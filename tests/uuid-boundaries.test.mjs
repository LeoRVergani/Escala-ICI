import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('fluxos administrativos não dependem diretamente de randomUUID', async () => {
  const [usuarios, escrita, uuid] = await Promise.all([
    ler('lib/importUsers.ts'),
    ler('lib/firebase/writeRepository.ts'),
    ler('lib/uuid.ts'),
  ]);

  assert.doesNotMatch(`${usuarios}\n${escrita}`, /crypto\.randomUUID\s*\(/);
  // O login é a chave desde a criação — importUsers.ts não gera mais ID
  // nenhum (nem via gerarUuid nem via crypto.randomUUID).
  assert.doesNotMatch(usuarios, /randomUUID|gerarUuid/);
  assert.match(escrita, /gerarUuid\(\)/);
  assert.match(uuid, /getRandomValues/);
  assert.doesNotMatch(uuid, /Math\.random/);
});

test('Dashboard definitivo fica local ao proxy e o laboratório LAN pode ser explícito', async () => {
  const [compose, ambienteLan, caddy] = await Promise.all([
    ler('deploy/dashboard/compose.yaml'),
    ler('.env.emulator-lan.example'),
    ler('deploy/dashboard/Caddyfile.intranet.example'),
  ]);

  assert.match(compose, /DASHBOARD_BIND_ADDRESS:-127\.0\.0\.1/);
  assert.match(ambienteLan, /DASHBOARD_BIND_ADDRESS=0\.0\.0\.0/);
  assert.match(caddy, /reverse_proxy 127\.0\.0\.1:4173/);
  assert.doesNotMatch(caddy, /:(?:4000|4174|8080|9099)\b/);
});
