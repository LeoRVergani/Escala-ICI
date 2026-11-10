import { beforeEach, describe, expect, it, vi } from 'vitest';

const documento = (login: string) => ({ login, equipeId: 'EQ', competencia: '2026-12', dias: {} });
const estado = {
  tipo: 'ESCALA_6X1' as 'ESCALA_6X1' | 'PLANTAO',
  documentos: [documento('ana'), documento('bia')],
  erros: [] as Array<{ linha: number; coluna: string; motivo: string; severidade: string; valorEncontrado: string }>,
  usuarios: [{ login: 'ana', nome: 'Ana', ativo: true }, { login: 'bia', nome: 'Bia', ativo: true }],
};

vi.mock('./readRepository', () => ({ listarUsuarios: vi.fn(async () => estado.usuarios) }));
vi.mock('../importadorPlanilha', () => ({
  processarArquivoImportado: vi.fn(() => (estado.tipo === 'PLANTAO'
    ? { tipo: 'PLANTAO', resultado: {} }
    : { tipo: 'ESCALA_6X1', resultado: { ok: true, equipeNome: 'EQ', periodoInicio: '2026-11-26', periodoFim: '2026-12-25', totalDias: 30, documentos: estado.documentos, erros: estado.erros, avisos: [] } })),
}));
vi.mock('@escala-ici/contrato', async (original) => ({
  ...(await original<typeof import('@escala-ici/contrato')>()),
  parsePlanilhaEscala: vi.fn(() => ({ ok: true, equipeNome: 'EQ', periodoInicio: '2026-11-26', periodoFim: '2026-12-25', totalDias: 30, documentos: estado.documentos, erros: estado.erros, avisos: [] })),
}));
const salvarRascunho = vi.fn<(...args: unknown[]) => Promise<string>>(async () => 'importacao-1');
const publicarEscalas = vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({}));
vi.mock('./writeRepository', () => ({ salvarRascunho: (...args: unknown[]) => salvarRascunho(...args), publicarEscalas: (...args: unknown[]) => publicarEscalas(...args) }));

const { gravarImportacao6x1App, prepararImportacao6x1App } = await import('./importacao6x1App');
const autor = { login: 'coord', nome: 'Coordenador' } as never;

describe('IMPORTAR-6X1-APP-1 — importação da escala 6x1 pelo App', () => {
  beforeEach(() => {
    estado.tipo = 'ESCALA_6X1';
    estado.documentos = [documento('ana'), documento('bia')];
    estado.erros = [];
    estado.usuarios = [{ login: 'ana', nome: 'Ana', ativo: true }, { login: 'bia', nome: 'Bia', ativo: true }];
    salvarRascunho.mockClear();
    publicarEscalas.mockClear();
  });

  it('planilha de Plantão é recusada com a orientação certa', async () => {
    estado.tipo = 'PLANTAO';
    const resultado = await prepararImportacao6x1App(new ArrayBuffer(0), 'x.xlsx', 'EQ', '2026-12', {});
    expect(resultado).toEqual({ tipo: 'NAO_6X1', motivo: 'Esta planilha é de Plantão. Importe-a na aba do Plantão.' });
  });

  it('tudo reconhecido e sem erro: pode publicar; gravar salva o rascunho e publica com origemApp', async () => {
    const resultado = await prepararImportacao6x1App(new ArrayBuffer(0), 'escala.xlsx', 'EQ', '2026-12', {});
    if (resultado.tipo !== 'OK') throw new Error('esperava OK');
    expect(resultado.preparo).toMatchObject({ pessoas: 2, pendenciasNomes: 0, podePublicar: true });
    await expect(gravarImportacao6x1App(resultado.preparo, autor, true)).resolves.toEqual({ publicado: true });
    expect(salvarRascunho).toHaveBeenCalledWith(expect.anything(), autor, 'escala.xlsx', { origemApp: true });
    expect(publicarEscalas).toHaveBeenCalledWith(expect.anything(), 'coord', 'Importação pelo App', [], { origemApp: true });
  });

  it('nome sem cadastro: não pode publicar; gravar só salva o rascunho', async () => {
    estado.documentos = [documento('ana'), documento('Fulano Sem Cadastro')];
    const resultado = await prepararImportacao6x1App(new ArrayBuffer(0), 'escala.xlsx', 'EQ', '2026-12', {});
    if (resultado.tipo !== 'OK') throw new Error('esperava OK');
    expect(resultado.preparo.podePublicar).toBe(false);
    expect(resultado.preparo.pendenciasNomes).toBeGreaterThan(0);
    await expect(gravarImportacao6x1App(resultado.preparo, autor, true)).resolves.toEqual({ publicado: false });
    expect(salvarRascunho).toHaveBeenCalledTimes(1);
    expect(publicarEscalas).not.toHaveBeenCalled();
  });

  it('erro bloqueante da leitura: não pode publicar', async () => {
    estado.erros = [{ linha: 5, coluna: 'C', motivo: 'Código de turno desconhecido', severidade: 'BLOQUEANTE', valorEncontrado: 'ZZ' }];
    const resultado = await prepararImportacao6x1App(new ArrayBuffer(0), 'escala.xlsx', 'EQ', '2026-12', {});
    if (resultado.tipo !== 'OK') throw new Error('esperava OK');
    expect(resultado.preparo.podePublicar).toBe(false);
    expect(resultado.preparo.errosBloqueantes).toHaveLength(1);
  });
});
