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
  throw new Error(`App staging reprovado: ${resultado.erros.join(' ')}`);
}
if (!process.argv.includes('--confirm=DEPLOY_STAGING')) {
  throw new Error(
    'Confirme o destino: npm run pages:deploy:staging -- --confirm=DEPLOY_STAGING',
  );
}

const projetoPages = process.env.CLOUDFLARE_PAGES_PROJECT?.trim();
if (!projetoPages || !/-staging$/.test(projetoPages)) {
  throw new Error('CLOUDFLARE_PAGES_PROJECT deve terminar em -staging.');
}

const executar = (argumentos) => new Promise((resolvePromise, reject) => {
  const filho = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', argumentos, {
    stdio: 'inherit',
    env: process.env,
  });
  filho.on('error', reject);
  filho.on('exit', (codigo) => codigo === 0
    ? resolvePromise()
    : reject(new Error(`Comando finalizado com código ${codigo ?? 1}.`)));
});

await executar(['run', 'build:app:pages']);
await executar([
  'exec',
  'wrangler',
  '--',
  'pages',
  'deploy',
  'dist/apps/app',
  '--project-name',
  projetoPages,
  '--branch',
  'staging',
]);
