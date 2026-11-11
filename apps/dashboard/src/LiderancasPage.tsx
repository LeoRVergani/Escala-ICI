import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crown, LoaderCircle, Search, UserPlus, Users } from 'lucide-react';

import { listarTodosUsuarios } from '@/lib/firebase/adminRepository';
import { tornarLideranca } from '@/lib/firebase/liderancasRepository';
import { ehLideranca } from '@/lib/liderancas';
import type { Usuario } from '@/lib/modelos';

/**
 * LIDERANCAS-1 — Dashboard › Lideranças: quem cuida de equipe (coordenador,
 * supervisor, gestor, chefe) e as demais pessoas. Uma liderança pode tornar
 * outra pessoa liderança — ela passa a poder criar equipe. Rebaixar é só do
 * administrador.
 */
type Aba = 'liderancas' | 'pessoas';
type Pessoa = Usuario & { promovidoPorLogin?: string; promovidoEm?: string };

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/u);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)?.[0] ?? '' : '')).toUpperCase();
}

export function LiderancasPage({ autor, nomeEquipe }: { autor: Usuario; nomeEquipe: (equipeId: string) => string }) {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('liderancas');
  const [busca, setBusca] = useState('');
  const [confirmando, setConfirmando] = useState<Pessoa | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let cancelado = false;
    void listarTodosUsuarios()
      .then((lista) => { if (!cancelado) setPessoas((lista as Pessoa[]).filter((pessoa) => pessoa.ativo !== false)); })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar as pessoas agora.'); });
    return () => { cancelado = true; };
  }, []);

  const nomePorLogin = useMemo(() => new Map((pessoas ?? []).map((pessoa) => [pessoa.login, pessoa.nome])), [pessoas]);
  const termo = busca.trim().toLowerCase();
  const filtradas = (pessoas ?? [])
    .filter((pessoa) => (aba === 'liderancas' ? ehLideranca(pessoa) : !ehLideranca(pessoa)))
    .filter((pessoa) => termo === '' || `${pessoa.nome} ${pessoa.login} ${pessoa.cargo ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const totalLiderancas = (pessoas ?? []).filter(ehLideranca).length;

  async function confirmar() {
    if (!confirmando) return;
    setSalvando(true);
    setErro('');
    try {
      await tornarLideranca(confirmando, autor.login);
      const agora = new Date().toISOString();
      setPessoas((atuais) => (atuais ?? []).map((pessoa) => (pessoa.login !== confirmando.login ? pessoa : {
        ...pessoa, perfil: 'GESTOR_EQUIPE', nivelHierarquico: Math.min(pessoa.nivelHierarquico ?? 6, 5), promovidoPorLogin: autor.login, promovidoEm: agora,
      })));
      setMensagem(`${confirmando.nome} agora é liderança e já pode criar equipe.`);
      setConfirmando(null);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Você não tem permissão para tornar esta pessoa liderança.' : texto || 'Não foi possível salvar agora.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="liderancas-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Equipes</p>
          <h1>Lideranças</h1>
          <p>Quem cuida de equipe — coordenador, supervisor, gestor ou chefe. Liderança cria equipe e pode tornar outra pessoa liderança.</p>
        </div>
      </header>

      <div className="liderancas-barra">
        <div className="liderancas-abas" role="tablist" aria-label="Lista">
          <button type="button" role="tab" aria-selected={aba === 'liderancas'} className={aba === 'liderancas' ? 'active' : ''} onClick={() => setAba('liderancas')}>
            <Crown size={15} aria-hidden="true" /> Lideranças <span>{totalLiderancas}</span>
          </button>
          <button type="button" role="tab" aria-selected={aba === 'pessoas'} className={aba === 'pessoas' ? 'active' : ''} onClick={() => setAba('pessoas')}>
            <Users size={15} aria-hidden="true" /> Pessoas <span>{(pessoas?.length ?? 0) - totalLiderancas}</span>
          </button>
        </div>
        <label className="liderancas-busca">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar por nome, login ou cargo" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        </label>
      </div>

      {erro && <div className="alert error" role="alert">{erro}</div>}
      {mensagem && <p className="liderancas-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</p>}
      {aba === 'pessoas' && (
        <p className="liderancas-dica">Pessoa nova? Cadastre em <strong>Minha equipe › Cadastrar pessoa nova</strong> e depois torne liderança aqui.</p>
      )}

      {pessoas === null && !erro ? (
        <p className="liderancas-carregando"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Carregando…</p>
      ) : filtradas.length === 0 ? (
        <p className="liderancas-vazio">{termo ? 'Ninguém encontrado com essa busca.' : 'Ninguém nesta lista ainda.'}</p>
      ) : (
        <ul className="liderancas-lista">
          {filtradas.map((pessoa) => (
            <li key={pessoa.login}>
              <span className="liderancas-avatar" data-lideranca={ehLideranca(pessoa) ? '' : undefined} aria-hidden="true">{iniciais(pessoa.nome)}</span>
              <span className="liderancas-pessoa">
                <strong>{pessoa.nome}</strong>
                <small>{[pessoa.cargo, pessoa.equipeId ? nomeEquipe(pessoa.equipeId) : null].filter(Boolean).join(' · ') || pessoa.login}</small>
                {pessoa.promovidoPorLogin && (
                  <em>Promovida por {nomePorLogin.get(pessoa.promovidoPorLogin) ?? pessoa.promovidoPorLogin}
                    {pessoa.promovidoEm ? ` em ${new Date(pessoa.promovidoEm).toLocaleDateString('pt-BR')}` : ''}</em>
                )}
              </span>
              {aba === 'pessoas' && pessoa.login !== autor.login && (
                <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setConfirmando(pessoa); }}>
                  <UserPlus size={15} aria-hidden="true" /> Tornar liderança
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmando && (
        <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : () => setConfirmando(null)}>
          <section className="edit-modal liderancas-confirmar" role="dialog" aria-modal="true" aria-labelledby="liderancas-confirmar-titulo"
            onMouseDown={(evento) => evento.stopPropagation()}>
            <h2 id="liderancas-confirmar-titulo">Tornar {confirmando.nome} liderança?</h2>
            <p>{confirmando.nome.split(' ')[0]} poderá <strong>criar equipes</strong>, cuidar da escala delas e <strong>tornar outras pessoas liderança</strong>. Fica registrado que foi você quem promoveu.</p>
            <div className="liderancas-confirmar-acoes">
              <button type="button" className="secondary-button" disabled={salvando} onClick={() => setConfirmando(null)}>Cancelar</button>
              <button type="button" className="primary-button" disabled={salvando} onClick={() => void confirmar()}>
                {salvando ? 'Salvando…' : 'Tornar liderança'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
