/**
 * FASE-PLANTAO-CODB-CANONICO-1 — provisiona o Grupo canônico "Plantão CODB"
 * (multi-função: DBA/Linux/Telecom/Windows como postos do MESMO Grupo,
 * nunca quatro Grupos/Equipes/Matrizes/publicações — ver
 * `docs/spec/PLANTAO_CODB.md`).
 *
 * Cria/confirma, nesta ordem, e SÓ isto (nunca competência, atribuição ou
 * participante — esses nascem do fluxo real de importação/editor):
 *
 * 1. `equipes/GEDSI_CODB_PLANTAO` — anchor técnico exclusivo do Plantão
 *    CODB (mesmo padrão de `GEDSI_COSI_PLANTAO`: nunca uma equipe humana,
 *    nunca o vínculo organizacional do Coordenador, existe só para
 *    satisfazer `GrupoPlantao.equipeResponsavelId`, que é obrigatório e
 *    imutável no schema atual). `sigla: 'PLANTAO_CODB'` — deliberadamente
 *    NÃO `'PLANTAO'` (o padrão que `GEDSI_COSI_PLANTAO` usa): com esse
 *    sigla, `identificadorGrupoPlantaoDaEquipe()` produziria o grupoId
 *    "PLANTAO", que colide com o shell legado `gruposPlantao/PLANTAO`
 *    (COSI, inativo) — ver auditoria no relatório da fase.
 * 2. `gruposPlantao/PLANTAO_CODB` — grupoId derivado do MESMO helper
 *    oficial usado pelo Dashboard (`identificadorGrupoPlantaoDaEquipe()`,
 *    `lib/inicioEscala.ts`), replicado aqui porque scripts de
 *    `scripts/staging/` nunca importam de `lib/` (mesmo padrão de
 *    `corrigir-usuario-supervisor-equipe.mjs`) — nunca uma concatenação
 *    inventada isolada. `funcoesEsperadas: ['DBA','LINUX','TELECOM','WINDOWS']`.
 * 3. `escoposOperacionais/PLANTAO_PLANTAO_CODB` — responsabilidade
 *    explícita do Coordenador CODB sobre o Grupo INTEIRO (nunca uma
 *    responsabilidade por posto).
 *
 * NUNCA toca: `gruposPlantao/NOC` (shell legado, `DEACTIVATE_LATER` —
 * fase própria, só depois do Plantão CODB validado ponta a ponta),
 * `equipes/GEDSI_CODB_NOC`, `escoposOperacionais/JORNADA_GEDSI_CODB_NOC`,
 * ou qualquer campo do usuário Elton além de confirmar (nunca alterar)
 * que ele já não tem `equipeId` apontando para equipe descendente
 * (corrigido em fase anterior, commit `425b86f`).
 *
 * DRY-RUN POR PADRÃO — sem `--apply`, só mostra o plano (create/keep por
 * item) e não grava nada. Só executa de verdade com:
 *
 *   --apply --confirm=PROVISIONAR_PLANTAO_CODB
 *
 * Idempotente: rodar de novo depois de aplicado não duplica nada — cada
 * etapa primeiro confere se o documento já existe no formato esperado
 * (`KEEP`) antes de decidir criar (`CREATE`).
 *
 * Usa o Admin SDK, mesma guarda de `firebaseAdminStaging.mjs`: só roda
 * contra o projeto `escala-ici-staging`, nunca produção.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/provisionar-plantao-codb.mjs --coordenador=elrauh
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/provisionar-plantao-codb.mjs --coordenador=elrauh \
 *     --apply --confirm=PROVISIONAR_PLANTAO_CODB
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

const CONFIRMACAO = 'PROVISIONAR_PLANTAO_CODB';
const TIMEZONE_PADRAO_GRUPO_PLANTAO = 'America/Sao_Paulo';

const ANCHOR = Object.freeze({
  id: 'GEDSI_CODB_PLANTAO',
  sigla: 'PLANTAO_CODB',
  nome: 'Plantão CODB',
  unidadeId: 'GEDSI_CODB',
});

const FUNCOES_PLANTAO_CODB = Object.freeze(['DBA', 'LINUX', 'TELECOM', 'WINDOWS']);

function valorDoArgumento(argv, prefixo) {
  const encontrado = argv.find((valor) => valor.startsWith(prefixo));
  return encontrado ? encontrado.slice(prefixo.length).trim() : '';
}

export function analisarArgumentos(argv) {
  return {
    apply: argv.includes('--apply'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
    coordenadorLogin: valorDoArgumento(argv, '--coordenador=') || 'elrauh',
  };
}

/** Mesma normalização de `normalizarIdentificadorTecnico()` (`lib/inicioEscala.ts`) — replicada, nunca importada (scripts/staging/ nunca importam de lib/). */
export function normalizarIdentificadorTecnico(valor) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

/** Mesma fórmula de `identificadorGrupoPlantaoDaEquipe()` (`lib/inicioEscala.ts`): sigla da equipe responsável, nunca o id. */
export function identificadorGrupoPlantaoDaEquipe(equipeResponsavel) {
  return normalizarIdentificadorTecnico(equipeResponsavel.sigla || equipeResponsavel.id);
}

const GRUPO_ID = identificadorGrupoPlantaoDaEquipe(ANCHOR);

async function main() {
  const { apply, confirmado, coordenadorLogin } = analisarArgumentos(process.argv);
  if (apply && !confirmado) {
    throw new Error(`Para aplicar de verdade, use --apply --confirm=${CONFIRMACAO}.`);
  }
  const modo = apply ? 'APLICANDO (grava no Firestore)' : 'DRY-RUN (só mostra o plano)';

  const { db } = inicializarAdminStaging();
  console.log('[provisionar-plantao-codb] projeto: escala-ici-staging');
  console.log(`[provisionar-plantao-codb] modo: ${modo}`);
  console.log(`[provisionar-plantao-codb] coordenador: ${coordenadorLogin}`);
  console.log(`[provisionar-plantao-codb] grupoId derivado: ${GRUPO_ID} (de sigla="${ANCHOR.sigla}")`);

  // --- Leitura do estado atual (sempre, mesmo em dry-run) ---
  const [unidadeSnap, anchorSnap, grupoSnap, escopoSnap, coordenadorSnap, todosGruposSnap] = await Promise.all([
    db.doc(`unidadesOrganizacionais/${ANCHOR.unidadeId}`).get(),
    db.doc(`equipes/${ANCHOR.id}`).get(),
    db.doc(`gruposPlantao/${GRUPO_ID}`).get(),
    db.doc(`escoposOperacionais/PLANTAO_${GRUPO_ID}`).get(),
    db.doc(`usuarios/${coordenadorLogin}`).get(),
    db.collection('gruposPlantao').get(),
  ]);

  if (!unidadeSnap.exists) {
    throw new Error(`unidadesOrganizacionais/${ANCHOR.unidadeId} não existe. Nada foi verificado/gravado.`);
  }
  const unidade = unidadeSnap.data();
  const caminhoUnidade = Array.isArray(unidade.caminho) ? unidade.caminho : [];

  if (!coordenadorSnap.exists) {
    throw new Error(`usuarios/${coordenadorLogin} não existe. Nada foi verificado/gravado.`);
  }
  const coordenador = coordenadorSnap.data();
  if (coordenador.perfil !== 'GESTOR_UNIDADE' || coordenador.unidadeId !== ANCHOR.unidadeId) {
    throw new Error(
      `usuarios/${coordenadorLogin} não é GESTOR_UNIDADE de ${ANCHOR.unidadeId} `
      + `(perfil=${coordenador.perfil}, unidadeId=${coordenador.unidadeId}). Nada foi verificado/gravado.`,
    );
  }
  if ((coordenador.equipeId ?? '').trim() !== '') {
    throw new Error(
      `usuarios/${coordenadorLogin}.equipeId ainda não está vazio ("${coordenador.equipeId}") — corrija isso primeiro `
      + '(scripts/staging/corrigir-gestor-unidade-equipe-id.mjs) antes de provisionar. Nada foi verificado/gravado.',
    );
  }

  // --- Prova de ausência de duplicidade: qualquer outro grupo semanticamente parecido ---
  //
  // `gruposPlantao/NOC` já foi diagnosticado (read-only, fase anterior):
  // criado por elrauh em 2026-08-25, shell vazio (0 participantes/
  // competências/atribuições/publicações) — não é o Plantão CODB legado,
  // não é a Jornada do NOC. Tratado como DEACTIVATE_LATER (seção 11/17 da
  // fase), nunca reutilizado. Em vez de bloquear cegamente todo run neste
  // candidato já conhecido, o script RE-VERIFICA ao vivo que ele continua
  // vazio a cada execução (defesa em profundidade: se alguém começou a
  // usá-lo entre uma execução e outra, isso PASSA a bloquear de novo).
  // Qualquer OUTRO candidato suspeito (desconhecido) sempre bloqueia.
  const candidatosSuspeitos = [];
  todosGruposSnap.forEach((doc) => {
    if (doc.id === GRUPO_ID) return;
    const dados = doc.data();
    const nomeNormalizado = String(dados.nome ?? '').toLowerCase();
    if (
      nomeNormalizado.includes('codb')
      || dados.unidadeResponsavelId === ANCHOR.unidadeId
      || dados.equipeResponsavelId === ANCHOR.id
    ) {
      candidatosSuspeitos.push({ id: doc.id, nome: dados.nome, unidadeResponsavelId: dados.unidadeResponsavelId, equipeResponsavelId: dados.equipeResponsavelId, ativo: dados.ativo });
    }
  });

  console.log('\n=== PROVA DE AUSÊNCIA DE DUPLICIDADE ===');
  console.log(`gruposPlantao existentes: ${todosGruposSnap.size}`);
  console.log('candidatos suspeitos (nome contém "codb", ou unidade/equipe responsável batem com o anchor):');
  console.log(candidatosSuspeitos.length === 0 ? '  nenhum' : JSON.stringify(candidatosSuspeitos, null, 2));

  const candidatosNaoExplicados = [];
  for (const candidato of candidatosSuspeitos) {
    if (candidato.id !== 'NOC') {
      candidatosNaoExplicados.push(candidato);
      continue;
    }
    const [participantes, competencias, rascunhos] = await Promise.all([
      db.collection(`gruposPlantao/${candidato.id}/participantes`).limit(1).get(),
      db.collection('competenciasPlantao').where('grupoId', '==', candidato.id).limit(1).get(),
      db.collection('rascunhosCompetenciasPlantao').where('grupoId', '==', candidato.id).limit(1).get(),
    ]);
    const aindaVazio = participantes.empty && competencias.empty && rascunhos.empty;
    console.log(`  NOC re-verificado ao vivo: ${aindaVazio ? 'continua vazio (shell legado, DEACTIVATE_LATER, não bloqueia)' : 'DEIXOU DE ESTAR VAZIO — reauditar antes de continuar'}`);
    if (!aindaVazio) {
      candidatosNaoExplicados.push(candidato);
    }
  }

  if (candidatosNaoExplicados.length > 0) {
    throw new Error(
      'Existem grupos suspeitos de duplicidade não explicados — revise manualmente antes de continuar. Nada foi gravado.',
    );
  }

  // --- Plano ---
  const anchorAcao = anchorSnap.exists ? 'KEEP' : 'CREATE';
  const grupoAcao = grupoSnap.exists ? 'KEEP' : 'CREATE';
  const grupoAtual = grupoSnap.exists ? grupoSnap.data() : null;
  const funcoesJaCorretas = grupoAtual !== null
    && Array.isArray(grupoAtual.funcoesEsperadas)
    && FUNCOES_PLANTAO_CODB.every((f) => grupoAtual.funcoesEsperadas.includes(f))
    && grupoAtual.funcoesEsperadas.length === FUNCOES_PLANTAO_CODB.length;
  const responsavelJaListado = escopoSnap.exists
    && Array.isArray(escopoSnap.data().responsaveisLogin)
    && escopoSnap.data().responsaveisLogin.includes(coordenadorLogin);
  const escopoAcao = !escopoSnap.exists
    ? 'CREATE'
    : responsavelJaListado
      ? 'KEEP'
      : 'ADD_RESPONSAVEL';

  console.log('\n=== PLANO ===');
  console.log('\nANCHOR');
  console.log(`  ${ANCHOR.id} (sigla=${ANCHOR.sigla}, nome="${ANCHOR.nome}", unidadeId=${ANCHOR.unidadeId})`);
  console.log(`  ${anchorAcao}`);

  console.log('\nGRUPO');
  console.log(`  ${GRUPO_ID}`);
  console.log('  nome="Plantão CODB"');
  console.log(`  ${grupoAcao}${grupoAcao === 'KEEP' && !funcoesJaCorretas ? ' (mas funcoesEsperadas precisa correção — revisar manualmente, este script não sobrescreve um Grupo existente)' : ''}`);

  console.log('\nFUNÇÕES');
  console.log(`  ${FUNCOES_PLANTAO_CODB.join(', ')}`);

  console.log('\nRESPONSÁVEL');
  console.log(`  ${coordenadorLogin}`);
  console.log(`  ${escopoAcao}`);

  console.log('\nNOC JORNADA');
  console.log('  NO CHANGE (escoposOperacionais/JORNADA_GEDSI_CODB_NOC intocado)');

  console.log('\nSUPERVISORA');
  console.log('  NO CHANGE (usuarios/wmoriyama intocado)');

  console.log('\nSHELL gruposPlantao/NOC');
  console.log('  DEACTIVATE_LATER — não alterado nesta etapa');

  if (!apply) {
    console.log(`\n[provisionar-plantao-codb] nada foi gravado (dry-run). Rode com --apply --confirm=${CONFIRMACAO} para aplicar.`);
    process.exit(0);
  }

  if (grupoSnap.exists && !funcoesJaCorretas) {
    throw new Error(
      `gruposPlantao/${GRUPO_ID} já existe mas funcoesEsperadas não bate com o esperado — `
      + 'correção manual necessária, este script nunca sobrescreve um Grupo existente. Nada foi gravado.',
    );
  }

  const agora = new Date().toISOString();
  const escritas = [];

  if (anchorAcao === 'CREATE') {
    escritas.push(db.doc(`equipes/${ANCHOR.id}`).set({
      id: ANCHOR.id,
      nome: ANCHOR.nome,
      sigla: ANCHOR.sigla,
      ativa: true,
      unidadeId: ANCHOR.unidadeId,
      caminhoUnidade,
      ordem: 2,
      codigoOrganizacional: ANCHOR.id,
      schemaVersion: 1,
      criadoPorLogin: 'provisionar-plantao-codb',
      criadoEm: agora,
      atualizadoEm: agora,
    }));
  }

  if (grupoAcao === 'CREATE') {
    escritas.push(db.doc(`gruposPlantao/${GRUPO_ID}`).set({
      grupoId: GRUPO_ID,
      nome: 'Plantão CODB',
      equipeResponsavelId: ANCHOR.id,
      equipesConsulta: [ANCHOR.id],
      unidadeResponsavelId: ANCHOR.unidadeId,
      caminhoUnidadeResponsavel: caminhoUnidade,
      funcoesEsperadas: [...FUNCOES_PLANTAO_CODB],
      timezone: TIMEZONE_PADRAO_GRUPO_PLANTAO,
      ativo: true,
      schemaVersion: 1,
      criadoPorLogin: 'provisionar-plantao-codb',
      criadoEm: agora,
      atualizadoEm: agora,
    }));
  }

  if (escopoAcao === 'CREATE') {
    escritas.push(db.doc(`escoposOperacionais/PLANTAO_${GRUPO_ID}`).set({
      tipo: 'PLANTAO',
      alvoId: GRUPO_ID,
      alvoNome: 'Plantão CODB',
      unidadeId: ANCHOR.unidadeId,
      caminhoUnidade,
      responsaveisLogin: [coordenadorLogin],
      responsaveisEquipe: [],
      equipesConsulta: [],
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
      criadoPorLogin: 'provisionar-plantao-codb',
      atualizadoPorLogin: 'provisionar-plantao-codb',
      schemaVersion: 1,
    }));
  } else if (escopoAcao === 'ADD_RESPONSAVEL') {
    const atual = escopoSnap.data();
    escritas.push(db.doc(`escoposOperacionais/PLANTAO_${GRUPO_ID}`).set({
      ...atual,
      responsaveisLogin: [...new Set([...(atual.responsaveisLogin ?? []), coordenadorLogin])],
      atualizadoEm: agora,
      atualizadoPorLogin: 'provisionar-plantao-codb',
    }, { merge: true }));
  }

  await Promise.all(escritas);
  console.log(`\n[provisionar-plantao-codb] concluído. Grupo "${GRUPO_ID}" pronto, responsável: ${coordenadorLogin}.`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[provisionar-plantao-codb] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
