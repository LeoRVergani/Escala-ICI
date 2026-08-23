import { describe, expect, it } from 'vitest';

import type { GrupoPlantao } from '@escala-ici/contrato';
import { criarContextoEscala } from './contextoEscala';
import type { EscoposOperacionais } from './escoposOperacionais';
import type { Equipe, Usuario } from './modelos';
import {
  classeSaudeOperacaoDashboard,
  derivarStatusOperacaoDashboard,
  resolverOperacoesDashboard,
  rotuloStatusOperacaoDashboard,
} from './operacoesDashboard';

function usuarioBase(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    login: 'fulano',
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    cargo: '',
    equipeId: 'EQ_X',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...sobrescritas,
  };
}

function equipe(id: string, nome: string): Equipe {
  return { id, nome, sigla: nome, ativa: true };
}

const grupoPlantaoCosi: GrupoPlantao = {
  grupoId: 'PLANTAO_GEDSI_COSI',
  nome: 'Plantão COSI',
  equipeResponsavelId: 'GEDSI_COSI_PLANTAO',
  equipesConsulta: ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
  unidadeResponsavelId: 'GEDSI_COSI',
  timezone: 'America/Sao_Paulo',
  ativo: true,
  schemaVersion: 1,
  criadoPorLogin: 'admin',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
};

function escopos(sobrescritas: Partial<EscoposOperacionais> = {}): EscoposOperacionais {
  return {
    unidadesAdministraveis: [],
    equipesAdministraveis: [],
    jornadasAdministraveis: [],
    gruposPlantaoAdministraveis: [],
    plantoesAdministraveis: [],
    plantoesConsultaveis: [],
    plantoesMonitorados: [],
    alvosDisponiveisParaConfiguracao: { jornadas: [], plantoes: [] },
    ...sobrescritas,
  };
}

const semRascunhoNemPublicada = () => ({ temRascunho: false, temPublicada: false });

describe('derivarStatusOperacaoDashboard', () => {
  it('sem rascunho e sem publicada -> sem-escala', () => {
    expect(derivarStatusOperacaoDashboard(false, false)).toBe('sem-escala');
  });

  it('só rascunho -> rascunho', () => {
    expect(derivarStatusOperacaoDashboard(true, false)).toBe('rascunho');
  });

  it('só publicada -> publicada', () => {
    expect(derivarStatusOperacaoDashboard(false, true)).toBe('publicada');
  });

  it('rascunho E publicada ao mesmo tempo -> publicada-com-rascunho-pendente (nunca colapsa para "rascunho" sozinho)', () => {
    expect(derivarStatusOperacaoDashboard(true, true)).toBe('publicada-com-rascunho-pendente');
  });
});

describe('rotuloStatusOperacaoDashboard', () => {
  it('tem um rótulo distinto para cada um dos 4 estados', () => {
    const rotulos = new Set([
      rotuloStatusOperacaoDashboard('sem-escala'),
      rotuloStatusOperacaoDashboard('rascunho'),
      rotuloStatusOperacaoDashboard('publicada'),
      rotuloStatusOperacaoDashboard('publicada-com-rascunho-pendente'),
    ]);
    expect(rotulos.size).toBe(4);
  });
});

describe('classeSaudeOperacaoDashboard', () => {
  it('sem-escala é sempre "empty", mesmo com alertas', () => {
    expect(classeSaudeOperacaoDashboard('sem-escala', 5)).toBe('empty');
  });

  it('publicada sem alertas é "stable"', () => {
    expect(classeSaudeOperacaoDashboard('publicada', 0)).toBe('stable');
  });

  it('publicada com alertas é "attention"', () => {
    expect(classeSaudeOperacaoDashboard('publicada', 1)).toBe('attention');
  });

  it('publicada-com-rascunho-pendente é sempre "attention", mesmo sem alertas — precisa chamar atenção do gestor', () => {
    expect(classeSaudeOperacaoDashboard('publicada-com-rascunho-pendente', 0)).toBe('attention');
  });
});

describe('resolverOperacoesDashboard', () => {
  it('ADMIN_SISTEMA vê SOC, NOC e Plantão COSI — nunca um card genérico "Plantão"', () => {
    const admin = usuarioBase({ login: 'admin', perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL' });
    const dados = {
      escopos: escopos({
        jornadasAdministraveis: [equipe('GEDSI_COSI_SOC', 'SOC'), equipe('GEDSI_CODB_NOC', 'NOC')],
        plantoesAdministraveis: [grupoPlantaoCosi],
      }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    const operacoes = resolverOperacoesDashboard(admin, null, dados);
    const nomes = operacoes.map((op) => op.nome).sort();
    expect(nomes).toEqual(['NOC', 'Plantão COSI', 'SOC']);
    expect(operacoes.every((op) => op.nome !== 'Plantão')).toBe(true);
    expect(operacoes.find((op) => op.tipo === 'PLANTAO')?.alvoId).toBe('PLANTAO_GEDSI_COSI');
  });

  it('GESTOR_UNIDADE de GEDSI_COSI (Claudio) vê SOC e Plantão COSI, nunca NOC', () => {
    const clis = usuarioBase({
      login: 'clis',
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
      unidadeId: 'GEDSI_COSI',
      unidadesPermitidas: ['GEDSI_COSI'],
    });
    const dados = {
      escopos: escopos({
        jornadasAdministraveis: [equipe('GEDSI_COSI_SOC', 'SOC')],
        plantoesAdministraveis: [grupoPlantaoCosi],
      }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    const operacoes = resolverOperacoesDashboard(clis, null, dados);
    const nomes = operacoes.map((op) => op.nome).sort();
    expect(nomes).toEqual(['Plantão COSI', 'SOC']);
    expect(nomes).not.toContain('NOC');
    expect(operacoes.some((op) => op.nome === 'Plantão')).toBe(false);
  });

  it('supervisora do NOC vê só NOC — nunca SOC, nunca Plantão COSI, nunca card genérico', () => {
    const wanessa = usuarioBase({
      login: 'wanessa',
      perfil: 'SUPERVISOR_EQUIPE',
      escopo: 'EQUIPE',
      unidadeId: 'GEDSI_CODB',
      equipeId: 'GEDSI_CODB_NOC',
      equipesPermitidas: ['GEDSI_CODB_NOC'],
    });
    const dados = {
      escopos: escopos({ jornadasAdministraveis: [equipe('GEDSI_CODB_NOC', 'NOC')] }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    const operacoes = resolverOperacoesDashboard(wanessa, null, dados);
    expect(operacoes.map((op) => op.nome)).toEqual(['NOC']);
    expect(operacoes.some((op) => op.tipo === 'PLANTAO')).toBe(false);
  });

  it('marca `ativa: true` só na operação que bate com o contexto ativo — nunca mais de uma', () => {
    const admin = usuarioBase({ login: 'admin', perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL' });
    const contexto = criarContextoEscala('PLANTAO', 'PLANTAO_GEDSI_COSI', 'Plantão COSI', '2026-08');
    const dados = {
      escopos: escopos({
        jornadasAdministraveis: [equipe('GEDSI_COSI_SOC', 'SOC')],
        plantoesAdministraveis: [grupoPlantaoCosi],
      }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    const operacoes = resolverOperacoesDashboard(admin, contexto, dados);
    expect(operacoes.filter((op) => op.ativa)).toHaveLength(1);
    expect(operacoes.find((op) => op.ativa)?.alvoId).toBe('PLANTAO_GEDSI_COSI');
  });

  it('usa o mesmo derivarStatusOperacaoDashboard — nunca uma segunda lógica de status embutida', () => {
    const admin = usuarioBase({ login: 'admin', perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL' });
    const dados = {
      escopos: escopos({ plantoesAdministraveis: [grupoPlantaoCosi] }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: () => ({ temRascunho: true, temPublicada: true }),
    };
    const operacoes = resolverOperacoesDashboard(admin, null, dados);
    expect(operacoes[0]?.status).toBe(derivarStatusOperacaoDashboard(true, true));
    expect(operacoes[0]?.status).toBe('publicada-com-rascunho-pendente');
  });

  it('Grupos monitorados (consulta) aparecem marcados consulta:true, nunca misturados com os administráveis', () => {
    const supervisor = usuarioBase({
      login: 'supervisor.soc',
      perfil: 'SUPERVISOR_EQUIPE',
      escopo: 'EQUIPE',
      equipeId: 'GEDSI_COSI_SOC',
      equipesPermitidas: ['GEDSI_COSI_SOC'],
    });
    const dados = {
      escopos: escopos({ plantoesMonitorados: [grupoPlantaoCosi] }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    const operacoes = resolverOperacoesDashboard(supervisor, null, dados);
    expect(operacoes).toHaveLength(1);
    expect(operacoes[0]?.consulta).toBe(true);
  });

  it('usuário inativo nunca vê nenhuma operação, mesmo com escopos resolvidos', () => {
    const inativo = usuarioBase({ perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL', ativo: false });
    const dados = {
      escopos: escopos({
        jornadasAdministraveis: [equipe('GEDSI_COSI_SOC', 'SOC')],
        plantoesAdministraveis: [grupoPlantaoCosi],
      }),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    expect(resolverOperacoesDashboard(inativo, null, dados)).toEqual([]);
  });

  it('nunca inventa uma operação PLANTAO sem grupoId real — a lista vem só de escopos.plantoesAdministraveis/plantoesMonitorados', () => {
    const admin = usuarioBase({ login: 'admin', perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL' });
    const dados = {
      escopos: escopos(),
      statusJornada: semRascunhoNemPublicada,
      statusPlantao: semRascunhoNemPublicada,
    };
    expect(resolverOperacoesDashboard(admin, null, dados)).toEqual([]);
  });
});
