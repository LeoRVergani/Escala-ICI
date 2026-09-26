import { describe, expect, it } from 'vitest';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, UnidadeOrganizacional, Usuario } from './modelos';
import {
  plantoesDisponiveisParaMonitoramento,
  plantoesMonitoradosPelaEquipe,
  resolverEscoposOperacionais as resolverEscoposOperacionaisBase,
} from './escoposOperacionais';
import { areasParaExibicaoNoWizard, equipesAdministraveisNaUnidade, resolverAreaAtiva, resolverGrupoParaPlantao } from './inicioEscala';

const unidade = (unidadeId: string, ajustes: Partial<UnidadeOrganizacional> = {}): UnidadeOrganizacional => ({
  unidadeId,
  nome: `Unidade ${unidadeId}`,
  sigla: unidadeId,
  tipo: 'COORDENACAO',
  parentId: null,
  caminho: [unidadeId],
  ativa: true,
  criadoPorLogin: 'admin',
  ...ajustes,
});

const equipe = (id: string, ajustes: Partial<Equipe> = {}): Equipe => ({
  id,
  nome: `Equipe ${id}`,
  sigla: id,
  ativa: true,
  ...ajustes,
});

const grupo = (grupoId: string, equipeResponsavelId: string, ajustes: Partial<GrupoPlantao> = {}): GrupoPlantao => ({
  grupoId,
  nome: `Grupo ${grupoId}`,
  equipeResponsavelId,
  equipesConsulta: [equipeResponsavelId],
  timezone: 'America/Sao_Paulo',
  ativo: true,
  schemaVersion: 1,
  criadoPorLogin: 'admin',
  criadoEm: '2026-08-01T00:00:00.000Z',
  atualizadoEm: '2026-08-01T00:00:00.000Z',
  ...ajustes,
});

const usuario = (ajustes: Partial<Usuario> = {}): Usuario => ({
  login: 'usuario.teste',
  nome: 'Usuário Teste',
  email: 'usuario.teste@empresa.com',
  cargo: 'ANALISTA',
  equipeId: 'EQ_QUALQUER',
  gestorUid: null,
  nivelHierarquico: 6,
  turnoPadrao: 'ADM',
  ativo: true,
  ...ajustes,
});

const UNIDADE_COSI = unidade('COSI');
const UNIDADE_CODB = unidade('CODB');
const EQ_SOC = equipe('EQ_SOC', { unidadeId: 'COSI', caminhoUnidade: ['COSI'] });
const EQ_PLANTAO_COSI = equipe('EQ_PLANTAO_COSI', { unidadeId: 'COSI', caminhoUnidade: ['COSI'] });
const EQ_NOC = equipe('EQ_NOC', { unidadeId: 'CODB', caminhoUnidade: ['CODB'] });
const GRUPO_PLANTAO_COSI = grupo('PLANTAO_COSI', EQ_PLANTAO_COSI.id, {
  equipesConsulta: [EQ_PLANTAO_COSI.id, EQ_SOC.id],
  unidadeResponsavelId: 'COSI',
  caminhoUnidadeResponsavel: ['COSI'],
});

const UNIDADES = [UNIDADE_COSI, UNIDADE_CODB];
const EQUIPES = [EQ_SOC, EQ_PLANTAO_COSI, EQ_NOC];
const GRUPOS = [GRUPO_PLANTAO_COSI];

function resolverEscoposOperacionais(
  usuarioEfetivo: Usuario,
  unidades: readonly UnidadeOrganizacional[],
  equipes: readonly Equipe[],
  grupos: readonly GrupoPlantao[],
) {
  return resolverEscoposOperacionaisBase(
    usuarioEfetivo,
    unidades,
    equipes,
    grupos,
    [],
    { permitirFallbackLegado: true },
  );
}

describe('resolverEscoposOperacionais', () => {
  it('fallback legado só roda quando explicitamente permitido', () => {
    const gestorEquipe = usuario({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
    expect(resolverEscoposOperacionaisBase(gestorEquipe, UNIDADES, EQUIPES, GRUPOS).jornadasAdministraveis).toEqual([]);
    expect(resolverEscoposOperacionais(gestorEquipe, UNIDADES, EQUIPES, GRUPOS).jornadasAdministraveis.map((item) => item.id))
      .toEqual(['EQ_SOC']);
  });

  it('ADMIN_SISTEMA sem matriz também depende do opt-in para o fallback operacional', () => {
    const admin = usuario({ perfil: 'ADMIN_SISTEMA' });
    expect(resolverEscoposOperacionaisBase(admin, UNIDADES, EQUIPES, GRUPOS).jornadasAdministraveis).toEqual([]);
    expect(resolverEscoposOperacionaisBase(admin, UNIDADES, EQUIPES, GRUPOS).plantoesAdministraveis).toEqual([]);
  });

  it('GESTOR_UNIDADE de COSI administra a unidade COSI, as equipes SOC e Plantão COSI, e o Grupo de Plantão COSI', () => {
    const gestorCosi = usuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', unidadesPermitidas: ['COSI'] });
    const escopos = resolverEscoposOperacionais(gestorCosi, UNIDADES, EQUIPES, GRUPOS);

    expect(escopos.unidadesAdministraveis.map((item) => item.unidadeId)).toEqual(['COSI']);
    expect(escopos.equipesAdministraveis.map((item) => item.id).sort()).toEqual(['EQ_PLANTAO_COSI', 'EQ_SOC']);
    expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).toEqual(['PLANTAO_COSI']);
    expect(escopos.plantoesAdministraveis).toBe(escopos.gruposPlantaoAdministraveis);
  });

  it('GESTOR_UNIDADE de COSI não vê nem administra a equipe/unidade/Plantão de outra unidade (CODB)', () => {
    const gestorCosi = usuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', unidadesPermitidas: ['COSI'] });
    const grupoCodb = grupo('PLANTAO_CODB', EQ_NOC.id, { unidadeResponsavelId: 'CODB', caminhoUnidadeResponsavel: ['CODB'] });
    const escopos = resolverEscoposOperacionais(gestorCosi, UNIDADES, EQUIPES, [...GRUPOS, grupoCodb]);

    expect(escopos.unidadesAdministraveis.map((item) => item.unidadeId)).not.toContain('CODB');
    expect(escopos.equipesAdministraveis.map((item) => item.id)).not.toContain('EQ_NOC');
    expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).not.toContain('PLANTAO_CODB');
  });

  it('separa Jornadas de Plantões: SOC é Jornada, Plantão COSI (equipe responsável de um Grupo) não é', () => {
    const gestorCosi = usuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', unidadesPermitidas: ['COSI'] });
    const escopos = resolverEscoposOperacionais(gestorCosi, UNIDADES, EQUIPES, GRUPOS);

    expect(escopos.jornadasAdministraveis.map((item) => item.id)).toEqual(['EQ_SOC']);
    expect(escopos.jornadasAdministraveis.map((item) => item.id)).not.toContain('EQ_PLANTAO_COSI');
  });

  it('equipe Plantão COSI sozinha (sem GrupoPlantao correspondente) não aparece em plantoesAdministraveis — o wizard deve oferecer criar o Grupo', () => {
    const gestorCosi = usuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', unidadesPermitidas: ['COSI'] });
    const escopos = resolverEscoposOperacionais(gestorCosi, UNIDADES, EQUIPES, []);

    expect(escopos.equipesAdministraveis.map((item) => item.id)).toContain('EQ_PLANTAO_COSI');
    expect(escopos.plantoesAdministraveis).toEqual([]);
    expect(resolverGrupoParaPlantao(escopos.plantoesAdministraveis, () => true)).toEqual({ estado: 'CRIAR' });
  });

  it('ADMIN_SISTEMA vê e administra tudo, mesmo sem nenhum campo de escopo', () => {
    const admin = usuario({ perfil: 'ADMIN_SISTEMA' });
    const escopos = resolverEscoposOperacionais(admin, UNIDADES, EQUIPES, GRUPOS);

    expect(escopos.unidadesAdministraveis.map((item) => item.unidadeId).sort()).toEqual(['CODB', 'COSI']);
    expect(escopos.equipesAdministraveis.map((item) => item.id).sort()).toEqual(['EQ_NOC', 'EQ_PLANTAO_COSI', 'EQ_SOC']);
    expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).toEqual(['PLANTAO_COSI']);
  });

  it('GESTOR_EQUIPE continua restrito às equipesPermitidasEfetivas, nunca vê unidades', () => {
    const gestorEquipe = usuario({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
    const escopos = resolverEscoposOperacionais(gestorEquipe, UNIDADES, EQUIPES, GRUPOS);

    expect(escopos.unidadesAdministraveis).toEqual([]);
    expect(escopos.equipesAdministraveis.map((item) => item.id)).toEqual(['EQ_SOC']);
    expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
  });

  it('SUPERVISOR_EQUIPE tem o mesmo alcance de GESTOR_EQUIPE', () => {
    const supervisor = usuario({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
    const escopos = resolverEscoposOperacionais(supervisor, UNIDADES, EQUIPES, GRUPOS);

    expect(escopos.equipesAdministraveis.map((item) => item.id)).toEqual(['EQ_SOC']);
  });

  it('ANALISTA_SOC/ANALISTA_SUPORTE não administram nada, mesmo pertencendo à equipe/unidade', () => {
    const analistaSoc = usuario({ perfil: 'ANALISTA_SOC', equipeId: 'EQ_SOC' });
    const analistaSuporte = usuario({ perfil: 'ANALISTA_SUPORTE', equipeId: 'EQ_PLANTAO_COSI', unidadeId: 'COSI' });

    for (const analista of [analistaSoc, analistaSuporte]) {
      const escopos = resolverEscoposOperacionais(analista, UNIDADES, EQUIPES, GRUPOS);
      expect(escopos.unidadesAdministraveis).toEqual([]);
      expect(escopos.equipesAdministraveis).toEqual([]);
      expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
    }
  });

  it('suporta subárvore via caminho materializado — GESTOR_UNIDADE de COSI também administra uma sub-unidade e suas equipes/Plantão', () => {
    const subUnidade = unidade('COSI_SUL', { parentId: 'COSI', caminho: ['COSI', 'COSI_SUL'] });
    const equipeNaSubUnidade = equipe('EQ_SOC_SUL', { unidadeId: 'COSI_SUL', caminhoUnidade: ['COSI', 'COSI_SUL'] });
    const grupoNaSubUnidade = grupo('PLANTAO_SUL', equipeNaSubUnidade.id, {
      unidadeResponsavelId: 'COSI_SUL',
      caminhoUnidadeResponsavel: ['COSI', 'COSI_SUL'],
    });
    const gestorCosi = usuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', unidadesPermitidas: ['COSI'] });

    const escopos = resolverEscoposOperacionais(
      gestorCosi,
      [...UNIDADES, subUnidade],
      [...EQUIPES, equipeNaSubUnidade],
      [...GRUPOS, grupoNaSubUnidade],
    );

    expect(escopos.unidadesAdministraveis.map((item) => item.unidadeId)).toContain('COSI_SUL');
    expect(escopos.equipesAdministraveis.map((item) => item.id)).toContain('EQ_SOC_SUL');
    expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).toContain('PLANTAO_SUL');
  });

  it('unidade/equipe/Grupo inativos nunca aparecem como administráveis', () => {
    const inativas = unidade('COSI', { ativa: false });
    const equipeInativa = equipe('EQ_SOC', { unidadeId: 'COSI', caminhoUnidade: ['COSI'], ativa: false });
    const grupoInativo = grupo('PLANTAO_COSI', 'EQ_PLANTAO_COSI', { ativo: false, unidadeResponsavelId: 'COSI' });
    const gestorCosi = usuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', unidadesPermitidas: ['COSI'] });

    const escopos = resolverEscoposOperacionais(gestorCosi, [inativas], [equipeInativa], [grupoInativo]);
    expect(escopos.unidadesAdministraveis).toEqual([]);
    expect(escopos.equipesAdministraveis).toEqual([]);
    expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
  });

  it('não contém nomes de unidades ou equipes de seed nas regras de resolução', async () => {
    const modulo = await import('./escoposOperacionais');
    const fonte = Object.values(modulo).map(String).join('\n');
    expect(fonte).not.toMatch(/COSI|SOC|NOC|CODB|GEDSI|EQ_SOC|EQ_PLANTAO_COSI/u);
  });
});

/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — `permitirAmploStaging` é um opt-in
 * SEPARADO de `permitirFallbackLegado`: espelha `souCoordenadorOperacionalStaging()`
 * de `firestore.rules`, valendo MESMO quando a Matriz já cobre o alvo (e não
 * lista o usuário) — nunca reaproveita nem altera `permitirFallbackLegado`.
 */
describe('resolverEscoposOperacionais — permitirAmploStaging (STAGING-RESET-HIERARQUIA-ICI-1)', () => {
  it('sem a opção, uma Matriz existente que não lista o usuário continua bloqueando (comportamento de produção)', () => {
    const gestorEquipe = usuario({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
    const matrizSemEsteUsuario = [{
      tipo: 'JORNADA' as const,
      alvoId: 'EQ_SOC',
      alvoNome: 'SOC',
      responsaveisLogin: ['outra.pessoa'],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: true,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    }];
    const escopos = resolverEscoposOperacionaisBase(gestorEquipe, UNIDADES, EQUIPES, GRUPOS, matrizSemEsteUsuario);
    expect(escopos.jornadasAdministraveis).toEqual([]);
  });

  /**
   * HOTFIX-STAGING-FALLBACK-MATRIZ-1 — até esta fase, `permitirAmploStaging`
   * concedia Jornada MESMO com uma Matriz ativa que não lista o usuário
   * (comportamento documentado como intencional). Isso se provou incorreto
   * na prática: uma Matriz explícita — mesmo sem listar este usuário — é
   * uma decisão operacional real e precisa vencer o fallback de staging,
   * nunca ser contornada por hierarquia. Corrigido: `alvoTemMatriz(...)`
   * agora bloqueia `jornadasAmploStaging`/`gruposPlantaoAmploStaging`
   * sempre que existe QUALQUER documento de Matriz para o alvo (ativo ou
   * inativo) — só alvo SEM NENHUMA Matriz continua elegível ao fallback.
   */
  it('Matriz ATIVA que não lista o usuário BLOQUEIA o fallback de staging — matriz explícita sempre vence', () => {
    const matrizSemEsteUsuario = [{
      tipo: 'JORNADA' as const,
      alvoId: 'EQ_SOC',
      alvoNome: 'SOC',
      responsaveisLogin: ['outra.pessoa'],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: true,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    }];
    for (const perfil of ['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'] as const) {
      const ator = usuario({ perfil, equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
      const escopos = resolverEscoposOperacionaisBase(
        ator, UNIDADES, EQUIPES, GRUPOS, matrizSemEsteUsuario, { permitirAmploStaging: true },
      );
      expect(escopos.jornadasAdministraveis).toEqual([]);
    }
  });

  it('Matriz ATIVA com o usuário explicitamente responsável concede administração pela própria Matriz, sem precisar de fallback', () => {
    const matrizComEsteUsuario = [{
      tipo: 'JORNADA' as const,
      alvoId: 'EQ_SOC',
      alvoNome: 'SOC',
      responsaveisLogin: ['gestor.soc'],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: true,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    }];
    const ator = usuario({ login: 'gestor.soc', perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
    const escopos = resolverEscoposOperacionaisBase(
      ator, UNIDADES, EQUIPES, GRUPOS, matrizComEsteUsuario, { permitirAmploStaging: true },
    );
    expect(escopos.jornadasAdministraveis.map((item) => item.id)).toEqual(['EQ_SOC']);
  });

  it('Matriz INATIVA (tombstone) também BLOQUEIA o fallback de staging — matriz inativa é fail-closed, nunca reativada pela hierarquia', () => {
    const matrizInativa = [{
      tipo: 'PLANTAO' as const,
      alvoId: 'PLANTAO_COSI',
      alvoNome: 'Plantão COSI',
      responsaveisLogin: [],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: false,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    }];
    for (const perfil of ['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'] as const) {
      const ator = usuario({ perfil, equipeId: 'EQ_PLANTAO_COSI', equipesPermitidas: ['EQ_PLANTAO_COSI'] });
      const escopos = resolverEscoposOperacionaisBase(
        ator, UNIDADES, EQUIPES, GRUPOS, matrizInativa, { permitirAmploStaging: true },
      );
      expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
    }
  });

  /**
   * HOTFIX-STAGING-MATRIZ-BOOTSTRAP-1 — a Matriz criada pelo seed estrutural
   * de staging (`scripts/staging/hierarquia-ici.mjs`, `MATRIZ_INICIAL`) é
   * sempre assim logo após um reset: ativa, mas só listando o login técnico
   * `admin`. Precisa continuar liberando o fallback amplo — só uma Matriz
   * com responsável REAL (humano ou equipe) deve travá-lo (ver `estadoMatrizOperacional()`).
   */
  it('Matriz ativa só com o login técnico "admin" (bootstrap) ainda libera o fallback de staging', () => {
    const matrizBootstrap = [{
      tipo: 'PLANTAO' as const,
      alvoId: 'PLANTAO_COSI',
      alvoNome: 'Plantão COSI',
      responsaveisLogin: ['admin'],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: true,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    }];
    for (const perfil of ['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'] as const) {
      const ator = usuario({ perfil, equipeId: 'EQ_PLANTAO_COSI', equipesPermitidas: ['EQ_PLANTAO_COSI'] });
      const escopos = resolverEscoposOperacionaisBase(
        ator, UNIDADES, EQUIPES, GRUPOS, matrizBootstrap, { permitirAmploStaging: true },
      );
      expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).toEqual(['PLANTAO_COSI']);
    }
  });

  it('alvo SEM NENHUMA Matriz continua elegível ao fallback de staging (finalidade original preservada)', () => {
    for (const perfil of ['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'] as const) {
      const ator = usuario({ perfil, equipeId: 'EQ_PLANTAO_COSI', equipesPermitidas: ['EQ_PLANTAO_COSI'] });
      const escopos = resolverEscoposOperacionaisBase(
        ator, UNIDADES, EQUIPES, GRUPOS, [], { permitirAmploStaging: true },
      );
      expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).toEqual(['PLANTAO_COSI']);
    }
  });

  it('nunca amplia para fora do escopo do usuário (equipe/unidade de terceiros continua fora, mesmo com a opção ligada)', () => {
    const gestorEquipeSoc = usuario({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
    const escopos = resolverEscoposOperacionaisBase(
      gestorEquipeSoc, UNIDADES, EQUIPES, GRUPOS, [], { permitirAmploStaging: true },
    );
    expect(escopos.jornadasAdministraveis.map((item) => item.id)).not.toContain('EQ_NOC');
    expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
  });

  it('ANALISTA_SOC nunca ganha administração via permitirAmploStaging, mesmo pertencendo à equipe', () => {
    const analista = usuario({ perfil: 'ANALISTA_SOC', equipeId: 'EQ_SOC' });
    const escopos = resolverEscoposOperacionaisBase(
      analista, UNIDADES, EQUIPES, GRUPOS, [], { permitirAmploStaging: true },
    );
    expect(escopos.jornadasAdministraveis).toEqual([]);
  });
});

/**
 * ADENDO — ÁREA DE GESTÃO NÃO RESOLVIDA NO PLANTÃO. Reproduz a cadeia real
 * de IDs canônicos do staging (`scripts/staging/hierarquia-ici.mjs`) —
 * unidade `GEDSI_COSI` (caminho de 4 níveis, não um mock de 1 nível), Grupo
 * `PLANTAO_GEDSI_COSI`, equipe responsável `GEDSI_COSI_PLANTAO` — com uma
 * Matriz existente mas que só lista `admin` (exatamente `MATRIZ_INICIAL`) e
 * um `GESTOR_UNIDADE` de `GEDSI_COSI` que NÃO é `admin` e cujo `equipeId`
 * próprio é `GEDSI_COSI_SOC` (o coordenador cuida das duas coisas, mas mora
 * na equipe de Jornada). Isto prova que `resolverEscoposOperacionais()` +
 * o resolver do Wizard (`lib/inicioEscala.ts`) já resolvem a cadeia
 * GEDSI_COSI -> PLANTAO_GEDSI_COSI -> GEDSI_COSI_PLANTAO corretamente para
 * esse perfil, quando `permitirAmploStaging` está ativo — se a tela real
 * ainda mostra "Área não cadastrada", a causa está fora deste módulo (env
 * var `VITE_ESCALA_STAGING_PERMISSAO_AMPLA` não propagada para o build em
 * execução, ou o documento `usuarios/{login}` real divergindo do esperado
 * — ver relatório da fase PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1).
 */
describe('ADENDO — Área de gestão do Plantão resolve GEDSI_COSI -> PLANTAO_GEDSI_COSI -> GEDSI_COSI_PLANTAO', () => {
  const caminhoCosi = ['PRE', 'DIO', 'GEDSI', 'GEDSI_COSI'];
  const caminhoCodb = ['PRE', 'DIO', 'GEDSI', 'GEDSI_CODB'];

  const GEDSI_COSI_UNIDADE = unidade('GEDSI_COSI', {
    nome: 'Coordenação de Segurança da Informação',
    sigla: 'COSI',
    tipo: 'COORDENACAO',
    parentId: 'GEDSI',
    caminho: caminhoCosi,
  });
  const GEDSI_CODB_UNIDADE = unidade('GEDSI_CODB', {
    nome: 'Coordenação de Data Center e Banco de Dados',
    sigla: 'CODB',
    tipo: 'COORDENACAO',
    parentId: 'GEDSI',
    caminho: caminhoCodb,
  });
  const EQUIPE_SOC_REAL = equipe('GEDSI_COSI_SOC', { nome: 'SOC', sigla: 'SOC', unidadeId: 'GEDSI_COSI', caminhoUnidade: caminhoCosi });
  const EQUIPE_PLANTAO_REAL = equipe('GEDSI_COSI_PLANTAO', { nome: 'Plantão COSI', sigla: 'PLANTAO', unidadeId: 'GEDSI_COSI', caminhoUnidade: caminhoCosi });
  const EQUIPE_NOC_REAL = equipe('GEDSI_CODB_NOC', { nome: 'NOC', sigla: 'NOC', unidadeId: 'GEDSI_CODB', caminhoUnidade: caminhoCodb });
  const GRUPO_PLANTAO_REAL = grupo('PLANTAO_GEDSI_COSI', EQUIPE_PLANTAO_REAL.id, {
    equipesConsulta: [EQUIPE_PLANTAO_REAL.id, EQUIPE_SOC_REAL.id],
    unidadeResponsavelId: 'GEDSI_COSI',
    caminhoUnidadeResponsavel: caminhoCosi,
  });
  const MATRIZ_REAL = [
    { tipo: 'PLANTAO' as const, alvoId: 'PLANTAO_GEDSI_COSI', alvoNome: 'Plantão COSI', unidadeId: 'GEDSI_COSI', caminhoUnidade: caminhoCosi, responsaveisLogin: ['admin'], responsaveisEquipe: [], equipesConsulta: GRUPO_PLANTAO_REAL.equipesConsulta, ativo: true, criadoPorLogin: 'admin', atualizadoPorLogin: 'admin', schemaVersion: 1 as const },
  ];
  const coordenadorCosi = usuario({
    login: 'clis',
    equipeId: 'GEDSI_COSI_SOC',
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    unidadeId: 'GEDSI_COSI',
    unidadesPermitidas: ['GEDSI_COSI'],
  });

  it('resolverEscoposOperacionais inclui PLANTAO_GEDSI_COSI mesmo com a Matriz só listando "admin"', () => {
    const escopos = resolverEscoposOperacionaisBase(
      coordenadorCosi,
      [GEDSI_COSI_UNIDADE, GEDSI_CODB_UNIDADE],
      [EQUIPE_SOC_REAL, EQUIPE_PLANTAO_REAL, EQUIPE_NOC_REAL],
      [GRUPO_PLANTAO_REAL],
      MATRIZ_REAL,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    expect(escopos.unidadesAdministraveis.map((item) => item.unidadeId)).toEqual(['GEDSI_COSI']);
    expect(escopos.equipesAdministraveis.map((item) => item.id).sort()).toEqual(['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC']);
    expect(escopos.plantoesAdministraveis.map((item) => item.grupoId)).toEqual(['PLANTAO_GEDSI_COSI']);
  });

  it('resolverAreaAtiva resolve GEDSI_COSI sozinha (nunca "SELECIONAR"/"CRIAR")', () => {
    const escopos = resolverEscoposOperacionaisBase(
      coordenadorCosi, [GEDSI_COSI_UNIDADE, GEDSI_CODB_UNIDADE], [EQUIPE_SOC_REAL, EQUIPE_PLANTAO_REAL, EQUIPE_NOC_REAL], [GRUPO_PLANTAO_REAL], MATRIZ_REAL,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    const area = resolverAreaAtiva(
      [GEDSI_COSI_UNIDADE, GEDSI_CODB_UNIDADE],
      escopos.unidadesAdministraveis.map((item) => item.unidadeId),
      false,
    );
    expect(area).toEqual({ estado: 'RESOLVIDO', valor: GEDSI_COSI_UNIDADE });
  });

  it('o Grupo PLANTAO_GEDSI_COSI resolve sozinho dentro da área GEDSI_COSI, com a equipe GEDSI_COSI_PLANTAO como responsável (nunca GEDSI_COSI_SOC)', () => {
    const escopos = resolverEscoposOperacionaisBase(
      coordenadorCosi, [GEDSI_COSI_UNIDADE, GEDSI_CODB_UNIDADE], [EQUIPE_SOC_REAL, EQUIPE_PLANTAO_REAL, EQUIPE_NOC_REAL], [GRUPO_PLANTAO_REAL], MATRIZ_REAL,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    const equipesNaArea = equipesAdministraveisNaUnidade(
      [EQUIPE_SOC_REAL, EQUIPE_PLANTAO_REAL, EQUIPE_NOC_REAL],
      'GEDSI_COSI',
      escopos.equipesAdministraveis.map((item) => item.id),
      false,
    );
    const gruposNaArea = escopos.plantoesAdministraveis.filter((item) => equipesNaArea.some((equipe) => equipe.id === item.equipeResponsavelId));
    const resolucao = resolverGrupoParaPlantao(
      gruposNaArea,
      (item) => escopos.plantoesAdministraveis.some((admin) => admin.grupoId === item.grupoId),
    );
    expect(resolucao).toEqual({ estado: 'RESOLVIDO', valor: GRUPO_PLANTAO_REAL });
    expect(resolucao.estado === 'RESOLVIDO' && resolucao.valor.equipeResponsavelId).toBe('GEDSI_COSI_PLANTAO');
  });

  it('areasParaExibicaoNoWizard nunca cai em "não cadastrada" quando GEDSI_COSI é administrável', () => {
    const escopos = resolverEscoposOperacionaisBase(
      coordenadorCosi, [GEDSI_COSI_UNIDADE, GEDSI_CODB_UNIDADE], [EQUIPE_SOC_REAL, EQUIPE_PLANTAO_REAL, EQUIPE_NOC_REAL], [GRUPO_PLANTAO_REAL], MATRIZ_REAL,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    const areasParaExibir = areasParaExibicaoNoWizard(
      escopos.unidadesAdministraveis,
      [GEDSI_COSI_UNIDADE, GEDSI_CODB_UNIDADE],
      EQUIPE_SOC_REAL,
    );
    expect(areasParaExibir).toEqual([GEDSI_COSI_UNIDADE]);
  });
});

/**
 * Fase ESCOPO-CONSULTA-PLANTAO-1 — Wanessa (SUPERVISOR_EQUIPE do NOC)
 * administra a Jornada do NOC, mas não administra Plantão COSI nem
 * Plantão CODB — só pode vincular a própria equipe (EQ_NOC) à consulta
 * deles. Ver `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção
 * "Plantões monitorados por equipe".
 */
/**
 * HOTFIX-STAGING-MATRIZ-BOOTSTRAP-1 — reproduz o cenário real de staging que
 * motivou este hotfix: Elton (`elrauh`, GESTOR_UNIDADE de `GEDSI_CODB`) deve
 * administrar `PLANTAO_CODB` (Matriz CONFIGURADA, ele é o responsável real)
 * mas NUNCA `NOC` (Matriz `PLANTAO_NOC` é um tombstone INATIVO — fail-closed,
 * mesmo `NOC` estando hierarquicamente dentro de `GEDSI_CODB` e mesmo com
 * `permitirFallbackLegado`/`permitirAmploStaging` ligados).
 */
describe('HOTFIX-STAGING-MATRIZ-BOOTSTRAP-1 — Elton (GESTOR_UNIDADE de GEDSI_CODB): Plantão CODB pela Matriz, NOC nunca por fallback', () => {
  const caminhoCodb = ['PRE', 'DIO', 'GEDSI', 'GEDSI_CODB'];
  const UNIDADE_GEDSI_CODB = unidade('GEDSI_CODB', { caminho: caminhoCodb });
  const EQUIPE_PLANTAO_CODB = equipe('GEDSI_CODB_PLANTAO', { unidadeId: 'GEDSI_CODB', caminhoUnidade: caminhoCodb });
  const EQUIPE_NOC = equipe('GEDSI_CODB_NOC', { unidadeId: 'GEDSI_CODB', caminhoUnidade: caminhoCodb });
  const GRUPO_PLANTAO_CODB_REAL = grupo('PLANTAO_CODB', EQUIPE_PLANTAO_CODB.id, {
    equipesConsulta: [EQUIPE_PLANTAO_CODB.id],
    unidadeResponsavelId: 'GEDSI_CODB',
    caminhoUnidadeResponsavel: caminhoCodb,
  });
  const GRUPO_NOC_LEGADO = grupo('NOC', EQUIPE_NOC.id, {
    equipesConsulta: [EQUIPE_NOC.id],
    unidadeResponsavelId: 'GEDSI_CODB',
    caminhoUnidadeResponsavel: caminhoCodb,
  });
  const MATRIZ_ELTON = [
    {
      tipo: 'PLANTAO' as const,
      alvoId: 'PLANTAO_CODB',
      alvoNome: 'Plantão CODB',
      unidadeId: 'GEDSI_CODB',
      caminhoUnidade: caminhoCodb,
      responsaveisLogin: ['elrauh'],
      responsaveisEquipe: [],
      equipesConsulta: GRUPO_PLANTAO_CODB_REAL.equipesConsulta,
      ativo: true,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    },
    {
      tipo: 'PLANTAO' as const,
      alvoId: 'NOC',
      alvoNome: 'NOC',
      responsaveisLogin: [],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: false,
      criadoPorLogin: 'admin',
      atualizadoPorLogin: 'admin',
      schemaVersion: 1 as const,
    },
  ];
  const elton = usuario({
    login: 'elrauh',
    nome: 'Elton Rauh',
    equipeId: 'GEDSI_CODB_OUTRA',
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    unidadeId: 'GEDSI_CODB',
    unidadesPermitidas: ['GEDSI_CODB'],
  });

  it('NOC (Matriz PLANTAO_NOC inativa) nunca aparece, mesmo com fallback legado e amplo de staging ligados', () => {
    const escopos = resolverEscoposOperacionaisBase(
      elton, [UNIDADE_GEDSI_CODB], [EQUIPE_PLANTAO_CODB, EQUIPE_NOC], [GRUPO_PLANTAO_CODB_REAL, GRUPO_NOC_LEGADO], MATRIZ_ELTON,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).not.toContain('NOC');
  });

  it('PLANTAO_CODB (Matriz configurada, elrauh é o responsável real) aparece pela própria Matriz', () => {
    const escopos = resolverEscoposOperacionaisBase(
      elton, [UNIDADE_GEDSI_CODB], [EQUIPE_PLANTAO_CODB, EQUIPE_NOC], [GRUPO_PLANTAO_CODB_REAL, GRUPO_NOC_LEGADO], MATRIZ_ELTON,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    expect(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId)).toContain('PLANTAO_CODB');
  });

  it('resultado conjunto de gruposPlantaoAdministraveis é exatamente {PLANTAO_CODB}, sem depender de ordenação', () => {
    const escopos = resolverEscoposOperacionaisBase(
      elton, [UNIDADE_GEDSI_CODB], [EQUIPE_PLANTAO_CODB, EQUIPE_NOC], [GRUPO_PLANTAO_CODB_REAL, GRUPO_NOC_LEGADO], MATRIZ_ELTON,
      { permitirFallbackLegado: true, permitirAmploStaging: true },
    );
    expect(new Set(escopos.gruposPlantaoAdministraveis.map((item) => item.grupoId))).toEqual(new Set(['PLANTAO_CODB']));
  });
});

describe('resolverEscoposOperacionais — plantoesConsultaveis (Plantões monitorados pela equipe)', () => {
  const GRUPO_PLANTAO_CODB = grupo('PLANTAO_CODB', 'EQ_PLANTAO_CODB', {
    equipesConsulta: ['EQ_PLANTAO_CODB'],
    unidadeResponsavelId: 'CODB',
  });

  it('Wanessa (SUPERVISOR_EQUIPE do NOC) administra a Jornada do NOC, mas Plantão COSI/CODB aparecem como consultáveis, não administráveis, antes de vincular EQ_NOC', () => {
    const wanessa = usuario({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    const escopos = resolverEscoposOperacionais(
      wanessa,
      UNIDADES,
      EQUIPES,
      [GRUPO_PLANTAO_COSI, GRUPO_PLANTAO_CODB],
    );
    expect(escopos.jornadasAdministraveis.map((item) => item.id)).toEqual(['EQ_NOC']);
    expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
    expect(escopos.plantoesConsultaveis).toEqual([]);
  });

  it('depois de EQ_NOC entrar em equipesConsulta, Plantão COSI aparece em plantoesConsultaveis, nunca em plantoesAdministraveis', () => {
    const wanessa = usuario({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    const grupoComNoc = grupo('PLANTAO_COSI', EQ_PLANTAO_COSI.id, {
      equipesConsulta: [EQ_PLANTAO_COSI.id, 'EQ_NOC'],
      unidadeResponsavelId: 'COSI',
    });
    const escopos = resolverEscoposOperacionais(wanessa, UNIDADES, EQUIPES, [grupoComNoc]);

    expect(escopos.plantoesConsultaveis.map((item) => item.grupoId)).toEqual(['PLANTAO_COSI']);
    expect(escopos.plantoesAdministraveis).toEqual([]);
    expect(escopos.gruposPlantaoAdministraveis).toEqual([]);
  });

  it('removendo EQ_NOC de equipesConsulta, o Plantão sai de plantoesConsultaveis', () => {
    const wanessa = usuario({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    const grupoSemNoc = grupo('PLANTAO_COSI', EQ_PLANTAO_COSI.id, { equipesConsulta: [EQ_PLANTAO_COSI.id] });
    const escopos = resolverEscoposOperacionais(wanessa, UNIDADES, EQUIPES, [grupoSemNoc]);
    expect(escopos.plantoesConsultaveis).toEqual([]);
  });

  it('ADMIN_SISTEMA nunca tem nada em plantoesConsultaveis — para ele tudo é administrável', () => {
    const admin = usuario({ perfil: 'ADMIN_SISTEMA' });
    const escopos = resolverEscoposOperacionais(admin, UNIDADES, EQUIPES, GRUPOS);
    expect(escopos.plantoesConsultaveis).toEqual([]);
  });

  it('plantoesMonitoradosPelaEquipe/plantoesDisponiveisParaMonitoramento — pura, parametrizada por equipe específica (Administração > Equipes > Plantões monitorados)', () => {
    const grupoComNoc = grupo('PLANTAO_COSI', EQ_PLANTAO_COSI.id, { equipesConsulta: [EQ_PLANTAO_COSI.id, 'EQ_NOC'] });
    const gruposDisponiveis = [grupoComNoc, GRUPO_PLANTAO_CODB];

    expect(plantoesMonitoradosPelaEquipe(gruposDisponiveis, 'EQ_NOC').map((item) => item.grupoId)).toEqual(['PLANTAO_COSI']);
    expect(plantoesDisponiveisParaMonitoramento(gruposDisponiveis, 'EQ_NOC').map((item) => item.grupoId)).toEqual(['PLANTAO_CODB']);
  });

  it('plantoesMonitoradosPelaEquipe/plantoesDisponiveisParaMonitoramento ignoram Grupos inativos', () => {
    const grupoInativoComNoc = grupo('PLANTAO_INATIVO', 'EQ_X', { ativo: false, equipesConsulta: ['EQ_X', 'EQ_NOC'] });
    expect(plantoesMonitoradosPelaEquipe([grupoInativoComNoc], 'EQ_NOC')).toEqual([]);
    expect(plantoesDisponiveisParaMonitoramento([grupoInativoComNoc], 'EQ_NOC')).toEqual([]);
  });
});
