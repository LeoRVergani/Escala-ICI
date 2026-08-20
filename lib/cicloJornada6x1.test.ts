import { describe, expect, it } from 'vitest';

import {
  calcularCicloInicialJornada6x1,
  mensagemCicloInicialJornada6x1,
} from './cicloJornada6x1';

describe('cicloJornada6x1', () => {
  it('calcula os seis dias a partir do primeiro lançamento', () => {
    const resultado = calcularCicloInicialJornada6x1({
      dataInicial: '2026-08-03',
      periodoFim: '2026-08-31',
      dias: {},
    });
    expect(resultado.datasAplicadas).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
    ]);
    expect(resultado.datasIgnoradas).toEqual([]);
  });

  it('não ultrapassa o fim da competência', () => {
    const resultado = calcularCicloInicialJornada6x1({
      dataInicial: '2026-08-30',
      periodoFim: '2026-08-31',
      dias: {},
    });
    expect(resultado.datasAplicadas).toEqual(['2026-08-30', '2026-08-31']);
  });

  it('preserva dias que já têm código', () => {
    const resultado = calcularCicloInicialJornada6x1({
      dataInicial: '2026-08-03',
      periodoFim: '2026-08-31',
      dias: {
        '2026-08-05': { c: 'N' },
        '2026-08-07': { c: 'DF' },
      },
    });
    expect(resultado.datasAplicadas).toEqual(['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-08']);
    expect(resultado.datasIgnoradas).toEqual(['2026-08-05', '2026-08-07']);
  });

  it('comunica que dias preenchidos foram preservados', () => {
    const mensagem = mensagemCicloInicialJornada6x1(
      { datasAplicadas: ['2026-08-03', '2026-08-04'], datasIgnoradas: ['2026-08-05'] },
      'N',
    );
    expect(mensagem).toContain('2 dias do ciclo inicial');
    expect(mensagem).toContain('1 dia já preenchido não foi alterado');
    expect(mensagem).toContain('editar cada dia separadamente');
  });
});
