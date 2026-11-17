import { describe, expect, it } from 'vitest';

import {
  chaveLimite, diaDoLimite, enviadosAtivos, estadoParaRemetente, expirou, gruposEnviadosAtivos, gruposPendentesParaMembro, jaRespondeuGrupo, lerRecado,
  lerRecadoGrupo, LIMITE_DIARIO_RECADOS, mensagensConsumidas, montarRecado, montarRecadoGrupo, ordenarParaRemetente, pendentesParaODestinatario,
  quantidadeQuePedeAtencao, RESPOSTAS_RAPIDAS, restanteHoje, rotuloDoAlvo, rotuloRespostasDoGrupo, validarEntradaMensagem, validarResposta, VALIDADE_DIAS,
  type AlvoRecado, type Recado, type RecadoGrupo,
} from './recados';

const AGORA = '2026-11-17T15:00:00.000Z';
const ANA = { login: 'ana', nome: 'Ana  Lima', equipeId: 'EQ_SOC' };
const MARINA = { login: 'marina', nome: 'Marina Azevedo' };
const recado = (id: string, ajustes: Partial<Recado> = {}): Recado => ({ ...montarRecado({ texto: 'Pode trocar comigo dia 20?' }, ANA, MARINA, id, AGORA), ...ajustes });

describe('RECADOS-3 — validação (mensagens em português simples)', () => {
  const pessoa = { tipo: 'PESSOA' as const, pessoa: ANA };
  const soc: AlvoRecado = { tipo: 'EQUIPE', id: 'EQ_SOC', nome: 'Equipe SOC', quantidade: 42 };
  const plantao: AlvoRecado = { tipo: 'PLANTAO', id: 'G1', nome: 'Plantão COSI', quantidade: 3 };
  const ok = { destino: pessoa, texto: 'Pode trocar comigo dia 20?' };

  it('uma mensagem completa, com limite sobrando, é válida — para uma pessoa ou para grupos', () => {
    expect(validarEntradaMensagem(ok, 30)).toEqual([]);
    expect(validarEntradaMensagem({ destino: { tipo: 'GRUPOS', alvos: [soc] }, texto: 'Reunião amanhã às 9h' }, 30)).toEqual([]);
  });

  it('pede o destino e o texto; recusa texto longo', () => {
    expect(validarEntradaMensagem({ destino: null, texto: '' }, 30)).toEqual(['Escolha para quem enviar.', 'Escreva a mensagem.']);
    expect(validarEntradaMensagem({ destino: { tipo: 'GRUPOS', alvos: [] }, texto: 'Oi, pessoal' }, 30)).toEqual(['Escolha para quem enviar.']);
    expect(validarEntradaMensagem({ ...ok, texto: 'x'.repeat(301) }, 30)).toEqual(['A mensagem passa de 300 caracteres.']);
  });

  it('o limite conta UMA mensagem por pessoa ou por grupo — nunca por integrante do grupo', () => {
    expect(mensagensConsumidas(pessoa)).toBe(1);
    expect(mensagensConsumidas({ tipo: 'GRUPOS', alvos: [soc] })).toBe(1);
    expect(mensagensConsumidas({ tipo: 'GRUPOS', alvos: [soc, plantao] })).toBe(2);
    expect(mensagensConsumidas(null)).toBe(1);
    expect(validarEntradaMensagem(ok, 0)).toEqual(['Você já enviou as 30 mensagens de hoje. Amanhã libera de novo.']);
    expect(validarEntradaMensagem({ destino: { tipo: 'GRUPOS', alvos: [soc, plantao] }, texto: 'Oi, pessoal' }, 1)).toEqual(['Hoje você ainda pode enviar 1 mensagem (limite de 30 por dia).']);
    expect(validarEntradaMensagem({ destino: { tipo: 'GRUPOS', alvos: [soc, plantao] }, texto: 'Oi, pessoal' }, 2)).toEqual([]);
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
    expect(quantidadeQuePedeAtencao(lista, [], 'marina', AGORA)).toBe(2);
    expect(quantidadeQuePedeAtencao(lista, [], 'ninguem', AGORA)).toBe(0);
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

describe('RECADOS-3 — mensagem para um GRUPO (equipe ou Plantão)', () => {
  const SOC: AlvoRecado = { tipo: 'EQUIPE', id: 'EQ_SOC', nome: 'Equipe SOC', quantidade: 13 };
  const grupo = (id: string, ajustes: Partial<RecadoGrupo> = {}): RecadoGrupo => ({ ...montarRecadoGrupo({ texto: 'Alguém cobre a noite de sábado?' }, SOC, MARINA, id, AGORA), ...ajustes });
  const resp = (login: string, em: string, texto = 'Posso') => ({ login, nome: login.toUpperCase(), texto, em });

  it('nasce sem respostas e vence em 3 dias', () => {
    const g = grupo('g');
    expect(g).toMatchObject({ schemaVersion: 1, alvoTipo: 'EQUIPE', alvoId: 'EQ_SOC', alvoNome: 'Equipe SOC', respostas: [], remetenteLogin: 'marina' });
    expect(g.expiraEm).toBe('2026-11-20T15:00:00.000Z');
    expect(VALIDADE_DIAS).toBe(3);
  });

  it('o integrante só vê para responder as de OUTRA pessoa, ainda válidas e sem a resposta dele — respondeu, some', () => {
    const lista = [
      grupo('nova'),
      grupo('minha', { remetenteLogin: 'ana' }),
      grupo('ja-respondi', { respostas: [resp('ana', AGORA)] }),
      grupo('outro-respondeu', { respostas: [resp('caio', AGORA)] }),
      grupo('vencida', { expiraEm: '2026-11-17T14:00:00.000Z' }),
    ];
    expect(gruposPendentesParaMembro(lista, 'ana', AGORA).map((g) => g.id)).toEqual(['nova', 'outro-respondeu']);
    expect(jaRespondeuGrupo(lista[2]!, 'ana')).toBe(true);
    expect(jaRespondeuGrupo(lista[3]!, 'ana')).toBe(false);
  });

  it('o remetente vê as dele que ainda valem, com respostas primeiro', () => {
    const lista = [
      grupo('sem', { criadoEm: '2026-11-17T14:00:00.000Z' }),
      grupo('com', { criadoEm: '2026-11-17T10:00:00.000Z', respostas: [resp('ana', AGORA)] }),
      grupo('vencida', { expiraEm: '2026-11-17T14:00:00.000Z' }),
      grupo('de-outro', { remetenteLogin: 'caio' }),
    ];
    expect(gruposEnviadosAtivos(lista, 'marina', AGORA).map((g) => g.id)).toEqual(['com', 'sem']);
  });

  it('a bolinha soma pessoas e grupos: esperando minha resposta + respostas para ver', () => {
    const pessoas = [recado('p1', { remetenteLogin: 'marina', status: 'RESPONDIDO', resposta: 'Posso' })];
    const grupos = [
      grupo('g1', { respostas: [resp('ana', AGORA)] }),        // marina enviou e já tem resposta: 1
      grupo('g2', { remetenteLogin: 'caio' }),                  // de caio para a equipe, marina ainda não respondeu: 1
      grupo('g3'),                                              // marina enviou, sem resposta: 0
    ];
    expect(quantidadeQuePedeAtencao(pessoas, grupos, 'marina', AGORA)).toBe(3);
  });

  it('os rótulos: quantidade do grupo e "N de M responderam"', () => {
    expect(rotuloDoAlvo(SOC)).toBe('Equipe SOC · 13 pessoas');
    expect(rotuloDoAlvo({ nome: 'Plantão COSI', quantidade: 1 })).toBe('Plantão COSI · 1 pessoa');
    expect(rotuloDoAlvo({ nome: 'Plantão COSI' })).toBe('Plantão COSI');
    expect(rotuloRespostasDoGrupo(grupo('g'), 13)).toBe('Ninguém respondeu ainda');
    expect(rotuloRespostasDoGrupo(grupo('g', { respostas: [resp('a', AGORA)] }), 13)).toBe('1 de 13 respondeu');
    expect(rotuloRespostasDoGrupo(grupo('g', { respostas: [resp('a', AGORA), resp('b', AGORA)] }), 13)).toBe('2 de 13 responderam');
    expect(rotuloRespostasDoGrupo(grupo('g', { respostas: [resp('a', AGORA), resp('b', AGORA)] }))).toBe('2 responderam');
  });

  it('ida e volta com o banco: o mapa de respostas (chave = login com ponto) vira lista em ordem; malformado é ignorado', () => {
    const cru = {
      ...grupo('g'), respostas: {
        'caio.monteiro': { nome: 'Caio Monteiro', texto: 'Não posso', em: '2026-11-17T16:00:00.000Z' },
        'ana.lima': { nome: 'Ana Lima', texto: 'Posso', em: '2026-11-17T15:30:00.000Z' },
        quebrada: { nome: 'X' },
      },
    } as unknown as Record<string, unknown>;
    const lido = lerRecadoGrupo('g', cru);
    expect(lido?.respostas.map((r) => r.login)).toEqual(['ana.lima', 'caio.monteiro']);
    expect(lido?.respostas[0]).toEqual({ login: 'ana.lima', nome: 'Ana Lima', texto: 'Posso', em: '2026-11-17T15:30:00.000Z' });
    expect(lerRecadoGrupo('g', { ...cru, schemaVersion: 2 })).toBeNull();
    expect(lerRecadoGrupo('g', { ...cru, alvoTipo: 'TODOS' })).toBeNull();
    expect(lerRecadoGrupo('g', { ...cru, alvoId: '' })).toBeNull();
    expect(lerRecadoGrupo('g', { ...cru, expiraEm: undefined })).toBeNull();
    expect(lerRecadoGrupo('g', { ...cru, respostas: undefined })?.respostas).toEqual([]);
    expect(lerRecadoGrupo('g', { id: 'g' })).toBeNull();
  });
});
