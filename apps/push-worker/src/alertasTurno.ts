/**
 * ALERTAS-TURNO-2 — agendador dos "Avisos do turno" (Perfil do App).
 *
 * A cada minuto, para cada pessoa com preferências salvas
 * (preferenciasAlertasTurno/{login}), calcula os avisos de HOJE e de ONTEM
 * (turno da noite: saída/intervalo depois da meia-noite) a partir da escala
 * PUBLICADA e envia os que venceram — UMA vez cada (reserva atômica em
 * alertasTurnoEnviados/{login}_{data}_{tipo}_{quando}). Só em dia de trabalho, com o
 * horário real (HE com turno, trocas já aplicadas). Respeita PUSH_ENABLED.
 */

export const FUSO_ALERTAS = 'America/Sao_Paulo';
/** Aviso vencido há mais que isso (ex.: worker parado) é descartado. */
export const JANELA_ATRASO_MINUTOS = 5;

// ---------------------------------------------------------------------------
// Jornada do dia — cópia MÍNIMA de @escala-ici/contrato#resolverJornadaDia (o
// push-worker não depende do contrato). A paridade com a original é garantida
// por teste (test/alertasTurno.test.ts): se a original mudar, o teste quebra.
export interface TipoTurnoMin {
  categoria?: string;
  horaInicio?: string;
  horaFim?: string;
  duracaoMinutos?: number;
  viraDia?: boolean;
  descricao?: string;
}

export interface DiaMin {
  c: string;
  i?: string;
  f?: string;
  m?: number;
  t?: string;
}

export const CATALOGO_PADRAO: Readonly<Record<string, TipoTurnoMin>> = {
  MD: { categoria: 'TRABALHO', horaInicio: '01:00', horaFim: '07:00', duracaoMinutos: 360, viraDia: false, descricao: 'Madrugada' },
  M: { categoria: 'TRABALHO', horaInicio: '07:00', horaFim: '13:00', duracaoMinutos: 360, viraDia: false, descricao: 'Manhã' },
  T: { categoria: 'TRABALHO', horaInicio: '13:00', horaFim: '19:00', duracaoMinutos: 360, viraDia: false, descricao: 'Tarde' },
  N: { categoria: 'TRABALHO', horaInicio: '19:00', horaFim: '01:00', duracaoMinutos: 360, viraDia: true, descricao: 'Noite' },
  X: { categoria: 'AUSENCIA', duracaoMinutos: 0, viraDia: false, descricao: 'Férias' },
  DF: { categoria: 'DESCANSO', duracaoMinutos: 0, viraDia: false, descricao: 'DSR - Final de Semana' },
  DU: { categoria: 'DESCANSO', duracaoMinutos: 0, viraDia: false, descricao: 'DSR - Dia útil' },
  BH: { categoria: 'COMPENSACAO', duracaoMinutos: 0, viraDia: false, descricao: 'Compensação BH' },
  FOLGA: { categoria: 'DESCANSO', duracaoMinutos: 0, viraDia: false, descricao: 'Folga - Feriado' },
  AN: { categoria: 'DESCANSO', duracaoMinutos: 0, viraDia: false, descricao: 'Folga Aniversário' },
  HE: { categoria: 'EXTRA', duracaoMinutos: 0, viraDia: false, descricao: 'Hora Extra' },
  AFA: { categoria: 'AUSENCIA', duracaoMinutos: 0, viraDia: false, descricao: 'Afastamento Atestado' },
};

export interface TurnoDoDia {
  trabalha: boolean;
  inicio?: string | undefined;
  fim?: string | undefined;
  periodo: string;
  viraDia: boolean;
  descricao: string;
}

function minutosHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function categoriaTrabalha(categoria: string | undefined): boolean {
  return categoria === 'TRABALHO' || categoria === 'PLANTAO' || categoria === 'EXTRA';
}

export function resolverTurnoDoDia(
  dias: Readonly<Record<string, DiaMin>> | undefined,
  catalogo: Readonly<Record<string, TipoTurnoMin>>,
  data: string,
): TurnoDoDia {
  const dia = dias?.[data];
  if (dia === undefined) {
    return { trabalha: false, periodo: '', viraDia: false, descricao: 'Sem escala publicada' };
  }
  const tipo = catalogo[dia.c];
  const horaExtra = tipo?.categoria === 'EXTRA';
  const turnoBase = horaExtra && dia.t !== undefined ? catalogo[dia.t] : undefined;
  const inicio = dia.i ?? turnoBase?.horaInicio ?? tipo?.horaInicio;
  const fim = dia.f ?? turnoBase?.horaFim ?? tipo?.horaFim;
  const duracao = dia.m ?? (turnoBase !== undefined ? turnoBase.duracaoMinutos : undefined) ?? tipo?.duracaoMinutos ?? 0;
  const trabalha = (duracao > 0 || categoriaTrabalha(tipo?.categoria)) && inicio !== undefined && fim !== undefined;
  const descricaoBase = tipo?.descricao ?? dia.c;
  return {
    trabalha,
    inicio,
    fim,
    periodo: horaExtra && dia.t !== undefined ? dia.t : dia.c,
    viraDia: turnoBase?.viraDia ?? tipo?.viraDia ?? (inicio !== undefined && fim !== undefined && minutosHora(fim) <= minutosHora(inicio)),
    descricao: horaExtra && dia.t !== undefined ? `${turnoBase?.descricao ?? dia.t} · ${descricaoBase}` : descricaoBase,
  };
}

// ---------------------------------------------------------------------------
// Preferências (formato de @escala-ici/contrato — ALERTAS-TURNO-1)
export interface PreferenciasAlertas {
  login: string;
  avisoAntes: { ativo: boolean; minutos: number };
  pontoEntrada: { ativo: boolean };
  pontoSaida: { ativo: boolean };
  intervalo: { ativo: boolean; duracaoMinutos: number; horarios: Partial<Record<string, string>> };
}

export type TipoAlertaTurno =
  | 'ALERTA_TURNO_ANTES'
  | 'ALERTA_TURNO_ENTRADA'
  | 'ALERTA_TURNO_INTERVALO'
  | 'ALERTA_TURNO_FIM_INTERVALO'
  | 'ALERTA_TURNO_SAIDA';

export interface AlertaAgendado {
  tipo: TipoAlertaTurno;
  /** Dia do turno (a quem o aviso pertence), AAAA-MM-DD. */
  data: string;
  /** Momento local (fuso de Brasília) do aviso: "AAAA-MM-DDTHH:MM". */
  quando: string;
  titulo: string;
  corpo: string;
}

// Datas/horas locais como texto "AAAA-MM-DDTHH:MM", comparadas em minutos.
export function minutosLocais(momento: string): number {
  const [data, hora] = momento.split('T');
  const [a, m, d] = (data ?? '').split('-').map(Number);
  return Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1) / 60_000 + minutosHora(hora ?? '00:00');
}

function momentoDeMinutos(total: number): string {
  return new Date(total * 60_000).toISOString().slice(0, 16);
}

export function somarDias(data: string, dias: number): string {
  return momentoDeMinutos(minutosLocais(`${data}T00:00`) + dias * 1440).slice(0, 10);
}

/** "Agora" no fuso de Brasília, como "AAAA-MM-DDTHH:MM". */
export function agoraLocal(instante: Date = new Date(), fuso: string = FUSO_ALERTAS): string {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante).map((parte) => [parte.type, parte.value]));
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

function rotuloMinutos(minutos: number): string {
  if (minutos % 60 === 0) return `${minutos / 60} h`;
  return minutos > 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
}

/** Avisos de UM turno (o dia `data`), conforme as preferências da pessoa. */
export function alertasDoTurno(preferencias: PreferenciasAlertas, data: string, turno: TurnoDoDia): AlertaAgendado[] {
  if (!turno.trabalha || turno.inicio === undefined || turno.fim === undefined) return [];
  const inicio = `${data}T${turno.inicio}`;
  const viraDia = turno.viraDia || minutosHora(turno.fim) <= minutosHora(turno.inicio);
  const fim = `${viraDia ? somarDias(data, 1) : data}T${turno.fim}`;
  const horario = `${turno.inicio} - ${turno.fim}`;
  const alertas: AlertaAgendado[] = [];

  if (preferencias.avisoAntes.ativo) {
    alertas.push({
      tipo: 'ALERTA_TURNO_ANTES', data,
      quando: momentoDeMinutos(minutosLocais(inicio) - preferencias.avisoAntes.minutos),
      titulo: 'Você trabalha hoje',
      corpo: `${turno.descricao} · ${horario}. Seu turno começa em ${rotuloMinutos(preferencias.avisoAntes.minutos)}.`,
    });
  }
  if (preferencias.pontoEntrada.ativo) {
    alertas.push({
      tipo: 'ALERTA_TURNO_ENTRADA', data, quando: inicio,
      titulo: 'Hora de bater o ponto de entrada',
      corpo: `Seu turno de ${turno.descricao} começa agora (${turno.inicio}).`,
    });
  }
  const horaIntervalo = preferencias.intervalo.horarios[turno.periodo];
  if (preferencias.intervalo.ativo && horaIntervalo) {
    // O intervalo depois da meia-noite (turno da noite) cai no dia seguinte.
    const inicioIntervalo = `${minutosHora(horaIntervalo) < minutosHora(turno.inicio) ? somarDias(data, 1) : data}T${horaIntervalo}`;
    const dentro = minutosLocais(inicioIntervalo) > minutosLocais(inicio) && minutosLocais(inicioIntervalo) < minutosLocais(fim);
    if (dentro) {
      const fimIntervalo = momentoDeMinutos(minutosLocais(inicioIntervalo) + preferencias.intervalo.duracaoMinutos);
      alertas.push({
        tipo: 'ALERTA_TURNO_INTERVALO', data, quando: inicioIntervalo,
        titulo: 'Hora do intervalo',
        corpo: `Aproveite seus ${preferencias.intervalo.duracaoMinutos} minutos. Volte às ${fimIntervalo.slice(11)}.`,
      });
      alertas.push({
        tipo: 'ALERTA_TURNO_FIM_INTERVALO', data, quando: fimIntervalo,
        titulo: 'Fim do intervalo',
        corpo: `Seus ${preferencias.intervalo.duracaoMinutos} minutos de intervalo acabaram.`,
      });
    }
  }
  if (preferencias.pontoSaida.ativo) {
    alertas.push({
      tipo: 'ALERTA_TURNO_SAIDA', data, quando: fim,
      titulo: 'Hora de bater o ponto de saída',
      corpo: `Seu turno de ${turno.descricao} termina agora (${turno.fim}). Bom descanso!`,
    });
  }
  return alertas;
}

/** Os avisos que venceram agora (até JANELA_ATRASO_MINUTOS de atraso). */
export function alertasDevidos(alertas: readonly AlertaAgendado[], agora: string, janela = JANELA_ATRASO_MINUTOS): AlertaAgendado[] {
  const agoraMin = minutosLocais(agora);
  return alertas.filter((alerta) => {
    const quando = minutosLocais(alerta.quando);
    return quando <= agoraMin && quando > agoraMin - janela;
  });
}

/** Competência operacional (dia 26 em diante = mês seguinte), como no contrato. */
export function competenciaDaData(data: string): string {
  const [a, m, d] = data.split('-').map(Number);
  let ano = a ?? 1970;
  let mes = m ?? 1;
  if ((d ?? 1) >= 26) {
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Envio de UM aviso, uma única vez (dependências injetadas → testável).
export interface DependenciasEnvio {
  /** Cria o registro do aviso; false se ele já existia (já enviado/reservado). */
  reservar(id: string, dados: Record<string, unknown>): Promise<boolean>;
  listarDispositivos(login: string): Promise<Array<{ deviceId: string; fid: string }>>;
  enviar(mensagem: { fids: string[]; data: Record<string, string> }): Promise<{
    successCount: number; failureCount: number; responses: Array<{ success: boolean; errorCode: string | null }>;
  }>;
  desativarDispositivo(deviceId: string): Promise<void>;
  finalizar(id: string, dados: Record<string, unknown>): Promise<void>;
  codigosFidInvalido: ReadonlySet<string>;
}

export type ResultadoAlerta = 'ja-enviado' | 'sem-dispositivo' | 'enviado' | 'falhou';

/**
 * ALERTAS-TURNO-3 — o horário do aviso faz parte da identidade: se a pessoa
 * MUDA o horário (ex.: intervalo de 22:00 para 22:30), o novo aviso é outro e
 * sai; o mesmo aviso no mesmo horário continua saindo uma única vez.
 * (Antes era login+dia+tipo: um segundo horário no mesmo dia nunca saía.)
 */
export function idDoAlerta(login: string, alerta: Pick<AlertaAgendado, 'data' | 'tipo' | 'quando'>): string {
  return `${login}_${alerta.data}_${alerta.tipo}_${alerta.quando.replace(/[-:T]/gu, '')}`;
}

export async function enviarAlertaUmaVez(
  login: string,
  alerta: AlertaAgendado,
  deps: DependenciasEnvio,
  agoraIso: string,
): Promise<ResultadoAlerta> {
  const id = idDoAlerta(login, alerta);
  const reservado = await deps.reservar(id, {
    login, tipo: alerta.tipo, data: alerta.data, quando: alerta.quando, status: 'ENVIANDO', criadoEm: agoraIso,
  });
  if (!reservado) return 'ja-enviado';
  const dispositivos = await deps.listarDispositivos(login);
  if (dispositivos.length === 0) {
    await deps.finalizar(id, { status: 'SEM_DISPOSITIVO', finalizadoEm: agoraIso });
    return 'sem-dispositivo';
  }
  const resultado = await deps.enviar({
    fids: dispositivos.map((dispositivo) => dispositivo.fid),
    data: { eventId: id, tipo: alerta.tipo, route: 'hoje', titulo: alerta.titulo, corpo: alerta.corpo },
  });
  for (const [indice, resposta] of resultado.responses.entries()) {
    if (!resposta.success && resposta.errorCode && deps.codigosFidInvalido.has(resposta.errorCode)) {
      const dispositivo = dispositivos[indice];
      if (dispositivo) await deps.desativarDispositivo(dispositivo.deviceId);
    }
  }
  const enviado = resultado.successCount > 0;
  await deps.finalizar(id, {
    status: enviado ? 'ENVIADO' : 'FALHOU',
    successCount: resultado.successCount,
    failureCount: resultado.failureCount,
    finalizadoEm: agoraIso,
  });
  return enviado ? 'enviado' : 'falhou';
}
