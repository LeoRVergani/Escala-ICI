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
  usuarios: [] as Array<{ id: string; data: Record<string, unknown> }>,
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
  lerUsuario: (id: string, dados: Record<string, unknown>) => ({ ...dados, login: dados.login ?? id }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nome: string) => ({ __colecao: nome }),
  where: (campo: string, operador: string, valor: unknown) => ({ campo, operador, valor }),
  query: (colecaoRef: { __colecao: string }, ...condicoes: Array<{ campo: string; operador: string; valor: unknown }>) => ({
    __colecao: colecaoRef.__colecao,
    condicoes,
  }),
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async (ref: { __colecao: string; condicoes: Array<{ campo: string; operador: string; valor: unknown }> }) => {
    const fonte = ref.__colecao === 'turnosMes'
      ? estado.turnosMes
      : ref.__colecao === 'usuarios' ? estado.usuarios : [];
    const obterCampo = (dados: Record<string, unknown>, caminho: string): unknown =>
      caminho.split('.').reduce<unknown>((atual, parte) =>
        atual !== null && typeof atual === 'object'
          ? (atual as Record<string, unknown>)[parte]
          : undefined, dados);
    // `array-contains` precisa de semântica própria — as demais condições
    // (equality) continuam comparando por `===`, como antes.
    const combina = (item: { data: Record<string, unknown> }, condicao: { campo: string; operador: string; valor: unknown }): boolean => {
      const campoValor = obterCampo(item.data, condicao.campo);
      if (condicao.operador === 'array-contains') {
        return Array.isArray(campoValor) && campoValor.includes(condicao.valor);
      }
      return campoValor === condicao.valor;
    };
    const filtrados = fonte.filter((item) => ref.condicoes.every((condicao) => combina(item, condicao)));
    return { docs: filtrados.map((item) => ({ id: item.id, data: () => item.data })) };
  },
  onSnapshot: () => () => {},
}));

const { carregarMinhaEscala, listarUsuariosDoPlantao, listarUsuariosElegiveisPlantao } = await import('./readRepository');

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
  estado.usuarios = [];
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

describe('listarUsuariosDoPlantao', () => {
  it('restringe simultaneamente por equipe e pelo contexto do Grupo de Plantão', async () => {
    estado.usuarios = [
      { id: 'carofreitas', data: { login: 'carofreitas', equipeId: 'EQ_PLANTAO', cadastroOperacional: { tipo: 'PLANTAO', alvoId: 'GRUPO_A' } } },
      { id: 'outro-grupo', data: { login: 'outro-grupo', equipeId: 'EQ_PLANTAO', cadastroOperacional: { tipo: 'PLANTAO', alvoId: 'GRUPO_B' } } },
      { id: 'jornada', data: { login: 'jornada', equipeId: 'EQ_PLANTAO', cadastroOperacional: { tipo: 'JORNADA', alvoId: 'EQ_PLANTAO' } } },
    ];

    const usuarios = await listarUsuariosDoPlantao('EQ_PLANTAO', 'GRUPO_A');

    expect(usuarios.map((usuario) => usuario.login)).toEqual(['carofreitas']);
  });
});

/**
 * PATCH-PLANTAO-VINCULO-GESTOR-COMO-PARTICIPANTE-1 — perfil de acesso ao
 * sistema (GESTOR_UNIDADE, GESTOR_EQUIPE, etc.) não é a mesma coisa que
 * participação em escala. `listarUsuariosDoPlantao()` acima só encontra
 * quem foi cadastrado ESPECIFICAMENTE através deste Grupo
 * (`cadastroOperacional`); esta função cobre o alcance real do Plantão —
 * membro direto da equipe responsável/das equipes em `equipesConsulta`
 * (por `equipeId`), ou quem administra a unidade responsável (por
 * `unidadeId`) — nunca filtra por perfil.
 *
 * IMPORTANTE: `unidadesPermitidas`/`equipesPermitidas` (array-contains)
 * foram cogitados na primeira versão desta função, mas um teste em
 * `tests/firebase/firestore.rules.test.ts` provou que uma consulta `list`
 * nesses campos falha ("Null value error") para qualquer ator não-admin —
 * mesmo quando o único documento retornado seria o do próprio autor. Só
 * `equipeId`/`unidadeId` (os mesmos campos que as Rules de leitura usam
 * para autorizar) são "prováveis" como `list`. Este mock não reproduz essa
 * limitação (não sabe nada de Rules) — por isso os cenários abaixo usam
 * SEMPRE `equipeId`/`unidadeId` reais para provar a cobertura, nunca as
 * listas de permissão.
 */
describe('listarUsuariosElegiveisPlantao', () => {
  it('inclui um GESTOR_UNIDADE cuja própria equipe é uma das equipesConsulta do grupo (equipeId), mesmo fora da equipe responsável', async () => {
    estado.usuarios = [
      { id: 'carofreitas', data: { login: 'carofreitas', nome: 'Caroline Ribeiro de Freitas', equipeId: 'GEDSI_COSI_PLANTAO', ativo: true } },
      {
        id: 'clis',
        data: {
          login: 'clis',
          nome: 'Claudio Lis',
          equipeId: 'GEDSI_COSI_SOC',
          perfil: 'GESTOR_UNIDADE',
          escopo: 'UNIDADE',
          unidadeId: 'GEDSI_COSI',
          unidadesPermitidas: ['GEDSI_COSI'],
          ativo: true,
        },
      },
      { id: 'estranho', data: { login: 'estranho', nome: 'Fulano de Outra Equipe', equipeId: 'OUTRA_EQUIPE', ativo: true } },
    ];

    const usuarios = await listarUsuariosElegiveisPlantao(
      'GEDSI_COSI_PLANTAO',
      'PLANTAO_GEDSI_COSI',
      'GEDSI_COSI',
      ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
    );

    const logins = usuarios.map((usuario) => usuario.login).sort();
    expect(logins).toContain('clis');
    expect(logins).toContain('carofreitas');
    expect(logins).not.toContain('estranho');
  });

  it('inclui um GESTOR_UNIDADE só por unidadeId, mesmo quando a própria equipe NÃO é a responsável nem consta em equipesConsulta', async () => {
    estado.usuarios = [
      {
        id: 'gestor.outra.equipe',
        data: {
          login: 'gestor.outra.equipe',
          nome: 'Gestor de Outra Equipe da Mesma Unidade',
          equipeId: 'GEDSI_COSI_OUTRA_EQUIPE',
          perfil: 'GESTOR_UNIDADE',
          escopo: 'UNIDADE',
          unidadeId: 'GEDSI_COSI',
          unidadesPermitidas: ['GEDSI_COSI'],
          ativo: true,
        },
      },
    ];

    const usuarios = await listarUsuariosElegiveisPlantao(
      'GEDSI_COSI_PLANTAO',
      'PLANTAO_GEDSI_COSI',
      'GEDSI_COSI',
      ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
    );

    expect(usuarios.map((usuario) => usuario.login)).toContain('gestor.outra.equipe');
  });

  it('nunca duplica um usuário que corresponde a mais de uma das consultas (equipeId E unidadeId)', async () => {
    estado.usuarios = [
      {
        id: 'clis',
        data: {
          login: 'clis',
          nome: 'Claudio Lis',
          equipeId: 'GEDSI_COSI_SOC',
          unidadeId: 'GEDSI_COSI',
          ativo: true,
        },
      },
    ];

    const usuarios = await listarUsuariosElegiveisPlantao(
      'GEDSI_COSI_PLANTAO',
      'PLANTAO_GEDSI_COSI',
      'GEDSI_COSI',
      ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
    );

    expect(usuarios).toHaveLength(1);
    expect(usuarios[0]?.login).toBe('clis');
  });

  it('não exclui ninguém por perfil/escopo — ADMIN_SISTEMA, GESTOR_UNIDADE e colaborador sem perfil aparecem igualmente quando o equipeId bate', async () => {
    estado.usuarios = [
      { id: 'admin.no.time', data: { login: 'admin.no.time', nome: 'Admin no time', perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL', equipeId: 'GEDSI_COSI_SOC', ativo: true } },
      { id: 'clis', data: { login: 'clis', nome: 'Claudio Lis', perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE', equipeId: 'GEDSI_COSI_SOC', unidadeId: 'GEDSI_COSI', ativo: true } },
      { id: 'colaborador.comum', data: { login: 'colaborador.comum', nome: 'Colaborador Comum', equipeId: 'GEDSI_COSI_SOC', ativo: true } },
    ];

    const usuarios = await listarUsuariosElegiveisPlantao(
      'GEDSI_COSI_PLANTAO',
      'PLANTAO_GEDSI_COSI',
      'GEDSI_COSI',
      ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
    );

    const logins = usuarios.map((usuario) => usuario.login).sort();
    expect(logins).toEqual(['admin.no.time', 'clis', 'colaborador.comum']);
  });
});
