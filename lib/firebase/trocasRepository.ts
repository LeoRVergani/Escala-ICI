import {
  calcularTotais,
  idDocumento,
  resolverJornadaDia,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Usuario } from '../modelos';
import {
  STATUS_TROCA_ATIVOS,
  aplicarTrocaNosDias,
  transicaoPermitida,
  trocaDesatualizada,
  validarNovaSolicitacaoTroca,
  type AtorTroca,
  type EventoHistoricoTroca,
  type NotificacaoTroca,
  type SolicitacaoTrocaReal,
  type StatusTroca,
  type TipoNotificacaoTroca,
} from '../trocasEscala';
import { gerarUuid } from '../uuid';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * Hotfix (ver lib/dataSegura.ts): antes esta função recebia `descricao`/`em`
 * como argumentos posicionais, e todo ponto de chamada os passava na ordem
 * errada — `em` acabava gravado com o texto da descrição em vez de uma data,
 * e `new Date(evento.em)` virava `Invalid Date` ao renderizar o histórico
 * (`RangeError: Invalid time value`). Parâmetro nomeado único elimina essa
 * classe de erro: não há mais posição para trocar.
 */
function criarEventoHistorico(parametros: {
  tipo: string;
  porLogin: string | null;
  porNome: string | null;
  porPerfil: AtorTroca;
  em: string;
  descricao: string;
}): EventoHistoricoTroca {
  return { ...parametros };
}

/**
 * Devolve `null` (em vez de montar a notificação) quando o destinatário é a
 * própria pessoa que executou a ação — as Firestore Rules já rejeitam
 * `destinatarioLogin == criadoPorLogin` (`create` de `notificacoesTroca`),
 * e sem essa checagem aqui isso derrubaria o `writeBatch`/`runTransaction`
 * inteiro (inclusive a troca em si) por causa de um efeito colateral que
 * ninguém precisa: avisar alguém de uma ação que ela mesma fez. Cenário
 * real: um gestor que também é parte da troca (solicitante ou destinatário)
 * aprovando a própria solicitação.
 */
function criarNotificacaoTroca(parametros: {
  destinatarioLogin: string;
  equipeId: string;
  tipo: TipoNotificacaoTroca;
  titulo: string;
  mensagem: string;
  trocaId: string;
  criadoPorLogin: string;
  em: string;
}): NotificacaoTroca | null {
  if (parametros.destinatarioLogin === parametros.criadoPorLogin) {
    return null;
  }
  return {
    id: gerarUuid(),
    destinatarioLogin: parametros.destinatarioLogin,
    equipeId: parametros.equipeId,
    tipo: parametros.tipo,
    titulo: parametros.titulo,
    mensagem: parametros.mensagem,
    trocaId: parametros.trocaId,
    criadoPorLogin: parametros.criadoPorLogin,
    criadoEm: parametros.em,
    lidaEm: null,
    acao: 'ABRIR_TROCA',
  };
}

/**
 * Diagnóstico temporário (hotfix 2 — investigação de permission-denied
 * intermitente): loga a operação, o código/mensagem do erro do Firestore e
 * o contexto de identidade envolvido, sem nenhum dado sensível (só logins
 * corporativos, já visíveis nas telas, e o `trocaId`). Não substitui a
 * mensagem amigável mostrada ao usuário — só ajuda a diagnosticar em
 * produção/staging via console do navegador.
 */
function logOperacaoTroca(operacao: string, falha: unknown, contexto: Record<string, unknown>): void {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String((falha as { code?: unknown }).code)
    : 'desconhecido';
  const mensagem = falha instanceof Error ? falha.message : String(falha);
  console.error(`[trocasRepository] ${operacao} falhou — code=${codigo} message=${mensagem}`, contexto);
}

function horarioDoDia(documento: TurnosMes | null, catalogo: Record<string, TipoTurno>, data: string): {
  codigo: string;
  horario: string;
} {
  const jornada = resolverJornadaDia(documento, catalogo, data);
  return {
    codigo: jornada.codigo,
    horario: jornada.inicio && jornada.fim ? `${jornada.inicio}–${jornada.fim}` : '',
  };
}

// --- Leitura ---

/**
 * Duas consultas (uma por papel) em vez de uma consulta `or()`: cada uma usa
 * exatamente um dos índices compostos declarados em `firestore.indexes.json`
 * (`equipeId+competencia+solicitanteLogin` / `...+destinatarioLogin`), sem
 * depender do planejador de consultas compostas para uma tela que precisa
 * ser tempo real (a resposta do colega tem que aparecer sem F5).
 */
export function observarTrocasDoUsuario(
  equipeId: string,
  competencia: string,
  login: string,
  aoAtualizar: (trocas: SolicitacaoTrocaReal[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  let comoSolicitante: SolicitacaoTrocaReal[] = [];
  let comoDestinatario: SolicitacaoTrocaReal[] = [];

  function emitir() {
    const porId = new Map<string, SolicitacaoTrocaReal>();
    for (const troca of [...comoSolicitante, ...comoDestinatario]) {
      porId.set(troca.trocaId, troca);
    }
    aoAtualizar([...porId.values()].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)));
  }

  const cancelarSolicitante = onSnapshot(query(
    collection(db, 'trocasEscala'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
    where('solicitanteLogin', '==', login),
  ), (snapshot) => {
    comoSolicitante = snapshot.docs.map((documento) => documento.data() as SolicitacaoTrocaReal);
    emitir();
  }, (falha) => aoFalhar(falha instanceof Error ? falha : new Error('Falha ao acompanhar suas trocas.')));

  const cancelarDestinatario = onSnapshot(query(
    collection(db, 'trocasEscala'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
    where('destinatarioLogin', '==', login),
  ), (snapshot) => {
    comoDestinatario = snapshot.docs.map((documento) => documento.data() as SolicitacaoTrocaReal);
    emitir();
  }, (falha) => aoFalhar(falha instanceof Error ? falha : new Error('Falha ao acompanhar trocas recebidas.')));

  return () => {
    cancelarSolicitante();
    cancelarDestinatario();
  };
}

/** Traz todos os status da competência; o Dashboard filtra por aba localmente (mesmo padrão do protótipo). */
export function observarTrocasDoGestor(
  equipeId: string,
  competencia: string,
  aoAtualizar: (trocas: SolicitacaoTrocaReal[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, 'trocasEscala'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ), (snapshot) => aoAtualizar(
    snapshot.docs.map((documento) => documento.data() as SolicitacaoTrocaReal),
  ), (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar as trocas da equipe.'),
  ));
}

export function observarNotificacoesTroca(
  login: string,
  aoAtualizar: (notificacoes: NotificacaoTroca[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, 'notificacoesTroca'),
    where('destinatarioLogin', '==', login),
  ), (snapshot) => {
    const notificacoes = snapshot.docs
      .map((documento) => documento.data() as NotificacaoTroca)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    aoAtualizar(notificacoes);
  }, (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar notificações de troca.'),
  ));
}

export async function buscarTroca(trocaId: string): Promise<SolicitacaoTrocaReal | null> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasEscala', trocaId));
  return snapshot.exists() ? snapshot.data() as SolicitacaoTrocaReal : null;
}

export async function marcarNotificacaoTrocaComoLida(notificacaoId: string): Promise<void> {
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, 'notificacoesTroca', notificacaoId), { lidaEm: agora });
  await batch.commit();
}

// --- Escrita ---

function garantirTransicao(de: StatusTroca, para: StatusTroca): void {
  if (!transicaoPermitida(de, para)) {
    throw new Error(`Transição de ${de} para ${para} não é permitida.`);
  }
}

export interface EntradaCriarSolicitacaoTroca {
  equipeId: string;
  competencia: string;
  data: string;
  solicitante: Pick<Usuario, 'login' | 'nome' | 'ativo'>;
  destinatario: Pick<Usuario, 'login' | 'nome' | 'ativo'>;
  mensagem: string;
  catalogo: Record<string, TipoTurno>;
}

export async function criarSolicitacaoTroca(entrada: EntradaCriarSolicitacaoTroca): Promise<string> {
  const { db } = exigirFirebase();
  const { equipeId, competencia, data, solicitante, destinatario, mensagem, catalogo } = entrada;

  const [snapshotSolicitante, snapshotDestinatario] = await Promise.all([
    getDoc(doc(db, 'turnosMes', idDocumento(equipeId, solicitante.login, competencia))),
    getDoc(doc(db, 'turnosMes', idDocumento(equipeId, destinatario.login, competencia))),
  ]);
  if (!snapshotSolicitante.exists() || !snapshotDestinatario.exists()) {
    throw new Error('Escala publicada não encontrada para um dos colaboradores.');
  }
  const docSolicitante = snapshotSolicitante.data() as TurnosMes;
  const docDestinatario = snapshotDestinatario.data() as TurnosMes;

  const erros = validarNovaSolicitacaoTroca({
    solicitanteLogin: solicitante.login,
    destinatarioLogin: destinatario.login,
    solicitanteAtivo: solicitante.ativo,
    destinatarioAtivo: destinatario.ativo,
    diaSolicitante: docSolicitante.dias[data],
    diaDestinatario: docDestinatario.dias[data],
  });
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }

  // Checagem best-effort de duplicidade: as Firestore Rules não conseguem
  // impedir uma segunda solicitação ativa para o mesmo dia (precisaria de
  // uma consulta antes do `create`, ver docs/spec/TROCA_ESCALA_PLANO.md
  // seção 9.6) — isto reduz o caso comum, não é garantia contra concorrência.
  const existentes = await getDocs(query(
    collection(db, 'trocasEscala'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
    where('solicitanteLogin', '==', solicitante.login),
  ));
  const duplicada = existentes.docs.some((documento) => {
    const dados = documento.data() as SolicitacaoTrocaReal;
    return dados.data === data && STATUS_TROCA_ATIVOS.includes(dados.status);
  });
  if (duplicada) {
    throw new Error('Você já tem uma solicitação em andamento para esse dia.');
  }

  const jornadaSolicitante = horarioDoDia(docSolicitante, catalogo, data);
  const jornadaDestinatario = horarioDoDia(docDestinatario, catalogo, data);
  const trocaId = gerarUuid();
  const agora = new Date().toISOString();

  const troca: SolicitacaoTrocaReal = {
    trocaId,
    equipeId,
    competencia,
    solicitanteLogin: solicitante.login,
    solicitanteNome: solicitante.nome,
    destinatarioLogin: destinatario.login,
    destinatarioNome: destinatario.nome,
    data,
    turnoSolicitanteAntes: jornadaSolicitante.codigo,
    horarioSolicitanteAntes: jornadaSolicitante.horario,
    turnoDestinatarioAntes: jornadaDestinatario.codigo,
    horarioDestinatarioAntes: jornadaDestinatario.horario,
    status: 'PENDENTE_USUARIO',
    mensagemSolicitante: mensagem.trim() || null,
    motivoRecusa: null,
    criadoEm: agora,
    atualizadoEm: agora,
    respondidoEm: null,
    aprovadoEm: null,
    publicadoEm: null,
    gestorLogin: null,
    gestorNome: null,
    historico: [
      criarEventoHistorico({
        tipo: 'SOLICITACAO_CRIADA',
        porLogin: solicitante.login,
        porNome: solicitante.nome,
        porPerfil: 'SOLICITANTE',
        em: agora,
        descricao: 'Solicitação criada',
      }),
    ],
    snapshotValidacao: {
      solicitanteDocId: idDocumento(equipeId, solicitante.login, competencia),
      destinatarioDocId: idDocumento(equipeId, destinatario.login, competencia),
      turnoSolicitanteOriginal: jornadaSolicitante.codigo,
      turnoDestinatarioOriginal: jornadaDestinatario.codigo,
    },
  };

  const notificacao = criarNotificacaoTroca({
    destinatarioLogin: destinatario.login,
    equipeId,
    tipo: 'TROCA_SOLICITADA',
    titulo: 'Nova solicitação de troca',
    mensagem: `${solicitante.nome} quer trocar o turno do dia ${data} com você.`,
    trocaId,
    criadoPorLogin: solicitante.login,
    em: agora,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'trocasEscala', trocaId), removerUndefined(troca));
  if (notificacao) {
    batch.set(doc(db, 'notificacoesTroca', notificacao.id), removerUndefined(notificacao));
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTroca('criarSolicitacaoTroca', falha, {
      trocaId,
      equipeId,
      competencia,
      solicitanteLogin: solicitante.login,
      destinatarioLogin: destinatario.login,
    });
    throw falha;
  }
  return trocaId;
}

export async function cancelarSolicitacaoTroca(
  trocaId: string,
  solicitante: Pick<Usuario, 'login' | 'nome'>,
): Promise<void> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasEscala', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaReal;
  if (troca.solicitanteLogin !== solicitante.login) {
    throw new Error('Só quem solicitou a troca pode cancelá-la.');
  }
  garantirTransicao(troca.status, 'CANCELADA_SOLICITANTE');

  const agora = new Date().toISOString();
  const notificacao = criarNotificacaoTroca({
    destinatarioLogin: troca.destinatarioLogin,
    equipeId: troca.equipeId,
    tipo: 'TROCA_CANCELADA',
    titulo: 'Solicitação de troca cancelada',
    mensagem: `${solicitante.nome} cancelou a solicitação de troca do dia ${troca.data}.`,
    trocaId,
    criadoPorLogin: solicitante.login,
    em: agora,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasEscala', trocaId), removerUndefined({
    status: 'CANCELADA_SOLICITANTE' as StatusTroca,
    atualizadoEm: agora,
    historico: [
      ...troca.historico,
      criarEventoHistorico({
        tipo: 'CANCELADA_SOLICITANTE',
        porLogin: solicitante.login,
        porNome: solicitante.nome,
        porPerfil: 'SOLICITANTE',
        em: agora,
        descricao: 'Cancelada pelo solicitante',
      }),
    ],
  }));
  if (notificacao) {
    batch.set(doc(db, 'notificacoesTroca', notificacao.id), removerUndefined(notificacao));
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTroca('cancelarSolicitacaoTroca', falha, {
      trocaId,
      equipeId: troca.equipeId,
      statusAtual: troca.status,
      statusNovo: 'CANCELADA_SOLICITANTE',
      solicitanteLogin: solicitante.login,
    });
    throw falha;
  }
}

export async function responderSolicitacaoTroca(
  trocaId: string,
  destinatario: Pick<Usuario, 'login' | 'nome'>,
  aceitar: boolean,
  motivoRecusa?: string,
): Promise<void> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasEscala', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaReal;
  if (troca.destinatarioLogin !== destinatario.login) {
    throw new Error('Só o colega convidado pode responder esta troca.');
  }
  const novoStatus: StatusTroca = aceitar ? 'PENDENTE_GESTOR' : 'RECUSADA_USUARIO';
  garantirTransicao(troca.status, novoStatus);

  const agora = new Date().toISOString();
  const notificacao = criarNotificacaoTroca({
    destinatarioLogin: troca.solicitanteLogin,
    equipeId: troca.equipeId,
    tipo: aceitar ? 'TROCA_ACEITA_AGUARDANDO_GESTOR' : 'TROCA_RECUSADA_USUARIO',
    titulo: aceitar ? 'Troca aceita, aguardando o gestor' : 'Troca recusada pelo colega',
    mensagem: aceitar
      ? `${destinatario.nome} aceitou a troca do dia ${troca.data}. Agora o gestor precisa aprovar.`
      : `${destinatario.nome} recusou a troca do dia ${troca.data}.`,
    trocaId,
    criadoPorLogin: destinatario.login,
    em: agora,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasEscala', trocaId), removerUndefined({
    status: novoStatus,
    atualizadoEm: agora,
    respondidoEm: agora,
    motivoRecusa: aceitar ? null : (motivoRecusa?.trim() || 'Recusada pelo colega.'),
    historico: [
      ...troca.historico,
      criarEventoHistorico({
        tipo: aceitar ? 'ACEITE_DESTINATARIO' : 'RECUSA_DESTINATARIO',
        porLogin: destinatario.login,
        porNome: destinatario.nome,
        porPerfil: 'DESTINATARIO',
        em: agora,
        descricao: aceitar ? 'Aceite do colega — encaminhada para o gestor' : `Recusada pelo colega${motivoRecusa?.trim() ? `: ${motivoRecusa.trim()}` : ''}`,
      }),
    ],
  }));
  if (notificacao) {
    batch.set(doc(db, 'notificacoesTroca', notificacao.id), removerUndefined(notificacao));
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTroca('responderSolicitacaoTroca', falha, {
      trocaId,
      equipeId: troca.equipeId,
      statusAtual: troca.status,
      statusNovo: novoStatus,
      destinatarioLogin: destinatario.login,
    });
    throw falha;
  }
}

export async function gestorRecusarTroca(
  trocaId: string,
  gestor: Pick<Usuario, 'login' | 'nome'>,
  motivo: string,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasEscala', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaReal;
  garantirTransicao(troca.status, 'RECUSADA_GESTOR');

  const agora = new Date().toISOString();
  const motivoFinal = motivo.trim() || 'Recusada pelo gestor.';
  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasEscala', trocaId), removerUndefined({
    status: 'RECUSADA_GESTOR' as StatusTroca,
    atualizadoEm: agora,
    motivoRecusa: motivoFinal,
    gestorLogin: gestor.login,
    gestorNome: gestor.nome,
    historico: [
      ...troca.historico,
      criarEventoHistorico({
        tipo: 'RECUSA_GESTOR',
        porLogin: gestor.login,
        porNome: gestor.nome,
        porPerfil: 'GESTOR',
        em: agora,
        descricao: `Recusada pelo gestor: ${motivoFinal}`,
      }),
    ],
  }));
  for (const destinatarioLogin of [troca.solicitanteLogin, troca.destinatarioLogin]) {
    const notificacao = criarNotificacaoTroca({
      destinatarioLogin,
      equipeId: troca.equipeId,
      tipo: 'TROCA_RECUSADA_GESTOR',
      titulo: 'Troca recusada pelo gestor',
      mensagem: `O gestor recusou a troca do dia ${troca.data}: ${motivoFinal}`,
      trocaId,
      criadoPorLogin: gestor.login,
      em: agora,
    });
    if (notificacao) {
      batch.set(doc(db, 'notificacoesTroca', notificacao.id), removerUndefined(notificacao));
    }
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTroca('gestorRecusarTroca', falha, {
      trocaId,
      equipeId: troca.equipeId,
      statusAtual: troca.status,
      statusNovo: 'RECUSADA_GESTOR',
      gestorLogin: gestor.login,
    });
    throw falha;
  }
}

/**
 * Único ponto do projeto que usa `runTransaction` (em vez de `writeBatch`):
 * precisa reler a troca e os dois `turnosMes` no momento da aprovação para
 * revalidar contra concorrência (a escala pode ter mudado desde que a
 * solicitação foi criada) antes de gravar. Aplica a troca diretamente nos
 * dois documentos — não passa pelo pipeline de `publicarEscalas` nesta fase
 * (decisão registrada em docs/spec/TROCA_ESCALA_PLANO.md e confirmada para
 * o MVP: sem nova revisão/rollback para trocas, o histórico oficial fica em
 * `trocasEscala.historico` e nas notificações).
 */
export async function gestorAprovarEPublicarTroca(
  trocaId: string,
  gestor: Pick<Usuario, 'login' | 'nome'>,
  catalogo: Record<string, TipoTurno>,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  let statusAtualParaLog: string | undefined;

  try {
    await runTransaction(db, async (tx) => {
      const trocaRef = doc(db, 'trocasEscala', trocaId);
      const trocaSnapshot = await tx.get(trocaRef);
      if (!trocaSnapshot.exists()) {
        throw new Error('Solicitação de troca não encontrada.');
      }
      const troca = trocaSnapshot.data() as SolicitacaoTrocaReal;
      statusAtualParaLog = troca.status;
      if (troca.status !== 'PENDENTE_GESTOR') {
        throw new Error(`Só é possível aprovar uma troca com status PENDENTE_GESTOR (atual: ${troca.status}).`);
      }

      const solicitanteRef = doc(db, 'turnosMes', troca.snapshotValidacao.solicitanteDocId);
      const destinatarioRef = doc(db, 'turnosMes', troca.snapshotValidacao.destinatarioDocId);
      const usuarioSolicitanteRef = doc(db, 'usuarios', troca.solicitanteLogin);
      const usuarioDestinatarioRef = doc(db, 'usuarios', troca.destinatarioLogin);
      const [solicitanteSnapshot, destinatarioSnapshot, usuarioSolicitanteSnapshot, usuarioDestinatarioSnapshot] = await Promise.all([
        tx.get(solicitanteRef),
        tx.get(destinatarioRef),
        tx.get(usuarioSolicitanteRef),
        tx.get(usuarioDestinatarioRef),
      ]);

      if (!solicitanteSnapshot.exists() || !destinatarioSnapshot.exists()) {
        throw new Error('Escala publicada não encontrada para um dos colaboradores.');
      }
      const docSolicitante = solicitanteSnapshot.data() as TurnosMes;
      const docDestinatario = destinatarioSnapshot.data() as TurnosMes;
      if (docSolicitante.equipeId !== troca.equipeId || docDestinatario.equipeId !== troca.equipeId) {
        throw new Error('Um dos colaboradores não pertence mais à equipe da troca.');
      }
      if (docSolicitante.competencia !== troca.competencia || docDestinatario.competencia !== troca.competencia) {
        throw new Error('Um dos colaboradores não está mais na competência da troca.');
      }
      if (usuarioSolicitanteSnapshot.data()?.ativo === false || usuarioDestinatarioSnapshot.data()?.ativo === false) {
        throw new Error('Um dos colaboradores está inativo — a troca não pode ser aplicada.');
      }
      if (trocaDesatualizada(troca, docSolicitante.dias[troca.data], docDestinatario.dias[troca.data])) {
        throw new Error('A escala mudou desde que a troca foi solicitada. Peça para recriar a solicitação.');
      }

      const { diasSolicitante, diasDestinatario } = aplicarTrocaNosDias(
        docSolicitante.dias,
        docDestinatario.dias,
        troca.data,
      );
      const totaisSolicitante = calcularTotais(diasSolicitante, catalogo);
      const totaisDestinatario = calcularTotais(diasDestinatario, catalogo);

      tx.update(solicitanteRef, removerUndefined({
        dias: diasSolicitante,
        totais: totaisSolicitante,
        atualizadoEm: agora,
      }));
      tx.update(destinatarioRef, removerUndefined({
        dias: diasDestinatario,
        totais: totaisDestinatario,
        atualizadoEm: agora,
      }));
      tx.update(trocaRef, removerUndefined({
        status: 'APROVADA_PUBLICADA' as StatusTroca,
        atualizadoEm: agora,
        aprovadoEm: agora,
        publicadoEm: agora,
        gestorLogin: gestor.login,
        gestorNome: gestor.nome,
        historico: [
          ...troca.historico,
          criarEventoHistorico({
            tipo: 'APROVADA_PUBLICADA',
            porLogin: gestor.login,
            porNome: gestor.nome,
            porPerfil: 'GESTOR',
            em: agora,
            descricao: 'Aprovada e publicada pelo gestor',
          }),
        ],
      }));

      for (const destinatarioLogin of [troca.solicitanteLogin, troca.destinatarioLogin]) {
        const notificacao = criarNotificacaoTroca({
          destinatarioLogin,
          equipeId: troca.equipeId,
          tipo: 'TROCA_APROVADA_PUBLICADA',
          titulo: 'Troca aprovada e publicada',
          mensagem: `A troca do dia ${troca.data} foi aprovada pelo gestor e já está na escala publicada.`,
          trocaId,
          criadoPorLogin: gestor.login,
          em: agora,
        });
        if (notificacao) {
          tx.set(doc(db, 'notificacoesTroca', notificacao.id), removerUndefined(notificacao));
        }
      }
    });
  } catch (falha) {
    logOperacaoTroca('gestorAprovarEPublicarTroca', falha, {
      trocaId,
      statusAtual: statusAtualParaLog,
      statusNovo: 'APROVADA_PUBLICADA',
      gestorLogin: gestor.login,
    });
    throw falha;
  }
}
