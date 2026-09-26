/**
 * Repositório de Informações da Escala (dia/pessoa-dia) — Fase
 * FASE-MATRIZ-DEFINITIVA-E-INFORMACOES-DIA-1, Parte B1. Persistência e
 * queries, sem nenhuma lógica de UI; usa o domínio puro de
 * `lib/informacoesEscala.ts` para validar/normalizar antes de qualquer
 * escrita — a Firestore Rule é a segunda barreira, nunca a única (mesmo
 * princípio de `lembretesRepository.ts`).
 *
 * Coleção: `informacoesEscala/{contextoId}/itens/{infoId}`, onde
 * `contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId,
 * competencia)` — agrupa TODAS as informações de uma operação numa
 * competência num único caminho, então "todas da operação/competência" é
 * uma leitura da subcoleção inteira, sem `where()` nenhum.
 *
 * Mesmo assim, TODA consulta abaixo inclui `where('tipoEscala', '==', ...)`
 * e `where('alvoId', '==', ...)` explicitamente, redundantes com o path:
 * a Firestore Rule de `list` só aprova uma consulta cujos `where()` já
 * bastam, sozinhos, para provar a condição da Rule para qualquer documento
 * que a consulta possa retornar — nunca avalia campo a campo depois de
 * buscar o documento (mesmo ajuste documentado em
 * `listarLembretesAtribuidosDoGestor()`, `lembretesRepository.ts`). Como a
 * Rule usa `podeAdministrarJornada(resource.data.alvoId)`/
 * `podeAdministrarEscalaPlantao(resource.data.alvoId)` (e, para leitura
 * pública, também `resource.data.tipoEscala`), esses dois campos precisam
 * estar sempre presos por igualdade na query.
 *
 * `infoId` é gerado por `gerarUuid()` (nunca `titulo + data`). Timestamps
 * são string ISO via `new Date().toISOString()` — nunca
 * `Timestamp`/`serverTimestamp()`, mesmo padrão do projeto
 * (`lembretesRepository.ts`, `trocasRepository.ts`).
 *
 * `publicarInformacoesDaCompetencia()` é o serviço de publicação em lote
 * pedido pela Parte B1 — só promove itens RASCUNHO já existentes desta
 * operação/competência para PUBLICADA (`writeBatch`, atômico). Esta fase
 * NÃO conecta isso ao fluxo de publicação da Jornada/Plantão em si —
 * decidir QUANDO chamar isto (ex.: junto do botão "Publicar" da Jornada) é
 * trabalho da Parte B2/B3, para não acoplar prematuramente nem alterar o
 * fluxo de publicação existente nesta fase. Antes de montar o batch,
 * confere `LIMITE_PUBLICACAO_EM_LOTE_INFORMACOES_ESCALA` (400, folga sob o
 * teto real de 500 operações/batch do Firestore) e lança um erro claro se
 * excedido — nunca divide silenciosamente em vários batches, o que
 * quebraria a garantia de atomicidade que a função promete.
 *
 * `PUBLICADA` é imutável (conteúdo e identidade) a partir da transição
 * `RASCUNHO -> PUBLICADA` — `atualizarInformacaoEscala()` rejeita chamadas
 * sobre um item que não esteja `RASCUNHO`. Corrigir uma informação já
 * publicada é sempre: cancelar a antiga
 * (`cancelarInformacaoEscala()`, preserva histórico) + criar uma nova via
 * `criarInformacaoEscalaRascunho()` (novo `infoId`) + publicar de novo
 * quando pronta. Nenhuma UI para esse fluxo nesta fase — só a
 * infraestrutura que o suporta (ver `docs/spec/INFORMACOES_ESCALA.md`).
 *
 * Sem `observarInformacoes*` (realtime) nesta fase — B1 é só a base
 * tipada/persistência; a Parte B2/B3 acrescenta as variantes `onSnapshot`
 * espelhando exatamente os `listar*` abaixo, no momento em que a UI
 * realmente precisar de atualização em tempo real (mesmo par
 * `listar*`/`observar*` de `lembretesRepository.ts`).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  cancelarInformacaoEscala as cancelarInformacaoEscalaDominio,
  criarIdContextoInformacoesEscala,
  LIMITE_PUBLICACAO_EM_LOTE_INFORMACOES_ESCALA,
  normalizarEntradaInformacaoEscala,
  publicarInformacaoEscala as publicarInformacaoEscalaDominio,
  validarEntradaInformacaoEscala,
  type CategoriaInformacaoEscala,
  type EntradaInformacaoEscala,
  type InformacaoEscala,
  type StatusInformacaoEscala,
  type TipoEscalaInformacao,
  type VisibilidadeInformacaoEscala,
} from '../informacoesEscala';
import { gerarUuid } from '../uuid';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

function validarEntradaOuLancar(entrada: EntradaInformacaoEscala): void {
  const erros = validarEntradaInformacaoEscala(entrada);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
}

function colecaoItens(db: ReturnType<typeof exigirFirebase>['db'], contextoId: string) {
  return collection(db, 'informacoesEscala', contextoId, 'itens');
}

// --- Mapper: nunca um cast cego de snapshot.data(), sempre extração
// defensiva por campo (mesmo padrão de `lerLembretePessoal()`/`lerUsuario()`)
// — um documento corrompido/malformado vira um item com campos vazios,
// nunca derruba a tela nem é promovido silenciosamente a dado válido. ---
function lerInformacaoEscala(infoId: string, dados: Record<string, unknown>): InformacaoEscala {
  return {
    schemaVersion: 1,
    infoId,
    tipoEscala: dados.tipoEscala === 'PLANTAO' ? 'PLANTAO' : 'JORNADA',
    alvoId: typeof dados.alvoId === 'string' ? dados.alvoId : '',
    competencia: typeof dados.competencia === 'string' ? dados.competencia : '',
    data: typeof dados.data === 'string' ? dados.data : '',
    escopo: dados.escopo === 'PESSOA_DIA' ? 'PESSOA_DIA' : 'DIA',
    usuarioLogin: typeof dados.usuarioLogin === 'string' ? dados.usuarioLogin : null,
    categoria: (typeof dados.categoria === 'string' ? dados.categoria : 'OUTRO') as CategoriaInformacaoEscala,
    titulo: typeof dados.titulo === 'string' ? dados.titulo : '',
    descricao: typeof dados.descricao === 'string' ? dados.descricao : null,
    visibilidade: (
      typeof dados.visibilidade === 'string' ? dados.visibilidade : 'GESTORES'
    ) as VisibilidadeInformacaoEscala,
    status: (typeof dados.status === 'string' ? dados.status : 'RASCUNHO') as StatusInformacaoEscala,
    criadoPorLogin: typeof dados.criadoPorLogin === 'string' ? dados.criadoPorLogin : '',
    criadoEm: typeof dados.criadoEm === 'string' ? dados.criadoEm : '',
    atualizadoPorLogin: typeof dados.atualizadoPorLogin === 'string' ? dados.atualizadoPorLogin : '',
    atualizadoEm: typeof dados.atualizadoEm === 'string' ? dados.atualizadoEm : '',
    publicadoPorLogin: typeof dados.publicadoPorLogin === 'string' ? dados.publicadoPorLogin : null,
    publicadoEm: typeof dados.publicadoEm === 'string' ? dados.publicadoEm : null,
    canceladoPorLogin: typeof dados.canceladoPorLogin === 'string' ? dados.canceladoPorLogin : null,
    canceladoEm: typeof dados.canceladoEm === 'string' ? dados.canceladoEm : null,
    motivoCancelamento: typeof dados.motivoCancelamento === 'string' ? dados.motivoCancelamento : null,
  };
}

export async function criarInformacaoEscalaRascunho(
  entrada: EntradaInformacaoEscala,
  autorLogin: string,
): Promise<string> {
  exigirEscritaAdministrativaHabilitada();
  const conteudo = normalizarEntradaInformacaoEscala(entrada);
  validarEntradaOuLancar(conteudo);
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(conteudo.tipoEscala, conteudo.alvoId, conteudo.competencia);
  const infoId = gerarUuid();
  const agora = new Date().toISOString();
  const documento: InformacaoEscala = {
    ...conteudo,
    schemaVersion: 1,
    infoId,
    status: 'RASCUNHO',
    criadoPorLogin: autorLogin,
    criadoEm: agora,
    atualizadoPorLogin: autorLogin,
    atualizadoEm: agora,
    publicadoPorLogin: null,
    publicadoEm: null,
    canceladoPorLogin: null,
    canceladoEm: null,
    motivoCancelamento: null,
  };
  await setDoc(doc(colecaoItens(db, contextoId), infoId), removerUndefined(documento));
  return infoId;
}

/**
 * Só conteúdo (categoria/título/descrição/visibilidade) muda, e só enquanto
 * `RASCUNHO` — tipo, alvo, competência, data, escopo e pessoa são
 * imutáveis por design desde a criação (ver Rule). Uma vez `PUBLICADA`, o
 * item inteiro (conteúdo e identidade) fica congelado para sempre — a
 * única transição possível é `PUBLICADA -> CANCELADA`
 * (`cancelarInformacaoEscala()`, abaixo). Corrigir uma informação já
 * publicada nunca edita o documento: cancela o item antigo e cria um novo
 * `RASCUNHO` (`criarInformacaoEscalaRascunho()`, novo `infoId`) — ver
 * `docs/spec/INFORMACOES_ESCALA.md`.
 */
export async function atualizarInformacaoEscala(
  informacaoAtual: InformacaoEscala,
  entrada: Pick<EntradaInformacaoEscala, 'categoria' | 'titulo' | 'descricao' | 'visibilidade'>,
  autorLogin: string,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  if (informacaoAtual.status !== 'RASCUNHO') {
    throw new Error(
      'Só é possível editar o conteúdo de uma informação em RASCUNHO. '
      + 'Cancele esta informação e crie uma nova para corrigir uma informação já publicada.',
    );
  }
  const conteudo = normalizarEntradaInformacaoEscala({ ...informacaoAtual, ...entrada });
  validarEntradaOuLancar(conteudo);
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(
    informacaoAtual.tipoEscala,
    informacaoAtual.alvoId,
    informacaoAtual.competencia,
  );
  await updateDoc(doc(colecaoItens(db, contextoId), informacaoAtual.infoId), removerUndefined({
    categoria: conteudo.categoria,
    titulo: conteudo.titulo,
    descricao: conteudo.descricao,
    visibilidade: conteudo.visibilidade,
    atualizadoPorLogin: autorLogin,
    atualizadoEm: new Date().toISOString(),
  }));
}

/** Nunca hard delete de item PUBLICADA — cancelar preserva o documento e o histórico. */
export async function cancelarInformacaoEscala(
  informacaoAtual: InformacaoEscala,
  canceladoPorLogin: string,
  motivo: string | null,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const atualizado = cancelarInformacaoEscalaDominio(
    informacaoAtual, canceladoPorLogin, motivo, new Date().toISOString(),
  );
  const contextoId = criarIdContextoInformacoesEscala(
    informacaoAtual.tipoEscala,
    informacaoAtual.alvoId,
    informacaoAtual.competencia,
  );
  await updateDoc(doc(colecaoItens(db, contextoId), informacaoAtual.infoId), removerUndefined({
    status: atualizado.status,
    canceladoPorLogin: atualizado.canceladoPorLogin,
    canceladoEm: atualizado.canceladoEm,
    motivoCancelamento: atualizado.motivoCancelamento,
    atualizadoPorLogin: atualizado.atualizadoPorLogin,
    atualizadoEm: atualizado.atualizadoEm,
  }));
}

/**
 * Publica em lote (writeBatch atômico) todos os itens RASCUNHO de uma
 * operação/competência. Retorna quantos itens foram publicados. B2/B3
 * decidem quando chamar isto — nada nesta fase invoca automaticamente.
 */
export async function publicarInformacoesDaCompetencia(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
  publicadoPorLogin: string,
): Promise<number> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const rascunhos = await getDocs(query(
    colecaoItens(db, contextoId),
    where('tipoEscala', '==', tipoEscala),
    where('alvoId', '==', alvoId),
    where('status', '==', 'RASCUNHO'),
  ));
  if (rascunhos.empty) {
    return 0;
  }
  if (rascunhos.docs.length > LIMITE_PUBLICACAO_EM_LOTE_INFORMACOES_ESCALA) {
    throw new Error(
      `Há ${rascunhos.docs.length} informações em RASCUNHO nesta competência, acima do limite de `
      + `${LIMITE_PUBLICACAO_EM_LOTE_INFORMACOES_ESCALA} por publicação em lote. `
      + 'Nenhuma foi publicada — publique em grupos menores.',
    );
  }
  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  for (const snapshot of rascunhos.docs) {
    const atual = lerInformacaoEscala(snapshot.id, snapshot.data());
    const publicado = publicarInformacaoEscalaDominio(atual, publicadoPorLogin, agora);
    batch.update(doc(colecaoItens(db, contextoId), atual.infoId), removerUndefined({
      status: publicado.status,
      publicadoPorLogin: publicado.publicadoPorLogin,
      publicadoEm: publicado.publicadoEm,
      atualizadoPorLogin: publicado.atualizadoPorLogin,
      atualizadoEm: publicado.atualizadoEm,
    }));
  }
  await batch.commit();
  return rascunhos.docs.length;
}

export async function obterInformacaoEscala(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
  infoId: string,
): Promise<InformacaoEscala | null> {
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const snapshot = await getDoc(doc(colecaoItens(db, contextoId), infoId));
  return snapshot.exists() ? lerInformacaoEscala(snapshot.id, snapshot.data()) : null;
}

/** Dashboard — todas as informações (qualquer status) da operação/competência; uso administrativo. */
export async function listarInformacoesDaCompetencia(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
): Promise<InformacaoEscala[]> {
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const resultado = await getDocs(query(
    colecaoItens(db, contextoId),
    where('tipoEscala', '==', tipoEscala),
    where('alvoId', '==', alvoId),
  ));
  return resultado.docs.map((snapshot) => lerInformacaoEscala(snapshot.id, snapshot.data()));
}

/** Dashboard — informações (qualquer status) de um dia específico; cabeçalho da data na grade. */
export async function listarInformacoesDoDia(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
  data: string,
): Promise<InformacaoEscala[]> {
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const resultado = await getDocs(query(
    colecaoItens(db, contextoId),
    where('tipoEscala', '==', tipoEscala),
    where('alvoId', '==', alvoId),
    where('data', '==', data),
  ));
  return resultado.docs.map((snapshot) => lerInformacaoEscala(snapshot.id, snapshot.data()));
}

/** Dashboard — informações (qualquer status) de uma pessoa na competência; célula pessoa×dia. */
export async function listarInformacoesDaPessoa(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
  usuarioLogin: string,
): Promise<InformacaoEscala[]> {
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const resultado = await getDocs(query(
    colecaoItens(db, contextoId),
    where('tipoEscala', '==', tipoEscala),
    where('alvoId', '==', alvoId),
    where('usuarioLogin', '==', usuarioLogin),
  ));
  return resultado.docs.map((snapshot) => lerInformacaoEscala(snapshot.id, snapshot.data()));
}

/**
 * App — Hoje/Agenda: só PUBLICADA + visibilidade EQUIPE (qualquer pessoa
 * com acesso de consulta à operação). PESSOAS_AFETADAS é uma consulta
 * separada (`listarInformacoesPublicadasDaPessoa`, abaixo) — nunca uma
 * única query misturando as duas visibilidades, porque a Rule de `list`
 * só aprova uma consulta cujos `where()` já bastam sozinhos para provar a
 * condição (mesmo motivo de `listarLembretesAtribuidosDoGestor()`):
 * combinar as duas exigiria a Rule provar um OR que a query não restringe.
 */
export async function listarInformacoesPublicadasDaEquipe(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
): Promise<InformacaoEscala[]> {
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const resultado = await getDocs(query(
    colecaoItens(db, contextoId),
    where('tipoEscala', '==', tipoEscala),
    where('alvoId', '==', alvoId),
    where('status', '==', 'PUBLICADA'),
    where('visibilidade', '==', 'EQUIPE'),
  ));
  return resultado.docs.map((snapshot) => lerInformacaoEscala(snapshot.id, snapshot.data()));
}

/** App — Hoje/Agenda: só PUBLICADA + visibilidade PESSOAS_AFETADAS da própria pessoa autenticada. */
export async function listarInformacoesPublicadasDaPessoa(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
  usuarioLogin: string,
): Promise<InformacaoEscala[]> {
  const { db } = exigirFirebase();
  const contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia);
  const resultado = await getDocs(query(
    colecaoItens(db, contextoId),
    where('tipoEscala', '==', tipoEscala),
    where('alvoId', '==', alvoId),
    where('status', '==', 'PUBLICADA'),
    where('visibilidade', '==', 'PESSOAS_AFETADAS'),
    where('usuarioLogin', '==', usuarioLogin),
  ));
  return resultado.docs.map((snapshot) => lerInformacaoEscala(snapshot.id, snapshot.data()));
}
