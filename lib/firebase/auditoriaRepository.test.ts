import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Usuario } from '../modelos';

const estado = vi.hoisted(() => ({
  escritaHabilitada: true,
  operacoes: [] as Array<{ colecao: string; id: string; dados: Record<string, unknown> }>,
}));

vi.mock('./shared', () => ({
  exigirEscritaAdministrativaHabilitada: () => {
    if (!estado.escritaHabilitada) {
      throw new Error('A escrita está bloqueada.');
    }
  },
  exigirFirebase: () => ({ db: {} }),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  setDoc: async (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
    estado.operacoes.push({ colecao: ref.__colecao, id: ref.__id, dados });
  },
}));

const { registrarAuditoriaAdmin } = await import('./auditoriaRepository');

function usuario(sobrescritas: Partial<Usuario>): Usuario {
  return {
    login: 'fulano',
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    cargo: 'ANALISTA_SOC',
    equipeId: 'EQ_SOC',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...sobrescritas,
  };
}

beforeEach(() => {
  estado.escritaHabilitada = true;
  estado.operacoes.length = 0;
});

describe('registrarAuditoriaAdmin', () => {
  it('grava os 8 campos sem trocar ator real e ator simulado', async () => {
    const atorReal = usuario({ login: 'admin', nome: 'Admin Sistema', perfil: 'ADMIN_SISTEMA' });
    const atorSimulado = usuario({ login: 'marina.azevedo', nome: 'Marina Azevedo', perfil: 'GESTOR_EQUIPE' });

    await registrarAuditoriaAdmin({
      atorReal,
      atorSimulado,
      equipeId: 'EQ_SOC',
      acao: 'PUBLICAR_ESCALA',
    });

    expect(estado.operacoes).toHaveLength(1);
    const [operacao] = estado.operacoes;
    expect(operacao?.colecao).toBe('auditoriaAdmin');
    expect(operacao?.dados).toMatchObject({
      atorRealLogin: 'admin',
      atorRealNome: 'Admin Sistema',
      atorRealPerfil: 'ADMIN_SISTEMA',
      atorSimuladoLogin: 'marina.azevedo',
      atorSimuladoNome: 'Marina Azevedo',
      atorSimuladoPerfil: 'GESTOR_EQUIPE',
      equipeId: 'EQ_SOC',
      acao: 'PUBLICAR_ESCALA',
    });
    expect(typeof operacao?.dados.em).toBe('string');
  });

  it('JORNADA-IMPORTACAO-VINCULOS-UX-1 — campos de contexto de importação ficam null quando omitidos', async () => {
    await registrarAuditoriaAdmin({
      atorReal: usuario({ login: 'admin', perfil: 'ADMIN_SISTEMA' }),
      atorSimulado: null,
      equipeId: 'EQ_SOC',
      acao: 'PUBLICAR_ESCALA',
    });

    const [operacao] = estado.operacoes;
    expect(operacao?.dados).toMatchObject({
      unidadeId: null,
      competencia: null,
      nomeImportado: null,
      usuarioVinculadoLogin: null,
      origem: null,
    });
  });

  it('JORNADA-IMPORTACAO-VINCULOS-UX-1 — grava o contexto de importação quando informado', async () => {
    await registrarAuditoriaAdmin({
      atorReal: usuario({ login: 'clis', perfil: 'GESTOR_UNIDADE' }),
      atorSimulado: null,
      equipeId: 'GEDSI_COSI_SOC',
      acao: 'ASSOCIAR_USUARIO_IMPORTACAO',
      unidadeId: 'GEDSI_COSI',
      competencia: '2026-08',
      nomeImportado: 'a.lima',
      usuarioVinculadoLogin: 'aleilima',
      origem: 'IMPORTACAO_JORNADA',
    });

    const [operacao] = estado.operacoes;
    expect(operacao?.dados).toMatchObject({
      equipeId: 'GEDSI_COSI_SOC',
      unidadeId: 'GEDSI_COSI',
      competencia: '2026-08',
      nomeImportado: 'a.lima',
      usuarioVinculadoLogin: 'aleilima',
      origem: 'IMPORTACAO_JORNADA',
    });
  });

  it('STAGING-RESET-HIERARQUIA-ICI-1 — atorSimulado null grava os campos de ator simulado como null (ação direta, sem simulação)', async () => {
    const atorReal = usuario({ login: 'sabrina.supervisora', nome: 'Sabrina Supervisora', perfil: 'SUPERVISOR_EQUIPE' });

    await registrarAuditoriaAdmin({
      atorReal,
      atorSimulado: null,
      equipeId: 'EQ_SOC',
      acao: 'CADASTRAR_USUARIOS',
    });

    expect(estado.operacoes).toHaveLength(1);
    const [operacao] = estado.operacoes;
    expect(operacao?.dados).toMatchObject({
      atorRealLogin: 'sabrina.supervisora',
      atorRealPerfil: 'SUPERVISOR_EQUIPE',
      atorSimuladoLogin: null,
      atorSimuladoNome: null,
      atorSimuladoPerfil: null,
      equipeId: 'EQ_SOC',
      acao: 'CADASTRAR_USUARIOS',
    });
  });

  it('recusa escrever quando a escrita administrativa está bloqueada', async () => {
    estado.escritaHabilitada = false;
    await expect(registrarAuditoriaAdmin({
      atorReal: usuario({ login: 'admin', perfil: 'ADMIN_SISTEMA' }),
      atorSimulado: usuario({ login: 'marina.azevedo', perfil: 'GESTOR_EQUIPE' }),
      equipeId: 'EQ_SOC',
      acao: 'PUBLICAR_ESCALA',
    })).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });
});
