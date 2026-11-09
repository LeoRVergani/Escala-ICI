import { describe, expect, it } from 'vitest';

import { textoVersaoApp, VERSAO_APP } from './versaoApp';

describe('VERSAO-APP-1', () => {
  it('fora do build cai no padrão sem quebrar', () => {
    expect(VERSAO_APP.commit).toBe('dev');
    expect(textoVersaoApp()).toBe('desenvolvimento');
  });
  it('formato data · commit', () => {
    expect(textoVersaoApp({ commit: '2b2e032', data: '06/11/2026 15:42' })).toBe('06/11/2026 15:42 · 2b2e032');
  });
});
