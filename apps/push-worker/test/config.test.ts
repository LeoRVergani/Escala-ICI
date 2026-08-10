import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';

const baseEnv = {
  FIREBASE_PROJECT_ID: 'escala-ici-staging',
  PUSH_ENVIRONMENT: 'staging',
  PUSH_ACTIVATED_AT: '2026-08-01T00:00:00.000Z',
};

describe('loadConfig', () => {
  it('carrega uma configuração válida com PUSH_ENABLED padrão false', () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.pushEnabled).toBe(false);
    expect(config.firebaseProjectId).toBe('escala-ici-staging');
    expect(config.pushEnvironment).toBe('staging');
    expect(config.workerId).toMatch(/^push-worker-/);
  });

  it('aceita PUSH_ENABLED=true explicitamente', () => {
    const config = loadConfig({ ...baseEnv, PUSH_ENABLED: 'true' });
    expect(config.pushEnabled).toBe(true);
  });

  it('recusa projeto diferente de escala-ici-staging', () => {
    expect(() => loadConfig({ ...baseEnv, FIREBASE_PROJECT_ID: 'escalaici' })).toThrowError(ConfigError);
    try {
      loadConfig({ ...baseEnv, FIREBASE_PROJECT_ID: 'escalaici' });
      throw new Error('deveria ter lançado ConfigError');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ConfigError);
      expect((erro as ConfigError).code).toBe('PUSH_WORKER_PROJECT_MISMATCH');
    }
  });

  it('recusa PUSH_ENVIRONMENT diferente de staging', () => {
    expect(() => loadConfig({ ...baseEnv, PUSH_ENVIRONMENT: 'production' })).toThrowError(ConfigError);
  });

  it('recusa FIREBASE_PROJECT_ID ausente', () => {
    const env = { ...baseEnv };
    delete (env as Record<string, string | undefined>).FIREBASE_PROJECT_ID;
    expect(() => loadConfig(env)).toThrowError(ConfigError);
  });

  it('recusa PUSH_ACTIVATED_AT inválido', () => {
    expect(() => loadConfig({ ...baseEnv, PUSH_ACTIVATED_AT: 'não-é-uma-data' })).toThrowError(ConfigError);
  });

  it('recusa PUSH_ENABLED com valor não booleano', () => {
    expect(() => loadConfig({ ...baseEnv, PUSH_ENABLED: 'sim' })).toThrowError(ConfigError);
  });

  it('usa PUSH_WORKER_ID explícito quando fornecido', () => {
    const config = loadConfig({ ...baseEnv, PUSH_WORKER_ID: 'worker-fixo-1' });
    expect(config.workerId).toBe('worker-fixo-1');
  });
});
