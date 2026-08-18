import { describe, expect, it } from 'vitest';

import type { GrupoPlantao } from '@escala-ici/contrato';

import {
  areaGestaoInicial,
  equipesAdministraveisNaArea,
  gruposAdministraveisNaArea,
  resolverAreaGestaoAutomatica,
  unidadesDisponiveisParaGestao,
} from './areaGestaoAtiva';
import type { Equipe, Usuario } from './modelos';

function usuarioBase(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    login: 'fulano',
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    cargo: 'ANALISTA_SOC',
    equipeId: 'EQ_SOC',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...sobrescritas,
  };
}

function equipeBase(sobrescritas: Partial<Equipe> = {}): Equipe {
  return { id: 'EQ_1', nome: 'Equipe 1', sigla: 'EQ1', ativa: true, ...sobrescritas };
}

function grupoBase(sobrescritas: Partial<GrupoPlantao> = {}): GrupoPlantao {
  return {
    grupoId: 'GRUPO_1',
    nome: 'Grupo 1',
    equipeResponsavelId: 'EQ_1',
    equipesConsulta: ['EQ_1'],
    timezone: 'America/Sao_Paulo',
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: 'gestor',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

describe('unidadesDisponiveisParaGestao', () => {
  it('ADMIN_SISTEMA enxerga todas as unidades cadastradas, mesmo sem unidadesPermitidas próprias', () => {
    const admin = usuarioBase({ perfil: 'ADMIN_SISTEMA' });
    expect(unidadesDisponiveisParaGestao(admin, ['U1', 'U2', 'U3'])).toEqual(['U1', 'U2', 'U3']);
  });

  it('demais perfis só enxergam unidadesPermitidasEfetivas — nunca todas as cadastradas', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_UNIDADE', unidadesPermitidas: ['U1'] });
    expect(unidadesDisponiveisParaGestao(gestor, ['U1', 'U2', 'U3'])).toEqual(['U1']);
  });

  it('sem unidadesPermitidas nem unidadeId, lista fica vazia (nunca lança erro)', () => {
    const analista = usuarioBase({ perfil: 'ANALISTA_SOC' });
    expect(unidadesDisponiveisParaGestao(analista, ['U1'])).toEqual([]);
  });
});

describe('resolverAreaGestaoAutomatica / areaGestaoInicial', () => {
  it('exatamente uma unidade disponível vira a área ativa automaticamente, sem perguntar nada', () => {
    expect(resolverAreaGestaoAutomatica(['U1'])).toBe('U1');
  });

  it('zero ou mais de uma disponível não resolve sozinho (null — UI decide)', () => {
    expect(resolverAreaGestaoAutomatica([])).toBeNull();
    expect(resolverAreaGestaoAutomatica(['U1', 'U2'])).toBeNull();
  });

  it('preferência salva só vale enquanto ainda está entre as disponíveis atuais', () => {
    expect(areaGestaoInicial(['U1', 'U2'], 'U2')).toBe('U2');
    expect(areaGestaoInicial(['U1', 'U2'], 'U9')).toBeNull();
    expect(areaGestaoInicial(['U1'], null)).toBe('U1');
  });
});

describe('equipesAdministraveisNaArea', () => {
  it('ADMIN_SISTEMA administra qualquer equipe, mesmo fora de equipesPermitidas', () => {
    const admin = usuarioBase({ perfil: 'ADMIN_SISTEMA' });
    const equipes = [equipeBase({ id: 'EQ_A', unidadeId: 'U1' }), equipeBase({ id: 'EQ_B', unidadeId: 'U1' })];
    expect(equipesAdministraveisNaArea(admin, equipes, 'U1').map((e) => e.id)).toEqual(['EQ_A', 'EQ_B']);
  });

  it('perfil comum só vê as equipes que administra (equipesPermitidasEfetivas), nunca por pertencimento de outra pessoa', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipesPermitidas: ['EQ_A'] });
    const equipes = [equipeBase({ id: 'EQ_A', unidadeId: 'U1' }), equipeBase({ id: 'EQ_B', unidadeId: 'U1' })];
    expect(equipesAdministraveisNaArea(gestor, equipes, 'U1').map((e) => e.id)).toEqual(['EQ_A']);
  });

  it('filtra por área ativa — equipe administrável de outra unidade não aparece', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipesPermitidas: ['EQ_A', 'EQ_B'] });
    const equipes = [equipeBase({ id: 'EQ_A', unidadeId: 'U1' }), equipeBase({ id: 'EQ_B', unidadeId: 'U2' })];
    expect(equipesAdministraveisNaArea(gestor, equipes, 'U1').map((e) => e.id)).toEqual(['EQ_A']);
  });

  it('área null (sem unidade resolvida) não filtra por unidade — só por autorização', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipesPermitidas: ['EQ_A', 'EQ_B'] });
    const equipes = [equipeBase({ id: 'EQ_A', unidadeId: 'U1' }), equipeBase({ id: 'EQ_B' })];
    expect(equipesAdministraveisNaArea(gestor, equipes, null).map((e) => e.id)).toEqual(['EQ_A', 'EQ_B']);
  });
});

describe('gruposAdministraveisNaArea', () => {
  it('pertencer à equipe responsável sem ser gestor NUNCA basta (regra permanente da HIERARQUIA_ORGANIZACIONAL §7)', () => {
    const analista = usuarioBase({ perfil: 'ANALISTA_SOC', equipesPermitidas: ['EQ_1'] });
    const equipes = [equipeBase({ id: 'EQ_1', unidadeId: 'U1' })];
    const grupos = [grupoBase({ equipeResponsavelId: 'EQ_1' })];
    expect(gruposAdministraveisNaArea(analista, grupos, equipes, 'U1')).toEqual([]);
  });

  it('GESTOR_EQUIPE da equipe responsável administra o grupo', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipesPermitidas: ['EQ_1'] });
    const equipes = [equipeBase({ id: 'EQ_1', unidadeId: 'U1' })];
    const grupos = [grupoBase({ grupoId: 'G1', equipeResponsavelId: 'EQ_1' })];
    expect(gruposAdministraveisNaArea(gestor, grupos, equipes, 'U1').map((g) => g.grupoId)).toEqual(['G1']);
  });

  it('filtra pela unidade da equipe responsável, não por unidade própria do usuário', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipesPermitidas: ['EQ_1', 'EQ_2'] });
    const equipes = [
      equipeBase({ id: 'EQ_1', unidadeId: 'U1' }),
      equipeBase({ id: 'EQ_2', unidadeId: 'U2' }),
    ];
    const grupos = [
      grupoBase({ grupoId: 'G1', equipeResponsavelId: 'EQ_1' }),
      grupoBase({ grupoId: 'G2', equipeResponsavelId: 'EQ_2' }),
    ];
    expect(gruposAdministraveisNaArea(gestor, grupos, equipes, 'U1').map((g) => g.grupoId)).toEqual(['G1']);
  });

  it('grupos só de consulta (equipesConsulta) nunca aparecem, mesmo se equipesConsulta incluir a área ativa', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipesPermitidas: ['EQ_CONSULTA'] });
    const equipes = [
      equipeBase({ id: 'EQ_RESP', unidadeId: 'U1' }),
      equipeBase({ id: 'EQ_CONSULTA', unidadeId: 'U1' }),
    ];
    const grupos = [grupoBase({ grupoId: 'G1', equipeResponsavelId: 'EQ_RESP', equipesConsulta: ['EQ_RESP', 'EQ_CONSULTA'] })];
    expect(gruposAdministraveisNaArea(gestor, grupos, equipes, 'U1')).toEqual([]);
  });
});
