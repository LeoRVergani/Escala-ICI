import { connect } from 'node:net';
import { resolve } from 'node:path';
import { projectRoot } from './runtime-env.mjs';

const host = process.env.ESCALA_ICI_LAN_HOST?.trim() ?? '';
if (host === '') {
  console.error('[ERRO] ESCALA_ICI_LAN_HOST não foi informado.');
  process.exit(1);
}

const expected = [
  '"VITE_FIREBASE_USE_EMULATORS": "true"',
  '"VITE_FIREBASE_LAN_MODE": "true"',
  `http://${host}:9099`,
  host,
  'demo-escala-ici-fase3i',
];

function firebaseModuleUrl(port) {
  const sourcePath = resolve(projectRoot, 'lib', 'firebase', 'client.ts').replaceAll('\\', '/');
  return `http://127.0.0.1:${port}/@fs/${sourcePath}`;
}

async function verifyVite(port, label) {
  const response = await fetch(firebaseModuleUrl(port), {
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.text();
  if (!response.ok || !expected.every((item) => body.includes(item))) {
    throw new Error(`${label} não carregou o ambiente LAN autorizado.`);
  }
  console.log(`[OK] ${label} conectado ao Firebase LAN em ${host}.`);
}

function verifyPort(port, label) {
  return new Promise((complete, reject) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${label} não respondeu em ${host}:${port}.`));
    }, 5_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      console.log(`[OK] ${label} acessível pela interface LAN ${host}:${port}.`);
      complete();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`${label} falhou em ${host}:${port}: ${error.message}`));
    });
  });
}

try {
  await Promise.all([
    verifyVite(4173, 'Dashboard'),
    verifyVite(4174, 'App'),
    verifyPort(9099, 'Firebase Authentication'),
    verifyPort(8080, 'Cloud Firestore'),
    verifyPort(4000, 'Firebase Emulator UI'),
  ]);
  console.log('Laboratório LAN validado: serviços e ambiente Vite usam o mesmo IPv4 privado.');
} catch (error) {
  console.error(`[ERRO] ${error.message}`);
  process.exit(1);
}
