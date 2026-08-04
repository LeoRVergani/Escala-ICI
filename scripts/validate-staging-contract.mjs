import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { avaliarConfiguracaoFirebase } from './firebase-preflight-lib.mjs';

const ler = (arquivo) => readFile(arquivo, 'utf8');
const [app, dashboard, dockerfile, pages, firebase] = await Promise.all([
  ler('.env.staging.app.example'),
  ler('.env.staging.dashboard.example'),
  ler('deploy/dashboard/Dockerfile'),
  ler('scripts/deploy-pages-staging.mjs'),
  ler('scripts/firebase-staging.mjs'),
]);

assert.match(app, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false/);
assert.match(dashboard, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=true/);
assert.match(app, /FIREBASE_STAGING_CONFIRMATION=ESCALA_ICI_STAGING_ONLY/);
assert.match(dashboard, /FIREBASE_STAGING_CONFIRMATION=ESCALA_ICI_STAGING_ONLY/);
assert.doesNotMatch(`${app}\n${dashboard}`, /private_key|serviceAccount|AIza[0-9A-Za-z_-]{35}/i);
assert.match(dockerfile, /--target=staging --require-write/);
assert.match(pages, /--confirm=DEPLOY_STAGING/);
assert.match(firebase, /--confirm=DEPLOY_STAGING/);

const fake = {
  VITE_FIREBASE_API_KEY: `AIza${'A'.repeat(35)}`,
  VITE_FIREBASE_AUTH_DOMAIN: 'escala-ici-staging.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'escala-ici-staging',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef123456',
  VITE_FIREBASE_ENVIRONMENT: 'staging',
  VITE_FIREBASE_USE_EMULATORS: 'false',
  VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
  FIREBASE_STAGING_CONFIRMATION: 'ESCALA_ICI_STAGING_ONLY',
};

assert.equal(avaliar(fake), true);
assert.equal(avaliar({
  ...fake,
  VITE_FIREBASE_PROJECT_ID: 'escala-ici-producao',
  VITE_FIREBASE_AUTH_DOMAIN: 'escala-ici-producao.firebaseapp.com',
}), false);

function avaliar(ambiente) {
  return avaliarConfiguracaoFirebase(ambiente, {
    alvo: 'staging',
    exigirEscrita: true,
  }).valido;
}

console.log('Contrato 3K-B validado: staging explícito e produção bloqueada.');
