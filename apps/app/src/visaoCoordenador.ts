import { calcularTotais, codigoPeriodoDia, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

/**
 * VISAO-COORDENADOR-APP-1 — consulta (somente leitura) das equipes que o
 * coordenador administra: quem trabalha em cada turno num dia, quem folga,
 * turnos descobertos, a semana e o resumo do mês de cada pessoa.
 */
export const PERIODOS_JORNADA = ['MD', 'M', 'T', 'N'] as const;
export type PeriodoJornada = (typeof PERIODOS_JORNADA)[number];

export interface PessoaNoDia {
  login: string;
  nome: string;
  codigo: string;
  horaExtra: boolean;
}

export interface ResumoEquipeNoDia {
  porPeriodo: Record<PeriodoJornada, PessoaNoDia[]>;
  folga: PessoaNoDia[];
  /** Férias, banco de horas, atestado etc. */
  ausentes: PessoaNoDia[];
  /** Turnos que a equipe usa no mês e que ficaram com ninguém neste dia. */
  descobertos: PeriodoJornada[];
}

function ehPeriodo(codigo: string): codigo is PeriodoJornada {
  return (PERIODOS_JORNADA as readonly string[]).includes(codigo);
}

export function resumirEquipeNoDia(
  documentos: readonly TurnosMes[],
  data: string,
  catalogo: Record<string, TipoTurno>,
  nomePorLogin: ReadonlyMap<string, string>,
): ResumoEquipeNoDia {
  const resumo: ResumoEquipeNoDia = {
    porPeriodo: { MD: [], M: [], T: [], N: [] },
    folga: [],
    ausentes: [],
    descobertos: [],
  };
  const periodosUsados = new Set<PeriodoJornada>();
  for (const documento of documentos) {
    for (const dia of Object.values(documento.dias)) {
      const periodo = codigoPeriodoDia(dia);
      if (ehPeriodo(periodo)) periodosUsados.add(periodo);
    }
    const dia = documento.dias[data];
    if (dia === undefined) continue;
    const pessoa: PessoaNoDia = {
      login: documento.login,
      nome: nomePorLogin.get(documento.login) ?? documento.login,
      codigo: dia.c,
      horaExtra: dia.t !== undefined,
    };
    const periodo = codigoPeriodoDia(dia);
    const categoria = catalogo[dia.c]?.categoria;
    if (ehPeriodo(periodo) && (categoria === 'TRABALHO' || categoria === 'EXTRA')) {
      resumo.porPeriodo[periodo].push(pessoa);
    } else if (categoria === 'DESCANSO') {
      resumo.folga.push(pessoa);
    } else {
      resumo.ausentes.push(pessoa);
    }
  }
  for (const lista of [...Object.values(resumo.porPeriodo), resumo.folga, resumo.ausentes]) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome));
  }
  resumo.descobertos = PERIODOS_JORNADA.filter((periodo) => periodosUsados.has(periodo) && resumo.porPeriodo[periodo].length === 0);
  return resumo;
}

/** Os 7 dias (domingo a sábado) da semana que contém `data`. */
export function semanaDaData(data: string): string[] {
  const [ano, mes, dia] = data.split('-').map(Number);
  if (!ano || !mes || !dia) return [];
  const base = new Date(Date.UTC(ano, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() - base.getUTCDay());
  return Array.from({ length: 7 }, (_, indice) => {
    const atual = new Date(base);
    atual.setUTCDate(base.getUTCDate() + indice);
    return atual.toISOString().slice(0, 10);
  });
}

export function deslocarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const base = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export interface ResumoMensalPessoa {
  diasTrabalhados: number;
  minutos: number;
  folgasSabado: number;
  folgasSemana: number;
  folgasDomingo: number;
  horasExtras: number;
  folgasFeriado: number;
}

/** Mesmo critério do Controle de Plantão: folgas de DSR (DF/DU) separadas por tipo de dia. */
export function resumirMesDaPessoa(documento: TurnosMes, catalogo: Record<string, TipoTurno>): ResumoMensalPessoa {
  const totais = calcularTotais(documento.dias, catalogo);
  const resumo: ResumoMensalPessoa = {
    diasTrabalhados: totais.diasTrabalhados,
    minutos: totais.min,
    folgasSabado: 0,
    folgasSemana: 0,
    folgasDomingo: 0,
    horasExtras: totais.he,
    folgasFeriado: totais.folga,
  };
  for (const [data, dia] of Object.entries(documento.dias)) {
    if (dia.c !== 'DF' && dia.c !== 'DU') continue;
    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
    if (diaSemana === 6) resumo.folgasSabado += 1;
    else if (diaSemana === 0) resumo.folgasDomingo += 1;
    else resumo.folgasSemana += 1;
  }
  return resumo;
}
