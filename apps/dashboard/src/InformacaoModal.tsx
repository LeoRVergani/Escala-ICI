import { useMemo, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Search, StickyNote, X } from 'lucide-react';

import { ICONE_INFORMACAO } from '@/components/iconesInformacao';
import {
  LIMITE_OBSERVACAO, LIMITE_TITULO, metaDoTipo, semAcento, TIPOS_INFORMACAO, validarEntradaInformacao,
  type EntradaInformacao, type TipoInformacao,
} from '@/lib/informacoesDia';
import { iniciais } from './pessoasLideranca';

/**
 * INFORMACOES-DIA-1 — janela de "Nova informação" / "Editar informação": escolher a pessoa, o que
 * aconteceu, quando e se o colaborador pode ver. Cada pedaço é um bloco numerado, em linguagem simples.
 */
export interface PessoaDaEquipe {
  login: string;
  nome: string;
  equipeId: string;
}

export function InformacaoModal({ edicao, entradaInicial, pessoas, nomeEquipe, onFechar, onSalvar }: {
  /** Editando: a pessoa fica travada (a informação pertence a ela). */
  edicao: boolean;
  entradaInicial: EntradaInformacao;
  pessoas: readonly PessoaDaEquipe[];
  nomeEquipe: (equipeId: string) => string;
  onFechar: () => void;
  onSalvar: (entrada: EntradaInformacao) => Promise<void>;
}) {
  const [entrada, setEntrada] = useState<EntradaInformacao>(entradaInicial);
  const [maisDeUmDia, setMaisDeUmDia] = useState(entradaInicial.dataFim !== '' && entradaInicial.dataFim !== entradaInicial.dataInicio);
  const [busca, setBusca] = useState('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroGravar, setErroGravar] = useState('');

  const meta = metaDoTipo(entrada.tipo);
  const erros = useMemo(() => validarEntradaInformacao({ ...entrada, dataFim: maisDeUmDia ? entrada.dataFim : '' }), [entrada, maisDeUmDia]);
  const candidatas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((pessoa) => termo === '' || semAcento(`${pessoa.nome} ${pessoa.login}`).includes(termo));
  }, [pessoas, busca]);
  const pessoaEscolhida = pessoas.find((pessoa) => pessoa.login === entrada.login);
  const primeiroNome = (entrada.nomeColaborador || 'o colaborador').split(' ')[0];

  function mudar(parte: Partial<EntradaInformacao>) {
    setEntrada((atual) => ({ ...atual, ...parte }));
  }
  function escolherTipo(tipo: TipoInformacao) {
    // afastamento por horário só faz sentido com horário: já deixa "Em um horário" marcado
    mudar({ tipo, ...(metaDoTipo(tipo).exigeHorario ? { diaTodo: false } : {}) });
  }
  async function salvar() {
    setTentou(true);
    if (erros.length > 0) return;
    setErroGravar('');
    setSalvando(true);
    try {
      await onSalvar({ ...entrada, dataFim: maisDeUmDia ? entrada.dataFim : '' });
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErroGravar(/permission|insufficient/iu.test(texto) ? 'Você não tem permissão para registrar informações desta pessoa.' : texto || 'Não foi possível salvar agora. Tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : onFechar}>
      <section className="edit-modal info-modal" role="dialog" aria-modal="true" aria-label={edicao ? 'Editar informação' : 'Nova informação'} onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><StickyNote size={18} aria-hidden="true" /></span>
          <div>
            <h2>{edicao ? 'Editar informação' : 'Nova informação'}</h2>
            <p>Registre o que aconteceu com um colaborador. Só você e a liderança veem, a menos que você libere.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={salvando} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="info-bloco">
          <h3><span>1</span> Quem?</h3>
          {edicao || pessoaEscolhida ? (
            <div className="info-pessoa-escolhida">
              <span className="info-avatar" aria-hidden="true">{iniciais(entrada.nomeColaborador)}</span>
              <span><strong>{entrada.nomeColaborador}</strong><small>{nomeEquipe(entrada.equipeId)}</small></span>
              {!edicao && <button type="button" className="secondary-button compact-button" onClick={() => mudar({ login: '', nomeColaborador: '', equipeId: '' })}>Trocar</button>}
            </div>
          ) : (
            <>
              <label className="info-busca"><Search size={16} aria-hidden="true" />
                <input type="search" placeholder="Buscar colaborador pelo nome" value={busca} onChange={(evento) => setBusca(evento.target.value)} /></label>
              <ul className="info-pessoas" aria-label="Colaboradores">
                {candidatas.length === 0 && <li className="info-vazio-lista">Ninguém com esse nome.</li>}
                {candidatas.map((pessoa) => (
                  <li key={pessoa.login}>
                    <button type="button" aria-label={`Escolher ${pessoa.nome}`} onClick={() => mudar({ login: pessoa.login, nomeColaborador: pessoa.nome, equipeId: pessoa.equipeId })}>
                      <span className="info-avatar" aria-hidden="true">{iniciais(pessoa.nome)}</span>
                      <span><strong>{pessoa.nome}</strong><small>{nomeEquipe(pessoa.equipeId)}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="info-bloco">
          <h3><span>2</span> O que aconteceu?</h3>
          <div className="info-tipos" role="radiogroup" aria-label="Tipo da informação">
            {TIPOS_INFORMACAO.map((tipo) => {
              const Icone = ICONE_INFORMACAO[tipo.icone];
              return (
                <button key={tipo.chave} type="button" role="radio" aria-checked={entrada.tipo === tipo.chave} data-cor={tipo.cor} className={entrada.tipo === tipo.chave ? 'active' : ''} onClick={() => escolherTipo(tipo.chave)}>
                  <span className="info-tipo-icone" aria-hidden="true"><Icone size={18} /></span>
                  <strong>{tipo.rotulo}</strong>
                  <small>{tipo.descricao}</small>
                </button>
              );
            })}
          </div>
          {meta.cuidado && <p className="info-cuidado" role="note">{meta.cuidado}</p>}
        </div>

        <div className="info-bloco">
          <h3><span>3</span> Quando?</h3>
          <div className="info-quando">
            <label className="criar-equipe-campo"><span>{maisDeUmDia ? 'Primeiro dia' : 'Dia'}</span>
              <input type="date" value={entrada.dataInicio} onChange={(evento) => mudar({ dataInicio: evento.target.value })} /></label>
            {maisDeUmDia && (
              <label className="criar-equipe-campo"><span>Último dia</span>
                <input type="date" value={entrada.dataFim} min={entrada.dataInicio} onChange={(evento) => mudar({ dataFim: evento.target.value })} /></label>
            )}
          </div>
          <label className="info-opcao-simples">
            <input type="checkbox" checked={maisDeUmDia} onChange={(evento) => { setMaisDeUmDia(evento.target.checked); mudar({ dataFim: evento.target.checked ? (entrada.dataFim || entrada.dataInicio) : '' }); }} />
            Dura mais de um dia
          </label>
          <div className="liderancas-abas info-horario" role="radiogroup" aria-label="Horário">
            <button type="button" role="radio" aria-checked={entrada.diaTodo} disabled={meta.exigeHorario} className={entrada.diaTodo ? 'active' : ''} onClick={() => mudar({ diaTodo: true })}>Dia todo</button>
            <button type="button" role="radio" aria-checked={!entrada.diaTodo} className={!entrada.diaTodo ? 'active' : ''} onClick={() => mudar({ diaTodo: false })}>Em um horário</button>
          </div>
          {!entrada.diaTodo && (
            <div className="info-quando">
              <label className="criar-equipe-campo"><span>Das</span>
                <input type="time" value={entrada.horaInicio} onChange={(evento) => mudar({ horaInicio: evento.target.value })} /></label>
              <label className="criar-equipe-campo"><span>Até</span>
                <input type="time" value={entrada.horaFim} onChange={(evento) => mudar({ horaFim: evento.target.value })} /></label>
            </div>
          )}
        </div>

        <div className="info-bloco">
          <h3><span>4</span> Detalhes <small>(opcional)</small></h3>
          <label className="criar-equipe-campo"><span>Título {entrada.tipo === 'OUTRO' && <b>(obrigatório)</b>}</span>
            <input value={entrada.titulo} maxLength={LIMITE_TITULO} placeholder={meta.placeholderTitulo} onChange={(evento) => mudar({ titulo: evento.target.value })} /></label>
          <label className="criar-equipe-campo"><span>Observações <small>{entrada.observacao.length}/{LIMITE_OBSERVACAO}</small></span>
            <textarea rows={3} maxLength={LIMITE_OBSERVACAO} value={entrada.observacao} placeholder="Algo que ajude a lembrar depois" onChange={(evento) => mudar({ observacao: evento.target.value })} /></label>
        </div>

        <label className="info-visibilidade" data-ativa={entrada.visivelParaColaborador ? '' : undefined}>
          <input type="checkbox" role="switch" checked={entrada.visivelParaColaborador} onChange={(evento) => mudar({ visivelParaColaborador: evento.target.checked })} />
          <span className="info-chave" aria-hidden="true"><i /></span>
          <span>
            <strong>{entrada.visivelParaColaborador ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />} Mostrar para o colaborador no App</strong>
            <small>{entrada.visivelParaColaborador
              ? `${primeiroNome} vai ver esta informação no App, na aba Hoje, até a data passar.`
              : 'Só você e as outras lideranças da equipe veem. O colaborador não sabe.'}</small>
          </span>
        </label>

        {tentou && erros.length > 0 && (
          <ul className="info-erros" role="alert">{erros.map((erro) => <li key={erro}>{erro}</li>)}</ul>
        )}
        {erroGravar && <div className="alert error" role="alert">{erroGravar}</div>}
        <footer className="assistente-rodape">
          <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null} {edicao ? 'Salvar alterações' : 'Salvar informação'}
          </button>
        </footer>
      </section>
    </div>
  );
}
