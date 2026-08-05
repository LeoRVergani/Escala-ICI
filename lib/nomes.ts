import { normalizarTexto } from '@escala-ici/contrato';

/**
 * Normaliza nomes vindos da planilha e cadastrados como alias para permitir
 * comparação exata previsível: remove acentos, aplica trim, converte para
 * minúsculas e reduz espaços internos duplicados a um único espaço.
 *
 * Não faz nenhuma correspondência aproximada — "Caio M." e "Caio Monteiro"
 * permanecem diferentes. Igualar abreviações é uma decisão manual do gestor
 * (cadastrar o alias exato), nunca automática.
 */
export function normalizarNome(texto: string): string {
  return normalizarTexto(texto).toLowerCase().replace(/\s+/gu, ' ');
}
