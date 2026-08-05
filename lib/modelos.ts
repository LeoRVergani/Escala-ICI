import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

export interface Usuario {
  uid: string;
  login: string;
  loginAliases?: string[];
  nome: string;
  email: string;
  cargo: string;
  equipeId: string;
  gestorUid: string | null;
  nivelHierarquico: number;
  turnoPadrao: string;
  ativo: boolean;

  /**
   * Nomes alternativos vindos da planilha, usados apenas para comparação
   * normalizada na conciliação de importação (ver `lib/conciliacaoUsuarios.ts`).
   * Diferente de `loginAliases`, que são strings comparadas de forma exata
   * pelo parser.
   */
  aliasesPlanilha?: string[];
  /**
   * `true` quando o UID do documento é um identificador provisório, sem
   * correspondência confirmada no Firebase Authentication — ver
   * Fase 3K-D2 no checkpoint para a limitação de não renomear o ID do
   * documento depois de criado.
   */
  pendenteVinculo?: boolean;
  /**
   * Fase 3K-D2C — preenchido só no cadastro antigo, quando alguém usa
   * "Vincular ao UID do Authentication" para migrar para o UID real. Aponta
   * para o novo documento; o antigo fica `ativo: false`, mas não é apagado.
   */
  substituidoPorUid?: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Equipe {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;
}

export interface Importacao {
  id: string;
  equipeId: string;
  competencia: string;
  enviadoPor: string;
  nomeArquivo: string;
  periodoInicio: string;
  periodoFim: string;
  totalDocumentos: number;
  status: 'RASCUNHO';
}

export type TipoPublicacaoEscala = 'SEED' | 'PUBLICACAO' | 'ROLLBACK';

export interface AlteracaoEscala {
  usuarioUid: string;
  login: string;
  data: string;
  codigoAnterior: string | null;
  horarioAnterior: string | null;
  codigoNovo: string | null;
  horarioNovo: string | null;
}

export interface EventoEscala {
  id: string;
  publicacaoId: string;
  equipeId: string;
  competencia: string;
  revisao: number;
  tipo: TipoPublicacaoEscala;
  usuarioUid: string;
  motivo: string;
  publicadoPor: string;
  publicadoEm: string;
  alteracoes: AlteracaoEscala[];
}

export interface PublicacaoEscala {
  id: string;
  chavePublicacao: string;
  equipeId: string;
  competencia: string;
  revisao: number;
  tipo: TipoPublicacaoEscala;
  revisaoOrigem: number | null;
  revisaoSubstituida: number | null;
  totalDocumentos: number;
  motivo?: string;
  totalColaboradoresAfetados?: number;
  totalDiasAlterados?: number;
  publicadoPor: string;
  publicadoEm: string;
}

export interface EstadoPublicacaoEscala {
  id: string;
  equipeId: string;
  competencia: string;
  revisaoAtual: number;
  ultimaPublicacaoId: string;
  atualizadoPor: string;
  atualizadoEm: string;
}

/**
 * Fase 3K-D1 — desenho inicial da troca de escala.
 *
 * Contrato preparado, ainda não implementado. Regras do desenho:
 * - o App do colaborador poderá, no futuro, escrever apenas em
 *   `solicitacoesTroca`, e somente como solicitante;
 * - o App nunca edita `turnosMes`, `rascunhosTurnosMes` nem gera revisão;
 * - a aprovação e a aplicação final na escala ficam no Dashboard/gestor, que
 *   aplica a troca pelo fluxo de revisão já existente.
 */
export type StatusSolicitacaoTroca =
  | 'PENDENTE'
  | 'CANCELADA'
  | 'RECUSADA'
  | 'APROVADA'
  | 'APLICADA';

export type AtorSolicitacaoTroca = 'COLABORADOR' | 'GESTOR';

/** Fotografia somente leitura do dia envolvido na troca. */
export interface DiaSolicitacaoTroca {
  data: string;
  codigo: string | null;
  horario: string | null;
}

/** Campos que o App pode enviar ao criar uma solicitação. */
export interface NovaSolicitacaoTroca {
  equipeId: string;
  competencia: string;
  revisaoBase: number;
  solicitanteUid: string;
  solicitanteLogin: string;
  destinatarioUid: string;
  destinatarioLogin: string;
  diaSolicitante: DiaSolicitacaoTroca;
  diaDestinatario: DiaSolicitacaoTroca;
  motivo: string;
}

export interface SolicitacaoTroca extends NovaSolicitacaoTroca {
  id: string;
  status: StatusSolicitacaoTroca;
  criadoEm: string;
  atualizadoEm: string;
  /** Preenchido apenas pelo Dashboard/gestor. */
  decididoPor: string | null;
  decididoEm: string | null;
  observacaoGestor: string | null;
  /** Revisão da escala em que a troca foi efetivamente aplicada. */
  aplicadoNaRevisao: number | null;
}

/**
 * Fase 3K-D2 — conciliação de nomes importados da planilha.
 *
 * Uma linha por texto distinto encontrado na coluna de colaborador da
 * planilha. Ver `lib/conciliacaoUsuarios.ts` para a lógica pura de
 * classificação e `lib/nomes.ts` para a normalização usada na comparação.
 */
export type StatusConciliacao =
  | 'VINCULADO_UID'
  | 'VINCULADO_ALIAS'
  | 'PRECISA_MAPEAR'
  | 'USUARIO_INATIVO'
  | 'USUARIO_NAO_ENCONTRADO'
  | 'CONFLITO_ALIAS'
  | 'IGNORADA';

export interface LinhaConciliacao {
  nomePlanilha: string;
  usuarioUid: string | null;
  status: StatusConciliacao;
  /** UIDs candidatos quando o status é `CONFLITO_ALIAS`. */
  candidatos: string[];
}

export interface DadosEscala {
  documentos: TurnosMes[];
  catalogo: Record<string, TipoTurno>;
  usuarios: Usuario[];
}
