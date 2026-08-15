import { Clock3 } from 'lucide-react';

import { rotuloHorarioLembrete, rotuloViraDia, type ItemLembreteUnificado } from '@/lib/lembretesUi';
import { LembreteBadge } from './LembreteBadge';

export function LembreteCard({
  item,
  onSelecionar,
}: {
  item: ItemLembreteUnificado;
  onSelecionar: () => void;
}) {
  const viraDia = rotuloViraDia(item.horario);
  return (
    <button type="button" className="lembrete-card" onClick={onSelecionar}>
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
