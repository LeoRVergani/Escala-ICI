export const SCHEMA_VERSION = 1;

export type Categoria =
  | 'TRABALHO'
  | 'PLANTAO'
  | 'EXTRA'
  | 'DESCANSO'
  | 'COMPENSACAO'
  | 'AUSENCIA';

export interface TipoTurno {
  codigo: string;
  descricao: string;
  categoria: Categoria;
  horaInicio?: string;
  horaFim?: string;
  duracaoMinutos: number;
  viraDia: boolean;
  contaComoPlantao: boolean;
  pesoPlantao: number;
  corHex: string;
  aliasesXLS: string[];
}

export interface Dia {
  c: string;
  i?: string;
  f?: string;
  m?: number;
  vd?: boolean;
  seq?: number;
}

export interface Totais {
  min: number;
  diasTrabalhados: number;
  df: number;
  du: number;
  x: number;
  he: number;
  bh: number;
  an: number;
  folga: number;
  afa: number;
}

export interface TurnosMes {
  schemaVersion: number;
  usuarioUid: string;
  login: string;
  equipeId: string;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  turnoPadrao: string;
  status: 'RASCUNHO' | 'PUBLICADA';
  dias: Record<string, Dia>;
  totais: Totais;
  importacaoId?: string;
  publicadoPor?: string | null;
  publicadoEm?: string | null;
  atualizadoEm?: string;
}

export interface ErroImportacao {
  linha: number;
  coluna: string;
  login?: string;
  data?: string;
  valorEncontrado: string;
  motivo: string;
  sugestao?: string;
}

export interface ResultadoParse {
  ok: boolean;
  equipeNome: string;
  periodoInicio: string;
  periodoFim: string;
  totalDias: number;
  documentos: TurnosMes[];
  erros: ErroImportacao[];
  avisos: string[];
}

export interface OpcoesParse {
  equipeId: string;
  competencia: string;
  catalogo: Record<string, TipoTurno>;
  loginParaUid: Record<string, string>;
  anoInicio?: number;
}
