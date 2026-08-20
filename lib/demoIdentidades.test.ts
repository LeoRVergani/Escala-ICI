import { describe, expect, it } from 'vitest';

import {
  EQUIPE_DEMO,
  EQUIPE_PLANTAO_DEMO,
  GRUPO_PLANTAO_DEMO,
  GESTOR_DEMO,
  PARTICIPANTES_PLANTAO_DEMO,
  UNIDADE_COSI_DEMO,
} from './demoIdentidades';
import { resolverEscoposOperacionais } from './escoposOperacionais';
import { podeGerenciarGrupoPlantao, unidadesPermitidasEfetivas } from './sessao';

describe('contextos de demonstração do COSI', () => {
  it('mantém SOC e Plantão em equipes diferentes, ambas dentro da unidade COSI', () => {
    expect(EQUIPE_DEMO.id).toBe('EQ_SOC');
    expect(EQUIPE_PLANTAO_DEMO.id).toBe('EQ_PLANTAO_COSI');
    expect(EQUIPE_DEMO.id).not.toBe(EQUIPE_PLANTAO_DEMO.id);
    expect(EQUIPE_DEMO.unidadeId).toBe(UNIDADE_COSI_DEMO.unidadeId);
    expect(EQUIPE_PLANTAO_DEMO.unidadeId).toBe(UNIDADE_COSI_DEMO.unidadeId);
  });

  it('liga o Grupo Plantão à equipe Plantão, permite consulta pelo SOC e denormaliza a unidade responsável', () => {
    expect(GRUPO_PLANTAO_DEMO.equipeResponsavelId).toBe(EQUIPE_PLANTAO_DEMO.id);
    expect(GRUPO_PLANTAO_DEMO.equipesConsulta).toEqual(
      expect.arrayContaining([EQUIPE_PLANTAO_DEMO.id, EQUIPE_DEMO.id]),
    );
    expect(GRUPO_PLANTAO_DEMO.unidadeResponsavelId).toBe(UNIDADE_COSI_DEMO.unidadeId);
  });

  it('o coordenador é GESTOR_UNIDADE de COSI, sem equipesPermitidas explícito — a administração vem só da unidade', () => {
    expect(GESTOR_DEMO.perfil).toBe('GESTOR_UNIDADE');
    expect(unidadesPermitidasEfetivas(GESTOR_DEMO)).toEqual([UNIDADE_COSI_DEMO.unidadeId]);
    expect(GESTOR_DEMO.equipesPermitidas).toBeUndefined();
  });

  it('dá ao coordenador COSI os dois contextos administráveis (SOC como Jornada, Plantão COSI como Plantão)', () => {
    const escopos = resolverEscoposOperacionais(
      GESTOR_DEMO,
      [UNIDADE_COSI_DEMO],
      [EQUIPE_DEMO, EQUIPE_PLANTAO_DEMO],
      [GRUPO_PLANTAO_DEMO],
    );
    expect(escopos.equipesAdministraveis.map((item) => item.id)).toEqual(
      expect.arrayContaining([EQUIPE_DEMO.id, EQUIPE_PLANTAO_DEMO.id]),
    );
    expect(escopos.jornadasAdministraveis.map((item) => item.id)).toEqual([EQUIPE_DEMO.id]);
    expect(escopos.plantoesAdministraveis.map((item) => item.grupoId)).toEqual([GRUPO_PLANTAO_DEMO.grupoId]);
    expect(podeGerenciarGrupoPlantao(GESTOR_DEMO, GRUPO_PLANTAO_DEMO)).toBe(true);
    expect(PARTICIPANTES_PLANTAO_DEMO.length).toBeGreaterThan(0);
  });
});
