import { describe, expect, it } from 'vitest';

import {
  horarioDentroDoTurno,
  preferenciasAlertasTurnoPadrao,
  sugerirHorarioIntervalo,
  validarPreferenciasAlertasTurno,
} from '../src/alertasTurno.js';

describe('ALERTAS-TURNO-1 — preferências dos avisos do turno', () => {
  it('sugere o meio do turno, inclusive no que passa da meia-noite', () => {
    expect(sugerirHorarioIntervalo('07:00', '13:00')).toBe('10:00');
    expect(sugerirHorarioIntervalo('19:00', '01:00')).toBe('22:00');
    expect(sugerirHorarioIntervalo('01:00', '07:00')).toBe('04:00');
  });

  it('confere se o horário cai dentro do turno', () => {
    expect(horarioDentroDoTurno('10:00', '07:00', '13:00')).toBe(true);
    expect(horarioDentroDoTurno('14:00', '07:00', '13:00')).toBe(false);
    expect(horarioDentroDoTurno('00:30', '19:00', '01:00')).toBe(true);
    expect(horarioDentroDoTurno('02:00', '19:00', '01:00')).toBe(false);
    expect(horarioDentroDoTurno('25:00', '07:00', '13:00')).toBe(false);
  });

  it('padrão válido; valores fora do limite viram erro', () => {
    const padrao = preferenciasAlertasTurnoPadrao('ana');
    expect(validarPreferenciasAlertasTurno(padrao)).toEqual([]);
    const ruim = { ...padrao, avisoAntes: { ativo: true, minutos: 5 }, intervalo: { ativo: true, duracaoMinutos: 15, horarios: { M: '9h' } } };
    expect(validarPreferenciasAlertasTurno(ruim)).toHaveLength(2);
  });
});
