import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  pacote,
  seed,
  windows,
  linux,
  ambiente,
  firebaseCli,
  localTool,
  buildVerified,
  dashboardVite,
  appVite,
  liveSmoke,
  runningLab,
  prepareWebPort,
] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/seed-firebase-lab.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../executar-laboratorio-windows.bat', import.meta.url), 'utf8'),
  readFile(new URL('../executar-laboratorio-linux.sh', import.meta.url), 'utf8'),
  readFile(new URL('../.env.emulator', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/firebase-cli.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/run-local-tool.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/build-verified.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../apps/dashboard/vite.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../apps/app/vite.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/live-lab-smoke.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-running-lab.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/prepare-local-web-port.mjs', import.meta.url), 'utf8'),
]);

test('seed local usa Node diretamente e nao carrega Vinext/Vite', () => {
  assert.match(pacote, /"firebase:lab:seed": "node scripts\/seed-firebase-lab\.mjs"/);
  assert.doesNotMatch(pacote, /firebase:lab:seed[^\n]*vite-node/);
  assert.doesNotMatch(seed, /vinext|vite-node|@escala-ici\/contrato/);
});

test('inicializadores preservam Firebase oficial bloqueado', () => {
  assert.match(ambiente, /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false/);
  for (const arquivo of [windows, linux]) {
    assert.doesNotMatch(arquivo, /ALLOW_OFFICIAL_FIRESTORE_WRITE=true/);
    assert.match(arquivo, /firebase:lab:seed/);
    assert.match(arquivo, /check:phase3kc/);
    assert.match(arquivo, /dev:dashboard:emulator/);
    assert.match(arquivo, /dev:app:emulator/);
  }
});

test('inicializadores executam o ciclo completo validado pela Fase 3K-C', () => {
  assert.match(pacote, /"check:phase3kc"/);
  for (const arquivo of [windows, linux]) {
    assert.match(arquivo, /Fase 3K-C/);
    assert.match(arquivo, /rollback/);
  }
  assert.match(seed, /historicoPublicacoes/);
  assert.match(seed, /versoesEscala/);
  assert.match(seed, /publicacoesEscala/);
  assert.match(pacote, /firebase:lab:verify-seed/);
  assert.match(pacote, /firebase:lab:smoke/);
});

test('inicializador Windows recicla somente servidores Vite locais incompatíveis', () => {
  assert.match(windows, /prepare-local-web-port\.mjs/);
  assert.match(prepareWebPort, /Get-NetTCPConnection/);
  assert.match(prepareWebPort, /Get-CimInstance Win32_Process/);
  assert.match(prepareWebPort, /CommandLine/);
  assert.match(prepareWebPort, /isVite/);
  assert.match(prepareWebPort, /Stop-Process/);
  assert.match(prepareWebPort, /PORT_READY_TO_START = 10/);
  assert.match(prepareWebPort, /VITE_FIREBASE_USE_EMULATORS/);
  assert.match(prepareWebPort, /demo-escala-ici-fase3i/);
  assert.doesNotMatch(prepareWebPort, /taskkill|killall/);
});

test('inicializador Linux preserva processos existentes', () => {
  assert.match(linux, /Porta 4174 ja em uso/);
  assert.doesNotMatch(linux, /taskkill|pkill|killall|Stop-Process/);
});

test('inicializador Windows detecta Java sem escapes invalidos no PowerShell', () => {
  assert.match(windows, /:java_21_available/);
  assert.match(windows, /ProductMajorPart/);
  assert.match(windows, /call :java_21_available/);
  assert.doesNotMatch(windows, /\^& java|2\^>\^&1|\^\| Select-Object/);
});

test('executor Firebase usa o CLI local sem depender de firebase.cmd', () => {
  assert.match(firebaseCli, /firebase-tools/);
  assert.match(firebaseCli, /spawnSync\(process\.execPath, \[firebaseCli, \.\.\.argumentos\]/);
  assert.match(firebaseCli, /shell: false/);
  assert.match(firebaseCli, /Firebase CLI terminou com/);
  assert.doesNotMatch(firebaseCli, /firebase\.cmd|shell: process\.platform/);
});

test('validacao ativa no Windows nao depende do Bash ou do WSL', () => {
  assert.match(pacote, /"lint": "node scripts\/run-local-tool\.mjs lint"/);
  assert.match(pacote, /"build": "node scripts\/build-verified\.mjs"/);
  assert.match(pacote, /"validate:artifact": "node scripts\/validate-artifact\.mjs"/);
  assert.match(localTool, /spawnSync\(process\.execPath/);
  assert.match(buildVerified, /spawnSync\(process\.execPath/);
  assert.match(`${localTool}\n${buildVerified}`, /shell: false/);
  assert.doesNotMatch(pacote, /"(?:lint|build|validate:artifact)": "bash /);
});

test('smoke do laboratorio exige Firebase, Dashboard e App simultaneos', () => {
  assert.match(firebaseCli, /live-smoke/);
  assert.match(pacote, /"firebase:lab:smoke": "node scripts\/firebase-cli\.mjs live-smoke"/);
  assert.match(windows, /call :wait_port 4000 90/);
});

test('Dashboard e App carregam o ambiente emulator da raiz do repositorio', () => {
  for (const viteConfig of [dashboardVite, appVite]) {
    assert.match(viteConfig, /envDir: raizRepositorio/);
  }
  assert.match(liveSmoke, /VITE_FIREBASE_USE_EMULATORS/);
  assert.match(liveSmoke, /demo-escala-ici-fase3i/);
  assert.match(runningLab, /VITE_FIREBASE_USE_EMULATORS/);
  assert.match(runningLab, /demo-escala-ici-fase3i/);
  assert.match(windows, /verify-running-lab\.mjs/);
  assert.match(linux, /verify-running-lab\.mjs/);
});
