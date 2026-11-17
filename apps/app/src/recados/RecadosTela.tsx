import { useState } from 'react';
import { CheckCircle2, ChevronRight, Clock3, MessageSquareText, Plus } from 'lucide-react';

import { CartaoRecadoEnviado, CartaoRecadoRecebido } from '@/components/RecadoCartoes';
import { RecadoModal, type PessoaParaRecado } from '@/components/RecadoModal';
import { estadoParaRemetente, LIMITE_DIARIO_RECADOS, type EntradaRecado, type Recado } from '@/lib/recados';

/**
 * RECADOS-2 — o menu "Recados" do App: qualquer colaborador escolhe pessoas da sua equipe ou do seu Plantão, escreve
 * do seu jeito e recebe a resposta do jeito da pessoa. Sem conversa nem histórico: a pessoa responde UMA vez, você vê
 * a resposta e apaga; o que vence some sozinho.
 */
export function RecadosTela({ pendentes, enviados, contagemHoje, pessoas, agoraIso, erro, onEnviar, onResponder, onApagar }: {
  /** Recados para eu responder. */
  pendentes: readonly Recado[];
  /** Os que eu enviei e ainda valem (com resposta primeiro). */
  enviados: readonly Recado[];
  contagemHoje: number;
  pessoas: readonly PessoaParaRecado[];
  agoraIso: string;
  erro: string;
  onEnviar: (entrada: EntradaRecado) => Promise<void>;
  onResponder: (recado: Recado, resposta: string) => Promise<void>;
  onApagar: (recado: Recado) => Promise<void>;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState('');
  const comResposta = enviados.filter((recado) => recado.status === 'RESPONDIDO');
  const aguardando = enviados.filter((recado) => recado.status === 'ENVIADO');
  const vazio = pendentes.length === 0 && enviados.length === 0;
  const percentual = Math.min(100, Math.round((contagemHoje / LIMITE_DIARIO_RECADOS) * 100));

  function avisar(texto: string) {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4500);
  }
  async function enviar(entrada: EntradaRecado) {
    await onEnviar(entrada);
    setModalAberto(false);
    avisar(entrada.destinatarios.length === 1 ? `Recado enviado para ${entrada.destinatarios[0]!.nome.split(' ')[0]}.` : `${entrada.destinatarios.length} recados enviados.`);
  }
  async function responder(recado: Recado, resposta: string) {
    await onResponder(recado, resposta);
    avisar('Resposta enviada.');
  }
  async function apagar(recado: Recado) {
    setOcupado(recado.id);
    setErroAcao('');
    try {
      await onApagar(recado);
      avisar(recado.status === 'RESPONDIDO' ? 'Recado apagado.' : 'Recado cancelado.');
    } catch {
      setErroAcao('Não foi possível apagar agora. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  }
  const cartaoEnviado = (recado: Recado) => (
    <CartaoRecadoEnviado key={recado.id} recado={recado} estado={estadoParaRemetente(recado, agoraIso)} ocupado={ocupado === recado.id} onApagar={() => void apagar(recado)} />
  );

  return (
    <div className="recado-tela">
      <header className="recado-tela-topo">
        <div>
          <h1>Recados</h1>
          <p>Mande um recado para alguém da sua equipe ou do seu Plantão. A pessoa responde do jeito dela, e o recado some depois que você vê a resposta.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setModalAberto(true)}><Plus size={16} aria-hidden="true" /> Novo recado</button>
      </header>

      {mensagem && <div className="alert success" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</div>}
      {(erro || erroAcao) && <div className="alert error" role="alert">{erro || erroAcao}</div>}

      {pendentes.length > 0 && (
        <section className="recado-grupo" aria-label="Esperando sua resposta">
          <h2><MessageSquareText size={16} aria-hidden="true" /> Esperando sua resposta <span>{pendentes.length}</span></h2>
          <div className="info-lista">{pendentes.map((recado) => <CartaoRecadoRecebido key={recado.id} recado={recado} onResponder={responder} />)}</div>
        </section>
      )}
      {comResposta.length > 0 && (
        <section className="recado-grupo" aria-label="Respostas para você">
          <h2><CheckCircle2 size={16} aria-hidden="true" /> Respostas para você <span>{comResposta.length}</span></h2>
          <div className="info-lista">{comResposta.map(cartaoEnviado)}</div>
        </section>
      )}
      {aguardando.length > 0 && (
        <section className="recado-grupo" aria-label="Aguardando resposta">
          <h2><Clock3 size={16} aria-hidden="true" /> Aguardando resposta <span>{aguardando.length}</span></h2>
          <div className="info-lista">{aguardando.map(cartaoEnviado)}</div>
        </section>
      )}
      {vazio && (
        <div className="info-vazio panel">
          <MessageSquareText size={26} aria-hidden="true" />
          <strong>Nenhum recado por aqui</strong>
          <small>Use “Novo recado” para perguntar algo a um colega, como “pode trocar comigo no dia 20?”.</small>
        </div>
      )}

      <div className="recado-medidor" data-cheio={contagemHoje >= LIMITE_DIARIO_RECADOS ? '' : undefined}>
        <span><strong>{contagemHoje}</strong> de {LIMITE_DIARIO_RECADOS} recados enviados hoje</span>
        <div className="recado-barra" role="progressbar" aria-valuenow={contagemHoje} aria-valuemin={0} aria-valuemax={LIMITE_DIARIO_RECADOS} aria-label="Recados enviados hoje"><i style={{ width: `${percentual}%` }} /></div>
        <small>O limite diário evita excesso de mensagens. Libera de novo à meia-noite.</small>
      </div>

      {modalAberto && <RecadoModal pessoas={pessoas} contagemHoje={contagemHoje} onFechar={() => setModalAberto(false)} onEnviar={enviar} />}
    </div>
  );
}

/** Aviso compacto da aba Hoje: leva ao menu "Recados" (só aparece quando há algo para ver). */
export function RecadosAviso({ esperando, respostas, onAbrir }: { esperando: number; respostas: number; onAbrir: () => void }) {
  if (esperando + respostas === 0) return null;
  const partes = [
    esperando > 0 ? `${esperando} ${esperando === 1 ? 'recado esperando' : 'recados esperando'} sua resposta` : '',
    respostas > 0 ? `${respostas} ${respostas === 1 ? 'resposta nova' : 'respostas novas'} para você ver` : '',
  ].filter(Boolean);
  return (
    <button type="button" className="recado-aviso" onClick={onAbrir}>
      <span className="recado-aviso-icone" aria-hidden="true"><MessageSquareText size={20} /></span>
      <span><strong>{partes.join(' · ')}</strong><small>Toque para abrir os recados.</small></span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
