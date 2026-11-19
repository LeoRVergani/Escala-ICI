import { competenciaDoPonto, periodoDoPonto } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import {
  derivarEstadoGlobalApp,
  operacaoPrincipalHoje,
  periodosSeSobrepoem,
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

/**
 * PLANTAO-HOJE-CICLOS-1 — regressão real: em 19/11/2026 a competência ativa passou a ser "2026-12" (17/11 a 15/12, calendário do RH) e o
 * Plantão publicado que cobre HOJE é o "2026-11" (26/10 a 25/11). Comparar só o rótulo escondia o card "De plantão agora / Próximo plantão".
 */
describe('resolverOperacoesApp — ciclos do ponto que se sobrepõem', () => {
  const GRUPO = { grupoId: 'grupo-1', nome: 'Plantão COSI' };
  const plantaoNovembro: DadosPlantaoApp = {
    grupo: GRUPO, competenciaPublicada: '2026-11', periodoPublicado: { inicio: '2026-10-26', fim: '2026-11-25' }, participante: true, consulta: true,
  };
  const periodo = (competencia: string) => {
    const p = periodoDoPonto(competencia)!;
    return { inicio: p.periodoInicio, fim: p.periodoFim };
  };
  const status = (dados: DadosPlantaoApp, competencia: string, comPeriodo = true) =>
    resolverOperacoesApp(USUARIO, COM_JORNADA, dados, competencia, comPeriodo ? periodo(competencia) : undefined).find((o) => o.tipo === 'PLANTAO')?.status;

  it('o caso de 19/11: o Plantão de novembro (26/10–25/11) vale na competência "2026-12" (17/11–15/12), que se sobrepõe a ele', () => {
    const ativa = competenciaDoPonto('2026-11-19');
    expect(ativa).toBe('2026-12');
    expect(status(plantaoNovembro, ativa)).toBe('publicada');
    const operacoes = resolverOperacoesApp(USUARIO, COM_JORNADA, plantaoNovembro, ativa, periodo(ativa));
    expect(temPlantaoPublicado(operacoes)).toBe(true);
    expect(operacaoPrincipalHoje(operacoes)?.tipo).toBe('JORNADA');
  });

  it('sem o período da competência, só o rótulo vale — o comportamento de antes não muda', () => {
    expect(status(plantaoNovembro, '2026-12', false)).toBe('sem-escala');
    expect(status(plantaoNovembro, '2026-11', false)).toBe('publicada');
  });

  it('competências que NÃO se sobrepõem continuam "sem-escala" (ciclos vizinhos, mês seguinte)', () => {
    expect(status(plantaoNovembro, '2027-01')).toBe('sem-escala');          // 16/12 a 16/01: depois do Plantão
    const outubro: DadosPlantaoApp = { ...plantaoNovembro, competenciaPublicada: '2026-10', periodoPublicado: { inicio: '2026-09-26', fim: '2026-10-25' } };
    expect(status(outubro, '2026-11')).toBe('sem-escala');                  // 26/10 começa um dia depois do fim de 25/10
  });

  it('sem competência publicada, nunca vira "publicada" só por sobreposição', () => {
    expect(status({ ...plantaoNovembro, competenciaPublicada: null, periodoPublicado: null }, '2026-12')).toBe('sem-escala');
  });

  it('periodosSeSobrepoem: inclusivo nas pontas, e período ausente nunca sobrepõe', () => {
    expect(periodosSeSobrepoem({ inicio: '2026-10-26', fim: '2026-11-25' }, { inicio: '2026-11-25', fim: '2026-12-15' })).toBe(true);
    expect(periodosSeSobrepoem({ inicio: '2026-10-26', fim: '2026-11-25' }, { inicio: '2026-11-26', fim: '2026-12-15' })).toBe(false);
    expect(periodosSeSobrepoem(null, { inicio: '2026-11-26', fim: '2026-12-15' })).toBe(false);
    expect(periodosSeSobrepoem({ inicio: '2026-11-01', fim: '2026-11-02' }, undefined)).toBe(false);
  });
});
