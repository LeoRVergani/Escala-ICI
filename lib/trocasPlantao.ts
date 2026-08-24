import type { AtribuicaoPlantaoPersistida } from '@escala-ici/contrato';

/**
 * Troca de Plantão — FASE-TROCAS-PLANTAO-1 (coleção `trocasPlantao`, ver
 * docs/spec/PLANTOES.md).
 *
 * Módulo puro: nenhuma dependência do SDK do Firestore, só regras de negócio
 * testáveis isoladamente — mesmo padrão de `lib/trocasEscala.ts` (Jornada
 * 6x1), mas coleção e domínio SEPARADOS ("dois domínios, não um"): Jornada é
 * modelada por DIA + código de turno de catálogo; Plantão é modelada por
 * ATRIBUIÇÃO/intervalo (`inicio`/`fim` como instantes UTC, podendo cruzar
 * meia-noite). Reaproveitar `trocasEscala`/`trocasRepository` para Plantão
 * misturaria as duas semânticas.
 *
 * ESCOPO DESTA FASE (nunca escreve na escala publicada): `APROVADA` é um
 * status TERMINAL DE DECISÃO, não de efetivação. As Rules de
 * `competenciasPlantao/*\/atribuicoes` só aceitam republicação inteira da
 * competência com `revisao` estritamente crescente (`firestore.rules`), e o
 * modelo BASE→OVERRIDE→EFETIVA que permitiria uma troca cirúrgica está
 * reservado mas não implementado (docs/spec/PLANTOES.md § 3, PLANTÃO-6).
 * Aplicar a troca de verdade na escala publicada continua sendo edição
 * manual do coordenador no Dashboard.
 *
 * Mudar a tabela de transições aqui sem mudar as Firestore Rules (bloco
 * `trocasPlantao`) — ou vice-versa — quebra a fronteira: não existe Cloud
 * Function neste projeto, toda transição de status é escrita de client
 * autorizada só pelas Rules.
 *
 * NÃO valida nesta fase (fica para fases seguintes, se algum dia forem
 * necessárias): descanso mínimo, conflito com Jornada, limite de horas,
 * regra 6x1, sobreposição complexa de intervalos.
 */

export type StatusTrocaPlantao =
  | 'PENDENTE_USUARIO'
  | 'RECUSADA_USUARIO'
  | 'CANCELADA'
  | 'PENDENTE_GESTOR'
  | 'RECUSADA_GESTOR'
  | 'APROVADA';

export type AtorTrocaPlantao = 'SOLICITANTE' | 'DESTINATARIO' | 'GESTOR' | 'SISTEMA';

export interface EventoHistoricoTrocaPlantao {
  tipo: string;
  porLogin: string | null;
  porNome: string | null;
  porPerfil: AtorTrocaPlantao;
  em: string;
  descricao: string;
}

export interface SolicitacaoTrocaPlantao {
  trocaId: string;
  tipo: 'PLANTAO';
  grupoId: string;
  competencia: string;

  solicitanteLogin: string;
  solicitanteNome: string;
  destinatarioLogin: string;
  destinatarioNome: string;

  plantaoSolicitanteId: string;
  plantaoDestinatarioId: string;
  inicioSolicitante: string;
  fimSolicitante: string;
  inicioDestinatario: string;
  fimDestinatario: string;

  status: StatusTrocaPlantao;

  mensagemSolicitante: string | null;
  motivoRecusa: string | null;

  criadoEm: string;
  atualizadoEm: string;
  respondidoEm: string | null;
  decididoEm: string | null;

  criadoPorLogin: string;
  gestorLogin: string | null;
  gestorNome: string | null;

  historico: EventoHistoricoTrocaPlantao[];

  schemaVersion: number;
}

export type TipoNotificacaoTrocaPlantao =
  | 'TROCA_PLANTAO_SOLICITADA'
  | 'TROCA_PLANTAO_RECUSADA_USUARIO'
  | 'TROCA_PLANTAO_ACEITA_AGUARDANDO_GESTOR'
  | 'TROCA_PLANTAO_AGUARDANDO_APROVACAO_GESTOR'
  | 'TROCA_PLANTAO_RECUSADA_GESTOR'
  | 'TROCA_PLANTAO_APROVADA'
  | 'TROCA_PLANTAO_CANCELADA';

export interface NotificacaoTrocaPlantao {
  id: string;
  destinatarioLogin: string;
  grupoId: string;
  tipo: TipoNotificacaoTrocaPlantao;
  titulo: string;
  mensagem: string;
  trocaId: string;
  /** Quem executou a ação que gerou a notificação — nunca o próprio destinatário; autentica o `create` nas Firestore Rules. */
  criadoPorLogin: string;
  criadoEm: string;
  lidaEm: string | null;
  acao: 'ABRIR_TROCA_PLANTAO';
}

/**
 * Tabela de transições — espelha as Firestore Rules (bloco `trocasPlantao`).
 * `APROVADA` (não `APROVADA_PUBLICADA`) é deliberado: nada é publicado nesta
 * fase. Não existe `EXPIRADA`: nenhuma transição real leva a esse estado
 * nem em Jornada, então não foi replicado aqui.
 */
export const TRANSICOES_TROCA_PLANTAO: Readonly<Record<StatusTrocaPlantao, readonly StatusTrocaPlantao[]>> = {
  PENDENTE_USUARIO: ['RECUSADA_USUARIO', 'PENDENTE_GESTOR', 'CANCELADA'],
  PENDENTE_GESTOR: ['RECUSADA_GESTOR', 'APROVADA'],
  RECUSADA_USUARIO: [],
  CANCELADA: [],
  RECUSADA_GESTOR: [],
  APROVADA: [],
};

/** Status que ainda podem seguir adiante — usado pela UI (abas) e pela checagem de solicitação duplicada. */
export const STATUS_TROCA_PLANTAO_ATIVOS: readonly StatusTrocaPlantao[] = ['PENDENTE_USUARIO', 'PENDENTE_GESTOR'];

export const ROTULO_STATUS_TROCA_PLANTAO: Readonly<Record<StatusTrocaPlantao, string>> = {
  PENDENTE_USUARIO: 'Aguardando colega',
  RECUSADA_USUARIO: 'Recusada pelo colega',
  CANCELADA: 'Cancelada',
  PENDENTE_GESTOR: 'Aguardando gestor',
  RECUSADA_GESTOR: 'Recusada pelo gestor',
  APROVADA: 'Aprovada pelo gestor',
};

export type SeveridadeStatusTrocaPlantao = 'success' | 'warning' | 'danger' | 'neutral';

export const SEVERIDADE_STATUS_TROCA_PLANTAO: Readonly<Record<StatusTrocaPlantao, SeveridadeStatusTrocaPlantao>> = {
  PENDENTE_USUARIO: 'warning',
  RECUSADA_USUARIO: 'danger',
  CANCELADA: 'neutral',
  PENDENTE_GESTOR: 'warning',
  RECUSADA_GESTOR: 'danger',
  APROVADA: 'success',
};

/**
 * Texto obrigatório sempre que `APROVADA` é exibido — a aprovação registra a
 * decisão, mas não altera a escala publicada automaticamente (ver cabeçalho
 * do módulo).
 */
export const AVISO_APROVACAO_NAO_PUBLICA =
  'Esta aprovação registra a decisão. O ajuste na escala publicada ainda é manual no Dashboard.';

export function statusTrocaPlantaoEhAtivo(status: StatusTrocaPlantao): boolean {
  return STATUS_TROCA_PLANTAO_ATIVOS.includes(status);
}

export function transicaoTrocaPlantaoPermitida(de: StatusTrocaPlantao, para: StatusTrocaPlantao): boolean {
  return TRANSICOES_TROCA_PLANTAO[de].includes(para);
}

export const LIMITE_MENSAGEM_TROCA_PLANTAO = 280;

/** Recorte de `AtribuicaoPlantaoPersistida` usado pelo domínio de trocas — nunca precisa de `schemaVersion`/auditoria. */
export type PlantaoParaTroca = Pick<
  AtribuicaoPlantaoPersistida,
  'atribuicaoId' | 'grupoId' | 'competenciaId' | 'plantonistaLogin' | 'inicio' | 'fim' | 'duracaoMinutos'
>;

/** Plantões do próprio login que ainda NÃO começaram (`inicio > agoraIso`), em ordem cronológica. */
export function plantoesFuturosDoPlantonista(
  atribuicoes: readonly PlantaoParaTroca[],
  login: string,
  agoraIso: string,
): PlantaoParaTroca[] {
  return atribuicoes
    .filter((atribuicao) => atribuicao.plantonistaLogin === login && atribuicao.inicio > agoraIso)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Plantões futuros de OUTROS participantes ativos do mesmo grupo — nunca o próprio login, nunca inativo. */
export function plantoesFuturosDeOutrosParticipantes(
  atribuicoes: readonly PlantaoParaTroca[],
  meuLogin: string,
  loginsParticipantesAtivos: readonly string[],
  agoraIso: string,
): PlantaoParaTroca[] {
  const ativos = new Set(loginsParticipantesAtivos);
  return atribuicoes
    .filter(
      (atribuicao) =>
        atribuicao.plantonistaLogin !== meuLogin
        && ativos.has(atribuicao.plantonistaLogin)
        && atribuicao.inicio > agoraIso,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export interface ContextoValidacaoNovaTrocaPlantao {
  agoraIso: string;
  grupoId: string;
  competencia: string;
  solicitanteLogin: string;
  destinatarioLogin: string;
  solicitanteAtivo: boolean;
  destinatarioAtivo: boolean;
  plantaoSolicitante: PlantaoParaTroca | undefined;
  plantaoDestinatario: PlantaoParaTroca | undefined;
  trocasExistentes: readonly Pick<SolicitacaoTrocaPlantao, 'status' | 'plantaoSolicitanteId' | 'plantaoDestinatarioId'>[];
}

/**
 * Validação pura do que o App pode enviar ao criar uma solicitação de troca
 * de Plantão. Cobre exatamente as regras pedidas para esta fase — nada de
 * descanso mínimo, conflito de jornada, limite de horas, regra 6x1 ou
 * sobreposição complexa.
 */
export function validarNovaSolicitacaoTrocaPlantao(contexto: ContextoValidacaoNovaTrocaPlantao): string[] {
  const erros: string[] = [];
  const { plantaoSolicitante, plantaoDestinatario } = contexto;

  if (plantaoSolicitante === undefined) {
    erros.push('Escolha um dos seus plantões futuros.');
  } else if (plantaoSolicitante.plantonistaLogin !== contexto.solicitanteLogin) {
    erros.push('Este plantão não é seu.');
  }

  if (plantaoDestinatario === undefined) {
    erros.push('Escolha o plantão do colega.');
  } else if (plantaoDestinatario.plantonistaLogin !== contexto.destinatarioLogin) {
    erros.push('Este plantão não é do colega escolhido.');
  }

  if (plantaoSolicitante !== undefined && plantaoDestinatario !== undefined) {
    if (plantaoSolicitante.grupoId !== contexto.grupoId || plantaoDestinatario.grupoId !== contexto.grupoId) {
      erros.push('Os dois plantões precisam ser do mesmo Grupo de Plantão.');
    }
    if (plantaoSolicitante.inicio <= contexto.agoraIso || plantaoDestinatario.inicio <= contexto.agoraIso) {
      erros.push('Só é possível trocar plantões que ainda não começaram.');
    }
    if (plantaoSolicitante.atribuicaoId === plantaoDestinatario.atribuicaoId) {
      erros.push('Escolha dois plantões diferentes.');
    }
  }

  if (contexto.destinatarioLogin.trim() === '') {
    erros.push('Escolha o colega que receberá a solicitação.');
  } else if (contexto.destinatarioLogin === contexto.solicitanteLogin) {
    erros.push('Escolha outro participante para a troca.');
  }

  if (!contexto.solicitanteAtivo) {
    erros.push('Você precisa ser participante ativo do Grupo de Plantão.');
  }
  if (!contexto.destinatarioAtivo) {
    erros.push('O colega precisa ser participante ativo do Grupo de Plantão.');
  }

  if (plantaoSolicitante !== undefined && plantaoDestinatario !== undefined) {
    const idsEnvolvidos = new Set([plantaoSolicitante.atribuicaoId, plantaoDestinatario.atribuicaoId]);
    const jaExisteAtiva = contexto.trocasExistentes.some(
      (troca) =>
        statusTrocaPlantaoEhAtivo(troca.status)
        && (idsEnvolvidos.has(troca.plantaoSolicitanteId) || idsEnvolvidos.has(troca.plantaoDestinatarioId)),
    );
    if (jaExisteAtiva) {
      erros.push('Já existe uma solicitação em andamento para um desses plantões.');
    }
  }

  return erros;
}

/**
 * Verdadeiro quando a escala mudou desde que a solicitação foi criada (o
 * plantão sumiu, mudou de dono ou de horário) — o gestor não deve aprovar
 * sobre um snapshot que não bate mais com a escala publicada. Só avisa,
 * nunca bloqueia (a decisão final continua sendo do gestor).
 */
export function trocaPlantaoDesatualizada(
  troca: Pick<
    SolicitacaoTrocaPlantao,
    'plantaoSolicitanteId' | 'plantaoDestinatarioId' | 'solicitanteLogin' | 'destinatarioLogin' | 'inicioSolicitante' | 'fimSolicitante' | 'inicioDestinatario' | 'fimDestinatario'
  >,
  plantaoSolicitanteAtual: PlantaoParaTroca | undefined,
  plantaoDestinatarioAtual: PlantaoParaTroca | undefined,
): boolean {
  const solicitanteMudou =
    plantaoSolicitanteAtual === undefined
    || plantaoSolicitanteAtual.plantonistaLogin !== troca.solicitanteLogin
    || plantaoSolicitanteAtual.inicio !== troca.inicioSolicitante
    || plantaoSolicitanteAtual.fim !== troca.fimSolicitante;
  const destinatarioMudou =
    plantaoDestinatarioAtual === undefined
    || plantaoDestinatarioAtual.plantonistaLogin !== troca.destinatarioLogin
    || plantaoDestinatarioAtual.inicio !== troca.inicioDestinatario
    || plantaoDestinatarioAtual.fim !== troca.fimDestinatario;
  return solicitanteMudou || destinatarioMudou;
}

/**
 * Quem avisar quando a troca vira `PENDENTE_GESTOR` — SEM hardcode de nome,
 * cargo, sigla, unidade ou equipe. Fonte única: `responsaveisLogin` de um
 * escopo operacional `PLANTAO` ativo para este grupo (Matriz). Escopo
 * ausente, inativo, ou sem logins explícitos ⇒ `[]` — a troca continua seu
 * fluxo normalmente, só sem notificação dirigida a um gestor (a fila de
 * "Aprovações de Plantão" continua visível a quem puder administrar o
 * grupo). Nunca inventa destinatário e nunca deixa o aceite do colega
 * falhar por falta de Matriz configurada.
 */
export function destinatariosNotificacaoGestorPlantao(
  escopo: { ativo: boolean; responsaveisLogin: readonly string[] } | null,
  excluirLogins: readonly string[],
): string[] {
  if (escopo === null || !escopo.ativo) {
    return [];
  }
  const excluir = new Set(excluirLogins);
  return escopo.responsaveisLogin.filter((login) => !excluir.has(login));
}
