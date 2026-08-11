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
  runTransaction,
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
  admin: {
    login: 'paula.ferraz',
    nome: 'Paula Ferraz',
    email: 'paula.ferraz@teste.local',
    equipeId: 'EQ_ADMIN',
    nivelHierarquico: 0,
    perfil: 'ADMIN_SISTEMA',
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

/**
 * Solicitante = `colaborador`, destinatário = `colega` — os dois da mesma
 * equipe (`EQ_COSI_SOC`), espelhando o par usado nos testes de `usuarios`/
 * `turnosMes` acima. `ajustes` sobrescreve qualquer campo para os cenários
 * de fronteira (status diferente, historico maior, etc.).
 */
function troca(ajustes: Record<string, unknown> = {}) {
  return {
    trocaId: 'troca-1',
    equipeId: 'EQ_COSI_SOC',
    competencia: '2026-08',
    solicitanteLogin: usuarios.colaborador.login,
    solicitanteNome: usuarios.colaborador.nome,
    destinatarioLogin: usuarios.colega.login,
    destinatarioNome: usuarios.colega.nome,
    data: '2026-08-10',
    turnoSolicitanteAntes: 'M',
    horarioSolicitanteAntes: '07:00–13:00',
    turnoDestinatarioAntes: 'T',
    horarioDestinatarioAntes: '13:00–19:00',
    status: 'PENDENTE_USUARIO',
    mensagemSolicitante: null,
    motivoRecusa: null,
    criadoEm: '2026-08-07T13:00:00.000Z',
    atualizadoEm: '2026-08-07T13:00:00.000Z',
    respondidoEm: null,
    aprovadoEm: null,
    publicadoEm: null,
    gestorLogin: null,
    gestorNome: null,
    historico: [{
      tipo: 'SOLICITACAO_CRIADA',
      porLogin: usuarios.colaborador.login,
      porNome: usuarios.colaborador.nome,
      porPerfil: 'SOLICITANTE',
      em: '2026-08-07T13:00:00.000Z',
      descricao: 'Solicitação criada',
    }],
    snapshotValidacao: {
      solicitanteDocId: 'EQ_COSI_SOC_caio.monteiro_2026-08',
      destinatarioDocId: 'EQ_COSI_SOC_bianca.salles_2026-08',
      turnoSolicitanteOriginal: 'M',
      turnoDestinatarioOriginal: 'T',
    },
    ...ajustes,
  };
}

function notificacaoTroca(ajustes: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    destinatarioLogin: usuarios.colega.login,
    equipeId: 'EQ_COSI_SOC',
    tipo: 'TROCA_SOLICITADA',
    titulo: 'Nova solicitação de troca',
    mensagem: `${usuarios.colaborador.nome} quer trocar com você.`,
    trocaId: 'troca-1',
    criadoPorLogin: usuarios.colaborador.login,
    criadoEm: '2026-08-07T13:00:00.000Z',
    lidaEm: null,
    acao: 'ABRIR_TROCA',
    ...ajustes,
  };
}

/**
 * Contrato pós Fase PUSH-1B (`apps/push-worker/src/types.ts`): `fid`, nunca
 * `token`. `deviceId` default combina com o ID de documento usado pela
 * maioria dos testes (`dev-1`) — sobrescrever os dois juntos quando o
 * cenário precisar de um ID diferente.
 */
function dispositivoPush(login: string, ajustes: Record<string, unknown> = {}) {
  return {
    deviceId: 'dev-1',
    login,
    plataforma: 'WEB',
    fid: 'fid-teste-1',
    ativo: true,
    criadoEm: '2026-08-07T13:00:00.000Z',
    atualizadoEm: '2026-08-07T13:00:00.000Z',
    ultimaConfirmacaoEm: null,
    appVersion: null,
    environment: 'STAGING',
    schemaVersion: 1,
    ...ajustes,
  };
}

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
      setDoc(doc(db, 'trocasEscala', 'troca-1'), troca()),
      // Documentos com o mesmo ID que `idDocumento(equipeId, login, competencia)`
      // gera de verdade (`${equipeId}_${login}_${competencia}`), com o dia da
      // troca presente — necessário para o teste do fluxo real de aprovação
      // (gestorAprovarEPublicarTroca), que lê exatamente esses IDs.
      setDoc(doc(db, 'turnosMes', 'EQ_COSI_SOC_caio.monteiro_2026-08'), {
        ...escala(usuarios.colaborador.login, 'EQ_COSI_SOC', 'PUBLICADA'),
        dias: { '2026-08-10': { c: 'M', i: '07:00', f: '13:00' } },
      }),
      setDoc(doc(db, 'turnosMes', 'EQ_COSI_SOC_bianca.salles_2026-08'), {
        ...escala(usuarios.colega.login, 'EQ_COSI_SOC', 'PUBLICADA'),
        dias: { '2026-08-10': { c: 'T', i: '13:00', f: '19:00' } },
      }),
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

  describe('trocasEscala', () => {
    it('permite ao solicitante criar a própria solicitação PENDENTE_USUARIO', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(setDoc(doc(db, 'trocasEscala', 'troca-nova'), troca({ trocaId: 'troca-nova' })));
    });

    it('impede criar troca em nome de outro solicitante', async () => {
      const db = autenticarComo(usuarios.colega);
      await assertFails(setDoc(doc(db, 'trocasEscala', 'troca-forjada'), troca({ trocaId: 'troca-forjada' })));
    });

    it('impede criar troca consigo mesmo como destinatário', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'trocasEscala', 'troca-auto'),
        troca({ trocaId: 'troca-auto', destinatarioLogin: usuarios.colaborador.login }),
      ));
    });

    it('impede criar troca com status inicial diferente de PENDENTE_USUARIO', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'trocasEscala', 'troca-status-errado'),
        troca({ trocaId: 'troca-status-errado', status: 'PENDENTE_GESTOR' }),
      ));
    });

    it('impede criar troca informando equipeId diferente da própria equipe', async () => {
      const db = autenticarComo(usuarios.externo);
      await assertFails(setDoc(
        doc(db, 'trocasEscala', 'troca-outra-equipe'),
        troca({
          trocaId: 'troca-outra-equipe',
          equipeId: 'EQ_COSI_SOC',
          solicitanteLogin: usuarios.externo.login,
          destinatarioLogin: usuarios.colega.login,
        }),
      ));
    });

    it('permite ao destinatário aceitar, encaminhando para o gestor', async () => {
      const db = autenticarComo(usuarios.colega);
      await assertSucceeds(updateDoc(doc(db, 'trocasEscala', 'troca-1'), {
        status: 'PENDENTE_GESTOR',
        respondidoEm: '2026-08-07T14:00:00.000Z',
        historico: [
          ...troca().historico,
          { tipo: 'ACEITE_DESTINATARIO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'DESTINATARIO', em: '2026-08-07T14:00:00.000Z', descricao: 'Aceite do colega' },
        ],
      }));
    });

    it('permite ao destinatário recusar', async () => {
      const db = autenticarComo(usuarios.colega);
      await assertSucceeds(updateDoc(doc(db, 'trocasEscala', 'troca-1'), {
        status: 'RECUSADA_USUARIO',
        motivoRecusa: 'Já tenho compromisso.',
        historico: [
          ...troca().historico,
          { tipo: 'RECUSA_DESTINATARIO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'DESTINATARIO', em: '2026-08-07T14:00:00.000Z', descricao: 'Recusada pelo colega' },
        ],
      }));
    });

    it('impede o destinatário de pular direto para APROVADA_PUBLICADA', async () => {
      const db = autenticarComo(usuarios.colega);
      await assertFails(updateDoc(doc(db, 'trocasEscala', 'troca-1'), {
        status: 'APROVADA_PUBLICADA',
        historico: [
          ...troca().historico,
          { tipo: 'FORJADO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'DESTINATARIO', em: '2026-08-07T14:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('permite ao solicitante cancelar a própria solicitação pendente', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(updateDoc(doc(db, 'trocasEscala', 'troca-1'), {
        status: 'CANCELADA_SOLICITANTE',
        historico: [
          ...troca().historico,
          { tipo: 'CANCELADA_SOLICITANTE', porLogin: usuarios.colaborador.login, porNome: usuarios.colaborador.nome, porPerfil: 'SOLICITANTE', em: '2026-08-07T14:00:00.000Z', descricao: 'Cancelada' },
        ],
      }));
    });

    it('impede o destinatário de cancelar a solicitação do outro', async () => {
      const db = autenticarComo(usuarios.colega);
      await assertFails(updateDoc(doc(db, 'trocasEscala', 'troca-1'), {
        status: 'CANCELADA_SOLICITANTE',
        historico: [
          ...troca().historico,
          { tipo: 'FORJADO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'DESTINATARIO', em: '2026-08-07T14:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('impede update sem o historico crescer', async () => {
      const db = autenticarComo(usuarios.colega);
      await assertFails(updateDoc(doc(db, 'trocasEscala', 'troca-1'), {
        status: 'PENDENTE_GESTOR',
      }));
    });

    it('impede o gestor de recusar/aprovar uma troca ainda PENDENTE_USUARIO', async () => {
      const gestor = autenticarComo(usuarios.gestor);
      await assertFails(updateDoc(doc(gestor, 'trocasEscala', 'troca-1'), {
        status: 'RECUSADA_GESTOR',
        gestorLogin: usuarios.gestor.login,
        gestorNome: usuarios.gestor.nome,
        historico: [
          ...troca().historico,
          { tipo: 'FORJADO', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T14:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('permite ao gestor recusar ou aprovar e publicar a partir de PENDENTE_GESTOR', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'trocasEscala', 'troca-pendente-gestor'),
          troca({ trocaId: 'troca-pendente-gestor', status: 'PENDENTE_GESTOR' }),
        );
      });
      const gestor = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(gestor, 'trocasEscala', 'troca-pendente-gestor'), {
        status: 'APROVADA_PUBLICADA',
        aprovadoEm: '2026-08-07T15:00:00.000Z',
        publicadoEm: '2026-08-07T15:00:00.000Z',
        gestorLogin: usuarios.gestor.login,
        gestorNome: usuarios.gestor.nome,
        historico: [
          ...troca().historico,
          { tipo: 'APROVADA_PUBLICADA', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'Aprovada' },
        ],
      }));
    });

    it('impede o gestor de outra equipe de ler ou decidir a troca', async () => {
      const externo = autenticarComo(usuarios.externo);
      await assertFails(getDoc(doc(externo, 'trocasEscala', 'troca-1')));
      await assertFails(updateDoc(doc(externo, 'trocasEscala', 'troca-1'), {
        status: 'RECUSADA_GESTOR',
        gestorLogin: usuarios.externo.login,
        gestorNome: usuarios.externo.nome,
        historico: [
          ...troca().historico,
          { tipo: 'FORJADO', porLogin: usuarios.externo.login, porNome: usuarios.externo.nome, porPerfil: 'GESTOR', em: '2026-08-07T14:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('permite leitura ao solicitante, ao destinatário e ao gestor da equipe; nega a um colega qualquer', async () => {
      await assertSucceeds(getDoc(doc(autenticarComo(usuarios.colaborador), 'trocasEscala', 'troca-1')));
      await assertSucceeds(getDoc(doc(autenticarComo(usuarios.colega), 'trocasEscala', 'troca-1')));
      await assertSucceeds(getDoc(doc(autenticarComo(usuarios.gestor), 'trocasEscala', 'troca-1')));
    });

    it('nega delete', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(deleteDoc(doc(db, 'trocasEscala', 'troca-1')));
    });
  });

  describe('notificacoesTroca', () => {
    it('permite ao destinatário ler a própria notificação e nega a outro login', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'notificacoesTroca', 'notif-1'), notificacaoTroca());
      });
      await assertSucceeds(getDoc(doc(autenticarComo(usuarios.colega), 'notificacoesTroca', 'notif-1')));
      await assertFails(getDoc(doc(autenticarComo(usuarios.colaborador), 'notificacoesTroca', 'notif-1')));
    });

    it('permite criar notificação para outra pessoa da equipe quando o autor é quem está autenticado', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(setDoc(doc(db, 'notificacoesTroca', 'notif-nova'), notificacaoTroca({ id: 'notif-nova' })));
    });

    it('impede forjar criadoPorLogin de outra pessoa', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'notificacoesTroca', 'notif-forjada'),
        notificacaoTroca({ id: 'notif-forjada', criadoPorLogin: usuarios.gestor.login }),
      ));
    });

    it('impede criar notificação endereçada a si mesmo', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'notificacoesTroca', 'notif-para-mim'),
        notificacaoTroca({ id: 'notif-para-mim', destinatarioLogin: usuarios.colaborador.login, criadoPorLogin: usuarios.colaborador.login }),
      ));
    });

    it('permite ao destinatário marcar a própria notificação como lida, e só esse campo', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'notificacoesTroca', 'notif-1'), notificacaoTroca());
      });
      const db = autenticarComo(usuarios.colega);
      await assertSucceeds(updateDoc(doc(db, 'notificacoesTroca', 'notif-1'), { lidaEm: '2026-08-07T16:00:00.000Z' }));
      await assertFails(updateDoc(doc(db, 'notificacoesTroca', 'notif-1'), { mensagem: 'alterada' }));
    });

    it('impede outra pessoa de marcar a notificação de alguém como lida', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'notificacoesTroca', 'notif-1'), notificacaoTroca());
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(updateDoc(doc(db, 'notificacoesTroca', 'notif-1'), { lidaEm: '2026-08-07T16:00:00.000Z' }));
    });

    it('nega delete', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'notificacoesTroca', 'notif-1'), notificacaoTroca());
      });
      const db = autenticarComo(usuarios.colega);
      await assertFails(deleteDoc(doc(db, 'notificacoesTroca', 'notif-1')));
    });
  });

  describe('dispositivosPush (Fase PUSH-1B — FID, sem token)', () => {
    it('permite criar dispositivo WEB próprio com fid', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        dispositivoPush(usuarios.colaborador.login, { plataforma: 'WEB' }),
      ));
    });

    it('permite criar dispositivo ANDROID próprio com fid', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        dispositivoPush(usuarios.colaborador.login, { plataforma: 'ANDROID' }),
      ));
    });

    it('nega criar dispositivo para outro login', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        dispositivoPush(usuarios.colega.login),
      ));
    });

    it('nega list mesmo para o próprio usuário', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(getDocs(collection(db, 'dispositivosPush')));
    });

    it('nega criar com campo token', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        { ...dispositivoPush(usuarios.colaborador.login), token: 'tok-1' },
      ));
    });

    it('nega criar com fid vazio', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        dispositivoPush(usuarios.colaborador.login, { fid: '' }),
      ));
    });

    it('nega criar com environment diferente de STAGING', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        dispositivoPush(usuarios.colaborador.login, { environment: 'PRODUCTION' }),
      ));
    });

    it('nega criar quando deviceId do corpo diverge do ID do documento', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(setDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        dispositivoPush(usuarios.colaborador.login, { deviceId: 'outro-id' }),
      ));
    });

    it('permite ao próprio usuário ler o próprio dispositivo e nega a outro login', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
      });
      await assertSucceeds(getDoc(doc(autenticarComo(usuarios.colaborador), 'dispositivosPush', 'dev-1')));
      await assertFails(getDoc(doc(autenticarComo(usuarios.colega), 'dispositivosPush', 'dev-1')));
    });

    it('permite renovação controlada do fid do próprio dispositivo', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(updateDoc(
        doc(db, 'dispositivosPush', 'dev-1'),
        { fid: 'fid-renovado', atualizadoEm: '2026-08-08T00:00:00.000Z' },
      ));
    });

    it('preserva imutabilidade de login/deviceId/environment na atualização', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(updateDoc(doc(db, 'dispositivosPush', 'dev-1'), { login: usuarios.colega.login }));
      await assertFails(updateDoc(doc(db, 'dispositivosPush', 'dev-1'), { deviceId: 'outro-id' }));
      await assertFails(updateDoc(doc(db, 'dispositivosPush', 'dev-1'), { environment: 'PRODUCTION' }));
    });

    it('nega update que reintroduz campo token', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertFails(updateDoc(doc(db, 'dispositivosPush', 'dev-1'), { token: 'tok-reintroduzido' }));
    });

    it('nega update de outro usuário sobre o dispositivo', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
      });
      const db = autenticarComo(usuarios.colega);
      await assertFails(updateDoc(doc(db, 'dispositivosPush', 'dev-1'), { ativo: false }));
    });

    it('permite delete pelo próprio usuário e nega para outro', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-1'), dispositivoPush(usuarios.colaborador.login));
        await setDoc(doc(contexto.firestore(), 'dispositivosPush', 'dev-2'), dispositivoPush(usuarios.colega.login, { deviceId: 'dev-2' }));
      });
      await assertFails(deleteDoc(doc(autenticarComo(usuarios.colaborador), 'dispositivosPush', 'dev-2')));
      await assertSucceeds(deleteDoc(doc(autenticarComo(usuarios.colaborador), 'dispositivosPush', 'dev-1')));
    });
  });

  /**
   * Hotfix PUSH-PWA-2A.1 — `registrarOuRenovarDispositivo()` sempre faz um
   * `getDoc()` antes do `setDoc()`, para decidir criar vs. renovar. Na
   * primeira ativação de um `deviceId` novo, esse documento ainda não
   * existe: `resource` é `null` na regra de `get`, e ler `resource.data`
   * nesse caso é erro de avaliação — que o Firestore trata como negado.
   * Os testes abaixo reproduzem exatamente esse `get` sem pré-seed (nenhum
   * teste anterior de `get` fazia isso — todos pré-criavam o documento).
   */
  describe('dispositivosPush — primeira inscrição (documento ainda inexistente)', () => {
    it('nega get em documento inexistente para usuário não autenticado', async () => {
      const db = ambiente.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'dispositivosPush', 'dev-novo')));
    });

    it('permite get em documento inexistente pelo próprio dono do deviceId e retorna snapshot inexistente', async () => {
      const db = autenticarComo(usuarios.colaborador);
      const snapshot = await assertSucceeds(getDoc(doc(db, 'dispositivosPush', 'dev-novo')));
      expect(snapshot.exists()).toBe(false);
    });

    it('permite criar o próprio documento depois do get em ID inexistente (fluxo real de primeira ativação)', async () => {
      const db = autenticarComo(usuarios.colaborador);
      const snapshotAntes = await assertSucceeds(getDoc(doc(db, 'dispositivosPush', 'dev-novo')));
      expect(snapshotAntes.exists()).toBe(false);

      await assertSucceeds(setDoc(
        doc(db, 'dispositivosPush', 'dev-novo'),
        dispositivoPush(usuarios.colaborador.login, { deviceId: 'dev-novo' }),
      ));

      const snapshotDepois = await assertSucceeds(getDoc(doc(db, 'dispositivosPush', 'dev-novo')));
      expect(snapshotDepois.exists()).toBe(true);
      expect(snapshotDepois.data()?.login).toBe(usuarios.colaborador.login);
    });
  });

  /**
   * Hotfix 2 — os testes acima só exercitam get/set/update/delete em um
   * documento por vez. As operações reais de `lib/firebase/trocasRepository.ts`
   * fazem `getDocs(query(...))` (list, não get) e uma `runTransaction` com
   * várias leituras/escritas. Uma regra pode passar em todos os testes
   * de documento único e ainda falhar numa consulta ou numa transação — por
   * isso este bloco reproduz exatamente essas formas de acesso.
   */
  describe('fluxo real de troca de escala (A -> B -> gestor)', () => {
    it('A cria a troca e a notificação para B', async () => {
      const a = autenticarComo(usuarios.colaborador);
      await assertSucceeds(setDoc(doc(a, 'trocasEscala', 'troca-nova'), troca({ trocaId: 'troca-nova' })));
      await assertSucceeds(setDoc(doc(a, 'notificacoesTroca', 'notif-nova'), notificacaoTroca({ id: 'notif-nova' })));
    });

    it('B lista as próprias notificações via query (list, não só get)', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'notificacoesTroca', 'notif-1'), notificacaoTroca());
      });
      const b = autenticarComo(usuarios.colega);
      const resultado = await assertSucceeds(getDocs(query(
        collection(b, 'notificacoesTroca'),
        where('destinatarioLogin', '==', usuarios.colega.login),
      )));
      expect(resultado.docs).toHaveLength(1);
    });

    it('B marca a notificação como lida', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'notificacoesTroca', 'notif-1'), notificacaoTroca());
      });
      const b = autenticarComo(usuarios.colega);
      await assertSucceeds(updateDoc(doc(b, 'notificacoesTroca', 'notif-1'), { lidaEm: '2026-08-07T14:00:00.000Z' }));
    });

    it('B lista as próprias trocas via query — como solicitante e como destinatário', async () => {
      const b = autenticarComo(usuarios.colega);
      const comoDestinatario = await assertSucceeds(getDocs(query(
        collection(b, 'trocasEscala'),
        where('equipeId', '==', 'EQ_COSI_SOC'),
        where('competencia', '==', '2026-08'),
        where('destinatarioLogin', '==', usuarios.colega.login),
      )));
      expect(comoDestinatario.docs).toHaveLength(1);
      const comoSolicitante = await assertSucceeds(getDocs(query(
        collection(b, 'trocasEscala'),
        where('equipeId', '==', 'EQ_COSI_SOC'),
        where('competencia', '==', '2026-08'),
        where('solicitanteLogin', '==', usuarios.colega.login),
      )));
      expect(comoSolicitante.docs).toHaveLength(0);
    });

    it('B aceita a troca (-> PENDENTE_GESTOR) e cria a notificação para A', async () => {
      const b = autenticarComo(usuarios.colega);
      await assertSucceeds(updateDoc(doc(b, 'trocasEscala', 'troca-1'), {
        status: 'PENDENTE_GESTOR',
        respondidoEm: '2026-08-07T14:00:00.000Z',
        historico: [
          ...troca().historico,
          { tipo: 'ACEITE_DESTINATARIO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'DESTINATARIO', em: '2026-08-07T14:00:00.000Z', descricao: 'Aceite do colega' },
        ],
      }));
      await assertSucceeds(setDoc(doc(b, 'notificacoesTroca', 'notif-para-a'), notificacaoTroca({
        id: 'notif-para-a',
        destinatarioLogin: usuarios.colaborador.login,
        criadoPorLogin: usuarios.colega.login,
        tipo: 'TROCA_ACEITA_AGUARDANDO_GESTOR',
      })));
    });

    it('B recusa a troca e cria a notificação para A', async () => {
      const b = autenticarComo(usuarios.colega);
      await assertSucceeds(updateDoc(doc(b, 'trocasEscala', 'troca-1'), {
        status: 'RECUSADA_USUARIO',
        motivoRecusa: 'Já tenho compromisso.',
        historico: [
          ...troca().historico,
          { tipo: 'RECUSA_DESTINATARIO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'DESTINATARIO', em: '2026-08-07T14:00:00.000Z', descricao: 'Recusada pelo colega' },
        ],
      }));
      await assertSucceeds(setDoc(doc(b, 'notificacoesTroca', 'notif-recusa-a'), notificacaoTroca({
        id: 'notif-recusa-a',
        destinatarioLogin: usuarios.colaborador.login,
        criadoPorLogin: usuarios.colega.login,
        tipo: 'TROCA_RECUSADA_USUARIO',
      })));
    });

    it('gestor lista as trocas da equipe via query (sem filtro de status)', async () => {
      const gestor = autenticarComo(usuarios.gestor);
      const resultado = await assertSucceeds(getDocs(query(
        collection(gestor, 'trocasEscala'),
        where('equipeId', '==', 'EQ_COSI_SOC'),
        where('competencia', '==', '2026-08'),
      )));
      expect(resultado.docs).toHaveLength(1);
    });

    it('gestor de outra equipe lista a própria equipe e não vê a troca da EQ_COSI_SOC', async () => {
      const externo = autenticarComo(usuarios.externo);
      const resultado = await assertSucceeds(getDocs(query(
        collection(externo, 'trocasEscala'),
        where('equipeId', '==', 'EQ_CODB_NOC'),
        where('competencia', '==', '2026-08'),
      )));
      expect(resultado.docs).toHaveLength(0);
    });

    it('gestor recusa a troca (a partir de PENDENTE_GESTOR) e notifica A e B', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'trocasEscala', 'troca-pendente-gestor'),
          troca({ trocaId: 'troca-pendente-gestor', status: 'PENDENTE_GESTOR' }),
        );
      });
      const gestor = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(gestor, 'trocasEscala', 'troca-pendente-gestor'), {
        status: 'RECUSADA_GESTOR',
        motivoRecusa: 'Causaria descanso insuficiente.',
        gestorLogin: usuarios.gestor.login,
        gestorNome: usuarios.gestor.nome,
        historico: [
          ...troca().historico,
          { tipo: 'RECUSA_GESTOR', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'Recusada pelo gestor' },
        ],
      }));
      for (const destinatarioLogin of [usuarios.colaborador.login, usuarios.colega.login]) {
        await assertSucceeds(setDoc(doc(gestor, 'notificacoesTroca', `notif-recusa-gestor-${destinatarioLogin}`), notificacaoTroca({
          id: `notif-recusa-gestor-${destinatarioLogin}`,
          destinatarioLogin,
          criadoPorLogin: usuarios.gestor.login,
          tipo: 'TROCA_RECUSADA_GESTOR',
        })));
      }
    });

    it('gestor aprova e publica: transação real com os 2 turnosMes + trocasEscala + 2 notificações', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'trocasEscala', 'troca-pendente-gestor'),
          troca({ trocaId: 'troca-pendente-gestor', status: 'PENDENTE_GESTOR' }),
        );
      });
      const gestor = autenticarComo(usuarios.gestor);

      await assertSucceeds(runTransaction(gestor, async (tx) => {
        const trocaRef = doc(gestor, 'trocasEscala', 'troca-pendente-gestor');
        const solicitanteRef = doc(gestor, 'turnosMes', 'EQ_COSI_SOC_caio.monteiro_2026-08');
        const destinatarioRef = doc(gestor, 'turnosMes', 'EQ_COSI_SOC_bianca.salles_2026-08');
        const usuarioSolicitanteRef = doc(gestor, 'usuarios', usuarios.colaborador.login);
        const usuarioDestinatarioRef = doc(gestor, 'usuarios', usuarios.colega.login);

        const [trocaSnap, solicitanteSnap, destinatarioSnap] = await Promise.all([
          tx.get(trocaRef),
          tx.get(solicitanteRef),
          tx.get(destinatarioRef),
          tx.get(usuarioSolicitanteRef),
          tx.get(usuarioDestinatarioRef),
        ]);
        void trocaSnap;

        tx.update(solicitanteRef, {
          dias: { '2026-08-10': destinatarioSnap.data()!.dias['2026-08-10'] },
          totais: solicitanteSnap.data()!.totais ?? {},
          atualizadoEm: '2026-08-07T16:00:00.000Z',
        });
        tx.update(destinatarioRef, {
          dias: { '2026-08-10': solicitanteSnap.data()!.dias['2026-08-10'] },
          totais: destinatarioSnap.data()!.totais ?? {},
          atualizadoEm: '2026-08-07T16:00:00.000Z',
        });
        tx.update(trocaRef, {
          status: 'APROVADA_PUBLICADA',
          atualizadoEm: '2026-08-07T16:00:00.000Z',
          aprovadoEm: '2026-08-07T16:00:00.000Z',
          publicadoEm: '2026-08-07T16:00:00.000Z',
          gestorLogin: usuarios.gestor.login,
          gestorNome: usuarios.gestor.nome,
          historico: [
            ...troca().historico,
            { tipo: 'APROVADA_PUBLICADA', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T16:00:00.000Z', descricao: 'Aprovada e publicada' },
          ],
        });
        for (const destinatarioLogin of [usuarios.colaborador.login, usuarios.colega.login]) {
          tx.set(doc(gestor, 'notificacoesTroca', `notif-aprovada-${destinatarioLogin}`), notificacaoTroca({
            id: `notif-aprovada-${destinatarioLogin}`,
            destinatarioLogin,
            criadoPorLogin: usuarios.gestor.login,
            tipo: 'TROCA_APROVADA_PUBLICADA',
          }));
        }
      }));
    });

    it('colaborador comum não consegue aprovar/recusar troca PENDENTE_GESTOR', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'trocasEscala', 'troca-pendente-gestor'),
          troca({ trocaId: 'troca-pendente-gestor', status: 'PENDENTE_GESTOR' }),
        );
      });
      const colaboradorComum = autenticarComo(usuarios.colaborador);
      await assertFails(updateDoc(doc(colaboradorComum, 'trocasEscala', 'troca-pendente-gestor'), {
        status: 'APROVADA_PUBLICADA',
        historico: [
          ...troca().historico,
          { tipo: 'FORJADO', porLogin: usuarios.colaborador.login, porNome: usuarios.colaborador.nome, porPerfil: 'SOLICITANTE', em: '2026-08-07T15:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('gestor de outra equipe não consegue aprovar (nem ler) a troca', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'trocasEscala', 'troca-pendente-gestor'),
          troca({ trocaId: 'troca-pendente-gestor', status: 'PENDENTE_GESTOR' }),
        );
      });
      const externo = autenticarComo(usuarios.externo);
      await assertFails(getDoc(doc(externo, 'trocasEscala', 'troca-pendente-gestor')));
      await assertFails(updateDoc(doc(externo, 'trocasEscala', 'troca-pendente-gestor'), {
        status: 'APROVADA_PUBLICADA',
        gestorLogin: usuarios.externo.login,
        historico: [
          ...troca().historico,
          { tipo: 'FORJADO', porLogin: usuarios.externo.login, porNome: usuarios.externo.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });
  });
});

/**
 * ADMIN_SISTEMA — perfil explícito com fallback (não quebra usuários
 * existentes), escopo global cross-equipe, e a trava contra
 * escalonamento de privilégio na coleção `usuarios`. `usuarios.admin`
 * (login `paula.ferraz`) é o único fixture com `perfil` definido — todos
 * os outros (gestor/colaborador/colega/externo) continuam sem o campo,
 * de propósito: a suíte inteira acima já é o teste de regressão do
 * fallback, e precisa continuar passando sem alteração.
 */
describe('ADMIN_SISTEMA — perfil explícito e acesso global', () => {
  it('permite ao admin listar notificacoesTroca de outra equipe (filtro composto equipeId+destinatarioLogin, exigido pela regra); nega para colaborador de fora', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(
        doc(contexto.firestore(), 'notificacoesTroca', 'notif-colega'),
        notificacaoTroca({ id: 'notif-colega', destinatarioLogin: usuarios.colega.login }),
      );
    });
    const admin = autenticarComo(usuarios.admin);
    const resultado = await assertSucceeds(getDocs(query(
      collection(admin, 'notificacoesTroca'),
      where('equipeId', '==', 'EQ_COSI_SOC'),
      where('destinatarioLogin', '==', usuarios.colega.login),
    )));
    expect(resultado.docs.map((d) => d.id)).toContain('notif-colega');

    const colaborador = autenticarComo(usuarios.colaborador);
    await assertFails(getDocs(query(
      collection(colaborador, 'notificacoesTroca'),
      where('equipeId', '==', 'EQ_CODB_NOC'),
      where('destinatarioLogin', '==', usuarios.externo.login),
    )));
  });

  it('lê usuarios, turnosMes e trocasEscala de uma equipe que não é a dele', async () => {
    const admin = autenticarComo(usuarios.admin);
    await assertSucceeds(getDoc(doc(admin, 'usuarios', usuarios.colaborador.login)));
    await assertSucceeds(getDoc(doc(admin, 'turnosMes', 'publicada-soc')));
    await assertSucceeds(getDoc(doc(admin, 'turnosMes', 'publicada-codb-noc')));
    await assertSucceeds(getDoc(doc(admin, 'trocasEscala', 'troca-1')));
  });

  it('cria rascunho para uma equipe da qual não é membro', async () => {
    const admin = autenticarComo(usuarios.admin);
    await assertSucceeds(setDoc(
      doc(admin, 'rascunhosTurnosMes', 'rascunho-admin-codb-noc'),
      escala(usuarios.externo.login, 'EQ_CODB_NOC', 'RASCUNHO'),
    ));
  });

  it('gestor não-admin continua bloqueado fora da própria equipe (regressão do podeOperarNaEquipe)', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(getDoc(doc(gestor, 'turnosMes', 'publicada-codb-noc')));
    await assertFails(setDoc(
      doc(gestor, 'rascunhosTurnosMes', 'rascunho-gestor-codb-noc'),
      escala(usuarios.externo.login, 'EQ_CODB_NOC', 'RASCUNHO'),
    ));
  });

  it('impede o gestor de setar perfil ou escopo em si mesmo', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(updateDoc(doc(gestor, 'usuarios', usuarios.gestor.login), {
      perfil: 'ADMIN_SISTEMA',
    }));
    await assertFails(updateDoc(doc(gestor, 'usuarios', usuarios.gestor.login), {
      escopo: 'GLOBAL',
    }));
  });

  it('impede o gestor de setar perfil ou escopo em um colega da própria equipe', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(updateDoc(doc(gestor, 'usuarios', usuarios.colaborador.login), {
      perfil: 'GESTOR_EQUIPE',
    }));
    await assertFails(updateDoc(doc(gestor, 'usuarios', usuarios.colaborador.login), {
      escopo: 'GLOBAL',
    }));
  });

  it('impede o gestor de criar um novo usuário com perfil ADMIN_SISTEMA ou escopo GLOBAL', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    const base = {
      login: 'novo.login',
      nome: 'Novo Login',
      email: 'novo.login@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: usuarios.gestor.login,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    };
    await assertFails(setDoc(doc(gestor, 'usuarios', 'novo.login'), {
      ...base,
      perfil: 'ADMIN_SISTEMA',
    }));
    await assertFails(setDoc(doc(gestor, 'usuarios', 'novo.login'), {
      ...base,
      escopo: 'GLOBAL',
    }));
  });

  it('permite ao gestor criar um novo usuário sem perfil/escopo, que herda o fallback', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertSucceeds(setDoc(doc(gestor, 'usuarios', 'novo.login'), {
      login: 'novo.login',
      nome: 'Novo Login',
      email: 'novo.login@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: usuarios.gestor.login,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    }));
  });

  it('permite ao admin conceder perfil a um colaborador existente e realocar de equipe', async () => {
    const admin = autenticarComo(usuarios.admin);
    await assertSucceeds(updateDoc(doc(admin, 'usuarios', usuarios.colaborador.login), {
      perfil: 'GESTOR_EQUIPE',
    }));
    await assertSucceeds(updateDoc(doc(admin, 'usuarios', usuarios.colaborador.login), {
      equipeId: 'EQ_CODB_NOC',
    }));
  });

  it('permite ao admin criar um segundo ADMIN_SISTEMA', async () => {
    const admin = autenticarComo(usuarios.admin);
    await assertSucceeds(setDoc(doc(admin, 'usuarios', 'segundo.admin'), {
      login: 'segundo.admin',
      nome: 'Segundo Admin',
      email: 'segundo.admin@teste.local',
      cargo: 'ADMIN',
      equipeId: 'EQ_ADMIN',
      gestorUid: null,
      nivelHierarquico: 0,
      turnoPadrao: 'ADM',
      ativo: true,
      perfil: 'ADMIN_SISTEMA',
      escopo: 'GLOBAL',
    }));
  });

  it('permite ao admin excluir usuario, troca e notificação; nega para gestor e colaborador', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(
        doc(contexto.firestore(), 'notificacoesTroca', 'notif-para-excluir'),
        notificacaoTroca({ id: 'notif-para-excluir' }),
      );
    });
    const admin = autenticarComo(usuarios.admin);
    const gestor = autenticarComo(usuarios.gestor);
    const colaborador = autenticarComo(usuarios.colaborador);

    await assertFails(deleteDoc(doc(gestor, 'trocasEscala', 'troca-1')));
    await assertFails(deleteDoc(doc(colaborador, 'notificacoesTroca', 'notif-para-excluir')));
    await assertFails(deleteDoc(doc(gestor, 'usuarios', usuarios.colaborador.login)));

    await assertSucceeds(deleteDoc(doc(admin, 'notificacoesTroca', 'notif-para-excluir')));
    await assertSucceeds(deleteDoc(doc(admin, 'trocasEscala', 'troca-1')));
    await assertSucceeds(deleteDoc(doc(admin, 'usuarios', usuarios.colaborador.login)));
  });

  /**
   * Reproduz o fluxo real de `excluirUsuario()` (lib/firebase/
   * adminRepository.ts): list (getDocs com filtro composto equipeId+campo
   * do candidato) seguido de delete em lote — para um candidato de uma
   * equipe diferente da do admin (`EQ_ADMIN`), não só a mesma equipe por
   * coincidência.
   */
  it('permite ao admin executar list+delete em lote (padrão de excluirUsuario) para candidato de outra equipe', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(
        doc(db, 'notificacoesTroca', 'notif-externo'),
        notificacaoTroca({
          id: 'notif-externo',
          equipeId: 'EQ_CODB_NOC',
          destinatarioLogin: usuarios.externo.login,
          criadoPorLogin: usuarios.externo.login,
        }),
      );
    });
    const admin = autenticarComo(usuarios.admin);

    const encontradas = await assertSucceeds(getDocs(query(
      collection(admin, 'notificacoesTroca'),
      where('equipeId', '==', 'EQ_CODB_NOC'),
      where('destinatarioLogin', '==', usuarios.externo.login),
    )));
    expect(encontradas.docs.map((d) => d.id)).toEqual(['notif-externo']);

    await Promise.all(encontradas.docs.map((snapshot) => assertSucceeds(deleteDoc(snapshot.ref))));
  });

  it('equipes/setores: leitura livre para autenticado, escrita só admin, delete sempre negado', async () => {
    const admin = autenticarComo(usuarios.admin);
    const gestor = autenticarComo(usuarios.gestor);
    const equipe = { id: 'EQ_NOVA', nome: 'Nova Equipe', sigla: 'NOVA', ativa: true };
    const setor = { id: 'SET_NOVO', nome: 'Novo Setor', sigla: 'NOVO', ativo: true };

    await assertSucceeds(setDoc(doc(admin, 'equipes', equipe.id), equipe));
    await assertSucceeds(setDoc(doc(admin, 'setores', setor.id), setor));
    await assertFails(setDoc(doc(gestor, 'equipes', 'EQ_OUTRA'), { id: 'EQ_OUTRA', nome: 'x', sigla: 'x', ativa: true }));
    await assertFails(setDoc(doc(gestor, 'setores', 'SET_OUTRO'), { id: 'SET_OUTRO', nome: 'x', sigla: 'x', ativo: true }));
    await assertSucceeds(getDoc(doc(gestor, 'equipes', equipe.id)));
    await assertFails(deleteDoc(doc(admin, 'equipes', equipe.id)));
    await assertFails(deleteDoc(doc(admin, 'setores', setor.id)));
  });

  it('impede ANALISTA_SOC de acessar auditoriaAdmin; permite ao admin criar registro com atorRealLogin correto', async () => {
    const colaborador = autenticarComo(usuarios.colaborador);
    const admin = autenticarComo(usuarios.admin);
    const registro = {
      atorRealLogin: usuarios.admin.login,
      atorRealNome: usuarios.admin.nome,
      atorRealPerfil: 'ADMIN_SISTEMA',
      atorSimuladoLogin: usuarios.gestor.login,
      atorSimuladoNome: usuarios.gestor.nome,
      atorSimuladoPerfil: 'GESTOR_EQUIPE',
      equipeId: usuarios.gestor.equipeId,
      acao: 'PUBLICAR_ESCALA',
      em: '2026-08-07T13:00:00.000Z',
    };
    await assertFails(setDoc(doc(colaborador, 'auditoriaAdmin', 'evento-1'), registro));
    await assertFails(setDoc(doc(admin, 'auditoriaAdmin', 'evento-2'), {
      ...registro,
      atorRealLogin: usuarios.gestor.login,
    }));
    await assertSucceeds(setDoc(doc(admin, 'auditoriaAdmin', 'evento-3'), registro));
  });
});
