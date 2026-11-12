import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Search, Star, UserPlus } from 'lucide-react';

import { ehLideranca } from '@/lib/liderancas';
import type { Usuario } from '@/lib/modelos';
import { ConfirmarPromocao, iniciais, usePessoas, type Pessoa } from './pessoasLideranca';

/**
 * LIDERANCAS-2 — Dashboard › Colaboradores: todas as pessoas que não são
 * liderança, com quem é das MINHAS equipes em destaque (primeiro e com a
 * etiqueta "Sua equipe"). "Tornar liderança" em cada uma.
 */
export function ColaboradoresPage({ pessoasDemo, autor, minhasEquipes, nomeEquipe }: {
  pessoasDemo?: readonly Usuario[];
  autor: Usuario; minhasEquipes: readonly string[]; nomeEquipe: (equipeId: string) => string;
}) {
  const { pessoas, erro, recarregar } = usePessoas(pessoasDemo);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'minha'>('todos');
  const [promovendo, setPromovendo] = useState<Pessoa | null>(null);
  const [mensagem, setMensagem] = useState('');
  const daMinhaEquipe = (pessoa: Pessoa) => pessoa.equipeId !== '' && minhasEquipes.includes(pessoa.equipeId);
  const termo = busca.trim().toLowerCase();
  const colaboradores = (pessoas ?? []).filter((pessoa) => !ehLideranca(pessoa));
  const totalMinha = colaboradores.filter(daMinhaEquipe).length;
  const lista = colaboradores
    .filter((pessoa) => filtro === 'todos' || daMinhaEquipe(pessoa))
    .filter((pessoa) => termo === '' || `${pessoa.nome} ${pessoa.login} ${pessoa.cargo ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => Number(daMinhaEquipe(b)) - Number(daMinhaEquipe(a)) || a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <section className="liderancas-pagina">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Equipes</p>
          <h1>Colaboradores</h1>
          <p>Todas as pessoas cadastradas. Quem é das suas equipes aparece primeiro, em destaque.</p>
        </div>
      </header>

      <div className="liderancas-barra">
        <div className="liderancas-abas" role="tablist" aria-label="Filtro">
          <button type="button" role="tab" aria-selected={filtro === 'todos'} className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>
            Todos <span>{colaboradores.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={filtro === 'minha'} className={filtro === 'minha' ? 'active' : ''} onClick={() => setFiltro('minha')}>
            <Star size={14} aria-hidden="true" /> Minha equipe <span>{totalMinha}</span>
          </button>
        </div>
        <label className="liderancas-busca">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar por nome, login ou cargo" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        </label>
      </div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      {mensagem && <p className="liderancas-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</p>}
      <p className="liderancas-dica">Pessoa nova na sua equipe? Cadastre em <strong>Minha equipe › Cadastrar pessoa nova</strong>.</p>

      {pessoas === null && !erro ? (
        <p className="liderancas-carregando"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="liderancas-vazio">{termo ? 'Ninguém encontrado com essa busca.' : filtro === 'minha' ? 'Ninguém das suas equipes ainda.' : 'Nenhum colaborador ainda.'}</p>
      ) : (
        <ul className="liderancas-lista">
          {lista.map((pessoa) => (
            <li key={pessoa.login} data-minha-equipe={daMinhaEquipe(pessoa) ? '' : undefined}>
              <span className="liderancas-avatar" aria-hidden="true">{iniciais(pessoa.nome)}</span>
              <span className="liderancas-pessoa">
                <strong>{pessoa.nome}{daMinhaEquipe(pessoa) && <span className="colaboradores-selo"><Star size={11} aria-hidden="true" /> Sua equipe</span>}</strong>
                <small>{[pessoa.cargo, pessoa.equipeId ? nomeEquipe(pessoa.equipeId) : 'Sem equipe'].filter(Boolean).join(' · ')}</small>
              </span>
              {pessoa.login !== autor.login && (
                <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setPromovendo(pessoa); }}>
                  <UserPlus size={15} aria-hidden="true" /> Tornar liderança
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {promovendo && (
        <ConfirmarPromocao pessoa={promovendo} autorLogin={autor.login} onFechar={() => setPromovendo(null)}
          onPromovida={(pessoa) => { setPromovendo(null); setMensagem(`${pessoa.nome} agora é liderança e aparece em Lideranças.`); recarregar(); }} />
      )}
    </section>
  );
}
