import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Clock3, Copy, Eye, FlaskConical, Info, Lock, Moon, Pencil, Plus, Repeat, Scale,
  ShieldAlert, Sparkles, Trash2, X,
} from 'lucide-react';
import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';

import {
  avaliarRegras, copiarComoRascunho, formatarValorRegra, gerarIdRegraEmTeste, NOMES_DIA_SEMANA, novaRegraEmBranco, OPERADORES_REGRA, renderizarMensagem, ROTULO_GRAVIDADE, rotuloUnidade, VARIAVEIS_REGRA,
  type AlertaRegra, type CategoriaVariavel, type CondicaoRegra, type RegraEscala, type ValoresDia,
} from '@/lib/regrasEscala';
import { EXEMPLOS_REGRA } from '@/lib/regrasExemplos';
import { ConstrutorRegra } from './ConstrutorRegra';
import { MenuAcoes } from './MenuAcoes';

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

/** Valores de exemplo que fazem a regra disparar — para mostrar como a mensagem fica. */
export function valoresDeExemplo(regra: RegraEscala): ValoresDia {
  const valores: ValoresDia = {};
  for (const condicao of regra.quando.condicoes) {
    const { valor, op } = condicao;
    valores[condicao.variavel] = op === '>' || op === '!=' ? valor + 1 : op === '<' ? (valor >= 2 ? valor - 2 : valor - 1) : valor;
  }
  return valores;
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

export function AdminRegrasPage({ regras, equipes, documentos, catalogo, escalaAberta, nomePorLogin, subnav }: {
  regras: readonly RegraEscala[];
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
  const [construtor, setConstrutor] = useState<{ regra: RegraEscala; emEdicao: boolean } | null>(null);
  const alertas = useMemo(
    () => avaliarRegras(documentos, catalogo, regras, { nomePorLogin }),
    [documentos, catalogo, regras, nomePorLogin],
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
  const daEmpresa = regras.filter((regra) => regra.categoria === 'EMPRESA');

  const cartao = (regra: RegraEscala, emModoTeste = false) => {
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
            : <span className="regra-estado" data-ativa={regra.ativa ? '' : undefined}><span aria-hidden="true" /> {regra.ativa ? 'Ativa' : 'Desligada'}</span>}
        </div>
        <FraseSeEntao regra={regra} />
        <div className="regra-cartao-rodape">
          <span className="regra-selos">
            {regra.categoria === 'LEGAL'
              ? <span className="regra-selo regra-selo-legal" title="Regra da legislação: pode ser endurecida, mas não desligada."><Lock size={12} aria-hidden="true" /> Legal</span>
              : <span className="regra-selo">Da empresa</span>}
            <Alcance regra={regra} />
            <span className="regra-selo regra-selo-casos" data-casos={casos > 0 ? '' : undefined} title={escalaAberta ?? 'Abra uma escala para ver os casos'}>
              {escalaAberta === null ? 'Sem escala aberta' : casos === 0 ? 'Nenhum caso na escala aberta' : `${casos} ${casos === 1 ? 'caso' : 'casos'} na escala aberta`}
            </span>
          </span>
          {emModoTeste ? (
            <span className="regra-acoes-teste">
              <button type="button" className="secondary-button compact-button" onClick={() => setConstrutor({ regra, emEdicao: true })}><Pencil size={14} aria-hidden="true" /> Editar</button>
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
          <MenuAcoes
            rotulo="Começar de um exemplo"
            classeBotao="secondary-button"
            conteudoBotao={<><Sparkles size={15} aria-hidden="true" /> Começar de um exemplo <ChevronDown size={14} aria-hidden="true" /></>}
            itens={EXEMPLOS_REGRA.map((exemplo) => ({
              rotulo: exemplo.titulo,
              dica: exemplo.descricao,
              executar: () => setConstrutor({ regra: { ...structuredClone(exemplo.modelo), id: gerarIdRegraEmTeste() }, emEdicao: false }),
            }))}
          />
          <button type="button" className="primary-button" onClick={() => setConstrutor({ regra: novaRegraEmBranco(gerarIdRegraEmTeste()), emEdicao: false })}><Plus size={16} /> Nova regra</button>
        </div>
      </header>
      {subnav}

      <div className="admin-numeros">
        <div><CheckCircle2 size={18} aria-hidden="true" /><span><small>Regras ativas</small><strong>{regras.filter((regra) => regra.ativa).length}</strong></span></div>
        <div><Scale size={18} aria-hidden="true" /><span><small>Legais</small><strong>{legais.length}</strong></span></div>
        <div><Sparkles size={18} aria-hidden="true" /><span><small>Da empresa</small><strong>{daEmpresa.length}</strong></span></div>
        <div><FlaskConical size={18} aria-hidden="true" /><span><small>Em teste</small><strong>{emTeste.length}</strong></span></div>
        <div data-alerta={alertas.length > 0 ? '' : undefined}><AlertTriangle size={18} aria-hidden="true" /><span><small>Casos na escala aberta</small><strong>{escalaAberta === null ? '–' : alertas.length}</strong></span></div>
      </div>

      <p className="regras-dica"><Info size={15} aria-hidden="true" /> {escalaAberta === null
        ? 'Escolha uma escala em Escalas para ver quantos casos cada regra encontra nela.'
        : <>Os casos são contados na escala <strong>{escalaAberta}</strong>.</>}</p>

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
            <strong>Nenhuma regra da empresa salva ainda</strong>
            <small>Monte uma regra com <strong>Nova regra</strong> ou comece de um exemplo, e teste na escala aberta. Salvar e ativar a regra para todos chega na próxima etapa.</small>
          </div>
        ) : (
          <ul className="regras-lista">{daEmpresa.map((regra) => cartao(regra))}</ul>
        )}
      </div>

      {emTeste.length > 0 && (
        <div className="regras-grupo">
          <h2><FlaskConical size={16} aria-hidden="true" /> Em teste</h2>
          <p>Estas regras existem só nesta tela e <strong>não valem para ninguém</strong>. Ao sair da página, elas se perdem.</p>
          <ul className="regras-lista">{emTeste.map((regra) => cartao(regra, true))}</ul>
        </div>
      )}

      {aberta && (
        <DetalheRegra
          regra={aberta}
          casos={casosPorRegra.get(aberta.id) ?? []}
          escalaAberta={escalaAberta}
          onFechar={() => setAberta(null)}
          onCriarVersao={() => { setConstrutor({ regra: copiarComoRascunho(aberta, gerarIdRegraEmTeste()), emEdicao: false }); setAberta(null); }}
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
          onFechar={() => setConstrutor(null)}
          onManterEmTeste={(regra) => {
            setEmTeste((atuais) => (atuais.some((item) => item.id === regra.id) ? atuais.map((item) => (item.id === regra.id ? regra : item)) : [...atuais, regra]));
            setConstrutor(null);
          }}
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
          <h3>Casos {escalaAberta ? `em ${escalaAberta}` : 'na escala aberta'}</h3>
          {escalaAberta === null ? (
            <p className="regra-exemplo">Abra uma escala em Escalas para ver os casos.</p>
          ) : casos.length === 0 ? (
            <p className="regra-exemplo regra-ok"><CheckCircle2 size={15} aria-hidden="true" /> Nenhum caso: ninguém descumpre esta regra nesta escala.</p>
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
