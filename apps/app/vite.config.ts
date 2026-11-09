import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

import { versaoDoBuild } from './versaoBuild';

const diretorioApp = fileURLToPath(new URL('.', import.meta.url));
const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));
const versao = versaoDoBuild();

/** VERSAO-APP-2 — publica /versao.json: o App compara com a versão em execução. */
function publicarVersao(): Plugin {
  return {
    name: 'escala-ici-versao-json',
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
    __VERSAO_APP__: JSON.stringify(versao),
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
