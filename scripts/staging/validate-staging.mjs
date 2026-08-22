/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — valida, só leitura, que
 * `seed-hierarquia-ici.mjs` deixou o staging (`escala-ici-staging`) no
 * estado esperado: organograma canônico presente, equipes/Grupo de
 * Plantão/Matriz/usuários de teste criados, `config/ambiente` ligado, e
 * NENHUM documento novo usando os IDs legados (`EQ_SOC`, `EQ_PLANTAO_COSI`,
 * `EQ_NOC`) ou o `grupoId` legado (`PLANTAO_COSI`).
 *
 * Nunca escreve nada — só `get()`/`.get()` de coleções via Admin SDK.
 * Sai com código 1 se qualquer checagem falhar (para poder ser usado como
 * gate de pipeline), sempre imprimindo o relatório completo antes de sair.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/validate-staging.mjs
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';
import {
  EQUIPES,
  GRUPO_PLANTAO,
  IDS_MATRIZ,
  IDS_UNIDADES,
  MAPEAMENTO_LEGADO,
  USUARIOS_SEED,
} from './hierarquia-ici.mjs';

const IDS_LEGADOS_EQUIPE = Object.freeze(Object.keys(MAPEAMENTO_LEGADO));
const GRUPO_PLANTAO_LEGADO = 'PLANTAO_COSI';

/**
 * Coleções varridas em busca de referência residual aos IDs legados, e o(s)
 * campo(s) de cada uma que poderiam carregar um `equipeId`/`grupoId`.
 * Cobre o grafo mínimo de referências descrito em
 * `docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`, seção 3.
 */
const VARREDURA_EQUIPE_ID = Object.freeze([
  'usuarios', 'turnosMes', 'rascunhosTurnosMes', 'publicacoesEscala',
  'historicoPublicacoes', 'trocasEscala', 'notificacoesTroca',
]);
const VARREDURA_GRUPO_ID = Object.freeze([
  'competenciasPlantao', 'rascunhosCompetenciasPlantao',
]);

function contemValorLegado(valor, legados) {
  if (typeof valor === 'string') {
    return legados.includes(valor);
  }
  if (Array.isArray(valor)) {
    return valor.some((item) => typeof item === 'string' && legados.includes(item));
  }
  return false;
}

export async function validarUnidades(db) {
  const faltando = [];
  for (const unidadeId of IDS_UNIDADES) {
    const snapshot = await db.doc(`unidadesOrganizacionais/${unidadeId}`).get();
    if (!snapshot.exists) faltando.push(unidadeId);
  }
  return { nome: 'unidades organizacionais canônicas existem', ok: faltando.length === 0, detalhe: faltando };
}

export async function validarEquipes(db) {
  const problemas = [];
  for (const equipe of EQUIPES) {
    const snapshot = await db.doc(`equipes/${equipe.id}`).get();
    if (!snapshot.exists) {
      problemas.push(`${equipe.id}: não existe`);
      continue;
    }
    const dados = snapshot.data();
    if (dados.unidadeId !== equipe.unidadeId) {
      problemas.push(`${equipe.id}: unidadeId="${dados.unidadeId}" (esperado "${equipe.unidadeId}")`);
    }
  }
  return { nome: 'equipes canônicas existem com unidadeId correto', ok: problemas.length === 0, detalhe: problemas };
}

export async function validarGrupoPlantao(db) {
  const snapshot = await db.doc(`gruposPlantao/${GRUPO_PLANTAO.grupoId}`).get();
  if (!snapshot.exists) {
    return { nome: 'Grupo de Plantão canônico existe', ok: false, detalhe: [`${GRUPO_PLANTAO.grupoId}: não existe`] };
  }
  const dados = snapshot.data();
  const problemas = [];
  if (dados.equipeResponsavelId !== GRUPO_PLANTAO.equipeResponsavelId) {
    problemas.push(`equipeResponsavelId="${dados.equipeResponsavelId}" (esperado "${GRUPO_PLANTAO.equipeResponsavelId}")`);
  }
  return { nome: 'Grupo de Plantão canônico existe com equipeResponsavelId correto', ok: problemas.length === 0, detalhe: problemas };
}

export async function validarMatriz(db) {
  const faltando = [];
  for (const idEscopo of IDS_MATRIZ) {
    const snapshot = await db.doc(`escoposOperacionais/${idEscopo}`).get();
    if (!snapshot.exists) faltando.push(idEscopo);
  }
  return { nome: 'Matriz de Responsáveis inicial existe', ok: faltando.length === 0, detalhe: faltando };
}

export async function validarUsuarios(db) {
  const problemas = [];
  for (const usuario of USUARIOS_SEED) {
    const snapshot = await db.doc(`usuarios/${usuario.login}`).get();
    if (!snapshot.exists) {
      problemas.push(`${usuario.login}: não existe`);
      continue;
    }
    const dados = snapshot.data();
    if (dados.equipeId !== usuario.equipeId || dados.perfil !== usuario.perfil) {
      problemas.push(`${usuario.login}: equipeId="${dados.equipeId}" perfil="${dados.perfil}" (esperado equipeId="${usuario.equipeId}" perfil="${usuario.perfil}")`);
    }
  }
  return { nome: 'usuários de teste vinculados corretamente', ok: problemas.length === 0, detalhe: problemas };
}

export async function validarAmbienteStaging(db) {
  const snapshot = await db.doc('config/ambiente').get();
  const ok = snapshot.exists && snapshot.data().staging === true;
  return {
    nome: 'config/ambiente.staging=true (liga souCoordenadorOperacionalStaging)',
    ok,
    detalhe: ok ? [] : ['config/ambiente ausente ou staging != true'],
  };
}

export async function validarSemIdsLegados(db) {
  const ocorrencias = [];

  for (const colecao of VARREDURA_EQUIPE_ID) {
    const snapshot = await db.collection(colecao).get();
    for (const doc of snapshot.docs) {
      const dados = doc.data();
      if (contemValorLegado(dados.equipeId, IDS_LEGADOS_EQUIPE) || contemValorLegado(dados.equipesPermitidas, IDS_LEGADOS_EQUIPE)) {
        ocorrencias.push(`${colecao}/${doc.id}: referencia equipeId legado`);
      }
    }
  }

  for (const colecao of VARREDURA_GRUPO_ID) {
    const snapshot = await db.collection(colecao).get();
    for (const doc of snapshot.docs) {
      const dados = doc.data();
      if (dados.grupoId === GRUPO_PLANTAO_LEGADO) {
        ocorrencias.push(`${colecao}/${doc.id}: referencia grupoId legado "${GRUPO_PLANTAO_LEGADO}"`);
      }
    }
  }

  const equipesSnapshot = await db.collection('equipes').get();
  for (const doc of equipesSnapshot.docs) {
    if (IDS_LEGADOS_EQUIPE.includes(doc.id)) {
      ocorrencias.push(`equipes/${doc.id}: equipe legada recriada`);
    }
  }

  const gruposSnapshot = await db.collection('gruposPlantao').get();
  for (const doc of gruposSnapshot.docs) {
    const dados = doc.data();
    if (doc.id === GRUPO_PLANTAO_LEGADO || contemValorLegado(dados.equipeResponsavelId, IDS_LEGADOS_EQUIPE) || contemValorLegado(dados.equipesConsulta, IDS_LEGADOS_EQUIPE)) {
      ocorrencias.push(`gruposPlantao/${doc.id}: referencia ID legado`);
    }
  }

  const matrizSnapshot = await db.collection('escoposOperacionais').get();
  for (const doc of matrizSnapshot.docs) {
    const dados = doc.data();
    if (
      contemValorLegado(dados.alvoId, [...IDS_LEGADOS_EQUIPE, GRUPO_PLANTAO_LEGADO])
      || contemValorLegado(dados.responsaveisEquipe, IDS_LEGADOS_EQUIPE)
      || contemValorLegado(dados.equipesConsulta, IDS_LEGADOS_EQUIPE)
    ) {
      ocorrencias.push(`escoposOperacionais/${doc.id}: referencia ID legado`);
    }
  }

  return {
    nome: 'nenhum documento novo usa EQ_SOC, EQ_PLANTAO_COSI, EQ_NOC ou o grupoId legado PLANTAO_COSI',
    ok: ocorrencias.length === 0,
    detalhe: ocorrencias,
  };
}

export async function rodarValidacoes(db) {
  return Promise.all([
    validarUnidades(db),
    validarEquipes(db),
    validarGrupoPlantao(db),
    validarMatriz(db),
    validarUsuarios(db),
    validarAmbienteStaging(db),
    validarSemIdsLegados(db),
  ]);
}

async function main() {
  const { db } = inicializarAdminStaging();
  console.log('[validate-staging] projeto: escala-ici-staging');

  const resultados = await rodarValidacoes(db);
  let tudoOk = true;
  for (const resultado of resultados) {
    const marca = resultado.ok ? 'OK ' : 'FALHOU';
    console.log(`[validate-staging] ${marca} — ${resultado.nome}`);
    for (const linha of resultado.detalhe) {
      console.log(`    - ${linha}`);
    }
    if (!resultado.ok) tudoOk = false;
  }

  if (!tudoOk) {
    console.error('[validate-staging] validação falhou — ver detalhes acima.');
    process.exitCode = 1;
    return;
  }
  console.log('[validate-staging] tudo certo.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[validate-staging] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
