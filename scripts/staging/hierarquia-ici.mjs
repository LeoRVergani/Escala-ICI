/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — fonte única de dados do organograma
 * canônico do ICI para o staging reiniciado. Módulo PURO (sem I/O, sem
 * `firebase-admin`, sem `process.env`) — importado tanto por
 * `seed-hierarquia-ici.mjs` (grava) quanto por `validate-staging.mjs`
 * (confere o que foi gravado), para as duas pontas nunca divergirem.
 *
 * IDs canônicos (ver `docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`):
 *   EQ_SOC          -> GEDSI_COSI_SOC
 *   EQ_PLANTAO_COSI -> GEDSI_COSI_PLANTAO
 *   EQ_NOC          -> GEDSI_CODB_NOC
 *
 * Nenhum documento novo usa os IDs legados — `MAPEAMENTO_LEGADO` abaixo
 * existe só para relatório/migração, nunca para gravar um documento com
 * esses valores (ver `validate-staging.mjs`, que varre a base gravada para
 * confirmar que nenhum documento novo os referencia).
 *
 * Grupo de Plantão — entidade separada da equipe (mesmo padrão já usado em
 * produção/staging antigo: `PLANTAO_COSI` != `EQ_PLANTAO_COSI`), canonizado
 * com o mesmo prefixo:
 *   equipeId responsável: GEDSI_COSI_PLANTAO
 *   grupoId:              PLANTAO_GEDSI_COSI
 *   label:                "Plantão COSI"
 */

/** Espelha `idEscopoOperacional()` de `firestore.rules` — nunca diverge. */
export function idEscopoOperacional(tipo, alvoId) {
  return `${tipo}_${alvoId}`;
}

export const MAPEAMENTO_LEGADO = Object.freeze({
  EQ_SOC: 'GEDSI_COSI_SOC',
  EQ_PLANTAO_COSI: 'GEDSI_COSI_PLANTAO',
  EQ_NOC: 'GEDSI_CODB_NOC',
});

/**
 * Ordem parent-first — cada unidade referencia o `parentId` de uma anterior
 * na lista (ou `null` para raiz). `caminho`/`nivelHierarquico` são
 * resolvidos abaixo, em memória, a partir de `parentId` — nunca em
 * `firestore.rules` (que não percorre `parentId`, só lê arrays explícitos
 * de permissão já materializados no documento).
 *
 * Nomes completos vêm de `docs/spec/ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md`
 * (fonte de verdade do organograma real do ICI, seções 3-4) — nunca
 * inventados aqui.
 */
const UNIDADES_SEM_CAMINHO = [
  { unidadeId: 'PRE', sigla: 'PRE', nome: 'Presidência', tipo: 'PRESIDENCIA', parentId: null, ordem: 1, observacao: null },
  { unidadeId: 'DSI', sigla: 'DSI', nome: 'Diretoria de Sistemas e Inovação', tipo: 'DIRETORIA', parentId: 'PRE', ordem: 1, observacao: null },
  { unidadeId: 'DIO', sigla: 'DIO', nome: 'Diretoria de Infraestrutura e Operações', tipo: 'DIRETORIA', parentId: 'PRE', ordem: 2, observacao: null },
  { unidadeId: 'DAF', sigla: 'DAF', nome: 'Diretoria Administrativa e Financeira', tipo: 'DIRETORIA', parentId: 'PRE', ordem: 3, observacao: null },
  { unidadeId: 'DJC', sigla: 'DJC', nome: 'Diretoria Jurídica e Compliance', tipo: 'DIRETORIA', parentId: 'PRE', ordem: 4, observacao: null },
  { unidadeId: 'ASRIM', sigla: 'ASRIM', nome: 'Assessoria de Relações Institucionais e Mercado', tipo: 'ASSESSORIA', parentId: 'PRE', ordem: 5, observacao: null },

  { unidadeId: 'GEDSI', sigla: 'GEDSI', nome: 'Gerência de Data Center e Segurança da Informação', tipo: 'GERENCIA', parentId: 'DIO', ordem: 1, observacao: null },
  { unidadeId: 'GEDSI_COSI', sigla: 'COSI', nome: 'Coordenação de Segurança da Informação', tipo: 'COORDENACAO', parentId: 'GEDSI', ordem: 1, observacao: null },
  { unidadeId: 'GEDSI_CODB', sigla: 'CODB', nome: 'Coordenação de Data Center e Banco de Dados', tipo: 'COORDENACAO', parentId: 'GEDSI', ordem: 2, observacao: null },
  { unidadeId: 'GEDSI_COCR', sigla: 'COCR', nome: 'Coordenação de Conectividade e Redes', tipo: 'COORDENACAO', parentId: 'GEDSI', ordem: 3, observacao: null },

  { unidadeId: 'GESUP', sigla: 'GESUP', nome: 'Gerência de Infraestrutura e Suporte Técnico', tipo: 'GERENCIA', parentId: 'DIO', ordem: 2, observacao: null },
  { unidadeId: 'GESUP_CSTE', sigla: 'CSTE', nome: 'Coordenação de Suporte em TI Externo', tipo: 'COORDENACAO', parentId: 'GESUP', ordem: 1, observacao: null },
  { unidadeId: 'GESUP_COAT', sigla: 'COAT', nome: 'Coordenação de Assistência Técnica', tipo: 'COORDENACAO', parentId: 'GESUP', ordem: 2, observacao: null },
  { unidadeId: 'GESUP_COSD', sigla: 'COSD', nome: 'Coordenação de Service Desk', tipo: 'COORDENACAO', parentId: 'GESUP', ordem: 3, observacao: null },

  { unidadeId: 'GEOPE', sigla: 'GEOPE', nome: 'Gerência de Operações', tipo: 'GERENCIA', parentId: 'DIO', ordem: 3, observacao: null },
  { unidadeId: 'GEOPE_COAC', sigla: 'COAC', nome: 'Coordenação de Atendimento ao Cidadão', tipo: 'COORDENACAO', parentId: 'GEOPE', ordem: 1, observacao: null },
  { unidadeId: 'GEOPE_COPC', sigla: 'COPC', nome: 'Coordenação de Operações Continuadas', tipo: 'COORDENACAO', parentId: 'GEOPE', ordem: 2, observacao: null },
];

/**
 * Classificação de echelon por `tipo` — espelha
 * `NivelHierarquicoOrganizacional` (`lib/modelos.ts`) e
 * `docs/spec/ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` § 2/§ 5. Puramente de
 * leitura/contexto, nunca autorização.
 */
const NIVEL_POR_TIPO = {
  PRESIDENCIA: 'DELIBERATIVO',
  DIRETORIA: 'ESTRATEGICO',
  ASSESSORIA: 'ESTRATEGICO',
  GERENCIA: 'TATICO',
  COORDENACAO: 'TATICO',
  SUPERVISAO: 'TATICO',
};

function resolverCaminhos(unidadesSemCaminho) {
  const porId = new Map(unidadesSemCaminho.map((unidade) => [unidade.unidadeId, unidade]));
  const caminhoPorId = new Map();

  function caminhoDe(unidadeId) {
    if (caminhoPorId.has(unidadeId)) {
      return caminhoPorId.get(unidadeId);
    }
    const unidade = porId.get(unidadeId);
    if (unidade === undefined) {
      throw new Error(`[hierarquia-ici] parentId "${unidadeId}" não existe em UNIDADES_SEM_CAMINHO.`);
    }
    const caminho = unidade.parentId === null
      ? [unidade.unidadeId]
      : [...caminhoDe(unidade.parentId), unidade.unidadeId];
    caminhoPorId.set(unidadeId, caminho);
    return caminho;
  }

  return unidadesSemCaminho.map((unidade) => {
    const nivelHierarquico = NIVEL_POR_TIPO[unidade.tipo];
    if (nivelHierarquico === undefined) {
      throw new Error(`[hierarquia-ici] tipo "${unidade.tipo}" (${unidade.unidadeId}) não tem nivelHierarquico mapeado em NIVEL_POR_TIPO.`);
    }
    return {
      ...unidade,
      caminho: caminhoDe(unidade.unidadeId),
      nivelHierarquico,
      ativa: true,
      schemaVersion: 1,
    };
  });
}

/** Unidades organizacionais canônicas, com `caminho`/`nivelHierarquico` já resolvidos. */
export const UNIDADES = Object.freeze(resolverCaminhos(UNIDADES_SEM_CAMINHO));

const caminhoPorUnidadeId = new Map(UNIDADES.map((unidade) => [unidade.unidadeId, unidade.caminho]));

function caminhoDaUnidade(unidadeId) {
  const caminho = caminhoPorUnidadeId.get(unidadeId);
  if (caminho === undefined) {
    throw new Error(`[hierarquia-ici] unidadeId "${unidadeId}" não existe em UNIDADES.`);
  }
  return caminho;
}

/**
 * Equipes canônicas — as únicas 3 que este staging reiniciado precisa para
 * destravar SOC/Plantão COSI/NOC. Novas equipes podem ser cadastradas depois
 * pela Administração do Dashboard; este módulo cobre só o mínimo do reset.
 */
export const EQUIPES = Object.freeze([
  {
    id: 'GEDSI_COSI_SOC',
    sigla: 'SOC',
    nome: 'SOC',
    unidadeId: 'GEDSI_COSI',
    caminhoUnidade: caminhoDaUnidade('GEDSI_COSI'),
    ativa: true,
    ordem: 1,
    // Para IDs canônicos, o código organizacional derivado (formato
    // Gerência_Área_Equipe, docs/spec/ESCALA_ICI_MASTER_SPEC.md § 19)
    // coincide literalmente com o próprio id — o ID já nasce nesse formato.
    codigoOrganizacional: 'GEDSI_COSI_SOC',
    schemaVersion: 1,
  },
  {
    id: 'GEDSI_COSI_PLANTAO',
    // Nunca "PLANTAO_COSI" aqui — é literalmente o `grupoId` LEGADO
    // (entidade diferente, ver MAPEAMENTO_LEGADO/GRUPO_PLANTAO abaixo).
    sigla: 'PLANTAO',
    nome: 'Plantão COSI',
    unidadeId: 'GEDSI_COSI',
    caminhoUnidade: caminhoDaUnidade('GEDSI_COSI'),
    ativa: true,
    ordem: 2,
    codigoOrganizacional: 'GEDSI_COSI_PLANTAO',
    schemaVersion: 1,
  },
  {
    id: 'GEDSI_CODB_NOC',
    sigla: 'NOC',
    nome: 'NOC',
    unidadeId: 'GEDSI_CODB',
    caminhoUnidade: caminhoDaUnidade('GEDSI_CODB'),
    ativa: true,
    ordem: 1,
    codigoOrganizacional: 'GEDSI_CODB_NOC',
    schemaVersion: 1,
  },
]);

const equipePorId = new Map(EQUIPES.map((equipe) => [equipe.id, equipe]));

/**
 * Grupo de Plantão — entidade separada de `GEDSI_COSI_PLANTAO` (a equipe
 * responsável). `equipesConsulta` sempre contém a própria
 * `equipeResponsavelId` (exigido por `firestore.rules`) mais o SOC, mesmo
 * padrão de visibilidade cruzada que o staging antigo já tinha entre
 * `EQ_PLANTAO_COSI`/`EQ_SOC`.
 */
export const GRUPO_PLANTAO = Object.freeze({
  grupoId: 'PLANTAO_GEDSI_COSI',
  nome: 'Plantão COSI',
  equipeResponsavelId: 'GEDSI_COSI_PLANTAO',
  equipesConsulta: ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
  unidadeResponsavelId: equipePorId.get('GEDSI_COSI_PLANTAO').unidadeId,
  caminhoUnidadeResponsavel: equipePorId.get('GEDSI_COSI_PLANTAO').caminhoUnidade,
  timezone: 'America/Sao_Paulo',
  ativo: true,
  schemaVersion: 1,
});

/**
 * Usuários de teste mínimos pedidos para validar o organograma novo. Logins
 * são identificadores funcionais (nunca nomes hardcoded em regra de
 * negócio) — só existem aqui como dado de seed, igual a qualquer outro
 * usuário cadastrado pela Administração do Dashboard.
 */
export const USUARIOS_SEED = Object.freeze([
  {
    login: 'admin',
    nome: 'Administrador ICI',
    equipeId: 'ADMIN_ICI',
    nivelHierarquico: 0,
    perfil: 'ADMIN_SISTEMA',
    escopo: 'GLOBAL',
    ativo: true,
  },
  {
    // STAGING-RESET-HIERARQUIA-ICI-2 — Marina coordena a UNIDADE GEDSI_COSI
    // inteira (SOC + Plantão COSI), não só a equipe SOC. `equipeId` fica só
    // como compatibilidade visual (nunca a fonte de autorização — essa é
    // `unidadeId`/`unidadesPermitidas`, ver docs/spec/STAGING_RESET_HIERARQUIA_ICI.md § 2).
    login: 'marina.azevedo',
    nome: 'Marina Azevedo',
    equipeId: 'GEDSI_COSI_SOC',
    unidadeId: 'GEDSI_COSI',
    unidadesPermitidas: ['GEDSI_COSI'],
    nivelHierarquico: 4,
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    ativo: true,
  },
  {
    login: 'coordenador.plantao.cosi',
    nome: 'Coordenador Plantão COSI',
    equipeId: 'GEDSI_COSI_PLANTAO',
    nivelHierarquico: 4,
    perfil: 'GESTOR_EQUIPE',
    escopo: 'EQUIPE',
    ativo: true,
  },
  {
    // STAGING-RESET-HIERARQUIA-ICI-2 — mesma lógica de Marina: Wanessa
    // coordena a UNIDADE GEDSI_CODB inteira, não só a equipe NOC.
    login: 'wanessa.moriyama',
    nome: 'Wanessa Moriyama',
    equipeId: 'GEDSI_CODB_NOC',
    unidadeId: 'GEDSI_CODB',
    unidadesPermitidas: ['GEDSI_CODB'],
    nivelHierarquico: 4,
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    ativo: true,
  },
]);

/**
 * Matriz de Responsáveis inicial — existe para navegação/visualização no
 * Dashboard. NÃO é a única via de autorização em staging: a liberação
 * ampla de `souCoordenadorOperacionalStaging()` (`firestore.rules`) garante
 * que um coordenador/supervisor elegível nunca fica travado mesmo que esta
 * Matriz esteja incompleta ou desatualizada.
 */
export const MATRIZ_INICIAL = Object.freeze([
  {
    tipo: 'JORNADA',
    alvoId: 'GEDSI_COSI_SOC',
    alvoNome: 'SOC',
    unidadeId: equipePorId.get('GEDSI_COSI_SOC').unidadeId,
    caminhoUnidade: equipePorId.get('GEDSI_COSI_SOC').caminhoUnidade,
    responsaveisLogin: ['marina.azevedo'],
    responsaveisEquipe: [],
    equipesConsulta: [],
    ativo: true,
    schemaVersion: 1,
  },
  {
    tipo: 'PLANTAO',
    alvoId: GRUPO_PLANTAO.grupoId,
    alvoNome: GRUPO_PLANTAO.nome,
    unidadeId: GRUPO_PLANTAO.unidadeResponsavelId,
    caminhoUnidade: GRUPO_PLANTAO.caminhoUnidadeResponsavel,
    responsaveisLogin: ['coordenador.plantao.cosi', 'marina.azevedo'],
    responsaveisEquipe: [],
    equipesConsulta: GRUPO_PLANTAO.equipesConsulta,
    ativo: true,
    schemaVersion: 1,
  },
  {
    tipo: 'JORNADA',
    alvoId: 'GEDSI_CODB_NOC',
    alvoNome: 'NOC',
    unidadeId: equipePorId.get('GEDSI_CODB_NOC').unidadeId,
    caminhoUnidade: equipePorId.get('GEDSI_CODB_NOC').caminhoUnidade,
    responsaveisLogin: ['wanessa.moriyama'],
    responsaveisEquipe: [],
    equipesConsulta: [],
    ativo: true,
    schemaVersion: 1,
  },
]);

/** IDs de todos os documentos que este módulo descreve — usado por `validate-staging.mjs`. */
export const IDS_UNIDADES = Object.freeze(UNIDADES.map((unidade) => unidade.unidadeId));
export const IDS_EQUIPES = Object.freeze(EQUIPES.map((equipe) => equipe.id));
export const IDS_MATRIZ = Object.freeze(MATRIZ_INICIAL.map((escopo) => idEscopoOperacional(escopo.tipo, escopo.alvoId)));
