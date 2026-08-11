import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const diretorioApp = fileURLToPath(new URL('.', import.meta.url));
const raizRepositorio = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Build separado, só para o service worker (Fase PUSH-PWA-1.1) — roda
 * DEPOIS de `vite.config.ts` (que já copiou `public/service-worker.js`
 * genérico via `publicDir`) e sobrescreve só esse arquivo em
 * `dist/apps/app/service-worker.js` com a versão que integra
 * `firebase/messaging/sw` (ver `src/sw/serviceWorker.js`). `emptyOutDir:
 * false` — nunca apaga o resto do build principal; `publicDir: false` —
 * não recopia `public/` de novo.
 *
 * Motivo de existir um build separado: `public/service-worker.js`
 * (raiz do repo) também é servido, sem alteração, pela Sites Worker/Next
 * (`worker/index.ts`) — este config nunca toca nesse arquivo, só produz
 * a versão FCM-aware para o deployment do Cloudflare Pages de
 * `apps/app` (`dist/apps/app`), destino real documentado em
 * `docs/operacao/PUSH-FCM-OPERACAO.md`.
 */
export default defineConfig({
  root: diretorioApp,
  envDir: raizRepositorio,
  publicDir: false,
  resolve: {
    alias: {
      '@': raizRepositorio,
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist/apps/app', import.meta.url)),
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/sw/serviceWorker.js', import.meta.url)),
      name: 'EscalaIciServiceWorker',
      formats: ['iife'],
      fileName: () => 'service-worker.js',
    },
  },
});
