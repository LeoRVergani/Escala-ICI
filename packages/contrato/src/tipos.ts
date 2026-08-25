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

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — `BLOQUEANTE` é um erro
 * estrutural: a escala fica ilegível sem corrigir (aba/cabeçalho ausente,
 * turno não reconhecido, login não encontrado) — nada é salvo enquanto
 * existir. `ALERTA` é uma regra operacional fora do padrão que PODE ser
 * uma exceção legítima (ex.: sequência de trabalho fora de 1-6 por causa
 * de um curso/treinamento/ausência) — permite salvar rascunho, e publicar
 * exige confirmação + justificativa (nunca decide no lugar do gestor).
 * Mesma filosofia já usada no domínio Plantão (`docs/spec/PLANTOES.md`
 * §24.4: "só quatro erros objetivos bloqueiam").
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
 * saber "existe algo a revisar"). Salvar/publicar passam a checar ISTO em
 * vez de `ok`: só um erro `BLOQUEANTE` de verdade impede salvar; um
 * `ALERTA` (ex.: sequência de trabalho fora do padrão) permite salvar
 * rascunho e só exige confirmação + justificativa para publicar (ver
 * `AVISO_PUBLICACAO_COM_ALERTA` no Dashboard).
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
