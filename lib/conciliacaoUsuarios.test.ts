import { describe, expect, it } from 'vitest';

import {
  conciliarNome,
  conciliarPlanilha,
  contarPendenciasConciliacao,
  ignorarLinha,
  loginParaUidComConciliacao,
  marcarPendente,
  publicacaoBloqueadaPorConciliacao,
  resolverManualmente,
} from './conciliacaoUsuarios';
import type { Usuario } from './modelos';

function usuario(ajustes: Partial<Usuario>): Usuario {
  return {
    login: 'login-base',
    nome: 'Nome Base',
    email: 'nome.base@empresa.com',
    cargo: 'ANALISTA_SOC',
    equipeId: 'EQ_SOC',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...ajustes,
  };
}

const CAIO = usuario({
  login: 'cmonteiro',
  nome: 'Caio Monteiro',
  email: 'caio.monteiro@example.com',
  aliasesPlanilha: ['C. Monteiro'],
});

const BIANCA_INATIVA = usuario({
  login: 'bsalles',
  nome: 'Bianca Salles',
  email: 'bianca.salles@empresa.com',
  ativo: false,
});

describe('conciliação por texto único', () => {
  it('vincula por login exato', () => {
    expect(conciliarNome('cmonteiro', [CAIO])).toEqual({
      nomePlanilha: 'cmonteiro',
      login: 'cmonteiro',
      status: 'VINCULADO_LOGIN',
      candidatos: ['cmonteiro'],
    });
  });

  it('vincula por e-mail exato, sem diferenciar caixa', () => {
    const resultado = conciliarNome('CAIO.MONTEIRO@EXAMPLE.COM', [CAIO]);
    expect(resultado.status).toBe('VINCULADO_LOGIN');
    expect(resultado.login).toBe('cmonteiro');
  });

  it('vincula por alias da planilha normalizado', () => {
    const resultado = conciliarNome('c. monteiro', [CAIO]);
    expect(resultado.status).toBe('VINCULADO_ALIAS');
    expect(resultado.login).toBe('cmonteiro');
  });

  it('vincula por nome normalizado (acentos, caixa e espaços)', () => {
    const resultado = conciliarNome('CAIO   MONTEIRO', [CAIO]);
    expect(resultado.status).toBe('VINCULADO_ALIAS');
    expect(resultado.login).toBe('cmonteiro');
  });

  it('não aproxima abreviação a nome completo', () => {
    const resultado = conciliarNome('Caio M.', [CAIO]);
    expect(resultado.status).toBe('USUARIO_NAO_ENCONTRADO');
    expect(resultado.login).toBeNull();
  });

  it('marca usuário inativo em vez de vincular automaticamente', () => {
    const resultado = conciliarNome('Bianca Salles', [BIANCA_INATIVA]);
    expect(resultado.status).toBe('USUARIO_INATIVO');
    expect(resultado.login).toBeNull();
    expect(resultado.candidatos).toEqual(['bsalles']);
  });

  it('não encontra usuário quando não há nenhuma correspondência', () => {
    const resultado = conciliarNome('Fulano Desconhecido', [CAIO]);
    expect(resultado.status).toBe('USUARIO_NAO_ENCONTRADO');
    expect(resultado.candidatos).toEqual([]);
  });

  it('marca conflito quando duas pessoas normalizam para o mesmo nome', () => {
    const homonimo = usuario({ login: 'cmonteiro2', nome: 'Caio Monteiro', email: 'outro@empresa.com' });
    const resultado = conciliarNome('Caio Monteiro', [CAIO, homonimo]);
    expect(resultado.status).toBe('CONFLITO_ALIAS');
    expect(resultado.candidatos.sort()).toEqual(['cmonteiro', 'cmonteiro2'].sort());
  });

  it('prioriza login exato sobre correspondência por nome de outra pessoa', () => {
    const outraPessoaComEsseNome = usuario({ login: 'outro.login', nome: 'cmonteiro' });
    const resultado = conciliarNome('cmonteiro', [CAIO, outraPessoaComEsseNome]);
    expect(resultado.status).toBe('VINCULADO_LOGIN');
    expect(resultado.login).toBe('cmonteiro');
  });
});

describe('conciliação de uma planilha inteira', () => {
  it('deduplica textos repetidos e ignora vazios', () => {
    const linhas = conciliarPlanilha(['cmonteiro', 'cmonteiro', '', '   '], [CAIO]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.nomePlanilha).toBe('cmonteiro');
  });
});

describe('bloqueio de publicação', () => {
  it('bloqueia quando existe pendência, conflito, inativo ou não encontrado', () => {
    expect(publicacaoBloqueadaPorConciliacao([
      { nomePlanilha: 'a', login: 'x', status: 'VINCULADO_LOGIN', candidatos: ['x'] },
    ])).toBe(false);
    expect(publicacaoBloqueadaPorConciliacao([
      { nomePlanilha: 'a', login: null, status: 'PRECISA_MAPEAR', candidatos: [] },
    ])).toBe(true);
    expect(publicacaoBloqueadaPorConciliacao([
      { nomePlanilha: 'a', login: 'x', status: 'VINCULADO_LOGIN', candidatos: ['x'] },
      { nomePlanilha: 'b', login: null, status: 'USUARIO_NAO_ENCONTRADO', candidatos: [] },
    ])).toBe(true);
  });

  it('linha ignorada não bloqueia', () => {
    expect(publicacaoBloqueadaPorConciliacao([
      { nomePlanilha: 'a', login: null, status: 'IGNORADA', candidatos: [] },
    ])).toBe(false);
  });

  it('conta pendências', () => {
    expect(contarPendenciasConciliacao([
      { nomePlanilha: 'a', login: 'x', status: 'VINCULADO_LOGIN', candidatos: ['x'] },
      { nomePlanilha: 'b', login: null, status: 'CONFLITO_ALIAS', candidatos: ['x', 'y'] },
      { nomePlanilha: 'c', login: null, status: 'USUARIO_NAO_ENCONTRADO', candidatos: [] },
    ])).toBe(2);
  });
});

describe('ações manuais do gestor', () => {
  const linha = { nomePlanilha: 'Caio M.', login: null, status: 'USUARIO_NAO_ENCONTRADO' as const, candidatos: [] };

  it('resolve manualmente vinculando a um usuário ativo', () => {
    expect(resolverManualmente(linha, CAIO)).toEqual({
      nomePlanilha: 'Caio M.',
      login: 'cmonteiro',
      status: 'VINCULADO_ALIAS',
      candidatos: ['cmonteiro'],
    });
  });

  it('não vincula manualmente a um usuário inativo', () => {
    expect(resolverManualmente(linha, BIANCA_INATIVA)).toEqual({
      nomePlanilha: 'Caio M.',
      login: null,
      status: 'USUARIO_INATIVO',
      candidatos: ['bsalles'],
    });
  });

  it('marca como pendente', () => {
    expect(marcarPendente(linha).status).toBe('PRECISA_MAPEAR');
  });

  it('ignora a linha', () => {
    expect(ignorarLinha(linha).status).toBe('IGNORADA');
  });
});

describe('extensão do mapa de login com a conciliação', () => {
  it('adiciona somente vínculos resolvidos e não ignorados', () => {
    const mapa = loginParaUidComConciliacao({ existente: 'existente' }, [
      { nomePlanilha: 'Caio M.', login: 'cmonteiro', status: 'VINCULADO_ALIAS', candidatos: ['cmonteiro'] },
      { nomePlanilha: 'Fulano', login: null, status: 'PRECISA_MAPEAR', candidatos: [] },
      { nomePlanilha: 'Ignorado', login: 'outro', status: 'IGNORADA', candidatos: ['outro'] },
    ]);
    expect(mapa).toEqual({
      existente: 'existente',
      'Caio M.': 'cmonteiro',
    });
  });
});
