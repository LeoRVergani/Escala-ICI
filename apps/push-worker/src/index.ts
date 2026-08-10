import { ConfigError, loadConfig } from './config.js';
import { initAdmin } from './firebaseAdmin.js';
import { writeHeartbeat } from './health.js';
import { iniciarWatcher } from './notificationWatcher.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, messaging } = initAdmin(config);

  console.info('push-worker iniciado', {
    environment: config.pushEnvironment,
    project: config.firebaseProjectId,
    pushEnabled: config.pushEnabled,
    workerId: config.workerId,
    pushActivatedAt: config.pushActivatedAt,
  });

  writeHeartbeat();
  const heartbeatIntervalo = setInterval(() => writeHeartbeat(), HEARTBEAT_INTERVAL_MS);

  const unsubscribe = iniciarWatcher({
    db,
    messaging,
    config,
    onErro: (erro) => {
      console.error('erro no watcher de notificacoesTroca', erro instanceof Error ? erro.message : String(erro));
    },
  });

  console.info('listener de notificacoesTroca iniciado — firestore=connected fcm=ready listener=started');

  let encerrando = false;
  const shutdown = (signal: string): void => {
    if (encerrando) {
      return;
    }
    encerrando = true;
    console.info(`recebido ${signal}, encerrando graciosamente`);
    clearInterval(heartbeatIntervalo);
    unsubscribe();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((erro: unknown) => {
  if (erro instanceof ConfigError) {
    console.error(`${erro.code}: ${erro.message}`);
  } else {
    console.error('falha fatal ao iniciar o push-worker:', erro instanceof Error ? erro.message : String(erro));
  }
  process.exit(1);
});
