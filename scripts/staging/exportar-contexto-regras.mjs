#!/usr/bin/env node
/**
 * DIAGNOSTICO-PUBLICACAO-1 — passo 1 (SOMENTE LEITURA): copia para um arquivo LOCAL o contexto de que as Regras do Firestore
 * precisam para decidir "esse usuário pode administrar essa Jornada?": usuários, equipes, Matriz de responsáveis
 * (`escoposOperacionais`), ambiente (`config`) e grupos de Plantão. Nunca grava nada no staging.
 *
 *   npm run staging:diagnosticar:publicacao:exportar -- --login=<login do usuário> [--saida=/tmp/contexto-regras.json]
 *
 * O arquivo tem nomes e e-mails do cadastro: fica só na VM, com permissão 0600 — apague quando terminar (o resumo impresso aqui
 * não tem dado pessoal além do login). Requer GOOGLE_APPLICATION_CREDENTIALS (o mesmo dos outros scripts de staging).
 * Passo 2: `simular-publicacao.mjs`, dentro do emulador (ver docs/operacao/DIAGNOSTICO_PUBLICACAO.md).
 */
import { chmodSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { Timestamp } from 'firebase-admin/firestore';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';
import { COLECOES_DO_CONTEXTO, resumirContexto, serializar } from './diagnosticoPublicacaoLib.mjs';

const argumento = (nome) => process.argv.find((item) => item.startsWith(`--${nome}=`))?.slice(nome.length + 3);

async function main() {
  const login = (argumento('login') ?? '').trim().toLowerCase();
  const saida = argumento('saida') ?? '/tmp/contexto-regras.json';
  if (login === '') {
    console.error('Uso: npm run staging:diagnosticar:publicacao:exportar -- --login=<login do usuário> [--saida=/tmp/contexto-regras.json]');
    process.exitCode = 2;
    return;
  }
  const { db } = inicializarAdminStaging({ appName: 'exportar-contexto-regras' });
  const colecoes = {};
  for (const nome of COLECOES_DO_CONTEXTO) {
    const resultado = await db.collection(nome).get();
    colecoes[nome] = Object.fromEntries(resultado.docs.map((documento) => [documento.id, serializar(documento.data(), (valor) => valor instanceof Timestamp)]));
    console.log(`  ${nome}: ${resultado.size} documento(s)`);
  }
  const contexto = { geradoEm: new Date().toISOString(), projeto: 'escala-ici-staging', login, colecoes };
  writeFileSync(saida, JSON.stringify(contexto), { mode: 0o600 });
  chmodSync(saida, 0o600);

  const resumo = resumirContexto(contexto, login);
  console.log(`\nContexto salvo em ${saida} (somente você lê). Apague quando terminar.\n`);
  console.log('Resumo do usuário e da Jornada dele (sem dado pessoal além do login):');
  for (const [chave, valor] of Object.entries(resumo)) console.log(`  ${chave}: ${JSON.stringify(valor)}`);
  if (!resumo.usuarioExiste) console.log(`\nATENÇÃO: não existe usuarios/${login}. As Regras negam tudo sem esse documento (o doc ID é o login).`);
}

main().catch((erro) => {
  console.error('Falha ao exportar o contexto:', erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
