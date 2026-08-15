import {
  CATALOGO_SOC,
  adicionarDias,
  formatarData,
  resolverJornadaDia,
  type TurnosMes,
} from '@escala-ici/contrato';
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

export function LembretesCalendario({
  mesVisivel,
  dataHoje,
  dataSelecionada,
  contagemPorData,
  escala,
  catalogo,
  onSelecionarDia,
  onMudarMes,
}: {
  mesVisivel: string;
  dataHoje: string;
  dataSelecionada: string;
  contagemPorData: Map<string, number>;
  /**
   * Contexto de escala do próprio usuário, já carregado por
   * `EmployeeApp.tsx` (`minhaEscala`/`catalogo`) — mesmo contrato de
   * `CalendarioEscala`/`AgendaEscala`. Nenhuma leitura Firebase nova: só
   * `resolverJornadaDia()` sobre dado que já existe em memória.
   */
  escala: TurnosMes | null;
  catalogo: typeof CATALOGO_SOC;
  onSelecionarDia: (data: string) => void;
  onMudarMes: (mes: string) => void;
}) {
  const dias = diasDoMes(mesVisivel);
  const espacosIniciais = new Date(`${dias[0]}T12:00:00Z`).getUTCDay();
  const espacosFinais = (7 - ((espacosIniciais + dias.length) % 7)) % 7;

  return (
    <div className="lembretes-calendario">
      <header className="lembretes-calendario-header">
        <div className="lembretes-calendario-nav">
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
        </div>
        {/* Sempre presente (nunca condicional) — evita layout shift no
            resto do cabeçalho; "desabilitado" no mês atual em vez de
            sumir. Botão de verdade (secondary + compact-button), não um
            link de texto solto perto das setas. */}
        <div className="lembretes-calendario-hoje">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => onMudarMes(mesDeData(dataHoje))}
            disabled={mesVisivel === mesDeData(dataHoje)}
          >
            <CalendarDays size={13} /> Hoje
          </button>
        </div>
      </header>
      <div className="calendar-weekdays" aria-hidden="true">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}
      </div>
      <div className="lembretes-grid" role="grid" aria-label="Calendário de lembretes">
        {Array.from({ length: espacosIniciais }, (_, indice) => (
          <span className="lembretes-grid-blank" key={`blank-${indice}`} aria-hidden="true" />
        ))}
        {dias.map((data) => {
          const temLembrete = (contagemPorData.get(data) ?? 0) > 0;
          // Só o código real do catálogo (M/T/N/MD/DF/DU/BH/X/...) — jornada
          // vazia (`codigo === ''`, sentinela de `resolverJornadaDia` para
          // "sem escala nesse dia") não renderiza nada, nunca um "—"/"?"
          // inventado.
          const jornada = resolverJornadaDia(escala, catalogo, data);
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
                jornada.codigo ? `, ${jornada.descricao}` : ''
              }${temLembrete ? ', com lembrete' : ''}`}
            >
              <span>{formatarData(data, { day: 'numeric' })}</span>
              <span className="lembretes-grid-meta">
                {jornada.codigo && (
                  <strong className="shift-chip" data-code={jornada.codigo}>{jornada.codigo}</strong>
                )}
                {temLembrete && <i className="lembrete-indicador" aria-hidden="true" />}
              </span>
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
