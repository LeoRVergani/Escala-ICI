import { describe, expect, it } from 'vitest';
import {
  chaveContextoEscala,
  contextoEhJornada,
  contextoEhPlantao,
  contextosEscalaIguais,
  type ContextoEscalaAtivo,
} from './contextoEscala';

describe('ContextoEscalaAtivo — Fase ESCALAS-UX-2A.1 (contexto ativo de escala)', () => {
  it('1. contexto Jornada válido — tipo, equipeId e competencia preservados', () => {
    const contexto: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-08' };
    expect(contexto.tipo).toBe('JORNADA');
    expect(contexto.equipeId).toBe('EQ_1');
    expect(contexto.competencia).toBe('2026-08');
  });

  it('2. contexto Plantão válido — tipo, grupoId e competencia preservados', () => {
    const contexto: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: 'GRUPO_1', competencia: '2026-08' };
    expect(contexto.tipo).toBe('PLANTAO');
    expect(contexto.grupoId).toBe('GRUPO_1');
    expect(contexto.competencia).toBe('2026-08');
  });

  it('3. identidade é sempre por ID — chaveContextoEscala nunca inclui nome/sigla', () => {
    const contexto: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_ABC', competencia: '2026-08' };
    expect(chaveContextoEscala(contexto)).toBe('JORNADA:EQ_ABC:2026-08');
  });

  it('4. competência faz parte da identidade do contexto', () => {
    const a: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-08' };
    const b: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-09' };
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('5. igualdade Jornada — mesma equipe e competência é o mesmo contexto', () => {
    const a: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-08' };
    const b: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-08' };
    expect(contextosEscalaIguais(a, b)).toBe(true);
  });

  it('6. igualdade Plantão — mesmo grupo e competência é o mesmo contexto', () => {
    const a: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: 'GRUPO_1', competencia: '2026-08' };
    const b: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: 'GRUPO_1', competencia: '2026-08' };
    expect(contextosEscalaIguais(a, b)).toBe(true);
  });

  it('7. equipes diferentes nunca são o mesmo contexto', () => {
    const a: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-08' };
    const b: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_2', competencia: '2026-08' };
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('8. grupos de Plantão diferentes nunca são o mesmo contexto', () => {
    const a: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: 'GRUPO_1', competencia: '2026-08' };
    const b: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: 'GRUPO_2', competencia: '2026-08' };
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('9. Jornada e Plantão nunca são o mesmo contexto, mesmo com o mesmo ID/competência coincidentes', () => {
    const a: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'X', competencia: '2026-08' };
    const b: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: 'X', competencia: '2026-08' };
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('10. nenhum hardcode de sigla — contextoEhJornada/contextoEhPlantao funcionam para qualquer ID, sem lista fixa de siglas conhecidas', () => {
    const siglasQuaisquer = ['SOC', 'NOC', 'COSI', 'QUALQUER_OUTRA_SIGLA_FUTURA'];
    for (const sigla of siglasQuaisquer) {
      const jornada: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: sigla, competencia: '2026-08' };
      const plantao: ContextoEscalaAtivo = { tipo: 'PLANTAO', grupoId: sigla, competencia: '2026-08' };
      expect(contextoEhJornada(jornada)).toBe(true);
      expect(contextoEhPlantao(jornada)).toBe(false);
      expect(contextoEhPlantao(plantao)).toBe(true);
      expect(contextoEhJornada(plantao)).toBe(false);
    }
  });

  it('contextoEhJornada/contextoEhPlantao retornam false para null (nenhum contexto selecionado)', () => {
    expect(contextoEhJornada(null)).toBe(false);
    expect(contextoEhPlantao(null)).toBe(false);
  });

  it('contextosEscalaIguais(null, null) é true; contextosEscalaIguais(null, algo) é false', () => {
    const contexto: ContextoEscalaAtivo = { tipo: 'JORNADA', equipeId: 'EQ_1', competencia: '2026-08' };
    expect(contextosEscalaIguais(null, null)).toBe(true);
    expect(contextosEscalaIguais(null, contexto)).toBe(false);
    expect(contextosEscalaIguais(contexto, null)).toBe(false);
  });
});
