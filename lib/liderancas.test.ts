import { describe, expect, it } from 'vitest';

import { camposPromocaoLideranca, ehLideranca } from './liderancas';

describe('LIDERANCAS-1', () => {
  it('liderança pelos perfis existentes (ou, sem perfil, pelo nível)', () => {
    expect(ehLideranca({ perfil: 'GESTOR_EQUIPE', nivelHierarquico: 6 })).toBe(true);
    expect(ehLideranca({ perfil: 'SUPERVISOR_EQUIPE', nivelHierarquico: 5 })).toBe(true);
    expect(ehLideranca({ perfil: 'ANALISTA_SOC', nivelHierarquico: 6 })).toBe(false);
    expect(ehLideranca({ nivelHierarquico: 4 } as never)).toBe(true);
    expect(ehLideranca({ nivelHierarquico: 6 } as never)).toBe(false);
  });

  it('promoção: gestor de equipe, nível 5 (ou mantém se já for menor) e registra quem', () => {
    expect(camposPromocaoLideranca({ nivelHierarquico: 6 }, 'clis', 'T')).toEqual({
      perfil: 'GESTOR_EQUIPE', nivelHierarquico: 5, promovidoPorLogin: 'clis', promovidoEm: 'T', atualizadoEm: 'T',
    });
    expect(camposPromocaoLideranca({ nivelHierarquico: 4 }, 'clis', 'T').nivelHierarquico).toBe(4);
  });
});
