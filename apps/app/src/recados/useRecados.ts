import { useEffect, useMemo, useRef, useState } from 'react';

import { ehErroEncerramentoFirestore } from '@/lib/firebase/errors';
import {
  apagarRecado, enviarRecado, lerContagemDoDia, observarContagemDoDia, observarRecadosEnviados, observarRecadosRecebidos, responderRecado,
} from '@/lib/firebase/recadosRepository';
import {
  diaDoLimite, enviadosAtivos, expirou, gerarIdRecado, montarRecado, pendentesParaODestinatario, quantidadeQuePedeAtencao, type EntradaRecado, type Recado,
} from '@/lib/recados';

/**
 * RECADOS-2 — tudo do menu "Recados" do App: o que eu RECEBI (para responder), o que eu ENVIEI (aguardando ou com
 * resposta), o contador do dia e as ações (enviar, responder, apagar). Mesmo ciclo dos outros listeners: só com a
 * sessão pronta, nunca em demonstração. O que venceu é apagado aqui mesmo (as Regras deixam cada lado limpar o seu).
 */
export function useRecados({ login, nome, listenersLiberados }: { login: string | null; nome: string; listenersLiberados: boolean }) {
  const [recebidos, setRecebidos] = useState<Recado[]>([]);
  const [enviados, setEnviados] = useState<Recado[]>([]);
  const [contagemHoje, setContagemHoje] = useState(0);
  const [erro, setErro] = useState('');
  const [agoraIso, setAgoraIso] = useState(() => new Date().toISOString());
  const jaTentouApagar = useRef(new Set<string>());
  const dia = diaDoLimite(agoraIso);

  useEffect(() => {
    if (!listenersLiberados || login === null) return undefined;
    const falhou = (falha: Error) => { if (!ehErroEncerramentoFirestore(falha)) setErro('Não foi possível carregar os recados agora.'); };
    const pararRecebidos = observarRecadosRecebidos(login, (lista) => { setRecebidos(lista); setErro(''); }, falhou);
    const pararEnviados = observarRecadosEnviados(login, setEnviados, falhou);
    return () => { pararRecebidos(); pararEnviados(); };
  }, [listenersLiberados, login]);

  useEffect(() => {
    if (!listenersLiberados || login === null) return undefined;
    return observarContagemDoDia(login, dia, setContagemHoje, () => undefined);
  }, [listenersLiberados, login, dia]);

  // o "agora" anda de minuto em minuto: um recado que vence some sozinho da tela
  useEffect(() => {
    const relogio = window.setInterval(() => setAgoraIso(new Date().toISOString()), 60_000);
    return () => window.clearInterval(relogio);
  }, []);

  useEffect(() => {
    for (const recado of [...recebidos, ...enviados]) {
      if (expirou(recado, agoraIso) && !jaTentouApagar.current.has(recado.id)) {
        jaTentouApagar.current.add(recado.id);
        void apagarRecado(recado.id).catch(() => undefined);
      }
    }
  }, [recebidos, enviados, agoraIso]);

  const ativo = listenersLiberados && login !== null;
  const pendentes = useMemo(() => (ativo ? pendentesParaODestinatario(recebidos, login, agoraIso) : []), [ativo, recebidos, login, agoraIso]);
  const meusEnviados = useMemo(() => (ativo ? enviadosAtivos(enviados, login, agoraIso) : []), [ativo, enviados, login, agoraIso]);
  const atencao = useMemo(() => (ativo ? quantidadeQuePedeAtencao([...recebidos, ...enviados], login, agoraIso) : 0), [ativo, recebidos, enviados, login, agoraIso]);

  async function enviar(entrada: EntradaRecado): Promise<void> {
    if (login === null) return;
    const agora = new Date().toISOString();
    let contagem = await lerContagemDoDia(login, diaDoLimite(agora));
    let enviadas = 0;
    try {
      for (const destinatario of entrada.destinatarios) {
        contagem = await enviarRecado(montarRecado(entrada, destinatario, { login, nome }, gerarIdRecado(), agora), contagem);
        enviadas += 1;
      }
    } catch (falha) {
      if (enviadas > 0) throw new Error(`${enviadas} de ${entrada.destinatarios.length} recados foram enviados antes de o envio falhar.`);
      throw falha;
    } finally {
      setAgoraIso(new Date().toISOString());
    }
  }

  return {
    pendentes,
    enviados: meusEnviados,
    respostasParaVer: meusEnviados.filter((recado) => recado.status === 'RESPONDIDO').length,
    contagemHoje: ativo ? contagemHoje : 0,
    atencao,
    agoraIso,
    erro,
    enviar,
    responder: (recado: Recado, resposta: string) => responderRecado(recado.id, resposta),
    apagar: (recado: Recado) => apagarRecado(recado.id),
  };
}
