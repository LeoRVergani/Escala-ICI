import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock3, Copy, Eye, FlaskConical, Info, Lock, Moon, Pencil, Plus, Repeat, Scale,
  ShieldAlert, Sparkles, Trash2, X,
} from 'lucide-react';
import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

import {
  avaliarRegras, copiarComoRascunho, formatarValorRegra, gerarIdRegraEmTeste, NOMES_DIA_SEMANA, OPERADORES_REGRA, renderizarMensagem, ROTULO_GRAVIDADE, rotuloUnidade, VARIAVEIS_REGRA,
  valoresDeExemplo, type AlertaRegra, type CategoriaVariavel, type CondicaoRegra, type RegraEscala,
} from '@/lib/regrasEscala';
import { lerEstadoDaRegra, type EstadoAssistente } from '@/lib/regrasAssistente';
import { idParaSalvar, type RegraEscalaSalva } from '@/lib/regrasPersistencia';
import { AssistenteRegra } from './AssistenteRegra';
import { ConstrutorRegra } from './ConstrutorRegra';

/**
 * REGRAS-ESCALA-1 — Administração › Regras: as regras da escala como frases
 * "SE … ENTÃO …", em cartões. Mostra o que já vale hoje (as regras que o
 * sistema aplicava, agora legíveis), quantos casos cada uma tem na escala
 * aberta e o detalhe de cada regra. Criar/editar vem na etapa seguinte.
 */
const ICONE_CATEGORIA: Record<CategoriaVariavel, ReactNode> = {
  SEQUENCIA: <Repeat size={18} />,
  DESCANSO: <Moon size={18} />,
  CARGA: <Clock3 size={18} />,
  DIA: <CalendarClock size={18} />,
};

function iconeDaRegra(regra: RegraEscala): ReactNode {
  const variavel = regra.quando.condicoes[0]?.variavel;
  return variavel ? ICONE_CATEGORIA[VARIAVEIS_REGRA[variavel].categoria] : <Sparkles size={18} />;
}


/** Símbolos de leitura comum no lugar da notação de programador (== >= <= !=). */
const SIMBOLO_OPERADOR: Record<CondicaoRegra['op'], string> = { '>': '>', '>=': '≥', '<': '<', '<=': '≤', '==': '=', '!=': '≠' };

function Condicao({ condicao }: { condicao: CondicaoRegra }) {
  const definicao = VARIAVEIS_REGRA[condicao.variavel];
  return (
    <span className="regra-condicao" title={definicao.ajuda}>
      <span className="regra-chip regra-chip-variavel">{definicao.rotulo}</span>
      <span className="regra-chip regra-chip-op" title={OPERADORES_REGRA[condicao.op]}>{SIMBOLO_OPERADOR[condicao.op]}</span>
      <span className="regra-chip regra-chip-valor">{Number.isFinite(condicao.valor)
        ? (condicao.variavel === 'diaDaSemana' ? (NOMES_DIA_SEMANA[condicao.valor] ?? formatarValorRegra(condicao.valor)) : formatarValorRegra(condicao.valor))
        : '…'}{definicao.unidade === '' || !Number.isFinite(condicao.valor) ? '' : ` ${rotuloUnidade(definicao.unidade, condicao.valor)}`}</span>
    </span>
  );
}

export function FraseSeEntao({ regra }: { regra: RegraEscala }) {
  const { entao, quando } = regra;
  return (
    <div className="regra-frase">
      <div className="regra-linha">
        <span className="regra-palavra regra-palavra-se">SE</span>
        <span className="regra-linha-chips">
          {quando.condicoes.map((condicao, indice) => (
            <span key={`${condicao.variavel}-${indice}`} className="regra-condicao-bloco">
              {indice > 0 && <span className="regra-conector">{quando.logica === 'E' ? 'E' : 'OU'}</span>}
              <Condicao condicao={condicao} />
            </span>
          ))}
        </span>
      </div>
      <div className="regra-linha">
        <span className="regra-palavra regra-palavra-entao">ENTÃO</span>
        <span className="regra-linha-chips">
          <span className="regra-chip regra-chip-acao" data-gravidade={entao.gravidade}>
            <AlertTriangle size={13} aria-hidden="true" /> gerar alerta · {ROTULO_GRAVIDADE[entao.gravidade].toLowerCase()}
          </span>
          {entao.bloqueiaPublicacao && <span className="regra-chip regra-chip-bloqueia"><ShieldAlert size={13} aria-hidden="true" /> bloquear a publicação</span>}
        </span>
      </div>
    </div>
  );
}

function Alcance({ regra }: { regra: RegraEscala }) {
  return <span className="regra-selo">{regra.vale.tipo === 'TODAS' ? 'Todas as escalas' : `${regra.vale.ids?.length ?? 0} equipe(s)`}</span>;
}

export function AdminRegrasPage({
  regras, regrasSalvas, erroCarregar, ignoradas, equipes, documentos, catalogo, escalaAberta, nomePorLogin, subnav, onSalvar, onAlternar, onExcluir,
}: {
  /** As regras legais (vêm do código; não se grava nem se desliga). */
  regras: readonly RegraEscala[];
  /** REGRAS-ESCALA-4 — regras da empresa salvas pelo administrador. */
  regrasSalvas: readonly RegraEscalaSalva[];
  erroCarregar: string;
  /** Quantas regras salvas vieram inválidas e foram ignoradas. */
  ignoradas: number;
  onSalvar: (regra: RegraEscala, existente: RegraEscalaSalva | null) => Promise<void>;
  onAlternar: (regra: RegraEscalaSalva, ativa: boolean) => Promise<void>;
  onExcluir: (regra: RegraEscalaSalva) => Promise<void>;
  /** Equipes que o construtor oferece em "Vale para". */
  equipes: ReadonlyArray<{ id: string; nome: string }>;
  documentos: readonly TurnosMes[];
  catalogo: Record<string, TipoTurno>;
  /** Nome legível da escala usada para contar os casos (ex.: "SOC · Agosto de 2026"), ou null. */
  escalaAberta: string | null;
  nomePorLogin: Readonly<Record<string, string>>;
  subnav: ReactNode;
}) {
  const [aberta, setAberta] = useState<RegraEscala | null>(null);
  /** REGRAS-ESCALA-3 — regras em teste: só nesta tela, nada é salvo (salvar vem na etapa seguinte). */
  const [emTeste, setEmTeste] = useState<RegraEscala[]>([]);
  const [construtor, setConstrutor] = useState<{ regra: RegraEscala; emEdicao: boolean; jaSalva: boolean } | null>(null);
  /** ASSISTENTE-REGRAS-1 — criar/editar pelo passo a passo (a regra de desenho livre cai no modo avançado). */
  const [assistente, setAssistente] = useState<{ id: string; estado: EstadoAssistente | null; jaSalva: boolean } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState('');
  const [excluindo, setExcluindo] = useState<RegraEscalaSalva | null>(null);
  const todasValendo = useMemo(() => [...regras, ...regrasSalvas], [regras, regrasSalvas]);
  const alertas = useMemo(
    () => avaliarRegras(documentos, catalogo, todasValendo, { nomePorLogin }),
    [documentos, catalogo, todasValendo, nomePorLogin],
  );
  const alertasEmTeste = useMemo(
    () => avaliarRegras(documentos, catalogo, emTeste.map((regra) => ({ ...regra, ativa: true })), { nomePorLogin }),
    [documentos, catalogo, emTeste, nomePorLogin],
  );
  const casosPorRegra = useMemo(() => {
    const mapa = new Map<string, AlertaRegra[]>();
    for (const alerta of [...alertas, ...alertasEmTeste]) mapa.set(alerta.regraId, [...(mapa.get(alerta.regraId) ?? []), alerta]);
    return mapa;
  }, [alertas, alertasEmTeste]);
  const legais = regras.filter((regra) => regra.categoria === 'LEGAL');
  const daEmpresa = regrasSalvas;

  /** Abre a regra no passo a passo se ela tem o desenho de uma das situações; senão, no modo avançado. */
  function abrirParaEditar(regra: RegraEscala, jaSalva: boolean, emEdicao: boolean) {
    const estado = lerEstadoDaRegra(regra);
    if (estado !== null) setAssistente({ id: regra.id, estado, jaSalva });
    else setConstrutor({ regra, emEdicao, jaSalva });
  }
  async function salvarDaTela(regra: RegraEscala) {
    const existente = regrasSalvas.find((item) => item.id === idParaSalvar(regra)) ?? null;
    await onSalvar(regra, existente);
    setEmTeste((atuais) => atuais.filter((item) => item.id !== regra.id));
    setConstrutor(null);
    setAssistente(null);
  }
  function manterEmTesteDaTela(regra: RegraEscala) {
    setEmTeste((atuais) => (atuais.some((item) => item.id === regra.id) ? atuais.map((item) => (item.id === regra.id ? regra : item)) : [...atuais, regra]));
    setConstrutor(null);
    setAssistente(null);
  }

  function textoErro(falha: unknown): string {
    const texto = falha instanceof Error ? falha.message : '';
    return /permission|insufficient/iu.test(texto) ? 'Sem permissão: só o administrador do sistema altera regras.' : texto || 'Não foi possível concluir agora.';
  }
  async function alternar(regra: RegraEscalaSalva) {
    setErroAcao('');
    setOcupado(regra.id);
    try {
      await onAlternar(regra, !regra.ativa);
    } catch (falha) {
      setErroAcao(textoErro(falha));
    } finally {
      setOcupado(null);
    }
  }
  async function confirmarExclusao(regra: RegraEscalaSalva) {
    setErroAcao('');
    setOcupado(regra.id);
    try {
      await onExcluir(regra);
      setExcluindo(null);
    } catch (falha) {
      setErroAcao(textoErro(falha));
    } finally {
      setOcupado(null);
    }
  }

  const cartao = (regra: RegraEscala, modo: 'legal' | 'salva' | 'teste' = 'legal') => {
    const emModoTeste = modo === 'teste';
    const salva = modo === 'salva' ? (regra as RegraEscalaSalva) : null;
    const casos = casosPorRegra.get(regra.id)?.length ?? 0;
    return (
      <li key={regra.id} className="regra-cartao" data-legal={regra.categoria === 'LEGAL' ? '' : undefined} data-inativa={regra.ativa ? undefined : ''} data-teste={emModoTeste ? '' : undefined}>
        <div className="regra-cartao-topo">
          <span className="regra-icone" aria-hidden="true">{iconeDaRegra(regra)}</span>
          <span className="regra-titulo">
            <strong>{regra.nome}</strong>
            <small>{regra.descricao}</small>
          </span>
          {emModoTeste
            ? <span className="regra-estado regra-estado-teste"><FlaskConical size={12} aria-hidden="true" /> Em teste</span>
            : salva
              ? (
                <button type="button" role="switch" aria-checked={salva.ativa} className="regra-estado regra-estado-botao" data-ativa={salva.ativa ? '' : undefined}
                  disabled={ocupado === salva.id} title={salva.ativa ? 'Desligar a regra' : 'Ligar a regra'} onClick={() => void alternar(salva)}>
                  <span aria-hidden="true" /> {salva.ativa ? 'Ativa' : 'Desligada'}
                </button>
              )
              : <span className="regra-estado" data-ativa={regra.ativa ? '' : undefined}><span aria-hidden="true" /> {regra.ativa ? 'Ativa' : 'Desligada'}</span>}
        </div>
        <FraseSeEntao regra={regra} />
        <div className="regra-cartao-rodape">
          <span className="regra-selos">
            {regra.categoria === 'LEGAL'
              ? <span className="regra-selo regra-selo-legal" title="Regra da legislação: pode ser endurecida, mas não desligada."><Lock size={12} aria-hidden="true" /> Legal</span>
              : <span className="regra-selo">Da empresa</span>}
            <Alcance regra={regra} />
            <span className="regra-selo regra-selo-casos" data-casos={casos > 0 ? '' : undefined} title={escalaAberta ?? 'Abra uma escala para ver as ocorrências'}>
              {!regra.ativa ? 'Desligada — não vale' : escalaAberta === null ? 'Sem escala aberta' : casos === 0 ? 'Nenhuma ocorrência na escala aberta' : `${casos} ${casos === 1 ? 'ocorrência' : 'ocorrências'} na escala aberta`}
            </span>
          </span>
          {salva ? (
            <span className="regra-acoes-teste">
              <button type="button" className="secondary-button compact-button" onClick={() => abrirParaEditar(salva, true, true)}><Pencil size={14} aria-hidden="true" /> Editar</button>
              <button type="button" className="icon-button" aria-label={`Excluir ${salva.nome}`} title="Excluir" onClick={() => { setErroAcao(''); setExcluindo(salva); }}><Trash2 size={15} /></button>
            </span>
          ) : emModoTeste ? (
            <span className="regra-acoes-teste">
              <button type="button" className="secondary-button compact-button" onClick={() => abrirParaEditar(regra, false, true)}><Pencil size={14} aria-hidden="true" /> Editar</button>
              <button type="button" className="icon-button" aria-label={`Descartar ${regra.nome}`} title="Descartar" onClick={() => setEmTeste((atuais) => atuais.filter((item) => item.id !== regra.id))}><Trash2 size={15} /></button>
            </span>
          ) : (
            <button type="button" className="secondary-button compact-button" onClick={() => setAberta(regra)}>
              <Eye size={14} aria-hidden="true" /> Ver detalhes <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="admin-equipes regras-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Regras da escala</h1>
          <p>Quando o sistema deve avisar a liderança. Cada regra é uma frase: <strong>SE</strong> acontece algo, <strong>ENTÃO</strong> gera um alerta.</p>
        </div>
        <div className="grade-header-actions">
          <button type="button" className="primary-button" onClick={() => setAssistente({ id: gerarIdRegraEmTeste(), estado: null, jaSalva: false })}><Plus size={16} /> Nova regra</button>
        </div>
      </header>
      {subnav}

      <div className="admin-numeros">
        <div><CheckCircle2 size={18} aria-hidden="true" /><span><small>Regras ativas</small><strong>{todasValendo.filter((regra) => regra.ativa).length}</strong></span></div>
        <div><Scale size={18} aria-hidden="true" /><span><small>Legais</small><strong>{legais.length}</strong></span></div>
        <div><Sparkles size={18} aria-hidden="true" /><span><small>Da empresa</small><strong>{daEmpresa.length}</strong></span></div>
        <div><FlaskConical size={18} aria-hidden="true" /><span><small>Em teste</small><strong>{emTeste.length}</strong></span></div>
        <div data-alerta={alertas.length > 0 ? '' : undefined}><AlertTriangle size={18} aria-hidden="true" /><span><small>Ocorrências na escala aberta</small><strong>{escalaAberta === null ? '–' : alertas.length}</strong></span></div>
      </div>

      {erroCarregar && <div className="alert error" role="alert">{erroCarregar}</div>}
      {ignoradas > 0 && <div className="alert warning" role="status">{ignoradas === 1 ? '1 regra salva está inválida e foi ignorada.' : `${ignoradas} regras salvas estão inválidas e foram ignoradas.`}</div>}
      {erroAcao && <div className="alert error" role="alert">{erroAcao}</div>}
      <p className="regras-dica"><Info size={15} aria-hidden="true" /> {escalaAberta === null
        ? 'Escolha uma escala em Escalas para ver quantas ocorrências cada regra encontra nela.'
        : <>As ocorrências são contadas na escala <strong>{escalaAberta}</strong>.</>}</p>

      <div className="regras-grupo">
        <h2><Scale size={16} aria-hidden="true" /> Regras legais</h2>
        <p>Já valem hoje. Vêm da legislação trabalhista: o limite poderá ser endurecido, mas elas não podem ser desligadas.</p>
        <ul className="regras-lista">{legais.map((regra) => cartao(regra))}</ul>
      </div>

      <div className="regras-grupo">
        <h2><Sparkles size={16} aria-hidden="true" /> Regras da empresa</h2>
        {daEmpresa.length === 0 ? (
          <div className="regras-vazio">
            <Sparkles size={22} aria-hidden="true" />
            <strong>Nenhuma regra da empresa ainda</strong>
            <small>Monte uma regra com <strong>Nova regra</strong> ou comece de um exemplo, teste na escala aberta e salve para valer para todas as lideranças.</small>
          </div>
        ) : (
          <ul className="regras-lista">{daEmpresa.map((regra) => cartao(regra, 'salva'))}</ul>
        )}
      </div>

      {emTeste.length > 0 && (
        <div className="regras-grupo">
          <h2><FlaskConical size={16} aria-hidden="true" /> Em teste</h2>
          <p>Estas regras existem só nesta tela e <strong>não valem para ninguém</strong> até você salvar. Ao sair da página, elas se perdem.</p>
          <ul className="regras-lista">{emTeste.map((regra) => cartao(regra, 'teste'))}</ul>
        </div>
      )}

      {aberta && (
        <DetalheRegra
          regra={aberta}
          casos={casosPorRegra.get(aberta.id) ?? []}
          escalaAberta={escalaAberta}
          onFechar={() => setAberta(null)}
          onCriarVersao={() => { abrirParaEditar(copiarComoRascunho(aberta, gerarIdRegraEmTeste()), false, false); setAberta(null); }}
        />
      )}
      {excluindo && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setExcluindo(null)}>
          <section className="edit-modal alteracao-problemas" role="alertdialog" aria-modal="true" aria-label="Excluir regra" onMouseDown={(evento) => evento.stopPropagation()}>
            <header className="criar-equipe-cabecalho">
              <span className="criar-equipe-icone alteracao-problemas-icone"><Trash2 size={18} aria-hidden="true" /></span>
              <div><h2>Excluir “{excluindo.nome}”?</h2><p>A regra deixa de valer para todas as lideranças, imediatamente.</p></div>
              <button className="icon-button" type="button" onClick={() => setExcluindo(null)} aria-label="Fechar"><X size={18} /></button>
            </header>
            <p className="regra-exemplo">Se você só quer parar de usá-la por um tempo, <strong>desligue</strong> a regra em vez de excluir.</p>
            {erroAcao && <div className="alert error" role="alert">{erroAcao}</div>}
            <div className="criar-equipe-acoes">
              <button type="button" className="secondary-button" disabled={ocupado === excluindo.id} onClick={() => setExcluindo(null)}>Manter a regra</button>
              <button type="button" className="primary-button danger-button" disabled={ocupado === excluindo.id} onClick={() => void confirmarExclusao(excluindo)}>Excluir</button>
            </div>
          </section>
        </div>
      )}
      {assistente && (
        <AssistenteRegra
          idRegra={assistente.id}
          inicial={assistente.estado}
          jaSalva={assistente.jaSalva}
          equipes={equipes}
          documentos={documentos}
          catalogo={catalogo}
          escalaAberta={escalaAberta}
          nomePorLogin={nomePorLogin}
          onFechar={() => setAssistente(null)}
          onAvancado={(regra) => { setAssistente(null); setConstrutor({ regra, emEdicao: false, jaSalva: assistente.jaSalva }); }}
          onManterEmTeste={manterEmTesteDaTela}
          onSalvar={salvarDaTela}
        />
      )}
      {construtor && (
        <ConstrutorRegra
          inicial={construtor.regra}
          equipes={equipes}
          documentos={documentos}
          catalogo={catalogo}
          escalaAberta={escalaAberta}
          nomePorLogin={nomePorLogin}
          emEdicao={construtor.emEdicao}
          jaSalva={construtor.jaSalva}
          onFechar={() => setConstrutor(null)}
          onSalvar={salvarDaTela}
          onManterEmTeste={manterEmTesteDaTela}
        />
      )}
    </section>
  );
}

function DetalheRegra({ regra, casos, escalaAberta, onFechar, onCriarVersao }: {
  regra: RegraEscala; casos: readonly AlertaRegra[]; escalaAberta: string | null; onFechar: () => void; onCriarVersao: () => void;
}) {
  const exemplo = renderizarMensagem(regra.entao.mensagem, {
    pessoa: 'Ana', data: '2026-08-12', limite: regra.quando.condicoes[0]?.valor ?? null, valores: valoresDeExemplo(regra),
  });
  const mensagemComDestaque = regra.entao.mensagem.split(/(\{[a-zA-Z]+\})/u).map((trecho, indice) => (
    /^\{[a-zA-Z]+\}$/u.test(trecho) ? <mark key={indice} className="regra-variavel-msg">{trecho}</mark> : <span key={indice}>{trecho}</span>
  ));
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section className="edit-modal regra-detalhe" role="dialog" aria-modal="true" aria-label={regra.nome} onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone">{iconeDaRegra(regra)}</span>
          <div><h2>{regra.nome}</h2><p>{regra.descricao}</p></div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="regra-bloco">
          <h3>Como a regra decide</h3>
          <FraseSeEntao regra={regra} />
          <ul className="regra-explicacoes">
            {regra.quando.condicoes.map((condicao, indice) => (
              <li key={`${condicao.variavel}-${indice}`}><strong>{VARIAVEIS_REGRA[condicao.variavel].rotulo}:</strong> {VARIAVEIS_REGRA[condicao.variavel].ajuda}</li>
            ))}
            {regra.entao.agrupar === 'PRIMEIRO_DIA_DA_SEQUENCIA' && <li>Dias seguidos que descumprem a regra geram <strong>um alerta só</strong>, no primeiro deles.</li>}
          </ul>
        </div>

        <div className="regra-bloco">
          <h3>A mensagem do alerta</h3>
          <p className="regra-mensagem">{mensagemComDestaque}</p>
          <p className="regra-exemplo"><small>Exemplo:</small> {exemplo}</p>
        </div>

        <div className="regra-bloco">
          <h3>Onde aparece</h3>
          <ul className="regra-explicacoes">
            <li>Marca o dia na grade da escala.</li>
            <li>Entra no sino de alertas da liderança.</li>
            <li>{regra.entao.bloqueiaPublicacao ? 'Impede a publicação enquanto não for corrigido.' : 'Aparece ao publicar, sem impedir (só avisa).'}</li>
          </ul>
        </div>

        <div className="regra-bloco">
          <h3>Ocorrências {escalaAberta ? `em ${escalaAberta}` : 'na escala aberta'}</h3>
          {escalaAberta === null ? (
            <p className="regra-exemplo">Abra uma escala em Escalas para ver as ocorrências.</p>
          ) : casos.length === 0 ? (
            <p className="regra-exemplo regra-ok"><CheckCircle2 size={15} aria-hidden="true" /> Nenhuma ocorrência: ninguém descumpre esta regra nesta escala.</p>
          ) : (
            <ul className="regra-casos">
              {casos.slice(0, 8).map((caso) => (
                <li key={caso.chave}><AlertTriangle size={14} aria-hidden="true" /> <span>{caso.mensagem}</span></li>
              ))}
              {casos.length > 8 && <li className="regra-casos-mais">… e mais {casos.length - 8}</li>}
            </ul>
          )}
        </div>

        {regra.categoria === 'LEGAL' && (
          <p className="regra-nota-legal"><Lock size={14} aria-hidden="true" /><span>Regra legal: o limite poderá ser <strong>endurecido</strong> (por exemplo, descanso de 12 h), mas a regra não pode ser desligada nem afrouxada.</span></p>
        )}
        <div className="criar-equipe-acoes">
          <button type="button" className="secondary-button" onClick={onCriarVersao}><Copy size={15} aria-hidden="true" /> {regra.categoria === 'LEGAL' ? 'Criar uma versão mais rígida' : 'Criar uma cópia para editar'}</button>
          <button type="button" className="primary-button" onClick={onFechar}>Fechar</button>
        </div>
      </section>
    </div>
  );
}
