import * as XLSX from 'xlsx';

import { obterCelula, textoCelula, valorCelula } from './celulas.js';
import { normalizarChaveEstrutural } from './normalizar.js';

export interface ColunaPlantonistaMultiFonte {
  coluna: number;
  /** Texto da coluna após "Plantonista", ex.: "DBA" — nunca inventado. */
  fonte: string;
}

export interface LocalizacaoTabelaPlantaoMultiFonte {
  status: 'UNICA' | 'AMBIGUA' | 'AUSENTE';
  aba?: string;
  /** Presente só quando `status === 'AMBIGUA'`. */
  abasCandidatas?: string[];
  linhaCabecalho?: number;
  colunas?: ColunaPlantonistaMultiFonte[];
  colInicio?: number;
  colFim?: number;
}

const PREFIXO_PLANTONISTA = 'Plantonista';

/**
 * "Plantonista DBA" -> "DBA". Quando o cabeçalho é literalmente
 * "Plantonista" (sem sufixo), devolve o texto original — nunca inventa um
 * nome de fonte que não está na planilha.
 */
function extrairFonte(cabecalhoOriginal: string): string {
  const texto = cabecalhoOriginal.trim();
  if (normalizarChaveEstrutural(texto) === 'PLANTONISTA') {
    return texto;
  }
  const resto = texto.slice(PREFIXO_PLANTONISTA.length).trim();
  return resto === '' ? texto : resto;
}

/**
 * Localiza, em qualquer aba do workbook, a linha de cabeçalho de uma
 * tabela de Plantão com MÚLTIPLAS fontes simultâneas: uma ou mais colunas
 * contíguas começando com "PLANTONISTA" (cada uma sua própria fonte, ex.
 * "Plantonista DBA"/"Plantonista Linux"), imediatamente seguidas por
 * "Data Início" e "Data Fim", nesta ordem. Estrutura irmã de
 * `localizarTabelaPlantao()` (fonte única) — deliberadamente uma função
 * separada, nunca compartilhada, para as duas formas nunca se misturarem.
 * Nunca depende de nome de aba ou de arquivo.
 */
export function localizarTabelaPlantaoMultiFonte(
  workbook: XLSX.WorkBook,
): LocalizacaoTabelaPlantaoMultiFonte {
  const candidatos: Array<{
    aba: string;
    linha: number;
    colunas: ColunaPlantonistaMultiFonte[];
    colInicio: number;
    colFim: number;
  }> = [];

  for (const nomeAba of workbook.SheetNames) {
    const planilha = workbook.Sheets[nomeAba];
    const referencia = planilha?.['!ref'];
    if (planilha === undefined || referencia === undefined) {
      continue;
    }

    const intervalo = XLSX.utils.decode_range(referencia);
    for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
      let coluna = intervalo.s.c;
      while (coluna <= intervalo.e.c) {
        const chave = normalizarChaveEstrutural(valorCelula(obterCelula(planilha, linha, coluna)));
        if (!chave.startsWith('PLANTONISTA')) {
          coluna += 1;
          continue;
        }

        const colunasRun: ColunaPlantonistaMultiFonte[] = [];
        while (coluna <= intervalo.e.c) {
          const celulaAtual = obterCelula(planilha, linha, coluna);
          const chaveAtual = normalizarChaveEstrutural(valorCelula(celulaAtual));
          if (!chaveAtual.startsWith('PLANTONISTA')) {
            break;
          }
          colunasRun.push({ coluna, fonte: extrairFonte(textoCelula(celulaAtual)) });
          coluna += 1;
        }

        if (coluna + 1 > intervalo.e.c) {
          continue;
        }

        const chaveInicio = normalizarChaveEstrutural(
          valorCelula(obterCelula(planilha, linha, coluna)),
        );
        const chaveFim = normalizarChaveEstrutural(
          valorCelula(obterCelula(planilha, linha, coluna + 1)),
        );
        if (chaveInicio === 'DATAINICIO' && chaveFim === 'DATAFIM') {
          candidatos.push({
            aba: nomeAba,
            linha,
            colunas: colunasRun,
            colInicio: coluna,
            colFim: coluna + 1,
          });
        }
      }
    }
  }

  if (candidatos.length === 0) {
    return { status: 'AUSENTE' };
  }

  if (candidatos.length > 1) {
    return {
      status: 'AMBIGUA',
      abasCandidatas: [...new Set(candidatos.map((candidato) => candidato.aba))],
    };
  }

  const unico = candidatos[0];
  if (unico === undefined) {
    return { status: 'AUSENTE' };
  }

  return {
    status: 'UNICA',
    aba: unico.aba,
    linhaCabecalho: unico.linha,
    colunas: unico.colunas,
    colInicio: unico.colInicio,
    colFim: unico.colFim,
  };
}
