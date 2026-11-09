import { describe, expect, it } from 'vitest';

import { gestoresParaAvisar } from './trocasRepository';

describe('AVISO-GESTOR-6X1-1 — quem aprova recebe o aviso quando o colega aceita', () => {
  it('responsáveis do escopo, sem os dois envolvidos e sem repetir', () => {
    expect(gestoresParaAvisar({ ativo: true, responsaveisLogin: ['coord', 'ana', 'lider', 'coord'] }, ['ana', 'bruno'])).toEqual(['coord', 'lider']);
  });
  it('escopo inexistente ou inativo: ninguém', () => {
    expect(gestoresParaAvisar(null, ['ana'])).toEqual([]);
    expect(gestoresParaAvisar({ ativo: false, responsaveisLogin: ['coord'] }, ['ana'])).toEqual([]);
  });
});
