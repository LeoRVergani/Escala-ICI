import { describe, expect, it } from 'vitest';

import type { Equipe, UnidadeOrganizacional, Usuario } from './modelos';
import {
  achatarArvore,
  caminhoCurto,
  calcularResumoOrganizacional,
  caminhoLegivel,
  construirArvoreUnidades,
  ehUsuarioTecnicoOuFake,
  formariaCiclo,
  rotuloCompacto,
  rotuloGestorParaSimulacao,
  rotuloOpcaoUnidade,
  trechoFinalCaminho,
} from './organizacao';

function unidade(sobrescritas: Partial<UnidadeOrganizacional> = {}): UnidadeOrganizacional {
  return {
    unidadeId: 'X',
    nome: 'X',
    sigla: 'X',
    tipo: 'SETOR' as const,
    parentId: null,
    caminho: ['X'],
    ativa: true,
    criadoPorLogin: 'admin',
    ...sobrescritas,
  };
}

const diretoria = unidade({
  unidadeId: 'DIRETOR_PRESIDENTE',
  nome: 'Diretor Presidente',
  sigla: 'PRESIDENCIA',
  tipo: 'PRESIDENCIA',
  parentId: null,
  caminho: ['DIRETOR_PRESIDENTE'],
});
const dirInfra = unidade({
  unidadeId: 'DIR_INFRA_SEGURANCA',
  nome: 'Diretoria de Infraestrutura e Segurança da Informação',
  sigla: 'DIR_INFRA_SEG',
  tipo: 'DIRETORIA',
  parentId: 'DIRETOR_PRESIDENTE',
  caminho: ['DIRETOR_PRESIDENTE', 'DIR_INFRA_SEGURANCA'],
});
const gedsi = unidade({
  unidadeId: 'GEDSI',
  nome: 'Gerência de Data Center e Segurança da Informação',
  sigla: 'GEDSI',
  tipo: 'GERENCIA',
  parentId: 'DIR_INFRA_SEGURANCA',
  caminho: ['DIRETOR_PRESIDENTE', 'DIR_INFRA_SEGURANCA', 'GEDSI'],
});
const cosi = unidade({
  unidadeId: 'COSI',
  nome: 'COSI',
  sigla: 'COSI',
  tipo: 'COORDENACAO',
  parentId: 'GEDSI',
  caminho: ['DIRETOR_PRESIDENTE', 'DIR_INFRA_SEGURANCA', 'GEDSI', 'COSI'],
});
const codb = unidade({
  unidadeId: 'CODB',
  nome: 'CODB',
  sigla: 'CODB',
  tipo: 'COORDENACAO',
  parentId: 'GEDSI',
  caminho: ['DIRETOR_PRESIDENTE', 'DIR_INFRA_SEGURANCA', 'GEDSI', 'CODB'],
});
const supervisorTi = unidade({
  unidadeId: 'SUPERVISOR_TI',
  nome: 'Supervisor de TI',
  sigla: 'SUP_TI',
  tipo: 'SUPERVISAO',
  parentId: 'CODB',
  caminho: ['DIRETOR_PRESIDENTE', 'DIR_INFRA_SEGURANCA', 'GEDSI', 'CODB', 'SUPERVISOR_TI'],
});

const todasUnidades = [diretoria, dirInfra, gedsi, cosi, codb, supervisorTi];

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

function equipeBase(sobrescritas: Partial<Equipe> = {}): Equipe {
  return { id: 'EQ_SOC', nome: 'SOC', sigla: 'SOC', ativa: true, ...sobrescritas };
}

describe('rotuloCompacto', () => {
  it('usa o nome quando ele já é curto', () => {
    expect(rotuloCompacto(cosi)).toBe('COSI');
    expect(rotuloCompacto(supervisorTi)).toBe('Supervisor de TI');
  });

  it('cai para a sigla quando o nome é longo', () => {
    expect(rotuloCompacto(gedsi)).toBe('GEDSI');
    expect(rotuloCompacto(dirInfra)).toBe('DIR_INFRA_SEG');
  });
});

describe('caminhoLegivel / trechoFinalCaminho / caminhoCurto', () => {
  it('caminhoLegivel mostra o caminho completo com rótulos compactos por nível', () => {
    expect(caminhoLegivel(cosi.caminho, todasUnidades)).toBe('Diretor Presidente > DIR_INFRA_SEG > GEDSI > COSI');
  });

  it('trechoFinalCaminho mostra só os últimos níveis, sem indicação de corte', () => {
    expect(trechoFinalCaminho(cosi.caminho, todasUnidades, 2)).toBe('GEDSI > COSI');
    expect(trechoFinalCaminho(supervisorTi.caminho, todasUnidades, 2)).toBe('CODB > Supervisor de TI');
  });

  it('caminhoCurto prefixa "…" só quando o caminho é mais longo que o recorte', () => {
    expect(caminhoCurto(cosi.caminho, todasUnidades, 2)).toBe('… > GEDSI > COSI');
    expect(caminhoCurto(diretoria.caminho, todasUnidades, 2)).toBe('Diretor Presidente');
  });
});

describe('rotuloOpcaoUnidade', () => {
  it('usa o unidadeId como identificador e o trecho final como contexto', () => {
    expect(rotuloOpcaoUnidade(cosi, todasUnidades)).toBe('COSI — GEDSI > COSI');
    expect(rotuloOpcaoUnidade(codb, todasUnidades)).toBe('CODB — GEDSI > CODB');
    expect(rotuloOpcaoUnidade(supervisorTi, todasUnidades)).toBe('SUPERVISOR_TI — CODB > Supervisor de TI');
  });
});

describe('construirArvoreUnidades / achatarArvore', () => {
  it('monta a hierarquia a partir de parentId, ordenando irmãos por nome', () => {
    const arvore = construirArvoreUnidades(todasUnidades);
    expect(arvore).toHaveLength(1);
    expect(arvore[0]?.unidade.unidadeId).toBe('DIRETOR_PRESIDENTE');
    const [gedsiFilho] = arvore[0]!.filhos[0]!.filhos;
    expect(gedsiFilho?.unidade.unidadeId).toBe('GEDSI');
    expect(gedsiFilho?.filhos.map((no) => no.unidade.unidadeId)).toEqual(['CODB', 'COSI']);
  });

  it('trata unidade com parentId desconhecido como raiz, em vez de descartá-la', () => {
    const orfa = unidade({ unidadeId: 'ORFA', nome: 'Órfã', parentId: 'NAO_EXISTE', caminho: ['ORFA'] });
    const arvore = construirArvoreUnidades([cosi, orfa]);
    expect(arvore.map((no) => no.unidade.unidadeId)).toContain('ORFA');
  });

  it('achatarArvore devolve pré-ordem (pai antes dos filhos)', () => {
    const achatada = achatarArvore(construirArvoreUnidades(todasUnidades));
    const indice = (id: string) => achatada.findIndex((no) => no.unidade.unidadeId === id);
    expect(indice('DIRETOR_PRESIDENTE')).toBeLessThan(indice('GEDSI'));
    expect(indice('GEDSI')).toBeLessThan(indice('COSI'));
    expect(indice('CODB')).toBeLessThan(indice('SUPERVISOR_TI'));
  });
});

describe('formariaCiclo', () => {
  it('nega auto-referência direta', () => {
    expect(formariaCiclo('GEDSI', 'GEDSI', todasUnidades)).toBe(true);
  });

  it('nega colocar um ancestral como filho do seu próprio descendente', () => {
    expect(formariaCiclo('GEDSI', 'COSI', todasUnidades)).toBe(true);
  });

  it('permite reparentar para um ramo que não é descendente', () => {
    expect(formariaCiclo('COSI', 'CODB', todasUnidades)).toBe(false);
  });

  it('permite qualquer parentId quando a unidade ainda não tem ID definitivo', () => {
    expect(formariaCiclo('', 'COSI', todasUnidades)).toBe(false);
  });

  it('parentId nulo (raiz) nunca forma ciclo', () => {
    expect(formariaCiclo('COSI', null, todasUnidades)).toBe(false);
  });
});

describe('ehUsuarioTecnicoOuFake', () => {
  it('reconhece um login humano normal como real', () => {
    expect(ehUsuarioTecnicoOuFake({ login: 'marina.azevedo', email: 'marina.azevedo@empresa.com' })).toBe(false);
  });

  it('marca prefixos técnicos conhecidos', () => {
    expect(ehUsuarioTecnicoOuFake({ login: 'usuario-123', email: '' })).toBe(true);
    expect(ehUsuarioTecnicoOuFake({ login: 'pendente-abc', email: '' })).toBe(true);
  });

  it('marca login que parece UID do Firebase (sem ponto, longo, alfanumérico)', () => {
    expect(ehUsuarioTecnicoOuFake({ login: 'aB3dEf7gH9iJ1kL2mN3o', email: '' })).toBe(true);
  });

  it('marca quando o e-mail não bate com o login', () => {
    expect(ehUsuarioTecnicoOuFake({ login: 'marina.azevedo', email: 'outraconta@empresa.com' })).toBe(true);
  });

  it('não marca quando não há e-mail para comparar', () => {
    expect(ehUsuarioTecnicoOuFake({ login: 'marina.azevedo', email: '' })).toBe(false);
  });
});

describe('calcularResumoOrganizacional', () => {
  it('agrega contagens de unidades, equipes e usuários', () => {
    const usuarios = [
      usuarioBase({ login: 'marina.azevedo', email: 'marina.azevedo@empresa.com', perfil: 'GESTOR_EQUIPE', ativo: true }),
      usuarioBase({ login: 'caio.monteiro', email: 'caio.monteiro@empresa.com', ativo: true }),
      usuarioBase({ login: 'usuario-999', email: '', ativo: false }),
    ];
    const equipes = [equipeBase({ id: 'EQ_SOC', unidadeId: 'COSI' }), equipeBase({ id: 'EQ_SEM_UNIDADE' })];
    const resumo = calcularResumoOrganizacional(todasUnidades, equipes, usuarios);
    expect(resumo).toEqual({
      totalUnidades: todasUnidades.length,
      totalEquipes: 2,
      usuariosAtivos: 2,
      usuariosTecnicosOuFake: 1,
      totalGestores: 1,
      equipesSemUnidade: 1,
    });
  });
});

describe('rotuloGestorParaSimulacao', () => {
  it('mostra unidadesPermitidas para GESTOR_UNIDADE', () => {
    const gestor = usuarioBase({ nome: 'Gestor COSI', perfil: 'GESTOR_UNIDADE', unidadesPermitidas: ['COSI'] });
    expect(rotuloGestorParaSimulacao(gestor)).toBe('Gestor COSI — GESTOR_UNIDADE — COSI');
  });

  it('mostra equipesPermitidas (ou fallback por equipeId) para GESTOR_EQUIPE/SUPERVISOR_EQUIPE', () => {
    const gestor = usuarioBase({ nome: 'Marina Azevedo', perfil: 'GESTOR_EQUIPE', equipeId: 'EQ_SOC' });
    expect(rotuloGestorParaSimulacao(gestor)).toBe('Marina Azevedo — GESTOR_EQUIPE — EQ_SOC');

    const supervisor = usuarioBase({ nome: 'Supervisor NOC', perfil: 'SUPERVISOR_EQUIPE', equipeId: 'EQ_NOC' });
    expect(rotuloGestorParaSimulacao(supervisor)).toBe('Supervisor NOC — SUPERVISOR_EQUIPE — EQ_NOC');
  });
});
