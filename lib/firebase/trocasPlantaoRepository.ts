import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Usuario } from '../modelos';
import {
  transicaoTrocaPlantaoPermitida,
  validarNovaSolicitacaoTrocaPlantao,
  type AtorTrocaPlantao,
  type EventoHistoricoTrocaPlantao,
  type NotificacaoTrocaPlantao,
  type PlantaoParaTroca,
  type SolicitacaoTrocaPlantao,
  type StatusTrocaPlantao,
  type TipoNotificacaoTrocaPlantao,
} from '../trocasPlantao';
import { gerarUuid } from '../uuid';
import { removerUndefined } from './sanitizar';
import { exigirFirebase } from './shared';

/**
 * Repositório Firestore de Trocas de Plantão — espelha
 * `lib/firebase/trocasRepository.ts` (Jornada 6x1), mas em coleções
 * dedicadas (`trocasPlantao`/`notificacoesTrocaPlantao`) e SEM
 * `runTransaction`/`exigirEscritaAdministrativaHabilitada()`: esta fase
 * nunca escreve em `competenciasPlantao` (escala publicada) — `APROVADA` só
 * registra a decisão do gestor sobre o documento de troca em si, autorizado
 * pelas Firestore Rules via `podeAdministrarEscalaPlantao(grupoId)` (ver
 * `firestore.rules`, bloco `trocasPlantao`, e `lib/trocasPlantao.ts` para o
 * porquê completo).
 */

function criarEventoHistoricoPlantao(parametros: {
  tipo: string;
  porLogin: string | null;
  porNome: string | null;
  porPerfil: AtorTrocaPlantao;
  em: string;
  descricao: string;
}): EventoHistoricoTrocaPlantao {
  return { ...parametros };
}

/** Devolve `null` quando o destinatário é quem executou a ação — mesmo motivo de `criarNotificacaoTroca()` (Jornada). */
function criarNotificacaoTrocaPlantao(parametros: {
  destinatarioLogin: string;
  grupoId: string;
  tipo: TipoNotificacaoTrocaPlantao;
  titulo: string;
  mensagem: string;
  trocaId: string;
  criadoPorLogin: string;
  em: string;
}): NotificacaoTrocaPlantao | null {
  if (parametros.destinatarioLogin === parametros.criadoPorLogin) {
    return null;
  }
  return {
    id: gerarUuid(),
    destinatarioLogin: parametros.destinatarioLogin,
    grupoId: parametros.grupoId,
    tipo: parametros.tipo,
    titulo: parametros.titulo,
    mensagem: parametros.mensagem,
    trocaId: parametros.trocaId,
    criadoPorLogin: parametros.criadoPorLogin,
    criadoEm: parametros.em,
    lidaEm: null,
    acao: 'ABRIR_TROCA_PLANTAO',
  };
}

function logOperacaoTrocaPlantao(operacao: string, falha: unknown, contexto: Record<string, unknown>): void {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String((falha as { code?: unknown }).code)
    : 'desconhecido';
  const mensagem = falha instanceof Error ? falha.message : String(falha);
  console.error(`[trocasPlantaoRepository] ${operacao} falhou — code=${codigo} message=${mensagem}`, contexto);
}

function garantirTransicaoPlantao(de: StatusTrocaPlantao, para: StatusTrocaPlantao): void {
  if (!transicaoTrocaPlantaoPermitida(de, para)) {
    throw new Error(`Transição de ${de} para ${para} não é permitida.`);
  }
}

// --- Leitura ---

/** Duas consultas (uma por papel), mesmo motivo de `observarTrocasDoUsuario()` (Jornada): cada uma usa um índice composto dedicado. */
export function observarTrocasPlantaoDoUsuario(
  grupoId: string,
  competencia: string,
  login: string,
  aoAtualizar: (trocas: SolicitacaoTrocaPlantao[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  let comoSolicitante: SolicitacaoTrocaPlantao[] = [];
  let comoDestinatario: SolicitacaoTrocaPlantao[] = [];

  function emitir() {
    const porId = new Map<string, SolicitacaoTrocaPlantao>();
    for (const troca of [...comoSolicitante, ...comoDestinatario]) {
      porId.set(troca.trocaId, troca);
    }
    aoAtualizar([...porId.values()].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)));
  }

  const cancelarSolicitante = onSnapshot(query(
    collection(db, 'trocasPlantao'),
    where('grupoId', '==', grupoId),
    where('competencia', '==', competencia),
    where('solicitanteLogin', '==', login),
  ), (snapshot) => {
    comoSolicitante = snapshot.docs.map((documento) => documento.data() as SolicitacaoTrocaPlantao);
    emitir();
  }, (falha) => aoFalhar(falha instanceof Error ? falha : new Error('Falha ao acompanhar suas trocas de plantão.')));

  const cancelarDestinatario = onSnapshot(query(
    collection(db, 'trocasPlantao'),
    where('grupoId', '==', grupoId),
    where('competencia', '==', competencia),
    where('destinatarioLogin', '==', login),
  ), (snapshot) => {
    comoDestinatario = snapshot.docs.map((documento) => documento.data() as SolicitacaoTrocaPlantao);
    emitir();
  }, (falha) => aoFalhar(falha instanceof Error ? falha : new Error('Falha ao acompanhar trocas de plantão recebidas.')));

  return () => {
    cancelarSolicitante();
    cancelarDestinatario();
  };
}

/** Traz todas as trocas do grupo/competência — quem administra o grupo filtra a fila de aprovação localmente. */
export function observarTrocasPlantaoDoGrupo(
  grupoId: string,
  competencia: string,
  aoAtualizar: (trocas: SolicitacaoTrocaPlantao[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, 'trocasPlantao'),
    where('grupoId', '==', grupoId),
    where('competencia', '==', competencia),
  ), (snapshot) => aoAtualizar(
    snapshot.docs.map((documento) => documento.data() as SolicitacaoTrocaPlantao),
  ), (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar as trocas de plantão do grupo.'),
  ));
}

export function observarNotificacoesTrocaPlantao(
  login: string,
  aoAtualizar: (notificacoes: NotificacaoTrocaPlantao[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, 'notificacoesTrocaPlantao'),
    where('destinatarioLogin', '==', login),
  ), (snapshot) => {
    const notificacoes = snapshot.docs
      .map((documento) => documento.data() as NotificacaoTrocaPlantao)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    aoAtualizar(notificacoes);
  }, (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar notificações de troca de plantão.'),
  ));
}

export async function buscarTrocaPlantao(trocaId: string): Promise<SolicitacaoTrocaPlantao | null> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasPlantao', trocaId));
  return snapshot.exists() ? snapshot.data() as SolicitacaoTrocaPlantao : null;
}

export async function marcarNotificacaoTrocaPlantaoComoLida(notificacaoId: string): Promise<void> {
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, 'notificacoesTrocaPlantao', notificacaoId), { lidaEm: agora });
  await batch.commit();
}

// --- Escrita ---

export interface EntradaCriarSolicitacaoTrocaPlantao {
  grupoId: string;
  competencia: string;
  solicitante: Pick<Usuario, 'login' | 'nome' | 'ativo'>;
  destinatario: Pick<Usuario, 'login' | 'nome' | 'ativo'>;
  plantaoSolicitante: PlantaoParaTroca;
  plantaoDestinatario: PlantaoParaTroca;
  mensagem: string;
  agoraIso: string;
}

export async function criarSolicitacaoTrocaPlantao(entrada: EntradaCriarSolicitacaoTrocaPlantao): Promise<string> {
  const { db } = exigirFirebase();
  const { grupoId, competencia, solicitante, destinatario, plantaoSolicitante, plantaoDestinatario, mensagem, agoraIso } = entrada;

  // Checagem best-effort de duplicidade: as Firestore Rules não conseguem
  // impedir uma segunda solicitação ativa para o mesmo plantão (mesma
  // limitação já aceita em `criarSolicitacaoTroca()`, Jornada).
  const existentes = await getDocs(query(
    collection(db, 'trocasPlantao'),
    where('grupoId', '==', grupoId),
    where('competencia', '==', competencia),
    where('solicitanteLogin', '==', solicitante.login),
  ));
  const trocasExistentes = existentes.docs.map((documento) => documento.data() as SolicitacaoTrocaPlantao);

  const erros = validarNovaSolicitacaoTrocaPlantao({
    agoraIso,
    grupoId,
    competencia,
    solicitanteLogin: solicitante.login,
    destinatarioLogin: destinatario.login,
    solicitanteAtivo: solicitante.ativo,
    destinatarioAtivo: destinatario.ativo,
    plantaoSolicitante,
    plantaoDestinatario,
    trocasExistentes,
  });
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }

  const trocaId = gerarUuid();
  const agora = new Date().toISOString();

  const troca: SolicitacaoTrocaPlantao = {
    trocaId,
    tipo: 'PLANTAO',
    grupoId,
    competencia,
    solicitanteLogin: solicitante.login,
    solicitanteNome: solicitante.nome,
    destinatarioLogin: destinatario.login,
    destinatarioNome: destinatario.nome,
    plantaoSolicitanteId: plantaoSolicitante.atribuicaoId,
    plantaoDestinatarioId: plantaoDestinatario.atribuicaoId,
    inicioSolicitante: plantaoSolicitante.inicio,
    fimSolicitante: plantaoSolicitante.fim,
    inicioDestinatario: plantaoDestinatario.inicio,
    fimDestinatario: plantaoDestinatario.fim,
    status: 'PENDENTE_USUARIO',
    mensagemSolicitante: mensagem.trim() || null,
    motivoRecusa: null,
    criadoEm: agora,
    atualizadoEm: agora,
    respondidoEm: null,
    decididoEm: null,
    criadoPorLogin: solicitante.login,
    gestorLogin: null,
    gestorNome: null,
    historico: [
      criarEventoHistoricoPlantao({
        tipo: 'SOLICITACAO_CRIADA',
        porLogin: solicitante.login,
        porNome: solicitante.nome,
        porPerfil: 'SOLICITANTE',
        em: agora,
        descricao: 'Solicitação de troca de plantão criada',
      }),
    ],
    schemaVersion: 1,
  };

  const notificacao = criarNotificacaoTrocaPlantao({
    destinatarioLogin: destinatario.login,
    grupoId,
    tipo: 'TROCA_PLANTAO_SOLICITADA',
    titulo: 'Nova solicitação de troca de plantão',
    mensagem: `${solicitante.nome} quer trocar um plantão com você.`,
    trocaId,
    criadoPorLogin: solicitante.login,
    em: agora,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'trocasPlantao', trocaId), removerUndefined(troca));
  if (notificacao) {
    batch.set(doc(db, 'notificacoesTrocaPlantao', notificacao.id), removerUndefined(notificacao));
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTrocaPlantao('criarSolicitacaoTrocaPlantao', falha, {
      trocaId,
      grupoId,
      competencia,
      solicitanteLogin: solicitante.login,
      destinatarioLogin: destinatario.login,
    });
    throw falha;
  }
  return trocaId;
}

export async function cancelarSolicitacaoTrocaPlantao(
  trocaId: string,
  solicitante: Pick<Usuario, 'login' | 'nome'>,
): Promise<void> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasPlantao', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca de plantão não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaPlantao;
  if (troca.solicitanteLogin !== solicitante.login) {
    throw new Error('Só quem solicitou a troca pode cancelá-la.');
  }
  garantirTransicaoPlantao(troca.status, 'CANCELADA');

  const agora = new Date().toISOString();
  const notificacao = criarNotificacaoTrocaPlantao({
    destinatarioLogin: troca.destinatarioLogin,
    grupoId: troca.grupoId,
    tipo: 'TROCA_PLANTAO_CANCELADA',
    titulo: 'Solicitação de troca de plantão cancelada',
    mensagem: `${solicitante.nome} cancelou a solicitação de troca de plantão.`,
    trocaId,
    criadoPorLogin: solicitante.login,
    em: agora,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasPlantao', trocaId), removerUndefined({
    status: 'CANCELADA' as StatusTrocaPlantao,
    atualizadoEm: agora,
    historico: [
      ...troca.historico,
      criarEventoHistoricoPlantao({
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
    batch.set(doc(db, 'notificacoesTrocaPlantao', notificacao.id), removerUndefined(notificacao));
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTrocaPlantao('cancelarSolicitacaoTrocaPlantao', falha, {
      trocaId,
      grupoId: troca.grupoId,
      statusAtual: troca.status,
      statusNovo: 'CANCELADA',
      solicitanteLogin: solicitante.login,
    });
    throw falha;
  }
}

export interface OpcoesResponderSolicitacaoTrocaPlantao {
  /** Logins a notificar quando a troca vira `PENDENTE_GESTOR` (ver `destinatariosNotificacaoGestorPlantao()`). */
  gestoresLogin?: readonly string[];
  motivoRecusa?: string;
}

export async function responderSolicitacaoTrocaPlantao(
  trocaId: string,
  destinatario: Pick<Usuario, 'login' | 'nome'>,
  aceitar: boolean,
  opcoes: OpcoesResponderSolicitacaoTrocaPlantao = {},
): Promise<void> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasPlantao', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca de plantão não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaPlantao;
  if (troca.destinatarioLogin !== destinatario.login) {
    throw new Error('Só o colega convidado pode responder esta troca.');
  }
  const novoStatus: StatusTrocaPlantao = aceitar ? 'PENDENTE_GESTOR' : 'RECUSADA_USUARIO';
  garantirTransicaoPlantao(troca.status, novoStatus);

  const agora = new Date().toISOString();
  const motivoRecusa = opcoes.motivoRecusa;
  const notificacaoSolicitante = criarNotificacaoTrocaPlantao({
    destinatarioLogin: troca.solicitanteLogin,
    grupoId: troca.grupoId,
    tipo: aceitar ? 'TROCA_PLANTAO_ACEITA_AGUARDANDO_GESTOR' : 'TROCA_PLANTAO_RECUSADA_USUARIO',
    titulo: aceitar ? 'Troca de plantão aceita, aguardando o gestor' : 'Troca de plantão recusada pelo colega',
    mensagem: aceitar
      ? `${destinatario.nome} aceitou a troca de plantão. Agora o gestor precisa aprovar.`
      : `${destinatario.nome} recusou a troca de plantão.`,
    trocaId,
    criadoPorLogin: destinatario.login,
    em: agora,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasPlantao', trocaId), removerUndefined({
    status: novoStatus,
    atualizadoEm: agora,
    respondidoEm: agora,
    motivoRecusa: aceitar ? null : (motivoRecusa?.trim() || 'Recusada pelo colega.'),
    historico: [
      ...troca.historico,
      criarEventoHistoricoPlantao({
        tipo: aceitar ? 'ACEITE_DESTINATARIO' : 'RECUSA_DESTINATARIO',
        porLogin: destinatario.login,
        porNome: destinatario.nome,
        porPerfil: 'DESTINATARIO',
        em: agora,
        descricao: aceitar ? 'Aceite do colega — encaminhada para o gestor' : `Recusada pelo colega${motivoRecusa?.trim() ? `: ${motivoRecusa.trim()}` : ''}`,
      }),
    ],
  }));
  if (notificacaoSolicitante) {
    batch.set(doc(db, 'notificacoesTrocaPlantao', notificacaoSolicitante.id), removerUndefined(notificacaoSolicitante));
  }
  if (aceitar) {
    for (const gestorLogin of opcoes.gestoresLogin ?? []) {
      const notificacaoGestor = criarNotificacaoTrocaPlantao({
        destinatarioLogin: gestorLogin,
        grupoId: troca.grupoId,
        tipo: 'TROCA_PLANTAO_AGUARDANDO_APROVACAO_GESTOR',
        titulo: 'Troca de plantão aguardando aprovação',
        mensagem: `${troca.solicitanteNome} e ${troca.destinatarioNome} combinaram uma troca de plantão — falta sua aprovação.`,
        trocaId,
        criadoPorLogin: destinatario.login,
        em: agora,
      });
      if (notificacaoGestor) {
        batch.set(doc(db, 'notificacoesTrocaPlantao', notificacaoGestor.id), removerUndefined(notificacaoGestor));
      }
    }
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTrocaPlantao('responderSolicitacaoTrocaPlantao', falha, {
      trocaId,
      grupoId: troca.grupoId,
      statusAtual: troca.status,
      statusNovo: novoStatus,
      destinatarioLogin: destinatario.login,
    });
    throw falha;
  }
}

export async function gestorRecusarTrocaPlantao(
  trocaId: string,
  gestor: Pick<Usuario, 'login' | 'nome'>,
  motivo: string,
): Promise<void> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasPlantao', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca de plantão não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaPlantao;
  garantirTransicaoPlantao(troca.status, 'RECUSADA_GESTOR');

  const agora = new Date().toISOString();
  const motivoFinal = motivo.trim() || 'Recusada pelo gestor.';
  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasPlantao', trocaId), removerUndefined({
    status: 'RECUSADA_GESTOR' as StatusTrocaPlantao,
    atualizadoEm: agora,
    decididoEm: agora,
    motivoRecusa: motivoFinal,
    gestorLogin: gestor.login,
    gestorNome: gestor.nome,
    historico: [
      ...troca.historico,
      criarEventoHistoricoPlantao({
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
    const notificacao = criarNotificacaoTrocaPlantao({
      destinatarioLogin,
      grupoId: troca.grupoId,
      tipo: 'TROCA_PLANTAO_RECUSADA_GESTOR',
      titulo: 'Troca de plantão recusada pelo gestor',
      mensagem: `O gestor recusou a troca de plantão: ${motivoFinal}`,
      trocaId,
      criadoPorLogin: gestor.login,
      em: agora,
    });
    if (notificacao) {
      batch.set(doc(db, 'notificacoesTrocaPlantao', notificacao.id), removerUndefined(notificacao));
    }
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTrocaPlantao('gestorRecusarTrocaPlantao', falha, {
      trocaId,
      grupoId: troca.grupoId,
      statusAtual: troca.status,
      statusNovo: 'RECUSADA_GESTOR',
      gestorLogin: gestor.login,
    });
    throw falha;
  }
}

/**
 * Aprova a troca — SÓ registra a decisão em `trocasPlantao` (status
 * `APROVADA` + histórico + notificações). Deliberadamente NÃO existe um
 * `gestorAprovarEPublicarTrocaPlantao`: diferente da Jornada
 * (`gestorAprovarEPublicarTroca`, que reescreve `turnosMes` com segurança
 * comprovada), aqui não há mecanismo seguro equivalente para aplicar a troca
 * em `competenciasPlantao/*\/atribuicoes` — as Rules dessa coleção exigem
 * republicação inteira da competência com `revisao` crescente, e o modelo
 * BASE/OVERRIDE/EFETIVA que permitiria uma troca cirúrgica está reservado
 * mas não implementado (docs/spec/PLANTOES.md, PLANTÃO-6). O ajuste real na
 * escala publicada continua sendo edição manual do coordenador no
 * Dashboard.
 */
export async function gestorAprovarTrocaPlantao(
  trocaId: string,
  gestor: Pick<Usuario, 'login' | 'nome'>,
): Promise<void> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'trocasPlantao', trocaId));
  if (!snapshot.exists()) {
    throw new Error('Solicitação de troca de plantão não encontrada.');
  }
  const troca = snapshot.data() as SolicitacaoTrocaPlantao;
  garantirTransicaoPlantao(troca.status, 'APROVADA');

  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, 'trocasPlantao', trocaId), removerUndefined({
    status: 'APROVADA' as StatusTrocaPlantao,
    atualizadoEm: agora,
    decididoEm: agora,
    gestorLogin: gestor.login,
    gestorNome: gestor.nome,
    historico: [
      ...troca.historico,
      criarEventoHistoricoPlantao({
        tipo: 'APROVACAO_GESTOR',
        porLogin: gestor.login,
        porNome: gestor.nome,
        porPerfil: 'GESTOR',
        em: agora,
        descricao: 'Aprovada pelo gestor — o ajuste na escala publicada é feito manualmente no Dashboard',
      }),
    ],
  }));
  for (const destinatarioLogin of [troca.solicitanteLogin, troca.destinatarioLogin]) {
    const notificacao = criarNotificacaoTrocaPlantao({
      destinatarioLogin,
      grupoId: troca.grupoId,
      tipo: 'TROCA_PLANTAO_APROVADA',
      titulo: 'Troca de plantão aprovada',
      mensagem: 'O gestor aprovou a troca de plantão. O ajuste na escala publicada é feito pelo coordenador no Dashboard.',
      trocaId,
      criadoPorLogin: gestor.login,
      em: agora,
    });
    if (notificacao) {
      batch.set(doc(db, 'notificacoesTrocaPlantao', notificacao.id), removerUndefined(notificacao));
    }
  }
  try {
    await batch.commit();
  } catch (falha) {
    logOperacaoTrocaPlantao('gestorAprovarTrocaPlantao', falha, {
      trocaId,
      grupoId: troca.grupoId,
      statusAtual: troca.status,
      statusNovo: 'APROVADA',
      gestorLogin: gestor.login,
    });
    throw falha;
  }
}
