/**
 * Consolida o Plantão COSI no Grupo e na Matriz canônicos do staging.
 *
 * O reparo é conservador: somente staging literal, dry-run por padrão,
 * confirmação textual para gravar, nenhum dado operacional movido/apagado,
 * aborto se um legado possuir dados e desativação (nunca exclusão) de
 * Grupos/Matrizes legados vazios.
 *
 * Uso:
 *   npm run staging:repair:cosi
 *   npm run staging:repair:cosi -- --apply --confirm=REPARAR_PLANTAO_COSI
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';
import {
  GRUPO_PLANTAO,
  MATRIZ_INICIAL,
  idEscopoOperacional,
} from './hierarquia-ici.mjs';

const CONFIRMACAO = 'REPARAR_PLANTAO_COSI';
const GRUPO_CANONICO = GRUPO_PLANTAO.grupoId;
const GRUPOS_LEGADOS = Object.freeze(['PLANTAO_COSI', 'PLANTAO']);
const ESCOPO_CANONICO = idEscopoOperacional('PLANTAO', GRUPO_CANONICO);
const ESCOPOS_LEGADOS = Object.freeze(
  GRUPOS_LEGADOS.map((grupoId) => idEscopoOperacional('PLANTAO', grupoId)),
);
const MATRIZ_CANONICA_SEED = MATRIZ_INICIAL.find(
  (item) => item.tipo === 'PLANTAO' && item.alvoId === GRUPO_CANONICO,
);

if (MATRIZ_CANONICA_SEED === undefined) {
  throw new Error(`A fonte canônica não contém a Matriz ${ESCOPO_CANONICO}.`);
}

export function analisarArgumentos(argv) {
  return {
    apply: argv.includes('--apply'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
  };
}

function unicos(valores) {
  return [...new Set(
    valores.filter((valor) => typeof valor === 'string' && valor.trim() !== ''),
  )].sort();
}

function arrayDo(dados, campo) {
  return Array.isArray(dados?.[campo]) ? dados[campo] : [];
}

function resumoContagens(dados) {
  return {
    participantes: dados.participantes,
    participantesAtivos: dados.participantesAtivos,
    publicadas: dados.publicadas,
    canceladas: dados.canceladas,
    rascunhos: dados.rascunhos,
  };
}

function totalDadosOperacionais(dados) {
  return dados.participantes + dados.publicadas + dados.canceladas + dados.rascunhos;
}

async function contarDadosGrupo(db, grupoId) {
  const [participantes, competencias, rascunhos] = await Promise.all([
    db.collection(`gruposPlantao/${grupoId}/participantes`).get(),
    db.collection('competenciasPlantao').where('grupoId', '==', grupoId).get(),
    db.collection('rascunhosCompetenciasPlantao').where('grupoId', '==', grupoId).get(),
  ]);
  return {
    participantes: participantes.size,
    participantesAtivos: participantes.docs.filter((doc) => doc.data().ativo === true).length,
    publicadas: competencias.docs.filter((doc) => doc.data().status === 'PUBLICADA').length,
    canceladas: competencias.docs.filter((doc) => doc.data().status === 'CANCELADA').length,
    rascunhos: rascunhos.size,
    participantesDocs: participantes.docs,
  };
}

function dadosMatriz(snapshot) {
  return snapshot.exists ? snapshot.data() : {};
}

async function main() {
  const { apply, confirmado } = analisarArgumentos(process.argv);
  if (apply && !confirmado) {
    throw new Error(`Para aplicar, use --apply --confirm=${CONFIRMACAO}.`);
  }

  const { db } = inicializarAdminStaging({ appName: 'auditar-reparar-plantao-cosi' });
  console.log('[auditar-reparar-plantao-cosi] projeto: escala-ici-staging');
  console.log(`[auditar-reparar-plantao-cosi] modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const refsGrupos = [GRUPO_CANONICO, ...GRUPOS_LEGADOS]
    .map((grupoId) => db.doc(`gruposPlantao/${grupoId}`));
  const refsMatrizes = [ESCOPO_CANONICO, ...ESCOPOS_LEGADOS]
    .map((escopoId) => db.doc(`escoposOperacionais/${escopoId}`));

  const [gruposSnaps, matrizesSnaps, equipeSnap, unidadeSnap, contagens] = await Promise.all([
    Promise.all(refsGrupos.map((ref) => ref.get())),
    Promise.all(refsMatrizes.map((ref) => ref.get())),
    db.doc(`equipes/${GRUPO_PLANTAO.equipeResponsavelId}`).get(),
    db.doc(`unidadesOrganizacionais/${GRUPO_PLANTAO.unidadeResponsavelId}`).get(),
    Promise.all([GRUPO_CANONICO, ...GRUPOS_LEGADOS].map((grupoId) => contarDadosGrupo(db, grupoId))),
  ]);

  if (!equipeSnap.exists || equipeSnap.data().ativa !== true) {
    throw new Error(`Equipe canônica ${GRUPO_PLANTAO.equipeResponsavelId} ausente ou inativa. Revise o seed estrutural antes deste reparo.`);
  }
  if (!unidadeSnap.exists || unidadeSnap.data().ativa !== true) {
    throw new Error(`Unidade canônica ${GRUPO_PLANTAO.unidadeResponsavelId} ausente ou inativa. Revise o seed estrutural antes deste reparo.`);
  }

  const [grupoCanonicoSnap, ...gruposLegadosSnaps] = gruposSnaps;
  const [dadosCanonicos, ...dadosLegados] = contagens;
  const grupoCanonico = grupoCanonicoSnap.exists ? grupoCanonicoSnap.data() : {};

  if (totalDadosOperacionais(dadosCanonicos) > 0 && !grupoCanonicoSnap.exists) {
    throw new Error(`Há dados órfãos sob ${GRUPO_CANONICO}, mas o Grupo canônico não existe. Revisão manual obrigatória; nada foi gravado.`);
  }
  if (grupoCanonicoSnap.exists && grupoCanonico.ativo !== true && totalDadosOperacionais(dadosCanonicos) > 0) {
    throw new Error('O Grupo canônico está inativo e contém dados operacionais. Revisão manual obrigatória; nada foi reativado.');
  }
  if (grupoCanonicoSnap.exists && arrayDo(grupoCanonico, 'funcoesEsperadas').length > 0) {
    throw new Error('O Plantão COSI canônico está configurado como multiposto. O COSI é posto único; revisão manual obrigatória.');
  }
  if (
    grupoCanonicoSnap.exists
    && totalDadosOperacionais(dadosCanonicos) > 0
    && grupoCanonico.equipeResponsavelId !== GRUPO_PLANTAO.equipeResponsavelId
  ) {
    throw new Error('O Grupo canônico contém dados, mas aponta para outra equipe responsável. Revisão manual obrigatória.');
  }

  for (let indice = 0; indice < GRUPOS_LEGADOS.length; indice += 1) {
    const total = totalDadosOperacionais(dadosLegados[indice]);
    if (total > 0) {
      throw new Error(
        `Grupo legado ${GRUPOS_LEGADOS[indice]} contém ${total} registro(s) operacional(is). `
        + 'O script não migra nem apaga dados; faça revisão manual.',
      );
    }
  }

  const participantesAtivos = dadosCanonicos.participantesDocs
    .filter((doc) => doc.data().ativo === true);
  const usuariosParticipantes = await Promise.all(
    participantesAtivos.map((doc) => db.doc(`usuarios/${doc.id}`).get()),
  );
  const participantesSemUsuario = usuariosParticipantes.filter((snapshot) => !snapshot.exists).length;
  if (participantesSemUsuario > 0) {
    throw new Error(`${participantesSemUsuario} participante(s) ativo(s) não possuem usuário correspondente. ACL não pode ser derivada com segurança.`);
  }

  const equipesParticipantes = unicos(
    usuariosParticipantes.map((snapshot) => snapshot.data().equipeId),
  );
  const equipesConsultaGrupo = unicos([
    ...GRUPO_PLANTAO.equipesConsulta,
    ...arrayDo(grupoCanonico, 'equipesConsulta'),
    ...equipesParticipantes,
  ]);

  const [matrizCanonicaSnap, ...matrizesLegadasSnaps] = matrizesSnaps;
  const todasMatrizes = matrizesSnaps.map(dadosMatriz);
  const responsaveisLogin = unicos([
    ...MATRIZ_CANONICA_SEED.responsaveisLogin,
    ...todasMatrizes.flatMap((dados) => arrayDo(dados, 'responsaveisLogin')),
  ]);
  const responsaveisEquipe = unicos(
    todasMatrizes.flatMap((dados) => arrayDo(dados, 'responsaveisEquipe')),
  );
  const equipesConsultaMatriz = unicos([
    ...equipesConsultaGrupo,
    ...arrayDo(dadosMatriz(matrizCanonicaSnap), 'equipesConsulta'),
  ]);

  console.log('\n=== ESTADO ENCONTRADO ===');
  console.log(JSON.stringify({
    grupoCanonico: {
      id: GRUPO_CANONICO,
      existe: grupoCanonicoSnap.exists,
      ativo: grupoCanonico.ativo === true,
      ...resumoContagens(dadosCanonicos),
    },
    gruposLegados: GRUPOS_LEGADOS.map((grupoId, indice) => ({
      id: grupoId,
      existe: gruposLegadosSnaps[indice].exists,
      ativo: gruposLegadosSnaps[indice].exists && gruposLegadosSnaps[indice].data().ativo === true,
      ...resumoContagens(dadosLegados[indice]),
    })),
    matrizCanonica: { id: ESCOPO_CANONICO, existe: matrizCanonicaSnap.exists, ativo: dadosMatriz(matrizCanonicaSnap).ativo === true },
    matrizesLegadas: ESCOPOS_LEGADOS.map((id, indice) => ({
      id,
      existe: matrizesLegadasSnaps[indice].exists,
      ativo: matrizesLegadasSnaps[indice].exists && matrizesLegadasSnaps[indice].data().ativo === true,
    })),
  }, null, 2));

  console.log('\n=== PLANO SEGURO ===');
  console.log(JSON.stringify({
    grupoCanonico: 'CRIAR_OU_REATIVAR_E_NORMALIZAR',
    posto: 'UNICO',
    equipeResponsavelId: GRUPO_PLANTAO.equipeResponsavelId,
    equipesConsulta: equipesConsultaGrupo,
    matrizCanonica: 'CRIAR_OU_REATIVAR_E_CONSOLIDAR_RESPONSAVEIS',
    responsaveisLogin,
    responsaveisEquipe,
    gruposLegados: gruposLegadosSnaps.filter((snap) => snap.exists).map((snap) => `${snap.id}:DESATIVAR`),
    matrizesLegadas: matrizesLegadasSnaps.filter((snap) => snap.exists).map((snap) => `${snap.id}:DESATIVAR`),
    dadosOperacionais: 'NÃO_MOVER_NÃO_APAGAR',
  }, null, 2));

  if (!apply) {
    console.log(`\n[auditar-reparar-plantao-cosi] nada gravado. Para aplicar: --apply --confirm=${CONFIRMACAO}`);
    return;
  }

  const agora = new Date().toISOString();
  const ator = 'auditar-reparar-plantao-cosi';
  const batch = db.batch();

  batch.set(grupoCanonicoSnap.ref, {
    ...GRUPO_PLANTAO,
    equipesConsulta: equipesConsultaGrupo,
    funcoesEsperadas: [],
    ...(grupoCanonicoSnap.exists ? {} : { criadoPorLogin: ator, criadoEm: agora }),
    atualizadoEm: agora,
  }, { merge: true });

  batch.set(matrizCanonicaSnap.ref, {
    ...MATRIZ_CANONICA_SEED,
    responsaveisLogin,
    responsaveisEquipe,
    equipesConsulta: equipesConsultaMatriz,
    ...(matrizCanonicaSnap.exists ? {} : { criadoPorLogin: ator, criadoEm: agora }),
    atualizadoPorLogin: ator,
    atualizadoEm: agora,
  }, { merge: true });

  for (const snapshot of gruposLegadosSnaps) {
    if (snapshot.exists && snapshot.data().ativo !== false) {
      batch.update(snapshot.ref, { ativo: false, atualizadoEm: agora });
    }
  }
  for (const snapshot of matrizesLegadasSnaps) {
    if (snapshot.exists && snapshot.data().ativo !== false) {
      batch.update(snapshot.ref, {
        ativo: false,
        atualizadoPorLogin: ator,
        atualizadoEm: agora,
      });
    }
  }

  await batch.commit();
  console.log('[auditar-reparar-plantao-cosi] reparo concluído: canônico ativo, legados vazios desativados, nenhum dado operacional movido ou apagado.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[auditar-reparar-plantao-cosi] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
