import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('a Fase 3K-A mantém App e Dashboard como implantações independentes', async () => {
  const [pacote, dockerfile, appVite, dashboardVite] = await Promise.all([
    ler('package.json'),
    ler('deploy/dashboard/Dockerfile'),
    ler('apps/app/vite.config.ts'),
    ler('apps/dashboard/vite.config.ts'),
  ]);

  assert.match(pacote, /"build:app:pages"/);
  assert.match(pacote, /"docker:dashboard:build"/);
  assert.match(appVite, /dist\/apps\/app/);
  assert.match(dashboardVite, /dist\/apps\/dashboard/);
  assert.match(dockerfile, /npm run build:dashboard/);
  assert.doesNotMatch(dockerfile, /npm run build:app/);
  assert.doesNotMatch(dockerfile, /dist\/apps\/app/);
  assert.match(dockerfile, /rm -f[\s\S]*manifest\.webmanifest[\s\S]*service-worker\.js/);
});

test('o Dashboard Docker inicia bloqueado para escrita oficial e com defesa em profundidade', async () => {
  const [dockerfile, compose, nginx, dockerignore] = await Promise.all([
    ler('deploy/dashboard/Dockerfile'),
    ler('deploy/dashboard/compose.yaml'),
    ler('deploy/dashboard/nginx.conf'),
    ler('.dockerignore'),
  ]);

  assert.match(dockerfile, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE="false"/);
  assert.match(dockerfile, /nginxinc\/nginx-unprivileged/);
  assert.match(dockerfile, /USER 101/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:[\s\S]*ALL/);
  assert.match(nginx, /location = \/health/);
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/);
  assert.match(dockerignore, /\.env\.\*/);
  assert.doesNotMatch(`${dockerfile}\n${compose}`, /serviceAccount|private_key|FIREBASE_ADMIN/i);
});

test('o App Pages usa a raiz sem quebrar a rota de compatibilidade', async () => {
  const [manifesto, legado, worker, provider, paginaCompatibilidade, headers, redirects] = await Promise.all([
    ler('public/manifest.webmanifest'),
    ler('public/manifest-app.webmanifest'),
    ler('public/service-worker.js'),
    ler('components/PwaProvider.tsx'),
    ler('app/app/page.tsx'),
    ler('public/_headers'),
    ler('public/_redirects'),
  ]);

  assert.deepEqual(
    Object.fromEntries(['id', 'start_url', 'scope'].map((chave) => [chave, JSON.parse(manifesto)[chave]])),
    { id: '/', start_url: '/', scope: '/' },
  );
  assert.deepEqual(
    Object.fromEntries(['id', 'start_url', 'scope'].map((chave) => [chave, JSON.parse(legado)[chave]])),
    { id: '/app', start_url: '/app', scope: '/app' },
  );
  assert.match(worker, /SCOPE_PATH/);
  assert.match(provider, /window\.location\.pathname === '\/app'/);
  assert.match(provider, /scope: escopo/);
  assert.match(paginaCompatibilidade, /manifest-app\.webmanifest/);
  assert.match(headers, /service-worker\.js[\s\S]*no-cache/);
  assert.match(redirects, /\/\* \/index\.html 200/);
});
