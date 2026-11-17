import { useState } from 'react';
import { CheckCircle2, ChevronRight, Clock3, MessageSquareText, Plus } from 'lucide-react';

import { CartaoEnviadoGrupo, CartaoEnviadoPessoa, CartaoRecebido } from '@/components/RecadoCartoes';
import { NovaMensagem, type PessoaParaRecado } from '@/components/NovaMensagem';
import {
  estadoParaRemetente, LIMITE_DIARIO_RECADOS, type AlvoRecado, type EntradaMensagem, type Recado, type RecadoGrupo,
} from '@/lib/recados';

/**
 * RECADOS-3 — o menu "Mensagens" do App: escolha uma pessoa, a equipe, o Plantão ou todos, escreva e envie — como no
 * Teams. Cada um responde do seu jeito e, para um grupo, você vê todas as respostas juntas. Sem histórico: depois de
 * ver as respostas você apaga; o que vence some sozinho.
 */
export function RecadosTela({
  pendentes, gruposPendentes, enviados, gruposEnviados, contagemHoje, pessoas, alvos, agoraIso, erro,
  onEnviar, onResponder, onResponderGrupo, onApagar, onApagarGrupo,
}: {
  pendentes: readonly Recado[];
  gruposPendentes: readonly RecadoGrupo[];
  enviados: readonly Recado[];
  gruposEnviados: readonly RecadoGrupo[];
  contagemHoje: number;
  pessoas: readonly PessoaParaRecado[];
  /** Os grupos para onde posso mandar (a minha equipe e/ou o Plantão em que participo). */
  alvos: readonly AlvoRecado[];
  agoraIso: string;
  erro: string;
  onEnviar: (entrada: EntradaMensagem) => Promise<void>;
  onResponder: (recado: Recado, resposta: string) => Promise<void>;
  onResponderGrupo: (grupo: RecadoGrupo, resposta: string) => Promise<void>;
  onApagar: (recado: Recado) => Promise<void>;
  onApagarGrupo: (grupo: RecadoGrupo) => Promise<void>;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState('');
  const quantidadeDoGrupo = (id: string) => alvos.find((alvo) => alvo.id === id)?.quantidade;
  const comResposta = [...enviados.filter((recado) => recado.status === 'RESPONDIDO'), ...gruposEnviados.filter((grupo) => grupo.respostas.length > 0)];
  const aguardando = [...enviados.filter((recado) => recado.status === 'ENVIADO'), ...gruposEnviados.filter((grupo) => grupo.respostas.length === 0)];
  const esperando = [...pendentes.map((recado) => ({ recado, criadoEm: recado.criadoEm })), ...gruposPendentes.map((grupo) => ({ grupo, criadoEm: grupo.criadoEm }))]
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const vazio = esperando.length === 0 && comResposta.length === 0 && aguardando.length === 0;
  const percentual = Math.min(100, Math.round((contagemHoje / LIMITE_DIARIO_RECADOS) * 100));

  function avisar(texto: string) {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4500);
  }
  async function enviar(entrada: EntradaMensagem) {
    await onEnviar(entrada);
    setModalAberto(false);
    const destino = entrada.destino;
    avisar(destino?.tipo === 'PESSOA' ? `Mensagem enviada para ${destino.pessoa.nome.split(' ')[0]}.` : 'Mensagem enviada.');
  }
  async function apagar(id: string, acao: () => Promise<void>, respondido: boolean) {
    setOcupado(id);
    setErroAcao('');
    try {
      await acao();
      avisar(respondido ? 'Mensagem apagada.' : 'Mensagem cancelada.');
    } catch {
      setErroAcao('Não foi possível apagar agora. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  }
  const cartaoEnviado = (item: Recado | RecadoGrupo) => ('alvoTipo' in item
    ? <CartaoEnviadoGrupo key={item.id} grupo={item} quantidade={quantidadeDoGrupo(item.alvoId)} ocupado={ocupado === item.id} onApagar={() => void apagar(item.id, () => onApagarGrupo(item), item.respostas.length > 0)} />
    : <CartaoEnviadoPessoa key={item.id} recado={item} estado={estadoParaRemetente(item, agoraIso)} ocupado={ocupado === item.id} onApagar={() => void apagar(item.id, () => onApagar(item), item.status === 'RESPONDIDO')} />);

  return (
    <div className="recado-tela">
      <header className="recado-tela-topo">
        <div>
          <h1>Mensagens</h1>
          <p>Mande uma mensagem para alguém, para a equipe ou para o Plantão. Cada um responde do seu jeito, e a mensagem some depois que você vê as respostas.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setModalAberto(true)}><Plus size={16} aria-hidden="true" /> Nova mensagem</button>
      </header>

      {mensagem && <div className="alert success" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</div>}
      {(erro || erroAcao) && <div className="alert error" role="alert">{erro || erroAcao}</div>}

      {esperando.length > 0 && (
        <section className="recado-grupo" aria-label="Esperando sua resposta">
          <h2><MessageSquareText size={16} aria-hidden="true" /> Esperando sua resposta <span>{esperando.length}</span></h2>
          <div className="info-lista">
            {esperando.map((item) => ('grupo' in item
              ? <CartaoRecebido key={item.grupo.id} deNome={item.grupo.remetenteNome} paraRotulo={item.grupo.alvoNome} quando={item.grupo.criadoEm} texto={item.grupo.texto} onResponder={(resposta) => onResponderGrupo(item.grupo, resposta)} />
              : <CartaoRecebido key={item.recado.id} deNome={item.recado.remetenteNome} quando={item.recado.criadoEm} texto={item.recado.texto} onResponder={(resposta) => onResponder(item.recado, resposta)} />))}
          </div>
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
          <strong>Nenhuma mensagem por aqui</strong>
          <small>Use “Nova mensagem” para perguntar algo a um colega ou avisar a equipe.</small>
        </div>
      )}

      <div className="recado-medidor" data-cheio={contagemHoje >= LIMITE_DIARIO_RECADOS ? '' : undefined}>
        <span><strong>{contagemHoje}</strong> de {LIMITE_DIARIO_RECADOS} mensagens enviadas hoje</span>
        <div className="recado-barra" role="progressbar" aria-valuenow={contagemHoje} aria-valuemin={0} aria-valuemax={LIMITE_DIARIO_RECADOS} aria-label="Mensagens enviadas hoje"><i style={{ width: `${percentual}%` }} /></div>
        <small>O limite diário evita excesso de mensagens. Libera de novo à meia-noite.</small>
      </div>

      {modalAberto && <NovaMensagem grupos={alvos} pessoas={pessoas} contagemHoje={contagemHoje} onFechar={() => setModalAberto(false)} onEnviar={enviar} />}
    </div>
  );
}

/** Aviso compacto da aba Hoje: leva ao menu "Mensagens" (só aparece quando há algo para ver). */
export function RecadosAviso({ esperando, respostas, onAbrir }: { esperando: number; respostas: number; onAbrir: () => void }) {
  if (esperando + respostas === 0) return null;
  const partes = [
    esperando > 0 ? `${esperando} ${esperando === 1 ? 'mensagem esperando' : 'mensagens esperando'} sua resposta` : '',
    respostas > 0 ? `${respostas} ${respostas === 1 ? 'resposta nova' : 'respostas novas'} para você ver` : '',
  ].filter(Boolean);
  return (
    <button type="button" className="recado-aviso" onClick={onAbrir}>
      <span className="recado-aviso-icone" aria-hidden="true"><MessageSquareText size={20} /></span>
      <span><strong>{partes.join(' · ')}</strong><small>Toque para abrir as mensagens.</small></span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
