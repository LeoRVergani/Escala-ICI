import { describe, expect, it } from 'vitest';

import { camposPromocaoLideranca, documentoNovaLideranca, ehLideranca, podeRemoverLideranca } from './liderancas';

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

describe('LIDERANCAS-2', () => {
  it('pessoa nova como liderança: login do e-mail, sem equipe, nível 5, registro de quem cadastrou', () => {
    const doc = documentoNovaLideranca({ nome: '  Ana   Souza ', email: 'Ana.Souza@Empresa.com ', cargo: 'Coordenadora' }, 'clis', 'T');
    expect(doc).toMatchObject({
      login: 'ana.souza', nome: 'Ana Souza', email: 'ana.souza@empresa.com', equipeId: '', nivelHierarquico: 5,
      perfil: 'GESTOR_EQUIPE', promovidoPorLogin: 'clis', promovidoEm: 'T', ativo: true,
    });
  });

  it('remover liderança só de gestor/supervisor de equipe', () => {
    expect(podeRemoverLideranca({ perfil: 'GESTOR_EQUIPE' })).toBe(true);
    expect(podeRemoverLideranca({ perfil: 'GESTOR_UNIDADE' })).toBe(false);
    expect(podeRemoverLideranca({ perfil: 'ADMIN_SISTEMA' })).toBe(false);
  });
});
