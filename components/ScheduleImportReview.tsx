'use client';

import {
  adicionarDias,
  formatarData,
  type Dia,
  type ErroImportacao,
  type ResultadoParse,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileWarning,
  HelpCircle,
  Link2,
  Search,
  UserMinus,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';

import {
  chaveIndicadorCelula,
  type IndicadorCelulaAlerta,
} from '@/lib/alertasEscala';
import { contarPendenciasConciliacao } from '@/lib/conciliacaoUsuarios';
import type { LinhaConciliacao, Usuario } from '@/lib/modelos';

interface ScheduleImportReviewProps {
  resultado: ResultadoParse;
  nomeArquivo: string;
  usuarios: Usuario[];
  catalogo: Record<string, TipoTurno>;
  indiceAlertas?: Map<string, IndicadorCelulaAlerta>;
  linhasConciliacao?: LinhaConciliacao[];
  escritaBloqueada?: boolean;
  onSelecionarVinculo?: (linha: LinhaConciliacao, login: string) => void;
  onCriarUsuario?: (linha: LinhaConciliacao) => void;
  onSalvarAlias?: (linha: LinhaConciliacao) => void;
  onMarcarPendente?: (linha: LinhaConciliacao) => void;
  onIgnorar?: (linha: LinhaConciliacao) => void;
  onEditar?: (documento: TurnosMes, data: string, dia: Dia) => void;
  onRemover?: (documento: TurnosMes) => void;
  onVoltar?: () => void;
  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — "Ajustar" num erro
   * (`resultado.erros[indice]`) chama isto para levar até a linha exata na
   * tabela "Corrigir inconsistências" — nunca fica inerte, mesmo quando o
   * erro é estrutural (sem célula física específica, ex.: aba ausente).
   */
  onAjustarErro?: (indice: number) => void;
  headerActions?: ReactNode;
}

const ORDEM_TURNOS = ['MD', 'M', 'T', 'N'];

const STATUS_CONCILIACAO_LABEL: Record<LinhaConciliacao['status'], string> = {
  VINCULADO_LOGIN: 'Vinculado automaticamente por login/e-mail',
  VINCULADO_ALIAS: 'Vinculado por alias',
  PRECISA_MAPEAR: 'Precisa mapear',
  USUARIO_INATIVO: 'Usuário inativo',
  USUARIO_NAO_ENCONTRADO: 'Usuário não encontrado',
  CONFLITO_ALIAS: 'Conflito de aliases',
  IGNORADA: 'Ignorada',
};

const STATUS_CONCILIACAO_LABEL_CURTO: Record<LinhaConciliacao['status'], string> = {
  VINCULADO_LOGIN: 'Vinculado',
  VINCULADO_ALIAS: 'Vinculado',
  PRECISA_MAPEAR: 'Pendente',
  USUARIO_INATIVO: 'Inativo',
  USUARIO_NAO_ENCONTRADO: 'Sem vínculo',
  CONFLITO_ALIAS: 'Conflito',
  IGNORADA: 'Ignorado',
};

function statusConciliacaoResolvido(status: LinhaConciliacao['status']): boolean {
  return status === 'VINCULADO_LOGIN' || status === 'VINCULADO_ALIAS' || status === 'IGNORADA';
}

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
  escritaBloqueada = false,
  onSelecionarVinculo,
  onCriarUsuario,
  onSalvarAlias,
  onMarcarPendente,
  onIgnorar,
  onEditar,
  onRemover,
  onVoltar,
  onAjustarErro,
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
  const pendenciasSecaoRef = useRef<HTMLElement>(null);
  const [chavePendenciaSelecionada, setChavePendenciaSelecionada] = useState<string | null>(null);
  /**
   * HOTFIX-ESCALA-ALERTA-TROCAS-1 — "Ajustar"/"Revisar" numa pendência
   * precisa focar a linha/dia exatos AQUI, dentro desta mesma tela (Grade
   * da equipe). O antigo `onAjustarErro` (prop) mirava uma tabela "Corrigir
   * inconsistências" que só existe na tela de importação (`tela ===
   * 'importar'`) — quando este componente está montado (`tela === 'grade'`),
   * aquela tabela não existe no DOM, então o clique não fazia nada.
   */
  const [linhaErroDestacadaLogin, setLinhaErroDestacadaLogin] = useState<string | null>(null);
  const linhaGradeRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  /**
   * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — refs por célula
   * (`usuarioUid_data`, mesma chave de `chaveIndicadorCelula`) para
   * "Revisar"/"Ajustar" numa pendência rolar horizontalmente até a célula
   * exata, além da linha — `linhaGradeRefs` sozinho só resolve o eixo
   * vertical.
   */
  const celulaGradeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [celulaFocoErro, setCelulaFocoErro] = useState<{ chave: string; erro: ErroImportacao } | null>(null);
  const celulaFocoTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (celulaFocoTimeoutRef.current !== null) {
      window.clearTimeout(celulaFocoTimeoutRef.current);
    }
  }, []);

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

  // JORNADA-IMPORTACAO-VINCULOS-UX-1 — casa cada colaborador importado com
  // sua pendência de conciliação (por login já resolvido, ou pelo nome cru
  // da planilha quando ainda não há vínculo) para exibir status na lista
  // lateral e permitir abrir o vínculo com um clique.
  const linhaPorDocumento = useMemo(() => {
    const porLogin = new Map(
      linhasConciliacao.filter((linha) => linha.login !== null).map((linha) => [linha.login as string, linha] as const),
    );
    const porNomePlanilha = new Map(linhasConciliacao.map((linha) => [linha.nomePlanilha, linha] as const));
    return new Map(documentos.map((documento) => [
      documento.usuarioUid,
      porLogin.get(documento.login) ?? porNomePlanilha.get(documento.login) ?? null,
    ]));
  }, [documentos, linhasConciliacao]);

  /**
   * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — índice próprio dos erros
   * de importação por célula (`usuarioUid_data`), separado de
   * `indiceAlertas`/`chaveIndicadorCelula` (aquele é sobre 6x1/descanso, um
   * cálculo derivado da grade final; este é sobre o que a FONTE reportou
   * como inválido, célula a célula).
   */
  const errosFontePorCelula = useMemo(() => {
    const mapa = new Map<string, ErroImportacao>();
    for (const erro of resultado.erros) {
      if (erro.login === undefined || erro.data === undefined) continue;
      const documento = documentos.find((item) => item.login === erro.login);
      if (!documento) continue;
      mapa.set(chaveIndicadorCelula(documento.usuarioUid, erro.data), erro);
    }
    return mapa;
  }, [resultado.erros, documentos]);

  const pendenciasConciliacaoCount = contarPendenciasConciliacao(linhasConciliacao);
  const pendenciaSelecionada = chavePendenciaSelecionada
    ? linhasConciliacao.find((linha) => linha.nomePlanilha === chavePendenciaSelecionada) ?? null
    : null;

  const alertasOperacionais = useMemo(() => {
    const alertas: Array<{
      tipo: 'warning' | 'error' | 'info';
      titulo: string;
      detalhe: string;
      referencia: string;
      nomePlanilha: string | null;
      /** FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — índice em `resultado.erros`, para "Ajustar" levar à linha exata na tabela "Corrigir inconsistências" (nunca ficar inerte). */
      indiceErro: number | null;
    }> = [];
    resultado.erros.forEach((erro, indiceErro) => {
      const documento = erro.login ? documentos.find((item) => item.login === erro.login) : undefined;
      const nomePessoa = documento ? (nomes.get(documento.login) ?? documento.login) : erro.login;
      const celula = `${erro.coluna}${erro.linha}`;
      /**
       * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — mostrar o erro exato
       * (pessoa · data · célula · valor encontrado) em vez de só o motivo
       * genérico. Usa só campos que já existem em `ErroImportacao`, nunca
       * hardcode de célula/aba.
       */
      const detalhePartes = [
        nomePessoa ? `${nomePessoa}${erro.data ? ` · ${formatarDia(erro.data)}` : ''}` : undefined,
        celula,
        erro.valorEncontrado !== '' ? `Valor encontrado: ${erro.valorEncontrado}` : undefined,
      ].filter((parte): parte is string => Boolean(parte));
      alertas.push({
        tipo: 'error',
        titulo: erro.motivo,
        detalhe: detalhePartes.length > 0 ? detalhePartes.join(' · ') : (erro.sugestao ?? (erro.severidade === 'ALERTA'
          ? 'Pode ser uma exceção operacional legítima — confira antes de decidir.'
          : 'Revise o valor encontrado na fonte antes de continuar.')),
        referencia: nomePessoa ?? (erro.data ? formatarDia(erro.data) : celula),
        nomePlanilha: null,
        indiceErro,
      });
    });
    for (const aviso of resultado.avisos) {
      alertas.push({
        tipo: 'warning',
        titulo: aviso,
        detalhe: 'Aviso importado da validação da planilha.',
        referencia: 'Fonte',
        nomePlanilha: null,
        indiceErro: null,
      });
    }
    for (const linha of linhasConciliacao) {
      if (statusConciliacaoResolvido(linha.status)) continue;
      alertas.push({
        tipo: 'warning',
        titulo: `"${linha.nomePlanilha}" não está vinculado a um usuário`,
        detalhe: STATUS_CONCILIACAO_LABEL[linha.status],
        referencia: linha.nomePlanilha,
        nomePlanilha: linha.nomePlanilha,
        indiceErro: null,
      });
    }
    return alertas;
  }, [linhasConciliacao, resultado.erros, resultado.avisos, documentos, nomes]);

  function atualizarDia(delta: number) {
    const novoIndice = Math.min(datas.length - 1, Math.max(0, indiceDataSelecionada + delta));
    setDataSelecionadaEstado(datas[novoIndice] ?? dataSelecionada);
  }

  function rolarParaPendencias() {
    pendenciasSecaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ajustarErro(indice: number) {
    const erro = resultado.erros[indice];
    if (erro?.data && datas.includes(erro.data)) {
      setDataSelecionadaEstado(erro.data);
    }
    const documento = erro?.login ? documentos.find((item) => item.login === erro.login) : undefined;
    setLinhaErroDestacadaLogin(documento ? documento.login : null);
    if (documento && erro?.data) {
      /**
       * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — rola verticalmente
       * (linha) E horizontalmente (célula), foca a célula e aplica
       * highlight temporário — clicar "Revisar"/"Ajustar" precisa chegar
       * VISUALMENTE na célula exata, não só selecionar a data.
       */
      const chaveCelula = chaveIndicadorCelula(documento.usuarioUid, erro.data);
      linhaGradeRefs.current[documento.usuarioUid]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const celula = celulaGradeRefs.current[chaveCelula];
      celula?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      celula?.focus({ preventScroll: true });
      if (celulaFocoTimeoutRef.current !== null) {
        window.clearTimeout(celulaFocoTimeoutRef.current);
      }
      setCelulaFocoErro({ chave: chaveCelula, erro });
      celulaFocoTimeoutRef.current = window.setTimeout(() => {
        setCelulaFocoErro(null);
        celulaFocoTimeoutRef.current = null;
      }, 6000);
    } else if (documento) {
      linhaGradeRefs.current[documento.usuarioUid]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      rolarParaPendencias();
    }
    onAjustarErro?.(indice);
  }

  /**
   * Handler estável (não recriado dentro do `.map()` de linhas de alerta) —
   * o React Compiler recusa uma função que lê `ref.current` quando ela é
   * definida a cada iteração do `.map()`, mesmo só sendo chamada num
   * clique real. Os dados da linha viajam por `data-*`, não por closure.
   */
  function aoClicarLinhaDeAlerta(evento: MouseEvent<HTMLElement>) {
    const nomePlanilha = evento.currentTarget.dataset.nomePlanilha;
    if (nomePlanilha) {
      setChavePendenciaSelecionada(nomePlanilha);
      return;
    }
    const indiceErro = evento.currentTarget.dataset.indiceErro;
    if (indiceErro !== undefined) {
      ajustarErro(Number(indiceErro));
    }
  }

  function turnosImportadosDaLinha(linha: LinhaConciliacao): string[] {
    const relacionados = documentos.filter((documento) => documento.login === linha.login || documento.login === linha.nomePlanilha);
    return [...new Set(relacionados.map((documento) => documento.turnoPadrao))];
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
          {resultado.ok ? (
            <span className="status-badge success"><CircleCheck size={14} /> Prévia validada</span>
          ) : (
            <button type="button" className="status-badge warning status-badge-clickable" onClick={rolarParaPendencias} title="Ver pendências da importação">
              <CircleAlert size={14} /> Revisão necessária
            </button>
          )}
          {headerActions}
        </div>
      </header>

      <div className="soc-import-review-metrics">
        <div className="soc-import-review-metric"><CalendarDays size={19} /><strong>{resultado.totalDias}</strong><span>dias</span></div>
        <div className="soc-import-review-metric"><FileWarning size={19} /><strong>{documentosPorTurno.length}</strong><span>turnos</span></div>
        <div className="soc-import-review-metric"><UsersRound size={19} /><strong>{documentos.length}</strong><span>colaboradores</span></div>
        <button
          type="button"
          className={`soc-import-review-metric soc-import-review-metric-button ${alertasOperacionais.length > 0 ? 'has-alerts' : ''}`}
          onClick={rolarParaPendencias}
          disabled={alertasOperacionais.length === 0}
          title={alertasOperacionais.length > 0 ? 'Ver e resolver pendências da importação' : 'Nenhum alerta nesta importação'}
        >
          <AlertTriangle size={19} /><strong>{alertasOperacionais.length}</strong><span>alertas</span>
        </button>
        <div className="soc-import-review-source-health">
          <span>Saúde da origem</span>
          <strong className={resultado.ok ? 'good' : 'attention'}>{resultado.ok ? 'Boa' : 'Revisar'}</strong>
          <p>{resultado.ok ? 'Todas as colunas obrigatórias presentes.' : 'Existem valores que precisam de conferência.'}</p>
          {!resultado.ok && (
            <button type="button" className="secondary-button compact-button" onClick={rolarParaPendencias}>
              Revisar pendências
            </button>
          )}
        </div>
      </div>

      <div className="soc-import-review-workspace">
        <aside className="soc-import-review-roster">
          <div className="soc-import-review-panel-heading"><strong>Colaboradores</strong><span>{colaboradoresComNome.length}</span></div>
          <label className="soc-import-review-search"><Search size={14} /><input placeholder="Buscar colaborador" aria-label="Buscar colaborador" /></label>
          <div className="soc-import-review-roster-list">
            {colaboradoresComNome.map(({ documento, nome }) => {
              const linha = linhaPorDocumento.get(documento.usuarioUid) ?? null;
              return (
                <div
                  className="soc-import-review-person"
                  key={documento.usuarioUid}
                  role={linha ? 'button' : undefined}
                  tabIndex={linha ? 0 : undefined}
                  onClick={linha ? () => setChavePendenciaSelecionada(linha.nomePlanilha) : undefined}
                  onKeyDown={linha ? (evento) => {
                    if (evento.key === 'Enter' || evento.key === ' ') {
                      evento.preventDefault();
                      setChavePendenciaSelecionada(linha.nomePlanilha);
                    }
                  } : undefined}
                  title={linha ? `Vincular ${nome}` : undefined}
                >
                  <span className="soc-import-review-avatar" data-code={documento.turnoPadrao}>{nomeCurto(nome)}</span>
                  {/*
                    PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — o login
                    (identificador principal) fica sozinho na primeira linha,
                    nunca dividindo espaço com a badge de status: numa coluna
                    de 190px, badge+chip encostados na mesma linha do login
                    reduziam o `<strong>` a poucos caracteres visíveis.
                  */}
                  <span className="soc-import-review-person-copy">
                    <strong>{documento.login}</strong>
                    <span className="soc-import-review-person-meta">
                      <small>{nome}</small>
                      {linha && (
                        <span className={`status-badge compact ${statusConciliacaoResolvido(linha.status) ? 'success' : 'warning'}`}>
                          {STATUS_CONCILIACAO_LABEL_CURTO[linha.status]}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shift-chip soc-import-review-person-code" data-code={documento.turnoPadrao}>{documento.turnoPadrao}</span>
                  {onRemover && (
                    <button
                      type="button"
                      className="soc-import-review-remove"
                      title="Remover da grade desta competência"
                      aria-label={`Remover ${nome}`}
                      onClick={(evento) => { evento.stopPropagation(); onRemover(documento); }}
                    >
                      <UserMinus size={12} />
                    </button>
                  )}
                </div>
              );
            })}
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
          {celulaFocoErro && (
            <div className="soc-import-review-erro-foco" role="status">
              <CircleAlert size={13} />
              <span>
                <strong>{celulaFocoErro.erro.login ?? '—'}</strong>
                {celulaFocoErro.erro.data ? ` · ${formatarDia(celulaFocoErro.erro.data)}` : ''}
                {` · ${celulaFocoErro.erro.coluna}${celulaFocoErro.erro.linha}`}
                {` · Valor encontrado: ${celulaFocoErro.erro.valorEncontrado}`}
              </span>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setCelulaFocoErro(null)}><X size={13} /></button>
            </div>
          )}
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
                    return <tr
                      key={documento.usuarioUid}
                      ref={(elemento) => { linhaGradeRefs.current[documento.usuarioUid] = elemento; }}
                      className={linhaErroDestacadaLogin === documento.login ? 'linha-destacada' : undefined}
                    >
                      <th className="soc-import-review-name"><span>{nomeCurto(nome)}</span><strong>{documento.login}</strong></th>
                      {datas.map((data) => {
                        const dia = documento.dias[data];
                        const chaveCelula = chaveIndicadorCelula(documento.usuarioUid, data);
                        const indicador = indiceAlertas?.get(chaveCelula);
                        const erroFonte = errosFontePorCelula.get(chaveCelula);
                        const sequenciaCritica = (indicador?.sequencia ?? 0) >= 7;
                        const emFoco = celulaFocoErro?.chave === chaveCelula;
                        const tituloBase = `${documento.login} · ${formatarDataCompleta(data)}`;
                        const titulo = erroFonte
                          ? `${tituloBase} · ${erroFonte.coluna}${erroFonte.linha} · Valor encontrado: ${erroFonte.valorEncontrado}`
                          : sequenciaCritica
                            ? `${tituloBase} · 7º dia consecutivo de trabalho — regra 6x1 requer revisão.`
                            : tituloBase;
                        return <td key={data} className={`${data === dataSelecionada ? 'selected' : ''} ${ehFimDeSemana(data) ? 'weekend' : ''}`}>
                          <button
                            ref={(elemento) => { celulaGradeRefs.current[chaveCelula] = elemento; }}
                            type="button"
                            className={[
                              'soc-import-review-cell',
                              !dia ? 'empty' : '',
                              sequenciaCritica ? 'seq-critica' : '',
                              erroFonte ? 'erro-fonte' : '',
                              emFoco ? 'em-foco' : '',
                            ].filter(Boolean).join(' ')}
                            data-code={dia?.c ?? ''}
                            title={titulo}
                            onClick={() => { setDataSelecionadaEstado(data); onEditar?.(documento, data, dia ?? { c: '' }); }}
                          >
                            <span>{nomeCurto(nome)}</span><i>{dia?.c ?? '—'}</i>
                            {indicador?.sequencia !== undefined && (
                              <b className={`soc-import-review-cell-seq ${sequenciaCritica ? 'critica' : ''}`}>{indicador.sequencia}</b>
                            )}
                            {indicador?.descansoInsuficiente && <AlertTriangle size={10} aria-label="Descanso insuficiente" />}
                            {erroFonte && <CircleAlert size={10} className="soc-import-review-cell-erro-icon" aria-label="Erro reportado pela fonte" />}
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

      <section className="panel conciliation-panel" ref={pendenciasSecaoRef} id="soc-import-review-pendencias">
        <div className="panel-title">
          <div>
            <h2>Pendências e vínculos</h2>
            <p>Associe, crie ou ignore cada nome pendente da planilha antes de salvar ou publicar.</p>
          </div>
          <span className={`status-badge ${pendenciasConciliacaoCount > 0 ? 'warning' : 'success'}`}>
            {pendenciasConciliacaoCount > 0 ? `${pendenciasConciliacaoCount} pendência(s)` : 'Tudo conciliado'}
          </span>
        </div>
        {linhasConciliacao.length === 0 ? (
          <p className="soc-import-review-alerts-empty"><CircleCheck size={15} /> Nenhum nome da planilha precisa de conciliação.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table conciliation-table">
              <thead>
                <tr>
                  <th>Nome encontrado na planilha</th>
                  <th>Usuário vinculado</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {linhasConciliacao.map((linha) => {
                  const vinculado = usuarios.find((item) => item.login === linha.login);
                  return (
                    <tr key={linha.nomePlanilha} data-status={linha.status}>
                      <td>{linha.nomePlanilha}</td>
                      <td>
                        <select
                          value={linha.login ?? ''}
                          onChange={(evento) => {
                            if (evento.target.value) {
                              onSelecionarVinculo?.(linha, evento.target.value);
                            }
                          }}
                          aria-label={`Usuário vinculado a ${linha.nomePlanilha}`}
                        >
                          <option value="">Selecionar usuário…</option>
                          {usuarios.map((item) => (
                            <option key={item.login} value={item.login}>
                              {item.nome}{item.ativo ? '' : ' (inativo)'}
                            </option>
                          ))}
                        </select>
                        {linha.status === 'CONFLITO_ALIAS' && (
                          <small>
                            Candidatos: {linha.candidatos
                              .map((login) => usuarios.find((item) => item.login === login)?.nome ?? login)
                              .join(', ')}
                          </small>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${statusConciliacaoResolvido(linha.status) ? 'success' : 'warning'}`}>
                          {STATUS_CONCILIACAO_LABEL[linha.status]}
                        </span>
                      </td>
                      <td>
                        <div className="conciliation-actions">
                          <button
                            className="icon-button"
                            type="button"
                            title={`Ver detalhes e vincular "${linha.nomePlanilha}"`}
                            onClick={() => setChavePendenciaSelecionada(linha.nomePlanilha)}
                          >
                            <Search size={15} />
                          </button>
                          {linha.login !== null && linha.status !== 'VINCULADO_LOGIN' && (
                            <button
                              className="icon-button"
                              type="button"
                              title={`Salvar "${linha.nomePlanilha}" como alias de ${vinculado?.nome ?? ''}`}
                              disabled={escritaBloqueada}
                              onClick={() => onSalvarAlias?.(linha)}
                            >
                              <Link2 size={15} />
                            </button>
                          )}
                          <button
                            className="icon-button"
                            type="button"
                            title={`Criar usuário para "${linha.nomePlanilha}"`}
                            disabled={escritaBloqueada}
                            onClick={() => onCriarUsuario?.(linha)}
                          >
                            <UsersRound size={15} />
                          </button>
                          {linha.status !== 'PRECISA_MAPEAR' && linha.status !== 'IGNORADA' && (
                            <button
                              className="icon-button"
                              type="button"
                              title="Marcar como pendente"
                              onClick={() => onMarcarPendente?.(linha)}
                            >
                              <HelpCircle size={15} />
                            </button>
                          )}
                          {linha.status !== 'IGNORADA' && (
                            <button
                              className="icon-button"
                              type="button"
                              title="Ignorar esta linha"
                              onClick={() => onIgnorar?.(linha)}
                            >
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="soc-import-review-alerts">
        <div className="soc-import-review-alerts-heading"><div><strong>Pendências da fonte</strong><span>{alertasOperacionais.length}</span></div><small>Validações preservadas da importação local</small></div>
        <div className="soc-import-review-alerts-table">
          {alertasOperacionais.length === 0 ? <p className="soc-import-review-alerts-empty"><CircleCheck size={15} /> Nenhuma pendência encontrada na fonte.</p> : alertasOperacionais.slice(0, 4).map((alerta, indice) => {
            const linhaRelacionada = alerta.nomePlanilha
              ? linhasConciliacao.find((linha) => linha.nomePlanilha === alerta.nomePlanilha) ?? null
              : null;
            const indiceErroDaLinha = alerta.indiceErro;
            const podeAjustarErro = indiceErroDaLinha !== null;
            const acionavel = linhaRelacionada !== null || podeAjustarErro;
            const Wrapper = acionavel ? 'button' : 'div';
            const erroDaLinha = alerta.indiceErro !== null ? resultado.erros[alerta.indiceErro] : undefined;
            const severidadeErro = erroDaLinha?.severidade;
            /**
             * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — quando o erro
             * tem célula física (login + data), "Ir para o erro" deixa
             * explícito que o clique leva à célula exata na grade, não só a
             * uma correção qualquer.
             */
            const rotuloAcao = erroDaLinha?.login !== undefined && erroDaLinha.data !== undefined
              ? 'Ir para o erro'
              : severidadeErro === 'BLOQUEANTE' ? 'Ajustar' : severidadeErro === 'ALERTA' ? 'Revisar' : (alerta.tipo === 'error' ? 'Ajustar' : 'Revisar');
            return (
              <Wrapper
                key={`${alerta.referencia}-${indice}`}
                type={acionavel ? 'button' : undefined}
                className={`soc-import-review-alert-row ${acionavel ? 'is-actionable' : ''}`}
                data-nome-planilha={linhaRelacionada ? linhaRelacionada.nomePlanilha : undefined}
                data-indice-erro={indiceErroDaLinha !== null ? indiceErroDaLinha : undefined}
                onClick={acionavel ? aoClicarLinhaDeAlerta : undefined}
              >
                <span className={`soc-import-review-alert-icon ${alerta.tipo}`}><AlertTriangle size={14} /></span>
                <div><strong>{alerta.titulo}</strong><small>{alerta.detalhe}</small></div>
                <span className="soc-import-review-alert-reference">{alerta.referencia}</span>
                <span className={`status-badge ${severidadeErro === 'ALERTA' ? 'warning' : alerta.tipo === 'error' ? 'danger' : 'warning'}`}>{rotuloAcao}</span>
              </Wrapper>
            );
          })}
          {alertasOperacionais.length > 4 && (
            <p className="soc-import-review-alerts-more">
              +{alertasOperacionais.length - 4} pendência(s) na tabela de conciliação acima.
            </p>
          )}
        </div>
      </section>

      {pendenciaSelecionada && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setChavePendenciaSelecionada(null)}>
          <section
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vinculo-importado-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Vincular colaborador importado</p>
                <h2 id="vinculo-importado-title">{nomeCurto(pendenciaSelecionada.nomePlanilha)} · {pendenciaSelecionada.nomePlanilha}</h2>
                <span className={`status-badge ${statusConciliacaoResolvido(pendenciaSelecionada.status) ? 'success' : 'warning'}`}>
                  {STATUS_CONCILIACAO_LABEL[pendenciaSelecionada.status]}
                </span>
              </div>
              <button className="icon-button" type="button" onClick={() => setChavePendenciaSelecionada(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <p>Turnos importados: {turnosImportadosDaLinha(pendenciaSelecionada).join(', ') || '—'}</p>
            <label>
              Usuário vinculado
              <select
                value={pendenciaSelecionada.login ?? ''}
                onChange={(evento) => {
                  if (evento.target.value) {
                    onSelecionarVinculo?.(pendenciaSelecionada, evento.target.value);
                  }
                }}
                aria-label={`Usuário vinculado a ${pendenciaSelecionada.nomePlanilha}`}
              >
                <option value="">Selecionar usuário…</option>
                {usuarios.map((item) => (
                  <option key={item.login} value={item.login}>
                    {item.nome}{item.ativo ? '' : ' (inativo)'}
                  </option>
                ))}
              </select>
            </label>
            {pendenciaSelecionada.status === 'CONFLITO_ALIAS' && (
              <small>
                Candidatos: {pendenciaSelecionada.candidatos
                  .map((login) => usuarios.find((item) => item.login === login)?.nome ?? login)
                  .join(', ')}
              </small>
            )}
            <div className="rollback-actions">
              {pendenciaSelecionada.login !== null && pendenciaSelecionada.status !== 'VINCULADO_LOGIN' && (
                <button
                  className="secondary-button compact-button"
                  type="button"
                  disabled={escritaBloqueada}
                  onClick={() => onSalvarAlias?.(pendenciaSelecionada)}
                >
                  <Link2 size={14} /> Salvar como alias
                </button>
              )}
              <button
                className="secondary-button compact-button"
                type="button"
                disabled={escritaBloqueada}
                onClick={() => { onCriarUsuario?.(pendenciaSelecionada); setChavePendenciaSelecionada(null); }}
              >
                <UsersRound size={14} /> Criar usuário
              </button>
              {pendenciaSelecionada.status !== 'IGNORADA' && (
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => onIgnorar?.(pendenciaSelecionada)}
                >
                  <Ban size={14} /> Ignorar por enquanto
                </button>
              )}
              <button className="primary-button" type="button" onClick={() => setChavePendenciaSelecionada(null)}>
                Voltar para a importação
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
