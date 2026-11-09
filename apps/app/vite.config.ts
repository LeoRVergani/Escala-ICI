import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const diretorioApp = fileURLToPath(new URL('.', import.meta.url));
const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));

/**
 * VERSAO-APP-1 — versão gravada no build: data/hora (Brasília) + commit curto.
 * No Cloudflare Pages o commit vem de CF_PAGES_COMMIT_SHA; localmente, do Git.
 */
function versaoDoBuild(): { commit: string; data: string } {
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
  return { commit: commit.slice(0, 7) || 'local', data };
}

export default defineConfig({
  root: diretorioApp,
  envDir: raizRepositorio,
  plugins: [react()],
  define: {
    __VERSAO_APP__: JSON.stringify(versaoDoBuild()),
  },
  resolve: {
    alias: {
      '@': raizRepositorio,
    },
  },
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('../../dist/apps/app', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    allowedHosts: ['terminal.local'],
    fs: {
      allow: [raizRepositorio],
    },
  },
});
