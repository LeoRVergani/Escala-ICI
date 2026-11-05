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
    if (matriz && !matriz.ativo) {
      riscos.push(`"${grupo.nome}" (${doc.id}) tem Matriz INATIVA: as regras bloqueiam a leitura dele, e como ele entra na consulta do App, a consulta INTEIRA é recusada → é o erro de permissão.`);
    }
    if (grupo.ativo === false) {
      riscos.push(`"${grupo.nome}" (${doc.id}) está INATIVO mas ainda tem "${equipeId}" em equipes que consultam (retire a equipe ou exclua o grupo).`);
    }
  }

  // 2. Onde a pessoa é participante (independe da equipe).
  console.log(`\n=== 2. Grupos em que "${login}" é participante`);
  const participacoes = await db.collectionGroup('participantes').where('login', '==', login).get();
  if (participacoes.empty) {
    console.log('  ✗ a pessoa NÃO é participante de nenhum Grupo de Plantão.');
  }
  for (const doc of participacoes.docs) {
    const grupoId = doc.ref.parent.parent?.id ?? '?';
    const visivel = gruposConsulta.some((grupo) => grupo.id === grupoId);
    console.log(`  • ${grupoId} — participante ${doc.data().ativo ? 'ativo' : 'INATIVO'} — ${visivel ? 'visível pela equipe ✓' : 'NÃO visível pela equipe da pessoa ✗'}`);
    if (!visivel) {
      riscos.push(`É participante de "${grupoId}", mas a equipe "${equipeId}" não está em "equipes que consultam" desse grupo → o App não encontra o Plantão dela.`);
    }
    // 3. Competências publicadas desse grupo.
    const competencias = await db.collection('competenciasPlantao').where('grupoId', '==', grupoId).get();
    for (const competencia of competencias.docs) {
      const dados = competencia.data();
      console.log(`      competência ${dados.competencia} · ${dados.status} · ${dados.periodoInicio} → ${dados.periodoFim}`);
    }
    if (competencias.empty) {
      riscos.push(`"${grupoId}" ainda não tem competência PUBLICADA (só rascunho?) → não há escala para mostrar.`);
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
