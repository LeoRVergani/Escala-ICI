import type { TurnosMes } from '@escala-ici/contrato';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão: a escala publicada de alguém pode ficar gravada com um
 * `usuarioUid` antigo/provisório (de antes do vínculo real com o Firebase
 * Authentication), enquanto o `login` corporativo é estável e único na
 * empresa. `carregarMinhaEscala()` precisa buscar por `login`, não por
 * `usuarioUid` — este mock trava a condição exata usada na query.
 */
const estado = vi.hoisted(() => ({
  turnosMes: [] as Array<{ id: string; data: Record<string, unknown> }>,
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nome: string) => ({ __colecao: nome }),
  where: (campo: string, _operador: string, valor: unknown) => ({ campo, valor }),
  query: (colecaoRef: { __colecao: string }, ...condicoes: Array<{ campo: string; valor: unknown }>) => ({
    __colecao: colecaoRef.__colecao,
    condicoes,
  }),
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async (ref: { __colecao: string; condicoes: Array<{ campo: string; valor: unknown }> }) => {
    const fonte = ref.__colecao === 'turnosMes' ? estado.turnosMes : [];
    const filtrados = fonte.filter((item) =>
      ref.condicoes.every((condicao) => item.data[condicao.campo] === condicao.valor));
    return { docs: filtrados.map((item) => ({ data: () => item.data })) };
  },
  onSnapshot: () => () => {},
}));

const { carregarMinhaEscala } = await import('./readRepository');

const EQUIPE = 'EQ_SOC';
const COMPETENCIA = '2026-08';

function escalaPublicada(overrides: Partial<Record<string, unknown>>): { id: string; data: Record<string, unknown> } {
  return {
    id: `${overrides.login}`,
    data: {
      equipeId: EQUIPE,
      competencia: COMPETENCIA,
      status: 'PUBLICADA',
      ...overrides,
    },
  };
}

beforeEach(() => {
  estado.turnosMes = [];
});

describe('carregarMinhaEscala', () => {
  it('busca pelo login corporativo, não pelo usuarioUid', async () => {
    estado.turnosMes = [
      escalaPublicada({ login: 'lvergani', usuarioUid: 'usuario-antigo-provisorio' }),
    ];

    const escala = await carregarMinhaEscala('lvergani', EQUIPE, COMPETENCIA) as TurnosMes | null;

    expect(escala).not.toBeNull();
    expect(escala?.login).toBe('lvergani');
  });

  it('encontra a escala do lvergani mesmo com usuarioUid diferente do UID real do Auth', async () => {
    estado.turnosMes = [
      escalaPublicada({
        login: 'lvergani',
        usuarioUid: 'usuario-7e1869fc-2818-442d-95dd-d731b23bd0da',
      }),
    ];

    const escala = await carregarMinhaEscala('lvergani', EQUIPE, COMPETENCIA);
    expect(escala).not.toBeNull();
  });

  it('não exige usuarioUid == auth.uid para encontrar a escala', async () => {
    estado.turnosMes = [
      escalaPublicada({ login: 'lvergani', usuarioUid: 'qualquer-uid-diferente-do-real' }),
    ];

    const escala = await carregarMinhaEscala('lvergani', EQUIPE, COMPETENCIA);
    expect(escala).not.toBeNull();
    expect(escala?.usuarioUid).not.toBe('cIOiUrnLAAbTap8uIPb4KQ6Ny7D3');
  });

  it('não retorna a escala de outro colaborador da mesma equipe', async () => {
    estado.turnosMes = [
      escalaPublicada({ login: 'outro.colaborador', usuarioUid: 'uid-outro' }),
    ];

    const escala = await carregarMinhaEscala('lvergani', EQUIPE, COMPETENCIA);
    expect(escala).toBeNull();
  });

  it('não retorna escala de outra equipe mesmo com o mesmo login', async () => {
    estado.turnosMes = [
      escalaPublicada({ login: 'lvergani', usuarioUid: 'uid-x', equipeId: 'EQ_OUTRA' }),
    ];

    const escala = await carregarMinhaEscala('lvergani', EQUIPE, COMPETENCIA);
    expect(escala).toBeNull();
  });

  it('não retorna rascunho como escala publicada', async () => {
    estado.turnosMes = [
      { id: 'r1', data: { equipeId: EQUIPE, competencia: COMPETENCIA, login: 'lvergani', status: 'RASCUNHO' } },
    ];

    const escala = await carregarMinhaEscala('lvergani', EQUIPE, COMPETENCIA);
    expect(escala).toBeNull();
  });
});
