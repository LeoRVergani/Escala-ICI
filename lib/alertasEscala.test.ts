import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import {
  calcularIntervaloDescansoHoras,
  calcularSequenciaTrabalho,
  construirIndiceAlertasGrade,
  detectarDescansoInsuficiente,
  detectarSequencias6x1,
  gerarAlertasEscala,
  isDiaDeTrabalho,
  temDescansoInsuficiente,
} from './alertasEscala';

function diaTrabalho(codigo: string): Dia {
  const tipo = CATALOGO_SOC[codigo]!;
  return {
    c: codigo,
    i: tipo.horaInicio,
    f: tipo.horaFim,
    m: tipo.duracaoMinutos,
    vd: tipo.viraDia,
  };
}

function diaDescanso(codigo = 'DF'): Dia {
  return { c: codigo };
}

function documento(dias: Record<string, Dia>, ajustes: Partial<TurnosMes> = {}): TurnosMes {
  const datas = Object.keys(dias).sort();
  return {
    schemaVersion: 1,
    usuarioUid: 'uid-ana',
    login: 'ana',
    equipeId: 'EQ_SOC',
    competencia: '2026-08',
    periodoInicio: datas[0] ?? '2026-08-01',
    periodoFim: datas.at(-1) ?? '2026-08-01',
    turnoPadrao: 'MD',
    status: 'RASCUNHO',
    dias,
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
    ...ajustes,
  };
}

describe('isDiaDeTrabalho', () => {
  it('considera MD/M/T/N como trabalho', () => {
    expect(isDiaDeTrabalho('MD', CATALOGO_SOC)).toBe(true);
    expect(isDiaDeTrabalho('M', CATALOGO_SOC)).toBe(true);
    expect(isDiaDeTrabalho('T', CATALOGO_SOC)).toBe(true);
    expect(isDiaDeTrabalho('N', CATALOGO_SOC)).toBe(true);
  });

  it('não considera descanso, ausência, compensação ou código desconhecido como trabalho', () => {
    expect(isDiaDeTrabalho('DF', CATALOGO_SOC)).toBe(false);
    expect(isDiaDeTrabalho('DU', CATALOGO_SOC)).toBe(false);
    expect(isDiaDeTrabalho('X', CATALOGO_SOC)).toBe(false);
    expect(isDiaDeTrabalho('BH', CATALOGO_SOC)).toBe(false);
    expect(isDiaDeTrabalho('AFA', CATALOGO_SOC)).toBe(false);
    expect(isDiaDeTrabalho('INEXISTENTE', CATALOGO_SOC)).toBe(false);
  });
});

describe('sequência 6x1', () => {
  it('5 dias seguidos não geram alerta crítico', () => {
    const dias: Record<string, Dia> = {};
    for (let dia = 1; dia <= 5; dia += 1) {
      dias[`2026-08-0${dia}`] = diaTrabalho('MD');
    }
    const doc = documento(dias);
    expect(detectarSequencias6x1(doc, CATALOGO_SOC)).toEqual([]);
    expect(calcularSequenciaTrabalho(doc, CATALOGO_SOC)['2026-08-05']).toBe(5);
  });

  it('6 dias seguidos ainda não geram alerta crítico', () => {
    const dias: Record<string, Dia> = {};
    for (let dia = 1; dia <= 6; dia += 1) {
      dias[`2026-08-0${dia}`] = diaTrabalho('MD');
    }
    const doc = documento(dias);
    expect(detectarSequencias6x1(doc, CATALOGO_SOC)).toEqual([]);
    expect(calcularSequenciaTrabalho(doc, CATALOGO_SOC)['2026-08-06']).toBe(6);
  });

  it('7 dias seguidos geram exatamente um alerta, no 7º dia', () => {
    const dias: Record<string, Dia> = {};
    for (let dia = 1; dia <= 7; dia += 1) {
      dias[`2026-08-0${dia}`] = diaTrabalho('MD');
    }
    const doc = documento(dias);
    const alertas = detectarSequencias6x1(doc, CATALOGO_SOC);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      tipo: 'SEQUENCIA_6X1',
      diaCritico: '2026-08-07',
      periodoInicio: '2026-08-01',
      periodoFim: '2026-08-07',
      diasConsecutivos: 7,
    });
  });

  it('sequência interrompida por folga zera a contagem', () => {
    const dias: Record<string, Dia> = {
      '2026-08-01': diaTrabalho('MD'),
      '2026-08-02': diaTrabalho('MD'),
      '2026-08-03': diaTrabalho('MD'),
      '2026-08-04': diaDescanso('DF'),
      '2026-08-05': diaTrabalho('MD'),
      '2026-08-06': diaTrabalho('MD'),
      '2026-08-07': diaTrabalho('MD'),
    };
    const doc = documento(dias);
    expect(detectarSequencias6x1(doc, CATALOGO_SOC)).toEqual([]);
    expect(calcularSequenciaTrabalho(doc, CATALOGO_SOC)['2026-08-07']).toBe(3);
  });

  it('férias, folga, DSR e afastamento não contam como trabalho para a sequência', () => {
    for (const codigoDescanso of ['DF', 'DU', 'X', 'BH', 'AFA', 'FOLGA', 'AN']) {
      const dias: Record<string, Dia> = {
        '2026-08-01': diaTrabalho('MD'),
        '2026-08-02': diaTrabalho('MD'),
        '2026-08-03': diaTrabalho('MD'),
        '2026-08-04': diaTrabalho('MD'),
        '2026-08-05': diaTrabalho('MD'),
        '2026-08-06': diaTrabalho('MD'),
        '2026-08-07': diaDescanso(codigoDescanso),
      };
      const doc = documento(dias);
      expect(detectarSequencias6x1(doc, CATALOGO_SOC)).toEqual([]);
      expect(calcularSequenciaTrabalho(doc, CATALOGO_SOC)['2026-08-07']).toBeUndefined();
    }
  });

  it('continua a marcar dias além do 7º como críticos na contagem da grade, sem duplicar o alerta', () => {
    const dias: Record<string, Dia> = {};
    for (let dia = 1; dia <= 9; dia += 1) {
      dias[`2026-08-0${dia}`] = diaTrabalho('MD');
    }
    const doc = documento(dias);
    const sequencia = calcularSequenciaTrabalho(doc, CATALOGO_SOC);
    expect(sequencia['2026-08-08']).toBe(8);
    expect(sequencia['2026-08-09']).toBe(9);
    expect(detectarSequencias6x1(doc, CATALOGO_SOC)).toHaveLength(1);
  });
});

describe('descanso mínimo de 11 horas', () => {
  it('N seguido de M no dia seguinte (6h de descanso) gera alerta', () => {
    const anterior = { data: '2026-08-05', fim: '01:00', viraDia: true };
    const atual = { data: '2026-08-06', inicio: '07:00' };
    expect(calcularIntervaloDescansoHoras(anterior, atual)).toBe(6);
    expect(temDescansoInsuficiente(anterior, atual)).toBe(true);
  });

  it('MD seguido de MD no dia seguinte (18h de descanso) não gera alerta', () => {
    const anterior = { data: '2026-08-05', fim: '07:00', viraDia: false };
    const atual = { data: '2026-08-06', inicio: '01:00' };
    expect(calcularIntervaloDescansoHoras(anterior, atual)).toBe(18);
    expect(temDescansoInsuficiente(anterior, atual)).toBe(false);
  });

  it('exatamente 11 horas não é insuficiente (limite é exclusivo)', () => {
    const anterior = { data: '2026-08-05', fim: '19:00', viraDia: false };
    const atual = { data: '2026-08-06', inicio: '06:00' };
    expect(calcularIntervaloDescansoHoras(anterior, atual)).toBe(11);
    expect(temDescansoInsuficiente(anterior, atual)).toBe(false);
  });

  it('detecta no documento inteiro, considerando virada de dia', () => {
    const doc = documento({
      '2026-08-05': diaTrabalho('N'),
      '2026-08-06': diaTrabalho('M'),
    });
    const alertas = detectarDescansoInsuficiente(doc, CATALOGO_SOC);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      tipo: 'DESCANSO_INSUFICIENTE',
      dataAnterior: '2026-08-05',
      codigoAnterior: 'N',
      dataAtual: '2026-08-06',
      codigoAtual: 'M',
      descansoHoras: 6,
    });
  });

  it('não alerta quando um dos dois dias não é trabalho', () => {
    const doc = documento({
      '2026-08-05': diaTrabalho('N'),
      '2026-08-06': diaDescanso('DF'),
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([]);
  });

  it('não alerta quando os dias não são consecutivos no calendário', () => {
    const doc = documento({
      '2026-08-05': diaTrabalho('N'),
      '2026-08-07': diaTrabalho('M'),
    }, { periodoInicio: '2026-08-05', periodoFim: '2026-08-07' });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([]);
  });
});

describe('agregação e índice para a grade', () => {
  it('gerarAlertasEscala combina os dois tipos de todos os documentos', () => {
    const docA = documento({
      '2026-08-05': diaTrabalho('N'),
      '2026-08-06': diaTrabalho('M'),
    }, { usuarioUid: 'uid-a', login: 'a' });
    const docB = documento((() => {
      const dias: Record<string, Dia> = {};
      for (let dia = 1; dia <= 7; dia += 1) {
        dias[`2026-08-0${dia}`] = diaTrabalho('MD');
      }
      return dias;
    })(), { usuarioUid: 'uid-b', login: 'b' });

    const alertas = gerarAlertasEscala([docA, docB], CATALOGO_SOC);
    expect(alertas.filter((alerta) => alerta.tipo === 'DESCANSO_INSUFICIENTE')).toHaveLength(1);
    expect(alertas.filter((alerta) => alerta.tipo === 'SEQUENCIA_6X1')).toHaveLength(1);
  });

  it('constrói o índice usuarioUid_data para a grade', () => {
    const doc = documento({
      '2026-08-05': diaTrabalho('N'),
      '2026-08-06': diaTrabalho('M'),
    });
    const indice = construirIndiceAlertasGrade([doc], CATALOGO_SOC);
    expect(indice.get('uid-ana_2026-08-06')).toEqual({ sequencia: 2, descansoInsuficiente: true });
    expect(indice.get('uid-ana_2026-08-05')).toEqual({ sequencia: 1 });
  });
});
