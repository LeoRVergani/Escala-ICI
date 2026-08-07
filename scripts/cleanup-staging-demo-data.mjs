/**
 * Limpeza de usuários fictícios/demo no Firebase staging e dos documentos
 * associados a eles — depois que a equipe real e a escala real já foram
 * cadastradas em `escala-ici-staging`.
 *
 * NÃO EXECUTAR SEM REVISAR O DRY-RUN — este script pode gravar (apagar) no
 * Firestore de staging. Roda em modo dry-run por padrão; precisa de
 * `--execute --confirm=LIMPAR_STAGING` explícito para apagar de fato.
 *
 * ESCOPO: SDK cliente, UMA EQUIPE POR VEZ (mesma limitação de
 * scripts/migrate-usuarios-login.mjs, pelo mesmo motivo)
 *   Este script autentica como um gestor real e respeita as Firestore
 *   Rules — não usa Admin SDK nem service account (política atual do
 *   projeto para staging, ver deploy/firebase-staging/README.md). Isso
 *   significa:
 *     - só alcança a equipe do gestor autenticado (`equipeId == minhaEquipe()`);
 *     - só apaga o que as rules permitem a um gestor apagar.
 *
 * O QUE AS REGRAS ATUAIS PERMITEM APAGAR (checado em firestore.rules)
 *   turnosMes            -> allow delete: souGestor() && equipeId == minhaEquipe()   [PERMITIDO]
 *   rascunhosTurnosMes   -> allow delete: souGestor() && equipeId == minhaEquipe()   [PERMITIDO]
 *   usuarios             -> allow delete: if false                                   [BLOQUEADO]
 *   trocasEscala         -> allow delete: if false                                   [BLOQUEADO]
 *   notificacoesTroca    -> allow delete: if false                                   [BLOQUEADO]
 *   eventosEscala        -> allow update, delete: if false                           [BLOQUEADO]
 *   versoesEscala        -> allow update, delete: if false                           [BLOQUEADO]
 *   historicoPublicacoes -> allow update, delete: if false                           [BLOQUEADO]
 *   publicacoesEscala    -> allow delete: if false                                   [BLOQUEADO]
 *
 *   Este script NÃO altera firestore.rules. Para as coleções bloqueadas,
 *   ele só lista o que seria apagado (dry-run) e, no --execute, avisa
 *   claramente "bloqueado pelas rules" em vez de tentar burlar a regra —
 *   a remoção real dessas coleções, se um dia for necessária, exige uma
 *   decisão explícita sobre abrir essa permissão (fora do escopo desta fase).
 *
 * `notificacoesTroca` merece destaque: a regra de leitura só permite ao
 * PRÓPRIO destinatário ler a própria notificação (`destinatarioLogin ==
 * loginDoAuth()`) — nem o gestor consegue listar notificações de outra
 * pessoa. Por isso este script nem tenta consultar essa coleção por
 * usuário candidato: ela aparece no relatório só como "bloqueada para
 * leitura pelas rules atuais".
 *
 * USO
 *   node scripts/cleanup-staging-demo-data.mjs --dry-run
 *
 *   # Depois de revisar o relatório com atenção:
 *   node scripts/cleanup-staging-demo-data.mjs --execute --confirm=LIMPAR_STAGING
 *
 * Variáveis exigidas em .env.staging.dashboard (além das VITE_FIREBASE_*
 * já usadas pelo Dashboard):
 *   ESCALA_CLEANUP_EMAIL_GESTOR=marina.azevedo@empresa.com
 *   ESCALA_CLEANUP_SENHA_GESTOR=...
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { avaliarConfiguracaoFirebase } from './firebase-preflight-lib.mjs';

const PROJETO_STAGING_ESPERADO = 'escala-ici-staging';
const CONFIRMACAO_EXECUCAO = 'LIMPAR_STAGING';
const LIMITE_LOTE = 400; // margem de segurança abaixo do limite de 500 do writeBatch.
const PALAVRAS_CARGO_GESTOR = ['gestor', 'coordenador', 'gerente', 'admin', 'administrador'];

// --- 1. Carrega o .env.staging.dashboard (mesmo padrão de migrate-usuarios-login.mjs) ---

const arquivoEnv = resolve('.env.staging.dashboard');
if (!existsSync(arquivoEnv)) {
  throw new Error('Crie .env.staging.dashboard a partir de .env.staging.dashboard.example antes de rodar a limpeza.');
}
Object.assign(process.env, parseEnv(readFileSync(arquivoEnv, 'utf8')));

// --- 2. Argumentos e modo ---

const execute = process.argv.includes('--execute');
const confirmado = process.argv.includes(`--confirm=${CONFIRMACAO_EXECUCAO}`);
if (execute && !confirmado) {
  throw new Error(`Para apagar de fato, use --execute --confirm=${CONFIRMACAO_EXECUCAO}.`);
}
const modo = execute ? 'EXECUTANDO (apaga o que as rules permitirem)' : 'DRY-RUN (nada é apagado)';

// --- 3. Preflight: bloquear qualquer coisa que não seja exatamente escala-ici-staging ---

const resultadoPreflight = avaliarConfiguracaoFirebase(process.env, { alvo: 'staging' });
if (!resultadoPreflight.valido) {
  throw new Error(`Preflight de staging reprovado: ${resultadoPreflight.erros.join(' ')}`);
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';
const projectIdNormalizado = projectId.toLowerCase();
if (
  projectIdNormalizado.includes('prod')
  || projectIdNormalizado === 'escala-ici-producao'
  || projectId !== PROJETO_STAGING_ESPERADO
) {
  throw new Error(
    `[cleanup] BLOQUEADO: este script só roda contra o projeto "${PROJETO_STAGING_ESPERADO}". `
    + `VITE_FIREBASE_PROJECT_ID atual é "${projectId}". Nunca aponte este script para produção.`,
  );
}

// --- 4. Allowlist ---

const arquivoAllowlist = resolve('scripts/cleanup-staging-allowlist.txt');
if (!existsSync(arquivoAllowlist)) {
  throw new Error(`Crie ${arquivoAllowlist} com um login real por linha antes de rodar a limpeza.`);
}
const allowlist = new Set(
  readFileSync(arquivoAllowlist, 'utf8')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '' && !linha.startsWith('#')),
);
if (allowlist.size === 0) {
  throw new Error(
    `${arquivoAllowlist} está vazia. Preencha com pelo menos um login real antes de rodar a limpeza — `
    + 'uma allowlist vazia não protege ninguém.',
  );
}

// --- 5. Autenticação (SDK cliente, sujeito às Firestore Rules — sem Admin SDK) ---

const email = process.env.ESCALA_CLEANUP_EMAIL_GESTOR;
const senha = process.env.ESCALA_CLEANUP_SENHA_GESTOR;
if (!email || !senha) {
  throw new Error('Defina ESCALA_CLEANUP_EMAIL_GESTOR e ESCALA_CLEANUP_SENHA_GESTOR em .env.staging.dashboard.');
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[cleanup] modo: ${modo}`);
console.log(`[cleanup] projeto: ${projectId}`);

await signInWithEmailAndPassword(auth, email, senha);
const currentUser = auth.currentUser;
if (currentUser === null) {
  throw new Error('[cleanup] auth.currentUser indisponível depois do login.');
}
console.log(`[cleanup] autenticado como ${currentUser.email ?? email}`);

/** Mesma derivação de lib/firebase/authRepository.ts e loginDoAuth() em firestore.rules. */
function loginDoEmail(valorEmail) {
  return valorEmail.split('@')[0]?.toLowerCase().trim() ?? '';
}

function fatiarEmLotes(itens, limite = LIMITE_LOTE) {
  const lotes = [];
  for (let inicio = 0; inicio < itens.length; inicio += limite) {
    lotes.push(itens.slice(inicio, inicio + limite));
  }
  return lotes;
}

// --- 6. Perfil do gestor autenticado (define o escopo: só a própria equipe) ---

async function carregarPerfilGestor() {
  const candidatos = [currentUser.uid, loginDoEmail(currentUser.email ?? email)]
    .filter((candidato) => candidato !== '');

  for (const idCandidato of candidatos) {
    const snapshot = await getDoc(doc(db, 'usuarios', idCandidato));
    if (!snapshot.exists()) {
      continue;
    }
    const dados = snapshot.data();
    const equipeId = typeof dados.equipeId === 'string' ? dados.equipeId.trim() : '';
    const nivelHierarquico = Number(dados.nivelHierarquico ?? 6);
    if (equipeId === '') {
      throw new Error(`[cleanup] usuarios/${idCandidato} existe mas não tem equipeId válido.`);
    }
    if (!(nivelHierarquico <= 5)) {
      throw new Error(
        `[cleanup] usuarios/${idCandidato} tem nivelHierarquico=${dados.nivelHierarquico}, que não é de gestor `
        + '(<= 5). Este script exige autenticação como gestor — abortando por segurança.',
      );
    }
    return { docId: idCandidato, equipeId, nivelHierarquico, nome: String(dados.nome ?? idCandidato) };
  }

  throw new Error(
    `[cleanup] não encontrei o perfil do gestor em usuarios/${currentUser.uid} nem em `
    + `usuarios/${loginDoEmail(currentUser.email ?? email)}.`,
  );
}

// --- 7 e 8. Buscar e classificar usuários da equipe ---

function cargoIndicaGestor(cargo) {
  const cargoNormalizado = String(cargo ?? '').toLowerCase();
  return PALAVRAS_CARGO_GESTOR.some((palavra) => cargoNormalizado.includes(palavra));
}

/**
 * Devolve `{ protegido, motivo }`. `motivo` é um dos quatro pedidos:
 * 'allowlist' | 'gestor' | 'usuario_autenticado' | 'outro' — ou `null`
 * quando o usuário é candidato à exclusão (não protegido por nenhuma regra).
 */
function classificarUsuario(usuarioDoc, gestorLoginAutenticado) {
  const login = usuarioDoc.id;
  const dados = usuarioDoc.data();
  const nivelHierarquico = Number(dados.nivelHierarquico ?? 6);

  if (allowlist.has(login)) {
    return { protegido: true, motivo: 'allowlist' };
  }
  if (Number.isFinite(nivelHierarquico) && nivelHierarquico <= 5) {
    return { protegido: true, motivo: 'gestor', detalhe: `nivelHierarquico=${dados.nivelHierarquico}` };
  }
  if (cargoIndicaGestor(dados.cargo)) {
    return { protegido: true, motivo: 'gestor', detalhe: `cargo="${dados.cargo}"` };
  }
  if (login === gestorLoginAutenticado) {
    return { protegido: true, motivo: 'usuario_autenticado' };
  }
  return { protegido: false, motivo: null };
}

async function carregarUsuariosDaEquipe(equipeId) {
  const snapshot = await getDocs(
    query(collection(db, 'usuarios'), where('equipeId', '==', equipeId)),
  );
  return snapshot.docs;
}

// --- 9. Documentos relacionados aos candidatos ---

async function carregarRelacionados(equipeId, loginsCandidatos) {
  const candidatosSet = new Set(loginsCandidatos);

  async function coletar(nomeColecao, extrairLogin) {
    const snapshot = await getDocs(
      query(collection(db, nomeColecao), where('equipeId', '==', equipeId)),
    );
    return snapshot.docs.filter((documento) => {
      const login = extrairLogin(documento);
      return login !== null && candidatosSet.has(login);
    });
  }

  /**
   * Critério pedido: `data.login` (fonte confiável) OU o ID do documento
   * contendo `_{login}_`. A segunda checagem é só um reforço best-effort —
   * `idDocumento()` junta equipeId/login/competencia com "_", e tanto
   * equipeId (ex.: "EQ_COSI_SOC") quanto login podem conter "_", então um
   * `includes('_login_')` sozinho seria ambíguo. Por isso a comparação por
   * `data.login` vem primeiro e decide na prática; o teste no ID só serve
   * para pegar o caso raro de um documento sem o campo `login` preenchido.
   */
  function extrairLoginDeEscala(documento) {
    const dados = documento.data();
    const loginDoCampo = typeof dados.login === 'string' ? dados.login.trim() : '';
    if (loginDoCampo !== '') {
      return loginDoCampo;
    }
    for (const candidato of candidatosSet) {
      if (documento.id.includes(`_${candidato}_`)) {
        return candidato;
      }
    }
    return null;
  }

  const turnosMes = await coletar('turnosMes', extrairLoginDeEscala);
  const rascunhosTurnosMes = await coletar('rascunhosTurnosMes', extrairLoginDeEscala);

  // trocasEscala: allow list agora é só equipeId == minhaEquipe() (hotfix de
  // permission-denied intermitente) — dá pra listar a equipe inteira e
  // filtrar aqui por solicitanteLogin/destinatarioLogin.
  const snapshotTrocas = await getDocs(
    query(collection(db, 'trocasEscala'), where('equipeId', '==', equipeId)),
  );
  const trocasEscala = snapshotTrocas.docs.filter((documento) => {
    const dados = documento.data();
    return candidatosSet.has(dados.solicitanteLogin) || candidatosSet.has(dados.destinatarioLogin);
  });

  // notificacoesTroca: a regra de leitura só permite ao PRÓPRIO destinatário
  // ler a própria notificação — nem o gestor consegue listar notificações de
  // outra pessoa. Não dá pra descobrir a contagem real por aqui; reportamos
  // como bloqueado em vez de fingir que sabemos.
  const notificacoesTrocaBloqueado = true;

  // Só listagem para revisão manual — nunca apagadas automaticamente nesta fase.
  const eventosEscala = await coletar('eventosEscala', (documento) => {
    const dados = documento.data();
    return typeof dados.usuarioUid === 'string' ? dados.usuarioUid.trim() : null;
  });
  const versoesEscala = await coletar('versoesEscala', extrairLoginDeEscala);

  // historicoPublicacoes/publicacoesEscala não têm campo `login` (são
  // agregados por competência inteira, com uma lista de `alteracoes` por
  // colaborador dentro do documento) — não dá pra filtrar por candidato de
  // forma confiável. Reportamos a contagem da equipe inteira, só como aviso
  // de "existe algo aqui, revise manualmente", nunca como alvo de exclusão.
  const snapshotHistorico = await getDocs(
    query(collection(db, 'historicoPublicacoes'), where('equipeId', '==', equipeId)),
  );
  const historicoPublicacoes = snapshotHistorico.docs;
  const snapshotPublicacoes = await getDocs(
    query(collection(db, 'publicacoesEscala'), where('equipeId', '==', equipeId)),
  ).catch(() => ({ docs: [] })); // publicacoesEscala/estado pode não bater no filtro de query; falha aqui não deve travar o relatório.
  const publicacoesEscala = snapshotPublicacoes.docs;

  return {
    turnosMes,
    rascunhosTurnosMes,
    trocasEscala,
    notificacoesTrocaBloqueado,
    revisaoManual: {
      eventosEscala,
      versoesEscala,
      historicoPublicacoes,
      publicacoesEscala,
    },
  };
}

// --- Execução ---

const perfilGestor = await carregarPerfilGestor();
console.log(`[cleanup] perfil do gestor: usuarios/${perfilGestor.docId} (${perfilGestor.nome})`);
console.log(`[cleanup] equipeId (escopo desta execução): ${perfilGestor.equipeId}`);

const documentosUsuarios = await carregarUsuariosDaEquipe(perfilGestor.equipeId);
const classificados = documentosUsuarios.map((documento) => ({
  login: documento.id,
  nome: String(documento.data().nome ?? documento.id),
  equipeId: String(documento.data().equipeId ?? ''),
  ativo: documento.data().ativo !== false,
  nivelHierarquico: documento.data().nivelHierarquico ?? null,
  cargo: documento.data().cargo ?? null,
  ...classificarUsuario(documento, perfilGestor.docId),
}));

const protegidos = classificados.filter((item) => item.protegido);
const candidatos = classificados.filter((item) => !item.protegido);
const loginsCandidatos = candidatos.map((item) => item.login);

const relacionados = loginsCandidatos.length > 0
  ? await carregarRelacionados(perfilGestor.equipeId, loginsCandidatos)
  : {
      turnosMes: [],
      rascunhosTurnosMes: [],
      trocasEscala: [],
      notificacoesTrocaBloqueado: true,
      revisaoManual: { eventosEscala: [], versoesEscala: [], historicoPublicacoes: [], publicacoesEscala: [] },
    };

// --- Relatório ---

console.log('\n[cleanup] ===== RELATÓRIO =====');
console.log(`[cleanup] total de usuários encontrados na equipe ${perfilGestor.equipeId}: ${classificados.length}`);
console.log(`[cleanup] total protegidos: ${protegidos.length}`);
console.log(`[cleanup] total candidatos à exclusão: ${candidatos.length}`);

console.log('\n[cleanup] --- A. Usuários protegidos ---');
if (protegidos.length === 0) {
  console.log('[cleanup] (nenhum — revise a allowlist e as rules de proteção antes de continuar)');
}
for (const item of protegidos) {
  const detalhe = item.detalhe ? ` (${item.detalhe})` : '';
  console.log(`[cleanup]   PROTEGIDO  ${item.login} — ${item.nome} — motivo: ${item.motivo}${detalhe}`);
}

console.log('\n[cleanup] --- B. Usuários candidatos à exclusão ---');
if (candidatos.length === 0) {
  console.log('[cleanup] (nenhum candidato — nada a limpar nesta equipe)');
}
for (const item of candidatos) {
  console.log(
    `[cleanup]   CANDIDATO  ${item.login} — ${item.nome} — equipeId=${item.equipeId} `
    + `ativo=${item.ativo} nivelHierarquico=${item.nivelHierarquico} — motivo: fora da allowlist e não é gestor`,
  );
}

console.log('\n[cleanup] --- C. Documentos que seriam excluídos (permitido pelas rules atuais) ---');
console.log(`[cleanup]   turnosMes: ${relacionados.turnosMes.length}`);
for (const documento of relacionados.turnosMes) {
  console.log(`[cleanup]     - turnosMes/${documento.id}`);
}
console.log(`[cleanup]   rascunhosTurnosMes: ${relacionados.rascunhosTurnosMes.length}`);
for (const documento of relacionados.rascunhosTurnosMes) {
  console.log(`[cleanup]     - rascunhosTurnosMes/${documento.id}`);
}

console.log('\n[cleanup] --- C-bis. Documentos candidatos, mas BLOQUEADOS pelas rules atuais (allow delete: if false) ---');
console.log(`[cleanup]   usuarios (candidatos): ${candidatos.length} — BLOQUEADO (usuarios nunca tem allow delete)`);
console.log(`[cleanup]   trocasEscala relacionadas: ${relacionados.trocasEscala.length} — BLOQUEADO`);
for (const documento of relacionados.trocasEscala) {
  console.log(`[cleanup]     - trocasEscala/${documento.id}`);
}
console.log('[cleanup]   notificacoesTroca relacionadas: não verificável — BLOQUEADO PARA LEITURA (a regra só deixa o próprio destinatário ler a própria notificação; nem o gestor consegue listar notificações de outra pessoa).');

console.log('\n[cleanup] --- D. Documentos somente para revisão manual (nunca apagados automaticamente) ---');
console.log(`[cleanup]   eventosEscala relacionados: ${relacionados.revisaoManual.eventosEscala.length}`);
console.log(`[cleanup]   versoesEscala relacionados: ${relacionados.revisaoManual.versoesEscala.length}`);
console.log(`[cleanup]   historicoPublicacoes da equipe (revisão manual, agregado por competência, não por login): ${relacionados.revisaoManual.historicoPublicacoes.length}`);
console.log(`[cleanup]   publicacoesEscala/estadoPublicacao da equipe (revisão manual): ${relacionados.revisaoManual.publicacoesEscala.length}`);

console.log('\n[cleanup] --- Coleções nunca tocadas por este script ---');
console.log('[cleanup]   config, equipes, tiposTurno (catálogo) — fora de escopo desta limpeza.');

// --- Execução real (só o que as rules permitem) ---

async function apagarDocumentos(nomeColecao, documentos) {
  if (documentos.length === 0) {
    return { apagados: 0, falhas: 0 };
  }
  let apagados = 0;
  let falhas = 0;
  for (const lote of fatiarEmLotes(documentos)) {
    const batch = writeBatch(db);
    for (const documento of lote) {
      batch.delete(doc(db, nomeColecao, documento.id));
    }
    try {
      await batch.commit();
      apagados += lote.length;
    } catch (falha) {
      falhas += lote.length;
      console.error(`[cleanup] falha ao apagar lote de ${nomeColecao}: ${falha instanceof Error ? falha.message : falha}`);
    }
  }
  return { apagados, falhas };
}

if (execute) {
  console.log('\n[cleanup] ===== EXECUTANDO =====');
  console.log(`[cleanup] projeto confirmado: ${projectId}`);
  console.log(`[cleanup] apagando ${relacionados.turnosMes.length} turnosMes e ${relacionados.rascunhosTurnosMes.length} rascunhosTurnosMes de ${candidatos.length} usuário(s) candidato(s).`);

  const resultadoTurnos = await apagarDocumentos('turnosMes', relacionados.turnosMes);
  const resultadoRascunhos = await apagarDocumentos('rascunhosTurnosMes', relacionados.rascunhosTurnosMes);

  console.log('\n[cleanup] --- contagem real apagada por coleção ---');
  console.log(`[cleanup]   turnosMes: ${resultadoTurnos.apagados} apagado(s), ${resultadoTurnos.falhas} falha(s)`);
  console.log(`[cleanup]   rascunhosTurnosMes: ${resultadoRascunhos.apagados} apagado(s), ${resultadoRascunhos.falhas} falha(s)`);
  console.log('[cleanup]   usuarios: 0 apagado — bloqueado pelas rules (allow delete: if false), não tentado.');
  console.log('[cleanup]   trocasEscala: 0 apagado — bloqueado pelas rules (allow delete: if false), não tentado.');
  console.log('[cleanup]   notificacoesTroca: 0 apagado — bloqueado pelas rules e não listável, não tentado.');
  console.log(
    '\n[cleanup] IMPORTANTE: usuarios/trocasEscala/notificacoesTroca continuam existindo — as rules atuais '
    + 'não permitem apagá-los pelo SDK cliente. Remova manualmente pelo Firebase Console se for indispensável, '
    + 'ou trate isso como uma decisão separada (mudar rules) em uma fase futura.',
  );
  console.log('\n[cleanup] Limpeza concluída em staging.');
} else {
  console.log('\n[cleanup] ================================================');
  console.log('[cleanup] DRY-RUN: nada foi apagado.');
  console.log('[cleanup] ================================================');
  console.log(`[cleanup] Para apagar de fato (só turnosMes/rascunhosTurnosMes, o resto fica bloqueado pelas rules), revise a lista de candidatos acima e rode:`);
  console.log(`[cleanup]   node scripts/cleanup-staging-demo-data.mjs --execute --confirm=${CONFIRMACAO_EXECUCAO}`);
}

// O SDK cliente mantém streams gRPC abertos; sem isso o processo não termina sozinho.
process.exit(0);
