import {
  CATALOGO_SOC,
  idDocumento,
  parsePlanilhaEscala,
} from '@escala-ici/contrato';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

const PROJECT_ID = 'demo-escala-ici-fase3i';
const AUTH_URL = 'http://127.0.0.1:9099';
const SENHA = 'TesteLocal#2026';
const EQUIPE_COSI_SOC = 'EQ_COSI_SOC';
const EQUIPE_CODB_NOC = 'EQ_CODB_NOC';

let ambiente: RulesTestEnvironment;
const apps: FirebaseApp[] = [];
const identidades = {
  gestora: { uid: '', email: 'helena.prado@integracao.local' },
  colaborador: { uid: '', email: 'davi.freitas@integracao.local' },
  externo: { uid: '', email: 'lara.pires@integracao.local' },
};

function novoApp(nome: string): FirebaseApp {
  const app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    appId: '1:123456789012:web:abcdef1234567890',
  }, `${nome}-${Date.now()}-${Math.random()}`);
  apps.push(app);
  return app;
}

async function criarConta(email: string): Promise<string> {
  const app = novoApp(`cadastro-${email}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });
  const credencial = await createUserWithEmailAndPassword(auth, email, SENHA);
  return credencial.user.uid;
}

async function conectar(email: string): Promise<Firestore> {
  const app = novoApp(`sessao-${email}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email, SENHA);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return db;
}

function escala(status: 'RASCUNHO' | 'PUBLICADA') {
  return {
    schemaVersion: 1,
    equipeId: EQUIPE_COSI_SOC,
    usuarioUid: identidades.colaborador.uid,
    login: 'dfreitas',
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    turnoPadrao: 'M',
    status,
    dias: {
      '2026-07-31': { c: 'M', i: '07:00', f: '13:00', m: 360, vd: false, seq: 1 },
    },
    totais: {
      min: 360,
      diasTrabalhados: 1,
      df: 0,
      du: 0,
      x: 0,
      he: 0,
      bh: 0,
      an: 0,
      folga: 0,
      afa: 0,
    },
  };
}

beforeAll(async () => {
  const apagar = await fetch(
    `${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' },
  );
  expect(apagar.ok).toBe(true);

  identidades.gestora.uid = await criarConta(identidades.gestora.email);
  identidades.colaborador.uid = await criarConta(identidades.colaborador.email);
  identidades.externo.uid = await criarConta(identidades.externo.email);

  ambiente = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(
        new URL('../../firestore.rules', import.meta.url),
        'utf8',
      ),
    },
  });
  await ambiente.clearFirestore();
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    await Promise.all([
      setDoc(doc(db, 'usuarios', identidades.gestora.uid), {
        uid: identidades.gestora.uid,
        nome: 'Helena Prado',
        equipeId: EQUIPE_COSI_SOC,
        nivelHierarquico: 4,
      }),
      setDoc(doc(db, 'usuarios', identidades.colaborador.uid), {
        uid: identidades.colaborador.uid,
        nome: 'Davi Freitas',
        equipeId: EQUIPE_COSI_SOC,
        nivelHierarquico: 6,
      }),
      setDoc(doc(db, 'usuarios', identidades.externo.uid), {
        uid: identidades.externo.uid,
        nome: 'Lara Pires',
        equipeId: EQUIPE_CODB_NOC,
        nivelHierarquico: 6,
      }),
    ]);
  });
});

afterAll(async () => {
  await ambiente.cleanup();
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe('ciclo integrado Dashboard → Firestore → App', () => {
  it('preserva a escala ativa durante o rascunho, publica e executa rollback auditável', async () => {
    const dbGestora = await conectar(identidades.gestora.email);
    const dbColaborador = await conectar(identidades.colaborador.email);
    const chavePublicacao = `${EQUIPE_COSI_SOC}_2026-08`;
    const referencia = doc(dbGestora, 'turnosMes', 'ciclo-fase3jb');
    const rascunho = doc(dbGestora, 'rascunhosTurnosMes', 'ciclo-fase3jb');
    const revisaoInicial = escala('PUBLICADA');

    await setDoc(referencia, revisaoInicial);
    await setDoc(doc(dbGestora, 'versoesEscala', 'ciclo-fase3jb-v1'), {
      ...revisaoInicial,
      chavePublicacao,
      revisao: 1,
    });
    await setDoc(doc(dbGestora, 'historicoPublicacoes', 'ciclo-fase3jb-r1'), {
      id: 'ciclo-fase3jb-r1',
      chavePublicacao,
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisao: 1,
      tipo: 'SEED',
      revisaoOrigem: null,
      revisaoSubstituida: null,
      totalDocumentos: 1,
      publicadoPor: identidades.gestora.uid,
      publicadoEm: '2026-07-31T12:00:00.000Z',
    });
    await setDoc(doc(dbGestora, 'publicacoesEscala', chavePublicacao), {
      id: chavePublicacao,
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisaoAtual: 1,
      ultimaPublicacaoId: 'ciclo-fase3jb-r1',
      atualizadoPor: identidades.gestora.uid,
      atualizadoEm: '2026-07-31T12:00:00.000Z',
    });

    const proximaEscala = {
      ...escala('RASCUNHO'),
      dias: {
        '2026-07-31': { c: 'T', i: '13:00', f: '19:00', m: 360, vd: false, seq: 1 },
      },
    };
    await setDoc(rascunho, proximaEscala);
    await assertFails(getDoc(doc(dbColaborador, 'rascunhosTurnosMes', 'ciclo-fase3jb')));
    const aindaAtiva = await getDoc(doc(dbColaborador, 'turnosMes', 'ciclo-fase3jb'));
    expect(aindaAtiva.data()?.dias['2026-07-31'].c).toBe('M');

    const publicadaR2 = {
      ...proximaEscala,
      status: 'PUBLICADA',
      publicadoPor: identidades.gestora.uid,
      publicadoEm: '2026-08-01T12:00:00.000Z',
    };
    await setDoc(referencia, publicadaR2);
    await setDoc(doc(dbGestora, 'versoesEscala', 'ciclo-fase3jb-v2'), {
      ...publicadaR2,
      chavePublicacao,
      revisao: 2,
    });
    await setDoc(doc(dbGestora, 'historicoPublicacoes', 'ciclo-fase3jb-r2'), {
      id: 'ciclo-fase3jb-r2',
      chavePublicacao,
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisao: 2,
      tipo: 'PUBLICACAO',
      revisaoOrigem: null,
      revisaoSubstituida: 1,
      totalDocumentos: 1,
      publicadoPor: identidades.gestora.uid,
      publicadoEm: '2026-08-01T12:00:00.000Z',
    });
    await updateDoc(doc(dbGestora, 'publicacoesEscala', chavePublicacao), {
      revisaoAtual: 2,
      ultimaPublicacaoId: 'ciclo-fase3jb-r2',
    });
    await deleteDoc(rascunho);
    const atualizada = await getDoc(doc(dbColaborador, 'turnosMes', 'ciclo-fase3jb'));
    expect(atualizada.data()?.dias['2026-07-31'].c).toBe('T');

    const rollbackR3 = {
      ...revisaoInicial,
      publicadoPor: identidades.gestora.uid,
      publicadoEm: '2026-08-01T13:00:00.000Z',
    };
    await setDoc(referencia, rollbackR3);
    await setDoc(doc(dbGestora, 'versoesEscala', 'ciclo-fase3jb-v3'), {
      ...rollbackR3,
      chavePublicacao,
      revisao: 3,
      restauradaDe: `${chavePublicacao}_000001`,
    });
    await setDoc(doc(dbGestora, 'historicoPublicacoes', 'ciclo-fase3jb-r3'), {
      id: 'ciclo-fase3jb-r3',
      chavePublicacao,
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisao: 3,
      tipo: 'ROLLBACK',
      revisaoOrigem: 1,
      revisaoSubstituida: 2,
      totalDocumentos: 1,
      publicadoPor: identidades.gestora.uid,
      publicadoEm: '2026-08-01T13:00:00.000Z',
    });
    await updateDoc(doc(dbGestora, 'publicacoesEscala', chavePublicacao), {
      revisaoAtual: 3,
      ultimaPublicacaoId: 'ciclo-fase3jb-r3',
    });
    const restaurada = await getDoc(doc(dbColaborador, 'turnosMes', 'ciclo-fase3jb'));
    expect(restaurada.data()?.dias['2026-07-31'].c).toBe('M');

    const historico = await getDocs(query(
      collection(dbGestora, 'historicoPublicacoes'),
      where('equipeId', '==', EQUIPE_COSI_SOC),
      where('competencia', '==', '2026-08'),
      where('chavePublicacao', '==', chavePublicacao),
    ));
    const versaoRestaurada = await getDocs(query(
      collection(dbGestora, 'versoesEscala'),
      where('equipeId', '==', EQUIPE_COSI_SOC),
      where('chavePublicacao', '==', chavePublicacao),
      where('revisao', '==', 1),
    ));
    expect(historico.size).toBe(3);
    expect(versaoRestaurada.size).toBe(1);

    await assertFails(updateDoc(
      doc(dbColaborador, 'turnosMes', 'ciclo-fase3jb'),
      { status: 'RASCUNHO' },
    ));
    await assertFails(getDoc(doc(dbColaborador, 'historicoPublicacoes', 'ciclo-fase3jb-r3')));
    await assertFails(getDocs(query(
      collection(dbColaborador, 'historicoPublicacoes'),
      where('equipeId', '==', EQUIPE_COSI_SOC),
    )));
  });

  it('importa o XLS de exemplo, salva rascunho, publica e permite leitura no App', async () => {
    const dbGestora = await conectar(identidades.gestora.email);
    const dbColaborador = await conectar(identidades.colaborador.email);
    const logins = [
      'liavilar',
      'noahcampos',
      'mayanunes',
      'gaelfreire',
      'irisporto',
      'teosalles',
      'auramatos',
      'nilovalente',
      'evaprado',
    ];
    const loginParaUid = Object.fromEntries(logins.map((login, indice) => [
      login,
      indice === 0 ? identidades.colaborador.uid : `importado-${login}`,
    ]));

    for (const login of logins.slice(1)) {
      await setDoc(doc(dbGestora, 'usuarios', loginParaUid[login]!), {
        uid: loginParaUid[login],
        login,
        nome: login,
        email: `${login}@empresa.com`,
        cargo: 'ANALISTA_SOC',
        equipeId: EQUIPE_COSI_SOC,
        gestorUid: identidades.gestora.uid,
        nivelHierarquico: 6,
        turnoPadrao: 'M',
        ativo: true,
      });
    }

    const arquivo = await readFile(
      new URL('../../public/demo/Escala-SOC-Controle-Agosto.xls', import.meta.url),
    );
    const buffer = arquivo.buffer.slice(
      arquivo.byteOffset,
      arquivo.byteOffset + arquivo.byteLength,
    ) as ArrayBuffer;
    const resultado = parsePlanilhaEscala(buffer, {
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      catalogo: CATALOGO_SOC,
      loginParaUid,
    });
    expect(resultado.ok).toBe(true);
    expect(resultado.documentos).toHaveLength(9);
    expect(resultado.documentos[0]?.usuarioUid).toBe(identidades.colaborador.uid);

    const rascunho = writeBatch(dbGestora);
    for (const documento of resultado.documentos) {
      rascunho.set(doc(
        dbGestora,
        'rascunhosTurnosMes',
        idDocumento(documento.equipeId, documento.usuarioUid, documento.competencia),
      ), documento);
    }
    await rascunho.commit();
    await assertFails(getDocs(query(
      collection(dbColaborador, 'rascunhosTurnosMes'),
      where('equipeId', '==', EQUIPE_COSI_SOC),
    )));

    const publicadoEm = '2026-08-02T18:00:00.000Z';
    const publicacao = writeBatch(dbGestora);
    for (const documento of resultado.documentos) {
      const id = idDocumento(documento.equipeId, documento.usuarioUid, documento.competencia);
      const publicado = {
        ...documento,
        status: 'PUBLICADA',
        publicadoPor: identidades.gestora.uid,
        publicadoEm,
      } as const;
      publicacao.set(doc(dbGestora, 'turnosMes', id), publicado);
      publicacao.set(doc(dbGestora, 'versoesEscala', `importacao-xls-${documento.usuarioUid}`), {
        ...publicado,
        chavePublicacao: `${EQUIPE_COSI_SOC}_2026-08`,
        revisao: 4,
      });
      publicacao.delete(doc(dbGestora, 'rascunhosTurnosMes', id));
    }
    publicacao.set(doc(dbGestora, 'historicoPublicacoes', 'importacao-xls-r4'), {
      id: 'importacao-xls-r4',
      chavePublicacao: `${EQUIPE_COSI_SOC}_2026-08`,
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisao: 4,
      tipo: 'PUBLICACAO',
      revisaoOrigem: null,
      revisaoSubstituida: 3,
      totalDocumentos: resultado.documentos.length,
      publicadoPor: identidades.gestora.uid,
      publicadoEm,
    });
    publicacao.set(doc(dbGestora, 'publicacoesEscala', `${EQUIPE_COSI_SOC}_2026-08`), {
      id: `${EQUIPE_COSI_SOC}_2026-08`,
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisaoAtual: 4,
      ultimaPublicacaoId: 'importacao-xls-r4',
      atualizadoPor: identidades.gestora.uid,
      atualizadoEm: publicadoEm,
    });
    await publicacao.commit();

    const escalaNoApp = await getDocs(query(
      collection(dbColaborador, 'turnosMes'),
      where('usuarioUid', '==', identidades.colaborador.uid),
      where('equipeId', '==', EQUIPE_COSI_SOC),
      where('competencia', '==', '2026-08'),
      where('status', '==', 'PUBLICADA'),
    ));
    expect(escalaNoApp.docs.some((snapshot) =>
      snapshot.data().login === 'liavilar')).toBe(true);
  });

  it('sincroniza a publicação em tempo real e entrega o antes e depois ao usuário afetado', async () => {
    const dbGestora = await conectar(identidades.gestora.email);
    const dbColaborador = await conectar(identidades.colaborador.email);
    const idEvento = `evento-tempo-real-${Date.now()}`;
    const consulta = query(
      collection(dbColaborador, 'eventosEscala'),
      where('usuarioUid', '==', identidades.colaborador.uid),
      where('equipeId', '==', EQUIPE_COSI_SOC),
    );

    const recebido = new Promise<Record<string, unknown>>((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error('Evento em tempo real não recebido.')), 5_000);
      const cancelar = onSnapshot(consulta, (snapshot) => {
        const encontrado = snapshot.docs.find((documento) => documento.id === idEvento);
        if (encontrado !== undefined) {
          clearTimeout(limite);
          cancelar();
          resolve(encontrado.data());
        }
      }, reject);
    });

    await setDoc(doc(dbGestora, 'eventosEscala', idEvento), {
      id: idEvento,
      publicacaoId: 'publicacao-tempo-real',
      equipeId: EQUIPE_COSI_SOC,
      competencia: '2026-08',
      revisao: 5,
      tipo: 'PUBLICACAO',
      usuarioUid: identidades.colaborador.uid,
      motivo: 'Ajuste da cobertura da madrugada',
      publicadoPor: identidades.gestora.uid,
      publicadoEm: '2026-08-02T21:36:00.000Z',
      alteracoes: [{
        usuarioUid: identidades.colaborador.uid,
        login: 'dfreitas',
        data: '2026-08-05',
        codigoAnterior: 'MD',
        horarioAnterior: '01:00–07:00',
        codigoNovo: 'M',
        horarioNovo: '07:00–13:00',
      }],
    });

    const evento = await recebido;
    expect(evento.motivo).toBe('Ajuste da cobertura da madrugada');
    expect(evento.alteracoes).toEqual([expect.objectContaining({
      data: '2026-08-05',
      codigoAnterior: 'MD',
      codigoNovo: 'M',
    })]);
  });

  it('mantém COSI/SOC isolado de CODB/NOC', async () => {
    const dbExterno = await conectar(identidades.externo.email);
    await assertFails(getDoc(doc(dbExterno, 'turnosMes', 'ciclo-fase3jb')));
  });
});
