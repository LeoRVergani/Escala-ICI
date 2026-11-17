import { describe, expect, it } from 'vitest';

import { cargoEhDeLideranca, PALAVRAS_CARGO_LIDERANCA } from './cargoLideranca';

describe('LIDERANCA-CARGO-1 — cargo de liderança', () => {
  it.each([
    'Coordenador de Segurança da Informação', 'Coordenadora', 'COORDENADOR_COSI', 'Supervisor de Operações', 'SUPERVISOR_EQUIPE',
    'Líder Técnico', 'LÍDER DE TURNO', 'lider', 'Gestor de Contratos', 'Gestora de Projetos', 'GESTOR_UNIDADE', 'Gerente de Infraestrutura', 'Diretor',
  ])('"%s" é cargo de liderança', (cargo) => {
    expect(cargoEhDeLideranca(cargo)).toBe(true);
  });

  it.each([
    'Analista de SOC', 'ANALISTA_SOC_SENIOR', 'Técnico de Redes', 'Estagiário', 'Assistente de Coordenação', 'Auxiliar Administrativo', '', '   ',
  ])('"%s" NÃO é cargo de liderança', (cargo) => {
    expect(cargoEhDeLideranca(cargo)).toBe(false);
  });

  it('cargo ausente nunca é liderança', () => {
    expect(cargoEhDeLideranca(undefined)).toBe(false);
    expect(cargoEhDeLideranca(null)).toBe(false);
  });

  it('a lista tem as palavras combinadas (e nenhuma de cargo operacional)', () => {
    expect([...PALAVRAS_CARGO_LIDERANCA]).toEqual(expect.arrayContaining(['coordenador', 'supervisor', 'lider', 'gestor']));
    for (const operacional of ['analista', 'tecnico', 'estagiario', 'assistente']) expect(PALAVRAS_CARGO_LIDERANCA).not.toContain(operacional);
  });
});
