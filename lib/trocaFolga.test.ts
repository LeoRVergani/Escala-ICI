import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { aplicarTrocaDeFolga, validarTrocaDeFolga } from './trocaFolga';

const MANHA: Dia = { c: 'M', i: '07:00', f: '13:00', m: 360 };
const DF: Dia = { c: 'DF' };

/** 01 DF · 02–06 M · 07 DF · 08–12 M · 13 DF · 14 M */
function escala(status: TurnosMes['status'] = 'PUBLICADA'): TurnosMes {
  const dias: Record<string, Dia> = {};
  for (let dia = 1; dia <= 14; dia += 1) {
    const data = `2026-11-${String(dia).padStart(2, '0')}`;
    dias[data] = [1, 7, 13].includes(dia) ? DF : MANHA;
  }
  return {
    schemaVersion: 1,
    usuarioUid: 'leo',
    login: 'leo',
    equipeId: 'EQ',
    competencia: '2026-11',
    periodoInicio: '2026-11-01',
    periodoFim: '2026-11-14',
    turnoPadrao: 'M',
    status,
    dias,
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}

describe('TROCA-FOLGA-1 — troca de folga pelo próprio colaborador', () => {
  it('troca a folga de 07/11 pelo trabalho de 06/11: continua apto', () => {
    const resultado = validarTrocaDeFolga({ documento: escala(), dataFolga: '2026-11-07', dataTrabalho: '2026-11-06', catalogo: CATALOGO_SOC, hoje: '2026-11-01' });
    expect(resultado.erros).toEqual([]);
    const dias = aplicarTrocaDeFolga(escala().dias, '2026-11-07', '2026-11-06');
    expect(dias['2026-11-07']?.c).toBe('M');
    expect(dias['2026-11-06']?.c).toBe('DF');
  });

  it('bloqueia quando a troca criaria mais de 6 dias seguidos de trabalho', () => {
    const resultado = validarTrocaDeFolga({ documento: escala(), dataFolga: '2026-11-07', dataTrabalho: '2026-11-12', catalogo: CATALOGO_SOC, hoje: '2026-11-01' });
    expect(resultado.erros.some((erro) => erro.includes('dias seguidos'))).toBe(true);
    expect(resultado.alertasNovos.length).toBeGreaterThan(0);
  });

  it('bloqueia dia passado, códigos errados e escala não publicada', () => {
    expect(validarTrocaDeFolga({ documento: escala(), dataFolga: '2026-11-07', dataTrabalho: '2026-11-06', catalogo: CATALOGO_SOC, hoje: '2026-11-06' }).erros)
      .toContain('Só dá para trocar dias a partir de amanhã.');
    expect(validarTrocaDeFolga({ documento: escala(), dataFolga: '2026-11-06', dataTrabalho: '2026-11-05', catalogo: CATALOGO_SOC, hoje: '2026-11-01' }).erros)
      .toContain('O dia de folga precisa ser uma folga de DSR (DF ou DU).');
    expect(validarTrocaDeFolga({ documento: escala('RASCUNHO'), dataFolga: '2026-11-07', dataTrabalho: '2026-11-06', catalogo: CATALOGO_SOC, hoje: '2026-11-01' }).erros)
      .toContain('Só dá para trocar dias de uma escala publicada.');
  });

  it('as horas do mês não mudam com a troca', () => {
    const antes = Object.values(escala().dias).reduce((soma, dia) => soma + (dia.m ?? 0), 0);
    const depois = Object.values(aplicarTrocaDeFolga(escala().dias, '2026-11-07', '2026-11-06')).reduce((soma, dia) => soma + (dia.m ?? 0), 0);
    expect(depois).toBe(antes);
  });
});
