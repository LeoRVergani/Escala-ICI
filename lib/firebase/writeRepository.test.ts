import type { TurnosMes } from '@escala-ici/contrato';
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
  operacoes: [] as Array<{ tipo: 'set' | 'delete' | 'update'; colecao: string; id: string; dados?: Record<string, unknown> }>,
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
    estado.operacoes.push({ tipo: 'set', colecao: ref.__colecao, id: ref.__id, dados });
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
  writeBatch: () => ({
    set: (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
      estado.operacoes.push({ tipo: 'set', colecao: ref.__colecao, id: ref.__id, dados });
    },
    delete: (ref: { __colecao: string; __id: string }) => {
      estado.operacoes.push({ tipo: 'delete', colecao: ref.__colecao, id: ref.__id });
    },
    update: (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
      estado.operacoes.push({ tipo: 'update', colecao: ref.__colecao, id: ref.__id, dados });
    },
    commit: async () => {},
  }),
}));

const { publicarEscalas, salvarUsuario } = await import('./writeRepository');

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
