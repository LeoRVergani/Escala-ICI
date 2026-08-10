import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const HEARTBEAT_PATH = process.env.PUSH_WORKER_HEARTBEAT_PATH ?? '/tmp/push-worker-heartbeat';
const HEARTBEAT_STALE_MS = 90_000;

export function writeHeartbeat(now: () => Date = () => new Date()): void {
  writeFileSync(HEARTBEAT_PATH, now().toISOString(), 'utf8');
}

export function isHeartbeatFresh(now: () => Date = () => new Date()): boolean {
  try {
    const conteudo = readFileSync(HEARTBEAT_PATH, 'utf8').trim();
    const ultimaBatida = Date.parse(conteudo);
    if (Number.isNaN(ultimaBatida)) {
      return false;
    }
    return now().getTime() - ultimaBatida < HEARTBEAT_STALE_MS;
  } catch {
    return false;
  }
}

function ehExecucaoDirecta(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (ehExecucaoDirecta()) {
  process.exit(isHeartbeatFresh() ? 0 : 1);
}
