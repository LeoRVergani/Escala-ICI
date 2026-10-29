import type { Dia, TipoTurno } from './tipos.js';

/**
 * HOTFIX-HE-TURNO-1 — Hora Extra com turno.
 *
 * Na planilha, a célula do dia na aba "Escalistas" diz só `HE`; o período
 * real (Madrugada/Manhã/Tarde/Noite) aparece na aba "Escala". Sem esse
 * período o App mostrava "Hora Extra — sem horário de trabalho", e o
 * colaborador não sabia em que horário ia trabalhar.
 *
 * O dia continua com `c: 'HE'` (os totais seguem contando Hora Extra, e
 * `m` NÃO é preenchido para não somar a HE nas horas de jornada regular —
 * mesmo critério de "Dias trabalhados" do Controle de Plantão), mas ganha
 * `t` + horário do turno em que a HE acontece.
 */
export function criarDiaHoraExtra(extra: TipoTurno, turno: TipoTurno): Dia {
  if (turno.horaInicio === undefined || turno.horaFim === undefined) {
    return { c: extra.codigo.toUpperCase() };
  }
  return {
    c: extra.codigo.toUpperCase(),
    t: turno.codigo.toUpperCase(),
    i: turno.horaInicio,
    f: turno.horaFim,
    vd: turno.viraDia,
  };
}

/**
 * Código usado para cor/ícone do dia: o turno real (`t`) quando é Hora
 * Extra com turno, senão o próprio código do dia.
 */
export function codigoPeriodoDia(dia: Pick<Dia, 'c' | 't'> | undefined): string {
  if (dia === undefined) {
    return '';
  }
  return dia.t ?? dia.c;
}
