import { describe, expect, it } from 'vitest';

import type { Usuario } from './modelos';
import {
  chavePreferenciaSessao,
  deveExibirRestauracao,
  ehAdminSistema,
  escopoEfetivo,
  estadoInicialSessao,
  nivelPermiteDashboard,
  perfilEfetivo,
  podeIniciarListeners,
  preferenciaPadraoSessao,
  resolverManterConectado,
} from './sessao';

function usuarioBase(sobrescritas: Partial<Usuario> = {}): Usuario {
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

describe('preferência de sessão', () => {
  it('usa chaves distintas por produto', () => {
    expect(chavePreferenciaSessao('app')).toBe('escala-ici-sessao-app');
    expect(chavePreferenciaSessao('dashboard')).toBe('escala-ici-sessao-dashboard');
  });

  it('mantém o colaborador conectado por padrão e o gestor não', () => {
    expect(preferenciaPadraoSessao('app')).toBe(true);
    expect(preferenciaPadraoSessao('dashboard')).toBe(false);
    expect(resolverManterConectado('app', null)).toBe(true);
    expect(resolverManterConectado('dashboard', null)).toBe(false);
  });

  it('respeita a preferência gravada no dispositivo', () => {
    expect(resolverManterConectado('app', 'false')).toBe(false);
    expect(resolverManterConectado('dashboard', 'true')).toBe(true);
  });
});

describe('estado inicial da sessão', () => {
  it('começa restaurando quando o Firebase está configurado', () => {
    expect(estadoInicialSessao({
      firebaseConfigurado: true,
      restauracaoDelegada: false,
    })).toBe('restaurando');
  });

  it('não restaura sem Firebase configurado nem quando delegada', () => {
    expect(estadoInicialSessao({
      firebaseConfigurado: false,
      restauracaoDelegada: false,
    })).toBe('ausente');
    expect(estadoInicialSessao({
      firebaseConfigurado: true,
      restauracaoDelegada: true,
    })).toBe('ausente');
  });
});

describe('telas visíveis durante a restauração', () => {
  it('só mostra a tela de restauração enquanto a sessão não é resolvida', () => {
    expect(deveExibirRestauracao('restaurando')).toBe(true);
    expect(deveExibirRestauracao('ausente')).toBe(false);
    expect(deveExibirRestauracao('ativa')).toBe(false);
  });
});

describe('início dos listeners em tempo real', () => {
  const base = {
    estado: 'ativa',
    usuarioCarregado: true,
    dadosIniciaisCarregados: true,
    modoDemonstracao: false,
  } as const;

  it('inicia com sessão restaurada e carga inicial concluída', () => {
    expect(podeIniciarListeners(base)).toBe(true);
  });

  it('também inicia após login manual, quando a restauração já terminou', () => {
    expect(podeIniciarListeners({ ...base, estado: 'ausente' })).toBe(true);
  });

  it('não inicia durante a restauração', () => {
    expect(podeIniciarListeners({ ...base, estado: 'restaurando' })).toBe(false);
  });

  it('não inicia antes do usuário do Firestore e da carga inicial', () => {
    expect(podeIniciarListeners({ ...base, usuarioCarregado: false })).toBe(false);
    expect(podeIniciarListeners({ ...base, dadosIniciaisCarregados: false })).toBe(false);
  });

  it('não inicia na demonstração', () => {
    expect(podeIniciarListeners({ ...base, modoDemonstracao: true })).toBe(false);
  });
});

describe('nível hierárquico', () => {
  it('libera o dashboard somente para gestores', () => {
    expect(nivelPermiteDashboard(5)).toBe(true);
    expect(nivelPermiteDashboard(6)).toBe(false);
  });
});

describe('perfilEfetivo', () => {
  it('usa o perfil explícito quando definido, mesmo contradizendo nivelHierarquico', () => {
    expect(perfilEfetivo(usuarioBase({ perfil: 'ADMIN_SISTEMA', nivelHierarquico: 6 }))).toBe('ADMIN_SISTEMA');
    expect(perfilEfetivo(usuarioBase({ perfil: 'ANALISTA_SOC', nivelHierarquico: 1 }))).toBe('ANALISTA_SOC');
  });

  it('cai no fallback por nivelHierarquico quando perfil está ausente', () => {
    expect(perfilEfetivo(usuarioBase({ nivelHierarquico: 5 }))).toBe('GESTOR_EQUIPE');
    expect(perfilEfetivo(usuarioBase({ nivelHierarquico: 0 }))).toBe('GESTOR_EQUIPE');
    expect(perfilEfetivo(usuarioBase({ nivelHierarquico: 6 }))).toBe('ANALISTA_SOC');
  });

  it('nunca retorna ADMIN_SISTEMA por fallback — só quando explícito', () => {
    for (const nivelHierarquico of [-1, 0, 1, 5, 6, 10]) {
      expect(perfilEfetivo(usuarioBase({ nivelHierarquico }))).not.toBe('ADMIN_SISTEMA');
    }
  });
});

describe('escopoEfetivo', () => {
  it('usa o escopo explícito quando definido', () => {
    expect(escopoEfetivo(usuarioBase({ escopo: 'GLOBAL' }))).toBe('GLOBAL');
  });

  it('cai em EQUIPE quando ausente', () => {
    expect(escopoEfetivo(usuarioBase())).toBe('EQUIPE');
  });
});

describe('ehAdminSistema', () => {
  it('é true somente com perfil ADMIN_SISTEMA explícito', () => {
    expect(ehAdminSistema(usuarioBase({ perfil: 'ADMIN_SISTEMA' }))).toBe(true);
    expect(ehAdminSistema(usuarioBase({ nivelHierarquico: 0 }))).toBe(false);
    expect(ehAdminSistema(usuarioBase({ perfil: 'GESTOR_EQUIPE' }))).toBe(false);
  });
});
