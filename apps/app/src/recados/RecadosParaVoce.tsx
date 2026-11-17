import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';

import { formatarDiaMes } from '@/lib/informacoesDia';
import { LIMITE_NOTA_RESPOSTA, respostasDoTipo, rotuloResposta, type Recado, type RespostaRecado } from '@/lib/recados';

/**
 * RECADOS-1 — "Recados da liderança": o recado do seu chefe com a resposta de um toque (Posso / Não posso,
 * ou Entendi). Depois de responder, o recado SOME daqui. O texto é sempre TEXTO (nunca HTML).
 */
export function RecadosParaVoce({ recados, onResponder }: {
  recados: readonly Recado[];
  onResponder: (recado: Recado, resposta: RespostaRecado, nota: string) => Promise<void>;
}) {
  if (recados.length === 0) return null;
  return (
    <section className="recado-app" aria-label="Recados da liderança">
      <header>
        <span className="info-app-cabecalho-icone" aria-hidden="true"><MessageSquareText size={18} /></span>
        <div><h2>Recados da liderança</h2><small>{recados.length === 1 ? '1 recado esperando você' : `${recados.length} recados esperando você`}</small></div>
      </header>
      {recados.map((recado) => <ItemRecado key={recado.id} recado={recado} onResponder={onResponder} />)}
    </section>
  );
}

function ItemRecado({ recado, onResponder }: { recado: Recado; onResponder: (recado: Recado, resposta: RespostaRecado, nota: string) => Promise<void> }) {
  const [nota, setNota] = useState('');
  const [comNota, setComNota] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function responder(resposta: RespostaRecado) {
    setErro('');
    setEnviando(true);
    try {
      await onResponder(recado, resposta, nota);
    } catch {
      setErro('Não foi possível enviar a resposta. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <article className="recado-app-item">
      <header><strong>{recado.remetenteNome}</strong><small>{formatarDiaMes(recado.criadoEm.slice(0, 10))}</small></header>
      <p className="recado-app-texto">{recado.texto}</p>
      {comNota ? (
        <textarea rows={2} maxLength={LIMITE_NOTA_RESPOSTA} value={nota} aria-label="Quer explicar? (opcional)" placeholder="Quer explicar? (opcional)" onChange={(evento) => setNota(evento.target.value)} />
      ) : (
        <button type="button" className="recado-app-nota-link" onClick={() => setComNota(true)}>+ Quer explicar? (opcional)</button>
      )}
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="recado-app-acoes">
        {respostasDoTipo(recado.tipo).map((resposta, indice) => (
          <button key={resposta} type="button" className={indice === 0 ? 'primary-button' : 'secondary-button'} disabled={enviando} onClick={() => void responder(resposta)}>
            {rotuloResposta(resposta)}
          </button>
        ))}
      </div>
    </article>
  );
}
