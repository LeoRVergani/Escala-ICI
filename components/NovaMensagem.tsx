import { useMemo, useState } from 'react';
import { LoaderCircle, Search, Send, User, Users, X } from 'lucide-react';

import { semAcento } from '@/lib/informacoesDia';
import {
  LIMITE_DIARIO_RECADOS, LIMITE_TEXTO_RECADO, restanteHoje, rotuloDoAlvo, validarEntradaMensagem,
  type AlvoRecado, type DestinatarioRecado, type DestinoMensagem, type EntradaMensagem,
} from '@/lib/recados';

/**
 * RECADOS-3 — "Nova mensagem", como começar uma conversa no Teams: escolha PARA QUEM (uma pessoa, a equipe, o Plantão
 * ou todos), escreva e envie. Para um grupo é UMA mensagem só e cada um responde do seu jeito.
 */
export interface PessoaParaRecado extends DestinatarioRecado {
  /** De onde a pessoa vem ("Equipe SOC", "Plantão COSI"…), só para mostrar. */
  rotulo: string;
}

const iniciaisDoNome = (nome: string) => nome.split(/\s+/u).filter(Boolean).slice(0, 2).map((parte) => parte[0]!.toUpperCase()).join('');
const chaveDoAlvo = (alvo: AlvoRecado) => `${alvo.tipo}:${alvo.id}`;

export function NovaMensagem({ grupos, pessoas, contagemHoje, onFechar, onEnviar }: {
  /** Os grupos para onde posso mandar: a equipe e/ou os Plantões. */
  grupos: readonly AlvoRecado[];
  pessoas: readonly PessoaParaRecado[];
  contagemHoje: number;
  onFechar: () => void;
  onEnviar: (entrada: EntradaMensagem) => Promise<void>;
}) {
  /** 'pessoa' | 'todos' | chave de um grupo | null (ainda não escolheu) */
  const [escolha, setEscolha] = useState<string | null>(grupos.length === 1 && pessoas.length === 0 ? chaveDoAlvo(grupos[0]!) : null);
  const [pessoa, setPessoa] = useState<PessoaParaRecado | null>(null);
  const [busca, setBusca] = useState('');
  const [texto, setTexto] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');

  const destino = useMemo<DestinoMensagem | null>(() => {
    if (escolha === 'pessoa') return pessoa === null ? null : { tipo: 'PESSOA', pessoa };
    if (escolha === 'todos') return { tipo: 'GRUPOS', alvos: grupos };
    const alvo = grupos.find((item) => chaveDoAlvo(item) === escolha);
    return alvo ? { tipo: 'GRUPOS', alvos: [alvo] } : null;
  }, [escolha, pessoa, grupos]);
  const restante = restanteHoje(contagemHoje);
  const erros = useMemo(() => validarEntradaMensagem({ destino, texto }, restante), [destino, texto, restante]);
  const candidatas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((item) => termo === '' || semAcento(item.nome).includes(termo)).slice(0, 60);
  }, [pessoas, busca]);

  const resumo = destino === null ? null
    : destino.tipo === 'PESSOA' ? destino.pessoa.nome
      : destino.alvos.map((alvo) => rotuloDoAlvo(alvo)).join(' e ');

  async function enviar() {
    setTentou(true);
    if (erros.length > 0) return;
    setErroEnvio('');
    setEnviando(true);
    try {
      await onEnviar({ destino, texto });
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : '';
      setErroEnvio(/permission|insufficient/iu.test(mensagem)
        ? 'O envio foi recusado. Confira se o limite de hoje não acabou e se você faz parte da equipe ou do Plantão escolhido. Se tudo estiver certo, falta publicar a atualização do banco de dados: avise o administrador do sistema.'
        : mensagem || 'Não foi possível enviar agora. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={enviando ? undefined : onFechar}>
      <section className="edit-modal info-modal nova-msg" role="dialog" aria-modal="true" aria-label="Nova mensagem" onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="nova-msg-topo">
          <h2>Nova mensagem</h2>
          <button className="icon-button" type="button" onClick={onFechar} disabled={enviando} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="info-rolagem nova-msg-corpo">
          <div className="nova-msg-campo">
            <span className="nova-msg-rotulo">Para</span>
            <div className="nova-msg-opcoes" role="radiogroup" aria-label="Para quem">
              {pessoas.length > 0 && (
                <button type="button" role="radio" aria-checked={escolha === 'pessoa'} className={escolha === 'pessoa' ? 'ativa' : ''} onClick={() => setEscolha('pessoa')}>
                  <User size={16} aria-hidden="true" /> Uma pessoa
                </button>
              )}
              {grupos.map((alvo) => (
                <button key={chaveDoAlvo(alvo)} type="button" role="radio" aria-checked={escolha === chaveDoAlvo(alvo)} className={escolha === chaveDoAlvo(alvo) ? 'ativa' : ''} onClick={() => setEscolha(chaveDoAlvo(alvo))}>
                  <Users size={16} aria-hidden="true" /> {alvo.nome}{alvo.quantidade !== undefined && <small>{alvo.quantidade}</small>}
                </button>
              ))}
              {grupos.length > 1 && (
                <button type="button" role="radio" aria-checked={escolha === 'todos'} className={escolha === 'todos' ? 'ativa' : ''} onClick={() => setEscolha('todos')}>
                  <Users size={16} aria-hidden="true" /> Todos
                </button>
              )}
            </div>
          </div>

          {escolha === 'pessoa' && (
            <div className="nova-msg-campo">
              {pessoa !== null ? (
                <div className="nova-msg-escolhida">
                  <span className="info-avatar" aria-hidden="true">{iniciaisDoNome(pessoa.nome)}</span>
                  <span><strong>{pessoa.nome}</strong><small>{pessoa.rotulo}</small></span>
                  <button type="button" className="assistente-link" onClick={() => setPessoa(null)}>Trocar</button>
                </div>
              ) : (
                <>
                  <label className="nova-msg-busca"><Search size={16} aria-hidden="true" />
                    <input type="search" autoFocus placeholder="Buscar pelo nome" value={busca} onChange={(evento) => setBusca(evento.target.value)} /></label>
                  <ul className="nova-msg-pessoas" aria-label="Pessoas">
                    {candidatas.length === 0 && <li className="info-vazio-lista">{pessoas.length === 0 ? 'Não encontrei colegas da sua equipe ou do seu Plantão.' : 'Ninguém com esse nome.'}</li>}
                    {candidatas.map((item) => (
                      <li key={item.login}>
                        <button type="button" onClick={() => setPessoa(item)}>
                          <span className="info-avatar" aria-hidden="true">{iniciaisDoNome(item.nome)}</span>
                          <span><strong>{item.nome}</strong><small>{item.rotulo}</small></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="nova-msg-campo">
            {resumo !== null && <p className="nova-msg-resumo">Vai para <strong>{resumo}</strong>{destino?.tipo === 'GRUPOS' ? '. Cada um responde do seu jeito e você vê tudo junto.' : '.'}</p>}
            <textarea className="nova-msg-texto" rows={5} maxLength={LIMITE_TEXTO_RECADO} value={texto} aria-label="Mensagem" placeholder="Escreva a sua mensagem…" onChange={(evento) => setTexto(evento.target.value)} />
            <small className="nova-msg-contagem">{texto.length}/{LIMITE_TEXTO_RECADO}</small>
          </div>

          {tentou && erros.length > 0 && <ul className="info-erros" role="alert">{erros.map((erro) => <li key={erro}>{erro}</li>)}</ul>}
          {erroEnvio && <div className="alert error" role="alert">{erroEnvio}</div>}
        </div>

        <footer className="nova-msg-rodape">
          <small>{contagemHoje} de {LIMITE_DIARIO_RECADOS} mensagens enviadas hoje</small>
          <span>
            <button type="button" className="secondary-button" disabled={enviando} onClick={onFechar}>Cancelar</button>
            <button type="button" className="primary-button" disabled={enviando} onClick={() => void enviar()}>
              {enviando ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />} Enviar
            </button>
          </span>
        </footer>
      </section>
    </div>
  );
}
