import { describe, expect, it } from 'vitest';

import { numeroVersaoApp, textoVersaoApp, VERSAO_APP, versaoPublicadaDiferente } from './versaoApp';

describe('VERSAO-APP-1/2', () => {
  it('fora do build cai no padrão sem quebrar', () => {
    expect(VERSAO_APP.commit).toBe('dev');
    expect(textoVersaoApp()).toBe('desenvolvimento');
    expect(numeroVersaoApp()).toBe('desenvolvimento');
  });

  it('formato com número da versão', () => {
    const v = { versao: '3.0.0', commit: '2b2e032', data: '06/11/2026 15:42' };
    expect(numeroVersaoApp(v)).toBe('3.0.0');
    expect(textoVersaoApp(v)).toBe('3.0.0 · 06/11/2026 15:42 · 2b2e032');
  });

  it('detecta versão nova publicada (número OU commit); ignora resposta inválida e build local', () => {
    const atual = { versao: '3.0.0', commit: 'aaaaaaa' };
    expect(versaoPublicadaDiferente(atual, { versao: '3.0.0', commit: 'aaaaaaa', data: 'x' })).toBe(false);
    expect(versaoPublicadaDiferente(atual, { versao: '3.0.0', commit: 'bbbbbbb' })).toBe(true);
    expect(versaoPublicadaDiferente(atual, { versao: '3.1.0', commit: 'aaaaaaa' })).toBe(true);
    expect(versaoPublicadaDiferente(atual, '<html>')).toBe(false);
    expect(versaoPublicadaDiferente(atual, null)).toBe(false);
    expect(versaoPublicadaDiferente({ versao: '3.0.0', commit: 'dev' }, { versao: '3.1.0', commit: 'b' })).toBe(false);
  });
});
