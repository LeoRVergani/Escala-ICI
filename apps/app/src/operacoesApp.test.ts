import { describe, expect, it } from 'vitest';

import {
  derivarEstadoGlobalApp,
  operacaoPrincipalHoje,
  resolverOperacoesApp,
  temJornadaPublicada,
  temPlantaoPublicado,
  type DadosJornadaApp,
  type DadosPlantaoApp,
} from './operacoesApp';

/**
 * FASE-APP-OPERACOES-UNIVERSAIS-1 — ver `operacoesApp.ts`. Estes testes
 * cobrem diretamente os cenários "obrigatórios" da fase (usuário só com
 * Jornada, só com Plantão, com as duas, e sem nenhuma), sem precisar de
 * DOM/React/Firebase.
 */

const USUARIO = { equipeId: 'SOC' };
const COMPETENCIA = '2026-08';

const SEM_JORNADA: DadosJornadaApp = { escalaPublicada: false };
const COM_JORNADA: DadosJornadaApp = { escalaPublicada: true };

const SEM_PLANTAO: DadosPlantaoApp = {
  grupo: null,
  competenciaPublicada: null,
  participante: false,
  consulta: false,
};

const PLANTAO_PUBLICADO_PARTICIPANTE: DadosPlantaoApp = {
  grupo: { grupoId: 'grupo-1', nome: 'Plantão NOC' },
  competenciaPublicada: COMPETENCIA,
  participante: true,
  consulta: true,
};

describe('resolverOperacoesApp', () => {
  it('usuário só com Jornada 6x1 publicada', () => {
    const operacoes = resolverOperacoesApp(USUARIO, COM_JORNADA, SEM_PLANTAO, COMPETENCIA);
    expect(operacoes.length).toBe(1);
    expect(operacoes[0]?.tipo).toBe('JORNADA');
    expect(operacoes[0]?.status).toBe('publicada');
    expect(temJornadaPublicada(operacoes)).toBe(true);
    expect(temPlantaoPublicado(operacoes)).toBe(false);
    expect(derivarEstadoGlobalApp(operacoes)).toBe('com-operacoes');
    expect(operacaoPrincipalHoje(operacoes)?.tipo).toBe('JORNADA');
  });

  it('usuário só com Plantão publicado (sem Jornada) — a causa raiz do bug do Jean', () => {
    const operacoes = resolverOperacoesApp(USUARIO, SEM_JORNADA, PLANTAO_PUBLICADO_PARTICIPANTE, COMPETENCIA);
    expect(operacoes.length).toBe(2);
    expect(temJornadaPublicada(operacoes)).toBe(false);
    expect(temPlantaoPublicado(operacoes)).toBe(true);
    // A ausência de Jornada nunca pode virar "sem operações" quando o Plantão existe.
    expect(derivarEstadoGlobalApp(operacoes)).toBe('com-operacoes');
    expect(operacaoPrincipalHoje(operacoes)?.tipo).toBe('PLANTAO');
  });

  it('usuário com Jornada 6x1 e Plantão — Jornada é a operação principal', () => {
    const operacoes = resolverOperacoesApp(USUARIO, COM_JORNADA, PLANTAO_PUBLICADO_PARTICIPANTE, COMPETENCIA);
    expect(temJornadaPublicada(operacoes)).toBe(true);
    expect(temPlantaoPublicado(operacoes)).toBe(true);
    expect(operacaoPrincipalHoje(operacoes)?.tipo).toBe('JORNADA');
  });

  it('usuário sem nenhuma operação publicada', () => {
    const operacoes = resolverOperacoesApp(USUARIO, SEM_JORNADA, SEM_PLANTAO, COMPETENCIA);
    expect(temJornadaPublicada(operacoes)).toBe(false);
    expect(temPlantaoPublicado(operacoes)).toBe(false);
    expect(derivarEstadoGlobalApp(operacoes)).toBe('sem-operacoes');
    expect(operacaoPrincipalHoje(operacoes)).toBe(null);
  });

  it('Grupo de Plantão existe mas SEM competência publicada nesta competência — operação PLANTAO fica "sem-escala"', () => {
    const dadosPlantao: DadosPlantaoApp = {
      grupo: { grupoId: 'grupo-1', nome: 'Plantão NOC' },
      competenciaPublicada: '2026-07',
      participante: true,
      consulta: true,
    };
    const operacoes = resolverOperacoesApp(USUARIO, SEM_JORNADA, dadosPlantao, COMPETENCIA);
    const plantao = operacoes.find((operacao) => operacao.tipo === 'PLANTAO');
    expect(plantao?.status).toBe('sem-escala');
    expect(temPlantaoPublicado(operacoes)).toBe(false);
    // Sem Jornada e sem Plantão publicado nesta competência: estado vazio, não erro.
    expect(derivarEstadoGlobalApp(operacoes)).toBe('sem-operacoes');
  });

  it('consulta de Plantão ainda não concluída (grupo undefined) — nenhuma operação de Plantão é assumida', () => {
    const dadosPlantao: DadosPlantaoApp = {
      grupo: undefined,
      competenciaPublicada: null,
      participante: false,
      consulta: false,
    };
    const operacoes = resolverOperacoesApp(USUARIO, SEM_JORNADA, dadosPlantao, COMPETENCIA);
    expect(operacoes.length).toBe(1);
    expect(operacoes[0]?.tipo).toBe('JORNADA');
  });

  it('usuário sem participação/consulta de Plantão, mas Grupo publicado (ex.: colega vê o Plantão sem ser plantonista)', () => {
    const dadosPlantao: DadosPlantaoApp = {
      grupo: { grupoId: 'grupo-1', nome: 'Plantão NOC' },
      competenciaPublicada: COMPETENCIA,
      participante: false,
      consulta: true,
    };
    const operacoes = resolverOperacoesApp(USUARIO, SEM_JORNADA, dadosPlantao, COMPETENCIA);
    expect(temPlantaoPublicado(operacoes)).toBe(true);
    const plantao = operacoes.find((operacao) => operacao.tipo === 'PLANTAO');
    expect(plantao?.participante).toBe(false);
  });
});
