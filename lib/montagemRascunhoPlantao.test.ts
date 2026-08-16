import { describe, expect, it } from 'vitest';
import type { AtribuicaoPlantaoBruta, CompetenciaPlantao, GrupoPlantao, ParticipantePlantao } from '@escala-ici/contrato';

import type { AtribuicaoPlantaoComVinculo, VinculoPlantao } from './conciliacaoPlantoes';
import {
  montarAtribuicoesPlantaoRascunho,
  montarCompetenciaPlantaoRascunho,
  montarGrupoPlantaoParaSalvar,
  montarParticipantesPlantaoParaSalvar,
  sugerirCompetenciaPlantao,
} from './montagemRascunhoPlantao';

function atribuicaoBruta(overrides: Partial<AtribuicaoPlantaoBruta> = {}): AtribuicaoPlantaoBruta {
  return {
    plantonistaNomeOriginal: 'Ana Costa',
    inicio: { data: '2026-07-25', hora: '19:00' },
    fim: { data: '2026-07-26', hora: '07:00' },
    duracaoMinutos: 720,
    linhaOrigem: 5,
    abaOrigem: 'Plantão',
    ...overrides,
  };
}

function vinculo(overrides: Partial<VinculoPlantao> = {}): VinculoPlantao {
  return {
    participanteNomeOriginal: 'Ana Costa',
    login: 'acosta',
    status: 'VINCULADO',
    sugestao: null,
    ...overrides,
  };
}

describe('sugerirCompetenciaPlantao', () => {
  it('retorna null quando não há atribuições', () => {
    expect(sugerirCompetenciaPlantao([])).toBeNull();
  });

  it('sugere o mês com mais ocorrências entre as atribuições', () => {
    const atribuicoes = [
      atribuicaoBruta({ inicio: { data: '2026-07-31', hora: '19:00' } }),
      atribuicaoBruta({ inicio: { data: '2026-08-01', hora: '19:00' } }),
      atribuicaoBruta({ inicio: { data: '2026-08-05', hora: '19:00' } }),
    ];
    expect(sugerirCompetenciaPlantao(atribuicoes)?.competencia).toBe('2026-08');
  });

  it('calcula periodoInicio/periodoFim como o primeiro e o último dia do mês', () => {
    const resultado = sugerirCompetenciaPlantao([atribuicaoBruta({ inicio: { data: '2026-08-10', hora: '19:00' } })]);
    expect(resultado).toEqual({ competencia: '2026-08', periodoInicio: '2026-08-01', periodoFim: '2026-08-31' });
  });

  it('calcula corretamente o último dia de fevereiro em ano bissexto', () => {
    const resultado = sugerirCompetenciaPlantao([atribuicaoBruta({ inicio: { data: '2028-02-10', hora: '19:00' } })]);
    expect(resultado?.periodoFim).toBe('2028-02-29');
  });

  it('calcula corretamente o último dia de fevereiro fora de ano bissexto', () => {
    const resultado = sugerirCompetenciaPlantao([atribuicaoBruta({ inicio: { data: '2026-02-10', hora: '19:00' } })]);
    expect(resultado?.periodoFim).toBe('2026-02-28');
  });

  it('ignora datas malformadas e ainda sugere a partir das válidas', () => {
    const atribuicoes = [
      atribuicaoBruta({ inicio: { data: 'data-invalida', hora: '19:00' } }),
      atribuicaoBruta({ inicio: { data: '2026-08-05', hora: '19:00' } }),
    ];
    expect(sugerirCompetenciaPlantao(atribuicoes)?.competencia).toBe('2026-08');
  });
});

describe('montarParticipantesPlantaoParaSalvar', () => {
  it('gera um participante novo por login único, ignorando vínculos sem login', () => {
    const resultado = montarParticipantesPlantaoParaSalvar({
      grupoId: 'PLANTAO_SEGURANCA',
      vinculos: [
        vinculo({ login: 'acosta' }),
        vinculo({ participanteNomeOriginal: 'Bruno Lima', login: 'blima' }),
        vinculo({ participanteNomeOriginal: 'Sem Login', login: null, status: 'PENDENTE' }),
      ],
      participantesExistentes: [],
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado.map((item) => item.login).sort()).toEqual(['acosta', 'blima']);
    const acosta = resultado.find((item) => item.login === 'acosta');
    expect(acosta).toMatchObject({
      grupoId: 'PLANTAO_SEGURANCA',
      ativo: true,
      contatos: [],
      criadoPorLogin: 'gestor1',
      criadoEm: '2026-08-01T00:00:00.000Z',
    });
  });

  it('dedup: o mesmo login vinculado por dois participantes originais diferentes vira um único registro', () => {
    const resultado = montarParticipantesPlantaoParaSalvar({
      grupoId: 'PLANTAO_SEGURANCA',
      vinculos: [vinculo({ login: 'acosta' }), vinculo({ participanteNomeOriginal: 'A. Costa', login: 'acosta' })],
      participantesExistentes: [],
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado).toHaveLength(1);
  });

  it('preserva contatos/ordem de um participante já existente, sem apagar ao reimportar', () => {
    const existente: ParticipantePlantao = {
      grupoId: 'PLANTAO_SEGURANCA',
      login: 'acosta',
      ativo: false,
      ordem: 3,
      contatos: [{ rotulo: 'Celular', numero: '11999990000', ativo: true }],
      schemaVersion: 1,
      criadoPorLogin: 'gestor0',
      criadoEm: '2026-07-01T00:00:00.000Z',
      atualizadoEm: '2026-07-01T00:00:00.000Z',
    };
    const resultado = montarParticipantesPlantaoParaSalvar({
      grupoId: 'PLANTAO_SEGURANCA',
      vinculos: [vinculo({ login: 'acosta' })],
      participantesExistentes: [existente],
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado).toEqual([{
      ...existente,
      ativo: true,
      atualizadoEm: '2026-08-01T00:00:00.000Z',
    }]);
  });
});

describe('montarCompetenciaPlantaoRascunho', () => {
  const resultadoBase = {
    totalBrutoCalculado: { quantidade: 32, minutos: 30240 },
    totaisInformados: { totalPlantoesInformado: 28, totalMinutosInformado: 28080 },
  };

  it('monta o id determinístico grupoId_competencia e preserva a divergência bruto/informado', () => {
    const competencia = montarCompetenciaPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-07',
      periodoInicio: '2026-07-01',
      periodoFim: '2026-07-31',
      resultado: resultadoBase,
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
      competenciaExistente: null,
    });
    expect(competencia.id).toBe('PLANTAO_SEGURANCA_2026-07');
    expect(competencia.totalBruto).toEqual({ quantidade: 32, minutos: 30240 });
    expect(competencia.totaisInformadosOrigem).toEqual({ totalPlantoesInformado: 28, totalMinutosInformado: 28080 });
    expect(competencia.status).toBe('RASCUNHO');
    expect(competencia.revisao).toBe(0);
  });

  it('totaisInformadosOrigem fica null quando a planilha não tem contabilidade informada', () => {
    const competencia = montarCompetenciaPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-07',
      periodoInicio: '2026-07-01',
      periodoFim: '2026-07-31',
      resultado: { ...resultadoBase, totaisInformados: null },
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
      competenciaExistente: null,
    });
    expect(competencia.totaisInformadosOrigem).toBeNull();
  });

  it('sem competência existente, criadoEm/criadoPorLogin vêm do usuário/momento atual', () => {
    const competencia = montarCompetenciaPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-07',
      periodoInicio: '2026-07-01',
      periodoFim: '2026-07-31',
      resultado: resultadoBase,
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
      competenciaExistente: null,
    });
    expect(competencia.criadoPorLogin).toBe('gestor1');
    expect(competencia.criadoEm).toBe('2026-08-01T00:00:00.000Z');
  });

  it('regravação idempotente preserva criadoEm/criadoPorLogin da competência existente', () => {
    const existente: CompetenciaPlantao = {
      id: 'PLANTAO_SEGURANCA_2026-07',
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-07',
      periodoInicio: '2026-07-01',
      periodoFim: '2026-07-31',
      status: 'RASCUNHO',
      revisao: 0,
      origem: 'IMPORTADO',
      totaisInformadosOrigem: null,
      totalBruto: { quantidade: 1, minutos: 60 },
      schemaVersion: 1,
      criadoPorLogin: 'gestor-original',
      criadoEm: '2026-07-20T00:00:00.000Z',
      atualizadoEm: '2026-07-20T00:00:00.000Z',
    };
    const competencia = montarCompetenciaPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-07',
      periodoInicio: '2026-07-01',
      periodoFim: '2026-07-31',
      resultado: resultadoBase,
      loginAtual: 'gestor-novo',
      agoraIso: '2026-08-01T00:00:00.000Z',
      competenciaExistente: existente,
    });
    expect(competencia.criadoPorLogin).toBe('gestor-original');
    expect(competencia.criadoEm).toBe('2026-07-20T00:00:00.000Z');
    expect(competencia.atualizadoEm).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('montarAtribuicoesPlantaoRascunho', () => {
  function comVinculo(overrides: Partial<AtribuicaoPlantaoComVinculo> = {}): AtribuicaoPlantaoComVinculo {
    return {
      ...atribuicaoBruta(),
      loginVinculado: 'acosta',
      statusVinculo: 'VINCULADO',
      ...overrides,
    };
  }

  it('lança se alguma atribuição não tiver login vinculado', () => {
    expect(() => montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-07',
      atribuicoes: [comVinculo({ loginVinculado: null, statusVinculo: 'PENDENTE' })],
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    })).toThrow(/login vinculado/);
  });

  it('gera atribuicaoId sequencial determinístico (0001, 0002, ...) na mesma ordem da lista', () => {
    const resultado = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-07',
      atribuicoes: [comVinculo(), comVinculo(), comVinculo()],
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado.map((item) => item.atribuicaoId)).toEqual(['0001', '0002', '0003']);
  });

  it('converte início/fim para instante UTC usando o timezone do grupo', () => {
    const [resultado] = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-07',
      atribuicoes: [comVinculo({ inicio: { data: '2026-07-25', hora: '19:00' }, fim: { data: '2026-07-26', hora: '07:00' } })],
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado?.inicio).toBe('2026-07-25T22:00:00.000Z');
    expect(resultado?.fim).toBe('2026-07-26T10:00:00.000Z');
  });

  it('preserva o plantonistaLogin/duracaoMinutos da atribuição e sempre marca PRIMARIO/IMPORTADO/revisão 0', () => {
    const [resultado] = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-07',
      atribuicoes: [comVinculo({ loginVinculado: 'blima', duracaoMinutos: 300 })],
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado).toMatchObject({
      plantonistaLogin: 'blima',
      duracaoMinutos: 300,
      papel: 'PRIMARIO',
      origem: 'IMPORTADO',
      revisao: 0,
      schemaVersion: 1,
    });
  });
});

describe('montarGrupoPlantaoParaSalvar', () => {
  it('descrição em branco vira undefined, nunca string vazia', () => {
    const grupo = montarGrupoPlantaoParaSalvar({
      grupoExistente: null,
      grupoId: 'PLANTAO_SEGURANCA',
      nome: 'Plantão de Segurança',
      descricao: '   ',
      equipeResponsavelId: 'EQ_COSI',
      equipesConsulta: ['EQ_COSI'],
      timezone: 'America/Sao_Paulo',
      ativo: true,
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(grupo.descricao).toBeUndefined();
  });

  it('sem grupo existente, criadoEm/criadoPorLogin vêm do usuário/momento atual', () => {
    const grupo = montarGrupoPlantaoParaSalvar({
      grupoExistente: null,
      grupoId: 'PLANTAO_SEGURANCA',
      nome: 'Plantão de Segurança',
      descricao: '',
      equipeResponsavelId: 'EQ_COSI',
      equipesConsulta: ['EQ_COSI'],
      timezone: 'America/Sao_Paulo',
      ativo: true,
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(grupo.criadoPorLogin).toBe('gestor1');
    expect(grupo.criadoEm).toBe('2026-08-01T00:00:00.000Z');
  });

  it('regravação idempotente preserva criadoEm/criadoPorLogin do grupo existente', () => {
    const existente: GrupoPlantao = {
      grupoId: 'PLANTAO_SEGURANCA',
      nome: 'Plantão de Segurança',
      equipeResponsavelId: 'EQ_COSI',
      equipesConsulta: ['EQ_COSI'],
      timezone: 'America/Sao_Paulo',
      ativo: true,
      schemaVersion: 1,
      criadoPorLogin: 'gestor-original',
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    };
    const grupo = montarGrupoPlantaoParaSalvar({
      grupoExistente: existente,
      grupoId: 'PLANTAO_SEGURANCA',
      nome: 'Plantão de Segurança (renomeado)',
      descricao: '',
      equipeResponsavelId: 'EQ_COSI',
      equipesConsulta: ['EQ_COSI', 'EQ_SOC'],
      timezone: 'America/Sao_Paulo',
      ativo: true,
      loginAtual: 'gestor-novo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(grupo.criadoPorLogin).toBe('gestor-original');
    expect(grupo.criadoEm).toBe('2026-01-01T00:00:00.000Z');
    expect(grupo.atualizadoEm).toBe('2026-08-01T00:00:00.000Z');
  });
});
