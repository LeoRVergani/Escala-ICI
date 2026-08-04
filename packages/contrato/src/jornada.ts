import type {
  Categoria,
  Dia,
  TipoTurno,
  TurnosMes,
} from './tipos.js';

export interface ReferenciaTemporal {
  dataIso: string;
  hora: string;
}

export interface JornadaDia {
  data: string;
  codigo: string;
  descricao: string;
  categoria: Categoria | 'SEM_ESCALA';
  inicio?: string;
  fim?: string;
  duracaoMinutos: number;
  viraDia: boolean;
  trabalha: boolean;
}

export interface IntervaloTurno extends JornadaDia {
  inicio: string;
  fim: string;
  trabalha: true;
}

export type EstadoJornada =
  | 'EM_ANDAMENTO'
  | 'AGENDADO_HOJE'
  | 'ENCERRADO_HOJE'
  | 'NAO_TRABALHA_HOJE'
  | 'SEM_ESCALA';

export interface ContextoJornada {
  referencia: ReferenciaTemporal;
  hoje: JornadaDia;
  estado: EstadoJornada;
  turnoAtual: IntervaloTurno | null;
  proximoTurno: IntervaloTurno | null;
}

function partesData(dataIso: string) {
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dataIso);
  if (correspondencia === null) {
    throw new Error(`Data ISO inválida: ${dataIso}`);
  }
  return {
    ano: Number(correspondencia[1]),
    mes: Number(correspondencia[2]),
    dia: Number(correspondencia[3]),
  };
}

function dataUtc(dataIso: string): Date {
  const { ano, mes, dia } = partesData(dataIso);
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

function minutosHora(hora: string): number {
  const correspondencia = /^(\d{2}):(\d{2})$/u.exec(hora);
  if (correspondencia === null) {
    throw new Error(`Horário inválido: ${hora}`);
  }
  const horas = Number(correspondencia[1]);
  const minutos = Number(correspondencia[2]);
  if (horas > 23 || minutos > 59) {
    throw new Error(`Horário inválido: ${hora}`);
  }
  return horas * 60 + minutos;
}

function diferencaDias(dataIso: string, referenciaIso: string): number {
  const milissegundos = dataUtc(dataIso).getTime() - dataUtc(referenciaIso).getTime();
  return Math.round(milissegundos / 86_400_000);
}

function minutosRelativos(
  turno: IntervaloTurno,
  referenciaIso: string,
): { inicio: number; fim: number } {
  const deslocamento = diferencaDias(turno.data, referenciaIso) * 1_440;
  const inicio = deslocamento + minutosHora(turno.inicio);
  let fim = deslocamento + minutosHora(turno.fim);
  if (turno.viraDia || fim <= inicio) {
    fim += 1_440;
  }
  return { inicio, fim };
}

function categoriaTrabalha(categoria: Categoria | undefined): boolean {
  return categoria === 'TRABALHO'
    || categoria === 'PLANTAO'
    || categoria === 'EXTRA';
}

function adicionarMeses(competencia: string, quantidade: number): string {
  const correspondencia = /^(\d{4})-(\d{2})$/u.exec(competencia);
  if (correspondencia === null) {
    throw new Error(`Competência inválida: ${competencia}`);
  }
  const data = new Date(Date.UTC(
    Number(correspondencia[1]),
    Number(correspondencia[2]) - 1 + quantidade,
    1,
  ));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dataIsoLocal(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function horaLocal(data = new Date()): string {
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

export function referenciaLocal(data = new Date()): ReferenciaTemporal {
  return { dataIso: dataIsoLocal(data), hora: horaLocal(data) };
}

export function adicionarDias(dataIso: string, quantidade: number): string {
  const data = dataUtc(dataIso);
  data.setUTCDate(data.getUTCDate() + quantidade);
  return data.toISOString().slice(0, 10);
}

export function competenciaOperacional(
  dataIso: string,
  diaCorte = 26,
): string {
  const { ano, mes, dia } = partesData(dataIso);
  const competenciaCalendario = `${ano}-${String(mes).padStart(2, '0')}`;
  return dia >= diaCorte
    ? adicionarMeses(competenciaCalendario, 1)
    : competenciaCalendario;
}

export function competenciasCandidatas(
  dataIso: string,
  diaCorte = 26,
): string[] {
  const operacional = competenciaOperacional(dataIso, diaCorte);
  const { ano, mes } = partesData(dataIso);
  const calendario = `${ano}-${String(mes).padStart(2, '0')}`;
  return [...new Set([
    operacional,
    calendario,
    adicionarMeses(operacional, -1),
    adicionarMeses(operacional, 1),
  ])];
}

export function formatarCompetencia(
  competencia: string,
  locale = 'pt-BR',
): string {
  const correspondencia = /^(\d{4})-(\d{2})$/u.exec(competencia);
  if (correspondencia === null) {
    return competencia;
  }
  const data = new Date(Date.UTC(
    Number(correspondencia[1]),
    Number(correspondencia[2]) - 1,
    1,
  ));
  const formatada = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(data);
  return formatada.charAt(0).toUpperCase() + formatada.slice(1);
}

export function formatarPeriodo(
  inicio: string,
  fim: string,
  locale = 'pt-BR',
): string {
  const inicioData = dataUtc(inicio);
  const fimData = dataUtc(fim);
  const mesmoAno = inicioData.getUTCFullYear() === fimData.getUTCFullYear();
  const formatadorInicio = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    ...(mesmoAno ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  });
  const formatadorFim = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatadorInicio.format(inicioData)} a ${formatadorFim.format(fimData)}`;
}

export function formatarData(
  dataIso: string,
  opcoes: Intl.DateTimeFormatOptions,
  locale = 'pt-BR',
): string {
  return new Intl.DateTimeFormat(locale, {
    ...opcoes,
    timeZone: 'UTC',
  }).format(dataUtc(dataIso));
}

export function selecionarEscalaPorData(
  escalas: readonly TurnosMes[],
  dataIso: string,
): TurnosMes | null {
  const noPeriodo = escalas.find(
    ({ periodoInicio, periodoFim }) =>
      periodoInicio <= dataIso && dataIso <= periodoFim,
  );
  if (noPeriodo !== undefined) {
    return noPeriodo;
  }

  const competencia = competenciaOperacional(dataIso);
  return escalas.find((escala) => escala.competencia === competencia)
    ?? [...escalas].sort((a, b) =>
      b.competencia.localeCompare(a.competencia))[0]
    ?? null;
}

export function resolverJornadaDia(
  documento: TurnosMes | null | undefined,
  catalogo: Record<string, TipoTurno>,
  dataIso: string,
): JornadaDia {
  const dia: Dia | undefined = documento?.dias[dataIso];
  if (dia === undefined) {
    return {
      data: dataIso,
      codigo: '',
      descricao: 'Sem escala publicada',
      categoria: 'SEM_ESCALA',
      duracaoMinutos: 0,
      viraDia: false,
      trabalha: false,
    };
  }

  const tipo = catalogo[dia.c];
  const inicio = dia.i ?? tipo?.horaInicio;
  const fim = dia.f ?? tipo?.horaFim;
  const duracaoMinutos = dia.m ?? tipo?.duracaoMinutos ?? 0;
  const trabalha = (duracaoMinutos > 0 || categoriaTrabalha(tipo?.categoria))
    && inicio !== undefined
    && fim !== undefined;

  return {
    data: dataIso,
    codigo: dia.c,
    descricao: tipo?.descricao ?? dia.c,
    categoria: tipo?.categoria ?? (trabalha ? 'TRABALHO' : 'SEM_ESCALA'),
    inicio,
    fim,
    duracaoMinutos,
    viraDia: tipo?.viraDia ?? (
      inicio !== undefined
      && fim !== undefined
      && minutosHora(fim) <= minutosHora(inicio)
    ),
    trabalha,
  };
}

export function resolverContextoJornada(
  documento: TurnosMes | null | undefined,
  catalogo: Record<string, TipoTurno>,
  referencia: ReferenciaTemporal,
): ContextoJornada {
  const hoje = resolverJornadaDia(documento, catalogo, referencia.dataIso);
  if (documento === null || documento === undefined) {
    return {
      referencia,
      hoje,
      estado: 'SEM_ESCALA',
      turnoAtual: null,
      proximoTurno: null,
    };
  }

  const agoraMinutos = minutosHora(referencia.hora);
  const intervalos = Object.keys(documento.dias)
    .sort()
    .map((data) => resolverJornadaDia(documento, catalogo, data))
    .filter((jornada): jornada is IntervaloTurno =>
      jornada.trabalha
      && jornada.inicio !== undefined
      && jornada.fim !== undefined);

  const turnoAtual = intervalos.find((turno) => {
    const intervalo = minutosRelativos(turno, referencia.dataIso);
    return intervalo.inicio <= agoraMinutos && agoraMinutos < intervalo.fim;
  }) ?? null;

  const proximoTurno = intervalos.find((turno) =>
    minutosRelativos(turno, referencia.dataIso).inicio > agoraMinutos) ?? null;

  let estado: EstadoJornada;
  if (turnoAtual !== null) {
    estado = 'EM_ANDAMENTO';
  } else if (!hoje.trabalha || hoje.inicio === undefined || hoje.fim === undefined) {
    estado = 'NAO_TRABALHA_HOJE';
  } else {
    const intervaloHoje = minutosRelativos(
      hoje as IntervaloTurno,
      referencia.dataIso,
    );
    estado = intervaloHoje.inicio > agoraMinutos
      ? 'AGENDADO_HOJE'
      : 'ENCERRADO_HOJE';
  }

  return {
    referencia,
    hoje,
    estado,
    turnoAtual,
    proximoTurno,
  };
}
