import { resolve } from 'node:path';
import { projectRoot } from './runtime-env.mjs';

const expected = [
  '"VITE_FIREBASE_USE_EMULATORS": "true"',
  'demo-escala-ici-fase3i',
];

function firebaseModuleUrl(port) {
  const sourcePath = resolve(projectRoot, 'lib', 'firebase', 'client.ts').replaceAll('\\', '/');
  return `http://127.0.0.1:${port}/@fs/${sourcePath}`;
}

async function verify(port, label) {
  const response = await fetch(firebaseModuleUrl(port), {
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.text();
  if (!response.ok || !expected.every((text) => body.includes(text))) {
    throw new Error(
      `${label} na porta ${port} nao carregou o ambiente Firebase local. ` +
      'O inicializador nao conseguiu preparar o servidor Vite desta versao.',
    );
  }
  console.log(`[OK] ${label} conectado ao ambiente Firebase local.`);
}

try {
  await Promise.all([
    verify(4173, 'Dashboard'),
    verify(4174, 'App'),
  ]);
} catch (error) {
  console.error(`[ERRO] ${error.message}`);
  process.exit(1);
}
