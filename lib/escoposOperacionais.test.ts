import { describe, expect, it } from 'vitest';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, UnidadeOrganizacional, Usuario } from './modelos';
import {
  plantoesDisponiveisParaMonitoramento,
  plantoesMonitoradosPelaEquipe,
  resolverEscoposOperacionais as resolverEscoposOperacionaisBase,
} from './escoposOperacionais';
import { resolverGrupoParaPlantao } from './inicioEscala';

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
 * Fase ESCOPO-CONSULTA-PLANTAO-1 — Wanessa (SUPERVISOR_EQUIPE do NOC)
 * administra a Jornada do NOC, mas não administra Plantão COSI nem
 * Plantão CODB — só pode vincular a própria equipe (EQ_NOC) à consulta
 * deles. Ver `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção
 * "Plantões monitorados por equipe".
 */
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
