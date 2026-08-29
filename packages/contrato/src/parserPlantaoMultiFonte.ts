import * as XLSX from 'xlsx';

import { ehVazio, obterCelula, textoCelula, valorCelula } from './celulas.js';
import {
  localizarTabelaPlantaoMultiFonte,
  type ColunaPlantonistaMultiFonte,
} from './detectorTabelaPlantaoMultiFonte.js';
import {
  FUNCOES_PLANTAO_VALIDAS,
  funcaoPlantaoDaFonte,
  ROTULO_FUNCAO_PLANTAO,
  type FuncaoPlantao,
} from './modeloPlantaoPersistente.js';
import { calcularDuracaoEntreMomentos, interpretarMomento } from './parserPlantao.js';
import type {
  AtribuicaoPlantaoBruta,
  AtribuicaoPlantaoBrutaMultiFonte,
  ErroImportacaoPlantao,
  MomentoPlantao,
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
            + `(${FUNCOES_PLANTAO_VALIDAS.join(', ')}).`,
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

/**
 * Identificador determinístico de UMA ocorrência (uma linha da planilha
 * multi-função — mesmo `inicio`/`fim` compartilhado por até N postos).
 * Só para agrupamento em relatório/revisão/editor — nunca persistido em
 * `AtribuicaoPlantaoPersistida` nesta fase (o agrupamento por ocorrência já
 * funciona sem ele via `inicio`/`fim` exatos, ver `postosIncompletos()`);
 * decidir se vale a pena persistir fica para quando o Editor precisar dele
 * de verdade.
 */
export function criarIdOcorrenciaPlantao(inicio: MomentoPlantao, fim: MomentoPlantao): string {
  return `${inicio.data}T${inicio.hora}__${fim.data}T${fim.hora}`;
}

export interface AtribuicaoPlantaoPorFuncao extends AtribuicaoPlantaoBruta {
  funcao: FuncaoPlantao;
  ocorrenciaId: string;
}

export interface EstatisticasPlantaoPorFuncao {
  /** Contagem de OCORRÊNCIAS distintas (linhas), não de atribuições — 32 ocorrências podem gerar até 128 atribuições. */
  linhasProcessadas: number;
  atribuicoesTotal: number;
  porFuncao: Record<FuncaoPlantao, number>;
  nomesUnicos: number;
}

export interface ResultadoAgrupamentoPlantaoPorFuncao {
  ok: boolean;
  abaOrigem: string;
  /** Cada posto obrigatório sempre existe como chave, mesmo vazio — nunca `undefined`. */
  equipes: Record<FuncaoPlantao, AtribuicaoPlantaoPorFuncao[]>;
  /** Mesmos objetos de `equipes`, achatados — nunca uma segunda cópia divergente. */
  atribuicoes: AtribuicaoPlantaoPorFuncao[];
  erros: ErroImportacaoPlantao[];
  avisos: string[];
  estatisticas: EstatisticasPlantaoPorFuncao;
}

function equipesVazias(): Record<FuncaoPlantao, AtribuicaoPlantaoPorFuncao[]> {
  return { DBA: [], LINUX: [], TELECOM: [], WINDOWS: [] };
}

function estatisticasVazias(): EstatisticasPlantaoPorFuncao {
  return {
    linhasProcessadas: 0,
    atribuicoesTotal: 0,
    porFuncao: { DBA: 0, LINUX: 0, TELECOM: 0, WINDOWS: 0 },
    nomesUnicos: 0,
  };
}

/**
 * Camada específica de "Grupo multi-função com postos obrigatórios" por
 * cima de `parsePlanilhaPlantaoMultiFonte()` (genérica, aceita QUALQUER
 * conjunto de colunas "Plantonista <fonte>", sem exigir nenhuma em
 * específico — reaproveitada aqui sem alteração, nunca reimplementada:
 * detecção de cabeçalho por CONTEÚDO/independente de posição
 * (`localizarTabelaPlantaoMultiFonte`), parsing de data tolerante a nome de
 * dia da semana em texto (`interpretarMomento`), célula vazia por posto
 * nunca vira atribuição fictícia).
 *
 * O que esta camada acrescenta, específico de um Grupo com postos
 * OBRIGATÓRIOS conhecidos (`funcoesObrigatorias`, default
 * `FUNCOES_PLANTAO_VALIDAS` — DBA/LINUX/TELECOM/WINDOWS):
 * 1. Erro BLOQUEANTE nomeado se uma coluna obrigatória inteira estiver
 *    ausente do cabeçalho (`localizarTabelaPlantaoMultiFonte` sozinho
 *    aceitaria alegremente 3 de 4 colunas como "planilha multi-fonte
 *    válida" — correto para o caso genérico, errado para este Grupo
 *    específico, que precisa dos quatro postos).
 * 2. Agrupamento por função (`equipes.DBA`/`.LINUX`/`.TELECOM`/`.WINDOWS`)
 *    além da lista achatada — nunca decide a função só depois da
 *    conciliação (a função vem da COLUNA, sempre).
 * 3. `ocorrenciaId` por atribuição (mesma linha = mesmo id).
 * 4. Estatísticas (`linhasProcessadas`/`atribuicoesTotal`/`porFuncao`/
 *    `nomesUnicos`) — calculadas, nunca um número fixo.
 *
 * Conciliação de login (`lib/conciliacaoPlantoes.ts`) continua uma etapa
 * SEPARADA e POSTERIOR — este módulo nunca consulta `usuarios`, nunca
 * decide pendência de vínculo; só separa nome-da-fonte + função + período.
 */
export function agruparPlanilhaPlantaoPorFuncao(
  arquivo: ArrayBuffer,
  funcoesObrigatorias: readonly FuncaoPlantao[] = FUNCOES_PLANTAO_VALIDAS,
): ResultadoAgrupamentoPlantaoPorFuncao {
  const resultado = parsePlanilhaPlantaoMultiFonte(arquivo);
  const erros: ErroImportacaoPlantao[] = [...resultado.erros];

  if (!resultado.ok) {
    return {
      ok: false,
      abaOrigem: resultado.abaOrigem,
      equipes: equipesVazias(),
      atribuicoes: [],
      erros,
      avisos: resultado.avisos,
      estatisticas: estatisticasVazias(),
    };
  }

  const funcoesEncontradas = new Set(
    resultado.fontes
      .map((fonte) => funcaoPlantaoDaFonte(fonte))
      .filter((funcao): funcao is FuncaoPlantao => funcao !== null),
  );
  const faltando = funcoesObrigatorias.filter((funcao) => !funcoesEncontradas.has(funcao));
  if (faltando.length > 0) {
    for (const funcao of faltando) {
      erros.push({
        linha: 1,
        coluna: `Plantonista ${ROTULO_FUNCAO_PLANTAO[funcao]}`,
        valorEncontrado: resultado.fontes.join(', '),
        motivo: `Coluna obrigatória não encontrada: Plantonista ${ROTULO_FUNCAO_PLANTAO[funcao]}.`,
      });
    }
    return {
      ok: false,
      abaOrigem: resultado.abaOrigem,
      equipes: equipesVazias(),
      atribuicoes: [],
      erros,
      avisos: resultado.avisos,
      estatisticas: estatisticasVazias(),
    };
  }

  const { atribuicoes: atribuicoesBrutas, erros: errosConversao } = converterAtribuicoesMultiFonteParaBrutas(resultado);
  erros.push(...errosConversao);

  const equipes = equipesVazias();
  const atribuicoes: AtribuicaoPlantaoPorFuncao[] = [];
  const nomesUnicos = new Set<string>();
  const ocorrenciasUnicas = new Set<string>();

  for (const bruta of atribuicoesBrutas) {
    // `converterAtribuicoesMultiFonteParaBrutas()` já garante `funcao` presente para todo item retornado.
    const funcao = bruta.funcao as FuncaoPlantao;
    const ocorrenciaId = criarIdOcorrenciaPlantao(bruta.inicio, bruta.fim);
    const item: AtribuicaoPlantaoPorFuncao = { ...bruta, funcao, ocorrenciaId };
    equipes[funcao].push(item);
    atribuicoes.push(item);
    nomesUnicos.add(bruta.plantonistaNomeOriginal.trim().toLowerCase());
    ocorrenciasUnicas.add(ocorrenciaId);
  }

  const estatisticas: EstatisticasPlantaoPorFuncao = {
    linhasProcessadas: ocorrenciasUnicas.size,
    atribuicoesTotal: atribuicoes.length,
    porFuncao: {
      DBA: equipes.DBA.length,
      LINUX: equipes.LINUX.length,
      TELECOM: equipes.TELECOM.length,
      WINDOWS: equipes.WINDOWS.length,
    },
    nomesUnicos: nomesUnicos.size,
  };

  return {
    ok: erros.length === 0,
    abaOrigem: resultado.abaOrigem,
    equipes,
    atribuicoes,
    erros,
    avisos: resultado.avisos,
    estatisticas,
  };
}
