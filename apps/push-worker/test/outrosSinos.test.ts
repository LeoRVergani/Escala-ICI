import { describe, expect, it } from 'vitest';

import { textoEventoEscala, textoTrocaPlantao } from '../src/outrosSinos.js';

describe('SINOS-NO-CELULAR-1 — textos fixos (sem nomes na tela bloqueada)', () => {
  it('troca de plantão: todos os tipos do App têm texto; desconhecido não vira push', () => {
    for (const tipo of ['TROCA_PLANTAO_SOLICITADA', 'TROCA_PLANTAO_RECUSADA_USUARIO', 'TROCA_PLANTAO_ACEITA_AGUARDANDO_GESTOR',
      'TROCA_PLANTAO_AGUARDANDO_APROVACAO_GESTOR', 'TROCA_PLANTAO_RECUSADA_GESTOR', 'TROCA_PLANTAO_APROVADA', 'TROCA_PLANTAO_CANCELADA']) {
      expect(textoTrocaPlantao(tipo)?.titulo, tipo).toBeTruthy();
    }
    expect(textoTrocaPlantao('OUTRO')).toBeNull();
    expect(textoTrocaPlantao(undefined)).toBeNull();
  });

  it('escala: publicada (sem alterações), alterada (com contagem), SEED nunca', () => {
    expect(textoEventoEscala({ tipo: 'PUBLICACAO', competencia: '2026-12', alteracoes: [] }))
      .toEqual({ titulo: 'Escala publicada', corpo: 'Sua escala de dezembro foi publicada. Abra o app para ver.' });
    expect(textoEventoEscala({ tipo: 'PUBLICACAO', competencia: '2026-11', alteracoes: [{}, {}, {}] })?.corpo)
      .toBe('3 dias da sua escala foram alterados em novembro. Abra o app para ver.');
    expect(textoEventoEscala({ tipo: 'PUBLICACAO', competencia: '2026-11', alteracoes: [{}] })?.corpo)
      .toBe('1 dia da sua escala foi alterado em novembro. Abra o app para ver.');
    expect(textoEventoEscala({ tipo: 'SEED', competencia: '2026-11' })).toBeNull();
  });
});
