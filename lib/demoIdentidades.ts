import type { GrupoPlantao, ParticipantePlantao } from '@escala-ici/contrato';
import type { Equipe, UnidadeOrganizacional, Usuario } from './modelos';

/**
 * Fase ESCOPO-GESTOR-UNIDADE-1 — o laboratório local passa a representar
 * uma Unidade Organizacional de verdade (não mais só um prefixo no `nome`
 * da equipe, `"COSI > SOC"`). COSI é a coordenação; SOC e Plantão COSI são
 * duas Equipes distintas dentro dela — ver
 * `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`.
 */
export const UNIDADE_COSI_DEMO: UnidadeOrganizacional = {
  unidadeId: 'COSI',
  nome: 'COSI',
  sigla: 'COSI',
  tipo: 'COORDENACAO',
  parentId: null,
  caminho: ['COSI'],
  ativa: true,
  criadoPorLogin: 'sofiavalente',
  criadoEm: '2026-07-01T00:00:00.000Z',
  atualizadoEm: '2026-07-01T00:00:00.000Z',
};

export const EQUIPE_DEMO: Equipe = {
  id: 'EQ_SOC',
  nome: 'SOC',
  sigla: 'SOC',
  ativa: true,
  unidadeId: UNIDADE_COSI_DEMO.unidadeId,
  caminhoUnidade: UNIDADE_COSI_DEMO.caminho,
};

/**
 * Plantão não reutiliza o id nem a equipe da Jornada SOC — o topo precisa
 * poder alternar entre os dois contextos sem misturar seus rascunhos.
 * "Plantão COSI" existe como Equipe na árvore administrativa (dentro de
 * COSI, igual SOC), mas a escala de Plantão em si é vinculada ao
 * `GrupoPlantao` abaixo, nunca a esta Equipe diretamente — ver
 * `docs/spec/PLANTOES.md` § 20 e `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`.
 */
export const EQUIPE_PLANTAO_DEMO: Equipe = {
  id: 'EQ_PLANTAO_COSI',
  nome: 'Plantão COSI',
  sigla: 'PLANTAO',
  ativa: true,
  unidadeId: UNIDADE_COSI_DEMO.unidadeId,
  caminhoUnidade: UNIDADE_COSI_DEMO.caminho,
};

export const GRUPO_PLANTAO_DEMO: GrupoPlantao = {
  grupoId: 'PLANTAO_COSI',
  nome: 'Plantão COSI',
  equipeResponsavelId: EQUIPE_PLANTAO_DEMO.id,
  equipesConsulta: [EQUIPE_PLANTAO_DEMO.id, EQUIPE_DEMO.id],
  unidadeResponsavelId: UNIDADE_COSI_DEMO.unidadeId,
  caminhoUnidadeResponsavel: UNIDADE_COSI_DEMO.caminho,
  timezone: 'America/Sao_Paulo',
  ativo: true,
  padraoHorarioSemanal: [
    { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    { diaSemana: 1, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    { diaSemana: 2, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    { diaSemana: 3, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    { diaSemana: 4, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 },
    { diaSemana: 6, horaInicio: '19:00', horaFim: '00:00', fimDiaOffset: 1 },
  ],
  schemaVersion: 1,
  criadoPorLogin: 'sofiavalente',
  criadoEm: '2026-07-01T00:00:00.000Z',
  atualizadoEm: '2026-07-01T00:00:00.000Z',
};

const IDENTIDADES = [
  ['liavilar', 'Lia Vilar', 'MD'],
  ['noahcampos', 'Noah Campos', 'MD'],
  ['mayanunes', 'Maya Nunes', 'M'],
  ['gaelfreire', 'Gael Freire', 'M'],
  ['irisporto', 'Íris Porto', 'M'],
  ['teosalles', 'Téo Salles', 'T'],
  ['auramatos', 'Aura Matos', 'T'],
  ['nilovalente', 'Nilo Valente', 'N'],
  ['evaprado', 'Eva Prado', 'N'],
] as const;

export const USUARIOS_DEMO: Usuario[] = IDENTIDADES.map(
  ([login, nome, turno], indice) => ({
    uid: `u${indice + 1}`,
    login,
    nome,
    email: `${login}@empresa.com`,
    cargo: 'ANALISTA_SOC',
    equipeId: EQUIPE_DEMO.id,
    gestorUid: 'uid_coord',
    nivelHierarquico: 6,
    turnoPadrao: turno,
    ativo: true,
  }),
);

/**
 * Coordenador da unidade COSI — `GESTOR_UNIDADE` com `unidadesPermitidas:
 * ['COSI']`, deliberadamente SEM `equipesPermitidas` explícito. Antes da
 * Fase ESCOPO-GESTOR-UNIDADE-1 este cadastro simulava a administração de
 * SOC/Plantão COSI via `equipesPermitidas` (um `GESTOR_EQUIPE` de fato,
 * apesar do cargo), o que mascarava o bug real: um `GESTOR_UNIDADE`
 * genuíno não conseguia administrar nada. `equipeId` continua apontando
 * para SOC só como metadado informativo (breadcrumb) — a autorização de
 * fato vem inteiramente de `unidadesPermitidas`, resolvida por
 * `lib/escoposOperacionais.ts`.
 */
export const GESTOR_DEMO: Usuario = {
  uid: 'uid_coord',
  login: 'sofiavalente',
  nome: 'Sofia Valente',
  email: 'sofia.valente@teste.local',
  cargo: 'COORDENADOR_COSI',
  equipeId: EQUIPE_DEMO.id,
  perfil: 'GESTOR_UNIDADE',
  escopo: 'UNIDADE',
  unidadeId: UNIDADE_COSI_DEMO.unidadeId,
  unidadesPermitidas: [UNIDADE_COSI_DEMO.unidadeId],
  gestorUid: null,
  nivelHierarquico: 4,
  turnoPadrao: 'ADM',
  ativo: true,
};

/**
 * Fase ESCOPO-CONSULTA-PLANTAO-1 — fixtures para "Plantões monitorados por
 * equipe" (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`). NOC é uma
 * equipe de Jornada de OUTRA unidade (CODB, sem relação com COSI/Sofia
 * acima) cuja supervisora (Wanessa) precisa vincular a própria equipe à
 * consulta de Plantões que ela NÃO administra (Plantão COSI e Plantão
 * CODB) — nunca usados em regra de produto, só aqui e em testes.
 */
export const UNIDADE_CODB_DEMO: UnidadeOrganizacional = {
  unidadeId: 'CODB',
  nome: 'CODB',
  sigla: 'CODB',
  tipo: 'COORDENACAO',
  parentId: null,
  caminho: ['CODB'],
  ativa: true,
  criadoPorLogin: 'wanessasupervisora',
  criadoEm: '2026-07-01T00:00:00.000Z',
  atualizadoEm: '2026-07-01T00:00:00.000Z',
};

export const EQUIPE_NOC_DEMO: Equipe = {
  id: 'EQ_NOC',
  nome: 'NOC',
  sigla: 'NOC',
  ativa: true,
  unidadeId: UNIDADE_CODB_DEMO.unidadeId,
  caminhoUnidade: UNIDADE_CODB_DEMO.caminho,
};

export const EQUIPE_PLANTAO_CODB_DEMO: Equipe = {
  id: 'EQ_PLANTAO_CODB',
  nome: 'Plantão CODB',
  sigla: 'PLANTAO_CODB',
  ativa: true,
  unidadeId: UNIDADE_CODB_DEMO.unidadeId,
  caminhoUnidade: UNIDADE_CODB_DEMO.caminho,
};

export const GRUPO_PLANTAO_CODB_DEMO: GrupoPlantao = {
  grupoId: 'PLANTAO_CODB',
  nome: 'Plantão CODB',
  equipeResponsavelId: EQUIPE_PLANTAO_CODB_DEMO.id,
  equipesConsulta: [EQUIPE_PLANTAO_CODB_DEMO.id],
  unidadeResponsavelId: UNIDADE_CODB_DEMO.unidadeId,
  caminhoUnidadeResponsavel: UNIDADE_CODB_DEMO.caminho,
  timezone: 'America/Sao_Paulo',
  ativo: true,
  schemaVersion: 1,
  criadoPorLogin: 'wanessasupervisora',
  criadoEm: '2026-07-01T00:00:00.000Z',
  atualizadoEm: '2026-07-01T00:00:00.000Z',
};

/**
 * Supervisora do NOC — `SUPERVISOR_EQUIPE` com `equipesPermitidas:
 * ['EQ_NOC']`, deliberadamente SEM `unidadesPermitidas`/`GESTOR_UNIDADE`:
 * ela administra a Jornada do NOC, mas nunca administra Plantão COSI nem
 * Plantão CODB — só pode vincular a própria equipe (EQ_NOC) à consulta
 * deles via autovínculo (`podeAutoVincularConsultaPlantao()`), nunca via
 * `equipesPermitidas`/`GESTOR_UNIDADE` sobre CODB/COSI.
 */
export const WANESSA_DEMO: Usuario = {
  uid: 'uid_wanessa',
  login: 'wanessasupervisora',
  nome: 'Wanessa Supervisora',
  email: 'wanessa.supervisora@teste.local',
  cargo: 'SUPERVISORA_NOC',
  equipeId: EQUIPE_NOC_DEMO.id,
  perfil: 'SUPERVISOR_EQUIPE',
  equipesPermitidas: [EQUIPE_NOC_DEMO.id],
  gestorUid: null,
  nivelHierarquico: 4,
  turnoPadrao: 'ADM',
  ativo: true,
};

export const LOGIN_PARA_LOGIN = Object.fromEntries(
  USUARIOS_DEMO.map(({ login }) => [login, login]),
);

export const PARTICIPANTES_PLANTAO_DEMO: ParticipantePlantao[] = USUARIOS_DEMO.slice(0, 3).map((usuario, ordem) => ({
  grupoId: GRUPO_PLANTAO_DEMO.grupoId,
  login: usuario.login,
  ativo: true,
  ordem,
  contatos: [],
  schemaVersion: 1,
  criadoPorLogin: GESTOR_DEMO.login,
  criadoEm: '2026-07-01T00:00:00.000Z',
  atualizadoEm: '2026-07-01T00:00:00.000Z',
}));
