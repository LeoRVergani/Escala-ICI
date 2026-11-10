import { describe, expect, it } from 'vitest';

import { dataFinalPadraoRepeticao, diasSemanaDaRepeticao, gerarDatasRepeticao, LIMITE_OCORRENCIAS_REPETICAO_LEMBRETE } from './lembretes';

describe('LEMBRETE-REPETICAO-1 — repetir lembrete', () => {
  it('segunda a sexta: só dias úteis, do início até a data final', () => {
    // 09/11/2026 é segunda-feira.
    const datas = gerarDatasRepeticao('2026-11-09', '2026-11-22', diasSemanaDaRepeticao('DIAS_UTEIS', []));
    expect(datas).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
  });

  it('todo dia e dias escolhidos (ter e qui)', () => {
    expect(gerarDatasRepeticao('2026-11-09', '2026-11-15', diasSemanaDaRepeticao('DIARIO', []))).toHaveLength(7);
    expect(gerarDatasRepeticao('2026-11-09', '2026-11-22', diasSemanaDaRepeticao('SEMANAL', [2, 4])))
      .toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19']);
  });

  it('limite de segurança, intervalo inválido e sem dias', () => {
    expect(gerarDatasRepeticao('2026-01-01', '2027-12-31', [0, 1, 2, 3, 4, 5, 6])).toHaveLength(LIMITE_OCORRENCIAS_REPETICAO_LEMBRETE);
    expect(gerarDatasRepeticao('2026-11-20', '2026-11-10', [1])).toEqual([]);
    expect(gerarDatasRepeticao('2026-11-09', '2026-11-20', [])).toEqual([]);
  });

  it('data final sugerida: 3 meses depois', () => {
    expect(dataFinalPadraoRepeticao('2026-11-09')).toBe('2027-02-09');
  });
});
