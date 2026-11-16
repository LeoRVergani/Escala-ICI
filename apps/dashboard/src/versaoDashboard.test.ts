import { describe, expect, it } from 'vitest';

import { detalheVersaoDashboard, numeroVersaoDashboard, VERSAO_DASHBOARD } from './versaoDashboard';

describe('VERSAO-DASHBOARD-1', () => {
  it('fora do build cai no padrão sem quebrar', () => {
    expect(VERSAO_DASHBOARD.commit).toBe('dev');
    expect(numeroVersaoDashboard()).toBe('desenvolvimento');
    expect(detalheVersaoDashboard()).toBe('');
  });

  it('com build: número da versão e detalhe (data e commit; sem commit quando é "local")', () => {
    const v = { versao: '1.5.0', commit: '6112654', data: '17/11/2026 09:42' };
    expect(numeroVersaoDashboard(v)).toBe('1.5.0');
    expect(detalheVersaoDashboard(v)).toBe('17/11/2026 09:42 · 6112654');
    expect(detalheVersaoDashboard({ ...v, commit: 'local' })).toBe('17/11/2026 09:42');
  });
});
