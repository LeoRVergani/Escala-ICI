/**
 * VERSAO-APP-1/2 — versão do App gravada no build (vite.config.ts → define).
 * Fora do build (testes), `__VERSAO_APP__` não existe e cai no padrão.
 */
export interface VersaoApp {
  versao: string;
  commit: string;
  data: string;
}

declare const __VERSAO_APP__: VersaoApp | undefined;

export const VERSAO_APP: VersaoApp =
  typeof __VERSAO_APP__ !== 'undefined' && __VERSAO_APP__ ? __VERSAO_APP__ : { versao: 'dev', commit: 'dev', data: '' };

/** "3.0.0" — o número que a pessoa vê e fala ("estou na 3.0.0"). */
export function numeroVersaoApp(versao: VersaoApp = VERSAO_APP): string {
  return versao.data ? versao.versao : 'desenvolvimento';
}

/** "06/11/2026 15:42 · 2b2e032" — detalhe técnico do build. */
export function detalheVersaoApp(versao: VersaoApp = VERSAO_APP): string {
  return versao.data ? `${versao.data} · ${versao.commit}` : '';
}

/** Compatibilidade: "3.0.0 · 06/11/2026 15:42 · 2b2e032". */
export function textoVersaoApp(versao: VersaoApp = VERSAO_APP): string {
  return versao.data ? `${versao.versao} · ${versao.data} · ${versao.commit}` : 'desenvolvimento';
}

/** A versão publicada (/versao.json) é outra que a em execução? (só versão + commit contam). */
export function versaoPublicadaDiferente(emExecucao: Pick<VersaoApp, 'versao' | 'commit'>, publicada: unknown): boolean {
  if (typeof publicada !== 'object' || publicada === null) return false;
  const { versao, commit } = publicada as Partial<VersaoApp>;
  if (typeof versao !== 'string' || typeof commit !== 'string') return false;
  if (emExecucao.commit === 'dev' || emExecucao.commit === 'local') return false;
  return versao !== emExecucao.versao || commit !== emExecucao.commit;
}
