import { describe, expect, it } from 'vitest';

import { idParaNovoPlantao } from './criarPlantaoLideranca';

describe('CRIAR-PLANTAO-1 — id do Plantão novo', () => {
  it('a partir do nome, sem repetir "Plantão", com sufixo', () => {
    expect(idParaNovoPlantao('Plantão Infra', 'a1b2')).toBe('PLANTAO_INFRA_A1B2');
    expect(idParaNovoPlantao('Sobreaviso Redes', 'zz99')).toBe('PLANTAO_SOBREAVISO_REDES_ZZ99');
  });
});
