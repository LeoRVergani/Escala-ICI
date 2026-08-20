import { describe, expect, it } from 'vitest';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, UnidadeOrganizacional } from './modelos';
import {
  areasParaExibicaoNoWizard,
  equipesAdministraveisNaUnidade,
  equipesCandidatasParaPlantao,
  gruposPlantaoAdministraveis,
  identificadorGrupoPlantaoDaEquipe,
  normalizarIdentificadorTecnico,
  resolverAreaAtiva,
  resolverEquipeParaJornada,
  resolverEquipeResponsavelParaPlantao,
  resolverGrupoParaPlantao,
  resolverUnicoOuAmbiguo,
  unidadesAdministraveis,
  validarCadastroInline,
} from './inicioEscala';

const unidade = (unidadeId: string, ativa = true): UnidadeOrganizacional => ({
  unidadeId,
  nome: `Unidade ${unidadeId}`,
  sigla: unidadeId,
  tipo: 'AREA',
  parentId: null,
  caminho: [unidadeId],
  ativa,
  criadoPorLogin: 'gestor',
});

const equipe = (id: string, unidadeId?: string, ativa = true): Equipe => ({
  id,
  nome: `Equipe ${id}`,
  sigla: id,
  unidadeId,
  ativa,
});

const grupo = (grupoId: string, equipeResponsavelId: string, ativo = true): GrupoPlantao => ({
  grupoId,
  nome: `Grupo ${grupoId}`,
  equipeResponsavelId,
  equipesConsulta: [equipeResponsavelId],
  timezone: 'America/Sao_Paulo',
  ativo,
  schemaVersion: 1,
  criadoPorLogin: 'gestor',
  criadoEm: '2026-08-01T00:00:00.000Z',
  atualizadoEm: '2026-08-01T00:00:00.000Z',
});

describe('inicioEscala', () => {
  it('resolve automaticamente uma única opção e só pede seleção quando há ambiguidade', () => {
    expect(resolverUnicoOuAmbiguo(['única'])).toEqual({ estado: 'RESOLVIDO', valor: 'única' });
    expect(resolverUnicoOuAmbiguo(['a', 'b'])).toEqual({ estado: 'SELECIONAR', opcoes: ['a', 'b'] });
    expect(resolverUnicoOuAmbiguo([])).toEqual({ estado: 'CRIAR' });
  });

  it('filtra áreas pelo escopo administrativo e ignora unidades inativas', () => {
    expect(unidadesAdministraveis([unidade('A'), unidade('B'), unidade('C', false)], ['A'], false).map((item) => item.unidadeId)).toEqual(['A']);
    expect(resolverAreaAtiva([unidade('A')], ['A'], false)).toMatchObject({ estado: 'RESOLVIDO' });
    expect(resolverAreaAtiva([unidade('A'), unidade('B')], ['A', 'B'], false)).toMatchObject({ estado: 'SELECIONAR' });
  });

  it('resolve equipes apenas dentro da área e do escopo permitidos', () => {
    const equipes = [equipe('E1', 'A'), equipe('E2', 'B'), equipe('E3', 'A', false)];
    expect(equipesAdministraveisNaUnidade(equipes, 'A', ['E1', 'E2'], false).map((item) => item.id)).toEqual(['E1']);
    expect(resolverEquipeParaJornada(equipes, 'A', ['E1', 'E2'], false)).toMatchObject({ estado: 'RESOLVIDO' });
    expect(resolverEquipeParaJornada([equipe('E1'), equipe('E2')], null, ['E1', 'E2'], false)).toMatchObject({ estado: 'SELECIONAR' });
  });

  it('Jornada preserva a equipe de Jornada preferida mesmo quando há outra equipe administrável sem GrupoPlantao', () => {
    const jornada = equipe('JORNADA', 'UNIDADE');
    const candidataPlantao = equipe('PLANTAO', 'UNIDADE');
    expect(resolverEquipeParaJornada(
      [jornada, candidataPlantao],
      'UNIDADE',
      [jornada.id, candidataPlantao.id],
      false,
      jornada.id,
    )).toMatchObject({ estado: 'RESOLVIDO', valor: { id: 'JORNADA' } });
  });

  it('considera apenas Grupos de Plantão administráveis, nunca os de consulta', () => {
    const grupos = [grupo('G1', 'E1'), grupo('G2', 'E2'), grupo('G3', 'E3', false)];
    const administraveis = gruposPlantaoAdministraveis(grupos, (item) => item.grupoId === 'G1' || item.grupoId === 'G2');
    expect(administraveis.map((item) => item.grupoId)).toEqual(['G1', 'G2']);
    expect(resolverGrupoParaPlantao(grupos, (item) => item.grupoId === 'G1')).toMatchObject({ estado: 'RESOLVIDO' });
    expect(resolverGrupoParaPlantao(grupos, () => false)).toEqual({ estado: 'CRIAR' });
  });

  it('normaliza identificadores inline e valida campos obrigatórios', () => {
    expect(normalizarIdentificadorTecnico('  Equipe São José  ')).toBe('EQUIPE_SAO_JOSE');
    expect(identificadorGrupoPlantaoDaEquipe({ id: 'EQ_PLANTAO_COSI', sigla: 'PLANTAO_COSI' })).toBe('PLANTAO_COSI');
    expect(validarCadastroInline('', '')).toEqual(['Informe um nome.', 'Informe um identificador.']);
    expect(validarCadastroInline('Equipe', 'EQ_1')).toEqual([]);
  });

  it('equipesCandidatasParaPlantao exclui a equipe já ativa como Jornada agora, nunca a oferecendo como responsável de um Plantão novo', () => {
    const soc = equipe('SOC', 'UNIDADE');
    const plantao = equipe('PLANTAO', 'UNIDADE');
    expect(equipesCandidatasParaPlantao([soc, plantao], 'SOC').map((item) => item.id)).toEqual(['PLANTAO']);
    expect(resolverEquipeResponsavelParaPlantao([soc, plantao], 'SOC')).toMatchObject({ estado: 'RESOLVIDO', valor: { id: 'PLANTAO' } });
  });

  it('equipesCandidatasParaPlantao não filtra nada quando não há Jornada ativa (equipeJornadaAtivaId nulo)', () => {
    const soc = equipe('SOC', 'UNIDADE');
    const plantao = equipe('PLANTAO', 'UNIDADE');
    expect(equipesCandidatasParaPlantao([soc, plantao], null).map((item) => item.id)).toEqual(['SOC', 'PLANTAO']);
  });

  it('sem candidata de Plantão distinta, mantém a equipe existente só como opção manual e nunca como fallback automático', () => {
    const soc = equipe('SOC', 'UNIDADE');
    expect(equipesCandidatasParaPlantao([soc], 'SOC').map((item) => item.id)).toEqual(['SOC']);
    expect(resolverEquipeResponsavelParaPlantao([soc], 'SOC')).toEqual({ estado: 'SELECIONAR', opcoes: [soc] });
  });

  it('múltiplas candidatas de Plantão sem grupo exigem escolha e nunca retornam a Jornada de referência', () => {
    const jornada = equipe('JORNADA', 'UNIDADE');
    const plantaoA = equipe('PLANTAO_A', 'UNIDADE');
    const plantaoB = equipe('PLANTAO_B', 'UNIDADE');
    expect(resolverEquipeResponsavelParaPlantao([jornada, plantaoA, plantaoB], jornada.id)).toEqual({
      estado: 'SELECIONAR',
      opcoes: [plantaoA, plantaoB],
    });
  });

  it('caso SOC + Plantão COSI na mesma unidade: Jornada permanece SOC e Plantão resolve EQ_PLANTAO_COSI sem GrupoPlantao', () => {
    const soc = { ...equipe('EQ_SOC', 'COSI'), nome: 'SOC', sigla: 'SOC' };
    const plantaoCosi = { ...equipe('EQ_PLANTAO_COSI', 'COSI'), nome: 'Plantão COSI', sigla: 'PLANTAO_COSI' };
    const equipesDaArea = [soc, plantaoCosi];

    expect(resolverEquipeParaJornada(
      equipesDaArea,
      'COSI',
      equipesDaArea.map((item) => item.id),
      false,
      soc.id,
    )).toMatchObject({ estado: 'RESOLVIDO', valor: { id: 'EQ_SOC', nome: 'SOC' } });
    expect(resolverEquipeResponsavelParaPlantao(equipesDaArea, soc.id)).toMatchObject({
      estado: 'RESOLVIDO',
      valor: { id: 'EQ_PLANTAO_COSI', nome: 'Plantão COSI' },
    });
  });

  it('areasParaExibicaoNoWizard mostra as unidades administráveis quando existirem', () => {
    const unidadeA = unidade('A');
    expect(areasParaExibicaoNoWizard([unidadeA], [unidadeA], undefined)).toEqual([unidadeA]);
  });

  it('areasParaExibicaoNoWizard cai para a unidade da equipe já resolvida quando o usuário não administra nenhuma unidade diretamente (GESTOR_EQUIPE comum)', () => {
    const unidadeA = unidade('A');
    const equipeResolvida = equipe('PLANTAO', 'A');
    expect(areasParaExibicaoNoWizard([], [unidadeA], equipeResolvida)).toEqual([unidadeA]);
  });

  it('areasParaExibicaoNoWizard nunca inventa uma unidade — lista vazia quando não há unidade administrável nem equipe resolvida com unidadeId conhecido', () => {
    expect(areasParaExibicaoNoWizard([], [unidade('A')], undefined)).toEqual([]);
    expect(areasParaExibicaoNoWizard([], [unidade('A')], equipe('SOLTA', undefined))).toEqual([]);
  });

  it('não contém nomes de unidades ou equipes de seed nas regras de resolução', async () => {
    const modulo = await import('./inicioEscala');
    const fonte = Object.values(modulo).map(String).join('\n');
    expect(fonte).not.toMatch(/COSI|SOC|NOC|CODB|GEDSI|EQ_SOC|EQ_PLANTAO_COSI/u);
  });
});
