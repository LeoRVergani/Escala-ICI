import type { ErroImportacao, ResultadoParse, TurnosMes } from '@escala-ici/contrato';
import { idDocumento } from '@escala-ici/contrato';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Usuario } from '../modelos';

/**
 * Regressão: `publicarEscalas()` já apagou rascunho inexistente com
 * `batch.delete()` incondicional, o que as Firestore Rules recusam
 * (`resource` nulo não tem `equipeId` para comparar) e derrubava o batch
 * inteiro com permission-denied. Este mock não reproduz as rules — ele
 * trava o contrato de que a função só deve emitir `delete` para
 * `rascunhosTurnosMes` que realmente vieram de uma leitura prévia.
 */
const estado = vi.hoisted(() => ({
  rascunhos: [] as Array<{ id: string; data: Record<string, unknown> }>,
  turnosMesAtivos: [] as Array<{ id: string; data: Record<string, unknown> }>,
  operacoes: [] as Array<{ tipo: 'set' | 'delete' | 'update'; colecao: string; id: string; dados?: Record<string, unknown>; lote: number }>,
  commits: [] as number[][],
  proximoLote: 0,
  // Controla em qual índice global de commit (0-based, na ordem em que
  // `writeBatch()` é chamado) o `.commit()` deve rejeitar — usado só para
  // testar propagação de falha, nunca reproduz as Rules reais.
  falharNoCommit: null as number | null,
}));

vi.mock('./shared', () => ({
  ambienteFirebaseAtual: 'local',
  escritaAdministrativaHabilitada: true,
  escritaOficialHabilitada: false,
  exigirEscritaAdministrativaHabilitada: () => {},
  exigirFirebase: () => ({ db: {} }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nome: string) => ({ __colecao: nome }),
  where: (campo: string, operador: string, valor: unknown) => ({ campo, operador, valor }),
  query: (colecaoRef: { __colecao: string }) => ({ __colecao: colecaoRef.__colecao }),
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  setDoc: async (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
    estado.operacoes.push({ tipo: 'set', colecao: ref.__colecao, id: ref.__id, dados, lote: -1 });
  },
  updateDoc: async () => {},
  deleteDoc: async () => {},
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async (ref: { __colecao: string }) => {
    const fonte = ref.__colecao === 'rascunhosTurnosMes'
      ? estado.rascunhos
      : ref.__colecao === 'turnosMes'
        ? estado.turnosMesAtivos
        : [];
    return {
      docs: fonte.map((item) => ({
        id: item.id,
        ref: { __colecao: ref.__colecao, __id: item.id },
        data: () => item.data,
      })),
    };
  },
  writeBatch: () => {
    const lote = estado.proximoLote++;
    return {
      set: (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
        estado.operacoes.push({ tipo: 'set', colecao: ref.__colecao, id: ref.__id, dados, lote });
      },
      delete: (ref: { __colecao: string; __id: string }) => {
        estado.operacoes.push({ tipo: 'delete', colecao: ref.__colecao, id: ref.__id, lote });
      },
      update: (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
        estado.operacoes.push({ tipo: 'update', colecao: ref.__colecao, id: ref.__id, dados, lote });
      },
      commit: async () => {
        if (estado.falharNoCommit === lote) {
          const erro = new Error('permission-denied (mock)') as Error & { code?: string };
          erro.code = 'permission-denied';
          throw erro;
        }
        estado.commits.push([lote]);
      },
    };
  },
}));

const { publicarEscalas, salvarRascunho, salvarUsuario } = await import('./writeRepository');

const EQUIPE = 'EQ_COSI_SOC';
const COMPETENCIA = '2026-08';

function documento(login: string, usuarioUidLegado = login): TurnosMes {
  return {
    schemaVersion: 1,
    usuarioUid: usuarioUidLegado,
    login,
    equipeId: EQUIPE,
    competencia: COMPETENCIA,
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    turnoPadrao: 'M',
    status: 'RASCUNHO',
    dias: {},
    totais: {
      min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0,
    },
  };
}

beforeEach(() => {
  estado.rascunhos = [];
  estado.turnosMesAtivos = [];
  estado.operacoes = [];
  estado.commits = [];
  estado.proximoLote = 0;
  estado.falharNoCommit = null;
});

describe('publicarEscalas', () => {
  it('conclui sem tentar apagar rascunho que não existe', async () => {
    await expect(publicarEscalas([documento('colab-1')], 'gestora-uid')).resolves.toBeDefined();

    const deletesDeRascunho = estado.operacoes.filter((operacao) =>
      operacao.colecao === 'rascunhosTurnosMes' && operacao.tipo === 'delete');
    expect(deletesDeRascunho).toHaveLength(0);
  });

  it('apaga somente os rascunhos que existem para a competência publicada', async () => {
    const idExistente = idDocumento(EQUIPE, 'colab-1', COMPETENCIA);
    const idOrfao = idDocumento(EQUIPE, 'colab-removido', COMPETENCIA);
    estado.rascunhos = [
      { id: idExistente, data: { equipeId: EQUIPE, competencia: COMPETENCIA, usuarioUid: 'colab-1' } },
      { id: idOrfao, data: { equipeId: EQUIPE, competencia: COMPETENCIA, usuarioUid: 'colab-removido' } },
    ];

    await publicarEscalas([documento('colab-1')], 'gestora-uid');

    const idsDeletados = estado.operacoes
      .filter((operacao) => operacao.colecao === 'rascunhosTurnosMes' && operacao.tipo === 'delete')
      .map((operacao) => operacao.id);
    expect(idsDeletados.sort()).toEqual([idExistente, idOrfao].sort());
  });

  /**
   * HOTFIX-PUBLICAR-ESCALAS-RULES-BUDGET-1 — regressão do estouro de
   * "maximum of 1000 expressions to evaluate" das Firestore Rules: cada
   * commit de `publicarEscalas()` soma poucos colaboradores (no máximo
   * `COLABORADORES_POR_LOTE_PUBLICACAO`), nunca centenas, mesmo quando a
   * escala publicada tem muitos colaboradores.
   */
  it('divide a publicação de vários colaboradores em múltiplos commits pequenos', async () => {
    const MAX_WRITES_POR_COLABORADOR = 3; // turnosMes + versoesEscala + eventosEscala
    const WRITES_EXTRAS_DO_PRIMEIRO_LOTE = 2; // historicoPublicacoes + publicacoesEscala
    const COLABORADORES_POR_LOTE_PUBLICACAO = 3;
    const MAX_WRITES_POR_COMMIT =
      COLABORADORES_POR_LOTE_PUBLICACAO * MAX_WRITES_POR_COLABORADOR + WRITES_EXTRAS_DO_PRIMEIRO_LOTE;

    const logins = Array.from({ length: 7 }, (_, indice) => `colab-${indice + 1}`);
    const documentos = logins.map((login) => documento(login));

    await publicarEscalas(documentos, 'gestora-uid');

    // 7 colaboradores / 3 por lote => 3 commits (ceil(7/3)).
    expect(estado.commits).toHaveLength(3);

    const porLote = new Map<number, typeof estado.operacoes>();
    for (const operacao of estado.operacoes) {
      const grupo = porLote.get(operacao.lote) ?? [];
      grupo.push(operacao);
      porLote.set(operacao.lote, grupo);
    }

    expect(porLote.size).toBe(3);
    for (const operacoesDoLote of porLote.values()) {
      expect(operacoesDoLote.length).toBeLessThanOrEqual(MAX_WRITES_POR_COMMIT);
    }

    const turnosMesGravados = estado.operacoes.filter((operacao) =>
      operacao.colecao === 'turnosMes' && operacao.tipo === 'set');
    const versoesGravadas = estado.operacoes.filter((operacao) =>
      operacao.colecao === 'versoesEscala' && operacao.tipo === 'set');
    expect(turnosMesGravados).toHaveLength(logins.length);
    expect(versoesGravadas).toHaveLength(logins.length);
    expect(turnosMesGravados.map((operacao) => operacao.dados?.login).sort()).toEqual([...logins].sort());

    const publicacoesEscalaGravadas = estado.operacoes.filter((operacao) =>
      operacao.colecao === 'publicacoesEscala' && operacao.tipo === 'set');
    const historicoGravado = estado.operacoes.filter((operacao) =>
      operacao.colecao === 'historicoPublicacoes' && operacao.tipo === 'set');
    expect(publicacoesEscalaGravadas).toHaveLength(1);
    expect(historicoGravado).toHaveLength(1);
    // O estado/histórico da publicação só pode existir no primeiro commit.
    expect(publicacoesEscalaGravadas[0]?.lote).toBe(0);
    expect(historicoGravado[0]?.lote).toBe(0);
  });

  /**
   * DIAGNOSTICO-PUBLICAR-ESCALAS-FASE-1 — regressão do diagnóstico de
   * commits: múltiplos lotes do commit principal continuam sendo
   * executados em sequência quando nenhum falha (o instrumento não altera
   * o fluxo funcional já coberto pelo teste de divisão em lotes acima).
   */
  it('executa todos os lotes do commit principal quando nenhum falha', async () => {
    const logins = Array.from({ length: 7 }, (_, indice) => `colab-${indice + 1}`);
    const documentos = logins.map((login) => documento(login));

    await publicarEscalas(documentos, 'gestora-uid');

    expect(estado.commits).toHaveLength(3);
  });

  /**
   * DIAGNOSTICO-PUBLICAR-ESCALAS-FASE-1 — uma falha em qualquer commit
   * intermediário deve propagar o erro original (`code`/`message`
   * preservados) e nunca ser convertido/engolido pelo instrumento de
   * diagnóstico.
   */
  it('propaga o erro original quando um commit intermediário falha', async () => {
    const logins = Array.from({ length: 7 }, (_, indice) => `colab-${indice + 1}`);
    const documentos = logins.map((login) => documento(login));
    estado.falharNoCommit = 1;

    await expect(publicarEscalas(documentos, 'gestora-uid')).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'permission-denied (mock)',
    });
  });

  /**
   * DIAGNOSTICO-PUBLICAR-ESCALAS-FASE-1 — quando o commit principal falha,
   * as fases posteriores (exclusão de turnos obsoletos e limpeza de
   * rascunhos) não devem ser executadas: o `for` que fatia e comita cada
   * fase é sequencial, dentro do mesmo `try`, então uma falha já interrompe
   * o restante da função.
   */
  it('não executa fases posteriores quando o commit principal falha', async () => {
    const logins = Array.from({ length: 7 }, (_, indice) => `colab-${indice + 1}`);
    const documentos = logins.map((login) => documento(login));
    estado.rascunhos = logins.map((login) => ({
      id: idDocumento(EQUIPE, login, COMPETENCIA),
      data: { equipeId: EQUIPE, competencia: COMPETENCIA, usuarioUid: login },
    }));
    estado.falharNoCommit = 0;

    await expect(publicarEscalas(documentos, 'gestora-uid')).rejects.toThrow();

    expect(estado.commits).toHaveLength(0);
    const deletesDeRascunho = estado.operacoes.filter((operacao) =>
      operacao.colecao === 'rascunhosTurnosMes' && operacao.tipo === 'delete');
    expect(deletesDeRascunho).toHaveLength(0);
  });

  /**
   * DIAGNOSTICO-PUBLICAR-ESCALAS-FASE-1 — o console precisa preservar
   * `code`/`message` do erro original do Firestore, mesmo que o catch
   * externo converta a mensagem para a UI.
   */
  it('registra code e message originais no console ao falhar um commit', async () => {
    const erroSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    estado.falharNoCommit = 0;

    await expect(publicarEscalas([documento('colab-1')], 'gestora-uid')).rejects.toThrow();

    const chamadaDeCommitFalhou = erroSpy.mock.calls.find(([mensagem]) =>
      mensagem === '[publicarEscalas] commit-falhou');
    expect(chamadaDeCommitFalhou?.[1]).toMatchObject({
      fase: 'publicacao-lote-principal',
      code: 'permission-denied',
      message: 'permission-denied (mock)',
    });

    erroSpy.mockRestore();
  });

  it('continua apagando todos os rascunhos da competência ao publicar vários colaboradores', async () => {
    const logins = Array.from({ length: 5 }, (_, indice) => `colab-${indice + 1}`);
    const documentos = logins.map((login) => documento(login));
    estado.rascunhos = [
      ...logins.map((login) => ({
        id: idDocumento(EQUIPE, login, COMPETENCIA),
        data: { equipeId: EQUIPE, competencia: COMPETENCIA, usuarioUid: login },
      })),
      {
        id: idDocumento(EQUIPE, 'colab-orfao', COMPETENCIA),
        data: { equipeId: EQUIPE, competencia: COMPETENCIA, usuarioUid: 'colab-orfao' },
      },
    ];

    await publicarEscalas(documentos, 'gestora-uid');

    const idsDeletados = estado.operacoes
      .filter((operacao) => operacao.colecao === 'rascunhosTurnosMes' && operacao.tipo === 'delete')
      .map((operacao) => operacao.id);
    expect(idsDeletados.sort()).toEqual(estado.rascunhos.map((rascunho) => rascunho.id).sort());
  });

  it('usa o login — não o usuarioUid legado — para montar o ID do documento publicado', async () => {
    const idPorLogin = idDocumento(EQUIPE, 'lvergani', COMPETENCIA);
    const idPorUidAntigo = idDocumento(EQUIPE, 'usuario-provisorio-antigo', COMPETENCIA);

    await publicarEscalas([documento('lvergani', 'usuario-provisorio-antigo')], 'gestora-login');

    const turnosMesCriado = estado.operacoes.find((operacao) =>
      operacao.colecao === 'turnosMes' && operacao.tipo === 'set');
    expect(turnosMesCriado?.id).toBe(idPorLogin);
    expect(turnosMesCriado?.id).not.toBe(idPorUidAntigo);
    expect(turnosMesCriado?.dados?.login).toBe('lvergani');
  });
});

const GESTORA: Usuario = {
  login: 'gestora',
  uid: 'gestora-uid',
  nome: 'Gestora',
  email: 'gestora@empresa.com',
  cargo: 'SUPERVISOR_EQUIPE',
  equipeId: EQUIPE,
  gestorUid: null,
  nivelHierarquico: 3,
  turnoPadrao: 'M',
  ativo: true,
};

function erro(severidade: ErroImportacao['severidade']): ErroImportacao {
  return {
    linha: 2,
    coluna: 'D',
    login: 'colab-1',
    valorEncontrado: '7',
    motivo: severidade === 'ALERTA' ? 'Sequência de trabalho fora do padrão 1-6.' : 'Turno não reconhecido.',
    severidade,
  };
}

function resultadoParse(erros: ErroImportacao[]): ResultadoParse {
  return {
    ok: erros.length === 0,
    equipeNome: 'COSI SOC',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    totalDias: 31,
    documentos: [documento('colab-1')],
    erros,
    avisos: [],
  };
}

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — regressão do hotfix:
 * `salvarRascunho()` bloqueava por `!resultado.ok` (== `erros.length > 0`),
 * o que impedia salvar um rascunho com só ALERTA (nunca deveria travar,
 * só um erro BLOQUEANTE de verdade deveria). Ver `temErroBloqueante()` em
 * `packages/contrato/src/tipos.ts`.
 */
describe('salvarRascunho', () => {
  it('persiste normalmente quando só existe ALERTA (nenhum BLOQUEANTE)', async () => {
    const resultado = resultadoParse([erro('ALERTA')]);

    await expect(salvarRascunho(resultado, GESTORA, 'Escala.xls')).resolves.toEqual(expect.any(String));

    const gravado = estado.operacoes.find((operacao) => operacao.colecao === 'rascunhosTurnosMes');
    expect(gravado).toBeDefined();
  });

  it('continua recusando persistir quando existe erro BLOQUEANTE', async () => {
    const resultado = resultadoParse([erro('BLOQUEANTE')]);

    await expect(salvarRascunho(resultado, GESTORA, 'Escala.xls'))
      .rejects.toThrow('Não é permitido persistir uma importação com erros bloqueantes.');

    const gravado = estado.operacoes.find((operacao) => operacao.colecao === 'rascunhosTurnosMes');
    expect(gravado).toBeUndefined();
  });
});

describe('salvarUsuario', () => {
  it('grava o documento em usuarios/{login}, não em usuarios/{uid}', async () => {
    const usuario: Usuario = {
      login: 'lvergani',
      uid: 'cIOiUrnLAAbTap8uIPb4KQ6Ny7D3',
      nome: 'lvergani',
      email: 'lvergani@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: EQUIPE,
      gestorUid: null,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    };

    await salvarUsuario(usuario);

    const gravado = estado.operacoes.find((operacao) => operacao.colecao === 'usuarios');
    expect(gravado?.id).toBe('lvergani');
    expect(gravado?.id).not.toBe(usuario.uid);
  });
});
