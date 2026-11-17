import { useState } from 'react';
import { CheckCircle2, Clock3, Trash2 } from 'lucide-react';

import { formatarDiaMes } from '@/lib/informacoesDia';
import { LIMITE_RESPOSTA_RECADO, RESPOSTAS_RAPIDAS, validarResposta, type EstadoParaRemetente, type Recado } from '@/lib/recados';

/**
 * RECADOS-2 — os cartões do recado, iguais no App e no Dashboard:
 *  - `CartaoRecadoEnviado`: o que EU enviei (aguardando, ou a resposta livre da pessoa) com "Ok, apagar" / "Cancelar";
 *  - `CartaoRecadoRecebido`: o que EU recebi, com o campo de resposta livre e os atalhos Posso / Não posso / Entendi.
 * O texto é sempre TEXTO (nunca HTML): quem escreve não injeta nada na tela de ninguém.
 */
const iniciaisDoNome = (nome: string) => nome.split(/\s+/u).filter(Boolean).slice(0, 2).map((parte) => parte[0]!.toUpperCase()).join('');
const dataHora = (iso: string) => {
  const data = new Date(iso);
  return `${formatarDiaMes(iso.slice(0, 10))} às ${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
};

const ROTULO_ESTADO: Record<EstadoParaRemetente, string> = { AGUARDANDO: 'Aguardando resposta', RESPONDIDO: 'Respondeu', EXPIRADO: 'Venceu' };

export function CartaoRecadoEnviado({ recado, subtitulo, estado, ocupado, onApagar }: {
  recado: Recado; subtitulo?: string; estado: EstadoParaRemetente; ocupado: boolean; onApagar: () => void;
}) {
  const respondido = recado.status === 'RESPONDIDO';
  return (
    <article className="recado-cartao" data-estado={estado}>
      <header>
        <span className="info-avatar" aria-hidden="true">{iniciaisDoNome(recado.destinatarioNome)}</span>
        <span className="info-cartao-pessoa"><strong>{recado.destinatarioNome}</strong>{subtitulo && <small>{subtitulo}</small>}</span>
        <span className="recado-selo" data-estado={estado}>
          {estado === 'RESPONDIDO' ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
          {ROTULO_ESTADO[estado]}
        </span>
      </header>
      <p className="recado-texto">{recado.texto}</p>
      {respondido && <p className="recado-nota"><b>{recado.destinatarioNome.split(' ')[0]} respondeu:</b> {recado.resposta}</p>}
      <footer>
        <small>Enviado {dataHora(recado.criadoEm)}</small>
        <button type="button" className={respondido ? 'primary-button compact-button' : 'secondary-button compact-button'} disabled={ocupado} onClick={onApagar}>
          {respondido ? <><CheckCircle2 size={13} aria-hidden="true" /> Ok, apagar</> : <><Trash2 size={13} aria-hidden="true" /> Cancelar recado</>}
        </button>
      </footer>
    </article>
  );
}

export function CartaoRecadoRecebido({ recado, onResponder }: { recado: Recado; onResponder: (recado: Recado, resposta: string) => Promise<void> }) {
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const erros = validarResposta(resposta);

  async function responder() {
    if (erros.length > 0) { setErro(erros[0]!); return; }
    setErro('');
    setEnviando(true);
    try {
      await onResponder(recado, resposta.trim());
    } catch {
      setErro('Não foi possível enviar a resposta. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <article className="recado-app-item">
      <header><strong>{recado.remetenteNome}</strong><small>{dataHora(recado.criadoEm)}</small></header>
      <p className="recado-app-texto">{recado.texto}</p>
      <textarea rows={2} maxLength={LIMITE_RESPOSTA_RECADO} value={resposta} aria-label={`Sua resposta para ${recado.remetenteNome}`} placeholder="Escreva a sua resposta" onChange={(evento) => setResposta(evento.target.value)} />
      <div className="recado-rapidas" aria-label="Respostas rápidas">
        {RESPOSTAS_RAPIDAS.map((atalho) => (
          <button key={atalho} type="button" disabled={enviando} onClick={() => setResposta(atalho)}>{atalho}</button>
        ))}
      </div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <button type="button" className="primary-button" disabled={enviando} onClick={() => void responder()}>Responder</button>
    </article>
  );
}
