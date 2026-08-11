import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appOnly = process.argv.includes('--app-only');
const ler = (...partes) => readFile(resolve(raiz, ...partes), 'utf8');

const [
  appHtml,
  manifesto,
  manifestoCompatibilidade,
  serviceWorker,
  swFonte,
  headers,
  redirects,
] = await Promise.all([
  ler('dist/apps/app/index.html'),
  ler('dist/apps/app/manifest.webmanifest'),
  ler('dist/apps/app/manifest-app.webmanifest'),
  ler('dist/apps/app/service-worker.js'),
  // O build de `dist/apps/app/service-worker.js` é minificado
  // (`apps/app/vite.sw.config.ts`) — nomes de identificador como
  // SCOPE_PATH/APP_ENTRY são renomeados pelo minificador, então essas
  // checagens leem a fonte legível; strings literais (ex.:
  // `manifest-app.webmanifest`, `fase-3k-c-v1`) sobrevivem à minificação e
  // continuam sendo checadas no artefato de fato distribuído.
  ler('apps/app/src/sw/serviceWorker.js'),
  ler('dist/apps/app/_headers'),
  ler('dist/apps/app/_redirects'),
]);

// O App tem um único ponto de montagem, com a placa inicial da Fase 3K-D1
// dentro dele — o React limpa o conteúdo de #root ao montar.
assert.match(appHtml, /<div id="root">/);
assert.equal(appHtml.match(/id="root"/g)?.length, 1);
assert.match(appHtml, /id="boot-splash"/);
assert.match(appHtml, /rel="manifest" href="\/manifest\.webmanifest"/);

const pwa = JSON.parse(manifesto);
assert.equal(pwa.id, '/');
assert.equal(pwa.start_url, '/');
assert.equal(pwa.scope, '/');

const pwaCompatibilidade = JSON.parse(manifestoCompatibilidade);
assert.equal(pwaCompatibilidade.id, '/app');
assert.equal(pwaCompatibilidade.start_url, '/app');
assert.equal(pwaCompatibilidade.scope, '/app');

assert.match(swFonte, /SCOPE_PATH/);
assert.match(swFonte, /APP_ENTRY/);
assert.match(serviceWorker, /manifest-app\.webmanifest/);
assert.match(serviceWorker, /fase-3k-c-v1/);
assert.match(serviceWorker, /onBackgroundMessage/);
assert.equal(
  serviceWorker.includes('firebase-messaging-sw'),
  false,
  'o artefato distribuído nunca deve referenciar um segundo service worker',
);
assert.match(headers, /service-worker\.js[\s\S]*no-cache/);
assert.match(headers, /X-Content-Type-Options: nosniff/);
assert.match(redirects, /^\/\* \/index\.html 200\s*$/);

if (!appOnly) {
  const [
    dashboardHtml,
    dockerfile,
    compose,
    nginx,
    dockerignore,
  ] = await Promise.all([
    ler('dist/apps/dashboard/index.html'),
    ler('deploy/dashboard/Dockerfile'),
    ler('deploy/dashboard/compose.yaml'),
    ler('deploy/dashboard/nginx.conf'),
    ler('.dockerignore'),
  ]);

  assert.match(dashboardHtml, /<div id="root"><\/div>/);
  assert.match(dockerfile, /FROM node:22-alpine AS build/);
  assert.match(dockerfile, /npm run build:dashboard/);
  assert.match(dockerfile, /dist\/apps\/dashboard/);
  assert.doesNotMatch(dockerfile, /dist\/apps\/app/);
  assert.match(dockerfile, /dist\/apps\/dashboard\/service-worker\.js/);
  assert.match(dockerfile, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE="false"/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /USER 101/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:[\s\S]*ALL/);
  assert.match(nginx, /location = \/health/);
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/);
  assert.match(nginx, /X-Frame-Options "DENY"/);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^node_modules$/m);
}

console.log(appOnly
  ? 'Cloudflare Pages validado: App independente, SPA e PWA na raiz.'
  : 'Implantações validadas: App para Pages e Dashboard isolado em Docker.');
