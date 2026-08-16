/**
 * Contrato puro do domínio de Plantão (Fase PLANTÃO-1). Nenhum tipo aqui
 * corresponde a schema Firestore — ver `docs/spec/PLANTOES.md`. Nenhum tipo
 * aqui é usado para decidir login: o parser preserva sempre
 * `plantonistaNomeOriginal`, nunca inventa identidade (ver seção "Nome do
 * XLS → login real" da especificação).
 */

export type TipoPlanilha = 'ESCALA_6X1' | 'PLANTAO' | 'DESCONHECIDA';

export interface ResultadoDeteccaoPlanilha {
  tipo: TipoPlanilha;
  /** Nome real da aba onde a estrutura reconhecida foi encontrada. */
  abaEncontrada?: string;
  /** Presente só quando há ambiguidade — mais de uma aba estruturalmente compatível. */
  abasCandidatas?: string[];
  /** Diagnóstico legível, sobretudo quando `tipo` é `DESCONHECIDA`. */
  motivo?: string;
}

/**
 * Momento civil (data + hora), sem timezone anexado — decisão deliberada,
 * ver seção "Datas, horas e timezone" de `docs/spec/PLANTOES.md`. Mesmo
 * princípio de `ReferenciaTemporal` (`jornada.ts`): nunca combinar
 * data+hora num único `Date`/string com fuso, para não sofrer conversão
 * silenciosa pelo timezone da máquina que roda o código.
 */
export interface MomentoPlantao {
  /** YYYY-MM-DD, mesma convenção de `montarChaveDia`. */
  data: string;
  /** HH:mm, 24h. */
  hora: string;
}

export interface AtribuicaoPlantaoBruta {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  duracaoMinutos: number;
  /** Linha 1-based da planilha de origem, para diagnóstico. */
  linhaOrigem: number;
  /** Nome real da aba de origem — nunca assumir um nome fixo (ex.: "PlantaoCOSI"). */
  abaOrigem: string;
}

export interface ErroImportacaoPlantao {
  linha: number;
  coluna: string;
  /** Preenchido quando o erro está associado a uma linha de atribuição já identificada. */
  plantonistaNomeOriginal?: string;
  valorEncontrado: string;
  motivo: string;
  sugestao?: string;
}

/** Uma linha da seção "Contabilidade dos Plantões no mês" informada pelo XLS. */
export interface ContabilidadePlantaoInformada {
  plantonistaNomeOriginal: string;
  quantidadeInformada: number;
  minutosInformados: number;
  /** Valor de texto original da célula de horas, preservado para diagnóstico. */
  valorHorasBruto: string;
}

/** Linha de total da seção de contabilidade informada pelo XLS (quando presente). */
export interface TotaisInformadosPlantao {
  totalPlantoesInformado: number;
  totalMinutosInformado: number;
}

/**
 * Soma bruta das durações das atribuições lidas — NUNCA chamar isso de
 * "contabilidade mensal": a planilha real analisada prova que a
 * contabilidade de negócio informada não coincide com a soma bruta dos
 * intervalos (504h somadas vs. 468h informadas, mesmo mês). Ver
 * `calcularDuracaoBrutaDosIntervalos` em `parserPlantao.ts`.
 */
export interface TotalBrutoPlantao {
  quantidade: number;
  minutos: number;
}

export type TipoSobreposicaoPlantao = 'MESMO_PLANTONISTA' | 'PLANTONISTAS_DIFERENTES';

/** Duas atribuições cujos intervalos se sobrepõem no tempo — só detecção, nunca correção automática. */
export interface SobreposicaoPlantao {
  tipo: TipoSobreposicaoPlantao;
  a: AtribuicaoPlantaoBruta;
  b: AtribuicaoPlantaoBruta;
}

/**
 * Intervalo cronológico entre o fim de uma atribuição e o início da
 * seguinte (ordenadas por início) — informação estrutural, nunca uma
 * violação de cobertura por si só (ver seção "Lacunas" de `PLANTOES.md`).
 */
export interface LacunaPlantao {
  fimAnterior: MomentoPlantao;
  inicioProximo: MomentoPlantao;
  minutos: number;
}

export interface ResultadoParsePlantao {
  ok: boolean;
  /** Nome real da aba de onde os dados foram lidos. */
  abaOrigem: string;
  atribuicoes: AtribuicaoPlantaoBruta[];
  contabilidadeInformada: ContabilidadePlantaoInformada[];
  /** `null` quando a planilha não tem a seção de contabilidade informada. */
  totaisInformados: TotaisInformadosPlantao | null;
  totalBrutoCalculado: TotalBrutoPlantao;
  sobreposicoes: SobreposicaoPlantao[];
  erros: ErroImportacaoPlantao[];
  avisos: string[];
}
