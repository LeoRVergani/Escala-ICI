import { randomUUID } from 'node:crypto';

export const REQUIRED_PROJECT_ID = 'escala-ici-staging';
export const REQUIRED_ENVIRONMENT = 'staging';
const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000;

export class ConfigError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface PushWorkerConfig {
  readonly firebaseProjectId: string;
  readonly pushEnabled: boolean;
  readonly pushEnvironment: string;
  readonly pushActivatedAt: string;
  readonly workerId: string;
  readonly leaseDurationMs: number;
}

/**
 * Lê e valida a configuração do processo. Falha rápido (lança
 * `ConfigError`) em qualquer valor ausente ou fora do esperado — nunca
 * tenta adivinhar ou cair para um padrão de produção.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): PushWorkerConfig {
  const firebaseProjectId = requireString(env, 'FIREBASE_PROJECT_ID');
  if (firebaseProjectId !== REQUIRED_PROJECT_ID) {
    throw new ConfigError(
      'PUSH_WORKER_PROJECT_MISMATCH',
      `FIREBASE_PROJECT_ID deve ser "${REQUIRED_PROJECT_ID}" nesta fase; recebido "${firebaseProjectId}".`,
    );
  }

  const pushEnvironment = requireString(env, 'PUSH_ENVIRONMENT');
  if (pushEnvironment !== REQUIRED_ENVIRONMENT) {
    throw new ConfigError(
      'PUSH_WORKER_ENVIRONMENT_INVALIDO',
      `PUSH_ENVIRONMENT deve ser "${REQUIRED_ENVIRONMENT}" nesta fase; recebido "${pushEnvironment}".`,
    );
  }

  const pushActivatedAt = requireString(env, 'PUSH_ACTIVATED_AT');
  if (Number.isNaN(Date.parse(pushActivatedAt))) {
    throw new ConfigError(
      'PUSH_WORKER_ACTIVATED_AT_INVALIDO',
      `PUSH_ACTIVATED_AT deve ser um timestamp ISO válido; recebido "${pushActivatedAt}".`,
    );
  }

  const pushEnabled = parseBoolean(env.PUSH_ENABLED, false);
  const workerId = env.PUSH_WORKER_ID?.trim() || `push-worker-${randomUUID()}`;
  const leaseDurationMs = parsePositiveInt(env.PUSH_LEASE_DURATION_MS, DEFAULT_LEASE_DURATION_MS);

  return {
    firebaseProjectId,
    pushEnabled,
    pushEnvironment,
    pushActivatedAt,
    workerId,
    leaseDurationMs,
  };
}

function requireString(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim() === '') {
    throw new ConfigError(
      'PUSH_WORKER_CONFIG_AUSENTE',
      `Variável de ambiente obrigatória ausente: ${key}.`,
    );
  }
  return value.trim();
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  const normalizado = value.trim().toLowerCase();
  if (normalizado === 'true') {
    return true;
  }
  if (normalizado === 'false') {
    return false;
  }
  throw new ConfigError('PUSH_WORKER_CONFIG_INVALIDO', `Valor booleano inválido para PUSH_ENABLED: "${value}".`);
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(
      'PUSH_WORKER_CONFIG_INVALIDO',
      `Valor numérico positivo inválido para PUSH_LEASE_DURATION_MS: "${value}".`,
    );
  }
  return parsed;
}
