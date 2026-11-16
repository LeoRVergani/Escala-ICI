/**
 * VERSAO-DASHBOARD-1 — versão do Dashboard gravada no build (vite.config.ts → define).
 * Fora do build (testes), `__VERSAO_DASHBOARD__` não existe e cai no padrão.
 */
export interface VersaoDashboard {
  versao: string;
  commit: string;
  data: string;
}

declare const __VERSAO_DASHBOARD__: VersaoDashboard | undefined;

export const VERSAO_DASHBOARD: VersaoDashboard =
  typeof __VERSAO_DASHBOARD__ !== 'undefined' && __VERSAO_DASHBOARD__ ? __VERSAO_DASHBOARD__ : { versao: 'dev', commit: 'dev', data: '' };

/** "1.5.0" — o número que a pessoa vê e fala; fora do build, "desenvolvimento". */
export function numeroVersaoDashboard(versao: VersaoDashboard = VERSAO_DASHBOARD): string {
  return versao.data ? versao.versao : 'desenvolvimento';
}

/** "17/11/2026 09:42 · 6112654" — detalhe técnico do build (para o title do rodapé). */
export function detalheVersaoDashboard(versao: VersaoDashboard = VERSAO_DASHBOARD): string {
  return versao.data ? `${versao.data}${versao.commit === 'local' ? '' : ` · ${versao.commit}`}` : '';
}
