import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, EyeOff, List, Pencil, Plus, Search, StickyNote, Trash2, UserRound, X } from 'lucide-react';
import { dataIsoLocal } from '@escala-ici/contrato';

import {
  cobreDia, descricaoHorario, descricaoPeriodo, entradaDaInformacao, entradaEmBranco, filtrarInformacoes, gerarIdInformacao, informacoesDoDia, informacoesDoMes,
  mensagemFalhaDeLeitura, metaDoTipo, montarDocumentoInformacao, nomeDoMes, ordenarInformacoes, resumoDoPeriodo, resumoPorDia, rotuloDiaRelativo, SEM_FILTROS, semanasDoMes, TIPOS_INFORMACAO,
  tituloDoDia, tituloExibicao, type EntradaInformacao, type FiltrosInformacao, type InformacaoDia,
} from '@/lib/informacoesDia';
import { excluirInformacao, observarInformacoesDaEquipe, salvarInformacao } from '@/lib/firebase/informacoesDiaRepository';
import { mesAdjacente, primeiroDiaDoMes } from '@/lib/lembretesUi';
import type { Usuario } from '@/lib/modelos';
import { ICONE_INFORMACAO } from '@/components/iconesInformacao';
import { InformacaoModal } from './InformacaoModal';
import { informacoesDeExemplo } from './informacoesDemo';
import { iniciais, mensagemErro, usePessoas } from './pessoasLideranca';

/**
 * INFORMACOES-DIA-1 — Informações: o chefe de equipe registra o que aconteceu com cada colaborador
 * (atestado, afastamento por horário, curso, anotação) e consulta tudo num lugar só: calendário do
 * mês, painel do dia e lista. Cada informação pode ser liberada (ou não) para o colaborador ver no App.
 */
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const maiuscula = (texto: string) => `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;

export function InformacoesPage({ autor, equipes, modoDemo, pessoasDemo }: {
  autor: Usuario;
  /** Equipes cujas pessoas o chefe pode registrar (as dele e as equipes dos Plantões que organiza). */
  equipes: ReadonlyArray<{ id: string; nome: string }>;
  modoDemo: boolean;
  pessoasDemo?: readonly Usuario[];
}) {
  const [hoje] = useState(() => dataIsoLocal());
  const [mes, setMes] = useState(() => hoje.slice(0, 7));
  const [dia, setDia] = useState(hoje);
  const [visao, setVisao] = useState<'calendario' | 'lista'>('calendario');
  const [filtros, setFiltros] = useState<FiltrosInformacao>(SEM_FILTROS);
  const [modal, setModal] = useState<{ existente: InformacaoDia | null; entrada: EntradaInformacao } | null>(null);
  const [excluindo, setExcluindo] = useState<InformacaoDia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [porEquipe, setPorEquipe] = useState<Record<string, InformacaoDia[]>>({});
  const [erroCarga, setErroCarga] = useState('');
  const { pessoas, erro: erroPessoas } = usePessoas(pessoasDemo);

  const chaveEquipes = equipes.map((equipe) => equipe.id).join('|');
  const idsEquipes = useMemo(() => (chaveEquipes === '' ? [] : chaveEquipes.split('|')), [chaveEquipes]);
  const nomeEquipe = (equipeId: string) => equipes.find((equipe) => equipe.id === equipeId)?.nome ?? equipeId;
  const membros = useMemo(
    () => (pessoas ?? []).filter((pessoa) => idsEquipes.includes(pessoa.equipeId) && pessoa.ativo !== false)
      .map((pessoa) => ({ login: pessoa.login, nome: pessoa.nome, equipeId: pessoa.equipeId }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [pessoas, idsEquipes],
  );

  // Demonstração: informações de exemplo (relativas a hoje), só na memória. Real: uma assinatura por equipe.
  // (os exemplos são DERIVADOS das pessoas; só depois de uma edição passam a ser a lista editada)
  const exemplosDemo = useMemo(
    () => (modoDemo && membros.length >= 5 ? informacoesDeExemplo(hoje, membros, { login: autor.login, nome: autor.nome }) : []),
    [modoDemo, membros, hoje, autor.login, autor.nome],
  );
  const [demoEditada, setDemoEditada] = useState<InformacaoDia[] | null>(null);
  const demoLista = demoEditada ?? exemplosDemo;

  useEffect(() => {
    if (modoDemo) return undefined;
    const inicioDoMes = primeiroDiaDoMes(mes);
    const desde = hoje < inicioDoMes ? hoje : inicioDoMes;
    const cancelar = idsEquipes.map((equipeId) => observarInformacoesDaEquipe(
      equipeId, desde,
      (lista) => { setPorEquipe((atual) => ({ ...atual, [equipeId]: lista })); setErroCarga(''); },
      (falha) => { console.error('Informações: falha ao carregar', falha); setErroCarga(mensagemFalhaDeLeitura(falha)); },
    ));
    return () => cancelar.forEach((parar) => parar());
  }, [modoDemo, idsEquipes, mes, hoje]);

  const todas = useMemo(() => (modoDemo ? demoLista : Object.values(porEquipe).flat()), [modoDemo, demoLista, porEquipe]);
  const filtradas = useMemo(() => filtrarInformacoes(todas, filtros), [todas, filtros]);
  const resumo = useMemo(() => resumoDoPeriodo(todas, mes, hoje), [todas, mes, hoje]);
  const pontos = useMemo(() => resumoPorDia(filtradas, mes), [filtradas, mes]);
  const semanas = useMemo(() => semanasDoMes(mes), [mes]);
  const doDia = useMemo(() => informacoesDoDia(filtradas, dia), [filtradas, dia]);
  const doMes = useMemo(() => informacoesDoMes(filtradas, mes), [filtradas, mes]);
  const quemEstaHoje = useMemo(() => ordenarInformacoes(todas.filter((informacao) => cobreDia(informacao, hoje))), [todas, hoje]);
  const contagemPorTipo = useMemo(() => {
    const semTipo = informacoesDoMes(filtrarInformacoes(todas, { ...filtros, tipo: 'TODOS' }), mes);
    return { TODOS: semTipo.length, ...Object.fromEntries(TIPOS_INFORMACAO.map((tipo) => [tipo.chave, semTipo.filter((informacao) => informacao.tipo === tipo.chave).length])) } as Record<string, number>;
  }, [todas, filtros, mes]);

  function irParaMes(novo: string) {
    setMes(novo);
    setDia(novo === hoje.slice(0, 7) ? hoje : primeiroDiaDoMes(novo));
  }
  function selecionarDia(data: string) {
    setDia(data);
    if (!data.startsWith(mes)) setMes(data.slice(0, 7));
  }
  function avisar(texto: string) {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4500);
  }
  function abrirNova(data: string) {
    setErro('');
    setModal({ existente: null, entrada: entradaEmBranco({ dataInicio: data, ...(filtros.login !== '' ? semelhante(filtros.login) : {}) }) });
  }
  function semelhante(login: string): Partial<EntradaInformacao> {
    const pessoa = membros.find((item) => item.login === login);
    return pessoa ? { login: pessoa.login, nomeColaborador: pessoa.nome, equipeId: pessoa.equipeId } : {};
  }

  async function salvar(entrada: EntradaInformacao) {
    const existente = modal?.existente ?? null;
    const documento = montarDocumentoInformacao(entrada, existente?.id ?? gerarIdInformacao(), { login: autor.login, nome: autor.nome }, new Date().toISOString(), existente);
    if (modoDemo) setDemoEditada([...demoLista.filter((item) => item.id !== documento.id), documento]);
    else await salvarInformacao(documento);
    setModal(null);
    setDia(documento.dataInicio);
    setMes(documento.dataInicio.slice(0, 7));
    avisar(existente ? 'Informação atualizada.' : documento.visivelParaColaborador ? `Informação salva — ${documento.nomeColaborador.split(' ')[0]} vai vê-la no App.` : 'Informação salva.');
  }
  async function excluir(informacao: InformacaoDia) {
    setOcupado(true);
    setErro('');
    try {
      if (modoDemo) setDemoEditada(demoLista.filter((item) => item.id !== informacao.id));
      else await excluirInformacao(informacao.id);
      setExcluindo(null);
      avisar('Informação excluída.');
    } catch (falha) {
      setErro(mensagemErro(falha, 'Não foi possível excluir agora.'));
    } finally {
      setOcupado(false);
    }
  }

  const cartao = (informacao: InformacaoDia, mostrarDia = false) => (
    <CartaoInformacao key={informacao.id} informacao={informacao} equipe={nomeEquipe(informacao.equipeId)} mostrarDia={mostrarDia} hoje={hoje}
      onEditar={() => { setErro(''); setModal({ existente: informacao, entrada: entradaDaInformacao(informacao) }); }}
      onExcluir={() => { setErro(''); setExcluindo(informacao); }} />
  );
  const grupos = useMemo(() => {
    const mapa = new Map<string, InformacaoDia[]>();
    for (const informacao of ordenarInformacoes(doMes)) mapa.set(informacao.dataInicio, [...(mapa.get(informacao.dataInicio) ?? []), informacao]);
    return [...mapa.entries()];
  }, [doMes]);
  const filtrando = filtros.tipo !== 'TODOS' || filtros.login !== '' || filtros.visibilidade !== 'TODAS' || filtros.busca.trim() !== '';

  return (
    <section className="info-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Equipe</p>
          <h1>Informações</h1>
          <p>Registre atestados, afastamentos por horário, cursos e anotações sobre cada colaborador — e consulte tudo aqui.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => abrirNova(dia)}><Plus size={16} /> Nova informação</button>
      </header>

      {mensagem && <div className="alert success" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</div>}
      {(erroCarga || erroPessoas) && <div className="alert error" role="alert">{erroCarga || erroPessoas}</div>}

      <div className="info-resumo">
        <div data-destaque={resumo.pessoasHoje > 0 ? '' : undefined}>
          <span className="info-resumo-icone"><UserRound size={18} aria-hidden="true" /></span>
          <span><small>Hoje</small><strong>{resumo.pessoasHoje} {resumo.pessoasHoje === 1 ? 'pessoa' : 'pessoas'}</strong>
            <em>{quemEstaHoje.length === 0 ? 'Ninguém com informação' : quemEstaHoje.slice(0, 2).map((informacao) => informacao.nomeColaborador.split(' ')[0]).join(', ') + (quemEstaHoje.length > 2 ? ` e +${quemEstaHoje.length - 2}` : '')}</em></span>
        </div>
        <div><span className="info-resumo-icone"><StickyNote size={18} aria-hidden="true" /></span><span><small>Neste mês</small><strong>{resumo.noMes}</strong><em>{nomeDoMes(mes)}</em></span></div>
        <div><span className="info-resumo-icone" data-cor="rosa"><ICONE_INFORMACAO.atestado size={18} aria-hidden="true" /></span><span><small>Atestados no mês</small><strong>{resumo.atestadosNoMes}</strong><em>&nbsp;</em></span></div>
        <div><span className="info-resumo-icone" data-cor="azul"><Eye size={18} aria-hidden="true" /></span><span><small>O colaborador vê</small><strong>{resumo.visiveisNoMes}</strong><em>de {resumo.noMes} no mês</em></span></div>
      </div>

      <div className="info-barra">
        <div className="info-mes">
          <button type="button" className="icon-button" aria-label="Mês anterior" onClick={() => irParaMes(mesAdjacente(mes, -1))}><ChevronLeft size={18} /></button>
          <strong>{nomeDoMes(mes)}</strong>
          <button type="button" className="icon-button" aria-label="Próximo mês" onClick={() => irParaMes(mesAdjacente(mes, 1))}><ChevronRight size={18} /></button>
          <button type="button" className="secondary-button compact-button" onClick={() => { setMes(hoje.slice(0, 7)); setDia(hoje); }}>Hoje</button>
        </div>
        <div className="liderancas-abas" role="tablist" aria-label="Como ver">
          <button type="button" role="tab" aria-selected={visao === 'calendario'} className={visao === 'calendario' ? 'active' : ''} onClick={() => setVisao('calendario')}><CalendarDays size={14} aria-hidden="true" /> Calendário</button>
          <button type="button" role="tab" aria-selected={visao === 'lista'} className={visao === 'lista' ? 'active' : ''} onClick={() => setVisao('lista')}><List size={14} aria-hidden="true" /> Lista do mês</button>
        </div>
      </div>

      <div className="info-filtros">
        <label className="liderancas-busca"><Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar por nome, título ou observação" value={filtros.busca} onChange={(evento) => setFiltros((atual) => ({ ...atual, busca: evento.target.value }))} /></label>
        <select aria-label="Filtrar por pessoa" value={filtros.login} onChange={(evento) => setFiltros((atual) => ({ ...atual, login: evento.target.value }))}>
          <option value="">Todas as pessoas</option>
          {membros.map((pessoa) => <option key={pessoa.login} value={pessoa.login}>{pessoa.nome}</option>)}
        </select>
        <select aria-label="Filtrar por visibilidade" value={filtros.visibilidade} onChange={(evento) => setFiltros((atual) => ({ ...atual, visibilidade: evento.target.value as FiltrosInformacao['visibilidade'] }))}>
          <option value="TODAS">Visibilidade: todas</option>
          <option value="VISIVEL">O colaborador vê</option>
          <option value="RESERVADA">Só a liderança vê</option>
        </select>
        {filtrando && <button type="button" className="assistente-link" onClick={() => setFiltros(SEM_FILTROS)}><X size={14} aria-hidden="true" /> Limpar filtros</button>}
      </div>
      <div className="info-chips" role="radiogroup" aria-label="Tipo de informação">
        <button type="button" role="radio" aria-checked={filtros.tipo === 'TODOS'} className={filtros.tipo === 'TODOS' ? 'active' : ''} onClick={() => setFiltros((atual) => ({ ...atual, tipo: 'TODOS' }))}>Todas <span>{contagemPorTipo.TODOS}</span></button>
        {TIPOS_INFORMACAO.map((tipo) => {
          const Icone = ICONE_INFORMACAO[tipo.icone];
          return (
            <button key={tipo.chave} type="button" role="radio" data-cor={tipo.cor} aria-checked={filtros.tipo === tipo.chave} className={filtros.tipo === tipo.chave ? 'active' : ''} onClick={() => setFiltros((atual) => ({ ...atual, tipo: tipo.chave }))}>
              <Icone size={14} aria-hidden="true" /> {tipo.rotulo} <span>{contagemPorTipo[tipo.chave]}</span>
            </button>
          );
        })}
      </div>

      {visao === 'calendario' ? (
        <div className="info-colunas">
          <div className="info-calendario" role="grid" aria-label={`Calendário de ${nomeDoMes(mes)}`}>
            <div className="info-semana info-semana-titulos" role="row">{DIAS.map((nome) => <span key={nome} role="columnheader">{nome}</span>)}</div>
            {semanas.map((semana) => (
              <div key={semana[0]!.data} className="info-semana" role="row">
                {semana.map((celula) => {
                  const ponto = pontos.get(celula.data);
                  return (
                    <button key={celula.data} type="button" role="gridcell" className="info-dia" data-fora={celula.doMes ? undefined : ''} data-hoje={celula.data === hoje ? '' : undefined}
                      data-selecionado={celula.data === dia ? '' : undefined} aria-selected={celula.data === dia}
                      aria-label={`${tituloDoDia(celula.data)}${ponto ? `, ${ponto.total} ${ponto.total === 1 ? 'informação' : 'informações'}` : ''}`} onClick={() => selecionarDia(celula.data)}>
                      <span className="info-dia-numero">{Number(celula.data.slice(8))}</span>
                      {ponto && (
                        <span className="info-dia-pontos">
                          {ponto.tipos.slice(0, 4).map((tipo) => <i key={tipo} data-cor={metaDoTipo(tipo).cor} />)}
                          {ponto.total > 1 && <b>{ponto.total}</b>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <aside className="info-painel-dia" aria-label="Informações do dia selecionado">
            <header>
              <div>
                <small>{rotuloDiaRelativo(dia, hoje)}</small>
                <h2>{maiuscula(tituloDoDia(dia))}</h2>
              </div>
              <button type="button" className="secondary-button compact-button" onClick={() => abrirNova(dia)}><Plus size={14} aria-hidden="true" /> Adicionar</button>
            </header>
            {doDia.length === 0 ? (
              <div className="info-vazio">
                <StickyNote size={26} aria-hidden="true" />
                <strong>{filtrando ? 'Nada neste dia com esses filtros' : 'Nenhuma informação neste dia'}</strong>
                <small>{filtrando ? 'Limpe os filtros para ver tudo.' : 'Use “Adicionar” para registrar um atestado, curso ou anotação.'}</small>
              </div>
            ) : (
              <div className="info-lista">{doDia.map((informacao) => cartao(informacao))}</div>
            )}
          </aside>
        </div>
      ) : (
        <div className="info-lista-mes">
          {grupos.length === 0 ? (
            <div className="info-vazio panel">
              <StickyNote size={26} aria-hidden="true" />
              <strong>{filtrando ? 'Nada com esses filtros neste mês' : `Nenhuma informação em ${nomeDoMes(mes)}`}</strong>
              <small>Use “Nova informação” para registrar a primeira.</small>
            </div>
          ) : grupos.map(([data, lista]) => (
            <section key={data} className="info-grupo">
              <h3><span>{rotuloDiaRelativo(data, hoje)}</span> {maiuscula(tituloDoDia(data))}</h3>
              <div className="info-lista">{lista.map((informacao) => cartao(informacao, true))}</div>
            </section>
          ))}
        </div>
      )}

      {modal && (
        <InformacaoModal
          edicao={modal.existente !== null}
          entradaInicial={modal.entrada}
          pessoas={membros}
          nomeEquipe={nomeEquipe}
          onFechar={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
      {excluindo && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setExcluindo(null)}>
          <section className="edit-modal alteracao-problemas" role="alertdialog" aria-modal="true" aria-label="Excluir informação" onMouseDown={(evento) => evento.stopPropagation()}>
            <header className="criar-equipe-cabecalho">
              <span className="criar-equipe-icone alteracao-problemas-icone"><Trash2 size={18} aria-hidden="true" /></span>
              <div><h2>Excluir esta informação?</h2><p>{excluindo.nomeColaborador} · {tituloExibicao(excluindo)} · {descricaoPeriodo(excluindo)}</p></div>
              <button className="icon-button" type="button" onClick={() => setExcluindo(null)} aria-label="Fechar"><X size={18} /></button>
            </header>
            <p className="regra-exemplo">{excluindo.visivelParaColaborador ? 'O colaborador deixa de vê-la no App. ' : ''}Isso não pode ser desfeito.</p>
            {erro && <div className="alert error" role="alert">{erro}</div>}
            <div className="criar-equipe-acoes">
              <button type="button" className="secondary-button" disabled={ocupado} onClick={() => setExcluindo(null)}>Manter</button>
              <button type="button" className="primary-button danger-button" disabled={ocupado} onClick={() => void excluir(excluindo)}>Excluir</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function CartaoInformacao({ informacao, equipe, mostrarDia, hoje, onEditar, onExcluir }: {
  informacao: InformacaoDia; equipe: string; mostrarDia: boolean; hoje: string; onEditar: () => void; onExcluir: () => void;
}) {
  const meta = metaDoTipo(informacao.tipo);
  const Icone = ICONE_INFORMACAO[meta.icone];
  return (
    <article className="info-cartao" data-cor={meta.cor}>
      <header>
        <span className="info-avatar" aria-hidden="true">{iniciais(informacao.nomeColaborador)}</span>
        <span className="info-cartao-pessoa"><strong>{informacao.nomeColaborador}</strong><small>{equipe}</small></span>
        <span className="info-tipo-selo" data-cor={meta.cor}><Icone size={13} aria-hidden="true" /> {meta.rotulo}</span>
      </header>
      <p className="info-cartao-titulo">{tituloExibicao(informacao)}</p>
      <p className="info-cartao-quando">
        <CalendarDays size={13} aria-hidden="true" /> {mostrarDia || informacao.dataInicio !== informacao.dataFim ? `${descricaoPeriodo(informacao)}${informacao.dataFim < hoje ? ' (já passou)' : ''}` : 'Neste dia'}
        <span aria-hidden="true">·</span> <Clock3 size={13} aria-hidden="true" /> {descricaoHorario(informacao)}
      </p>
      {informacao.observacao && <p className="info-cartao-obs">{informacao.observacao}</p>}
      <footer>
        <span className="info-visibilidade-selo" data-visivel={informacao.visivelParaColaborador ? '' : undefined} title={informacao.visivelParaColaborador ? 'O colaborador vê esta informação no App.' : 'Só a liderança vê.'}>
          {informacao.visivelParaColaborador ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
          {informacao.visivelParaColaborador ? 'O colaborador vê' : 'Só a liderança'}
        </span>
        <span className="info-cartao-acoes">
          <button type="button" className="secondary-button compact-button" onClick={onEditar}><Pencil size={13} aria-hidden="true" /> Editar</button>
          <button type="button" className="icon-button" aria-label={`Excluir informação de ${informacao.nomeColaborador}`} title="Excluir" onClick={onExcluir}><Trash2 size={15} /></button>
        </span>
      </footer>
      {informacao.criadoPorNome && <small className="info-cartao-autoria">Registrada por {informacao.criadoPorNome}</small>}
    </article>
  );
}
