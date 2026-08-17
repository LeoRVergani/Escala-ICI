import { describe, expect, it } from 'vitest';
import type { PadraoHorarioPlantaoDia } from '@escala-ici/contrato';

import {
  alternarDiaNoPadraoHorarioSemanal,
  atualizarDiaNoPadraoHorarioSemanal,
  previewPadraoHorarioPlantaoDia,
} from './PadraoHorarioSemanalCampo';

/**
 * Fase PLANTAO-PADRAO-1 — testa a lógica pura por trás de
 * `PadraoHorarioSemanalCampo` (toggle de dia, edição de campo, preview
 * humano), sem renderizar nenhum DOM: este projeto não usa uma biblioteca
 * de testes de componente, então a lógica de interação vive em funções
 * puras exportadas e testáveis diretamente (§ 38 do pedido — evitar
 * testes frágeis dependentes de pixel).
 */

describe('alternarDiaNoPadraoHorarioSemanal — habilitar/desabilitar dia', () => {
  it('habilitar um dia sem padrão cria uma entrada vazia (nunca um horário pré-preenchido)', () => {
    const resultado = alternarDiaNoPadraoHorarioSemanal(undefined, 0);
    expect(resultado).toEqual([{ diaSemana: 0, horaInicio: '', horaFim: '', fimDiaOffset: 0 }]);
  });

  it('habilitar um dia preserva os dias já configurados', () => {
    const atual: PadraoHorarioPlantaoDia[] = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 }];
    const resultado = alternarDiaNoPadraoHorarioSemanal(atual, 5);
    expect(resultado?.map((entrada) => entrada.diaSemana).sort()).toEqual([1, 5]);
  });

  it('desabilitar o único dia configurado remove a entrada — resultado vira undefined, nunca []', () => {
    const atual: PadraoHorarioPlantaoDia[] = [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }];
    const resultado = alternarDiaNoPadraoHorarioSemanal(atual, 0);
    expect(resultado).toBeUndefined();
  });

  it('desabilitar um dia entre vários remove só aquela entrada', () => {
    const atual: PadraoHorarioPlantaoDia[] = [
      { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
      { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 },
    ];
    const resultado = alternarDiaNoPadraoHorarioSemanal(atual, 0);
    expect(resultado).toEqual([{ diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 }]);
  });
});

describe('atualizarDiaNoPadraoHorarioSemanal — editar início/fim/dia seguinte', () => {
  const BASE: PadraoHorarioPlantaoDia[] = [{ diaSemana: 0, horaInicio: '', horaFim: '', fimDiaOffset: 0 }];

  it('alterar início só muda o campo alterado, preservando os demais', () => {
    const resultado = atualizarDiaNoPadraoHorarioSemanal(BASE, 0, { horaInicio: '19:00' });
    expect(resultado).toEqual([{ diaSemana: 0, horaInicio: '19:00', horaFim: '', fimDiaOffset: 0 }]);
  });

  it('alterar fim só muda o campo alterado', () => {
    const resultado = atualizarDiaNoPadraoHorarioSemanal(BASE, 0, { horaFim: '07:00' });
    expect(resultado).toEqual([{ diaSemana: 0, horaInicio: '', horaFim: '07:00', fimDiaOffset: 0 }]);
  });

  it('marcar "dia seguinte" muda fimDiaOffset para 1', () => {
    const resultado = atualizarDiaNoPadraoHorarioSemanal(BASE, 0, { fimDiaOffset: 1 });
    expect(resultado[0]?.fimDiaOffset).toBe(1);
  });

  it('não afeta entradas de outros dias', () => {
    const doisD: PadraoHorarioPlantaoDia[] = [
      { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
      { diaSemana: 5, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 },
    ];
    const resultado = atualizarDiaNoPadraoHorarioSemanal(doisD, 0, { horaInicio: '20:00' });
    expect(resultado.find((entrada) => entrada.diaSemana === 5)).toEqual(doisD[1]);
  });
});

describe('previewPadraoHorarioPlantaoDia — resumo humano, nunca expõe fimDiaOffset cru', () => {
  it('12h — 19:00 → 07:00 (+1 dia)', () => {
    const preview = previewPadraoHorarioPlantaoDia({ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 });
    expect(preview.valida).toBe(true);
    expect(preview.texto).toBe('19:00 → 07:00 (+1 dia) · 12h');
  });

  it('24h — 19:00 → 19:00 (+1 dia)', () => {
    const preview = previewPadraoHorarioPlantaoDia({ diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 });
    expect(preview.valida).toBe(true);
    expect(preview.texto).toBe('19:00 → 19:00 (+1 dia) · 24h');
  });

  it('mesmo dia (sem "+1 dia") não mostra sufixo', () => {
    const preview = previewPadraoHorarioPlantaoDia({ diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 });
    expect(preview.texto).toBe('08:00 → 18:00 · 10h');
  });

  it('campos ainda vazios (dia recém-habilitado) são inválidos, nunca calculam duração', () => {
    const preview = previewPadraoHorarioPlantaoDia({ diaSemana: 0, horaInicio: '', horaFim: '', fimDiaOffset: 0 });
    expect(preview.valida).toBe(false);
  });

  it('19:00 → 19:00 (+0 dia) é inválido — duração zero', () => {
    const preview = previewPadraoHorarioPlantaoDia({ diaSemana: 0, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 0 });
    expect(preview.valida).toBe(false);
  });

  it('nunca inclui "fimDiaOffset" no texto exibido', () => {
    const preview = previewPadraoHorarioPlantaoDia({ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 });
    expect(preview.texto.toLowerCase()).not.toContain('offset');
  });
});
