import { useMemo, useState } from 'react';
import { LoaderCircle, MessageSquareText, Search, X } from 'lucide-react';

import {
  LIMITE_DIARIO_RECADOS, LIMITE_TEXTO_RECADO, MAXIMO_DESTINATARIOS, restanteHoje, validarEntradaRecado, type EntradaRecado, type TipoRecado,
} from '@/lib/recados';
import { semAcento } from '@/lib/informacoesDia';
import { iniciais } from './pessoasLideranca';
import type { PessoaDaEquipe } from './InformacaoModal';

/**
 * RECADOS-1 — "Novo recado": escolher quem recebe, se espera uma resposta (posso / não posso) ou só avisa,
 * e escrever o texto livre. Cada pessoa recebe o seu recado e conta 1 no limite do dia.
 */
export function RecadoModal({ pessoas, nomeEquipe, contagemHoje, onFechar, onEnviar }: {
  pessoas: readonly PessoaDaEquipe[];
  nomeEquipe: (equipeId: string) => string;
  contagemHoje: number;
  onFechar: () => void;
  onEnviar: (entrada: EntradaRecado) => Promise<void>;
}) {
  const [escolhidas, setEscolhidas] = useState<PessoaDaEquipe[]>([]);
  const [tipo, setTipo] = useState<TipoRecado>('PERGUNTA');
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');

  const restante = restanteHoje(contagemHoje);
  const erros = useMemo(() => validarEntradaRecado({ destinatarios: escolhidas, tipo, texto }, restante), [escolhidas, tipo, texto, restante]);
  const candidatas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((pessoa) => termo === '' || semAcento(`${pessoa.nome} ${pessoa.login}`).includes(termo));
  }, [pessoas, busca]);

  function alternar(pessoa: PessoaDaEquipe) {
    setEscolhidas((atuais) => (atuais.some((item) => item.login === pessoa.login) ? atuais.filter((item) => item.login !== pessoa.login) : [...atuais, pessoa]));
  }
  async function enviar() {
    setTentou(true);
    if (erros.length > 0) return;
    setErroEnvio('');
    setEnviando(true);
    try {
      await onEnviar({ destinatarios: escolhidas, tipo, texto });
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : '';
      setErroEnvio(/permission|insufficient/iu.test(mensagem)
        ? 'O envio foi recusado. Confira se o limite de hoje não acabou, se a pessoa é da sua equipe e se as Regras do Firestore desta versão já foram publicadas.'
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
            <p>Um recado curto, sem conversa: a pessoa responde com um toque e o recado é apagado depois.</p>
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
            <label className="info-busca"><Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Buscar colaborador pelo nome" value={busca} onChange={(evento) => setBusca(evento.target.value)} /></label>
            <ul className="info-pessoas" aria-label="Colaboradores">
              {candidatas.length === 0 && <li className="info-vazio-lista">Ninguém com esse nome.</li>}
              {candidatas.map((pessoa) => {
                const marcada = escolhidas.some((item) => item.login === pessoa.login);
                return (
                  <li key={pessoa.login}>
                    <button type="button" aria-pressed={marcada} data-marcada={marcada ? '' : undefined} onClick={() => alternar(pessoa)}>
                      <span className="info-avatar" aria-hidden="true">{iniciais(pessoa.nome)}</span>
                      <span><strong>{pessoa.nome}</strong><small>{nomeEquipe(pessoa.equipeId)}</small></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="info-bloco">
            <h3><span>2</span> O que você precisa?</h3>
            <div className="info-tipos" role="radiogroup" aria-label="Tipo de recado">
              <button type="button" role="radio" aria-checked={tipo === 'PERGUNTA'} data-cor="azul" className={tipo === 'PERGUNTA' ? 'active' : ''} onClick={() => setTipo('PERGUNTA')}>
                <strong>Uma resposta</strong><small>A pessoa responde “Posso” ou “Não posso”.</small>
              </button>
              <button type="button" role="radio" aria-checked={tipo === 'AVISO'} data-cor="roxo" className={tipo === 'AVISO' ? 'active' : ''} onClick={() => setTipo('AVISO')}>
                <strong>Só avisar</strong><small>A pessoa toca em “Entendi”.</small>
              </button>
            </div>
          </div>

          <div className="info-bloco">
            <h3><span>3</span> O recado</h3>
            <label className="criar-equipe-campo"><span>Escreva do seu jeito <small>{texto.length}/{LIMITE_TEXTO_RECADO}</small></span>
              <textarea rows={4} maxLength={LIMITE_TEXTO_RECADO} value={texto} placeholder={tipo === 'PERGUNTA' ? 'Ex.: Você pode trocar comigo no dia 20?' : 'Ex.: Amanhã a reunião começa às 9h.'} onChange={(evento) => setTexto(evento.target.value)} /></label>
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
