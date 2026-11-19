import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { aplicarInversaoNosDocumentos, conferirRegrasDaInversao, descreverPeriodo, periodosSugeridos, planejarInversao } from './inversaoEscalas';
import { REGRAS_PADRAO } from './regrasPadrao';

/**
 * INVERSAO-ESCALAS-1 — a inversão é uma PERMUTA entre duas pessoas: cada dia do período, uma passa a ter o que a outra tinha.
 * As escalas aqui seguem o desenho da escala de fim de ano (19/12/2026 a 03/01/2027): quem não cobre turno está em DF/DU/FOLGA.
 */
const DATAS = Array.from({ length: 16 }, (_, i) => new Date(Date.UTC(2026, 11, 19 + i, 12)).toISOString().slice(0, 10));
const diaDe = (codigo: string): Dia => {
  const tipo = CATALOGO_SOC[codigo]!;
  return tipo.categoria === 'TRABALHO'
    ? { c: codigo, i: tipo.horaInicio!, f: tipo.horaFim!, m: tipo.duracaoMinutos, vd: tipo.viraDia }
    : { c: codigo };
};

function doc(login: string, codigos: Record<number, string>, ajustes: Partial<TurnosMes> = {}): TurnosMes {
  const dias: Record<string, Dia> = {};
  DATAS.forEach((data, i) => { dias[data] = diaDe(codigos[i] ?? 'DU'); });
  return {
    schemaVersion: 1, usuarioUid: login, login, equipeId: 'EQ_SOC', competencia: '2027-01', periodoInicio: DATAS[0]!, periodoFim: DATAS[15]!,
    turnoPadrao: 'N', status: 'RASCUNHO', dias, totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
    ...ajustes,
  };
}

/** Daniel cobre a Noite na semana do Natal (20 a 25/12); Luiz, na semana do Ano Novo (26 a 31/12). */
const daniel = () => doc('daniel', { 1: 'N', 2: 'N', 3: 'N', 4: 'N', 5: 'N', 6: 'N', 14: 'N' });
const luiz = () => doc('luiz', { 7: 'N', 8: 'N', 9: 'N', 10: 'N', 11: 'N', 12: 'N', 15: 'N' });
const outra = () => doc('ana', { 0: 'M', 3: 'M' }, { turnoPadrao: 'M' });
const PERIODO_TODO = { inicio: DATAS[0]!, fim: DATAS[15]! };

describe('planejarInversao — o caso do pedido ("Luiz folga no Natal, já combinei com o Daniel")', () => {
  const docs = [daniel(), luiz(), outra()];
  const r = planejarInversao(docs, 'luiz', 'daniel', PERIODO_TODO, CATALOGO_SOC);

  it('inverte o período inteiro: cada um fica com a escala do outro, dia a dia', () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const data of DATAS) {
      expect(r.plano.documentoA.dias[data]!.c, `luiz em ${data}`).toBe(daniel().dias[data]!.c);
      expect(r.plano.documentoB.dias[data]!.c, `daniel em ${data}`).toBe(luiz().dias[data]!.c);
    }
    // o Luiz agora folga no Natal (24 e 25/12) e o Daniel cobre; no Ano Novo é o contrário
    expect(r.plano.documentoA.dias['2026-12-24']!.c).toBe('N');
    expect(r.plano.documentoA.dias['2026-12-31']!.c).toBe('DU');
  });

  it('só os dias que DIFEREM entram na troca; os que já eram iguais são contados e pulados', () => {
    if (!r.ok) throw new Error('plano esperado');
    expect(r.plano.trocados.length + r.plano.iguais).toBe(16);
    expect(r.plano.trocados.every((t) => t.deA.c !== t.deB.c)).toBe(true);
    expect(r.plano.semDados).toEqual([]);
  });

  it('o período todo troca também o turno-base; os totais são recalculados', () => {
    if (!r.ok) throw new Error('plano esperado');
    expect(r.plano.trocouTurnoPadrao).toBe(true);
    expect(r.plano.documentoA.totais.diasTrabalhados).toBe(7);
    expect(r.plano.documentoB.totais.diasTrabalhados).toBe(7);
    expect(r.plano.documentoA.totais.diasTrabalhados + r.plano.documentoA.totais.du + r.plano.documentoA.totais.df + r.plano.documentoA.totais.folga).toBe(16);
  });

  it('a COBERTURA não muda: em cada dia, o conjunto de turnos do time é o mesmo (só muda quem faz o quê)', () => {
    if (!r.ok) throw new Error('plano esperado');
    const depois = aplicarInversaoNosDocumentos(docs, r.plano);
    for (const data of DATAS) {
      const turnos = (lista: readonly TurnosMes[]) => lista.map((d) => d.dias[data]!.c).sort().join(',');
      expect(turnos(depois), data).toBe(turnos(docs));
    }
  });

  it('cada documento continua sendo da mesma pessoa: só os dias (e o turno-base) trocam', () => {
    if (!r.ok) throw new Error('plano esperado');
    for (const [novo, original] of [[r.plano.documentoA, luiz()], [r.plano.documentoB, daniel()]] as const) {
      const { dias: _d, totais: _t, turnoPadrao: _p, ...resto } = novo;
      const { dias: _d2, totais: _t2, turnoPadrao: _p2, ...restoOriginal } = original;
      void [_d, _t, _p, _d2, _t2, _p2];
      expect(resto).toEqual(restoOriginal);
    }
    expect([r.plano.documentoA.login, r.plano.documentoA.usuarioUid]).toEqual(['luiz', 'luiz']);
  });

  it('as outras pessoas ficam EXATAMENTE como estavam (a mesma referência) e as de entrada não são alteradas', () => {
    if (!r.ok) throw new Error('plano esperado');
    const antes = JSON.stringify(docs);
    const depois = aplicarInversaoNosDocumentos(docs, r.plano);
    expect(JSON.stringify(docs)).toBe(antes);
    expect(depois[2]).toBe(docs[2]);
    expect(depois.map((d) => d.login)).toEqual(['daniel', 'luiz', 'ana']);
  });
});

describe('planejarInversao — só um período (Natal)', () => {
  it('troca só 24 e 25/12 e mantém o turno-base de cada um', () => {
    const r = planejarInversao([daniel(), luiz()], 'luiz', 'daniel', { inicio: '2026-12-24', fim: '2026-12-25' }, CATALOGO_SOC);
    if (!r.ok) throw new Error('plano esperado');
    expect(r.plano.trocados.map((t) => t.data)).toEqual(['2026-12-24', '2026-12-25']);
    expect(r.plano.trocouTurnoPadrao).toBe(false);
    expect(r.plano.documentoA.dias['2026-12-24']!.c).toBe('N');   // Luiz cobre... o que o Daniel tinha
    expect(r.plano.documentoA.dias['2026-12-26']!.c).toBe('N');   // fora do período: continua o dele
    expect(r.plano.documentoA.dias['2026-12-20']).toEqual(luiz().dias['2026-12-20']); // fora do período: continua o dele, igual ao original
  });

  it('o dia trocado perde o `seq` (contador de dias seguidos da importação deixa de valer)', () => {
    const a = daniel(); a.dias['2026-12-24'] = { ...a.dias['2026-12-24']!, seq: 4 };
    const r = planejarInversao([a, luiz()], 'luiz', 'daniel', { inicio: '2026-12-24', fim: '2026-12-24' }, CATALOGO_SOC);
    if (!r.ok) throw new Error('plano esperado');
    expect(r.plano.documentoA.dias['2026-12-24']).not.toHaveProperty('seq');
    expect(r.plano.documentoB.dias['2026-12-24']).not.toHaveProperty('seq');
  });

  it('um dia que falta na escala de uma das duas é PULADO e informado, nunca inventado', () => {
    const a = daniel(); delete a.dias['2026-12-24'];
    const r = planejarInversao([a, luiz()], 'luiz', 'daniel', { inicio: '2026-12-24', fim: '2026-12-25' }, CATALOGO_SOC);
    if (!r.ok) throw new Error('plano esperado');
    expect(r.plano.semDados).toEqual(['2026-12-24']);
    expect(r.plano.trocados.map((t) => t.data)).toEqual(['2026-12-25']);
    expect(r.plano.trocouTurnoPadrao).toBe(false);
  });
});

describe('planejarInversao — recusas com motivo claro', () => {
  const docs = [daniel(), luiz(), outra()];
  it.each([
    ['sem escolher', '', 'luiz', PERIODO_TODO, 'Escolha as duas pessoas.'],
    ['a mesma pessoa', 'luiz', 'luiz', PERIODO_TODO, 'Escolha duas pessoas diferentes.'],
    ['pessoa fora da escala', 'luiz', 'fantasma', PERIODO_TODO, 'Uma das pessoas não está nesta escala.'],
    ['sem período', 'luiz', 'daniel', { inicio: '', fim: '' }, 'Informe o período.'],
    ['período invertido', 'luiz', 'daniel', { inicio: '2026-12-25', fim: '2026-12-24' }, 'A data inicial é depois da final.'],
    ['período fora da escala', 'luiz', 'daniel', { inicio: '2027-02-01', fim: '2027-02-02' }, 'Nenhum dia da escala cai nesse período.'],
  ])('%s', (_rotulo, a, b, periodo, erro) => {
    expect(planejarInversao(docs, a, b, periodo, CATALOGO_SOC)).toEqual({ ok: false, erro });
  });

  it('duas escalas iguais no período: não há o que inverter', () => {
    const r = planejarInversao([doc('x', { 0: 'M' }), doc('y', { 0: 'M' })], 'x', 'y', PERIODO_TODO, CATALOGO_SOC);
    expect(r).toEqual({ ok: false, erro: 'As duas escalas são iguais nesse período: não há o que inverter.' });
  });
});

describe('conferirRegrasDaInversao — o que a troca CRIA e o que RESOLVE nas regras de cada uma', () => {
  // Leo: Noite 19/12 → folga 20/12 → Madrugada 21/12 = só 24 h depois da folga (o mínimo é 35 h). Ana: Tarde, folga, Tarde (ok).
  const leo = doc('leo', { 0: 'N', 2: 'MD' });
  const ana = doc('ana', { 0: 'T', 2: 'T' }, { turnoPadrao: 'T' });
  const periodo = { inicio: '2026-12-19', fim: '2026-12-21' };
  const docs = [leo, ana];

  it('trocar o Leo com a Ana RESOLVE o descanso de 24 h do Leo e CRIA o mesmo problema para a Ana', () => {
    const r = planejarInversao(docs, 'leo', 'ana', periodo, CATALOGO_SOC);
    if (!r.ok) throw new Error('plano esperado');
    const { novos, resolvidos } = conferirRegrasDaInversao(docs, r.plano, CATALOGO_SOC, REGRAS_PADRAO, { leo: 'Leo', ana: 'Ana' });
    expect(resolvidos.map((a) => a.login)).toEqual(['leo']);
    expect(novos.map((a) => a.login)).toEqual(['ana']);
    expect(novos[0]!.mensagem).toContain('só 24 h de descanso depois da folga');
    expect(novos[0]!.gravidade).toBe('CRITICO');
  });

  it('uma troca sem efeito nas regras não cria nem resolve nada', () => {
    const a = doc('a', { 0: 'M', 1: 'M' }); const b = doc('b', { 0: 'T', 1: 'T' });
    const r = planejarInversao([a, b], 'a', 'b', PERIODO_TODO, CATALOGO_SOC);
    if (!r.ok) throw new Error('plano esperado');
    expect(conferirRegrasDaInversao([a, b], r.plano, CATALOGO_SOC, REGRAS_PADRAO)).toEqual({ novos: [], resolvidos: [] });
  });
});

describe('periodosSugeridos', () => {
  const docs = [daniel(), luiz()];
  it('oferece o período todo, Natal e Ano Novo quando cabem', () => {
    expect(periodosSugeridos(docs, 'luiz', 'daniel')).toEqual([
      { chave: 'tudo', rotulo: 'Todo o período', inicio: '2026-12-19', fim: '2027-01-03' },
      { chave: 'natal-2026', rotulo: 'Natal (24 e 25/12)', inicio: '2026-12-24', fim: '2026-12-25' },
      { chave: 'anonovo-2026', rotulo: 'Ano Novo (31/12 e 01/01)', inicio: '2026-12-31', fim: '2027-01-01' },
    ]);
  });

  it('numa escala que não passa pelo Natal, só o período todo', () => {
    const agosto = [doc('a', {}, { periodoInicio: '2026-07-26', periodoFim: '2026-08-25' })];
    expect(periodosSugeridos(agosto, 'a', 'a').map((s) => s.chave)).toEqual(['tudo']);
  });

  it('descreverPeriodo', () => {
    expect(descreverPeriodo({ inicio: '2026-12-24', fim: '2026-12-25' })).toBe('24/12 a 25/12');
    expect(descreverPeriodo({ inicio: '2026-12-24', fim: '2026-12-24' })).toBe('24/12');
  });
});
