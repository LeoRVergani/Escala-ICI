import { describe, expect, it } from 'vitest';

import { idParaNovaEquipe, siglaDoNome } from './criarEquipeLideranca';

describe('CRIAR-EQUIPE-1 — id e sigla da equipe nova', () => {
  it('id a partir do nome, sem acento, com sufixo para não colidir', () => {
    expect(idParaNovaEquipe('Suporte Técnico N1', 'k3f9')).toBe('EQ_SUPORTE_TECNICO_N1_K3F9');
    expect(idParaNovaEquipe('   ', 'ab12')).toBe('EQ_EQUIPE_AB12');
  });

  it('sigla pelas iniciais (ou a palavra única)', () => {
    expect(siglaDoNome('Suporte Técnico de Redes')).toBe('STR');
    expect(siglaDoNome('NOC')).toBe('NOC');
    expect(siglaDoNome('Infraestrutura')).toBe('INFRAEST');
  });
});
