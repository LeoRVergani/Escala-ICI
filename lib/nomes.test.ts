import { describe, expect, it } from 'vitest';

import { normalizarNome } from './nomes';

describe('normalização de nome', () => {
  it('remove acentos, aplica trim e converte para minúsculas', () => {
    expect(normalizarNome('Caio Monteiro')).toBe('caio monteiro');
    expect(normalizarNome('CAIO MONTEIRO')).toBe('caio monteiro');
    expect(normalizarNome('  Caio Monteiro  ')).toBe('caio monteiro');
    expect(normalizarNome('Íris Porto')).toBe('iris porto');
  });

  it('reduz espaços internos duplicados', () => {
    expect(normalizarNome('Caio   Monteiro')).toBe('caio monteiro');
    expect(normalizarNome('Caio\tMonteiro')).toBe('caio monteiro');
  });

  it('não aproxima abreviações a nomes completos', () => {
    expect(normalizarNome('Caio M.')).not.toBe(normalizarNome('Caio Monteiro'));
    expect(normalizarNome('Caio M.')).toBe('caio m.');
  });

  it('é previsível e idempotente', () => {
    const normalizado = normalizarNome('Ana Beatriz Souza');
    expect(normalizarNome(normalizado)).toBe(normalizado);
  });
});
