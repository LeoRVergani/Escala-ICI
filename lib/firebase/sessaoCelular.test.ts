import { describe, expect, it, vi } from 'vitest';

vi.mock('./shared', () => ({ exigirFirebase: () => { throw new Error('sem firebase no teste'); } }));
vi.mock('./client', () => ({ configurarCachePersistente: () => undefined }));

const { falhaDeRedeAoCarregarUsuario, falhaPassageiraAoCarregarUsuario } = await import('./authRepository');

function erroFirebase(code: string, message = 'x') {
  return Object.assign(new Error(message), { code });
}

describe('SESSAO-CELULAR-1 — falha passageira não derruba a sessão', () => {
  it('rede/servidor e o "sem permissão" momentâneo são passageiros (tenta de novo)', () => {
    expect(falhaPassageiraAoCarregarUsuario(erroFirebase('firestore/unavailable'))).toBe(true);
    expect(falhaPassageiraAoCarregarUsuario(erroFirebase('deadline-exceeded'))).toBe(true);
    expect(falhaPassageiraAoCarregarUsuario(erroFirebase('permission-denied', 'Missing or insufficient permissions.'))).toBe(true);
    expect(falhaPassageiraAoCarregarUsuario(new Error('Failed to get document because the client is offline.'))).toBe(true);
  });

  it('só rede/servidor mantém a sessão depois da 2ª tentativa; permissão persistente desconecta', () => {
    expect(falhaDeRedeAoCarregarUsuario(erroFirebase('unavailable'))).toBe(true);
    expect(falhaDeRedeAoCarregarUsuario(new Error('Failed to get document because the client is offline.'))).toBe(true);
    expect(falhaDeRedeAoCarregarUsuario(erroFirebase('permission-denied', 'Missing or insufficient permissions.'))).toBe(false);
  });

  it('cadastro inexistente/inativo e erros desconhecidos não são passageiros', () => {
    expect(falhaPassageiraAoCarregarUsuario(new Error('qualquer outra coisa'))).toBe(false);
  });
});
