import { AlertTriangle, ArrowRight, CheckCircle2, Link2 } from 'lucide-react';

import type { SaudeFuncaoPlantao } from '@/lib/plantaoMultiposto';

/**
 * FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1/FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1
 * — painel de saúde de UM posto/função (§16/§17/§33, §19/§20). Genérico
 * por construção: recebe `rotulo` (nunca hardcoda "DBA"/"Linux"/...) e o
 * resultado já calculado de `avaliarSaudePlantao()` — nunca recalcula
 * nada aqui, só apresenta. Não criar `CardDBA.tsx`/`CardLinux.tsx`/etc.
 * — este componente serve qualquer função de qualquer Grupo de Plantão
 * multi-função presente ou futuro (`grupo.funcoesEsperadas`).
 *
 * Card é navegação operacional, não só decoração (§20): "Ver escala"
 * sempre leva ao Calendário da função; "Resolver vínculos" (só quando há
 * pendência) leva direto à aba Vínculos já filtrada pela função — duas
 * ações, nunca um menu extenso.
 *
 * Reaproveita as classes `.overview-operation-card`/`-heading`/`-meta`/
 * `-action` já usadas pelos cards de operação da Visão Geral — nenhuma
 * classe CSS nova, para não divergir do Design System existente.
 */
export interface CardFuncaoPlantaoProps {
  rotulo: string;
  saude: SaudeFuncaoPlantao;
  selecionado: boolean;
  onSelecionar: () => void;
  onResolverVinculos: () => void;
}

function formatarMinutosCard(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  return `${horas}h`;
}

export function CardFuncaoPlantao({ rotulo, saude, selecionado, onSelecionar, onResolverVinculos }: CardFuncaoPlantaoProps) {
  const varianteStatus = saude.status === 'OK' ? 'stable' : 'attention';
  const problemas: string[] = [];
  if (saude.postosFaltando > 0) {
    problemas.push(`${saude.postosFaltando} posto(s) sem plantonista`);
  }
  if (saude.vinculosPendentes > 0) {
    problemas.push(`${saude.vinculosPendentes} vínculo(s) pendente(s)`);
  }
  if (saude.conflitos > 0) {
    problemas.push(`${saude.conflitos} conflito(s) de horário`);
  }
  if (saude.errosOrigem > 0) {
    problemas.push(`${saude.errosOrigem} erro(s) de origem`);
  }
  if (saude.avisos > 0) {
    problemas.push(`${saude.avisos} aviso(s)`);
  }

  return (
    <article className={`overview-operation-card plantao-card-funcao ${varianteStatus}${selecionado ? ' selected' : ''}`}>
      <button type="button" className="plantao-card-funcao-corpo" onClick={onSelecionar} aria-pressed={selecionado}>
        <div className="overview-operation-card-heading">
          <span className="overview-operation-icon plantao">{rotulo.slice(0, 2).toUpperCase()}</span>
          <div className="overview-operation-title">
            <strong>{rotulo}</strong>
          </div>
          {saude.status === 'OK' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </div>
        <div className="overview-operation-meta">
          <span><strong>{saude.atribuicoes}</strong><small>Atribuições</small></span>
          <span><strong>{saude.pessoasUnicas}</strong><small>Pessoas</small></span>
          <span><strong>{formatarMinutosCard(saude.minutosCobertura)}</strong><small>Cobertura</small></span>
        </div>
        {problemas.length === 0 ? (
          <p className="plantao-validado-nota"><CheckCircle2 size={14} /> Tudo certo</p>
        ) : (
          <ul className="warning-list">
            {problemas.map((problema) => <li key={problema}>⚠ {problema}</li>)}
          </ul>
        )}
        <div className="overview-operation-action">
          {selecionado ? `Vendo ${rotulo}` : `Ver ${rotulo}`}
          <ArrowRight size={14} />
        </div>
      </button>
      {saude.vinculosPendentes > 0 && (
        <button type="button" className="secondary-button compact-button plantao-card-funcao-vinculos" onClick={onResolverVinculos}>
          <Link2 size={14} /> Resolver {saude.vinculosPendentes} vínculo(s)
        </button>
      )}
    </article>
  );
}
