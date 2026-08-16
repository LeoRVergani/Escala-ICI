import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  gruposPlantao: [] as Array<{ id: string; data: Record<string, unknown> }>,
  participantes: {} as Record<string, Array<{ id: string; data: Record<string, unknown> }>>,
  rascunhosCompetencias: [] as Array<{ id: string; data: Record<string, unknown> }>,
  atribuicoes: {} as Record<string, Array<{ id: string; data: Record<string, unknown> }>>,
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segmentos: string[]) => ({ __caminho: segmentos.join('/') }),
  where: (campo: string, operador: string, valor: unknown) => ({ campo, operador, valor }),
  query: (colecaoRef: { __caminho: string }, ...condicoes: Array<{ campo: string; operador: string; valor: unknown }>) => ({
    __caminho: colecaoRef.__caminho,
    condicoes,
  }),
  doc: (_db: unknown, ...segmentos: string[]) => ({ __caminho: segmentos.join('/') }),
  getDoc: async (ref: { __caminho: string }) => {
    const [colecao] = ref.__caminho.split('/');
    const fonte = colecao === 'gruposPlantao' ? estado.gruposPlantao : estado.rascunhosCompetencias;
    const encontrado = fonte.find((item) => ref.__caminho.endsWith(`/${item.id}`) || ref.__caminho === `${colecao}/${item.id}`);
    return {
      exists: () => encontrado !== undefined,
      data: () => encontrado?.data,
    };
  },
  getDocs: async (ref: { __caminho: string; condicoes?: Array<{ campo: string; operador: string; valor: unknown }> }) => {
    const partes = ref.__caminho.split('/');
    let fonte: Array<{ id: string; data: Record<string, unknown> }> = [];
    if (partes[0] === 'gruposPlantao' && partes.length === 1) {
      fonte = estado.gruposPlantao;
    } else if (partes[0] === 'gruposPlantao' && partes[2] === 'participantes') {
      fonte = estado.participantes[partes[1] as string] ?? [];
    } else if (partes[0] === 'rascunhosCompetenciasPlantao' && partes[2] === 'atribuicoes') {
      fonte = estado.atribuicoes[partes[1] as string] ?? [];
    }
    const condicoes = ref.condicoes ?? [];
    const filtrados = fonte.filter((item) => condicoes.every((condicao) => {
      const valorCampo = item.data[condicao.campo];
      if (condicao.operador === 'array-contains') {
        return Array.isArray(valorCampo) && valorCampo.includes(condicao.valor);
      }
      return valorCampo === condicao.valor;
    }));
    return { docs: filtrados.map((item) => ({ id: item.id, data: () => item.data })) };
  },
}));

const {
  listarAtribuicoesPlantaoRascunho,
  listarGruposPlantaoPermitidos,
  listarParticipantesPlantao,
  obterCompetenciaPlantaoRascunho,
  obterGrupoPlantao,
} = await import('./plantaoReadRepository');

function grupo(overrides: Record<string, unknown>) {
  return {
    grupoId: 'PLANTAO_SEGURANCA',
    nome: 'Plantão de Segurança',
    equipeResponsavelId: 'EQ_COSI',
    equipesConsulta: ['EQ_COSI'],
    timezone: 'America/Sao_Paulo',
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: 'gestor',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  estado.gruposPlantao = [];
  estado.participantes = {};
  estado.rascunhosCompetencias = [];
  estado.atribuicoes = {};
});

describe('obterGrupoPlantao', () => {
  it('lê o Grupo quando existe', async () => {
    estado.gruposPlantao = [{ id: 'PLANTAO_SEGURANCA', data: grupo({}) }];
    const resultado = await obterGrupoPlantao('PLANTAO_SEGURANCA');
    expect(resultado?.nome).toBe('Plantão de Segurança');
  });

  it('retorna null quando o Grupo não existe', async () => {
    const resultado = await obterGrupoPlantao('inexistente');
    expect(resultado).toBeNull();
  });
});

describe('listarGruposPlantaoPermitidos', () => {
  it('retorna só os grupos cuja equipesConsulta inclui a equipe informada', async () => {
    estado.gruposPlantao = [
      { id: 'PLANTAO_SEGURANCA', data: grupo({ equipesConsulta: ['EQ_COSI', 'EQ_SOC'] }) },
      { id: 'PLANTAO_REDES', data: grupo({ grupoId: 'PLANTAO_REDES', equipesConsulta: ['EQ_REDES'] }) },
    ];
    const resultado = await listarGruposPlantaoPermitidos('EQ_SOC');
    expect(resultado.map((g) => g.grupoId)).toEqual(['PLANTAO_SEGURANCA']);
  });
});

describe('listarParticipantesPlantao', () => {
  it('lista os participantes do grupo informado, sem misturar com outro grupo', async () => {
    estado.participantes = {
      PLANTAO_SEGURANCA: [
        { id: 'acosta', data: { grupoId: 'PLANTAO_SEGURANCA', login: 'acosta', ativo: true, contatos: [] } },
      ],
      PLANTAO_REDES: [
        { id: 'blima', data: { grupoId: 'PLANTAO_REDES', login: 'blima', ativo: true, contatos: [] } },
      ],
    };
    const resultado = await listarParticipantesPlantao('PLANTAO_SEGURANCA');
    expect(resultado.map((p) => p.login)).toEqual(['acosta']);
  });
});

describe('obterCompetenciaPlantaoRascunho / listarAtribuicoesPlantaoRascunho', () => {
  it('resolve o ID determinístico grupoId_competencia e lê o rascunho', async () => {
    estado.rascunhosCompetencias = [
      { id: 'PLANTAO_SEGURANCA_2026-08', data: { id: 'PLANTAO_SEGURANCA_2026-08', grupoId: 'PLANTAO_SEGURANCA', status: 'RASCUNHO' } },
    ];
    const resultado = await obterCompetenciaPlantaoRascunho('PLANTAO_SEGURANCA', '2026-08');
    expect(resultado?.status).toBe('RASCUNHO');
  });

  it('lista as atribuições da competência correta', async () => {
    estado.atribuicoes = {
      'PLANTAO_SEGURANCA_2026-08': [
        { id: '0001', data: { atribuicaoId: '0001', plantonistaLogin: 'acosta' } },
      ],
    };
    const resultado = await listarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', '2026-08');
    expect(resultado.map((a) => a.atribuicaoId)).toEqual(['0001']);
  });
});
