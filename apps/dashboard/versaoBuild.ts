import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/**
 * VERSAO-DASHBOARD-1 — versão do build do Dashboard (mesmo desenho do App).
 *  - versao: apps/dashboard/package.json → "version" (ex.: 1.5.0)
 *  - commit: GIT_COMMIT (se informado no build), senão o git local; dentro do Docker, sem git, fica 'local'
 *  - data: data/hora do build (Brasília)
 */
export interface VersaoBuildDashboard {
  versao: string;
  commit: string;
  data: string;
}

const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));

export function versaoDoBuildDashboard(): VersaoBuildDashboard {
  const pacote = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };
  let commit = process.env.GIT_COMMIT ?? '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse HEAD', { cwd: raizRepositorio, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      commit = '';
    }
  }
  const data = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', '');
  return { versao: pacote.version ?? '0.0.0', commit: commit.slice(0, 7) || 'local', data };
}
