import {
  detectarTipoPlanilha,
  parsePlanilhaEscala,
  parsePlanilhaPlantao,
  type OpcoesParse,
  type ResultadoParse,
  type ResultadoParsePlantao,
} from '@escala-ici/contrato';

/**
 * Fase PLANTÃO-2 — roteador puro entre os dois parsers do pacote
 * `@escala-ici/contrato`. Não reimplementa detecção nem parsing: só decide,
 * a partir de `detectarTipoPlanilha`, qual dos dois parsers já existentes
 * chamar. Sem SDK do Firestore, sem `writeRepository`, sem
 * `CATALOGO_SOC`/regras de 6x1 embutidas para o caminho de Plantão — o
 * ramo `PLANTAO` só recebe os bytes do arquivo, nada mais (ver
 * `docs/spec/PLANTOES.md`).
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
  const deteccao = detectarTipoPlanilha(arquivo);

  if (deteccao.tipo === 'ESCALA_6X1') {
    return { tipo: 'ESCALA_6X1', resultado: parsePlanilhaEscala(arquivo, opcoes6x1) };
  }

  if (deteccao.tipo === 'PLANTAO') {
    return { tipo: 'PLANTAO', resultado: parsePlanilhaPlantao(arquivo) };
  }

  return { tipo: 'DESCONHECIDA', motivo: deteccao.motivo ?? MOTIVO_PADRAO };
}
