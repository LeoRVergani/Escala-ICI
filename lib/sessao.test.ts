import { describe, expect, it } from 'vitest';

import {
  chavePreferenciaSessao,
  deveExibirRestauracao,
  estadoInicialSessao,
  nivelPermiteDashboard,
  podeIniciarListeners,
  preferenciaPadraoSessao,
  resolverManterConectado,
} from './sessao';

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
