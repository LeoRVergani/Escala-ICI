import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fake Firestore em memória — mesmo espírito de `readRepository.test.ts`/
 * `pushDeviceRepository.test.ts`, estendido para suportar `collection()`
 * multi-segmento (subcoleção `usuarios/{login}/lembretes`), `where`/
 * `orderBy`/`query`, e `writeBatch` (para a escrita atômica de série). Não
 * testa comportamento real de segurança/índices do Firestore — isso é
 * `tests/firebase/firestore.rules.test.ts`, com o Emulator de verdade.
 */
const estado = vi.hoisted(() => ({
  documentos: new Map<string, Record<string, unknown>>(),
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
  exigirEscritaAdministrativaHabilitada: () => {},
}));

vi.mock('firebase/firestore', () => {
  function aplicarWhere(
    dados: Record<string, unknown>,
    condicao: { campo: string; operador: string; valor: unknown },
  ): boolean {
    const atual = dados[condicao.campo];
    if (condicao.operador === '==') {
      return atual === condicao.valor;
    }
    if (condicao.operador === '>=') {
      return String(atual) >= String(condicao.valor);
    }
    if (condicao.operador === '<=') {
      return String(atual) <= String(condicao.valor);
    }
    return true;
  }

  function candidatosDaColecao(caminho: string) {
    const prefixo = `${caminho}/`;
    return [...estado.documentos.entries()].filter(
      ([chave]) => chave.startsWith(prefixo) && !chave.slice(prefixo.length).includes('/'),
    );
  }

  function resolverQuery(queryRef: { __caminho: string; condicoes: Array<Record<string, unknown>> }) {
    const candidatos = candidatosDaColecao(queryRef.__caminho)
      .filter(([, dados]) => queryRef.condicoes.every((condicao) =>
        condicao.tipo !== 'where' || aplicarWhere(dados, condicao as never)));
    const campoOrdenacao = queryRef.condicoes.find((condicao) => condicao.tipo === 'orderBy')?.campo as string | undefined;
    const ordenados = campoOrdenacao === undefined
      ? candidatos
      : [...candidatos].sort((a, b) => String(a[1][campoOrdenacao]).localeCompare(String(b[1][campoOrdenacao])));
    const prefixo = `${queryRef.__caminho}/`;
    return ordenados.map(([chave, dados]) => ({ id: chave.slice(prefixo.length), data: () => dados }));
  }

  return {
    collection: (_db: unknown, ...segmentos: string[]) => ({ __caminho: segmentos.join('/') }),
    doc: (base: { __caminho?: string }, ...resto: string[]) => ({
      __caminho: base.__caminho !== undefined ? [base.__caminho, ...resto].join('/') : resto.join('/'),
    }),
    where: (campo: string, operador: string, valor: unknown) => ({ tipo: 'where', campo, operador, valor }),
    orderBy: (campo: string) => ({ tipo: 'orderBy', campo }),
    query: (colecaoRef: { __caminho: string }, ...condicoes: Array<Record<string, unknown>>) => ({
      __caminho: colecaoRef.__caminho,
      condicoes,
    }),
    getDocs: async (queryRef: { __caminho: string; condicoes: Array<Record<string, unknown>> }) => ({
      docs: resolverQuery(queryRef),
    }),
    setDoc: async (ref: { __caminho: string }, dados: Record<string, unknown>) => {
      estado.documentos.set(ref.__caminho, { ...dados });
    },
    updateDoc: async (ref: { __caminho: string }, patch: Record<string, unknown>) => {
      const atual = estado.documentos.get(ref.__caminho);
      if (atual === undefined) {
        throw { code: 'not-found' };
      }
      estado.documentos.set(ref.__caminho, { ...atual, ...patch });
    },
    deleteDoc: async (ref: { __caminho: string }) => {
      estado.documentos.delete(ref.__caminho);
    },
    writeBatch: (_db: unknown) => {
      const operacoes: Array<() => void> = [];
      return {
        set: (ref: { __caminho: string }, dados: Record<string, unknown>) => {
          operacoes.push(() => estado.documentos.set(ref.__caminho, { ...dados }));
        },
        update: (ref: { __caminho: string }, patch: Record<string, unknown>) => {
          operacoes.push(() => {
            const atual = estado.documentos.get(ref.__caminho);
            estado.documentos.set(ref.__caminho, { ...atual, ...patch });
          });
        },
        commit: async () => {
          operacoes.forEach((operacao) => operacao());
        },
      };
    },
    onSnapshot: (
      queryRef: { __caminho: string; condicoes: Array<Record<string, unknown>> },
      aoSucesso: (snapshot: { docs: unknown[] }) => void,
    ) => {
      aoSucesso({ docs: resolverQuery(queryRef) });
      return () => {};
    },
  };
});

const {
  criarLembretePessoal,
  criarSerieLembretesPessoais,
  atualizarLembretePessoal,
  excluirLembretePessoal,
  listarLembretesPessoais,
  observarLembretesPessoais,
  criarLembreteAtribuido,
  criarSerieLembretesAtribuidos,
  atualizarLembreteAtribuido,
  cancelarLembreteAtribuido,
  listarLembretesAtribuidosDoUsuario,
  observarLembretesAtribuidosDoUsuario,
} = await import('./lembretesRepository');

const LOGIN = 'caio.monteiro';
const GESTOR = { login: 'marina.azevedo', nome: 'Marina Azevedo' };
const DESTINATARIO = { login: LOGIN, equipeId: 'EQ_COSI_SOC' };

function entradaValida(sobrescritas: Record<string, unknown> = {}) {
  return {
    titulo: 'Estudar CySA+',
    descricao: null,
    data: '2026-08-19',
    diaInteiro: false,
    horaInicio: '21:00',
    horaFim: null,
    ...sobrescritas,
  };
}

beforeEach(() => {
  estado.documentos.clear();
});

describe('lembretes pessoais — paths e CRUD', () => {
  it('cria no path usuarios/{login}/lembretes/{lembreteId}', async () => {
    const lembreteId = await criarLembretePessoal(LOGIN, entradaValida());
    expect(estado.documentos.has(`usuarios/${LOGIN}/lembretes/${lembreteId}`)).toBe(true);
  });

  it('grava schemaVersion 1, tipo PESSOAL, e nunca inclui o login no corpo (o dono já está no path)', async () => {
    const lembreteId = await criarLembretePessoal(LOGIN, entradaValida());
    const documento = estado.documentos.get(`usuarios/${LOGIN}/lembretes/${lembreteId}`);
    expect(documento?.tipo).toBe('PESSOAL');
    expect(documento?.schemaVersion).toBe(1);
    expect(documento).not.toHaveProperty('login');
  });

  it('rejeita entrada inválida antes de qualquer escrita', async () => {
    await expect(criarLembretePessoal(LOGIN, entradaValida({ titulo: '' })))
      .rejects.toThrow();
    expect(estado.documentos.size).toBe(0);
  });

  it('atualiza título/descrição/horário sem tocar em criadoEm', async () => {
    const lembreteId = await criarLembretePessoal(LOGIN, entradaValida());
    const criadoEmOriginal = estado.documentos.get(`usuarios/${LOGIN}/lembretes/${lembreteId}`)?.criadoEm;

    await atualizarLembretePessoal(LOGIN, lembreteId, entradaValida({ titulo: 'Estudar CySA+ (revisão)' }));

    const atualizado = estado.documentos.get(`usuarios/${LOGIN}/lembretes/${lembreteId}`);
    expect(atualizado?.titulo).toBe('Estudar CySA+ (revisão)');
    expect(atualizado?.criadoEm).toBe(criadoEmOriginal);
  });

  it('exclui definitivamente — sem deixar rastro no domínio', async () => {
    const lembreteId = await criarLembretePessoal(LOGIN, entradaValida());
    await excluirLembretePessoal(LOGIN, lembreteId);
    expect(estado.documentos.has(`usuarios/${LOGIN}/lembretes/${lembreteId}`)).toBe(false);
  });

  it('lista e observa só o intervalo civil pedido, ordenado por data', async () => {
    await criarLembretePessoal(LOGIN, entradaValida({ data: '2026-08-16' }));
    await criarLembretePessoal(LOGIN, entradaValida({ data: '2026-08-20' }));
    await criarLembretePessoal(LOGIN, entradaValida({ data: '2026-09-05' }));

    const lembretes = await listarLembretesPessoais(LOGIN, '2026-08-17', '2026-08-31');
    expect(lembretes.map((item) => item.data)).toEqual(['2026-08-20']);

    let recebido: unknown[] = [];
    observarLembretesPessoais(LOGIN, '2026-08-01', '2026-09-30', (lembretes) => { recebido = lembretes; }, () => {});
    expect(recebido).toHaveLength(3);
  });

  it('cria uma série com um documento por ocorrência, mesmo serieId, em lote', async () => {
    const ids = await criarSerieLembretesPessoais(LOGIN, {
      titulo: 'Capacitação COBIT',
      descricao: null,
      datas: ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'],
      diaInteiro: false,
      horaInicio: '18:30',
      horaFim: '22:30',
    });

    expect(ids).toHaveLength(4);
    const documentos = ids.map((id) => estado.documentos.get(`usuarios/${LOGIN}/lembretes/${id}`));
    expect(documentos.every((documento) => documento !== undefined)).toBe(true);
    const serieIds = new Set(documentos.map((documento) => documento?.serieId));
    expect(serieIds.size).toBe(1);
    expect(documentos.map((documento) => documento?.data)).toEqual([
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
    ]);
  });

  it('rejeita série inválida antes de escrever qualquer documento (atomicidade do lado do domínio)', async () => {
    await expect(criarSerieLembretesPessoais(LOGIN, {
      titulo: 'Capacitação COBIT',
      descricao: null,
      datas: [],
      diaInteiro: true,
      horaInicio: null,
      horaFim: null,
    })).rejects.toThrow();
    expect(estado.documentos.size).toBe(0);
  });

  it('mapper defensivo: documento malformado vira lembrete com campos vazios, nunca lança', async () => {
    estado.documentos.set(`usuarios/${LOGIN}/lembretes/malformado`, {
      data: '2026-08-19',
      // titulo ausente, horario ausente, alertasAntecedenciaMin com lixo misturado
      alertasAntecedenciaMin: [10, 'trinta', null, 30],
    });

    const lembretes = await listarLembretesPessoais(LOGIN, '2026-08-01', '2026-08-31');
    expect(lembretes).toHaveLength(1);
    expect(lembretes[0]?.titulo).toBe('');
    expect(lembretes[0]?.horario).toEqual({ diaInteiro: false, horaInicio: null, horaFim: null, viraDia: false });
    expect(lembretes[0]?.alertasAntecedenciaMin).toEqual([10, 30]);
  });
});

describe('lembretes atribuídos — paths, CRUD e cancelamento', () => {
  it('cria no path top-level lembretesAtribuidos/{lembreteId}, com status ATIVO e autoria', async () => {
    const lembreteId = await criarLembreteAtribuido(DESTINATARIO, GESTOR, entradaValida({ titulo: 'Capacitação COBIT' }));
    const documento = estado.documentos.get(`lembretesAtribuidos/${lembreteId}`);
    expect(documento?.tipo).toBe('ATRIBUIDO');
    expect(documento?.status).toBe('ATIVO');
    expect(documento?.destinatarioLogin).toBe(LOGIN);
    expect(documento?.destinatarioEquipeId).toBe('EQ_COSI_SOC');
    expect(documento?.criadoPorLogin).toBe(GESTOR.login);
    expect(documento?.criadoPorNome).toBe(GESTOR.nome);
    expect(documento?.canceladoEm).toBeNull();
    expect(documento?.canceladoPorLogin).toBeNull();
  });

  it('rejeita entrada inválida antes de qualquer escrita', async () => {
    await expect(criarLembreteAtribuido(DESTINATARIO, GESTOR, entradaValida({ titulo: '' })))
      .rejects.toThrow();
    expect(estado.documentos.size).toBe(0);
  });

  it('atualiza conteúdo sem tocar em destinatário/autoria', async () => {
    const lembreteId = await criarLembreteAtribuido(DESTINATARIO, GESTOR, entradaValida());
    await atualizarLembreteAtribuido(lembreteId, entradaValida({ titulo: 'Capacitação COBIT (sala alterada)' }));
    const documento = estado.documentos.get(`lembretesAtribuidos/${lembreteId}`);
    expect(documento?.titulo).toBe('Capacitação COBIT (sala alterada)');
    expect(documento?.destinatarioLogin).toBe(LOGIN);
    expect(documento?.criadoPorLogin).toBe(GESTOR.login);
  });

  it('cancelar transiciona status para CANCELADO e preserva o documento (nunca deleteDoc)', async () => {
    const lembreteId = await criarLembreteAtribuido(DESTINATARIO, GESTOR, entradaValida());
    await cancelarLembreteAtribuido(lembreteId, { login: GESTOR.login });
    const documento = estado.documentos.get(`lembretesAtribuidos/${lembreteId}`);
    expect(documento?.status).toBe('CANCELADO');
    expect(documento?.canceladoPorLogin).toBe(GESTOR.login);
    expect(documento?.canceladoEm).not.toBeNull();
  });

  it('cria série atribuída em lote, um documento por data, mesmo serieId', async () => {
    const ids = await criarSerieLembretesAtribuidos(DESTINATARIO, GESTOR, {
      titulo: 'Capacitação COBIT',
      descricao: null,
      datas: ['2026-08-21', '2026-08-28', '2026-09-10', '2026-09-17'],
      diaInteiro: false,
      horaInicio: '13:00',
      horaFim: '17:30',
    });
    expect(ids).toHaveLength(4);
    const documentos = ids.map((id) => estado.documentos.get(`lembretesAtribuidos/${id}`));
    expect(new Set(documentos.map((documento) => documento?.serieId)).size).toBe(1);
  });

  it('lista e observa por destinatário + intervalo civil, incluindo cancelados (filtro de status é responsabilidade do domínio/UI)', async () => {
    const id1 = await criarLembreteAtribuido(DESTINATARIO, GESTOR, entradaValida({ data: '2026-08-17' }));
    await criarLembreteAtribuido(DESTINATARIO, GESTOR, entradaValida({ data: '2026-08-25' }));
    await cancelarLembreteAtribuido(id1, { login: GESTOR.login });
    await criarLembreteAtribuido({ login: 'outro.login', equipeId: 'EQ_COSI_SOC' }, GESTOR, entradaValida({ data: '2026-08-18' }));

    const lembretes = await listarLembretesAtribuidosDoUsuario(LOGIN, '2026-08-01', '2026-08-31');
    expect(lembretes).toHaveLength(2);
    expect(lembretes.every((item) => item.destinatarioLogin === LOGIN)).toBe(true);
    expect(lembretes.some((item) => item.status === 'CANCELADO')).toBe(true);

    let recebido: unknown[] = [];
    observarLembretesAtribuidosDoUsuario(LOGIN, '2026-08-01', '2026-08-31', (lembretes) => { recebido = lembretes; }, () => {});
    expect(recebido).toHaveLength(2);
  });

  it('mapper defensivo: status desconhecido vira ATIVO por padrão, nunca lança', async () => {
    estado.documentos.set('lembretesAtribuidos/malformado', {
      destinatarioLogin: LOGIN,
      destinatarioEquipeId: 'EQ_COSI_SOC',
      data: '2026-08-19',
      status: 'ALGO_INESPERADO',
    });
    const lembretes = await listarLembretesAtribuidosDoUsuario(LOGIN, '2026-08-01', '2026-08-31');
    expect(lembretes[0]?.status).toBe('ATIVO');
  });
});
