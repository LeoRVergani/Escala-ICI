import { useMemo, useState } from 'react';
import { CheckCircle2, Crown, LoaderCircle, Search, UserMinus, UserPlus, X } from 'lucide-react';

import { cadastrarNovaLideranca, removerLideranca } from '@/lib/firebase/liderancasRepository';
import { ehLideranca, loginDoEmailCorporativo, podeRemoverLideranca } from '@/lib/liderancas';
import type { Usuario } from '@/lib/modelos';
import { ConfirmarPromocao, iniciais, mensagemErro, usePessoas, type Pessoa } from './pessoasLideranca';

/**
 * LIDERANCAS-2 — Dashboard › Lideranças: só as lideranças. "Nova liderança"
 * promove um colaborador ou cadastra uma pessoa nova já como liderança; o
 * administrador pode remover alguém da liderança.
 */
export function LiderancasPage({ autor, souAdmin, nomeEquipe }: {
  autor: Usuario; souAdmin: boolean; nomeEquipe: (equipeId: string) => string;
}) {
  const { pessoas, erro: erroCarga, recarregar } = usePessoas();
  const [busca, setBusca] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [novaAberta, setNovaAberta] = useState(false);
  const [removendo, setRemovendo] = useState<Pessoa | null>(null);
  const nomePorLogin = useMemo(() => new Map((pessoas ?? []).map((pessoa) => [pessoa.login, pessoa.nome])), [pessoas]);
  const termo = busca.trim().toLowerCase();
  const liderancas = (pessoas ?? []).filter(ehLideranca)
    .filter((pessoa) => termo === '' || `${pessoa.nome} ${pessoa.login} ${pessoa.cargo ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <section className="liderancas-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Equipes</p>
          <h1>Lideranças</h1>
          <p>Quem cuida de equipe — coordenador, supervisor, gestor ou chefe. Liderança cria equipes e Plantões e pode tornar outra pessoa liderança.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => { setMensagem(''); setNovaAberta(true); }}>
          <UserPlus size={16} aria-hidden="true" /> Nova liderança
        </button>
      </header>

      <div className="liderancas-barra">
        <span className="liderancas-total"><Crown size={15} aria-hidden="true" /> {(pessoas ?? []).filter(ehLideranca).length} lideranças</span>
        <label className="liderancas-busca">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar por nome, login ou cargo" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        </label>
      </div>
      {erroCarga && <div className="alert error" role="alert">{erroCarga}</div>}
      {mensagem && <p className="liderancas-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</p>}

      {pessoas === null && !erroCarga ? (
        <p className="liderancas-carregando"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Carregando…</p>
      ) : liderancas.length === 0 ? (
        <p className="liderancas-vazio">{termo ? 'Ninguém encontrado com essa busca.' : 'Nenhuma liderança ainda.'}</p>
      ) : (
        <ul className="liderancas-lista">
          {liderancas.map((pessoa) => (
            <li key={pessoa.login}>
              <span className="liderancas-avatar" data-lideranca="" aria-hidden="true">{iniciais(pessoa.nome)}</span>
              <span className="liderancas-pessoa">
                <strong>{pessoa.nome}</strong>
                <small>{[pessoa.cargo, pessoa.equipeId ? nomeEquipe(pessoa.equipeId) : null].filter(Boolean).join(' · ') || pessoa.login}</small>
                {pessoa.promovidoPorLogin && (
                  <em>Liderança por {nomePorLogin.get(pessoa.promovidoPorLogin) ?? pessoa.promovidoPorLogin}
                    {pessoa.promovidoEm ? ` em ${new Date(pessoa.promovidoEm).toLocaleDateString('pt-BR')}` : ''}</em>
                )}
              </span>
              {souAdmin && podeRemoverLideranca(pessoa) && pessoa.login !== autor.login && (
                <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setRemovendo(pessoa); }}>
                  <UserMinus size={15} aria-hidden="true" /> Remover liderança
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {novaAberta && pessoas !== null && (
        <NovaLiderancaModal
          autor={autor}
          pessoas={pessoas}
          onFechar={() => setNovaAberta(false)}
          onPronto={(texto) => { setNovaAberta(false); setMensagem(texto); recarregar(); }}
        />
      )}
      {removendo && (
        <ConfirmarRemocao pessoa={removendo} onFechar={() => setRemovendo(null)}
          onRemovida={() => { setMensagem(`${removendo.nome} voltou a ser colaborador.`); setRemovendo(null); recarregar(); }} />
      )}
    </section>
  );
}

function NovaLiderancaModal({ autor, pessoas, onFechar, onPronto }: {
  autor: Usuario; pessoas: readonly Pessoa[]; onFechar: () => void; onPronto: (mensagem: string) => void;
}) {
  const [modo, setModo] = useState<'colaborador' | 'nova'>('colaborador');
  const [busca, setBusca] = useState('');
  const [escolhida, setEscolhida] = useState<Pessoa | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const termo = busca.trim().toLowerCase();
  const colaboradores = pessoas.filter((pessoa) => !ehLideranca(pessoa))
    .filter((pessoa) => termo.length >= 2 && `${pessoa.nome} ${pessoa.login}`.toLowerCase().includes(termo))
    .slice(0, 8);
  const loginNovo = loginDoEmailCorporativo(email);
  const jaCadastrada = loginNovo ? pessoas.find((pessoa) => pessoa.login === loginNovo) ?? null : null;

  async function cadastrar() {
    setErro('');
    if (jaCadastrada) { setErro(`${jaCadastrada.nome} já tem cadastro — use “Escolher colaborador”.`); return; }
    setSalvando(true);
    try {
      await cadastrarNovaLideranca({ nome, email, cargo }, autor.login);
      onPronto(`${nome.trim()} foi cadastrada como liderança. No primeiro acesso, entra com o e-mail corporativo.`);
    } catch (falha) {
      setErro(mensagemErro(falha, 'Não foi possível cadastrar agora.'));
      setSalvando(false);
    }
  }

  if (escolhida) {
    return <ConfirmarPromocao pessoa={escolhida} autorLogin={autor.login} onFechar={() => setEscolhida(null)}
      onPromovida={(pessoa) => onPronto(`${pessoa.nome} agora é liderança e já pode criar equipe.`)} />;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : onFechar}>
      <section className="edit-modal criar-equipe-modal" role="dialog" aria-modal="true" aria-labelledby="nova-lideranca-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Crown size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="nova-lideranca-titulo">Nova liderança</h2>
            <p>Escolha um colaborador já cadastrado ou cadastre uma pessoa nova.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={salvando} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="criar-plantao-segmento" role="tablist" aria-label="Como">
          <button type="button" role="tab" aria-selected={modo === 'colaborador'} className={modo === 'colaborador' ? 'active' : ''} onClick={() => setModo('colaborador')}>Escolher colaborador</button>
          <button type="button" role="tab" aria-selected={modo === 'nova'} className={modo === 'nova' ? 'active' : ''} onClick={() => setModo('nova')}>Pessoa nova</button>
        </div>
        {modo === 'colaborador' ? (
          <>
            <label className="criar-equipe-campo">
              <span>Buscar colaborador</span>
              <input autoFocus value={busca} placeholder="Digite o nome ou o login" onChange={(evento) => setBusca(evento.target.value)} />
            </label>
            {termo.length >= 2 && (colaboradores.length === 0 ? (
              <p className="liderancas-vazio">Ninguém encontrado. Se a pessoa ainda não tem cadastro, use “Pessoa nova”.</p>
            ) : (
              <ul className="nova-lideranca-resultados">
                {colaboradores.map((pessoa) => (
                  <li key={pessoa.login}>
                    <button type="button" onClick={() => setEscolhida(pessoa)}>
                      <span className="liderancas-avatar" aria-hidden="true">{iniciais(pessoa.nome)}</span>
                      <span className="liderancas-pessoa"><strong>{pessoa.nome}</strong><small>{pessoa.cargo || pessoa.login}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </>
        ) : (
          <>
            <label className="criar-equipe-campo"><span>Nome</span>
              <input autoFocus value={nome} maxLength={80} onChange={(evento) => setNome(evento.target.value)} /></label>
            <label className="criar-equipe-campo"><span>E-mail corporativo</span>
              <input type="email" value={email} maxLength={120} placeholder="nome@empresa.com" onChange={(evento) => setEmail(evento.target.value)} /></label>
            <label className="criar-equipe-campo"><span>Cargo</span>
              <input value={cargo} maxLength={80} placeholder="Ex.: Coordenador de Infraestrutura" onChange={(evento) => setCargo(evento.target.value)} /></label>
            {jaCadastrada && <p className="liderancas-dica">{jaCadastrada.nome} já tem cadastro com este e-mail — use “Escolher colaborador”.</p>}
            {erro && <div className="alert error" role="alert">{erro}</div>}
            <div className="criar-equipe-acoes">
              <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
              <button type="button" className="primary-button" disabled={salvando} onClick={() => void cadastrar()}>
                {salvando ? 'Cadastrando…' : 'Cadastrar liderança'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ConfirmarRemocao({ pessoa, onFechar, onRemovida }: { pessoa: Pessoa; onFechar: () => void; onRemovida: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  async function confirmar() {
    setSalvando(true);
    setErro('');
    try {
      await removerLideranca(pessoa.login);
      onRemovida();
    } catch (falha) {
      setErro(mensagemErro(falha, 'Não foi possível salvar agora.'));
      setSalvando(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : onFechar}>
      <section className="edit-modal liderancas-confirmar" role="dialog" aria-modal="true" aria-labelledby="remover-lideranca-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <h2 id="remover-lideranca-titulo">Remover {pessoa.nome} da liderança?</h2>
        <p>{pessoa.nome.split(' ')[0]} volta a ser colaborador: deixa de acessar o Dashboard e de criar equipes. As equipes e escalas que já existem continuam como estão.</p>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="liderancas-confirmar-acoes">
          <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button perigo" disabled={salvando} onClick={() => void confirmar()}>
            {salvando ? 'Salvando…' : 'Remover liderança'}
          </button>
        </div>
      </section>
    </div>
  );
}
