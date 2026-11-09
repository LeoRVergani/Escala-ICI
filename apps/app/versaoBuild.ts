import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/**
 * VERSAO-APP-2 — versão do build, usada pelo App e pelo service worker.
 *  - versao: número da versão (apps/app/package.json → "version", ex.: 3.0.0)
 *  - commit: commit curto (Cloudflare: CF_PAGES_COMMIT_SHA; local: git)
 *  - data: data/hora do build (Brasília)
 */
export interface VersaoBuild {
  versao: string;
  commit: string;
  data: string;
}

const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));

export function versaoDoBuild(): VersaoBuild {
  const pacote = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };
  let commit = process.env.CF_PAGES_COMMIT_SHA ?? '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse HEAD', { cwd: raizRepositorio, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      commit = '';
    }
  }
  const data = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');
  return { versao: pacote.version ?? '0.0.0', commit: commit.slice(0, 7) || 'local', data };
}
