import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const PROJECT_ID = 'demo-escala-ici-fase3i';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const AUTH_URL = 'http://127.0.0.1:9099';
const SENHA_LOCAL = 'EscalaLocal#2026';
const EQUIPE_ID = 'EQ_COSI_SOC';

const CATALOGO_SOC = {
  MD: {
    codigo: 'MD', descricao: 'Madrugada', categoria: 'TRABALHO',
    horaInicio: '01:00', horaFim: '07:00', duracaoMinutos: 360, viraDia: false,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['MADRUGADA', 'MD'],
  },
  M: {
    codigo: 'M', descricao: 'Manhã', categoria: 'TRABALHO',
    horaInicio: '07:00', horaFim: '13:00', duracaoMinutos: 360, viraDia: false,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['MANHA', 'MANHÃ', 'M'],
  },
  T: {
    codigo: 'T', descricao: 'Tarde', categoria: 'TRABALHO',
    horaInicio: '13:00', horaFim: '19:00', duracaoMinutos: 360, viraDia: false,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['TARDE', 'T'],
  },
  N: {
    codigo: 'N', descricao: 'Noite', categoria: 'TRABALHO',
    horaInicio: '19:00', horaFim: '01:00', duracaoMinutos: 360, viraDia: true,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['NOITE', 'N'],
  },
  X: {
    codigo: 'X', descricao: 'Férias', categoria: 'AUSENCIA',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#0070C0', aliasesXLS: ['X', 'FERIAS', 'FÉRIAS'],
  },
  DF: {
    codigo: 'DF', descricao: 'DSR - Final de Semana', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#FF3399', aliasesXLS: ['DF'],
  },
  DU: {
    codigo: 'DU', descricao: 'DSR - Dia útil', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#00B050', aliasesXLS: ['DU'],
  },
  BH: {
    codigo: 'BH', descricao: 'Compensação BH', categoria: 'COMPENSACAO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#FFD966', aliasesXLS: ['BH'],
  },
  FOLGA: {
    codigo: 'FOLGA', descricao: 'Folga - Feriado', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#CC99FF', aliasesXLS: ['FOLGA'],
  },
  AN: {
    codigo: 'AN', descricao: 'Folga Aniversário', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#99CCFF', aliasesXLS: ['AN'],
  },
  HE: {
    codigo: 'HE', descricao: 'Hora Extra', categoria: 'EXTRA',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#00B0F0', aliasesXLS: ['HE'],
  },
  AFA: {
    codigo: 'AFA', descricao: 'Afastamento Atestado', categoria: 'AUSENCIA',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#404040', aliasesXLS: ['#', 'AT', 'ATESTADO', 'AFASTAMENTO'],
  },
};

const CONTADORES = {
  DF: 'df', DU: 'du', X: 'x', HE: 'he', BH: 'bh', AN: 'an',
  FOLGA: 'folga', AFA: 'afa', '#': 'afa',
};

const contas = [
  {
    email: 'marina.azevedo@teste.local', login: 'mazevedo',
    nome: 'Marina Azevedo', cargo: 'COORDENADORA_SOC',
    nivelHierarquico: 4, turnoPadrao: 'ADM',
  },
  {
    email: 'caio.monteiro@teste.local', login: 'cmonteiro',
    nome: 'Caio Monteiro', cargo: 'ANALISTA_SOC',
    nivelHierarquico: 6, turnoPadrao: 'MD', loginAliases: ['liavilar'],
  },
  {
    email: 'bianca.salles@teste.local', login: 'bsalles',
    nome: 'Bianca Salles', cargo: 'ANALISTA_SOC',
    nivelHierarquico: 6, turnoPadrao: 'M', loginAliases: ['noahcampos'],
  },
  {
    email: 'enzo.tavares@teste.local', login: 'etavares',
    nome: 'Enzo Tavares', cargo: 'ANALISTA_SOC',
    nivelHierarquico: 6, turnoPadrao: 'T', loginAliases: ['mayanunes'],
  },
];

const usuariosPlanilhaExemplo = [
  ['gaelfreire', 'Gael Freire', 'M'],
  ['irisporto', 'Íris Porto', 'M'],
  ['teosalles', 'Téo Salles', 'T'],
  ['auramatos', 'Aura Matos', 'T'],
  ['nilovalente', 'Nilo Valente', 'N'],
  ['evaprado', 'Eva Prado', 'N'],
].map(([login, nome, turnoPadrao]) => ({
  uid: `planilha-${login}`,
  email: `${login}@teste.local`,
  login,
  nome,
  cargo: 'ANALISTA_SOC',
  nivelHierarquico: 6,
  turnoPadrao,
  loginAliases: [],
}));

function calcularTotais(dias) {
  const totais = {
    min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0,
    he: 0, bh: 0, an: 0, folga: 0, afa: 0,
  };
  for (const dia of Object.values(dias)) {
    const codigo = dia.c.toUpperCase();
    if (CATALOGO_SOC[codigo]?.categoria === 'TRABALHO') {
      totais.diasTrabalhados += 1;
    }
    if (dia.m !== undefined) {
      totais.min += dia.m;
    }
    const contador = CONTADORES[codigo];
    if (contador !== undefined) {
      totais[contador] += 1;
    }
  }
  return totais;
}

function criarDias(codigo) {
  const dias = {};
  const data = new Date(Date.UTC(2026, 6, 26));
  for (let indice = 0; indice < 31; indice += 1) {
    const iso = data.toISOString().slice(0, 10);
    const codigoDia = data.getUTCDay() === 0 ? 'DF' : codigo;
    const tipo = CATALOGO_SOC[codigoDia];
    dias[iso] = tipo.categoria === 'TRABALHO'
      ? {
          c: tipo.codigo,
          i: tipo.horaInicio,
          f: tipo.horaFim,
          m: tipo.duracaoMinutos,
          vd: tipo.viraDia,
          seq: 1,
        }
      : { c: tipo.codigo };
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return dias;
}

const app = initializeApp({
  apiKey: 'demo-api-key',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  appId: '1:123456789012:web:abcdef1234567890',
}, `seed-${Date.now()}`);
const auth = getAuth(app);
connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });

const usuarios = [];
for (const conta of contas) {
  let credencial;
  try {
    credencial = await createUserWithEmailAndPassword(
      auth,
      conta.email,
      SENHA_LOCAL,
    );
  } catch (falha) {
    if (falha?.code !== 'auth/email-already-in-use') {
      throw falha;
    }
    credencial = await signInWithEmailAndPassword(
      auth,
      conta.email,
      SENHA_LOCAL,
    );
  }
  usuarios.push({ ...conta, uid: credencial.user.uid });
  await signOut(auth);
}

const regras = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const ambiente = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { host: FIRESTORE_HOST, port: FIRESTORE_PORT, rules: regras },
});
await ambiente.clearFirestore();

await ambiente.withSecurityRulesDisabled(async (contexto) => {
  const db = contexto.firestore();
  const gestor = usuarios[0];
  const chavePublicacao = `${EQUIPE_ID}_2026-08`;
  const publicacaoId = `${chavePublicacao}_000001`;
  const publicadoEm = '2026-07-31T12:00:00.000Z';

  await setDoc(doc(db, 'equipes', EQUIPE_ID), {
    id: EQUIPE_ID,
    organizacaoId: 'COSI',
    nome: 'COSI > SOC',
    sigla: 'SOC',
    ativa: true,
  });

  for (const tipo of Object.values(CATALOGO_SOC)) {
    await setDoc(doc(db, 'tiposTurno', `${EQUIPE_ID}_${tipo.codigo}`), {
      ...tipo,
      equipeId: EQUIPE_ID,
    });
  }

  for (const usuario of [...usuarios, ...usuariosPlanilhaExemplo]) {
    await setDoc(doc(db, 'usuarios', usuario.uid), {
      ...usuario,
      equipeId: EQUIPE_ID,
      gestorUid: usuario.uid === gestor.uid ? null : gestor.uid,
      ativo: true,
    });
  }

  for (const usuario of usuarios.slice(1)) {
    const dias = criarDias(usuario.turnoPadrao);
    const documento = {
      schemaVersion: 1,
      usuarioUid: usuario.uid,
      login: usuario.login,
      equipeId: EQUIPE_ID,
      competencia: '2026-08',
      periodoInicio: '2026-07-26',
      periodoFim: '2026-08-25',
      turnoPadrao: usuario.turnoPadrao,
      status: 'PUBLICADA',
      dias,
      totais: calcularTotais(dias),
      importacaoId: 'laboratorio-inicial',
      publicadoPor: gestor.uid,
      publicadoEm,
    };
    await setDoc(
      doc(db, 'turnosMes', `${EQUIPE_ID}_${usuario.uid}_2026-08`),
      documento,
    );
    await setDoc(
      doc(db, 'versoesEscala', `${publicacaoId}_${usuario.uid}`),
      { ...documento, chavePublicacao, revisao: 1 },
    );
  }

  await setDoc(doc(db, 'historicoPublicacoes', publicacaoId), {
    id: publicacaoId,
    chavePublicacao,
    equipeId: EQUIPE_ID,
    competencia: '2026-08',
    revisao: 1,
    tipo: 'SEED',
    revisaoOrigem: null,
    revisaoSubstituida: null,
    totalDocumentos: usuarios.length - 1,
    motivo: 'Carga inicial do laboratório',
    totalColaboradoresAfetados: usuarios.length - 1,
    totalDiasAlterados: (usuarios.length - 1) * 31,
    publicadoPor: gestor.uid,
    publicadoEm,
  });

  await setDoc(doc(db, 'publicacoesEscala', chavePublicacao), {
    id: chavePublicacao,
    equipeId: EQUIPE_ID,
    competencia: '2026-08',
    revisaoAtual: 1,
    ultimaPublicacaoId: publicacaoId,
    atualizadoPor: gestor.uid,
    atualizadoEm: publicadoEm,
  });

  await setDoc(doc(db, 'config', 'app'), {
    schemaVersionAtual: 1,
    schemaVersionMinima: 1,
    minBuildWeb: 1,
    ambiente: 'EMULADOR_LOCAL',
  });
});

await ambiente.cleanup();
await deleteApp(app);

console.log('Laboratório local carregado com dados totalmente fictícios.');
console.log(`Gestora: ${contas[0].email}`);
console.log(`Colaborador: ${contas[1].email}`);
console.log(`Senha de todas as contas: ${SENHA_LOCAL}`);
