import { describe, expect, it } from 'vitest';

import { idDocumento, normalizarCelula } from '../src/index.js';

describe('identificadores compartilhados', () => {
  it('gera o id estável de turnosMes', () => {
    expect(idDocumento('EQ_SOC', 'u2', '2026-08')).toBe('EQ_SOC_u2_2026-08');
  });

  it('normaliza célula sem acentos e espaços', () => {
    expect(normalizarCelula('  Férias ')).toBe('FERIAS');
  });
});
