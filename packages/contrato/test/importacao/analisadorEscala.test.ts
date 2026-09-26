import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  analisarArquivoEscalaPlantao,
  converterAnaliseParaResultadoParsePlantao,
} from '../../src/importacao/analisadorEscala.js';

function construirArrayBuffer(nomeAba: string, aoa: unknown[][]): ArrayBuffer {
  const planilha = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

const CABECALHO_MULTIFONTE = [
  'Plantonista DBA', 'Plantonista Linux', 'Plantonista Telecom', 'Plantonista Windows', 'Data Inicio', 'Data Fim',
];

function linhaMultiFonte(sufixo: string, data: string): unknown[] {
  return [
    `Pessoa DBA ${sufixo}`, `Pessoa Linux ${sufixo}`, `Pessoa Telecom ${sufixo}`, `Pessoa Windows ${sufixo}`,
    `Segunda-feira, ${data} - 07:00`, `Segunda-feira, ${data} - 19:00`,
  ];
}

describe('analisarArquivoEscalaPlantao — FASE-IMPORTADOR-UNIVERSAL-1', () => {
  it('reconhece PLANTAO_MULTIFONTE com alta confiança e gera 1 registro canônico por posto/linha', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_MULTIFONTE,
      linhaMultiFonte('1', '27/07/2026'),
      linhaMultiFonte('2', '28/07/2026'),
    ]);
    const analise = analisarArquivoEscalaPlantao(arquivo);

    expect(analise.descoberta.estrutura).toBe('PLANTAO_MULTIFONTE');
    expect(analise.descoberta.confianca).toBe(1);
    expect(analise.erros).toEqual([]);
    expect(analise.registros).toHaveLength(8);
    expect(analise.estatisticas).toEqual({
      registros: 8,
      ocorrencias: 2,
      pessoasUnicas: 8,
      porFuncao: { DBA: 2, LINUX: 2, TELECOM: 2, WINDOWS: 2 },
      periodoInicio: { data: '2026-07-27', hora: '07:00' },
      periodoFim: { data: '2026-07-28', hora: '19:00' },
    });
  });

  /**
   * Reproduz a estrutura EXATA do Plantão CODB real: a última coluna
   * "Plantonista Windows" fica contígua às duas colunas de data, formando
   * um falso "trio" que `localizarTabelaPlantao()` (fonte única) aceita
   * sozinho — a causa raiz do bug real de "4 plantonistas em vez de 17"
   * (a coluna de 1 posto só sendo lida como se fosse a planilha inteira).
   * `analisarArquivoEscalaPlantao()` precisa detectar multi-fonte primeiro
   * e nunca cair nesse falso positivo.
   */
  it('nunca degrada para fonte única quando há 2+ colunas Plantonista (a falsa detecção que causava "4 plantonistas")', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_MULTIFONTE,
      linhaMultiFonte('1', '27/07/2026'),
      linhaMultiFonte('2', '28/07/2026'),
      linhaMultiFonte('3', '29/07/2026'),
      linhaMultiFonte('4', '30/07/2026'),
    ]);
    const analise = analisarArquivoEscalaPlantao(arquivo);

    expect(analise.descoberta.estrutura).toBe('PLANTAO_MULTIFONTE');
    // 4 linhas x 4 postos = 16 registros, 16 pessoas únicas (nunca 4).
    expect(analise.registros).toHaveLength(16);
    expect(analise.estatisticas.pessoasUnicas).toBe(16);
    expect(analise.estatisticas.porFuncao).toEqual({ DBA: 4, LINUX: 4, TELECOM: 4, WINDOWS: 4 });
  });

  it('planilha de fonte única (1 coluna Plantonista) continua PLANTAO_INTERVALO, sem funcao em nenhum registro', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      ['Plantonista', 'Data Inicio', 'Data Fim'],
      ['Fulano', 'Segunda-feira, 27/07/2026 - 07:00', 'Segunda-feira, 27/07/2026 - 19:00'],
    ]);
    const analise = analisarArquivoEscalaPlantao(arquivo);

    expect(analise.descoberta.estrutura).toBe('PLANTAO_INTERVALO');
    expect(analise.registros).toHaveLength(1);
    expect(analise.registros[0]?.funcao).toBeUndefined();
  });

  it('planilha sem nenhuma estrutura de Plantão reconhecida vira DESCONHECIDA, sem inventar registro', () => {
    const arquivo = construirArrayBuffer('Aba1', [['nada relevante', 'aqui']]);
    const analise = analisarArquivoEscalaPlantao(arquivo);

    expect(analise.descoberta.estrutura).toBe('DESCONHECIDA');
    expect(analise.registros).toEqual([]);
  });
});

describe('converterAnaliseParaResultadoParsePlantao', () => {
  it('produz um ResultadoParsePlantao consumível pelo Editor existente, com totalBrutoCalculado/sobreposicoes calculados', () => {
    const arquivo = construirArrayBuffer('Plantao', [
      CABECALHO_MULTIFONTE,
      linhaMultiFonte('1', '27/07/2026'),
    ]);
    const analise = analisarArquivoEscalaPlantao(arquivo);
    const resultado = converterAnaliseParaResultadoParsePlantao(analise);

    expect(resultado.ok).toBe(true);
    expect(resultado.atribuicoes).toHaveLength(4);
    expect(resultado.atribuicoes.every((atribuicao) => atribuicao.funcao !== undefined)).toBe(true);
    expect(resultado.totalBrutoCalculado).toEqual({ quantidade: 4, minutos: 4 * 12 * 60 });
    expect(resultado.contabilidadeInformada).toEqual([]);
    expect(resultado.totaisInformados).toBeNull();
  });
});
