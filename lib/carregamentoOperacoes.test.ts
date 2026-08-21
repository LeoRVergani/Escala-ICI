import { describe, expect, it, vi } from 'vitest';
import {
  MENSAGEM_MATRIZ_SEM_RULES,
  MENSAGEM_REDE_OPERACOES,
  carregarOperacoesComEstado,
  estadoErroOperacoes,
} from './carregamentoOperacoes';

describe('carregamento robusto das operações de escala', () => {
  it('finaliza em sucesso e preserva os dados carregados', async () => {
    const resultado = await carregarOperacoesComEstado({
      carregar: async () => ['jornada', 'plantao'],
      estaVazio: (dados) => dados.length === 0,
    });
    expect(resultado).toEqual({ estado: { fase: 'sucesso' }, dados: ['jornada', 'plantao'] });
  });

  it('finaliza em vazio, nunca permanece carregando', async () => {
    const resultado = await carregarOperacoesComEstado({
      carregar: async () => [],
      estaVazio: (dados) => dados.length === 0,
    });
    expect(resultado).toEqual({ estado: { fase: 'vazio' }, dados: [] });
  });

  it('diagnostica permission-denied como Rules de staging não publicadas', () => {
    expect(estadoErroOperacoes({ code: 'permission-denied' })).toEqual({
      fase: 'erro',
      diagnostico: 'RULES',
      mensagem: MENSAGEM_MATRIZ_SEM_RULES,
    });
  });

  it('diagnostica erro de rede como recuperável', () => {
    expect(estadoErroOperacoes({ code: 'unavailable' })).toEqual({
      fase: 'erro',
      diagnostico: 'REDE',
      mensagem: MENSAGEM_REDE_OPERACOES,
    });
  });

  it('timeout transforma uma Promise pendente em erro de rede e sempre finaliza', async () => {
    vi.useFakeTimers();
    const resultadoPendente = carregarOperacoesComEstado({
      carregar: () => new Promise<never>(() => undefined),
      estaVazio: () => false,
      tempoLimiteMs: 10,
    });
    await vi.advanceTimersByTimeAsync(11);
    await expect(resultadoPendente).resolves.toEqual({
      estado: { fase: 'erro', diagnostico: 'REDE', mensagem: MENSAGEM_REDE_OPERACOES },
    });
    vi.useRealTimers();
  });
});
