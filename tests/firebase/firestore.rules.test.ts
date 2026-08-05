import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const PROJECT_ID = 'demo-escala-ici-fase3i';
let ambiente: RulesTestEnvironment;

const usuarios = {
  gestor: {
    uid: 'gestora-cosi-soc',
    nome: 'Marina Azevedo',
    email: 'marina.azevedo@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 5,
  },
  colaborador: {
    uid: 'colaborador-cosi-soc',
    nome: 'Caio Monteiro',
    email: 'caio.monteiro@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 6,
  },
  colega: {
    uid: 'colega-cosi-soc',
    nome: 'Bianca Salles',
    email: 'bianca.salles@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 6,
  },
  externo: {
    uid: 'operador-codb-noc',
    nome: 'Ravi Nogueira',
    email: 'ravi.nogueira@teste.local',
    equipeId: 'EQ_CODB_NOC',
    nivelHierarquico: 6,
  },
} as const;

function escala(
  usuarioUid: string,
  equipeId: string,
  status: 'RASCUNHO' | 'PUBLICADA',
) {
  return {
    schemaVersion: 1,
    equipeId,
    usuarioUid,
    login: usuarioUid,
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    status,
    dias: {},
  };
}

beforeAll(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile(
        new URL('../../firestore.rules', import.meta.url),
        'utf8',
      ),
    },
  });
});

beforeEach(async () => {
  await ambiente.clearFirestore();
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    await Promise.all([
      ...Object.values(usuarios).map((usuario) =>
        setDoc(doc(db, 'usuarios', usuario.uid), usuario)),
      setDoc(
        doc(db, 'turnosMes', 'publicada-soc'),
        escala(usuarios.colaborador.uid, 'EQ_COSI_SOC', 'PUBLICADA'),
      ),
      setDoc(
        doc(db, 'rascunhosTurnosMes', 'rascunho-soc'),
        escala(usuarios.colaborador.uid, 'EQ_COSI_SOC', 'RASCUNHO'),
      ),
      setDoc(
        doc(db, 'turnosMes', 'publicada-codb-noc'),
        escala(usuarios.externo.uid, 'EQ_CODB_NOC', 'PUBLICADA'),
      ),
      setDoc(doc(db, 'config', 'app'), { schemaVersionAtual: 1 }),
    ]);
  });
});

afterAll(async () => {
  await ambiente.cleanup();
});

describe('regras Firestore do Escala ICI', () => {
  it('bloqueia dados operacionais para usuário não autenticado', async () => {
    const db = ambiente.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'usuarios', usuarios.colaborador.uid)));
    await assertFails(getDoc(doc(db, 'turnosMes', 'publicada-soc')));
  });

  it('permite que o colaborador leia a própria identidade e colegas da equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    const proprio = await assertSucceeds(
      getDoc(doc(db, 'usuarios', usuarios.colaborador.uid)),
    );
    const colega = await assertSucceeds(
      getDoc(doc(db, 'usuarios', usuarios.colega.uid)),
    );
    expect(proprio.data()?.nome).toBe('Caio Monteiro');
    expect(colega.data()?.nome).toBe('Bianca Salles');
  });

  it('permite ao colaborador somente escala publicada da própria equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'turnosMes', 'publicada-soc')));
    await assertFails(getDoc(doc(db, 'rascunhosTurnosMes', 'rascunho-soc')));
    await assertFails(getDoc(doc(db, 'turnosMes', 'publicada-codb-noc')));
  });

  it('impede que colaborador crie ou publique documentos', async () => {
    const db = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    await assertFails(setDoc(
      doc(db, 'rascunhosTurnosMes', 'novo-rascunho'),
      escala(usuarios.colaborador.uid, 'EQ_COSI_SOC', 'RASCUNHO'),
    ));
    await assertFails(updateDoc(
      doc(db, 'turnosMes', 'publicada-soc'),
      { status: 'PUBLICADA' },
    ));
  });

  it('permite ao gestor revisar e criar rascunho da própria equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'rascunhosTurnosMes', 'rascunho-soc')));
    await assertSucceeds(setDoc(
      doc(db, 'rascunhosTurnosMes', 'novo-rascunho'),
      escala(usuarios.colega.uid, 'EQ_COSI_SOC', 'RASCUNHO'),
    ));
  });

  it('permite ao gestor cadastrar usuário importado na própria equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'usuario-importado'), {
      uid: 'usuario-importado',
      login: 'login.planilha',
      nome: 'Login planilha',
      email: 'login.planilha@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: usuarios.gestor.uid,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    }));
  });

  it('permite consulta individual quando UID e equipe limitam a coleção', async () => {
    const db = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    await assertSucceeds(getDocs(query(
      collection(db, 'turnosMes'),
      where('usuarioUid', '==', usuarios.colaborador.uid),
      where('equipeId', '==', 'EQ_COSI_SOC'),
      where('competencia', '==', '2026-08'),
      where('status', '==', 'PUBLICADA'),
    )));
  });

  it('impede o gestor de criar documento para outra equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    await assertFails(setDoc(
      doc(db, 'rascunhosTurnosMes', 'rascunho-codb-noc'),
      escala(usuarios.externo.uid, 'EQ_CODB_NOC', 'RASCUNHO'),
    ));
  });

  it('reserva histórico e rollback para o gestor da própria equipe', async () => {
    const gestor = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    const colaborador = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    const versao = {
      ...escala(usuarios.colaborador.uid, 'EQ_COSI_SOC', 'PUBLICADA'),
      chavePublicacao: 'EQ_COSI_SOC_2026-08',
      revisao: 1,
    };

    await assertSucceeds(setDoc(doc(gestor, 'versoesEscala', 'versao-1'), versao));
    await assertFails(getDoc(doc(colaborador, 'versoesEscala', 'versao-1')));
    await assertFails(deleteDoc(doc(gestor, 'versoesEscala', 'versao-1')));
    await assertSucceeds(getDoc(doc(gestor, 'publicacoesEscala', 'ainda-inexistente')));
  });

  it('entrega cada atualização somente ao colaborador afetado e ao gestor', async () => {
    const gestor = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    const colaborador = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    const colega = ambiente.authenticatedContext(usuarios.colega.uid).firestore();
    const evento = {
      id: 'publicacao-2-colaborador',
      publicacaoId: 'publicacao-2',
      equipeId: 'EQ_COSI_SOC',
      competencia: '2026-08',
      revisao: 2,
      tipo: 'PUBLICACAO',
      usuarioUid: usuarios.colaborador.uid,
      motivo: 'Ajuste da cobertura da madrugada',
      publicadoPor: usuarios.gestor.uid,
      publicadoEm: '2026-08-02T21:36:00.000Z',
      alteracoes: [{
        usuarioUid: usuarios.colaborador.uid,
        login: 'cmonteiro',
        data: '2026-08-05',
        codigoAnterior: 'MD',
        horarioAnterior: '01:00–07:00',
        codigoNovo: 'M',
        horarioNovo: '07:00–13:00',
      }],
    };

    await assertSucceeds(setDoc(doc(gestor, 'eventosEscala', evento.id), evento));
    await assertSucceeds(getDoc(doc(colaborador, 'eventosEscala', evento.id)));
    await assertSucceeds(getDoc(doc(gestor, 'eventosEscala', evento.id)));
    await assertFails(getDoc(doc(colega, 'eventosEscala', evento.id)));
    await assertFails(setDoc(doc(colaborador, 'eventosEscala', 'evento-forjado'), {
      ...evento,
      id: 'evento-forjado',
      publicadoPor: usuarios.colaborador.uid,
    }));
    await assertFails(updateDoc(doc(colaborador, 'eventosEscala', evento.id), {
      motivo: 'Alterado',
    }));
  });

  it('permite alterar somente o próprio nome', async () => {
    const db = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    await assertSucceeds(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.uid),
      { nome: 'Nome atualizado' },
    ));
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.uid),
      { email: 'alterado@empresa.com' },
    ));
  });

  it('permite ao gestor editar cadastro, status e aliases de colaborador da própria equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    await assertSucceeds(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.uid),
      {
        cargo: 'ANALISTA_SOC_SENIOR',
        ativo: false,
        aliasesPlanilha: ['Caio M.'],
        atualizadoEm: '2026-08-05T00:00:00.000Z',
      },
    ));
  });

  it('impede o gestor de mover o colaborador para outra equipe ou trocar o UID do documento', async () => {
    const db = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.uid),
      { equipeId: 'EQ_CODB_NOC' },
    ));
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.uid),
      { uid: 'outro-uid' },
    ));
  });

  it('impede o gestor de editar usuário de outra equipe', async () => {
    const db = ambiente.authenticatedContext(usuarios.gestor.uid).firestore();
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.externo.uid),
      { ativo: false },
    ));
  });

  it('impede o colaborador comum de editar outro colaborador', async () => {
    const db = ambiente.authenticatedContext(usuarios.colaborador.uid).firestore();
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colega.uid),
      { ativo: false },
    ));
  });

  it('mantém a configuração de compatibilidade pública e imutável', async () => {
    const db = ambiente.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'config', 'app')));
    await assertFails(setDoc(
      doc(db, 'config', 'app'),
      { schemaVersionAtual: 2 },
    ));
  });
});
