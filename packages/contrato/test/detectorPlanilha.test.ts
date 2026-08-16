import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { detectarTipoPlanilha } from '../src/index.js';
import { carregarFixture } from './dados.js';
import { carregarFixturePlantao } from './dadosPlantao.js';

function construirArrayBuffer(nomeAba: string, aoa: unknown[][]): ArrayBuffer {
  const planilha = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

function construirComDuasAbas(
  abaA: { nome: string; aoa: unknown[][] },
  abaB: { nome: string; aoa: unknown[][] },
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(abaA.aoa), abaA.nome);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(abaB.aoa), abaB.nome);
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

function renomearAba(arquivo: ArrayBuffer, nomeAntigo: string, nomeNovo: string): ArrayBuffer {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const indice = workbook.SheetNames.indexOf(nomeAntigo);
  if (indice === -1) {
    throw new Error(`Aba "${nomeAntigo}" não encontrada.`);
  }
  workbook.SheetNames[indice] = nomeNovo;
  workbook.Sheets[nomeNovo] = workbook.Sheets[nomeAntigo];
  if (nomeNovo !== nomeAntigo) {
    delete workbook.Sheets[nomeAntigo];
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

const LINHA_PLANTAO_VALIDA: [string, string, string] = [
  'Ana Costa',
  'Sábado, 25/07/2026 - 00:00',
  'Domingo, 26/07/2026 - 19:00',
];

describe('detectarTipoPlanilha', () => {
  it('1. reconhece a fixture real de escala 6x1 como ESCALA_6X1', () => {
    const resultado = detectarTipoPlanilha(carregarFixture());
    expect(resultado.tipo).toBe('ESCALA_6X1');
    expect(resultado.abaEncontrada).toBe('Escalistas');
  });

  it('2. reconhece a fixture sanitizada de Plantão como PLANTAO', () => {
    const resultado = detectarTipoPlanilha(carregarFixturePlantao());
    expect(resultado.tipo).toBe('PLANTAO');
    expect(resultado.abaEncontrada).toBe('PlantaoCOSI');
  });

  it('3. a assinatura da função não recebe nome de arquivo (só os bytes)', () => {
    // detectarTipoPlanilha(arquivo: ArrayBuffer) — um único parâmetro,
    // nunca um nome/caminho de arquivo. A prova estrutural: arity 1.
    expect(detectarTipoPlanilha.length).toBe(1);
  });

  it('4. detecta PLANTAO mesmo quando a aba não se chama "PlantaoCOSI"', () => {
    const original = carregarFixturePlantao();
    const renomeada = renomearAba(original, 'PlantaoCOSI', 'Relatorio_Agosto_2026');
    const resultado = detectarTipoPlanilha(renomeada);
    expect(resultado.tipo).toBe('PLANTAO');
    expect(resultado.abaEncontrada).toBe('Relatorio_Agosto_2026');
  });

  it('5. planilha sem os cabeçalhos mínimos retorna DESCONHECIDA', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['Nada relevante aqui', 'Outra coluna qualquer'],
      ['x', 'y'],
    ]);
    const resultado = detectarTipoPlanilha(arquivo);
    expect(resultado.tipo).toBe('DESCONHECIDA');
    expect(resultado.motivo).toBeTruthy();
  });

  it('6. mais de uma aba com estrutura de Plantão retorna resultado ambíguo explícito, nunca escolha silenciosa', () => {
    const aba = { nome: 'PlantaoA', aoa: [
      ['Plantonista Segurança', 'Data Inicio', 'Data Fim'],
      LINHA_PLANTAO_VALIDA,
    ] };
    const outraAba = { nome: 'PlantaoB', aoa: [
      ['Plantonista Redes', 'Data Inicio', 'Data Fim'],
      LINHA_PLANTAO_VALIDA,
    ] };
    const arquivo = construirComDuasAbas(aba, outraAba);

    const resultado = detectarTipoPlanilha(arquivo);
    expect(resultado.tipo).toBe('DESCONHECIDA');
    expect(resultado.abasCandidatas).toEqual(
      expect.arrayContaining(['PlantaoA', 'PlantaoB']),
    );
    expect(resultado.abasCandidatas).toHaveLength(2);
    expect(resultado.motivo).toMatch(/ambígu|Mais de uma aba/iu);
  });

  it('7. tolera variação segura de caixa/acentuação/espaçamento no cabeçalho', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['  plantonista   segurança  ', 'data   início', 'DATA FIM'],
      LINHA_PLANTAO_VALIDA,
    ]);
    const resultado = detectarTipoPlanilha(arquivo);
    expect(resultado.tipo).toBe('PLANTAO');
  });

  it('8. uma célula solta com a palavra "Plantão" sozinha não é suficiente para detectar PLANTAO', () => {
    const arquivo = construirArrayBuffer('Aba1', [
      ['Relatório de Plantão', 'Observações', ''],
      ['Alguma nota qualquer mencionando plantão', '', ''],
    ]);
    const resultado = detectarTipoPlanilha(arquivo);
    expect(resultado.tipo).toBe('DESCONHECIDA');
  });
});
