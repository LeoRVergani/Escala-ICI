/**
 * FORMATO-HORARIO-1 — faixa de horário de turno no padrão "19:00 - 01:00":
 * traço curto com um espaço de cada lado (antes "19:00–01:00", travessão
 * longo colado nos números).
 */
export function faixaHorario(inicio?: string | null, fim?: string | null): string {
  if (!inicio || !fim) return '';
  return `${inicio} - ${fim}`;
}

/** Converte uma faixa já gravada no formato antigo ("19:00–01:00") para o novo. */
export function normalizarFaixaHorario(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s*[–—]\s*/gu, ' - ');
}
