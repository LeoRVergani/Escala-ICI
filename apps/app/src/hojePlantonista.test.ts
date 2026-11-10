import type { AtribuicaoPlantaoPersistida } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { meuPlantaoEmDestaque, minhaSemanaDePlantao, rotuloTempoAte, sequenciaDoPosto } from './hojePlantonista';

// Plantões de 12 h, 19:00 → 07:00 (Brasília = UTC−3: 22:00Z → 10:00Z).
function plantao(login: string, dia: string, funcao?: string): AtribuicaoPlantaoPersistida {
  const seguinte = new Date(`${dia}T12:00:00Z`);
  seguinte.setUTCDate(seguinte.getUTCDate() + 1);
  return {
    plantonistaLogin: login,
    inicio: `${dia}T22:00:00.000Z`,
    fim: `${seguinte.toISOString().slice(0, 10)}T10:00:00.000Z`,
    ...(funcao ? { funcao } : {}),
  } as unknown as AtribuicaoPlantaoPersistida;
}

const escala = [plantao('ana', '2026-11-08'), plantao('bia', '2026-11-09'), plantao('jean', '2026-11-10'), plantao('ana', '2026-11-11'), plantao('jean', '2026-11-13')];

describe('HOJE-PLANTONISTA-1', () => {
  it('passagem do plantão: anterior, agora e próximo', () => {
    // 10/11 às 23:00 (02:00Z do dia 11): Jean de plantão.
    const seq = sequenciaDoPosto(escala, '2026-11-11T02:00:00.000Z');
    expect([seq.anterior?.plantonistaLogin, seq.atual?.plantonistaLogin, seq.proximo?.plantonistaLogin]).toEqual(['bia', 'jean', 'ana']);
  });

  it('sem ninguém agora (durante o dia): anterior = o que acabou, próximo = o da noite', () => {
    const seq = sequenciaDoPosto(escala, '2026-11-10T15:00:00.000Z');
    expect([seq.anterior?.plantonistaLogin, seq.atual, seq.proximo?.plantonistaLogin]).toEqual(['bia', null, 'jean']);
  });

  it('multi-posto: só o meu posto', () => {
    const multi = [plantao('ana', '2026-11-10', 'DBA'), plantao('rui', '2026-11-10', 'LINUX'), plantao('bia', '2026-11-11', 'DBA')];
    const seq = sequenciaDoPosto(multi, '2026-11-11T02:00:00.000Z', 'DBA' as never);
    expect([seq.atual?.plantonistaLogin, seq.proximo?.plantonistaLogin]).toEqual(['ana', 'bia']);
  });

  it('meu plantão: agora (com progresso e quanto falta) ou o próximo', () => {
    const agora = meuPlantaoEmDestaque('jean', escala, '2026-11-11T04:00:00.000Z');
    expect(agora).toMatchObject({ estado: 'AGORA', minutosParaFim: 360, progresso: 0.5 });
    const proximo = meuPlantaoEmDestaque('jean', escala, '2026-11-10T19:00:00.000Z');
    expect(proximo).toMatchObject({ estado: 'PROXIMO', minutosParaInicio: 180 });
    expect(meuPlantaoEmDestaque('ninguem', escala, '2026-11-10T19:00:00.000Z')).toEqual({ estado: 'NENHUM' });
  });

  it('tempo até: minutos, horas e dias', () => {
    expect(rotuloTempoAte(45)).toBe('em 45 min');
    expect(rotuloTempoAte(320)).toBe('em 5 h 20 min');
    expect(rotuloTempoAte(180)).toBe('em 3 h');
    expect(rotuloTempoAte(1500)).toBe('amanhã');
    expect(rotuloTempoAte(3 * 1440)).toBe('em 3 dias');
  });

  it('minha semana: dias com plantão e a continuação da madrugada', () => {
    const semana = minhaSemanaDePlantao('jean', escala, '2026-11-10', 'America/Sao_Paulo', 5);
    expect(semana.map((dia) => dia.data)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
    expect(semana[0]).toMatchObject({ hoje: true, continuacao: false });
    expect(semana[0]?.plantoes[0]).toMatchObject({ horaInicio: '19:00', horaFim: '07:00' });
    expect(semana[1]).toMatchObject({ plantoes: [], continuacao: true });
    expect(semana[3]?.plantoes).toHaveLength(1);
  });
});
