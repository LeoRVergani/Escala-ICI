import type { NotificacaoTroca } from '@/lib/trocasEscala';
import type { NotificacaoTrocaPlantao, SolicitacaoTrocaPlantao, StatusTrocaPlantao } from '@/lib/trocasPlantao';
import { statusTrocaPlantaoEhAtivo } from '@/lib/trocasPlantao';

/**
 * Lógica pura da tela "Trocas" do App — mescla notificações de Jornada 6x1 e
 * de Plantão num único sino sem misturar as duas coleções de origem, e
 * replica para Plantão o mesmo padrão de abas (minhas/responder/gestor/
 * histórico) já usado pela Jornada, hoje calculado inline em JSX. Sem
 * dependência de DOM/React/Firebase — mesmo princípio de `plantaoApp.ts`.
 */

export type OrigemTroca = 'JORNADA' | 'PLANTAO';

export interface ItemNotificacaoTrocaApp {
  id: string;
  origem: OrigemTroca;
  trocaId: string;
  titulo: string;
  mensagem: string;
  criadoEm: string;
  lidaEm: string | null;
}

/** Mescla as notificações de Jornada e de Plantão num único feed, ordenado por criadoEm desc — mais recente primeiro. */
export function mesclarNotificacoesTrocaApp(
  jornada: readonly NotificacaoTroca[],
  plantao: readonly NotificacaoTrocaPlantao[],
): ItemNotificacaoTrocaApp[] {
  const itensJornada: ItemNotificacaoTrocaApp[] = jornada.map((notificacao) => ({
    id: notificacao.id,
    origem: 'JORNADA',
    trocaId: notificacao.trocaId,
    titulo: notificacao.titulo,
    mensagem: notificacao.mensagem,
    criadoEm: notificacao.criadoEm,
    lidaEm: notificacao.lidaEm,
  }));
  const itensPlantao: ItemNotificacaoTrocaApp[] = plantao.map((notificacao) => ({
    id: notificacao.id,
    origem: 'PLANTAO',
    trocaId: notificacao.trocaId,
    titulo: notificacao.titulo,
    mensagem: notificacao.mensagem,
    criadoEm: notificacao.criadoEm,
    lidaEm: notificacao.lidaEm,
  }));
  return [...itensJornada, ...itensPlantao].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function contarNaoLidas(itens: readonly ItemNotificacaoTrocaApp[]): number {
  return itens.filter((item) => item.lidaEm === null).length;
}

export type AbaTrocas = 'minhas' | 'responder' | 'gestor' | 'historico';

export interface ContagensAbasTrocaPlantao {
  minhas: number;
  responder: number;
  gestor: number;
  historico: number;
}

function statusInativo(status: StatusTrocaPlantao): boolean {
  return !statusTrocaPlantaoEhAtivo(status);
}

/** Igual à contagem de abas de Jornada (inline em `EmployeeApp.tsx`), só que sobre `SolicitacaoTrocaPlantao`. */
export function contarAbasTrocaPlantao(
  trocas: readonly SolicitacaoTrocaPlantao[],
  login: string,
): ContagensAbasTrocaPlantao {
  return {
    minhas: trocas.filter((item) => item.solicitanteLogin === login).length,
    responder: trocas.filter((item) => item.destinatarioLogin === login && item.status === 'PENDENTE_USUARIO').length,
    gestor: trocas.filter(
      (item) => (item.solicitanteLogin === login || item.destinatarioLogin === login) && item.status === 'PENDENTE_GESTOR',
    ).length,
    historico: trocas.filter(
      (item) => (item.solicitanteLogin === login || item.destinatarioLogin === login) && statusInativo(item.status),
    ).length,
  };
}

export function filtrarTrocasPlantaoPorAba(
  trocas: readonly SolicitacaoTrocaPlantao[],
  login: string,
  aba: AbaTrocas,
): SolicitacaoTrocaPlantao[] {
  switch (aba) {
    case 'minhas':
      return trocas.filter((item) => item.solicitanteLogin === login);
    case 'responder':
      return trocas.filter((item) => item.destinatarioLogin === login && item.status === 'PENDENTE_USUARIO');
    case 'gestor':
      return trocas.filter(
        (item) => (item.solicitanteLogin === login || item.destinatarioLogin === login) && item.status === 'PENDENTE_GESTOR',
      );
    case 'historico':
      return trocas.filter(
        (item) => (item.solicitanteLogin === login || item.destinatarioLogin === login) && statusInativo(item.status),
      );
    default:
      return [];
  }
}

export function mensagemVaziaAbaTrocaPlantao(aba: AbaTrocas): string {
  switch (aba) {
    case 'minhas':
      return 'Você ainda não pediu nenhuma troca de plantão.';
    case 'responder':
      return 'Nenhuma solicitação de plantão esperando sua resposta.';
    case 'gestor':
      return 'Nenhuma troca de plantão aguardando o gestor agora.';
    case 'historico':
      return 'Nenhuma troca de plantão concluída ainda.';
    default:
      return '';
  }
}
