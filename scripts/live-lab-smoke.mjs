import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { projectRoot } from './runtime-env.mjs';

const vite = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const seed = resolve(projectRoot, 'scripts', 'seed-firebase-lab.mjs');

for (const entry of [vite, seed]) {
  if (!existsSync(entry)) {
    console.error(`Arquivo necessário não encontrado: ${entry}`);
    process.exit(69);
  }
}

function startVite(appDirectory, port) {
  return spawn(
    process.execPath,
    [vite, '--config', 'vite.config.ts', '--mode', 'emulator', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: resolve(projectRoot, 'apps', appDirectory),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    },
  );
}

async function waitForPage(url, expectedText, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      const body = await response.text();
      const expectedTexts = Array.isArray(expectedText) ? expectedText : [expectedText];
      if (expectedText === null || (response.ok && expectedTexts.every((text) => body.includes(text)))) {
        return;
      }
      lastError = new Error(`${url} respondeu HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Tempo esgotado aguardando ${url}: ${lastError?.message ?? 'sem resposta'}`);
}

function firebaseModuleUrl(port) {
  const sourcePath = resolve(projectRoot, 'lib', 'firebase', 'client.ts').replaceAll('\\', '/');
  return `http://127.0.0.1:${port}/@fs/${sourcePath}`;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    delay(3_000).then(() => child.kill('SIGKILL')),
  ]);
}

const seedResult = spawnSync(process.execPath, [seed], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});
if (seedResult.error || seedResult.status !== 0) {
  console.error(seedResult.error?.message ?? 'Falha ao carregar o seed local.');
  process.exit(seedResult.status ?? 1);
}

const dashboard = startVite('dashboard', 4173);
const app = startVite('app', 4174);

try {
  await Promise.all([
    waitForPage('http://127.0.0.1:8080/', null),
    waitForPage('http://127.0.0.1:4173/', 'Dashboard · Escala ICI'),
    waitForPage('http://127.0.0.1:4174/', 'Minha Escala · Escala ICI'),
    waitForPage(firebaseModuleUrl(4173), [
      '"VITE_FIREBASE_USE_EMULATORS": "true"',
      'demo-escala-ici-fase3i',
    ]),
    waitForPage(firebaseModuleUrl(4174), [
      '"VITE_FIREBASE_USE_EMULATORS": "true"',
      'demo-escala-ici-fase3i',
    ]),
  ]);
  console.log('Laboratório vivo validado: Firebase, Dashboard e App responderam juntos com login local habilitado.');
} catch (error) {
  console.error(error.message);
  for (const [label, child] of [['Dashboard', dashboard], ['App', app]]) {
    const output = `${child.stdout.read() ?? ''}${child.stderr.read() ?? ''}`.trim();
    if (output) console.error(`${label}:\n${output}`);
  }
  process.exitCode = 1;
} finally {
  await Promise.all([stop(dashboard), stop(app)]);
}
