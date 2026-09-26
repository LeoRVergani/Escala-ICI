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
 * começando com "PLANTONISTA" (cada uma sua própria fonte, ex. "Plantonista
 * DBA"/"Plantonista Linux") mais "Data Início" e "Data Fim", em QUALQUER
 * posição da linha — cabeçalho decide, nunca a posição/adjacência das
 * colunas. Estrutura irmã de `localizarTabelaPlantao()` (fonte única) —
 * deliberadamente uma função separada, nunca compartilhada, para as duas
 * formas nunca se misturarem. Nunca depende de nome de aba ou de arquivo.
 *
 * Correção HOTFIX-PARSER-PLANTAO-CODB-4-EQUIPES-1 — antes desta fase, as
 * colunas "Plantonista*" precisavam ser contíguas e imediatamente seguidas
 * por "Data Início"/"Data Fim" nesta ordem exata; uma planilha real com as
 * colunas de data intercaladas entre postos (ex.: "Data Início, DBA,
 * Linux, Data Fim, Telecom, Windows") não era reconhecida. A busca agora é
 * puramente por CONTEÚDO normalizado de cada célula da linha, independente
 * de posição — estritamente mais permissiva que a regra anterior (todo
 * cabeçalho que já satisfazia "contíguo e nesta ordem" continua satisfazendo
 * "em qualquer posição"), então nenhum caso já reconhecido deixa de ser.
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
      const colunasPlantonista: ColunaPlantonistaMultiFonte[] = [];
      let colInicio: number | null = null;
      let colFim: number | null = null;

      for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
        const celula = obterCelula(planilha, linha, coluna);
        const chave = normalizarChaveEstrutural(valorCelula(celula));
        if (chave.startsWith('PLANTONISTA')) {
          colunasPlantonista.push({ coluna, fonte: extrairFonte(textoCelula(celula)) });
        } else if (chave === 'DATAINICIO') {
          colInicio = coluna;
        } else if (chave === 'DATAFIM') {
          colFim = coluna;
        }
      }

      if (colunasPlantonista.length > 0 && colInicio !== null && colFim !== null) {
        candidatos.push({
          aba: nomeAba,
          linha,
          colunas: colunasPlantonista,
          colInicio,
          colFim,
        });
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
