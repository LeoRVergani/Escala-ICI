/**
 * VERSAO-APP-1 — versão do App gravada no build (vite.config.ts → define).
 * Fora do build (testes), `__VERSAO_APP__` não existe e cai no padrão.
 */
declare const __VERSAO_APP__: { commit: string; data: string } | undefined;

export const VERSAO_APP: { commit: string; data: string } =
  typeof __VERSAO_APP__ !== 'undefined' && __VERSAO_APP__ ? __VERSAO_APP__ : { commit: 'dev', data: '' };

/** "06/11/2026 15:42 · 2b2e032" (ou "desenvolvimento"). */
export function textoVersaoApp(versao = VERSAO_APP): string {
  return versao.data ? `${versao.data} · ${versao.commit}` : 'desenvolvimento';
}
