import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import { avaliarConfiguracaoFirebase } from './firebase-preflight-lib.mjs';

const arquivo = resolve('.env.staging.app');
if (!existsSync(arquivo)) {
  throw new Error('Crie .env.staging.app a partir do arquivo .example.');
}
Object.assign(process.env, parseEnv(readFileSync(arquivo, 'utf8')));

const resultado = avaliarConfiguracaoFirebase(process.env, { alvo: 'staging' });
if (!resultado.valido || resultado.escritaOficial) {
  throw new Error(`Build do App staging bloqueado: ${resultado.erros.join(' ')}`);
}

const filho = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'run',
  'build:app:pages',
], {
  stdio: 'inherit',
  env: process.env,
});
filho.on('exit', (codigo) => {
  process.exitCode = codigo ?? 1;
});
