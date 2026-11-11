import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Crown, Pencil, Power, Search, Users, X } from 'lucide-react';

import { ehLideranca } from '@/lib/liderancas';
import type { Equipe, EscopoOperacional, UnidadeOrganizacional, Usuario } from '@/lib/modelos';

/**
 * ADMIN-EQUIPES-1 — Administração › Equipes: todas as equipes em cartões
 * simples (coordenação, liderança, pessoas), com editar, trocar a liderança e
 * desativar. Sem códigos técnicos à vista; o responsável é um campo da equipe.
 */
type Filtro = 'ativas' | 'sem-lideranca' | 'inativas';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/u);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)?.[0] ?? '' : '')).toUpperCase();
}

export function responsaveisDaEquipe(equipeId: string, escopos: readonly EscopoOperacional[]): string[] {
  const escopo = escopos.find((item) => item.tipo === 'JORNADA' && item.alvoId === equipeId && item.ativo !== false);
  return escopo ? [...escopo.responsaveisLogin] : [];
}

export function AdminEquipesPage({
  equipes, unidades, escopos, usuarios, subnav, onSalvarEquipe, onDefinirLideranca,
}: {
  equipes: readonly Equipe[];
  unidades: readonly UnidadeOrganizacional[];
  escopos: readonly EscopoOperacional[];
  usuarios: readonly Usuario[];
  subnav: ReactNode;
  onSalvarEquipe: (equipe: Equipe) => Promise<void>;
  onDefinirLideranca: (equipe: Equipe, login: string) => Promise<void>;
}) {
  const [filtro, setFiltro] = useState<Filtro>('ativas');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Equipe | null>(null);
  const [trocandoLideranca, setTrocandoLideranca] = useState<Equipe | null>(null);
  const [alternando, setAlternando] = useState<Equipe | null>(null);
  const [mensagem, setMensagem] = useState('');

  const nomeUnidade = useMemo(() => new Map(unidades.map((unidade) => [unidade.unidadeId, unidade.nome])), [unidades]);
  const usuarioPorLogin = useMemo(() => new Map(usuarios.map((usuario) => [usuario.login, usuario])), [usuarios]);
  const pessoasPorEquipe = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const usuario of usuarios) if (usuario.ativo !== false && usuario.equipeId) mapa.set(usuario.equipeId, (mapa.get(usuario.equipeId) ?? 0) + 1);
    return mapa;
  }, [usuarios]);
  const semLideranca = (equipe: Equipe) => responsaveisDaEquipe(equipe.id, escopos).length === 0;
  const ativas = equipes.filter((equipe) => equipe.ativa !== false);
  const termo = busca.trim().toLowerCase();
  const lista = equipes
    .filter((equipe) => (filtro === 'inativas' ? equipe.ativa === false : equipe.ativa !== false))
    .filter((equipe) => filtro !== 'sem-lideranca' || semLideranca(equipe))
    .filter((equipe) => termo === '' || `${equipe.nome} ${equipe.sigla} ${nomeUnidade.get(equipe.unidadeId ?? '') ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <section className="admin-equipes">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Equipes</h1>
          <p>Todas as equipes, com a coordenação, a liderança responsável e quantas pessoas cada uma tem.</p>
        </div>
      </header>
      {subnav}

      <div className="admin-numeros">
        <div><Users size={18} aria-hidden="true" /><span><small>Equipes ativas</small><strong>{ativas.length}</strong></span></div>
        <div data-alerta={ativas.some(semLideranca) ? '' : undefined}><AlertTriangle size={18} aria-hidden="true" /><span><small>Sem liderança</small><strong>{ativas.filter(semLideranca).length}</strong></span></div>
        <div><Crown size={18} aria-hidden="true" /><span><small>Pessoas nas equipes</small><strong>{ativas.reduce((total, equipe) => total + (pessoasPorEquipe.get(equipe.id) ?? 0), 0)}</strong></span></div>
      </div>

      <div className="liderancas-barra">
        <div className="liderancas-abas" role="tablist" aria-label="Filtro">
          {([['ativas', 'Ativas'], ['sem-lideranca', 'Sem liderança'], ['inativas', 'Inativas']] as const).map(([valor, rotulo]) => (
            <button key={valor} type="button" role="tab" aria-selected={filtro === valor} className={filtro === valor ? 'active' : ''} onClick={() => setFiltro(valor)}>{rotulo}</button>
          ))}
        </div>
        <label className="liderancas-busca">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar equipe ou coordenação" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        </label>
      </div>
      {mensagem && <p className="liderancas-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</p>}

      {lista.length === 0 ? (
        <p className="liderancas-vazio">{termo ? 'Nenhuma equipe com essa busca.' : filtro === 'sem-lideranca' ? 'Todas as equipes têm liderança. 👍' : 'Nenhuma equipe aqui.'}</p>
      ) : (
        <ul className="admin-equipes-grade">
          {lista.map((equipe) => {
            const responsaveis = responsaveisDaEquipe(equipe.id, escopos);
            return (
              <li key={equipe.id} className="admin-equipe-cartao" data-inativa={equipe.ativa === false ? '' : undefined}>
                <div className="admin-equipe-topo">
                  <span className="admin-equipe-icone" aria-hidden="true">{iniciais(equipe.nome)}</span>
                  <span className="admin-equipe-nome">
                    <strong>{equipe.nome}</strong>
                    <small><Building2 size={12} aria-hidden="true" /> {nomeUnidade.get(equipe.unidadeId ?? '') ?? 'Sem coordenação'}</small>
                  </span>
                  {equipe.ativa === false && <span className="admin-selo">Inativa</span>}
                </div>
                <div className="admin-equipe-linhas">
                  <div>
                    <small>Liderança</small>
                    {responsaveis.length === 0 ? (
                      <span className="admin-alerta"><AlertTriangle size={13} aria-hidden="true" /> Sem liderança</span>
                    ) : (
                      <span className="admin-pessoas">{responsaveis.map((login) => usuarioPorLogin.get(login)?.nome ?? login).join(', ')}</span>
                    )}
                  </div>
                  <div>
                    <small>Pessoas</small>
                    <span>{pessoasPorEquipe.get(equipe.id) ?? 0}</span>
                  </div>
                </div>
                <div className="admin-equipe-acoes">
                  <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setEditando(equipe); }}><Pencil size={14} /> Editar</button>
                  <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setTrocandoLideranca(equipe); }}><Crown size={14} /> {responsaveis.length === 0 ? 'Definir liderança' : 'Trocar liderança'}</button>
                  <button type="button" className="icon-button" title={equipe.ativa === false ? 'Reativar' : 'Desativar'} aria-label={equipe.ativa === false ? `Reativar ${equipe.nome}` : `Desativar ${equipe.nome}`}
                    onClick={() => { setMensagem(''); setAlternando(equipe); }}><Power size={16} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <EditarEquipeModal equipe={editando} unidades={unidades} onFechar={() => setEditando(null)}
          onSalvar={async (equipe) => { await onSalvarEquipe(equipe); setEditando(null); setMensagem(`${equipe.nome} atualizada.`); }} />
      )}
      {trocandoLideranca && (
        <LiderancaEquipeModal equipe={trocandoLideranca} usuarios={usuarios} atuais={responsaveisDaEquipe(trocandoLideranca.id, escopos)}
          onFechar={() => setTrocandoLideranca(null)}
          onEscolher={async (login) => {
            await onDefinirLideranca(trocandoLideranca, login);
            setMensagem(`${usuarioPorLogin.get(login)?.nome ?? login} agora lidera ${trocandoLideranca.nome}.`);
            setTrocandoLideranca(null);
          }} />
      )}
      {alternando && (
        <ConfirmarAtivacao equipe={alternando} onFechar={() => setAlternando(null)}
          onConfirmar={async () => {
            const reativar = alternando.ativa === false;
            await onSalvarEquipe({ ...alternando, ativa: reativar });
            setMensagem(`${alternando.nome} ${reativar ? 'reativada' : 'desativada'}.`);
            setAlternando(null);
          }} />
      )}
    </section>
  );
}

function Modal({ titulo, descricao, icone, onFechar, ocupado, children }: {
  titulo: string; descricao: string; icone: ReactNode; onFechar: () => void; ocupado: boolean; children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={ocupado ? undefined : onFechar}>
      <section className="edit-modal criar-equipe-modal" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone">{icone}</span>
          <div><h2>{titulo}</h2><p>{descricao}</p></div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={ocupado} aria-label="Fechar"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro('');
    try {
      await acao();
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Sem permissão para esta ação.' : texto || 'Não foi possível salvar agora.');
      setOcupado(false);
    }
  }
  return { ocupado, erro, executar };
}

function EditarEquipeModal({ equipe, unidades, onFechar, onSalvar }: {
  equipe: Equipe; unidades: readonly UnidadeOrganizacional[]; onFechar: () => void; onSalvar: (equipe: Equipe) => Promise<void>;
}) {
  const [nome, setNome] = useState(equipe.nome);
  const [sigla, setSigla] = useState(equipe.sigla);
  const [unidadeId, setUnidadeId] = useState(equipe.unidadeId ?? '');
  const { ocupado, erro, executar } = useAcao();
  const opcoes = [...unidades].filter((unidade) => unidade.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  function salvar() {
    void executar(async () => {
      if (nome.trim().length < 2) throw new Error('Dê um nome para a equipe.');
      const unidade = opcoes.find((item) => item.unidadeId === unidadeId);
      await onSalvar({
        ...equipe,
        nome: nome.replace(/\s+/gu, ' ').trim(),
        sigla: sigla.trim().toUpperCase() || equipe.sigla,
        ...(unidade ? { unidadeId: unidade.unidadeId, caminhoUnidade: [...unidade.caminho] } : { unidadeId: undefined, caminhoUnidade: undefined }),
      });
    });
  }
  return (
    <Modal titulo="Editar equipe" descricao="Nome, sigla e a coordenação a que a equipe pertence." icone={<Pencil size={18} />} onFechar={onFechar} ocupado={ocupado}>
      <label className="criar-equipe-campo"><span>Nome</span><input value={nome} maxLength={60} onChange={(evento) => setNome(evento.target.value)} /></label>
      <label className="criar-equipe-campo"><span>Sigla</span><input value={sigla} maxLength={12} onChange={(evento) => setSigla(evento.target.value)} /></label>
      <label className="criar-equipe-campo">
        <span>Coordenação</span>
        <select value={unidadeId} onChange={(evento) => setUnidadeId(evento.target.value)}>
          <option value="">Sem coordenação</option>
          {opcoes.map((unidade) => <option key={unidade.unidadeId} value={unidade.unidadeId}>{unidade.nome}{unidade.sigla ? ` (${unidade.sigla})` : ''}</option>)}
        </select>
      </label>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="criar-equipe-acoes">
        <button type="button" className="secondary-button" disabled={ocupado} onClick={onFechar}>Cancelar</button>
        <button type="button" className="primary-button" disabled={ocupado} onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}

function LiderancaEquipeModal({ equipe, usuarios, atuais, onFechar, onEscolher }: {
  equipe: Equipe; usuarios: readonly Usuario[]; atuais: readonly string[]; onFechar: () => void; onEscolher: (login: string) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const { ocupado, erro, executar } = useAcao();
  const termo = busca.trim().toLowerCase();
  const liderancas = usuarios.filter((usuario) => usuario.ativo !== false && ehLideranca(usuario))
    .filter((usuario) => termo === '' || `${usuario.nome} ${usuario.login} ${usuario.cargo}`.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 30);
  return (
    <Modal titulo={`Liderança de ${equipe.nome}`} descricao="Escolha quem cuida da escala desta equipe. Para alguém que ainda não é liderança, use Lideranças › Nova liderança."
      icone={<Crown size={18} />} onFechar={onFechar} ocupado={ocupado}>
      <label className="criar-equipe-campo"><span>Buscar liderança</span>
        <input autoFocus value={busca} placeholder="Nome, login ou cargo" onChange={(evento) => setBusca(evento.target.value)} /></label>
      <ul className="nova-lideranca-resultados">
        {liderancas.map((usuario) => (
          <li key={usuario.login}>
            <button type="button" disabled={ocupado} onClick={() => void executar(() => onEscolher(usuario.login))}>
              <span className="liderancas-avatar" data-lideranca="" aria-hidden="true">{iniciais(usuario.nome)}</span>
              <span className="liderancas-pessoa"><strong>{usuario.nome}</strong><small>{usuario.cargo || usuario.login}</small></span>
              {atuais.includes(usuario.login) && <span className="admin-selo">Atual</span>}
            </button>
          </li>
        ))}
      </ul>
      {erro && <div className="alert error" role="alert">{erro}</div>}
    </Modal>
  );
}

function ConfirmarAtivacao({ equipe, onFechar, onConfirmar }: { equipe: Equipe; onFechar: () => void; onConfirmar: () => Promise<void> }) {
  const { ocupado, erro, executar } = useAcao();
  const reativar = equipe.ativa === false;
  return (
    <Modal titulo={`${reativar ? 'Reativar' : 'Desativar'} ${equipe.nome}?`}
      descricao={reativar ? 'A equipe volta a aparecer para a liderança e nas escalas.' : 'A equipe some das listas de trabalho. Pessoas, escalas e histórico continuam guardados — dá para reativar depois.'}
      icone={<Power size={18} />} onFechar={onFechar} ocupado={ocupado}>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="criar-equipe-acoes">
        <button type="button" className="secondary-button" disabled={ocupado} onClick={onFechar}>Cancelar</button>
        <button type="button" className={`primary-button${reativar ? '' : ' perigo'}`} disabled={ocupado} onClick={() => void executar(onConfirmar)}>
          {ocupado ? 'Salvando…' : reativar ? 'Reativar' : 'Desativar'}
        </button>
      </div>
    </Modal>
  );
}
