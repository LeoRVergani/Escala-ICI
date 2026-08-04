export interface CryptoUuidApi {
  randomUUID?: () => string;
  getRandomValues?: (valores: Uint8Array) => Uint8Array;
}

function cryptoGlobal(): CryptoUuidApi | undefined {
  return typeof globalThis.crypto === 'undefined' ? undefined : globalThis.crypto;
}

/**
 * Gera um UUID v4 sem depender de `crypto.randomUUID`, que pode não existir
 * quando o Dashboard é aberto por HTTP em um IPv4 privado da rede interna.
 */
export function gerarUuid(api: CryptoUuidApi | undefined = cryptoGlobal()): string {
  if (typeof api?.randomUUID === 'function') {
    return api.randomUUID.call(api);
  }

  if (typeof api?.getRandomValues !== 'function') {
    throw new Error('Este navegador não disponibiliza a Web Crypto API necessária para gerar identificadores seguros.');
  }

  const bytes = new Uint8Array(16);
  api.getRandomValues.call(api, bytes);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hexadecimal.slice(0, 4).join(''),
    hexadecimal.slice(4, 6).join(''),
    hexadecimal.slice(6, 8).join(''),
    hexadecimal.slice(8, 10).join(''),
    hexadecimal.slice(10, 16).join(''),
  ].join('-');
}
