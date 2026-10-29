import type { TipoTurno } from '@escala-ici/contrato';

/** Ordem/subconjunto padrão — os códigos que sempre existiram na legenda da escala. */
const CODIGOS_LEGENDA_PADRAO = ['MD', 'M', 'T', 'N', 'X', 'DF', 'DU', 'BH'];

interface ScheduleLegendProps {
  catalogo: Record<string, TipoTurno>;
  titulo?: string;
  codigos?: string[];
  className?: string;
}

/**
 * Legenda dos códigos de turno (chip + descrição), reaproveitada pelo
 * Dashboard e pelo App — mesmas cores de `.shift-chip[data-code]` já
 * usadas na grade/calendário, nenhum token novo.
 */
export function ScheduleLegend({
  catalogo,
  titulo = 'Legenda da escala',
  codigos = CODIGOS_LEGENDA_PADRAO,
  className = '',
}: ScheduleLegendProps) {
  const tipos = codigos
    .map((codigo) => catalogo[codigo])
    .filter((tipo): tipo is TipoTurno => tipo !== undefined);

  if (tipos.length === 0) {
    return null;
  }

  return (
    <article className={`panel schedule-legend ${className}`.trim()}>
      <p className="schedule-legend-title">{titulo}</p>
      <div className="legend-row">
        {tipos.map((tipo) => (
          <span key={tipo.codigo}>
            <i className="shift-chip" data-code={tipo.codigo}>{tipo.codigo}</i>
            {tipo.descricao}
          </span>
        ))}
        {/* HOTFIX-HE-TURNO-1 — HE aparece com a cor do turno em que acontece. */}
        {catalogo.HE !== undefined && (
          <span>
            <i className="shift-chip" data-code="T" data-hora-extra="">
              T<span className="shift-chip-he" aria-hidden="true">HE</span>
            </i>
            {catalogo.HE.descricao} (cor do turno)
          </span>
        )}
      </div>
    </article>
  );
}
