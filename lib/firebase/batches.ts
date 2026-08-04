export function fatiarEmLotes<T>(
  itens: readonly T[],
  limite = 500,
): T[][] {
  if (!Number.isInteger(limite) || limite < 1 || limite > 500) {
    throw new RangeError('O limite deve ser um inteiro entre 1 e 500.');
  }

  const lotes: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += limite) {
    lotes.push(itens.slice(inicio, inicio + limite));
  }
  return lotes;
}
