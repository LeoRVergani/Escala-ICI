import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { GrupoPlantao } from '@escala-ici/contrato';

import type { Usuario } from '../modelos';
import { prepararImportacaoPlantaoApp } from './importacaoPlantaoApp';

/** Planilha no formato do relatório multi-posto (nomes fictícios). */
function planilhaMultiposto(linhas: string[][]): ArrayBuffer {
  const dados = [
    ['Relatório de Plantão'],
    ['Plantonista DBA', 'Plantonista Linux', 'Plantonista Telecom', 'Plantonista Windows', 'Data Inicio', 'Data Fim'],
    ...linhas,
  ];
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(dados), 'Plantao');
  const saida = XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return saida;
}

const linhas = [
  ['Ana Lima', 'Beto Souza', 'Caio Reis', 'Dani Prado', 'Segunda-feira, 02/11/2026 - 19:00', 'Terça-feira, 03/11/2026 - 07:00'],
  ['Ana Lima', 'Beto Souza', 'Caio Reis', 'Dani Prado', 'Terça-feira, 03/11/2026 - 19:00', 'Quarta-feira, 04/11/2026 - 07:00'],
];

const grupo = {
  grupoId: 'PLANTAO_X', nome: 'Plantão X', equipeResponsavelId: 'EQ_X', equipesConsulta: ['EQ_X'],
  timezone: 'America/Sao_Paulo', ativo: true, funcoesEsperadas: ['DBA', 'LINUX', 'TELECOM', 'WINDOWS'],
} as unknown as GrupoPlantao;

const pessoa = (login: string, nome: string) => ({ login, nome, equipeId: 'EQ_X', ativo: true }) as unknown as Usuario;
const todos = [pessoa('ana', 'Ana Lima'), pessoa('beto', 'Beto Souza'), pessoa('caio', 'Caio Reis'), pessoa('dani', 'Dani Prado')];

describe('IMPORTAR-PLANTAO-APP-1 — preparo da importação rápida pelo App', () => {
  it('planilha certa: postos, totais, mês e nenhuma pendência', () => {
    const r = prepararImportacaoPlantaoApp(planilhaMultiposto(linhas), 'x.xlsx', grupo, todos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preparo.totalPlantoes).toBe(8);
    expect(r.preparo.totalPessoas).toBe(4);
    expect(r.preparo.postos.map((posto) => `${posto.rotulo}:${posto.plantoes}`)).toEqual(['DBA:2', 'Linux:2', 'Telecom:2', 'Windows:2']);
    expect(r.preparo.competencia).toBe('2026-11');
    expect(r.preparo.pendencias).toEqual([]);
  });

  it('pessoa sem cadastro vira pendência (resolver no Dashboard)', () => {
    const r = prepararImportacaoPlantaoApp(planilhaMultiposto(linhas), 'x.xlsx', grupo, todos.slice(0, 3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preparo.nomesSemVinculo).toEqual(['Dani Prado']);
    expect(r.preparo.pendencias.join(' ')).toContain('sem cadastro');
  });

  it('postos que não batem com o grupo viram pendência', () => {
    const grupoUnico = { ...grupo, funcoesEsperadas: undefined } as unknown as GrupoPlantao;
    const r = prepararImportacaoPlantaoApp(planilhaMultiposto(linhas), 'x.xlsx', grupoUnico, todos);
    expect(r.ok && r.preparo.pendencias.join(' ')).toContain('posto único');
  });

  it('arquivo que não é planilha de Plantão é recusado com mensagem clara', () => {
    const r = prepararImportacaoPlantaoApp(new TextEncoder().encode('qualquer coisa').buffer as ArrayBuffer, 'x.txt', grupo, todos);
    expect(r.ok).toBe(false);
  });
});
