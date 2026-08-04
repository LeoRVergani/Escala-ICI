import { describe, expect, it } from 'vitest';

import { fatiarEmLotes } from './batches';

describe('fatiarEmLotes', () => {
  it('respeita o limite de 500 operações', () => {
    const lotes = fatiarEmLotes(Array.from({ length: 1001 }, (_, i) => i));
    expect(lotes.map((lote) => lote.length)).toEqual([500, 500, 1]);
  });
});
