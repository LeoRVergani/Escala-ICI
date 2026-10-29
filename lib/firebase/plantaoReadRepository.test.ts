import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  gruposPlantao: [] as Array<{ id: string; data: Record<string, unknown> }>,
  participantes: {} as Record<string, Array<{ id: string; data: Record<string, unknown> }>>,
  rascunhosCompetencias: [] as Array<{ id: string; data: Record<string, unknown> }>,
  competenciasPublicadas: [] as Array<{ id: string; data: Record<string, unknown> }>,
  atribuicoes: {} as Record<string, Array<{ id: string; data: Record<string, unknown> }>>,
  assinatura: null as null | { grupoId: string; atualizar: () => void; falhar: (erro: Error) => void; ativa: boolean },
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
}));

vi.mock('firebase/firestore', () => ({
  onSnapshot: (ref: { condicoes: Array<{ valor: string }> }, atualizar: () => void, falhar: (erro: Error) => void) => {
    const assinatura = { grupoId: ref.condicoes[0]!.valor, atualizar, falhar, ativa: true };
    estado.assinatura = assinatura;
    return () => { assinatura.ativa = false; };
  },
  collection: (_db: unknown, ...segmentos: string[]) => ({ __caminho: segmentos.join('/') }),
  where: (campo: string, operador: string, valor: unknown) => ({ __tipo: 'where', campo, operador, valor }),
  orderBy: (campo: string) => ({ __tipo: 'orderBy', campo }),
  query: (colecaoRef: { __caminho: string }, ...condicoes: Array<{ __tipo: string; campo: string; operador?: string; valor?: unknown }>) => ({
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
  getDocs: async (ref: { __caminho: string; condicoes?: Array<{ __tipo: string; campo: string; operador?: string; valor?: unknown }> }) => {
    const partes = ref.__caminho.split('/');
    let fonte: Array<{ id: string; data: Record<string, unknown> }> = [];
    if (partes[0] === 'gruposPlantao' && partes.length === 1) {
      fonte = estado.gruposPlantao;
    } else if (partes[0] === 'gruposPlantao' && partes[2] === 'participantes') {
      fonte = estado.participantes[partes[1] as string] ?? [];
    } else if (partes[0] === 'rascunhosCompetenciasPlantao' && partes.length === 1) {
      fonte = estado.rascunhosCompetencias;
    } else if (partes[0] === 'competenciasPlantao' && partes.length === 1) {
      fonte = estado.competenciasPublicadas;
    } else if (partes[0] === 'rascunhosCompetenciasPlantao' && partes[2] === 'atribuicoes') {
      fonte = estado.atribuicoes[partes[1] as string] ?? [];
    }
    const filtrosWhere = (ref.condicoes ?? []).filter((condicao) => condicao.__tipo === 'where');
    const ordenacao = (ref.condicoes ?? []).find((condicao) => condicao.__tipo === 'orderBy');
    let filtrados = fonte.filter((item) => filtrosWhere.every((condicao) => {
      const valorCampo = item.data[condicao.campo];
      if (condicao.operador === 'array-contains') {
        return Array.isArray(valorCampo) && valorCampo.includes(condicao.valor);
      }
      return valorCampo === condicao.valor;
    }));
    if (ordenacao !== undefined) {
      filtrados = [...filtrados].sort((a, b) => String(a.data[ordenacao.campo]).localeCompare(String(b.data[ordenacao.campo])));
    }
    return { docs: filtrados.map((item) => ({ id: item.id, data: () => item.data })) };
  },
}));

const {
  listarAtribuicoesPlantaoRascunho,
  listarCompetenciasPlantaoRascunho,
  listarGruposPlantaoPermitidos,
  listarGruposPlantaoPorUnidadeResponsavel,
  listarParticipantesPlantao,
  listarTodosGruposPlantao,
  obterCompetenciaPlantaoPublicada,
  obterCompetenciaPlantaoPublicadaNaData,
  observarPublicacoesPlantao,
  obterCompetenciaPlantaoRascunho,
  obterGrupoPlantao,
} = await import('./plantaoReadRepository');

describe('Plantão publicado por período real', () => {
  it('acompanha novas publicações do grupo e fornece cancelamento e erro ao App', () => {
    const atualizar = vi.fn();
    const falhar = vi.fn();
    const parar = observarPublicacoesPlantao('COSI', atualizar, falhar);
    expect(estado.assinatura?.grupoId).toBe('COSI');
    estado.assinatura?.atualizar();
    estado.assinatura?.atualizar();
    expect(atualizar).toHaveBeenCalledTimes(2);
    const erro = new Error('Sem conexão');
    estado.assinatura?.falhar(erro);
    expect(falhar).toHaveBeenCalledWith(erro);
    parar();
    expect(estado.assinatura?.ativa).toBe(false);
  });
  const publicada = (grupoId: string, competencia: string, inicio: string, fim: string) => ({
    id: `${grupoId}_${competencia}`,
    data: { id: `${grupoId}_${competencia}`, grupoId, competencia, periodoInicio: inicio, periodoFim: fim,
      status: 'PUBLICADA', atualizadoEm: '2026-08-01T00:00:00.000Z' },
  });

  it('encontra agosto no dia 26 mesmo quando o corte SOC aponta setembro', async () => {
    estado.competenciasPublicadas = [publicada('COSI', '2026-08', '2026-08-01', '2026-08-31')];
    expect(await obterCompetenciaPlantaoPublicada('COSI', '2026-09')).toBeNull();
    expect((await obterCompetenciaPlantaoPublicadaNaData('COSI', '2026-08-26'))?.competencia).toBe('2026-08');
  });

  it('preserva o período 26→25 e inclui seus dois limites', async () => {
    estado.competenciasPublicadas = [publicada('CODB', '2027-01', '2026-12-26', '2027-01-25')];
    for (const data of ['2026-12-26', '2027-01-25']) {
      expect((await obterCompetenciaPlantaoPublicadaNaData('CODB', data))?.competencia).toBe('2027-01');
    }
    expect(await obterCompetenciaPlantaoPublicadaNaData('CODB', '2027-01-26')).toBeNull();
  });

  it('não confunde rascunho, outro grupo ou publicação fora do período com escala disponível', async () => {
    const rascunho = publicada('COSI', '2026-09', '2026-09-01', '2026-09-30');
    rascunho.data.status = 'RASCUNHO';
    estado.competenciasPublicadas = [
      rascunho,
      publicada('CODB', '2026-09', '2026-09-01', '2026-09-30'),
      publicada('COSI', '2026-08', '2026-08-01', '2026-08-31'),
    ];
    expect(await obterCompetenciaPlantaoPublicadaNaData('COSI', '2026-09-09')).toBeNull();
  });
});

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
  estado.competenciasPublicadas = [];
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

  it('Fase PLANTAO-PADRAO-1 — leitura retorna padraoHorarioSemanal quando persistido, sem query nova', async () => {
    estado.gruposPlantao = [{
      id: 'PLANTAO_SEGURANCA',
      data: grupo({ padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }] }),
    }];
    const resultado = await obterGrupoPlantao('PLANTAO_SEGURANCA');
    expect(resultado?.padraoHorarioSemanal).toEqual([{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }]);
  });

  it('Grupo sem padraoHorarioSemanal continua lido normalmente (retrocompatibilidade)', async () => {
    estado.gruposPlantao = [{ id: 'PLANTAO_SEGURANCA', data: grupo({}) }];
    const resultado = await obterGrupoPlantao('PLANTAO_SEGURANCA');
    expect(resultado?.padraoHorarioSemanal).toBeUndefined();
  });
});

describe('listarGruposPlantaoPermitidos', () => {
  it('retorna só os grupos cuja equipesConsulta inclui a equipe informada', async () => {
    estado.gruposPlantao = [
      { id: 'PLANTAO_SEGURANCA', data: grupo({ equipesConsulta: ['EQ_COSI', 'EQ_SOC'] }) },
      { id: 'PLANTAO_LEGADO', data: grupo({ grupoId: 'PLANTAO_LEGADO', equipesConsulta: ['EQ_SOC'], ativo: false }) },
      { id: 'PLANTAO_REDES', data: grupo({ grupoId: 'PLANTAO_REDES', equipesConsulta: ['EQ_REDES'] }) },
    ];
    const resultado = await listarGruposPlantaoPermitidos('EQ_SOC');
    expect(resultado.map((g) => g.grupoId)).toEqual(['PLANTAO_SEGURANCA']);
  });
});

describe('listarGruposPlantaoPorUnidadeResponsavel — Fase ESCOPO-GESTOR-UNIDADE-1', () => {
  it('retorna só os grupos cuja unidadeResponsavelId é a informada, independente de equipesConsulta', async () => {
    estado.gruposPlantao = [
      { id: 'PLANTAO_COSI', data: grupo({ grupoId: 'PLANTAO_COSI', equipesConsulta: ['EQ_OUTRA'], unidadeResponsavelId: 'COSI' }) },
      { id: 'PLANTAO_CODB', data: grupo({ grupoId: 'PLANTAO_CODB', equipeResponsavelId: 'EQ_CODB', equipesConsulta: ['EQ_CODB'], unidadeResponsavelId: 'CODB' }) },
    ];
    const resultado = await listarGruposPlantaoPorUnidadeResponsavel('COSI');
    expect(resultado.map((g) => g.grupoId)).toEqual(['PLANTAO_COSI']);
  });

  it('um Grupo sem unidadeResponsavelId (documento antigo) nunca aparece nesta consulta', async () => {
    estado.gruposPlantao = [{ id: 'PLANTAO_ANTIGO', data: grupo({ grupoId: 'PLANTAO_ANTIGO' }) }];
    const resultado = await listarGruposPlantaoPorUnidadeResponsavel('COSI');
    expect(resultado).toEqual([]);
  });
});

describe('listarTodosGruposPlantao', () => {
  it('retorna todos os grupos, sem filtrar por equipesConsulta (uso exclusivo de ADMIN_SISTEMA)', async () => {
    estado.gruposPlantao = [
      { id: 'PLANTAO_SEGURANCA', data: grupo({ equipesConsulta: ['EQ_COSI'] }) },
      { id: 'PLANTAO_REDES', data: grupo({ grupoId: 'PLANTAO_REDES', equipeResponsavelId: 'EQ_REDES', equipesConsulta: ['EQ_REDES'] }) },
    ];
    const resultado = await listarTodosGruposPlantao();
    expect(resultado.map((g) => g.grupoId).sort()).toEqual(['PLANTAO_REDES', 'PLANTAO_SEGURANCA']);
  });

  it('retorna lista vazia quando não há nenhum grupo cadastrado', async () => {
    const resultado = await listarTodosGruposPlantao();
    expect(resultado).toEqual([]);
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

describe('obterCompetenciaPlantaoRascunho / obterCompetenciaPlantaoPublicada / listarAtribuicoesPlantaoRascunho', () => {
  it('consulta por grupo e competência e lê o rascunho', async () => {
    estado.rascunhosCompetencias = [
      { id: 'PLANTAO_SEGURANCA_2026-08', data: { id: 'PLANTAO_SEGURANCA_2026-08', grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-08', status: 'RASCUNHO' } },
    ];
    const resultado = await obterCompetenciaPlantaoRascunho('PLANTAO_SEGURANCA', '2026-08');
    expect(resultado?.status).toBe('RASCUNHO');
  });

  it('retorna null sem permission-denied quando a primeira competência ainda não existe', async () => {
    await expect(obterCompetenciaPlantaoRascunho('PLANTAO_SEGURANCA', '2026-08')).resolves.toBeNull();
    await expect(obterCompetenciaPlantaoPublicada('PLANTAO_SEGURANCA', '2026-08')).resolves.toBeNull();
  });

  it('consulta a publicação pelo mesmo grupo e competência', async () => {
    estado.competenciasPublicadas = [
      { id: 'PLANTAO_SEGURANCA_2026-08', data: { id: 'PLANTAO_SEGURANCA_2026-08', grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-08', status: 'PUBLICADA' } },
      { id: 'PLANTAO_SEGURANCA_2026-07', data: { id: 'PLANTAO_SEGURANCA_2026-07', grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-07', status: 'PUBLICADA' } },
    ];
    const resultado = await obterCompetenciaPlantaoPublicada('PLANTAO_SEGURANCA', '2026-08');
    expect(resultado?.id).toBe('PLANTAO_SEGURANCA_2026-08');
  });

  it('lista as atribuições da competência correta, ordenadas por atribuicaoId', async () => {
    estado.atribuicoes = {
      'PLANTAO_SEGURANCA_2026-08': [
        { id: '0002', data: { atribuicaoId: '0002', grupoId: 'PLANTAO_SEGURANCA', plantonistaLogin: 'blima' } },
        { id: '0001', data: { atribuicaoId: '0001', grupoId: 'PLANTAO_SEGURANCA', plantonistaLogin: 'acosta' } },
      ],
    };
    const resultado = await listarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', '2026-08');
    expect(resultado.map((a) => a.atribuicaoId)).toEqual(['0001', '0002']);
  });

  // Fase ESCALAS-UX-1B.1 — o `where('grupoId', ...)` existe para permitir
  // ao Firestore validar o `list` sem `resource.data` ambíguo (ver
  // docs/spec/PLANTOES.md § 26.3), não como filtro de negócio real (todo
  // documento da subcoleção já pertence ao grupoId do próprio caminho) —
  // mas o mock precisa respeitar o filtro do mesmo jeito, então uma
  // atribuição com `grupoId` diferente (nunca deveria existir na prática,
  // mas a query não pode silenciosamente ignorar o filtro) não aparece.
  it('nunca retorna uma atribuição de outro grupoId', async () => {
    estado.atribuicoes = {
      'PLANTAO_SEGURANCA_2026-08': [
        { id: '0001', data: { atribuicaoId: '0001', grupoId: 'PLANTAO_OUTRO', plantonistaLogin: 'acosta' } },
      ],
    };
    const resultado = await listarAtribuicoesPlantaoRascunho('PLANTAO_SEGURANCA', '2026-08');
    expect(resultado).toEqual([]);
  });
});

describe('listarCompetenciasPlantaoRascunho — Fase ESCALAS-UX-1B.1 (listar rascunhos existentes de um Grupo)', () => {
  it('lista todos os rascunhos do grupo informado, sem misturar com outro grupo', async () => {
    estado.rascunhosCompetencias = [
      { id: 'PLANTAO_SEGURANCA_2026-08', data: { id: 'PLANTAO_SEGURANCA_2026-08', grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-08', status: 'RASCUNHO' } },
      { id: 'PLANTAO_SEGURANCA_2026-07', data: { id: 'PLANTAO_SEGURANCA_2026-07', grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-07', status: 'RASCUNHO' } },
      { id: 'PLANTAO_REDES_2026-08', data: { id: 'PLANTAO_REDES_2026-08', grupoId: 'PLANTAO_REDES', competencia: '2026-08', status: 'RASCUNHO' } },
    ];
    const resultado = await listarCompetenciasPlantaoRascunho('PLANTAO_SEGURANCA');
    expect(resultado.map((item) => item.competencia).sort()).toEqual(['2026-07', '2026-08']);
  });

  it('retorna lista vazia quando o grupo não tem nenhum rascunho', async () => {
    const resultado = await listarCompetenciasPlantaoRascunho('PLANTAO_SEGURANCA');
    expect(resultado).toEqual([]);
  });
});
