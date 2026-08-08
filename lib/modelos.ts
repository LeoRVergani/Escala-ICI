import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

/**
 * Perfil = O QUE o usuário pode fazer (autorização explícita). Diferente de
 * `nivelHierarquico`, que é só posição/ordem organizacional e nunca deve,
 * sozinho, autorizar uma ação sensível — ver `perfilEfetivo()` em
 * `lib/sessao.ts`.
 *
 * - ADMIN_SISTEMA: acesso de leitura/escrita a todas as equipes do staging.
 * - GESTOR_EQUIPE: poderes de gestor de hoje, restritos à própria equipe.
 * - ANALISTA_SOC: colaborador comum.
 * - LEITURA: reservado para uso futuro (hoje equivalente a ANALISTA_SOC).
 */
export type PerfilUsuario = 'ADMIN_SISTEMA' | 'GESTOR_EQUIPE' | 'ANALISTA_SOC' | 'LEITURA';

export type EscopoUsuario = 'GLOBAL' | 'EQUIPE';

/**
 * O `login` corporativo é a chave funcional e o ID do documento
 * `usuarios/{login}` — estável desde o cadastro, nunca muda. `uid` é
 * metadado interno opcional (o UID do Firebase Authentication, quando
 * conhecido): serve só de referência, nunca é necessário para autenticar,
 * ler ou publicar escala.
 */
export interface Usuario {
  login: string;
  uid?: string;
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
   * Autorização explícita — ver `PerfilUsuario`. Opcional para não quebrar
   * documentos existentes: quando ausente, `perfilEfetivo()` (lib/sessao.ts)
   * deriva o comportamento de hoje a partir de `nivelHierarquico`. Só
   * ADMIN_SISTEMA pode definir ou alterar este campo em qualquer usuário
   * (ver firestore.rules).
   */
  perfil?: PerfilUsuario;

  /**
   * Alcance da autorização: 'GLOBAL' (todas as equipes — só faz sentido com
   * perfil ADMIN_SISTEMA) ou 'EQUIPE' (restrito a `equipeId`, o padrão
   * implícito de todo o resto do sistema). Ausência equivale a 'EQUIPE'.
   */
  escopo?: EscopoUsuario;

  /**
   * Nomes alternativos vindos da planilha, usados apenas para comparação
   * normalizada na conciliação de importação (ver `lib/conciliacaoUsuarios.ts`).
   * Diferente de `loginAliases`, que são strings comparadas de forma exata
   * pelo parser.
   */
  aliasesPlanilha?: string[];
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Equipe {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;
}

/** Cadastro administrativo simples, mesma forma de `Equipe`. */
export interface Setor {
  id: string;
  nome: string;
  sigla: string;
  ativo: boolean;
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
  | 'VINCULADO_LOGIN'
  | 'VINCULADO_ALIAS'
  | 'PRECISA_MAPEAR'
  | 'USUARIO_INATIVO'
  | 'USUARIO_NAO_ENCONTRADO'
  | 'CONFLITO_ALIAS'
  | 'IGNORADA';

export interface LinhaConciliacao {
  nomePlanilha: string;
  login: string | null;
  status: StatusConciliacao;
  /** Logins candidatos quando o status é `CONFLITO_ALIAS`. */
  candidatos: string[];
}

export interface DadosEscala {
  documentos: TurnosMes[];
  catalogo: Record<string, TipoTurno>;
  usuarios: Usuario[];
}
