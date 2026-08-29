import * as XLSX from 'xlsx';

import { localizarTabelaPlantaoMultiFonte } from '../detectorTabelaPlantaoMultiFonte.js';
import {
  calcularDuracaoBrutaDosIntervalos,
  detectarSobreposicoesPlantao,
  parsePlanilhaPlantao,
} from '../parserPlantao.js';
import {
  converterAtribuicoesMultiFonteParaBrutas,
  parsePlanilhaPlantaoMultiFonte,
} from '../parserPlantaoMultiFonte.js';
import type { AtribuicaoPlantaoBruta, ResultadoParsePlantao } from '../tiposPlantao.js';
import {
  calcularEstatisticasImportacao,
  type RegistroEscalaCanonico,
  type ResultadoAnaliseEscala,
} from './modeloCanonico.js';

/**
 * Entrypoint universal do domínio Plantão (`docs/spec/IMPORTADOR_UNIVERSAL_ESCALAS.md`,
 * FASE-IMPORTADOR-UNIVERSAL-1 §38). Decide entre as DUAS estruturas de
 * Plantão já suportadas — nunca "na sorte", sempre pela estrutura real do
 * cabeçalho:
 *
 * - `PLANTAO_MULTIFONTE`: 2+ colunas "Plantonista <fonte>" (o caso real do
 *   Plantão CODB — DBA/Linux/Telecom/Windows). Detectado PRIMEIRO e
 *   deliberadamente: o detector de fonte única
 *   (`localizarTabelaPlantao()`) também "acerta" por acidente numa
 *   planilha multi-fonte real (a ÚLTIMA coluna "Plantonista X" fica
 *   contígua às colunas de data, formando um falso "trio único") — foi
 *   exatamente essa falsa detecção que produzia "4 plantonistas" em vez
 *   de 17 no Dashboard (a coluna de UM posto só, lida como se fosse a
 *   única fonte da planilha inteira). Checar multi-fonte primeiro elimina
 *   esse falso positivo estruturalmente, sem heurística de nome de aba ou
 *   de arquivo.
 * - `PLANTAO_INTERVALO`: exatamente 1 coluna "Plantonista" — o formato de
 *   fonte única já usado por Plantão COSI/Segurança, inalterado.
 *
 * Reaproveita os parsers/detectores já testados (`parsePlanilhaPlantao()`,
 * `parsePlanilhaPlantaoMultiFonte()`, `converterAtribuicoesMultiFonteParaBrutas()`)
 * — nunca reimplementa scanning/parsing de célula aqui, só converte o
 * resultado já correto para o modelo canônico.
 */
export function analisarArquivoEscalaPlantao(arquivo: ArrayBuffer): ResultadoAnaliseEscala {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const multiFonte = localizarTabelaPlantaoMultiFonte(workbook);

  if (multiFonte.status === 'UNICA' && (multiFonte.colunas?.length ?? 0) >= 2) {
    const bruto = parsePlanilhaPlantaoMultiFonte(arquivo);
    const { atribuicoes, erros: errosConversao } = converterAtribuicoesMultiFonteParaBrutas(bruto);
    const registros = atribuicoes.map(atribuicaoParaRegistroCanonico);
    return {
      descoberta: { estrutura: 'PLANTAO_MULTIFONTE', confianca: bruto.ok ? 1 : 0.5, abaOrigem: bruto.abaOrigem },
      registros,
      estatisticas: calcularEstatisticasImportacao(registros),
      avisos: bruto.avisos,
      erros: [...bruto.erros, ...errosConversao],
    };
  }

  const resultado = parsePlanilhaPlantao(arquivo);
  const registros = resultado.atribuicoes.map(atribuicaoParaRegistroCanonico);
  return {
    descoberta: {
      // `abaOrigem` só vem vazio quando `localizarTabelaPlantao()` não achou
      // NENHUM cabeçalho de fonte única (`resultadoVazioPlantao()`, default
      // `''`) — sinal estrutural, nunca a presença de erros de conteúdo
      // (uma tabela encontrada com datas inválidas continua PLANTAO_INTERVALO).
      estrutura: resultado.abaOrigem !== '' ? 'PLANTAO_INTERVALO' : 'DESCONHECIDA',
      confianca: resultado.ok ? 1 : 0.5,
      abaOrigem: resultado.abaOrigem,
    },
    registros,
    estatisticas: calcularEstatisticasImportacao(registros),
    avisos: resultado.avisos,
    erros: resultado.erros,
  };
}

function atribuicaoParaRegistroCanonico(atribuicao: AtribuicaoPlantaoBruta): RegistroEscalaCanonico {
  return {
    origem: { folha: atribuicao.abaOrigem, linha: atribuicao.linhaOrigem },
    pessoa: { nomeFonte: atribuicao.plantonistaNomeOriginal },
    inicio: atribuicao.inicio,
    fim: atribuicao.fim,
    duracaoMinutos: atribuicao.duracaoMinutos,
    ...(atribuicao.funcao === undefined ? {} : { funcao: atribuicao.funcao }),
  };
}

function registroCanonicoParaAtribuicaoBruta(registro: RegistroEscalaCanonico): AtribuicaoPlantaoBruta {
  return {
    plantonistaNomeOriginal: registro.pessoa.nomeFonte,
    inicio: registro.inicio,
    fim: registro.fim,
    duracaoMinutos: registro.duracaoMinutos,
    linhaOrigem: registro.origem.linha,
    abaOrigem: registro.origem.folha,
    ...(registro.funcao === undefined ? {} : { funcao: registro.funcao }),
  };
}

/**
 * Adapta `ResultadoAnaliseEscala` (modelo canônico) de volta para
 * `ResultadoParsePlantao` — o formato que `lib/importadorPlanilha.ts` e
 * todo o Editor de Plantão do Dashboard já consomem
 * (`interpretarPlantao()`, `criarAtribuicoesEditaveis()`,
 * `consolidarParticipantesPlantao()`, `sugerirCompetenciaPlantao()`,
 * `montarAtribuicoesPlantaoRascunho()`). Isso mantém o motor universal
 * como a fonte única de verdade da leitura/detecção sem exigir reescrever
 * o Editor nesta fase (`docs/spec/IMPORTADOR_UNIVERSAL_ESCALAS.md`, "não
 * fazer big bang"). `contabilidadeInformada`/`totaisInformados` ficam
 * vazios: essa seção não existe na estrutura multi-fonte (planilha
 * diferente) e, para fonte única, já vem preenchida por
 * `parsePlanilhaPlantao()` — perdida aqui só quando a origem foi
 * multi-fonte, onde ela nunca existiu para começo de conversa.
 */
export function converterAnaliseParaResultadoParsePlantao(analise: ResultadoAnaliseEscala): ResultadoParsePlantao {
  const atribuicoes = analise.registros.map(registroCanonicoParaAtribuicaoBruta);
  return {
    ok: analise.erros.length === 0,
    abaOrigem: analise.descoberta.abaOrigem,
    atribuicoes,
    contabilidadeInformada: [],
    totaisInformados: null,
    totalBrutoCalculado: calcularDuracaoBrutaDosIntervalos(atribuicoes),
    sobreposicoes: detectarSobreposicoesPlantao(atribuicoes),
    erros: analise.erros,
    avisos: analise.avisos,
  };
}
