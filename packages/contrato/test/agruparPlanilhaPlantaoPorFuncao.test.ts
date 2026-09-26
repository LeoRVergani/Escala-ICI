import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { agruparPlanilhaPlantaoPorFuncao, criarIdOcorrenciaPlantao } from '../src/index.js';

function construirArrayBuffer(nomeAba: string, aoa: unknown[][]): ArrayBuffer {
  const planilha = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

const CABECALHO_PADRAO = [
  'Plantonista DBA', 'Plantonista Linux', 'Plantonista Telecom', 'Plantonista Windows', 'Data Inicio', 'Data Fim',
];

describe('agruparPlanilhaPlantaoPorFuncao — fixture simples (§26)', () => {
  it('uma linha com os quatro postos preenchidos gera as quatro equipes com 1 atribuição cada', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_PADRAO,
      ['Pessoa DBA', 'Pessoa Linux', 'Pessoa Telecom', 'Pessoa Windows',
        'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);

    expect(resultado.ok).toBe(true);
    expect(resultado.erros).toEqual([]);
    expect(resultado.equipes.DBA).toHaveLength(1);
    expect(resultado.equipes.LINUX).toHaveLength(1);
    expect(resultado.equipes.TELECOM).toHaveLength(1);
    expect(resultado.equipes.WINDOWS).toHaveLength(1);
    expect(resultado.atribuicoes).toHaveLength(4);
    expect(resultado.estatisticas).toEqual({
      linhasProcessadas: 1,
      atribuicoesTotal: 4,
      porFuncao: { DBA: 1, LINUX: 1, TELECOM: 1, WINDOWS: 1 },
      nomesUnicos: 4,
    });
  });

  it('as quatro atribuições da mesma linha compartilham o mesmo ocorrenciaId', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_PADRAO,
      ['Pessoa DBA', 'Pessoa Linux', 'Pessoa Telecom', 'Pessoa Windows',
        'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    const ids = new Set(resultado.atribuicoes.map((a) => a.ocorrenciaId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBe(criarIdOcorrenciaPlantao(
      { data: '2026-07-27', hora: '07:00' },
      { data: '2026-07-27', hora: '19:00' },
    ));
  });

  it('a função pertence à atribuição, não à pessoa — mesma pessoa em postos diferentes em linhas diferentes', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_PADRAO,
      ['Fulano', 'Beltrano', 'Ciclano', 'Sicrano',
        'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
      ['Beltrano', 'Fulano', 'Sicrano', 'Ciclano',
        'Terça-feira, 28/07/2026 - 07:00', 'Terça-feira, 28/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    expect(resultado.equipes.DBA.map((a) => a.plantonistaNomeOriginal)).toEqual(['Fulano', 'Beltrano']);
    expect(resultado.equipes.LINUX.map((a) => a.plantonistaNomeOriginal)).toEqual(['Beltrano', 'Fulano']);
    expect(resultado.estatisticas.nomesUnicos).toBe(4);
  });
});

describe('agruparPlanilhaPlantaoPorFuncao — ordem de colunas (§27)', () => {
  it('funciona com as colunas embaralhadas — cabeçalho decide, nunca a posição', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      ['Data Fim', 'Plantonista Telecom', 'Plantonista DBA', 'Data Inicio', 'Plantonista Windows', 'Plantonista Linux'],
      ['Segunda-feira, 27/07/2026 - 19:00', 'Pessoa Telecom', 'Pessoa DBA',
        'Segunda-feira, 27/07/2026 - 07:00', 'Pessoa Windows', 'Pessoa Linux'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    expect(resultado.ok).toBe(true);
    expect(resultado.equipes.DBA.map((a) => a.plantonistaNomeOriginal)).toEqual(['Pessoa DBA']);
    expect(resultado.equipes.LINUX.map((a) => a.plantonistaNomeOriginal)).toEqual(['Pessoa Linux']);
    expect(resultado.equipes.TELECOM.map((a) => a.plantonistaNomeOriginal)).toEqual(['Pessoa Telecom']);
    expect(resultado.equipes.WINDOWS.map((a) => a.plantonistaNomeOriginal)).toEqual(['Pessoa Windows']);
  });
});

describe('agruparPlanilhaPlantaoPorFuncao — célula vazia (§28)', () => {
  it('posto sem plantonista na linha gera 3 atribuições, nunca inventa a 4ª', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_PADRAO,
      ['João', 'Maria', '', 'Carlos', 'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    expect(resultado.ok).toBe(true);
    expect(resultado.estatisticas.porFuncao).toEqual({ DBA: 1, LINUX: 1, TELECOM: 0, WINDOWS: 1 });
    expect(resultado.estatisticas.atribuicoesTotal).toBe(3);
    expect(resultado.equipes.TELECOM).toEqual([]);
  });
});

describe('agruparPlanilhaPlantaoPorFuncao — data inválida (§29)', () => {
  it('data de início não reconhecida gera erro com linha/coluna/valorEncontrado, sem atribuição daquela linha', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_PADRAO,
      ['João', 'Maria', 'Pedro', 'Carlos', 'abc', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.atribuicoes).toEqual([]);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0].valorEncontrado).toBe('abc');
    expect(resultado.erros[0].motivo).toMatch(/início/i);
  });
});

describe('agruparPlanilhaPlantaoPorFuncao — coluna obrigatória faltando (§30)', () => {
  it('sem a coluna Plantonista Windows, erro bloqueante nomeado — nunca infere pela quarta coluna', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      ['Plantonista DBA', 'Plantonista Linux', 'Plantonista Telecom', 'Data Inicio', 'Data Fim'],
      ['João', 'Maria', 'Pedro', 'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.atribuicoes).toEqual([]);
    expect(resultado.erros.some((erro) => erro.motivo.includes('Coluna obrigatória não encontrada: Plantonista Windows'))).toBe(true);
  });
});

describe('agruparPlanilhaPlantaoPorFuncao — usuário não existente (§31)', () => {
  it('nome sem correspondência em usuarios ainda gera a atribuição bruta — parser nunca consulta cadastro', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_PADRAO,
      ['Pessoa Totalmente Inexistente No Cadastro', 'Maria', 'Pedro', 'Carlos',
        'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const resultado = agruparPlanilhaPlantaoPorFuncao(arquivo);
    expect(resultado.ok).toBe(true);
    expect(resultado.equipes.DBA.map((a) => a.plantonistaNomeOriginal)).toEqual(['Pessoa Totalmente Inexistente No Cadastro']);
  });
});

describe('criarIdOcorrenciaPlantao', () => {
  it('é determinístico e distingue ocorrências diferentes', () => {
    const a = criarIdOcorrenciaPlantao({ data: '2026-07-27', hora: '07:00' }, { data: '2026-07-27', hora: '19:00' });
    const b = criarIdOcorrenciaPlantao({ data: '2026-07-27', hora: '07:00' }, { data: '2026-07-27', hora: '19:00' });
    const c = criarIdOcorrenciaPlantao({ data: '2026-07-28', hora: '07:00' }, { data: '2026-07-28', hora: '19:00' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
