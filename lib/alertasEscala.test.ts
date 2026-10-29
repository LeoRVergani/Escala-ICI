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
  MINIMO_DESCANSO_APOS_FOLGA_HORAS,
  temDescansoInsuficiente,
  tituloAlertaDescanso,
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
      minimoHoras: 11,
      regra: 'INTERJORNADA',
      datasFolga: [],
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
    expect(indice.get('uid-ana_2026-08-06')).toEqual({
      sequencia: 2,
      descansoInsuficiente: true,
      descansoMinimoHoras: 11,
    });
    expect(indice.get('uid-ana_2026-08-05')).toEqual({ sequencia: 1 });
  });
});

/**
 * HOTFIX-DSR-35H-1 — regras do Controle de Plantão: após folga, o descanso
 * entre o fim do último turno e o retorno precisa ser de 35h (DSR 24h +
 * interjornada 11h).
 */
describe('descanso após folga (DSR 24h + 11h = 35h)', () => {
  it('o mínimo é 35h', () => {
    expect(MINIMO_DESCANSO_APOS_FOLGA_HORAS).toBe(35);
  });

  it('caso real: Noite 13/11, DF 14/11, Manhã 15/11 = 30h → alerta', () => {
    const doc = documento({
      '2026-11-13': diaTrabalho('N'),
      '2026-11-14': diaDescanso('DF'),
      '2026-11-15': diaTrabalho('M'),
    });
    const alertas = detectarDescansoInsuficiente(doc, CATALOGO_SOC);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      dataAnterior: '2026-11-13',
      codigoAnterior: 'N',
      dataAtual: '2026-11-15',
      codigoAtual: 'M',
      descansoHoras: 30,
      minimoHoras: 35,
      regra: 'DSR',
      datasFolga: ['2026-11-14'],
    });
    expect(tituloAlertaDescanso(alertas[0]!)).toBe('Descanso inferior a 35h após folga');
  });

  it('o ajuste feito (retorno à Tarde, 36h) passa', () => {
    const doc = documento({
      '2026-11-13': diaTrabalho('N'),
      '2026-11-14': diaDescanso('DF'),
      '2026-11-15': { c: 'HE', t: 'T', i: '13:00', f: '19:00', vd: false },
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([]);
  });

  it('Noite no sábado não pode ser seguida de Manhã na segunda (folga no domingo)', () => {
    const doc = documento({
      '2026-11-21': diaTrabalho('N'),
      '2026-11-22': diaDescanso('DF'),
      '2026-11-23': diaTrabalho('M'),
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([
      expect.objectContaining({ regra: 'DSR', descansoHoras: 30, minimoHoras: 35 }),
    ]);
  });

  it('Tarde antes da folga e Madrugada no retorno (30h) → alerta', () => {
    const doc = documento({
      '2026-11-05': diaTrabalho('T'),
      '2026-11-06': diaDescanso('DU'),
      '2026-11-07': diaTrabalho('MD'),
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([
      expect.objectContaining({ regra: 'DSR', descansoHoras: 30 }),
    ]);
  });

  it('exatamente 35h não é insuficiente', () => {
    // Noite termina 01:00 do dia 14; retorno 12:00 do dia 15 = 35h.
    const doc = documento({
      '2026-11-13': diaTrabalho('N'),
      '2026-11-14': diaDescanso('DF'),
      '2026-11-15': { c: 'M', i: '12:00', f: '18:00', m: 360, vd: false },
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([]);
  });

  it('mesmo turno antes e depois da folga (Manhã → DF → Manhã = 42h) passa', () => {
    const doc = documento({
      '2026-11-13': diaTrabalho('M'),
      '2026-11-14': diaDescanso('DF'),
      '2026-11-15': diaTrabalho('M'),
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toEqual([]);
  });

  it('folga de feriado também conta como DSR', () => {
    const doc = documento({
      '2026-11-01': diaTrabalho('N'),
      '2026-11-02': diaDescanso('FOLGA'),
      '2026-11-03': diaTrabalho('M'),
    });
    expect(detectarDescansoInsuficiente(doc, CATALOGO_SOC)).toHaveLength(1);
  });

  it('não aplica a regra quando há férias ou dia sem escala no intervalo', () => {
    const comFerias = documento({
      '2026-11-13': diaTrabalho('N'),
      '2026-11-14': diaDescanso('X'),
      '2026-11-15': diaTrabalho('M'),
    });
    const semEscala = documento({
      '2026-11-13': diaTrabalho('N'),
      '2026-11-15': diaTrabalho('M'),
    }, { periodoInicio: '2026-11-13', periodoFim: '2026-11-15' });
    expect(detectarDescansoInsuficiente(comFerias, CATALOGO_SOC)).toEqual([]);
    expect(detectarDescansoInsuficiente(semEscala, CATALOGO_SOC)).toEqual([]);
  });

  it('marca o dia de retorno na grade com o mínimo de 35h', () => {
    const doc = documento({
      '2026-11-13': diaTrabalho('N'),
      '2026-11-14': diaDescanso('DF'),
      '2026-11-15': diaTrabalho('M'),
    });
    expect(construirIndiceAlertasGrade([doc], CATALOGO_SOC).get('uid-ana_2026-11-15')).toEqual({
      sequencia: 1,
      descansoInsuficiente: true,
      descansoMinimoHoras: 35,
    });
  });
});
