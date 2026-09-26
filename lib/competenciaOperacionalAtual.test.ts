import { describe, expect, it } from 'vitest';

import { competenciaOperacionalAtual } from './competenciaOperacionalAtual';

describe('competenciaOperacionalAtual — HOTFIX-COMPETENCIA-OPERACIONAL-DINAMICA-1', () => {
  it.each([
    ['2026-08-25', '2026-08'],
    ['2026-08-26', '2026-09'],
    ['2026-08-31', '2026-09'],
    ['2026-09-01', '2026-09'],
    ['2026-09-25', '2026-09'],
    ['2026-09-26', '2026-10'],
    ['2026-12-25', '2026-12'],
    ['2026-12-26', '2027-01'],
    ['2027-01-01', '2027-01'],
  ])('%s → %s', (dataIso, competenciaEsperada) => {
    const [ano, mes, dia] = dataIso.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia, 8, 0, 0);
    expect(competenciaOperacionalAtual(data)).toBe(competenciaEsperada);
  });

  it('nunca usa UTC para decidir o dia local — 26/08 às 00:01 local já é competência de setembro', () => {
    const data = new Date(2026, 7, 26, 0, 1, 0);
    expect(competenciaOperacionalAtual(data)).toBe('2026-09');
  });

  it('aceita Date opcional, default new Date() (não testado aqui por não ser determinístico, só a assinatura)', () => {
    expect(typeof competenciaOperacionalAtual).toBe('function');
    expect(competenciaOperacionalAtual.length).toBe(0);
  });
});
