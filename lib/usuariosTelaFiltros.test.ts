import { describe, expect, it } from 'vitest';

import type { Usuario } from './modelos';
import {
  FILTRO_SETOR_TODOS,
  opcoesFiltroSetorUsuariosPlantao,
  usuarioCorrespondeBuscaTextual,
  usuarioPertenceAoFiltroSetorPlantao,
  type GrupoPlantaoParaFiltroSetor,
} from './usuariosTelaFiltros';

function usuarioBase(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    login: 'fulano',
    nome: 'Fulano',
    email: 'fulano@empresa.com',
    cargo: '',
    equipeId: 'EQ_X',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...sobrescritas,
  };
}

const grupo: GrupoPlantaoParaFiltroSetor = {
  grupoId: 'PLANTAO_GEDSI_COSI',
  nome: 'Plantão COSI',
  equipeResponsavelId: 'GEDSI_COSI_PLANTAO',
  equipesConsulta: ['GEDSI_COSI_PLANTAO', 'GEDSI_COSI_SOC'],
  unidadeResponsavelId: 'GEDSI_COSI',
};

describe('opcoesFiltroSetorUsuariosPlantao', () => {
  it('gera Todos, Plantão <nome>, uma opção por equipe consultora (exceto a responsável) e a unidade inteira', () => {
    const opcoes = opcoesFiltroSetorUsuariosPlantao(
      grupo,
      new Map([['GEDSI_COSI_SOC', 'SOC']]),
      new Map([['GEDSI_COSI', 'COSI']]),
    );
    expect(opcoes).toEqual([
      { id: 'todos', rotulo: 'Todos' },
      { id: 'plantao', rotulo: 'Plantão Plantão COSI' },
      { id: 'equipe:GEDSI_COSI_SOC', rotulo: 'SOC' },
      { id: 'unidade', rotulo: 'COSI inteiro' },
    ]);
  });

  it('usa o id técnico como rótulo quando o nome da equipe/unidade é desconhecido', () => {
    const opcoes = opcoesFiltroSetorUsuariosPlantao(grupo, new Map(), new Map());
    expect(opcoes.find((opcao) => opcao.id === 'equipe:GEDSI_COSI_SOC')?.rotulo).toBe('GEDSI_COSI_SOC');
    expect(opcoes.find((opcao) => opcao.id === 'unidade')?.rotulo).toBe('GEDSI_COSI inteiro');
  });

  it('nunca gera a opção de unidade quando o Grupo não tem unidadeResponsavelId', () => {
    const opcoes = opcoesFiltroSetorUsuariosPlantao({ ...grupo, unidadeResponsavelId: undefined }, new Map(), new Map());
    expect(opcoes.some((opcao) => opcao.id === 'unidade')).toBe(false);
  });

  it('nunca duplica a equipe responsável como uma opção separada de "equipe:"', () => {
    const opcoes = opcoesFiltroSetorUsuariosPlantao(grupo, new Map(), new Map());
    expect(opcoes.some((opcao) => opcao.id === 'equipe:GEDSI_COSI_PLANTAO')).toBe(false);
  });
});

describe('usuarioPertenceAoFiltroSetorPlantao', () => {
  it('Todos sempre inclui qualquer usuário', () => {
    expect(usuarioPertenceAoFiltroSetorPlantao(usuarioBase(), FILTRO_SETOR_TODOS, grupo, new Set())).toBe(true);
  });

  it('Plantão inclui por equipeId da equipe responsável', () => {
    const usuario = usuarioBase({ equipeId: 'GEDSI_COSI_PLANTAO' });
    expect(usuarioPertenceAoFiltroSetorPlantao(usuario, 'plantao', grupo, new Set())).toBe(true);
  });

  it('Plantão inclui por cadastroOperacional PLANTAO apontando o mesmo grupo', () => {
    const usuario = usuarioBase({
      equipeId: 'ALGUMA_OUTRA_EQUIPE',
      cadastroOperacional: { tipo: 'PLANTAO', alvoId: 'PLANTAO_GEDSI_COSI', criadoPorLogin: 'admin' },
    });
    expect(usuarioPertenceAoFiltroSetorPlantao(usuario, 'plantao', grupo, new Set())).toBe(true);
  });

  it('cadastroOperacional PLANTAO de outro grupo não conta para este filtro', () => {
    const usuario = usuarioBase({
      equipeId: 'ALGUMA_OUTRA_EQUIPE',
      cadastroOperacional: { tipo: 'PLANTAO', alvoId: 'PLANTAO_OUTRO_GRUPO', criadoPorLogin: 'admin' },
    });
    expect(usuarioPertenceAoFiltroSetorPlantao(usuario, 'plantao', grupo, new Set())).toBe(false);
  });

  it('Plantão inclui por login participante ativo publicado, mesmo com equipeId de outra área (ex.: Jean do SOC)', () => {
    const jean = usuarioBase({ login: 'jean', equipeId: 'GEDSI_COSI_SOC' });
    expect(usuarioPertenceAoFiltroSetorPlantao(jean, 'plantao', grupo, new Set(['jean']))).toBe(true);
    expect(usuarioPertenceAoFiltroSetorPlantao(jean, `equipe:GEDSI_COSI_SOC`, grupo, new Set(['jean']))).toBe(true);
  });

  it('filtro de equipe (equipesConsulta) inclui só quem tem exatamente aquele equipeId', () => {
    const doSoc = usuarioBase({ equipeId: 'GEDSI_COSI_SOC' });
    const doPlantao = usuarioBase({ equipeId: 'GEDSI_COSI_PLANTAO' });
    expect(usuarioPertenceAoFiltroSetorPlantao(doSoc, 'equipe:GEDSI_COSI_SOC', grupo, new Set())).toBe(true);
    expect(usuarioPertenceAoFiltroSetorPlantao(doPlantao, 'equipe:GEDSI_COSI_SOC', grupo, new Set())).toBe(false);
  });

  it('Unidade inclui por unidadeId ou unidadesPermitidas contendo a unidade responsável', () => {
    const porUnidadeId = usuarioBase({ equipeId: 'OUTRA', unidadeId: 'GEDSI_COSI' });
    const porUnidadesPermitidas = usuarioBase({ equipeId: 'OUTRA', unidadesPermitidas: ['GEDSI_COSI'] });
    const foraDaUnidade = usuarioBase({ equipeId: 'OUTRA', unidadeId: 'OUTRA_UNIDADE' });
    expect(usuarioPertenceAoFiltroSetorPlantao(porUnidadeId, 'unidade', grupo, new Set())).toBe(true);
    expect(usuarioPertenceAoFiltroSetorPlantao(porUnidadesPermitidas, 'unidade', grupo, new Set())).toBe(true);
    expect(usuarioPertenceAoFiltroSetorPlantao(foraDaUnidade, 'unidade', grupo, new Set())).toBe(false);
  });

  it('Unidade nunca inclui ninguém quando o Grupo não tem unidadeResponsavelId', () => {
    const usuario = usuarioBase({ unidadeId: 'GEDSI_COSI' });
    expect(usuarioPertenceAoFiltroSetorPlantao(usuario, 'unidade', { ...grupo, unidadeResponsavelId: undefined }, new Set())).toBe(false);
  });

  it('nunca altera perfil/escopo/equipeId/cargo do usuário — é uma função pura, só lê', () => {
    const original = usuarioBase({ perfil: 'ANALISTA_SOC', cargo: 'Analista' });
    const copia = { ...original };
    usuarioPertenceAoFiltroSetorPlantao(original, 'plantao', grupo, new Set());
    expect(original).toEqual(copia);
  });
});

describe('usuarioCorrespondeBuscaTextual', () => {
  it('termo vazio sempre corresponde', () => {
    expect(usuarioCorrespondeBuscaTextual(usuarioBase(), '')).toBe(true);
    expect(usuarioCorrespondeBuscaTextual(usuarioBase(), '   ')).toBe(true);
  });

  it('corresponde por nome ou login', () => {
    const jean = usuarioBase({ login: 'jean', nome: 'Jean Carlo Machado Ribeiro' });
    expect(usuarioCorrespondeBuscaTextual(jean, 'jean')).toBe(true);
    expect(usuarioCorrespondeBuscaTextual(jean, 'Carlo Machado')).toBe(true);
    expect(usuarioCorrespondeBuscaTextual(jean, 'clis')).toBe(false);
  });

  it('corresponde por e-mail', () => {
    const usuario = usuarioBase({ email: 'jean.ribeiro@ici.tec.br' });
    expect(usuarioCorrespondeBuscaTextual(usuario, 'jean.ribeiro@ici.tec.br')).toBe(true);
  });

  it('corresponde por cargo real', () => {
    const usuario = usuarioBase({ cargo: 'Analista de Segurança da Informação' });
    expect(usuarioCorrespondeBuscaTextual(usuario, 'segurança')).toBe(true);
  });

  it('corresponde por loginAliases e aliasesPlanilha', () => {
    const comAliasLogin = usuarioBase({ loginAliases: ['jean.cmr'] });
    const comAliasPlanilha = usuarioBase({ aliasesPlanilha: ['J. Carlo'] });
    expect(usuarioCorrespondeBuscaTextual(comAliasLogin, 'jean.cmr')).toBe(true);
    expect(usuarioCorrespondeBuscaTextual(comAliasPlanilha, 'J. Carlo')).toBe(true);
  });
});
