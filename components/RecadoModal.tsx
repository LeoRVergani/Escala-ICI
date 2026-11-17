import { useMemo, useState } from 'react';
import { LoaderCircle, MessageSquareText, Search, X } from 'lucide-react';

import { semAcento } from '@/lib/informacoesDia';
import { LIMITE_DIARIO_RECADOS, LIMITE_TEXTO_RECADO, MAXIMO_DESTINATARIOS, restanteHoje, validarEntradaRecado, type DestinatarioRecado, type EntradaRecado } from '@/lib/recados';

/**
 * RECADOS-2 — "Novo recado" (usado no App pelos colegas e no Dashboard pela liderança): escolher uma ou mais
 * pessoas da equipe ou do Plantão e escrever do jeito que quiser. Cada pessoa recebe o seu recado e conta 1 no limite do dia.
 */
export interface PessoaParaRecado extends DestinatarioRecado {
  /** De onde a pessoa vem: "Minha equipe", o nome do Plantão, o nome da equipe… (vira um filtro). */
  rotulo: string;
}

const iniciaisDoNome = (nome: string) => nome.split(/\s+/u).filter(Boolean).slice(0, 2).map((parte) => parte[0]!.toUpperCase()).join('');

export function RecadoModal({ pessoas, contagemHoje, onFechar, onEnviar }: {
  pessoas: readonly PessoaParaRecado[];
  contagemHoje: number;
  onFechar: () => void;
  onEnviar: (entrada: EntradaRecado) => Promise<void>;
}) {
  const [escolhidas, setEscolhidas] = useState<PessoaParaRecado[]>([]);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');

  const restante = restanteHoje(contagemHoje);
  const origens = useMemo(() => [...new Set(pessoas.map((pessoa) => pessoa.rotulo))], [pessoas]);
  const erros = useMemo(() => validarEntradaRecado({ destinatarios: escolhidas, texto }, restante), [escolhidas, texto, restante]);
  const candidatas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((pessoa) => (origem === '' || pessoa.rotulo === origem) && (termo === '' || semAcento(pessoa.nome).includes(termo)));
  }, [pessoas, busca, origem]);
  const todasMarcadas = candidatas.length > 0 && candidatas.every((pessoa) => escolhidas.some((item) => item.login === pessoa.login));

  function alternar(pessoa: PessoaParaRecado) {
    setEscolhidas((atuais) => (atuais.some((item) => item.login === pessoa.login) ? atuais.filter((item) => item.login !== pessoa.login) : [...atuais, pessoa]));
  }
  /** "Selecionar todos" marca (ou desmarca) quem está na lista filtrada, até o máximo por recado. */
  function alternarTodos() {
    setEscolhidas((atuais) => {
      if (todasMarcadas) return atuais.filter((item) => !candidatas.some((pessoa) => pessoa.login === item.login));
      const novos = candidatas.filter((pessoa) => !atuais.some((item) => item.login === pessoa.login));
      return [...atuais, ...novos].slice(0, MAXIMO_DESTINATARIOS);
    });
  }
  async function enviar() {
    setTentou(true);
    if (erros.length > 0) return;
    setErroEnvio('');
    setEnviando(true);
    try {
      await onEnviar({ destinatarios: escolhidas, texto });
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : '';
      setErroEnvio(/permission|insufficient/iu.test(mensagem)
        ? 'O envio foi recusado. Confira se o limite de hoje não acabou, se a pessoa é da sua equipe ou do seu Plantão e se as Regras do Firestore desta versão já foram publicadas.'
        : mensagem || 'Não foi possível enviar agora. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={enviando ? undefined : onFechar}>
      <section className="edit-modal info-modal" role="dialog" aria-modal="true" aria-label="Novo recado" onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><MessageSquareText size={18} aria-hidden="true" /></span>
          <div>
            <h2>Novo recado</h2>
            <p>Escreva do seu jeito. A pessoa responde do jeito dela, e o recado some depois que você vê a resposta.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={enviando} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="info-rolagem">
          <div className="info-bloco">
            <h3><span>1</span> Para quem? <small>(até {MAXIMO_DESTINATARIOS})</small></h3>
            {escolhidas.length > 0 && (
              <div className="recado-escolhidas" aria-label="Pessoas escolhidas">
                {escolhidas.map((pessoa) => (
                  <button key={pessoa.login} type="button" onClick={() => alternar(pessoa)} aria-label={`Tirar ${pessoa.nome}`}>
                    {pessoa.nome.split(' ')[0]} <X size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {origens.length > 1 && (
              <div className="info-chips" role="radiogroup" aria-label="De onde">
                <button type="button" role="radio" aria-checked={origem === ''} className={origem === '' ? 'active' : ''} onClick={() => setOrigem('')}>Todos</button>
                {origens.map((rotulo) => (
                  <button key={rotulo} type="button" role="radio" aria-checked={origem === rotulo} className={origem === rotulo ? 'active' : ''} onClick={() => setOrigem(rotulo)}>{rotulo}</button>
                ))}
              </div>
            )}
            <label className="info-busca"><Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Buscar pelo nome" value={busca} onChange={(evento) => setBusca(evento.target.value)} /></label>
            {candidatas.length > 1 && (
              <button type="button" className="assistente-link" onClick={alternarTodos}>{todasMarcadas ? 'Desmarcar todos' : `Selecionar todos (até ${MAXIMO_DESTINATARIOS})`}</button>
            )}
            <ul className="info-pessoas" aria-label="Pessoas">
              {candidatas.length === 0 && <li className="info-vazio-lista">{pessoas.length === 0 ? 'Não encontrei colegas da sua equipe ou do seu Plantão.' : 'Ninguém com esse nome.'}</li>}
              {candidatas.map((pessoa) => {
                const marcada = escolhidas.some((item) => item.login === pessoa.login);
                return (
                  <li key={pessoa.login}>
                    <button type="button" aria-pressed={marcada} data-marcada={marcada ? '' : undefined} onClick={() => alternar(pessoa)}>
                      <span className="info-avatar" aria-hidden="true">{iniciaisDoNome(pessoa.nome)}</span>
                      <span><strong>{pessoa.nome}</strong><small>{pessoa.rotulo}</small></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="info-bloco">
            <h3><span>2</span> O recado</h3>
            <label className="criar-equipe-campo"><span>Escreva do seu jeito <small>{texto.length}/{LIMITE_TEXTO_RECADO}</small></span>
              <textarea rows={4} maxLength={LIMITE_TEXTO_RECADO} value={texto} placeholder="Ex.: Você pode trocar comigo no dia 20? Fico com a sua manhã." onChange={(evento) => setTexto(evento.target.value)} /></label>
          </div>

          <p className="recado-limite">
            Hoje você já enviou <strong>{contagemHoje}</strong> de {LIMITE_DIARIO_RECADOS} recados. Este envio usa <strong>{escolhidas.length || 1}</strong>.
          </p>
          {tentou && erros.length > 0 && <ul className="info-erros" role="alert">{erros.map((erro) => <li key={erro}>{erro}</li>)}</ul>}
          {erroEnvio && <div className="alert error" role="alert">{erroEnvio}</div>}
        </div>

        <footer className="assistente-rodape">
          <button type="button" className="secondary-button" disabled={enviando} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button" disabled={enviando} onClick={() => void enviar()}>
            {enviando ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null} Enviar{escolhidas.length > 1 ? ` para ${escolhidas.length} pessoas` : ''}
          </button>
        </footer>
      </section>
    </div>
  );
}
