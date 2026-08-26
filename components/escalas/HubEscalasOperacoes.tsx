'use client';

import { AlertTriangle, ArrowUpRight, CalendarDays, Eye, Radio, ShieldCheck, Users } from 'lucide-react';
import { agruparOperacoesParaHub, rotuloAcaoOperacaoHub } from '@/lib/hubEscalas';
import type { OperacaoDashboard } from '@/lib/operacoesDashboard';
import { rotuloStatusOperacaoDashboard } from '@/lib/operacoesDashboard';

/**
 * Fase DASH-SIMPLES-1B — índice do Hub de Escalas
 * (`docs/spec/HUB_ESCALAS.md`). Puramente apresentacional: recebe a lista
 * já resolvida por `resolverOperacoesDashboard()` (via `DashboardApp.tsx`)
 * e só agrupa/renderiza — nunca decide autorização, nunca resolve
 * contexto/competência por conta própria (isso continua em
 * `contextoOpcaoOperacao()`/`solicitarTrocaContexto()`, o mesmo caminho já
 * usado pelo `ScheduleContextSwitcher`).
 *
 * "Minhas escalas" (administráveis) e "Acompanhamento" (só consulta) nunca
 * se misturam visualmente, e uma operação de Acompanhamento nunca ganha
 * uma ação administrativa — só "Visualizar" (§ 4/§ 16 do redesign).
 */
export interface HubEscalasOperacoesProps {
  operacoes: readonly OperacaoDashboard[];
  /** Competência já formatada para exibição (ex.: "Setembro de 2026") — mesma competência para todo o Hub nesta fase (§ 5 de `docs/spec/HUB_ESCALAS.md`). */
  competenciaFormatada: string;
  /** Pessoas (colaboradores/participantes ativos) já resolvidas para a operação, quando disponíveis — `null` quando o dado ainda não foi carregado. */
  pessoasPorOperacao: (operacao: OperacaoDashboard) => number | null;
  /**
   * Alertas já resolvidos para a operação, quando disponíveis.
   * `null` significa "não avaliado fora do editor" (nunca "0" inventado) —
   * o Hub mostra "Abra para conferir" nesse caso, nunca "0 alertas" (§ 8).
   */
  alertasPorOperacao: (operacao: OperacaoDashboard) => number | null;
  onAbrir: (operacao: OperacaoDashboard) => void;
}

function iconeOperacao(operacao: OperacaoDashboard) {
  return operacao.tipo === 'JORNADA' ? <ShieldCheck size={20} aria-hidden="true" /> : <Radio size={20} aria-hidden="true" />;
}

function rotuloTipoOperacao(operacao: OperacaoDashboard): string {
  return operacao.tipo === 'JORNADA' ? 'Jornada 6x1' : 'Plantão';
}

function chaveOperacao(operacao: OperacaoDashboard): string {
  return `${operacao.tipo}:${operacao.alvoId}`;
}

interface HubEscalaCardProps {
  operacao: OperacaoDashboard;
  competenciaFormatada: string;
  pessoas: number | null;
  alertas: number | null;
  onAbrir: (operacao: OperacaoDashboard) => void;
}

function HubEscalaCard({ operacao, competenciaFormatada, pessoas, alertas, onAbrir }: HubEscalaCardProps) {
  const rotuloAcao = rotuloAcaoOperacaoHub(operacao);
  const rotuloPessoas = operacao.tipo === 'JORNADA' ? 'colaboradores' : 'participantes';
  return (
    <button
      type="button"
      className={`hub-escala-card ${operacao.consulta ? 'consulta' : ''} ${operacao.ativa ? 'ativa' : ''}`}
      onClick={() => onAbrir(operacao)}
    >
      <span className={`hub-escala-card-icon ${operacao.tipo === 'PLANTAO' ? 'plantao' : ''}`}>{iconeOperacao(operacao)}</span>
      <span className="hub-escala-card-corpo">
        <span className="hub-escala-card-cabecalho">
          <strong>{operacao.nome}</strong>
          <span className={`status-badge ${VARIANTE_STATUS[operacao.status]}`}>{rotuloStatusOperacaoDashboard(operacao.status)}</span>
        </span>
        <small className="hub-escala-card-tipo">{rotuloTipoOperacao(operacao)}</small>
        <span className="hub-escala-card-meta">
          <span><CalendarDays size={14} aria-hidden="true" />{competenciaFormatada}</span>
          {pessoas !== null && <span><Users size={14} aria-hidden="true" />{pessoas} {rotuloPessoas}</span>}
          {!operacao.consulta && (
            <span>
              <AlertTriangle size={14} aria-hidden="true" />
              {alertas === null ? 'Abra para conferir' : `${alertas} ${alertas === 1 ? 'alerta' : 'alertas'}`}
            </span>
          )}
          {operacao.consulta && <span className="hub-escala-card-somente-consulta">Somente consulta</span>}
        </span>
      </span>
      <span className="hub-escala-card-acao">
        {operacao.consulta ? <Eye size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
        {rotuloAcao}
      </span>
    </button>
  );
}

const VARIANTE_STATUS: Record<OperacaoDashboard['status'], string> = {
  rascunho: 'warning',
  publicada: 'success',
  'publicada-com-rascunho-pendente': 'warning',
  'sem-escala': 'neutral',
};

export function HubEscalasOperacoes({
  operacoes,
  competenciaFormatada,
  pessoasPorOperacao,
  alertasPorOperacao,
  onAbrir,
}: HubEscalasOperacoesProps) {
  const { minhasEscalas, acompanhamento } = agruparOperacoesParaHub(operacoes);
  if (minhasEscalas.length === 0 && acompanhamento.length === 0) {
    return null;
  }
  return (
    <div className="hub-escalas">
      {minhasEscalas.length > 0 && (
        <section className="hub-escalas-secao" aria-label="Minhas escalas">
          <h2 className="hub-escalas-titulo">Minhas escalas</h2>
          <div className="hub-escala-grid">
            {minhasEscalas.map((operacao) => (
              <HubEscalaCard
                key={chaveOperacao(operacao)}
                operacao={operacao}
                competenciaFormatada={competenciaFormatada}
                pessoas={pessoasPorOperacao(operacao)}
                alertas={alertasPorOperacao(operacao)}
                onAbrir={onAbrir}
              />
            ))}
          </div>
        </section>
      )}
      {acompanhamento.length > 0 && (
        <section className="hub-escalas-secao" aria-label="Acompanhamento">
          <h2 className="hub-escalas-titulo">Acompanhamento</h2>
          <div className="hub-escala-grid">
            {acompanhamento.map((operacao) => (
              <HubEscalaCard
                key={chaveOperacao(operacao)}
                operacao={operacao}
                competenciaFormatada={competenciaFormatada}
                pessoas={pessoasPorOperacao(operacao)}
                alertas={alertasPorOperacao(operacao)}
                onAbrir={onAbrir}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
