import { describe, expect, it } from 'vitest';

import {
  avisoCargoDivergenteDaEquipe,
  montarCamposAcessoUsuario,
  resumoAcessoUsuario,
  tipoAcessoDoUsuario,
  validarCoerenciaAcessoUsuario,
  validarSelecaoAcessoUsuario,
} from './perfilAcessoUsuario';

const UNIDADE_DA_EQUIPE_NOC = (equipeId: string) => (equipeId === 'GEDSI_CODB_NOC' ? 'CODB' : undefined);

describe('montarCamposAcessoUsuario', () => {
  it('1. Colaborador: perfil/escopo vazios, equipeId = equipe escolhida, sem equipesPermitidas', () => {
    const campos = montarCamposAcessoUsuario({ tipo: 'COLABORADOR', equipeId: 'EQ_NOC' });
    expect(campos).toEqual({
      perfil: undefined,
      escopo: undefined,
      equipeId: 'EQ_NOC',
      equipesPermitidas: [],
      unidadeId: undefined,
      unidadesPermitidas: [],
      nivelHierarquico: 6,
    });
  });

  it('2. Supervisor de equipe: perfil/escopo automáticos, equipeId e equipesPermitidas com a mesma equipe', () => {
    const campos = montarCamposAcessoUsuario(
      { tipo: 'SUPERVISOR_EQUIPE', equipeId: 'GEDSI_CODB_NOC' },
      { unidadeDaEquipe: UNIDADE_DA_EQUIPE_NOC },
    );
    expect(campos).toEqual({
      perfil: 'SUPERVISOR_EQUIPE',
      escopo: 'EQUIPE',
      equipeId: 'GEDSI_CODB_NOC',
      equipesPermitidas: ['GEDSI_CODB_NOC'],
      unidadeId: 'CODB',
      unidadesPermitidas: [],
      nivelHierarquico: 5,
    });
  });

  it('3. Gestor de equipe: mesmo formato do Supervisor, perfil diferente', () => {
    const campos = montarCamposAcessoUsuario({ tipo: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC' });
    expect(campos.perfil).toBe('GESTOR_EQUIPE');
    expect(campos.escopo).toBe('EQUIPE');
    expect(campos.equipeId).toBe('EQ_SOC');
    expect(campos.equipesPermitidas).toEqual(['EQ_SOC']);
  });

  it('4. Gestor de unidade: escopo UNIDADE, unidadeId e unidadesPermitidas com a mesma unidade, sem equipe', () => {
    const campos = montarCamposAcessoUsuario({ tipo: 'GESTOR_UNIDADE', unidadeId: 'CODB' });
    expect(campos).toEqual({
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
      equipeId: undefined,
      equipesPermitidas: [],
      unidadeId: 'CODB',
      unidadesPermitidas: ['CODB'],
      nivelHierarquico: 4,
    });
  });

  it('5. Administrador do sistema: perfil ADMIN_SISTEMA, escopo GLOBAL, sem equipe/unidade', () => {
    const campos = montarCamposAcessoUsuario({ tipo: 'ADMIN_SISTEMA', confirmaAcessoGlobal: true });
    expect(campos).toEqual({
      perfil: 'ADMIN_SISTEMA',
      escopo: 'GLOBAL',
      equipeId: undefined,
      equipesPermitidas: [],
      unidadeId: undefined,
      unidadesPermitidas: [],
      nivelHierarquico: 0,
    });
  });

  it('6. Caso Wanessa/NOC: Supervisor de equipe > GEDSI_CODB_NOC gera equipeId e equipesPermitidas corretos', () => {
    const campos = montarCamposAcessoUsuario(
      { tipo: 'SUPERVISOR_EQUIPE', equipeId: 'GEDSI_CODB_NOC' },
      { unidadeDaEquipe: UNIDADE_DA_EQUIPE_NOC },
    );
    expect(campos.equipeId).toBe('GEDSI_CODB_NOC');
    expect(campos.equipesPermitidas).toEqual(['GEDSI_CODB_NOC']);
    expect(campos.equipeId).not.toBe('ADMIN_ICI');
  });

  it('7. equipeId ausente na seleção de Supervisor/Gestor de equipe não inventa nada — fica undefined', () => {
    const campos = montarCamposAcessoUsuario({ tipo: 'SUPERVISOR_EQUIPE' });
    expect(campos.equipeId).toBeUndefined();
    expect(campos.equipesPermitidas).toEqual([]);
  });
});

describe('validarSelecaoAcessoUsuario', () => {
  it('7. Supervisor de equipe não permite salvar sem equipe', () => {
    expect(validarSelecaoAcessoUsuario({ tipo: 'SUPERVISOR_EQUIPE' })).toEqual([
      'Selecione a equipe supervisionada.',
    ]);
    expect(validarSelecaoAcessoUsuario({ tipo: 'SUPERVISOR_EQUIPE', equipeId: '   ' }).length).toBe(1);
  });

  it('gestor de equipe não permite salvar sem equipe', () => {
    expect(validarSelecaoAcessoUsuario({ tipo: 'GESTOR_EQUIPE' })).toEqual([
      'Selecione a equipe gerenciada.',
    ]);
  });

  it('8. Gestor de unidade não permite salvar sem unidade', () => {
    expect(validarSelecaoAcessoUsuario({ tipo: 'GESTOR_UNIDADE' })).toEqual([
      'Selecione a unidade gerenciada.',
    ]);
  });

  it('9. Admin sistema exige confirmação explícita de acesso global', () => {
    expect(validarSelecaoAcessoUsuario({ tipo: 'ADMIN_SISTEMA' })).toEqual([
      'Confirme que este usuário deve ter acesso administrativo global.',
    ]);
    expect(validarSelecaoAcessoUsuario({ tipo: 'ADMIN_SISTEMA', confirmaAcessoGlobal: true })).toEqual([]);
  });

  it('Colaborador sem equipe não gera erro de seleção (equipe é opcional na validação simples)', () => {
    expect(validarSelecaoAcessoUsuario({ tipo: 'COLABORADOR' })).toEqual([]);
  });
});

describe('validarCoerenciaAcessoUsuario', () => {
  it('rejeita SUPERVISOR_EQUIPE com escopo GLOBAL', () => {
    expect(validarCoerenciaAcessoUsuario({ perfil: 'SUPERVISOR_EQUIPE', escopo: 'GLOBAL', equipeId: 'EQ_NOC' }))
      .toContain('Supervisor de equipe não pode ter escopo GLOBAL.');
  });

  it('rejeita GESTOR_EQUIPE com escopo GLOBAL', () => {
    expect(validarCoerenciaAcessoUsuario({ perfil: 'GESTOR_EQUIPE', escopo: 'GLOBAL', equipeId: 'EQ_SOC' }))
      .toContain('Gestor de equipe não pode ter escopo GLOBAL.');
  });

  it('rejeita GESTOR_UNIDADE sem unidade', () => {
    expect(validarCoerenciaAcessoUsuario({ perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE' }))
      .toContain('Gestor de unidade precisa de uma unidade definida.');
  });

  it('rejeita SUPERVISOR_EQUIPE sem equipe', () => {
    expect(validarCoerenciaAcessoUsuario({ perfil: 'SUPERVISOR_EQUIPE', escopo: 'EQUIPE' }))
      .toContain('Supervisor/Gestor de equipe precisa de uma equipe definida.');
  });

  it('não gera erro para uma combinação coerente', () => {
    expect(validarCoerenciaAcessoUsuario({
      perfil: 'SUPERVISOR_EQUIPE',
      escopo: 'EQUIPE',
      equipeId: 'GEDSI_CODB_NOC',
    })).toEqual([]);
  });
});

describe('tipoAcessoDoUsuario', () => {
  it('deriva cada tipo a partir do perfil salvo, e COLABORADOR quando ausente', () => {
    expect(tipoAcessoDoUsuario({ perfil: 'ADMIN_SISTEMA' })).toBe('ADMIN_SISTEMA');
    expect(tipoAcessoDoUsuario({ perfil: 'GESTOR_UNIDADE' })).toBe('GESTOR_UNIDADE');
    expect(tipoAcessoDoUsuario({ perfil: 'GESTOR_EQUIPE' })).toBe('GESTOR_EQUIPE');
    expect(tipoAcessoDoUsuario({ perfil: 'SUPERVISOR_EQUIPE' })).toBe('SUPERVISOR_EQUIPE');
    expect(tipoAcessoDoUsuario({ perfil: 'ANALISTA_SOC' })).toBe('COLABORADOR');
    expect(tipoAcessoDoUsuario({})).toBe('COLABORADOR');
  });
});

describe('avisoCargoDivergenteDaEquipe', () => {
  const equipes = [
    { id: 'EQ_NOC', nome: 'NOC', sigla: 'NOC' },
    { id: 'EQ_SOC', nome: 'SOC', sigla: 'SOC' },
  ];

  it('avisa quando o cargo menciona uma equipe diferente da atribuída (aviso visual, não bloqueante)', () => {
    expect(avisoCargoDivergenteDaEquipe('Supervisora de NOC', 'EQ_SOC', equipes)).toContain('NOC');
  });

  it('não avisa quando o cargo menciona a própria equipe atribuída', () => {
    expect(avisoCargoDivergenteDaEquipe('Supervisora de NOC', 'EQ_NOC', equipes)).toBeUndefined();
  });

  it('não avisa quando o cargo não menciona nenhuma equipe conhecida', () => {
    expect(avisoCargoDivergenteDaEquipe('Analista Sênior', 'EQ_NOC', equipes)).toBeUndefined();
  });
});

describe('resumoAcessoUsuario', () => {
  it('Supervisor/Gestor de equipe: resumo cita a equipe resolvida, nunca um nome fixo', () => {
    const resumo = resumoAcessoUsuario(
      { perfil: 'SUPERVISOR_EQUIPE', escopo: 'EQUIPE' },
      { rotuloEquipe: 'NOC' },
    );
    expect(resumo.some((linha) => linha.includes('NOC'))).toBe(true);
    expect(resumo.some((linha) => linha.includes('NÃO terá acesso administrativo global'))).toBe(true);
  });

  it('Gestor de unidade: resumo cita a unidade resolvida', () => {
    const resumo = resumoAcessoUsuario(
      { perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE' },
      { rotuloUnidade: 'CODB' },
    );
    expect(resumo.some((linha) => linha.includes('CODB'))).toBe(true);
  });

  it('Admin sistema/escopo GLOBAL: resumo avisa acesso global', () => {
    const resumo = resumoAcessoUsuario({ perfil: 'ADMIN_SISTEMA', escopo: 'GLOBAL' }, {});
    expect(resumo.some((linha) => linha.includes('GLOBAL'))).toBe(true);
  });

  it('Colaborador: resumo indica ausência de acesso administrativo', () => {
    const resumo = resumoAcessoUsuario({ perfil: undefined, escopo: undefined }, {});
    expect(resumo.some((linha) => linha.includes('não terá nenhum acesso administrativo'))).toBe(true);
  });
});
