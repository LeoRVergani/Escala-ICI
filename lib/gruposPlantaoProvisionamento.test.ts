import { describe, expect, it } from 'vitest';
import type { Equipe } from './modelos';
import {
  construirGrupoPlantaoOficial,
  derivarUnidadeResponsavelDoGrupoPlantao,
  sugerirNomeGrupoPlantao,
  TIMEZONE_PADRAO_GRUPO_PLANTAO,
} from './gruposPlantaoProvisionamento';

const equipeResponsavel: Equipe = {
  id: 'EQ_PLANTAO_COSI',
  nome: 'Plantão COSI',
  sigla: 'PLANTAO',
  ativa: true,
  unidadeId: 'COSI',
  caminhoUnidade: ['GEDSI', 'COSI'],
};

describe('derivarUnidadeResponsavelDoGrupoPlantao', () => {
  it('copia unidadeId/caminhoUnidade da equipe responsável — nunca digitado pelo usuário', () => {
    expect(derivarUnidadeResponsavelDoGrupoPlantao(equipeResponsavel)).toEqual({
      unidadeResponsavelId: 'COSI',
      caminhoUnidadeResponsavel: ['GEDSI', 'COSI'],
    });
  });

  it('equipe sem unidade (legada) ou ausente produz os dois campos undefined — nunca inventa uma unidade', () => {
    expect(derivarUnidadeResponsavelDoGrupoPlantao(undefined)).toEqual({
      unidadeResponsavelId: undefined,
      caminhoUnidadeResponsavel: undefined,
    });
    expect(derivarUnidadeResponsavelDoGrupoPlantao({ unidadeId: undefined, caminhoUnidade: undefined })).toEqual({
      unidadeResponsavelId: undefined,
      caminhoUnidadeResponsavel: undefined,
    });
  });
});

describe('sugerirNomeGrupoPlantao', () => {
  it('usa o nome da equipe de Plantão resolvida e nunca deixa o nome vazio nesse caso', () => {
    expect(sugerirNomeGrupoPlantao(equipeResponsavel)).toBe('Plantão COSI');
  });

  it('não inventa nome quando nenhuma equipe responsável foi escolhida', () => {
    expect(sugerirNomeGrupoPlantao(undefined)).toBe('');
  });
});

describe('construirGrupoPlantaoOficial', () => {
  it('preenche unidadeResponsavelId/caminhoUnidadeResponsavel a partir da equipe responsável', () => {
    const grupo = construirGrupoPlantaoOficial({
      grupoId: 'PLANTAO_COSI',
      nome: 'Plantão COSI',
      equipeResponsavel,
      criadoPorLogin: 'coordenadora.cosi',
      criadoEm: '2026-08-20T00:00:00.000Z',
    });
    expect(grupo.unidadeResponsavelId).toBe('COSI');
    expect(grupo.caminhoUnidadeResponsavel).toEqual(['GEDSI', 'COSI']);
    expect(grupo.equipeResponsavelId).toBe('EQ_PLANTAO_COSI');
  });

  it('equipesConsulta sempre inclui equipeResponsavelId, mesmo sem equipesConsultaAdicionais', () => {
    const grupo = construirGrupoPlantaoOficial({
      grupoId: 'PLANTAO_COSI',
      nome: 'Plantão COSI',
      equipeResponsavel,
      criadoPorLogin: 'coordenadora.cosi',
      criadoEm: '2026-08-20T00:00:00.000Z',
    });
    expect(grupo.equipesConsulta).toEqual(['EQ_PLANTAO_COSI']);
  });

  it('equipesConsultaAdicionais (ex.: EQ_SOC) entram junto da equipe responsável, sem duplicar', () => {
    const grupo = construirGrupoPlantaoOficial({
      grupoId: 'PLANTAO_COSI',
      nome: 'Plantão COSI',
      equipeResponsavel,
      equipesConsultaAdicionais: ['EQ_SOC', 'EQ_PLANTAO_COSI'],
      criadoPorLogin: 'coordenadora.cosi',
      criadoEm: '2026-08-20T00:00:00.000Z',
    });
    expect(grupo.equipesConsulta).toEqual(['EQ_PLANTAO_COSI', 'EQ_SOC']);
  });

  it('valores padrão: timezone America/Sao_Paulo, ativo, schemaVersion 1, atualizadoEm = criadoEm', () => {
    const grupo = construirGrupoPlantaoOficial({
      grupoId: 'PLANTAO_COSI',
      nome: 'Plantão COSI',
      equipeResponsavel,
      criadoPorLogin: 'coordenadora.cosi',
      criadoEm: '2026-08-20T00:00:00.000Z',
    });
    expect(grupo.timezone).toBe(TIMEZONE_PADRAO_GRUPO_PLANTAO);
    expect(grupo.ativo).toBe(true);
    expect(grupo.schemaVersion).toBe(1);
    expect(grupo.criadoPorLogin).toBe('coordenadora.cosi');
    expect(grupo.atualizadoEm).toBe(grupo.criadoEm);
  });

  it('nunca grava undefined em descricao quando não informada', () => {
    const grupo = construirGrupoPlantaoOficial({
      grupoId: 'PLANTAO_COSI',
      nome: 'Plantão COSI',
      equipeResponsavel,
      criadoPorLogin: 'coordenadora.cosi',
      criadoEm: '2026-08-20T00:00:00.000Z',
    });
    expect('descricao' in grupo).toBe(true);
    expect(grupo.descricao).toBeUndefined();
  });

  it('não contém nomes de unidades ou equipes de seed nas regras de construção', async () => {
    const modulo = await import('./gruposPlantaoProvisionamento');
    const fonte = Object.values(modulo).map(String).join('\n');
    expect(fonte).not.toMatch(/COSI|SOC|NOC|CODB|GEDSI|EQ_SOC|EQ_PLANTAO_COSI/u);
  });
});
