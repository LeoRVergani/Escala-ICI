import {
  idDocumento,
  temErroBloqueante,
  type ResultadoParse,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';

import type {
  EventoEscala,
  PublicacaoEscala,
  TipoPublicacaoEscala,
  Usuario,
} from '../modelos';
import { agruparAlteracoesPorUsuario, calcularAlteracoesEscala } from '../revisoes';
import { gerarUuid } from '../uuid';
import { fatiarEmLotes } from './batches';
import { removerUndefined } from './sanitizar';
import {
  ambienteFirebaseAtual,
  escritaAdministrativaHabilitada,
  escritaOficialHabilitada,
  exigirEscritaAdministrativaHabilitada,
  exigirFirebase,
} from './shared';

export { escritaAdministrativaHabilitada, escritaOficialHabilitada };

function validarConjuntoPublicacao(documentos: readonly TurnosMes[]): {
  equipeId: string;
  competencia: string;
  chavePublicacao: string;
} {
  const primeiro = documentos[0];
  if (primeiro === undefined) {
    throw new Error('A publicação precisa conter ao menos uma escala.');
  }
  if (documentos.some((documento) =>
    documento.equipeId !== primeiro.equipeId
    || documento.competencia !== primeiro.competencia)) {
    throw new Error('Todos os documentos devem pertencer à mesma equipe e competência.');
  }
  for (const documento of documentos) {
    idDocumento(documento.equipeId, documento.login, documento.competencia);
  }
  return {
    equipeId: primeiro.equipeId,
    competencia: primeiro.competencia,
    chavePublicacao: `${primeiro.equipeId}_${primeiro.competencia}`,
  };
}

/**
 * HOTFIX-PUBLICAR-ESCALAS-RULES-BUDGET-1 — cada write de `turnosMes`/
 * `versoesEscala`/`eventosEscala` avalia `podeAdministrarJornada()`, que por
 * sua vez encadeia `matrizConcedeAdministracao()` (múltiplos `get()` sobre
 * `escoposOperacionais/{id}`, cada um reavaliando toda a função, mesmo com o
 * documento em cache) mais `eu()`/`minhasEquipesPermitidas()` (outro `get()`
 * sobre `usuarios/{login}`). Isso custa dezenas de "expressões" por write —
 * e o orçamento de avaliação de Rules é por COMMIT, não por documento.
 *
 * Com o limite antigo (100 colaboradores/lote) e até 3 writes por
 * colaborador (`turnosMes` + `versoesEscala` + `eventosEscala`), o primeiro
 * commit de uma publicação de equipe média já soma centenas de writes —
 * cada um reavaliando a cadeia acima — e estoura "maximum of 1000
 * expressions to evaluate" bem antes de qualquer verificação de posse falhar
 * de verdade (por isso o erro chega como `permission-denied` mesmo com a
 * matriz/hierarquia corretas). `salvarRascunho()` não sofre o mesmo estouro
 * porque grava só 1 write por colaborador.
 *
 * 3 colaboradores/lote × até 3 writes cada = até 9 writes, + os 2 writes
 * extras do primeiro lote (`historicoPublicacoes` + `publicacoesEscala`) =
 * no máximo 11 writes por commit — bem abaixo do que já estourava com ~40
 * colaboradores num único lote de 100. Não é ciência exata (o custo exato
 * por write não é documentado), mas dá margem generosa sem fatiar demais a
 * publicação em commits desnecessários.
 *
 * Isso NÃO piora a atomicidade da função: `publicarEscalas()` já não é uma
 * única transação — documentos acima de 100 (agora 3) já viravam múltiplos
 * commits, e as remoções/exclusão de rascunhos já rodam em lotes próprios
 * depois do loop principal. Reduzir o tamanho do lote só reduz quantos
 * colaboradores cada commit intermediário cobre.
 */
const COLABORADORES_POR_LOTE_PUBLICACAO = 3;

function idRevisao(chavePublicacao: string, revisao: number): string {
  return `${chavePublicacao}_${String(revisao).padStart(6, '0')}`;
}

function idDocumentoVersao(
  chavePublicacao: string,
  revisao: number,
  usuarioUid: string,
): string {
  return `${idRevisao(chavePublicacao, revisao)}_${usuarioUid}`;
}

function criarEventoEscala(
  publicacao: PublicacaoEscala,
  usuarioUid: string,
  alteracoes: EventoEscala['alteracoes'],
): EventoEscala {
  return {
    id: `${publicacao.id}_${usuarioUid}`,
    publicacaoId: publicacao.id,
    equipeId: publicacao.equipeId,
    competencia: publicacao.competencia,
    revisao: publicacao.revisao,
    tipo: publicacao.tipo,
    usuarioUid,
    motivo: publicacao.motivo ?? '',
    publicadoPor: publicacao.publicadoPor,
    publicadoEm: publicacao.publicadoEm,
    alteracoes,
  };
}

function motivoPublicacao(
  revisaoAtual: number,
  motivo: string,
  tipo: TipoPublicacaoEscala,
  revisaoOrigem: number | null = null,
): string {
  if (tipo === 'ROLLBACK') {
    return motivo.trim() || `Restauração da revisão ${revisaoOrigem ?? ''}`.trim();
  }
  if (revisaoAtual === 0) {
    return motivo.trim() || 'Publicação inicial da escala';
  }
  if (motivo.trim().length < 3) {
    throw new Error('Informe o motivo da alteração antes de publicar.');
  }
  return motivo.trim();
}

/**
 * DIAGNOSTICO-PUBLICAR-ESCALAS-FASE-1 — o hotfix que reduziu
 * `COLABORADORES_POR_LOTE_PUBLICACAO` para 3 não resolveu o
 * `permission-denied` observado em staging. Este helper isola o
 * `batch.commit()` de cada fase de `publicarEscalas()` para descobrir qual
 * delas está sendo recusada pelas Rules, sem esconder `erro.code`/
 * `erro.message` (o catch externo de `publicarEscalas()` continua livre
 * para converter a mensagem para a UI). Nunca loga login, nome, e-mail,
 * conteúdo de turno, token ou credencial — só metadados de fase/lote.
 */
async function commitComDiagnostico(parametros: {
  batch: WriteBatch;
  fase: string;
  lote: number;
  quantidadeOperacoes: number;
  equipeId: string;
  competencia: string;
}): Promise<void> {
  const { batch, fase, lote, quantidadeOperacoes, equipeId, competencia } = parametros;
  console.info('[publicarEscalas] commit-inicio', {
    fase,
    lote,
    quantidadeOperacoes,
    equipeId,
    competencia,
  });
  try {
    await batch.commit();
  } catch (erro) {
    console.error('[publicarEscalas] commit-falhou', {
      fase,
      lote,
      quantidadeOperacoes,
      equipeId,
      competencia,
      code: (erro as { code?: string } | null)?.code,
      message: (erro as { message?: string } | null)?.message,
    });
    throw erro;
  }
  console.info('[publicarEscalas] commit-ok', {
    fase,
    lote,
    quantidadeOperacoes,
  });
}

export async function salvarRascunho(
  resultado: ResultadoParse,
  enviadoPor: Usuario,
  nomeArquivo: string,
): Promise<string> {
  exigirEscritaAdministrativaHabilitada();
  if (temErroBloqueante(resultado.erros)) {
    throw new Error('Não é permitido persistir uma importação com erros bloqueantes.');
  }
  const primeiro = resultado.documentos[0];
  if (primeiro === undefined) {
    throw new Error('Não é permitido salvar uma escala sem colaboradores.');
  }
  if (resultado.documentos.some((documento) =>
    documento.equipeId !== primeiro.equipeId || documento.competencia !== primeiro.competencia)) {
    throw new Error('Todos os documentos do rascunho devem pertencer ao mesmo alvo e competência.');
  }

  const { db } = exigirFirebase();
  const importacaoId = gerarUuid();
  const lotes = fatiarEmLotes(resultado.documentos, 499);

  for (const [indice, documentos] of lotes.entries()) {
    const batch = writeBatch(db);
    for (const documento of documentos) {
      const referencia = doc(
        db,
        'rascunhosTurnosMes',
        idDocumento(documento.equipeId, documento.login, documento.competencia),
      );
      batch.set(referencia, removerUndefined({
        ...documento,
        status: 'RASCUNHO',
        importacaoId,
        publicadoPor: null,
        publicadoEm: null,
        atualizadoEm: serverTimestamp(),
      }));
    }

    if (indice === 0) {
      batch.set(doc(db, 'importacoes', importacaoId), removerUndefined({
        equipeId: primeiro.equipeId,
        competencia: primeiro.competencia,
        enviadoPor: enviadoPor.login,
        nomeArquivo,
        periodoInicio: resultado.periodoInicio,
        periodoFim: resultado.periodoFim,
        totalDocumentos: resultado.documentos.length,
        status: 'RASCUNHO',
        criadoEm: serverTimestamp(),
      }));
    }
    await batch.commit();
  }

  return importacaoId;
}

export async function publicarEscalas(
  documentos: readonly TurnosMes[],
  publicadoPor: string,
  motivo = '',
): Promise<PublicacaoEscala> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const { equipeId, competencia, chavePublicacao } = validarConjuntoPublicacao(documentos);
  const estadoRef = doc(db, 'publicacoesEscala', chavePublicacao);
  const estadoAtual = await getDoc(estadoRef);
  const revisaoAtual = Number(estadoAtual.data()?.revisaoAtual ?? 0);
  const ativos = await getDocs(query(
    collection(db, 'turnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ));
  const documentosAtivos = ativos.docs.map((snapshot) => snapshot.data() as TurnosMes);
  const rascunhosAtuais = await getDocs(query(
    collection(db, 'rascunhosTurnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ));
  const alteracoes = calcularAlteracoesEscala(documentosAtivos, documentos);
  if (revisaoAtual > 0 && alteracoes.length === 0) {
    throw new Error('Nenhuma alteração foi encontrada em relação à revisão publicada.');
  }
  const alteracoesPorUsuario = agruparAlteracoesPorUsuario(alteracoes);
  const loginsPublicados = new Set(documentos.map(({ login }) => login));
  const documentosRemovidos = ativos.docs.filter((snapshot) =>
    !loginsPublicados.has(String(snapshot.data().login ?? '')));
  const revisao = revisaoAtual + 1;
  const publicadoEm = new Date().toISOString();
  const publicacao: PublicacaoEscala = {
    id: idRevisao(chavePublicacao, revisao),
    chavePublicacao,
    equipeId,
    competencia,
    revisao,
    tipo: 'PUBLICACAO',
    revisaoOrigem: null,
    revisaoSubstituida: revisaoAtual > 0 ? revisaoAtual : null,
    totalDocumentos: documentos.length,
    motivo: motivoPublicacao(revisaoAtual, motivo, 'PUBLICACAO'),
    totalColaboradoresAfetados: alteracoesPorUsuario.size,
    totalDiasAlterados: alteracoes.length,
    publicadoPor,
    publicadoEm,
  };

  if (ambienteFirebaseAtual !== 'producao') {
    console.info('[publicarEscalas] plano de escrita', {
      equipeId,
      competencia,
      totalDocumentos: documentos.length,
      turnosMesIds: documentos.map((documento) =>
        idDocumento(equipeId, documento.login, competencia)),
      versoesEscalaIds: documentos.map((documento) =>
        idDocumentoVersao(chavePublicacao, revisao, documento.login)),
      eventosIds: [...alteracoesPorUsuario.keys()].map((login) =>
        `${publicacao.id}_${login}`),
      rascunhosParaExcluirIds: rascunhosAtuais.docs.map((snapshot) => snapshot.id),
      estadoPublicacaoId: chavePublicacao,
      historicoId: publicacao.id,
    });
  }

  try {
    for (const [indice, lote] of fatiarEmLotes(documentos, COLABORADORES_POR_LOTE_PUBLICACAO).entries()) {
      const batch = writeBatch(db);
      let quantidadeOperacoes = 0;
      for (const documento of lote) {
        const publicado: TurnosMes = {
          ...documento,
          status: 'PUBLICADA',
          publicadoPor,
          publicadoEm,
          atualizadoEm: publicadoEm,
        };
        batch.set(
          doc(db, 'turnosMes', idDocumento(equipeId, documento.login, competencia)),
          removerUndefined(publicado),
        );
        quantidadeOperacoes += 1;
        batch.set(
          doc(db, 'versoesEscala', idDocumentoVersao(chavePublicacao, revisao, documento.login)),
          removerUndefined({ ...publicado, chavePublicacao, revisao }),
        );
        quantidadeOperacoes += 1;
        const alteracoesDoUsuario = alteracoesPorUsuario.get(documento.login);
        if (alteracoesDoUsuario !== undefined) {
          const evento = criarEventoEscala(publicacao, documento.login, alteracoesDoUsuario);
          batch.set(doc(db, 'eventosEscala', evento.id), removerUndefined(evento));
          quantidadeOperacoes += 1;
        }
      }
      if (indice === 0) {
        batch.set(doc(db, 'historicoPublicacoes', publicacao.id), removerUndefined(publicacao));
        quantidadeOperacoes += 1;
        batch.set(estadoRef, removerUndefined({
          id: chavePublicacao,
          equipeId,
          competencia,
          revisaoAtual: revisao,
          ultimaPublicacaoId: publicacao.id,
          atualizadoPor: publicadoPor,
          atualizadoEm: publicadoEm,
        }));
        quantidadeOperacoes += 1;
      }
      await commitComDiagnostico({
        batch,
        fase: 'publicacao-lote-principal',
        lote: indice,
        quantidadeOperacoes,
        equipeId,
        competencia,
      });
    }

    for (const [indice, lote] of fatiarEmLotes(documentosRemovidos, 150).entries()) {
      const batch = writeBatch(db);
      let quantidadeOperacoes = 0;
      for (const snapshot of lote) {
        const login = String(snapshot.data().login ?? '');
        batch.delete(snapshot.ref);
        quantidadeOperacoes += 1;
        const alteracoesDoUsuario = alteracoesPorUsuario.get(login);
        if (alteracoesDoUsuario !== undefined) {
          const evento = criarEventoEscala(publicacao, login, alteracoesDoUsuario);
          batch.set(doc(db, 'eventosEscala', evento.id), removerUndefined(evento));
          quantidadeOperacoes += 1;
        }
      }
      await commitComDiagnostico({
        batch,
        fase: 'exclusao-turnos-obsoletos',
        lote: indice,
        quantidadeOperacoes,
        equipeId,
        competencia,
      });
    }

    // A publicação substitui o rascunho da competência inteira: limpa todos
    // os rascunhos existentes em vez de tentar apagar por usuarioUid, o que
    // falhava (permission-denied) sempre que algum colaborador publicado ou
    // removido não tinha rascunho persistido — `resource` inexistente faz a
    // regra de delete negar o batch inteiro.
    for (const [indice, lote] of fatiarEmLotes(rascunhosAtuais.docs, 450).entries()) {
      const batch = writeBatch(db);
      for (const snapshot of lote) {
        batch.delete(snapshot.ref);
      }
      await commitComDiagnostico({
        batch,
        fase: 'limpeza-rascunhos',
        lote: indice,
        quantidadeOperacoes: lote.length,
        equipeId,
        competencia,
      });
    }
  } catch (erro) {
    if (ambienteFirebaseAtual !== 'producao') {
      console.error('[publicarEscalas] falha ao publicar', {
        codigo: (erro as { code?: string } | null)?.code,
        mensagem: (erro as { message?: string } | null)?.message,
        equipeId,
        competencia,
        totalDocumentos: documentos.length,
      });
    }
    throw erro;
  }
  return publicacao;
}

export async function reverterPublicacao(
  equipeId: string,
  competencia: string,
  revisaoOrigem: number,
  publicadoPor: string,
  motivo = '',
): Promise<{ publicacao: PublicacaoEscala; documentos: TurnosMes[] }> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const chavePublicacao = `${equipeId}_${competencia}`;
  const estadoRef = doc(db, 'publicacoesEscala', chavePublicacao);
  const estadoAtual = await getDoc(estadoRef);
  const revisaoAtual = Number(estadoAtual.data()?.revisaoAtual ?? 0);
  if (revisaoAtual < 1 || revisaoOrigem < 1 || revisaoOrigem >= revisaoAtual) {
    throw new Error('Selecione uma revisão anterior válida para restaurar.');
  }

  const chaveVersao = idRevisao(chavePublicacao, revisaoOrigem);
  const snapshotVersao = await getDocs(query(
    collection(db, 'versoesEscala'),
    where('equipeId', '==', equipeId),
    where('chavePublicacao', '==', chavePublicacao),
    where('revisao', '==', revisaoOrigem),
  ));
  const documentos = snapshotVersao.docs.map((snapshot) => {
    const dados = snapshot.data();
    const { chavePublicacao: _chave, revisao: _revisao, ...documento } = dados;
    void _chave;
    void _revisao;
    return documento as unknown as TurnosMes;
  });
  if (documentos.length === 0) {
    throw new Error(`A revisão ${revisaoOrigem} não possui documentos restauráveis.`);
  }

  const ativos = await getDocs(query(
    collection(db, 'turnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ));
  const documentosAtivos = ativos.docs.map((snapshot) => snapshot.data() as TurnosMes);
  const alteracoes = calcularAlteracoesEscala(documentosAtivos, documentos);
  if (alteracoes.length === 0) {
    throw new Error('A revisão selecionada possui o mesmo conteúdo da escala ativa.');
  }
  const alteracoesPorUsuario = agruparAlteracoesPorUsuario(alteracoes);
  const revisao = revisaoAtual + 1;
  const publicadoEm = new Date().toISOString();
  const publicacao: PublicacaoEscala = {
    id: idRevisao(chavePublicacao, revisao),
    chavePublicacao,
    equipeId,
    competencia,
    revisao,
    tipo: 'ROLLBACK',
    revisaoOrigem,
    revisaoSubstituida: revisaoAtual,
    totalDocumentos: documentos.length,
    motivo: motivoPublicacao(revisaoAtual, motivo, 'ROLLBACK', revisaoOrigem),
    totalColaboradoresAfetados: alteracoesPorUsuario.size,
    totalDiasAlterados: alteracoes.length,
    publicadoPor,
    publicadoEm,
  };

  const loginsRestaurados = new Set(documentos.map(({ login }) => login));
  const obsoletos = ativos.docs.filter((snapshot) =>
    !loginsRestaurados.has(String(snapshot.data().login ?? '')));

  const batch = writeBatch(db);
  for (const snapshot of obsoletos) {
    const login = String(snapshot.data().login ?? '');
    batch.delete(snapshot.ref);
    const alteracoesDoUsuario = alteracoesPorUsuario.get(login);
    if (alteracoesDoUsuario !== undefined) {
      const evento = criarEventoEscala(publicacao, login, alteracoesDoUsuario);
      batch.set(doc(db, 'eventosEscala', evento.id), removerUndefined(evento));
    }
  }
  for (const documento of documentos) {
    const restaurado: TurnosMes = {
      ...documento,
      status: 'PUBLICADA',
      publicadoPor,
      publicadoEm,
      atualizadoEm: publicadoEm,
    };
    batch.set(
      doc(db, 'turnosMes', idDocumento(equipeId, documento.login, competencia)),
      removerUndefined(restaurado),
    );
    batch.set(
      doc(db, 'versoesEscala', idDocumentoVersao(chavePublicacao, revisao, documento.login)),
      removerUndefined({ ...restaurado, chavePublicacao, revisao, restauradaDe: chaveVersao }),
    );
    const alteracoesDoUsuario = alteracoesPorUsuario.get(documento.login);
    if (alteracoesDoUsuario !== undefined) {
      const evento = criarEventoEscala(publicacao, documento.login, alteracoesDoUsuario);
      batch.set(doc(db, 'eventosEscala', evento.id), removerUndefined(evento));
    }
  }
  batch.set(doc(db, 'historicoPublicacoes', publicacao.id), removerUndefined(publicacao));
  batch.set(estadoRef, removerUndefined({
    id: chavePublicacao,
    equipeId,
    competencia,
    revisaoAtual: revisao,
    ultimaPublicacaoId: publicacao.id,
    atualizadoPor: publicadoPor,
    atualizadoEm: publicadoEm,
  }));
  await batch.commit();
  return { publicacao, documentos };
}

/**
 * `merge: true` já preserva qualquer campo omitido — por isso
 * `removerUndefined()` aqui não é só defensivo: é o que faz um `criadoEm`
 * ausente (cadastros de antes desse campo existir) ser simplesmente
 * ignorado em vez de sobrescrito com `undefined`, o que o Firestore rejeita.
 */
export async function salvarUsuario(usuario: Usuario): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'usuarios', usuario.login), removerUndefined(usuario), { merge: true });
}

export async function salvarUsuarios(usuarios: readonly Usuario[]): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  if (usuarios.length === 0) {
    return;
  }
  const equipeId = usuarios[0]?.equipeId;
  if (!equipeId || usuarios.some((usuario) => usuario.equipeId !== equipeId)) {
    throw new Error('Todos os usuários cadastrados devem pertencer à mesma equipe.');
  }
  const { db } = exigirFirebase();
  for (const lote of fatiarEmLotes(usuarios, 500)) {
    const batch = writeBatch(db);
    for (const usuario of lote) {
      batch.set(doc(db, 'usuarios', usuario.login), removerUndefined(usuario));
    }
    await batch.commit();
  }
}

/**
 * Atualiza só os aliases (e o carimbo de atualização) em vez de regravar o
 * usuário inteiro — usada pela conciliação de importação, que só precisa
 * mudar esse campo e não deveria arriscar reenviar o resto do cadastro.
 */
export async function atualizarAliasesPlanilha(
  login: string,
  aliasesPlanilha: readonly string[],
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'usuarios', login), removerUndefined({
    aliasesPlanilha: [...aliasesPlanilha],
    atualizadoEm: new Date().toISOString(),
  }));
}

export async function excluirRascunho(documento: TurnosMes): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  if (documento.status !== 'RASCUNHO') {
    throw new Error('Somente rascunhos podem ser excluídos.');
  }
  await deleteDoc(doc(
    db,
    'rascunhosTurnosMes',
    idDocumento(documento.equipeId, documento.login, documento.competencia),
  ));
}

/**
 * Inclui um colaborador na grade/rascunho da competência (Fase 3K-D2A).
 * Só adiciona — nunca decide se o colaborador continua ativo no sistema,
 * isso é responsabilidade exclusiva do cadastro de usuário.
 */
export async function adicionarMembroRascunho(documento: TurnosMes): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  if (documento.status !== 'RASCUNHO') {
    throw new Error('Somente rascunhos podem ser incluídos diretamente na grade.');
  }
  const { db } = exigirFirebase();
  await setDoc(
    doc(db, 'rascunhosTurnosMes', idDocumento(documento.equipeId, documento.login, documento.competencia)),
    removerUndefined({ ...documento, importacaoId: documento.importacaoId ?? null, publicadoPor: null, publicadoEm: null }),
  );
}

export async function atualizarNome(login: string, nome: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'usuarios', login), { nome });
}
