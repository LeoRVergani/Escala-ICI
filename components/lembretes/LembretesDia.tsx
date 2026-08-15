import { formatarData } from '@escala-ici/contrato';
import { Bell, Plus } from 'lucide-react';

import {
  capitalizarPrimeiraLetra,
  type GrupoLembretesPorData,
  type ItemLembreteUnificado,
} from '@/lib/lembretesUi';
import { LembreteCard } from './LembreteCard';

export function LembretesDia({
  data,
  dataHoje,
  itens,
  proximos,
  onNovoLembrete,
  onSelecionarItem,
}: {
  data: string;
  dataHoje: string;
  itens: ItemLembreteUnificado[];
  proximos: GrupoLembretesPorData<ItemLembreteUnificado>[];
  onNovoLembrete: () => void;
  onSelecionarItem: (item: ItemLembreteUnificado) => void;
}) {
  return (
    <aside className="panel selected-day-card lembretes-day-panel" aria-live="polite">
      <div className="selected-day-date">
        <small>{data === dataHoje ? 'Hoje' : 'Dia selecionado'}</small>
        <strong>{capitalizarPrimeiraLetra(formatarData(data, { weekday: 'long' }))}</strong>
        <span>{formatarData(data, { day: '2-digit', month: 'long' })}</span>
      </div>

      <div className="lembretes-lista-dia">
        {itens.length === 0 ? (
          <div className="notification-empty">
            <Bell size={22} />
            <span>Nenhum lembrete neste dia.</span>
          </div>
        ) : itens.map((item) => (
          <LembreteCard key={item.lembreteId} item={item} onSelecionar={() => onSelecionarItem(item)} />
        ))}
      </div>

      <button type="button" className="secondary-button lembretes-novo-button" onClick={onNovoLembrete}>
        <Plus size={15} /> Novo lembrete
      </button>

      {proximos.length > 0 && (
        <div className="lembretes-proximos">
          <p className="schedule-legend-title">Próximos lembretes</p>
          {proximos.map((grupo) => (
            <div key={grupo.data} className="lembretes-proximos-dia">
              <small>
                {capitalizarPrimeiraLetra(formatarData(grupo.data, { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', ''))}
              </small>
              <div className="lembretes-proximos-itens">
                {grupo.itens.map((item) => (
                  <LembreteCard
                    key={item.lembreteId}
                    item={item}
                    compacto
                    onSelecionar={() => onSelecionarItem(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
