import { useEffect, useMemo, useRef, useState } from 'react';

import { ehErroEncerramentoFirestore } from '@/lib/firebase/errors';
import { enviarMensagem } from '@/lib/firebase/recadosEnvio';
import {
  apagarRecado, apagarRecadoGrupo, observarContagemDoDia, observarRecadosEnviados, observarRecadosGrupoDoAlvo, observarRecadosGrupoEnviados,
  observarRecadosRecebidos, responderRecado, responderRecadoGrupo,
} from '@/lib/firebase/recadosRepository';
import {
  diaDoLimite, enviadosAtivos, expirou, gruposEnviadosAtivos, gruposPendentesParaMembro, pendentesParaODestinatario, quantidadeQuePedeAtencao,
  type EntradaMensagem, type Recado, type RecadoGrupo,
} from '@/lib/recados';

/**
 * RECADOS-3 — tudo do menu "Mensagens" do App: o que EU recebi (de uma pessoa ou para o meu grupo), o que EU enviei
 * (aguardando ou com respostas), o contador do dia e as ações. Mesmo ciclo dos outros listeners: só com a sessão pronta,
 * nunca em demonstração. O que venceu é apagado aqui mesmo (as Regras deixam cada lado limpar o seu).
 */
export function useRecados({ login, nome, equipeId, plantaoId, listenersLiberados }: {
  login: string | null;
  nome: string;
  /** A equipe do usuário ('' se não tem): as mensagens para ela chegam por aqui. */
  equipeId: string;
  /** O Plantão em que o usuário PARTICIPA (as Regras só deixam ler se participa), ou null. */
  plantaoId: string | null;
  listenersLiberados: boolean;
}) {
  const [recebidos, setRecebidos] = useState<Recado[]>([]);
  const [enviados, setEnviados] = useState<Recado[]>([]);
  const [gruposEnviadosBrutos, setGruposEnviadosBrutos] = useState<RecadoGrupo[]>([]);
  const [gruposEquipe, setGruposEquipe] = useState<RecadoGrupo[]>([]);
  const [gruposPlantao, setGruposPlantao] = useState<RecadoGrupo[]>([]);
  const [contagemHoje, setContagemHoje] = useState(0);
  const [erro, setErro] = useState('');
  const [agoraIso, setAgoraIso] = useState(() => new Date().toISOString());
  const jaTentouApagar = useRef(new Set<string>());
  const dia = diaDoLimite(agoraIso);

  useEffect(() => {
    if (!listenersLiberados || login === null) return undefined;
    const falhou = (falha: Error) => { if (!ehErroEncerramentoFirestore(falha)) setErro('Não foi possível carregar as mensagens agora.'); };
    const parar = [
      observarRecadosRecebidos(login, (lista) => { setRecebidos(lista); setErro(''); }, falhou),
      observarRecadosEnviados(login, setEnviados, falhou),
      observarRecadosGrupoEnviados(login, setGruposEnviadosBrutos, falhou),
    ];
    return () => parar.forEach((fn) => fn());
  }, [listenersLiberados, login]);

  useEffect(() => {
    if (!listenersLiberados || equipeId === '') return undefined;
    return observarRecadosGrupoDoAlvo('EQUIPE', equipeId, setGruposEquipe, (falha) => { if (!ehErroEncerramentoFirestore(falha)) setErro('Não foi possível carregar as mensagens da equipe agora.'); });
  }, [listenersLiberados, equipeId]);

  useEffect(() => {
    if (!listenersLiberados || plantaoId === null) return undefined;
    return observarRecadosGrupoDoAlvo('PLANTAO', plantaoId, setGruposPlantao, (falha) => { if (!ehErroEncerramentoFirestore(falha)) setErro('Não foi possível carregar as mensagens do Plantão agora.'); });
  }, [listenersLiberados, plantaoId]);

  useEffect(() => {
    if (!listenersLiberados || login === null) return undefined;
    return observarContagemDoDia(login, dia, setContagemHoje, () => undefined);
  }, [listenersLiberados, login, dia]);

  // o "agora" anda de minuto em minuto: uma mensagem que vence some sozinha da tela
  useEffect(() => {
    const relogio = window.setInterval(() => setAgoraIso(new Date().toISOString()), 60_000);
    return () => window.clearInterval(relogio);
  }, []);

  // limpeza do que venceu: cada lado apaga o que a Regra deixa (recebido de pessoa; enviado de pessoa; grupo que EU enviei)
  useEffect(() => {
    const apagarUmaVez = (id: string, apagar: () => Promise<void>) => {
      if (jaTentouApagar.current.has(id)) return;
      jaTentouApagar.current.add(id);
      void apagar().catch(() => undefined);
    };
    for (const recado of [...recebidos, ...enviados]) if (expirou(recado, agoraIso)) apagarUmaVez(recado.id, () => apagarRecado(recado.id));
    for (const grupo of gruposEnviadosBrutos) if (expirou(grupo, agoraIso)) apagarUmaVez(grupo.id, () => apagarRecadoGrupo(grupo.id));
  }, [recebidos, enviados, gruposEnviadosBrutos, agoraIso]);

  const ativo = listenersLiberados && login !== null;
  const todosOsGrupos = useMemo(() => {
    const mapa = new Map<string, RecadoGrupo>();
    for (const grupo of [...gruposEquipe, ...gruposPlantao, ...gruposEnviadosBrutos]) mapa.set(grupo.id, grupo);
    return [...mapa.values()];
  }, [gruposEquipe, gruposPlantao, gruposEnviadosBrutos]);
  const pendentes = useMemo(() => (ativo ? pendentesParaODestinatario(recebidos, login, agoraIso) : []), [ativo, recebidos, login, agoraIso]);
  const gruposPendentes = useMemo(() => (ativo ? gruposPendentesParaMembro(todosOsGrupos, login, agoraIso) : []), [ativo, todosOsGrupos, login, agoraIso]);
  const meusEnviados = useMemo(() => (ativo ? enviadosAtivos(enviados, login, agoraIso) : []), [ativo, enviados, login, agoraIso]);
  const meusGrupos = useMemo(() => (ativo ? gruposEnviadosAtivos(todosOsGrupos, login, agoraIso) : []), [ativo, todosOsGrupos, login, agoraIso]);
  const atencao = useMemo(
    () => (ativo ? quantidadeQuePedeAtencao([...recebidos, ...enviados], todosOsGrupos, login, agoraIso) : 0),
    [ativo, recebidos, enviados, todosOsGrupos, login, agoraIso],
  );

  async function enviar(entrada: EntradaMensagem): Promise<void> {
    if (login === null) return;
    try {
      await enviarMensagem(entrada, { login, nome });
    } finally {
      setAgoraIso(new Date().toISOString());
    }
  }

  return {
    pendentes,
    gruposPendentes,
    enviados: meusEnviados,
    gruposEnviados: meusGrupos,
    respostasParaVer: meusEnviados.filter((recado) => recado.status === 'RESPONDIDO').length + meusGrupos.filter((grupo) => grupo.respostas.length > 0).length,
    contagemHoje: ativo ? contagemHoje : 0,
    atencao,
    agoraIso,
    erro,
    enviar,
    responder: (recado: Recado, resposta: string) => responderRecado(recado.id, resposta),
    responderGrupo: (grupo: RecadoGrupo, resposta: string) => responderRecadoGrupo(grupo.id, login ?? '', nome, resposta),
    apagar: (recado: Recado) => apagarRecado(recado.id),
    apagarGrupo: (grupo: RecadoGrupo) => apagarRecadoGrupo(grupo.id),
  };
}
