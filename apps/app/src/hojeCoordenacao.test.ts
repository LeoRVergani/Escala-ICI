import { describe, expect, it } from 'vitest';

import { periodoAgora } from './HojeCoordenacao';

describe('HOJE-COORDENACAO-1 — turno em andamento', () => {
  it('MD 01–07, M 07–13, T 13–19, N 19–01 (00h ainda é a Noite de ontem)', () => {
    expect(periodoAgora(0)).toEqual({ periodo: 'N', ontem: true });
    expect(periodoAgora(1)).toEqual({ periodo: 'MD', ontem: false });
    expect(periodoAgora(6)).toEqual({ periodo: 'MD', ontem: false });
    expect(periodoAgora(7)).toEqual({ periodo: 'M', ontem: false });
    expect(periodoAgora(13)).toEqual({ periodo: 'T', ontem: false });
    expect(periodoAgora(19)).toEqual({ periodo: 'N', ontem: false });
    expect(periodoAgora(23)).toEqual({ periodo: 'N', ontem: false });
  });
});
