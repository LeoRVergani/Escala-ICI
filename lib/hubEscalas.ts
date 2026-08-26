import type { OperacaoDashboard } from './operacoesDashboard';

/**
 * Fase DASH-SIMPLES-1B — "Escalas" vira o HUB único de trabalho com
 * escalas (`docs/spec/HUB_ESCALAS.md`). Este módulo é puro (sem
 * React/Firebase): recebe a MESMA lista já resolvida por
 * `resolverOperacoesDashboard()` (`lib/operacoesDashboard.ts`) — nunca uma
 * segunda fonte, nunca uma segunda regra de autorização — e só decide como
 * agrupar/rotular essa lista para o índice do Hub.
 *
 * Regra permanente: `consulta: true` (Acompanhamento) e `consulta: false`
 * (Minhas escalas) nunca se misturam, e uma operação de Acompanhamento
 * nunca ganha um rótulo de ação administrativa (Abrir/Editar/Publicar) —
 * sempre "Visualizar".
 */
export interface OperacoesAgrupadasHub {
  /** Operações que o usuário administra de fato — pode editar/publicar. */
  minhasEscalas: OperacaoDashboard[];
  /** Operações que o usuário só consulta — nunca editar/publicar/importar. */
  acompanhamento: OperacaoDashboard[];
}

export function agruparOperacoesParaHub(operacoes: readonly OperacaoDashboard[]): OperacoesAgrupadasHub {
  return {
    minhasEscalas: operacoes.filter((operacao) => !operacao.consulta),
    acompanhamento: operacoes.filter((operacao) => operacao.consulta),
  };
}

/**
 * Rótulo humano da ação de abrir uma operação a partir do Hub — nunca
 * "Editar"/"Publicar"/"Importar" para uma operação só-consultável (§ 4 de
 * `docs/spec/HUB_ESCALAS.md`).
 */
export function rotuloAcaoOperacaoHub(operacao: OperacaoDashboard): string {
  return operacao.consulta ? 'Visualizar' : 'Abrir escala';
}

/** `true` quando o usuário tem pelo menos uma operação administrável (Jornada ou Plantão) — único gate válido para CTAs de criação/importação. */
export function possuiOperacaoAdministravelHub(operacoes: readonly OperacaoDashboard[]): boolean {
  return operacoes.some((operacao) => !operacao.consulta);
}
