import { describe, expect, it } from 'vitest';
import type { AtribuicaoPlantaoBruta, AtribuicaoPlantaoPersistida, CompetenciaPlantao, GrupoPlantao, ParticipantePlantao } from '@escala-ici/contrato';

import type { Usuario } from './modelos';

import {
  aplicarVinculosNasAtribuicoes,
  vinculosDeCopiaAnterior,
  vinculosDeParticipantesGrupoPlantao,
  type AtribuicaoPlantaoComVinculo,
  type VinculoPlantao,
} from './conciliacaoPlantoes';
import {
  adicionarAtribuicaoEditavel,
  agruparAtribuicoesPorDia,
  conferirEscalaAtualPlantao,
  criarAtribuicoesEditaveis,
  duracaoPlantaoAtipica,
  editarAtribuicaoEditavel,
  excluirAtribuicaoEditavel,
  resumirPorPessoa,
} from './editorPlantao';
import {
  competenciaAnterior,
  competenciaDoDia,
  copiarAtribuicoesParaNovaCompetencia,
  montarAtribuicoesPlantaoRascunho,
  montarCompetenciaPlantaoRascunho,
  montarGrupoPlantaoParaSalvar,
  montarParticipantesPlantaoParaSalvar,
  dataPertenceCompetencia,
  periodoDaCompetencia,
  reidratarRascunhoPlantao,
  sugerirCompetenciaPlantao,
  validarNovoPlantaoEmBranco,
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

// ---------------------------------------------------------------------------
// Fase ESCALAS-UX-2B.1 — dataPertenceCompetencia (§10 do pedido)
// ---------------------------------------------------------------------------

describe('dataPertenceCompetencia — gate de "esta data pode iniciar uma nova atribuição de Plantão"', () => {
  it('1. dia anterior ao período (25/07 para competência 2026-08) -> false', () => {
    expect(dataPertenceCompetencia('2026-07-25', '2026-08')).toBe(false);
  });

  it('2. primeiro dia do período (26/07 para competência 2026-08) -> true', () => {
    expect(dataPertenceCompetencia('2026-07-26', '2026-08')).toBe(true);
  });

  it('3. dia comum dentro do período (01/08) -> true', () => {
    expect(dataPertenceCompetencia('2026-08-01', '2026-08')).toBe(true);
  });

  it('4. último dia do período (25/08) -> true', () => {
    expect(dataPertenceCompetencia('2026-08-25', '2026-08')).toBe(true);
  });

  it('5. dia posterior ao período (26/08) -> false', () => {
    expect(dataPertenceCompetencia('2026-08-26', '2026-08')).toBe(false);
  });

  it('6. dia bem posterior (29/08) -> false', () => {
    expect(dataPertenceCompetencia('2026-08-29', '2026-08')).toBe(false);
  });

  it('7. competência malformada -> false (nunca lança, nunca assume período default)', () => {
    expect(dataPertenceCompetencia('2026-08-10', '2026-8')).toBe(false);
    expect(dataPertenceCompetencia('2026-08-10', '')).toBe(false);
  });

  it('8. data malformada -> false', () => {
    expect(dataPertenceCompetencia('10/08/2026', '2026-08')).toBe(false);
    expect(dataPertenceCompetencia('', '2026-08')).toBe(false);
  });

  it('9. reaproveita periodoDaCompetencia — mesmo resultado para uma virada de ano (janeiro)', () => {
    expect(dataPertenceCompetencia('2025-12-26', '2026-01')).toBe(true);
    expect(dataPertenceCompetencia('2025-12-25', '2026-01')).toBe(false);
    expect(dataPertenceCompetencia('2026-01-25', '2026-01')).toBe(true);
    expect(dataPertenceCompetencia('2026-01-26', '2026-01')).toBe(false);
  });
});

describe('competenciaAnterior — Fase ESCALAS-UX-1C ("Usar período anterior")', () => {
  it('1. competência anterior de 2026-09 é 2026-08', () => {
    expect(competenciaAnterior('2026-09')).toBe('2026-08');
  });

  it('2. competência anterior de 2026-01 é 2025-12 (rollover de ano)', () => {
    expect(competenciaAnterior('2026-01')).toBe('2025-12');
  });

  it('nunca depende da data da máquina — determinística para qualquer entrada válida', () => {
    expect(competenciaAnterior('2030-05')).toBe('2030-04');
  });

  it('competência malformada devolve null', () => {
    expect(competenciaAnterior('2026-9')).toBeNull();
    expect(competenciaAnterior('não-é-competencia')).toBeNull();
    expect(competenciaAnterior('2026-13')).toBeNull();
  });
});

describe('validarNovoPlantaoEmBranco — Fase ESCALAS-UX-1B ("+ Nova escala" → Plantão → Criar escala vazia)', () => {
  it('grupo vazio bloqueia', () => {
    expect(validarNovoPlantaoEmBranco({ grupoId: '', competencia: '2026-08' }).length).toBeGreaterThan(0);
  });

  it('competência vazia/malformada bloqueia', () => {
    expect(validarNovoPlantaoEmBranco({ grupoId: 'PLANTAO_SEGURANCA', competencia: '' }).length).toBeGreaterThan(0);
    expect(validarNovoPlantaoEmBranco({ grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-8' }).length).toBeGreaterThan(0);
  });

  it('grupo + competência válidos (janela 26→25) não bloqueiam — nenhum outro campo é exigido (timezone/ACL/participantes vêm do Grupo)', () => {
    expect(validarNovoPlantaoEmBranco({ grupoId: 'PLANTAO_SEGURANCA', competencia: '2026-08' })).toEqual([]);
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
      agoraIso: '2026-08-01T00:00:00.000Z',
    })).toThrow(/login vinculado/);
  });

  it('gera atribuicaoId sequencial determinístico (0001, 0002, ...) na mesma ordem da lista', () => {
    const resultado = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-07',
      atribuicoes: [comVinculo(), comVinculo(), comVinculo()],
      timezone: 'America/Sao_Paulo',
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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

  it('Fase ESCALAS-UX-1B — origem MANUAL é honrada, nunca hardcoded para IMPORTADO', () => {
    const [resultado] = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: [comVinculo()],
      timezone: 'America/Sao_Paulo',
      origem: 'MANUAL',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(resultado?.origem).toBe('MANUAL');
  });
});

describe('montarCompetenciaPlantaoRascunho — Fase ESCALAS-UX-1B (origem MANUAL, escala criada vazia)', () => {
  it('origem MANUAL é honrada, nunca hardcoded para IMPORTADO', () => {
    const competencia = montarCompetenciaPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-08',
      periodoInicio: '2026-07-26',
      periodoFim: '2026-08-25',
      resultado: { totalBrutoCalculado: { quantidade: 0, minutos: 0 }, totaisInformados: null },
      origem: 'MANUAL',
      loginAtual: 'gestor1',
      agoraIso: '2026-08-01T00:00:00.000Z',
      competenciaExistente: null,
    });
    expect(competencia.origem).toBe('MANUAL');
    expect(competencia.totalBruto).toEqual({ quantidade: 0, minutos: 0 });
    expect(competencia.totaisInformadosOrigem).toBeNull();
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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
      origem: 'IMPORTADO',
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

  // --- Fase PLANTAO-PADRAO-1 ---

  const OPCOES_BASE = {
    grupoExistente: null as GrupoPlantao | null,
    grupoId: 'PLANTAO_SEGURANCA',
    nome: 'Plantão de Segurança',
    descricao: '',
    equipeResponsavelId: 'EQ_COSI',
    equipesConsulta: ['EQ_COSI'],
    timezone: 'America/Sao_Paulo',
    ativo: true,
    loginAtual: 'gestor1',
    agoraIso: '2026-08-01T00:00:00.000Z',
  };

  it('criar grupo sem padrão — campo fica undefined', () => {
    const grupo = montarGrupoPlantaoParaSalvar(OPCOES_BASE);
    expect(grupo.padraoHorarioSemanal).toBeUndefined();
  });

  it('criar grupo com padrão — campo persistido e ordenado', () => {
    const grupo = montarGrupoPlantaoParaSalvar({
      ...OPCOES_BASE,
      padraoHorarioSemanal: [
        { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 },
        { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
      ],
    });
    expect(grupo.padraoHorarioSemanal?.map((entrada) => entrada.diaSemana)).toEqual([0, 5]);
  });

  it('editar padrão — novo valor substitui o anterior', () => {
    const existente: GrupoPlantao = {
      ...OPCOES_BASE,
      schemaVersion: 1,
      criadoPorLogin: 'gestor-original',
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
    };
    const grupo = montarGrupoPlantaoParaSalvar({
      ...OPCOES_BASE,
      grupoExistente: existente,
      padraoHorarioSemanal: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 }],
    });
    expect(grupo.padraoHorarioSemanal).toEqual([{ diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 }]);
  });

  it('editar grupo SEM tocar o padrão (omitir o parâmetro) preserva o padrão existente', () => {
    const existente: GrupoPlantao = {
      ...OPCOES_BASE,
      schemaVersion: 1,
      criadoPorLogin: 'gestor-original',
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
    };
    const grupo = montarGrupoPlantaoParaSalvar({ ...OPCOES_BASE, grupoExistente: existente, nome: 'Renomeado' });
    expect(grupo.padraoHorarioSemanal).toEqual(existente.padraoHorarioSemanal);
  });

  it('remover padrão — passar [] explicitamente zera o campo (undefined)', () => {
    const existente: GrupoPlantao = {
      ...OPCOES_BASE,
      schemaVersion: 1,
      criadoPorLogin: 'gestor-original',
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
    };
    const grupo = montarGrupoPlantaoParaSalvar({ ...OPCOES_BASE, grupoExistente: existente, padraoHorarioSemanal: [] });
    expect(grupo.padraoHorarioSemanal).toBeUndefined();
  });

  it('preserva os demais campos ao adicionar um padrão (nenhum campo alheio é tocado)', () => {
    const grupo = montarGrupoPlantaoParaSalvar({
      ...OPCOES_BASE,
      equipesConsulta: ['EQ_COSI', 'EQ_SOC'],
      padraoHorarioSemanal: [{ diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 }],
    });
    expect(grupo.nome).toBe('Plantão de Segurança');
    expect(grupo.equipesConsulta).toEqual(['EQ_COSI', 'EQ_SOC']);
    expect(grupo.timezone).toBe('America/Sao_Paulo');
    expect(grupo.ativo).toBe(true);
  });
});

describe('CRÍTICO — unificação do Editor: IMPORTADO e MANUAL usam a MESMA working copy/helpers/payload (Fase ESCALAS-UX-1B)', () => {
  function usuario(overrides: Partial<Usuario> & { login: string; nome: string }): Usuario {
    return {
      email: `${overrides.login}@empresa.com`,
      cargo: 'Analista',
      equipeId: 'EQ_COSI',
      gestorUid: null,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      ...overrides,
    };
  }

  const USUARIOS = [usuario({ login: 'acosta', nome: 'Ana Costa' }), usuario({ login: 'blima', nome: 'Bruno Lima' })];

  function participantePlantao(overrides: Partial<ParticipantePlantao> & { login: string }): ParticipantePlantao {
    return {
      grupoId: 'PLANTAO_SEGURANCA',
      ativo: true,
      contatos: [],
      schemaVersion: 1,
      criadoPorLogin: 'gestor1',
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('working copy IMPORTADO (a partir de atribuições brutas) e MANUAL (criada vazia, populada via adicionarAtribuicaoEditavel) produzem a MESMA forma final, agrupamento por dia, resumo por pessoa e conferência', () => {
    // --- Caminho IMPORTADO ---
    const brutas: AtribuicaoPlantaoBruta[] = [
      { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-08-01', hora: '19:00' }, fim: { data: '2026-08-02', hora: '07:00' }, duracaoMinutos: 720, linhaOrigem: 2, abaOrigem: 'PlantaoCOSI' },
    ];
    const editaveisImportado = criarAtribuicoesEditaveis(brutas);

    // --- Caminho MANUAL: começa vazio (nova escala vazia), depois recebe a MESMA atribuição via o mesmo helper de edição ---
    let editaveisManual = criarAtribuicoesEditaveis([]);
    expect(editaveisManual).toEqual([]); // item 1/2 do § 46 — working copy de uma escala nova começa com 0 atribuições
    editaveisManual = adicionarAtribuicaoEditavel(editaveisManual, {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-01', hora: '19:00' },
      fim: { data: '2026-08-02', hora: '07:00' },
      abaOrigem: '',
    });

    // Ambas passam pelos MESMOS helpers puros — mesmo conteúdo de negócio
    // (nome/início/fim/duração). `idLocal`/`origemImportacao`/`linhaOrigem`/
    // `abaOrigem` legitimamente diferem por proveniência (MANUAL nunca tem
    // uma linha/aba real de planilha) — não fazem parte da comparação.
    const camposDeNegocio = ({ plantonistaNomeOriginal, inicio, fim, duracaoMinutos }: (typeof editaveisImportado)[number]) =>
      ({ plantonistaNomeOriginal, inicio, fim, duracaoMinutos });
    expect(editaveisManual.map(camposDeNegocio)).toEqual(editaveisImportado.map(camposDeNegocio));

    for (const [editaveis, rotulo] of [[editaveisImportado, 'IMPORTADO'], [editaveisManual, 'MANUAL']] as const) {
      expect(agruparAtribuicoesPorDia(editaveis).get('2026-08-01')?.length, rotulo).toBe(1);
      expect(resumirPorPessoa(editaveis).find((p) => p.nomeOriginal === 'Ana Costa')?.quantidade, rotulo).toBe(1);
      expect(conferirEscalaAtualPlantao(editaveis, duracaoPlantaoAtipica).quantidadePessoas, rotulo).toBe(1);
    }
  });

  it('payload final (montarAtribuicoesPlantaoRascunho) usa o LOGIN real do participante do Grupo — nunca um nome de planilha — para origem MANUAL', () => {
    const participantesAtivos: ParticipantePlantao[] = [
      participantePlantao({ login: 'acosta' }),
      participantePlantao({ login: 'blima' }),
    ];
    const vinculosIniciais = vinculosDeParticipantesGrupoPlantao(participantesAtivos, USUARIOS);
    expect(vinculosIniciais.every((v) => v.status === 'VINCULADO')).toBe(true); // nenhuma conciliação nome→login pendente

    let editaveis = criarAtribuicoesEditaveis([]);
    editaveis = adicionarAtribuicaoEditavel(editaveis, {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-01', hora: '19:00' },
      fim: { data: '2026-08-02', hora: '07:00' },
      abaOrigem: '',
    });

    const comVinculo = aplicarVinculosNasAtribuicoes(editaveis, vinculosIniciais);
    const payload = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: comVinculo,
      timezone: 'America/Sao_Paulo',
      origem: 'MANUAL',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });

    expect(payload).toHaveLength(1);
    expect(payload[0]?.plantonistaLogin).toBe('acosta');
    expect(payload[0]?.origem).toBe('MANUAL');
  });

  it('idempotência (§ 49): criar 3 atribuições MANUAIS, montar payload, editar 1, montar payload de novo — resultado final tem 3 atribuições, nunca 6', () => {
    const vinculosIniciais = vinculosDeParticipantesGrupoPlantao(
      [participantePlantao({ login: 'acosta' })],
      USUARIOS,
    );

    let editaveis = criarAtribuicoesEditaveis([]);
    for (let dia = 1; dia <= 3; dia += 1) {
      editaveis = adicionarAtribuicaoEditavel(editaveis, {
        plantonistaNomeOriginal: 'Ana Costa',
        inicio: { data: `2026-08-0${dia}`, hora: '19:00' },
        fim: { data: `2026-08-0${dia + 1}`, hora: '07:00' },
        abaOrigem: '',
      });
    }

    function montarPayload(atuais: typeof editaveis) {
      return montarAtribuicoesPlantaoRascunho({
        grupoId: 'PLANTAO_SEGURANCA',
        competenciaId: 'PLANTAO_SEGURANCA_2026-08',
        atribuicoes: aplicarVinculosNasAtribuicoes(atuais, vinculosIniciais),
        timezone: 'America/Sao_Paulo',
        origem: 'MANUAL',
        agoraIso: '2026-08-01T00:00:00.000Z',
      });
    }

    const primeiroSalvamento = montarPayload(editaveis);
    expect(primeiroSalvamento).toHaveLength(3);
    expect(primeiroSalvamento.map((item) => item.atribuicaoId)).toEqual(['0001', '0002', '0003']);

    editaveis = editarAtribuicaoEditavel(editaveis, editaveis[0]?.idLocal ?? '', {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-01', hora: '20:00' },
      fim: { data: '2026-08-02', hora: '08:00' },
    });
    const segundoSalvamento = montarPayload(editaveis);
    expect(segundoSalvamento).toHaveLength(3);
    expect(segundoSalvamento.map((item) => item.atribuicaoId)).toEqual(['0001', '0002', '0003']);
  });

  it('excluir uma atribuição MANUAL antes de salvar reduz o payload — nunca deixa um "fantasma" da atribuição excluída', () => {
    const vinculosIniciais = vinculosDeParticipantesGrupoPlantao(
      [participantePlantao({ login: 'acosta' })],
      USUARIOS,
    );
    let editaveis = criarAtribuicoesEditaveis([]);
    editaveis = adicionarAtribuicaoEditavel(editaveis, {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-01', hora: '19:00' },
      fim: { data: '2026-08-02', hora: '07:00' },
      abaOrigem: '',
    });
    editaveis = adicionarAtribuicaoEditavel(editaveis, {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-03', hora: '19:00' },
      fim: { data: '2026-08-04', hora: '07:00' },
      abaOrigem: '',
    });
    editaveis = excluirAtribuicaoEditavel(editaveis, editaveis[0]?.idLocal ?? '');

    const payload = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: aplicarVinculosNasAtribuicoes(editaveis, vinculosIniciais),
      timezone: 'America/Sao_Paulo',
      origem: 'MANUAL',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });
    expect(payload).toHaveLength(1);
  });
});

describe('reidratarRascunhoPlantao — Fase ESCALAS-UX-1B.1 (reabrir rascunho no mesmo Editor)', () => {
  function usuario(overrides: Partial<Usuario> & { login: string; nome: string }): Usuario {
    return {
      email: `${overrides.login}@empresa.com`,
      cargo: 'Analista',
      equipeId: 'EQ_COSI',
      gestorUid: null,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      ...overrides,
    };
  }

  const USUARIOS = [
    usuario({ login: 'acosta', nome: 'Ana Costa' }),
    usuario({ login: 'blima', nome: 'Bruno Lima' }),
  ];

  function participantePlantao(overrides: Partial<ParticipantePlantao> & { login: string }): ParticipantePlantao {
    return {
      grupoId: 'PLANTAO_SEGURANCA',
      ativo: true,
      contatos: [],
      schemaVersion: 1,
      criadoPorLogin: 'gestor1',
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  const GRUPO: GrupoPlantao = {
    grupoId: 'PLANTAO_SEGURANCA',
    nome: 'Plantão de Segurança',
    equipeResponsavelId: 'EQ_COSI',
    equipesConsulta: ['EQ_COSI'],
    timezone: 'America/Sao_Paulo',
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: 'gestor1',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
  };

  function competenciaPersistida(overrides: Partial<CompetenciaPlantao> = {}): CompetenciaPlantao {
    return {
      id: 'PLANTAO_SEGURANCA_2026-08',
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-08',
      periodoInicio: '2026-07-26',
      periodoFim: '2026-08-25',
      status: 'RASCUNHO',
      revisao: 0,
      origem: 'MANUAL',
      totaisInformadosOrigem: null,
      totalBruto: { quantidade: 0, minutos: 0 },
      schemaVersion: 1,
      criadoPorLogin: 'gestor1',
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function atribuicaoPersistida(overrides: Partial<AtribuicaoPlantaoPersistida> & { atribuicaoId: string }): AtribuicaoPlantaoPersistida {
    return {
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      plantonistaLogin: 'acosta',
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z',
      duracaoMinutos: 720,
      papel: 'PRIMARIO',
      origem: 'MANUAL',
      revisao: 0,
      schemaVersion: 1,
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('1. rascunho MANUAL vazio (0 atribuições persistidas) reidrata para working copy vazia', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [],
      participantes: [participantePlantao({ login: 'acosta' })],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis).toEqual([]);
  });

  it('2. rascunho MANUAL com atribuições reidrata cada uma delas', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001' }), atribuicaoPersistida({ atribuicaoId: '0002', plantonistaLogin: 'blima' })],
      participantes: [participantePlantao({ login: 'acosta' }), participantePlantao({ login: 'blima' })],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis).toHaveLength(2);
  });

  it('3. origem MANUAL persistida é preservada — nunca virou outra coisa por ter sido reaberta', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida({ origem: 'MANUAL' }),
      atribuicoesPersistidas: [],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.origem).toBe('MANUAL');
  });

  it('4. origem IMPORTADO persistida é preservada — nunca "cai" para MANUAL só porque foi reaberta pelo Editor', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida({ origem: 'IMPORTADO' }),
      atribuicoesPersistidas: [],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.origem).toBe('IMPORTADO');
  });

  it('5. competência preservada (rótulo AAAA-MM, período 26→25) — nunca recalculada a partir das atribuições', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida({ competencia: '2026-08', periodoInicio: '2026-07-26', periodoFim: '2026-08-25' }),
      atribuicoesPersistidas: [],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.competencia.competencia).toBe('2026-08');
    expect(resultado.competencia.periodoInicio).toBe('2026-07-26');
    expect(resultado.competencia.periodoFim).toBe('2026-08-25');
  });

  it('6. grupo preservado — o mesmo grupoId/timezone/nome usados na reidratação são devolvidos', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.grupo).toEqual(GRUPO);
  });

  it('7. login preservado — a atribuição reidratada resolve o mesmo participante (por nome, mas o vínculo aponta pro mesmo login)', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'blima' })],
      participantes: [participantePlantao({ login: 'blima' })],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis[0]?.plantonistaNomeOriginal).toBe('Bruno Lima');
    expect(resultado.vinculos.find((v) => v.participanteNomeOriginal === 'Bruno Lima')?.login).toBe('blima');
  });

  it('8. início/fim civis corretos — o instante UTC persistido volta a ser o horário que o coordenador digitou', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001', inicio: '2026-07-26T22:00:00.000Z', fim: '2026-07-27T10:00:00.000Z' })],
      participantes: [participantePlantao({ login: 'acosta' })],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis[0]?.inicio).toEqual({ data: '2026-07-26', hora: '19:00' });
    expect(resultado.atribuicoesEditaveis[0]?.fim).toEqual({ data: '2026-07-27', hora: '07:00' });
  });

  it('9. duração correta — nunca recalculada, sempre a persistida', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001', duracaoMinutos: 43 * 60 })],
      participantes: [participantePlantao({ login: 'acosta' })],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis[0]?.duracaoMinutos).toBe(43 * 60);
  });

  it('10. dirtyInicial é sempre false', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.dirtyInicial).toBe(false);
  });

  it('11. participante inativo referenciado por uma atribuição não desaparece — a atribuição continua reidratada com o nome correto', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'blima' })],
      participantes: [participantePlantao({ login: 'blima', ativo: false })],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis).toHaveLength(1);
    expect(resultado.atribuicoesEditaveis[0]?.plantonistaNomeOriginal).toBe('Bruno Lima');
    // Vínculo não inclui inativos — "Salvar rascunho" não conta esse participante como candidato ativo.
    expect(resultado.vinculos.some((v) => v.login === 'blima')).toBe(false);
  });

  it('12. login que não corresponde a nenhum participante cadastrado (nem ativo nem inativo) ainda resolve pelo cadastro de usuários, nunca lança', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'acosta' })],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis[0]?.plantonistaNomeOriginal).toBe('Ana Costa');
  });

  it('13. login sem usuário cadastrado nenhum cai no próprio login como nome — nunca lança, nunca inventa nome', () => {
    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida(),
      atribuicoesPersistidas: [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'usuario-removido' })],
      participantes: [],
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoesEditaveis[0]?.plantonistaNomeOriginal).toBe('usuario-removido');
  });

  it('14. CRÍTICO — round-trip completo: working copy A → persistir → reidratar → working copy B semanticamente igual (data/hora/login/duração/quantidade/origem/competência)', () => {
    const vinculosIniciais = vinculosDeParticipantesGrupoPlantao(
      [participantePlantao({ login: 'acosta' }), participantePlantao({ login: 'blima' })],
      USUARIOS,
    );
    let workingCopyA = criarAtribuicoesEditaveis([]);
    workingCopyA = adicionarAtribuicaoEditavel(workingCopyA, {
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-07-26', hora: '19:00' },
      fim: { data: '2026-07-27', hora: '07:00' },
      abaOrigem: '',
    });
    workingCopyA = adicionarAtribuicaoEditavel(workingCopyA, {
      plantonistaNomeOriginal: 'Bruno Lima',
      inicio: { data: '2026-07-31', hora: '19:00' },
      fim: { data: '2026-08-01', hora: '19:00' },
      abaOrigem: '',
    });

    const payload = montarAtribuicoesPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      atribuicoes: aplicarVinculosNasAtribuicoes(workingCopyA, vinculosIniciais),
      timezone: 'America/Sao_Paulo',
      origem: 'MANUAL',
      agoraIso: '2026-08-01T00:00:00.000Z',
    });

    const resultado = reidratarRascunhoPlantao({
      grupo: GRUPO,
      competencia: competenciaPersistida({ origem: 'MANUAL' }),
      atribuicoesPersistidas: payload,
      participantes: [participantePlantao({ login: 'acosta' }), participantePlantao({ login: 'blima' })],
      usuarios: USUARIOS,
    });

    expect(resultado.origem).toBe('MANUAL');
    expect(resultado.competencia.competencia).toBe('2026-08');
    expect(resultado.atribuicoesEditaveis).toHaveLength(2);

    const semIdentidadeLocal = (item: (typeof resultado.atribuicoesEditaveis)[number]) =>
      ({ plantonistaNomeOriginal: item.plantonistaNomeOriginal, inicio: item.inicio, fim: item.fim, duracaoMinutos: item.duracaoMinutos });
    const original = workingCopyA.map(semIdentidadeLocal);
    const reidratado = resultado.atribuicoesEditaveis.map(semIdentidadeLocal);
    // Ordena pelos mesmos critérios (nome) para comparar sem depender de ordem de array/IDs transitórios.
    const ordenar = (lista: typeof original) => [...lista].sort((a, b) => a.plantonistaNomeOriginal.localeCompare(b.plantonistaNomeOriginal));
    expect(ordenar(reidratado)).toEqual(ordenar(original));
  });
});

describe('copiarAtribuicoesParaNovaCompetencia — Fase ESCALAS-UX-1C ("Usar período anterior")', () => {
  function usuario(overrides: Partial<Usuario> & { login: string; nome: string }): Usuario {
    return {
      email: `${overrides.login}@empresa.com`,
      cargo: 'Analista',
      equipeId: 'EQ_COSI',
      gestorUid: null,
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      ...overrides,
    };
  }

  const USUARIOS = [
    usuario({ login: 'acosta', nome: 'Ana Costa' }),
    usuario({ login: 'blima', nome: 'Bruno Lima' }),
  ];

  function participantePlantao(overrides: Partial<ParticipantePlantao> & { login: string }): ParticipantePlantao {
    return {
      grupoId: 'PLANTAO_SEGURANCA',
      ativo: true,
      contatos: [],
      schemaVersion: 1,
      criadoPorLogin: 'gestor1',
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function atribuicaoPersistida(overrides: Partial<AtribuicaoPlantaoPersistida> & { atribuicaoId: string }): AtribuicaoPlantaoPersistida {
    return {
      grupoId: 'PLANTAO_SEGURANCA',
      competenciaId: 'PLANTAO_SEGURANCA_2026-08',
      plantonistaLogin: 'acosta',
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z',
      duracaoMinutos: 720,
      papel: 'PRIMARIO',
      origem: 'MANUAL',
      revisao: 0,
      schemaVersion: 1,
      criadoEm: '2026-08-01T00:00:00.000Z',
      atualizadoEm: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  const PARTICIPANTES_ATIVOS: ParticipantePlantao[] = [
    participantePlantao({ login: 'acosta' }),
    participantePlantao({ login: 'blima' }),
  ];

  it('3. carrega atribuições anteriores — cada atribuição persistida vira uma atribuição editável', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [
        atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'acosta' }),
        atribuicaoPersistida({ atribuicaoId: '0002', plantonistaLogin: 'blima', inicio: '2026-07-31T22:00:00.000Z', fim: '2026-08-01T22:00:00.000Z' }),
      ],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes).toHaveLength(2);
    expect(resultado.quantidadeNaoCopiada).toBe(0);
  });

  it('4. cria uma NOVA working copy — idLocal "copiado-N", nunca reaproveita nenhuma referência da competência anterior', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({ atribuicaoId: '0001' })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes[0]?.idLocal).toBe('copiado-0');
  });

  it('5. preserva o plantonista (login/nome) — nunca troca automaticamente por outra pessoa', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'blima' })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes[0]?.plantonistaNomeOriginal).toBe('Bruno Lima');
  });

  it('6. preserva o horário civil — hora de início/fim nunca é recalculada, só a data muda', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({
        atribuicaoId: '0001',
        inicio: '2026-07-26T22:00:00.000Z', // 19:00 America/Sao_Paulo
        fim: '2026-07-27T10:00:00.000Z', // 07:00 America/Sao_Paulo
      })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes[0]?.inicio.hora).toBe('19:00');
    expect(resultado.atribuicoes[0]?.fim.hora).toBe('07:00');
  });

  it('7. ajusta as datas para a nova competência, preservando a posição relativa (dia 0 da anterior -> dia 0 da nova)', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({
        atribuicaoId: '0001',
        inicio: '2026-07-26T22:00:00.000Z', // dia 26/07 = dia 0 da competência 2026-08
        fim: '2026-07-27T10:00:00.000Z',
      })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26', // dia 0 da nova competência 2026-09
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes[0]?.inicio.data).toBe('2026-08-26');
    expect(resultado.atribuicoes[0]?.fim.data).toBe('2026-08-27');
  });

  it('preserva a duração de 12h ao traduzir para a nova competência', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({ atribuicaoId: '0001', duracaoMinutos: 12 * 60 })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes[0]?.duracaoMinutos).toBe(12 * 60);
  });

  it('13. borda real de 43h é preservada exatamente — nunca normalizada', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({
        atribuicaoId: '0001',
        inicio: '2026-07-25T03:00:00.000Z', // 00:00 America/Sao_Paulo, dia 25 (contexto)
        fim: '2026-07-26T22:00:00.000Z', // 19:00 América/Sao_Paulo, dia 26
        duracaoMinutos: 43 * 60,
      })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes).toHaveLength(1);
    expect(resultado.atribuicoes[0]?.duracaoMinutos).toBe(43 * 60);
    expect(resultado.atribuicoes[0]?.inicio).toEqual({ data: '2026-08-25', hora: '00:00' });
    expect(resultado.atribuicoes[0]?.fim).toEqual({ data: '2026-08-26', hora: '19:00' });
  });

  it('8. NÃO altera a competência anterior — as atribuições persistidas de entrada nunca são mutadas', () => {
    const anteriores = [atribuicaoPersistida({ atribuicaoId: '0001' })];
    const copiaAntesEsperada = JSON.parse(JSON.stringify(anteriores));
    copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: anteriores,
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(anteriores).toEqual(copiaAntesEsperada);
  });

  it('12. anterior inexistente: função não decide isso (responsabilidade do chamador verificar antes) — mas atribuicoesAnteriores vazio produz working copy vazia, nunca erro', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado).toEqual({ atribuicoes: [], quantidadeNaoCopiada: 0 });
  });

  it('13b. participante inativo/removido do Grupo: nome é preservado (nunca trocado), reconhecível via vinculosDeCopiaAnterior', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'blima' })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: [], // Bruno Lima não é mais participante ativo
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes[0]?.plantonistaNomeOriginal).toBe('Bruno Lima');

    const vinculos = vinculosDeCopiaAnterior(
      [atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'blima' })],
      [],
      USUARIOS,
    );
    expect(vinculos[0]?.status).toBe('PENDENTE');
  });

  it('14. competências com quantidades de dias diferentes: atribuição fora da nova janela (mais curta) NÃO é copiada, só contada — nunca truncada/deslocada em silêncio', () => {
    // Competência 2026-08 (31 dias: 26/07 a 25/08) -> última atribuição no último dia (offset 30).
    // Copiando para 2026-03 (28 dias: 26/02 a 25/03, fevereiro não-bissexto) — offset 30 fica bem além do limite.
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({
        atribuicaoId: '0001',
        inicio: '2026-08-25T22:00:00.000Z', // 19:00 America/Sao_Paulo, dia 25/08 = offset 30 de 26/07
        fim: '2026-08-26T03:00:00.000Z',
      })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-02-26',
      periodoNovoFim: '2026-03-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes).toHaveLength(0);
    expect(resultado.quantidadeNaoCopiada).toBe(1);
  });

  it('uma atribuição cujo offset ainda cabe na nova janela (mesmo em um mês mais curto) é copiada normalmente', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [atribuicaoPersistida({
        atribuicaoId: '0001',
        inicio: '2026-07-26T22:00:00.000Z', // dia 26/07 = offset 0
        fim: '2026-07-27T10:00:00.000Z',
      })],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-02-26',
      periodoNovoFim: '2026-03-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes).toHaveLength(1);
    expect(resultado.quantidadeNaoCopiada).toBe(0);
    expect(resultado.atribuicoes[0]?.inicio.data).toBe('2026-02-26');
  });

  it('15. nenhuma rotação automática — copiar duas atribuições da mesma pessoa preserva a MESMA pessoa nas duas, nunca redistribui para outra', () => {
    const resultado = copiarAtribuicoesParaNovaCompetencia({
      atribuicoesAnteriores: [
        atribuicaoPersistida({ atribuicaoId: '0001', plantonistaLogin: 'acosta', inicio: '2026-07-26T22:00:00.000Z', fim: '2026-07-27T10:00:00.000Z' }),
        atribuicaoPersistida({ atribuicaoId: '0002', plantonistaLogin: 'acosta', inicio: '2026-07-28T22:00:00.000Z', fim: '2026-07-29T10:00:00.000Z' }),
      ],
      periodoAnteriorInicio: '2026-07-26',
      periodoNovoInicio: '2026-08-26',
      periodoNovoFim: '2026-09-25',
      timezone: 'America/Sao_Paulo',
      participantes: PARTICIPANTES_ATIVOS,
      usuarios: USUARIOS,
    });
    expect(resultado.atribuicoes.every((item) => item.plantonistaNomeOriginal === 'Ana Costa')).toBe(true);
  });

  it('9/10/11 — origem definida como COPIADO, dirty inicial coerente e nova competência correta são responsabilidade do chamador (DashboardApp) — cobertos no describe de origem/contrato acima (montarCompetenciaPlantaoRascunho — origem COPIADO)', () => {
    // Ver describe 'montarCompetenciaPlantaoRascunho — Fase ESCALAS-UX-1B (origem MANUAL...)' — o mesmo mecanismo
    // (origem como parâmetro explícito) já cobre COPIADO sem nenhuma mudança de código, testado abaixo.
    const competencia = montarCompetenciaPlantaoRascunho({
      grupoId: 'PLANTAO_SEGURANCA',
      competencia: '2026-09',
      periodoInicio: '2026-08-26',
      periodoFim: '2026-09-25',
      resultado: { totalBrutoCalculado: { quantidade: 0, minutos: 0 }, totaisInformados: null },
      origem: 'COPIADO',
      loginAtual: 'gestor1',
      agoraIso: '2026-09-01T00:00:00.000Z',
      competenciaExistente: null,
    });
    expect(competencia.origem).toBe('COPIADO');
  });
});
