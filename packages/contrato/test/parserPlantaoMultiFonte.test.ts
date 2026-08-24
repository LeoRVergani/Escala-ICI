import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { localizarTabelaPlantaoMultiFonte, parsePlanilhaPlantaoMultiFonte } from '../src/index.js';
import { carregarFixturePlantaoCodb } from './dadosPlantaoMultiFonte.js';

function construirArrayBuffer(nomeAba: string, aoa: unknown[][]): ArrayBuffer {
  const planilha = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

function resultadoFixtureCodb() {
  return parsePlanilhaPlantaoMultiFonte(carregarFixturePlantaoCodb());
}

describe('parsePlanilhaPlantaoMultiFonte com a fixture sanitizada do Plantão CODB', () => {
  it('1. lê as 19 atribuições (4 fontes x 5 linhas, menos 1 fonte vazia numa linha)', () => {
    expect(resultadoFixtureCodb().atribuicoes).toHaveLength(19);
  });

  it('2. detecta as 4 fontes na ordem das colunas do cabeçalho', () => {
    expect(resultadoFixtureCodb().fontes).toEqual(['DBA', 'Linux', 'Telecom', 'Windows']);
  });

  it('3. marca cada atribuição com a fonte da sua coluna de origem', () => {
    const primeiraLinha = resultadoFixtureCodb().atribuicoes.filter((a) => a.linhaOrigem === 3);
    expect(primeiraLinha.map((a) => a.fonte)).toEqual(['DBA', 'Linux', 'Telecom', 'Windows']);
  });

  it('4. preserva o nome original do plantonista em cada fonte', () => {
    const nomes = new Set(resultadoFixtureCodb().atribuicoes.map((a) => a.plantonistaNomeOriginal));
    expect(nomes).toEqual(new Set([
      'Ana Costa',
      'Bruno Lima',
      'Carlos Nunes',
      'Diana Melo',
      'Eduardo Reis',
      'Fernanda Alves',
      'Gustavo Pinto',
      'Helena Souza',
    ]));
  });

  it('5. uma coluna de fonte vazia numa linha não gera atribuição nem erro para essa fonte', () => {
    const resultado = resultadoFixtureCodb();
    expect(resultado.ok).toBe(true);
    expect(resultado.erros).toHaveLength(0);
    const linhaComTelecomVago = resultado.atribuicoes.filter((a) => a.linhaOrigem === 6);
    expect(linhaComTelecomVago.map((a) => a.fonte)).toEqual(['DBA', 'Linux', 'Windows']);
  });

  it('6. gera aviso quando o dia da semana em texto diverge da data numérica, sem alterar a data', () => {
    const resultado = resultadoFixtureCodb();
    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]).toContain('Quinta-feira');
    const atribuicaoAfetada = resultado.atribuicoes.find((a) => a.linhaOrigem === 5);
    expect(atribuicaoAfetada?.inicio.data).toBe('2026-07-28');
  });

  it('7. calcula a duração em minutos entre início e fim, incluindo janelas que atravessam a meia-noite', () => {
    const janela43h = resultadoFixtureCodb().atribuicoes.find((a) => a.linhaOrigem === 3);
    expect(janela43h?.duracaoMinutos).toBe(43 * 60);
  });

  it('8. preserva a aba de origem real', () => {
    expect(resultadoFixtureCodb().abaOrigem).toBe('Plantao');
  });
});

describe('localizarTabelaPlantaoMultiFonte', () => {
  it('1. reconhece uma única coluna de fonte como um caso válido (N=1)', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['Plantonista DBA', 'Data Inicio', 'Data Fim'],
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
    ]);
    const localizacao = localizarTabelaPlantaoMultiFonte(XLSX.read(arquivo, { type: 'array' }));
    expect(localizacao.status).toBe('UNICA');
    expect(localizacao.colunas).toEqual([{ coluna: 0, fonte: 'DBA' }]);
  });

  it('2. reconhece "Plantonista" sem sufixo preservando o texto original como fonte', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['Plantonista', 'Data Inicio', 'Data Fim'],
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
    ]);
    const localizacao = localizarTabelaPlantaoMultiFonte(XLSX.read(arquivo, { type: 'array' }));
    expect(localizacao.status).toBe('UNICA');
    expect(localizacao.colunas).toEqual([{ coluna: 0, fonte: 'Plantonista' }]);
  });

  it('3. status AUSENTE quando não há par Data Início/Data Fim logo após as colunas de fonte', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['Plantonista DBA', 'Plantonista Linux', 'Observação'],
      ['Ana Costa', 'Bruno Lima', 'x'],
    ]);
    const localizacao = localizarTabelaPlantaoMultiFonte(XLSX.read(arquivo, { type: 'array' }));
    expect(localizacao.status).toBe('AUSENTE');
  });

  it('4. status AMBIGUA quando mais de uma aba tem a estrutura', () => {
    const workbook = XLSX.utils.book_new();
    const aoa = [
      ['Plantonista DBA', 'Data Inicio', 'Data Fim'],
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Aba1');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Aba2');
    const localizacao = localizarTabelaPlantaoMultiFonte(workbook);
    expect(localizacao.status).toBe('AMBIGUA');
    expect(localizacao.abasCandidatas).toEqual(['Aba1', 'Aba2']);
  });
});

describe('parsePlanilhaPlantaoMultiFonte — erros estruturais', () => {
  it('1. reporta erro quando a estrutura de múltiplas fontes não é encontrada', () => {
    const arquivo = construirArrayBuffer('Aba1', [['Qualquer coisa']]);
    const resultado = parsePlanilhaPlantaoMultiFonte(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.atribuicoes).toHaveLength(0);
    expect(resultado.erros).toHaveLength(1);
  });

  it('2. reporta erro de linha quando a data de início não é reconhecida, sem interromper a leitura das demais linhas', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['Plantonista DBA', 'Plantonista Linux', 'Data Inicio', 'Data Fim'],
      ['Ana Costa', 'Bruno Lima', 'data inválida', 'Domingo, 26/07/2026 - 19:00'],
      ['Eduardo Reis', 'Fernanda Alves', 'Domingo, 26/07/2026 - 19:00', 'Segunda-feira, 27/07/2026 - 07:00'],
    ]);
    const resultado = parsePlanilhaPlantaoMultiFonte(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.atribuicoes).toHaveLength(2);
  });
});
