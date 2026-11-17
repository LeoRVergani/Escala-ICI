import { describe, expect, it } from 'vitest';

import {
  chaveLimite, diaDoLimite, estadoParaRemetente, expirou, lerRecado, LIMITE_DIARIO_RECADOS, montarRecado, ordenarParaRemetente,
  pendentesParaODestinatario, respostasDoTipo, restanteHoje, rotuloResposta, validarEntradaRecado, VALIDADE_DIAS, type Recado,
} from './recados';

const AGORA = '2026-11-17T15:00:00.000Z';
const ANA = { login: 'ana', nome: 'Ana  Lima', equipeId: 'EQ_SOC' };
const MARINA = { login: 'marina', nome: 'Marina Azevedo' };
const recado = (id: string, ajustes: Partial<Recado> = {}): Recado => ({ ...montarRecado({ tipo: 'PERGUNTA', texto: 'Pode trocar comigo dia 20?' }, ANA, MARINA, id, AGORA), ...ajustes });

describe('RECADOS-1 — validação (mensagens em português simples)', () => {
  const ok = { destinatarios: [ANA], tipo: 'PERGUNTA' as const, texto: 'Pode trocar comigo dia 20?' };

  it('um recado completo, com limite sobrando, é válido', () => {
    expect(validarEntradaRecado(ok, 30)).toEqual([]);
  });

  it('pede destinatário e texto; recusa texto longo e destinatários demais', () => {
    expect(validarEntradaRecado({ ...ok, destinatarios: [], texto: '' }, 30)).toEqual(['Escolha para quem enviar.', 'Escreva o recado.']);
    expect(validarEntradaRecado({ ...ok, texto: 'x'.repeat(301) }, 30)).toEqual(['O recado passa de 300 caracteres.']);
    const onze = Array.from({ length: 11 }, (_, i) => ({ ...ANA, login: `p${i}` }));
    expect(validarEntradaRecado({ ...ok, destinatarios: onze }, 30)).toEqual(['Escolha no máximo 10 pessoas por recado.']);
  });

  it('o limite diário conta um recado por destinatário e explica o que sobrou', () => {
    expect(validarEntradaRecado(ok, 0)).toEqual(['Você já enviou os 30 recados de hoje. Amanhã libera de novo.']);
    const tres = [ANA, { ...ANA, login: 'b' }, { ...ANA, login: 'c' }];
    expect(validarEntradaRecado({ ...ok, destinatarios: tres }, 2)).toEqual(['Hoje você ainda pode enviar 2 recados (limite de 30 por dia).']);
    expect(validarEntradaRecado({ ...ok, destinatarios: tres }, 1)).toEqual(['Hoje você ainda pode enviar 1 recado (limite de 30 por dia).']);
    expect(validarEntradaRecado({ ...ok, destinatarios: tres }, 3)).toEqual([]);
  });
});

describe('RECADOS-1 — montagem e limite diário', () => {
  it('nasce ENVIADO, sem resposta, e expira em 3 dias; o nome sai sem espaços sobrando', () => {
    const r = recado('a');
    expect(r).toMatchObject({ status: 'ENVIADO', resposta: null, notaResposta: '', respondidoEm: null, destinatarioNome: 'Ana Lima', equipeId: 'EQ_SOC' });
    expect(r.expiraEm).toBe('2026-11-20T15:00:00.000Z');
    expect(VALIDADE_DIAS).toBe(3);
  });

  it('o dia do limite é o dia de Brasília (UTC−3): 01:00 UTC ainda é o dia anterior', () => {
    expect(diaDoLimite('2026-11-17T15:00:00.000Z')).toBe('2026-11-17');
    expect(diaDoLimite('2026-11-18T02:59:59.000Z')).toBe('2026-11-17');
    expect(diaDoLimite('2026-11-18T03:00:00.000Z')).toBe('2026-11-18');
    expect(chaveLimite('marina', AGORA)).toBe('marina_2026-11-17');
  });

  it('o que sobra do dia nunca fica negativo', () => {
    expect(restanteHoje(0)).toBe(LIMITE_DIARIO_RECADOS);
    expect(restanteHoje(29)).toBe(1);
    expect(restanteHoje(30)).toBe(0);
    expect(restanteHoje(99)).toBe(0);
  });
});

describe('RECADOS-1 — o que cada lado enxerga', () => {
  it('o remetente vê aguardando, a resposta, ou expirado; o que tem resposta sobe na lista', () => {
    const pendente = recado('p');
    // (um recado expirado é sempre mais antigo que um ainda válido)
    const expirado = recado('e', { criadoEm: '2026-11-14T10:00:00.000Z', expiraEm: '2026-11-17T14:00:00.000Z' });
    const respondido = recado('r', { status: 'RESPONDIDO', resposta: 'NAO_POSSO', notaResposta: 'Estou de folga', respondidoEm: AGORA, criadoEm: '2026-11-16T10:00:00.000Z' });
    expect(estadoParaRemetente(pendente, AGORA)).toBe('AGUARDANDO');
    expect(estadoParaRemetente(expirado, AGORA)).toBe('EXPIRADO');
    expect(estadoParaRemetente(respondido, AGORA)).toBe('NAO_POSSO');
    expect(ordenarParaRemetente([pendente, expirado, respondido]).map((r) => r.id)).toEqual(['r', 'p', 'e']);
  });

  it('o colaborador só vê os dele, sem resposta e dentro da validade — respondeu, some', () => {
    const lista = [
      recado('dele'),
      recado('de-outro', { destinatarioLogin: 'bia' }),
      recado('respondido', { status: 'RESPONDIDO', resposta: 'POSSO' }),
      recado('expirado', { expiraEm: '2026-11-17T14:59:59.000Z' }),
      recado('mais-novo', { criadoEm: '2026-11-17T16:00:00.000Z' }),
    ];
    expect(pendentesParaODestinatario(lista, 'ana', AGORA).map((r) => r.id)).toEqual(['dele', 'mais-novo']);
    expect(pendentesParaODestinatario(lista, 'ninguem', AGORA)).toEqual([]);
  });

  it('as respostas cabem no tipo: pergunta = posso/não posso; aviso = entendi', () => {
    expect(respostasDoTipo('PERGUNTA')).toEqual(['POSSO', 'NAO_POSSO']);
    expect(respostasDoTipo('AVISO')).toEqual(['CIENTE']);
    expect(rotuloResposta('POSSO')).toBe('Posso');
    expect(rotuloResposta('NAO_POSSO')).toBe('Não posso');
    expect(rotuloResposta('CIENTE')).toBe('Entendi');
    expect(rotuloResposta(null)).toBe('');
  });

  it('expirou só quando a hora de expirar já passou', () => {
    expect(expirou({ expiraEm: AGORA }, AGORA)).toBe(true);
    expect(expirou({ expiraEm: '2026-11-17T15:00:00.001Z' }, AGORA)).toBe(false);
  });
});

describe('RECADOS-1 — ida e volta com o banco', () => {
  it('o que se grava é lido de novo igual; documento malformado é ignorado', () => {
    const r = recado('a');
    expect(lerRecado('a', JSON.parse(JSON.stringify(r)) as Record<string, unknown>)).toEqual(r);
    const cru = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    expect(lerRecado('a', { ...cru, tipo: 'CHAT' })).toBeNull();
    expect(lerRecado('a', { ...cru, status: 'LIDO' })).toBeNull();
    expect(lerRecado('a', { ...cru, resposta: 'TALVEZ' })).toBeNull();
    expect(lerRecado('a', { ...cru, destinatarioLogin: '' })).toBeNull();
    expect(lerRecado('a', { ...cru, expiraEm: undefined })).toBeNull();
    expect(lerRecado('a', { id: 'a' })).toBeNull();
  });
});
