import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const diretorioApp = fileURLToPath(new URL('.', import.meta.url));
const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: diretorioApp,
  envDir: raizRepositorio,
  plugins: [react()],
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
