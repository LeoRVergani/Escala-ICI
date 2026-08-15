import { adicionarDias, formatarData } from '@escala-ici/contrato';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import {
  mesAdjacente,
  mesDeData,
  primeiroDiaDoMes,
  tituloMesLembretes,
  ultimoDiaDoMes,
} from '@/lib/lembretesUi';

function diasDoMes(mes: string): string[] {
  const inicio = primeiroDiaDoMes(mes);
  const fim = ultimoDiaDoMes(mes);
  const dias: string[] = [];
  let cursor = inicio;
  while (cursor <= fim) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

function rotuloIndicador(contagem: number): string | null {
  if (contagem <= 0) {
    return null;
  }
  return contagem === 1 ? '•' : `• ${contagem}`;
}

export function LembretesCalendario({
  mesVisivel,
  dataHoje,
  dataSelecionada,
  contagemPorData,
  onSelecionarDia,
  onMudarMes,
}: {
  mesVisivel: string;
  dataHoje: string;
  dataSelecionada: string;
  contagemPorData: Map<string, number>;
  onSelecionarDia: (data: string) => void;
  onMudarMes: (mes: string) => void;
}) {
  const dias = diasDoMes(mesVisivel);
  const espacosIniciais = new Date(`${dias[0]}T12:00:00Z`).getUTCDay();
  const espacosFinais = (7 - ((espacosIniciais + dias.length) % 7)) % 7;

  return (
    <div className="lembretes-calendario">
      <header className="lembretes-calendario-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => onMudarMes(mesAdjacente(mesVisivel, -1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <strong>{tituloMesLembretes(mesVisivel)}</strong>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMudarMes(mesAdjacente(mesVisivel, 1))}
          aria-label="Mês seguinte"
        >
          <ChevronRight size={16} />
        </button>
        {mesVisivel !== mesDeData(dataHoje) && (
          <button
            type="button"
            className="today-back-to-today"
            onClick={() => onMudarMes(mesDeData(dataHoje))}
          >
            <CalendarDays size={13} /> Hoje
          </button>
        )}
      </header>
      <div className="calendar-weekdays" aria-hidden="true">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}
      </div>
      <div className="lembretes-grid" role="grid" aria-label="Calendário de lembretes">
        {Array.from({ length: espacosIniciais }, (_, indice) => (
          <span className="lembretes-grid-blank" key={`blank-${indice}`} aria-hidden="true" />
        ))}
        {dias.map((data) => {
          const contagem = contagemPorData.get(data) ?? 0;
          const indicador = rotuloIndicador(contagem);
          const ehHoje = data === dataHoje;
          const ehSelecionado = data === dataSelecionada;
          return (
            <button
              key={data}
              type="button"
              className={[ehHoje ? 'today' : '', ehSelecionado ? 'selected' : ''].filter(Boolean).join(' ')}
              onClick={() => onSelecionarDia(data)}
              aria-current={ehHoje ? 'date' : undefined}
              aria-pressed={ehSelecionado}
              aria-label={`${formatarData(data, { weekday: 'long', day: '2-digit', month: 'long' })}${
                contagem > 0 ? `, ${contagem} lembrete(s)` : ''
              }`}
            >
              <span>{formatarData(data, { day: 'numeric' })}</span>
              {indicador && <small className="lembrete-indicador">{indicador}</small>}
            </button>
          );
        })}
        {Array.from({ length: espacosFinais }, (_, indice) => (
          <span className="lembretes-grid-blank" key={`end-blank-${indice}`} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
