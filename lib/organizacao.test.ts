import { describe, expect, it } from 'vitest';

import type { Equipe, UnidadeOrganizacional, Usuario } from './modelos';
import {
  achatarArvore,
  achatarArvoreOrganizacional,
  alternarSelecaoMultipla,
  buscarNaArvoreOrganizacional,
  caminhoCurto,
  calcularResumoOrganizacional,
  caminhoLegivel,
  chaveDoNoOrganizacional,
  chaveFocavelNaArvore,
  construirArvoreOrganizacional,
  construirArvoreUnidades,
  ehUsuarioTecnicoOuFake,
  formariaCiclo,
  gestoresParaSimulacao,
  nosVisiveisNaArvoreOrganizacional,
  raizesComEquipesSemUnidade,
  rotuloCompacto,
  rotuloGestorParaSimulacao,
  rotuloOpcaoUnidade,
  rotuloUnidadePorId,
  trechoFinalCaminho,
  type NoArvoreOrganizacional,
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

describe('gestoresParaSimulacao', () => {
  it('exclui ADMIN_SISTEMA e perfis não-gestores', () => {
    const usuarios = [
      usuarioBase({ login: 'paula.ferraz', nome: 'Paula Ferraz', email: 'paula.ferraz@empresa.com', perfil: 'ADMIN_SISTEMA' }),
      usuarioBase({ login: 'caio.monteiro', nome: 'Caio Monteiro', email: 'caio.monteiro@empresa.com', perfil: 'ANALISTA_SOC' }),
      usuarioBase({ login: 'marina.azevedo', nome: 'Marina Azevedo', email: 'marina.azevedo@empresa.com', perfil: 'GESTOR_EQUIPE' }),
    ];
    const resultado = gestoresParaSimulacao(usuarios);
    expect(resultado.map((u) => u.login)).toEqual(['marina.azevedo']);
  });

  it('oculta cadastro técnico/fake por padrão', () => {
    const usuarios = [
      usuarioBase({ login: 'usuario-999', nome: 'Marina Azevedo', email: '', perfil: 'GESTOR_EQUIPE' }),
    ];
    expect(gestoresParaSimulacao(usuarios)).toEqual([]);
  });

  it('deduplica por nome, mantendo o login com cara humana sobre o técnico', () => {
    const legado = usuarioBase({
      login: 'aB3dEf7gH9iJ1kL2mN3o',
      nome: 'Marina Azevedo',
      email: 'marina.azevedo@empresa.com',
      perfil: 'GESTOR_EQUIPE',
    });
    const atual = usuarioBase({
      login: 'marina.azevedo',
      nome: 'Marina Azevedo',
      email: 'marina.azevedo@empresa.com',
      perfil: 'GESTOR_EQUIPE',
    });
    // Ordem não deveria importar — testamos as duas.
    expect(gestoresParaSimulacao([legado, atual]).map((u) => u.login)).toEqual(['marina.azevedo']);
    expect(gestoresParaSimulacao([atual, legado]).map((u) => u.login)).toEqual(['marina.azevedo']);
  });

  it('mantém gestores distintos sem nome em comum', () => {
    const usuarios = [
      usuarioBase({ login: 'marina.azevedo', nome: 'Marina Azevedo', email: 'marina.azevedo@empresa.com', perfil: 'GESTOR_EQUIPE' }),
      usuarioBase({ login: 'wanessa.lima', nome: 'Wanessa Lima', email: 'wanessa.lima@empresa.com', perfil: 'SUPERVISOR_EQUIPE' }),
    ];
    expect(gestoresParaSimulacao(usuarios).map((u) => u.login).sort()).toEqual(['marina.azevedo', 'wanessa.lima']);
  });
});

describe('construirArvoreOrganizacional', () => {
  const socNaCosi = equipeBase({ id: 'EQ_SOC', nome: 'SOC', unidadeId: 'COSI', caminhoUnidade: cosi.caminho });
  const plantaoNaCosi = equipeBase({ id: 'EQ_PLANTAO_COSI', nome: 'Plantão COSI', unidadeId: 'COSI', caminhoUnidade: cosi.caminho });
  const nocNaSupervisorTi = equipeBase({ id: 'EQ_NOC', nome: 'NOC', unidadeId: 'SUPERVISOR_TI', caminhoUnidade: supervisorTi.caminho });
  const semUnidade = equipeBase({ id: 'EQ_LEGADA', nome: 'Legada' });
  const unidadeInexistente = equipeBase({ id: 'EQ_ORFA', nome: 'Órfã', unidadeId: 'NAO_EXISTE' });

  it('árvore com 1 nível: uma única unidade raiz, sem equipes', () => {
    const arvore = construirArvoreOrganizacional([diretoria], []);
    expect(arvore.raizes).toHaveLength(1);
    expect(arvore.raizes[0]).toMatchObject({ tipo: 'unidade', profundidade: 0 });
    expect(arvore.equipesSemUnidade).toEqual([]);
    expect(arvore.unidadesInalcancaveis).toEqual([]);
  });

  it('árvore com múltiplos níveis: profundidade cresce a cada geração', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, []);
    const achatada = achatarArvoreOrganizacional(arvore.raizes);
    const porId = new Map(achatada.filter((no) => no.tipo === 'unidade').map((no) => [no.tipo === 'unidade' ? no.unidade.unidadeId : '', no]));
    expect(porId.get('DIRETOR_PRESIDENTE')?.profundidade).toBe(0);
    expect(porId.get('DIR_INFRA_SEGURANCA')?.profundidade).toBe(1);
    expect(porId.get('GEDSI')?.profundidade).toBe(2);
    expect(porId.get('SUPERVISOR_TI')?.profundidade).toBe(4);
  });

  it('equipe vinculada aparece como filha da unidade correta, com profundidade = unidade + 1', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, [socNaCosi]);
    const cosiNo = achatarArvoreOrganizacional(arvore.raizes)
      .find((no) => no.tipo === 'unidade' && no.unidade.unidadeId === 'COSI');
    expect(cosiNo?.tipo).toBe('unidade');
    if (cosiNo?.tipo === 'unidade') {
      expect(cosiNo.filhos).toHaveLength(1);
      expect(cosiNo.filhos[0]).toMatchObject({ tipo: 'equipe', profundidade: cosiNo.profundidade + 1 });
    }
  });

  it('ordenação preservada: equipes e sub-unidades da mesma unidade aparecem juntas, por nome', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, [socNaCosi, plantaoNaCosi]);
    const cosiNo = achatarArvoreOrganizacional(arvore.raizes)
      .find((no) => no.tipo === 'unidade' && no.unidade.unidadeId === 'COSI');
    expect(cosiNo?.tipo === 'unidade' ? cosiNo.filhos.map((no) => (no.tipo === 'equipe' ? no.equipe.nome : '')) : [])
      .toEqual(['Plantão COSI', 'SOC']);
  });

  it('equipe sem unidade (ou apontando para unidade inexistente) nunca inventa parent — vai para equipesSemUnidade', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, [semUnidade, unidadeInexistente]);
    expect(arvore.equipesSemUnidade.map((e) => e.id).sort()).toEqual(['EQ_LEGADA', 'EQ_ORFA']);
    expect(achatarArvoreOrganizacional(arvore.raizes).some((no) => no.tipo === 'equipe')).toBe(false);
  });

  it('equipe em unidade profunda (SUPERVISOR_TI) é encontrada corretamente', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, [nocNaSupervisorTi]);
    const no = achatarArvoreOrganizacional(arvore.raizes).find((item) => item.tipo === 'equipe');
    expect(no?.tipo === 'equipe' ? no.equipe.id : null).toBe('EQ_NOC');
  });

  it('unidade inalcançável (ciclo entre IDs já existentes) é sinalizada, nunca corrigida', () => {
    const a = unidade({ unidadeId: 'CICLO_A', nome: 'Ciclo A', parentId: 'CICLO_B', caminho: ['CICLO_A'] });
    const b = unidade({ unidadeId: 'CICLO_B', nome: 'Ciclo B', parentId: 'CICLO_A', caminho: ['CICLO_B'] });
    const arvore = construirArvoreOrganizacional([a, b], []);
    expect(arvore.raizes).toEqual([]);
    expect(arvore.unidadesInalcancaveis.map((item) => item.unidadeId).sort()).toEqual(['CICLO_A', 'CICLO_B']);
  });

  it('nó desconhecido (equipe referenciando unidade fora do conjunto) não quebra o renderer — vira equipesSemUnidade', () => {
    expect(() => construirArvoreOrganizacional(todasUnidades, [unidadeInexistente])).not.toThrow();
  });
});

describe('nosVisiveisNaArvoreOrganizacional', () => {
  it('sem nenhuma chave expandida, só as raízes aparecem', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, []);
    const visiveis = nosVisiveisNaArvoreOrganizacional(arvore.raizes, new Set());
    expect(visiveis).toHaveLength(1);
    expect(visiveis[0]).toMatchObject({ tipo: 'unidade', profundidade: 0 });
  });

  it('expandir uma unidade revela só os filhos diretos, não os netos', () => {
    const arvore = construirArvoreOrganizacional(todasUnidades, []);
    const visiveis = nosVisiveisNaArvoreOrganizacional(arvore.raizes, new Set(['unidade:DIRETOR_PRESIDENTE']));
    const ids = visiveis.map((no) => (no.tipo === 'unidade' ? no.unidade.unidadeId : ''));
    expect(ids).toEqual(['DIRETOR_PRESIDENTE', 'DIR_INFRA_SEGURANCA']);
  });

  it('equipe (folha) nunca é tratada como expansível', () => {
    const socNaCosi = equipeBase({ id: 'EQ_SOC', nome: 'SOC', unidadeId: 'COSI', caminhoUnidade: cosi.caminho });
    const arvore = construirArvoreOrganizacional(todasUnidades, [socNaCosi]);
    const chaves = new Set(['unidade:DIRETOR_PRESIDENTE', 'unidade:DIR_INFRA_SEGURANCA', 'unidade:GEDSI', 'unidade:COSI', 'equipe:EQ_SOC']);
    const visiveis = nosVisiveisNaArvoreOrganizacional(arvore.raizes, chaves);
    expect(visiveis.some((no) => no.tipo === 'equipe')).toBe(true);
  });
});

describe('buscarNaArvoreOrganizacional', () => {
  const socNaCosi = equipeBase({ id: 'EQ_SOC', nome: 'SOC', unidadeId: 'COSI', caminhoUnidade: cosi.caminho });
  const arvore = construirArvoreOrganizacional(todasUnidades, [socNaCosi]);

  it('termo vazio não encontra nada e não força expansão', () => {
    const resultado = buscarNaArvoreOrganizacional(arvore.raizes, '');
    expect(resultado.chavesEncontradas.size).toBe(0);
    expect(resultado.chavesParaExpandir.size).toBe(0);
  });

  it('busca por nome de unidade, acento/caixa insensível', () => {
    const resultado = buscarNaArvoreOrganizacional(arvore.raizes, 'gerencia de data center');
    expect(resultado.chavesEncontradas.has('unidade:GEDSI')).toBe(true);
  });

  it('busca por sigla', () => {
    const resultado = buscarNaArvoreOrganizacional(arvore.raizes, 'codb');
    expect(resultado.chavesEncontradas.has('unidade:CODB')).toBe(true);
  });

  it('busca encontra equipe profunda e preserva os ancestrais necessários para expandir', () => {
    const resultado = buscarNaArvoreOrganizacional(arvore.raizes, 'soc');
    expect(resultado.chavesEncontradas.has('equipe:EQ_SOC')).toBe(true);
    expect(resultado.chavesParaExpandir).toEqual(new Set([
      'unidade:DIRETOR_PRESIDENTE',
      'unidade:DIR_INFRA_SEGURANCA',
      'unidade:GEDSI',
      'unidade:COSI',
    ]));
  });

  it('busca sem correspondência retorna conjuntos vazios', () => {
    const resultado = buscarNaArvoreOrganizacional(arvore.raizes, 'inexistente-zzz');
    expect(resultado.chavesEncontradas.size).toBe(0);
    expect(resultado.chavesParaExpandir.size).toBe(0);
  });
});

describe('achatarArvoreOrganizacional / chaveDoNoOrganizacional', () => {
  it('achata em pré-ordem (pai antes dos filhos), incluindo equipes', () => {
    const socNaCosi = equipeBase({ id: 'EQ_SOC', nome: 'SOC', unidadeId: 'COSI', caminhoUnidade: cosi.caminho });
    const arvore = construirArvoreOrganizacional(todasUnidades, [socNaCosi]);
    const chaves = achatarArvoreOrganizacional(arvore.raizes).map(chaveDoNoOrganizacional);
    expect(chaves.indexOf('unidade:GEDSI')).toBeLessThan(chaves.indexOf('unidade:COSI'));
    expect(chaves.indexOf('unidade:COSI')).toBeLessThan(chaves.indexOf('equipe:EQ_SOC'));
  });

  it('chaveDoNoOrganizacional distingue unidade e equipe com o mesmo id textual', () => {
    const noUnidade: NoArvoreOrganizacional = { chave: 'unidade:X', tipo: 'unidade', unidade: cosi, profundidade: 0, filhos: [] };
    const noEquipe: NoArvoreOrganizacional = { chave: 'equipe:X', tipo: 'equipe', equipe: equipeBase({ id: 'X' }), profundidade: 0 };
    expect(chaveDoNoOrganizacional(noUnidade)).toBe('unidade:COSI');
    expect(chaveDoNoOrganizacional(noEquipe)).toBe('equipe:X');
  });
});

describe('rotuloUnidadePorId', () => {
  it('resolve pelo id, com o mesmo rótulo compacto de rotuloCompacto()', () => {
    expect(rotuloUnidadePorId('COSI', todasUnidades)).toBe('COSI');
    expect(rotuloUnidadePorId('GEDSI', todasUnidades)).toBe('GEDSI');
  });

  it('retorna o próprio id quando a unidade não é encontrada', () => {
    expect(rotuloUnidadePorId('INEXISTENTE', todasUnidades)).toBe('INEXISTENTE');
  });
});

describe('raizesComEquipesSemUnidade', () => {
  it('anexa equipes sem unidade como raízes soltas, profundidade 0, sem inventar parent', () => {
    const semUnidade = equipeBase({ id: 'EQ_LEGADA', nome: 'Legada' });
    const arvore = construirArvoreOrganizacional([diretoria], [semUnidade]);
    const raizes = raizesComEquipesSemUnidade(arvore);
    const equipeSolta = raizes.find((no) => no.tipo === 'equipe');
    expect(equipeSolta).toMatchObject({ tipo: 'equipe', profundidade: 0 });
    expect(raizes).toHaveLength(2); // 1 unidade raiz + 1 equipe solta
  });

  it('sem nenhuma equipe sem unidade, devolve exatamente as mesmas raízes', () => {
    const arvore = construirArvoreOrganizacional([diretoria], []);
    expect(raizesComEquipesSemUnidade(arvore)).toEqual(arvore.raizes);
  });
});

describe('chaveFocavelNaArvore — roving tabindex (Fase UI-ORG-1A)', () => {
  const socNaCosi = equipeBase({ id: 'EQ_SOC', nome: 'SOC', unidadeId: 'COSI', caminhoUnidade: cosi.caminho });
  const arvore = construirArvoreOrganizacional(todasUnidades, [socNaCosi]);
  const visiveisRaiz = nosVisiveisNaArvoreOrganizacional(arvore.raizes, new Set());

  it('mantém a chave com foco quando ela está entre os nós visíveis', () => {
    const chave = chaveDoNoOrganizacional(visiveisRaiz[0]);
    expect(chaveFocavelNaArvore(visiveisRaiz, chave)).toBe(chave);
  });

  it('cai para o primeiro nó visível quando a chave com foco não está mais visível (ancestral recolhido)', () => {
    // 'equipe:EQ_SOC' só fica visível com GEDSI/COSI expandidos — aqui nada está expandido.
    expect(chaveFocavelNaArvore(visiveisRaiz, 'equipe:EQ_SOC')).toBe(chaveDoNoOrganizacional(visiveisRaiz[0]));
  });

  it('sem foco anterior (null), usa o primeiro nó visível', () => {
    expect(chaveFocavelNaArvore(visiveisRaiz, null)).toBe(chaveDoNoOrganizacional(visiveisRaiz[0]));
  });

  it('lista visível vazia devolve null (nunca lança)', () => {
    expect(chaveFocavelNaArvore([], 'qualquer')).toBeNull();
    expect(chaveFocavelNaArvore([], null)).toBeNull();
  });
});

describe('alternarSelecaoMultipla — seleção do OrganizationTeamPicker (Fase UI-ORG-1A)', () => {
  it('adiciona uma equipe ainda não selecionada', () => {
    const resultado = alternarSelecaoMultipla(new Set(['EQ_A']), 'EQ_B');
    expect([...resultado].sort()).toEqual(['EQ_A', 'EQ_B']);
  });

  it('remove uma equipe já selecionada (toggle)', () => {
    const resultado = alternarSelecaoMultipla(new Set(['EQ_A', 'EQ_B']), 'EQ_B');
    expect([...resultado]).toEqual(['EQ_A']);
  });

  it('nunca remove a equipe travada (responsável) — devolve o mesmo conteúdo', () => {
    const atuais = new Set(['EQ_RESPONSAVEL', 'EQ_OUTRA']);
    const resultado = alternarSelecaoMultipla(atuais, 'EQ_RESPONSAVEL', 'EQ_RESPONSAVEL');
    expect([...resultado].sort()).toEqual(['EQ_OUTRA', 'EQ_RESPONSAVEL']);
  });

  it('sem equipeTravadaId informado, qualquer equipe pode ser removida', () => {
    const resultado = alternarSelecaoMultipla(new Set(['EQ_A']), 'EQ_A', undefined);
    expect(resultado.size).toBe(0);
  });

  it('não muta o Set original (imutabilidade)', () => {
    const original = new Set(['EQ_A']);
    const resultado = alternarSelecaoMultipla(original, 'EQ_B');
    expect(original.has('EQ_B')).toBe(false);
    expect(resultado).not.toBe(original);
  });
});
