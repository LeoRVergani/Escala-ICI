import { describe, expect, it } from 'vitest';

import { Timestamp } from 'firebase-admin/firestore';

import { decidirPushRecado, inicioDeAtivacao, milissegundos, textoEventoEscala, textoRecado, textoTrocaPlantao } from '../src/outrosSinos.js';

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

describe('RECADOS-1 — push do recado novo', () => {
  const AGORA = Date.parse('2026-11-17T15:00:00.000Z');
  const base = { destinatarioLogin: 'ana', tipo: 'PERGUNTA', status: 'ENVIADO', expiraEm: Timestamp.fromMillis(AGORA + 86_400_000) };

  it('o texto é FIXO: nada do conteúdo do recado nem de quem enviou na tela bloqueada', () => {
    expect(textoRecado('PERGUNTA')).toEqual({ titulo: 'Nova mensagem da liderança', corpo: 'Você recebeu um recado que espera sua resposta. Abra o app para responder.' });
    expect(textoRecado('AVISO')).toEqual({ titulo: 'Nova mensagem da liderança', corpo: 'Você recebeu um aviso da liderança. Abra o app para ver.' });
    expect(textoRecado('CHAT')).toBeNull();
    // o recado real (com nome e texto) não tem como vazar: a função nem recebe esses campos
    const decisao = decidirPushRecado({ ...base, texto: 'Pode trocar comigo dia 20?', remetenteNome: 'Marina Azevedo' } as never, AGORA);
    expect(JSON.stringify(decisao)).not.toMatch(/Marina|trocar|dia 20/u);
  });

  it('avisa só o que ainda espera resposta e não venceu', () => {
    expect(decidirPushRecado(base, AGORA)).toMatchObject({ login: 'ana', texto: { titulo: 'Nova mensagem da liderança' } });
    expect(decidirPushRecado({ ...base, status: 'RESPONDIDO' }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, expiraEm: Timestamp.fromMillis(AGORA - 1) }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, expiraEm: Timestamp.fromMillis(AGORA) }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, destinatarioLogin: '' }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, destinatarioLogin: undefined }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, tipo: 'CHAT' }, AGORA)).toBeNull();
  });

  it('a validade pode vir como Timestamp, Date ou texto ISO; ilegível não derruba (só não bloqueia)', () => {
    expect(milissegundos(Timestamp.fromMillis(1234))).toBe(1234);
    expect(milissegundos(new Date(5000))).toBe(5000);
    expect(milissegundos('2026-11-17T15:00:00.000Z')).toBe(AGORA);
    expect(milissegundos('ontem')).toBeNull();
    expect(milissegundos(42)).toBeNull();
    expect(milissegundos(undefined)).toBeNull();
    expect(decidirPushRecado({ ...base, expiraEm: undefined }, AGORA)).not.toBeNull();
  });

  it('o limite de ativação vira TIMESTAMP (comparar com texto nunca acharia nenhum recado)', () => {
    const limite = inicioDeAtivacao('2026-11-17T12:00:00.000Z');
    expect(limite).toBeInstanceOf(Timestamp);
    expect(limite.toMillis()).toBe(Date.parse('2026-11-17T12:00:00.000Z'));
  });
});
