import * as XLSX from 'xlsx';

import { ehVazio, obterCelula, textoCelula, valorCelula } from './celulas.js';
import {
  localizarTabelaPlantaoMultiFonte,
  type ColunaPlantonistaMultiFonte,
} from './detectorTabelaPlantaoMultiFonte.js';
import { funcaoPlantaoDaFonte } from './modeloPlantaoPersistente.js';
import { calcularDuracaoEntreMomentos, interpretarMomento } from './parserPlantao.js';
import type {
  AtribuicaoPlantaoBruta,
  AtribuicaoPlantaoBrutaMultiFonte,
  ErroImportacaoPlantao,
  ResultadoParsePlantaoMultiFonte,
} from './tiposPlantao.js';

function criarErroEstruturalPlantaoMultiFonte(
  valorEncontrado: string,
  motivo: string,
): ErroImportacaoPlantao {
  return { linha: 1, coluna: 'A', valorEncontrado, motivo };
}

function resultadoVazioPlantaoMultiFonte(
  erros: ErroImportacaoPlantao[],
  abaOrigem = '',
): ResultadoParsePlantaoMultiFonte {
  return { ok: false, abaOrigem, fontes: [], atribuicoes: [], erros, avisos: [] };
}

/**
 * Converte a tabela de Plantão com múltiplas fontes simultâneas (ver
 * `AtribuicaoPlantaoBrutaMultiFonte` em `tiposPlantao.ts`) em atribuições
 * brutas — uma por combinação (linha, fonte com nome preenchido). Uma
 * coluna de fonte vazia numa linha só faz essa fonte não gerar atribuição
 * naquela linha; não é erro (nem toda fonte precisa ter alguém plantonista
 * em toda janela de tempo). Não persiste nada, não concilia login, não
 * aplica nenhuma regra de escala — mesma filosofia de `parsePlanilhaPlantao`.
 */
export function parsePlanilhaPlantaoMultiFonte(arquivo: ArrayBuffer): ResultadoParsePlantaoMultiFonte {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const localizacao = localizarTabelaPlantaoMultiFonte(workbook);

  if (localizacao.status === 'AUSENTE') {
    return resultadoVazioPlantaoMultiFonte([
      criarErroEstruturalPlantaoMultiFonte(
        'Plantonista.../Data Início/Data Fim',
        'Não foi possível localizar uma tabela de Plantão com múltiplas fontes '
        + '(cabeçalho esperado: uma ou mais colunas iniciadas em "Plantonista", '
        + 'seguidas de "Data Início" e "Data Fim", nesta ordem).',
      ),
    ]);
  }

  if (localizacao.status === 'AMBIGUA') {
    return resultadoVazioPlantaoMultiFonte([
      criarErroEstruturalPlantaoMultiFonte(
        (localizacao.abasCandidatas ?? []).join(', '),
        'Mais de uma aba desta planilha possui estrutura de tabela de Plantão com '
        + 'múltiplas fontes; é necessário indicar manualmente qual aba usar.',
      ),
    ]);
  }

  const { aba, linhaCabecalho, colunas, colInicio, colFim } = localizacao;
  const colunasFonte = colunas as ColunaPlantonistaMultiFonte[];
  const planilha = workbook.Sheets[aba as string] as XLSX.WorkSheet;
  const erros: ErroImportacaoPlantao[] = [];
  const avisos: string[] = [];
  const atribuicoes: AtribuicaoPlantaoBrutaMultiFonte[] = [];

  for (
    let linha = (linhaCabecalho as number) + 1;
    ;
    linha += 1
  ) {
    const celulasNome = colunasFonte.map((coluna) => obterCelula(planilha, linha, coluna.coluna));
    const textoInicio = textoCelula(obterCelula(planilha, linha, colInicio as number));
    const textoFim = textoCelula(obterCelula(planilha, linha, colFim as number));
    const todosNomesVazios = celulasNome.every((celula) => ehVazio(valorCelula(celula)));

    // Fim da tabela: linha inteiramente vazia (todas as fontes + datas).
    if (todosNomesVazios && textoInicio === '' && textoFim === '') {
      break;
    }

    const inicio = interpretarMomento(textoInicio);
    if (inicio === undefined) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colInicio as number),
        valorEncontrado: textoInicio,
        motivo: 'Data/hora de início inválida ou não reconhecida (esperado '
          + '"DD/MM/AAAA - HH:mm").',
      });
      continue;
    }

    const fim = interpretarMomento(textoFim);
    if (fim === undefined) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colFim as number),
        valorEncontrado: textoFim,
        motivo: 'Data/hora de fim inválida ou não reconhecida (esperado '
          + '"DD/MM/AAAA - HH:mm").',
      });
      continue;
    }

    const duracaoMinutos = calcularDuracaoEntreMomentos(inicio.momento, fim.momento);
    if (duracaoMinutos === null || duracaoMinutos <= 0) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colFim as number),
        valorEncontrado: `${textoInicio} -> ${textoFim}`,
        motivo: 'O fim do plantão não é posterior ao início.',
      });
      continue;
    }

    if (inicio.avisoDiaSemana !== undefined) {
      avisos.push(`Linha ${linha + 1} (início): ${inicio.avisoDiaSemana}`);
    }
    if (fim.avisoDiaSemana !== undefined) {
      avisos.push(`Linha ${linha + 1} (fim): ${fim.avisoDiaSemana}`);
    }

    colunasFonte.forEach((coluna, indice) => {
      const nome = textoCelula(celulasNome[indice]);
      if (nome === '') {
        return;
      }

      atribuicoes.push({
        fonte: coluna.fonte,
        plantonistaNomeOriginal: nome,
        inicio: inicio.momento,
        fim: fim.momento,
        duracaoMinutos,
        linhaOrigem: linha + 1,
        abaOrigem: aba as string,
      });
    });
  }

  const fontes = [...new Set(colunasFonte.map((coluna) => coluna.fonte))];

  return {
    ok: erros.length === 0,
    abaOrigem: aba as string,
    fontes,
    atribuicoes,
    erros,
    avisos,
  };
}

/**
 * Ponte entre o resultado multi-fonte e o pipeline de conciliação/montagem
 * de fonte única (`lib/conciliacaoPlantoes.ts`/`lib/montagemRascunhoPlantao.ts`),
 * que já operam sobre `AtribuicaoPlantaoBruta[]` sem se importar com campos
 * extras (conciliação casa por nome normalizado, nunca por índice — ver
 * `aplicarVinculosNasAtribuicoes()`). Cada atribuição resultante carrega
 * `funcao` derivado de `fonte` via `funcaoPlantaoDaFonte()` — uma coluna
 * cujo cabeçalho não bate com nenhuma `FuncaoPlantao` conhecida NUNCA vira
 * uma atribuição com função inventada: a linha inteira daquela fonte é
 * reportada em `erros` e excluída do resultado (dado real preservado no
 * erro, nunca descartado silenciosamente).
 */
export function converterAtribuicoesMultiFonteParaBrutas(
  resultado: ResultadoParsePlantaoMultiFonte,
): { atribuicoes: AtribuicaoPlantaoBruta[]; erros: ErroImportacaoPlantao[] } {
  const erros: ErroImportacaoPlantao[] = [];
  const atribuicoes: AtribuicaoPlantaoBruta[] = [];
  const fontesDesconhecidasReportadas = new Set<string>();

  for (const bruta of resultado.atribuicoes) {
    const funcao = funcaoPlantaoDaFonte(bruta.fonte);
    if (funcao === null) {
      if (!fontesDesconhecidasReportadas.has(bruta.fonte)) {
        fontesDesconhecidasReportadas.add(bruta.fonte);
        erros.push({
          linha: bruta.linhaOrigem,
          coluna: `Plantonista ${bruta.fonte}`,
          plantonistaNomeOriginal: bruta.plantonistaNomeOriginal,
          valorEncontrado: bruta.fonte,
          motivo: `Coluna "Plantonista ${bruta.fonte}" não corresponde a nenhum posto conhecido `
            + `(${['DBA', 'LINUX', 'TELECOM', 'WINDOWS'].join(', ')}).`,
          sugestao: 'Confira o cabeçalho da coluna na planilha antes de importar.',
        });
      }
      continue;
    }
    atribuicoes.push({
      plantonistaNomeOriginal: bruta.plantonistaNomeOriginal,
      inicio: bruta.inicio,
      fim: bruta.fim,
      duracaoMinutos: bruta.duracaoMinutos,
      linhaOrigem: bruta.linhaOrigem,
      abaOrigem: bruta.abaOrigem,
      funcao,
    });
  }

  return { atribuicoes, erros };
}
