import { describe, expect, it } from 'vitest';

import type { Usuario } from './modelos';
import {
  chavePreferenciaSessao,
  deveExibirRestauracao,
  ehAdminSistema,
  equipesPermitidasEfetivas,
  escopoEfetivo,
  estadoInicialSessao,
  nivelPermiteDashboard,
  perfilEfetivo,
  podeGerenciarEquipe,
  podeGerenciarGrupoPlantao,
  podeGerenciarUnidade,
  podeIniciarListeners,
  preferenciaPadraoSessao,
  resolverManterConectado,
  souGestorDePlantao,
  unidadesPermitidasEfetivas,
} from './sessao';

function usuarioBase(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    login: 'fulano',
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    cargo: 'ANALISTA_SOC',
    equipeId: 'EQ_SOC',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...sobrescritas,
  };
}

describe('preferência de sessão', () => {
  it('usa chaves distintas por produto', () => {
    expect(chavePreferenciaSessao('app')).toBe('escala-ici-sessao-app');
    expect(chavePreferenciaSessao('dashboard')).toBe('escala-ici-sessao-dashboard');
  });

  it('mantém o colaborador conectado por padrão e o gestor não', () => {
    expect(preferenciaPadraoSessao('app')).toBe(true);
    expect(preferenciaPadraoSessao('dashboard')).toBe(false);
    expect(resolverManterConectado('app', null)).toBe(true);
    expect(resolverManterConectado('dashboard', null)).toBe(false);
  });

  it('respeita a preferência gravada no dispositivo', () => {
    expect(resolverManterConectado('app', 'false')).toBe(false);
    expect(resolverManterConectado('dashboard', 'true')).toBe(true);
  });
});

describe('estado inicial da sessão', () => {
  it('começa restaurando quando o Firebase está configurado', () => {
    expect(estadoInicialSessao({
      firebaseConfigurado: true,
      restauracaoDelegada: false,
    })).toBe('restaurando');
  });

  it('não restaura sem Firebase configurado nem quando delegada', () => {
    expect(estadoInicialSessao({
      firebaseConfigurado: false,
      restauracaoDelegada: false,
    })).toBe('ausente');
    expect(estadoInicialSessao({
      firebaseConfigurado: true,
      restauracaoDelegada: true,
    })).toBe('ausente');
  });
});

describe('telas visíveis durante a restauração', () => {
  it('só mostra a tela de restauração enquanto a sessão não é resolvida', () => {
    expect(deveExibirRestauracao('restaurando')).toBe(true);
    expect(deveExibirRestauracao('ausente')).toBe(false);
    expect(deveExibirRestauracao('ativa')).toBe(false);
  });
});

describe('início dos listeners em tempo real', () => {
  const base = {
    estado: 'ativa',
    usuarioCarregado: true,
    dadosIniciaisCarregados: true,
    modoDemonstracao: false,
  } as const;

  it('inicia com sessão restaurada e carga inicial concluída', () => {
    expect(podeIniciarListeners(base)).toBe(true);
  });

  it('também inicia após login manual, quando a restauração já terminou', () => {
    expect(podeIniciarListeners({ ...base, estado: 'ausente' })).toBe(true);
  });

  it('não inicia durante a restauração', () => {
    expect(podeIniciarListeners({ ...base, estado: 'restaurando' })).toBe(false);
  });

  it('não inicia antes do usuário do Firestore e da carga inicial', () => {
    expect(podeIniciarListeners({ ...base, usuarioCarregado: false })).toBe(false);
    expect(podeIniciarListeners({ ...base, dadosIniciaisCarregados: false })).toBe(false);
  });

  it('não inicia na demonstração', () => {
    expect(podeIniciarListeners({ ...base, modoDemonstracao: true })).toBe(false);
  });
});

describe('nível hierárquico', () => {
  it('libera o dashboard somente para gestores', () => {
    expect(nivelPermiteDashboard(5)).toBe(true);
    expect(nivelPermiteDashboard(6)).toBe(false);
  });
});

describe('perfilEfetivo', () => {
  it('usa o perfil explícito quando definido, mesmo contradizendo nivelHierarquico', () => {
    expect(perfilEfetivo(usuarioBase({ perfil: 'ADMIN_SISTEMA', nivelHierarquico: 6 }))).toBe('ADMIN_SISTEMA');
    expect(perfilEfetivo(usuarioBase({ perfil: 'ANALISTA_SOC', nivelHierarquico: 1 }))).toBe('ANALISTA_SOC');
  });

  it('cai no fallback por nivelHierarquico quando perfil está ausente', () => {
    expect(perfilEfetivo(usuarioBase({ nivelHierarquico: 5 }))).toBe('GESTOR_EQUIPE');
    expect(perfilEfetivo(usuarioBase({ nivelHierarquico: 0 }))).toBe('GESTOR_EQUIPE');
    expect(perfilEfetivo(usuarioBase({ nivelHierarquico: 6 }))).toBe('ANALISTA_SOC');
  });

  it('nunca retorna ADMIN_SISTEMA por fallback — só quando explícito', () => {
    for (const nivelHierarquico of [-1, 0, 1, 5, 6, 10]) {
      expect(perfilEfetivo(usuarioBase({ nivelHierarquico }))).not.toBe('ADMIN_SISTEMA');
    }
  });
});

describe('escopoEfetivo', () => {
  it('usa o escopo explícito quando definido', () => {
    expect(escopoEfetivo(usuarioBase({ escopo: 'GLOBAL' }))).toBe('GLOBAL');
  });

  it('cai em EQUIPE quando ausente', () => {
    expect(escopoEfetivo(usuarioBase())).toBe('EQUIPE');
  });
});

describe('ehAdminSistema', () => {
  it('é true somente com perfil ADMIN_SISTEMA explícito', () => {
    expect(ehAdminSistema(usuarioBase({ perfil: 'ADMIN_SISTEMA' }))).toBe(true);
    expect(ehAdminSistema(usuarioBase({ nivelHierarquico: 0 }))).toBe(false);
    expect(ehAdminSistema(usuarioBase({ perfil: 'GESTOR_EQUIPE' }))).toBe(false);
  });
});

describe('unidadesPermitidasEfetivas', () => {
  it('usa a lista explícita quando presente', () => {
    expect(unidadesPermitidasEfetivas(usuarioBase({ unidadesPermitidas: ['GEDSI', 'COSI'] })))
      .toEqual(['GEDSI', 'COSI']);
  });

  it('cai para [unidadeId] quando a lista está ausente', () => {
    expect(unidadesPermitidasEfetivas(usuarioBase({ unidadeId: 'COSI' }))).toEqual(['COSI']);
  });

  it('cai para [unidadeId] quando a lista está presente mas vazia', () => {
    expect(unidadesPermitidasEfetivas(usuarioBase({ unidadeId: 'COSI', unidadesPermitidas: [] })))
      .toEqual(['COSI']);
  });

  it('devolve lista vazia quando não há unidadeId nem lista — usuário antigo sem unidade', () => {
    expect(unidadesPermitidasEfetivas(usuarioBase())).toEqual([]);
  });
});

describe('equipesPermitidasEfetivas', () => {
  it('usa a lista explícita quando presente', () => {
    expect(equipesPermitidasEfetivas(usuarioBase({ equipesPermitidas: ['EQ_SOC', 'EQ_NOC'] })))
      .toEqual(['EQ_SOC', 'EQ_NOC']);
  });

  it('cai para [equipeId] quando a lista está ausente — compat com GESTOR_EQUIPE/ANALISTA_SOC existente', () => {
    expect(equipesPermitidasEfetivas(usuarioBase({ equipeId: 'EQ_SOC' }))).toEqual(['EQ_SOC']);
  });

  it('cai para [equipeId] quando a lista está presente mas vazia', () => {
    expect(equipesPermitidasEfetivas(usuarioBase({ equipeId: 'EQ_SOC', equipesPermitidas: [] })))
      .toEqual(['EQ_SOC']);
  });
});

describe('podeGerenciarUnidade', () => {
  it('admin sempre pode, independente de unidadesPermitidas', () => {
    expect(podeGerenciarUnidade(usuarioBase({ perfil: 'ADMIN_SISTEMA' }), 'QUALQUER_UNIDADE')).toBe(true);
  });

  it('GESTOR_UNIDADE só pode dentro de unidadesPermitidasEfetivas', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_UNIDADE', unidadesPermitidas: ['GEDSI', 'COSI'] });
    expect(podeGerenciarUnidade(gestor, 'COSI')).toBe(true);
    expect(podeGerenciarUnidade(gestor, 'CODB')).toBe(false);
  });

  it('nenhum outro perfil gerencia unidade, mesmo com unidadeId próprio', () => {
    expect(podeGerenciarUnidade(usuarioBase({ perfil: 'GESTOR_EQUIPE', unidadeId: 'COSI' }), 'COSI')).toBe(false);
  });
});

describe('podeGerenciarEquipe', () => {
  it('admin sempre pode, independente de equipesPermitidas', () => {
    expect(podeGerenciarEquipe(usuarioBase({ perfil: 'ADMIN_SISTEMA' }), 'QUALQUER_EQUIPE')).toBe(true);
  });

  it('qualquer perfil com equipeId próprio continua podendo gerenciar a própria equipe sem equipesPermitidas explícito', () => {
    expect(podeGerenciarEquipe(usuarioBase({ equipeId: 'EQ_SOC' }), 'EQ_SOC')).toBe(true);
    expect(podeGerenciarEquipe(usuarioBase({ equipeId: 'EQ_SOC' }), 'EQ_NOC')).toBe(false);
  });

  it('GESTOR_UNIDADE com equipesPermitidas explícito respeita a lista', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC', 'EQ_NOC'] });
    expect(podeGerenciarEquipe(gestor, 'EQ_NOC')).toBe(true);
    expect(podeGerenciarEquipe(gestor, 'EQ_OUTRA')).toBe(false);
  });
});

describe('souGestorDePlantao', () => {
  it('true para ADMIN_SISTEMA', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'ADMIN_SISTEMA' }))).toBe(true);
  });

  it('true para GESTOR_EQUIPE', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'GESTOR_EQUIPE' }))).toBe(true);
  });

  it('false para GESTOR_UNIDADE — Plantão não é administrado por quem gerencia a unidade', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'GESTOR_UNIDADE' }))).toBe(false);
  });

  it('false para ANALISTA_SOC', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'ANALISTA_SOC' }))).toBe(false);
  });
});

describe('podeGerenciarGrupoPlantao', () => {
  it('admin sempre pode, mesmo sem pertencer à equipe responsável', () => {
    expect(podeGerenciarGrupoPlantao(usuarioBase({ perfil: 'ADMIN_SISTEMA', equipeId: 'EQ_OUTRA' }), 'EQ_SOC')).toBe(true);
  });

  it('GESTOR_EQUIPE só pode dentro de equipesPermitidasEfetivas', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC', 'EQ_PLANTAO_COSI'] });
    expect(podeGerenciarGrupoPlantao(gestor, 'EQ_PLANTAO_COSI')).toBe(true);
    expect(podeGerenciarGrupoPlantao(gestor, 'EQ_NOC')).toBe(false);
  });

  it('pertencer à equipe responsável NÃO basta sem ser GESTOR_EQUIPE/ADMIN_SISTEMA — mesmo bug corrigido nas Rules na Fase PLANTÃO-3A', () => {
    const analista = usuarioBase({ perfil: 'ANALISTA_SOC', equipeId: 'EQ_SOC' });
    expect(podeGerenciarGrupoPlantao(analista, 'EQ_SOC')).toBe(false);
  });

  it('GESTOR_UNIDADE não administra Plantão mesmo com a equipe em unidadesPermitidas', () => {
    const gestorUnidade = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_SOC', unidadesPermitidas: ['COSI'] });
    expect(podeGerenciarGrupoPlantao(gestorUnidade, 'EQ_SOC')).toBe(false);
  });
});
