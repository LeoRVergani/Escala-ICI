import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fake Firestore em memória — mesmo mock de `lembretesRepository.test.ts`
 * (que por sua vez segue `readRepository.test.ts`/`pushDeviceRepository.test.ts`),
 * estendido apenas na medida em que já suporta `collection()` multi-segmento
 * (aqui usado para a subcoleção `informacoesEscala/{contextoId}/itens`) e
 * `writeBatch` (usado por `publicarInformacoesDaCompetencia`). Não testa
 * comportamento real de segurança/índices do Firestore — isso é
 * `tests/firebase/firestore.rules.test.ts`, com o Emulator de verdade.
 */
const estado = vi.hoisted(() => ({
  documentos: new Map<string, Record<string, unknown>>(),
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
  exigirEscritaAdministrativaHabilitada: () => {},
}));

vi.mock('../uuid', () => ({
  gerarUuid: (() => {
    let contador = 0;
    return () => `info-${++contador}`;
  })(),
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
    const prefixo = `${queryRef.__caminho}/`;
    return candidatos.map(([chave, dados]) => ({ id: chave.slice(prefixo.length), data: () => dados }));
  }

  return {
    collection: (_db: unknown, ...segmentos: string[]) => ({ __caminho: segmentos.join('/') }),
    doc: (base: { __caminho?: string }, ...resto: string[]) => ({
      __caminho: base.__caminho !== undefined ? [base.__caminho, ...resto].join('/') : resto.join('/'),
    }),
    where: (campo: string, operador: string, valor: unknown) => ({ tipo: 'where', campo, operador, valor }),
    query: (colecaoRef: { __caminho: string }, ...condicoes: Array<Record<string, unknown>>) => ({
      __caminho: colecaoRef.__caminho,
      condicoes,
    }),
    getDoc: async (ref: { __caminho: string }) => {
      const dados = estado.documentos.get(ref.__caminho);
      return { exists: () => dados !== undefined, data: () => dados, id: ref.__caminho.split('/').pop() };
    },
    getDocs: async (queryRef: { __caminho: string; condicoes: Array<Record<string, unknown>> }) => {
      const docs = resolverQuery(queryRef);
      return { docs, empty: docs.length === 0 };
    },
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
    writeBatch: (_db: unknown) => {
      const operacoes: Array<() => void> = [];
      return {
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
  };
});

const {
  atualizarInformacaoEscala,
  cancelarInformacaoEscala,
  criarInformacaoEscalaRascunho,
  listarInformacoesDaCompetencia,
  listarInformacoesDaPessoa,
  listarInformacoesDoDia,
  listarInformacoesPublicadasDaEquipe,
  listarInformacoesPublicadasDaPessoa,
  obterInformacaoEscala,
  publicarInformacoesDaCompetencia,
} = await import('./informacoesEscalaRepository');

const TIPO = 'JORNADA' as const;
const ALVO = 'GEDSI_COSI_SOC';
const COMPETENCIA = '2026-09';
const CONTEXTO = `${TIPO}_${ALVO}_${COMPETENCIA}`;

function entradaDia(sobrescritas: Record<string, unknown> = {}) {
  return {
    tipoEscala: TIPO,
    alvoId: ALVO,
    competencia: COMPETENCIA,
    data: '2026-09-07',
    escopo: 'DIA' as const,
    usuarioLogin: null,
    categoria: 'FERIADO' as const,
    titulo: 'Feriado',
    descricao: null,
    visibilidade: 'EQUIPE' as const,
    ...sobrescritas,
  };
}

function entradaPessoaDia(sobrescritas: Record<string, unknown> = {}) {
  return entradaDia({
    escopo: 'PESSOA_DIA' as const,
    usuarioLogin: 'alamancio',
    categoria: 'COBERTURA_DU' as const,
    titulo: 'DU — Alamancio',
    visibilidade: 'PESSOAS_AFETADAS' as const,
    ...sobrescritas,
  });
}

beforeEach(() => {
  estado.documentos.clear();
});

describe('criarInformacaoEscalaRascunho', () => {
  it('grava em informacoesEscala/{contextoId}/itens/{infoId}, sempre como RASCUNHO', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const documento = estado.documentos.get(`informacoesEscala/${CONTEXTO}/itens/${infoId}`);
    expect(documento).toBeDefined();
    expect(documento?.status).toBe('RASCUNHO');
    expect(documento?.criadoPorLogin).toBe('clis');
    expect(documento?.schemaVersion).toBe(1);
  });

  it('nunca grava undefined — publicadoEm/canceladoEm nascem null, nunca omitidos', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const documento = estado.documentos.get(`informacoesEscala/${CONTEXTO}/itens/${infoId}`);
    expect(documento?.publicadoEm).toBeNull();
    expect(documento?.canceladoEm).toBeNull();
    expect(documento?.motivoCancelamento).toBeNull();
    expect(Object.values(documento ?? {}).some((valor) => valor === undefined)).toBe(false);
  });

  it('rejeita entrada inválida antes de qualquer escrita', async () => {
    await expect(criarInformacaoEscalaRascunho(entradaDia({ titulo: '' }), 'clis')).rejects.toThrow();
    expect(estado.documentos.size).toBe(0);
  });

  it('rejeita PESSOA_DIA sem usuarioLogin antes de qualquer escrita', async () => {
    await expect(
      criarInformacaoEscalaRascunho(entradaPessoaDia({ usuarioLogin: null }), 'clis'),
    ).rejects.toThrow();
    expect(estado.documentos.size).toBe(0);
  });
});

describe('atualizarInformacaoEscala', () => {
  it('atualiza só conteúdo, preservando criadoEm/criadoPorLogin', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const salva = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    await atualizarInformacaoEscala(
      salva!,
      { categoria: 'TREINAMENTO', titulo: 'Treinamento SOC', descricao: 'Turma nova', visibilidade: 'EQUIPE' },
      'clis',
    );
    const atualizada = estado.documentos.get(`informacoesEscala/${CONTEXTO}/itens/${infoId}`);
    expect(atualizada?.titulo).toBe('Treinamento SOC');
    expect(atualizada?.categoria).toBe('TREINAMENTO');
    expect(atualizada?.criadoPorLogin).toBe('clis');
  });

  it('rejeita entrada com data fora do período da competência antes de qualquer escrita', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const salva = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    const antes = estado.documentos.get(`informacoesEscala/${CONTEXTO}/itens/${infoId}`);
    await expect(atualizarInformacaoEscala(
      { ...salva!, data: '2026-10-01' },
      { categoria: 'GERAL', titulo: 'x', descricao: null, visibilidade: 'EQUIPE' },
      'clis',
    )).rejects.toThrow();
    expect(estado.documentos.get(`informacoesEscala/${CONTEXTO}/itens/${infoId}`)).toEqual(antes);
  });

  it('rejeita editar conteúdo de uma informação que não está mais RASCUNHO (PUBLICADA é imutável)', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    await publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis');
    const publicada = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    expect(publicada?.status).toBe('PUBLICADA');

    await expect(atualizarInformacaoEscala(
      publicada!,
      { categoria: 'GERAL', titulo: 'Tentando editar depois de publicada', descricao: null, visibilidade: 'EQUIPE' },
      'clis',
    )).rejects.toThrow();

    const inalterada = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    expect(inalterada?.titulo).toBe('Feriado');
  });

  it('rejeita editar conteúdo de uma informação CANCELADA', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const salva = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    await cancelarInformacaoEscala(salva!, 'clis', null);
    const cancelada = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    await expect(atualizarInformacaoEscala(
      cancelada!,
      { categoria: 'GERAL', titulo: 'x', descricao: null, visibilidade: 'EQUIPE' },
      'clis',
    )).rejects.toThrow();
  });
});

describe('correção de informação já publicada — cancelar + recriar', () => {
  it('cancelar uma PUBLICADA preserva todo o conteúdo anterior; recriar gera um infoId novo', async () => {
    const infoIdAntigo = await criarInformacaoEscalaRascunho(entradaDia({ titulo: 'Feriado (rascunho errado)' }), 'clis');
    await publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis');
    const publicada = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoIdAntigo);

    await cancelarInformacaoEscala(publicada!, 'clis', 'Título errado');
    const cancelada = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoIdAntigo);
    expect(cancelada?.status).toBe('CANCELADA');
    expect(cancelada?.titulo).toBe('Feriado (rascunho errado)');
    expect(cancelada?.publicadoPorLogin).toBe('clis');

    const infoIdNovo = await criarInformacaoEscalaRascunho(entradaDia({ titulo: 'Feriado (corrigido)' }), 'clis');
    expect(infoIdNovo).not.toBe(infoIdAntigo);
    const nova = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoIdNovo);
    expect(nova?.status).toBe('RASCUNHO');
    expect(nova?.titulo).toBe('Feriado (corrigido)');
  });
});

describe('cancelarInformacaoEscala', () => {
  it('cancela um RASCUNHO — status vira CANCELADA, documento preservado', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const salva = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    await cancelarInformacaoEscala(salva!, 'clis', 'Duplicado');
    const cancelada = estado.documentos.get(`informacoesEscala/${CONTEXTO}/itens/${infoId}`);
    expect(cancelada?.status).toBe('CANCELADA');
    expect(cancelada?.motivoCancelamento).toBe('Duplicado');
  });

  it('rejeita cancelar uma informação já CANCELADA', async () => {
    const infoId = await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    const salva = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    await cancelarInformacaoEscala(salva!, 'clis', null);
    const jaCancelada = await obterInformacaoEscala(TIPO, ALVO, COMPETENCIA, infoId);
    await expect(cancelarInformacaoEscala(jaCancelada!, 'clis', null)).rejects.toThrow();
  });
});

describe('publicarInformacoesDaCompetencia', () => {
  it('publica todos os RASCUNHO da operação/competência e retorna quantos', async () => {
    await criarInformacaoEscalaRascunho(entradaDia(), 'clis');
    await criarInformacaoEscalaRascunho(entradaDia({ data: '2026-09-08', titulo: 'Reunião' }), 'clis');

    const publicadas = await publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis');

    expect(publicadas).toBe(2);
    const todas = await listarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA);
    expect(todas.every((item) => item.status === 'PUBLICADA')).toBe(true);
    expect(todas.every((item) => item.publicadoPorLogin === 'clis')).toBe(true);
  });

  it('não publica itens de outra competência ou já publicados/cancelados', async () => {
    await criarInformacaoEscalaRascunho(entradaDia({ competencia: '2026-10', data: '2026-10-01' }), 'clis');
    const publicadas = await publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis');
    expect(publicadas).toBe(0);
  });

  it('recusa publicar acima do limite do lote, sem publicar nenhuma (nunca divide silenciosamente em vários batches)', async () => {
    const LIMITE = 400;
    const total = LIMITE + 1;
    for (let indice = 0; indice < total; indice += 1) {
      await criarInformacaoEscalaRascunho(entradaDia({ data: '2026-09-07', titulo: `Item ${indice}` }), 'clis');
    }
    await expect(publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis')).rejects.toThrow();
    const todas = await listarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA);
    expect(todas.every((item) => item.status === 'RASCUNHO')).toBe(true);
  });
});

describe('listagens', () => {
  it('lista por dia, filtrando pela data pedida', async () => {
    await criarInformacaoEscalaRascunho(entradaDia({ data: '2026-09-07' }), 'clis');
    await criarInformacaoEscalaRascunho(entradaDia({ data: '2026-09-08' }), 'clis');

    const doDia = await listarInformacoesDoDia(TIPO, ALVO, COMPETENCIA, '2026-09-07');
    expect(doDia).toHaveLength(1);
    expect(doDia[0].data).toBe('2026-09-07');
  });

  it('lista por pessoa, filtrando pelo usuarioLogin pedido', async () => {
    await criarInformacaoEscalaRascunho(entradaPessoaDia({ usuarioLogin: 'alamancio' }), 'clis');
    await criarInformacaoEscalaRascunho(entradaPessoaDia({ usuarioLogin: 'luizneto' }), 'clis');

    const daPessoa = await listarInformacoesDaPessoa(TIPO, ALVO, COMPETENCIA, 'alamancio');
    expect(daPessoa).toHaveLength(1);
    expect(daPessoa[0].usuarioLogin).toBe('alamancio');
  });

  it('listarInformacoesPublicadasDaEquipe só retorna PUBLICADA + EQUIPE', async () => {
    await criarInformacaoEscalaRascunho(entradaDia({ visibilidade: 'EQUIPE' }), 'clis');
    await criarInformacaoEscalaRascunho(entradaPessoaDia({ visibilidade: 'PESSOAS_AFETADAS' }), 'clis');
    await publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis');

    const publicadasEquipe = await listarInformacoesPublicadasDaEquipe(TIPO, ALVO, COMPETENCIA);
    expect(publicadasEquipe).toHaveLength(1);
    expect(publicadasEquipe[0].visibilidade).toBe('EQUIPE');
  });

  it('listarInformacoesPublicadasDaPessoa só retorna PUBLICADA + PESSOAS_AFETADAS da pessoa pedida', async () => {
    await criarInformacaoEscalaRascunho(entradaPessoaDia({ usuarioLogin: 'alamancio' }), 'clis');
    await criarInformacaoEscalaRascunho(entradaPessoaDia({ usuarioLogin: 'luizneto' }), 'clis');
    await publicarInformacoesDaCompetencia(TIPO, ALVO, COMPETENCIA, 'clis');

    const daAlamancio = await listarInformacoesPublicadasDaPessoa(TIPO, ALVO, COMPETENCIA, 'alamancio');
    expect(daAlamancio).toHaveLength(1);
    expect(daAlamancio[0].usuarioLogin).toBe('alamancio');
  });

  it('itens RASCUNHO nunca aparecem nas listagens "Publicadas" do App', async () => {
    await criarInformacaoEscalaRascunho(entradaDia({ visibilidade: 'EQUIPE' }), 'clis');
    const publicadasEquipe = await listarInformacoesPublicadasDaEquipe(TIPO, ALVO, COMPETENCIA);
    expect(publicadasEquipe).toHaveLength(0);
  });
});
