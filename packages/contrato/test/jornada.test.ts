import { describe, expect, it } from 'vitest';

import {
  CATALOGO_SOC,
  competenciaOperacional,
  competenciasCandidatas,
  formatarCompetencia,
  resolverContextoJornada,
  resolverJornadaDia,
  selecionarEscalaPorData,
  type TurnosMes,
} from '../src/index.js';

const documentoBase: TurnosMes = {
  schemaVersion: 1,
  usuarioUid: 'u1',
  login: 'analista',
  equipeId: 'EQ_SOC',
  competencia: '2026-08',
  periodoInicio: '2026-07-26',
  periodoFim: '2026-08-25',
  turnoPadrao: 'M',
  status: 'PUBLICADA',
  dias: {
    '2026-07-28': { c: 'N', i: '19:00', f: '01:00', m: 360, vd: true },
    '2026-07-29': { c: 'M', i: '07:00', f: '13:00', m: 360 },
    '2026-07-30': { c: 'DU', m: 0 },
    '2026-07-31': { c: 'T', i: '14:00', f: '20:00', m: 360 },
  },
  totais: {
    min: 1_080,
    diasTrabalhados: 3,
    df: 0,
    du: 1,
    x: 0,
    he: 0,
    bh: 0,
    an: 0,
    folga: 0,
    afa: 0,
  },
};

describe('competência dinâmica', () => {
  it('vira a competência no dia 26 sem fixar mês ou ano', () => {
    expect(competenciaOperacional('2026-07-25')).toBe('2026-07');
    expect(competenciaOperacional('2026-07-26')).toBe('2026-08');
    expect(competenciaOperacional('2026-12-26')).toBe('2027-01');
  });

  it('gera candidatas de fallback e formata o rótulo', () => {
    expect(competenciasCandidatas('2026-07-29')).toEqual([
      '2026-08',
      '2026-07',
      '2026-09',
    ]);
    expect(formatarCompetencia('2026-08')).toBe('Agosto de 2026');
  });

  it('seleciona primeiro a escala que contém a data', () => {
    const antiga = {
      ...documentoBase,
      competencia: '2026-07',
      periodoInicio: '2026-06-26',
      periodoFim: '2026-07-25',
    };
    expect(selecionarEscalaPorData(
      [antiga, documentoBase],
      '2026-07-29',
    )?.competencia).toBe('2026-08');
  });
});

describe('contexto da jornada', () => {
  it('identifica o turno atual e o próximo turno', () => {
    const contexto = resolverContextoJornada(
      documentoBase,
      CATALOGO_SOC,
      { dataIso: '2026-07-29', hora: '08:30' },
    );
    expect(contexto.estado).toBe('EM_ANDAMENTO');
    expect(contexto.turnoAtual?.codigo).toBe('M');
    expect(contexto.proximoTurno?.data).toBe('2026-07-31');
    expect(contexto.proximoTurno?.inicio).toBe('14:00');
  });

  it('reconhece depois da meia-noite um turno iniciado no dia anterior', () => {
    const contexto = resolverContextoJornada(
      documentoBase,
      CATALOGO_SOC,
      { dataIso: '2026-07-29', hora: '00:30' },
    );
    expect(contexto.estado).toBe('EM_ANDAMENTO');
    expect(contexto.turnoAtual?.data).toBe('2026-07-28');
    expect(contexto.turnoAtual?.codigo).toBe('N');
    expect(contexto.proximoTurno?.codigo).toBe('M');
  });

  it('mostra descanso hoje e encontra a próxima jornada', () => {
    const contexto = resolverContextoJornada(
      documentoBase,
      CATALOGO_SOC,
      { dataIso: '2026-07-30', hora: '09:00' },
    );
    expect(contexto.estado).toBe('NAO_TRABALHA_HOJE');
    expect(contexto.hoje.codigo).toBe('DU');
    expect(contexto.hoje.descricao).toBe('DSR - Dia útil');
    expect(contexto.proximoTurno?.data).toBe('2026-07-31');
  });

  it('prioriza horários explícitos do dia sobre o catálogo', () => {
    const jornada = resolverJornadaDia(
      documentoBase,
      CATALOGO_SOC,
      '2026-07-31',
    );
    expect(jornada.inicio).toBe('14:00');
    expect(jornada.fim).toBe('20:00');
    expect(jornada.trabalha).toBe(true);
  });
});
