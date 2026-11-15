#!/usr/bin/env node
/**
 * EQUIPE-DE-PLANTAO-1 — a equipe interna de um Plantão (a que guarda os
 * plantonistas) não é equipe 6x1. Se alguém definiu "liderança" para ela pela
 * Administração, nasceu um responsável de escala 6x1 e a equipe passou a
 * aparecer duplicada na Minha equipe (aba "6x1" + aba "Plantão").
 *
 * Este script acha esses casos e, com --aplicar, DESATIVA o responsável 6x1
 * (ativo=false — nada é apagado; dá para reativar). Só toca equipes que:
 *   - são a equipe responsável de um Plantão ativo; E
 *   - NUNCA tiveram escala 6x1 (nem publicada, nem rascunho).
 *
 *   npm run staging:corrigir:equipe-plantao             # só lista
 *   npm run staging:corrigir:equipe-plantao -- --aplicar
 *
 * Requer GOOGLE_APPLICATION_CREDENTIALS (mesma conta do diagnóstico de Plantão).
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const { db } = inicializarAdminStaging({ appName: 'corrigir-equipe-de-plantao' });

  const grupos = await db.collection('gruposPlantao').get();
  const equipeDoPlantao = new Map();
  for (const documento of grupos.docs) {
    if (documento.get('ativo') !== true) continue;
    const equipeId = documento.get('equipeResponsavelId');
    if (typeof equipeId === 'string' && equipeId !== '') equipeDoPlantao.set(equipeId, String(documento.get('nome') ?? documento.id));
  }

  const escopos = await db.collection('escoposOperacionais').where('tipo', '==', 'JORNADA').get();
  const candidatos = [];
  for (const documento of escopos.docs) {
    if (documento.get('ativo') === false) continue;
    const equipeId = documento.get('alvoId');
    if (!equipeDoPlantao.has(equipeId)) continue;
    const publicadas = await db.collection('turnosMes').where('equipeId', '==', equipeId).limit(1).get();
    const rascunhos = await db.collection('rascunhosTurnosMes').where('equipeId', '==', equipeId).limit(1).get();
    const temEscala6x1 = !publicadas.empty || !rascunhos.empty;
    candidatos.push({ ref: documento.ref, equipeId, plantao: equipeDoPlantao.get(equipeId), responsaveis: documento.get('responsaveisLogin') ?? [], temEscala6x1 });
  }

  console.log(`\n${equipeDoPlantao.size} equipe(s) de Plantão; ${escopos.size} responsável(is) 6x1 conferido(s).`);
  if (candidatos.length === 0) {
    console.log('✔ Nenhuma equipe de Plantão com responsável 6x1. Nada a corrigir.\n');
    return;
  }
  const corrigiveis = candidatos.filter((item) => !item.temEscala6x1);
  for (const item of candidatos) {
    console.log(`  ${item.equipeId} (equipe do ${item.plantao}) — responsável 6x1: ${item.responsaveis.join(', ') || '—'} — ${item.temEscala6x1 ? 'TEM escala 6x1: NÃO será alterada' : 'sem nenhuma escala 6x1: será desativado'}`);
  }
  if (corrigiveis.length === 0) { console.log('\nNada a desativar automaticamente.\n'); return; }
  if (!aplicar) {
    console.log(`\nNada foi gravado. Para desativar ${corrigiveis.length} responsável(is) 6x1: npm run staging:corrigir:equipe-plantao -- --aplicar\n`);
    return;
  }
  const lote = db.batch();
  for (const item of corrigiveis) {
    lote.update(item.ref, { ativo: false, atualizadoEm: new Date().toISOString(), atualizadoPorLogin: 'script-equipe-de-plantao' });
  }
  await lote.commit();
  console.log(`\n✔ ${corrigiveis.length} responsável(is) 6x1 desativado(s). A equipe volta a aparecer só como Plantão.\n`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
