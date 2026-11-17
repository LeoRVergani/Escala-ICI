import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, MessageSquareText, Plus } from 'lucide-react';

import { CartaoEnviadoGrupo, CartaoEnviadoPessoa } from '@/components/RecadoCartoes';
import { NovaMensagem, type PessoaParaRecado } from '@/components/NovaMensagem';
import { enviarMensagem } from '@/lib/firebase/recadosEnvio';
import {
  apagarRecado, apagarRecadoGrupo, observarContagemDoDia, observarRecadosEnviados, observarRecadosGrupoEnviados,
} from '@/lib/firebase/recadosRepository';
import type { Usuario } from '@/lib/modelos';
import {
  diaDoLimite, estadoParaRemetente, gerarIdRecado, LIMITE_DIARIO_RECADOS, mensagensConsumidas, montarRecado, montarRecadoGrupo, ordenarParaRemetente,
  type AlvoRecado, type EntradaMensagem, type Recado, type RecadoGrupo,
} from '@/lib/recados';
import { usePessoas } from './pessoasLideranca';
import { recadosDeExemplo } from './recadosDemo';

/**
 * RECADOS-3 — Mensagens na visão da liderança: escolhe PARA QUEM (uma pessoa, a equipe, o Plantão ou todos), escreve e
 * envia. Para um grupo é UMA mensagem só e cada um responde do seu jeito; as respostas chegam juntas no mesmo cartão.
 * Sem histórico: depois de ver as respostas, apaga; o que vence é apagado sozinho. Há um limite de mensagens por dia.
 * (Os colaboradores usam o mesmo recurso no App, entre colegas da equipe e do Plantão.)
 */
export function RecadosPage({ autor, equipes, alvosEquipe, alvosPlantao, modoDemo, pessoasDemo }: {
  autor: Usuario;
  /** Equipes cujas PESSOAS o chefe pode escolher (as dele e as equipes dos Plantões que organiza). */
  equipes: ReadonlyArray<{ id: string; nome: string }>;
  /** As equipes que ele gerencia (viram "Equipe X" na hora de escolher o destino). */
  alvosEquipe: ReadonlyArray<{ id: string; nome: string }>;
  /** Os Plantões que ele organiza. */
  alvosPlantao: ReadonlyArray<{ id: string; nome: string }>;
  modoDemo: boolean;
  pessoasDemo?: readonly Usuario[];
}) {
  const [agoraIso, setAgoraIso] = useState(() => new Date().toISOString());
  const [modalAberto, setModalAberto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [pessoasReais, setPessoasReais] = useState<Recado[]>([]);
  const [gruposReais, setGruposReais] = useState<RecadoGrupo[]>([]);
  const [contagemReal, setContagemReal] = useState(0);
  const [erroCarga, setErroCarga] = useState('');
  const { pessoas, erro: erroPessoas } = usePessoas(pessoasDemo);

  const chaveEquipes = equipes.map((equipe) => equipe.id).join('|');
  const idsEquipes = useMemo(() => (chaveEquipes === '' ? [] : chaveEquipes.split('|')), [chaveEquipes]);
  const nomeEquipe = (equipeId: string) => equipes.find((equipe) => equipe.id === equipeId)?.nome ?? equipeId;
  const membros = useMemo<PessoaParaRecado[]>(
    () => (pessoas ?? []).filter((pessoa) => idsEquipes.includes(pessoa.equipeId) && pessoa.ativo !== false && pessoa.login !== autor.login)
      .map((pessoa) => ({ login: pessoa.login, nome: pessoa.nome, equipeId: pessoa.equipeId, rotulo: equipes.find((equipe) => equipe.id === pessoa.equipeId)?.nome ?? pessoa.equipeId }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [pessoas, idsEquipes, autor.login, equipes],
  );
  /** Os grupos para onde se pode mandar: as equipes (com a quantidade de pessoas) e os Plantões. */
  const grupos = useMemo<AlvoRecado[]>(() => [
    ...alvosEquipe.map((equipe) => ({
      tipo: 'EQUIPE' as const, id: equipe.id, nome: /^equipe/iu.test(equipe.nome) ? equipe.nome : `Equipe ${equipe.nome}`,
      ...(pessoas === null ? {} : { quantidade: pessoas.filter((pessoa) => pessoa.equipeId === equipe.id && pessoa.ativo !== false && pessoa.login !== autor.login).length }),
    })),
    ...alvosPlantao.map((plantao) => ({ tipo: 'PLANTAO' as const, id: plantao.id, nome: plantao.nome })),
  ], [alvosEquipe, alvosPlantao, pessoas, autor.login]);
  const quantidadeDoGrupo = (id: string) => grupos.find((alvo) => alvo.id === id)?.quantidade;

  // Demonstração: exemplos derivados das pessoas, só na memória. Real: três assinaturas (pessoa, grupo e contador do dia).
  const exemplosDemo = useMemo(
    () => (modoDemo && membros.length >= 5 ? recadosDeExemplo(agoraIso, membros, grupos[0], { login: autor.login, nome: autor.nome }) : { pessoas: [], grupos: [] }),
    [modoDemo, membros, grupos, agoraIso, autor.login, autor.nome],
  );
  const [demoPessoas, setDemoPessoas] = useState<Recado[] | null>(null);
  const [demoGrupos, setDemoGrupos] = useState<RecadoGrupo[] | null>(null);
  const [contagemDemo, setContagemDemo] = useState(3);
  const enviadosPessoa = modoDemo ? (demoPessoas ?? exemplosDemo.pessoas) : pessoasReais;
  const enviadosGrupo = modoDemo ? (demoGrupos ?? exemplosDemo.grupos) : gruposReais;
  const contagemHoje = modoDemo ? contagemDemo : contagemReal;

  useEffect(() => {
    if (modoDemo) return undefined;
    const falhou = () => setErroCarga('Os recados ainda não estão disponíveis. Avise o administrador do sistema: falta publicar uma atualização no banco de dados.');
    const parar = [
      observarRecadosEnviados(autor.login, setPessoasReais, falhou),
      observarRecadosGrupoEnviados(autor.login, setGruposReais, falhou),
      observarContagemDoDia(autor.login, diaDoLimite(new Date().toISOString()), setContagemReal, () => undefined),
    ];
    return () => parar.forEach((fn) => fn());
  }, [modoDemo, autor.login]);

  // O que venceu é apagado ao abrir — o TTL do Firestore é só a rede de segurança.
  const jaTentouApagar = useRef(new Set<string>());
  useEffect(() => {
    if (modoDemo) return;
    const agora = new Date().toISOString();
    for (const item of [...pessoasReais, ...gruposReais]) {
      if (item.expiraEm <= agora && !jaTentouApagar.current.has(item.id)) {
        jaTentouApagar.current.add(item.id);
        void ('alvoTipo' in item ? apagarRecadoGrupo(item.id) : apagarRecado(item.id)).catch(() => undefined);
      }
    }
  }, [modoDemo, pessoasReais, gruposReais]);

  const vigentes = (expiraEm: string) => expiraEm > agoraIso || modoDemo;
  const pessoasOrdenadas = useMemo(() => ordenarParaRemetente(enviadosPessoa.filter((item) => vigentes(item.expiraEm))), [enviadosPessoa, agoraIso, modoDemo]); // eslint-disable-line react-hooks/exhaustive-deps
  const gruposOrdenados = useMemo(
    () => [...enviadosGrupo].filter((item) => vigentes(item.expiraEm)).sort((a, b) => Number(b.respostas.length > 0) - Number(a.respostas.length > 0) || b.criadoEm.localeCompare(a.criadoEm)),
    [enviadosGrupo, agoraIso, modoDemo], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const comResposta = [...pessoasOrdenadas.filter((item) => item.status === 'RESPONDIDO'), ...gruposOrdenados.filter((item) => item.respostas.length > 0)];
  const aguardando = [...pessoasOrdenadas.filter((item) => item.status === 'ENVIADO'), ...gruposOrdenados.filter((item) => item.respostas.length === 0)];
  const percentual = Math.min(100, Math.round((contagemHoje / LIMITE_DIARIO_RECADOS) * 100));

  function avisar(texto: string) {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4500);
  }

  async function enviar(entrada: EntradaMensagem) {
    const destino = entrada.destino;
    if (destino === null) return;
    const agora = new Date().toISOString();
    const remetente = { login: autor.login, nome: autor.nome };
    if (modoDemo) {
      if (destino.tipo === 'PESSOA') setDemoPessoas([...enviadosPessoa, montarRecado(entrada, destino.pessoa, remetente, gerarIdRecado(), agora)]);
      else setDemoGrupos([...enviadosGrupo, ...destino.alvos.map((alvo) => montarRecadoGrupo(entrada, alvo, remetente, gerarIdRecado(), agora))]);
      setContagemDemo((atual) => atual + mensagensConsumidas(destino));
    } else {
      await enviarMensagem(entrada, remetente);
    }
    setAgoraIso(agora);
    setModalAberto(false);
    avisar(destino.tipo === 'PESSOA' ? `Mensagem enviada para ${destino.pessoa.nome.split(' ')[0]}.` : destino.alvos.length === 1 ? `Mensagem enviada para ${destino.alvos[0]!.nome}.` : 'Mensagens enviadas.');
  }

  async function apagar(id: string, ehGrupo: boolean, respondido: boolean) {
    setOcupado(id);
    setErro('');
    try {
      if (modoDemo) {
        if (ehGrupo) setDemoGrupos(enviadosGrupo.filter((item) => item.id !== id)); else setDemoPessoas(enviadosPessoa.filter((item) => item.id !== id));
      } else if (ehGrupo) await apagarRecadoGrupo(id);
      else await apagarRecado(id);
      avisar(respondido ? 'Mensagem apagada.' : 'Mensagem cancelada.');
    } catch {
      setErro('Não foi possível apagar agora. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  }

  const cartao = (item: Recado | RecadoGrupo) => ('alvoTipo' in item
    ? <CartaoEnviadoGrupo key={item.id} grupo={item} quantidade={quantidadeDoGrupo(item.alvoId)} ocupado={ocupado === item.id} onApagar={() => void apagar(item.id, true, item.respostas.length > 0)} />
    : <CartaoEnviadoPessoa key={item.id} recado={item} subtitulo={nomeEquipe(item.equipeId)} estado={estadoParaRemetente(item, agoraIso)} ocupado={ocupado === item.id} onApagar={() => void apagar(item.id, false, item.status === 'RESPONDIDO')} />);

  return (
    <section className="info-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Equipe</p>
          <h1>Mensagens</h1>
          <p>Mande uma mensagem para uma pessoa, para a equipe ou para o Plantão. Cada um responde do seu jeito, e a mensagem some depois que você vê as respostas.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => { setErro(''); setModalAberto(true); }}><Plus size={16} /> Nova mensagem</button>
      </header>

      {mensagem && <div className="alert success" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</div>}
      {(erroCarga || erroPessoas) && <div className="alert error" role="alert">{erroCarga || erroPessoas}</div>}
      {erro && <div className="alert error" role="alert">{erro}</div>}

      {comResposta.length === 0 && aguardando.length === 0 ? (
        <div className="info-vazio panel">
          <MessageSquareText size={26} aria-hidden="true" />
          <strong>Nenhuma mensagem por aqui</strong>
          <small>Use “Nova mensagem” para perguntar algo a alguém ou avisar toda a equipe.</small>
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

      <div className="recado-medidor" data-cheio={contagemHoje >= LIMITE_DIARIO_RECADOS ? '' : undefined}>
        <span><strong>{contagemHoje}</strong> de {LIMITE_DIARIO_RECADOS} mensagens enviadas hoje</span>
        <div className="recado-barra" role="progressbar" aria-valuenow={contagemHoje} aria-valuemin={0} aria-valuemax={LIMITE_DIARIO_RECADOS} aria-label="Mensagens enviadas hoje"><i style={{ width: `${percentual}%` }} /></div>
        <small>O limite diário evita excesso de mensagens. Libera de novo à meia-noite.</small>
      </div>

      {modalAberto && <NovaMensagem grupos={grupos} pessoas={membros} contagemHoje={contagemHoje} onFechar={() => setModalAberto(false)} onEnviar={enviar} />}
    </section>
  );
}
