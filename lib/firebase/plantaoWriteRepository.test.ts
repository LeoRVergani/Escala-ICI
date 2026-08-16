import type {
  AtribuicaoPlantaoPersistida,
  CompetenciaPlantao,
  GrupoPlantao,
  ParticipantePlantao,
} from '@escala-ici/contrato';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  escritaHabilitada: true,
  operacoes: [] as Array<{ tipo: 'set' | 'update'; colecao: string; id: string; dados: Record<string, unknown> }>,
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
  doc: (_db: unknown, ...segmentos: string[]) => ({ __colecao: segmentos.at(-2), __id: segmentos.at(-1) }),
  setDoc: async (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
    estado.operacoes.push({ tipo: 'set', colecao: ref.__colecao, id: ref.__id, dados });
  },
  updateDoc: async (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
    estado.operacoes.push({ tipo: 'update', colecao: ref.__colecao, id: ref.__id, dados });
  },
  writeBatch: () => ({
    set: (ref: { __colecao: string; __id: string }, dados: Record<string, unknown>) => {
      estado.operacoes.push({ tipo: 'set', colecao: ref.__colecao, id: ref.__id, dados });
    },
    commit: async () => {},
  }),
}));

const {
  desativarParticipantePlantao,
  salvarAtribuicoesPlantaoRascunho,
  salvarCompetenciaPlantaoRascunho,
  salvarGrupoPlantao,
  salvarParticipantePlantao,
} = await import('./plantaoWriteRepository');

function grupoValido(overrides: Partial<GrupoPlantao> = {}): GrupoPlantao {
  return {
    grupoId: 'PLANTAO_SEGURANCA',
    nome: 'Plantão de Segurança',
    equipeResponsavelId: 'EQ_COSI',
    equipesConsulta: ['EQ_COSI', 'EQ_SOC'],
    timezone: 'America/Sao_Paulo',
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: 'marina.azevedo',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function participanteValido(overrides: Partial<ParticipantePlantao> = {}): ParticipantePlantao {
  return {
    grupoId: 'PLANTAO_SEGURANCA',
    login: 'acosta',
    ativo: true,
    contatos: [],
    schemaVersion: 1,
    criadoPorLogin: 'marina.azevedo',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function competenciaValida(overrides: Partial<CompetenciaPlantao> = {}): CompetenciaPlantao {
  return {
    id: 'PLANTAO_SEGURANCA_2026-08',
    grupoId: 'PLANTAO_SEGURANCA',
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    status: 'RASCUNHO',
    revisao: 0,
    origem: 'IMPORTADO',
    totaisInformadosOrigem: null,
    totalBruto: { quantidade: 32, minutos: 30_240 },
    schemaVersion: 1,
    criadoPorLogin: 'marina.azevedo',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function atribuicaoValida(overrides: Partial<AtribuicaoPlantaoPersistida> = {}): AtribuicaoPlantaoPersistida {
  return {
    atribuicaoId: '0001',
    grupoId: 'PLANTAO_SEGURANCA',
    competenciaId: 'PLANTAO_SEGURANCA_2026-08',
    plantonistaLogin: 'acosta',
    inicio: '2026-07-25T22:00:00.000Z',
    fim: '2026-07-26T10:00:00.000Z',
    duracaoMinutos: 720,
    papel: 'PRIMARIO',
    origem: 'IMPORTADO',
    revisao: 0,
    schemaVersion: 1,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  estado.escritaHabilitada = true;
  estado.operacoes.length = 0;
});

describe('salvarGrupoPlantao', () => {
  it('cria um Grupo válido', async () => {
    await salvarGrupoPlantao(grupoValido());
    expect(estado.operacoes).toHaveLength(1);
    expect(estado.operacoes[0]?.colecao).toBe('gruposPlantao');
    expect(estado.operacoes[0]?.id).toBe('PLANTAO_SEGURANCA');
  });

  it('rejeita domínio inválido antes de enviar ao Firestore (nunca chama setDoc)', async () => {
    await expect(salvarGrupoPlantao(grupoValido({ nome: '' }))).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('nunca envia campos undefined ao Firestore (24 — schema não aceita undefined)', async () => {
    await salvarGrupoPlantao(grupoValido({ descricao: undefined }));
    const [operacao] = estado.operacoes;
    expect(operacao?.dados).not.toHaveProperty('descricao');
    expect(JSON.stringify(operacao?.dados)).not.toContain('undefined');
  });

  it('recusa escrever quando a escrita administrativa está bloqueada', async () => {
    estado.escritaHabilitada = false;
    await expect(salvarGrupoPlantao(grupoValido())).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });
});

describe('salvarParticipantePlantao', () => {
  it('cria um participante válido', async () => {
    await salvarParticipantePlantao(participanteValido());
    expect(estado.operacoes).toHaveLength(1);
    expect(estado.operacoes[0]?.id).toBe('acosta');
  });

  it('atualiza contatos (até 3) num participante existente', async () => {
    await salvarParticipantePlantao(participanteValido({
      contatos: [
        { rotulo: 'Celular corporativo', numero: '11999990000', ativo: true },
        { rotulo: 'Ramal', numero: '4321', ativo: true },
        { rotulo: 'Celular pessoal', numero: '11988887777', ativo: false },
      ],
    }));
    expect((estado.operacoes[0]?.dados.contatos as unknown[])).toHaveLength(3);
  });

  it('rejeita mais de 3 contatos antes de enviar', async () => {
    await expect(salvarParticipantePlantao(participanteValido({
      contatos: [
        { rotulo: 'A', numero: '1', ativo: true },
        { rotulo: 'B', numero: '2', ativo: true },
        { rotulo: 'C', numero: '3', ativo: true },
        { rotulo: 'D', numero: '4', ativo: true },
      ],
    }))).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('rejeita login vazio antes de enviar', async () => {
    await expect(salvarParticipantePlantao(participanteValido({ login: '' }))).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });
});

describe('desativarParticipantePlantao', () => {
  it('nunca exclui — só marca ativo: false', async () => {
    await desativarParticipantePlantao('PLANTAO_SEGURANCA', 'acosta');
    expect(estado.operacoes).toHaveLength(1);
    expect(estado.operacoes[0]?.tipo).toBe('update');
    expect(estado.operacoes[0]?.dados.ativo).toBe(false);
  });
});

describe('salvarCompetenciaPlantaoRascunho', () => {
  it('salva um rascunho válido', async () => {
    await salvarCompetenciaPlantaoRascunho(competenciaValida());
    expect(estado.operacoes).toHaveLength(1);
    expect(estado.operacoes[0]?.colecao).toBe('rascunhosCompetenciasPlantao');
  });

  it('recusa salvar como PUBLICADA nesta fase (publicação é PLANTÃO-3C)', async () => {
    await expect(salvarCompetenciaPlantaoRascunho(competenciaValida({ status: 'PUBLICADA' })))
      .rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('rejeita domínio inválido antes de enviar (competência malformada)', async () => {
    await expect(salvarCompetenciaPlantaoRascunho(competenciaValida({ competencia: '08/2026' })))
      .rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });
});

describe('salvarAtribuicoesPlantaoRascunho', () => {
  it('salva as atribuições em lote', async () => {
    await salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA_2026-08', [
      atribuicaoValida({ atribuicaoId: '0001' }),
      atribuicaoValida({ atribuicaoId: '0002', plantonistaLogin: 'blima' }),
    ]);
    expect(estado.operacoes).toHaveLength(2);
    expect(estado.operacoes.map((o) => o.id).sort()).toEqual(['0001', '0002']);
  });

  it('rejeita a lista inteira se qualquer atribuição for inválida (fim antes do início)', async () => {
    await expect(salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA_2026-08', [
      atribuicaoValida({ atribuicaoId: '0001' }),
      atribuicaoValida({ atribuicaoId: '0002', inicio: '2026-07-26T10:00:00.000Z', fim: '2026-07-25T22:00:00.000Z' }),
    ])).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });
});
