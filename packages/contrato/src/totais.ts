import type { Dia, TipoTurno, Totais } from './tipos.js';

const CONTADORES: Readonly<Record<string, keyof Omit<Totais, 'min' | 'diasTrabalhados'>>> = {
  DF: 'df',
  DU: 'du',
  X: 'x',
  HE: 'he',
  BH: 'bh',
  AN: 'an',
  FOLGA: 'folga',
  AFA: 'afa',
  '#': 'afa',
};

export function calcularTotais(
  dias: Record<string, Dia>,
  catalogo: Record<string, TipoTurno>,
): Totais {
  const totais: Totais = {
    min: 0,
    diasTrabalhados: 0,
    df: 0,
    du: 0,
    x: 0,
    he: 0,
    bh: 0,
    an: 0,
    folga: 0,
    afa: 0,
  };

  for (const dia of Object.values(dias)) {
    const codigo = dia.c.toUpperCase();
    const tipo = catalogo[codigo];

    if (tipo?.categoria === 'TRABALHO') {
      totais.diasTrabalhados += 1;
    }

    if (dia.m !== undefined) {
      totais.min += dia.m;
    }

    const contador = CONTADORES[codigo];
    if (contador !== undefined) {
      totais[contador] += 1;
    }
  }

  return totais;
}
