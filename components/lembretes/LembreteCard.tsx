import { Clock3 } from 'lucide-react';

import { rotuloHorarioLembrete, rotuloViraDia, type ItemLembreteUnificado } from '@/lib/lembretesUi';
import { LembreteBadge } from './LembreteBadge';

/**
 * Mesma família visual em dois tamanhos — nunca uma classe de chip/tag de
 * outro módulo. `compacto` é usado por "Próximos lembretes" (LembretesDia):
 * mesmo componente, mesma estrutura (título + horário + badge), só menor.
 */
export function LembreteCard({
  item,
  onSelecionar,
  compacto = false,
}: {
  item: ItemLembreteUnificado;
  onSelecionar: () => void;
  compacto?: boolean;
}) {
  const viraDia = rotuloViraDia(item.horario);
  return (
    <button
      type="button"
      className={compacto ? 'lembrete-card lembrete-card-compacto' : 'lembrete-card'}
      onClick={onSelecionar}
    >
      <div className="lembrete-card-info">
        <strong>{item.titulo}</strong>
        <small>
          <Clock3 size={12} /> {rotuloHorarioLembrete(item.horario)}
          {viraDia ? ` · ${viraDia}` : ''}
        </small>
      </div>
      <LembreteBadge tipo={item.tipo} />
    </button>
  );
}
