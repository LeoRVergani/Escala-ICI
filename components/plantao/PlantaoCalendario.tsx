import { adicionarDias, formatarData } from '@escala-ici/contrato';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useState, type DragEvent } from 'react';

import {
  agruparAtribuicoesPorDia,
  duracaoPlantaoAtipica,
  ehDiaDeContexto,
  indiceIdentidadePlantonista,
  nomeCurtoPlantonista,
  rotuloHorarioCartaoPlantao,
  type AtribuicaoPlantaoEditavel,
} from '@/lib/editorPlantao';

/**
 * Calendário do Editor de Plantão. No modo `editor`, mantém a janela inteira
 * da competência em uma única grade, com criação, edição e drag-and-drop.
 * No modo `importacao`, apresenta um mês por vez, com navegação entre os
 * meses cobertos pela competência e uma legenda lateral para conferência.
 */

function diaDaSemanaUtc(dataIso: string): number {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay();
}

function diasDaGradeCompetencia(periodoInicio: string, periodoFim: string): string[] {
  const inicioGrade = adicionarDias(periodoInicio, -diaDaSemanaUtc(periodoInicio));
  const fimGrade = adicionarDias(periodoFim, 6 - diaDaSemanaUtc(periodoFim));
  const dias: string[] = [];
  let cursor = inicioGrade;
  while (cursor <= fimGrade) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

function mesesDaJanela(periodoInicio: string, periodoFim: string): string[] {
  const mesInicial = periodoInicio.slice(0, 7);
  const mesFinal = periodoFim.slice(0, 7);
  return mesInicial === mesFinal ? [mesInicial] : [mesInicial, mesFinal];
}

function diasDaGradeMes(mes: string): string[] {
  const primeiroDia = `${mes}-01`;
  const ano = Number(mes.slice(0, 4));
  const numeroMes = Number(mes.slice(5, 7));
  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const dataFinal = `${mes}-${String(ultimoDia).padStart(2, '0')}`;
  const inicioGrade = adicionarDias(primeiroDia, -diaDaSemanaUtc(primeiroDia));
  const fimGrade = adicionarDias(dataFinal, 6 - diaDaSemanaUtc(dataFinal));
  const dias: string[] = [];
  let cursor = inicioGrade;
  while (cursor <= fimGrade) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

function rotuloMes(mes: string): string {
  const ano = Number(mes.slice(0, 4));
  const numeroMes = Number(mes.slice(5, 7));
  const texto = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, numeroMes - 1, 1)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function iniciaisPlantonista(nomeOriginal: string): string {
  const partes = nomeOriginal.trim().split(/\s+/u).filter(Boolean);
  if (partes.length === 0) {
    return '?';
  }
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return `${partes[0][0] ?? ''}${partes[partes.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function rotuloHorarioCompacto(horario: string): string {
  if (!horario.includes(' → ')) return horario;
  const compactar = (valor: string) => valor.endsWith(':00') ? `${valor.slice(0, 2)}h` : valor;
  const [inicio, fim] = horario.split(' → ');
  return `${compactar(inicio ?? '')}–${compactar(fim ?? '')}`;
}

export interface PlantaoCalendarioProps {
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  dataHoje: string;
  atribuicoes: readonly AtribuicaoPlantaoEditavel[];
  onEditarAtribuicao: (idLocal: string) => void;
  /** `null` = ninguém selecionado no roster — clicar o fundo do dia não faz nada. */
  plantonistaSelecionado: string | null;
  onSolicitarNovaAtribuicao: (plantonistaNomeOriginal: string, dataIso: string) => void;
  /**
   * A importação usa uma grade mensal navegável; o editor mantém a grade
   * da competência. Fase ESCOPO-CONSULTA-PLANTAO-1 — `'consulta'` é
   * somente leitura: nunca cria uma atribuição nova (mesmo já excluído por
   * `podeCriar`) e nunca abre o modal de edição ao clicar num cartão
   * existente — só visualização do calendário/atribuições já persistidas.
   */
  modo?: 'editor' | 'importacao' | 'consulta';
}

export function PlantaoCalendario({
  competencia,
  periodoInicio,
  periodoFim,
  dataHoje,
  atribuicoes,
  onEditarAtribuicao,
  plantonistaSelecionado,
  onSolicitarNovaAtribuicao,
  modo = 'editor',
}: PlantaoCalendarioProps) {
  const dias = diasDaGradeCompetencia(periodoInicio, periodoFim);
  const meses = mesesDaJanela(periodoInicio, periodoFim);
  const porDia = agruparAtribuicoesPorDia(atribuicoes);
  const [diaEmDragOver, setDiaEmDragOver] = useState<string | null>(null);
  const mesInicialImportacao = meses[meses.length - 1] ?? periodoFim.slice(0, 7);
  const [mesImportacao, setMesImportacao] = useState(mesInicialImportacao);
  const mesSelecionadoImportacao = meses.includes(mesImportacao) ? mesImportacao : mesInicialImportacao;
  const indiceMesImportacao = Math.max(0, meses.indexOf(mesSelecionadoImportacao));
  const mesHoje = dataHoje.slice(0, 7);

  function aoSoltarNoDia(evento: DragEvent<HTMLDivElement>, data: string, podeReceber: boolean) {
    evento.preventDefault();
    setDiaEmDragOver(null);
    if (!podeReceber) {
      return;
    }
    const nomeArrastado = evento.dataTransfer.getData('text/plain').trim();
    if (nomeArrastado !== '') {
      onSolicitarNovaAtribuicao(nomeArrastado, data);
    }
  }

  function renderDia(data: string) {
    const contexto = ehDiaDeContexto(data, periodoInicio, periodoFim);
    const podeCriar = modo === 'editor' && !contexto;
    const ehHoje = data === dataHoje;
    const atribuicoesDoDia = porDia.get(data) ?? [];
    return (
      <div
        key={data}
        role="gridcell"
        className={[
          'plantao-dia',
          modo === 'importacao' ? 'plantao-dia-importacao' : '',
          contexto ? 'contexto' : '',
          ehHoje ? 'hoje' : '',
          podeCriar && diaEmDragOver === data ? 'drop-alvo' : '',
        ].filter(Boolean).join(' ')}
        aria-label={
          contexto
            ? `${formatarData(data, { weekday: 'long', day: '2-digit', month: 'long' })}, fora do período desta competência — não aceita novos plantões`
            : formatarData(data, { weekday: 'long', day: '2-digit', month: 'long' })
        }
        onClick={() => {
          if (podeCriar && plantonistaSelecionado !== null) {
            onSolicitarNovaAtribuicao(plantonistaSelecionado, data);
          }
        }}
        onDragOver={(evento) => {
          if (!podeCriar) {
            return;
          }
          evento.preventDefault();
          evento.dataTransfer.dropEffect = 'copy';
        }}
        onDragEnter={() => {
          if (podeCriar) {
            setDiaEmDragOver(data);
          }
        }}
        onDragLeave={() => setDiaEmDragOver((atual) => (atual === data ? null : atual))}
        onDrop={(evento) => aoSoltarNoDia(evento, data, podeCriar)}
      >
        <div className="plantao-dia-cabecalho">
          <span className="plantao-dia-numero">{formatarData(data, { day: 'numeric' })}</span>
          {contexto && modo !== 'importacao' && <span className="plantao-dia-contexto-rotulo">contexto</span>}
        </div>
        <div className="plantao-cartoes">
          {atribuicoesDoDia.map((atribuicao) => {
            const atipica = duracaoPlantaoAtipica(atribuicao.duracaoMinutos);
            const horario = rotuloHorarioCartaoPlantao(atribuicao);
            const horarioCompacto = rotuloHorarioCompacto(horario);
            return (
              <button
                key={atribuicao.idLocal}
                type="button"
                className={`plantao-card${modo === 'importacao' ? ' plantao-card-importacao' : ''}`}
                data-identidade={indiceIdentidadePlantonista(atribuicao.plantonistaNomeOriginal)}
                data-atipica={atipica ? 'true' : 'false'}
                title={`${atribuicao.plantonistaNomeOriginal} · ${horario}`}
                onClick={(evento) => {
                  evento.stopPropagation();
                  if (modo !== 'consulta') {
                    onEditarAtribuicao(atribuicao.idLocal);
                  }
                }}
                aria-label={modo === 'consulta'
                  ? `${atribuicao.plantonistaNomeOriginal}, ${horario} — somente consulta`
                  : `Editar plantão de ${atribuicao.plantonistaNomeOriginal}, ${horario}`}
              >
                {modo === 'importacao' ? (
                  <>
                    <span className="plantao-card-pessoa">
                      <span className="plantao-card-iniciais" aria-hidden="true">{iniciaisPlantonista(atribuicao.plantonistaNomeOriginal)}</span>
                    </span>
                    <span className="plantao-card-horario">{horarioCompacto}</span>
                  </>
                ) : (
                  <>
                    <span>{nomeCurtoPlantonista(atribuicao.plantonistaNomeOriginal)}</span>
                    <span className="plantao-card-horario">{horario}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {podeCriar && (
          <button
            type="button"
            className="plantao-adicionar"
            onClick={(evento) => {
              evento.stopPropagation();
              onSolicitarNovaAtribuicao(plantonistaSelecionado ?? '', data);
            }}
            aria-label={`Adicionar plantão em ${formatarData(data, { day: '2-digit', month: '2-digit' })}`}
          >
            + Adicionar
          </button>
        )}
      </div>
    );
  }

  const nomesLegenda = Array.from(new Set(atribuicoes.map((atribuicao) => atribuicao.plantonistaNomeOriginal)));
  const podeIrParaMesAnterior = indiceMesImportacao > 0;
  const podeIrParaProximoMes = indiceMesImportacao < meses.length - 1;

  function selecionarMes(delta: number) {
    const proximoIndice = indiceMesImportacao + delta;
    const proximoMes = meses[proximoIndice];
    if (proximoMes !== undefined) {
      setMesImportacao(proximoMes);
    }
  }

  function irParaHoje() {
    setMesImportacao(meses.includes(mesHoje) ? mesHoje : meses[meses.length - 1] ?? mesImportacao);
  }

  function renderLegenda() {
    return (
      <aside className="plantao-calendario-legenda" aria-label="Legenda do calendário">
        <h3>Legenda</h3>
        <p className="plantao-legenda-titulo">Plantonistas</p>
        <div className="plantao-legenda-pessoas">
          {nomesLegenda.map((nome) => (
            <span key={nome} data-identidade={indiceIdentidadePlantonista(nome)}>
              <i aria-hidden="true">{iniciaisPlantonista(nome)}</i>
              <strong>{nome}</strong>
            </span>
          ))}
        </div>
        <div className="plantao-legenda-separador" />
        <div className="plantao-legenda-tipos">
          <span><i className="sem-escala" aria-hidden="true" /> Dia sem escala</span>
          <span><i className="noturno" aria-hidden="true" /><span>Plantão noturno <small>(~12h)</small></span></span>
          <span><i className="cinco-horas" aria-hidden="true" /><span>Plantão 5h <small>(19h→00h)</small></span></span>
          <span><i className="vinte-quatro" aria-hidden="true" /><span>Plantão 24h <small>(overnight)</small></span></span>
        </div>
        <p className="plantao-legenda-nota"><Info size={14} /> Plantões noturnos cruzam a madrugada do dia seguinte até o horário final.</p>
      </aside>
    );
  }

  return (
    <div className={`plantao-calendario${modo === 'importacao' ? ' plantao-calendario-importacao' : ''}`}>
      <header className="plantao-calendario-header">
        <strong>{modo === 'importacao' ? 'Calendário de plantões' : `Competência ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`}</strong>
        <span className="plantao-calendario-periodo">
          {formatarData(periodoInicio, { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {' → '}
          {formatarData(periodoFim, { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </header>

      {modo === 'importacao' ? (
        <div className="plantao-calendario-importacao-layout">
          <section className="plantao-mes plantao-mes-unico" aria-label={`Calendário de ${rotuloMes(mesSelecionadoImportacao)}`}>
            <header className="plantao-mes-header">
              <strong>{rotuloMes(mesSelecionadoImportacao)}</strong>
              <div className="plantao-mes-controles" aria-label="Navegação mensal">
                <button type="button" onClick={irParaHoje} disabled={mesSelecionadoImportacao === mesHoje}>Hoje</button>
                <button type="button" onClick={() => selecionarMes(-1)} disabled={!podeIrParaMesAnterior} aria-label="Ver mês anterior">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => selecionarMes(1)} disabled={!podeIrParaProximoMes} aria-label="Ver próximo mês">
                  <ChevronRight size={16} />
                </button>
              </div>
            </header>
            <div className="calendar-weekdays" aria-hidden="true">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}
            </div>
            <div className="plantao-grid" role="grid" aria-label={`Dias de plantão em ${rotuloMes(mesSelecionadoImportacao)}`}>
              {diasDaGradeMes(mesSelecionadoImportacao).map(renderDia)}
            </div>
          </section>
          {renderLegenda()}
        </div>
      ) : (
        <>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}
          </div>
          <div
            className={`plantao-grid${plantonistaSelecionado !== null ? ' selecao-ativa' : ''}`}
            role="grid"
            aria-label="Calendário do Plantão"
          >
            {dias.map(renderDia)}
          </div>
        </>
      )}
    </div>
  );
}
