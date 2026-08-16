import { describe, expect, it } from 'vitest';
import type { AtribuicaoPlantaoBruta, CompetenciaPlantao, GrupoPlantao, ParticipantePlantao } from '@escala-ici/contrato';

import { aplicarVinculosNasAtribuicoes, type AtribuicaoPlantaoComVinculo, type VinculoPlantao } from './conciliacaoPlantoes';
import {
  adicionarAtribuicaoEditavel,
  criarAtribuicoesEditaveis,
  editarAtribuicaoEditavel,
  excluirAtribuicaoEditavel,
} from './editorPlantao';
import {
  competenciaDoDia,
  montarAtribuicoesPlantaoRascunho,
  montarCompetenciaPlantaoRascunho,
  montarGrupoPlantaoParaSalvar,
  montarParticipantesPlantaoParaSalvar,
  periodoDaCompetencia,
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

describe('competenciaDoDia — janela 26→25 (Fase ESCALAS-UX-1A)', () => {
  it('dia <= 25 pertence à competência do próprio mês', () => {
    expect(competenciaDoDia('2026-08-01')).toBe('2026-08');
    expect(competenciaDoDia('2026-08-25')).toBe('2026-08');
  });

  it('dia >= 26 pertence à competência do mês seguinte', () => {
    expect(competenciaDoDia('2026-07-26')).toBe('2026-08');
    expect(competenciaDoDia('2026-07-31')).toBe('2026-08');
  });

  it('rollover de dezembro para janeiro do ano seguinte', () => {
    expect(competenciaDoDia('2026-12-26')).toBe('2027-01');
  });

  it('data malformada devolve null', () => {
    expect(competenciaDoDia('data-invalida')).toBeNull();
    expect(competenciaDoDia('2026-13-01')).toBeNull();
  });
});

describe('periodoDaCompetencia — janela 26→25 (Fase ESCALAS-UX-1A)', () => {
  it('periodoInicio é dia 26 do mês anterior; periodoFim é dia 25 do próprio mês', () => {
    expect(periodoDaCompetencia('2026-08')).toEqual({ periodoInicio: '2026-07-26', periodoFim: '2026-08-25' });
  });

  it('rollover de janeiro para dezembro do ano anterior', () => {
    expect(periodoDaCompetencia('2026-01')).toEqual({ periodoInicio: '2025-12-26', periodoFim: '2026-01-25' });
  });

  it('nunca depende de quantos dias o mês tem (fevereiro seria diferente num cálculo de "último dia do mês")', () => {
    expect(periodoDaCompetencia('2026-02')).toEqual({ periodoInicio: '2026-01-26', periodoFim: '2026-02-25' });
    expect(periodoDaCompetencia('2028-02')).toEqual({ periodoInicio: '2028-01-26', periodoFim: '2028-02-25' });
  });

  it('competência malformada devolve null', () => {
    expect(periodoDaCompetencia('2026-8')).toBeNull();
    expect(periodoDaCompetencia('não-é-competencia')).toBeNull();
  });
});

describe('sugerirCompetenciaPlantao', () => {
  it('retorna null quando não há atribuições', () => {
    expect(sugerirCompetenciaPlantao([])).toBeNull();
  });

  it('sugere a competência (janela 26→25) com mais ocorrências entre as atribuições', () => {
    const atribuicoes = [
      atribuicaoBruta({ inicio: { data: '2026-07-26', hora: '19:00' } }), // já é competência 2026-08
      atribuicaoBruta({ inicio: { data: '2026-08-01', hora: '19:00' } }),
      atribuicaoBruta({ inicio: { data: '2026-08-05', hora: '19:00' } }),
    ];
    expect(sugerirCompetenciaPlantao(atribuicoes)?.competencia).toBe('2026-08');
  });

  it('calcula periodoInicio/periodoFim como a janela 26→25, não o mês calendário', () => {
    const resultado = sugerirCompetenciaPlantao([atribuicaoBruta({ inicio: { data: '2026-08-10', hora: '19:00' } })]);
    expect(resultado).toEqual({ competencia: '2026-08', periodoInicio: '2026-07-26', periodoFim: '2026-08-25' });
  });

  it('uma atribuição no dia 25 (contexto do mês anterior) conta para a competência desse mês, não do seguinte', () => {
    const resultado = sugerirCompetenciaPlantao([atribuicaoBruta({ inicio: { data: '2026-07-25', hora: '00:00' } })]);
    expect(resultado?.competencia).toBe('2026-07');
  });

  it('uma atribuição no dia 26 (início da janela seguinte) já conta para a competência do mês seguinte', () => {
    const resultado = sugerirCompetenciaPlantao([atribuicaoBruta({ inicio: { data: '2026-07-26', hora: '00:00' } })]);
    expect(resultado?.competencia).toBe('2026-08');
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

describe('CRÍTICO — o payload do rascunho reflete a working copy EDITADA, nunca o parser original (Fase ESCALAS-UX-1A)', () => {
  const ORIGINAIS: AtribuicaoPlantaoBruta[] = [
    atribuicaoBruta({ plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-07-26', hora: '19:00' }, fim: { data: '2026-07-27', hora: '07:00' }, duracaoMinutos: 12 * 60 }),
    atribuicaoBruta({ plantonistaNomeOriginal: 'Bruno Lima', inicio: { data: '2026-07-27', hora: '19:00' }, fim: { data: '2026-07-28', hora: '07:00' }, duracaoMinutos: 12 * 60 }),
  ];
  const VINCULOS: VinculoPlantao[] = [
    vinculo({ participanteNomeOriginal: 'Ana Costa', login: 'acosta' }),
    vinculo({ participanteNomeOriginal: 'Bruno Lima', login: 'blima' }),
  ];

  it('edição de horário: o payload usa o horário EDITADO, não o original importado', () => {
    const copiaOriginalAntes = JSON.parse(JSON.stringify(ORIGINAIS));
    let editaveis = criarAtribuicoesEditaveis(ORIGINAIS);
    editaveis = editarAtribuicaoEditavel(editaveis, 'importado-0', {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-07-26', hora: '20:00' },
      fim: { data: '2026-07-27', hora: '08:00' },
    });

    const comVinculo = aplicarVinculosNasAtribuicoes(editaveis, VINCULOS);
    const payload = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: comVinculo,
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });

    const anaNoPayload = payload.find((item) => item.plantonistaLogin === 'acosta');
    // 20:00 em America/Sao_Paulo (UTC-3) = 23:00 UTC — nunca o 19:00/22:00 original.
    expect(anaNoPayload?.inicio).toBe('2026-07-26T23:00:00.000Z');
    expect(ORIGINAIS).toEqual(copiaOriginalAntes);
  });

  it('exclusão: o payload NÃO inclui a atribuição excluída na working copy', () => {
    let editaveis = criarAtribuicoesEditaveis(ORIGINAIS);
    editaveis = excluirAtribuicaoEditavel(editaveis, 'importado-1');

    const comVinculo = aplicarVinculosNasAtribuicoes(editaveis, VINCULOS);
    const payload = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: comVinculo,
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });

    expect(payload).toHaveLength(1);
    expect(payload.some((item) => item.plantonistaLogin === 'blima')).toBe(false);
  });

  it('adição: o payload INCLUI uma atribuição adicionada manualmente na working copy (não vinda do XLS)', () => {
    let editaveis = criarAtribuicoesEditaveis(ORIGINAIS);
    editaveis = adicionarAtribuicaoEditavel(editaveis, {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-10', hora: '19:00' },
      fim: { data: '2026-08-11', hora: '07:00' },
      abaOrigem: 'PlantaoCOSI',
    });

    const comVinculo = aplicarVinculosNasAtribuicoes(editaveis, VINCULOS);
    const payload = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: comVinculo,
      timezone: 'America/Sao_Paulo',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });

    expect(payload).toHaveLength(3);
    expect(payload.some((item) => item.inicio === '2026-08-10T22:00:00.000Z')).toBe(true);
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
