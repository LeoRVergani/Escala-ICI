import { describe, expect, it } from 'vitest';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, EscopoOperacional, Usuario } from './modelos';
import { resolverEscoposOperacionais } from './escoposOperacionais';
import {
  particionarResponsaveisLoginPorElegibilidade,
  usuariosResponsaveisOperacionaisElegiveis,
} from './escoposOperacionaisMatriz';

const equipe = (id: string, nome = id): Equipe => ({ id, nome, sigla: id, ativa: true });
const usuario = (login: string, equipeId: string, ajustes: Partial<Usuario> = {}): Usuario => ({
  login,
  nome: login,
  email: `${login}@teste.local`,
  cargo: 'Analista',
  equipeId,
  gestorUid: null,
  nivelHierarquico: 6,
  turnoPadrao: 'ADM',
  ativo: true,
  perfil: 'ANALISTA_SOC',
  ...ajustes,
});
const grupo = (grupoId: string, equipeResponsavelId: string, ajustes: Partial<GrupoPlantao> = {}): GrupoPlantao => ({
  grupoId,
  nome: grupoId,
  equipeResponsavelId,
  equipesConsulta: [],
  timezone: 'America/Sao_Paulo',
  ativo: true,
  schemaVersion: 1,
  criadoPorLogin: 'admin',
  criadoEm: '2026-08-01T00:00:00.000Z',
  atualizadoEm: '2026-08-01T00:00:00.000Z',
  ...ajustes,
});
const escopo = (ajustes: Partial<EscopoOperacional> & Pick<EscopoOperacional, 'tipo' | 'alvoId' | 'alvoNome'>): EscopoOperacional => ({
  responsaveisLogin: [],
  responsaveisEquipe: [],
  equipesConsulta: [],
  ativo: true,
  criadoPorLogin: 'admin',
  atualizadoPorLogin: 'admin',
  schemaVersion: 1,
  ...ajustes,
});

const EQ_SOC = equipe('EQ_SOC', 'SOC');
const EQ_PLANTAO_COSI = equipe('EQ_PLANTAO_COSI', 'Plantão COSI');
const EQ_NOC = equipe('EQ_NOC', 'NOC');
const EQ_CODB_COORD = equipe('EQ_CODB_COORD', 'Coordenação CODB');
const EQ_N1_ICI = equipe('EQ_N1_ICI', 'N1 ICI');
const EQ_N1_NOVA_LIMA = equipe('EQ_N1_NOVA_LIMA', 'N1 Nova Lima');
const EQUIPES = [EQ_SOC, EQ_PLANTAO_COSI, EQ_NOC, EQ_CODB_COORD, EQ_N1_ICI, EQ_N1_NOVA_LIMA];
const PLANTAO_COSI = grupo('PLANTAO_COSI', EQ_PLANTAO_COSI.id);
const PLANTAO_CODB = grupo('PLANTAO_CODB', EQ_CODB_COORD.id);

describe('matriz operacional explícita', () => {
  const escopos: EscopoOperacional[] = [
    escopo({ tipo: 'JORNADA', alvoId: EQ_SOC.id, alvoNome: EQ_SOC.nome, responsaveisLogin: ['marina.azevedo'] }),
    escopo({
      tipo: 'PLANTAO',
      alvoId: PLANTAO_COSI.grupoId,
      alvoNome: PLANTAO_COSI.nome,
      responsaveisLogin: ['marina.azevedo'],
      equipesConsulta: [EQ_SOC.id, EQ_NOC.id],
    }),
    escopo({ tipo: 'JORNADA', alvoId: EQ_NOC.id, alvoNome: EQ_NOC.nome, responsaveisLogin: ['wanessa.moriyama'] }),
    escopo({ tipo: 'PLANTAO', alvoId: PLANTAO_CODB.grupoId, alvoNome: PLANTAO_CODB.nome, responsaveisEquipe: [EQ_CODB_COORD.id], equipesConsulta: [EQ_NOC.id] }),
    escopo({ tipo: 'JORNADA', alvoId: EQ_N1_ICI.id, alvoNome: EQ_N1_ICI.nome, responsaveisLogin: ['supervisora.n1'] }),
    escopo({ tipo: 'JORNADA', alvoId: EQ_N1_NOVA_LIMA.id, alvoNome: EQ_N1_NOVA_LIMA.nome, responsaveisLogin: ['coordenadora.cosd'] }),
  ];

  it('Marina administra Jornada SOC e Plantão COSI quando perfil=GESTOR_UNIDADE, e não vê Plantão COSI como somente consulta', () => {
    const marina = usuario('marina.azevedo', EQ_SOC.id, { perfil: 'GESTOR_UNIDADE', unidadesPermitidas: ['COSI'] });
    const resultado = resolverEscoposOperacionais(marina, [], EQUIPES, [PLANTAO_COSI, PLANTAO_CODB], escopos);

    expect(resultado.jornadasAdministraveis.map((item) => item.id)).toEqual([EQ_SOC.id]);
    expect(resultado.plantoesAdministraveis.map((item) => item.grupoId)).toEqual([PLANTAO_COSI.grupoId]);
    expect(resultado.plantoesMonitorados.map((item) => item.grupoId)).not.toContain(PLANTAO_COSI.grupoId);
  });

  it('usuário comum SOC vê Plantão COSI apenas como monitorado quando está em equipesConsulta', () => {
    const analista = usuario('analista.soc', EQ_SOC.id);
    const resultado = resolverEscoposOperacionais(analista, [], EQUIPES, [PLANTAO_COSI], escopos);

    expect(resultado.plantoesAdministraveis).toEqual([]);
    expect(resultado.plantoesMonitorados.map((item) => item.grupoId)).toEqual([PLANTAO_COSI.grupoId]);
  });

  it('Wanessa administra Jornada NOC, mas consulta não vira administração de Plantão COSI/CODB', () => {
    const wanessa = usuario('wanessa.moriyama', EQ_NOC.id, { perfil: 'SUPERVISOR_EQUIPE', equipesPermitidas: [EQ_NOC.id] });
    const resultado = resolverEscoposOperacionais(wanessa, [], EQUIPES, [PLANTAO_COSI, PLANTAO_CODB], escopos);

    expect(resultado.jornadasAdministraveis.map((item) => item.id)).toEqual([EQ_NOC.id]);
    expect(resultado.plantoesAdministraveis).toEqual([]);
    expect(resultado.plantoesMonitorados.map((item) => item.grupoId).sort()).toEqual([PLANTAO_CODB.grupoId, PLANTAO_COSI.grupoId]);
  });

  it('lista de Responsáveis inclui somente usuários ativos com perfil de gestão/supervisão', () => {
    const usuarios = [
      usuario('marina.azevedo', EQ_SOC.id, { nome: 'Marina Azevedo', perfil: 'GESTOR_UNIDADE' }),
      usuario('wanessa.moriyama', EQ_NOC.id, { nome: 'Wanessa Moriyama', perfil: 'SUPERVISOR_EQUIPE' }),
      usuario('wanessa.gestora', EQ_NOC.id, { nome: 'Wanessa Gestora', perfil: 'GESTOR_EQUIPE' }),
      usuario('admin.sistema', EQ_CODB_COORD.id, { nome: 'Admin Sistema', perfil: 'ADMIN_SISTEMA' }),
      usuario('analista.soc', EQ_SOC.id, { nome: 'Analista SOC', perfil: 'ANALISTA_SOC' }),
      usuario('inativo.gestor', EQ_SOC.id, { nome: 'Gestor Inativo', perfil: 'GESTOR_EQUIPE', ativo: false }),
      usuario('sem.perfil.gestao', EQ_SOC.id, { nome: 'Sem Perfil Gestao', perfil: undefined, nivelHierarquico: 6 }),
    ];

    expect(usuariosResponsaveisOperacionaisElegiveis(usuarios).map((item) => item.login)).toEqual([
      'admin.sistema',
      'marina.azevedo',
      'wanessa.gestora',
      'wanessa.moriyama',
    ]);
  });

  it('fallback legado por nivelHierarquico só torna elegível documento sem perfil e nível de gestor', () => {
    const usuarios = [
      usuario('gestor.legado', EQ_SOC.id, { perfil: undefined, nivelHierarquico: 5 }),
      usuario('analista.legado', EQ_SOC.id, { perfil: undefined, nivelHierarquico: 6 }),
    ];

    expect(usuariosResponsaveisOperacionaisElegiveis(usuarios).map((item) => item.login)).toEqual(['gestor.legado']);
  });

  it('particiona vínculo antigo com responsável humano não elegível para alerta, sem apagar o login', () => {
    const usuarios = [
      usuario('marina.azevedo', EQ_SOC.id, { perfil: 'GESTOR_UNIDADE' }),
      usuario('analista.soc', EQ_SOC.id, { perfil: 'ANALISTA_SOC' }),
    ];

    expect(particionarResponsaveisLoginPorElegibilidade(['marina.azevedo', 'analista.soc'], usuarios)).toEqual({
      elegiveis: ['marina.azevedo'],
      naoElegiveis: ['analista.soc'],
    });
  });

  it('responsável humano ANALISTA_SOC em vínculo antigo não ganha administração', () => {
    const analista = usuario('analista.soc', EQ_SOC.id, { perfil: 'ANALISTA_SOC' });
    const escopoLegado = escopo({
      tipo: 'JORNADA',
      alvoId: EQ_SOC.id,
      alvoNome: EQ_SOC.nome,
      responsaveisLogin: [analista.login],
    });

    const resultado = resolverEscoposOperacionais(analista, [], EQUIPES, [], [escopoLegado]);

    expect(resultado.jornadasAdministraveis).toEqual([]);
  });

  it('criar vínculo com responsável elegível funciona no resolver operacional', () => {
    const marina = usuario('marina.azevedo', EQ_SOC.id, { perfil: 'GESTOR_UNIDADE', unidadesPermitidas: ['COSI'] });
    const escopoElegivel = escopo({
      tipo: 'JORNADA',
      alvoId: EQ_SOC.id,
      alvoNome: EQ_SOC.nome,
      responsaveisLogin: [marina.login],
    });

    const resultado = resolverEscoposOperacionais(marina, [], EQUIPES, [], [escopoElegivel]);

    expect(resultado.jornadasAdministraveis.map((item) => item.id)).toEqual([EQ_SOC.id]);
  });

  it('coordenador CODB não administra NOC automaticamente sem escopo explícito', () => {
    const coordenadorCodb = usuario('coord.codb', EQ_CODB_COORD.id, { perfil: 'GESTOR_EQUIPE', equipesPermitidas: [EQ_CODB_COORD.id] });
    const resultado = resolverEscoposOperacionais(coordenadorCodb, [], EQUIPES, [PLANTAO_CODB], escopos);

    expect(resultado.jornadasAdministraveis.map((item) => item.id)).not.toContain(EQ_NOC.id);
    expect(resultado.plantoesAdministraveis.map((item) => item.grupoId)).toEqual([PLANTAO_CODB.grupoId]);
  });

  it('GESUP/COSD/N1 é suportado por escopo explícito, sem dedução por nome', () => {
    const supervisora = usuario('supervisora.n1', EQ_N1_ICI.id, { perfil: 'SUPERVISOR_EQUIPE' });
    const coordenadora = usuario('coordenadora.cosd', EQ_N1_NOVA_LIMA.id, { perfil: 'GESTOR_EQUIPE' });

    expect(resolverEscoposOperacionais(supervisora, [], EQUIPES, [], escopos).jornadasAdministraveis.map((item) => item.id)).toEqual([EQ_N1_ICI.id]);
    expect(resolverEscoposOperacionais(coordenadora, [], EQUIPES, [], escopos).jornadasAdministraveis.map((item) => item.id)).toEqual([EQ_N1_NOVA_LIMA.id]);
  });

  it('GrupoPlantao ativo:false não entra em destinos operacionais nem esconde a Jornada da equipe', () => {
    const marina = usuario('marina.azevedo', EQ_SOC.id, { perfil: 'GESTOR_UNIDADE', unidadesPermitidas: ['COSI'] });
    const grupoSocInativo = grupo('SOC', EQ_SOC.id, { ativo: false });
    const resultado = resolverEscoposOperacionais(marina, [], EQUIPES, [grupoSocInativo], escopos);

    expect(resultado.jornadasAdministraveis.map((item) => item.id)).toContain(EQ_SOC.id);
    expect(resultado.plantoesAdministraveis.map((item) => item.grupoId)).not.toContain('SOC');
    expect(resultado.plantoesMonitorados.map((item) => item.grupoId)).not.toContain('SOC');
  });
});
