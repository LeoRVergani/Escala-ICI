import type {
  AtribuicaoPlantaoPersistida,
  CompetenciaPlantao,
  GrupoPlantao,
  ParticipantePlantao,
} from '@escala-ici/contrato';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  escritaHabilitada: true,
  operacoes: [] as Array<{ tipo: 'set' | 'update' | 'delete'; colecao: string; id: string; dados?: Record<string, unknown> }>,
  /** Fase ESCALAS-UX-1B.1 — simula o que já existe no Firestore antes de `salvarAtribuicoesPlantaoRascunho()` rodar, para testar a limpeza de documentos órfãos. */
  atribuicoesJaPersistidas: [] as Array<{ id: string; grupoId: string }>,
  /** Fase ESCOPO-CONSULTA-PLANTAO-1 — Grupos já existentes, para `atualizarEquipeConsultaPlantao()` ler antes de escrever. */
  gruposExistentes: {} as Record<string, GrupoPlantao | undefined>,
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
  collection: (_db: unknown, ...segmentos: string[]) => ({ __colecao: segmentos.at(-1) }),
  doc: (_db: unknown, ...segmentos: string[]) => ({ __colecao: segmentos.at(-2), __id: segmentos.at(-1) }),
  query: (colecaoRef: { __colecao: string }, ...filtros: unknown[]) => ({ __colecaoRef: colecaoRef, __filtros: filtros }),
  where: (campo: string, operador: string, valor: unknown) => ({ __tipo: 'where', campo, operador, valor }),
  getDoc: async (ref: { __colecao: string; __id: string }) => {
    const dados = ref.__colecao === 'gruposPlantao' ? estado.gruposExistentes[ref.__id] : undefined;
    return { exists: () => dados !== undefined, data: () => dados };
  },
  getDocs: async (_consulta: { __colecaoRef: { __colecao: string } }) => ({
    docs: estado.atribuicoesJaPersistidas.map((item) => ({ id: item.id, data: () => item })),
  }),
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
    delete: (ref: { __colecao: string; __id: string }) => {
      estado.operacoes.push({ tipo: 'delete', colecao: ref.__colecao, id: ref.__id });
    },
    commit: async () => {},
  }),
}));

const {
  atualizarEquipeConsultaPlantao,
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
  estado.atribuicoesJaPersistidas.length = 0;
  estado.gruposExistentes = {};
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

  // --- Fase PLANTAO-PADRAO-1 ---

  it('persiste um Grupo com padrão semanal válido', async () => {
    await salvarGrupoPlantao(grupoValido({
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
    }));
    const [operacao] = estado.operacoes;
    expect(operacao?.dados).toHaveProperty('padraoHorarioSemanal');
    expect((operacao?.dados as { padraoHorarioSemanal?: unknown[] })?.padraoHorarioSemanal).toHaveLength(1);
  });

  it('rejeita padrão semanal com horário malformado antes de enviar ao Firestore', async () => {
    await expect(salvarGrupoPlantao(grupoValido({
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '7:00', horaFim: '07:00', fimDiaOffset: 1 }],
    }))).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('rejeita padrão semanal com dia duplicado antes de enviar ao Firestore', async () => {
    await expect(salvarGrupoPlantao(grupoValido({
      padraoHorarioSemanal: [
        { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
        { diaSemana: 0, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 },
      ],
    }))).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('Grupo sem padraoHorarioSemanal continua válido (retrocompatibilidade)', async () => {
    await salvarGrupoPlantao(grupoValido());
    const [operacao] = estado.operacoes;
    expect(operacao?.dados).not.toHaveProperty('padraoHorarioSemanal');
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
    expect((estado.operacoes[0]?.dados?.contatos as unknown[])).toHaveLength(3);
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

describe('atualizarEquipeConsultaPlantao — Fase ESCOPO-CONSULTA-PLANTAO-1 (Plantões monitorados por equipe)', () => {
  it('adiciona a equipe solicitada em equipesConsulta, preservando as demais e atualizando atualizadoEm', async () => {
    estado.gruposExistentes.PLANTAO_COSI = grupoValido({ grupoId: 'PLANTAO_COSI', equipesConsulta: ['EQ_COSI'] });
    await atualizarEquipeConsultaPlantao('PLANTAO_COSI', 'EQ_NOC', 'ADICIONAR');
    expect(estado.operacoes).toHaveLength(1);
    expect(estado.operacoes[0]?.tipo).toBe('update');
    expect(estado.operacoes[0]?.colecao).toBe('gruposPlantao');
    expect(estado.operacoes[0]?.dados?.equipesConsulta).toEqual(['EQ_COSI', 'EQ_NOC']);
    expect(estado.operacoes[0]?.dados).toHaveProperty('atualizadoEm');
    expect(Object.keys(estado.operacoes[0]?.dados ?? {}).sort()).toEqual(['atualizadoEm', 'equipesConsulta']);
  });

  it('não duplica a equipe se ela já estiver em equipesConsulta (idempotente)', async () => {
    estado.gruposExistentes.PLANTAO_COSI = grupoValido({ grupoId: 'PLANTAO_COSI', equipesConsulta: ['EQ_COSI', 'EQ_NOC'] });
    await atualizarEquipeConsultaPlantao('PLANTAO_COSI', 'EQ_NOC', 'ADICIONAR');
    expect(estado.operacoes[0]?.dados?.equipesConsulta).toEqual(['EQ_COSI', 'EQ_NOC']);
  });

  it('remove a equipe solicitada, preservando as demais', async () => {
    estado.gruposExistentes.PLANTAO_COSI = grupoValido({ grupoId: 'PLANTAO_COSI', equipesConsulta: ['EQ_COSI', 'EQ_NOC'] });
    await atualizarEquipeConsultaPlantao('PLANTAO_COSI', 'EQ_NOC', 'REMOVER');
    expect(estado.operacoes[0]?.dados?.equipesConsulta).toEqual(['EQ_COSI']);
  });

  it('nunca remove a equipe responsável de equipesConsulta — recusa antes de chamar updateDoc', async () => {
    estado.gruposExistentes.PLANTAO_COSI = grupoValido({ grupoId: 'PLANTAO_COSI', equipeResponsavelId: 'EQ_COSI', equipesConsulta: ['EQ_COSI', 'EQ_NOC'] });
    await expect(atualizarEquipeConsultaPlantao('PLANTAO_COSI', 'EQ_COSI', 'REMOVER')).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('não altera nome/descrição/equipeResponsavelId/timezone/ativo/padrão semanal — só equipesConsulta e atualizadoEm', async () => {
    estado.gruposExistentes.PLANTAO_COSI = grupoValido({
      grupoId: 'PLANTAO_COSI',
      equipesConsulta: ['EQ_COSI'],
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
    });
    await atualizarEquipeConsultaPlantao('PLANTAO_COSI', 'EQ_NOC', 'ADICIONAR');
    const chaves = Object.keys(estado.operacoes[0]?.dados ?? {});
    expect(chaves).not.toContain('nome');
    expect(chaves).not.toContain('descricao');
    expect(chaves).not.toContain('equipeResponsavelId');
    expect(chaves).not.toContain('timezone');
    expect(chaves).not.toContain('ativo');
    expect(chaves).not.toContain('padraoHorarioSemanal');
  });

  it('rejeita quando o Grupo não existe', async () => {
    await expect(atualizarEquipeConsultaPlantao('PLANTAO_INEXISTENTE', 'EQ_NOC', 'ADICIONAR')).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  it('recusa escrever quando a escrita administrativa está bloqueada', async () => {
    estado.escritaHabilitada = false;
    estado.gruposExistentes.PLANTAO_COSI = grupoValido({ grupoId: 'PLANTAO_COSI' });
    await expect(atualizarEquipeConsultaPlantao('PLANTAO_COSI', 'EQ_NOC', 'ADICIONAR')).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });
});

describe('desativarParticipantePlantao', () => {
  it('nunca exclui — só marca ativo: false', async () => {
    await desativarParticipantePlantao('PLANTAO_SEGURANCA', 'acosta');
    expect(estado.operacoes).toHaveLength(1);
    expect(estado.operacoes[0]?.tipo).toBe('update');
    expect(estado.operacoes[0]?.dados?.ativo).toBe(false);
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
    await salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', 'PLANTAO_SEGURANCA_2026-08', [
      atribuicaoValida({ atribuicaoId: '0001' }),
      atribuicaoValida({ atribuicaoId: '0002', plantonistaLogin: 'blima' }),
    ]);
    expect(estado.operacoes).toHaveLength(2);
    expect(estado.operacoes.every((o) => o.tipo === 'set')).toBe(true);
    expect(estado.operacoes.map((o) => o.id).sort()).toEqual(['0001', '0002']);
  });

  it('rejeita a lista inteira se qualquer atribuição for inválida (fim antes do início)', async () => {
    await expect(salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', 'PLANTAO_SEGURANCA_2026-08', [
      atribuicaoValida({ atribuicaoId: '0001' }),
      atribuicaoValida({ atribuicaoId: '0002', inicio: '2026-07-26T10:00:00.000Z', fim: '2026-07-25T22:00:00.000Z' }),
    ])).rejects.toThrow();
    expect(estado.operacoes).toHaveLength(0);
  });

  // Fase ESCALAS-UX-1B.1 — reabrir um rascunho, excluir/editar/adicionar
  // atribuições e salvar de novo precisa deixar o Firestore EXATAMENTE
  // igual à working copy — nunca um documento órfão sobrando de antes.
  describe('limpeza de documentos órfãos (reabrir rascunho → excluir → salvar)', () => {
    it('exclui do Firestore o documento cujo atribuicaoId não está mais na lista nova', async () => {
      estado.atribuicoesJaPersistidas = [
        { id: '0001', grupoId: 'PLANTAO_SEGURANCA' },
        { id: '0002', grupoId: 'PLANTAO_SEGURANCA' },
        { id: '0003', grupoId: 'PLANTAO_SEGURANCA' },
      ];
      // A atribuição do meio foi excluída na working copy — o array novo
      // reindexa para 0001/0002, deixando o antigo 0003 sem nenhum "set"
      // que o sobrescreva.
      await salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', 'PLANTAO_SEGURANCA_2026-08', [
        atribuicaoValida({ atribuicaoId: '0001' }),
        atribuicaoValida({ atribuicaoId: '0002', plantonistaLogin: 'blima' }),
      ]);
      const exclusoes = estado.operacoes.filter((o) => o.tipo === 'delete');
      expect(exclusoes.map((o) => o.id)).toEqual(['0003']);
    });

    it('salvar sem nenhuma atribuição (todas excluídas) limpa todos os documentos antigos', async () => {
      estado.atribuicoesJaPersistidas = [
        { id: '0001', grupoId: 'PLANTAO_SEGURANCA' },
        { id: '0002', grupoId: 'PLANTAO_SEGURANCA' },
        { id: '0003', grupoId: 'PLANTAO_SEGURANCA' },
      ];
      await salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', 'PLANTAO_SEGURANCA_2026-08', []);
      const exclusoes = estado.operacoes.filter((o) => o.tipo === 'delete');
      expect(exclusoes.map((o) => o.id).sort()).toEqual(['0001', '0002', '0003']);
    });

    it('salvar de novo sem alterações não gera nenhuma exclusão nem duplicata — idempotente', async () => {
      estado.atribuicoesJaPersistidas = [{ id: '0001', grupoId: 'PLANTAO_SEGURANCA' }];
      await salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', 'PLANTAO_SEGURANCA_2026-08', [
        atribuicaoValida({ atribuicaoId: '0001' }),
      ]);
      expect(estado.operacoes.filter((o) => o.tipo === 'delete')).toHaveLength(0);
      expect(estado.operacoes.filter((o) => o.tipo === 'set')).toHaveLength(1);
    });

    it('adicionar uma atribuição nova (id além do que já existia) só grava a nova, sem excluir as anteriores', async () => {
      estado.atribuicoesJaPersistidas = [{ id: '0001', grupoId: 'PLANTAO_SEGURANCA' }];
      await salvarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', 'PLANTAO_SEGURANCA_2026-08', [
        atribuicaoValida({ atribuicaoId: '0001' }),
        atribuicaoValida({ atribuicaoId: '0002', plantonistaLogin: 'blima' }),
      ]);
      expect(estado.operacoes.filter((o) => o.tipo === 'delete')).toHaveLength(0);
      expect(estado.operacoes.filter((o) => o.tipo === 'set')).toHaveLength(2);
    });
  });
});
