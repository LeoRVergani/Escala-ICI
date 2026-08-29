import {
  analisarArquivoEscalaPlantao,
  converterAnaliseParaResultadoParsePlantao,
  detectarTipoPlanilha,
  parsePlanilhaEscala,
  parsePlanilhaPlantao,
  type OpcoesParse,
  type ResultadoParse,
  type ResultadoParsePlantao,
} from '@escala-ici/contrato';

/**
 * Fase PLANTÃO-2 — roteador puro entre os dois domínios do pacote
 * `@escala-ici/contrato` (6x1 vs. Plantão). Não reimplementa detecção nem
 * parsing: só decide qual parser/analisador já existente chamar.
 *
 * FASE-IMPORTADOR-UNIVERSAL-1 — dentro do ramo Plantão, o motor universal
 * (`analisarArquivoEscalaPlantao()`, `docs/spec/IMPORTADOR_UNIVERSAL_ESCALAS.md`)
 * decide PRIMEIRO se a planilha é multi-fonte (2+ colunas "Plantonista
 * <fonte>", ex. Plantão CODB) antes de tentar o detector de fonte única
 * (`detectarTipoPlanilha()`). Isso corrige o bug real de "4 plantonistas em
 * vez de 17": o detector de fonte única aceitava por acidente a ÚLTIMA
 * coluna "Plantonista X" de uma planilha multi-fonte real como se fosse a
 * única fonte da planilha inteira (ela fica contígua às colunas de data,
 * formando um falso "trio" completo) — silenciosamente lendo só 1 dos 4
 * postos. Uma planilha de fonte única de verdade (Plantão COSI/Segurança,
 * 1 única coluna "Plantonista") nunca aciona o ramo multi-fonte e continua
 * 100% no caminho original (`parsePlanilhaPlantao()` direto, sem passar
 * pelo modelo canônico) — preserva `contabilidadeInformada`/
 * `totaisInformados`, que só existem nesse formato e que o modelo
 * canônico ainda não carrega (dívida documentada na spec).
 */
export type ResultadoImportacaoArquivo =
  | { tipo: 'ESCALA_6X1'; resultado: ResultadoParse }
  | { tipo: 'PLANTAO'; resultado: ResultadoParsePlantao }
  | { tipo: 'DESCONHECIDA'; motivo: string };

const MOTIVO_PADRAO = 'Estrutura de planilha não reconhecida.';

export function processarArquivoImportado(
  arquivo: ArrayBuffer,
  opcoes6x1: OpcoesParse,
): ResultadoImportacaoArquivo {
  const analiseMultiFonte = analisarArquivoEscalaPlantao(arquivo);
  if (analiseMultiFonte.descoberta.estrutura === 'PLANTAO_MULTIFONTE') {
    return { tipo: 'PLANTAO', resultado: converterAnaliseParaResultadoParsePlantao(analiseMultiFonte) };
  }

  const deteccao = detectarTipoPlanilha(arquivo);

  if (deteccao.tipo === 'ESCALA_6X1') {
    return { tipo: 'ESCALA_6X1', resultado: parsePlanilhaEscala(arquivo, opcoes6x1) };
  }

  if (deteccao.tipo === 'PLANTAO') {
    return { tipo: 'PLANTAO', resultado: parsePlanilhaPlantao(arquivo) };
  }

  return { tipo: 'DESCONHECIDA', motivo: deteccao.motivo ?? MOTIVO_PADRAO };
}
