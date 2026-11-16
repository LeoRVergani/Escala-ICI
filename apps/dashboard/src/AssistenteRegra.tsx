import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Info, LoaderCircle, Minus, Moon, Plus, Repeat, ShieldAlert, Sparkles, X,
} from 'lucide-react';
import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

import {
  definicaoDaSituacao, estadoInicialDaSituacao, montarRegraDoAssistente, NOMES_DIA, nomeSugerido, plural, resumoDoAssistente, SERIEDADE, SITUACOES,
  type EstadoAssistente, type IconeSituacao, type SituacaoChave,
} from '@/lib/regrasAssistente';
import { novaRegraEmBranco, renderizarMensagem, testarRegra, valoresDeExemplo, type GravidadeRegra, type RegraEscala } from '@/lib/regrasEscala';

/**
 * ASSISTENTE-REGRAS-1 — criar uma regra em 3 passos, para qualquer pessoa:
 *  1. O que você quer vigiar?  (situações em palavras de todo dia)
 *  2. Qual é o limite?         (uma frase com UM número para ajustar + o efeito ao vivo)
 *  3. Como avisar?             (quão sério, quem, nome) — com o resumo numa frase.
 * Quem precisa de algo diferente cai no modo avançado (ConstrutorRegra) por um link.
 */
const ICONE: Record<IconeSituacao, ReactNode> = {
  sequencia: <Repeat size={22} />, descanso: <Moon size={22} />, relogio: <Clock3 size={22} />, calendario: <CalendarDays size={22} />,
};

/** O que vem antes e depois do campo de ajuste, na frase "Quero ser avisado quando alguém …". */
const PARTES: Record<SituacaoChave, { antes: string; depois: string }> = {
  DIAS_SEGUIDOS: { antes: 'trabalhar mais de', depois: 'seguidos' },
  POUCO_DESCANSO: { antes: 'descansar menos de', depois: 'entre um turno e o seguinte' },
  TURNO_LONGO: { antes: 'tiver um turno de mais de', depois: '' },
  DIA_DA_SEMANA: { antes: 'trabalhar', depois: '' },
};
const DIA_COM_ARTIGO: readonly string[] = ['no domingo', 'na segunda-feira', 'na terça-feira', 'na quarta-feira', 'na quinta-feira', 'na sexta-feira', 'no sábado'];
const GRAVIDADES: readonly GravidadeRegra[] = ['INFO', 'AVISO', 'CRITICO'];
const PASSOS = ['O que vigiar', 'O limite', 'Como avisar'] as const;

export function AssistenteRegra({ idRegra, inicial, jaSalva, equipes, documentos, catalogo, escalaAberta, nomePorLogin, onFechar, onAvancado, onManterEmTeste, onSalvar }: {
  idRegra: string;
  /** Regra existente já lida pelo assistente (editar); `null` começa pela escolha da situação. */
  inicial: EstadoAssistente | null;
  jaSalva: boolean;
  equipes: ReadonlyArray<{ id: string; nome: string }>;
  documentos: readonly TurnosMes[];
  catalogo: Record<string, TipoTurno>;
  escalaAberta: string | null;
  nomePorLogin: Readonly<Record<string, string>>;
  onFechar: () => void;
  onAvancado: (regra: RegraEscala) => void;
  onManterEmTeste: (regra: RegraEscala) => void;
  onSalvar: (regra: RegraEscala) => Promise<void>;
}) {
  const [passo, setPasso] = useState<1 | 2 | 3>(inicial ? 2 : 1);
  const [estado, setEstado] = useState<EstadoAssistente | null>(inicial);
  const [mudandoTexto, setMudandoTexto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  const regra = useMemo(() => (estado ? montarRegraDoAssistente(estado, idRegra) : null), [estado, idRegra]);
  // O efeito é calculado ao vivo: a conta é leve e deixa a pessoa ver o que o número faz.
  const efeito = useMemo(
    () => (regra && documentos.length > 0 ? testarRegra(regra, documentos, catalogo, { nomePorLogin }) : null),
    [regra, documentos, catalogo, nomePorLogin],
  );
  const nomesEquipes = estado ? equipes.filter((equipe) => estado.alcance.ids.includes(equipe.id)).map((equipe) => equipe.nome) : [];

  function ajustar(parte: Partial<EstadoAssistente>) {
    setEstado((atual) => (atual ? { ...atual, ...parte } : atual));
  }
  function escolherSituacao(chave: SituacaoChave) {
    // trocar de situação recomeça os números (o que serve para "dias" não serve para "horas")
    setEstado((atual) => (atual && atual.situacao === chave ? atual : { ...estadoInicialDaSituacao(chave), nome: '' }));
    setPasso(2);
  }
  function mudarNumero(novo: number) {
    if (!estado) return;
    const numero = definicaoDaSituacao(estado.situacao).numero;
    if (!numero || !Number.isFinite(novo)) return;
    ajustar({ parametros: { ...estado.parametros, valor: Math.min(numero.maximo, Math.max(numero.minimo, Math.round(novo))) } });
  }
  function alternarEquipe(equipeId: string) {
    if (!estado) return;
    const ids = estado.alcance.ids.includes(equipeId) ? estado.alcance.ids.filter((id) => id !== equipeId) : [...estado.alcance.ids, equipeId];
    ajustar({ alcance: { tipo: 'EQUIPE', ids } });
  }
  /** Insere o campo onde está o cursor do texto do aviso (handler estável: o campo vem do botão). */
  function inserirNoTexto(evento: MouseEvent<HTMLButtonElement>) {
    const campo = evento.currentTarget.dataset.campo;
    const area = campoTexto.current;
    if (!campo || !area || !regra) return;
    const atual = regra.entao.mensagem;
    const inicio = area.selectionStart ?? atual.length;
    const fim = area.selectionEnd ?? inicio;
    ajustar({ mensagem: `${atual.slice(0, inicio)}{${campo}}${atual.slice(fim)}` });
    window.requestAnimationFrame(() => { area.focus(); area.setSelectionRange(inicio + campo.length + 2, inicio + campo.length + 2); });
  }
  async function salvar() {
    if (!regra) return;
    setErro('');
    setSalvando(true);
    try {
      await onSalvar(regra);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Só o administrador do sistema pode salvar regras.' : texto || 'Não foi possível salvar agora. Tente de novo.');
      setSalvando(false);
    }
  }

  const definicao = estado ? definicaoDaSituacao(estado.situacao) : null;
  const precisaEquipe = estado?.alcance.tipo === 'EQUIPE' && estado.alcance.ids.length === 0;
  const nomeFinal = estado ? (estado.nome.trim() === '' ? nomeSugerido(estado.situacao, estado.parametros) : estado.nome) : '';
  const nomeValido = nomeFinal.trim().length >= 3;
  const exemplo = regra
    ? renderizarMensagem(regra.entao.mensagem, { pessoa: 'Ana', data: '2026-08-12', limite: regra.quando.condicoes[0]?.valor ?? null, valores: valoresDeExemplo(regra) })
    : '';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section className="edit-modal assistente-regra" role="dialog" aria-modal="true" aria-label={jaSalva ? 'Editar regra' : 'Nova regra'} onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Sparkles size={18} aria-hidden="true" /></span>
          <div>
            <h2>{jaSalva ? 'Editar regra' : 'Nova regra'}</h2>
            <p>Em 3 passos simples. Nada muda para ninguém até você ativar.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>

        <ol className="assistente-progresso" aria-label="Passos">
          {PASSOS.map((rotulo, indice) => (
            <li key={rotulo} data-estado={indice + 1 < passo ? 'feito' : indice + 1 === passo ? 'atual' : 'futuro'} aria-current={indice + 1 === passo ? 'step' : undefined}>
              <span>{indice + 1 < passo ? <Check size={13} aria-hidden="true" /> : indice + 1}</span>{rotulo}
            </li>
          ))}
        </ol>

        {passo === 1 && (
          <div className="assistente-corpo">
            <h3>O que você quer vigiar na escala?</h3>
            <div className="assistente-situacoes" role="radiogroup" aria-label="Situação a vigiar">
              {SITUACOES.map((situacao) => (
                <button key={situacao.chave} type="button" role="radio" aria-checked={estado?.situacao === situacao.chave} className={estado?.situacao === situacao.chave ? 'active' : ''} onClick={() => escolherSituacao(situacao.chave)}>
                  <span className="assistente-situacao-icone" aria-hidden="true">{ICONE[situacao.icone]}</span>
                  <strong>{situacao.titulo}</strong>
                  <small>{situacao.descricao}</small>
                </button>
              ))}
            </div>
            <button type="button" className="assistente-link" onClick={() => onAvancado(novaRegraEmBranco(idRegra))}>
              Preciso de algo diferente <ChevronRight size={14} aria-hidden="true" /> <small>(montar do zero, para quem já conhece)</small>
            </button>
          </div>
        )}

        {passo === 2 && estado && definicao && (
          <div className="assistente-corpo">
            <h3>Qual é o limite?</h3>
            <p className="assistente-frase">
              Quero ser avisado quando alguém <b>{PARTES[estado.situacao].antes}</b>
              {definicao.numero ? (
                <span className="assistente-ajuste">
                  <button type="button" aria-label="Diminuir" onClick={() => mudarNumero(estado.parametros.valor - 1)} disabled={estado.parametros.valor <= definicao.numero.minimo}><Minus size={18} /></button>
                  <input aria-label="Quantidade" inputMode="numeric" value={estado.parametros.valor} onChange={(evento) => mudarNumero(Number(evento.target.value.replace(/\D/gu, '')))} />
                  <button type="button" aria-label="Aumentar" onClick={() => mudarNumero(estado.parametros.valor + 1)} disabled={estado.parametros.valor >= definicao.numero.maximo}><Plus size={18} /></button>
                  <em>{plural(estado.parametros.valor, definicao.numero.unidade).replace(/^[\d.,]+\s/u, '')}</em>
                </span>
              ) : (
                <select className="assistente-dia" aria-label="Dia da semana" value={estado.parametros.diaSemana} onChange={(evento) => ajustar({ parametros: { ...estado.parametros, diaSemana: Number(evento.target.value) } })}>
                  {DIA_COM_ARTIGO.map((texto, numero) => <option key={NOMES_DIA[numero]} value={numero}>{texto}</option>)}
                </select>
              )}
              <span className="assistente-fim"><b>{PARTES[estado.situacao].depois}</b>.</span>
            </p>
            {definicao.numero && <p className="assistente-ajuda"><Info size={14} aria-hidden="true" /> {definicao.numero.explicacao}</p>}
            <EfeitoDaRegra efeito={efeito} escalaAberta={escalaAberta} />
          </div>
        )}

        {passo === 3 && estado && regra && (
          <div className="assistente-corpo">
            <h3>Como você quer ser avisado?</h3>
            <div className="assistente-serio" role="radiogroup" aria-label="Quão sério é">
              {GRAVIDADES.map((gravidade) => (
                <button key={gravidade} type="button" role="radio" aria-checked={estado.gravidade === gravidade} data-gravidade={gravidade} className={estado.gravidade === gravidade ? 'active' : ''} onClick={() => ajustar({ gravidade })}>
                  <AlertTriangle size={16} aria-hidden="true" /><strong>{SERIEDADE[gravidade].titulo}</strong><small>{SERIEDADE[gravidade].texto}</small>
                </button>
              ))}
            </div>
            <label className="assistente-opcao">
              <input type="checkbox" checked={estado.bloqueiaPublicacao} onChange={(evento) => ajustar({ bloqueiaPublicacao: evento.target.checked })} />
              <span><strong><ShieldAlert size={14} aria-hidden="true" /> Não deixar publicar a escala enquanto isso não for corrigido</strong><small>Se ficar desmarcado, a escala pode ser publicada mesmo com o aviso.</small></span>
            </label>

            <h3>Para quem vale?</h3>
            <div className="assistente-alcance" role="radiogroup" aria-label="Para quem vale">
              <button type="button" role="radio" aria-checked={estado.alcance.tipo === 'TODAS'} className={estado.alcance.tipo === 'TODAS' ? 'active' : ''} onClick={() => ajustar({ alcance: { tipo: 'TODAS', ids: [] } })}>Todas as equipes</button>
              <button type="button" role="radio" aria-checked={estado.alcance.tipo === 'EQUIPE'} className={estado.alcance.tipo === 'EQUIPE' ? 'active' : ''} onClick={() => ajustar({ alcance: { tipo: 'EQUIPE', ids: estado.alcance.ids } })}>Só algumas equipes</button>
            </div>
            {estado.alcance.tipo === 'EQUIPE' && (
              <div className="construtor-equipes">
                {equipes.map((equipe) => (
                  <button key={equipe.id} type="button" role="checkbox" aria-checked={estado.alcance.ids.includes(equipe.id)} className={estado.alcance.ids.includes(equipe.id) ? 'active' : ''} onClick={() => alternarEquipe(equipe.id)}>{equipe.nome}</button>
                ))}
                {precisaEquipe && <small className="assistente-ajuda">Escolha pelo menos uma equipe.</small>}
              </div>
            )}

            <label className="criar-equipe-campo"><span>Nome da regra <small>(já sugeri um)</small></span>
              <input value={estado.nome === '' ? nomeFinal : estado.nome} maxLength={80} onChange={(evento) => ajustar({ nome: evento.target.value })} /></label>

            <div className="assistente-texto">
              <p><small>O aviso vai aparecer assim:</small> <strong>{exemplo}</strong></p>
              <button type="button" className="assistente-link" aria-expanded={mudandoTexto} onClick={() => setMudandoTexto((aberto) => !aberto)}>
                {mudandoTexto ? 'Fechar' : 'Mudar o texto do aviso'} <ChevronRight size={14} aria-hidden="true" />
              </button>
              {mudandoTexto && (
                <>
                  <textarea ref={campoTexto} rows={2} maxLength={200} aria-label="Texto do aviso" value={regra.entao.mensagem} onChange={(evento) => ajustar({ mensagem: evento.target.value.trim() === '' ? null : evento.target.value })} />
                  <div className="construtor-campos">
                    <small>Colocar no texto:</small>
                    <button type="button" className="construtor-campo-botao" data-campo="pessoa" onClick={inserirNoTexto}>nome da pessoa</button>
                    <button type="button" className="construtor-campo-botao" data-campo="dia" onClick={inserirNoTexto}>dia</button>
                    <button type="button" className="construtor-campo-botao" data-campo="limite" onClick={inserirNoTexto}>limite</button>
                  </div>
                </>
              )}
            </div>

            <p className="assistente-resumo"><CheckCircle2 size={16} aria-hidden="true" /> {resumoDoAssistente(estado, nomesEquipes)}</p>
            <EfeitoDaRegra efeito={efeito} escalaAberta={escalaAberta} compacto />
            <button type="button" className="assistente-link" onClick={() => onAvancado(regra)}>Ajustes avançados <ChevronRight size={14} aria-hidden="true" /></button>
          </div>
        )}

        {erro && <div className="alert error" role="alert">{erro}</div>}
        <footer className="assistente-rodape">
          <button type="button" className="secondary-button" disabled={salvando} onClick={passo === 1 ? onFechar : () => setPasso((passo - 1) as 1 | 2)}>
            {passo === 1 ? 'Cancelar' : <><ChevronLeft size={15} aria-hidden="true" /> Voltar</>}
          </button>
          <div>
            {passo === 2 && <button type="button" className="primary-button" onClick={() => setPasso(3)}>Continuar <ChevronRight size={15} aria-hidden="true" /></button>}
            {passo === 3 && regra && (
              <>
                {!jaSalva && <button type="button" className="secondary-button" disabled={salvando || precisaEquipe || !nomeValido} onClick={() => onManterEmTeste(regra)}>Só testar</button>}
                <button type="button" className="primary-button" disabled={salvando || precisaEquipe || !nomeValido} onClick={() => void salvar()}>
                  {salvando ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null} {jaSalva ? 'Salvar alterações' : 'Ativar a regra'}
                </button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

/** "O que aconteceria": o efeito da regra na escala aberta, em frases (muda enquanto a pessoa ajusta o número). */
function EfeitoDaRegra({ efeito, escalaAberta, compacto = false }: { efeito: ReturnType<typeof testarRegra> | null; escalaAberta: string | null; compacto?: boolean }) {
  if (escalaAberta === null || efeito === null) {
    return (
      <div className="assistente-efeito" data-estado="neutro">
        <Info size={18} aria-hidden="true" />
        <p><strong>Quer ver o efeito?</strong> Abra uma escala em <b>Escalas</b> e volte aqui: mostro quantas pessoas seriam avisadas.</p>
      </div>
    );
  }
  if (efeito.total === 0) {
    return (
      <div className="assistente-efeito" data-estado="ok">
        <CheckCircle2 size={18} aria-hidden="true" />
        <p><strong>Ninguém seria avisado</strong> na escala {escalaAberta}. O limite está folgado para hoje.</p>
      </div>
    );
  }
  return (
    <div className="assistente-efeito" data-estado="alerta">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <p><strong>{efeito.pessoasAfetadas} {efeito.pessoasAfetadas === 1 ? 'pessoa seria avisada' : 'pessoas seriam avisadas'}</strong> na escala {escalaAberta}.</p>
        {!compacto && (
          <>
            <div className="assistente-efeito-pessoas">
              {efeito.porPessoa.slice(0, 6).map((pessoa) => <span key={pessoa.login}>{pessoa.nome}{pessoa.total > 1 ? ` · ${pessoa.total}×` : ''}</span>)}
              {efeito.porPessoa.length > 6 && <span>e mais {efeito.porPessoa.length - 6}</span>}
            </div>
            {efeito.amostra[0] && <small>Por exemplo: {efeito.amostra[0].mensagem}</small>}
          </>
        )}
      </div>
    </div>
  );
}
