import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  pacote,
  firebaseLan,
  launcher,
  ambienteLan,
  politica,
  preflight,
  dashboard,
  app,
  verificador,
] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../firebase.lan.json', import.meta.url), 'utf8'),
  readFile(new URL('../executar-laboratorio-lan-linux.sh', import.meta.url), 'utf8'),
  readFile(new URL('../.env.emulator-lan.example', import.meta.url), 'utf8'),
  readFile(new URL('../lib/firebase/environment.ts', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/firebase-preflight-lib.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../apps/dashboard/package.json', import.meta.url), 'utf8'),
  readFile(new URL('../apps/app/package.json', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-running-lan.mjs', import.meta.url), 'utf8'),
]);

test('Firebase LAN escuta nas interfaces da VM sem alterar o firebase.json local', () => {
  const configuracao = JSON.parse(firebaseLan);
  assert.equal(configuracao.emulators.auth.host, '0.0.0.0');
  assert.equal(configuracao.emulators.firestore.host, '0.0.0.0');
  assert.equal(configuracao.emulators.ui.host, '0.0.0.0');
  assert.match(pacote, /"firebase:lab:lan"/);
});

test('Dashboard e App possuem entradas LAN separadas e vinculadas a 0.0.0.0', () => {
  assert.match(dashboard, /dev:emulator:lan[^\n]*--host 0\.0\.0\.0[^\n]*4173/);
  assert.match(app, /dev:emulator:lan[^\n]*--host 0\.0\.0\.0[^\n]*4174/);
  assert.match(pacote, /dev:dashboard:emulator:lan/);
  assert.match(pacote, /dev:app:emulator:lan/);
});

test('modo LAN exige IPv4 privado exato e mantém produção bloqueada', () => {
  assert.match(politica, /VITE_FIREBASE_LAN_MODE === 'true'/);
  assert.match(politica, /VITE_FIREBASE_ENVIRONMENT === 'local'/);
  assert.match(politica, /hostIpv4Privado\(hostLan\)/);
  assert.match(preflight, /VITE_FIREBASE_LAN_HOST deve ser um IPv4 privado válido/);
  assert.match(ambienteLan, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false/);
  assert.match(ambienteLan, /VITE_FIREBASE_LAN_MODE=true/);
  assert.doesNotMatch(launcher, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=true/);
});

test('launcher Oracle Linux instala pré-requisitos oficiais e abre somente portas do laboratório', () => {
  assert.match(launcher, /dnf module install -y nodejs:22/);
  assert.match(launcher, /java-21-openjdk-headless/);
  assert.match(launcher, /--open-firewall/);
  for (const port of [4000, 4173, 4174, 8080, 9099]) {
    assert.match(launcher, new RegExp(String(port)));
  }
  assert.match(launcher, /check:phase3kc/);
  assert.match(launcher, /verify-running-lan\.mjs/);
});

test('verificador confirma Vite e Firebase pelo mesmo IPv4 da LAN', () => {
  assert.match(verificador, /ESCALA_ICI_LAN_HOST/);
  assert.match(verificador, /VITE_FIREBASE_LAN_MODE/);
  assert.match(verificador, /verifyPort\(9099/);
  assert.match(verificador, /verifyPort\(8080/);
  assert.match(verificador, /verifyPort\(4000/);
});
