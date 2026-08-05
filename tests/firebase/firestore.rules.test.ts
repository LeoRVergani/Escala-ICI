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

/**
 * `usuarios/{login}` é a chave funcional: o doc ID é o login, e a rule
 * deriva a identidade do e-mail autenticado (`loginDoAuth()`), não de
 * `request.auth.uid`. Por isso o contexto de teste usa `email` como token
 * claim — o primeiro argumento de `authenticatedContext` é só um UID de
 * sessão opaco, que as rules nunca leem.
 */
const usuarios = {
  gestor: {
    login: 'marina.azevedo',
    nome: 'Marina Azevedo',
    email: 'marina.azevedo@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 5,
  },
  colaborador: {
    login: 'caio.monteiro',
    nome: 'Caio Monteiro',
    email: 'caio.monteiro@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 6,
  },
  colega: {
    login: 'bianca.salles',
    nome: 'Bianca Salles',
    email: 'bianca.salles@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 6,
  },
  externo: {
    login: 'ravi.nogueira',
    nome: 'Ravi Nogueira',
    email: 'ravi.nogueira@teste.local',
    equipeId: 'EQ_CODB_NOC',
    nivelHierarquico: 6,
  },
} as const;

function autenticarComo(usuario: { login: string; email: string }) {
  return ambiente.authenticatedContext(usuario.login, { email: usuario.email }).firestore();
}

function escala(
  login: string,
  equipeId: string,
  status: 'RASCUNHO' | 'PUBLICADA',
) {
  return {
    schemaVersion: 1,
    equipeId,
    usuarioUid: login,
    login,
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
        setDoc(doc(db, 'usuarios', usuario.login), usuario)),
      setDoc(
        doc(db, 'turnosMes', 'publicada-soc'),
        escala(usuarios.colaborador.login, 'EQ_COSI_SOC', 'PUBLICADA'),
      ),
      setDoc(
        doc(db, 'rascunhosTurnosMes', 'rascunho-soc'),
        escala(usuarios.colaborador.login, 'EQ_COSI_SOC', 'RASCUNHO'),
      ),
      setDoc(
        doc(db, 'turnosMes', 'publicada-codb-noc'),
        escala(usuarios.externo.login, 'EQ_CODB_NOC', 'PUBLICADA'),
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
    await assertFails(getDoc(doc(db, 'usuarios', usuarios.colaborador.login)));
    await assertFails(getDoc(doc(db, 'turnosMes', 'publicada-soc')));
  });

  it('permite que o colaborador leia a própria identidade e colegas da equipe', async () => {
    const db = autenticarComo(usuarios.colaborador);
    const proprio = await assertSucceeds(
      getDoc(doc(db, 'usuarios', usuarios.colaborador.login)),
    );
    const colega = await assertSucceeds(
      getDoc(doc(db, 'usuarios', usuarios.colega.login)),
    );
    expect(proprio.data()?.nome).toBe('Caio Monteiro');
    expect(colega.data()?.nome).toBe('Bianca Salles');
  });

  it('permite ao colaborador somente escala publicada da própria equipe', async () => {
    const db = autenticarComo(usuarios.colaborador);
    await assertSucceeds(getDoc(doc(db, 'turnosMes', 'publicada-soc')));
    await assertFails(getDoc(doc(db, 'rascunhosTurnosMes', 'rascunho-soc')));
    await assertFails(getDoc(doc(db, 'turnosMes', 'publicada-codb-noc')));
  });

  it('permite ao colaborador ler a escala publicada de um colega com usuarioUid legado desatualizado (a leitura de equipe não depende de usuarioUid nem de auth.uid)', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(
        doc(db, 'turnosMes', 'publicada-uid-antigo'),
        { ...escala(usuarios.colega.login, 'EQ_COSI_SOC', 'PUBLICADA'), usuarioUid: 'usuario-provisorio-antigo' },
      );
    });
    const db = autenticarComo(usuarios.colega);
    await assertSucceeds(getDoc(doc(db, 'turnosMes', 'publicada-uid-antigo')));
  });

  it('impede que colaborador crie ou publique documentos', async () => {
    const db = autenticarComo(usuarios.colaborador);
    await assertFails(setDoc(
      doc(db, 'rascunhosTurnosMes', 'novo-rascunho'),
      escala(usuarios.colaborador.login, 'EQ_COSI_SOC', 'RASCUNHO'),
    ));
    await assertFails(updateDoc(
      doc(db, 'turnosMes', 'publicada-soc'),
      { status: 'PUBLICADA' },
    ));
  });

  it('permite ao gestor revisar e criar rascunho da própria equipe', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertSucceeds(getDoc(doc(db, 'rascunhosTurnosMes', 'rascunho-soc')));
    await assertSucceeds(setDoc(
      doc(db, 'rascunhosTurnosMes', 'novo-rascunho'),
      escala(usuarios.colega.login, 'EQ_COSI_SOC', 'RASCUNHO'),
    ));
  });

  it('permite ao gestor cadastrar usuário importado na própria equipe, com o login como ID', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'login.planilha'), {
      login: 'login.planilha',
      nome: 'Login planilha',
      email: 'login.planilha@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: usuarios.gestor.login,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    }));
  });

  it('impede criar usuários/{login} quando o ID do documento não é igual ao campo login', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(db, 'usuarios', 'login.planilha'), {
      login: 'login.diferente',
      nome: 'Login planilha',
      email: 'login.planilha@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: usuarios.gestor.login,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    }));
  });

  it('permite consulta individual quando login e equipe limitam a coleção', async () => {
    const db = autenticarComo(usuarios.colaborador);
    await assertSucceeds(getDocs(query(
      collection(db, 'turnosMes'),
      where('login', '==', usuarios.colaborador.login),
      where('equipeId', '==', 'EQ_COSI_SOC'),
      where('competencia', '==', '2026-08'),
      where('status', '==', 'PUBLICADA'),
    )));
  });

  it('impede o gestor de criar documento para outra equipe', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(
      doc(db, 'rascunhosTurnosMes', 'rascunho-codb-noc'),
      escala(usuarios.externo.login, 'EQ_CODB_NOC', 'RASCUNHO'),
    ));
  });

  it('recusa delete de rascunho inexistente e reforça por que publicarEscalas() precisa checar existência antes', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(deleteDoc(doc(gestor, 'rascunhosTurnosMes', 'rascunho-nunca-existiu')));
  });

  it('permite ao gestor apagar rascunho existente da própria equipe, mas não de outra equipe', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    const externo = autenticarComo(usuarios.externo);
    await assertFails(deleteDoc(doc(externo, 'rascunhosTurnosMes', 'rascunho-soc')));
    await assertSucceeds(deleteDoc(doc(gestor, 'rascunhosTurnosMes', 'rascunho-soc')));
  });

  it('impede colaborador comum de apagar rascunho', async () => {
    const db = autenticarComo(usuarios.colaborador);
    await assertFails(deleteDoc(doc(db, 'rascunhosTurnosMes', 'rascunho-soc')));
  });

  it('reserva histórico e rollback para o gestor da própria equipe', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    const colaborador = autenticarComo(usuarios.colaborador);
    const versao = {
      ...escala(usuarios.colaborador.login, 'EQ_COSI_SOC', 'PUBLICADA'),
      chavePublicacao: 'EQ_COSI_SOC_2026-08',
      revisao: 1,
    };

    await assertSucceeds(setDoc(doc(gestor, 'versoesEscala', 'versao-1'), versao));
    await assertFails(getDoc(doc(colaborador, 'versoesEscala', 'versao-1')));
    await assertFails(deleteDoc(doc(gestor, 'versoesEscala', 'versao-1')));
    await assertSucceeds(getDoc(doc(gestor, 'publicacoesEscala', 'ainda-inexistente')));
  });

  it('entrega cada atualização somente ao colaborador afetado (por login) e ao gestor', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    const colaborador = autenticarComo(usuarios.colaborador);
    const colega = autenticarComo(usuarios.colega);
    const evento = {
      id: 'publicacao-2-colaborador',
      publicacaoId: 'publicacao-2',
      equipeId: 'EQ_COSI_SOC',
      competencia: '2026-08',
      revisao: 2,
      tipo: 'PUBLICACAO',
      usuarioUid: usuarios.colaborador.login,
      motivo: 'Ajuste da cobertura da madrugada',
      publicadoPor: usuarios.gestor.login,
      publicadoEm: '2026-08-02T21:36:00.000Z',
      alteracoes: [{
        usuarioUid: usuarios.colaborador.login,
        login: usuarios.colaborador.login,
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
      publicadoPor: usuarios.colaborador.login,
    }));
    await assertFails(updateDoc(doc(colaborador, 'eventosEscala', evento.id), {
      motivo: 'Alterado',
    }));
  });

  it('impede criar publicadoPor/enviadoPor diferente do login autenticado', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(gestor, 'eventosEscala', 'evento-forjado'), {
      id: 'evento-forjado',
      publicacaoId: 'publicacao-x',
      equipeId: 'EQ_COSI_SOC',
      competencia: '2026-08',
      revisao: 3,
      tipo: 'PUBLICACAO',
      usuarioUid: usuarios.colaborador.login,
      motivo: 'Forjado',
      publicadoPor: 'outro-login-qualquer',
      publicadoEm: '2026-08-02T21:36:00.000Z',
      alteracoes: [],
    }));
  });

  it('permite alterar somente o próprio nome', async () => {
    const db = autenticarComo(usuarios.colaborador);
    await assertSucceeds(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.login),
      { nome: 'Nome atualizado' },
    ));
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.login),
      { email: 'alterado@empresa.com' },
    ));
  });

  it('permite ao gestor editar cadastro, status e aliases de colaborador da própria equipe', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertSucceeds(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.login),
      {
        cargo: 'ANALISTA_SOC_SENIOR',
        ativo: false,
        aliasesPlanilha: ['Caio M.'],
        atualizadoEm: '2026-08-05T00:00:00.000Z',
      },
    ));
  });

  it('impede o gestor de mover o colaborador para outra equipe ou trocar o login do documento', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.login),
      { equipeId: 'EQ_CODB_NOC' },
    ));
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colaborador.login),
      { login: 'outro-login' },
    ));
  });

  it('impede o gestor de editar usuário de outra equipe', async () => {
    const db = autenticarComo(usuarios.gestor);
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.externo.login),
      { ativo: false },
    ));
  });

  it('impede o colaborador comum de editar outro colaborador', async () => {
    const db = autenticarComo(usuarios.colaborador);
    await assertFails(updateDoc(
      doc(db, 'usuarios', usuarios.colega.login),
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
