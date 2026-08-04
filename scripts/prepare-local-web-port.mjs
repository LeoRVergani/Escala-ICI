import { spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { projectRoot } from './runtime-env.mjs';

const PORT_READY_TO_START = 10;
const expected = [
  '"VITE_FIREBASE_USE_EMULATORS": "true"',
  'demo-escala-ici-fase3i',
];

const port = Number(process.argv[2]);
const label = process.argv[3] || `Servico ${port}`;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error('[ERRO] Porta local invalida.');
  process.exit(1);
}

function firebaseModuleUrl() {
  const sourcePath = resolve(projectRoot, 'lib', 'firebase', 'client.ts').replaceAll('\\', '/');
  return `http://127.0.0.1:${port}/@fs/${sourcePath}`;
}

async function isExpectedVite() {
  try {
    const response = await fetch(firebaseModuleUrl(), {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return expected.every((text) => body.includes(text));
  } catch {
    return false;
  }
}

function isPortOpen() {
  return new Promise((complete) => {
    const socket = connect({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      complete(open);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function stopStaleWindowsVite() {
  const script = [
    `$connections = @(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue)`,
    'if ($connections.Count -eq 0) { exit 0 }',
    '$ids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)',
    'foreach ($processId in $ids) {',
    '  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue',
    '  if (-not $process -or -not $process.CommandLine) { Write-Error "Nao foi possivel identificar o processo $processId."; exit 3 }',
    `  $isVite = $process.CommandLine -match '(?i)(vite(?:\\.js)?|node_modules[\\\\/]vite)' -and $process.CommandLine -match '(?i)(--port(?:=|\\s+)${port})(?:\\s|$)'`,
    '  if (-not $isVite) { Write-Error "A porta pertence a outro programa: $($process.Name) (PID $processId)."; exit 4 }',
    '}',
    'foreach ($processId in $ids) { Stop-Process -Id $processId -Force -ErrorAction Stop }',
  ].join('\n');

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', shell: false },
  );

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    console.error(`[ERRO] A porta ${port} esta ocupada por um servico que nao pode ser encerrado com seguranca.`);
    if (detail) console.error(detail);
    return false;
  }
  return true;
}

async function waitUntilFree() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!(await isPortOpen())) return true;
    await new Promise((complete) => setTimeout(complete, 200));
  }
  return false;
}

if (await isExpectedVite()) {
  console.log(`[OK] ${label} atual ja esta ativo na porta ${port} e sera reutilizado.`);
  process.exit(0);
}

if (!(await isPortOpen())) {
  process.exit(PORT_READY_TO_START);
}

if (process.platform !== 'win32') {
  console.error(`[ERRO] A porta ${port} esta ocupada por uma instancia incompativel.`);
  process.exit(1);
}

console.log(`[INFO] Foi encontrado um servidor antigo na porta ${port}. Validando antes de reiniciar...`);
if (!stopStaleWindowsVite()) process.exit(1);
if (!(await waitUntilFree())) {
  console.error(`[ERRO] A porta ${port} continuou ocupada apos encerrar o Vite antigo.`);
  process.exit(1);
}

console.log(`[OK] Vite antigo da porta ${port} encerrado. A versao atual sera iniciada.`);
process.exit(PORT_READY_TO_START);
