import type { TipoLembrete } from '@/lib/lembretes';

/** Distinção visual mínima entre origem pessoal/atribuída — nunca o texto completo "Lembrete atribuído pelo gestor" num badge (isso fica no detalhe). */
export function LembreteBadge({ tipo }: { tipo: TipoLembrete }) {
  return tipo === 'PESSOAL'
    ? <span className="status-badge neutral">Pessoal</span>
    : <span className="status-badge primary">Gestor</span>;
}
