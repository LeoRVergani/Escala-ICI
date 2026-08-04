import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

export interface Usuario {
  uid: string;
  login: string;
  loginAliases?: string[];
  nome: string;
  email: string;
  cargo: string;
  equipeId: string;
  gestorUid: string | null;
  nivelHierarquico: number;
  turnoPadrao: string;
  ativo: boolean;
}

export interface Equipe {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;
}

export interface Importacao {
  id: string;
  equipeId: string;
  competencia: string;
  enviadoPor: string;
  nomeArquivo: string;
  periodoInicio: string;
  periodoFim: string;
  totalDocumentos: number;
  status: 'RASCUNHO';
}

export type TipoPublicacaoEscala = 'SEED' | 'PUBLICACAO' | 'ROLLBACK';

export interface AlteracaoEscala {
  usuarioUid: string;
  login: string;
  data: string;
  codigoAnterior: string | null;
  horarioAnterior: string | null;
  codigoNovo: string | null;
  horarioNovo: string | null;
}

export interface EventoEscala {
  id: string;
  publicacaoId: string;
  equipeId: string;
  competencia: string;
  revisao: number;
  tipo: TipoPublicacaoEscala;
  usuarioUid: string;
  motivo: string;
  publicadoPor: string;
  publicadoEm: string;
  alteracoes: AlteracaoEscala[];
}

export interface PublicacaoEscala {
  id: string;
  chavePublicacao: string;
  equipeId: string;
  competencia: string;
  revisao: number;
  tipo: TipoPublicacaoEscala;
  revisaoOrigem: number | null;
  revisaoSubstituida: number | null;
  totalDocumentos: number;
  motivo?: string;
  totalColaboradoresAfetados?: number;
  totalDiasAlterados?: number;
  publicadoPor: string;
  publicadoEm: string;
}

export interface EstadoPublicacaoEscala {
  id: string;
  equipeId: string;
  competencia: string;
  revisaoAtual: number;
  ultimaPublicacaoId: string;
  atualizadoPor: string;
  atualizadoEm: string;
}

export interface DadosEscala {
  documentos: TurnosMes[];
  catalogo: Record<string, TipoTurno>;
  usuarios: Usuario[];
}
