'use client';

import {
  adicionarDias,
  formatarData,
  type Dia,
  type ResultadoParse,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileWarning,
  Search,
  UserMinus,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  chaveIndicadorCelula,
  type IndicadorCelulaAlerta,
} from '@/lib/alertasEscala';
import type { LinhaConciliacao, Usuario } from '@/lib/modelos';

interface ScheduleImportReviewProps {
  resultado: ResultadoParse;
  nomeArquivo: string;
  usuarios: Usuario[];
  catalogo: Record<string, TipoTurno>;
  indiceAlertas?: Map<string, IndicadorCelulaAlerta>;
  linhasConciliacao?: LinhaConciliacao[];
  onEditar?: (documento: TurnosMes, data: string, dia: Dia) => void;
  onRemover?: (documento: TurnosMes) => void;
  onVoltar?: () => void;
  headerActions?: ReactNode;
}

const ORDEM_TURNOS = ['MD', 'M', 'T', 'N'];

function periodoDeDatas(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  for (let atual = inicio; atual <= fim; atual = adicionarDias(atual, 1)) {
    datas.push(atual);
  }
  return datas;
}

function nomeCurto(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '—';
  if (palavras.length === 1) return palavras[0]!.slice(0, 2).toUpperCase();
  return `${palavras[0]![0]}${palavras.at(-1)![0]}`.toUpperCase();
}

function formatarDia(data: string): string {
  return formatarData(data, { day: '2-digit', month: '2-digit' });
}

function formatarDataCompleta(data: string): string {
  return formatarData(data, { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
}

function ehFimDeSemana(data: string): boolean {
  const dia = new Date(`${data}T12:00:00`).getDay();
  return dia === 0 || dia === 6;
}

function descricaoTurno(documento: TurnosMes, catalogo: Record<string, TipoTurno>): string {
  return catalogo[documento.turnoPadrao]?.descricao ?? documento.turnoPadrao;
}

export function ScheduleImportReview({
  resultado,
  nomeArquivo,
  usuarios,
  catalogo,
  indiceAlertas,
  linhasConciliacao = [],
  onEditar,
  onRemover,
  onVoltar,
  headerActions,
}: ScheduleImportReviewProps) {
  const documentos = resultado.documentos;
  const datas = useMemo(
    () => periodoDeDatas(resultado.periodoInicio, resultado.periodoFim),
    [resultado.periodoInicio, resultado.periodoFim],
  );
  const nomes = useMemo(
    () => new Map(usuarios.map((usuario) => [usuario.login, usuario.nome])),
    [usuarios],
  );
  const dataHoje = new Date().toISOString().slice(0, 10);
  const dataInicial = datas.includes(dataHoje) ? dataHoje : datas[Math.floor(datas.length / 2)] ?? resultado.periodoInicio;
  const [dataSelecionadaEstado, setDataSelecionadaEstado] = useState(dataInicial);
  const dataSelecionada = datas.includes(dataSelecionadaEstado) ? dataSelecionadaEstado : dataInicial;
  const indiceDataSelecionada = Math.max(0, datas.indexOf(dataSelecionada));

  const documentosPorTurno = useMemo(() => {
    const grupos = new Map<string, TurnosMes[]>();
    for (const codigo of ORDEM_TURNOS) grupos.set(codigo, []);
    for (const documento of documentos) {
      const grupo = grupos.get(documento.turnoPadrao) ?? [];
      grupo.push(documento);
      grupos.set(documento.turnoPadrao, grupo);
    }
    return [...grupos.entries()].filter(([, grupo]) => grupo.length > 0);
  }, [documentos]);

  const colaboradoresComNome = useMemo(
    () => documentos.map((documento) => ({
      documento,
      nome: nomes.get(documento.login) ?? documento.login,
    })),
    [documentos, nomes],
  );

  const alertasOperacionais = useMemo(() => {
    const alertas: Array<{ tipo: 'warning' | 'error' | 'info'; titulo: string; detalhe: string; referencia: string }> = [];
    for (const erro of resultado.erros) {
      alertas.push({
        tipo: 'error',
        titulo: erro.motivo,
        detalhe: erro.sugestao ?? 'Revise o valor encontrado na fonte antes de continuar.',
        referencia: erro.login ?? (erro.data ? formatarDia(erro.data) : `${erro.coluna}${erro.linha}`),
      });
    }
    for (const aviso of resultado.avisos) {
      alertas.push({
        tipo: 'warning',
        titulo: aviso,
        detalhe: 'Aviso importado da validação da planilha.',
        referencia: 'Fonte',
      });
    }
    const pendencias = linhasConciliacao.filter((linha) => linha.status !== 'VINCULADO_LOGIN' && linha.status !== 'VINCULADO_ALIAS' && linha.status !== 'IGNORADA');
    if (pendencias.length > 0) {
      alertas.push({
        tipo: 'warning',
        titulo: 'Nomes da planilha precisam de vínculo',
        detalhe: `${pendencias.length} colaborador(es) ainda aguardam conciliação.`,
        referencia: pendencias[0]?.nomePlanilha ?? 'Conciliação',
      });
    }
    return alertas;
  }, [linhasConciliacao, resultado.erros, resultado.avisos]);

  function atualizarDia(delta: number) {
    const novoIndice = Math.min(datas.length - 1, Math.max(0, indiceDataSelecionada + delta));
    setDataSelecionadaEstado(datas[novoIndice] ?? dataSelecionada);
  }

  return (
    <section className="soc-import-review">
      <header className="soc-import-review-header">
        <div className="soc-import-review-title">
          {onVoltar && <button type="button" className="soc-import-review-back" onClick={onVoltar} aria-label="Voltar para Escalas"><ChevronLeft size={17} /></button>}
          <div className="soc-import-review-title-icon"><CalendarDays size={22} /></div>
          <div>
            <p className="eyebrow">Resumo da importação</p>
            <h1>Escala SOC · {formatarData(resultado.periodoFim, { month: 'long', year: 'numeric' })}</h1>
            <p>{formatarDia(resultado.periodoInicio)} — {formatarDia(resultado.periodoFim)} · {nomeArquivo}</p>
          </div>
        </div>
        <div className="soc-import-review-header-actions">
          <span className={`status-badge ${resultado.ok ? 'success' : 'warning'}`}>
            {resultado.ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
            {resultado.ok ? 'Prévia validada' : 'Revisão necessária'}
          </span>
          {headerActions}
        </div>
      </header>

      <div className="soc-import-review-metrics">
        <div className="soc-import-review-metric"><CalendarDays size={19} /><strong>{resultado.totalDias}</strong><span>dias</span></div>
        <div className="soc-import-review-metric"><FileWarning size={19} /><strong>{documentosPorTurno.length}</strong><span>turnos</span></div>
        <div className="soc-import-review-metric"><UsersRound size={19} /><strong>{documentos.length}</strong><span>colaboradores</span></div>
        <div className={`soc-import-review-metric ${alertasOperacionais.length > 0 ? 'has-alerts' : ''}`}><AlertTriangle size={19} /><strong>{alertasOperacionais.length}</strong><span>alertas</span></div>
        <div className="soc-import-review-source-health">
          <span>Saúde da origem</span>
          <strong className={resultado.ok ? 'good' : 'attention'}>{resultado.ok ? 'Boa' : 'Revisar'}</strong>
          <p>{resultado.ok ? 'Todas as colunas obrigatórias presentes.' : 'Existem valores que precisam de conferência.'}</p>
        </div>
      </div>

      <div className="soc-import-review-workspace">
        <aside className="soc-import-review-roster">
          <div className="soc-import-review-panel-heading"><strong>Colaboradores</strong><span>{colaboradoresComNome.length}</span></div>
          <label className="soc-import-review-search"><Search size={14} /><input placeholder="Buscar colaborador" aria-label="Buscar colaborador" /></label>
          <div className="soc-import-review-roster-list">
            {colaboradoresComNome.map(({ documento, nome }) => (
              <div className="soc-import-review-person" key={documento.usuarioUid}>
                <span className="soc-import-review-avatar" data-code={documento.turnoPadrao}>{nomeCurto(nome)}</span>
                <span className="soc-import-review-person-copy"><strong>{documento.login}</strong><small>{nome}</small></span>
                <span className="shift-chip soc-import-review-person-code" data-code={documento.turnoPadrao}>{documento.turnoPadrao}</span>
                {onRemover && <button type="button" className="soc-import-review-remove" title="Remover da grade desta competência" aria-label={`Remover ${nome}`} onClick={() => onRemover(documento)}><UserMinus size={12} /></button>}
              </div>
            ))}
          </div>
          <div className="soc-import-review-mini-legend">
            {ORDEM_TURNOS.concat(['X', 'DF', 'DU', 'BH']).map((codigo) => catalogo[codigo] ? <span key={codigo}><i className="shift-chip" data-code={codigo}>{codigo}</i></span> : null)}
          </div>
        </aside>

        <section className="soc-import-review-matrix-card">
          <div className="soc-import-review-matrix-toolbar">
            <label><CalendarDays size={14} /><span>Selecionar dia</span><select value={dataSelecionada} onChange={(evento) => setDataSelecionadaEstado(evento.target.value)} aria-label="Selecionar dia da escala">
              {datas.map((data) => <option key={data} value={data}>{formatarDataCompleta(data)}</option>)}
            </select></label>
            <div className="soc-import-review-month-controls">
              <button type="button" title="Dia anterior" aria-label="Dia anterior" disabled={indiceDataSelecionada === 0} onClick={() => atualizarDia(-1)}><ChevronLeft size={15} /></button>
              <strong>{formatarData(resultado.periodoFim, { month: 'long', year: 'numeric' })}</strong>
              <button type="button" title="Próximo dia" aria-label="Próximo dia" disabled={indiceDataSelecionada === datas.length - 1} onClick={() => atualizarDia(1)}><ChevronRight size={15} /></button>
            </div>
          </div>
          <div className="soc-import-review-table-scroll">
            <table className="soc-import-review-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  {datas.map((data) => <th key={data} className={`${ehFimDeSemana(data) ? 'weekend' : ''} ${data === dataSelecionada ? 'selected' : ''}`}><strong>{formatarData(data, { weekday: 'short' }).replace('.', '').toUpperCase()}</strong><span>{formatarDia(data)}</span></th>)}
                </tr>
              </thead>
              {documentosPorTurno.map(([codigoTurno, grupo]) => (
                <tbody key={codigoTurno}>
                  <tr className="soc-import-review-group-row"><th colSpan={datas.length + 1}><span className="shift-chip" data-code={codigoTurno}>{codigoTurno}</span>{descricaoTurno(grupo[0]!, catalogo)}</th></tr>
                  {grupo.map((documento) => {
                    const nome = nomes.get(documento.login) ?? documento.login;
                    return <tr key={documento.usuarioUid}>
                      <th className="soc-import-review-name"><span>{nomeCurto(nome)}</span><strong>{documento.login}</strong></th>
                      {datas.map((data) => {
                        const dia = documento.dias[data];
                        const indicador = indiceAlertas?.get(chaveIndicadorCelula(documento.usuarioUid, data));
                        return <td key={data} className={`${data === dataSelecionada ? 'selected' : ''} ${ehFimDeSemana(data) ? 'weekend' : ''}`}>
                          <button type="button" className={`soc-import-review-cell ${!dia ? 'empty' : ''}`} data-code={dia?.c ?? ''} title={`${documento.login} · ${formatarDataCompleta(data)}`} onClick={() => { setDataSelecionadaEstado(data); onEditar?.(documento, data, dia ?? { c: '' }); }}>
                            <span>{nomeCurto(nome)}</span><i>{dia?.c ?? '—'}</i>
                            {indicador?.descansoInsuficiente && <AlertTriangle size={10} aria-label="Descanso insuficiente" />}
                          </button>
                        </td>;
                      })}
                    </tr>;
                  })}
                </tbody>
              ))}
            </table>
          </div>
          <div className="soc-import-review-density-legend"><span>Baixa</span><i className="density-low" /><i className="density-mid" /><i className="density-high" /><span>Alta</span><span className="soc-import-review-no-data"><i /> Sem dados</span></div>
        </section>

      </div>

      <section className="soc-import-review-alerts">
        <div className="soc-import-review-alerts-heading"><div><strong>Pendências da fonte</strong><span>{alertasOperacionais.length}</span></div><small>Validações preservadas da importação local</small></div>
        <div className="soc-import-review-alerts-table">
          {alertasOperacionais.length === 0 ? <p className="soc-import-review-alerts-empty"><CircleCheck size={15} /> Nenhuma pendência encontrada na fonte.</p> : alertasOperacionais.slice(0, 4).map((alerta, indice) => <div className="soc-import-review-alert-row" key={`${alerta.referencia}-${indice}`}><span className={`soc-import-review-alert-icon ${alerta.tipo}`}><AlertTriangle size={14} /></span><div><strong>{alerta.titulo}</strong><small>{alerta.detalhe}</small></div><span className="soc-import-review-alert-reference">{alerta.referencia}</span><span className={`status-badge ${alerta.tipo === 'error' ? 'danger' : 'warning'}`}>{alerta.tipo === 'error' ? 'Ajustar' : 'Revisar'}</span></div>)}
        </div>
      </section>
    </section>
  );
}
