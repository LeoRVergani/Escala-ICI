/**
 * Semeia a hierarquia inicial de `unidadesOrganizacionais` (e algumas
 * `equipes` de exemplo já vinculadas a ela) em staging — modelo
 * organizacional flexível descrito em `lib/modelos.ts`
 * (`UnidadeOrganizacional`) e `firestore.rules`
 * (`match /unidadesOrganizacionais/{unidadeId}`).
 *
 * NÃO EXECUTAR SEM APROVAÇÃO — este script escreve em staging. Roda em modo
 * --dry-run por padrão (só lista o que faria); precisa de --execute
 * explícito para gravar. Requer autenticação como ADMIN_SISTEMA (as rules
 * só permitem criar unidade raiz — `parentId: null` — para admin; um
 * GESTOR_UNIDADE só cria filhas dentro do seu próprio escopo).
 *
 * O QUE SEMEIA
 *   Unidades (hierarquia real da Diretoria de Infraestrutura e Segurança):
 *     DIRETOR_PRESIDENTE (raiz)
 *       -> DIR_INFRA_SEGURANCA
 *            -> GEDSI
 *                 -> COSI
 *                 -> CODB
 *                      -> SUPERVISOR_TI
 *            -> GESUP
 *                 -> COSD
 *                 -> COAT
 *   Equipes (vínculo direto da escala, `turnosMes.equipeId` — nunca
 *   alterado por este script):
 *     EQ_SOC          (sob COSI)
 *     EQ_PLANTAO_COSI (sob COSI)
 *     EQ_NOC          (sob SUPERVISOR_TI)
 *
 * `caminho`/`caminhoUnidade` são resolvidos aqui, em memória, a partir de
 * `parentId` — nunca em firestore.rules (que não percorre `parentId`, só
 * lê arrays explícitos de permissão).
 *
 * Convenção para equipes homônimas em áreas diferentes (documentada, NÃO
 * semeada por este script): prefixar o ID com a coordenação, ex.
 * `EQ_COSD_TECNICO_N2` (sob COSD) vs `EQ_COAT_TECNICO_N2` (sob COAT) — o
 * mesmo cargo "Técnico N2" existe nas duas coordenações, mas como equipes
 * distintas.
 *
 * USO
 *   ESCALA_SEED_ORG_EMAIL_ADMIN=admin@empresa.com \
 *   ESCALA_SEED_ORG_SENHA_ADMIN='...' \
 *   node scripts/seed-organizacao.mjs --dry-run
 *
 *   # Depois de revisar o plano impresso, para gravar de fato:
 *   ESCALA_SEED_ORG_EMAIL_ADMIN=admin@empresa.com \
 *   ESCALA_SEED_ORG_SENHA_ADMIN='...' \
 *   node scripts/seed-organizacao.mjs --execute --confirm=SEED_ORGANIZACAO_STAGING
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

const arquivoEnv = resolve('.env.staging.dashboard');
if (!existsSync(arquivoEnv)) {
  throw new Error('Crie .env.staging.dashboard a partir do arquivo .example antes de semear.');
}
Object.assign(process.env, parseEnv(readFileSync(arquivoEnv, 'utf8')));

const execute = process.argv.includes('--execute');
const confirmado = process.argv.includes('--confirm=SEED_ORGANIZACAO_STAGING');
if (execute && !confirmado) {
  throw new Error('Para gravar de fato, use --execute --confirm=SEED_ORGANIZACAO_STAGING.');
}
const modo = execute ? 'EXECUTANDO (grava no Firestore)' : 'DRY-RUN (só lista o plano)';

const email = process.env.ESCALA_SEED_ORG_EMAIL_ADMIN;
const senha = process.env.ESCALA_SEED_ORG_SENHA_ADMIN;
if (!email || !senha) {
  throw new Error('Defina ESCALA_SEED_ORG_EMAIL_ADMIN e ESCALA_SEED_ORG_SENHA_ADMIN.');
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[seed-organizacao] modo: ${modo}`);
console.log(`[seed-organizacao] projeto: ${process.env.VITE_FIREBASE_PROJECT_ID}`);

await signInWithEmailAndPassword(auth, email, senha);
const currentUser = auth.currentUser;
if (currentUser === null) {
  throw new Error('[seed-organizacao] auth.currentUser indisponível depois do login.');
}
console.log(`[seed-organizacao] autenticado como ${currentUser.email ?? email}`);

/** Mesma derivação de `loginDoAuth()` em firestore.rules. */
function loginDoEmail(emailAutenticado) {
  return emailAutenticado.split('@')[0]?.toLowerCase().trim() ?? '';
}

const login = loginDoEmail(currentUser.email ?? email);

async function confirmarAdminSistema() {
  const snapshot = await getDoc(doc(db, 'usuarios', login));
  if (!snapshot.exists()) {
    throw new Error(`[seed-organizacao] usuarios/${login} não existe — cadastre o ADMIN_SISTEMA antes de semear.`);
  }
  if (snapshot.data().perfil !== 'ADMIN_SISTEMA') {
    throw new Error(`[seed-organizacao] usuarios/${login} não tem perfil ADMIN_SISTEMA — as rules negariam a criação de unidades raiz.`);
  }
}

/**
 * Ordem parent-first — cada unidade referencia o `unidadeId` de uma
 * anterior na lista (ou `null` para raiz). `caminho` é resolvido abaixo, em
 * memória, antes de qualquer escrita.
 */
const UNIDADES_SEM_CAMINHO = [
  { unidadeId: 'DIRETOR_PRESIDENTE', nome: 'Diretor Presidente', sigla: 'PRESIDENCIA', tipo: 'PRESIDENCIA', parentId: null },
  { unidadeId: 'DIR_INFRA_SEGURANCA', nome: 'Diretoria de Infraestrutura e Segurança da Informação', sigla: 'DIR_INFRA_SEG', tipo: 'DIRETORIA', parentId: 'DIRETOR_PRESIDENTE' },
  { unidadeId: 'GEDSI', nome: 'Gerência de Data Center e Segurança da Informação', sigla: 'GEDSI', tipo: 'GERENCIA', parentId: 'DIR_INFRA_SEGURANCA' },
  { unidadeId: 'COSI', nome: 'COSI', sigla: 'COSI', tipo: 'COORDENACAO', parentId: 'GEDSI' },
  { unidadeId: 'CODB', nome: 'CODB', sigla: 'CODB', tipo: 'COORDENACAO', parentId: 'GEDSI' },
  { unidadeId: 'SUPERVISOR_TI', nome: 'Supervisor de TI', sigla: 'SUP_TI', tipo: 'SUPERVISAO', parentId: 'CODB' },
  { unidadeId: 'GESUP', nome: 'Gerência de Suporte Técnico', sigla: 'GESUP', tipo: 'GERENCIA', parentId: 'DIR_INFRA_SEGURANCA' },
  { unidadeId: 'COSD', nome: 'COSD', sigla: 'COSD', tipo: 'COORDENACAO', parentId: 'GESUP' },
  { unidadeId: 'COAT', nome: 'COAT', sigla: 'COAT', tipo: 'COORDENACAO', parentId: 'GESUP' },
];

const EQUIPES_SEM_CAMINHO = [
  { id: 'EQ_SOC', nome: 'SOC', sigla: 'SOC', unidadeId: 'COSI' },
  { id: 'EQ_PLANTAO_COSI', nome: 'Plantão COSI', sigla: 'PLANTAO_COSI', unidadeId: 'COSI' },
  { id: 'EQ_NOC', nome: 'NOC', sigla: 'NOC', unidadeId: 'SUPERVISOR_TI' },
];

function resolverCaminhos(unidadesSemCaminho) {
  const porId = new Map(unidadesSemCaminho.map((unidade) => [unidade.unidadeId, unidade]));
  const caminhoPorId = new Map();

  function caminhoDe(unidadeId) {
    if (caminhoPorId.has(unidadeId)) {
      return caminhoPorId.get(unidadeId);
    }
    const unidade = porId.get(unidadeId);
    if (unidade === undefined) {
      throw new Error(`[seed-organizacao] parentId "${unidadeId}" não existe em UNIDADES_SEM_CAMINHO.`);
    }
    const caminho = unidade.parentId === null
      ? [unidade.unidadeId]
      : [...caminhoDe(unidade.parentId), unidade.unidadeId];
    caminhoPorId.set(unidadeId, caminho);
    return caminho;
  }

  return unidadesSemCaminho.map((unidade) => ({ ...unidade, caminho: caminhoDe(unidade.unidadeId) }));
}

const agora = new Date().toISOString();
const unidades = resolverCaminhos(UNIDADES_SEM_CAMINHO).map((unidade) => ({
  ...unidade,
  ativa: true,
  criadoPorLogin: login,
  criadoEm: agora,
  atualizadoEm: agora,
}));
const caminhoPorUnidadeId = new Map(unidades.map((unidade) => [unidade.unidadeId, unidade.caminho]));
const equipes = EQUIPES_SEM_CAMINHO.map((equipe) => ({
  ...equipe,
  ativa: true,
  caminhoUnidade: caminhoPorUnidadeId.get(equipe.unidadeId),
}));

console.log('[seed-organizacao] plano de unidadesOrganizacionais:');
for (const unidade of unidades) {
  console.log(`  ${unidade.unidadeId} (${unidade.tipo}) — ${unidade.caminho.join(' > ')}`);
}
console.log('[seed-organizacao] plano de equipes:');
for (const equipe of equipes) {
  console.log(`  ${equipe.id} — unidadeId=${equipe.unidadeId} — caminhoUnidade=${equipe.caminhoUnidade.join(' > ')}`);
}

if (execute) {
  await confirmarAdminSistema();
  for (const unidade of unidades) {
    await setDoc(doc(db, 'unidadesOrganizacionais', unidade.unidadeId), unidade, { merge: true });
  }
  for (const equipe of equipes) {
    await setDoc(doc(db, 'equipes', equipe.id), equipe, { merge: true });
  }
  console.log(`[seed-organizacao] gravado: ${unidades.length} unidade(s), ${equipes.length} equipe(s).`);
} else {
  console.log('[seed-organizacao] confirmação: nada foi gravado no Firestore (dry-run). Revise o plano acima antes de rodar com --execute --confirm=SEED_ORGANIZACAO_STAGING.');
}

// O SDK cliente mantém streams gRPC abertos; sem isso o processo não termina sozinho.
process.exit(0);
