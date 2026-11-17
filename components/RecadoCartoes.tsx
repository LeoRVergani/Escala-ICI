import { useState } from 'react';
import { CheckCircle2, Clock3, Trash2, Users } from 'lucide-react';

import { formatarDiaMes } from '@/lib/informacoesDia';
import {
  LIMITE_RESPOSTA_RECADO, RESPOSTAS_RAPIDAS, rotuloRespostasDoGrupo, validarResposta, type EstadoParaRemetente, type Recado, type RecadoGrupo,
} from '@/lib/recados';

/**
 * RECADOS-3 — os cartões das mensagens, iguais no App e no Dashboard, em forma de "balões" (como uma conversa):
 *  - `CartaoEnviadoPessoa` / `CartaoEnviadoGrupo`: o que EU enviei e as respostas que chegaram (balão meu + balões deles);
 *  - `CartaoRecebido`: o que EU recebi (de uma pessoa ou para o meu grupo), com a resposta livre e os atalhos.
 * O texto é sempre TEXTO (nunca HTML): quem escreve não injeta nada na tela de ninguém.
 */
const iniciaisDoNome = (nome: string) => nome.split(/\s+/u).filter(Boolean).slice(0, 2).map((parte) => parte[0]!.toUpperCase()).join('');
const dataHora = (iso: string) => {
  const data = new Date(iso);
  return `${formatarDiaMes(iso.slice(0, 10))} às ${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
};
const primeiroNome = (nome: string) => nome.split(' ')[0] ?? nome;

const ROTULO_ESTADO: Record<EstadoParaRemetente, string> = { AGUARDANDO: 'Aguardando resposta', RESPONDIDO: 'Respondeu', EXPIRADO: 'Venceu' };

export function CartaoEnviadoPessoa({ recado, subtitulo, estado, ocupado, onApagar }: {
  recado: Recado; subtitulo?: string; estado: EstadoParaRemetente; ocupado: boolean; onApagar: () => void;
}) {
  const respondido = recado.status === 'RESPONDIDO';
  return (
    <article className="msg-cartao" data-estado={estado}>
      <header className="msg-topo">
        <span className="info-avatar" aria-hidden="true">{iniciaisDoNome(recado.destinatarioNome)}</span>
        <span className="msg-quem"><strong>Para {recado.destinatarioNome}</strong>{subtitulo && <small>{subtitulo}</small>}</span>
        <span className="msg-selo" data-estado={estado}>{respondido ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />} {ROTULO_ESTADO[estado]}</span>
      </header>
      <div className="msg-bolha" data-lado="minha"><p>{recado.texto}</p><time>{dataHora(recado.criadoEm)}</time></div>
      {respondido && (
        <div className="msg-bolha" data-lado="deles"><b>{primeiroNome(recado.destinatarioNome)}</b><p>{recado.resposta}</p>{recado.respondidoEm && <time>{dataHora(recado.respondidoEm)}</time>}</div>
      )}
      <footer className="msg-acoes">
        <button type="button" className={respondido ? 'primary-button compact-button' : 'secondary-button compact-button'} disabled={ocupado} onClick={onApagar}>
          {respondido ? <><CheckCircle2 size={13} aria-hidden="true" /> Ok, apagar</> : <><Trash2 size={13} aria-hidden="true" /> Cancelar</>}
        </button>
      </footer>
    </article>
  );
}

export function CartaoEnviadoGrupo({ grupo, quantidade, ocupado, onApagar }: {
  grupo: RecadoGrupo; /** quantas pessoas tem o grupo, se souber */ quantidade?: number; ocupado: boolean; onApagar: () => void;
}) {
  const respondeu = grupo.respostas.length > 0;
  return (
    <article className="msg-cartao" data-estado={respondeu ? 'RESPONDIDO' : 'AGUARDANDO'}>
      <header className="msg-topo">
        <span className="info-avatar msg-avatar-grupo" aria-hidden="true"><Users size={16} /></span>
        <span className="msg-quem"><strong>Para {grupo.alvoNome}</strong>{quantidade !== undefined && <small>{quantidade} {quantidade === 1 ? 'pessoa' : 'pessoas'}</small>}</span>
        <span className="msg-selo" data-estado={respondeu ? 'RESPONDIDO' : 'AGUARDANDO'}>{respondeu ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />} {rotuloRespostasDoGrupo(grupo, quantidade)}</span>
      </header>
      <div className="msg-bolha" data-lado="minha"><p>{grupo.texto}</p><time>{dataHora(grupo.criadoEm)}</time></div>
      {grupo.respostas.map((resposta) => (
        <div key={resposta.login} className="msg-bolha" data-lado="deles"><b>{primeiroNome(resposta.nome)}</b><p>{resposta.texto}</p><time>{dataHora(resposta.em)}</time></div>
      ))}
      <footer className="msg-acoes">
        <button type="button" className={respondeu ? 'primary-button compact-button' : 'secondary-button compact-button'} disabled={ocupado} onClick={onApagar}>
          {respondeu ? <><CheckCircle2 size={13} aria-hidden="true" /> Ok, apagar</> : <><Trash2 size={13} aria-hidden="true" /> Cancelar</>}
        </button>
      </footer>
    </article>
  );
}

/** O que EU recebi: de uma pessoa, ou para o meu grupo (`paraRotulo`). A resposta é livre; os atalhos só preenchem o campo. */
export function CartaoRecebido({ deNome, paraRotulo, quando, texto, onResponder }: {
  deNome: string; paraRotulo?: string; quando: string; texto: string; onResponder: (resposta: string) => Promise<void>;
}) {
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function responder() {
    const erros = validarResposta(resposta);
    if (erros.length > 0) { setErro(erros[0]!); return; }
    setErro('');
    setEnviando(true);
    try {
      await onResponder(resposta.trim());
    } catch {
      setErro('Não foi possível enviar a resposta. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <article className="msg-cartao msg-recebido">
      <header className="msg-topo">
        <span className="info-avatar" aria-hidden="true">{iniciaisDoNome(deNome)}</span>
        <span className="msg-quem"><strong>{deNome}</strong>{paraRotulo && <small>para {paraRotulo}</small>}</span>
        <small className="msg-quando">{dataHora(quando)}</small>
      </header>
      <div className="msg-bolha" data-lado="deles"><p>{texto}</p></div>
      <textarea rows={2} maxLength={LIMITE_RESPOSTA_RECADO} value={resposta} aria-label={`Sua resposta para ${deNome}`} placeholder="Escreva a sua resposta…" onChange={(evento) => setResposta(evento.target.value)} />
      <div className="msg-rapidas" aria-label="Respostas rápidas">
        {RESPOSTAS_RAPIDAS.map((atalho) => (
          <button key={atalho} type="button" disabled={enviando} onClick={() => setResposta(atalho)}>{atalho}</button>
        ))}
        <button type="button" className="primary-button compact-button msg-enviar" disabled={enviando} onClick={() => void responder()}>Responder</button>
      </div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
    </article>
  );
}
