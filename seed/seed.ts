import { CATALOGO_SOC } from '@escala-ici/contrato';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

interface UsuarioSeed {
  uid: string;
  login: string;
  nome: string;
  turnoPadrao: string;
  ativo?: boolean;
  /** Nomes alternativos vindos da planilha, para a conciliação de importação. */
  aliasesPlanilha?: string[];
}

function variavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável obrigatória ausente: ${nome}`);
  }
  return valor;
}

const app = initializeApp({
  apiKey: variavel('VITE_FIREBASE_API_KEY'),
  authDomain: variavel('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: variavel('VITE_FIREBASE_PROJECT_ID'),
  appId: variavel('VITE_FIREBASE_APP_ID'),
});

const auth = getAuth(app);
const db = getFirestore(app);
const credencial = await signInWithEmailAndPassword(
  auth,
  variavel('FIREBASE_SEED_EMAIL'),
  variavel('FIREBASE_SEED_PASSWORD'),
);

const usuarios = JSON.parse(
  await readFile(new URL('./usuarios.json', import.meta.url), 'utf8'),
) as UsuarioSeed[];

if (usuarios.some(({ uid }) => uid.startsWith('SUBSTITUA_'))) {
  throw new Error(
    'Substitua os UIDs em seed/usuarios.json pelos UIDs criados no Firebase Authentication.',
  );
}

const lote = writeBatch(db);
lote.set(doc(db, 'equipes', 'EQ_SOC'), {
  id: 'EQ_SOC',
  nome: 'COSI > SOC',
  sigla: 'SOC',
  ativa: true,
  atualizadoEm: serverTimestamp(),
});

for (const tipo of Object.values(CATALOGO_SOC)) {
  lote.set(doc(db, 'tiposTurno', `EQ_SOC_${tipo.codigo}`), {
    ...tipo,
    equipeId: 'EQ_SOC',
  });
}

const agora = new Date().toISOString();
for (const usuario of usuarios) {
  lote.set(doc(db, 'usuarios', usuario.uid), {
    uid: usuario.uid,
    login: usuario.login,
    nome: usuario.nome,
    email: `${usuario.login}@empresa.com`,
    cargo: 'ANALISTA_SOC',
    equipeId: 'EQ_SOC',
    gestorUid: credencial.user.uid,
    nivelHierarquico: 6,
    turnoPadrao: usuario.turnoPadrao,
    ativo: usuario.ativo ?? true,
    aliasesPlanilha: usuario.aliasesPlanilha ?? [],
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

lote.set(doc(db, 'config', 'app'), {
  schemaVersionAtual: 1,
  schemaVersionMinima: 1,
  minBuildWeb: 1,
  mensagemAtualizacao: 'Atualize a página para continuar.',
});

await lote.commit();
console.log(`Seed concluído: ${usuarios.length} usuários e ${Object.keys(CATALOGO_SOC).length} tipos de turno.`);
