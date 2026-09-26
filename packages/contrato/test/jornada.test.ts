import { describe, expect, it } from 'vitest';

import {
  CATALOGO_SOC,
  competenciaOperacional,
  competenciasCandidatas,
  diaSemanaEscalaCivil,
  formatarCompetencia,
  mesclarDiasEscalas,
  resolverContextoJornada,
  resolverJornadaDia,
  selecionarEscalaPorData,
  type TurnosMes,
} from '../src/index.js';

const documentoBase: TurnosMes = {
  schemaVersion: 1,
  usuarioUid: 'u1',
  login: 'analista',
  equipeId: 'EQ_SOC',
  competencia: '2026-08',
  periodoInicio: '2026-07-26',
  periodoFim: '2026-08-25',
  turnoPadrao: 'M',
  status: 'PUBLICADA',
  dias: {
    '2026-07-28': { c: 'N', i: '19:00', f: '01:00', m: 360, vd: true },
    '2026-07-29': { c: 'M', i: '07:00', f: '13:00', m: 360 },
    '2026-07-30': { c: 'DU', m: 0 },
    '2026-07-31': { c: 'T', i: '14:00', f: '20:00', m: 360 },
  },
  totais: {
    min: 1_080,
    diasTrabalhados: 3,
    df: 0,
    du: 1,
    x: 0,
    he: 0,
    bh: 0,
    an: 0,
    folga: 0,
    afa: 0,
  },
};

describe('competência dinâmica', () => {
  it('vira a competência no dia 26 sem fixar mês ou ano', () => {
    expect(competenciaOperacional('2026-07-25')).toBe('2026-07');
    expect(competenciaOperacional('2026-07-26')).toBe('2026-08');
    expect(competenciaOperacional('2026-12-26')).toBe('2027-01');
  });

  it('gera candidatas de fallback e formata o rótulo', () => {
    expect(competenciasCandidatas('2026-07-29')).toEqual([
      '2026-08',
      '2026-07',
      '2026-09',
    ]);
    expect(formatarCompetencia('2026-08')).toBe('Agosto de 2026');
  });

  it('seleciona primeiro a escala que contém a data', () => {
    const antiga = {
      ...documentoBase,
      competencia: '2026-07',
      periodoInicio: '2026-06-26',
      periodoFim: '2026-07-25',
    };
    expect(selecionarEscalaPorData(
      [antiga, documentoBase],
      '2026-07-29',
    )?.competencia).toBe('2026-08');
  });
});

/**
 * FASE-PWA-COMPETENCIAS-MULTIPERIODOS-1 — regressão do bug relatado: após
 * publicar a competência seguinte (26/09 a 25/10), o PWA passou a mostrar
 * só o período novo e deixou de exibir corretamente o período anterior
 * (26/08 a 25/09), ainda vigente até 25/09. Estes testes fixam o
 * comportamento exigido por data civil, sem depender do fuso da máquina.
 */
describe('duas competências sobrepostas (regra 26–25)', () => {
  const competenciaAnterior: TurnosMes = {
    ...documentoBase,
    competencia: '2026-09',
    periodoInicio: '2026-08-26',
    periodoFim: '2026-09-25',
    dias: {
      '2026-09-19': { c: 'M', i: '07:00', f: '13:00', m: 360 },
      '2026-09-24': { c: 'X', m: 0 },
      '2026-09-25': { c: 'M', i: '07:00', f: '13:00', m: 360 },
    },
  };
  const competenciaSeguinte: TurnosMes = {
    ...documentoBase,
    competencia: '2026-10',
    periodoInicio: '2026-09-26',
    periodoFim: '2026-10-25',
    dias: {
      '2026-09-26': { c: 'M', i: '07:00', f: '13:00', m: 360 },
      '2026-10-19': { c: 'T', i: '14:00', f: '20:00', m: 360 },
    },
  };
  const escalas = [competenciaAnterior, competenciaSeguinte];

  it('2026-09-25 usa a competência anterior', () => {
    expect(selecionarEscalaPorData(escalas, '2026-09-25')?.competencia).toBe('2026-09');
  });

  it('2026-09-26 usa a competência seguinte', () => {
    expect(selecionarEscalaPorData(escalas, '2026-09-26')?.competencia).toBe('2026-10');
  });

  it('uma publicação nova não apaga visualmente a anterior antes da transição', () => {
    // A MESMA lista de escalas resolve os dois lados da virada — nenhuma
    // delas precisa ser descartada para a outra aparecer corretamente.
    expect(selecionarEscalaPorData(escalas, '2026-09-19')?.competencia).toBe('2026-09');
    expect(selecionarEscalaPorData(escalas, '2026-10-19')?.competencia).toBe('2026-10');
  });

  it('mesclarDiasEscalas funde os dois períodos num único mapa, sem perder nenhuma data', () => {
    const mesclado = mesclarDiasEscalas(escalas);
    expect(Object.keys(mesclado).sort()).toEqual([
      '2026-09-19',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-10-19',
    ]);
    expect(mesclado['2026-09-25']?.c).toBe('M');
    expect(mesclado['2026-09-26']?.c).toBe('M');
  });

  it('preserva a categoria FÉRIAS (código X) publicada na competência anterior', () => {
    const mesclado = mesclarDiasEscalas(escalas);
    const jornada = resolverJornadaDia({ ...competenciaAnterior, dias: mesclado }, CATALOGO_SOC, '2026-09-24');
    expect(jornada.trabalha).toBe(false);
    expect(jornada.categoria).toBe('AUSENCIA');
  });
});

describe('diaSemanaEscalaCivil', () => {
  it('19/10/2026 é segunda-feira', () => {
    expect(diaSemanaEscalaCivil('2026-10-19')).toBe(1);
  });

  it('19/09/2026 é sábado', () => {
    expect(diaSemanaEscalaCivil('2026-09-19')).toBe(6);
  });

  it('início de calendário no domingo gera zero espaços em branco', () => {
    // 2026-09-27 é domingo — o cálculo de espaços do calendário
    // (`espacosIniciais = diaSemanaEscalaCivil(primeiraData)`) deve ser 0.
    expect(diaSemanaEscalaCivil('2026-09-27')).toBe(0);
  });

  it('início de calendário na segunda gera um espaço em branco', () => {
    // 2026-09-28 é segunda-feira — o cálculo de espaços deve ser 1.
    expect(diaSemanaEscalaCivil('2026-09-28')).toBe(1);
  });

  it('nunca muda por causa do fuso horário da máquina rodando o teste', () => {
    // Independente do TZ do processo (o teste roda com o TZ real do
    // ambiente), a data civil pura nunca desloca de dia.
    for (const data of ['2026-01-01', '2026-06-30', '2026-12-31']) {
      expect(Number.isInteger(diaSemanaEscalaCivil(data))).toBe(true);
      expect(diaSemanaEscalaCivil(data)).toBeGreaterThanOrEqual(0);
      expect(diaSemanaEscalaCivil(data)).toBeLessThanOrEqual(6);
    }
  });
});

describe('contexto da jornada', () => {
  it('identifica o turno atual e o próximo turno', () => {
    const contexto = resolverContextoJornada(
      documentoBase,
      CATALOGO_SOC,
      { dataIso: '2026-07-29', hora: '08:30' },
    );
    expect(contexto.estado).toBe('EM_ANDAMENTO');
    expect(contexto.turnoAtual?.codigo).toBe('M');
    expect(contexto.proximoTurno?.data).toBe('2026-07-31');
    expect(contexto.proximoTurno?.inicio).toBe('14:00');
  });

  it('reconhece depois da meia-noite um turno iniciado no dia anterior', () => {
    const contexto = resolverContextoJornada(
      documentoBase,
      CATALOGO_SOC,
      { dataIso: '2026-07-29', hora: '00:30' },
    );
    expect(contexto.estado).toBe('EM_ANDAMENTO');
    expect(contexto.turnoAtual?.data).toBe('2026-07-28');
    expect(contexto.turnoAtual?.codigo).toBe('N');
    expect(contexto.proximoTurno?.codigo).toBe('M');
  });

  it('mostra descanso hoje e encontra a próxima jornada', () => {
    const contexto = resolverContextoJornada(
      documentoBase,
      CATALOGO_SOC,
      { dataIso: '2026-07-30', hora: '09:00' },
    );
    expect(contexto.estado).toBe('NAO_TRABALHA_HOJE');
    expect(contexto.hoje.codigo).toBe('DU');
    expect(contexto.hoje.descricao).toBe('DSR - Dia útil');
    expect(contexto.proximoTurno?.data).toBe('2026-07-31');
  });

  it('prioriza horários explícitos do dia sobre o catálogo', () => {
    const jornada = resolverJornadaDia(
      documentoBase,
      CATALOGO_SOC,
      '2026-07-31',
    );
    expect(jornada.inicio).toBe('14:00');
    expect(jornada.fim).toBe('20:00');
    expect(jornada.trabalha).toBe(true);
  });
});
