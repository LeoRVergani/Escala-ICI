#!/usr/bin/env node
/**
 * DIAGNOSTICO-PLANTAO-USUARIO-1 — SÓ LEITURA. Mostra, para um login, tudo o que
 * o App lê para montar a aba Plantão e aponta o que faria o banco recusar a
 * leitura ("Não foi possível acessar seus dados… sem permissão").
 *
 *   npm run staging:diagnosticar:plantao -- <login>
 *
 * Nunca grava nada.
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

function linha(rotulo, valor) {
  console.log(`  ${rotulo.padEnd(28)} ${valor}`);
}

async function main() {
  const login = (process.argv[2] ?? '').trim();
  if (!login) {
    console.error('Uso: npm run staging:diagnosticar:plantao -- <login>');
    process.exit(1);
  }
  const { db } = inicializarAdminStaging({ appName: 'diagnosticar-plantao-usuario' });

  console.log(`\n=== Usuário ${login}`);
  const usuarioSnap = await db.collection('usuarios').doc(login).get();
  if (!usuarioSnap.exists) {
    console.log('  ✗ cadastro NÃO encontrado em usuarios/{login} — o App não sabe quem é a pessoa.');
    return;
  }
  const usuario = usuarioSnap.data();
  linha('nome', usuario.nome);
  linha('ativo', usuario.ativo);
  linha('equipeId', usuario.equipeId || '(vazio)');
  linha('perfil', usuario.perfil ?? `(sem perfil; nível ${usuario.nivelHierarquico})`);
  const equipeId = usuario.equipeId || '';

  // 1. O que o App consulta: grupos com a equipe da pessoa em equipesConsulta.
  console.log(`\n=== 1. Grupos de Plantão visíveis para a equipe "${equipeId}" (consulta do App)`);
  const escopos = (await db.collection('escoposOperacionais').where('tipo', '==', 'PLANTAO').get()).docs.map((d) => d.data());
  const gruposConsulta = equipeId
    ? (await db.collection('gruposPlantao').where('equipesConsulta', 'array-contains', equipeId).get()).docs
    : [];
  if (gruposConsulta.length === 0) {
    console.log('  ✗ NENHUM grupo tem essa equipe em "equipes que consultam" → o App mostra "Nenhum Plantão configurado".');
  }
  const riscos = [];
  for (const doc of gruposConsulta) {
    const grupo = doc.data();
    const matriz = escopos.find((escopo) => escopo.alvoId === doc.id);
    console.log(`\n  • ${grupo.nome} (${doc.id})`);
    linha('ativo', grupo.ativo);
    linha('equipe responsável', grupo.equipeResponsavelId);
    linha('unidade responsável', grupo.unidadeResponsavelId ?? '(ausente — grupo antigo)');
    linha('equipes que consultam', (grupo.equipesConsulta ?? []).join(', '));
    linha('Matriz (responsáveis)', matriz ? `${matriz.ativo ? 'ATIVA' : 'INATIVA'} · ${(matriz.responsaveisLogin ?? []).join(', ') || '—'}` : '(sem Matriz)');
    if (matriz) linha('Matriz (equipes consulta)', (matriz.equipesConsulta ?? []).join(', ') || '(VAZIA)');
    const participante = await db.collection('gruposPlantao').doc(doc.id).collection('participantes').doc(login).get();
    linha('a pessoa é participante?', participante.exists ? (participante.data().ativo ? 'sim (ativa)' : 'sim (INATIVA)') : 'não');
    const publicadas = await db.collection('competenciasPlantao').where('grupoId', '==', doc.id).get();
    linha('competências publicadas', publicadas.docs.map((item) => `${item.data().competencia} (${item.data().status})`).join(', ') || '(nenhuma)');
    if (matriz && !matriz.ativo) {
      riscos.push(`"${grupo.nome}" (${doc.id}) tem Matriz INATIVA: as regras bloqueiam a leitura dele, e como ele entra na consulta do App, a consulta INTEIRA é recusada → é o erro de permissão.`);
    }
    if (grupo.ativo === false) {
      riscos.push(`"${grupo.nome}" (${doc.id}) está INATIVO mas ainda tem "${equipeId}" em equipes que consultam (retire a equipe ou exclua o grupo).`);
    }
  }

  console.log('\n=== Diagnóstico');
  if (riscos.length === 0) {
    console.log('  Nenhum problema de configuração encontrado. Mande esta saída para análise.');
  } else {
    riscos.forEach((risco, indice) => console.log(`  ${indice + 1}. ${risco}`));
  }
  console.log('\n(Nada foi gravado.)');
}

main().catch((falha) => {
  console.error('[diagnosticar-plantao-usuario] falhou:', falha.message);
  process.exit(1);
});
