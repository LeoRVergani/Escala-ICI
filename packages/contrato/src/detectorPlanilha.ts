import * as XLSX from 'xlsx';

import { obterCelula, valorCelula } from './celulas.js';
import { normalizarCelula, normalizarChaveEstrutural } from './normalizar.js';
import type { ResultadoDeteccaoPlanilha } from './tiposPlantao.js';

export interface LocalizacaoTabelaPlantao {
  status: 'UNICA' | 'AMBIGUA' | 'AUSENTE';
  aba?: string;
  /** Presente só quando `status === 'AMBIGUA'`. */
  abasCandidatas?: string[];
  linhaCabecalho?: number;
  colPlantonista?: number;
  colInicio?: number;
  colFim?: number;
}

function ehAbaEscalistas(nomeAba: string): boolean {
  return normalizarChaveEstrutural(nomeAba) === normalizarChaveEstrutural('Escalistas');
}

/**
 * Sinal estrutural mínimo da escala 6x1: uma aba "Escalistas" (nome
 * comparado sem acento/caixa) contendo o cabeçalho "DIA/MÊS" em algum
 * lugar — não reimplementa a busca completa de `parsePlanilhaEscala`, só o
 * suficiente para diferenciar 6x1 de Plantão/desconhecida.
 */
function detectarEscala6x1(workbook: XLSX.WorkBook): { encontrada: boolean; aba?: string } {
  for (const nomeAba of workbook.SheetNames) {
    if (!ehAbaEscalistas(nomeAba)) {
      continue;
    }

    const planilha = workbook.Sheets[nomeAba];
    const referencia = planilha?.['!ref'];
    if (planilha === undefined || referencia === undefined) {
      continue;
    }

    const intervalo = XLSX.utils.decode_range(referencia);
    for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
      for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
        if (normalizarCelula(valorCelula(obterCelula(planilha, linha, coluna))) === 'DIA/MES') {
          return { encontrada: true, aba: nomeAba };
        }
      }
    }
  }

  return { encontrada: false };
}

/**
 * Localiza, em qualquer aba do workbook (nome da aba irrelevante — nunca
 * "PlantaoCOSI" hardcoded), a linha de cabeçalho de uma tabela de Plantão:
 * três colunas contíguas onde a primeira começa com "PLANTONISTA" (aceita
 * "Plantonista Segurança"/"Plantonista Redes"/etc.), a segunda é
 * estruturalmente "Data Início" e a terceira é "Data Fim". Uma única
 * célula solta contendo a palavra "Plantão" nunca é suficiente — as três
 * colunas precisam bater, na mesma linha, contíguas.
 *
 * Compartilhada entre `detectarTipoPlanilha` e `parsePlanilhaPlantao` para
 * as duas nunca divergirem sobre "qual aba é a de Plantão".
 */
export function localizarTabelaPlantao(workbook: XLSX.WorkBook): LocalizacaoTabelaPlantao {
  const candidatos: Array<{
    aba: string;
    linha: number;
    colPlantonista: number;
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
      for (let coluna = intervalo.s.c; coluna + 2 <= intervalo.e.c; coluna += 1) {
        const chavePlantonista = normalizarChaveEstrutural(
          valorCelula(obterCelula(planilha, linha, coluna)),
        );
        if (!chavePlantonista.startsWith('PLANTONISTA')) {
          continue;
        }

        const chaveInicio = normalizarChaveEstrutural(
          valorCelula(obterCelula(planilha, linha, coluna + 1)),
        );
        if (chaveInicio !== 'DATAINICIO') {
          continue;
        }

        const chaveFim = normalizarChaveEstrutural(
          valorCelula(obterCelula(planilha, linha, coluna + 2)),
        );
        if (chaveFim !== 'DATAFIM') {
          continue;
        }

        candidatos.push({
          aba: nomeAba,
          linha,
          colPlantonista: coluna,
          colInicio: coluna + 1,
          colFim: coluna + 2,
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
    colPlantonista: unico.colPlantonista,
    colInicio: unico.colInicio,
    colFim: unico.colFim,
  };
}

/**
 * Roteador puro entre os dois domínios (ver `docs/spec/PLANTOES.md`,
 * "dois domínios, não um"). Não altera nem chama `parsePlanilhaEscala` —
 * só decide qual parser o chamador deve usar, ou sinaliza que a estrutura
 * não foi reconhecida / é ambígua. Nunca depende de nome de arquivo.
 */
export function detectarTipoPlanilha(arquivo: ArrayBuffer): ResultadoDeteccaoPlanilha {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const escala6x1 = detectarEscala6x1(workbook);
  const plantao = localizarTabelaPlantao(workbook);

  if (plantao.status === 'AMBIGUA') {
    return {
      tipo: 'DESCONHECIDA',
      ...(plantao.abasCandidatas === undefined ? {} : { abasCandidatas: plantao.abasCandidatas }),
      motivo: 'Mais de uma aba com estrutura de tabela de Plantão '
        + '("Plantonista.../Data Início/Data Fim") foi encontrada nesta '
        + 'planilha; seleção manual é necessária antes de importar.',
    };
  }

  if (escala6x1.encontrada && plantao.status === 'UNICA') {
    return {
      tipo: 'DESCONHECIDA',
      abasCandidatas: [escala6x1.aba, plantao.aba].filter(
        (aba): aba is string => aba !== undefined,
      ),
      motivo: 'A planilha combina sinais estruturais de escala 6x1 (aba '
        + '"Escalistas") e de Plantão; resolução manual é necessária.',
    };
  }

  if (escala6x1.encontrada) {
    return {
      tipo: 'ESCALA_6X1',
      ...(escala6x1.aba === undefined ? {} : { abaEncontrada: escala6x1.aba }),
    };
  }

  if (plantao.status === 'UNICA') {
    return {
      tipo: 'PLANTAO',
      ...(plantao.aba === undefined ? {} : { abaEncontrada: plantao.aba }),
    };
  }

  return {
    tipo: 'DESCONHECIDA',
    motivo: 'Nenhuma estrutura reconhecida: nem a aba "Escalistas" da '
      + 'escala 6x1, nem uma tabela de Plantão (cabeçalho '
      + '"Plantonista.../Data Início/Data Fim").',
  };
}
