/**
 * Protótipo visual da troca de escala (ver docs/spec/TROCA_ESCALA_PLANO.md).
 *
 * Módulo isolado e só de apresentação: nenhuma leitura/escrita no Firebase,
 * nenhuma dependência de `lib/trocaEscala.ts` (que continua no modelo de 5
 * status da Fase 3K-D1/D2, com 72 testes — a migração para os 8 status daqui
 * é proposta pra uma fase futura, não decidida "de fato" nesta rodada).
 */

export type StatusTrocaMock =
  | 'PENDENTE_USUARIO'
  | 'RECUSADA_USUARIO'
  | 'CANCELADA_SOLICITANTE'
  | 'PENDENTE_GESTOR'
  | 'RECUSADA_GESTOR'
  | 'APROVADA_AGUARDANDO_PUBLICACAO'
  | 'APROVADA_PUBLICADA'
  | 'EXPIRADA';

export const STATUS_TROCA_ORDEM: readonly StatusTrocaMock[] = [
  'PENDENTE_USUARIO',
  'PENDENTE_GESTOR',
  'APROVADA_AGUARDANDO_PUBLICACAO',
  'APROVADA_PUBLICADA',
  'RECUSADA_USUARIO',
  'RECUSADA_GESTOR',
  'CANCELADA_SOLICITANTE',
  'EXPIRADA',
];

export const ROTULO_STATUS_TROCA: Readonly<Record<StatusTrocaMock, string>> = {
  PENDENTE_USUARIO: 'Aguardando colega',
  RECUSADA_USUARIO: 'Recusada pelo colega',
  CANCELADA_SOLICITANTE: 'Cancelada',
  PENDENTE_GESTOR: 'Aguardando gestor',
  RECUSADA_GESTOR: 'Recusada pelo gestor',
  APROVADA_AGUARDANDO_PUBLICACAO: 'Aprovada — falta publicar',
  APROVADA_PUBLICADA: 'Concluída',
  EXPIRADA: 'Expirada',
};

export type SeveridadeStatusTroca = 'success' | 'warning' | 'danger' | 'neutral';

export const SEVERIDADE_STATUS_TROCA: Readonly<Record<StatusTrocaMock, SeveridadeStatusTroca>> = {
  PENDENTE_USUARIO: 'warning',
  RECUSADA_USUARIO: 'danger',
  CANCELADA_SOLICITANTE: 'neutral',
  PENDENTE_GESTOR: 'warning',
  RECUSADA_GESTOR: 'danger',
  APROVADA_AGUARDANDO_PUBLICACAO: 'warning',
  APROVADA_PUBLICADA: 'success',
  EXPIRADA: 'neutral',
};

/** Status que ainda podem seguir adiante — usado para "duplicar solicitação ativa". */
export function statusEhAtivo(status: StatusTrocaMock): boolean {
  return status === 'PENDENTE_USUARIO'
    || status === 'PENDENTE_GESTOR'
    || status === 'APROVADA_AGUARDANDO_PUBLICACAO';
}

export interface EventoHistoricoTrocaMock {
  em: string;
  ator: 'SOLICITANTE' | 'DESTINATARIO' | 'GESTOR' | 'SISTEMA';
  atorNome: string | null;
  acao: string;
  detalhe?: string;
}

export interface SolicitacaoTrocaMock {
  id: string;
  equipeId: string;
  competencia: string;

  solicitanteLogin: string;
  solicitanteNome: string;
  destinatarioLogin: string;
  destinatarioNome: string;

  dataSolicitante: string;
  turnoSolicitanteAntes: string | null;
  horarioSolicitanteAntes: string | null;

  dataDestinatario: string;
  turnoDestinatarioAntes: string | null;
  horarioDestinatarioAntes: string | null;

  status: StatusTrocaMock;
  mensagemSolicitante: string;

  criadoEm: string;
  atualizadoEm: string;
  respondidoEm: string | null;
  aprovadoEm: string | null;
  publicadoEm: string | null;

  gestorLogin: string | null;
  gestorNome: string | null;
  motivoRecusa: string | null;

  historico: EventoHistoricoTrocaMock[];
}

/** Resumo do turno de alguém em um dia — usado nos passos 1/2/3 do assistente. */
export interface DiaEscalaResumo {
  data: string;
  codigo: string | null;
  descricao: string;
  horario: string | null;
}

const EQUIPE_MOCK = 'EQ_COSI_SOC';
const COMPETENCIA_MOCK = '2026-08';

export const TROCAS_MOCK: SolicitacaoTrocaMock[] = [
  {
    id: 'mock-1',
    equipeId: EQUIPE_MOCK,
    competencia: COMPETENCIA_MOCK,
    solicitanteLogin: 'lvergani',
    solicitanteNome: 'Leonardo Vergani',
    destinatarioLogin: 'noahcampos',
    destinatarioNome: 'Noah Campos',
    dataSolicitante: '2026-08-10',
    turnoSolicitanteAntes: 'M',
    horarioSolicitanteAntes: '07:00–13:00',
    dataDestinatario: '2026-08-10',
    turnoDestinatarioAntes: 'T',
    horarioDestinatarioAntes: '13:00–19:00',
    status: 'PENDENTE_USUARIO',
    mensagemSolicitante: 'Preciso levar minha filha ao médico de manhã, você troca comigo?',
    criadoEm: '2026-08-07T13:20:00.000Z',
    atualizadoEm: '2026-08-07T13:20:00.000Z',
    respondidoEm: null,
    aprovadoEm: null,
    publicadoEm: null,
    gestorLogin: null,
    gestorNome: null,
    motivoRecusa: null,
    historico: [
      { em: '2026-08-07T13:20:00.000Z', ator: 'SOLICITANTE', atorNome: 'Leonardo Vergani', acao: 'Solicitação criada' },
      { em: '2026-08-07T13:20:05.000Z', ator: 'SISTEMA', atorNome: null, acao: 'Notificação enviada a Noah Campos' },
    ],
  },
  {
    id: 'mock-2',
    equipeId: EQUIPE_MOCK,
    competencia: COMPETENCIA_MOCK,
    solicitanteLogin: 'liavilar',
    solicitanteNome: 'Lia Vilar',
    destinatarioLogin: 'lvergani',
    destinatarioNome: 'Leonardo Vergani',
    dataSolicitante: '2026-08-12',
    turnoSolicitanteAntes: 'MD',
    horarioSolicitanteAntes: '01:00–07:00',
    dataDestinatario: '2026-08-13',
    turnoDestinatarioAntes: 'M',
    horarioDestinatarioAntes: '07:00–13:00',
    status: 'PENDENTE_GESTOR',
    mensagemSolicitante: 'Troco minha madrugada de quarta pela sua manhã de quinta.',
    criadoEm: '2026-08-05T09:10:00.000Z',
    atualizadoEm: '2026-08-06T08:00:00.000Z',
    respondidoEm: '2026-08-06T08:00:00.000Z',
    aprovadoEm: null,
    publicadoEm: null,
    gestorLogin: null,
    gestorNome: null,
    motivoRecusa: null,
    historico: [
      { em: '2026-08-05T09:10:00.000Z', ator: 'SOLICITANTE', atorNome: 'Lia Vilar', acao: 'Solicitação criada' },
      { em: '2026-08-05T09:10:05.000Z', ator: 'SISTEMA', atorNome: null, acao: 'Notificação enviada a Leonardo Vergani' },
      { em: '2026-08-06T08:00:00.000Z', ator: 'DESTINATARIO', atorNome: 'Leonardo Vergani', acao: 'Aceite do colega', detalhe: 'Encaminhada para o gestor' },
    ],
  },
  {
    id: 'mock-3',
    equipeId: EQUIPE_MOCK,
    competencia: COMPETENCIA_MOCK,
    solicitanteLogin: 'cmonteiro',
    solicitanteNome: 'Caio Monteiro',
    destinatarioLogin: 'bsalles',
    destinatarioNome: 'Bianca Salles',
    dataSolicitante: '2026-08-03',
    turnoSolicitanteAntes: 'MD',
    horarioSolicitanteAntes: '01:00–07:00',
    dataDestinatario: '2026-08-03',
    turnoDestinatarioAntes: 'M',
    horarioDestinatarioAntes: '07:00–13:00',
    status: 'APROVADA_AGUARDANDO_PUBLICACAO',
    mensagemSolicitante: 'Compromisso de família na madrugada, obrigado por aceitar!',
    criadoEm: '2026-08-01T10:00:00.000Z',
    atualizadoEm: '2026-08-02T15:40:00.000Z',
    respondidoEm: '2026-08-01T18:30:00.000Z',
    aprovadoEm: '2026-08-02T15:40:00.000Z',
    publicadoEm: null,
    gestorLogin: 'mazevedo',
    gestorNome: 'Marina Azevedo',
    motivoRecusa: null,
    historico: [
      { em: '2026-08-01T10:00:00.000Z', ator: 'SOLICITANTE', atorNome: 'Caio Monteiro', acao: 'Solicitação criada' },
      { em: '2026-08-01T18:30:00.000Z', ator: 'DESTINATARIO', atorNome: 'Bianca Salles', acao: 'Aceite do colega', detalhe: 'Encaminhada para o gestor' },
      { em: '2026-08-02T15:40:00.000Z', ator: 'GESTOR', atorNome: 'Marina Azevedo', acao: 'Aprovada', detalhe: 'Aguardando publicação' },
    ],
  },
  {
    id: 'mock-4',
    equipeId: EQUIPE_MOCK,
    competencia: COMPETENCIA_MOCK,
    solicitanteLogin: 'etavares',
    solicitanteNome: 'Enzo Tavares',
    destinatarioLogin: 'lvergani',
    destinatarioNome: 'Leonardo Vergani',
    dataSolicitante: '2026-07-29',
    turnoSolicitanteAntes: 'T',
    horarioSolicitanteAntes: '13:00–19:00',
    dataDestinatario: '2026-07-30',
    turnoDestinatarioAntes: 'M',
    horarioDestinatarioAntes: '07:00–13:00',
    status: 'APROVADA_PUBLICADA',
    mensagemSolicitante: 'Troca já combinada com o Leonardo.',
    criadoEm: '2026-07-25T11:00:00.000Z',
    atualizadoEm: '2026-07-27T09:15:00.000Z',
    respondidoEm: '2026-07-25T20:00:00.000Z',
    aprovadoEm: '2026-07-26T14:00:00.000Z',
    publicadoEm: '2026-07-27T09:15:00.000Z',
    gestorLogin: 'mazevedo',
    gestorNome: 'Marina Azevedo',
    motivoRecusa: null,
    historico: [
      { em: '2026-07-25T11:00:00.000Z', ator: 'SOLICITANTE', atorNome: 'Enzo Tavares', acao: 'Solicitação criada' },
      { em: '2026-07-25T20:00:00.000Z', ator: 'DESTINATARIO', atorNome: 'Leonardo Vergani', acao: 'Aceite do colega' },
      { em: '2026-07-26T14:00:00.000Z', ator: 'GESTOR', atorNome: 'Marina Azevedo', acao: 'Aprovada' },
      { em: '2026-07-27T09:15:00.000Z', ator: 'GESTOR', atorNome: 'Marina Azevedo', acao: 'Publicada', detalhe: 'Escala atualizada para os dois colaboradores' },
    ],
  },
  {
    id: 'mock-5',
    equipeId: EQUIPE_MOCK,
    competencia: COMPETENCIA_MOCK,
    solicitanteLogin: 'lvergani',
    solicitanteNome: 'Leonardo Vergani',
    destinatarioLogin: 'aleilima',
    destinatarioNome: 'Alessandra Lima',
    dataSolicitante: '2026-08-02',
    turnoSolicitanteAntes: 'M',
    horarioSolicitanteAntes: '07:00–13:00',
    dataDestinatario: '2026-08-02',
    turnoDestinatarioAntes: 'MD',
    horarioDestinatarioAntes: '01:00–07:00',
    status: 'RECUSADA_USUARIO',
    mensagemSolicitante: 'Você trocaria sua madrugada pela minha manhã?',
    criadoEm: '2026-07-30T16:00:00.000Z',
    atualizadoEm: '2026-07-31T08:00:00.000Z',
    respondidoEm: '2026-07-31T08:00:00.000Z',
    aprovadoEm: null,
    publicadoEm: null,
    gestorLogin: null,
    gestorNome: null,
    motivoRecusa: 'Já tenho compromisso nesse horário.',
    historico: [
      { em: '2026-07-30T16:00:00.000Z', ator: 'SOLICITANTE', atorNome: 'Leonardo Vergani', acao: 'Solicitação criada' },
      { em: '2026-07-31T08:00:00.000Z', ator: 'DESTINATARIO', atorNome: 'Alessandra Lima', acao: 'Recusada pelo colega', detalhe: 'Já tenho compromisso nesse horário.' },
    ],
  },
  {
    id: 'mock-6',
    equipeId: EQUIPE_MOCK,
    competencia: COMPETENCIA_MOCK,
    solicitanteLogin: 'bsalles',
    solicitanteNome: 'Bianca Salles',
    destinatarioLogin: 'cmonteiro',
    destinatarioNome: 'Caio Monteiro',
    dataSolicitante: '2026-07-28',
    turnoSolicitanteAntes: 'M',
    horarioSolicitanteAntes: '07:00–13:00',
    dataDestinatario: '2026-07-28',
    turnoDestinatarioAntes: 'MD',
    horarioDestinatarioAntes: '01:00–07:00',
    status: 'RECUSADA_GESTOR',
    mensagemSolicitante: 'Troca de manhã por madrugada no mesmo dia.',
    criadoEm: '2026-07-24T09:00:00.000Z',
    atualizadoEm: '2026-07-25T11:30:00.000Z',
    respondidoEm: '2026-07-24T19:00:00.000Z',
    aprovadoEm: null,
    publicadoEm: null,
    gestorLogin: 'mazevedo',
    gestorNome: 'Marina Azevedo',
    motivoRecusa: 'Caio já teria menos de 11h de descanso entre os turnos nessa semana.',
    historico: [
      { em: '2026-07-24T09:00:00.000Z', ator: 'SOLICITANTE', atorNome: 'Bianca Salles', acao: 'Solicitação criada' },
      { em: '2026-07-24T19:00:00.000Z', ator: 'DESTINATARIO', atorNome: 'Caio Monteiro', acao: 'Aceite do colega', detalhe: 'Encaminhada para o gestor' },
      { em: '2026-07-25T11:30:00.000Z', ator: 'GESTOR', atorNome: 'Marina Azevedo', acao: 'Recusada pelo gestor', detalhe: 'Caio já teria menos de 11h de descanso entre os turnos nessa semana.' },
    ],
  },
];
