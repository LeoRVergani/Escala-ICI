import { describe, expect, it } from 'vitest';
import type { FuncaoPlantao } from '@escala-ici/contrato';

import type { AtribuicaoPlantaoEditavel } from './editorPlantao';
import type { VinculoPlantao } from './conciliacaoPlantoes';
import {
  agruparOcorrenciasPlantao,
  avaliarSaudePlantao,
  conflitosRelevantesPlantao,
  filtrarAtribuicoesPlantaoPorFuncao,
  funcaoDoErroPlantao,
  vinculosPendentesPorFuncao,
} from './plantaoMultiposto';

const FUNCOES_CODB: readonly FuncaoPlantao[] = ['DBA', 'LINUX', 'TELECOM', 'WINDOWS'];

function atribuicao(ajustes: Partial<AtribuicaoPlantaoEditavel> & { plantonistaNomeOriginal: string }): AtribuicaoPlantaoEditavel {
  return {
    plantonistaNomeOriginal: ajustes.plantonistaNomeOriginal,
    inicio: ajustes.inicio ?? { data: '2026-08-27', hora: '19:00' },
    fim: ajustes.fim ?? { data: '2026-08-28', hora: '07:00' },
    duracaoMinutos: ajustes.duracaoMinutos ?? 720,
    linhaOrigem: ajustes.linhaOrigem ?? 1,
    abaOrigem: ajustes.abaOrigem ?? 'Plantao',
    idLocal: ajustes.idLocal ?? `local-${ajustes.plantonistaNomeOriginal}`,
    origemImportacao: ajustes.origemImportacao ?? true,
    ...(ajustes.funcao === undefined ? {} : { funcao: ajustes.funcao }),
  };
}

function vinculo(participanteNomeOriginal: string, status: VinculoPlantao['status'] = 'VINCULADO'): VinculoPlantao {
  return { participanteNomeOriginal, login: status === 'VINCULADO' ? participanteNomeOriginal : null, status, sugestao: null };
}

describe('filtrarAtribuicoesPlantaoPorFuncao', () => {
  /** §54 — teste de isolamento: cada função só enxerga sua própria atribuição. */
  it('TESTE DE ISOLAMENTO — cada aba mostra somente sua própria função', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' }),
      atribuicao({ plantonistaNomeOriginal: 'Maria', funcao: 'LINUX' }),
      atribuicao({ plantonistaNomeOriginal: 'Carlos', funcao: 'TELECOM' }),
      atribuicao({ plantonistaNomeOriginal: 'Ana', funcao: 'WINDOWS' }),
    ];

    expect(filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'DBA').map((a) => a.plantonistaNomeOriginal)).toEqual(['João']);
    expect(filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'LINUX').map((a) => a.plantonistaNomeOriginal)).toEqual(['Maria']);
    expect(filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'TELECOM').map((a) => a.plantonistaNomeOriginal)).toEqual(['Carlos']);
    expect(filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'WINDOWS').map((a) => a.plantonistaNomeOriginal)).toEqual(['Ana']);
    expect(filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'TODOS')).toHaveLength(4);
  });

  /** §55 — a mesma pessoa pode aparecer em funções diferentes em ocorrências diferentes; nunca uma função fixa por usuário. */
  it('TESTE MESMA PESSOA EM DUAS FUNÇÕES — a função pertence à atribuição, nunca ao usuário', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA', inicio: { data: '2026-08-01', hora: '19:00' }, fim: { data: '2026-08-02', hora: '07:00' } }),
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'LINUX', inicio: { data: '2026-08-05', hora: '19:00' }, fim: { data: '2026-08-06', hora: '07:00' } }),
    ];

    const dba = filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'DBA');
    expect(dba).toHaveLength(1);
    expect(dba[0]?.inicio.data).toBe('2026-08-01');

    const linux = filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, 'LINUX');
    expect(linux).toHaveLength(1);
    expect(linux[0]?.inicio.data).toBe('2026-08-05');
  });
});

describe('avaliarSaudePlantao — vínculos pendentes por função (§56/§57)', () => {
  it('TESTE CARD DE PENDÊNCIAS — DBA com pendência, Linux sem', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' }),
      atribuicao({ plantonistaNomeOriginal: 'Maria', funcao: 'LINUX' }),
    ];
    const vinculos = [vinculo('João', 'PENDENTE'), vinculo('Maria', 'VINCULADO')];

    const saude = avaliarSaudePlantao({
      grupo: { funcoesEsperadas: FUNCOES_CODB },
      atribuicoes,
      vinculos,
      erros: [],
      avisos: [],
    });

    expect(saude.porFuncao.DBA?.vinculosPendentes).toBe(1);
    expect(saude.porFuncao.LINUX?.vinculosPendentes).toBe(0);
  });

  it('TESTE GLOBAL DE VÍNCULOS — mesma pessoa pendente em DBA e Linux conta 1 globalmente, 1 em cada função (nunca 2 no total)', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA', inicio: { data: '2026-08-01', hora: '19:00' }, fim: { data: '2026-08-02', hora: '07:00' } }),
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'LINUX', inicio: { data: '2026-08-05', hora: '19:00' }, fim: { data: '2026-08-06', hora: '07:00' } }),
    ];
    const vinculos = [vinculo('João', 'PENDENTE')];

    const pendentesPorFuncao = vinculosPendentesPorFuncao(atribuicoes, vinculos);
    expect(pendentesPorFuncao.DBA).toBe(1);
    expect(pendentesPorFuncao.LINUX).toBe(1);

    const saude = avaliarSaudePlantao({ grupo: { funcoesEsperadas: FUNCOES_CODB }, atribuicoes, vinculos, erros: [], avisos: [] });
    expect(saude.todos.vinculosPendentes).toBe(1);
  });
});

describe('conflitosRelevantesPlantao (§27/§58)', () => {
  it('quatro postos diferentes no mesmo horário NUNCA é conflito', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' }),
      atribuicao({ plantonistaNomeOriginal: 'Maria', funcao: 'LINUX' }),
      atribuicao({ plantonistaNomeOriginal: 'Carlos', funcao: 'TELECOM' }),
      atribuicao({ plantonistaNomeOriginal: 'Ana', funcao: 'WINDOWS' }),
    ];
    const saude = avaliarSaudePlantao({ grupo: { funcoesEsperadas: FUNCOES_CODB }, atribuicoes, vinculos: [], erros: [], avisos: [] });
    expect(saude.todos.conflitos).toBe(0);
  });

  it('TESTE SOBREPOSIÇÃO — mesma pessoa em dois postos com intervalos incompatíveis é conflito de fato', () => {
    const atribuicoes = [
      atribuicao({
        plantonistaNomeOriginal: 'João', funcao: 'DBA',
        inicio: { data: '2026-08-27', hora: '19:00' }, fim: { data: '2026-08-28', hora: '07:00' },
      }),
      atribuicao({
        plantonistaNomeOriginal: 'João', funcao: 'LINUX',
        inicio: { data: '2026-08-27', hora: '20:00' }, fim: { data: '2026-08-28', hora: '00:00' },
      }),
    ];
    const saude = avaliarSaudePlantao({ grupo: { funcoesEsperadas: FUNCOES_CODB }, atribuicoes, vinculos: [], erros: [], avisos: [] });
    expect(saude.todos.conflitos).toBe(1);
    expect(saude.porFuncao.DBA?.conflitos).toBe(1);
    expect(saude.porFuncao.LINUX?.conflitos).toBe(1);
  });

  it('duas pessoas diferentes no MESMO posto e MESMO horário continua conflito (double-booking dentro do posto)', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' }),
      atribuicao({ plantonistaNomeOriginal: 'Pedro', funcao: 'DBA' }),
    ];
    const relevantes = conflitosRelevantesPlantao(
      [{ tipo: 'PLANTONISTAS_DIFERENTES', a: atribuicoes[0]!, b: atribuicoes[1]! }],
      true,
    );
    expect(relevantes).toHaveLength(1);
  });

  it('sem funcoesEsperadas (posto único), o filtro é a identidade — comportamento de Plantão COSI inalterado', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João' }),
      atribuicao({ plantonistaNomeOriginal: 'Maria' }),
    ];
    const relevantes = conflitosRelevantesPlantao(
      [{ tipo: 'PLANTONISTAS_DIFERENTES', a: atribuicoes[0]!, b: atribuicoes[1]! }],
      false,
    );
    expect(relevantes).toHaveLength(1);
  });
});

describe('agruparOcorrenciasPlantao — posto ausente (§31/§32/§59)', () => {
  it('TESTE POSTO AUSENTE — Telecom faltando aparece como gap, nunca desaparece da ocorrência', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' }),
      atribuicao({ plantonistaNomeOriginal: 'Maria', funcao: 'LINUX' }),
      atribuicao({ plantonistaNomeOriginal: 'Ana', funcao: 'WINDOWS' }),
    ];
    const ocorrencias = agruparOcorrenciasPlantao(atribuicoes, FUNCOES_CODB);

    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0]?.postosPreenchidos.sort()).toEqual(['DBA', 'LINUX', 'WINDOWS']);
    expect(ocorrencias[0]?.postosFaltando).toEqual(['TELECOM']);

    const saude = avaliarSaudePlantao({ grupo: { funcoesEsperadas: FUNCOES_CODB }, atribuicoes, vinculos: [], erros: [], avisos: [] });
    expect(saude.porFuncao.TELECOM?.postosFaltando).toBe(1);
    expect(saude.todos.postosFaltando).toBe(1);
  });

  it('sem funcoesEsperadas, nunca reporta posto faltando (Grupo de posto único)', () => {
    const atribuicoes = [atribuicao({ plantonistaNomeOriginal: 'João' })];
    const ocorrencias = agruparOcorrenciasPlantao(atribuicoes, []);
    expect(ocorrencias[0]?.postosFaltando).toEqual([]);
  });
});

describe('funcaoDoErroPlantao (§26)', () => {
  it('erro cuja coluna é "Plantonista Telecom" pertence ao card Telecom', () => {
    expect(funcaoDoErroPlantao({ coluna: 'Plantonista Telecom' })).toBe('TELECOM');
  });

  it('erro sem coluna de posto reconhecível não pertence a nenhuma função — fica só em Todos', () => {
    expect(funcaoDoErroPlantao({ coluna: 'A' })).toBeNull();
    expect(funcaoDoErroPlantao({ coluna: 'Plantonista Oracle' })).toBeNull();
  });
});

describe('avaliarSaudePlantao — status e podePublicar', () => {
  it('sem nenhum problema, status OK e podePublicar true', () => {
    const atribuicoes = [
      atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' }),
      atribuicao({ plantonistaNomeOriginal: 'Maria', funcao: 'LINUX' }),
      atribuicao({ plantonistaNomeOriginal: 'Carlos', funcao: 'TELECOM' }),
      atribuicao({ plantonistaNomeOriginal: 'Ana', funcao: 'WINDOWS' }),
    ];
    const vinculos = ['João', 'Maria', 'Carlos', 'Ana'].map((nome) => vinculo(nome, 'VINCULADO'));
    const saude = avaliarSaudePlantao({ grupo: { funcoesEsperadas: FUNCOES_CODB }, atribuicoes, vinculos, erros: [], avisos: [] });

    expect(saude.todos.status).toBe('OK');
    expect(saude.podePublicar).toBe(true);
    expect(saude.bloqueiosGlobais).toEqual([]);
  });

  it('com posto faltando, status CRITICO e podePublicar false, com bloqueio nomeado', () => {
    const atribuicoes = [atribuicao({ plantonistaNomeOriginal: 'João', funcao: 'DBA' })];
    const saude = avaliarSaudePlantao({ grupo: { funcoesEsperadas: FUNCOES_CODB }, atribuicoes, vinculos: [vinculo('João')], erros: [], avisos: [] });

    expect(saude.todos.status).toBe('CRITICO');
    expect(saude.podePublicar).toBe(false);
    expect(saude.bloqueiosGlobais.some((texto) => texto.includes('posto'))).toBe(true);
  });
});
