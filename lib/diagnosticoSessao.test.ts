import { beforeEach, describe, expect, it } from 'vitest';

import { registrarEventoSessao, textoDiagnosticoSessao } from './diagnosticoSessao';

function storageFalso(): Storage {
  const mapa = new Map<string, string>();
  return {
    getItem: (chave) => mapa.get(chave) ?? null,
    setItem: (chave, valor) => { mapa.set(chave, valor); },
    removeItem: (chave) => { mapa.delete(chave); },
    clear: () => mapa.clear(),
    key: () => null,
    get length() { return mapa.size; },
  };
}

describe('SESSAO-CELULAR-2 — diagnóstico da sessão', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storageFalso(), navigator: {}, matchMedia: () => ({ matches: true }) },
      configurable: true,
    });
  });

  it('sem login anterior, "nenhuma conta guardada" não aparece (é só o primeiro acesso)', () => {
    registrarEventoSessao('SEM_CONTA_GUARDADA', 'manter=sim');
    expect(textoDiagnosticoSessao()).toBeNull();
  });

  it('depois de um login, a sessão perdida aparece com o motivo e o modo (instalado/navegador)', () => {
    registrarEventoSessao('LOGIN', 'manter=sim, e-mail');
    registrarEventoSessao('SEM_CONTA_GUARDADA', 'manter=sim');
    const texto = textoDiagnosticoSessao() ?? '';
    expect(texto).toContain('nenhuma conta estava guardada no aparelho');
    expect(texto).toContain('instalado');
    expect(texto).toContain('manter=sim, e-mail');
  });

  it('restauração bem-sucedida não mostra nada', () => {
    registrarEventoSessao('LOGIN');
    registrarEventoSessao('RESTAURADA');
    expect(textoDiagnosticoSessao()).toBeNull();
  });
});
