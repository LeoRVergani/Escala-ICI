import { describe, expect, it } from 'vitest';

import { adicionarDias, competenciaDoPonto, competenciaOperacional, competenciasCandidatas, periodoDoPonto } from '../src/index.js';

/**
 * CALENDARIO-PONTO-1 — comunicado da Gestão de Pessoas de 10/11/2026: o ponto fecha sempre no dia 16 (período de 17 a 16);
 * primeiro período parcial 26/10 a 16/11; exceções: dezembro fecha em 15/12 e janeiro vai de 16/12 a 16/01 (32 dias).
 * Rótulo = mês em que o período termina. Até 2026-11 vale o ciclo antigo (26 → 25), como já foi publicado.
 */
const dias = (inicio: string, fim: string): string[] => {
  const lista: string[] = [];
  for (let d = inicio; d <= fim; d = adicionarDias(d, 1)) lista.push(d);
  return lista;
};

describe('periodoDoPonto — o período de cada competência', () => {
  it('ciclo antigo até 2026-11 (novembro continua 26/10 a 25/11, como já publicado)', () => {
    expect(periodoDoPonto('2026-08')).toEqual({ periodoInicio: '2026-07-26', periodoFim: '2026-08-25' });
    expect(periodoDoPonto('2026-10')).toEqual({ periodoInicio: '2026-09-26', periodoFim: '2026-10-25' });
    expect(periodoDoPonto('2026-11')).toEqual({ periodoInicio: '2026-10-26', periodoFim: '2026-11-25' });
    expect(periodoDoPonto('2026-01')).toEqual({ periodoInicio: '2025-12-26', periodoFim: '2026-01-25' });
  });

  it('as duas exceções do comunicado: dezembro fecha em 15/12 e janeiro vai de 16/12 a 16/01', () => {
    expect(periodoDoPonto('2026-12')).toEqual({ periodoInicio: '2026-11-17', periodoFim: '2026-12-15' });
    expect(periodoDoPonto('2027-01')).toEqual({ periodoInicio: '2026-12-16', periodoFim: '2027-01-16' });
    expect(dias('2026-12-16', '2027-01-16')).toHaveLength(32);
  });

  it('depois da transição o ciclo é regular, 17 a 16 do mês seguinte (inclusive em fevereiro e na virada do ano)', () => {
    expect(periodoDoPonto('2027-02')).toEqual({ periodoInicio: '2027-01-17', periodoFim: '2027-02-16' });
    expect(periodoDoPonto('2027-03')).toEqual({ periodoInicio: '2027-02-17', periodoFim: '2027-03-16' });
    expect(periodoDoPonto('2028-02')).toEqual({ periodoInicio: '2028-01-17', periodoFim: '2028-02-16' });
    expect(periodoDoPonto('2027-12')).toEqual({ periodoInicio: '2027-11-17', periodoFim: '2027-12-16' });
    expect(periodoDoPonto('2028-01')).toEqual({ periodoInicio: '2027-12-17', periodoFim: '2028-01-16' });
  });

  it('rótulo malformado devolve null', () => {
    for (const ruim of ['2026-8', '2026-13', '2026-00', 'abc', '']) expect(periodoDoPonto(ruim), ruim).toBeNull();
  });
});

describe('competenciaDoPonto — a competência de cada data', () => {
  it('as datas-chave do comunicado', () => {
    const chaves: Array<[string, string]> = [
      ['2026-10-25', '2026-10'], ['2026-10-26', '2026-11'], ['2026-11-16', '2026-11'],
      ['2026-11-17', '2026-12'], ['2026-11-25', '2026-12'], ['2026-11-26', '2026-12'], ['2026-12-15', '2026-12'],
      ['2026-12-16', '2027-01'], ['2026-12-26', '2027-01'], ['2027-01-16', '2027-01'],
      ['2027-01-17', '2027-02'], ['2027-02-16', '2027-02'], ['2027-02-17', '2027-03'], ['2027-12-16', '2027-12'], ['2027-12-17', '2028-01'],
    ];
    for (const [data, rotulo] of chaves) expect(competenciaDoPonto(data), data).toBe(rotulo);
  });

  it('ida e volta: o período da competência de qualquer data a CONTÉM (de 17/11/2026 a 2032)', () => {
    for (const data of dias('2026-11-17', '2032-12-31')) {
      const periodo = periodoDoPonto(competenciaDoPonto(data))!;
      expect(periodo.periodoInicio <= data && data <= periodo.periodoFim, data).toBe(true);
    }
  });

  it('os períodos de dezembro em diante se encadeiam: nenhum dia sobra nem se repete', () => {
    let rotulo = '2026-12';
    for (let i = 0; i < 70; i += 1) {
      const atual = periodoDoPonto(rotulo)!;
      const [ano, mes] = rotulo.split('-').map(Number) as [number, number];
      const proximo = `${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}`;
      expect(periodoDoPonto(proximo)!.periodoInicio, `${rotulo} → ${proximo}`).toBe(adicionarDias(atual.periodoFim, 1));
      rotulo = proximo;
    }
  });

  it('o ciclo antigo fica EXATAMENTE como era antes de 17/11/2026 (nada do passado muda)', () => {
    const antigo = (data: string) => {
      const [a, m, d] = data.split('-').map(Number) as [number, number, number];
      const total = a * 12 + (m - 1) + (d >= 26 ? 1 : 0);
      return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
    };
    for (const data of dias('2020-01-01', '2026-11-16')) expect(competenciaDoPonto(data), data).toBe(antigo(data));
  });

  it('a sobreposição de novembro é proposital: 17 a 25/11 existem na escala de novembro já publicada, mas pertencem a dezembro daqui para frente', () => {
    expect(periodoDoPonto('2026-11')!.periodoFim).toBe('2026-11-25');
    expect(periodoDoPonto('2026-12')!.periodoInicio).toBe('2026-11-17');
    expect(competenciaDoPonto('2026-11-20')).toBe('2026-12');
  });

  it('data malformada continua lançando erro', () => {
    expect(() => competenciaDoPonto('não-é-data')).toThrow();
  });
});

describe('competenciaOperacional / competenciasCandidatas seguem o calendário', () => {
  it('sem corte explícito usa o calendário; com corte explícito mantém a regra simples antiga', () => {
    expect(competenciaOperacional('2026-12-20')).toBe('2027-01');
    expect(competenciaOperacional('2026-12-20', 26)).toBe('2026-12');
    expect(competenciaOperacional('2026-08-26')).toBe('2026-09');
  });

  it('as candidatas de 16/12 incluem a competência de janeiro (a escala 16/12–16/01)', () => {
    expect(competenciasCandidatas('2026-12-16')).toContain('2027-01');
    expect(competenciasCandidatas('2026-11-18')).toContain('2026-12');
  });
});
