import { describe, expect, it } from 'vitest';

import { avisosDevidos, avisosDoLembrete, type LembreteParaAviso } from '../src/agendadorLembretes.js';

const estudar: LembreteParaAviso = {
  lembreteId: 'l1', login: 'ana', tipo: 'PESSOAL', titulo: 'Estudar para a certificação',
  data: '2026-11-10', diaInteiro: false, horaInicio: '14:00', alertasAntecedenciaMin: [5],
};

describe('LEMBRETE-ALARME-1 — aviso dos lembretes', () => {
  it('5 min antes: 13:55, com o título e o horário', () => {
    const [aviso] = avisosDoLembrete(estudar);
    expect(aviso?.quando).toBe('2026-11-10T13:55');
    expect(aviso?.titulo).toBe('⏰ Estudar para a certificação');
    expect(aviso?.corpo).toBe('Hoje às 14:00 (em 5 min).');
  });

  it('no horário, 1 h antes e 1 dia antes', () => {
    const avisos = avisosDoLembrete({ ...estudar, alertasAntecedenciaMin: [0, 60, 1440] });
    expect(avisos.map((a) => a.quando)).toEqual(['2026-11-10T14:00', '2026-11-10T13:00', '2026-11-09T14:00']);
    expect(avisos[2]?.corpo).toBe('Amanhã às 14:00 (amanhã).');
  });

  it('dia inteiro conta a partir das 08:00; sem aviso ou sem horário não avisa', () => {
    expect(avisosDoLembrete({ ...estudar, diaInteiro: true, horaInicio: null, alertasAntecedenciaMin: [0] })[0]?.quando).toBe('2026-11-10T08:00');
    expect(avisosDoLembrete({ ...estudar, diaInteiro: true, horaInicio: null, alertasAntecedenciaMin: [1440] })[0]?.quando).toBe('2026-11-09T08:00');
    expect(avisosDoLembrete({ ...estudar, alertasAntecedenciaMin: [] })).toEqual([]);
    expect(avisosDoLembrete({ ...estudar, horaInicio: null })).toEqual([]);
  });

  it('só vence dentro da janela de 5 minutos', () => {
    const avisos = avisosDoLembrete(estudar);
    expect(avisosDevidos(avisos, '2026-11-10T13:54')).toHaveLength(0);
    expect(avisosDevidos(avisos, '2026-11-10T13:55')).toHaveLength(1);
    expect(avisosDevidos(avisos, '2026-11-10T13:59')).toHaveLength(1);
    expect(avisosDevidos(avisos, '2026-11-10T14:00')).toHaveLength(0);
  });
});
