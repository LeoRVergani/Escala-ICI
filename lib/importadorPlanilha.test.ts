import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CATALOGO_SOC } from '@escala-ici/contrato';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { processarArquivoImportado } from './importadorPlanilha';

function construirArquivoPlantaoMultiFonte(): ArrayBuffer {
  const cabecalho = ['Plantonista DBA', 'Plantonista Linux', 'Plantonista Telecom', 'Plantonista Windows', 'Data Inicio', 'Data Fim'];
  const linhas = [1, 2, 3, 4].map((n) => [
    `Pessoa DBA ${n}`, `Pessoa Linux ${n}`, `Pessoa Telecom ${n}`, `Pessoa Windows ${n}`,
    `Segunda-feira, 2${n}/07/2026 - 07:00`, `Segunda-feira, 2${n}/07/2026 - 19:00`,
  ]);
  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, 'Plantao');
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

function carregar(caminho: string): ArrayBuffer {
  const bytes = readFileSync(fileURLToPath(new URL(caminho, import.meta.url)));
  return Uint8Array.from(bytes).buffer;
}

const FIXTURE_6X1 = '../packages/contrato/test/fixtures/Escala-SOC-Controle-Agosto.xls';
const FIXTURE_PLANTAO = '../packages/contrato/test/fixtures/Plantao-COSI-SANITIZADO.xls';

const OPCOES_6X1_MINIMAS = {
  equipeId: 'EQ_TESTE',
  competencia: '2026-08',
  catalogo: CATALOGO_SOC,
  loginParaUid: {},
};

function construirArquivoDesconhecido(): ArrayBuffer {
  const planilha = XLSX.utils.aoa_to_sheet([['nada relevante', 'aqui']]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, 'Aba1');
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

describe('processarArquivoImportado (roteador puro 6x1/Plantão)', () => {
  it('1. um XLS de escala 6x1 entra no fluxo ESCALA_6X1 e usa parsePlanilhaEscala', () => {
    const resultado = processarArquivoImportado(carregar(FIXTURE_6X1), OPCOES_6X1_MINIMAS);
    expect(resultado.tipo).toBe('ESCALA_6X1');
    if (resultado.tipo === 'ESCALA_6X1') {
      expect(resultado.resultado.documentos.length).toBeGreaterThan(0);
      expect(resultado.resultado.periodoInicio).toBe('2026-07-26');
    }
  });

  it('2. um XLS de Plantão entra no fluxo PLANTAO e usa parsePlanilhaPlantao', () => {
    const resultado = processarArquivoImportado(carregar(FIXTURE_PLANTAO), OPCOES_6X1_MINIMAS);
    expect(resultado.tipo).toBe('PLANTAO');
    if (resultado.tipo === 'PLANTAO') {
      expect(resultado.resultado.atribuicoes).toHaveLength(32);
      expect(resultado.resultado.ok).toBe(true);
    }
  });

  /**
   * FASE-IMPORTADOR-UNIVERSAL-1 — reproduz a estrutura real do Plantão CODB
   * (4 colunas "Plantonista <fonte>"). Antes desta fase, `detectarTipoPlanilha()`
   * (fonte única) aceitava por acidente a última coluna "Plantonista
   * Windows" — contígua às duas colunas de data — como se fosse a ÚNICA
   * fonte da planilha inteira, produzindo só 1/4 dos plantonistas reais no
   * Dashboard ("4 plantonistas" em vez de 16/17). Este é o teste de
   * regressão desse bug real, no MESMO entrypoint que o Dashboard chama.
   */
  it('4. um XLS multi-fonte (Plantão CODB) entra no fluxo PLANTAO com TODOS os postos, nunca só o último', () => {
    const resultado = processarArquivoImportado(construirArquivoPlantaoMultiFonte(), OPCOES_6X1_MINIMAS);
    expect(resultado.tipo).toBe('PLANTAO');
    if (resultado.tipo === 'PLANTAO') {
      expect(resultado.resultado.atribuicoes).toHaveLength(16);
      const nomesUnicos = new Set(resultado.resultado.atribuicoes.map((a) => a.plantonistaNomeOriginal));
      expect(nomesUnicos.size).toBe(16);
      const porFuncao = { DBA: 0, LINUX: 0, TELECOM: 0, WINDOWS: 0 } as Record<string, number>;
      for (const atribuicao of resultado.resultado.atribuicoes) {
        if (atribuicao.funcao !== undefined) {
          porFuncao[atribuicao.funcao] = (porFuncao[atribuicao.funcao] ?? 0) + 1;
        }
      }
      expect(porFuncao).toEqual({ DBA: 4, LINUX: 4, TELECOM: 4, WINDOWS: 4 });
      expect(resultado.resultado.ok).toBe(true);
    }
  });

  it('3. um arquivo sem estrutura reconhecida retorna DESCONHECIDA, sem tentar nenhum dos dois parsers', () => {
    const resultado = processarArquivoImportado(construirArquivoDesconhecido(), OPCOES_6X1_MINIMAS);
    expect(resultado.tipo).toBe('DESCONHECIDA');
    if (resultado.tipo === 'DESCONHECIDA') {
      expect(resultado.motivo).toBeTruthy();
    }
  });
});
