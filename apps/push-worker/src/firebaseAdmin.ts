import { readFileSync } from 'node:fs';
import { applicationDefault, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { ConfigError } from './config.js';
import type { PushWorkerConfig } from './config.js';

export interface AdminServices {
  app: App;
  db: Firestore;
  messaging: Messaging;
}

type LeitorDeArquivo = (caminho: string) => string;

/**
 * Lê SOMENTE o campo `project_id` do arquivo apontado por
 * GOOGLE_APPLICATION_CREDENTIALS. Nunca lê nem expõe `private_key`,
 * `private_key_id` ou `client_email` — a comparação de projeto precisa
 * acontecer sem que o restante da credencial passe perto de logs.
 *
 * Não usamos `app.options.projectId` para essa checagem porque esse valor
 * é exatamente o que *nós* passamos para `initializeApp()` — comparar um
 * valor com ele mesmo não verificaria nada. Ler o arquivo antes de
 * inicializar o Admin SDK é a única forma de confirmar de forma
 * independente que a credencial realmente pertence ao projeto esperado.
 */
export function lerProjectIdDaCredencial(
  env: NodeJS.ProcessEnv = process.env,
  ler: LeitorDeArquivo = (caminho) => readFileSync(caminho, 'utf8'),
): string {
  const caminho = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!caminho || caminho.trim() === '') {
    throw new ConfigError(
      'PUSH_WORKER_CREDENCIAL_AUSENTE',
      'GOOGLE_APPLICATION_CREDENTIALS não está definida — nenhuma credencial de service account foi apontada.',
    );
  }

  let conteudo: string;
  try {
    conteudo = ler(caminho);
  } catch (erro) {
    throw new ConfigError(
      'PUSH_WORKER_CREDENCIAL_AUSENTE',
      `Não foi possível ler o arquivo de credencial em GOOGLE_APPLICATION_CREDENTIALS: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(conteudo);
  } catch {
    throw new ConfigError('PUSH_WORKER_CREDENCIAL_INVALIDA', 'O arquivo de credencial não é um JSON válido.');
  }

  const projectId = (json as { project_id?: unknown }).project_id;
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw new ConfigError(
      'PUSH_WORKER_CREDENCIAL_INVALIDA',
      'O arquivo de credencial não contém um "project_id" (string) válido.',
    );
  }
  return projectId;
}

/**
 * Inicializa o Admin SDK só depois de confirmar, de forma independente,
 * que a credencial pertence a `config.firebaseProjectId` (sempre
 * `escala-ici-staging` nesta fase). Usa um nome de app derivado de
 * `workerId` para nunca colidir com o app "default" de outra instância no
 * mesmo processo (relevante em testes e no CLI de checagem).
 */
export function initAdmin(
  config: PushWorkerConfig,
  env: NodeJS.ProcessEnv = process.env,
  ler?: LeitorDeArquivo,
): AdminServices {
  const projectIdDaCredencial = ler ? lerProjectIdDaCredencial(env, ler) : lerProjectIdDaCredencial(env);
  if (projectIdDaCredencial !== config.firebaseProjectId) {
    throw new ConfigError(
      'PUSH_WORKER_PROJECT_MISMATCH',
      `O project_id da credencial ("${projectIdDaCredencial}") não corresponde a FIREBASE_PROJECT_ID ("${config.firebaseProjectId}").`,
    );
  }

  const app = initializeApp(
    {
      credential: applicationDefault(),
      projectId: config.firebaseProjectId,
    },
    config.workerId,
  );

  return {
    app,
    db: getFirestore(app),
    messaging: getMessaging(app),
  };
}
