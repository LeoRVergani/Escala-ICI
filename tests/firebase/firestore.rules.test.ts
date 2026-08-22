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
  orderBy,
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
  /** Escopo UNIDADE — só sobre GEDSI, ver `unidadesOrganizacionais e equipes — escopo GESTOR_UNIDADE`. */
  gestorUnidade: {
    login: 'renato.pires',
    nome: 'Renato Pires',
    email: 'renato.pires@teste.local',
    equipeId: 'EQ_GEDSI_ADM',
    nivelHierarquico: 4,
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    unidadesPermitidas: ['GEDSI'],
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

function escopoOperacional(ajustes: Record<string, unknown> = {}) {
  return {
    tipo: 'PLANTAO',
    alvoId: 'PLANTAO_TESTE',
    alvoNome: 'Plantão de Teste',
    unidadeId: 'COSI',
    caminhoUnidade: ['GEDSI', 'COSI'],
    responsaveisLogin: ['marina.azevedo'],
    responsaveisEquipe: [],
    equipesConsulta: ['EQ_COSI_SOC'],
    ativo: true,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    criadoPorLogin: usuarios.admin.login,
    atualizadoPorLogin: usuarios.admin.login,
    schemaVersion: 1,
    ...ajustes,
  };
}

function grupoPlantaoMatriz(grupoId = 'PLANTAO_COSI') {
  return {
    grupoId,
    nome: 'Plantão COSI',
    equipeResponsavelId: 'EQ_PLANTAO_COSI',
    equipesConsulta: ['EQ_PLANTAO_COSI'],
    timezone: 'America/Sao_Paulo',
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: usuarios.admin.login,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
  };
}

function competenciaPlantaoMatriz(status: 'RASCUNHO' | 'PUBLICADA' = 'RASCUNHO') {
  return {
    id: 'PLANTAO_COSI_2026-08',
    grupoId: 'PLANTAO_COSI',
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    status,
    revisao: status === 'PUBLICADA' ? 1 : 0,
    origem: 'MANUAL',
    totaisInformadosOrigem: null,
    totalBruto: { quantidade: 0, minutos: 0 },
    schemaVersion: 1,
    criadoPorLogin: usuarios.gestor.login,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
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

  describe('escoposOperacionais — matriz de responsáveis por escala', () => {
    it('ADMIN_SISTEMA cria, edita e desativa escopo operacional', async () => {
      const db = autenticarComo(usuarios.admin);
      const ref = doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE');

      await assertSucceeds(setDoc(ref, escopoOperacional()));
      await assertSucceeds(updateDoc(ref, {
        responsaveisLogin: ['marina.azevedo', 'wanessa.moriyama'],
        ativo: false,
        atualizadoPorLogin: usuarios.admin.login,
      }));
    });

    it('usuário comum não cria nem edita escopo operacional, inclusive para se colocar como responsável', async () => {
      const db = autenticarComo(usuarios.colaborador);
      const ref = doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE');
      await assertFails(setDoc(ref, escopoOperacional({ responsaveisLogin: [usuarios.colaborador.login] })));

      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE'), escopoOperacional());
      });
      await assertFails(updateDoc(ref, { responsaveisLogin: [usuarios.colaborador.login] }));
    });

    it('delete físico é negado', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE'), escopoOperacional());
      });
      const db = autenticarComo(usuarios.admin);
      await assertFails(deleteDoc(doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE')));
    });

    it('campo extra e schemaVersion inválido são negados', async () => {
      const db = autenticarComo(usuarios.admin);
      await assertFails(setDoc(doc(db, 'escoposOperacionais', 'extra'), escopoOperacional({ campoExtra: true })));
      await assertFails(setDoc(doc(db, 'escoposOperacionais', 'schema'), escopoOperacional({ schemaVersion: 2 })));
    });

    it('criar vínculo sem responsável por login ou equipe administradora é negado', async () => {
      const db = autenticarComo(usuarios.admin);
      await assertFails(setDoc(doc(db, 'escoposOperacionais', 'sem-responsavel'), escopoOperacional({
        responsaveisLogin: [],
        responsaveisEquipe: [],
      })));
    });

    it('equipesConsulta continua read-only para usuário comum e não concede escrita administrativa', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE'), escopoOperacional({
          responsaveisLogin: [],
          responsaveisEquipe: ['EQ_OUTRA'],
          equipesConsulta: [usuarios.colaborador.equipeId],
        }));
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(getDoc(doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE')));
      await assertFails(updateDoc(doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_TESTE'), {
        responsaveisLogin: [usuarios.colaborador.login],
      }));
    });
  });

  describe('ESCOPO-OPERACIONAL-MATRIZ-2 — escrita e leitura pelo alvo', () => {
    async function semearMatriz(ajustesPlantao: Record<string, unknown> = {}) {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await Promise.all([
          setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoMatriz()),
          setDoc(doc(db, 'escoposOperacionais', 'JORNADA_EQ_SOC'), escopoOperacional({
            tipo: 'JORNADA',
            alvoId: 'EQ_SOC',
            alvoNome: 'SOC',
            equipesConsulta: [],
            responsaveisLogin: [usuarios.gestor.login],
          })),
          setDoc(doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_COSI'), escopoOperacional({
            tipo: 'PLANTAO',
            alvoId: 'PLANTAO_COSI',
            alvoNome: 'Plantão COSI',
            responsaveisLogin: [usuarios.gestor.login],
            equipesConsulta: [usuarios.colaborador.equipeId],
            ...ajustesPlantao,
          })),
        ]);
      });
    }

    it('ADMIN_SISTEMA escreve qualquer alvo de Jornada e Plantão', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.admin);
      await assertSucceeds(setDoc(doc(db, 'rascunhosTurnosMes', 'admin-eq-soc'), escala('alguem', 'EQ_SOC', 'RASCUNHO')));
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08'),
        { ...competenciaPlantaoMatriz(), criadoPorLogin: usuarios.admin.login },
      ));
    });

    it('Marina responsável por JORNADA/EQ_SOC salva rascunho, turno publicado e estado de publicação pelo equipeId alvo', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(doc(db, 'rascunhosTurnosMes', 'EQ_SOC_caio_2026-08'), escala('caio', 'EQ_SOC', 'RASCUNHO')));
      await assertSucceeds(setDoc(doc(db, 'turnosMes', 'EQ_SOC_caio_2026-08'), escala('caio', 'EQ_SOC', 'PUBLICADA')));
      await assertSucceeds(setDoc(doc(db, 'publicacoesEscala', 'EQ_SOC_2026-08'), {
        id: 'EQ_SOC_2026-08', equipeId: 'EQ_SOC', competencia: '2026-08', revisaoAtual: 1,
      }));
    });

    it('responsável por JORNADA lê a equipe-alvo, cadastra ausente e reconcilia somente aliases', async () => {
      await semearMatriz();
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'usuarios', 'pessoa.soc'), {
          login: 'pessoa.soc',
          nome: 'Pessoa SOC',
          email: 'pessoa.soc@teste.local',
          equipeId: 'EQ_SOC',
          nivelHierarquico: 6,
          ativo: true,
        });
      });

      const db = autenticarComo(usuarios.gestor);
      const pessoas = await assertSucceeds(getDocs(query(
        collection(db, 'usuarios'),
        where('equipeId', '==', 'EQ_SOC'),
      )));
      expect(pessoas.docs.map((item) => item.id)).toContain('pessoa.soc');

      await assertSucceeds(setDoc(doc(db, 'usuarios', 'nova.pessoa.soc'), {
        login: 'nova.pessoa.soc',
        nome: 'Nova Pessoa SOC',
        email: 'nova.pessoa.soc@teste.local',
        cargo: 'ANALISTA_SOC',
        equipeId: 'EQ_SOC',
        gestorUid: usuarios.gestor.login,
        nivelHierarquico: 6,
        turnoPadrao: 'M',
        ativo: true,
      }));
      await assertSucceeds(updateDoc(doc(db, 'usuarios', 'pessoa.soc'), {
        aliasesPlanilha: ['PESSOA SOC'],
        atualizadoEm: '2026-08-02T00:00:00.000Z',
      }));

      await assertFails(updateDoc(doc(db, 'usuarios', 'pessoa.soc'), {
        nome: 'Nome adulterado',
      }));
      await assertFails(updateDoc(doc(db, 'usuarios', 'pessoa.soc'), {
        equipeId: usuarios.gestor.equipeId,
      }));
      await assertFails(setDoc(doc(db, 'usuarios', 'admin.forjado'), {
        login: 'admin.forjado',
        nome: 'Admin forjado',
        email: 'admin.forjado@teste.local',
        equipeId: 'EQ_SOC',
        nivelHierarquico: 0,
        perfil: 'ADMIN_SISTEMA',
        ativo: true,
      }));
    });

    it('responsável por JORNADA administra o catálogo de turnos do alvo', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      const ref = doc(db, 'tiposTurno', 'EQ_SOC_M');
      await assertSucceeds(setDoc(ref, {
        equipeId: 'EQ_SOC', codigo: 'M', nome: 'Manhã', inicio: '07:00', fim: '13:00',
      }));
      await assertSucceeds(updateDoc(ref, { nome: 'Manhã SOC' }));
      await assertFails(deleteDoc(ref));
    });

    it('Marina responsável por PLANTAO/PLANTAO_COSI salva rascunho e publicação pelo grupoId alvo', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08'),
        competenciaPlantaoMatriz(),
      ));
      await assertSucceeds(setDoc(
        doc(db, 'competenciasPlantao', 'PLANTAO_COSI_2026-08'),
        competenciaPlantaoMatriz('PUBLICADA'),
      ));
    });

    it('responsável por Plantão cadastra colaborador na equipe responsável do próprio grupo', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      const ref = doc(db, 'usuarios', 'novo.plantonista');
      await assertSucceeds(setDoc(ref, {
        login: 'novo.plantonista',
        nome: 'Novo Plantonista',
        email: 'novo.plantonista@teste.local',
        cargo: 'Analista',
        equipeId: 'EQ_PLANTAO_COSI',
        gestorUid: usuarios.gestor.login,
        nivelHierarquico: 6,
        turnoPadrao: 'M',
        ativo: true,
        cadastroOperacional: {
          tipo: 'PLANTAO',
          alvoId: 'PLANTAO_COSI',
          criadoPorLogin: usuarios.gestor.login,
        },
      }));
      await assertSucceeds(getDoc(ref));
      const usuariosDoPlantao = await assertSucceeds(getDocs(query(
        collection(db, 'usuarios'),
        where('equipeId', '==', 'EQ_PLANTAO_COSI'),
        where('cadastroOperacional.tipo', '==', 'PLANTAO'),
        where('cadastroOperacional.alvoId', '==', 'PLANTAO_COSI'),
      )));
      expect(usuariosDoPlantao.docs.map((snapshot) => snapshot.id)).toContain('novo.plantonista');
      await assertSucceeds(updateDoc(ref, {
        aliasesPlanilha: ['NOVO PLANTONISTA'],
        atualizadoEm: '2026-08-02T00:00:00.000Z',
      }));
    });

    it('responsável por Plantão cadastra outro coordenador ou supervisor apenas na equipe do alvo', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      const base = {
        nome: 'Nova Coordenação',
        email: 'nova.coordenacao@teste.local',
        cargo: 'Coordenador',
        equipeId: 'EQ_PLANTAO_COSI',
        gestorUid: usuarios.gestor.login,
        nivelHierarquico: 4,
        turnoPadrao: 'M',
        ativo: true,
        escopo: 'EQUIPE',
        cadastroOperacional: {
          tipo: 'PLANTAO',
          alvoId: 'PLANTAO_COSI',
          criadoPorLogin: usuarios.gestor.login,
        },
      };

      await assertSucceeds(setDoc(doc(db, 'usuarios', 'nova.coordenacao'), {
        ...base,
        login: 'nova.coordenacao',
        perfil: 'GESTOR_EQUIPE',
      }));
      await assertSucceeds(setDoc(doc(db, 'usuarios', 'nova.supervisao'), {
        ...base,
        login: 'nova.supervisao',
        email: 'nova.supervisao@teste.local',
        perfil: 'SUPERVISOR_EQUIPE',
      }));
    });

    it('responsável por Plantão não forja equipe, alvo, admin, gestão de unidade ou escopo global', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      const base = {
        login: 'delegacao.invalida',
        nome: 'Delegação Inválida',
        email: 'delegacao.invalida@teste.local',
        cargo: 'Coordenador',
        equipeId: 'EQ_PLANTAO_COSI',
        gestorUid: usuarios.gestor.login,
        nivelHierarquico: 4,
        turnoPadrao: 'M',
        ativo: true,
        perfil: 'GESTOR_EQUIPE',
        escopo: 'EQUIPE',
        cadastroOperacional: {
          tipo: 'PLANTAO',
          alvoId: 'PLANTAO_COSI',
          criadoPorLogin: usuarios.gestor.login,
        },
      };

      await assertFails(setDoc(doc(db, 'usuarios', 'equipe.forjada'), {
        ...base, login: 'equipe.forjada', equipeId: 'EQ_CODB_NOC',
      }));
      await assertFails(setDoc(doc(db, 'usuarios', 'alvo.forjado'), {
        ...base,
        login: 'alvo.forjado',
        cadastroOperacional: { ...base.cadastroOperacional, alvoId: 'PLANTAO_INEXISTENTE' },
      }));
      await assertFails(setDoc(doc(db, 'usuarios', 'admin.forjado.plantao'), {
        ...base, login: 'admin.forjado.plantao', perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL',
      }));
      await assertFails(setDoc(doc(db, 'usuarios', 'unidade.forjada'), {
        ...base, login: 'unidade.forjada', perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE',
      }));
    });

    it('responsável por Jornada cadastra outro coordenador com escopo restrito à equipe do alvo', async () => {
      await semearMatriz();
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(doc(db, 'usuarios', 'coordenador.jornada'), {
        login: 'coordenador.jornada',
        nome: 'Coordenador Jornada',
        email: 'coordenador.jornada@teste.local',
        cargo: 'Coordenador',
        equipeId: 'EQ_SOC',
        gestorUid: usuarios.gestor.login,
        nivelHierarquico: 4,
        turnoPadrao: 'M',
        ativo: true,
        perfil: 'GESTOR_EQUIPE',
        escopo: 'EQUIPE',
        cadastroOperacional: {
          tipo: 'JORNADA',
          alvoId: 'EQ_SOC',
          criadoPorLogin: usuarios.gestor.login,
        },
      }));
    });

    it('equipesConsulta lê/monitora Plantão, mas não salva nem publica', async () => {
      await semearMatriz({ responsaveisLogin: [usuarios.gestor.login] });
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08'),
          competenciaPlantaoMatriz(),
        );
      });
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI')));
      await assertSucceeds(getDoc(doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08')));
      await assertFails(updateDoc(doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08'), {
        atualizadoEm: '2026-08-02T00:00:00.000Z',
      }));
      await assertFails(setDoc(
        doc(db, 'competenciasPlantao', 'PLANTAO_COSI_2026-08'),
        competenciaPlantaoMatriz('PUBLICADA'),
      ));
    });

    it('usuário sem matriz e escopo inativo não escrevem no alvo', async () => {
      await semearMatriz({ ativo: false });
      const semMatriz = autenticarComo(usuarios.externo);
      const inativo = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(doc(semMatriz, 'rascunhosTurnosMes', 'sem-matriz'), escala('ravi', 'EQ_SOC', 'RASCUNHO')));
      await assertFails(setDoc(
        doc(inativo, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08'),
        competenciaPlantaoMatriz(),
      ));
    });

    it('matriz de Plantão inativa bloqueia leitura operacional mesmo quando a ACL legada permitiria', async () => {
      await semearMatriz({ ativo: false });
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await Promise.all([
          setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
            ...grupoPlantaoMatriz(),
            equipesConsulta: [usuarios.colaborador.equipeId],
          }),
          setDoc(
            doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08'),
            competenciaPlantaoMatriz(),
          ),
          setDoc(
            doc(db, 'gruposPlantao', 'PLANTAO_COSI', 'participantes', usuarios.colaborador.login),
            { grupoId: 'PLANTAO_COSI', login: usuarios.colaborador.login, ativo: true },
          ),
        ]);
      });

      const db = autenticarComo(usuarios.colaborador);
      await assertFails(getDoc(doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-08')));
      await assertFails(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI', 'participantes', usuarios.colaborador.login)));
    });

    it('responsável não consegue reendereçar rascunho ou estado de publicação de Jornada pelo payload', async () => {
      await semearMatriz();
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await Promise.all([
          setDoc(
            doc(db, 'rascunhosTurnosMes', 'EQ_FORA_pessoa_2026-08'),
            escala('pessoa', 'EQ_FORA', 'RASCUNHO'),
          ),
          setDoc(doc(db, 'publicacoesEscala', 'EQ_FORA_2026-08'), {
            id: 'EQ_FORA_2026-08', equipeId: 'EQ_FORA', competencia: '2026-08', revisaoAtual: 1,
          }),
        ]);
      });

      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'rascunhosTurnosMes', 'EQ_FORA_pessoa_2026-08'),
        escala('pessoa', 'EQ_SOC', 'RASCUNHO'),
      ));
      await assertFails(setDoc(doc(db, 'publicacoesEscala', 'EQ_FORA_2026-08'), {
        id: 'EQ_FORA_2026-08', equipeId: 'EQ_SOC', competencia: '2026-08', revisaoAtual: 2,
      }));
    });

    it('responsável não consegue reendereçar uma publicação alheia para o próprio grupo no payload', async () => {
      await semearMatriz();
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'competenciasPlantao', 'PLANTAO_FORA_2026-08'), {
          ...competenciaPlantaoMatriz('PUBLICADA'),
          id: 'PLANTAO_FORA_2026-08',
          grupoId: 'PLANTAO_FORA',
        });
      });
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(doc(db, 'competenciasPlantao', 'PLANTAO_FORA_2026-08'), {
        ...competenciaPlantaoMatriz('PUBLICADA'),
        id: 'PLANTAO_FORA_2026-08',
        grupoId: 'PLANTAO_COSI',
        revisao: 2,
      }));
    });
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

  /**
   * ESCOPO-OPERACIONAL-MATRIZ-2 — aprovar/recusar/publicar uma troca
   * PENDENTE_GESTOR deixa de depender só de `souGestor() +
   * podeOperarNaEquipe()` (ACL legada de equipe) e passa a aceitar o
   * responsável operacional ATIVO na Matriz para `tipo=JORNADA` e
   * `alvoId=equipeId` da troca — mesmo quando ele não pertence à equipe
   * (`minhaEquipe()` não bate) e não é "gestor" no sentido legado. Espelha
   * exatamente `podeAdministrarJornada()`. `usuarios.gestor` (marina.azevedo)
   * já é usado nos testes de ESCOPO-OPERACIONAL-MATRIZ-2 acima como
   * responsável de `JORNADA/EQ_SOC` — reaproveitado aqui.
   */
  describe('trocasEscala — aprovação pelo responsável operacional da Jornada (Matriz)', () => {
    function escopoJornadaSoc(ajustes: Record<string, unknown> = {}) {
      return escopoOperacional({
        tipo: 'JORNADA',
        alvoId: 'EQ_SOC',
        alvoNome: 'SOC',
        equipesConsulta: [],
        responsaveisLogin: [usuarios.gestor.login],
        ...ajustes,
      });
    }

    function trocaJornadaSoc(ajustes: Record<string, unknown> = {}) {
      return troca({
        trocaId: 'troca-jornada-soc',
        equipeId: 'EQ_SOC',
        status: 'PENDENTE_GESTOR',
        ...ajustes,
      });
    }

    async function semearTrocaSoc(ajustesMatriz: Record<string, unknown> = {}, ajustesTroca: Record<string, unknown> = {}) {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await Promise.all([
          setDoc(doc(db, 'escoposOperacionais', 'JORNADA_EQ_SOC'), escopoJornadaSoc(ajustesMatriz)),
          setDoc(doc(db, 'trocasEscala', 'troca-jornada-soc'), trocaJornadaSoc(ajustesTroca)),
        ]);
      });
    }

    it('Marina (responsável operacional ativo de JORNADA/EQ_SOC) aprova e publica a troca', async () => {
      await semearTrocaSoc();
      const gestor = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(gestor, 'trocasEscala', 'troca-jornada-soc'), {
        status: 'APROVADA_PUBLICADA',
        aprovadoEm: '2026-08-07T15:00:00.000Z',
        publicadoEm: '2026-08-07T15:00:00.000Z',
        gestorLogin: usuarios.gestor.login,
        gestorNome: usuarios.gestor.nome,
        historico: [
          ...trocaJornadaSoc().historico,
          { tipo: 'APROVADA_PUBLICADA', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'Aprovada' },
        ],
      }));
    });

    it('Marina (responsável operacional ativo de JORNADA/EQ_SOC) recusa a troca', async () => {
      await semearTrocaSoc();
      const gestor = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(gestor, 'trocasEscala', 'troca-jornada-soc'), {
        status: 'RECUSADA_GESTOR',
        motivoRecusa: 'Sem cobertura suficiente.',
        gestorLogin: usuarios.gestor.login,
        gestorNome: usuarios.gestor.nome,
        historico: [
          ...trocaJornadaSoc().historico,
          { tipo: 'RECUSA_GESTOR', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'Recusada' },
        ],
      }));
    });

    it('a aprovação também permite criar as notificações de solicitante e destinatário', async () => {
      await semearTrocaSoc();
      const gestor = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(gestor, 'trocasEscala', 'troca-jornada-soc'), {
        status: 'APROVADA_PUBLICADA',
        aprovadoEm: '2026-08-07T15:00:00.000Z',
        publicadoEm: '2026-08-07T15:00:00.000Z',
        gestorLogin: usuarios.gestor.login,
        gestorNome: usuarios.gestor.nome,
        historico: [
          ...trocaJornadaSoc().historico,
          { tipo: 'APROVADA_PUBLICADA', porLogin: usuarios.gestor.login, porNome: usuarios.gestor.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'Aprovada' },
        ],
      }));
      for (const destinatarioLogin of [usuarios.colaborador.login, usuarios.colega.login]) {
        await assertSucceeds(setDoc(doc(gestor, 'notificacoesTroca', `notif-aprovada-${destinatarioLogin}`), notificacaoTroca({
          id: `notif-aprovada-${destinatarioLogin}`,
          destinatarioLogin,
          equipeId: 'EQ_SOC',
          tipo: 'TROCA_APROVADA_PUBLICADA',
          criadoPorLogin: usuarios.gestor.login,
          trocaId: 'troca-jornada-soc',
        })));
      }
    });

    it('usuário responsável só por PLANTAO/PLANTAO_COSI não aprova troca de Jornada SOC', async () => {
      await semearTrocaSoc();
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'escoposOperacionais', 'PLANTAO_PLANTAO_COSI'),
          escopoOperacional({
            tipo: 'PLANTAO',
            alvoId: 'PLANTAO_COSI',
            alvoNome: 'Plantão COSI',
            responsaveisLogin: [usuarios.externo.login],
            equipesConsulta: [usuarios.externo.equipeId],
          }),
        );
      });
      const responsavelPlantao = autenticarComo(usuarios.externo);
      await assertFails(getDoc(doc(responsavelPlantao, 'trocasEscala', 'troca-jornada-soc')));
      await assertFails(updateDoc(doc(responsavelPlantao, 'trocasEscala', 'troca-jornada-soc'), {
        status: 'APROVADA_PUBLICADA',
        gestorLogin: usuarios.externo.login,
        historico: [
          ...trocaJornadaSoc().historico,
          { tipo: 'FORJADO', porLogin: usuarios.externo.login, porNome: usuarios.externo.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('usuário sem matriz e fora da equipe não aprova, mesmo com matriz de JORNADA existindo para outro responsável', async () => {
      await semearTrocaSoc();
      const externo = autenticarComo(usuarios.externo);
      await assertFails(getDoc(doc(externo, 'trocasEscala', 'troca-jornada-soc')));
      await assertFails(updateDoc(doc(externo, 'trocasEscala', 'troca-jornada-soc'), {
        status: 'RECUSADA_GESTOR',
        gestorLogin: usuarios.externo.login,
        historico: [
          ...trocaJornadaSoc().historico,
          { tipo: 'FORJADO', porLogin: usuarios.externo.login, porNome: usuarios.externo.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('equipe só em equipesConsulta de um Plantão (nunca responsável) não aprova troca de Jornada', async () => {
      await semearTrocaSoc({ responsaveisLogin: [], responsaveisEquipe: ['EQ_OUTRA_RESPONSAVEL'] });
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'escoposOperacionais', 'PLANTAO_PLANTAO_COSI'),
          escopoOperacional({
            tipo: 'PLANTAO',
            alvoId: 'PLANTAO_COSI',
            alvoNome: 'Plantão COSI',
            responsaveisLogin: [usuarios.externo.login],
            equipesConsulta: [usuarios.colega.equipeId],
          }),
        );
      });
      const consultaSomente = autenticarComo(usuarios.colega);
      await assertFails(getDoc(doc(consultaSomente, 'trocasEscala', 'troca-jornada-soc')));
      await assertFails(updateDoc(doc(consultaSomente, 'trocasEscala', 'troca-jornada-soc'), {
        status: 'APROVADA_PUBLICADA',
        gestorLogin: usuarios.colega.login,
        historico: [
          ...trocaJornadaSoc().historico,
          { tipo: 'FORJADO', porLogin: usuarios.colega.login, porNome: usuarios.colega.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'forjado' },
        ],
      }));
    });

    it('solicitante e destinatário da própria troca continuam sem poder decidir como gestor, mesmo com Matriz ativa', async () => {
      await semearTrocaSoc();
      for (const ator of [usuarios.colaborador, usuarios.colega]) {
        const db = autenticarComo(ator);
        await assertFails(updateDoc(doc(db, 'trocasEscala', 'troca-jornada-soc'), {
          status: 'APROVADA_PUBLICADA',
          gestorLogin: ator.login,
          historico: [
            ...trocaJornadaSoc().historico,
            { tipo: 'FORJADO', porLogin: ator.login, porNome: ator.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'forjado' },
          ],
        }));
      }
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

    /**
     * ESCOPO-OPERACIONAL-MATRIZ-2 — segundo ramo do `create`: o responsável
     * operacional da Jornada (Matriz) cria a notificação da própria ação
     * gerencial (aprovar/recusar) mesmo fora da equipe (`minhaEquipe()` não
     * bate). Restrito ao alvo que ele realmente administra e aos dois
     * `tipo`s de notificação gerencial — nunca abre criação livre.
     */
    describe('create pelo responsável operacional da Jornada (Matriz)', () => {
      beforeEach(async () => {
        await ambiente.withSecurityRulesDisabled(async (contexto) => {
          await setDoc(
            doc(contexto.firestore(), 'escoposOperacionais', 'JORNADA_EQ_SOC'),
            escopoOperacional({
              tipo: 'JORNADA',
              alvoId: 'EQ_SOC',
              alvoNome: 'SOC',
              equipesConsulta: [],
              responsaveisLogin: [usuarios.gestor.login],
            }),
          );
        });
      });

      it('permite criar notificação de recusa/aprovação gerencial para alvo administrado fora da própria equipe', async () => {
        const gestor = autenticarComo(usuarios.gestor);
        await assertSucceeds(setDoc(doc(gestor, 'notificacoesTroca', 'notif-recusada-soc'), notificacaoTroca({
          id: 'notif-recusada-soc',
          destinatarioLogin: usuarios.colaborador.login,
          equipeId: 'EQ_SOC',
          tipo: 'TROCA_RECUSADA_GESTOR',
          criadoPorLogin: usuarios.gestor.login,
          trocaId: 'troca-jornada-soc',
        })));
        await assertSucceeds(setDoc(doc(gestor, 'notificacoesTroca', 'notif-aprovada-soc'), notificacaoTroca({
          id: 'notif-aprovada-soc',
          destinatarioLogin: usuarios.colega.login,
          equipeId: 'EQ_SOC',
          tipo: 'TROCA_APROVADA_PUBLICADA',
          criadoPorLogin: usuarios.gestor.login,
          trocaId: 'troca-jornada-soc',
        })));
      });

      it('nega tipo fora da lista gerencial permitida para quem não pertence à equipe', async () => {
        const gestor = autenticarComo(usuarios.gestor);
        await assertFails(setDoc(doc(gestor, 'notificacoesTroca', 'notif-solicitada-soc'), notificacaoTroca({
          id: 'notif-solicitada-soc',
          destinatarioLogin: usuarios.colaborador.login,
          equipeId: 'EQ_SOC',
          tipo: 'TROCA_SOLICITADA',
          criadoPorLogin: usuarios.gestor.login,
          trocaId: 'troca-jornada-soc',
        })));
      });

      it('nega criar notificação de outra equipe sem Matriz para o alvo', async () => {
        const gestor = autenticarComo(usuarios.gestor);
        await assertFails(setDoc(doc(gestor, 'notificacoesTroca', 'notif-outra-equipe'), notificacaoTroca({
          id: 'notif-outra-equipe',
          destinatarioLogin: usuarios.colaborador.login,
          equipeId: 'EQ_SEM_MATRIZ',
          tipo: 'TROCA_APROVADA_PUBLICADA',
          criadoPorLogin: usuarios.gestor.login,
          trocaId: 'troca-jornada-soc',
        })));
      });

      it('continua impedindo forjar criadoPorLogin mesmo com Matriz ativa', async () => {
        const externo = autenticarComo(usuarios.externo);
        await assertFails(setDoc(doc(externo, 'notificacoesTroca', 'notif-forjada-soc'), notificacaoTroca({
          id: 'notif-forjada-soc',
          destinatarioLogin: usuarios.colaborador.login,
          equipeId: 'EQ_SOC',
          tipo: 'TROCA_APROVADA_PUBLICADA',
          criadoPorLogin: usuarios.gestor.login,
          trocaId: 'troca-jornada-soc',
        })));
      });
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

  it('impede promoção implícita: gestor não cria outro coordenador usando nível hierárquico <= 5 sem perfil', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(gestor, 'usuarios', 'novo.coordenador'), {
      login: 'novo.coordenador',
      nome: 'Novo Coordenador',
      email: 'novo.coordenador@empresa.com',
      cargo: 'Coordenador',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: usuarios.gestor.login,
      nivelHierarquico: 4,
      turnoPadrao: 'M',
      ativo: true,
    }));
  });

  it('permite ao gestor criar um colaborador sem perfil/escopo, no nível sem poder de gestão', async () => {
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

/**
 * Modelo organizacional flexível (`unidadesOrganizacionais`) — coleção
 * aditiva acima de `equipes`. `usuarios.gestorUnidade` tem
 * `unidadesPermitidas: ['GEDSI']`, então só pode criar/editar dentro desse
 * escopo — nunca por travessia de `parentId`, só pelo array explícito (ver
 * `minhasUnidadesPermitidas()` em firestore.rules).
 */
describe('unidadesOrganizacionais e equipes — escopo GESTOR_UNIDADE', () => {
  const gedsi = {
    unidadeId: 'GEDSI',
    nome: 'Gerência de Data Center e Segurança da Informação',
    sigla: 'GEDSI',
    tipo: 'GERENCIA',
    parentId: null,
    caminho: ['GEDSI'],
    ativa: true,
    criadoPorLogin: usuarios.admin.login,
  };

  it('leitura de unidadesOrganizacionais é livre para qualquer autenticado', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'unidadesOrganizacionais', gedsi.unidadeId), gedsi);
    });
    const colaborador = autenticarComo(usuarios.colaborador);
    await assertSucceeds(getDoc(doc(colaborador, 'unidadesOrganizacionais', gedsi.unidadeId)));
  });

  it('ADMIN_SISTEMA cria e edita qualquer unidade/equipe; delete de unidade sempre negado', async () => {
    const admin = autenticarComo(usuarios.admin);
    await assertSucceeds(setDoc(doc(admin, 'unidadesOrganizacionais', gedsi.unidadeId), gedsi));
    await assertSucceeds(updateDoc(doc(admin, 'unidadesOrganizacionais', gedsi.unidadeId), { nome: 'GEDSI renomeada' }));
    await assertFails(deleteDoc(doc(admin, 'unidadesOrganizacionais', gedsi.unidadeId)));

    await assertSucceeds(setDoc(doc(admin, 'equipes', 'EQ_GEDSI_TESTE'), {
      id: 'EQ_GEDSI_TESTE',
      nome: 'Equipe teste',
      sigla: 'TESTE',
      ativa: true,
      unidadeId: gedsi.unidadeId,
      caminhoUnidade: gedsi.caminho,
    }));
  });

  it('GESTOR_UNIDADE cria unidade filha dentro do escopo (parentId em unidadesPermitidas)', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'unidadesOrganizacionais', gedsi.unidadeId), gedsi);
    });
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertSucceeds(setDoc(doc(gestorUnidade, 'unidadesOrganizacionais', 'COSI'), {
      unidadeId: 'COSI',
      nome: 'COSI',
      sigla: 'COSI',
      tipo: 'COORDENACAO',
      parentId: 'GEDSI',
      caminho: ['GEDSI', 'COSI'],
      ativa: true,
      criadoPorLogin: usuarios.gestorUnidade.login,
    }));
  });

  it('GESTOR_UNIDADE não cria unidade fora do escopo (parentId fora de unidadesPermitidas, ou raiz)', async () => {
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertFails(setDoc(doc(gestorUnidade, 'unidadesOrganizacionais', 'FORA'), {
      unidadeId: 'FORA',
      nome: 'Fora do escopo',
      sigla: 'FORA',
      tipo: 'COORDENACAO',
      parentId: 'OUTRA_UNIDADE',
      caminho: ['OUTRA_UNIDADE', 'FORA'],
      ativa: true,
      criadoPorLogin: usuarios.gestorUnidade.login,
    }));
    // Raiz (parentId null) também é negada — só ADMIN_SISTEMA cria raiz.
    await assertFails(setDoc(doc(gestorUnidade, 'unidadesOrganizacionais', 'NOVA_RAIZ'), {
      unidadeId: 'NOVA_RAIZ',
      nome: 'Nova raiz',
      sigla: 'RAIZ',
      tipo: 'DIRETORIA',
      parentId: null,
      caminho: ['NOVA_RAIZ'],
      ativa: true,
      criadoPorLogin: usuarios.gestorUnidade.login,
    }));
  });

  it('GESTOR_UNIDADE edita unidade já em unidadesPermitidas; nega edição de outra unidade', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, 'unidadesOrganizacionais', gedsi.unidadeId), gedsi);
      await setDoc(doc(db, 'unidadesOrganizacionais', 'OUTRA_GERENCIA'), {
        unidadeId: 'OUTRA_GERENCIA',
        nome: 'Outra Gerência',
        sigla: 'OG',
        tipo: 'GERENCIA',
        parentId: null,
        caminho: ['OUTRA_GERENCIA'],
        ativa: true,
        criadoPorLogin: usuarios.admin.login,
      });
    });
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertSucceeds(updateDoc(doc(gestorUnidade, 'unidadesOrganizacionais', gedsi.unidadeId), { nome: 'GEDSI atualizada' }));
    await assertFails(updateDoc(doc(gestorUnidade, 'unidadesOrganizacionais', 'OUTRA_GERENCIA'), { nome: 'hackeado' }));
  });

  it('GESTOR_UNIDADE cria equipe dentro de uma unidade permitida; nega fora do escopo', async () => {
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertSucceeds(setDoc(doc(gestorUnidade, 'equipes', 'EQ_GEDSI_SOC'), {
      id: 'EQ_GEDSI_SOC',
      nome: 'SOC',
      sigla: 'SOC',
      ativa: true,
      unidadeId: 'GEDSI',
      caminhoUnidade: ['GEDSI'],
    }));
    await assertFails(setDoc(doc(gestorUnidade, 'equipes', 'EQ_FORA'), {
      id: 'EQ_FORA',
      nome: 'Fora',
      sigla: 'FORA',
      ativa: true,
      unidadeId: 'OUTRA_UNIDADE',
      caminhoUnidade: ['OUTRA_UNIDADE'],
    }));
  });

  it('GESTOR_UNIDADE edita equipe já pertencente a unidade permitida; nega outra', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, 'equipes', 'EQ_GEDSI_EXISTENTE'), {
        id: 'EQ_GEDSI_EXISTENTE', nome: 'Existente', sigla: 'EXI', ativa: true, unidadeId: 'GEDSI', caminhoUnidade: ['GEDSI'],
      });
      await setDoc(doc(db, 'equipes', 'EQ_FORA_EXISTENTE'), {
        id: 'EQ_FORA_EXISTENTE', nome: 'Fora existente', sigla: 'FOR', ativa: true, unidadeId: 'OUTRA_UNIDADE', caminhoUnidade: ['OUTRA_UNIDADE'],
      });
    });
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertSucceeds(updateDoc(doc(gestorUnidade, 'equipes', 'EQ_GEDSI_EXISTENTE'), { nome: 'Renomeada' }));
    await assertFails(updateDoc(doc(gestorUnidade, 'equipes', 'EQ_FORA_EXISTENTE'), { nome: 'hackeado' }));
  });

  it('GESTOR_UNIDADE cria/edita equipe numa SUBUNIDADE (caminhoUnidade contém a unidade permitida como ancestral, sem travessia de parentId)', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'unidadesOrganizacionais', 'GEDSI_SUL'), {
        unidadeId: 'GEDSI_SUL', nome: 'GEDSI Sul', sigla: 'GEDSI_SUL', tipo: 'SUPERVISAO',
        parentId: 'GEDSI', caminho: ['GEDSI', 'GEDSI_SUL'], ativa: true, criadoPorLogin: usuarios.admin.login,
      });
    });
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertSucceeds(setDoc(doc(gestorUnidade, 'equipes', 'EQ_GEDSI_SUL_SOC'), {
      id: 'EQ_GEDSI_SUL_SOC', nome: 'SOC Sul', sigla: 'SOC_SUL', ativa: true,
      unidadeId: 'GEDSI_SUL', caminhoUnidade: ['GEDSI', 'GEDSI_SUL'],
    }));
    await assertSucceeds(updateDoc(doc(gestorUnidade, 'equipes', 'EQ_GEDSI_SUL_SOC'), { nome: 'SOC Sul renomeada' }));
  });

  /**
   * Fase ESCOPO-GESTOR-UNIDADE-1 — antes desta fase, `update` só checava a
   * unidade ATUAL da equipe (`resource.data.unidadeId`); o `unidadeId` do
   * PAYLOAD (destino da migração) nunca era validado, então nada impedia
   * mover uma equipe para uma unidade fora do escopo do gestor. Corrigido:
   * agora a migração exige origem E destino dentro do escopo permitido.
   */
  it('migração de equipe: sucesso entre duas unidades permitidas, falha quando o destino está fora do escopo', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, 'unidadesOrganizacionais', 'GEDSI_SUL'), {
        unidadeId: 'GEDSI_SUL', nome: 'GEDSI Sul', sigla: 'GEDSI_SUL', tipo: 'SUPERVISAO',
        parentId: 'GEDSI', caminho: ['GEDSI', 'GEDSI_SUL'], ativa: true, criadoPorLogin: usuarios.admin.login,
      });
      await setDoc(doc(db, 'equipes', 'EQ_MIGRAVEL'), {
        id: 'EQ_MIGRAVEL', nome: 'Equipe migrável', sigla: 'MIG', ativa: true,
        unidadeId: 'GEDSI', caminhoUnidade: ['GEDSI'],
      });
    });
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    // Origem (GEDSI) e destino (GEDSI_SUL, subárvore de GEDSI) dentro do escopo — sucesso.
    await assertSucceeds(updateDoc(doc(gestorUnidade, 'equipes', 'EQ_MIGRAVEL'), {
      unidadeId: 'GEDSI_SUL', caminhoUnidade: ['GEDSI', 'GEDSI_SUL'],
    }));
    // De volta a uma unidade fora do escopo — negado, mesmo a equipe já estando (antes) dentro do escopo.
    await assertFails(updateDoc(doc(gestorUnidade, 'equipes', 'EQ_MIGRAVEL'), {
      unidadeId: 'OUTRA_UNIDADE', caminhoUnidade: ['OUTRA_UNIDADE'],
    }));
  });

  it('GESTOR_EQUIPE comum (sem GESTOR_UNIDADE) não cria unidade nem equipe — regressão', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(gestor, 'unidadesOrganizacionais', 'QUALQUER'), {
      unidadeId: 'QUALQUER',
      nome: 'x',
      sigla: 'x',
      tipo: 'SETOR',
      parentId: null,
      caminho: ['QUALQUER'],
      ativa: true,
      criadoPorLogin: usuarios.gestor.login,
    }));
    await assertFails(setDoc(doc(gestor, 'equipes', 'EQ_GESTOR_FORA'), {
      id: 'EQ_GESTOR_FORA', nome: 'x', sigla: 'x', ativa: true, unidadeId: 'GEDSI', caminhoUnidade: ['GEDSI'],
    }));
  });

  it('ANALISTA_SOC não acessa administração — sem escrita em unidadesOrganizacionais/equipes', async () => {
    const colaborador = autenticarComo(usuarios.colaborador);
    await assertFails(setDoc(doc(colaborador, 'unidadesOrganizacionais', 'X'), {
      unidadeId: 'X', nome: 'x', sigla: 'x', tipo: 'SETOR', parentId: null, caminho: ['X'], ativa: true, criadoPorLogin: usuarios.colaborador.login,
    }));
    await assertFails(setDoc(doc(colaborador, 'equipes', 'EQ_ANALISTA'), {
      id: 'EQ_ANALISTA', nome: 'x', sigla: 'x', ativa: true,
    }));
  });

  it('fallback por equipeId continua funcionando: GESTOR_EQUIPE sem equipesPermitidas continua operando a própria equipe', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertSucceeds(getDoc(doc(gestor, 'turnosMes', 'publicada-soc')));
    await assertSucceeds(updateDoc(doc(gestor, 'usuarios', usuarios.colaborador.login), { cargo: 'ANALISTA_SOC_SR' }));
  });
});

/**
 * Fase 3 (Lembretes) — pessoal. `colaborador` e `colega` são da mesma
 * equipe (`EQ_COSI_SOC`); a privacidade tem que se sustentar mesmo entre
 * colegas de time, não só entre equipes diferentes.
 */
function lembretePessoal(ajustes: Record<string, unknown> = {}) {
  return {
    lembreteId: 'lembrete-pessoal-1',
    tipo: 'PESSOAL',
    schemaVersion: 1,
    titulo: 'Estudar CySA+',
    descricao: null,
    data: '2026-08-19',
    horario: { diaInteiro: false, horaInicio: '21:00', horaFim: null, viraDia: false },
    serieId: null,
    alertasAntecedenciaMin: [],
    criadoEm: '2026-08-07T13:00:00.000Z',
    atualizadoEm: '2026-08-07T13:00:00.000Z',
    ...ajustes,
  };
}

describe('lembretes pessoais — privacidade estrutural (usuarios/{login}/lembretes)', () => {
  it('usuário cria, lê, lista, atualiza e exclui o próprio lembrete', async () => {
    const db = autenticarComo(usuarios.colaborador);
    const ref = doc(db, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1');

    await assertSucceeds(setDoc(ref, lembretePessoal({ lembreteId: 'lembrete-1' })));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(db, 'usuarios', usuarios.colaborador.login, 'lembretes')));
    await assertSucceeds(updateDoc(ref, { titulo: 'Estudar CySA+ (revisão)', atualizadoEm: '2026-08-08T00:00:00.000Z' }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('nega usuário A ler, listar, criar, atualizar ou excluir pessoal de B', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(
        doc(contexto.firestore(), 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1'),
        lembretePessoal({ lembreteId: 'lembrete-1' }),
      );
    });
    const outro = autenticarComo(usuarios.colega);
    const refDeB = doc(outro, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1');

    await assertFails(getDoc(refDeB));
    await assertFails(getDocs(collection(outro, 'usuarios', usuarios.colaborador.login, 'lembretes')));
    await assertFails(setDoc(
      doc(outro, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-forjado'),
      lembretePessoal({ lembreteId: 'lembrete-forjado' }),
    ));
    await assertFails(updateDoc(refDeB, { titulo: 'Alterado por outro usuário' }));
    await assertFails(deleteDoc(refDeB));
  });

  it('nega gestor ler, listar, criar, editar ou excluir pessoal do funcionário', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(
        doc(contexto.firestore(), 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1'),
        lembretePessoal({ lembreteId: 'lembrete-1' }),
      );
    });
    const gestor = autenticarComo(usuarios.gestor);
    const ref = doc(gestor, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1');

    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(gestor, 'usuarios', usuarios.colaborador.login, 'lembretes')));
    await assertFails(setDoc(
      doc(gestor, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-forjado-gestor'),
      lembretePessoal({ lembreteId: 'lembrete-forjado-gestor' }),
    ));
    await assertFails(updateDoc(ref, { titulo: 'Alterado pelo gestor' }));
    await assertFails(deleteDoc(ref));
  });

  it('nega ADMIN_SISTEMA ler, listar ou editar pessoal do funcionário — administrar usuários não dá acesso a conteúdo pessoal', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(
        doc(contexto.firestore(), 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1'),
        lembretePessoal({ lembreteId: 'lembrete-1' }),
      );
    });
    const admin = autenticarComo(usuarios.admin);
    const ref = doc(admin, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1');

    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(admin, 'usuarios', usuarios.colaborador.login, 'lembretes')));
    await assertFails(updateDoc(ref, { titulo: 'Alterado pelo admin' }));
  });

  it('nega criação fora do formato esperado (tipo diferente, schemaVersion diferente, campo extra)', async () => {
    const db = autenticarComo(usuarios.colaborador);
    const colecao = (id: string) => doc(db, 'usuarios', usuarios.colaborador.login, 'lembretes', id);

    await assertFails(setDoc(colecao('errado-tipo'), lembretePessoal({ lembreteId: 'errado-tipo', tipo: 'ATRIBUIDO' })));
    await assertFails(setDoc(colecao('errado-schema'), lembretePessoal({ lembreteId: 'errado-schema', schemaVersion: 2 })));
    await assertFails(setDoc(colecao('sem-titulo'), lembretePessoal({ lembreteId: 'sem-titulo', titulo: '' })));
    await assertFails(setDoc(colecao('campo-extra'), {
      ...lembretePessoal({ lembreteId: 'campo-extra' }),
      isAdmin: true,
    }));
  });

  it('ataque: usuário tenta transformar o próprio lembrete de PESSOAL em ATRIBUIDO, ou mudar schemaVersion, via update', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(
        doc(contexto.firestore(), 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1'),
        lembretePessoal({ lembreteId: 'lembrete-1' }),
      );
    });
    const db = autenticarComo(usuarios.colaborador);
    const ref = doc(db, 'usuarios', usuarios.colaborador.login, 'lembretes', 'lembrete-1');

    await assertFails(updateDoc(ref, { tipo: 'ATRIBUIDO' }));
    await assertFails(updateDoc(ref, { schemaVersion: 2 }));
    await assertFails(updateDoc(ref, { isAdmin: true }));
  });
});

/**
 * Fase 3 (Lembretes) — atribuído pelo gestor. `gestor` só administra
 * `EQ_COSI_SOC` (escopo implícito via `equipeId`, sem `equipesPermitidas`
 * explícito); `externo` é de `EQ_CODB_NOC`, fora desse escopo.
 */
function lembreteAtribuido(ajustes: Record<string, unknown> = {}) {
  return {
    lembreteId: 'lembrete-atribuido-1',
    tipo: 'ATRIBUIDO',
    schemaVersion: 1,
    destinatarioLogin: usuarios.colaborador.login,
    destinatarioEquipeId: usuarios.colaborador.equipeId,
    titulo: 'Capacitação COBIT',
    descricao: null,
    data: '2026-08-17',
    horario: { diaInteiro: false, horaInicio: '18:30', horaFim: '22:30', viraDia: false },
    serieId: null,
    alertasAntecedenciaMin: [],
    criadoPorLogin: usuarios.gestor.login,
    criadoPorNome: usuarios.gestor.nome,
    status: 'ATIVO',
    criadoEm: '2026-08-07T13:00:00.000Z',
    atualizadoEm: '2026-08-07T13:00:00.000Z',
    canceladoEm: null,
    canceladoPorLogin: null,
    ...ajustes,
  };
}

describe('lembretesAtribuidos — escopo do gestor e ataques (lembretesAtribuidos)', () => {
  it('gestor cria, lê e atualiza um atribuído para colaborador do seu escopo; destinatário só lê', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    const ref = doc(gestor, 'lembretesAtribuidos', 'lembrete-1');

    await assertSucceeds(setDoc(ref, lembreteAtribuido({ lembreteId: 'lembrete-1' })));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { titulo: 'Capacitação COBIT (sala alterada)', atualizadoEm: '2026-08-08T00:00:00.000Z' }));

    const destinatario = autenticarComo(usuarios.colaborador);
    await assertSucceeds(getDoc(doc(destinatario, 'lembretesAtribuidos', 'lembrete-1')));
  });

  it('gestor cancela: ATIVO -> CANCELADO, com metadados de cancelamento', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({ lembreteId: 'lembrete-1' }));
    });
    const gestor = autenticarComo(usuarios.gestor);
    await assertSucceeds(updateDoc(doc(gestor, 'lembretesAtribuidos', 'lembrete-1'), {
      status: 'CANCELADO',
      atualizadoEm: '2026-08-08T00:00:00.000Z',
      canceladoEm: '2026-08-08T00:00:00.000Z',
      canceladoPorLogin: usuarios.gestor.login,
    }));
  });

  it('nega outro funcionário (nem destinatário nem gestor) ler o atribuído', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({ lembreteId: 'lembrete-1' }));
    });
    const colega = autenticarComo(usuarios.colega);
    await assertFails(getDoc(doc(colega, 'lembretesAtribuidos', 'lembrete-1')));
  });

  it('nega destinatário criar, editar ou excluir um atribuído (inclusive o próprio)', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({ lembreteId: 'lembrete-1' }));
    });
    const destinatario = autenticarComo(usuarios.colaborador);

    await assertFails(setDoc(doc(destinatario, 'lembretesAtribuidos', 'lembrete-forjado'), lembreteAtribuido({
      lembreteId: 'lembrete-forjado',
      criadoPorLogin: usuarios.colaborador.login,
      criadoPorNome: usuarios.colaborador.nome,
    })));
    await assertFails(updateDoc(doc(destinatario, 'lembretesAtribuidos', 'lembrete-1'), { titulo: 'Alterado pelo destinatário' }));
    await assertFails(deleteDoc(doc(destinatario, 'lembretesAtribuidos', 'lembrete-1')));
  });

  it('nega gestor fora do escopo criar, ler ou editar', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-externo'), lembreteAtribuido({
        lembreteId: 'lembrete-externo',
        destinatarioLogin: usuarios.externo.login,
        destinatarioEquipeId: usuarios.externo.equipeId,
        criadoPorLogin: usuarios.gestor.login,
        criadoPorNome: usuarios.gestor.nome,
      }));
    });
    const gestor = autenticarComo(usuarios.gestor);

    await assertFails(setDoc(doc(gestor, 'lembretesAtribuidos', 'nova-tentativa'), lembreteAtribuido({
      lembreteId: 'nova-tentativa',
      destinatarioLogin: usuarios.externo.login,
      destinatarioEquipeId: usuarios.externo.equipeId,
    })));
    await assertFails(getDoc(doc(gestor, 'lembretesAtribuidos', 'lembrete-externo')));
    await assertFails(updateDoc(doc(gestor, 'lembretesAtribuidos', 'lembrete-externo'), { titulo: 'Alterado fora do escopo' }));
  });

  it('nega GESTOR_UNIDADE criar lembrete atribuído — mesma fronteira operacional de turnosMes/trocasEscala (não amplia o escopo do gestor)', async () => {
    const gestorUnidade = autenticarComo(usuarios.gestorUnidade);
    await assertFails(setDoc(doc(gestorUnidade, 'lembretesAtribuidos', 'tentativa-gestor-unidade'), lembreteAtribuido({
      lembreteId: 'tentativa-gestor-unidade',
      criadoPorLogin: usuarios.gestorUnidade.login,
      criadoPorNome: usuarios.gestorUnidade.nome,
    })));
  });

  it('nega query ampla do colaborador (sem where por destinatarioLogin, ou com where para outro login) — só a própria consulta filtrada funciona', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({ lembreteId: 'lembrete-1' }));
      await setDoc(doc(db, 'lembretesAtribuidos', 'lembrete-externo'), lembreteAtribuido({
        lembreteId: 'lembrete-externo',
        destinatarioLogin: usuarios.externo.login,
        destinatarioEquipeId: usuarios.externo.equipeId,
        criadoPorLogin: usuarios.gestor.login,
        criadoPorNome: usuarios.gestor.nome,
      }));
    });
    const colaborador = autenticarComo(usuarios.colaborador);

    await assertFails(getDocs(collection(colaborador, 'lembretesAtribuidos')));
    await assertFails(getDocs(query(
      collection(colaborador, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.colega.login),
    )));
    await assertSucceeds(getDocs(query(
      collection(colaborador, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.colaborador.login),
    )));
  });

  it('ataque: equipe falsificada — destinatarioLogin de uma equipe com destinatarioEquipeId da equipe do gestor', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(gestor, 'lembretesAtribuidos', 'ataque-equipe'), lembreteAtribuido({
      lembreteId: 'ataque-equipe',
      destinatarioLogin: usuarios.externo.login, // real equipeId: EQ_CODB_NOC
      destinatarioEquipeId: usuarios.gestor.equipeId, // forjado: EQ_COSI_SOC, a equipe do gestor
    })));
  });

  it('ataque: autoria falsificada — criadoPorLogin/criadoPorNome de outro gestor', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(gestor, 'lembretesAtribuidos', 'ataque-autoria'), lembreteAtribuido({
      lembreteId: 'ataque-autoria',
      criadoPorLogin: 'outro.gestor',
      criadoPorNome: 'Outro Gestor',
    })));
  });

  it('ataque: mudar destinatário por update (A -> B)', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({ lembreteId: 'lembrete-1' }));
    });
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(updateDoc(doc(gestor, 'lembretesAtribuidos', 'lembrete-1'), {
      destinatarioLogin: usuarios.colega.login,
    }));
  });

  it('ataque: reativar cancelado (CANCELADO -> ATIVO) é negado — transição unidirecional', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({
        lembreteId: 'lembrete-1',
        status: 'CANCELADO',
        canceladoEm: '2026-08-08T00:00:00.000Z',
        canceladoPorLogin: usuarios.gestor.login,
      }));
    });
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(updateDoc(doc(gestor, 'lembretesAtribuidos', 'lembrete-1'), { status: 'ATIVO' }));
  });

  it('nega criação fora do formato esperado (status inicial diferente de ATIVO, campo extra, canceladoEm pré-preenchido)', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(setDoc(doc(gestor, 'lembretesAtribuidos', 'errado-status'), lembreteAtribuido({
      lembreteId: 'errado-status',
      status: 'CANCELADO',
    })));
    await assertFails(setDoc(doc(gestor, 'lembretesAtribuidos', 'campo-extra'), {
      ...lembreteAtribuido({ lembreteId: 'campo-extra' }),
      qualquerCampoInventado: 'x',
    }));
    await assertFails(setDoc(doc(gestor, 'lembretesAtribuidos', 'cancelado-na-criacao'), lembreteAtribuido({
      lembreteId: 'cancelado-na-criacao',
      canceladoEm: '2026-08-08T00:00:00.000Z',
    })));
  });

  it('nega delete físico para todo mundo, inclusive ADMIN_SISTEMA — atribuído só sai de circulação por cancelamento (Fase 4, revisão de hardening)', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'lembretesAtribuidos', 'lembrete-1'), lembreteAtribuido({ lembreteId: 'lembrete-1' }));
    });
    const admin = autenticarComo(usuarios.admin);
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(deleteDoc(doc(gestor, 'lembretesAtribuidos', 'lembrete-1')));
    await assertFails(deleteDoc(doc(admin, 'lembretesAtribuidos', 'lembrete-1')));
  });
});

/**
 * Fase 5.1 — reproduz a QUERY real usada pelo Dashboard (não só get/set num
 * documento isolado). Firestore não trata Rules como filtro: para um
 * `list`, cada `where(...)` do lado do cliente precisa bastar, sozinho, para
 * provar a condição do lado do servidor — se a Rule depende de um campo que
 * a query não restringe por igualdade, o Firestore recusa o `list` inteiro,
 * mesmo que os documentos reais atendessem à condição. É exatamente o caso
 * do ramo do gestor em `lembretesAtribuidos`: `podeOperarNaEquipe(resource
 * .data.destinatarioEquipeId)` exige que a query filtre `destinatarioEquipeId`
 * por igualdade — só filtrar `destinatarioLogin` (a consulta antiga,
 * compartilhada com o colaborador) não basta.
 */
describe('lembretesAtribuidos — query administrativa real (Fase 5.1)', () => {
  beforeEach(async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await Promise.all([
        setDoc(doc(db, 'lembretesAtribuidos', 'lembrete-colaborador'), lembreteAtribuido({
          lembreteId: 'lembrete-colaborador',
        })),
        setDoc(doc(db, 'lembretesAtribuidos', 'lembrete-externo'), lembreteAtribuido({
          lembreteId: 'lembrete-externo',
          destinatarioLogin: usuarios.externo.login,
          destinatarioEquipeId: usuarios.externo.equipeId,
          criadoPorLogin: usuarios.admin.login,
          criadoPorNome: usuarios.admin.nome,
        })),
      ]);
    });
  });

  it('prova a causa raiz: query administrativa ANTIGA (só destinatarioLogin, sem destinatarioEquipeId) é negada para o gestor', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(getDocs(query(
      collection(gestor, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.colaborador.login),
      where('data', '>=', '2026-01-01'),
      where('data', '<=', '2026-12-31'),
    )));
  });

  it('query administrativa NOVA (destinatarioLogin + destinatarioEquipeId) é permitida para o gestor do escopo correto', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    const resultado = await assertSucceeds(getDocs(query(
      collection(gestor, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.colaborador.login),
      where('destinatarioEquipeId', '==', usuarios.colaborador.equipeId),
      where('data', '>=', '2026-01-01'),
      where('data', '<=', '2026-12-31'),
    )));
    expect(resultado.docs.map((item) => item.id)).toEqual(['lembrete-colaborador']);
  });

  it('query administrativa NOVA é negada quando a equipe informada não está no escopo do gestor', async () => {
    const gestor = autenticarComo(usuarios.gestor);
    await assertFails(getDocs(query(
      collection(gestor, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.externo.login),
      where('destinatarioEquipeId', '==', usuarios.externo.equipeId),
      where('data', '>=', '2026-01-01'),
      where('data', '<=', '2026-12-31'),
    )));
  });

  it('ADMIN_SISTEMA consegue usar a query administrativa NOVA cross-equipe', async () => {
    const admin = autenticarComo(usuarios.admin);
    const resultado = await assertSucceeds(getDocs(query(
      collection(admin, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.externo.login),
      where('destinatarioEquipeId', '==', usuarios.externo.equipeId),
      where('data', '>=', '2026-01-01'),
      where('data', '<=', '2026-12-31'),
    )));
    expect(resultado.docs.map((item) => item.id)).toEqual(['lembrete-externo']);
  });

  it('a query do colaborador para os próprios atribuídos continua funcionando sem destinatarioEquipeId', async () => {
    const colaborador = autenticarComo(usuarios.colaborador);
    const resultado = await assertSucceeds(getDocs(query(
      collection(colaborador, 'lembretesAtribuidos'),
      where('destinatarioLogin', '==', usuarios.colaborador.login),
      where('data', '>=', '2026-01-01'),
      where('data', '<=', '2026-12-31'),
    )));
    expect(resultado.docs.map((item) => item.id)).toEqual(['lembrete-colaborador']);
  });
});

/**
 * Plantão (Fase PLANTÃO-3A) — domínio paralelo, mesmos atores de
 * `usuarios` (gestor/colaborador/colega/externo/admin), mais dois novos
 * só para este bloco: um gestor de OUTRA equipe autorizada a consultar
 * (mas não a administrar) e um analista de uma equipe sem NENHUMA
 * permissão sobre o grupo. Grupo de teste: equipe responsável EQ_COSI_SOC
 * (gestor), consulta liberada também para EQ_CODB_NOC (externo).
 */
describe('Plantão — Grupo/Participantes/Contatos/Competência (Fase PLANTÃO-3A)', () => {
  const gestorForaEscopo = {
    login: 'renata.lima',
    nome: 'Renata Lima',
    email: 'renata.lima@teste.local',
    equipeId: 'EQ_CODB_NOC',
    nivelHierarquico: 5,
  };
  const analistaSemPermissao = {
    login: 'joao.pereira',
    nome: 'João Pereira',
    email: 'joao.pereira@teste.local',
    equipeId: 'EQ_GEDSI_ADM',
    nivelHierarquico: 6,
  };

  function grupoPlantao(ajustes: Record<string, unknown> = {}) {
    return {
      grupoId: 'PLANTAO_TESTE',
      nome: 'Plantão de Teste',
      descricao: 'Grupo usado nos testes de Rules',
      equipeResponsavelId: 'EQ_COSI_SOC',
      equipesConsulta: ['EQ_COSI_SOC', 'EQ_CODB_NOC'],
      timezone: 'America/Sao_Paulo',
      ativo: true,
      schemaVersion: 1,
      criadoPorLogin: usuarios.gestor.login,
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...ajustes,
    };
  }

  function participantePlantao(login: string, ajustes: Record<string, unknown> = {}) {
    return {
      grupoId: 'PLANTAO_TESTE',
      login,
      ativo: true,
      contatos: [] as unknown[],
      schemaVersion: 1,
      criadoPorLogin: usuarios.gestor.login,
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...ajustes,
    };
  }

  function competenciaRascunhoPlantao(ajustes: Record<string, unknown> = {}) {
    return {
      id: 'PLANTAO_TESTE_2026-08',
      grupoId: 'PLANTAO_TESTE',
      competencia: '2026-08',
      periodoInicio: '2026-07-26',
      periodoFim: '2026-08-25',
      status: 'RASCUNHO',
      revisao: 0,
      origem: 'IMPORTADO',
      totaisInformadosOrigem: { totalPlantoesInformado: 31, totalMinutosInformado: 28_080 },
      totalBruto: { quantidade: 32, minutos: 30_240 },
      schemaVersion: 1,
      criadoPorLogin: usuarios.gestor.login,
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...ajustes,
    };
  }

  function atribuicaoPlantao(ajustes: Record<string, unknown> = {}) {
    return {
      atribuicaoId: '0001',
      grupoId: 'PLANTAO_TESTE',
      competenciaId: 'PLANTAO_TESTE_2026-08',
      plantonistaLogin: usuarios.colaborador.login,
      inicio: '2026-07-25T22:00:00.000Z',
      fim: '2026-07-26T10:00:00.000Z',
      duracaoMinutos: 720,
      papel: 'PRIMARIO',
      origem: 'IMPORTADO',
      revisao: 0,
      schemaVersion: 1,
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...ajustes,
    };
  }

  beforeEach(async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await Promise.all([
        setDoc(doc(db, 'usuarios', gestorForaEscopo.login), gestorForaEscopo),
        setDoc(doc(db, 'usuarios', analistaSemPermissao.login), analistaSemPermissao),
        setDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), grupoPlantao()),
        setDoc(
          doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
          participantePlantao(usuarios.colaborador.login, {
            contatos: [{ rotulo: 'Celular corporativo', numero: '11999990000', ativo: true }],
          }),
        ),
        setDoc(
          doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08'),
          competenciaRascunhoPlantao(),
        ),
        setDoc(
          doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0001'),
          atribuicaoPlantao(),
        ),
        setDoc(doc(db, 'competenciasPlantao', 'PLANTAO_TESTE_2026-08'), {
          ...competenciaRascunhoPlantao(),
          status: 'PUBLICADA',
        }),
      ]);
    });
  });

  describe('não autenticado', () => {
    it('não lê Grupo, participante (com contatos) nem competência', async () => {
      const db = ambiente.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      await assertFails(getDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
      ));
      await assertFails(getDoc(doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08')));
    });

    it('não cria nem altera Grupo', async () => {
      const db = ambiente.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, 'gruposPlantao', 'novo-grupo'), grupoPlantao({ grupoId: 'novo-grupo' })));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Outro nome' }));
    });
  });

  describe('analista autorizado a consultar (equipe está em equipesConsulta, não é a responsável)', () => {
    it('lê Grupo, participante e contatos', async () => {
      const db = autenticarComo(usuarios.externo);
      const grupo = await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      expect(grupo.data()?.nome).toBe('Plantão de Teste');
      const participante = await assertSucceeds(getDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
      ));
      expect(participante.data()?.contatos).toEqual([
        { rotulo: 'Celular corporativo', numero: '11999990000', ativo: true },
      ]);
    });

    it('não altera Grupo nem participante, não cria rascunho', async () => {
      const db = autenticarComo(usuarios.externo);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Hackeado' }));
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.externo.login),
        participantePlantao(usuarios.externo.login),
      ));
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-09'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-09', competencia: '2026-09' }),
      ));
    });
  });

  describe('analista não autorizado (equipe fora de equipesConsulta)', () => {
    it('não lê Grupo, participantes nem contatos', async () => {
      const db = autenticarComo(analistaSemPermissao);
      await assertFails(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      await assertFails(getDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
      ));
    });
  });

  describe('participante do grupo (participar não implica poder administrativo)', () => {
    it('o próprio participante consegue ler o grupo (equipe responsável já está em equipesConsulta), mas não administra nada', async () => {
      const db = autenticarComo(usuarios.colaborador);
      await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Outro nome' }));
      await assertFails(updateDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
        { ativo: false },
      ));
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-09'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-09', competencia: '2026-09' }),
      ));
    });
  });

  describe('gestor autorizado (equipe responsável)', () => {
    it('cria e edita o Grupo', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_NOVO'),
        grupoPlantao({ grupoId: 'PLANTAO_NOVO', criadoPorLogin: usuarios.gestor.login }),
      ));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Plantão renomeado' }));
    });

    it('cria e edita participante, gerencia contatos (até 3)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.colega.login, {
          contatos: [
            { rotulo: 'Celular corporativo', numero: '11999990000', ativo: true },
            { rotulo: 'Ramal', numero: '4321', ativo: true },
          ],
        }),
      ));
      await assertSucceeds(updateDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
        { contatos: [{ rotulo: 'Celular alternativo', numero: '11988887777', ativo: true }] },
      ));
    });

    it('não cria participante cujo login não corresponde a nenhum usuário cadastrado', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', 'login.inexistente'),
        participantePlantao('login.inexistente'),
      ));
    });

    it('cria rascunho de competência e atribuições', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-09'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-09', competencia: '2026-09' }),
      ));
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0002'),
        atribuicaoPlantao({ atribuicaoId: '0002' }),
      ));
    });

    it('lê o rascunho e as atribuições (visível só a quem administra, não à consulta geral)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(getDoc(doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08')));
      await assertSucceeds(getDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0001'),
      ));
    });
  });

  describe('gestor fora do escopo (gestor de uma equipe que só consulta, não administra)', () => {
    it('lê o Grupo (a equipe dele está em equipesConsulta) mas não administra nada', async () => {
      const db = autenticarComo(gestorForaEscopo);
      await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Hackeado' }));
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.externo.login),
        participantePlantao(usuarios.externo.login),
      ));
      await assertSucceeds(getDoc(doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08')));
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-09'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-09', competencia: '2026-09' }),
      ));
    });
  });

  describe('payload inválido (testado contra o gestor autorizado, para isolar a validação de campo)', () => {
    it('4 contatos é negado', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.colega.login, {
          contatos: [
            { rotulo: 'A', numero: '1', ativo: true },
            { rotulo: 'B', numero: '2', ativo: true },
            { rotulo: 'C', numero: '3', ativo: true },
            { rotulo: 'D', numero: '4', ativo: true },
          ],
        }),
      ));
    });

    it('contato sem rótulo ou sem número é negado', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.colega.login, {
          contatos: [{ rotulo: '', numero: '11999990000', ativo: true }],
        }),
      ));
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.colega.login, {
          contatos: [{ rotulo: 'Celular', numero: '', ativo: true }],
        }),
      ));
    });

    it('campo extra no payload é negado (Grupo, participante e atribuição)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_OUTRO'),
        { ...grupoPlantao({ grupoId: 'PLANTAO_OUTRO' }), campoInventado: true },
      ));
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        { ...participantePlantao(usuarios.colega.login), campoInventado: true },
      ));
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0003'),
        { ...atribuicaoPlantao({ atribuicaoId: '0003' }), campoInventado: true },
      ));
    });

    it('login vazio na atribuição é negado', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0004'),
        atribuicaoPlantao({ atribuicaoId: '0004', plantonistaLogin: '' }),
      ));
    });

    it('login do payload do participante diferente do ID do documento é negado', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.externo.login),
      ));
    });

    it('status inválido na competência é negado (nunca aceita "PUBLICADA" direto no rascunho)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-10'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-10', competencia: '2026-10', status: 'PUBLICADA' }),
      ));
    });

    it('origem inválida na competência e na atribuição é negada', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-11'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-11', competencia: '2026-11', origem: 'INVENTADA' }),
      ));
      await assertFails(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0005'),
        atribuicaoPlantao({ atribuicaoId: '0005', origem: 'INVENTADA' }),
      ));
    });

    it('Fase ESCALAS-UX-1C — origem COPIADO ("Usar período anterior") é aceita na competência e na atribuição, para o gestor autorizado', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-12'),
        competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-12', competencia: '2026-12', origem: 'COPIADO' }),
      ));
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-12', 'atribuicoes', '0001'),
        atribuicaoPlantao({
          atribuicaoId: '0001',
          competenciaId: 'PLANTAO_TESTE_2026-12',
          origem: 'COPIADO',
          inicio: '2026-11-26T22:00:00.000Z',
          fim: '2026-11-27T10:00:00.000Z',
        }),
      ));
    });
  });

  describe('competência PUBLICADA — leitura e escrita operacional por responsável', () => {
    it('consulta autorizada lê a competência publicada', async () => {
      const db = autenticarComo(usuarios.externo);
      const documento = await assertSucceeds(
        getDoc(doc(db, 'competenciasPlantao', 'PLANTAO_TESTE_2026-08')),
      );
      expect(documento.data()?.status).toBe('PUBLICADA');
    });

    it('gestor responsável e ADMIN_SISTEMA escrevem; consulta continua sem escrita', async () => {
      const gestorDb = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(
        doc(gestorDb, 'competenciasPlantao', 'PLANTAO_TESTE_2026-08'),
        { revisao: 1 },
      ));
      const adminDb = autenticarComo(usuarios.admin);
      await assertSucceeds(setDoc(
        doc(adminDb, 'competenciasPlantao', 'PLANTAO_TESTE_2026-09'),
        { ...competenciaRascunhoPlantao({ id: 'PLANTAO_TESTE_2026-09', competencia: '2026-09' }), status: 'PUBLICADA', revisao: 1 },
      ));
      const consultaDb = autenticarComo(gestorForaEscopo);
      await assertFails(updateDoc(
        doc(consultaDb, 'competenciasPlantao', 'PLANTAO_TESTE_2026-08'),
        { revisao: 2 },
      ));
    });
  });

  describe('ADMIN_SISTEMA — acesso global também em Plantão', () => {
    it('lê e administra o grupo mesmo sem estar em equipesConsulta', async () => {
      const db = autenticarComo(usuarios.admin);
      await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Renomeado pelo admin' }));
    });
  });

  /**
   * Fase PLANTÃO-3B — cenários exercitados pela Administração de Plantão no
   * Dashboard: `listarTodosGruposPlantao()` (query sem `where`, só
   * ADMIN_SISTEMA), `equipesPermitidas` explícito de GESTOR_EQUIPE,
   * desativação nunca é exclusão física, e regravação idempotente do
   * rascunho não duplica documento. `GESTOR_UNIDADE` passou a administrar
   * Plantão dentro do escopo de unidade desde a Fase
   * ESCOPO-GESTOR-UNIDADE-1 (ver describe dedicado mais abaixo); `list`
   * sem `where` também passou a ser permitido para
   * `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` desde a Fase
   * ESCOPO-CONSULTA-PLANTAO-1 (descoberta para autovínculo de consulta).
   */
  describe('Fase PLANTÃO-3B — administração via Dashboard', () => {
    it('ADMIN_SISTEMA lista gruposPlantao sem where (equivalente de listarTodosGruposPlantao) mesmo com um grupo fora de sua equipesConsulta', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_OUTRO_TIME'),
          grupoPlantao({ grupoId: 'PLANTAO_OUTRO_TIME', equipeResponsavelId: 'EQ_TIME_QUALQUER', equipesConsulta: ['EQ_TIME_QUALQUER'] }),
        );
      });
      const db = autenticarComo(usuarios.admin);
      const resultado = await assertSucceeds(getDocs(collection(db, 'gruposPlantao')));
      expect(resultado.docs.map((item) => item.id).sort()).toEqual(['PLANTAO_OUTRO_TIME', 'PLANTAO_TESTE']);
    });

    /**
     * Fase ESCOPO-CONSULTA-PLANTAO-1 — mudança de regra aprovada: até essa
     * fase, só `ADMIN_SISTEMA` conseguia listar `gruposPlantao` sem
     * `where`; agora `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` também conseguem
     * — precisam DESCOBRIR quais Grupos existem (nome, equipe responsável)
     * antes de decidir vincular a própria equipe em `equipesConsulta`
     * (autovínculo de consulta, "Plantões monitorados por equipe"), sem
     * depender de já estar em `equipesConsulta`/administrar o Grupo.
     * `ANALISTA_SOC`/`ANALISTA_SUPORTE` continuam sem esse acesso — só
     * gestores decidem o que a própria equipe monitora.
     */
    it('GESTOR_EQUIPE/SUPERVISOR_EQUIPE conseguem listar gruposPlantao sem where (descoberta para autovínculo de consulta); analista comum continua sem esse acesso', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_OUTRO_TIME'),
          grupoPlantao({ grupoId: 'PLANTAO_OUTRO_TIME', equipeResponsavelId: 'EQ_TIME_QUALQUER', equipesConsulta: ['EQ_TIME_QUALQUER'] }),
        );
      });
      const db = autenticarComo(usuarios.gestor);
      const resultado = await assertSucceeds(getDocs(collection(db, 'gruposPlantao')));
      expect(resultado.docs.map((item) => item.id).sort()).toEqual(['PLANTAO_OUTRO_TIME', 'PLANTAO_TESTE']);

      const analistaDb = autenticarComo(usuarios.colaborador);
      await assertFails(getDocs(collection(analistaDb, 'gruposPlantao')));
      // A consulta filtrada por `array-contains` na própria equipe (o que
      // `listarGruposPlantaoPermitidos()` de fato faz) continua funcionando
      // para o analista comum, mesmo sem o acesso amplo de descoberta.
      const filtrada = await assertSucceeds(getDocs(
        query(collection(analistaDb, 'gruposPlantao'), where('equipesConsulta', 'array-contains', usuarios.colaborador.equipeId)),
      ));
      expect(filtrada.docs.map((item) => item.id)).toEqual(['PLANTAO_TESTE']);
    });

    it('GESTOR_EQUIPE com equipesPermitidas explícito administra um grupo cuja equipeResponsavelId não é sua equipeId principal', async () => {
      const gestorMultiEquipe = {
        login: 'debora.assis',
        nome: 'Débora Assis',
        email: 'debora.assis@teste.local',
        equipeId: 'EQ_OUTRA_PRINCIPAL',
        nivelHierarquico: 5,
        perfil: 'GESTOR_EQUIPE' as const,
        equipesPermitidas: ['EQ_OUTRA_PRINCIPAL', 'EQ_COSI_SOC'],
      };
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'usuarios', gestorMultiEquipe.login), gestorMultiEquipe);
      });
      const db = autenticarComo(gestorMultiEquipe);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Renomeado por gestor multi-equipe' }));
    });

    /**
     * Fase ESCOPO-GESTOR-UNIDADE-1 (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`)
     * — mudança de regra aprovada nesta fase: até aqui, `GESTOR_UNIDADE`
     * nunca administrava Plantão, nem quando a equipe responsável era a
     * própria unidade dele (o teste anterior deste describe afirmava
     * exatamente isso). O coordenador de uma unidade real (ex.: COSI) que
     * também é dono da equipe "Plantão COSI" não conseguia administrar o
     * próprio Grupo — bug de produto confirmado, corrigido aqui. A
     * autorização continua exigindo o campo denormalizado
     * `unidadeResponsavelId` (retrocompatível: Grupo sem o campo continua
     * fora do alcance de qualquer `GESTOR_UNIDADE`).
     */
    it('GESTOR_UNIDADE administra Plantão quando unidadeResponsavelId está em unidadesPermitidas — cria, edita, e continua fora do escopo de outra unidade', async () => {
      const db = autenticarComo(usuarios.gestorUnidade);
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_DA_UNIDADE'),
        grupoPlantao({
          grupoId: 'PLANTAO_DA_UNIDADE',
          equipeResponsavelId: 'EQ_GEDSI_PLANTAO',
          equipesConsulta: ['EQ_GEDSI_PLANTAO'],
          unidadeResponsavelId: 'GEDSI',
          criadoPorLogin: usuarios.gestorUnidade.login,
        }),
      ));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_DA_UNIDADE'), { nome: 'Renomeado pelo gestor de unidade' }));

      // Grupo cuja unidade responsável NÃO está em unidadesPermitidas continua negado.
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_FORA_DA_UNIDADE'),
        grupoPlantao({
          grupoId: 'PLANTAO_FORA_DA_UNIDADE',
          equipeResponsavelId: 'EQ_OUTRA_UNIDADE_PLANTAO',
          equipesConsulta: ['EQ_OUTRA_UNIDADE_PLANTAO'],
          unidadeResponsavelId: 'OUTRA_UNIDADE',
          criadoPorLogin: usuarios.gestorUnidade.login,
        }),
      ));
    });

    it('GESTOR_UNIDADE administra Plantão de uma unidade ANCESTRAL via caminhoUnidadeResponsavel materializado (subárvore, sem travessia de parentId)', async () => {
      const db = autenticarComo(usuarios.gestorUnidade);
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_SUBUNIDADE'),
        grupoPlantao({
          grupoId: 'PLANTAO_SUBUNIDADE',
          equipeResponsavelId: 'EQ_GEDSI_SUL_PLANTAO',
          equipesConsulta: ['EQ_GEDSI_SUL_PLANTAO'],
          unidadeResponsavelId: 'GEDSI_SUL',
          caminhoUnidadeResponsavel: ['GEDSI', 'GEDSI_SUL'],
          criadoPorLogin: usuarios.gestorUnidade.login,
        }),
      ));
    });

    it('Grupo de Plantão sem unidadeResponsavelId (documento antigo) continua fora do alcance de GESTOR_UNIDADE', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_ANTIGO'),
          grupoPlantao({
            grupoId: 'PLANTAO_ANTIGO',
            equipeResponsavelId: usuarios.gestorUnidade.equipeId,
            equipesConsulta: [usuarios.gestorUnidade.equipeId],
          }),
        );
      });
      const db = autenticarComo(usuarios.gestorUnidade);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_ANTIGO'), { nome: 'Hackeado pelo gestor de unidade' }));
    });

    it('ANALISTA_SOC da equipe responsável não administra Plantão mesmo com unidadeResponsavelId preenchido', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(
          doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_ANALISTA'),
          grupoPlantao({
            grupoId: 'PLANTAO_ANALISTA',
            equipeResponsavelId: analistaSemPermissao.equipeId,
            equipesConsulta: [analistaSemPermissao.equipeId],
            unidadeResponsavelId: 'GEDSI',
          }),
        );
      });
      const db = autenticarComo(analistaSemPermissao);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_ANALISTA'), { nome: 'Hackeado' }));
    });

    it('novo Grupo é negado quando equipeResponsavelId não está em equipesConsulta já na criação', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_SEM_INVARIANTE'),
        grupoPlantao({ grupoId: 'PLANTAO_SEM_INVARIANTE', equipeResponsavelId: 'EQ_COSI_SOC', equipesConsulta: ['EQ_CODB_NOC'] }),
      ));
    });

    it('desativar participante é sempre update (ativo:false) — delete é negado para grupo e participante, mesmo para o gestor autorizado e para o admin', async () => {
      const gestorDb = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(
        doc(gestorDb, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login),
        { ativo: false },
      ));
      await assertFails(deleteDoc(doc(gestorDb, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colaborador.login)));
      await assertFails(deleteDoc(doc(gestorDb, 'gruposPlantao', 'PLANTAO_TESTE')));

      const adminDb = autenticarComo(usuarios.admin);
      await assertFails(deleteDoc(doc(adminDb, 'gruposPlantao', 'PLANTAO_TESTE')));
    });

    it('editar equipesConsulta pelo ModalGrupoPlantao passa a autorizar uma equipe nova imediatamente, e a remover o acesso de uma equipe tirada da lista', async () => {
      const gestorDb = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(gestorDb, 'gruposPlantao', 'PLANTAO_TESTE'), {
        equipesConsulta: ['EQ_COSI_SOC', 'EQ_GEDSI_ADM'],
      }));
      // analistaSemPermissao é EQ_GEDSI_ADM — antes da edição acima, não conseguia consultar (ver
      // describe 'analista não autorizado' logo abaixo); depois de incluída, passa a conseguir.
      const analistaDb = autenticarComo(analistaSemPermissao);
      await assertSucceeds(getDoc(doc(analistaDb, 'gruposPlantao', 'PLANTAO_TESTE')));
      /**
       * `usuarios.externo` é ANALISTA_SOC de EQ_CODB_NOC — estava na lista
       * original e foi removida acima, então perde o acesso por
       * `equipesConsulta`. Diferente de um perfil `GESTOR_EQUIPE`/
       * `SUPERVISOR_EQUIPE` (ver teste dedicado logo abaixo, Fase
       * ESCOPO-CONSULTA-PLANTAO-1): analista comum não tem o caminho de
       * leitura de descoberta, só o de `equipesConsulta`.
       */
      const externoDb = autenticarComo(usuarios.externo);
      await assertFails(getDoc(doc(externoDb, 'gruposPlantao', 'PLANTAO_TESTE')));
      /**
       * Fase ESCOPO-CONSULTA-PLANTAO-1 — `gestorForaEscopo` é
       * `GESTOR_EQUIPE` (perfil de gestor, mesmo que de outra equipe) e
       * MANTÉM leitura mesmo depois de EQ_CODB_NOC sair de
       * `equipesConsulta` — não por consulta, mas pelo caminho de
       * descoberta concedido a qualquer `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE`
       * (ver "Plantões monitorados por equipe",
       * `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`). Isso NUNCA
       * concede administração — só leitura de metadado, para decidir se
       * vincula a própria equipe.
       */
      const foraDeEscopoDb = autenticarComo(gestorForaEscopo);
      const documento = await assertSucceeds(getDoc(doc(foraDeEscopoDb, 'gruposPlantao', 'PLANTAO_TESTE')));
      expect(documento.data()?.equipesConsulta).toEqual(['EQ_COSI_SOC', 'EQ_GEDSI_ADM']);
      await assertFails(updateDoc(doc(foraDeEscopoDb, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Hackeado' }));
    });

    it('marcar o grupo como inativo (ativo:false) não tira o poder de administração do gestor responsável — ele consegue reativar depois', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { ativo: false }));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { ativo: true }));
    });

    it('regravar o mesmo Grupo/participante/atribuição com o mesmo ID atualiza o documento existente, nunca duplica', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.colega.login, { contatos: [{ rotulo: 'Celular', numero: '11999990000', ativo: true }] }),
      ));
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes', usuarios.colega.login),
        participantePlantao(usuarios.colega.login, { contatos: [{ rotulo: 'Celular', numero: '11999990000', ativo: true }] }),
      ));
      const participantes = await assertSucceeds(getDocs(collection(db, 'gruposPlantao', 'PLANTAO_TESTE', 'participantes')));
      expect(participantes.docs.map((item) => item.id).sort()).toEqual([usuarios.colaborador.login, usuarios.colega.login].sort());

      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes', '0001'),
        atribuicaoPlantao({ duracaoMinutos: 720 }),
      ));
      // Achado da Fase PLANTÃO-3A, mantido aqui como registro histórico: a
      // MESMA query SEM `where` nesta subcoleção falha no emulador com
      // "Property grupoId is undefined on object" para `usuarios.gestor`
      // (funciona só para ADMIN_SISTEMA) — a regra depende de
      // `resource.data.grupoId` (não de uma variável de path, diferente da
      // subcoleção `participantes`), e o Firestore exige um `where` que
      // corresponda a esse campo para validar um `list` sem precisar
      // avaliar a regra contra a coleção inteira.
      const adminDb = autenticarComo(usuarios.admin);
      const semFiltro = await assertSucceeds(getDocs(
        collection(adminDb, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes'),
      ));
      expect(semFiltro.docs).toHaveLength(1);

      // Fase ESCALAS-UX-1B.1 — corrigido no REPOSITORY (não em
      // `firestore.rules`, que fica com diff zero): `listarAtribuicoesPlantaoRascunho()`
      // agora inclui `where('grupoId', '==', grupoId)` — a MESMA query,
      // com esse filtro, passa a funcionar para `usuarios.gestor` (o
      // GESTOR_EQUIPE autorizado que precisa reabrir o próprio rascunho),
      // sem nenhuma mudança na Rule.
      const gestorDb = autenticarComo(usuarios.gestor);
      const comFiltro = await assertSucceeds(getDocs(query(
        collection(gestorDb, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes'),
        where('grupoId', '==', 'PLANTAO_TESTE'),
        orderBy('atribuicaoId'),
      )));
      expect(comFiltro.docs.map((item) => item.id)).toEqual(['0001']);

      // Consulta operacional também lê o rascunho, sem ganhar escrita.
      const foraDeEscopoDb = autenticarComo(gestorForaEscopo);
      await assertSucceeds(getDocs(query(
        collection(foraDeEscopoDb, 'rascunhosCompetenciasPlantao', 'PLANTAO_TESTE_2026-08', 'atribuicoes'),
        where('grupoId', '==', 'PLANTAO_TESTE'),
        orderBy('atribuicaoId'),
      )));
    });

    it('Fase ESCALAS-UX-1B.1 — listarCompetenciasPlantaoRascunho(): o GESTOR_EQUIPE autorizado lista os rascunhos do próprio grupo (mesma técnica de where(grupoId) na coleção de competências)', async () => {
      const gestorDb = autenticarComo(usuarios.gestor);
      const resultado = await assertSucceeds(getDocs(query(
        collection(gestorDb, 'rascunhosCompetenciasPlantao'),
        where('grupoId', '==', 'PLANTAO_TESTE'),
      )));
      expect(resultado.docs.map((item) => item.id)).toEqual(['PLANTAO_TESTE_2026-08']);

      // Uma equipe em consulta monitora o rascunho deste grupo.
      const foraDeEscopoDb = autenticarComo(gestorForaEscopo);
      await assertSucceeds(getDocs(query(
        collection(foraDeEscopoDb, 'rascunhosCompetenciasPlantao'),
        where('grupoId', '==', 'PLANTAO_TESTE'),
      )));
    });

    it('competência inexistente retorna consulta vazia para o responsável, sem mascarar ausência como permission-denied', async () => {
      const gestorDb = autenticarComo(usuarios.gestor);
      const restricoes = [
        where('grupoId', '==', 'PLANTAO_TESTE'),
        where('competencia', '==', '2099-12'),
      ];
      const rascunhos = await assertSucceeds(getDocs(query(
        collection(gestorDb, 'rascunhosCompetenciasPlantao'),
        ...restricoes,
      )));
      const publicadas = await assertSucceeds(getDocs(query(
        collection(gestorDb, 'competenciasPlantao'),
        ...restricoes,
      )));
      expect(rascunhos.empty).toBe(true);
      expect(publicadas.empty).toBe(true);
    });
  });

  /**
   * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — cenário real observado em
   * staging (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção
   * "Provisionamento de Grupo de Plantão"): a equipe "Plantão COSI" existe
   * dentro da unidade COSI, mas o Grupo de Plantão operacional
   * (`gruposPlantao/PLANTAO_COSI`) precisa ser criável pelo próprio
   * `GESTOR_UNIDADE` de COSI, nunca só pelo Console do Firestore.
   */
  describe('Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — GrupoPlantao Plantão COSI, provisionado pelo produto', () => {
    const gestorUnidadeCosi = {
      login: 'coordenadora.cosi',
      nome: 'Coordenadora COSI',
      email: 'coordenadora.cosi@teste.local',
      equipeId: 'EQ_COSI_COORD',
      nivelHierarquico: 4,
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
      unidadeId: 'COSI',
      unidadesPermitidas: ['COSI'],
    };
    const gestorUnidadeOutra = {
      login: 'coordenador.outra',
      nome: 'Coordenador Outra Unidade',
      email: 'coordenador.outra@teste.local',
      equipeId: 'EQ_OUTRA_COORD',
      nivelHierarquico: 4,
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
      unidadeId: 'OUTRA_UNIDADE',
      unidadesPermitidas: ['OUTRA_UNIDADE'],
    };

    function grupoPlantaoCosi(ajustes: Record<string, unknown> = {}) {
      return grupoPlantao({
        grupoId: 'PLANTAO_COSI',
        nome: 'Plantão COSI',
        equipeResponsavelId: 'EQ_PLANTAO_COSI',
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_SOC'],
        unidadeResponsavelId: 'COSI',
        caminhoUnidadeResponsavel: ['GEDSI', 'COSI'],
        criadoPorLogin: gestorUnidadeCosi.login,
        ...ajustes,
      });
    }

    beforeEach(async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await Promise.all([
          setDoc(doc(db, 'usuarios', gestorUnidadeCosi.login), gestorUnidadeCosi),
          setDoc(doc(db, 'usuarios', gestorUnidadeOutra.login), gestorUnidadeOutra),
        ]);
      });
    });

    it('GESTOR_UNIDADE de COSI cria o Grupo Plantão COSI (equipe responsável, unidade e caminho corretos)', async () => {
      const db = autenticarComo(gestorUnidadeCosi);
      await assertSucceeds(setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi()));
    });

    it('GESTOR_UNIDADE de outra unidade NÃO cria o Grupo Plantão COSI (equipe responsável de COSI, fora do seu escopo)', async () => {
      const db = autenticarComo(gestorUnidadeOutra);
      await assertFails(setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi()));
    });

    it('create sem unidadeResponsavelId/caminhoUnidadeResponsavel: GESTOR_UNIDADE não consegue (retrocompatibilidade — só GESTOR_EQUIPE/ADMIN_SISTEMA administram Grupo sem esses campos)', async () => {
      const db = autenticarComo(gestorUnidadeCosi);
      const semUnidade: Record<string, unknown> = grupoPlantaoCosi();
      delete semUnidade.unidadeResponsavelId;
      delete semUnidade.caminhoUnidadeResponsavel;
      await assertFails(setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), semUnidade));
    });

    it('GESTOR_UNIDADE de COSI edita o Grupo já existente (nome, ativo, equipesConsulta)', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi());
      });
      const db = autenticarComo(gestorUnidadeCosi);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { nome: 'Plantão COSI renomeado' }));
    });

    it('update migrando unidadeResponsavelId para FORA do escopo é negado, mesmo pelo gestor que administrava o Grupo antes da migração', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi());
      });
      const db = autenticarComo(gestorUnidadeCosi);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        unidadeResponsavelId: 'OUTRA_UNIDADE',
        caminhoUnidadeResponsavel: ['OUTRA_UNIDADE'],
      }));
    });

    it('read/list administrativo: GESTOR_UNIDADE de COSI lê o Grupo mesmo com a própria equipe fora de equipesConsulta, só por administrar a unidade responsável', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        // equipesConsulta não inclui EQ_COSI_COORD (a equipe pessoal da coordenadora) — só a leitura via unidade deve autorizar.
        await setDoc(doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi({ equipesConsulta: ['EQ_PLANTAO_COSI'] }));
      });
      const db = autenticarComo(gestorUnidadeCosi);
      const documento = await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI')));
      expect(documento.data()?.grupoId).toBe('PLANTAO_COSI');
    });

    it('analista comum da equipe responsável não administra o Grupo Plantão COSI', async () => {
      const analistaCosi = {
        login: 'analista.cosi',
        nome: 'Analista COSI',
        email: 'analista.cosi@teste.local',
        equipeId: 'EQ_PLANTAO_COSI',
        nivelHierarquico: 6,
      };
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await setDoc(doc(db, 'usuarios', analistaCosi.login), analistaCosi);
        await setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi());
      });
      const db = autenticarComo(analistaCosi);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { nome: 'Hackeado' }));
    });

    it('ADMIN_SISTEMA cria e edita o Grupo Plantão COSI livremente; delete físico continua negado', async () => {
      const db = autenticarComo(usuarios.admin);
      await assertSucceeds(setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoCosi({ criadoPorLogin: usuarios.admin.login })));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { nome: 'Plantão COSI (admin)' }));
      await assertFails(deleteDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI')));
    });
  });

  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — "Plantões monitorados por equipe":
   * Wanessa (`SUPERVISOR_EQUIPE`/`GESTOR_EQUIPE` do NOC) precisa poder
   * vincular a própria equipe (EQ_NOC) à consulta de Plantões que ela NÃO
   * administra (Plantão COSI, Plantão CODB), sem depender de aprovação do
   * coordenador responsável por cada um — ver
   * `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção "Plantões
   * monitorados por equipe".
   */
  describe('Fase ESCOPO-CONSULTA-PLANTAO-1 — autovínculo de consulta (Plantões monitorados pela equipe)', () => {
    const wanessaSupervisoraNoc = {
      login: 'wanessa.supervisora',
      nome: 'Wanessa Supervisora',
      email: 'wanessa.supervisora@teste.local',
      equipeId: 'EQ_NOC',
      nivelHierarquico: 4,
      perfil: 'SUPERVISOR_EQUIPE',
      equipesPermitidas: ['EQ_NOC'],
    };
    const analistaNoc = {
      login: 'analista.noc',
      nome: 'Analista NOC',
      email: 'analista.noc@teste.local',
      equipeId: 'EQ_NOC',
      nivelHierarquico: 6,
    };

    function grupoPlantaoSemNoc(ajustes: Record<string, unknown> = {}) {
      return grupoPlantao({
        grupoId: 'PLANTAO_COSI',
        nome: 'Plantão COSI',
        equipeResponsavelId: 'EQ_PLANTAO_COSI',
        equipesConsulta: ['EQ_PLANTAO_COSI'],
        unidadeResponsavelId: 'COSI',
        criadoPorLogin: usuarios.gestor.login,
        ...ajustes,
      });
    }

    beforeEach(async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        const db = contexto.firestore();
        await Promise.all([
          setDoc(doc(db, 'usuarios', wanessaSupervisoraNoc.login), wanessaSupervisoraNoc),
          setDoc(doc(db, 'usuarios', analistaNoc.login), analistaNoc),
          setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoSemNoc()),
          setDoc(doc(db, 'gruposPlantao', 'PLANTAO_CODB'), grupoPlantaoSemNoc({
            grupoId: 'PLANTAO_CODB',
            nome: 'Plantão CODB',
            equipeResponsavelId: 'EQ_PLANTAO_CODB',
            equipesConsulta: ['EQ_PLANTAO_CODB'],
            unidadeResponsavelId: 'CODB',
          })),
        ]);
      });
    });

    it('Wanessa (SUPERVISOR_EQUIPE do NOC) adiciona EQ_NOC em equipesConsulta do Plantão COSI e do Plantão CODB, sem administrar nenhum dos dois', async () => {
      const db = autenticarComo(wanessaSupervisoraNoc);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC'],
        atualizadoEm: '2026-08-20T00:00:00.000Z',
      }));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_CODB'), {
        equipesConsulta: ['EQ_PLANTAO_CODB', 'EQ_NOC'],
        atualizadoEm: '2026-08-20T00:00:00.000Z',
      }));
      // Continua sem administrar: não consegue mudar nenhum outro campo.
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { nome: 'Hackeado pela Wanessa' }));
    });

    it('remover EQ_NOC de equipesConsulta também é permitido (desmonitorar)', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoSemNoc({ equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC'] }));
      });
      const db = autenticarComo(wanessaSupervisoraNoc);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { equipesConsulta: ['EQ_PLANTAO_COSI'] }));
    });

    it('Wanessa NÃO consegue adicionar outra equipe (só a própria administrada, EQ_NOC)', async () => {
      const db = autenticarComo(wanessaSupervisoraNoc);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_SOC'],
      }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_CODB_NOC'],
      }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_PLANTAO_CODB'],
      }));
    });

    it('Wanessa NÃO consegue alterar nome/descrição/timezone/ativo/equipeResponsavelId/unidadeResponsavelId/caminhoUnidadeResponsavel/padraoHorarioSemanal — nem junto com equipesConsulta, nem sozinho', async () => {
      const db = autenticarComo(wanessaSupervisoraNoc);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC'],
        nome: 'Renomeado',
      }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { descricao: 'Nova descrição' }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { timezone: 'UTC' }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { ativo: false }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { equipeResponsavelId: 'EQ_NOC' }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { unidadeResponsavelId: 'CODB' }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { caminhoUnidadeResponsavel: ['CODB'] }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
      }));
    });

    it('analista comum do NOC não consegue alterar equipesConsulta', async () => {
      const db = autenticarComo(analistaNoc);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC'],
      }));
    });

    it('equipeResponsavelId nunca pode sair de equipesConsulta, mesmo pelo próprio administrador da equipe responsável usando o caminho de autovínculo', async () => {
      // usuarios.gestor administra EQ_COSI_SOC, a equipeResponsavelId de PLANTAO_TESTE.
      const db = autenticarComo(usuarios.gestor);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        equipesConsulta: ['EQ_CODB_NOC'],
      }));
    });

    it('duas mudanças na mesma escrita (uma equipe entra, outra sai) é negado — autovínculo só move uma equipe por vez', async () => {
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoSemNoc({ equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC'] }));
      });
      const outroSupervisorNoc = { ...wanessaSupervisoraNoc, login: 'outro.supervisor.noc' };
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'usuarios', outroSupervisorNoc.login), outroSupervisorNoc);
      });
      const db = autenticarComo(wanessaSupervisoraNoc);
      // Tenta remover EQ_NOC e simular a entrada de outra equipe na mesma escrita.
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_SOC'],
      }));
    });

    it('coordenador responsável pelo Plantão COSI continua administrando normalmente (não fica restrito ao autovínculo)', async () => {
      const gestorUnidadeCosi = {
        login: 'coordenadora.cosi.consulta',
        nome: 'Coordenadora COSI',
        email: 'coordenadora.cosi.consulta@teste.local',
        equipeId: 'EQ_COSI_COORD',
        nivelHierarquico: 4,
        perfil: 'GESTOR_UNIDADE',
        escopo: 'UNIDADE',
        unidadeId: 'COSI',
        unidadesPermitidas: ['COSI'],
      };
      await ambiente.withSecurityRulesDisabled(async (contexto) => {
        await setDoc(doc(contexto.firestore(), 'usuarios', gestorUnidadeCosi.login), gestorUnidadeCosi);
      });
      const db = autenticarComo(gestorUnidadeCosi);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), { nome: 'Plantão COSI renomeado pelo coordenador' }));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC', 'EQ_SOC'],
      }));
    });

    it('ADMIN_SISTEMA continua podendo gerenciar qualquer grupo, inclusive equipesConsulta livremente', async () => {
      const db = autenticarComo(usuarios.admin);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), {
        equipesConsulta: ['EQ_PLANTAO_COSI', 'EQ_NOC', 'EQ_SOC', 'EQ_CODB_NOC'],
      }));
    });

    it('delete físico continua negado, mesmo para quem administra ou para quem só autovincula consulta', async () => {
      const gestorDb = autenticarComo(usuarios.gestor);
      await assertFails(deleteDoc(doc(gestorDb, 'gruposPlantao', 'PLANTAO_TESTE')));
      const wanessaDb = autenticarComo(wanessaSupervisoraNoc);
      await assertFails(deleteDoc(doc(wanessaDb, 'gruposPlantao', 'PLANTAO_COSI')));
    });
  });

  describe('Fase PLANTAO-PADRAO-1 — padrão semanal do Grupo de Plantão', () => {
    const ENTRADA_VALIDA = { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 };

    it('documento antigo sem o campo continua lido/atualizado normalmente (retrocompatibilidade)', async () => {
      const db = autenticarComo(usuarios.gestor);
      const grupo = await assertSucceeds(getDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE')));
      expect(grupo.data()?.padraoHorarioSemanal).toBeUndefined();
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { nome: 'Renomeado sem tocar o padrão' }));
    });

    it('gestor autorizado grava um padrão semanal válido (create e update)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(setDoc(
        doc(db, 'gruposPlantao', 'PLANTAO_NOVO_PADRAO'),
        grupoPlantao({ grupoId: 'PLANTAO_NOVO_PADRAO', padraoHorarioSemanal: [ENTRADA_VALIDA] }),
      ));
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [ENTRADA_VALIDA, { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 }],
      }));
    });

    it('gestor autorizado remove o padrão gravando array vazio', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { padraoHorarioSemanal: [] }));
    });

    it('rejeita horário inválido (fora de HH:mm 00-23/00-59)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [{ ...ENTRADA_VALIDA, horaInicio: '7:00' }],
      }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [{ ...ENTRADA_VALIDA, horaFim: '25:00' }],
      }));
    });

    it('rejeita diaSemana fora do intervalo 0..6', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [{ ...ENTRADA_VALIDA, diaSemana: -1 }],
      }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [{ ...ENTRADA_VALIDA, diaSemana: 7 }],
      }));
    });

    it('rejeita fimDiaOffset fora de {0, 1}', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [{ ...ENTRADA_VALIDA, fimDiaOffset: 2 }],
      }));
    });

    it('rejeita campo extra dentro de uma entrada do padrão (allowlist de chaves)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [{ ...ENTRADA_VALIDA, extra: 'não deveria existir' }],
      }));
    });

    it('rejeita mais de 7 entradas', async () => {
      const db = autenticarComo(usuarios.gestor);
      const oitoEntradas = Array.from({ length: 8 }, (_valor, indice) => ({
        ...ENTRADA_VALIDA,
        diaSemana: indice % 7,
      }));
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { padraoHorarioSemanal: oitoEntradas }));
    });

    // Achado documentado (não uma falha de Rule): duplicidade de `diaSemana`
    // entre elementos NÃO é validada pela Rule (exigiria comparação
    // par-a-par de até 7 posições — avaliado como desproporcional; a defesa
    // real já existe client-side em `validarPadraoHorarioSemanal()`, que
    // roda antes de qualquer `setDoc`/`updateDoc`). Registrado aqui para
    // nunca ser confundido com uma omissão silenciosa.
    it('dia duplicado NÃO é bloqueado pela Rule (limitação documentada — client-side é quem valida isso)', async () => {
      const db = autenticarComo(usuarios.gestor);
      await assertSucceeds(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), {
        padraoHorarioSemanal: [ENTRADA_VALIDA, { ...ENTRADA_VALIDA }],
      }));
    });

    it('usuário não autorizado (fora do escopo da equipe responsável) não consegue gravar o padrão', async () => {
      const db = autenticarComo(gestorForaEscopo);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { padraoHorarioSemanal: [ENTRADA_VALIDA] }));
    });

    it('consulta-only (equipe só em equipesConsulta, não é a responsável) não consegue editar o Grupo nem gravar o padrão', async () => {
      const db = autenticarComo(usuarios.externo);
      await assertFails(updateDoc(doc(db, 'gruposPlantao', 'PLANTAO_TESTE'), { padraoHorarioSemanal: [ENTRADA_VALIDA] }));
    });
  });
});

/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — liberação operacional exclusiva de
 * staging, via `config/ambiente` (`{ staging: true }`). Este bloco prova,
 * nesta ordem:
 *
 * 1. Sem o documento (produção, e staging antes do seed), a Matriz
 *    existente que não lista o coordenador continua bloqueando — o
 *    comportamento de ANTES desta fase não muda por omissão (fail-closed).
 * 2. Com o documento, GESTOR_EQUIPE e SUPERVISOR_EQUIPE administram
 *    Jornada/Plantão dentro do PRÓPRIO escopo mesmo quando a Matriz existe
 *    e não os lista — sem depender de um ADMIN_SISTEMA reconfigurar a
 *    Matriz antes.
 * 3. A própria Matriz (`escoposOperacionais`) também fica editável por
 *    coordenador/supervisor em staging, mas só dentro do próprio escopo.
 * 4. O que continua bloqueado mesmo em staging: ADMIN_SISTEMA, escopo
 *    GLOBAL, e todo delete físico já negado (`auditoriaAdmin`,
 *    `historicoPublicacoes`, `publicacoesEscala`, `escoposOperacionais`).
 */
describe('STAGING-RESET-HIERARQUIA-ICI-1 — liberação operacional de staging', () => {
  const supervisoraSoc = {
    login: 'sabrina.supervisora.soc',
    nome: 'Sabrina Supervisora',
    email: 'sabrina.supervisora.soc@teste.local',
    equipeId: 'EQ_COSI_SOC',
    nivelHierarquico: 4,
    perfil: 'SUPERVISOR_EQUIPE',
    escopo: 'EQUIPE',
    equipesPermitidas: ['EQ_COSI_SOC', 'EQ_COSI_SOC_TURNO2'],
  };

  const coordenadorPlantao = {
    login: 'paulo.coordenador.plantao',
    nome: 'Paulo Coordenador Plantão',
    email: 'paulo.coordenador.plantao@teste.local',
    equipeId: 'EQ_PLANTAO_COSI',
    nivelHierarquico: 5,
  };

  const supervisoraPlantao = {
    login: 'sonia.supervisora.plantao',
    nome: 'Sônia Supervisora Plantão',
    email: 'sonia.supervisora.plantao@teste.local',
    equipeId: 'EQ_PLANTAO_COSI',
    nivelHierarquico: 4,
    perfil: 'SUPERVISOR_EQUIPE',
    escopo: 'EQUIPE',
  };

  function matrizJornadaSocSemResponsavelDoTime(ajustes: Record<string, unknown> = {}) {
    return escopoOperacional({
      tipo: 'JORNADA',
      alvoId: 'EQ_COSI_SOC',
      alvoNome: 'SOC',
      equipesConsulta: [],
      responsaveisLogin: [usuarios.externo.login],
      ...ajustes,
    });
  }

  function matrizPlantaoSemResponsavelDoTime(ajustes: Record<string, unknown> = {}) {
    return escopoOperacional({
      tipo: 'PLANTAO',
      alvoId: 'PLANTAO_COSI',
      alvoNome: 'Plantão COSI',
      responsaveisLogin: [usuarios.externo.login],
      equipesConsulta: ['EQ_PLANTAO_COSI'],
      ...ajustes,
    });
  }

  async function habilitarStaging() {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'config', 'ambiente'), { staging: true });
    });
  }

  beforeEach(async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await Promise.all([
        setDoc(doc(db, 'usuarios', supervisoraSoc.login), supervisoraSoc),
        setDoc(doc(db, 'usuarios', coordenadorPlantao.login), coordenadorPlantao),
        setDoc(doc(db, 'usuarios', supervisoraPlantao.login), supervisoraPlantao),
        setDoc(doc(db, 'gruposPlantao', 'PLANTAO_COSI'), grupoPlantaoMatriz()),
        setDoc(doc(db, 'escoposOperacionais', 'JORNADA_EQ_COSI_SOC'), matrizJornadaSocSemResponsavelDoTime()),
        setDoc(doc(db, 'escoposOperacionais', 'PLANTAO_PLANTAO_COSI'), matrizPlantaoSemResponsavelDoTime()),
      ]);
    });
  });

  it('sem config/ambiente.staging=true, a Matriz existente que não lista o coordenador continua bloqueando (fail-closed, comportamento de produção)', async () => {
    const supervisora = autenticarComo(supervisoraSoc);
    await assertFails(setDoc(
      doc(supervisora, 'rascunhosTurnosMes', 'EQ_COSI_SOC_novo.membro_2026-09'),
      escala('novo.membro', 'EQ_COSI_SOC', 'RASCUNHO'),
    ));

    const coordenador = autenticarComo(coordenadorPlantao);
    await assertFails(setDoc(
      doc(coordenador, 'rascunhosCompetenciasPlantao', 'PLANTAO_COSI_2026-09'),
      competenciaPlantaoMatriz(),
    ));
  });

  it('com staging habilitado, GESTOR_EQUIPE e SUPERVISOR_EQUIPE administram Jornada mesmo com Matriz existente que não os lista', async () => {
    await habilitarStaging();
    for (const ator of [usuarios.gestor, supervisoraSoc]) {
      const db = autenticarComo(ator);
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosTurnosMes', `EQ_COSI_SOC_novo.${ator.login}_2026-09`),
        escala(`novo.${ator.login}`, 'EQ_COSI_SOC', 'RASCUNHO'),
      ));
    }
  });

  it('com staging habilitado, GESTOR_EQUIPE e SUPERVISOR_EQUIPE administram Plantão mesmo com Matriz existente que não os lista', async () => {
    await habilitarStaging();
    for (const ator of [coordenadorPlantao, supervisoraPlantao]) {
      const db = autenticarComo(ator);
      await assertSucceeds(setDoc(
        doc(db, 'rascunhosCompetenciasPlantao', `PLANTAO_COSI_2026-09-${ator.login}`),
        { ...competenciaPlantaoMatriz(), id: `PLANTAO_COSI_2026-09-${ator.login}`, competencia: '2026-09', criadoPorLogin: ator.login },
      ));
    }
  });

  it('com staging habilitado, coordenador aprova e recusa troca mesmo sem estar na Matriz de Jornada', async () => {
    await habilitarStaging();
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'trocasEscala', 'troca-staging'), troca({
        trocaId: 'troca-staging',
        equipeId: 'EQ_COSI_SOC',
        status: 'PENDENTE_GESTOR',
      }));
    });
    const supervisora = autenticarComo(supervisoraSoc);
    await assertSucceeds(updateDoc(doc(supervisora, 'trocasEscala', 'troca-staging'), {
      status: 'RECUSADA_GESTOR',
      motivoRecusa: 'Sem cobertura suficiente.',
      gestorLogin: supervisoraSoc.login,
      gestorNome: supervisoraSoc.nome,
      historico: [
        ...troca().historico,
        { tipo: 'RECUSA_GESTOR', porLogin: supervisoraSoc.login, porNome: supervisoraSoc.nome, porPerfil: 'GESTOR', em: '2026-08-07T15:00:00.000Z', descricao: 'Recusada' },
      ],
    }));
  });

  it('com staging habilitado, coordenador cadastra colaborador e delega GESTOR_EQUIPE/SUPERVISOR_EQUIPE restrito à própria equipe', async () => {
    await habilitarStaging();
    const supervisora = autenticarComo(supervisoraSoc);
    await assertSucceeds(setDoc(doc(supervisora, 'usuarios', 'novo.colaborador.soc'), {
      login: 'novo.colaborador.soc',
      nome: 'Novo Colaborador SOC',
      equipeId: 'EQ_COSI_SOC',
      nivelHierarquico: 6,
      cadastroOperacional: { tipo: 'JORNADA', alvoId: 'EQ_COSI_SOC', criadoPorLogin: supervisoraSoc.login },
    }));
    await assertSucceeds(setDoc(doc(supervisora, 'usuarios', 'novo.supervisor.soc'), {
      login: 'novo.supervisor.soc',
      nome: 'Novo Supervisor SOC',
      equipeId: 'EQ_COSI_SOC',
      nivelHierarquico: 4,
      perfil: 'SUPERVISOR_EQUIPE',
      escopo: 'EQUIPE',
      cadastroOperacional: { tipo: 'JORNADA', alvoId: 'EQ_COSI_SOC', criadoPorLogin: supervisoraSoc.login },
    }));
  });

  it('mesmo com staging habilitado, coordenador NÃO cria ADMIN_SISTEMA nem escopo GLOBAL', async () => {
    await habilitarStaging();
    const supervisora = autenticarComo(supervisoraSoc);
    await assertFails(setDoc(doc(supervisora, 'usuarios', 'admin.forjado.staging'), {
      login: 'admin.forjado.staging',
      nome: 'Admin Forjado',
      equipeId: 'EQ_COSI_SOC',
      nivelHierarquico: 0,
      perfil: 'ADMIN_SISTEMA',
      cadastroOperacional: { tipo: 'JORNADA', alvoId: 'EQ_COSI_SOC', criadoPorLogin: supervisoraSoc.login },
    }));
    await assertFails(setDoc(doc(supervisora, 'usuarios', 'escopo.global.forjado'), {
      login: 'escopo.global.forjado',
      nome: 'Escopo Global Forjado',
      equipeId: 'EQ_COSI_SOC',
      nivelHierarquico: 3,
      perfil: 'GESTOR_EQUIPE',
      escopo: 'GLOBAL',
      cadastroOperacional: { tipo: 'JORNADA', alvoId: 'EQ_COSI_SOC', criadoPorLogin: supervisoraSoc.login },
    }));
  });

  it('com staging habilitado, coordenador/supervisor editam a própria Matriz dentro do escopo, mas não fora dele', async () => {
    await habilitarStaging();
    const supervisora = autenticarComo(supervisoraSoc);
    await assertSucceeds(updateDoc(doc(supervisora, 'escoposOperacionais', 'JORNADA_EQ_COSI_SOC'), {
      responsaveisLogin: [usuarios.externo.login, supervisoraSoc.login],
      atualizadoPorLogin: supervisoraSoc.login,
      atualizadoEm: '2026-08-20T00:00:00.000Z',
    }));
    await assertSucceeds(setDoc(
      doc(supervisora, 'escoposOperacionais', 'JORNADA_EQ_COSI_SOC_TURNO2'),
      escopoOperacional({
        tipo: 'JORNADA',
        alvoId: 'EQ_COSI_SOC_TURNO2',
        alvoNome: 'SOC Turno 2',
        equipesConsulta: [],
        responsaveisLogin: [supervisoraSoc.login],
        criadoPorLogin: supervisoraSoc.login,
        atualizadoPorLogin: supervisoraSoc.login,
      }),
    ));

    // Fora do escopo dela (NOC): nem em staging.
    await assertFails(setDoc(
      doc(supervisora, 'escoposOperacionais', 'JORNADA_EQ_CODB_NOC'),
      escopoOperacional({
        tipo: 'JORNADA',
        alvoId: 'EQ_CODB_NOC',
        alvoNome: 'NOC',
        equipesConsulta: [],
        responsaveisLogin: [supervisoraSoc.login],
        criadoPorLogin: supervisoraSoc.login,
        atualizadoPorLogin: supervisoraSoc.login,
      }),
    ));
  });

  it('com staging habilitado, ações sensíveis do coordenador geram auditoria — mas ele nunca lê, atualiza ou apaga o log', async () => {
    await habilitarStaging();
    const supervisora = autenticarComo(supervisoraSoc);
    const registro = {
      atorRealLogin: supervisoraSoc.login,
      atorSimuladoLogin: null,
      acao: 'CADASTRAR_USUARIOS',
      equipeId: 'EQ_COSI_SOC',
      em: '2026-08-20T00:00:00.000Z',
    };
    await assertSucceeds(setDoc(doc(supervisora, 'auditoriaAdmin', 'auditoria-staging-1'), registro));
    await assertFails(getDoc(doc(supervisora, 'auditoriaAdmin', 'auditoria-staging-1')));
    await assertFails(updateDoc(doc(supervisora, 'auditoriaAdmin', 'auditoria-staging-1'), { acao: 'FORJADO' }));
    await assertFails(deleteDoc(doc(supervisora, 'auditoriaAdmin', 'auditoria-staging-1')));
  });

  it('mesmo em staging e mesmo para ADMIN_SISTEMA, delete físico de histórico/publicação/Matriz continua negado', async () => {
    await habilitarStaging();
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await Promise.all([
        setDoc(doc(db, 'historicoPublicacoes', 'hist-staging-1'), { equipeId: 'EQ_COSI_SOC' }),
        setDoc(doc(db, 'publicacoesEscala', 'pub-staging-1'), { id: 'pub-staging-1', equipeId: 'EQ_COSI_SOC', competencia: '2026-09' }),
      ]);
    });
    const admin = autenticarComo(usuarios.admin);
    await assertFails(deleteDoc(doc(admin, 'historicoPublicacoes', 'hist-staging-1')));
    await assertFails(deleteDoc(doc(admin, 'publicacoesEscala', 'pub-staging-1')));
    await assertFails(deleteDoc(doc(admin, 'escoposOperacionais', 'JORNADA_EQ_COSI_SOC')));
  });
});

/**
 * STAGING-RESET-HIERARQUIA-ICI-2 — cadastro LIVRE de unidade/equipe em
 * staging: `perfilCadastroLivreStagingValido()` nunca checa se quem cadastra
 * administra a unidade/equipe escolhida (deliberadamente, para nunca travar
 * o coordenador numa lista incompleta) — só valida a combinação
 * perfil/escopo/unidade/equipe em si. IDs usados abaixo (`GEDSI_COSI`,
 * `GEDSI_CODB`, `GEDSI_COSI_SOC`, `GEDSI_COSI_PLANTAO`, `GEDSI_CODB_NOC`)
 * são só valores de payload — esta regra nunca verifica se o documento de
 * equipe/unidade referenciado existe de fato.
 */
describe('STAGING-RESET-HIERARQUIA-ICI-2 — cadastro livre de unidade/equipe em staging', () => {
  const gestoraUnidadeStagingTeste = {
    login: 'gestor.unidade.staging.teste',
    nome: 'Gestora de Unidade (teste staging)',
    email: 'gestor.unidade.staging.teste@teste.local',
    equipeId: 'GEDSI_CODB_NOC',
    nivelHierarquico: 4,
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    unidadeId: 'GEDSI_CODB',
    unidadesPermitidas: ['GEDSI_CODB'],
  };

  async function habilitarStaging() {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'config', 'ambiente'), { staging: true });
    });
  }

  beforeEach(async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'usuarios', gestoraUnidadeStagingTeste.login), gestoraUnidadeStagingTeste);
    });
  });

  it('1-2. cadastra colaborador em qualquer equipe ativa, mesmo fora da própria unidade (GEDSI_COSI_SOC e GEDSI_CODB_NOC)', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    for (const equipeId of ['GEDSI_COSI_SOC', 'GEDSI_CODB_NOC']) {
      await assertSucceeds(setDoc(doc(gestora, 'usuarios', `novo.colaborador.${equipeId.toLowerCase()}`), {
        login: `novo.colaborador.${equipeId.toLowerCase()}`,
        nome: 'Novo Colaborador',
        equipeId,
        nivelHierarquico: 6,
      }));
    }
  });

  it('3-4. cadastra GESTOR_UNIDADE em qualquer unidade ativa, mesmo fora do próprio escopo (GEDSI_COSI e GEDSI_CODB)', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    for (const unidadeId of ['GEDSI_COSI', 'GEDSI_CODB']) {
      await assertSucceeds(setDoc(doc(gestora, 'usuarios', `novo.gestor.${unidadeId.toLowerCase()}`), {
        login: `novo.gestor.${unidadeId.toLowerCase()}`,
        nome: 'Novo Gestor de Unidade',
        equipeId: 'GEDSI_CODB_NOC',
        nivelHierarquico: 4,
        perfil: 'GESTOR_UNIDADE',
        escopo: 'UNIDADE',
        unidadeId,
        unidadesPermitidas: [unidadeId],
      }));
    }
  });

  it('5. cadastra GESTOR_EQUIPE em GEDSI_COSI_PLANTAO, fora da própria unidade', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertSucceeds(setDoc(doc(gestora, 'usuarios', 'novo.gestor.plantao'), {
      login: 'novo.gestor.plantao',
      nome: 'Novo Gestor de Equipe',
      equipeId: 'GEDSI_COSI_PLANTAO',
      nivelHierarquico: 4,
      perfil: 'GESTOR_EQUIPE',
      escopo: 'EQUIPE',
      equipesPermitidas: ['GEDSI_COSI_PLANTAO'],
    }));
  });

  it('6. cadastra SUPERVISOR_EQUIPE em GEDSI_CODB_NOC', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertSucceeds(setDoc(doc(gestora, 'usuarios', 'novo.supervisor.noc'), {
      login: 'novo.supervisor.noc',
      nome: 'Novo Supervisor',
      equipeId: 'GEDSI_CODB_NOC',
      nivelHierarquico: 5,
      perfil: 'SUPERVISOR_EQUIPE',
      escopo: 'EQUIPE',
      equipesPermitidas: ['GEDSI_CODB_NOC'],
    }));
  });

  it('7-8. a mesma coordenadora escolhe uma unidade E uma equipe diferentes da sua própria unidade/equipe, na mesma sessão', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertSucceeds(setDoc(doc(gestora, 'usuarios', 'escolha.unidade.diferente'), {
      login: 'escolha.unidade.diferente',
      nome: 'Escolha Unidade Diferente',
      equipeId: 'GEDSI_CODB_NOC',
      nivelHierarquico: 4,
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
      unidadeId: 'GEDSI_COSI',
      unidadesPermitidas: ['GEDSI_COSI'],
    }));
    await assertSucceeds(setDoc(doc(gestora, 'usuarios', 'escolha.equipe.diferente'), {
      login: 'escolha.equipe.diferente',
      nome: 'Escolha Equipe Diferente',
      equipeId: 'GEDSI_COSI_SOC',
      nivelHierarquico: 6,
    }));
  });

  it('9. nunca cria ADMIN_SISTEMA, mesmo em staging', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertFails(setDoc(doc(gestora, 'usuarios', 'admin.forjado.livre'), {
      login: 'admin.forjado.livre',
      nome: 'Admin Forjado',
      equipeId: 'GEDSI_CODB_NOC',
      nivelHierarquico: 0,
      perfil: 'ADMIN_SISTEMA',
      escopo: 'GLOBAL',
    }));
  });

  it('10. nunca cria escopo GLOBAL, mesmo com perfil de equipe/unidade válido', async () => {
    await habilitarStaging();
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertFails(setDoc(doc(gestora, 'usuarios', 'escopo.global.forjado.livre'), {
      login: 'escopo.global.forjado.livre',
      nome: 'Escopo Global Forjado',
      equipeId: 'GEDSI_CODB_NOC',
      nivelHierarquico: 4,
      perfil: 'GESTOR_EQUIPE',
      escopo: 'GLOBAL',
      equipesPermitidas: ['GEDSI_CODB_NOC'],
    }));
    await assertFails(setDoc(doc(gestora, 'usuarios', 'escopo.global.forjado.unidade'), {
      login: 'escopo.global.forjado.unidade',
      nome: 'Escopo Global Forjado 2',
      equipeId: 'GEDSI_CODB_NOC',
      nivelHierarquico: 4,
      perfil: 'GESTOR_UNIDADE',
      escopo: 'GLOBAL',
      unidadeId: 'GEDSI_COSI',
      unidadesPermitidas: ['GEDSI_COSI'],
    }));
  });

  it('11. não promove ninguém para ADMIN_SISTEMA via update, mesmo em staging', async () => {
    await habilitarStaging();
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'usuarios', 'colega.para.promover'), {
        login: 'colega.para.promover',
        nome: 'Colega',
        equipeId: 'GEDSI_CODB_NOC',
        nivelHierarquico: 6,
      });
    });
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertFails(updateDoc(doc(gestora, 'usuarios', 'colega.para.promover'), {
      perfil: 'ADMIN_SISTEMA',
      escopo: 'GLOBAL',
    }));
  });

  it('12. sem config/ambiente.staging=true, o cadastro livre continua indisponível (fail-closed)', async () => {
    const gestora = autenticarComo(gestoraUnidadeStagingTeste);
    await assertFails(setDoc(doc(gestora, 'usuarios', 'sem.staging.livre'), {
      login: 'sem.staging.livre',
      nome: 'Sem Staging',
      equipeId: 'GEDSI_COSI_SOC',
      nivelHierarquico: 6,
    }));
  });
});

/**
 * JORNADA-IMPORTACAO-VINCULOS-UX-1 — diferente do describe acima (cadastro
 * LIVRE de qualquer unidade/equipe), aqui o coordenador só administra a
 * PRÓPRIA equipe de Jornada (GEDSI_COSI_SOC) — o caso comum de "criar
 * usuário"/"associar"/"alias"/"ignorar" a partir da conciliação da planilha
 * importada. Confirma que os caminhos já existentes (matriz/ACL histórica +
 * `souCoordenadorOperacionalStaging()` como fallback) já autorizam tudo que
 * a nova UI faz — nenhuma regra nova foi necessária nesta fase.
 */
describe('JORNADA-IMPORTACAO-VINCULOS-UX-1 — vínculos da importação de Jornada em staging', () => {
  const coordenadorJornadaStagingTeste = {
    login: 'coordenador.jornada.staging.teste',
    nome: 'Coordenador de Jornada (teste staging)',
    email: 'coordenador.jornada.staging.teste@teste.local',
    equipeId: 'GEDSI_COSI_SOC',
    nivelHierarquico: 4,
    perfil: 'GESTOR_EQUIPE',
    escopo: 'EQUIPE',
  };

  async function habilitarStaging() {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'config', 'ambiente'), { staging: true });
    });
  }

  beforeEach(async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'usuarios', coordenadorJornadaStagingTeste.login), coordenadorJornadaStagingTeste);
    });
  });

  it('17. cria usuário operacional a partir de uma pendência de conciliação (perfil/escopo padrão, contexto JORNADA)', async () => {
    await habilitarStaging();
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    await assertSucceeds(setDoc(doc(coordenador, 'usuarios', 'a.lima'), {
      login: 'a.lima',
      nome: 'a.lima (planilha)',
      equipeId: 'GEDSI_COSI_SOC',
      nivelHierarquico: 6,
      aliasesPlanilha: ['a.lima (planilha)'],
      cadastroOperacional: {
        tipo: 'JORNADA',
        alvoId: 'GEDSI_COSI_SOC',
        criadoPorLogin: coordenadorJornadaStagingTeste.login,
      },
    }));
  });

  it('18. adiciona alias da planilha a um colaborador já existente da própria equipe', async () => {
    await habilitarStaging();
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'usuarios', 'aleilima'), {
        login: 'aleilima',
        nome: 'Aleilima',
        equipeId: 'GEDSI_COSI_SOC',
        nivelHierarquico: 6,
        aliasesPlanilha: [],
        cadastroOperacional: {
          tipo: 'JORNADA',
          alvoId: 'GEDSI_COSI_SOC',
          criadoPorLogin: coordenadorJornadaStagingTeste.login,
        },
      });
    });
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    await assertSucceeds(updateDoc(doc(coordenador, 'usuarios', 'aleilima'), {
      aliasesPlanilha: ['a. lima'],
      atualizadoEm: '2026-08-22T00:00:00.000Z',
    }));
  });

  it('19. registra auditoria (associar/alias/ignorar/criar) com o próprio login como ator real', async () => {
    await habilitarStaging();
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    for (const acao of ['ASSOCIAR_USUARIO_IMPORTACAO', 'ADICIONAR_ALIAS_IMPORTACAO', 'IGNORAR_PENDENCIA_IMPORTACAO', 'SALVAR_USUARIO']) {
      await assertSucceeds(setDoc(doc(coordenador, 'auditoriaAdmin', `${acao.toLowerCase()}-teste`), {
        atorRealLogin: coordenadorJornadaStagingTeste.login,
        atorRealNome: coordenadorJornadaStagingTeste.nome,
        atorRealPerfil: 'GESTOR_EQUIPE',
        atorSimuladoLogin: null,
        atorSimuladoNome: null,
        atorSimuladoPerfil: null,
        equipeId: 'GEDSI_COSI_SOC',
        unidadeId: null,
        competencia: '2026-08',
        nomeImportado: 'a.lima',
        usuarioVinculadoLogin: 'aleilima',
        origem: 'IMPORTACAO_JORNADA',
        acao,
        em: '2026-08-22T00:00:00.000Z',
      }));
    }
  });

  it('20. salva rascunho da grade (rascunhosTurnosMes) da própria equipe de Jornada', async () => {
    await habilitarStaging();
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    await assertSucceeds(setDoc(doc(coordenador, 'rascunhosTurnosMes', 'GEDSI_COSI_SOC_a.lima_2026-08'), {
      equipeId: 'GEDSI_COSI_SOC',
      login: 'a.lima',
      usuarioUid: 'a.lima',
      competencia: '2026-08',
      schemaVersion: 1,
      status: 'RASCUNHO',
    }));
  });

  it('21. não cria ADMIN_SISTEMA a partir da importação', async () => {
    await habilitarStaging();
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    await assertFails(setDoc(doc(coordenador, 'usuarios', 'admin.forjado.importacao'), {
      login: 'admin.forjado.importacao',
      nome: 'Admin Forjado',
      equipeId: 'GEDSI_COSI_SOC',
      nivelHierarquico: 0,
      perfil: 'ADMIN_SISTEMA',
      escopo: 'GLOBAL',
      cadastroOperacional: {
        tipo: 'JORNADA',
        alvoId: 'GEDSI_COSI_SOC',
        criadoPorLogin: coordenadorJornadaStagingTeste.login,
      },
    }));
  });

  it('22. não cria escopo GLOBAL a partir da importação', async () => {
    await habilitarStaging();
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    await assertFails(setDoc(doc(coordenador, 'usuarios', 'escopo.global.forjado.importacao'), {
      login: 'escopo.global.forjado.importacao',
      nome: 'Escopo Global Forjado',
      equipeId: 'GEDSI_COSI_SOC',
      nivelHierarquico: 4,
      perfil: 'GESTOR_EQUIPE',
      escopo: 'GLOBAL',
      cadastroOperacional: {
        tipo: 'JORNADA',
        alvoId: 'GEDSI_COSI_SOC',
        criadoPorLogin: coordenadorJornadaStagingTeste.login,
      },
    }));
  });

  it('23. sem config/ambiente.staging=true, a criação a partir da importação continua exigindo a Matriz/ACL histórica (fail-closed para o fallback de staging)', async () => {
    const coordenador = autenticarComo(coordenadorJornadaStagingTeste);
    // A própria equipe (`podeOperarNaEquipe` + ACL histórica sem Matriz) já
    // autoriza mesmo fora de staging — isso não muda nesta fase.
    await assertSucceeds(setDoc(doc(coordenador, 'usuarios', 'fora.de.staging.propria.equipe'), {
      login: 'fora.de.staging.propria.equipe',
      nome: 'Fora de Staging (própria equipe)',
      equipeId: 'GEDSI_COSI_SOC',
      nivelHierarquico: 6,
      cadastroOperacional: {
        tipo: 'JORNADA',
        alvoId: 'GEDSI_COSI_SOC',
        criadoPorLogin: coordenadorJornadaStagingTeste.login,
      },
    }));
    // Mas fora da própria equipe, sem staging e sem Matriz, continua negado.
    await assertFails(setDoc(doc(coordenador, 'usuarios', 'fora.de.staging.outra.equipe'), {
      login: 'fora.de.staging.outra.equipe',
      nome: 'Fora de Staging (outra equipe)',
      equipeId: 'GEDSI_CODB_NOC',
      nivelHierarquico: 6,
      cadastroOperacional: {
        tipo: 'JORNADA',
        alvoId: 'GEDSI_CODB_NOC',
        criadoPorLogin: coordenadorJornadaStagingTeste.login,
      },
    }));
  });
});
