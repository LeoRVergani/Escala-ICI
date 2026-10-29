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
  /**
   * HOTFIX-HE-TURNO-1 — turno de trabalho (MD/M/T/N) em que uma Hora Extra
   * acontece. Só existe quando `c` é de categoria EXTRA (ex.: `HE`). O
   * código `c` continua `HE` (é ele que conta em `totais.he`); `t` diz em
   * qual período a pessoa trabalha, para a tela mostrar cor e horário do
   * turno real. Sem `t`, a HE continua aparecendo como antes (sem horário).
   */
  t?: string;
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
  /** Pendências aceitas pelo gestor ao salvar/publicar esta versão. */
  pendenciasImportacao?: ErroImportacao[];
  publicadoPor?: string | null;
  publicadoEm?: string | null;
  atualizadoEm?: string;
}

/**
 * `BLOQUEANTE` identifica um erro estrutural grave para destaque e revisão;
 * `ALERTA` identifica uma exceção operacional. Na Jornada, ambos podem ser
 * salvos por decisão do gestor. Publicar com qualquer um deles exige
 * confirmação e justificativa, permitindo corrigir em revisão posterior.
 */
export type SeveridadeErroImportacao = 'BLOQUEANTE' | 'ALERTA';

export interface ErroImportacao {
  linha: number;
  coluna: string;
  login?: string;
  data?: string;
  valorEncontrado: string;
  motivo: string;
  sugestao?: string;
  severidade: SeveridadeErroImportacao;
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

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — `ResultadoParse.ok`
 * continua `erros.length === 0` (inalterado, usado por quem só precisa
 * saber "existe algo a revisar"). Esta função classifica a gravidade para
 * a interface, mas não é gate de persistência da Jornada: salvar é
 * permitido e publicar exige justificativa quando houver qualquer erro.
 */
export function temErroBloqueante(erros: readonly ErroImportacao[]): boolean {
  return erros.some((erro) => erro.severidade === 'BLOQUEANTE');
}

export interface OpcoesParse {
  equipeId: string;
  competencia: string;
  catalogo: Record<string, TipoTurno>;
  loginParaUid: Record<string, string>;
  anoInicio?: number;
}
