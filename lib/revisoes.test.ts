import type { TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { agruparAlteracoesPorUsuario, calcularAlteracoesEscala } from './revisoes';

function escala(usuarioUid: string, dias: TurnosMes['dias']): TurnosMes {
  return {
    schemaVersion: 1,
    usuarioUid,
    login: usuarioUid,
    equipeId: 'EQ_TESTE',
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    turnoPadrao: 'MD',
    status: 'PUBLICADA',
    dias,
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}

describe('diferenças entre revisões', () => {
  it('registra somente dias efetivamente alterados com antes e depois', () => {
    const alteracoes = calcularAlteracoesEscala(
      [escala('caio', {
        '2026-08-05': { c: 'MD', i: '01:00', f: '07:00', m: 360 },
        '2026-08-06': { c: 'DF' },
      })],
      [escala('caio', {
        '2026-08-05': { c: 'M', i: '07:00', f: '13:00', m: 360 },
        '2026-08-06': { c: 'DF' },
      })],
    );

    expect(alteracoes).toEqual([{
      usuarioUid: 'caio',
      login: 'caio',
      data: '2026-08-05',
      codigoAnterior: 'MD',
      horarioAnterior: '01:00–07:00',
      codigoNovo: 'M',
      horarioNovo: '07:00–13:00',
    }]);
  });

  it('agrupa alterações para notificar somente usuários afetados', () => {
    const alteracoes = calcularAlteracoesEscala(
      [escala('caio', { '2026-08-05': { c: 'MD' } }), escala('bianca', { '2026-08-05': { c: 'M' } })],
      [escala('caio', { '2026-08-05': { c: 'T' } }), escala('bianca', { '2026-08-05': { c: 'M' } })],
    );
    const grupos = agruparAlteracoesPorUsuario(alteracoes);

    expect([...grupos.keys()]).toEqual(['caio']);
    expect(grupos.get('caio')).toHaveLength(1);
  });

  it('considera afetado o colaborador retirado completamente da nova escala', () => {
    const alteracoes = calcularAlteracoesEscala(
      [escala('caio', {
        '2026-08-05': { c: 'MD', i: '01:00', f: '07:00', m: 360 },
        '2026-08-06': { c: 'DF' },
      })],
      [],
    );

    expect(alteracoes).toHaveLength(2);
    expect(alteracoes.every(({ usuarioUid, codigoNovo }) =>
      usuarioUid === 'caio' && codigoNovo === null)).toBe(true);
  });
});

describe('CHECKUP-VISUAL-1 — alterações de Hora Extra com turno', () => {
  it('registra o turno real antes/depois quando o dia é HE com turno', () => {
    const antes = escala('ana', { '2026-11-15': { c: 'HE' } });
    const depois = escala('ana', { '2026-11-15': { c: 'HE', t: 'T', i: '13:00', f: '19:00', vd: false } });
    const [alteracao] = calcularAlteracoesEscala([antes], [depois]);
    expect(alteracao).toEqual({
      usuarioUid: 'ana',
      login: 'ana',
      data: '2026-11-15',
      codigoAnterior: 'HE',
      horarioAnterior: null,
      codigoNovo: 'HE',
      horarioNovo: '13:00–19:00',
      turnoNovo: 'T',
    });
    expect(alteracao).not.toHaveProperty('turnoAnterior');
  });

  it('trocar só o turno da HE conta como alteração', () => {
    const antes = escala('ana', { '2026-11-15': { c: 'HE', t: 'M' } });
    const depois = escala('ana', { '2026-11-15': { c: 'HE', t: 'T' } });
    expect(calcularAlteracoesEscala([antes], [depois])).toHaveLength(1);
  });
});
