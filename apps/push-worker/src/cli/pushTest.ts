import { ConfigError, loadConfig } from '../config.js';
import { listActiveDevices } from '../deviceRepository.js';
import { initAdmin } from '../firebaseAdmin.js';
import { buildMessage, sendToDevices } from '../pushSender.js';
import type { NotificacaoTroca } from '../types.js';

function lerLoginDoArgv(argv: string[]): string {
  const arg = argv.find((valor) => valor.startsWith('--login='));
  if (!arg) {
    throw new Error('Uso: npm run push:test -- --login=<login>');
  }
  const login = arg.slice('--login='.length).trim();
  if (login === '') {
    throw new Error('Uso: npm run push:test -- --login=<login>');
  }
  return login;
}

/**
 * `npm run push:test -- --login=X` — ferramenta manual de diagnóstico.
 * Respeita PUSH_ENABLED (não faz bypass do kill switch: se
 * PUSH_ENABLED=false, informa e não envia nada). Nunca imprime token.
 * Não passa pelo `pushEntregas`/claim — é um envio direto, fora do fluxo
 * de domínio, só para validar a infraestrutura sem fabricar uma Troca.
 */
async function main(): Promise<void> {
  const login = lerLoginDoArgv(process.argv.slice(2));
  const config = loadConfig();

  if (!config.pushEnabled) {
    console.info(
      'PUSH_ENABLED=false — push:test respeita o kill switch e não envia nada. Defina PUSH_ENABLED=true temporariamente para testar de verdade.',
    );
    return;
  }

  const { db, messaging } = initAdmin(config);
  const dispositivos = await listActiveDevices(db, login);

  if (dispositivos.length === 0) {
    console.info(JSON.stringify({ devicesFound: 0, successCount: 0, failureCount: 0 }));
    return;
  }

  const notificacaoDeTeste: NotificacaoTroca = {
    id: `push-test-${Date.now()}`,
    destinatarioLogin: login,
    equipeId: 'push-test',
    tipo: 'TROCA_SOLICITADA',
    titulo: 'Teste Escala ICI',
    mensagem: 'Push staging funcionando.',
    trocaId: 'push-test',
    criadoPorLogin: 'push-worker',
    criadoEm: new Date().toISOString(),
    lidaEm: null,
    acao: 'ABRIR_TROCA',
  };

  const mensagem = buildMessage(notificacaoDeTeste, dispositivos.map((dispositivo) => dispositivo.token));
  const resultado = await sendToDevices(messaging, mensagem);

  console.info(
    JSON.stringify({
      devicesFound: dispositivos.length,
      successCount: resultado.successCount,
      failureCount: resultado.failureCount,
    }),
  );
}

main().catch((erro: unknown) => {
  if (erro instanceof ConfigError) {
    console.error(`${erro.code}: ${erro.message}`);
  } else {
    console.error('push:test falhou:', erro instanceof Error ? erro.message : String(erro));
  }
  process.exit(1);
});
