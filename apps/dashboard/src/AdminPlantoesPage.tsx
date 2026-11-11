import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Crown, Eye, ListChecks, Pencil, Plus, Power, Radio, Search, X } from 'lucide-react';
import { ROTULO_FUNCAO_PLANTAO, type FuncaoPlantao, type GrupoPlantao } from '@escala-ici/contrato';

import { ehLideranca } from '@/lib/liderancas';
import type { Equipe, EscopoOperacional, Usuario } from '@/lib/modelos';

/**
 * ADMIN-PLANTOES-1 — Administração › Plantões: todos os Plantões em cartões
 * (equipe, postos, responsável, quem vê no App), com editar nome e postos,
 * trocar o responsável, escolher quem vê e desativar. Plantonistas, contatos
 * e escala continuam na tela completa ("Plantonistas e escala").
 */
const POSTOS = Object.keys(ROTULO_FUNCAO_PLANTAO) as FuncaoPlantao[];
type Filtro = 'ativos' | 'sem-responsavel' | 'inativos';

export function responsaveisDoPlantao(grupoId: string, escopos: readonly EscopoOperacional[]): string[] {
  const escopo = escopos.find((item) => item.tipo === 'PLANTAO' && item.alvoId === grupoId && item.ativo !== false);
  return escopo ? [...escopo.responsaveisLogin] : [];
}

function iniciais(nome: string): string {
  const partes = nome.replace(/^plant[aã]o\s+/iu, '').trim().split(/\s+/u);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)?.[0] ?? '' : partes[0]?.[1] ?? '')).toUpperCase();
}

export function AdminPlantoesPage({
  grupos, equipes, escopos, usuarios, subnav, onSalvarGrupo, onDefinirResponsavel, onNovoPlantao, onAbrirCompleta,
}: {
  grupos: readonly GrupoPlantao[];
  equipes: readonly Equipe[];
  escopos: readonly EscopoOperacional[];
  usuarios: readonly Usuario[];
  subnav: ReactNode;
  onSalvarGrupo: (grupo: GrupoPlantao) => Promise<void>;
  onDefinirResponsavel: (grupo: GrupoPlantao, login: string) => Promise<void>;
  onNovoPlantao: () => void;
  onAbrirCompleta: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<GrupoPlantao | null>(null);
  const [responsavel, setResponsavel] = useState<GrupoPlantao | null>(null);
  const [quemVe, setQuemVe] = useState<GrupoPlantao | null>(null);
  const [alternando, setAlternando] = useState<GrupoPlantao | null>(null);
  const [mensagem, setMensagem] = useState('');

  const nomeEquipe = useMemo(() => new Map(equipes.map((equipe) => [equipe.id, equipe.nome])), [equipes]);
  const nomeUsuario = useMemo(() => new Map(usuarios.map((usuario) => [usuario.login, usuario.nome])), [usuarios]);
  const semResponsavel = (grupo: GrupoPlantao) => responsaveisDoPlantao(grupo.grupoId, escopos).length === 0;
  const ativos = grupos.filter((grupo) => grupo.ativo);
  const termo = busca.trim().toLowerCase();
  const lista = grupos
    .filter((grupo) => (filtro === 'inativos' ? !grupo.ativo : grupo.ativo))
    .filter((grupo) => filtro !== 'sem-responsavel' || semResponsavel(grupo))
    .filter((grupo) => termo === '' || `${grupo.nome} ${nomeEquipe.get(grupo.equipeResponsavelId) ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <section className="admin-equipes">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Plantões</h1>
          <p>Todos os Plantões, com a equipe, os postos, o responsável e quem vê no App.</p>
        </div>
        <div className="grade-header-actions">
          <button type="button" className="secondary-button" onClick={onAbrirCompleta}><ListChecks size={16} /> Plantonistas e escala</button>
          <button type="button" className="primary-button" onClick={onNovoPlantao}><Plus size={16} /> Novo Plantão</button>
        </div>
      </header>
      {subnav}

      <div className="admin-numeros">
        <div><Radio size={18} aria-hidden="true" /><span><small>Plantões ativos</small><strong>{ativos.length}</strong></span></div>
        <div data-alerta={ativos.some(semResponsavel) ? '' : undefined}><AlertTriangle size={18} aria-hidden="true" /><span><small>Sem responsável</small><strong>{ativos.filter(semResponsavel).length}</strong></span></div>
        <div><Eye size={18} aria-hidden="true" /><span><small>Equipes que veem algum</small><strong>{new Set(ativos.flatMap((grupo) => grupo.equipesConsulta ?? [])).size}</strong></span></div>
      </div>

      <div className="liderancas-barra">
        <div className="liderancas-abas" role="tablist" aria-label="Filtro">
          {([['ativos', 'Ativos'], ['sem-responsavel', 'Sem responsável'], ['inativos', 'Inativos']] as const).map(([valor, rotulo]) => (
            <button key={valor} type="button" role="tab" aria-selected={filtro === valor} className={filtro === valor ? 'active' : ''} onClick={() => setFiltro(valor)}>{rotulo}</button>
          ))}
        </div>
        <label className="liderancas-busca">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar Plantão ou equipe" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        </label>
      </div>
      {mensagem && <p className="liderancas-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</p>}

      {lista.length === 0 ? (
        <p className="liderancas-vazio">{termo ? 'Nenhum Plantão com essa busca.' : filtro === 'sem-responsavel' ? 'Todos os Plantões têm responsável. 👍' : 'Nenhum Plantão aqui.'}</p>
      ) : (
        <ul className="admin-equipes-grade">
          {lista.map((grupo) => {
            const responsaveis = responsaveisDoPlantao(grupo.grupoId, escopos);
            const postos = grupo.funcoesEsperadas ?? [];
            const veem = (grupo.equipesConsulta ?? []).map((id) => nomeEquipe.get(id) ?? id);
            return (
              <li key={grupo.grupoId} className="admin-equipe-cartao" data-inativa={grupo.ativo ? undefined : ''}>
                <div className="admin-equipe-topo">
                  <span className="admin-equipe-icone admin-plantao-icone" aria-hidden="true">{iniciais(grupo.nome)}</span>
                  <span className="admin-equipe-nome">
                    <strong>{grupo.nome}</strong>
                    <small>Equipe {nomeEquipe.get(grupo.equipeResponsavelId) ?? 'não encontrada'}</small>
                  </span>
                  {!grupo.ativo && <span className="admin-selo">Inativo</span>}
                </div>
                <div className="admin-postos">
                  {postos.length > 1
                    ? postos.map((posto) => <span key={posto} className="plantao-posto-selo" data-funcao={posto}>{ROTULO_FUNCAO_PLANTAO[posto]}</span>)
                    : <span className="admin-selo">Posto único</span>}
                </div>
                <div className="admin-equipe-linhas">
                  <div>
                    <small>Responsável</small>
                    {responsaveis.length === 0
                      ? <span className="admin-alerta"><AlertTriangle size={13} aria-hidden="true" /> Sem responsável</span>
                      : <span className="admin-pessoas">{responsaveis.map((login) => nomeUsuario.get(login) ?? login).join(', ')}</span>}
                  </div>
                  <div>
                    <small>Veem no App</small>
                    <span title={veem.join(', ')}>{veem.length} {veem.length === 1 ? 'equipe' : 'equipes'}</span>
                  </div>
                </div>
                <div className="admin-equipe-acoes">
                  <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setEditando(grupo); }}><Pencil size={14} /> Editar</button>
                  <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setResponsavel(grupo); }}><Crown size={14} /> Responsável</button>
                  <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setQuemVe(grupo); }}><Eye size={14} /> Quem vê</button>
                  <button type="button" className="icon-button" title={grupo.ativo ? 'Desativar' : 'Reativar'} aria-label={grupo.ativo ? `Desativar ${grupo.nome}` : `Reativar ${grupo.nome}`}
                    onClick={() => { setMensagem(''); setAlternando(grupo); }}><Power size={16} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <EditarPlantaoModal grupo={editando} onFechar={() => setEditando(null)}
          onSalvar={async (grupo) => { await onSalvarGrupo(grupo); setEditando(null); setMensagem(`${grupo.nome} atualizado.`); }} />
      )}
      {responsavel && (
        <ResponsavelModal grupo={responsavel} usuarios={usuarios} atuais={responsaveisDoPlantao(responsavel.grupoId, escopos)} onFechar={() => setResponsavel(null)}
          onEscolher={async (login) => {
            await onDefinirResponsavel(responsavel, login);
            setMensagem(`${nomeUsuario.get(login) ?? login} agora é o responsável pelo ${responsavel.nome}.`);
            setResponsavel(null);
          }} />
      )}
      {quemVe && (
        <QuemVeModal grupo={quemVe} equipes={equipes} onFechar={() => setQuemVe(null)}
          onSalvar={async (grupo) => { await onSalvarGrupo(grupo); setQuemVe(null); setMensagem(`Quem vê o ${grupo.nome} no App foi atualizado.`); }} />
      )}
      {alternando && (
        <ConfirmarAtivo grupo={alternando} onFechar={() => setAlternando(null)}
          onConfirmar={async () => {
            await onSalvarGrupo({ ...alternando, ativo: !alternando.ativo });
            setMensagem(`${alternando.nome} ${alternando.ativo ? 'desativado' : 'reativado'}.`);
            setAlternando(null);
          }} />
      )}
    </section>
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

function Acoes({ ocupado, onFechar, onSalvar, rotulo = 'Salvar', perigo = false }: {
  ocupado: boolean; onFechar: () => void; onSalvar: () => void; rotulo?: string; perigo?: boolean;
}) {
  return (
    <div className="criar-equipe-acoes">
      <button type="button" className="secondary-button" disabled={ocupado} onClick={onFechar}>Cancelar</button>
      <button type="button" className={`primary-button${perigo ? ' perigo' : ''}`} disabled={ocupado} onClick={onSalvar}>{ocupado ? 'Salvando…' : rotulo}</button>
    </div>
  );
}

function EditarPlantaoModal({ grupo, onFechar, onSalvar }: { grupo: GrupoPlantao; onFechar: () => void; onSalvar: (grupo: GrupoPlantao) => Promise<void> }) {
  const [nome, setNome] = useState(grupo.nome);
  const [varios, setVarios] = useState((grupo.funcoesEsperadas ?? []).length > 1);
  const [postos, setPostos] = useState<FuncaoPlantao[]>(grupo.funcoesEsperadas ?? []);
  const { ocupado, erro, executar } = useAcao();
  function salvar() {
    void executar(async () => {
      if (nome.trim().length < 2) throw new Error('Dê um nome para o Plantão.');
      if (varios && postos.length < 2) throw new Error('Marque pelo menos dois postos — ou escolha "Posto único".');
      const { funcoesEsperadas: _anteriores, ...resto } = grupo;
      void _anteriores;
      await onSalvar({ ...resto, nome: nome.replace(/\s+/gu, ' ').trim(), ...(varios ? { funcoesEsperadas: [...postos] } : {}) });
    });
  }
  return (
    <Modal titulo="Editar Plantão" descricao="O nome e os postos (DBA, Linux, Telecom, Windows) do Plantão." icone={<Pencil size={18} />} onFechar={onFechar} ocupado={ocupado}>
      <label className="criar-equipe-campo"><span>Nome</span><input value={nome} maxLength={60} onChange={(evento) => setNome(evento.target.value)} /></label>
      <div className="criar-equipe-campo">
        <span>Postos</span>
        <div className="criar-plantao-segmento" role="radiogroup" aria-label="Postos">
          <button type="button" role="radio" aria-checked={!varios} className={!varios ? 'active' : ''} onClick={() => setVarios(false)}>Posto único</button>
          <button type="button" role="radio" aria-checked={varios} className={varios ? 'active' : ''} onClick={() => setVarios(true)}>Vários postos</button>
        </div>
        {varios && (
          <div className="criar-plantao-postos" role="group" aria-label="Quais postos">
            {POSTOS.map((posto) => (
              <button key={posto} type="button" role="checkbox" aria-checked={postos.includes(posto)} className={postos.includes(posto) ? 'active' : ''}
                onClick={() => setPostos((atuais) => (atuais.includes(posto) ? atuais.filter((item) => item !== posto) : [...atuais, posto]))}>
                {ROTULO_FUNCAO_PLANTAO[posto]}
              </button>
            ))}
          </div>
        )}
      </div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Acoes ocupado={ocupado} onFechar={onFechar} onSalvar={salvar} />
    </Modal>
  );
}

function ResponsavelModal({ grupo, usuarios, atuais, onFechar, onEscolher }: {
  grupo: GrupoPlantao; usuarios: readonly Usuario[]; atuais: readonly string[]; onFechar: () => void; onEscolher: (login: string) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const { ocupado, erro, executar } = useAcao();
  const termo = busca.trim().toLowerCase();
  const liderancas = usuarios.filter((usuario) => usuario.ativo !== false && ehLideranca(usuario))
    .filter((usuario) => termo === '' || `${usuario.nome} ${usuario.login} ${usuario.cargo}`.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 30);
  return (
    <Modal titulo={`Responsável pelo ${grupo.nome}`} descricao="Quem cuida da escala e dos plantonistas deste Plantão." icone={<Crown size={18} />} onFechar={onFechar} ocupado={ocupado}>
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

function QuemVeModal({ grupo, equipes, onFechar, onSalvar }: {
  grupo: GrupoPlantao; equipes: readonly Equipe[]; onFechar: () => void; onSalvar: (grupo: GrupoPlantao) => Promise<void>;
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>([...(grupo.equipesConsulta ?? [])]);
  const { ocupado, erro, executar } = useAcao();
  const opcoes = equipes.filter((equipe) => equipe.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return (
    <Modal titulo={`Quem vê o ${grupo.nome} no App`} descricao="As equipes marcadas veem quem está de plantão, os telefones e o calendário. A equipe do Plantão sempre vê."
      icone={<Eye size={18} />} onFechar={onFechar} ocupado={ocupado}>
      <ul className="plantoes-da-equipe-lista admin-quem-ve">
        {opcoes.map((equipe) => {
          const daEquipe = equipe.id === grupo.equipeResponsavelId;
          const ligado = daEquipe || selecionadas.includes(equipe.id);
          return (
            <li key={equipe.id} data-ligado={ligado ? '' : undefined}>
              <span className="plantoes-da-equipe-nome"><strong>{equipe.nome}</strong>{daEquipe && <small>Equipe do Plantão</small>}</span>
              <button type="button" role="switch" aria-checked={ligado} aria-label={`${equipe.nome} vê o ${grupo.nome}`} className="plantoes-da-equipe-interruptor" disabled={daEquipe || ocupado}
                onClick={() => setSelecionadas((atuais) => (atuais.includes(equipe.id) ? atuais.filter((id) => id !== equipe.id) : [...atuais, equipe.id]))}><span /></button>
            </li>
          );
        })}
      </ul>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Acoes ocupado={ocupado} onFechar={onFechar}
        onSalvar={() => void executar(() => onSalvar({ ...grupo, equipesConsulta: [...new Set([grupo.equipeResponsavelId, ...selecionadas])] }))} />
    </Modal>
  );
}

function ConfirmarAtivo({ grupo, onFechar, onConfirmar }: { grupo: GrupoPlantao; onFechar: () => void; onConfirmar: () => Promise<void> }) {
  const { ocupado, erro, executar } = useAcao();
  return (
    <Modal titulo={`${grupo.ativo ? 'Desativar' : 'Reativar'} ${grupo.nome}?`}
      descricao={grupo.ativo ? 'O Plantão some do App e das listas de trabalho. Plantonistas, escalas e histórico continuam guardados — dá para reativar depois.' : 'O Plantão volta a aparecer no App para as equipes que o veem.'}
      icone={<Power size={18} />} onFechar={onFechar} ocupado={ocupado}>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Acoes ocupado={ocupado} onFechar={onFechar} onSalvar={() => void executar(onConfirmar)} rotulo={grupo.ativo ? 'Desativar' : 'Reativar'} perigo={grupo.ativo} />
    </Modal>
  );
}
