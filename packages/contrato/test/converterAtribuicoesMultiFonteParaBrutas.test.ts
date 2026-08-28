import { describe, expect, it } from 'vitest';

import { converterAtribuicoesMultiFonteParaBrutas, parsePlanilhaPlantaoMultiFonte } from '../src/index.js';
import { carregarFixturePlantaoCodb } from './dadosPlantaoMultiFonte.js';

function resultadoFixtureCodb() {
  return parsePlanilhaPlantaoMultiFonte(carregarFixturePlantaoCodb());
}

describe('converterAtribuicoesMultiFonteParaBrutas — planilha real do Plantão CODB', () => {
  it('A. converte as 4 fontes conhecidas (DBA/Linux/Telecom/Windows) para FuncaoPlantao, sem erro', () => {
    const { atribuicoes, erros } = converterAtribuicoesMultiFonteParaBrutas(resultadoFixtureCodb());
    expect(erros).toEqual([]);
    expect(new Set(atribuicoes.map((a) => a.funcao))).toEqual(new Set(['DBA', 'LINUX', 'TELECOM', 'WINDOWS']));
  });

  it('uma linha completa gera 4 atribuições com mesmo início/fim, funções diferentes', () => {
    const { atribuicoes } = converterAtribuicoesMultiFonteParaBrutas(resultadoFixtureCodb());
    const daLinha3 = atribuicoes.filter((a) => a.linhaOrigem === 3);
    expect(daLinha3).toHaveLength(4);
    expect(new Set(daLinha3.map((a) => a.inicio.data))).toEqual(new Set([daLinha3[0].inicio.data]));
    expect(new Set(daLinha3.map((a) => a.fim.data))).toEqual(new Set([daLinha3[0].fim.data]));
    expect(new Set(daLinha3.map((a) => a.funcao))).toEqual(new Set(['DBA', 'LINUX', 'TELECOM', 'WINDOWS']));
  });

  it('B. posto sem plantonista na linha (célula vazia) não gera atribuição nem função inventada', () => {
    const { atribuicoes } = converterAtribuicoesMultiFonteParaBrutas(resultadoFixtureCodb());
    const daLinha6 = atribuicoes.filter((a) => a.linhaOrigem === 6);
    expect(daLinha6).toHaveLength(3);
    expect(daLinha6.map((a) => a.funcao).sort()).toEqual(['DBA', 'LINUX', 'WINDOWS']);
  });

  it('E. coluna desconhecida não cria função arbitrária — reporta erro e exclui a linha do resultado', () => {
    const resultado = resultadoFixtureCodb();
    const comColunaDesconhecida = {
      ...resultado,
      fontes: [...resultado.fontes, 'Rede'],
      atribuicoes: [
        ...resultado.atribuicoes,
        {
          fonte: 'Rede',
          plantonistaNomeOriginal: 'Alguém Novo',
          inicio: { data: '2026-07-25', hora: '00:00' },
          fim: { data: '2026-07-26', hora: '19:00' },
          duracaoMinutos: 43 * 60,
          linhaOrigem: 99,
          abaOrigem: resultado.abaOrigem,
        },
      ],
    };
    const { atribuicoes, erros } = converterAtribuicoesMultiFonteParaBrutas(comColunaDesconhecida);
    expect(atribuicoes.some((a) => a.plantonistaNomeOriginal === 'Alguém Novo')).toBe(false);
    expect(erros).toHaveLength(1);
    expect(erros[0].motivo).toContain('Rede');
    expect(erros[0].motivo).not.toContain('undefined');
  });

  it('funcaoPlantaoDaFonte tolera variação de caixa/acento do cabeçalho real ("Linux"/"Telecom"/"Windows", não só maiúsculas)', () => {
    const { atribuicoes, erros } = converterAtribuicoesMultiFonteParaBrutas(resultadoFixtureCodb());
    expect(erros).toEqual([]);
    expect(atribuicoes.some((a) => a.funcao === 'LINUX')).toBe(true);
    expect(atribuicoes.some((a) => a.funcao === 'TELECOM')).toBe(true);
    expect(atribuicoes.some((a) => a.funcao === 'WINDOWS')).toBe(true);
  });
});
