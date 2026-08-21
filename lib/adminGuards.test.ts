import { describe, expect, it } from 'vitest';

import {
  cadastroUsuarioConcedeGestao,
  exclusaoZeraGestores,
  perfilDelegavelPorResponsavelOperacional,
  podeExcluirCompetencia,
  podeExcluirUsuario,
} from './adminGuards';
import type { Usuario } from './modelos';

function usuario(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    login: 'fulano',
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    cargo: 'ANALISTA_SOC',
    equipeId: 'EQ_SOC',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...sobrescritas,
  };
}

describe('podeExcluirUsuario', () => {
  it('bloqueia a autoexclusão do admin logado', () => {
    const admin = usuario({ login: 'admin', perfil: 'ADMIN_SISTEMA' });
    expect(podeExcluirUsuario(admin, admin)).toBe(false);
  });

  it('permite excluir qualquer outro usuário', () => {
    const admin = usuario({ login: 'admin', perfil: 'ADMIN_SISTEMA' });
    const candidato = usuario({ login: 'candidato' });
    expect(podeExcluirUsuario(candidato, admin)).toBe(true);
  });
});

describe('cadastroUsuarioConcedeGestao', () => {
  it('detecta perfil explícito de coordenação/supervisão', () => {
    expect(cadastroUsuarioConcedeGestao(usuario({ perfil: 'GESTOR_EQUIPE' }))).toBe(true);
    expect(cadastroUsuarioConcedeGestao(usuario({ perfil: 'GESTOR_UNIDADE' }))).toBe(true);
    expect(cadastroUsuarioConcedeGestao(usuario({ perfil: 'SUPERVISOR_EQUIPE' }))).toBe(true);
  });

  it('detecta a promoção implícita do fallback legado por nível', () => {
    expect(cadastroUsuarioConcedeGestao(usuario({ perfil: undefined, nivelHierarquico: 4 }))).toBe(true);
    expect(cadastroUsuarioConcedeGestao(usuario({ perfil: undefined, nivelHierarquico: 6 }))).toBe(false);
  });

  it('não trata perfil explícito de colaborador como gestão, mesmo com nível organizacional baixo', () => {
    expect(cadastroUsuarioConcedeGestao(usuario({ perfil: 'ANALISTA_SOC', nivelHierarquico: 4 }))).toBe(false);
  });
});

describe('perfilDelegavelPorResponsavelOperacional', () => {
  it('permite apenas coordenação e supervisão da própria equipe', () => {
    expect(perfilDelegavelPorResponsavelOperacional('GESTOR_EQUIPE')).toBe(true);
    expect(perfilDelegavelPorResponsavelOperacional('SUPERVISOR_EQUIPE')).toBe(true);
  });

  it('não permite administração global, gestão de unidade ou perfil comum', () => {
    expect(perfilDelegavelPorResponsavelOperacional('ADMIN_SISTEMA')).toBe(false);
    expect(perfilDelegavelPorResponsavelOperacional('GESTOR_UNIDADE')).toBe(false);
    expect(perfilDelegavelPorResponsavelOperacional('ANALISTA_SOC')).toBe(false);
    expect(perfilDelegavelPorResponsavelOperacional(undefined)).toBe(false);
  });
});

describe('exclusaoZeraGestores', () => {
  it('detecta quando a exclusão deixaria zero gestores/admins', () => {
    const usuarios = [
      usuario({ login: 'unico.gestor', perfil: 'GESTOR_EQUIPE' }),
      usuario({ login: 'analista1' }),
      usuario({ login: 'analista2' }),
    ];
    expect(exclusaoZeraGestores(usuarios, 'unico.gestor')).toBe(true);
  });

  it('não aciona quando ainda resta outro gestor ou admin', () => {
    const usuarios = [
      usuario({ login: 'gestor1', perfil: 'GESTOR_EQUIPE' }),
      usuario({ login: 'gestor2', perfil: 'GESTOR_EQUIPE' }),
      usuario({ login: 'admin', perfil: 'ADMIN_SISTEMA' }),
    ];
    expect(exclusaoZeraGestores(usuarios, 'gestor1')).toBe(false);
  });

  it('nunca aciona ao excluir um analista comum', () => {
    const usuarios = [
      usuario({ login: 'unico.gestor', perfil: 'GESTOR_EQUIPE' }),
      usuario({ login: 'analista1' }),
    ];
    expect(exclusaoZeraGestores(usuarios, 'analista1')).toBe(false);
  });

  it('considera o fallback por nivelHierarquico quando perfil está ausente', () => {
    const usuarios = [
      usuario({ login: 'gestor.legado', nivelHierarquico: 4 }),
      usuario({ login: 'analista1', nivelHierarquico: 6 }),
    ];
    expect(exclusaoZeraGestores(usuarios, 'gestor.legado')).toBe(true);
  });
});

describe('podeExcluirCompetencia', () => {
  it('bloqueia a competência atual', () => {
    expect(podeExcluirCompetencia('2026-08', '2026-08')).toBe(false);
  });

  it('permite competências antigas', () => {
    expect(podeExcluirCompetencia('2026-07', '2026-08')).toBe(true);
  });
});
