'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatarCompetencia, formatarData } from '@escala-ici/contrato';

/**
 * Fase ESCALAS-UX-2A.1 — controle real de competência no header
 * (`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 14/§ 15), substituindo a
 * string estática anterior. O rótulo amigável ("Agosto 2026") vem de
 * `formatarCompetencia()` (já existente, `@escala-ici/contrato`); o
 * período 26→25 vem de `periodoInicio`/`periodoFim` já calculados pelo
 * chamador via `periodoDaCompetencia()` (nunca duplicado aqui). A seleção
 * real usa um `&lt;input type="month"&gt;` nativo DENTRO do popover — mantém
 * o rótulo formatado em pt-BR sempre visível no gatilho (o texto de um
 * input nativo segue o locale do navegador/SO, não garantidamente pt-BR),
 * sem abrir mão de um controle de formulário real e acessível.
 */
export interface ScheduleCompetenceControlProps {
  competencia: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  onMudarCompetencia: (novaCompetencia: string) => void;
}

export function ScheduleCompetenceControl({
  competencia,
  periodoInicio,
  periodoFim,
  onMudarCompetencia,
}: ScheduleCompetenceControlProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) {
      return undefined;
    }
    function fecharAoClicarFora(evento: PointerEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAberto(false);
        gatilhoRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEscape);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEscape);
    };
  }, [aberto]);

  const desabilitado = competencia === null;

  return (
    <div className="escala-competencia-control" ref={containerRef}>
      <span>Competência</span>
      <button
        ref={gatilhoRef}
        type="button"
        className={`escala-context-trigger ${aberto ? 'open' : ''}`}
        disabled={desabilitado}
        onClick={() => setAberto((atual) => !atual)}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <strong>{competencia === null ? 'Selecione uma escala' : formatarCompetencia(competencia)}</strong>
        <ChevronDown size={16} />
      </button>
      {periodoInicio !== null && periodoFim !== null && (
        <p className="escala-competencia-periodo">
          {formatarData(periodoInicio, { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {' → '}
          {formatarData(periodoFim, { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
      )}
      {aberto && competencia !== null && (
        <div className="escala-context-popover escala-competencia-popover" role="menu" aria-label="Selecionar competência">
          <label htmlFor="escala-competencia-input">Escolher mês</label>
          <input
            id="escala-competencia-input"
            type="month"
            value={competencia}
            onChange={(evento) => {
              if (evento.target.value !== '') {
                setAberto(false);
                onMudarCompetencia(evento.target.value);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
