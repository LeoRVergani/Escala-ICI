import { resolverJornadaDia, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

import { semanaDaData } from './visaoCoordenador';

/**
 * HOJE-ESTATISTICAS-1 — números pessoais da Jornada para a tela Hoje:
 * semana (domingo a sábado) e mês (competência), com o que já foi cumprido,
 * folgas do mês e a próxima folga.
 */
export interface FaixaEstatistica {
  dias: number;
  diasCumpridos: number;
  minutos: number;
  minutosCumpridos: number;
}

export interface EstatisticasJornada {
  semana: FaixaEstatistica;
  mes: FaixaEstatistica;
  folgasMes: number;
  proximaFolga: string | null;
}

function somar(escala: TurnosMes, catalogo: Record<string, TipoTurno>, datas: readonly string[], dataHoje: string): FaixaEstatistica {
  const faixa: FaixaEstatistica = { dias: 0, diasCumpridos: 0, minutos: 0, minutosCumpridos: 0 };
  for (const data of datas) {
    if (escala.dias[data] === undefined) continue;
    const jornada = resolverJornadaDia(escala, catalogo, data);
    if (!jornada.trabalha) continue;
    faixa.dias += 1;
    faixa.minutos += jornada.duracaoMinutos;
    if (data < dataHoje) {
      faixa.diasCumpridos += 1;
      faixa.minutosCumpridos += jornada.duracaoMinutos;
    }
  }
  return faixa;
}

export function calcularEstatisticasJornada(
  escala: TurnosMes,
  catalogo: Record<string, TipoTurno>,
  dataHoje: string,
): EstatisticasJornada {
  const datasMes = Object.keys(escala.dias).sort();
  const folgas = datasMes.filter((data) => catalogo[escala.dias[data]?.c ?? '']?.categoria === 'DESCANSO');
  return {
    semana: somar(escala, catalogo, semanaDaData(dataHoje), dataHoje),
    mes: somar(escala, catalogo, datasMes, dataHoje),
    folgasMes: folgas.length,
    proximaFolga: folgas.find((data) => data > dataHoje) ?? null,
  };
}
