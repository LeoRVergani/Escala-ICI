/**
 * NOME-SEM-ESPACOS-1 — o nome de uma pessoa é sempre gravado limpo: sem
 * espaços no começo e no fim e sem espaços repetidos — inclusive o espaço
 * "invisível" (U+00A0) e outros espaços Unicode que vêm de Excel/web e que o
 * trim() comum não remove. Ex.: " Daniel  Silva " → "Daniel Silva".
 */
export function normalizarNomePessoa(nome: string): string {
  return nome.replace(/[\s\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]+/gu, ' ').trim();
}
