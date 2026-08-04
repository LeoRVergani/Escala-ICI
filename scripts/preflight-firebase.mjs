import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import {
  avaliarConfiguracaoFirebase,
  resumoSeguroFirebase,
} from './firebase-preflight-lib.mjs';

const argumentoArquivo = process.argv.find((item) => item.startsWith('--env-file='));
const arquivoLocal = resolve(argumentoArquivo?.slice('--env-file='.length) || '.env.local');
if (existsSync(arquivoLocal)) {
  Object.assign(process.env, parseEnv(readFileSync(arquivoLocal, 'utf8')));
}

const json = process.argv.includes('--json');
const alvo = process.argv.includes('--target=staging') ? 'staging' : 'seguro';
const exigirEscrita = process.argv.includes('--require-write');
const resultado = avaliarConfiguracaoFirebase(process.env, { alvo, exigirEscrita });

if (json) {
  console.log(JSON.stringify(resumoSeguroFirebase(resultado), null, 2));
} else {
  console.log(`Modo Firebase: ${resultado.modo}`);
  console.log(`Alvo validado: ${resultado.alvo}`);
  if (resultado.projeto) {
    console.log(`Projeto: ${resultado.projeto}`);
  }
  console.log(
    resultado.escritaOficial
      ? 'Escrita oficial: HABILITADA'
      : 'Escrita oficial: bloqueada',
  );
  console.log(
    resultado.emuladores
      ? resultado.emuladoresLan
        ? 'Emuladores: habilitados para o IPv4 privado autorizado do laboratório LAN'
        : 'Emuladores: habilitados somente para localhost'
      : 'Emuladores: desabilitados',
  );
  for (const aviso of resultado.avisos) {
    console.warn(`Aviso: ${aviso}`);
  }
  for (const erro of resultado.erros) {
    console.error(`Erro: ${erro}`);
  }
  console.log(
    resultado.valido
      ? 'Preflight concluído sem expor API key ou outras credenciais.'
      : 'Preflight reprovado. Corrija a configuração antes do build integrado.',
  );
}

if (!resultado.valido) {
  process.exitCode = 1;
}
