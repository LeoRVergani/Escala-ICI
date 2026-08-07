import type { Dia } from '@escala-ici/contrato';

/**
 * Troca de escala — fase real (coleção `trocasEscala`, ver
 * docs/spec/TROCA_ESCALA_PLANO.md e a implementação desta fase).
 *
 * Módulo puro: nenhuma dependência do SDK do Firestore, só regras de
 * negócio testáveis isoladamente. Datas e horários seguem o mesmo padrão de
 * string ISO já usado em `EventoEscala`/`PublicacaoEscala` (`lib/modelos.ts`)
 * — sem `Timestamp` do Firestore, para ficar consistente com o resto da base
 * e não exigir conversão nas Firestore Rules.
 *
 * Escopo desta fase (MVP): troca só no mesmo dia, mesma equipe, mesma
 * competência, entre dois dias que já existem em `turnosMes`. O gestor
 * aprova e publica em um único passo — por isso o modelo real tem 7 status,
 * sem `APROVADA_AGUARDANDO_PUBLICACAO` (que só existe no protótipo visual
 * em `lib/trocaEscalaMock.ts`).
 *
 * Este módulo é independente do desenho de 5 status de `lib/trocaEscala.ts`
 * (Fase 3K-D1/D2, não usado por nenhuma tela) — não o substitui nem o
 * altera.
 */

export type StatusTroca =
  | 'PENDENTE_USUARIO'
  | 'RECUSADA_USUARIO'
  | 'CANCELADA_SOLICITANTE'
  | 'PENDENTE_GESTOR'
  | 'RECUSADA_GESTOR'
  | 'APROVADA_PUBLICADA'
  | 'EXPIRADA';

export type AtorTroca = 'SOLICITANTE' | 'DESTINATARIO' | 'GESTOR' | 'SISTEMA';

export interface EventoHistoricoTroca {
  tipo: string;
  porLogin: string | null;
  porNome: string | null;
  porPerfil: AtorTroca;
  em: string;
  descricao: string;
}

/** Fotografia dos turnos no momento da criação — usada para detectar escala mudada antes de aprovar. */
export interface SnapshotValidacaoTroca {
  solicitanteDocId: string;
  destinatarioDocId: string;
  turnoSolicitanteOriginal: string;
  turnoDestinatarioOriginal: string;
}

export interface SolicitacaoTrocaReal {
  trocaId: string;
  equipeId: string;
  competencia: string;

  solicitanteLogin: string;
  solicitanteNome: string;
  destinatarioLogin: string;
  destinatarioNome: string;

  data: string;
  turnoSolicitanteAntes: string;
  horarioSolicitanteAntes: string;
  turnoDestinatarioAntes: string;
  horarioDestinatarioAntes: string;

  status: StatusTroca;

  mensagemSolicitante: string | null;
  motivoRecusa: string | null;

  criadoEm: string;
  atualizadoEm: string;
  respondidoEm: string | null;
  aprovadoEm: string | null;
  publicadoEm: string | null;

  gestorLogin: string | null;
  gestorNome: string | null;

  historico: EventoHistoricoTroca[];

  snapshotValidacao: SnapshotValidacaoTroca;
}

export type TipoNotificacaoTroca =
  | 'TROCA_SOLICITADA'
  | 'TROCA_RECUSADA_USUARIO'
  | 'TROCA_ACEITA_AGUARDANDO_GESTOR'
  | 'TROCA_RECUSADA_GESTOR'
  | 'TROCA_APROVADA_PUBLICADA'
  | 'TROCA_CANCELADA';

export interface NotificacaoTroca {
  id: string;
  destinatarioLogin: string;
  equipeId: string;
  tipo: TipoNotificacaoTroca;
  titulo: string;
  mensagem: string;
  trocaId: string;
  /** Quem executou a ação que gerou a notificação — nunca o próprio destinatário; autentica o `create` nas Firestore Rules. */
  criadoPorLogin: string;
  criadoEm: string;
  lidaEm: string | null;
  acao: 'ABRIR_TROCA';
}

/**
 * Tabela de transições do modelo real — espelha as Firestore Rules
 * (`firestore.rules`, bloco `trocasEscala`). Mudar aqui sem mudar lá (ou
 * vice-versa) quebra a fronteira entre "o que a UI tenta fazer" e "o que o
 * servidor aceita".
 */
export const TRANSICOES_TROCA_REAL: Readonly<Record<StatusTroca, readonly StatusTroca[]>> = {
  PENDENTE_USUARIO: ['RECUSADA_USUARIO', 'PENDENTE_GESTOR', 'CANCELADA_SOLICITANTE'],
  PENDENTE_GESTOR: ['RECUSADA_GESTOR', 'APROVADA_PUBLICADA'],
  RECUSADA_USUARIO: [],
  CANCELADA_SOLICITANTE: [],
  RECUSADA_GESTOR: [],
  APROVADA_PUBLICADA: [],
  EXPIRADA: [],
};

/** Status que ainda podem seguir adiante — usado tanto pela UI (abas) quanto pela checagem de solicitação duplicada. */
export const STATUS_TROCA_ATIVOS: readonly StatusTroca[] = ['PENDENTE_USUARIO', 'PENDENTE_GESTOR'];

/** Rótulo em PT-BR por status — usado pelo App e pelo Dashboard (mesmo texto nos dois lugares). */
export const ROTULO_STATUS_TROCA: Readonly<Record<StatusTroca, string>> = {
  PENDENTE_USUARIO: 'Aguardando colega',
  RECUSADA_USUARIO: 'Recusada pelo colega',
  CANCELADA_SOLICITANTE: 'Cancelada',
  PENDENTE_GESTOR: 'Aguardando gestor',
  RECUSADA_GESTOR: 'Recusada pelo gestor',
  APROVADA_PUBLICADA: 'Concluída',
  EXPIRADA: 'Expirada',
};

export type SeveridadeStatusTroca = 'success' | 'warning' | 'danger' | 'neutral';

export const SEVERIDADE_STATUS_TROCA: Readonly<Record<StatusTroca, SeveridadeStatusTroca>> = {
  PENDENTE_USUARIO: 'warning',
  RECUSADA_USUARIO: 'danger',
  CANCELADA_SOLICITANTE: 'neutral',
  PENDENTE_GESTOR: 'warning',
  RECUSADA_GESTOR: 'danger',
  APROVADA_PUBLICADA: 'success',
  EXPIRADA: 'neutral',
};

export function statusEhAtivo(status: StatusTroca): boolean {
  return STATUS_TROCA_ATIVOS.includes(status);
}

export function transicaoPermitida(de: StatusTroca, para: StatusTroca): boolean {
  return TRANSICOES_TROCA_REAL[de].includes(para);
}

export const LIMITE_MENSAGEM_TROCA = 280;

export interface ContextoValidacaoNovaTroca {
  solicitanteLogin: string;
  destinatarioLogin: string;
  solicitanteAtivo: boolean;
  destinatarioAtivo: boolean;
  diaSolicitante: Dia | undefined;
  diaDestinatario: Dia | undefined;
}

/**
 * Validação pura do que o App pode enviar ao criar uma solicitação — espelha
 * as restrições que as Firestore Rules também aplicam (`loginDoAuth()` como
 * `solicitanteLogin`, `destinatarioLogin` diferente, etc.); esta função
 * cobre as regras que dependem de dados que a regra não consegue ler
 * (o `Dia` de cada colaborador).
 */
export function validarNovaSolicitacaoTroca(contexto: ContextoValidacaoNovaTroca): string[] {
  const erros: string[] = [];

  if (contexto.destinatarioLogin.trim() === '') {
    erros.push('Informe o colaborador que receberá a solicitação.');
  } else if (contexto.destinatarioLogin === contexto.solicitanteLogin) {
    erros.push('Escolha outro colaborador para a troca.');
  }
  if (!contexto.solicitanteAtivo) {
    erros.push('O solicitante precisa estar ativo.');
  }
  if (!contexto.destinatarioAtivo) {
    erros.push('O destinatário precisa estar ativo.');
  }
  if (contexto.diaSolicitante === undefined) {
    erros.push('Você não tem turno nesse dia.');
  }
  if (contexto.diaDestinatario === undefined) {
    erros.push('O colega não tem turno nesse dia.');
  }
  if (
    contexto.diaSolicitante !== undefined
    && contexto.diaDestinatario !== undefined
    && contexto.diaSolicitante.c === contexto.diaDestinatario.c
  ) {
    erros.push('Os dois já estão no mesmo turno nesse dia — não há o que trocar.');
  }

  return erros;
}

/**
 * Troca os dois dias entre os mapas `dias` dos dois colaboradores,
 * preservando todo o resto de cada documento. Usada tanto pelo cálculo de
 * alertas hipotéticos (Dashboard, antes de aprovar) quanto pela escrita real
 * da aprovação — as duas simulações precisam ser idênticas.
 */
export function aplicarTrocaNosDias(
  diasSolicitante: Record<string, Dia>,
  diasDestinatario: Record<string, Dia>,
  data: string,
): { diasSolicitante: Record<string, Dia>; diasDestinatario: Record<string, Dia> } {
  const diaSolicitante = diasSolicitante[data];
  const diaDestinatario = diasDestinatario[data];
  if (diaSolicitante === undefined || diaDestinatario === undefined) {
    throw new Error(`O dia ${data} não existe em uma das duas escalas.`);
  }
  return {
    diasSolicitante: { ...diasSolicitante, [data]: diaDestinatario },
    diasDestinatario: { ...diasDestinatario, [data]: diaSolicitante },
  };
}

/**
 * Verdadeiro quando a escala mudou desde que a solicitação foi criada — o
 * gestor não pode aprovar sobre um snapshot que não bate mais com a escala
 * publicada (cobre o risco de concorrência descrito no plano, seção 9.6).
 */
export function trocaDesatualizada(
  troca: Pick<SolicitacaoTrocaReal, 'snapshotValidacao'>,
  diaSolicitanteAtual: Dia | undefined,
  diaDestinatarioAtual: Dia | undefined,
): boolean {
  return diaSolicitanteAtual?.c !== troca.snapshotValidacao.turnoSolicitanteOriginal
    || diaDestinatarioAtual?.c !== troca.snapshotValidacao.turnoDestinatarioOriginal;
}
