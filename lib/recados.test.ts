import { describe, expect, it } from 'vitest';

import {
  chaveLimite, diaDoLimite, enviadosAtivos, estadoParaRemetente, expirou, lerRecado, LIMITE_DIARIO_RECADOS, montarRecado, ordenarParaRemetente,
  pendentesParaODestinatario, quantidadeQuePedeAtencao, RESPOSTAS_RAPIDAS, restanteHoje, validarEntradaRecado, validarResposta, VALIDADE_DIAS, type Recado,
} from './recados';

const AGORA = '2026-11-17T15:00:00.000Z';
const ANA = { login: 'ana', nome: 'Ana  Lima', equipeId: 'EQ_SOC' };
const MARINA = { login: 'marina', nome: 'Marina Azevedo' };
const recado = (id: string, ajustes: Partial<Recado> = {}): Recado => ({ ...montarRecado({ texto: 'Pode trocar comigo dia 20?' }, ANA, MARINA, id, AGORA), ...ajustes });

describe('RECADOS-2 — validação (mensagens em português simples)', () => {
  const ok = { destinatarios: [ANA], texto: 'Pode trocar comigo dia 20?' };

  it('um recado completo, com limite sobrando, é válido', () => {
    expect(validarEntradaRecado(ok, 30)).toEqual([]);
  });

  it('pede destinatário e texto; recusa texto longo e destinatários demais', () => {
    expect(validarEntradaRecado({ destinatarios: [], texto: '' }, 30)).toEqual(['Escolha para quem enviar.', 'Escreva o recado.']);
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

  it('a resposta é livre: qualquer texto de 1 a 300 caracteres; vazia ou longa demais não', () => {
    expect(validarResposta('Posso sim, mas só à tarde.')).toEqual([]);
    expect(validarResposta('   ')).toEqual(['Escreva a sua resposta.']);
    expect(validarResposta('x'.repeat(301))).toEqual(['A resposta passa de 300 caracteres.']);
    expect([...RESPOSTAS_RAPIDAS]).toEqual(['Posso', 'Não posso', 'Entendi']);
  });
});

describe('RECADOS-2 — montagem e limite diário', () => {
  it('nasce ENVIADO, sem resposta, e expira em 3 dias; o nome sai sem espaços sobrando', () => {
    const r = recado('a');
    expect(r).toMatchObject({ schemaVersion: 2, status: 'ENVIADO', resposta: '', respondidoEm: null, destinatarioNome: 'Ana Lima', equipeId: 'EQ_SOC', grupoPlantaoId: '' });
    expect(r.expiraEm).toBe('2026-11-20T15:00:00.000Z');
    expect(VALIDADE_DIAS).toBe(3);
  });

  it('o recado de Plantão leva o grupo; o de equipe, não', () => {
    expect(montarRecado({ texto: 'Oi, tudo bem?' }, { ...ANA, grupoPlantaoId: 'G1' }, MARINA, 'p', AGORA).grupoPlantaoId).toBe('G1');
    expect(montarRecado({ texto: 'Oi, tudo bem?' }, ANA, MARINA, 'e', AGORA).grupoPlantaoId).toBe('');
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

describe('RECADOS-2 — o que cada lado enxerga', () => {
  it('o remetente vê aguardando, a resposta ou vencido; o que tem resposta sobe na lista', () => {
    const pendente = recado('p');
    const vencido = recado('e', { criadoEm: '2026-11-14T10:00:00.000Z', expiraEm: '2026-11-17T14:00:00.000Z' });
    const respondido = recado('r', { status: 'RESPONDIDO', resposta: 'Estou de folga', respondidoEm: AGORA, criadoEm: '2026-11-16T10:00:00.000Z' });
    expect(estadoParaRemetente(pendente, AGORA)).toBe('AGUARDANDO');
    expect(estadoParaRemetente(vencido, AGORA)).toBe('EXPIRADO');
    expect(estadoParaRemetente(respondido, AGORA)).toBe('RESPONDIDO');
    expect(ordenarParaRemetente([pendente, vencido, respondido]).map((r) => r.id)).toEqual(['r', 'p', 'e']);
  });

  it('o colaborador só vê para responder os dele, sem resposta e dentro da validade — respondeu, some', () => {
    const lista = [
      recado('dele'),
      recado('de-outro', { destinatarioLogin: 'bia' }),
      recado('respondido', { status: 'RESPONDIDO', resposta: 'ok' }),
      recado('vencido', { expiraEm: '2026-11-17T14:59:59.000Z' }),
      recado('mais-novo', { criadoEm: '2026-11-17T16:00:00.000Z' }),
    ];
    expect(pendentesParaODestinatario(lista, 'ana', AGORA).map((r) => r.id)).toEqual(['dele', 'mais-novo']);
    expect(pendentesParaODestinatario(lista, 'ninguem', AGORA)).toEqual([]);
  });

  it('o que eu enviei e ainda vale; a bolinha soma "esperando minha resposta" com "respostas para ver"', () => {
    const lista = [
      recado('p1', { remetenteLogin: 'marina' }),
      recado('r1', { remetenteLogin: 'marina', status: 'RESPONDIDO', resposta: 'Posso' }),
      recado('v1', { remetenteLogin: 'marina', expiraEm: '2026-11-17T14:00:00.000Z' }),
      recado('outra-pessoa', { remetenteLogin: 'caio', destinatarioLogin: 'marina' }),
    ];
    expect(enviadosAtivos(lista, 'marina', AGORA).map((r) => r.id)).toEqual(['r1', 'p1']);
    // marina: 1 recado esperando a resposta DELA (de caio) + 1 resposta para ver (r1)
    expect(quantidadeQuePedeAtencao(lista, 'marina', AGORA)).toBe(2);
    expect(quantidadeQuePedeAtencao(lista, 'ninguem', AGORA)).toBe(0);
  });

  it('expirou só quando a hora de expirar já passou', () => {
    expect(expirou({ expiraEm: AGORA }, AGORA)).toBe(true);
    expect(expirou({ expiraEm: '2026-11-17T15:00:00.001Z' }, AGORA)).toBe(false);
  });
});

describe('RECADOS-2 — ida e volta com o banco', () => {
  it('o que se grava é lido de novo igual; documento antigo (v1) ou malformado é ignorado', () => {
    const r = recado('a');
    expect(lerRecado('a', JSON.parse(JSON.stringify(r)) as Record<string, unknown>)).toEqual(r);
    const cru = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    expect(lerRecado('a', { ...cru, schemaVersion: 1 })).toBeNull();
    expect(lerRecado('a', { ...cru, status: 'LIDO' })).toBeNull();
    expect(lerRecado('a', { ...cru, destinatarioLogin: '' })).toBeNull();
    expect(lerRecado('a', { ...cru, expiraEm: undefined })).toBeNull();
    expect(lerRecado('a', { id: 'a' })).toBeNull();
  });
});
