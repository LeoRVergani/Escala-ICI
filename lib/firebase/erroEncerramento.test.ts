import { describe, expect, it } from 'vitest';

import { ehErroEncerramentoFirestore } from './errors';

describe('TROCA-CONTA-1 — erro de encerramento do Firestore (logout/troca de conta)', () => {
  it('reconhece o encerramento do cliente', () => {
    expect(ehErroEncerramentoFirestore(Object.assign(new Error('Firestore shutting down'), { code: 'aborted' }))).toBe(true);
    expect(ehErroEncerramentoFirestore(new Error('The client has already been terminated.'))).toBe(true);
    expect(ehErroEncerramentoFirestore({ code: 'aborted', message: 'x' })).toBe(true);
  });

  it('erros de verdade continuam aparecendo', () => {
    expect(ehErroEncerramentoFirestore(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }))).toBe(false);
    expect(ehErroEncerramentoFirestore(Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' }))).toBe(false);
    expect(ehErroEncerramentoFirestore(null)).toBe(false);
  });
});
