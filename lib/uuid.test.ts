import { describe, expect, it, vi } from 'vitest';

import { gerarUuid, type CryptoUuidApi } from './uuid';

const UUID_NATIVO = '12345678-1234-4abc-8def-1234567890ab';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('geração segura de UUID', () => {
  it('prefere randomUUID quando a API está disponível', () => {
    const randomUUID = vi.fn(() => UUID_NATIVO);
    const getRandomValues = vi.fn((valores: Uint8Array) => valores);

    expect(gerarUuid({ randomUUID, getRandomValues })).toBe(UUID_NATIVO);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('usa getRandomValues quando randomUUID não está disponível', () => {
    const getRandomValues = vi.fn((valores: Uint8Array) => {
      valores.set(Array.from({ length: 16 }, (_, indice) => indice));
      return valores;
    });

    const uuid = gerarUuid({ getRandomValues });

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(uuid).toMatch(UUID_V4);
    expect(uuid).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });

  it('gera valores diferentes em chamadas consecutivas do fallback', () => {
    let chamada = 0;
    const api: CryptoUuidApi = {
      getRandomValues(valores) {
        valores.fill(chamada);
        chamada += 1;
        return valores;
      },
    };

    const primeiro = gerarUuid(api);
    const segundo = gerarUuid(api);

    expect(primeiro).toMatch(UUID_V4);
    expect(segundo).toMatch(UUID_V4);
    expect(primeiro).not.toBe(segundo);
  });

  it('reprova ambientes sem Web Crypto API em vez de usar aleatoriedade fraca', () => {
    expect(() => gerarUuid({})).toThrow(/Web Crypto API/);
  });
});
