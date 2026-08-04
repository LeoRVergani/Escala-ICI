import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const modo = process.argv[2];
const projectId = 'demo-escala-ici-fase3i';
const runtime = resolve('.firebase-runtime');
mkdirSync(runtime, { recursive: true });

const comandos = {
  start: ['emulators:start', '--only', 'auth,firestore', '--project', projectId],
  'start-lan': [
    'emulators:start', '--only', 'auth,firestore', '--project', projectId,
    '--config', 'firebase.lan.json',
  ],
  integration: [
    'emulators:exec', '--only', 'auth,firestore', '--project', projectId,
    'vitest run --config vitest.firebase.config.ts',
  ],
  rules: [
    'emulators:exec', '--only', 'firestore', '--project', projectId,
    'vitest run --config vitest.firebase.config.ts tests/firebase/firestore.rules.test.ts',
  ],
  'verify-seed': [
    'emulators:exec', '--only', 'auth,firestore', '--project', projectId,
    'node scripts/seed-firebase-lab.mjs && node scripts/verify-firebase-lab.mjs',
  ],
  'live-smoke': [
    'emulators:exec', '--only', 'auth,firestore', '--project', projectId,
    'node scripts/live-lab-smoke.mjs',
  ],
};

const argumentos = comandos[modo];
if (argumentos === undefined) {
  console.error(
    'Uso: node scripts/firebase-cli.mjs start|start-lan|integration|rules|verify-seed|live-smoke',
  );
  process.exit(64);
}

const firebaseCli = resolve(
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);

if (!existsSync(firebaseCli)) {
  console.error('Firebase CLI local não encontrado. Execute npm ci e tente novamente.');
  process.exit(1);
}

const ambiente = {
  ...process.env,
  FIREBASE_CLI_PREVIEWS: '',
};

if (process.platform !== 'win32') {
  ambiente.HOME = resolve(runtime, 'home');
  ambiente.XDG_CONFIG_HOME = resolve(runtime, 'config');
  ambiente.TMPDIR = resolve(runtime, 'tmp');
  mkdirSync(ambiente.HOME, { recursive: true });
  mkdirSync(ambiente.XDG_CONFIG_HOME, { recursive: true });
  mkdirSync(ambiente.TMPDIR, { recursive: true });
}

const resultado = spawnSync(process.execPath, [firebaseCli, ...argumentos], {
  cwd: process.cwd(),
  env: ambiente,
  stdio: 'inherit',
  shell: false,
});

if (resultado.error) {
  console.error(`Não foi possível executar Firebase CLI: ${resultado.error.message}`);
  process.exit(1);
}

if (resultado.status !== 0) {
  const detalhe = resultado.signal === null
    ? `código ${resultado.status ?? 'desconhecido'}`
    : `sinal ${resultado.signal}`;
  console.error(`Firebase CLI terminou com ${detalhe}.`);
  process.exit(resultado.status ?? 1);
}
