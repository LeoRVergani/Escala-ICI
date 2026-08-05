/**
 * Migração usuarios/{uid} -> usuarios/{login} e turnosMes/rascunhosTurnosMes
 * para o esquema de ID por login, depois da refatoração que tornou o login
 * corporativo a chave funcional (ver firestore.rules e lib/firebase/*).
 *
 * NÃO EXECUTAR SEM APROVAÇÃO — este script escreve em staging. Roda em modo
 * --dry-run por padrão (só lista o que faria); precisa de --execute
 * explícito para gravar.
 *
 * O QUE FAZ
 *   1. Lê todo `usuarios/{uid}` existente (ID antigo). Para cada um cujo
 *      `usuarios/{login}` ainda não existe, cria o novo documento com os
 *      MESMOS dados (nunca apaga nem edita o documento antigo — "não
 *      apagar usuários" é regra fixa deste projeto).
 *   2. Lê `turnosMes` e `rascunhosTurnosMes` cujo ID não bate com
 *      `{equipeId}_{login}_{competencia}` (ou seja, ainda usa o
 *      `usuarioUid` antigo como chave). Cria o documento no ID novo e só
 *      então apaga o antigo — essas coleções não são "usuários", então
 *      limpar o registro velho é seguro.
 *   3. Se o documento de destino já existir (`turnosMes`/`rascunhosTurnosMes`
 *      só, nunca `usuarios`), pula e reporta como conflito em vez de
 *      sobrescrever.
 *
 * COMO FUNCIONA A AUTENTICAÇÃO
 *   Este script usa o SDK cliente do Firebase — o mesmo caminho do
 *   Dashboard — autenticando como um gestor real por e-mail/senha. Isso
 *   significa que ele só consegue escrever o que as Firestore Rules já
 *   permitem para esse gestor (mesma equipe). Não usa Admin SDK nem custom
 *   token.
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
 * Rode uma equipe por vez (o gestor só vê a própria equipe pelas rules) e
 * confira o relatório de conflitos antes de repetir para a próxima.
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
  getDocs,
  getFirestore,
  setDoc,
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
console.log(`[migrar-login] autenticado como ${email}`);

function idDocumento(equipeId, login, competencia) {
  return `${equipeId}_${login}_${competencia}`;
}

async function migrarUsuarios() {
  const snapshot = await getDocs(collection(db, 'usuarios'));
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
}

async function migrarColecaoEscala(nomeColecao) {
  const snapshot = await getDocs(collection(db, nomeColecao));
  const existentes = new Set(snapshot.docs.map((item) => item.id));

  let migrados = 0;
  let conflitos = 0;
  let jaNoEsquemaNovo = 0;

  for (const antigo of snapshot.docs) {
    const dados = antigo.data();
    const login = typeof dados.login === 'string' ? dados.login.trim() : '';
    const equipeId = typeof dados.equipeId === 'string' ? dados.equipeId.trim() : '';
    const competencia = typeof dados.competencia === 'string' ? dados.competencia.trim() : '';
    if (login === '' || equipeId === '' || competencia === '') {
      console.warn(`[migrar-login] ${nomeColecao}/${antigo.id} sem equipeId/login/competencia válidos — pulei.`);
      continue;
    }

    const idNovo = idDocumento(equipeId, login, competencia);
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
}

await migrarUsuarios();
await migrarColecaoEscala('turnosMes');
await migrarColecaoEscala('rascunhosTurnosMes');

if (!execute) {
  console.log('[migrar-login] nada foi gravado (dry-run). Revise o plano acima antes de rodar com --execute --confirm=MIGRAR_STAGING.');
}
