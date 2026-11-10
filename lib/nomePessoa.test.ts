import { describe, expect, it } from 'vitest';

import { normalizarNomePessoa } from './nomePessoa';

describe('NOME-SEM-ESPACOS-1 — nome sempre limpo', () => {
  it('tira espaços do começo/fim e junta os repetidos', () => {
    expect(normalizarNomePessoa(' Daniel Silva')).toBe('Daniel Silva');
    expect(normalizarNomePessoa('Daniel  Silva  ')).toBe('Daniel Silva');
    expect(normalizarNomePessoa('\tAna\n Paula ')).toBe('Ana Paula');
  });

  it('remove o espaço "invisível" que vem do Excel/web', () => {
    expect(normalizarNomePessoa('\u00a0Leonardo\u00a0Vergani\u00a0')).toBe('Leonardo Vergani');
    expect(normalizarNomePessoa('\ufeffCarlos\u200b Gabriel')).toBe('Carlos Gabriel');
  });

  it('nome já limpo continua igual (acentos e hífen preservados)', () => {
    expect(normalizarNomePessoa('João Guilherme Pedroso Frankl')).toBe('João Guilherme Pedroso Frankl');
    expect(normalizarNomePessoa('Ana-Luíza D’Ávila')).toBe('Ana-Luíza D’Ávila');
  });
});
