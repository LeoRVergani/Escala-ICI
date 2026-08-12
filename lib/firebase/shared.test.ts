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

  it('aceita os novos perfis/escopo do modelo organizacional flexível', () => {
    const usuario = lerUsuario('renato.pires', {
      nome: 'Renato Pires',
      equipeId: 'EQ_SOC',
      nivelHierarquico: 3,
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
    });
    expect(usuario.perfil).toBe('GESTOR_UNIDADE');
    expect(usuario.escopo).toBe('UNIDADE');
  });

  it('lê unidadeId/unidadesPermitidas/equipesPermitidas quando presentes', () => {
    const usuario = lerUsuario('renato.pires', {
      nome: 'Renato Pires',
      equipeId: 'EQ_SOC',
      nivelHierarquico: 3,
      unidadeId: 'GEDSI',
      unidadesPermitidas: ['GEDSI', 'COSI'],
      equipesPermitidas: ['EQ_SOC', 'EQ_NOC'],
    });
    expect(usuario.unidadeId).toBe('GEDSI');
    expect(usuario.unidadesPermitidas).toEqual(['GEDSI', 'COSI']);
    expect(usuario.equipesPermitidas).toEqual(['EQ_SOC', 'EQ_NOC']);
  });

  it('devolve undefined para unidadeId/unidadesPermitidas/equipesPermitidas ausentes (compat com usuário antigo)', () => {
    const usuario = lerUsuario('marina.azevedo', {
      nome: 'Marina Azevedo',
      equipeId: 'EQ_SOC',
      nivelHierarquico: 4,
    });
    expect(usuario.unidadeId).toBeUndefined();
    expect(usuario.unidadesPermitidas).toBeUndefined();
    expect(usuario.equipesPermitidas).toBeUndefined();
  });
});
