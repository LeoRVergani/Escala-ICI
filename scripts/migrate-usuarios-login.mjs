/**
 * Migração usuarios/{uid} -> usuarios/{login} e turnosMes/rascunhosTurnosMes
 * para o esquema de ID por login, depois da refatoração que tornou o login
 * corporativo a chave funcional (ver firestore.rules e lib/firebase/*).
 *
 * NÃO EXECUTAR SEM APROVAÇÃO — este script escreve em staging. Roda em modo
 * --dry-run por padrão (só lista o que faria); precisa de --execute
 * explícito para gravar.
 *
 * ESCOPO: UMA EQUIPE POR VEZ
 *   Este script usa o SDK cliente do Firebase e respeita as Firestore
 *   Rules — o gestor autenticado só pode ler a própria equipe
 *   (`resource.data.equipeId == minhaEquipe()`), nunca a coleção inteira.
 *   Por isso o script:
 *     1. Autentica como o gestor (e-mail/senha).
 *     2. Descobre o perfil do gestor tentando, nessa ordem,
 *        `usuarios/{auth.currentUser.uid}` (ID antigo) e, se não existir,
 *        `usuarios/{loginDoEmail(email)}` (ID novo). Se nenhum existir, ou
 *        se o perfil encontrado não tiver `equipeId`, para com erro claro.
 *     3. Migra só os documentos com esse `equipeId` — nunca faz
 *        `getDocs(collection(db, 'usuarios'))` sem filtro, que as rules
 *        atuais negam (permission-denied) por listar a coleção inteira.
 *
 * O QUE FAZ (dentro da equipe do gestor)
 *   1. Para cada `usuarios/{uid}` (ID antigo) cujo `usuarios/{login}` ainda
 *      não existe, cria o novo documento com os MESMOS dados (nunca apaga
 *      nem edita o documento antigo — "não apagar usuários" é regra fixa
 *      deste projeto).
 *   2. Lê `turnosMes` e `rascunhosTurnosMes` cujo ID não bate com
 *      `{equipeId}_{login}_{competencia}` (ou seja, ainda usa o
 *      `usuarioUid` antigo como chave). Cria o documento no ID novo e só
 *      então apaga o antigo — essas coleções não são "usuários", então
 *      limpar o registro velho é seguro.
 *   3. Se o documento de destino já existir (`turnosMes`/`rascunhosTurnosMes`
 *      só, nunca `usuarios`), pula e reporta como conflito em vez de
 *      sobrescrever.
 *
 * USO
 *   ESCALA_MIGRACAO_EMAIL_GESTOR=marina.azevedo@empresa.com \
 *   ESCALA_MIGRACAO_SENHA_GESTOR='...' \
 *   node scripts/migrate-usuarios-login.mjs --dry-run
 *
 *   # Depois de revisar o plano impresso, para gravar de fato:
 *   ESCALA_MIGRACAO_EMAIL_GESTOR=marina.azevedo@empresa.com \
 *   ESCALA_MIGRACAO_SENHA_GESTOR='...' \
 *   node scripts/migrate-usuarios-login.mjs --execute --confirm=MIGRAR_STAGING
 *
 * Rode uma vez por gestor/equipe e confira o relatório de conflitos antes
 * de repetir para a próxima equipe.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

const arquivoEnv = resolve('.env.staging.dashboard');
if (!existsSync(arquivoEnv)) {
  throw new Error('Crie .env.staging.dashboard a partir do arquivo .example antes de migrar.');
}
Object.assign(process.env, parseEnv(readFileSync(arquivoEnv, 'utf8')));

const execute = process.argv.includes('--execute');
const confirmado = process.argv.includes('--confirm=MIGRAR_STAGING');
if (execute && !confirmado) {
  throw new Error('Para gravar de fato, use --execute --confirm=MIGRAR_STAGING.');
}
const modo = execute ? 'EXECUTANDO (grava no Firestore)' : 'DRY-RUN (só lista o plano)';

const email = process.env.ESCALA_MIGRACAO_EMAIL_GESTOR;
const senha = process.env.ESCALA_MIGRACAO_SENHA_GESTOR;
if (!email || !senha) {
  throw new Error('Defina ESCALA_MIGRACAO_EMAIL_GESTOR e ESCALA_MIGRACAO_SENHA_GESTOR.');
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[migrar-login] modo: ${modo}`);
console.log(`[migrar-login] projeto: ${process.env.VITE_FIREBASE_PROJECT_ID}`);

await signInWithEmailAndPassword(auth, email, senha);
const currentUser = auth.currentUser;
if (currentUser === null) {
  throw new Error('[migrar-login] auth.currentUser indisponível depois do login.');
}
console.log(`[migrar-login] autenticado como ${currentUser.email ?? email}`);

/**
 * Mesma derivação que `lib/firebase/authRepository.ts` e
 * `loginDoAuth()` em firestore.rules: o login corporativo é o e-mail sem
 * o domínio. Duplicado aqui (em vez de importado) porque este script roda
 * como .mjs solto via `node`, fora do build TS do app.
 */
function loginDoEmail(email) {
  return email.split('@')[0]?.toLowerCase().trim() ?? '';
}

function idDocumento(equipeId, login, competencia) {
  return `${equipeId}_${login}_${competencia}`;
}

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
    if (equipeId === '') {
      throw new Error(
        `[migrar-login] usuarios/${idCandidato} existe mas não tem equipeId válido — não dá para saber qual equipe migrar.`,
      );
    }
    return { docId: idCandidato, equipeId };
  }

  throw new Error(
    `[migrar-login] não encontrei o perfil do gestor em usuarios/${currentUser.uid} nem em usuarios/${loginDoEmail(currentUser.email ?? email)}. Cadastre o gestor antes de migrar.`,
  );
}

async function migrarUsuarios(equipeId) {
  const snapshot = await getDocs(
    query(collection(db, 'usuarios'), where('equipeId', '==', equipeId)),
  );
  let criados = 0;
  let jaExistiam = 0;
  let semLogin = 0;

  const logins = new Set(snapshot.docs.map((item) => item.id));

  for (const antigo of snapshot.docs) {
    const dados = antigo.data();
    const login = typeof dados.login === 'string' ? dados.login.trim() : '';
    if (login === '') {
      semLogin += 1;
      console.warn(`[migrar-login] usuarios/${antigo.id} sem campo login válido — pulei.`);
      continue;
    }
    if (antigo.id === login) {
      continue; // já está no esquema novo.
    }
    if (logins.has(login)) {
      jaExistiam += 1;
      console.log(`[migrar-login] usuarios/${login} já existe — usuarios/${antigo.id} fica como legado, não apagado.`);
      continue;
    }
    console.log(`[migrar-login] usuarios/${antigo.id} -> usuarios/${login}`);
    if (execute) {
      await setDoc(doc(db, 'usuarios', login), dados);
    }
    criados += 1;
  }

  console.log(`[migrar-login] usuarios: ${criados} criado(s), ${jaExistiam} já existente(s), ${semLogin} sem login válido.`);
  return { criados, jaExistiam, semLogin };
}

async function migrarColecaoEscala(nomeColecao, equipeId) {
  const snapshot = await getDocs(
    query(collection(db, nomeColecao), where('equipeId', '==', equipeId)),
  );
  const existentes = new Set(snapshot.docs.map((item) => item.id));

  let migrados = 0;
  let conflitos = 0;
  let jaNoEsquemaNovo = 0;

  for (const antigo of snapshot.docs) {
    const dados = antigo.data();
    const login = typeof dados.login === 'string' ? dados.login.trim() : '';
    const equipeDoDoc = typeof dados.equipeId === 'string' ? dados.equipeId.trim() : '';
    const competencia = typeof dados.competencia === 'string' ? dados.competencia.trim() : '';
    if (login === '' || equipeDoDoc === '' || competencia === '') {
      console.warn(`[migrar-login] ${nomeColecao}/${antigo.id} sem equipeId/login/competencia válidos — pulei.`);
      continue;
    }

    const idNovo = idDocumento(equipeDoDoc, login, competencia);
    if (antigo.id === idNovo) {
      jaNoEsquemaNovo += 1;
      continue;
    }
    if (existentes.has(idNovo)) {
      conflitos += 1;
      console.warn(`[migrar-login] conflito: ${nomeColecao}/${idNovo} já existe — ${nomeColecao}/${antigo.id} NÃO foi migrado nem apagado.`);
      continue;
    }

    console.log(`[migrar-login] ${nomeColecao}/${antigo.id} -> ${nomeColecao}/${idNovo}`);
    if (execute) {
      await setDoc(doc(db, nomeColecao, idNovo), { ...dados, usuarioUid: login, login });
      await deleteDoc(antigo.ref);
    }
    migrados += 1;
  }

  console.log(`[migrar-login] ${nomeColecao}: ${migrados} migrado(s), ${conflitos} conflito(s), ${jaNoEsquemaNovo} já no esquema novo.`);
  return { migrados, conflitos, jaNoEsquemaNovo };
}

const perfilGestor = await carregarPerfilGestor();
console.log(`[migrar-login] perfil do gestor encontrado em usuarios/${perfilGestor.docId}`);
console.log(`[migrar-login] equipeId: ${perfilGestor.equipeId}`);

const resultadoUsuarios = await migrarUsuarios(perfilGestor.equipeId);
const resultadoTurnos = await migrarColecaoEscala('turnosMes', perfilGestor.equipeId);
const resultadoRascunhos = await migrarColecaoEscala('rascunhosTurnosMes', perfilGestor.equipeId);

const totalConflitos = resultadoUsuarios.jaExistiam + resultadoTurnos.conflitos + resultadoRascunhos.conflitos;

console.log('[migrar-login] ----- resumo -----');
console.log(`[migrar-login] gestor autenticado: ${currentUser.email ?? email}`);
console.log(`[migrar-login] equipeId migrada: ${perfilGestor.equipeId}`);
console.log(`[migrar-login] usuarios que seriam criados em usuarios/{login}: ${resultadoUsuarios.criados}`);
console.log(`[migrar-login] turnosMes que seriam migrados para ID por login: ${resultadoTurnos.migrados}`);
console.log(`[migrar-login] rascunhosTurnosMes que seriam migrados para ID por login: ${resultadoRascunhos.migrados}`);
console.log(`[migrar-login] conflitos: ${totalConflitos} (usuarios: ${resultadoUsuarios.jaExistiam}, turnosMes: ${resultadoTurnos.conflitos}, rascunhosTurnosMes: ${resultadoRascunhos.conflitos})`);

if (!execute) {
  console.log('[migrar-login] confirmação: nada foi gravado no Firestore (dry-run). Revise o plano acima antes de rodar com --execute --confirm=MIGRAR_STAGING.');
}

// O SDK cliente mantém streams gRPC abertos; sem isso o processo não termina sozinho.
process.exit(0);
