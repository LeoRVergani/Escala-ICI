import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { mesclarTrechoNaBase } from './importacaoMatrizTurnos';

/**
 * MATRIZ-TURNOS-1 — o trecho (19/12 a 03/01) é mesclado sobre a escala normal de 2027-01 (16/12 a 16/01): só os dias do trecho
 * mudam; os outros dias, e as pessoas que não estão na matriz, ficam como estavam.
 */
const COMP = '2027-01';
const BASE_INICIO = '2026-12-16';
const BASE_FIM = '2027-01-16';
const dias = (inicio: string, fim: string): string[] => {
  const lista: string[] = [];
  for (let t = Date.parse(`${inicio}T12:00:00Z`); t <= Date.parse(`${fim}T12:00:00Z`); t += 86_400_000) lista.push(new Date(t).toISOString().slice(0, 10));
  return lista;
};
const trabalho = (codigo: string, seq?: number): Dia => ({ c: codigo, i: '07:00', f: '13:00', m: 360, vd: false, ...(seq === undefined ? {} : { seq }) });

function docBase(login: string, ajustes: Partial<TurnosMes> = {}): TurnosMes {
  const mapa: Record<string, Dia> = {};
  dias(BASE_INICIO, BASE_FIM).forEach((data, i) => { mapa[data] = i % 7 === 6 ? { c: 'DF' } : trabalho('M', (i % 7) + 1); });
  return {
    schemaVersion: 1, usuarioUid: `uid-${login}`, login, equipeId: 'EQ_SOC', competencia: COMP, periodoInicio: BASE_INICIO, periodoFim: BASE_FIM,
    turnoPadrao: 'M', status: 'PUBLICADA', dias: mapa, totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
    publicadoPor: 'gestor', publicadoEm: '2026-11-20T10:00:00.000Z', importacaoId: 'imp-1', pendenciasImportacao: [{ linha: 1, coluna: 'A', valorEncontrado: 'x', motivo: 'm', severidade: 'ALERTA' }],
    ...ajustes,
  };
}

function docTrecho(login: string, codigos: Record<string, string>): TurnosMes {
  const mapa: Record<string, Dia> = {};
  for (const data of dias('2026-12-19', '2027-01-03')) mapa[data] = codigos[data] === undefined ? { c: 'DU' } : { c: codigos[data]!, i: '19:00', f: '01:00', m: 360, vd: true };
  return {
    schemaVersion: 1, usuarioUid: `uid-${login}`, login, equipeId: 'EQ_SOC', competencia: COMP, periodoInicio: '2026-12-19', periodoFim: '2027-01-03',
    turnoPadrao: 'N', status: 'RASCUNHO', dias: mapa, totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}
const opcoes = { catalogo: CATALOGO_SOC, competencia: COMP };

describe('mesclarTrechoNaBase — sem escala normal ainda', () => {
  it('devolve o trecho como está e AVISA que a escala normal, ao chegar, apagaria o trecho se não for reaplicado', () => {
    const trecho = [docTrecho('ana', { '2026-12-19': 'N' })];
    const r = mesclarTrechoNaBase(trecho, [], opcoes);
    expect(r.documentos).toEqual(trecho);
    expect(r.documentos[0]).not.toBe(trecho[0]);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain('A escala normal de 2027-01 ainda não existe');
    expect(r.avisos[0]).toContain('reaplique este arquivo POR CIMA');
  });

  it('trecho vazio devolve vazio', () => {
    expect(mesclarTrechoNaBase([], [docBase('ana')], opcoes)).toEqual({ documentos: [], avisos: [] });
  });
});

describe('mesclarTrechoNaBase — sobre a escala normal existente', () => {
  const base = [docBase('ana'), docBase('bruno'), docBase('carla')];
  const trecho = [docTrecho('ana', { '2026-12-19': 'N', '2026-12-21': 'MD' }), docTrecho('bruno', { '2026-12-20': 'T' })];
  const r = mesclarTrechoNaBase(trecho, base, { ...opcoes, origemBase: 'PUBLICADA' });
  const ana = r.documentos.find((d) => d.login === 'ana')!;

  it('troca SÓ os dias do trecho e preserva todos os outros dias, byte a byte (inclusive o ciclo `seq`)', () => {
    for (const data of dias(BASE_INICIO, '2026-12-18')) expect(ana.dias[data]).toEqual(base[0]!.dias[data]);
    for (const data of dias('2027-01-04', BASE_FIM)) expect(ana.dias[data]).toEqual(base[0]!.dias[data]);
    for (const data of dias('2026-12-19', '2027-01-03')) expect(ana.dias[data]).toEqual(trecho[0]!.dias[data]);
    expect(Object.keys(ana.dias)).toHaveLength(32);
  });

  it('mantém o período da escala normal (16/12 a 16/01), vira RASCUNHO e perde o que dizia "publicado" e as pendências antigas', () => {
    expect(ana).toMatchObject({ periodoInicio: BASE_INICIO, periodoFim: BASE_FIM, status: 'RASCUNHO', competencia: COMP });
    expect(ana).not.toHaveProperty('publicadoPor');
    expect(ana).not.toHaveProperty('publicadoEm');
    expect(ana).not.toHaveProperty('importacaoId');
    expect(ana).not.toHaveProperty('pendenciasImportacao');
  });

  it('recalcula os totais do documento mesclado (e o turno padrão da escala normal é mantido)', () => {
    const contado = Object.values(ana.dias).filter((dia) => ['MD', 'M', 'T', 'N'].includes(dia.c)).length;
    expect(ana.totais.diasTrabalhados).toBe(contado);
    expect(ana.totais.du).toBe(Object.values(ana.dias).filter((dia) => dia.c === 'DU').length);
    expect(ana.turnoPadrao).toBe('M');
  });

  it('quem não está na matriz fica EXATAMENTE como estava (só vira rascunho) e entra na lista de avisos', () => {
    const carla = r.documentos.find((d) => d.login === 'carla')!;
    expect(carla.dias).toEqual(base[2]!.dias);
    expect(carla.status).toBe('RASCUNHO');
    expect(r.avisos.join('\n')).toContain('mantêm os dias da escala normal durante o trecho: carla.');
    expect(r.documentos.map((d) => d.login)).toEqual(['ana', 'bruno', 'carla']);
  });

  it('o aviso principal diz o que foi trocado e de que escala (publicada × rascunho)', () => {
    expect(r.avisos[0]).toBe('Mesclado sobre a escala publicada de 2027-01: os dias de 19/12/2026 a 03/01/2027 foram trocados para 2 pessoa(s); todos os outros dias foram mantidos.');
    expect(mesclarTrechoNaBase(trecho, base, { ...opcoes, origemBase: 'RASCUNHO' }).avisos[0]).toContain('escala em rascunho de 2027-01');
  });

  it('não altera os documentos de entrada', () => {
    const antes = JSON.stringify([base, trecho]);
    mesclarTrechoNaBase(trecho, base, opcoes);
    expect(JSON.stringify([base, trecho])).toBe(antes);
  });
});

describe('mesclarTrechoNaBase — pessoa da matriz que não tem escala normal', () => {
  it('entra só com os dias do trecho, no período da competência, e o aviso diz quem é', () => {
    const r = mesclarTrechoNaBase([docTrecho('novo', { '2026-12-19': 'N' })], [docBase('ana')], opcoes);
    const novo = r.documentos.find((d) => d.login === 'novo')!;
    expect(novo).toMatchObject({ periodoInicio: BASE_INICIO, periodoFim: BASE_FIM });
    expect(Object.keys(novo.dias)).toHaveLength(16);
    expect(r.avisos.join('\n')).toContain('Sem escala normal em 2027-01 (só terão os dias do trecho): novo.');
  });
});
