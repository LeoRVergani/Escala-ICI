import { ConfigError, loadConfig } from '../config.js';
import { initAdmin } from '../firebaseAdmin.js';

/**
 * `npm run check` — inicialização "a seco": confere config, credencial e
 * project_id, faz UMA leitura Firestore e UMA chamada FCM com `dryRun`.
 * Nunca envia push de verdade.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  console.info(
    `Config OK — project=${config.firebaseProjectId} environment=${config.pushEnvironment} pushEnabled=${config.pushEnabled}`,
  );

  const { db, messaging } = initAdmin(config);
  console.info('Firebase Admin inicializado — project_id da credencial confirmado contra FIREBASE_PROJECT_ID.');

  await db.collection('notificacoesTroca').limit(1).get();
  console.info('Firestore acessível.');

  await messaging.sendEachForMulticast(
    {
      fids: ['push-worker-check-dry-run'],
      notification: { title: 'check', body: 'check' },
    },
    true,
  );
  console.info('FCM disponível (dryRun=true — nenhuma mensagem real foi enviada).');

  console.info('push-worker --check: OK.');
}

main().catch((erro: unknown) => {
  if (erro instanceof ConfigError) {
    console.error(`${erro.code}: ${erro.message}`);
  } else {
    console.error('check falhou:', erro instanceof Error ? erro.message : String(erro));
  }
  process.exit(1);
});
