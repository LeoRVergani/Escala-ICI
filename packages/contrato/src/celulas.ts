import * as XLSX from 'xlsx';

/**
 * Helpers genéricos de leitura de célula XLSX. Equivalentes aos helpers
 * privados já existentes em `parser.ts` (não exportados de lá) — duplicados
 * aqui deliberadamente, em vez de exportados do parser 6x1, para não tocar
 * em `parser.ts` nesta fase (ver `docs/spec/PLANTOES.md`, "não reescrever o
 * parser 6x1 sem necessidade").
 */

export function obterCelula(
  planilha: XLSX.WorkSheet,
  linha: number,
  coluna: number,
): XLSX.CellObject | undefined {
  const referencia = XLSX.utils.encode_cell({ r: linha, c: coluna });
  return planilha[referencia] as XLSX.CellObject | undefined;
}

export function valorCelula(celula: XLSX.CellObject | undefined): unknown {
  return celula?.v;
}

export function textoCelula(celula: XLSX.CellObject | undefined): string {
  if (celula === undefined || celula.v === null || celula.v === undefined) {
    return '';
  }

  if (typeof celula.v === 'string') {
    return celula.v.trim();
  }

  if (typeof celula.w === 'string' && celula.w.trim() !== '') {
    return celula.w.trim();
  }

  return String(celula.v).trim();
}

const VALOR_VAZIO = /^\s*$/u;

export function ehVazio(valor: unknown): boolean {
  return (
    valor === null
    || valor === undefined
    || (typeof valor === 'string' && VALOR_VAZIO.test(valor))
  );
}
