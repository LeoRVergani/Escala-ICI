import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, MessageSquareText, Plus, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

import {
  apagarRecado, enviarRecado, lerContagemDoDia, observarContagemDoDia, observarRecadosEnviados,
} from '@/lib/firebase/recadosRepository';
import type { Usuario } from '@/lib/modelos';
import {
  diaDoLimite, estadoParaRemetente, gerarIdRecado, LIMITE_DIARIO_RECADOS, montarRecado, ordenarParaRemetente, rotuloResposta,
  type EntradaRecado, type EstadoParaRemetente, type Recado,
} from '@/lib/recados';
import { formatarDiaMes } from '@/lib/informacoesDia';
import { RecadoModal } from './RecadoModal';
import { recadosDeExemplo } from './recadosDemo';
import { iniciais, usePessoas } from './pessoasLideranca';

/**
 * RECADOS-1 — Recados: a liderança manda um recado curto ("pode trocar comigo no dia 20?", "pode atender
 * este chamado?") e vê a resposta (posso / não posso). Sem histórico nem conversa: depois que você vê a
 * resposta, apaga o recado; o que vence é apagado sozinho. Há um limite de recados por dia.
 */
const dataHora = (iso: string) => {
  const data = new Date(iso);
  return `${formatarDiaMes(iso.slice(0, 10))} às ${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
};

export function RecadosPage({ autor, equipes, modoDemo, pessoasDemo }: {
  autor: Usuario;
  /** Equipes cujas pessoas o chefe pode escolher (as dele e as equipes dos Plantões que organiza). */
  equipes: ReadonlyArray<{ id: string; nome: string }>;
  modoDemo: boolean;
  pessoasDemo?: readonly Usuario[];
}) {
  const [agoraIso, setAgoraIso] = useState(() => new Date().toISOString());
  const [modalAberto, setModalAberto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviadosReais, setEnviadosReais] = useState<Recado[]>([]);
  const [contagemReal, setContagemReal] = useState(0);
  const [erroCarga, setErroCarga] = useState('');
  const { pessoas, erro: erroPessoas } = usePessoas(pessoasDemo);

  const chaveEquipes = equipes.map((equipe) => equipe.id).join('|');
  const idsEquipes = useMemo(() => (chaveEquipes === '' ? [] : chaveEquipes.split('|')), [chaveEquipes]);
  const nomeEquipe = (equipeId: string) => equipes.find((equipe) => equipe.id === equipeId)?.nome ?? equipeId;
  const membros = useMemo(
    () => (pessoas ?? []).filter((pessoa) => idsEquipes.includes(pessoa.equipeId) && pessoa.ativo !== false && pessoa.login !== autor.login)
      .map((pessoa) => ({ login: pessoa.login, nome: pessoa.nome, equipeId: pessoa.equipeId }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [pessoas, idsEquipes, autor.login],
  );

  // Demonstração: exemplos derivados das pessoas, só na memória. Real: duas assinaturas (recados e contador do dia).
  const exemplosDemo = useMemo(
    () => (modoDemo && membros.length >= 3 ? recadosDeExemplo(agoraIso, membros, { login: autor.login, nome: autor.nome }) : []),
    [modoDemo, membros, agoraIso, autor.login, autor.nome],
  );
  const [demoEditada, setDemoEditada] = useState<Recado[] | null>(null);
  const [contagemDemo, setContagemDemo] = useState(3);
  const enviados = modoDemo ? (demoEditada ?? exemplosDemo) : enviadosReais;
  const contagemHoje = modoDemo ? contagemDemo : contagemReal;

  useEffect(() => {
    if (modoDemo) return undefined;
    const pararRecados = observarRecadosEnviados(autor.login, setEnviadosReais, () => setErroCarga('Não foi possível carregar os recados agora. Se as Regras do Firestore desta versão ainda não foram publicadas, publique-as (deploy).'));
    const pararContagem = observarContagemDoDia(autor.login, diaDoLimite(new Date().toISOString()), setContagemReal, () => undefined);
    return () => { pararRecados(); pararContagem(); };
  }, [modoDemo, autor.login]);

  // O que venceu (sem resposta, ou resposta já vista há mais de 24 h) é apagado ao abrir — o TTL do Firestore é só a rede de segurança.
  const jaTentouApagar = useRef(new Set<string>());
  useEffect(() => {
    if (modoDemo) return;
    const agora = new Date().toISOString();
    for (const recado of enviadosReais) {
      if (recado.expiraEm <= agora && !jaTentouApagar.current.has(recado.id)) {
        jaTentouApagar.current.add(recado.id);
        void apagarRecado(recado.id).catch(() => undefined);
      }
    }
  }, [modoDemo, enviadosReais]);

  const ordenados = useMemo(() => ordenarParaRemetente(enviados.filter((recado) => recado.expiraEm > agoraIso || modoDemo)), [enviados, agoraIso, modoDemo]);
  const comResposta = ordenados.filter((recado) => recado.status === 'RESPONDIDO');
  const aguardando = ordenados.filter((recado) => recado.status === 'ENVIADO');
  const percentual = Math.min(100, Math.round((contagemHoje / LIMITE_DIARIO_RECADOS) * 100));

  function avisar(texto: string) {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4500);
  }

  async function enviar(entrada: EntradaRecado) {
    const agora = new Date().toISOString();
    const remetente = { login: autor.login, nome: autor.nome };
    if (modoDemo) {
      const novos = entrada.destinatarios.map((destinatario) => montarRecado(entrada, destinatario, remetente, gerarIdRecado(), agora));
      setDemoEditada([...enviados, ...novos]);
      setContagemDemo((atual) => atual + novos.length);
    } else {
      let contagem = await lerContagemDoDia(autor.login, diaDoLimite(agora));
      let enviadas = 0;
      try {
        for (const destinatario of entrada.destinatarios) {
          contagem = await enviarRecado(montarRecado(entrada, destinatario, remetente, gerarIdRecado(), agora), contagem);
          enviadas += 1;
        }
      } catch (falha) {
        if (enviadas > 0) throw new Error(`${enviadas} de ${entrada.destinatarios.length} recados foram enviados antes de o envio falhar.`);
        throw falha;
      }
    }
    setAgoraIso(agora);
    setModalAberto(false);
    avisar(entrada.destinatarios.length === 1 ? `Recado enviado para ${entrada.destinatarios[0]!.nome.split(' ')[0]}.` : `${entrada.destinatarios.length} recados enviados.`);
  }

  async function apagar(recado: Recado) {
    setOcupado(recado.id);
    setErro('');
    try {
      if (modoDemo) setDemoEditada(enviados.filter((item) => item.id !== recado.id));
      else await apagarRecado(recado.id);
      avisar(recado.status === 'RESPONDIDO' ? 'Recado apagado.' : 'Recado cancelado.');
    } catch {
      setErro('Não foi possível apagar agora. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  }

  const cartao = (recado: Recado) => (
    <CartaoRecado key={recado.id} recado={recado} equipe={nomeEquipe(recado.equipeId)} estado={estadoParaRemetente(recado, agoraIso)}
      ocupado={ocupado === recado.id} onApagar={() => void apagar(recado)} />
  );

  return (
    <section className="info-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Equipe</p>
          <h1>Recados</h1>
          <p>Mande um recado curto e receba a resposta (“posso” ou “não posso”). Depois que você vê a resposta, o recado é apagado.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => { setErro(''); setModalAberto(true); }}><Plus size={16} /> Novo recado</button>
      </header>

      {mensagem && <div className="alert success" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</div>}
      {(erroCarga || erroPessoas) && <div className="alert error" role="alert">{erroCarga || erroPessoas}</div>}
      {erro && <div className="alert error" role="alert">{erro}</div>}

      <div className="recado-medidor" data-cheio={contagemHoje >= LIMITE_DIARIO_RECADOS ? '' : undefined}>
        <span><strong>{contagemHoje}</strong> de {LIMITE_DIARIO_RECADOS} recados enviados hoje</span>
        <div className="recado-barra" role="progressbar" aria-valuenow={contagemHoje} aria-valuemin={0} aria-valuemax={LIMITE_DIARIO_RECADOS} aria-label="Recados enviados hoje"><i style={{ width: `${percentual}%` }} /></div>
        <small>O limite diário evita excesso de mensagens. Libera de novo à meia-noite.</small>
      </div>

      {ordenados.length === 0 ? (
        <div className="info-vazio panel">
          <MessageSquareText size={26} aria-hidden="true" />
          <strong>Nenhum recado por aqui</strong>
          <small>Use “Novo recado” para perguntar algo a um colaborador ou avisar um plantonista.</small>
        </div>
      ) : (
        <>
          {comResposta.length > 0 && (
            <section className="recado-grupo" aria-label="Respostas">
              <h2><CheckCircle2 size={16} aria-hidden="true" /> Respostas <span>{comResposta.length}</span></h2>
              <div className="info-lista">{comResposta.map(cartao)}</div>
            </section>
          )}
          {aguardando.length > 0 && (
            <section className="recado-grupo" aria-label="Aguardando resposta">
              <h2><Clock3 size={16} aria-hidden="true" /> Aguardando resposta <span>{aguardando.length}</span></h2>
              <div className="info-lista">{aguardando.map(cartao)}</div>
            </section>
          )}
        </>
      )}

      {modalAberto && (
        <RecadoModal pessoas={membros} nomeEquipe={nomeEquipe} contagemHoje={contagemHoje} onFechar={() => setModalAberto(false)} onEnviar={enviar} />
      )}
    </section>
  );
}

const ROTULO_ESTADO: Record<EstadoParaRemetente, string> = {
  AGUARDANDO: 'Aguardando resposta', POSSO: 'Respondeu: Posso', NAO_POSSO: 'Respondeu: Não posso', CIENTE: 'Entendeu', EXPIRADO: 'Venceu',
};

function CartaoRecado({ recado, equipe, estado, ocupado, onApagar }: {
  recado: Recado; equipe: string; estado: EstadoParaRemetente; ocupado: boolean; onApagar: () => void;
}) {
  const respondido = recado.status === 'RESPONDIDO';
  return (
    <article className="recado-cartao" data-estado={estado}>
      <header>
        <span className="info-avatar" aria-hidden="true">{iniciais(recado.destinatarioNome)}</span>
        <span className="info-cartao-pessoa"><strong>{recado.destinatarioNome}</strong><small>{equipe}</small></span>
        <span className="recado-selo" data-estado={estado}>
          {estado === 'POSSO' && <ThumbsUp size={13} aria-hidden="true" />}
          {estado === 'NAO_POSSO' && <ThumbsDown size={13} aria-hidden="true" />}
          {estado === 'CIENTE' && <CheckCircle2 size={13} aria-hidden="true" />}
          {(estado === 'AGUARDANDO' || estado === 'EXPIRADO') && <Clock3 size={13} aria-hidden="true" />}
          {ROTULO_ESTADO[estado]}
        </span>
      </header>
      {/* texto sempre como TEXTO (nunca HTML): quem escreve não injeta nada na tela de ninguém */}
      <p className="recado-texto">{recado.texto}</p>
      {respondido && recado.notaResposta && <p className="recado-nota"><b>{rotuloResposta(recado.resposta)}</b> — {recado.notaResposta}</p>}
      <footer>
        <small>{tipoRotulo(recado)} · enviado {dataHora(recado.criadoEm)}</small>
        <button type="button" className={respondido ? 'primary-button compact-button' : 'secondary-button compact-button'} disabled={ocupado} onClick={onApagar}>
          {respondido ? <><CheckCircle2 size={13} aria-hidden="true" /> Ok, apagar</> : <><Trash2 size={13} aria-hidden="true" /> Cancelar recado</>}
        </button>
      </footer>
    </article>
  );
}

const tipoRotulo = (recado: Recado) => (recado.tipo === 'PERGUNTA' ? 'Pede resposta' : 'Aviso');

