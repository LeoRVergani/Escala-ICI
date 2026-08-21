import { describe, expect, it } from 'vitest';
import {
  chaveContextoEscala,
  criarContextoEscala,
  contextoEhJornada,
  contextoEhPlantao,
  contextosEscalaIguais,
  chaveArmazenamentoContextoEscala,
  restaurarContextoEscalaPersistido,
  salvarContextoEscalaPersistido,
} from './contextoEscala';

describe('ContextoEscalaAtivo — Fase ESCALAS-UX-2A.1 (contexto ativo de escala)', () => {
  it('1. contexto Jornada válido — tipo, equipeId e competencia preservados', () => {
    const contexto = criarContextoEscala('JORNADA', 'EQ_SOC', 'SOC', '2026-08');
    expect(contexto.tipo).toBe('JORNADA');
    expect(contexto.alvoId).toBe('EQ_SOC');
    expect(contexto.label).toBe('SOC');
    expect(contexto.competencia).toBe('2026-08');
  });

  it('2. contexto Plantão válido — tipo, grupoId e competencia preservados', () => {
    const contexto = criarContextoEscala('PLANTAO', 'PLANTAO_COSI', 'Plantão COSI', '2026-08');
    expect(contexto.tipo).toBe('PLANTAO');
    expect(contexto.alvoId).toBe('PLANTAO_COSI');
    expect(contexto.label).toBe('Plantão COSI');
    expect(contexto.competencia).toBe('2026-08');
  });

  it('3. identidade é sempre por ID — chaveContextoEscala nunca inclui nome/sigla', () => {
    const contexto = criarContextoEscala('JORNADA', 'EQ_ABC', 'Nome mutável', '2026-08');
    expect(chaveContextoEscala(contexto)).toBe('JORNADA:EQ_ABC:2026-08');
  });

  it('4. competência faz parte da identidade do contexto', () => {
    const a = criarContextoEscala('JORNADA', 'EQ_1', 'Equipe', '2026-08');
    const b = criarContextoEscala('JORNADA', 'EQ_1', 'Outro nome', '2026-09');
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('5. igualdade Jornada — mesma equipe e competência é o mesmo contexto', () => {
    const a = criarContextoEscala('JORNADA', 'EQ_1', 'Equipe A', '2026-08');
    const b = criarContextoEscala('JORNADA', 'EQ_1', 'Equipe renomeada', '2026-08');
    expect(contextosEscalaIguais(a, b)).toBe(true);
  });

  it('6. igualdade Plantão — mesmo grupo e competência é o mesmo contexto', () => {
    const a = criarContextoEscala('PLANTAO', 'GRUPO_1', 'Plantão A', '2026-08');
    const b = criarContextoEscala('PLANTAO', 'GRUPO_1', 'Plantão renomeado', '2026-08');
    expect(contextosEscalaIguais(a, b)).toBe(true);
  });

  it('7. equipes diferentes nunca são o mesmo contexto', () => {
    const a = criarContextoEscala('JORNADA', 'EQ_1', 'Equipe 1', '2026-08');
    const b = criarContextoEscala('JORNADA', 'EQ_2', 'Equipe 2', '2026-08');
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('8. grupos de Plantão diferentes nunca são o mesmo contexto', () => {
    const a = criarContextoEscala('PLANTAO', 'GRUPO_1', 'Grupo 1', '2026-08');
    const b = criarContextoEscala('PLANTAO', 'GRUPO_2', 'Grupo 2', '2026-08');
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('9. Jornada e Plantão nunca são o mesmo contexto, mesmo com o mesmo ID/competência coincidentes', () => {
    const a = criarContextoEscala('JORNADA', 'X', 'X', '2026-08');
    const b = criarContextoEscala('PLANTAO', 'X', 'X', '2026-08');
    expect(contextosEscalaIguais(a, b)).toBe(false);
  });

  it('10. nenhum hardcode de sigla — contextoEhJornada/contextoEhPlantao funcionam para qualquer ID, sem lista fixa de siglas conhecidas', () => {
    const siglasQuaisquer = ['SOC', 'NOC', 'COSI', 'QUALQUER_OUTRA_SIGLA_FUTURA'];
    for (const sigla of siglasQuaisquer) {
      const jornada = criarContextoEscala('JORNADA', sigla, 'Rótulo qualquer', '2026-08');
      const plantao = criarContextoEscala('PLANTAO', sigla, 'Rótulo qualquer', '2026-08');
      expect(contextoEhJornada(jornada)).toBe(true);
      expect(contextoEhPlantao(jornada)).toBe(false);
      expect(contextoEhPlantao(plantao)).toBe(true);
      expect(contextoEhJornada(plantao)).toBe(false);
    }
  });

  it('contextoEhJornada/contextoEhPlantao retornam false para null (nenhum contexto selecionado)', () => {
    expect(contextoEhJornada(null)).toBe(false);
    expect(contextoEhPlantao(null)).toBe(false);
  });

  it('contextosEscalaIguais(null, null) é true; contextosEscalaIguais(null, algo) é false', () => {
    const contexto = criarContextoEscala('JORNADA', 'EQ_1', 'Equipe 1', '2026-08');
    expect(contextosEscalaIguais(null, null)).toBe(true);
    expect(contextosEscalaIguais(null, contexto)).toBe(false);
    expect(contextosEscalaIguais(contexto, null)).toBe(false);
  });

  it('recusa contexto sem alvo operacional', () => {
    expect(() => criarContextoEscala('JORNADA', ' ', 'Escala', '2026-08'))
      .toThrow('Não é permitido abrir uma escala sem alvo operacional.');
  });

  it('restaura contexto persistido somente quando o alvo continua válido', () => {
    const dados = new Map<string, string>();
    const armazenamento = {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => dados.set(chave, valor),
      removeItem: (chave: string) => dados.delete(chave),
    };
    const salvo = criarContextoEscala('JORNADA', 'EQ_1', 'Nome antigo', '2026-07');
    salvarContextoEscalaPersistido('Marina', salvo, armazenamento);

    expect(restaurarContextoEscalaPersistido(
      'marina',
      [criarContextoEscala('JORNADA', 'EQ_1', 'Nome atual', '2026-08')],
      armazenamento,
    )).toEqual({
      estado: 'valido',
      contexto: criarContextoEscala('JORNADA', 'EQ_1', 'Nome atual', '2026-07'),
    });
  });

  it('limpa JSON inválido do localStorage', () => {
    const dados = new Map([[chaveArmazenamentoContextoEscala('marina'), '{quebrado']]);
    const armazenamento = {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => dados.set(chave, valor),
      removeItem: (chave: string) => dados.delete(chave),
    };
    expect(restaurarContextoEscalaPersistido('marina', [], armazenamento)).toEqual({ estado: 'invalido' });
    expect(dados.size).toBe(0);
  });

  it('limpa alvo inexistente ou grupo inativo, pois eles não estão nas opções válidas', () => {
    const chave = chaveArmazenamentoContextoEscala('marina');
    const dados = new Map([[chave, JSON.stringify(criarContextoEscala('PLANTAO', 'GRUPO_INATIVO', 'Inativo', '2026-08'))]]);
    const armazenamento = {
      getItem: (item: string) => dados.get(item) ?? null,
      setItem: (item: string, valor: string) => dados.set(item, valor),
      removeItem: (item: string) => dados.delete(item),
    };
    expect(restaurarContextoEscalaPersistido(
      'marina',
      [criarContextoEscala('PLANTAO', 'GRUPO_ATIVO', 'Ativo', '2026-08')],
      armazenamento,
    )).toEqual({ estado: 'invalido' });
    expect(dados.has(chave)).toBe(false);
  });
});
