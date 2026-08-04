import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avaliarConfiguracaoFirebase,
  resumoSeguroFirebase,
} from '../scripts/firebase-preflight-lib.mjs';

const configuracaoValida = {
  VITE_FIREBASE_API_KEY: `AIza${'A'.repeat(35)}`,
  VITE_FIREBASE_AUTH_DOMAIN: 'escala-ici-teste.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'escala-ici-teste',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef123456',
  VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'false',
  VITE_FIREBASE_USE_EMULATORS: 'false',
};

const configuracaoStaging = {
  ...configuracaoValida,
  VITE_FIREBASE_AUTH_DOMAIN: 'escala-ici-staging.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'escala-ici-staging',
  VITE_FIREBASE_ENVIRONMENT: 'staging',
  FIREBASE_STAGING_CONFIRMATION: 'ESCALA_ICI_STAGING_ONLY',
};

test('aprova Firebase real em modo somente leitura', () => {
  const resultado = avaliarConfiguracaoFirebase(configuracaoValida);

  assert.equal(resultado.valido, true);
  assert.equal(resultado.modo, 'firebase-somente-leitura');
  assert.equal(resultado.escritaOficial, false);
  assert.deepEqual(resultado.erros, []);
});

test('reprova configuração incompleta com nomes das variáveis ausentes', () => {
  const resultado = avaliarConfiguracaoFirebase({});

  assert.equal(resultado.valido, false);
  assert.equal(resultado.modo, 'nao-configurado');
  assert.match(resultado.erros.join(' '), /VITE_FIREBASE_API_KEY/);
  assert.match(resultado.erros.join(' '), /VITE_FIREBASE_APP_ID/);
});

test('reprova API key e App ID com formatos inválidos', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_FIREBASE_API_KEY: 'segredo-invalido',
    VITE_FIREBASE_APP_ID: 'app-mobile',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join(' '), /API_KEY/);
  assert.match(resultado.erros.join(' '), /APP_ID/);
});

test('reprova projeto divergente do domínio firebaseapp.com', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_FIREBASE_AUTH_DOMAIN: 'outro-projeto.firebaseapp.com',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join(' '), /projetos diferentes/);
});

test('aceita domínio personalizado com aviso explícito', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_FIREBASE_AUTH_DOMAIN: 'login.escala.ici.br',
  });

  assert.equal(resultado.valido, true);
  assert.match(resultado.avisos.join(' '), /Domínio personalizado/);
});

test('bloqueia escrita oficial no checkpoint seguro', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
  });

  assert.equal(resultado.valido, false);
  assert.equal(resultado.modo, 'firebase-com-escrita');
  assert.match(resultado.erros.join(' '), /escrita oficial está habilitada/i);
});

test('aceita emuladores localhost e reprova destino remoto não autorizado', () => {
  const local = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: 'localhost',
    VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: '8080',
  });
  const remoto = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'https://firebase.exemplo.com',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: 'firebase.exemplo.com',
  });

  assert.equal(local.valido, true);
  assert.equal(local.modo, 'emulador-local');
  assert.equal(remoto.valido, false);
  assert.match(remoto.erros.join(' '), /IPv4 privado autorizado/);
});

test('aceita laboratório LAN somente em IPv4 privado exato', () => {
  const lan = avaliarConfiguracaoFirebase({
    ...configuracaoValida,
    VITE_FIREBASE_ENVIRONMENT: 'local',
    VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_LAN_MODE: 'true',
    VITE_FIREBASE_LAN_HOST: '172.31.6.111',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://172.31.6.111:9099',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '172.31.6.111',
    VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: '8080',
  });

  assert.equal(lan.valido, true);
  assert.equal(lan.modo, 'emulador-lan');
  assert.equal(lan.emuladoresLan, true);
});

test('reprova laboratório LAN público, divergente ou sem ambiente local', () => {
  const base = {
    ...configuracaoValida,
    VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_LAN_MODE: 'true',
  };
  const publico = avaliarConfiguracaoFirebase({
    ...base,
    VITE_FIREBASE_ENVIRONMENT: 'local',
    VITE_FIREBASE_LAN_HOST: '8.8.8.8',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://8.8.8.8:9099',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '8.8.8.8',
  });
  const divergente = avaliarConfiguracaoFirebase({
    ...base,
    VITE_FIREBASE_ENVIRONMENT: 'local',
    VITE_FIREBASE_LAN_HOST: '172.31.6.111',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://172.31.6.112:9099',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '172.31.6.112',
  });
  const producao = avaliarConfiguracaoFirebase({
    ...base,
    VITE_FIREBASE_ENVIRONMENT: 'producao',
    VITE_FIREBASE_LAN_HOST: '172.31.6.111',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://172.31.6.111:9099',
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '172.31.6.111',
  });

  assert.equal(publico.valido, false);
  assert.match(publico.erros.join(' '), /IPv4 privado/);
  assert.equal(divergente.valido, false);
  assert.match(divergente.erros.join(' '), /autorizado/);
  assert.equal(producao.valido, false);
  assert.match(producao.erros.join(' '), /ENVIRONMENT=local/);
});

test('o resumo seguro nunca expõe a API key', () => {
  const resultado = avaliarConfiguracaoFirebase(configuracaoValida);
  const serializado = JSON.stringify(resumoSeguroFirebase(resultado));

  assert.doesNotMatch(serializado, /AIza/);
  assert.doesNotMatch(serializado, /123456789:web/);
  assert.doesNotMatch(serializado, /ESCALA_ICI_STAGING_ONLY/);
});

test('aprova App staging em modo somente leitura', () => {
  const resultado = avaliarConfiguracaoFirebase(configuracaoStaging, {
    alvo: 'staging',
  });

  assert.equal(resultado.valido, true);
  assert.equal(resultado.modo, 'firebase-staging-somente-leitura');
  assert.equal(resultado.projetoStaging, true);
});

test('aprova escrita do Dashboard somente no staging confirmado', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoStaging,
    VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
  }, { alvo: 'staging', exigirEscrita: true });

  assert.equal(resultado.valido, true);
  assert.equal(resultado.modo, 'firebase-staging-com-escrita');
});

test('bloqueia escrita em projeto sem nome de homologação', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoStaging,
    VITE_FIREBASE_PROJECT_ID: 'escala-ici-producao',
    VITE_FIREBASE_AUTH_DOMAIN: 'escala-ici-producao.firebaseapp.com',
    VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
  }, { alvo: 'staging', exigirEscrita: true });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join(' '), /terminar em -staging/);
});

test('bloqueia staging sem confirmação operacional', () => {
  const resultado = avaliarConfiguracaoFirebase({
    ...configuracaoStaging,
    FIREBASE_STAGING_CONFIRMATION: '',
  }, { alvo: 'staging' });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join(' '), /STAGING_CONFIRMATION/);
});
