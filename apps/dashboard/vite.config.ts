import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

import { versaoDoBuildDashboard } from './versaoBuild';

const diretorioApp = fileURLToPath(new URL('.', import.meta.url));
const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));
const versao = versaoDoBuildDashboard();

/** VERSAO-DASHBOARD-1 — publica /versao.json: depois do deploy, `curl .../versao.json` mostra o que está rodando. */
function publicarVersao(): Plugin {
  return {
    name: 'escala-ici-dashboard-versao-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'versao.json', source: `${JSON.stringify(versao)}\n` });
    },
  };
}

export default defineConfig({
  root: diretorioApp,
  envDir: raizRepositorio,
  plugins: [react(), publicarVersao()],
  define: {
    __VERSAO_DASHBOARD__: JSON.stringify(versao),
  },
  resolve: {
    alias: {
      '@': raizRepositorio,
    },
  },
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('../../dist/apps/dashboard', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['terminal.local'],
    fs: {
      allow: [raizRepositorio],
    },
  },
});
