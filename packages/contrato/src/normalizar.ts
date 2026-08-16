export function normalizarTexto(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }

  return String(v)
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}

export function normalizarCelula(v: unknown): string {
  return normalizarTexto(v).replace(/\s+/gu, '');
}

/**
 * Chave de comparação estrutural: remove qualquer caractere que não seja
 * letra/dígito (espaço, `/`, `°`, `º`, pontuação) além de acento e caixa.
 * Usada para reconhecer cabeçalhos de planilha por assinatura estrutural
 * (ex.: "N° Horas" e "N o Horas" e "n horas" devem comparar iguais), nunca
 * para dado de negócio exibido ao usuário.
 */
export function normalizarChaveEstrutural(v: unknown): string {
  return normalizarTexto(v).replace(/[^0-9A-Z]/gu, '');
}

export function montarChaveDia(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new RangeError('Data inválida.');
  }

  const ano = String(d.getUTCFullYear()).padStart(4, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarMinutos(min: number): string {
  if (!Number.isInteger(min) || min < 0) {
    throw new RangeError('A quantidade de minutos deve ser um inteiro não negativo.');
  }

  const horas = Math.floor(min / 60);
  const minutosRestantes = min % 60;
  return `${horas}:${String(minutosRestantes).padStart(2, '0')}`;
}
