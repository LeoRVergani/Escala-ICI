import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { formatarHorasMinutos, resumirEquipeNoDia, resumirMesDaPessoa, resumirPlantonistas, semanaDaData } from './visaoCoordenador';

function documento(login: string, dias: Record<string, Dia>): TurnosMes {
  return {
    schemaVersion: 1, usuarioUid: login, login, equipeId: 'EQ', competencia: '2026-11',
    periodoInicio: '2026-11-01', periodoFim: '2026-11-30', turnoPadrao: 'M', status: 'PUBLICADA', dias,
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}

const M: Dia = { c: 'M', i: '07:00', f: '13:00', m: 360 };
const N: Dia = { c: 'N', i: '19:00', f: '01:00', m: 360 };
const DF: Dia = { c: 'DF' };

describe('VISAO-COORDENADOR-APP-1', () => {
  it('separa a equipe por turno, folga e aponta turno descoberto', () => {
    const docs = [
      documento('ana', { '2026-11-03': M, '2026-11-04': M }),
      documento('bia', { '2026-11-03': DF, '2026-11-04': N }),
      documento('caio', { '2026-11-03': { c: 'X' }, '2026-11-04': M }),
    ];
    const nomes = new Map([['ana', 'Ana'], ['bia', 'Bia'], ['caio', 'Caio']]);
    const resumo = resumirEquipeNoDia(docs, '2026-11-03', CATALOGO_SOC, nomes);
    expect(resumo.porPeriodo.M.map((p) => p.nome)).toEqual(['Ana']);
    expect(resumo.folga.map((p) => p.nome)).toEqual(['Bia']);
    expect(resumo.ausentes.map((p) => p.nome)).toEqual(['Caio']);
    expect(resumo.descobertos).toEqual(['N']);
  });

  it('Hora Extra conta no turno real', () => {
    const docs = [documento('ana', { '2026-11-15': { c: 'HE', t: 'T', i: '13:00', f: '19:00', vd: false } })];
    const resumo = resumirEquipeNoDia(docs, '2026-11-15', CATALOGO_SOC, new Map());
    expect(resumo.porPeriodo.T).toEqual([{ login: 'ana', nome: 'ana', codigo: 'HE', horaExtra: true }]);
  });

  it('semana de domingo a sábado', () => {
    expect(semanaDaData('2026-11-04')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  });

  it('resumo do mês: folgas de DSR por tipo de dia', () => {
    const doc = documento('ana', { '2026-11-01': DF, '2026-11-02': M, '2026-11-07': DF, '2026-11-11': { c: 'DU' } });
    expect(resumirMesDaPessoa(doc, CATALOGO_SOC)).toMatchObject({ folgasDomingo: 1, folgasSabado: 1, folgasSemana: 1, diasTrabalhados: 1 });
  });
});

describe('VISAO-COORDENADOR-APP-3 — total do mês por plantonista', () => {
  it('separa plantões de 24h e de dia útil e soma as horas', () => {
    const resumo = resumirPlantonistas([
      { plantonistaLogin: 'bruno', inicio: '2026-10-30T22:00:00.000Z', fim: '2026-10-31T22:00:00.000Z' },
      { plantonistaLogin: 'bruno', inicio: '2026-11-02T22:00:00.000Z', fim: '2026-11-03T10:00:00.000Z' },
      { plantonistaLogin: 'jean', inicio: '2026-10-31T22:00:00.000Z', fim: '2026-11-01T22:00:00.000Z' },
    ]);
    expect(resumo[0]).toEqual({ login: 'bruno', plantoes: 2, plantoes24h: 1, plantoesCurtos: 1, minutos: 36 * 60 });
    expect(resumo[1]).toMatchObject({ login: 'jean', plantoes: 1, plantoes24h: 1 });
    expect(formatarHorasMinutos(36 * 60)).toBe('36:00');
  });
});
