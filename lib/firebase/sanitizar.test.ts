import { describe, expect, it } from 'vitest';

import { removerUndefined } from './sanitizar';

describe('removerUndefined', () => {
  it('remove campos com valor undefined', () => {
    expect(removerUndefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('remove undefined em vários níveis de aninhamento', () => {
    expect(removerUndefined({
      a: 1,
      b: { c: undefined, d: 2, e: { f: undefined, g: 3 } },
    })).toEqual({
      a: 1,
      b: { d: 2, e: { g: 3 } },
    });
  });

  it('preserva null — só remove undefined', () => {
    expect(removerUndefined({ a: null, b: undefined, c: 0, d: '' })).toEqual({
      a: null,
      c: 0,
      d: '',
    });
  });

  it('preserva arrays, inclusive removendo undefined de dentro de objetos no array', () => {
    expect(removerUndefined({
      lista: [1, 2, { a: undefined, b: 3 }],
    })).toEqual({
      lista: [1, 2, { b: 3 }],
    });
  });

  it('preserva objetos aninhados sem achatar a estrutura', () => {
    const entrada = { usuario: { nome: 'Ana', endereco: { cidade: 'SP', uf: undefined } } };
    expect(removerUndefined(entrada)).toEqual({
      usuario: { nome: 'Ana', endereco: { cidade: 'SP' } },
    });
  });

  it('preserva instâncias que não são objetos literais simples (ex.: sentinels do Firestore)', () => {
    class FieldValueFalso {
      _tipo = 'serverTimestamp';
    }
    const sentinela = new FieldValueFalso();
    const resultado = removerUndefined({ atualizadoEm: sentinela, nome: 'Ana' });
    expect(resultado.atualizadoEm).toBe(sentinela);
    expect(resultado.nome).toBe('Ana');
  });

  it('preserva instâncias de Date sem convertê-las em objeto simples', () => {
    const data = new Date('2026-08-05T00:00:00Z');
    const resultado = removerUndefined({ criadoEm: data });
    expect(resultado.criadoEm).toBe(data);
  });

  it('não modifica um objeto que já não tem undefined', () => {
    const entrada = { a: 1, b: 'x', c: [1, 2, 3], d: null };
    expect(removerUndefined(entrada)).toEqual(entrada);
  });

  it('funciona com o caso real do bug: usuário antigo sem criadoEm', () => {
    const usuarioAntigo = {
      uid: 'usuario-a960',
      nome: 'Colaborador Antigo',
      criadoEm: undefined,
      atualizadoEm: undefined,
      aliasesPlanilha: ['Alias 1'],
      ativo: true,
    };
    const resultado = removerUndefined(usuarioAntigo);
    expect(resultado).not.toHaveProperty('criadoEm');
    expect(resultado).not.toHaveProperty('atualizadoEm');
    expect(resultado.aliasesPlanilha).toEqual(['Alias 1']);
    expect(resultado.ativo).toBe(true);
  });
});
