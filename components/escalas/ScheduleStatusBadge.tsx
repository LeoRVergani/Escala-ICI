/**
 * Fase ESCALAS-UX-2A.1 — status contextual compacto (§ 17/§ 18 do
 * redesign): reaproveita `.status-badge` (já existente, variantes
 * `success`/`warning`/`neutral` já no Design System — nenhuma classe
 * nova). Nunca vira dropdown editável — só um badge informativo; texto
 * sempre visível (nunca só cor), para acessibilidade. `'publicada'` só
 * aparece quando o dado já existente indicar isso (Jornada) — nunca uma
 * funcionalidade nova de publicação para Plantão (PLANTÃO-3C).
 */
export type StatusContextoEscala = 'rascunho' | 'publicada' | 'sem-escala';

export interface ScheduleStatusBadgeProps {
  status: StatusContextoEscala | null;
}

const ROTULOS: Record<StatusContextoEscala, string> = {
  rascunho: 'Rascunho',
  publicada: 'Publicada',
  'sem-escala': 'Sem escala',
};

const VARIANTES: Record<StatusContextoEscala, string> = {
  rascunho: 'warning',
  publicada: 'success',
  'sem-escala': 'neutral',
};

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
  if (status === null) {
    return null;
  }
  return (
    <div className="escala-status-control">
      <span>Status</span>
      <span className={`status-badge ${VARIANTES[status]}`}>{ROTULOS[status]}</span>
    </div>
  );
}
