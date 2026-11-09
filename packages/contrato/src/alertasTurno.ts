/**
 * ALERTAS-TURNO-1 — preferências dos avisos do turno de cada pessoa (Perfil do App).
 * Documento: preferenciasAlertasTurno/{login}. Lido pelo push-worker, que envia
 * a notificação na hora certa a partir da escala PUBLICADA do dia (só em dia
 * de trabalho, com o horário real — HE, trocas, turno que passa da meia-noite).
 */
export const PERIODOS_ALERTA_TURNO = ['MD', 'M', 'T', 'N'] as const;
export type PeriodoAlertaTurno = (typeof PERIODOS_ALERTA_TURNO)[number];

export const OPCOES_AVISO_ANTES_MINUTOS = [30, 60, 120] as const;
export const OPCOES_DURACAO_INTERVALO_MINUTOS = [10, 15, 20, 30] as const;

export interface PreferenciasAlertasTurno {
  login: string;
  /** "Você trabalha hoje", X minutos antes do início do turno. */
  avisoAntes: { ativo: boolean; minutos: number };
  /** "Bata o ponto de entrada", no horário de início. */
  pontoEntrada: { ativo: boolean };
  /** "Bata o ponto de saída", no horário de término. */
  pontoSaida: { ativo: boolean };
  /** Intervalo: um horário por TURNO que a pessoa faz + duração (aviso de início e de fim). */
  intervalo: { ativo: boolean; duracaoMinutos: number; horarios: Partial<Record<PeriodoAlertaTurno, string>> };
  atualizadoEm: string;
}

export function preferenciasAlertasTurnoPadrao(login: string): PreferenciasAlertasTurno {
  return {
    login,
    avisoAntes: { ativo: true, minutos: 60 },
    pontoEntrada: { ativo: true },
    pontoSaida: { ativo: true },
    intervalo: { ativo: false, duracaoMinutos: 15, horarios: {} },
    atualizadoEm: '',
  };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/u;

function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function deMinutos(total: number): string {
  const normalizado = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizado / 60)).padStart(2, '0')}:${String(normalizado % 60).padStart(2, '0')}`;
}

/** Duração do turno em minutos (turno que passa da meia-noite termina no dia seguinte). */
function duracaoTurno(inicio: string, fim: string): number {
  const d = paraMinutos(fim) - paraMinutos(inicio);
  return d > 0 ? d : d + 1440;
}

/** Sugestão de intervalo: o meio do turno, arredondado para 15 minutos. */
export function sugerirHorarioIntervalo(inicio: string, fim: string): string {
  const meio = paraMinutos(inicio) + duracaoTurno(inicio, fim) / 2;
  return deMinutos(Math.round(meio / 15) * 15);
}

/** O horário escolhido cai dentro do turno (considerando a virada da meia-noite)? */
export function horarioDentroDoTurno(horario: string, inicio: string, fim: string): boolean {
  if (!HORA.test(horario)) return false;
  const deslocamento = (paraMinutos(horario) - paraMinutos(inicio) + 1440) % 1440;
  return deslocamento > 0 && deslocamento < duracaoTurno(inicio, fim);
}

/** Mesmas regras que o Firestore aplica (firestore.rules → preferenciasAlertasTurno). */
export function validarPreferenciasAlertasTurno(preferencias: PreferenciasAlertasTurno): string[] {
  const erros: string[] = [];
  if (!Number.isInteger(preferencias.avisoAntes.minutos) || preferencias.avisoAntes.minutos < 15 || preferencias.avisoAntes.minutos > 240) {
    erros.push('Aviso antes do turno deve ficar entre 15 minutos e 4 horas.');
  }
  const duracao = preferencias.intervalo.duracaoMinutos;
  if (!Number.isInteger(duracao) || duracao < 5 || duracao > 120) {
    erros.push('A duração do intervalo deve ficar entre 5 e 120 minutos.');
  }
  for (const [periodo, horario] of Object.entries(preferencias.intervalo.horarios)) {
    if (!(PERIODOS_ALERTA_TURNO as readonly string[]).includes(periodo)) erros.push(`Turno desconhecido: ${periodo}.`);
    if (typeof horario !== 'string' || !HORA.test(horario)) erros.push(`Horário de intervalo inválido (${periodo}).`);
  }
  return erros;
}
