import { deleteApp, getApps } from 'firebase-admin/app';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { initAdmin, lerProjectIdDaCredencial } from '../src/firebaseAdmin.js';

const baseEnv = {
  FIREBASE_PROJECT_ID: 'escala-ici-staging',
  PUSH_ENVIRONMENT: 'staging',
  PUSH_ACTIVATED_AT: '2026-08-01T00:00:00.000Z',
};

afterEach(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

function esperarConfigErrorCom(fn: () => unknown, code: string): void {
  expect.assertions(2);
  try {
    fn();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ConfigError);
    expect((erro as ConfigError).code).toBe(code);
    return;
  }
  throw new Error('esperava que a função lançasse ConfigError');
}

describe('lerProjectIdDaCredencial', () => {
  it('falha com PUSH_WORKER_CREDENCIAL_AUSENTE quando GOOGLE_APPLICATION_CREDENTIALS não está definida', () => {
    esperarConfigErrorCom(() => lerProjectIdDaCredencial({}), 'PUSH_WORKER_CREDENCIAL_AUSENTE');
  });

  it('falha com PUSH_WORKER_CREDENCIAL_AUSENTE quando o arquivo não pode ser lido', () => {
    const ler = () => {
      throw new Error('ENOENT');
    };
    esperarConfigErrorCom(
      () => lerProjectIdDaCredencial({ GOOGLE_APPLICATION_CREDENTIALS: '/inexistente.json' }, ler),
      'PUSH_WORKER_CREDENCIAL_AUSENTE',
    );
  });

  it('falha com PUSH_WORKER_CREDENCIAL_INVALIDA quando o conteúdo não é JSON válido', () => {
    const ler = () => 'não é json';
    esperarConfigErrorCom(
      () => lerProjectIdDaCredencial({ GOOGLE_APPLICATION_CREDENTIALS: '/qualquer.json' }, ler),
      'PUSH_WORKER_CREDENCIAL_INVALIDA',
    );
  });

  it('falha com PUSH_WORKER_CREDENCIAL_INVALIDA quando falta project_id', () => {
    const ler = () => JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com' });
    esperarConfigErrorCom(
      () => lerProjectIdDaCredencial({ GOOGLE_APPLICATION_CREDENTIALS: '/qualquer.json' }, ler),
      'PUSH_WORKER_CREDENCIAL_INVALIDA',
    );
  });

  it('retorna o project_id quando o arquivo é válido', () => {
    const ler = () => JSON.stringify({ project_id: 'escala-ici-staging', private_key: 'não deve importar' });
    const projectId = lerProjectIdDaCredencial({ GOOGLE_APPLICATION_CREDENTIALS: '/qualquer.json' }, ler);
    expect(projectId).toBe('escala-ici-staging');
  });
});

describe('initAdmin', () => {
  it('recusa iniciar quando o project_id da credencial não corresponde a FIREBASE_PROJECT_ID', () => {
    const config = loadConfig({ ...baseEnv });
    const ler = () => JSON.stringify({ project_id: 'escalaici' });
    esperarConfigErrorCom(
      () => initAdmin(config, { GOOGLE_APPLICATION_CREDENTIALS: '/qualquer.json' }, ler),
      'PUSH_WORKER_PROJECT_MISMATCH',
    );
  });

  it('recusa iniciar quando GOOGLE_APPLICATION_CREDENTIALS está ausente', () => {
    const config = loadConfig({ ...baseEnv });
    esperarConfigErrorCom(() => initAdmin(config, {}), 'PUSH_WORKER_CREDENCIAL_AUSENTE');
  });

  it('inicializa com sucesso quando o project_id da credencial corresponde (sem tocar rede)', () => {
    const config = loadConfig({ ...baseEnv });
    const ler = () => JSON.stringify({ project_id: 'escala-ici-staging' });
    const { app } = initAdmin(config, { GOOGLE_APPLICATION_CREDENTIALS: '/qualquer.json' }, ler);
    expect(app.options.projectId).toBe('escala-ici-staging');
  });
});
