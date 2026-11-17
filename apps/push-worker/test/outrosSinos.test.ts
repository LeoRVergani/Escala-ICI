import { describe, expect, it } from 'vitest';

import { Timestamp } from 'firebase-admin/firestore';

import {
  decidirPushGrupo, decidirPushRecado, decidirPushResposta, decidirPushRespostaGrupo, inicioDeAtivacao, milissegundos, textoEventoEscala, textoRecado, textoRespostaRecado, textoTrocaPlantao,
} from '../src/outrosSinos.js';

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

describe('RECADOS-2 — push do recado novo e da resposta', () => {
  const AGORA = Date.parse('2026-11-17T15:00:00.000Z');
  const base = { destinatarioLogin: 'ana', remetenteLogin: 'marina', status: 'ENVIADO', expiraEm: Timestamp.fromMillis(AGORA + 86_400_000) };

  it('os textos são FIXOS: nada do conteúdo do recado, de quem enviou ou de quem respondeu na tela bloqueada', () => {
    expect(textoRecado()).toEqual({ titulo: 'Novo recado', corpo: 'Você recebeu um recado. Abra o app para responder.' });
    expect(textoRespostaRecado()).toEqual({ titulo: 'Recado respondido', corpo: 'Alguém respondeu o seu recado. Abra o app para ver.' });
    // o recado real (com nomes e texto) não tem como vazar: as funções nem recebem esses campos
    const dados = { ...base, texto: 'Pode trocar comigo dia 20?', remetenteNome: 'Marina Azevedo', resposta: 'Posso sim', destinatarioNome: 'Ana Lima' };
    expect(JSON.stringify(decidirPushRecado(dados as never, AGORA))).not.toMatch(/Marina|Ana Lima|trocar|dia 20|Posso/u);
    expect(JSON.stringify(decidirPushResposta({ ...dados, status: 'RESPONDIDO' } as never, AGORA))).not.toMatch(/Marina|Ana Lima|trocar|dia 20|Posso/u);
  });

  it('o recado novo avisa o DESTINATÁRIO só se ainda espera resposta e não venceu', () => {
    expect(decidirPushRecado(base, AGORA)).toMatchObject({ login: 'ana', texto: { titulo: 'Novo recado' } });
    expect(decidirPushRecado({ ...base, status: 'RESPONDIDO' }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, expiraEm: Timestamp.fromMillis(AGORA - 1) }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, expiraEm: Timestamp.fromMillis(AGORA) }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, destinatarioLogin: '' }, AGORA)).toBeNull();
    expect(decidirPushRecado({ ...base, destinatarioLogin: undefined }, AGORA)).toBeNull();
  });

  it('a resposta avisa quem ENVIOU (e só ele), se o recado está respondido e não venceu', () => {
    const respondido = { ...base, status: 'RESPONDIDO' };
    expect(decidirPushResposta(respondido, AGORA)).toMatchObject({ login: 'marina', texto: { titulo: 'Recado respondido' } });
    expect(decidirPushResposta(base, AGORA)).toBeNull();
    expect(decidirPushResposta({ ...respondido, expiraEm: Timestamp.fromMillis(AGORA - 1) }, AGORA)).toBeNull();
    expect(decidirPushResposta({ ...respondido, remetenteLogin: '' }, AGORA)).toBeNull();
    expect(decidirPushResposta({ ...respondido, remetenteLogin: undefined }, AGORA)).toBeNull();
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

describe('RECADOS-3 — push da mensagem para um GRUPO', () => {
  const AGORA = Date.parse('2026-11-17T15:00:00.000Z');
  const base = { alvoTipo: 'EQUIPE', alvoId: 'EQ_SOC', remetenteLogin: 'marina', expiraEm: Timestamp.fromMillis(AGORA + 86_400_000), respostas: {} };

  it('avisa o grupo só se o alvo é válido (equipe ou Plantão) e a mensagem não venceu', () => {
    expect(decidirPushGrupo(base, AGORA)).toEqual({ alvoTipo: 'EQUIPE', alvoId: 'EQ_SOC', remetenteLogin: 'marina' });
    expect(decidirPushGrupo({ ...base, alvoTipo: 'PLANTAO', alvoId: 'G1' }, AGORA)).toMatchObject({ alvoTipo: 'PLANTAO', alvoId: 'G1' });
    expect(decidirPushGrupo({ ...base, alvoTipo: 'TODOS' }, AGORA)).toBeNull();
    expect(decidirPushGrupo({ ...base, alvoId: '' }, AGORA)).toBeNull();
    expect(decidirPushGrupo({ ...base, remetenteLogin: undefined }, AGORA)).toBeNull();
    expect(decidirPushGrupo({ ...base, expiraEm: Timestamp.fromMillis(AGORA - 1) }, AGORA)).toBeNull();
  });

  it('quem enviou é avisado quando existe ao menos uma resposta — e só então (o texto é o mesmo, sem nome)', () => {
    expect(decidirPushRespostaGrupo(base, AGORA)).toBeNull();
    const comResposta = { ...base, respostas: { 'ana.lima': { nome: 'Ana Lima', texto: 'Posso sim', em: Timestamp.now() } } };
    const decisao = decidirPushRespostaGrupo(comResposta, AGORA);
    expect(decisao).toMatchObject({ login: 'marina', texto: { titulo: 'Recado respondido' } });
    expect(JSON.stringify(decisao)).not.toMatch(/Ana|Posso/u);
    expect(decidirPushRespostaGrupo({ ...comResposta, expiraEm: Timestamp.fromMillis(AGORA - 1) }, AGORA)).toBeNull();
    expect(decidirPushRespostaGrupo({ ...comResposta, remetenteLogin: '' }, AGORA)).toBeNull();
    expect(decidirPushRespostaGrupo({ ...comResposta, respostas: undefined }, AGORA)).toBeNull();
  });
});
