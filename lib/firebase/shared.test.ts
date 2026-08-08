import { describe, expect, it } from 'vitest';

import { lerUsuario } from './shared';

describe('lerUsuario', () => {
  it('preserva perfil e escopo quando válidos', () => {
    const usuario = lerUsuario('paula.ferraz', {
      nome: 'Paula Ferraz',
      email: 'paula.ferraz@teste.local',
      cargo: 'ADMIN',
      equipeId: 'EQ_ADMIN',
      nivelHierarquico: 0,
      perfil: 'ADMIN_SISTEMA',
      escopo: 'GLOBAL',
    });
    expect(usuario.perfil).toBe('ADMIN_SISTEMA');
    expect(usuario.escopo).toBe('GLOBAL');
  });

  it('ignora perfil/escopo inválidos e devolve undefined', () => {
    const usuario = lerUsuario('fulano', {
      nome: 'Fulano',
      perfil: 'SUPER_ADMIN',
      escopo: 'MUNDIAL',
    });
    expect(usuario.perfil).toBeUndefined();
    expect(usuario.escopo).toBeUndefined();
  });

  it('devolve undefined quando o documento legado não tem perfil/escopo', () => {
    const usuario = lerUsuario('marina.azevedo', {
      nome: 'Marina Azevedo',
      equipeId: 'EQ_SOC',
      nivelHierarquico: 4,
    });
    expect(usuario.perfil).toBeUndefined();
    expect(usuario.escopo).toBeUndefined();
  });
});
