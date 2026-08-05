import { describe, expect, it } from 'vitest';

import { mensagemErroFirebase } from './errors';

function erroPermissao(): Error {
  const erro = new Error('Missing or insufficient permissions.') as Error & { code: string };
  erro.code = 'permission-denied';
  return erro;
}

describe('mensagemErroFirebase — permissão negada por ambiente', () => {
  it('menciona o laboratório local quando ambiente é local', () => {
    const mensagem = mensagemErroFirebase(erroPermissao(), 'fallback', 'local');
    expect(mensagem).toMatch(/laboratório/i);
    expect(mensagem).not.toMatch(/staging/i);
  });

  it('menciona staging, não laboratório, quando ambiente é staging', () => {
    const mensagem = mensagemErroFirebase(erroPermissao(), 'fallback', 'staging');
    expect(mensagem).toMatch(/staging/i);
    expect(mensagem).not.toMatch(/laboratório/i);
    expect(mensagem).not.toMatch(/reinicie o Firebase local/i);
  });

  it('usa mensagem genérica (sem "laboratório") quando o ambiente não é informado', () => {
    const mensagem = mensagemErroFirebase(erroPermissao(), 'fallback');
    expect(mensagem).not.toMatch(/laboratório/i);
  });

  it('usa mensagem genérica também para produção', () => {
    const mensagem = mensagemErroFirebase(erroPermissao(), 'fallback', 'producao');
    expect(mensagem).not.toMatch(/laboratório/i);
  });
});

describe('mensagemErroFirebase — outros casos já existentes', () => {
  it('reconhece PERMISSION_DENIED na mensagem, não só no código', () => {
    const mensagem = mensagemErroFirebase(new Error('PERMISSION_DENIED: nope'), 'fallback', 'staging');
    expect(mensagem).toMatch(/staging/i);
  });

  it('detecta login sem vínculo', () => {
    expect(mensagemErroFirebase(new Error('Partes do identificador inválidas'), 'fallback'))
      .toBe('A escala possui colaborador sem vínculo válido. Corrija ou cadastre os logins antes de publicar.');
  });

  it('detecta campo undefined não removido a tempo, com mensagem amigável', () => {
    const mensagem = mensagemErroFirebase(
      new Error('Function setDoc() called with invalid data. Unsupported field value: undefined found in field criadoEm'),
      'fallback',
    );
    expect(mensagem).toMatch(/cadastro/i);
    expect(mensagem).not.toMatch(/Unsupported field value/);
  });

  it('usa o fallback quando a mensagem é longa ou vazia', () => {
    expect(mensagemErroFirebase(new Error('x'.repeat(500)), 'fallback')).toBe('fallback');
    expect(mensagemErroFirebase(new Error(''), 'fallback')).toBe('fallback');
  });
});
