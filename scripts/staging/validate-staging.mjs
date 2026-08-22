/**
 * STAGING-RESET-HIERARQUIA-ICI-1/2/3 — valida, só leitura, que
 * `seed-hierarquia-ici.mjs` deixou o staging (`escala-ici-staging`) no
 * estado esperado: organograma canônico presente, equipes/Grupo de
 * Plantão/Matriz/conta técnica `admin` criados, `config/ambiente` ligado, e
 * NENHUM documento novo usando os IDs legados (`EQ_SOC`, `EQ_PLANTAO_COSI`,
 * `EQ_NOC`) ou o `grupoId` legado (`PLANTAO_COSI`) — nem os IDs de unidade
 * simples de uma fase anterior (`COSI`/`CODB`/`COCR`, STAGING-RESET-HIERARQUIA-ICI-2),
 * nem unidade/equipe invertidas entre si.
 *
 * STAGING-RESET-HIERARQUIA-ICI-3 — a estrutura passa mesmo SEM nenhuma
 * pessoa real cadastrada: pessoas nunca são parte do seed estrutural.
 * `avisarPessoasReaisPendentes()` só emite avisos informativos (nunca
 * bloqueia o exit code) lembrando quais cadastros reais ainda faltam.
 *
 * Nunca escreve nada — só `get()`/`.get()` de coleções via Admin SDK.
 * Sai com código 1 se qualquer checagem BLOQUEANTE falhar (para poder ser
 * usado como gate de pipeline), sempre imprimindo o relatório completo
 * (checagens + avisos) antes de sair.
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
  IDS_EQUIPES,
  IDS_MATRIZ,
  IDS_UNIDADES,
  MAPEAMENTO_LEGADO,
  USUARIOS_SEED,
} from './hierarquia-ici.mjs';

const IDS_LEGADOS_EQUIPE = Object.freeze(Object.keys(MAPEAMENTO_LEGADO));
const GRUPO_PLANTAO_LEGADO = 'PLANTAO_COSI';
/**
 * STAGING-RESET-HIERARQUIA-ICI-2 — IDs simples de coordenação que a fase
 * anterior usava (`COSI`/`CODB`/`COCR`) e que agora precisam ser sempre
 * `GEDSI_COSI`/`GEDSI_CODB`/`GEDSI_COCR`. Não confundir com `MAPEAMENTO_LEGADO`
 * (que é sobre `EQ_SOC`/`EQ_PLANTAO_COSI`/`EQ_NOC`, equipes do staging
 * anterior a STAGING-RESET-HIERARQUIA-ICI-1) — este é um segundo corte,
 * só sobre os IDs de unidade/coordenação.
 */
const IDS_UNIDADE_SIMPLES_PROIBIDOS = Object.freeze(['COSI', 'CODB', 'COCR']);

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

export async function validarSemUnidadeIdSimples(db) {
  const ocorrencias = [];
  const snapshot = await db.collection('unidadesOrganizacionais').get();
  for (const doc of snapshot.docs) {
    if (IDS_UNIDADE_SIMPLES_PROIBIDOS.includes(doc.id)) {
      ocorrencias.push(`unidadesOrganizacionais/${doc.id}: unidadeId simples proibido — use o prefixo canônico (ex.: GEDSI_${doc.id})`);
    }
  }
  return {
    nome: 'nenhuma unidade usa ID simples (COSI/CODB/COCR) — só GEDSI_COSI/GEDSI_CODB/GEDSI_COCR',
    ok: ocorrencias.length === 0,
    detalhe: ocorrencias,
  };
}

/**
 * STAGING-RESET-HIERARQUIA-ICI-2 — nunca inverter unidade e equipe: um
 * `unidadeId` de verdade (`IDS_UNIDADES`) nunca pode aparecer salvo como
 * `equipeId` (em `equipes` ou `usuarios`), e um `equipeId` de verdade
 * (`IDS_EQUIPES`) nunca pode aparecer salvo como `unidadeId` (em
 * `unidadesOrganizacionais`, `equipes` ou `usuarios`).
 */
export async function validarNaoInverteUnidadeEquipe(db) {
  const ocorrencias = [];
  const idsUnidade = new Set(IDS_UNIDADES);
  const idsEquipe = new Set(IDS_EQUIPES);

  const [equipesSnapshot, unidadesSnapshot, usuariosSnapshot] = await Promise.all([
    db.collection('equipes').get(),
    db.collection('unidadesOrganizacionais').get(),
    db.collection('usuarios').get(),
  ]);

  for (const doc of equipesSnapshot.docs) {
    if (idsUnidade.has(doc.id)) {
      ocorrencias.push(`equipes/${doc.id}: um unidadeId foi salvo como equipeId`);
    }
    const unidadeId = doc.data().unidadeId;
    if (typeof unidadeId === 'string' && idsEquipe.has(unidadeId)) {
      ocorrencias.push(`equipes/${doc.id}: unidadeId="${unidadeId}" é na verdade um equipeId`);
    }
  }

  for (const doc of unidadesSnapshot.docs) {
    if (idsEquipe.has(doc.id)) {
      ocorrencias.push(`unidadesOrganizacionais/${doc.id}: um equipeId foi salvo como unidadeId`);
    }
  }

  for (const doc of usuariosSnapshot.docs) {
    const dados = doc.data();
    if (typeof dados.equipeId === 'string' && idsUnidade.has(dados.equipeId)) {
      ocorrencias.push(`usuarios/${doc.id}: equipeId="${dados.equipeId}" é na verdade um unidadeId`);
    }
    if (typeof dados.unidadeId === 'string' && idsEquipe.has(dados.unidadeId)) {
      ocorrencias.push(`usuarios/${doc.id}: unidadeId="${dados.unidadeId}" é na verdade um equipeId`);
    }
  }

  return {
    nome: 'unidade e equipe nunca invertidas (unidadeId nunca vira equipeId, e vice-versa)',
    ok: ocorrencias.length === 0,
    detalhe: ocorrencias,
  };
}

/**
 * STAGING-RESET-HIERARQUIA-ICI-3 — avisos informativos sobre pessoas reais,
 * NUNCA bloqueantes: a estrutura (unidades/equipes/grupo/matriz) é válida
 * mesmo sem nenhuma pessoa real cadastrada ainda — isto só lembra o
 * operador do que falta cadastrar, sem fazer o script falhar por isso.
 * `LOGIN_COORDENADOR_COSI_ESPERADO` é um lembrete operacional editável, não
 * uma regra de produto — ver `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md`
 * § 6 para a configuração completa esperada de cada pessoa.
 */
const LOGIN_COORDENADOR_COSI_ESPERADO = 'clis';

export async function avisarPessoasReaisPendentes(db) {
  const avisos = [];

  const snapshotCoordenadorCosi = await db.doc(`usuarios/${LOGIN_COORDENADOR_COSI_ESPERADO}`).get();
  if (!snapshotCoordenadorCosi.exists) {
    avisos.push(`usuarios/${LOGIN_COORDENADOR_COSI_ESPERADO}: coordenador real do COSI ainda não cadastrado (esperado GESTOR_UNIDADE de GEDSI_COSI).`);
  }

  const usuariosSnapshot = await db.collection('usuarios').get();
  const usuarios = usuariosSnapshot.docs.map((doc) => doc.data());

  const temSupervisorNoc = usuarios.some((dados) =>
    dados.perfil === 'SUPERVISOR_EQUIPE' && dados.equipeId === 'GEDSI_CODB_NOC' && dados.ativo !== false);
  if (!temSupervisorNoc) {
    avisos.push('usuarios: nenhum SUPERVISOR_EQUIPE ativo de GEDSI_CODB_NOC encontrado ainda (supervisora do NOC).');
  }

  const temGestorUnidadeCodb = usuarios.some((dados) =>
    dados.perfil === 'GESTOR_UNIDADE' && dados.unidadeId === 'GEDSI_CODB' && dados.ativo !== false);
  if (!temGestorUnidadeCodb) {
    avisos.push('usuarios: coordenador do CODB (GESTOR_UNIDADE de GEDSI_CODB) ainda não cadastrado — ok, será cadastrado depois.');
  }

  return avisos;
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
    validarSemUnidadeIdSimples(db),
    validarNaoInverteUnidadeEquipe(db),
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

  const avisos = await avisarPessoasReaisPendentes(db);
  for (const aviso of avisos) {
    console.log(`[validate-staging] AVISO (não bloqueia) — ${aviso}`);
  }

  if (!tudoOk) {
    console.error('[validate-staging] validação falhou — ver detalhes acima.');
    process.exitCode = 1;
    return;
  }
  console.log('[validate-staging] tudo certo (estrutura válida — avisos acima, se houver, são só lembretes de cadastro pendente).');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[validate-staging] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
