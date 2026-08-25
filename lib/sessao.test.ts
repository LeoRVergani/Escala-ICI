import { describe, expect, it } from 'vitest';

import type { Usuario } from './modelos';
import {
  chavePreferenciaSessao,
  deveExibirRestauracao,
  ehAdminSistema,
  ehPerfilElegivelParaAmploStaging,
  equipesPermitidasEfetivas,
  escopoDoGrupoPlantaoNoMeuAlcance,
  escopoEfetivo,
  estadoInicialSessao,
  nivelPermiteDashboard,
  perfilEfetivo,
  podeAutoVincularConsultaPlantao,
  podeGerenciarEquipe,
  podeGerenciarGrupoPlantao,
  podeGerenciarUnidade,
  podeIniciarListeners,
  preferenciaPadraoSessao,
  resolverManterConectado,
  rotuloCargoExibicao,
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

describe('rotuloCargoExibicao (PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1)', () => {
  it('mostra o cargo real quando cadastrado, mesmo para um perfil de coordenador', () => {
    expect(rotuloCargoExibicao(usuarioBase({ cargo: 'Analista de Segurança da Informação', nivelHierarquico: 6 })))
      .toBe('Analista de Segurança da Informação');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: 'Coordenador de Operações', perfil: 'GESTOR_UNIDADE', nivelHierarquico: 3 })))
      .toBe('Coordenador de Operações');
  });

  it('só usa o fallback quando cargo está vazio (string vazia ou só espaços)', () => {
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '', nivelHierarquico: 6 }))).toBe('Analista SOC');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '   ', nivelHierarquico: 6 }))).toBe('Analista SOC');
  });

  it('fallback é baseado em perfilEfetivo(), nunca sobrescreve um cargo real', () => {
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '', perfil: 'GESTOR_EQUIPE' }))).toBe('Coordenador');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '', perfil: 'GESTOR_UNIDADE' }))).toBe('Coordenador');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '', perfil: 'SUPERVISOR_EQUIPE' }))).toBe('Coordenador');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '', perfil: 'ADMIN_SISTEMA' }))).toBe('Coordenador');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: '', perfil: 'ANALISTA_SOC' }))).toBe('Analista SOC');
    expect(rotuloCargoExibicao(usuarioBase({ cargo: 'Analista Pleno', perfil: 'GESTOR_UNIDADE' }))).toBe('Analista Pleno');
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

  it('true para GESTOR_UNIDADE — mudança de regra aprovada na Fase ESCOPO-GESTOR-UNIDADE-1: só gate de VISIBILIDADE de tela, a autorização real por Grupo continua em podeGerenciarGrupoPlantao()', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'GESTOR_UNIDADE' }))).toBe(true);
  });

  it('true para SUPERVISOR_EQUIPE (Fase ESCOPO-CONSULTA-PLANTAO-1 — mesmo alcance de GESTOR_EQUIPE, senão Wanessa/NOC nunca carregaria gruposPlantao para configurar Plantões monitorados)', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'SUPERVISOR_EQUIPE' }))).toBe(true);
  });

  it('false para ANALISTA_SOC', () => {
    expect(souGestorDePlantao(usuarioBase({ perfil: 'ANALISTA_SOC' }))).toBe(false);
  });
});

describe('podeGerenciarGrupoPlantao', () => {
  it('admin sempre pode, mesmo sem pertencer à equipe responsável', () => {
    expect(podeGerenciarGrupoPlantao(
      usuarioBase({ perfil: 'ADMIN_SISTEMA', equipeId: 'EQ_OUTRA' }),
      { equipeResponsavelId: 'EQ_SOC' },
    )).toBe(true);
  });

  it('GESTOR_EQUIPE só pode dentro de equipesPermitidasEfetivas', () => {
    const gestor = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC', 'EQ_PLANTAO_COSI'] });
    expect(podeGerenciarGrupoPlantao(gestor, { equipeResponsavelId: 'EQ_PLANTAO_COSI' })).toBe(true);
    expect(podeGerenciarGrupoPlantao(gestor, { equipeResponsavelId: 'EQ_NOC' })).toBe(false);
  });

  /**
   * PATCH-NOC-SUPERVISAO-CONSULTA-PLANTAO-UX-1 — SUPERVISOR_EQUIPE tem o
   * MESMO alcance de GESTOR_EQUIPE aqui (só dentro da própria
   * equipesPermitidasEfetivas, nunca fora dela).
   */
  it('SUPERVISOR_EQUIPE tem o mesmo alcance de GESTOR_EQUIPE, só dentro de equipesPermitidasEfetivas', () => {
    const supervisora = usuarioBase({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC', 'EQ_PLANTAO_COSI'] });
    expect(podeGerenciarGrupoPlantao(supervisora, { equipeResponsavelId: 'EQ_PLANTAO_COSI' })).toBe(true);
    expect(podeGerenciarGrupoPlantao(supervisora, { equipeResponsavelId: 'EQ_NOC' })).toBe(false);
  });

  it('pertencer à equipe responsável NÃO basta sem ser GESTOR_EQUIPE/SUPERVISOR_EQUIPE/ADMIN_SISTEMA — mesmo bug corrigido nas Rules na Fase PLANTÃO-3A', () => {
    const analista = usuarioBase({ perfil: 'ANALISTA_SOC', equipeId: 'EQ_SOC' });
    expect(podeGerenciarGrupoPlantao(analista, { equipeResponsavelId: 'EQ_SOC' })).toBe(false);
  });

  it('GESTOR_UNIDADE administra o Grupo quando unidadeResponsavelId está em unidadesPermitidasEfetivas (Fase ESCOPO-GESTOR-UNIDADE-1)', () => {
    const gestorUnidade = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_SOC', unidadesPermitidas: ['COSI'] });
    expect(podeGerenciarGrupoPlantao(gestorUnidade, {
      equipeResponsavelId: 'EQ_PLANTAO_COSI',
      unidadeResponsavelId: 'COSI',
    })).toBe(true);
  });

  it('GESTOR_UNIDADE administra via unidade ANCESTRAL, usando caminhoUnidadeResponsavel materializado (sem travessia de parentId)', () => {
    const gestorUnidade = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_SOC', unidadesPermitidas: ['COSI'] });
    expect(podeGerenciarGrupoPlantao(gestorUnidade, {
      equipeResponsavelId: 'EQ_PLANTAO_COSI_SUL',
      unidadeResponsavelId: 'COSI_SUL',
      caminhoUnidadeResponsavel: ['COSI', 'COSI_SUL'],
    })).toBe(true);
  });

  it('GESTOR_UNIDADE não administra Grupo fora do escopo, nem Grupo sem unidadeResponsavelId (documento antigo, retrocompatível)', () => {
    const gestorUnidade = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_SOC', unidadesPermitidas: ['COSI'] });
    expect(podeGerenciarGrupoPlantao(gestorUnidade, {
      equipeResponsavelId: 'EQ_NOC',
      unidadeResponsavelId: 'CODB',
    })).toBe(false);
    expect(podeGerenciarGrupoPlantao(gestorUnidade, { equipeResponsavelId: 'EQ_SOC' })).toBe(false);
  });
});

describe('STAGING-RESET-HIERARQUIA-ICI-1 — helpers da liberação operacional de staging (só UX, a autorização real fica nas Rules)', () => {
  describe('ehPerfilElegivelParaAmploStaging', () => {
    it('true para ADMIN_SISTEMA, GESTOR_UNIDADE, GESTOR_EQUIPE e SUPERVISOR_EQUIPE', () => {
      for (const perfil of ['ADMIN_SISTEMA', 'GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'] as const) {
        expect(ehPerfilElegivelParaAmploStaging(usuarioBase({ perfil }))).toBe(true);
      }
    });

    it('false para ANALISTA_SOC, ANALISTA_SUPORTE e LEITURA', () => {
      for (const perfil of ['ANALISTA_SOC', 'ANALISTA_SUPORTE', 'LEITURA'] as const) {
        expect(ehPerfilElegivelParaAmploStaging(usuarioBase({ perfil }))).toBe(false);
      }
    });
  });

  describe('escopoDoGrupoPlantaoNoMeuAlcance', () => {
    /**
     * PATCH-NOC-SUPERVISAO-CONSULTA-PLANTAO-UX-1 — antes desta fase,
     * `podeGerenciarGrupoPlantao()` só reconhecia GESTOR_EQUIPE/ADMIN_SISTEMA
     * e divergia deste helper (que já tratava SUPERVISOR_EQUIPE com o mesmo
     * alcance). Agora os dois concordam.
     */
    it('true quando equipeResponsavelId está em equipesPermitidasEfetivas, inclusive para SUPERVISOR_EQUIPE (agora também coberto por podeGerenciarGrupoPlantao)', () => {
      const supervisora = usuarioBase({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_PLANTAO_COSI', equipesPermitidas: ['EQ_PLANTAO_COSI'] });
      expect(podeGerenciarGrupoPlantao(supervisora, { equipeResponsavelId: 'EQ_PLANTAO_COSI' })).toBe(true);
      expect(escopoDoGrupoPlantaoNoMeuAlcance(supervisora, { equipeResponsavelId: 'EQ_PLANTAO_COSI' })).toBe(true);
    });

    it('true via unidadeResponsavelId (ou caminho ancestral) em unidadesPermitidasEfetivas', () => {
      const gestorUnidade = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_SOC', unidadesPermitidas: ['COSI'] });
      expect(escopoDoGrupoPlantaoNoMeuAlcance(gestorUnidade, {
        equipeResponsavelId: 'EQ_PLANTAO_COSI_SUL',
        unidadeResponsavelId: 'COSI_SUL',
        caminhoUnidadeResponsavel: ['COSI', 'COSI_SUL'],
      })).toBe(true);
    });

    it('false fora do escopo (nem equipe nem unidade permitida cobrem o Grupo)', () => {
      const gestorEquipe = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC', equipesPermitidas: ['EQ_SOC'] });
      expect(escopoDoGrupoPlantaoNoMeuAlcance(gestorEquipe, { equipeResponsavelId: 'EQ_NOC' })).toBe(false);
    });
  });
});

describe('podeAutoVincularConsultaPlantao — Fase ESCOPO-CONSULTA-PLANTAO-1 (Plantões monitorados por equipe)', () => {
  it('SUPERVISOR_EQUIPE/GESTOR_EQUIPE adiciona a própria equipe em equipesConsulta de um Grupo que não administra', () => {
    const wanessa = usuarioBase({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    expect(podeAutoVincularConsultaPlantao(wanessa, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI')).toBe(true);
    const gestorEquipe = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    expect(podeAutoVincularConsultaPlantao(gestorEquipe, ['EQ_PLANTAO_CODB'], ['EQ_PLANTAO_CODB', 'EQ_NOC'], 'EQ_PLANTAO_CODB')).toBe(true);
  });

  it('remove a própria equipe (desmonitorar)', () => {
    const wanessa = usuarioBase({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    expect(podeAutoVincularConsultaPlantao(wanessa, ['EQ_PLANTAO_COSI', 'EQ_NOC'], ['EQ_PLANTAO_COSI'], 'EQ_PLANTAO_COSI')).toBe(true);
  });

  it('não consegue adicionar/remover outra equipe que não administra', () => {
    const wanessa = usuarioBase({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    expect(podeAutoVincularConsultaPlantao(wanessa, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_SOC'], 'EQ_PLANTAO_COSI')).toBe(false);
  });

  it('equipeResponsavelId nunca pode sair de equipesConsulta, mesmo se o usuário administrasse essa equipe', () => {
    const gestorMultiEquipe = usuarioBase({ perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC', 'EQ_PLANTAO_COSI'] });
    expect(podeAutoVincularConsultaPlantao(gestorMultiEquipe, ['EQ_PLANTAO_COSI', 'EQ_NOC'], ['EQ_NOC'], 'EQ_PLANTAO_COSI')).toBe(false);
  });

  it('duas mudanças na mesma chamada é negado — só uma equipe por vez', () => {
    const wanessa = usuarioBase({ perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC', equipesPermitidas: ['EQ_NOC'] });
    expect(podeAutoVincularConsultaPlantao(wanessa, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC', 'EQ_SOC'], 'EQ_PLANTAO_COSI')).toBe(false);
  });

  it('analista comum não consegue, mesmo pertencendo à equipe', () => {
    const analista = usuarioBase({ perfil: 'ANALISTA_SOC', equipeId: 'EQ_NOC' });
    expect(podeAutoVincularConsultaPlantao(analista, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI')).toBe(false);
  });

  it('ADMIN_SISTEMA não precisa deste caminho — já tem podeGerenciarGrupoPlantao() livre (esta função não precisa retornar true para admin)', () => {
    const admin = usuarioBase({ perfil: 'ADMIN_SISTEMA', equipeId: 'EQ_OUTRA' });
    // ADMIN_SISTEMA não é GESTOR_EQUIPE/SUPERVISOR_EQUIPE, então este
    // caminho específico retorna false — mas o admin já passa livremente
    // por podeGerenciarGrupoPlantao(), então nada fica bloqueado de fato.
    expect(podeAutoVincularConsultaPlantao(admin, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI')).toBe(false);
  });

  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — GESTOR_UNIDADE
   * vincula/desvincula qualquer equipe da própria unidade (ou descendente),
   * mesmo sem equipesPermitidas explícito sobre ela — diferente de
   * GESTOR_EQUIPE/SUPERVISOR_EQUIPE, precisa da lista de equipes carregada
   * (dado que não está em Usuario).
   */
  it('GESTOR_UNIDADE vincula equipe da própria unidade a um Grupo externo, mesmo sem equipesPermitidas', () => {
    const coordenador = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_CODB', unidadesPermitidas: ['GEDSI'] });
    const equipes = [
      { id: 'EQ_NOC', unidadeId: 'GEDSI', caminhoUnidade: ['GEDSI'] },
    ];
    expect(podeAutoVincularConsultaPlantao(
      coordenador, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI', equipes,
    )).toBe(true);
  });

  it('GESTOR_UNIDADE vincula via unidade ANCESTRAL, usando caminhoUnidade materializado', () => {
    const coordenador = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_CODB', unidadesPermitidas: ['GEDSI'] });
    const equipes = [
      { id: 'EQ_NOC', unidadeId: 'GEDSI_SUL', caminhoUnidade: ['GEDSI', 'GEDSI_SUL'] },
    ];
    expect(podeAutoVincularConsultaPlantao(
      coordenador, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI', equipes,
    )).toBe(true);
  });

  it('GESTOR_UNIDADE não vincula equipe de outra unidade', () => {
    const coordenador = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_CODB', unidadesPermitidas: ['GEDSI'] });
    const equipes = [
      { id: 'EQ_NOC', unidadeId: 'OUTRA_UNIDADE', caminhoUnidade: ['OUTRA_UNIDADE'] },
    ];
    expect(podeAutoVincularConsultaPlantao(
      coordenador, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI', equipes,
    )).toBe(false);
  });

  it('GESTOR_UNIDADE nega quando a equipe alterada não está na lista carregada — nunca assume presença', () => {
    const coordenador = usuarioBase({ perfil: 'GESTOR_UNIDADE', equipeId: 'EQ_CODB', unidadesPermitidas: ['GEDSI'] });
    expect(podeAutoVincularConsultaPlantao(
      coordenador, ['EQ_PLANTAO_COSI'], ['EQ_PLANTAO_COSI', 'EQ_NOC'], 'EQ_PLANTAO_COSI', [],
    )).toBe(false);
  });
});
