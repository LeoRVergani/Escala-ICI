import { describe, expect, it } from 'vitest';

import {
  derivarPadroesHorarioPlantao,
  padraoHorarioCorrespondente,
  padraoHorarioParaValores,
} from './horariosPlantao';

describe('horariosPlantao', () => {
  it('deduplica padrões do grupo e mantém a ordem visual oficial', () => {
    const padroes = derivarPadroesHorarioPlantao([
      { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 },
      { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
      { diaSemana: 1, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
      { diaSemana: 6, horaInicio: '19:00', horaFim: '00:00', fimDiaOffset: 1 },
    ]);

    expect(padroes).toHaveLength(3);
    expect(padroes.map((padrao) => padrao.titulo)).toEqual(['Noturno', '5 horas', '24 horas']);
    expect(padroes.map((padrao) => padrao.tom)).toEqual(['noite', 'noite', 'vinte-quatro-horas']);
  });

  it('oferece os três presets de compatibilidade para grupos antigos sem padrão', () => {
    const padroes = derivarPadroesHorarioPlantao(undefined);
    expect(padroes.map((padrao) => padrao.subtitulo)).toEqual([
      '19:00 → 07:00 · 12h',
      '19:00 → 00:00 · 5h',
      '19:00 → 19:00 · 24h',
    ]);
  });

  it('calcula o dia final seguinte para padrões noturnos, 5h e 24h', () => {
    const [noturno, cincoHoras, vinteQuatro] = derivarPadroesHorarioPlantao(undefined);
    expect(padraoHorarioParaValores(noturno, '2026-08-25').dataFinal).toBe('2026-08-26');
    expect(padraoHorarioParaValores(cincoHoras, '2026-08-25')).toEqual({
      dataFinal: '2026-08-26',
      horaInicial: '19:00',
      horaFinal: '00:00',
    });
    expect(padraoHorarioParaValores(vinteQuatro, '2026-08-31').dataFinal).toBe('2026-09-01');
  });

  it('reconhece o padrão selecionado em uma atribuição existente', () => {
    const padroes = derivarPadroesHorarioPlantao(undefined);
    expect(padraoHorarioCorrespondente(padroes, '19:00', '07:00', '2026-08-10', '2026-08-11')?.titulo).toBe('Noturno');
    expect(padraoHorarioCorrespondente(padroes, '19:00', '00:00', '2026-08-10', '2026-08-11')?.titulo).toBe('5 horas');
    expect(padraoHorarioCorrespondente(padroes, '18:00', '23:00', '2026-08-10', '2026-08-10')).toBeNull();
  });
});
