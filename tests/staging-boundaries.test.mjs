import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('o App staging permanece somente leitura e publicável como PWA', async () => {
  const [env, pacote, deploy] = await Promise.all([
    ler('.env.staging.app.example'),
    ler('package.json'),
    ler('scripts/deploy-pages-staging.mjs'),
  ]);

  assert.match(env, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false/);
  assert.match(pacote, /"build:app:staging"/);
  assert.match(pacote, /"pages:deploy:staging"/);
  assert.match(deploy, /dist\/apps\/app/);
  assert.match(deploy, /--branch[\s\S]*staging/);
  assert.match(deploy, /CLOUDFLARE_PAGES_PROJECT/);
});

test('o Dashboard habilita escrita somente após o preflight de staging', async () => {
  const [env, dockerfile, compose] = await Promise.all([
    ler('.env.staging.dashboard.example'),
    ler('deploy/dashboard/Dockerfile'),
    ler('deploy/dashboard/compose.yaml'),
  ]);

  assert.match(env, /VITE_FIREBASE_ENVIRONMENT=staging/);
  assert.match(env, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=true/);
  assert.match(env, /FIREBASE_STAGING_CONFIRMATION=ESCALA_ICI_STAGING_ONLY/);
  assert.match(dockerfile, /--target=staging --require-write/);
  assert.match(compose, /FIREBASE_STAGING_CONFIRMATION/);
  assert.doesNotMatch(`${env}\n${dockerfile}\n${compose}`, /private_key|serviceAccount/i);
});

test('operações externas exigem confirmação explícita', async () => {
  const [firebase, pages] = await Promise.all([
    ler('scripts/firebase-staging.mjs'),
    ler('scripts/deploy-pages-staging.mjs'),
  ]);

  assert.match(firebase, /--confirm=DEPLOY_STAGING/);
  assert.match(firebase, /firestore:rules,firestore:indexes/);
  assert.match(pages, /--confirm=DEPLOY_STAGING/);
  assert.match(pages, /-staging\$/);
});
