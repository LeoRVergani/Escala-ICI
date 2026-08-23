/**
 * Fase ESCALAS-UX-2A.1 — status contextual compacto (§ 17/§ 18 do
 * redesign): reaproveita `.status-badge` (já existente, variantes
 * `success`/`warning`/`neutral` já no Design System — nenhuma classe
 * nova). Nunca vira dropdown editável — só um badge informativo; texto
 * sempre visível (nunca só cor), para acessibilidade.
 *
 * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — os 4 valores espelham
 * `StatusOperacaoDashboard` (`lib/operacoesDashboard.ts`), a única função
 * de derivação de status do Dashboard: este badge nunca calcula status por
 * conta própria, só formata o que já veio de lá.
 */
export type StatusContextoEscala = 'rascunho' | 'publicada' | 'publicada-com-rascunho-pendente' | 'sem-escala';

export interface ScheduleStatusBadgeProps {
  status: StatusContextoEscala | null;
}

const ROTULOS: Record<StatusContextoEscala, string> = {
  rascunho: 'Rascunho',
  publicada: 'Publicada',
  'publicada-com-rascunho-pendente': 'Publicada (rascunho pendente)',
  'sem-escala': 'Sem escala',
};

const VARIANTES: Record<StatusContextoEscala, string> = {
  rascunho: 'warning',
  publicada: 'success',
  'publicada-com-rascunho-pendente': 'warning',
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
