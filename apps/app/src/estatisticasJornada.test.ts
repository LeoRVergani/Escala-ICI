import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { calcularEstatisticasJornada } from './estatisticasJornada';

const N: Dia = { c: 'N', i: '19:00', f: '01:00', m: 360 };
const DF: Dia = { c: 'DF' };

function escala(dias: Record<string, Dia>): TurnosMes {
  return {
    schemaVersion: 1, usuarioUid: 'u', login: 'u', equipeId: 'EQ', competencia: '2026-11',
    periodoInicio: '2026-11-01', periodoFim: '2026-11-30', turnoPadrao: 'N', status: 'PUBLICADA', dias,
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}

describe('HOJE-ESTATISTICAS-1', () => {
  it('semana, mês, cumpridos, folgas e próxima folga', () => {
    const doc = escala({
      '2026-11-01': DF, '2026-11-02': N, '2026-11-03': N, '2026-11-04': N, '2026-11-05': N, '2026-11-06': N,
      '2026-11-07': N, '2026-11-08': DF, '2026-11-09': N,
    });
    const r = calcularEstatisticasJornada(doc, CATALOGO_SOC, '2026-11-04');
    expect(r.semana).toEqual({ dias: 6, diasCumpridos: 2, minutos: 6 * 360, minutosCumpridos: 2 * 360 });
    expect(r.mes.dias).toBe(7);
    expect(r.folgasMes).toBe(2);
    expect(r.proximaFolga).toBe('2026-11-08');
  });
});
