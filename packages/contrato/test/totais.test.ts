import { describe, expect, it } from 'vitest';

import {
  calcularTotais,
  formatarMinutos,
  montarChaveDia,
  normalizarTexto,
  type Dia,
} from '../src/index.js';
import { CATALOGO_SOC } from './dados.js';

describe('normalização e totais', () => {
  it('17. formata minutos sem rollover e normaliza os auxiliares', () => {
    expect(formatarMinutos(28_080)).toBe('468:00');
    expect(montarChaveDia(new Date(Date.UTC(2026, 6, 26)))).toBe('2026-07-26');
    expect(normalizarTexto('  Manhã  ')).toBe('MANHA');
  });

  it('18. recalcula os totais do zero de forma idempotente', () => {
    const dias: Record<string, Dia> = {
      '2026-07-26': { c: 'DF' },
      '2026-07-27': {
        c: 'MD',
        i: '01:00',
        f: '07:00',
        m: 360,
        vd: false,
        seq: 1,
      },
      '2026-07-28': {
        c: 'MD',
        i: '01:00',
        f: '07:00',
        m: 360,
        vd: false,
        seq: 2,
      },
      '2026-07-29': { c: 'AFA' },
    };

    const primeira = calcularTotais(dias, CATALOGO_SOC);
    const segunda = calcularTotais(dias, CATALOGO_SOC);

    expect(primeira).toEqual({
      min: 720,
      diasTrabalhados: 2,
      df: 1,
      du: 0,
      x: 0,
      he: 0,
      bh: 0,
      an: 0,
      folga: 0,
      afa: 1,
    });
    expect(segunda).toEqual(primeira);
  });
});
