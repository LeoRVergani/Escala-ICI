import { describe, expect, it } from 'vitest';

import { formatarDataHoraSafe, formatarDataSafe, formatarDiaTrocaSafe, toDateSafe } from './dataSegura';

describe('toDateSafe', () => {
  it('aceita um Timestamp com toDate()', () => {
    const referencia = new Date('2026-08-07T13:20:00.000Z');
    const timestampFalso = { toDate: () => referencia };
    expect(toDateSafe(timestampFalso)?.getTime()).toBe(referencia.getTime());
  });

  it('aceita o objeto serializado { seconds, nanoseconds } de um Timestamp', () => {
    const data = toDateSafe({ seconds: 1_754_572_800, nanoseconds: 500_000_000 });
    expect(data).not.toBeNull();
    expect(data?.getTime()).toBe(1_754_572_800_500);
  });

  it('aceita o objeto { seconds } sem nanoseconds', () => {
    const data = toDateSafe({ seconds: 1_754_572_800 });
    expect(data?.getTime()).toBe(1_754_572_800_000);
  });

  it('aceita um Date válido', () => {
    const referencia = new Date('2026-08-07T13:20:00.000Z');
    expect(toDateSafe(referencia)).toBe(referencia);
  });

  it('rejeita um Date inválido', () => {
    expect(toDateSafe(new Date('não é uma data'))).toBeNull();
  });

  it('aceita uma string ISO completa', () => {
    expect(toDateSafe('2026-08-07T13:20:00.000Z')?.toISOString()).toBe('2026-08-07T13:20:00.000Z');
  });

  it('aceita uma string ISO só de data', () => {
    expect(toDateSafe('2026-08-21')).not.toBeNull();
  });

  it('aceita um number (epoch em milissegundos)', () => {
    expect(toDateSafe(1_754_572_800_000)?.getTime()).toBe(1_754_572_800_000);
  });

  it('devolve null para null', () => {
    expect(toDateSafe(null)).toBeNull();
  });

  it('devolve null para undefined', () => {
    expect(toDateSafe(undefined)).toBeNull();
  });

  it('devolve null para string vazia', () => {
    expect(toDateSafe('')).toBeNull();
  });

  it('devolve null para string inválida (o texto trocado pelo bug de argumentos)', () => {
    expect(toDateSafe('Solicitação criada')).toBeNull();
  });

  it('devolve null para "21/08" (formato ambíguo, não deve ser interpretado)', () => {
    expect(toDateSafe('21/08')).toBeNull();
  });

  it('devolve null para objeto qualquer sem toDate/seconds', () => {
    expect(toDateSafe({ algumCampo: 1 })).toBeNull();
  });

  it('nunca lança, mesmo para entradas hostis', () => {
    expect(() => toDateSafe(Symbol('x') as unknown)).not.toThrow();
    expect(() => toDateSafe({ toDate: () => { throw new Error('boom'); } })).not.toThrow();
  });
});

describe('formatarDataSafe / formatarDataHoraSafe', () => {
  it('formata uma data válida', () => {
    expect(formatarDataSafe('2026-08-07T13:20:00.000Z')).not.toBe('—');
    expect(formatarDataHoraSafe('2026-08-07T13:20:00.000Z')).not.toBe('—');
  });

  it('devolve o fallback para valores inválidos, sem lançar', () => {
    expect(formatarDataSafe('Solicitação criada')).toBe('—');
    expect(formatarDataHoraSafe(undefined)).toBe('—');
    expect(formatarDataHoraSafe(null)).toBe('—');
  });

  it('aceita um fallback customizado', () => {
    expect(formatarDataHoraSafe(null, 'Data não registrada')).toBe('Data não registrada');
  });
});

describe('formatarDiaTrocaSafe', () => {
  it('formata "2026-08-21" corretamente', () => {
    const resultado = formatarDiaTrocaSafe('2026-08-21');
    expect(resultado).not.toBe('Data não informada');
    expect(resultado).not.toBe('2026-08-21');
  });

  it('mostra o valor bruto para "21/08" em vez de quebrar', () => {
    expect(formatarDiaTrocaSafe('21/08')).toBe('21/08');
  });

  it('mostra "Data não informada" para vazio/null/undefined', () => {
    expect(formatarDiaTrocaSafe('')).toBe('Data não informada');
    expect(formatarDiaTrocaSafe(null)).toBe('Data não informada');
    expect(formatarDiaTrocaSafe(undefined)).toBe('Data não informada');
  });

  it('nunca lança para entrada arbitrária', () => {
    expect(() => formatarDiaTrocaSafe('##inválido##')).not.toThrow();
  });
});
