import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

/**
 * Perfil = O QUE o usuário pode fazer (autorização explícita). Diferente de
 * `nivelHierarquico`, que é só posição/ordem organizacional e nunca deve,
 * sozinho, autorizar uma ação sensível — ver `perfilEfetivo()` em
 * `lib/sessao.ts`.
 *
 * - ADMIN_SISTEMA: acesso de leitura/escrita a todas as equipes do staging.
 * - GESTOR_EQUIPE: poderes de gestor de hoje, restritos à própria equipe.
 * - GESTOR_UNIDADE: poderes de gestor sobre `unidadesPermitidas`/
 *   `equipesPermitidas` — pode criar unidades/equipes abaixo das unidades
 *   permitidas. Ver `unidadesPermitidasEfetivas()`/`equipesPermitidasEfetivas()`.
 * - SUPERVISOR_EQUIPE: mesmo alcance de GESTOR_EQUIPE (via `equipesPermitidas`),
 *   nome distinto só para refletir o cargo real na hierarquia.
 * - ANALISTA_SOC: colaborador comum.
 * - ANALISTA_SUPORTE: colaborador comum de outra área — mesmo alcance de
 *   ANALISTA_SOC, nome distinto só para refletir o cargo real.
 * - LEITURA: reservado para uso futuro (hoje equivalente a ANALISTA_SOC).
 */
export type PerfilUsuario =
  | 'ADMIN_SISTEMA'
  | 'GESTOR_EQUIPE'
  | 'ANALISTA_SOC'
  | 'LEITURA'
  | 'GESTOR_UNIDADE'
  | 'SUPERVISOR_EQUIPE'
  | 'ANALISTA_SUPORTE';

export type EscopoUsuario = 'GLOBAL' | 'EQUIPE' | 'UNIDADE';

export interface ContextoCadastroOperacionalUsuario {
  tipo: 'JORNADA' | 'PLANTAO';
  alvoId: string;
  criadoPorLogin: string;
}

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
   * ADMIN_SISTEMA pode definir qualquer perfil. Um responsável operacional
   * também pode definir `GESTOR_EQUIPE` ou `SUPERVISOR_EQUIPE` ao criar uma
   * pessoa dentro da equipe do próprio alvo; nunca pode conceder
   * `ADMIN_SISTEMA`, `GESTOR_UNIDADE` ou escopo global (ver firestore.rules).
   */
  perfil?: PerfilUsuario;

  /**
   * Alcance da autorização: 'GLOBAL' (todas as equipes — só faz sentido com
   * perfil ADMIN_SISTEMA) ou 'EQUIPE' (restrito a `equipeId`, o padrão
   * implícito de todo o resto do sistema). Ausência equivale a 'EQUIPE'.
   */
  escopo?: EscopoUsuario;

  /**
   * Unidade organizacional "principal" do usuário (ver `UnidadeOrganizacional`).
   * Hoje é sobretudo metadado informativo/UX (breadcrumb no cadastro) — a
   * autorização de fato usa `unidadesPermitidas`, que cai de volta para
   * `[unidadeId]` quando ausente (ver `unidadesPermitidasEfetivas()` em
   * `lib/sessao.ts`). Ausência é normal — usuário sem unidade atribuída não
   * quebra nada.
   */
  unidadeId?: string;

  /**
   * Unidades sobre as quais este usuário (tipicamente GESTOR_UNIDADE) tem
   * poder de gestor, inclusive para criar sub-unidades/equipes abaixo de
   * qualquer uma delas. Ausente => fallback para `[unidadeId]` se existir,
   * senão `[]` — nunca lança erro. Ver `unidadesPermitidasEfetivas()`.
   */
  unidadesPermitidas?: string[];

  /**
   * Equipes sobre as quais este usuário tem poder de gestor/leitura
   * administrativa. Ausente => fallback para `[equipeId]` — é assim que
   * todo GESTOR_EQUIPE/ANALISTA_SOC existente continua funcionando sem
   * qualquer migração de dado. Ver `equipesPermitidasEfetivas()`.
   */
  equipesPermitidas?: string[];

  /**
   * Nomes alternativos vindos da planilha, usados apenas para comparação
   * normalizada na conciliação de importação (ver `lib/conciliacaoUsuarios.ts`).
   * Diferente de `loginAliases`, que são strings comparadas de forma exata
   * pelo parser.
   */
  aliasesPlanilha?: string[];
  /**
   * Rastreia o alvo que autorizou um cadastro feito por responsável não-admin.
   * É metadado de auditoria e autorização da criação, não concede acesso
   * futuro e não substitui a Matriz de Responsáveis por Escala.
   */
  cadastroOperacional?: ContextoCadastroOperacionalUsuario;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Equipe {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;

  /**
   * Opcionais — equipes antigas continuam válidas em todo lugar sem eles
   * (rules, repositório e telas nunca exigem `unidadeId`/`caminhoUnidade`).
   * `caminhoUnidade` é o `caminho` (verbatim, sem anexar o id da própria
   * equipe) da `UnidadeOrganizacional` selecionada no momento da
   * criação/edição — só metadado de breadcrumb, nunca usado em rules.
   */
  unidadeId?: string;
  caminhoUnidade?: string[];
}

/** Cadastro administrativo simples, mesma forma de `Equipe`. Mantido intacto
 * por compatibilidade — não referenciado por nada (`Usuario`/`Equipe`/
 * `turnosMes`); a tela "Administração" passou a usar
 * `UnidadeOrganizacional` para novos cadastros, mas `setores` continua
 * funcionando (rules e repositório inalterados).
 */
export interface Setor {
  id: string;
  nome: string;
  sigla: string;
  ativo: boolean;
}

/**
 * Nó genérico da hierarquia organizacional acima de `Equipe` — qualquer
 * nível (diretoria, gerência, coordenação, supervisão...) é uma
 * `UnidadeOrganizacional`; só o nó que efetivamente recebe escala é uma
 * `Equipe`. Coleção aditiva: não substitui `setores`/`equipes`.
 */
export type TipoUnidadeOrganizacional =
  | 'PRESIDENCIA'
  | 'DIRETORIA'
  | 'GERENCIA'
  | 'COORDENACAO'
  | 'SUPERVISAO'
  | 'AREA'
  | 'SETOR'
  | 'DEPARTAMENTO';

export interface UnidadeOrganizacional {
  unidadeId: string;
  nome: string;
  sigla: string;
  tipo: TipoUnidadeOrganizacional;
  /** `null` só para a raiz da hierarquia (ex.: Diretor Presidente). */
  parentId: string | null;
  /**
   * Caminho completo de `unidadeId`s da raiz até o próprio nó, INCLUSIVE o
   * próprio `unidadeId` como último elemento. Calculado uma única vez na
   * criação (a partir do `caminho` da unidade-pai) e nunca recomputado em
   * `firestore.rules` — rules só leem arrays explícitos, nunca percorrem
   * `parentId`.
   */
  caminho: string[];
  ativa: boolean;
  criadoPorLogin: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export type TipoEscopoOperacional = 'JORNADA' | 'PLANTAO';

export interface EscopoOperacional {
  tipo: TipoEscopoOperacional;
  /** Para JORNADA é `Equipe.id`; para PLANTAO é `GrupoPlantao.grupoId`. */
  alvoId: string;
  alvoNome: string;
  unidadeId?: string;
  caminhoUnidade?: string[];
  responsaveisLogin: string[];
  responsaveisEquipe: string[];
  equipesConsulta: string[];
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
  criadoPorLogin: string;
  atualizadoPorLogin: string;
  schemaVersion: 1;
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
