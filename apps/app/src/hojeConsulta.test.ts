import { describe, expect, it } from 'vitest';
import {
  classificarDiaSemana,
  ehDiaConsultadoHoje,
  tituloEquipeConsultada,
} from './hojeConsulta';

describe('ehDiaConsultadoHoje', () => {
  it('é verdadeiro quando a data consultada é a mesma de hoje', () => {
    expect(ehDiaConsultadoHoje('2026-08-14', '2026-08-14')).toBe(true);
  });

  it('é falso quando a data consultada é diferente de hoje', () => {
    expect(ehDiaConsultadoHoje('2026-08-15', '2026-08-14')).toBe(false);
  });
});

describe('tituloEquipeConsultada', () => {
  it('usa "Equipe escalada hoje" quando a consulta é o dia atual', () => {
    expect(tituloEquipeConsultada('2026-08-14', '2026-08-14')).toBe('Equipe escalada hoje');
  });

  it('usa dia da semana e data curta quando a consulta é outro dia', () => {
    // 2026-08-15 é um sábado.
    expect(tituloEquipeConsultada('2026-08-15', '2026-08-14')).toBe('Equipe escalada — Sáb, 15/08');
  });

  it('funciona atravessando a virada de mês', () => {
    // 2026-09-01 é uma terça-feira.
    expect(tituloEquipeConsultada('2026-09-01', '2026-08-28')).toBe('Equipe escalada — Ter, 01/09');
  });
});

describe('classificarDiaSemana', () => {
  it('marca apenas "today" quando não há data selecionada', () => {
    const estado = classificarDiaSemana('2026-08-14', '2026-08-14', undefined);
    expect(estado.ehHoje).toBe(true);
    expect(estado.ehSelecionado).toBe(false);
    expect(estado.classes).toBe('today');
  });

  it('marca "today" e "selected" quando a consulta ainda é hoje', () => {
    const estado = classificarDiaSemana('2026-08-14', '2026-08-14', '2026-08-14');
    expect(estado.ehHoje).toBe(true);
    expect(estado.ehSelecionado).toBe(true);
    expect(estado.classes).toBe('today selected');
  });

  it('marca apenas "selected" para um dia diferente de hoje escolhido pelo usuário', () => {
    const estado = classificarDiaSemana('2026-08-15', '2026-08-14', '2026-08-15');
    expect(estado.ehHoje).toBe(false);
    expect(estado.ehSelecionado).toBe(true);
    expect(estado.classes).toBe('selected');
  });

  it('não marca nada para um dia neutro da faixa semanal', () => {
    const estado = classificarDiaSemana('2026-08-16', '2026-08-14', '2026-08-15');
    expect(estado.ehHoje).toBe(false);
    expect(estado.ehSelecionado).toBe(false);
    expect(estado.classes).toBe('');
  });
});
