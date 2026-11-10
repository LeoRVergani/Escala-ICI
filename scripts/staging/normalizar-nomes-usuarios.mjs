#!/usr/bin/env node
/**
 * NOME-SEM-ESPACOS-1 — encontra (e, com --aplicar, corrige) nomes gravados com
 * espaços extras: no começo/fim, repetidos ou "invisíveis" (U+00A0 etc.).
 * Confere o cadastro (usuarios/{login}.nome) e o nome copiado nos participantes
 * de Plantão (gruposPlantao/{grupo}/participantes/{login}.nomeExibicao).
 *
 *   npm run staging:normalizar:nomes            # só lista, não grava nada
 *   npm run staging:normalizar:nomes -- --aplicar
 *
 * Requer GOOGLE_APPLICATION_CREDENTIALS (mesma conta do diagnóstico de Plantão).
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

// MESMA regra de lib/nomePessoa.ts (o teste de fronteira confere que são iguais).
const ESPACOS = /[\s\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]+/gu;
function normalizarNomePessoa(nome) {
  return nome.replace(ESPACOS, ' ').trim();
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const { db } = inicializarAdminStaging({ appName: 'normalizar-nomes-usuarios' });
  const correcoes = [];

  const usuarios = await db.collection('usuarios').get();
  for (const documento of usuarios.docs) {
    const nome = documento.get('nome');
    if (typeof nome === 'string' && normalizarNomePessoa(nome) !== nome) {
      correcoes.push({ ref: documento.ref, campo: 'nome', antes: nome, depois: normalizarNomePessoa(nome) });
    }
  }
  const participantes = await db.collectionGroup('participantes').get();
  for (const documento of participantes.docs) {
    if (documento.ref.parent.parent?.parent.id !== 'gruposPlantao') continue;
    const nome = documento.get('nomeExibicao');
    if (typeof nome === 'string' && normalizarNomePessoa(nome) !== nome) {
      correcoes.push({ ref: documento.ref, campo: 'nomeExibicao', antes: nome, depois: normalizarNomePessoa(nome) });
    }
  }

  console.log(`\n${usuarios.size} cadastros e ${participantes.size} participantes conferidos.`);
  if (correcoes.length === 0) {
    console.log('✔ Nenhum nome com espaços extras.\n');
    return;
  }
  console.log(`${correcoes.length} nome(s) com espaços extras:`);
  for (const item of correcoes) {
    console.log(`  ${item.ref.path}  ${JSON.stringify(item.antes)} → ${JSON.stringify(item.depois)}`);
  }
  if (!aplicar) {
    console.log('\nNada foi gravado. Para corrigir: npm run staging:normalizar:nomes -- --aplicar\n');
    return;
  }
  for (let inicio = 0; inicio < correcoes.length; inicio += 400) {
    const lote = db.batch();
    for (const item of correcoes.slice(inicio, inicio + 400)) {
      lote.update(item.ref, { [item.campo]: item.depois });
    }
    await lote.commit();
  }
  console.log(`\n✔ ${correcoes.length} nome(s) corrigido(s).\n`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
