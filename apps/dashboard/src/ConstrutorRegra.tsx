import { useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  AlertTriangle, CheckCircle2, Info, LoaderCircle, Play, Plus, ShieldAlert, Sparkles, Trash2, X,
} from 'lucide-react';
import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

import {
  CAMPOS_MENSAGEM_FIXOS, NOMES_DIA_SEMANA, OPERADORES_REGRA, ROTULO_GRAVIDADE, VARIAVEIS_REGRA, renderizarMensagem, testarRegra,
  rotuloUnidade, validarRegra, variaveisDaRegra, variaveisPorCategoria,
  type CondicaoRegra, type GravidadeRegra, type OperadorRegra, type RegraEscala, type ResultadoTesteRegra, type VariavelRegra,
} from '@/lib/regrasEscala';
import { FraseSeEntao, valoresDeExemplo } from './AdminRegrasPage';

/**
 * REGRAS-ESCALA-3 — construtor visual "SE … ENTÃO …". A regra se monta
 * escolhendo em listas (ninguém digita código); "▶ Testar" roda a regra na
 * escala aberta SEM gravar nada. Salvar e ativar chegam na etapa seguinte.
 */
const SIMBOLO: Record<OperadorRegra, string> = { '>': '>  maior que', '>=': '≥  maior ou igual a', '<': '<  menor que', '<=': '≤  menor ou igual a', '==': '=  igual a', '!=': '≠  diferente de' };
const GRAVIDADES: ReadonlyArray<{ valor: GravidadeRegra; texto: string }> = [
  { valor: 'INFO', texto: 'Só informa, sem alarde.' },
  { valor: 'AVISO', texto: 'Chama a atenção da liderança.' },
  { valor: 'CRITICO', texto: 'Problema sério, em vermelho.' },
];

function valorDe(entrada: string): number {
  return entrada.trim() === '' ? Number.NaN : Number(entrada.replace(',', '.'));
}

export function ConstrutorRegra({ inicial, equipes, documentos, catalogo, escalaAberta, nomePorLogin, emEdicao, jaSalva, onFechar, onManterEmTeste, onSalvar }: {
  inicial: RegraEscala;
  equipes: ReadonlyArray<{ id: string; nome: string }>;
  documentos: readonly TurnosMes[];
  catalogo: Record<string, TipoTurno>;
  escalaAberta: string | null;
  nomePorLogin: Readonly<Record<string, string>>;
  emEdicao: boolean;
  /** A regra aberta já está salva (editar muda o que vale para todos); senão é nova ou em teste. */
  jaSalva: boolean;
  onFechar: () => void;
  onManterEmTeste: (regra: RegraEscala) => void;
  /** Grava a regra (a tela que chama decide onde). Se recusar, a mensagem aparece aqui. */
  onSalvar: (regra: RegraEscala) => Promise<void>;
}) {
  const [regra, setRegra] = useState<RegraEscala>(inicial);
  const [teste, setTeste] = useState<{ resultado: ResultadoTesteRegra; instantaneo: string } | null>(null);
  const [testando, setTestando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const campoMensagem = useRef<HTMLTextAreaElement>(null);
  const falta = useMemo(() => validarRegra(regra), [regra]);
  const instantaneo = JSON.stringify([regra.quando, regra.entao, regra.vale]);
  const testeDesatualizado = teste !== null && teste.instantaneo !== instantaneo;
  const gruposVariaveis = useMemo(() => variaveisPorCategoria(), []);
  const camposMensagem = useMemo(
    () => [
      ...CAMPOS_MENSAGEM_FIXOS,
      ...variaveisDaRegra(regra).map((variavel) => ({ campo: variavel, rotulo: VARIAVEIS_REGRA[variavel].rotulo })),
    ],
    [regra],
  );
  const exemplo = renderizarMensagem(regra.entao.mensagem, {
    pessoa: 'Ana', data: '2026-08-12', limite: regra.quando.condicoes[0]?.valor ?? null, valores: valoresDeExemplo(regra),
  });

  function mudar(parte: Partial<RegraEscala>) {
    setRegra((atual) => ({ ...atual, ...parte }));
  }
  function mudarCondicao(indice: number, parte: Partial<CondicaoRegra>) {
    setRegra((atual) => ({
      ...atual,
      quando: { ...atual.quando, condicoes: atual.quando.condicoes.map((condicao, posicao) => (posicao === indice ? { ...condicao, ...parte } : condicao)) },
    }));
  }
  function trocarVariavel(indice: number, variavel: VariavelRegra) {
    // dia da semana compara com 0–6; ao trocar para ele (ou dele), o valor volta a um padrão que faz sentido
    mudarCondicao(indice, { variavel, valor: variavel === 'diaDaSemana' ? 0 : regra.quando.condicoes[indice]?.variavel === 'diaDaSemana' ? 1 : regra.quando.condicoes[indice]?.valor ?? 0 });
  }
  function adicionarCondicao() {
    setRegra((atual) => ({ ...atual, quando: { ...atual.quando, condicoes: [...atual.quando.condicoes, { variavel: 'horasNoDia', op: '>', valor: 8 }] } }));
  }
  function removerCondicao(indice: number) {
    setRegra((atual) => ({ ...atual, quando: { ...atual.quando, condicoes: atual.quando.condicoes.filter((_, posicao) => posicao !== indice) } }));
  }
  function alternarEquipe(equipeId: string) {
    setRegra((atual) => {
      const ids = atual.vale.ids ?? [];
      return { ...atual, vale: { tipo: 'EQUIPE', ids: ids.includes(equipeId) ? ids.filter((id) => id !== equipeId) : [...ids, equipeId] } };
    });
  }
  /** Insere {campo} onde está o cursor da mensagem (o campo vem do botão: handler estável, sem ref dentro do map). */
  function inserirCampo(evento: MouseEvent<HTMLButtonElement>) {
    const campo = evento.currentTarget.dataset.campo;
    const area = campoMensagem.current;
    if (!campo || !area) return;
    const inicio = area.selectionStart ?? regra.entao.mensagem.length;
    const fim = area.selectionEnd ?? inicio;
    const mensagem = `${regra.entao.mensagem.slice(0, inicio)}{${campo}}${regra.entao.mensagem.slice(fim)}`;
    setRegra((atual) => ({ ...atual, entao: { ...atual.entao, mensagem } }));
    window.requestAnimationFrame(() => { area.focus(); area.setSelectionRange(inicio + campo.length + 2, inicio + campo.length + 2); });
  }

  function executarTeste() {
    setTestando(true);
    // pequena espera só para o botão mostrar que trabalhou (o cálculo é instantâneo)
    window.setTimeout(() => {
      setTeste({ resultado: testarRegra(regra, documentos, catalogo, { nomePorLogin }), instantaneo });
      setTestando(false);
    }, 250);
  }

  const podeTestar = falta.length === 0 && escalaAberta !== null && documentos.length > 0;

  async function salvar() {
    setErroSalvar('');
    setSalvando(true);
    try {
      await onSalvar(regra);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErroSalvar(/permission|insufficient/iu.test(texto) ? 'Sem permissão: só o administrador do sistema salva regras.' : texto || 'Não foi possível salvar agora.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section className="edit-modal construtor-regra" role="dialog" aria-modal="true" aria-label={jaSalva ? 'Editar regra' : emEdicao ? 'Editar regra em teste' : 'Nova regra'} onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Sparkles size={18} aria-hidden="true" /></span>
          <div>
            <h2>{jaSalva ? 'Editar regra' : emEdicao ? 'Editar regra em teste' : 'Nova regra'}</h2>
            <p>Monte a regra como uma frase e teste na escala aberta. <strong>Ela só passa a valer quando você salvar.</strong></p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="construtor-colunas">
          <div className="construtor-form">
            <div className="construtor-bloco">
              <label className="criar-equipe-campo"><span>Nome da regra</span>
                <input value={regra.nome} maxLength={80} placeholder="Ex.: Máximo de 5 dias seguidos" onChange={(evento) => mudar({ nome: evento.target.value })} /></label>
              <label className="criar-equipe-campo"><span>Descrição <small>(opcional)</small></span>
                <input value={regra.descricao} maxLength={160} placeholder="Para que serve esta regra" onChange={(evento) => mudar({ descricao: evento.target.value })} /></label>
            </div>

            <div className="construtor-bloco">
              <div className="construtor-titulo"><span className="regra-palavra regra-palavra-se">SE</span><strong>acontecer isto…</strong></div>
              <ul className="construtor-condicoes">
                {regra.quando.condicoes.map((condicao, indice) => {
                  const definicao = VARIAVEIS_REGRA[condicao.variavel];
                  return (
                    <li key={indice}>
                      {indice > 0 && <span className="construtor-conector">{regra.quando.logica === 'E' ? 'E' : 'OU'}</span>}
                      <div className="construtor-linha-condicao">
                        <select aria-label="O que medir" value={condicao.variavel} onChange={(evento) => trocarVariavel(indice, evento.target.value as VariavelRegra)}>
                          {gruposVariaveis.map((grupo) => (
                            <optgroup key={grupo.categoria} label={grupo.rotulo}>
                              {grupo.variaveis.map((variavel) => <option key={variavel} value={variavel}>{VARIAVEIS_REGRA[variavel].rotulo}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <select aria-label="Comparação" className="construtor-operador" value={condicao.op} onChange={(evento) => mudarCondicao(indice, { op: evento.target.value as OperadorRegra })}>
                          {(Object.keys(OPERADORES_REGRA) as OperadorRegra[]).map((op) => <option key={op} value={op}>{SIMBOLO[op]}</option>)}
                        </select>
                        {condicao.variavel === 'diaDaSemana' ? (
                          <select aria-label="Dia da semana" value={Number.isFinite(condicao.valor) ? condicao.valor : 0} onChange={(evento) => mudarCondicao(indice, { valor: Number(evento.target.value) })}>
                            {NOMES_DIA_SEMANA.map((nome, numero) => <option key={nome} value={numero}>{nome}</option>)}
                          </select>
                        ) : (
                          <span className="construtor-valor">
                            <input aria-label="Valor" inputMode="decimal" value={Number.isFinite(condicao.valor) ? String(condicao.valor) : ''} onChange={(evento) => mudarCondicao(indice, { valor: valorDe(evento.target.value) })} />
                            {definicao.unidade !== '' && <small>{rotuloUnidade(definicao.unidade, condicao.valor)}</small>}
                          </span>
                        )}
                        <button type="button" className="icon-button" aria-label="Remover esta condição" disabled={regra.quando.condicoes.length === 1} onClick={() => removerCondicao(indice)}><Trash2 size={15} /></button>
                      </div>
                      <small className="construtor-ajuda">{definicao.ajuda}</small>
                    </li>
                  );
                })}
              </ul>
              <div className="construtor-acoes-condicao">
                <button type="button" className="secondary-button compact-button" disabled={regra.quando.condicoes.length >= 8} onClick={adicionarCondicao}><Plus size={14} aria-hidden="true" /> Adicionar condição</button>
                {regra.quando.condicoes.length > 1 && (
                  <div className="liderancas-abas" role="radiogroup" aria-label="Como combinar as condições">
                    <button type="button" role="radio" aria-checked={regra.quando.logica === 'E'} className={regra.quando.logica === 'E' ? 'active' : ''} onClick={() => mudar({ quando: { ...regra.quando, logica: 'E' } })}>Todas (E)</button>
                    <button type="button" role="radio" aria-checked={regra.quando.logica === 'OU'} className={regra.quando.logica === 'OU' ? 'active' : ''} onClick={() => mudar({ quando: { ...regra.quando, logica: 'OU' } })}>Qualquer uma (OU)</button>
                  </div>
                )}
              </div>
            </div>

            <div className="construtor-bloco">
              <div className="construtor-titulo"><span className="regra-palavra regra-palavra-entao">ENTÃO</span><strong>fazer isto</strong></div>
              <div className="construtor-gravidades" role="radiogroup" aria-label="Gravidade do alerta">
                {GRAVIDADES.map((gravidade) => (
                  <button key={gravidade.valor} type="button" role="radio" aria-checked={regra.entao.gravidade === gravidade.valor} data-gravidade={gravidade.valor}
                    className={regra.entao.gravidade === gravidade.valor ? 'active' : ''} onClick={() => mudar({ entao: { ...regra.entao, gravidade: gravidade.valor } })}>
                    <AlertTriangle size={15} aria-hidden="true" /><strong>{ROTULO_GRAVIDADE[gravidade.valor]}</strong><small>{gravidade.texto}</small>
                  </button>
                ))}
              </div>
              <label className="construtor-opcao">
                <input type="checkbox" checked={regra.entao.bloqueiaPublicacao} onChange={(evento) => mudar({ entao: { ...regra.entao, bloqueiaPublicacao: evento.target.checked } })} />
                <span><strong><ShieldAlert size={14} aria-hidden="true" /> Bloquear a publicação</strong><small>A escala só pode ser publicada depois de corrigir este problema.</small></span>
              </label>
              <div className="liderancas-abas" role="radiogroup" aria-label="Quando vários dias seguidos descumprem">
                <button type="button" role="radio" aria-checked={regra.entao.agrupar === 'CADA_DIA'} className={regra.entao.agrupar === 'CADA_DIA' ? 'active' : ''} onClick={() => mudar({ entao: { ...regra.entao, agrupar: 'CADA_DIA' } })}>Um alerta por dia</button>
                <button type="button" role="radio" aria-checked={regra.entao.agrupar === 'PRIMEIRO_DIA_DA_SEQUENCIA'} className={regra.entao.agrupar === 'PRIMEIRO_DIA_DA_SEQUENCIA' ? 'active' : ''} onClick={() => mudar({ entao: { ...regra.entao, agrupar: 'PRIMEIRO_DIA_DA_SEQUENCIA' } })}>Um alerta por sequência</button>
              </div>
              <label className="criar-equipe-campo"><span>Mensagem do alerta</span>
                <textarea ref={campoMensagem} rows={2} maxLength={200} value={regra.entao.mensagem} onChange={(evento) => mudar({ entao: { ...regra.entao, mensagem: evento.target.value } })} /></label>
              <div className="construtor-campos">
                <small>Inserir na mensagem:</small>
                {camposMensagem.map((item) => <button key={item.campo} type="button" className="construtor-campo-botao" data-campo={item.campo} onClick={inserirCampo}>{item.rotulo}</button>)}
              </div>
              <p className="construtor-exemplo"><small>Exemplo:</small> {exemplo || '—'}</p>
              <label className="criar-equipe-campo"><span>Sugestão de correção <small>(opcional)</small></span>
                <input value={regra.entao.sugestao ?? ''} maxLength={200} placeholder="O que a liderança deve fazer. Aceita {pessoa}, {dia}, {limite}…"
                  onChange={(evento) => mudar({ entao: { ...regra.entao, sugestao: evento.target.value } })} /></label>
            </div>

            <div className="construtor-bloco">
              <div className="construtor-titulo"><strong>Vale para</strong></div>
              <div className="liderancas-abas" role="radiogroup" aria-label="Alcance da regra">
                <button type="button" role="radio" aria-checked={regra.vale.tipo === 'TODAS'} className={regra.vale.tipo === 'TODAS' ? 'active' : ''} onClick={() => mudar({ vale: { tipo: 'TODAS' } })}>Todas as escalas</button>
                <button type="button" role="radio" aria-checked={regra.vale.tipo === 'EQUIPE'} className={regra.vale.tipo === 'EQUIPE' ? 'active' : ''} onClick={() => mudar({ vale: { tipo: 'EQUIPE', ids: regra.vale.ids ?? [] } })}>Só algumas equipes</button>
              </div>
              {regra.vale.tipo === 'EQUIPE' && (
                <div className="construtor-equipes">
                  {equipes.map((equipe) => (
                    <button key={equipe.id} type="button" role="checkbox" aria-checked={(regra.vale.ids ?? []).includes(equipe.id)} className={(regra.vale.ids ?? []).includes(equipe.id) ? 'active' : ''} onClick={() => alternarEquipe(equipe.id)}>{equipe.nome}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="construtor-lateral">
            <div className="construtor-bloco">
              <h3>Como a regra será lida</h3>
              <FraseSeEntao regra={regra} />
            </div>

            <div className="construtor-bloco">
              <h3>Testar na escala aberta</h3>
              {falta.length > 0 && (
                <ul className="construtor-falta">
                  {falta.map((texto) => <li key={texto}><Info size={13} aria-hidden="true" /> {texto}</li>)}
                </ul>
              )}
              <button type="button" className="primary-button construtor-testar" disabled={!podeTestar || testando} onClick={executarTeste}>
                {testando ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />} Testar nesta escala
              </button>
              <small className="construtor-ajuda">{escalaAberta === null ? 'Abra uma escala em Escalas para poder testar.' : <>Escala usada no teste: <strong>{escalaAberta}</strong>. Nada é gravado.</>}</small>

              {teste !== null && (
                <div className="construtor-resultado" data-desatualizado={testeDesatualizado ? '' : undefined}>
                  {testeDesatualizado && <p className="construtor-desatualizado"><Info size={14} aria-hidden="true" /> A regra mudou desde este teste — teste de novo.</p>}
                  {teste.resultado.total === 0 ? (
                    <p className="regra-ok"><CheckCircle2 size={16} aria-hidden="true" /> Nenhum caso: ninguém descumpre esta regra nesta escala.</p>
                  ) : (
                    <>
                      <p className="construtor-total"><strong>{teste.resultado.total}</strong> {teste.resultado.total === 1 ? 'caso' : 'casos'} em <strong>{teste.resultado.pessoasAfetadas}</strong> {teste.resultado.pessoasAfetadas === 1 ? 'pessoa' : 'pessoas'}</p>
                      <ul className="construtor-pessoas">
                        {teste.resultado.porPessoa.slice(0, 6).map((pessoa) => <li key={pessoa.login}><span>{pessoa.nome}</span><b>{pessoa.total}</b></li>)}
                      </ul>
                      <ul className="regra-casos">
                        {teste.resultado.amostra.slice(0, 5).map((caso) => <li key={caso.chave}><AlertTriangle size={14} aria-hidden="true" /><span>{caso.mensagem}</span></li>)}
                        {teste.resultado.total > 5 && <li className="regra-casos-mais">… e mais {teste.resultado.total - 5}</li>}
                      </ul>
                    </>
                  )}
                  <small className="construtor-ajuda">Avaliadas {teste.resultado.documentosAvaliados} escalas ({teste.resultado.diasAvaliados} dias).</small>
                </div>
              )}
            </div>
          </aside>
        </div>

        {erroSalvar && <div className="alert error" role="alert">{erroSalvar}</div>}
        <footer className="construtor-rodape">
          <small>
            <Info size={13} aria-hidden="true" />
            {regra.entao.bloqueiaPublicacao
              ? 'Ao salvar, escalas com este problema não poderão ser publicadas até a correção — para todas as lideranças.'
              : 'Ao salvar, a regra passa a valer para todas as lideranças, nas escalas do alcance escolhido.'}
          </small>
          <div>
            <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
            {!jaSalva && (
              <button type="button" className="secondary-button" disabled={falta.length > 0 || salvando} onClick={() => onManterEmTeste(regra)}>Manter em teste</button>
            )}
            <button type="button" className="primary-button" disabled={falta.length > 0 || salvando} onClick={() => void salvar()}>
              {salvando ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null} {jaSalva ? 'Salvar alterações' : 'Salvar e ativar'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
