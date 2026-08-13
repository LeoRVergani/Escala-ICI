import { describe, expect, it } from 'vitest';

import {
  decidirEstadoCardPush,
  identificadorDispositivoAbreviado,
  rotuloConfirmacaoPush,
} from './pushCardEstado';

describe('decidirEstadoCardPush', () => {
  it('ATIVO permanece ATIVO', () => {
    expect(decidirEstadoCardPush('ATIVO')).toBe('ATIVO');
  });

  it('ATIVO sem Messaging inicializado nesta sessão vira PRECISA_REPARO', () => {
    expect(decidirEstadoCardPush('ATIVO', false)).toBe('PRECISA_REPARO');
  });

  it('PRECISA_REPARO nunca é tratado como ATIVO (achado da auditoria PUSH-PWA-2B.1)', () => {
    expect(decidirEstadoCardPush('PRECISA_REPARO')).toBe('PRECISA_REPARO');
  });

  it('INATIVO vira DISPONIVEL (oferece ativar, não reparar)', () => {
    expect(decidirEstadoCardPush('INATIVO')).toBe('DISPONIVEL');
  });
});

describe('identificadorDispositivoAbreviado', () => {
  it('devolve os últimos 6 caracteres do deviceId', () => {
    expect(identificadorDispositivoAbreviado('web-1234567890abcdef')).toBe('abcdef');
  });

  it('devolve null para deviceId nulo', () => {
    expect(identificadorDispositivoAbreviado(null)).toBeNull();
  });

  it('devolve null para deviceId curto demais para abreviar com segurança', () => {
    expect(identificadorDispositivoAbreviado('abc')).toBeNull();
  });

  it('nunca inclui o deviceId inteiro na saída', () => {
    const deviceId = 'web-fid-completo-que-nao-deve-aparecer-inteiro';
    const abreviado = identificadorDispositivoAbreviado(deviceId);
    expect(abreviado).not.toBe(deviceId);
    expect(abreviado?.length).toBe(6);
  });
});

describe('rotuloConfirmacaoPush', () => {
  const agora = Date.parse('2026-08-12T12:00:00.000Z');

  it('devolve null quando não há confirmação', () => {
    expect(rotuloConfirmacaoPush(null, agora)).toBeNull();
  });

  it('devolve null para timestamp inválido', () => {
    expect(rotuloConfirmacaoPush('não-é-uma-data', agora)).toBeNull();
  });

  it('"Confirmado agora" dentro da janela recente (< 5 minutos)', () => {
    const ha2minutos = new Date(agora - 2 * 60 * 1000).toISOString();
    expect(rotuloConfirmacaoPush(ha2minutos, agora)).toBe('Confirmado agora');
  });

  it('"Confirmado recentemente" fora da janela recente', () => {
    const haUmaHora = new Date(agora - 60 * 60 * 1000).toISOString();
    expect(rotuloConfirmacaoPush(haUmaHora, agora)).toBe('Confirmado recentemente');
  });

  it('nunca inclui o timestamp bruto na saída', () => {
    const timestamp = new Date(agora - 60 * 1000).toISOString();
    const rotulo = rotuloConfirmacaoPush(timestamp, agora);
    expect(rotulo).not.toContain(timestamp);
  });
});
