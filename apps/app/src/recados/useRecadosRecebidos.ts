import { useEffect, useMemo, useRef, useState } from 'react';

import { ehErroEncerramentoFirestore } from '@/lib/firebase/errors';
import { apagarRecado, observarRecadosRecebidos, responderRecado } from '@/lib/firebase/recadosRepository';
import { expirou, pendentesParaODestinatario, type Recado, type RespostaRecado } from '@/lib/recados';

/**
 * RECADOS-1 — os recados endereçados a este colaborador. Só mostra os que ainda esperam resposta (respondeu,
 * some). Responde com um toque; o App nunca ENVIA recado. O que venceu é apagado aqui mesmo (as Regras deixam o
 * destinatário limpar só o que já expirou). Mesmo ciclo dos outros listeners: só com a sessão pronta, nunca em demonstração.
 */
export function useRecadosRecebidos({ login, listenersLiberados }: { login: string | null; listenersLiberados: boolean }) {
  const [recados, setRecados] = useState<Recado[]>([]);
  const [erro, setErro] = useState('');
  const [agoraIso, setAgoraIso] = useState(() => new Date().toISOString());
  const jaTentouApagar = useRef(new Set<string>());

  useEffect(() => {
    if (!listenersLiberados || login === null) return undefined;
    return observarRecadosRecebidos(
      login,
      (lista) => { setRecados(lista); setErro(''); },
      (falha) => { if (!ehErroEncerramentoFirestore(falha)) setErro('Não foi possível carregar os recados agora.'); },
    );
  }, [listenersLiberados, login]);

  // o "agora" anda de minuto em minuto: um recado que vence some sozinho da tela
  useEffect(() => {
    const relogio = window.setInterval(() => setAgoraIso(new Date().toISOString()), 60_000);
    return () => window.clearInterval(relogio);
  }, []);

  useEffect(() => {
    for (const recado of recados) {
      if (expirou(recado, agoraIso) && !jaTentouApagar.current.has(recado.id)) {
        jaTentouApagar.current.add(recado.id);
        void apagarRecado(recado.id).catch(() => undefined);
      }
    }
  }, [recados, agoraIso]);

  const ativo = listenersLiberados && login !== null;
  const pendentes = useMemo(() => (ativo ? pendentesParaODestinatario(recados, login, agoraIso) : []), [ativo, recados, login, agoraIso]);
  return {
    pendentes,
    erro,
    responder: (recado: Recado, resposta: RespostaRecado, nota: string) => responderRecado(recado.id, resposta, nota),
  };
}
