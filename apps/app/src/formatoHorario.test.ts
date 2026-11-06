import { describe, expect, it } from 'vitest';

import { faixaHorario, normalizarFaixaHorario } from './formatoHorario';

describe('FORMATO-HORARIO-1', () => {
  it('traço curto com espaços', () => {
    expect(faixaHorario('19:00', '01:00')).toBe('19:00 - 01:00');
    expect(faixaHorario(undefined, '01:00')).toBe('');
  });
  it('converte o formato antigo gravado', () => {
    expect(normalizarFaixaHorario('19:00–01:00')).toBe('19:00 - 01:00');
    expect(normalizarFaixaHorario('Noite · 19:00 – 01:00')).toBe('Noite · 19:00 - 01:00');
  });
});
