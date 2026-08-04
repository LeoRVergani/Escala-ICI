import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import { avaliarConfiguracaoFirebase } from './firebase-preflight-lib.mjs';

const arquivo = resolve('.env.staging.dashboard');
if (!existsSync(arquivo)) {
  throw new Error('Crie .env.staging.dashboard a partir do arquivo .example.');
}
Object.assign(process.env, parseEnv(readFileSync(arquivo, 'utf8')));

const resultado = avaliarConfiguracaoFirebase(process.env, {
  alvo: 'staging',
  exigirEscrita: true,
});
if (!resultado.valido) {
  throw new Error(`Preflight staging reprovado: ${resultado.erros.join(' ')}`);
}

const acao = process.argv[2];
const confirmado = process.argv.includes('--confirm=DEPLOY_STAGING');
if (acao !== 'deploy-rules' || !confirmado) {
  throw new Error(
    'Uso: npm run firebase:staging:deploy -- --confirm=DEPLOY_STAGING',
  );
}

const argumentos = [
  'exec',
  'firebase',
  '--',
  'deploy',
  '--only',
  'firestore:rules,firestore:indexes',
  '--project',
  resultado.projeto,
];

const filho = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', argumentos, {
  stdio: 'inherit',
  env: process.env,
});
filho.on('exit', (codigo) => {
  process.exitCode = codigo ?? 1;
});
