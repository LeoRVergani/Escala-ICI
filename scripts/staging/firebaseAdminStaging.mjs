/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — inicialização do Admin SDK exclusiva
 * para os scripts de `scripts/staging/`. Mesmo idioma de
 * `apps/push-worker/src/firebaseAdmin.ts:lerProjectIdDaCredencial()`: lê
 * SOMENTE o campo `project_id` do arquivo apontado por
 * `GOOGLE_APPLICATION_CREDENTIALS` antes de inicializar — nunca lê nem
 * expõe `private_key`/`private_key_id`/`client_email`. A guarda aqui é mais
 * rígida que a de `scripts/firebase-preflight-lib.mjs` (que aceita qualquer
 * projeto terminado em `-staging`/`-hml`/`-homolog`): estes scripts tocam
 * dado real de staging via Admin SDK (bypassa `firestore.rules`), então só
 * aceitam o projeto literal `escala-ici-staging` — nunca produção, nunca um
 * outro ambiente de homologação por engano.
 *
 * NÃO adicionamos `firebase-admin` como dependência do `package.json` raiz
 * de propósito: `tests/push-worker-boundaries.test.mjs` e
 * `tests/pwa-push-boundaries.test.mjs` fixam que `firebase-admin` é
 * exclusivo do workspace `@escala-ici/push-worker` (nunca vaza para
 * apps/dashboard, apps/app ou a raiz) — fronteira deliberada para manter o
 * pacote fora do bundle dos apps. Este módulo o importa via hoisting do
 * npm workspace (o `npm install` na raiz já materializa
 * `node_modules/firebase-admin` por causa da dependência do push-worker),
 * o mesmo pacote/versão, nunca uma cópia própria.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const PROJETO_STAGING_ESPERADO = 'escala-ici-staging';

/**
 * Não usamos o `projectId` que passamos para `initializeApp()` para validar
 * o projeto — isso compararia um valor com ele mesmo. Ler o arquivo de
 * credencial ANTES de inicializar é a única forma de confirmar, de forma
 * independente, a qual projeto a credencial realmente pertence.
 */
export function lerProjectIdDaCredencial(
  env = process.env,
  ler = (caminho) => readFileSync(caminho, 'utf8'),
) {
  const caminho = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!caminho || caminho.trim() === '') {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS não está definida — aponte para a credencial de service account do staging antes de rodar este script.',
    );
  }

  let conteudo;
  try {
    conteudo = ler(caminho);
  } catch (erro) {
    throw new Error(
      `Não foi possível ler o arquivo de credencial em GOOGLE_APPLICATION_CREDENTIALS: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(conteudo);
  } catch {
    throw new Error('O arquivo de credencial não é um JSON válido.');
  }

  const projectId = json.project_id;
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw new Error('O arquivo de credencial não contém um "project_id" (string) válido.');
  }
  return projectId;
}

/**
 * Aborta se a credencial não pertencer literalmente a
 * `escala-ici-staging` — nunca produção, nunca outro projeto de
 * homologação. Cada script de `scripts/staging/` chama isto ANTES de
 * qualquer leitura/escrita.
 */
export function exigirProjetoStaging(env = process.env) {
  const projectIdDaCredencial = lerProjectIdDaCredencial(env);
  if (projectIdDaCredencial !== PROJETO_STAGING_ESPERADO) {
    throw new Error(
      `A credencial aponta para o projeto "${projectIdDaCredencial}", mas os scripts de scripts/staging/ só operam sobre "${PROJETO_STAGING_ESPERADO}". Abortando sem tocar em nada.`,
    );
  }
  return projectIdDaCredencial;
}

/**
 * `appName` evita colidir com o app "default" quando mais de um script
 * roda no mesmo processo (ex.: testes) — mesmo cuidado de
 * `apps/push-worker/src/firebaseAdmin.ts`.
 */
export function inicializarAdminStaging({ appName = 'escala-ici-staging-script', env = process.env } = {}) {
  exigirProjetoStaging(env);
  const app = getApps().find((candidato) => candidato.name === appName)
    ?? initializeApp({ credential: applicationDefault(), projectId: PROJETO_STAGING_ESPERADO }, appName);
  return { app, db: getFirestore(app) };
}
