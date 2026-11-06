import { describe, expect, it } from 'vitest';

import { descreverTempo, faixaTemperatura, interpretarPrevisao, previsaoDoTurno, urlPrevisao } from './previsaoTempo';

const resposta = {
  hourly: {
    time: ['2026-11-06T06:00', '2026-11-06T07:00', '2026-11-06T08:00', '2026-11-06T12:00', '2026-11-06T13:00',
      '2026-11-06T19:00', '2026-11-06T23:00', '2026-11-07T00:00', '2026-11-07T01:00'],
    temperature_2m: [14.2, 15.4, 16.8, 22.6, 23.1, 19.4, 16.2, 15.6, 15.1],
    precipitation_probability: [0, 5, 10, 20, 15, 60, 80, 70, 40],
    weather_code: [0, 1, 2, 3, 3, 61, 63, 61, 3],
  },
};

describe('PREVISAO-TEMPO-1', () => {
  const horas = interpretarPrevisao(resposta);

  it('interpreta a resposta e ignora formato inesperado', () => {
    expect(horas).toHaveLength(9);
    expect(interpretarPrevisao({ erro: true })).toEqual([]);
    expect(interpretarPrevisao(null)).toEqual([]);
  });

  it('turno da manhã: só as horas do turno, pior tempo = nublado', () => {
    const p = previsaoDoTurno(horas, '2026-11-06', '07:00', '13:00');
    expect(p).toMatchObject({ tempMin: 15, tempMax: 23, chuvaMax: 20, tipo: 'nublado' });
    expect(faixaTemperatura(p!)).toBe('15°–23°');
  });

  it('turno da noite passa da meia-noite e pega a chuva', () => {
    const p = previsaoDoTurno(horas, '2026-11-06', '19:00', '01:00');
    expect(p).toMatchObject({ tempMin: 16, tempMax: 19, chuvaMax: 80, tipo: 'chuva', rotulo: 'Chuva' });
  });

  it('sem horas no período (além dos 16 dias) → sem previsão', () => {
    expect(previsaoDoTurno(horas, '2026-12-30', '07:00', '13:00')).toBeNull();
  });

  it('códigos WMO e URL de Curitiba', () => {
    expect(descreverTempo(0).tipo).toBe('sol');
    expect(descreverTempo(95).tipo).toBe('tempestade');
    expect(descreverTempo(45).tipo).toBe('neblina');
    expect(urlPrevisao()).toContain('latitude=-25.4284');
    expect(urlPrevisao()).toContain('forecast_days=16');
  });
});
