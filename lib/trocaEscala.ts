import type { Dia, TurnosMes } from '@escala-ici/contrato';

import type {
  AtorSolicitacaoTroca,
  DiaSolicitacaoTroca,
  NovaSolicitacaoTroca,
  SolicitacaoTroca,
  StatusSolicitacaoTroca,
} from './modelos';

/**
 * Fase 3K-D1 — desenho inicial da troca de escala (sem implementação).
 *
 * Este módulo é intencionalmente puro: não importa o SDK do Firestore e não
 * executa nenhuma mutação. Ele existe para fixar o contrato antes da
 * implementação, mantendo o App do colaborador somente leitura na escala.
 *
 * Fronteiras do desenho:
 * - a única coleção que o App poderá escrever no futuro é `solicitacoesTroca`;
 * - o App só cria a solicitação (`PENDENTE`) e pode cancelar a própria;
 * - aprovar, recusar e aplicar na escala é exclusividade do Dashboard/gestor;
 * - aplicar a troca reaproveita a publicação com revisão do Dashboard, então a
 *   escala continua tendo uma única origem de escrita.
 */
export const COLECAO_SOLICITACOES_TROCA = 'solicitacoesTroca';

/** Campos aceitos do App na criação; qualquer outro deve ser recusado. */
export const CAMPOS_CRIACAO_SOLICITACAO_TROCA = [
  'id',
  'equipeId',
  'competencia',
  'revisaoBase',
  'solicitanteUid',
  'solicitanteLogin',
  'destinatarioUid',
  'destinatarioLogin',
  'diaSolicitante',
  'diaDestinatario',
  'motivo',
  'status',
  'criadoEm',
  'atualizadoEm',
] as const;

export const TRANSICOES_SOLICITACAO_TROCA: Readonly<
  Record<StatusSolicitacaoTroca, readonly StatusSolicitacaoTroca[]>
> = {
  PENDENTE: ['CANCELADA', 'RECUSADA', 'APROVADA'],
  APROVADA: ['APLICADA', 'RECUSADA'],
  CANCELADA: [],
  RECUSADA: [],
  APLICADA: [],
};

/** Quem pode levar a solicitação até cada status. */
export const ATOR_POR_STATUS: Readonly<
  Record<StatusSolicitacaoTroca, AtorSolicitacaoTroca>
> = {
  PENDENTE: 'COLABORADOR',
  CANCELADA: 'COLABORADOR',
  RECUSADA: 'GESTOR',
  APROVADA: 'GESTOR',
  APLICADA: 'GESTOR',
};

export const LIMITE_MOTIVO_TROCA = 280;

export function transicaoPermitida(
  de: StatusSolicitacaoTroca,
  para: StatusSolicitacaoTroca,
): boolean {
  return TRANSICOES_SOLICITACAO_TROCA[de].includes(para);
}

export function atorDaTransicao(
  para: StatusSolicitacaoTroca,
): AtorSolicitacaoTroca {
  return ATOR_POR_STATUS[para];
}

/** O App só pode operar transições atribuídas ao colaborador. */
export function transicaoPermitidaNoApp(
  de: StatusSolicitacaoTroca,
  para: StatusSolicitacaoTroca,
): boolean {
  return transicaoPermitida(de, para) && atorDaTransicao(para) === 'COLABORADOR';
}

export function dividirHorario(dia: Dia | undefined): string | null {
  if (dia?.i === undefined || dia.f === undefined) {
    return null;
  }
  return `${dia.i}–${dia.f}`;
}

export function diaParaSolicitacao(
  escala: TurnosMes | null,
  data: string,
): DiaSolicitacaoTroca {
  const dia = escala?.dias[data];
  return {
    data,
    codigo: dia?.c ?? null,
    horario: dividirHorario(dia),
  };
}

/**
 * Validação pura do que o App poderá enviar. Espelha as restrições que as
 * Firestore Rules deverão aplicar quando a escrita for liberada.
 */
export function validarSolicitacaoTroca(
  entrada: NovaSolicitacaoTroca,
  contexto: { usuarioUid: string; equipeId: string },
): string[] {
  const erros: string[] = [];

  if (entrada.solicitanteUid !== contexto.usuarioUid) {
    erros.push('A solicitação só pode ser criada em nome do próprio colaborador.');
  }
  if (entrada.equipeId !== contexto.equipeId) {
    erros.push('A troca só pode ocorrer dentro da própria equipe.');
  }
  if (entrada.destinatarioUid === entrada.solicitanteUid) {
    erros.push('Escolha outro colaborador para a troca.');
  }
  if (entrada.destinatarioUid.trim() === '') {
    erros.push('Informe o colaborador que receberá a solicitação.');
  }
  if (entrada.diaSolicitante.data === entrada.diaDestinatario.data
    && entrada.diaSolicitante.codigo === entrada.diaDestinatario.codigo) {
    erros.push('Os dias escolhidos precisam ser diferentes.');
  }
  if (entrada.motivo.trim() === '') {
    erros.push('Descreva o motivo da troca.');
  }
  if (entrada.motivo.length > LIMITE_MOTIVO_TROCA) {
    erros.push(`O motivo deve ter no máximo ${LIMITE_MOTIVO_TROCA} caracteres.`);
  }
  if (!Number.isInteger(entrada.revisaoBase) || entrada.revisaoBase < 1) {
    erros.push('A solicitação precisa apontar a revisão vigente da escala.');
  }

  return erros;
}

/**
 * Monta o documento que o App enviaria. Recebe `id` e `agora` de fora para
 * permanecer determinístico e testável.
 */
export function montarSolicitacaoTroca(
  entrada: NovaSolicitacaoTroca,
  id: string,
  agora: string,
): SolicitacaoTroca {
  return {
    ...entrada,
    id,
    motivo: entrada.motivo.trim(),
    status: 'PENDENTE',
    criadoEm: agora,
    atualizadoEm: agora,
    decididoPor: null,
    decididoEm: null,
    observacaoGestor: null,
    aplicadoNaRevisao: null,
  };
}

/**
 * Uma solicitação deixa de valer quando a escala recebe nova revisão: os dias
 * fotografados podem não existir mais. O gestor deve revalidar antes de aplicar.
 */
export function solicitacaoDesatualizada(
  solicitacao: Pick<SolicitacaoTroca, 'revisaoBase' | 'status'>,
  revisaoAtual: number,
): boolean {
  return solicitacao.status === 'PENDENTE'
    && revisaoAtual > solicitacao.revisaoBase;
}
