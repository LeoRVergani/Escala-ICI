import { useMemo, useState, type ReactNode } from 'react';
import { Building2, CalendarDays, CheckCircle2, Pencil, Plus, Radio, Search, X } from 'lucide-react';
import type { GrupoPlantao } from '@escala-ici/contrato';

import type { Equipe, TipoUnidadeOrganizacional, UnidadeOrganizacional } from '@/lib/modelos';

/**
 * ADMIN-COORDENACOES-1 — Administração › Coordenações: lista simples (no
 * lugar da árvore), cada uma com o caminho, as equipes e os Plantões dela;
 * renomear e criar nova, escolhendo "dentro de" qual.
 */
const TIPO: Partial<Record<TipoUnidadeOrganizacional, string>> = {
  PRESIDENCIA: 'Presidência', DIRETORIA: 'Diretoria', ASSESSORIA: 'Assessoria', GERENCIA: 'Gerência',
  COORDENACAO: 'Coordenação', SUPERVISAO: 'Supervisão', AREA: 'Área', SETOR: 'Setor', DEPARTAMENTO: 'Departamento',
};
const TIPOS_NOVA: TipoUnidadeOrganizacional[] = ['COORDENACAO', 'SUPERVISAO', 'GERENCIA', 'SETOR', 'AREA', 'DIRETORIA'];

export function idParaNovaUnidade(sigla: string, existentes: ReadonlySet<string>): string {
  const base = sigla.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toUpperCase().replace(/[^A-Z0-9]+/gu, '_').replace(/^_+|_+$/gu, '') || 'UNIDADE';
  let id = base;
  for (let n = 2; existentes.has(id); n += 1) id = `${base}_${n}`;
  return id;
}

export function AdminCoordenacoesPage({ unidades, equipes, grupos, autorLogin, subnav, onSalvar }: {
  unidades: readonly UnidadeOrganizacional[];
  equipes: readonly Equipe[];
  grupos: readonly GrupoPlantao[];
  autorLogin: string;
  subnav: ReactNode;
  onSalvar: (unidade: UnidadeOrganizacional) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [soComEquipes, setSoComEquipes] = useState(true);
  const [editando, setEditando] = useState<UnidadeOrganizacional | 'nova' | null>(null);
  const [mensagem, setMensagem] = useState('');
  const porId = useMemo(() => new Map(unidades.map((unidade) => [unidade.unidadeId, unidade])), [unidades]);
  const caminhoTexto = (unidade: UnidadeOrganizacional) => unidade.caminho.slice(0, -1).map((id) => porId.get(id)?.sigla || porId.get(id)?.nome || id).join(' › ');
  const equipesDe = (id: string) => equipes.filter((equipe) => equipe.ativa !== false && equipe.unidadeId === id);
  const gruposDe = (id: string) => grupos.filter((grupo) => grupo.ativo && grupo.unidadeResponsavelId === id);
  const termo = busca.trim().toLowerCase();
  const lista = unidades
    .filter((unidade) => !soComEquipes || equipesDe(unidade.unidadeId).length + gruposDe(unidade.unidadeId).length > 0)
    .filter((unidade) => termo === '' || `${unidade.nome} ${unidade.sigla}`.toLowerCase().includes(termo))
    .sort((a, b) => caminhoTexto(a).localeCompare(caminhoTexto(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <section className="admin-equipes">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Coordenações</h1>
          <p>A organização em uma lista: cada coordenação com as suas equipes e Plantões.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => { setMensagem(''); setEditando('nova'); }}><Plus size={16} /> Nova coordenação</button>
      </header>
      {subnav}
      <div className="liderancas-barra">
        <div className="liderancas-abas" role="tablist" aria-label="Filtro">
          <button type="button" role="tab" aria-selected={soComEquipes} className={soComEquipes ? 'active' : ''} onClick={() => setSoComEquipes(true)}>Com equipes</button>
          <button type="button" role="tab" aria-selected={!soComEquipes} className={!soComEquipes ? 'active' : ''} onClick={() => setSoComEquipes(false)}>Todas <span>{unidades.length}</span></button>
        </div>
        <label className="liderancas-busca">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar por nome ou sigla" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        </label>
      </div>
      {mensagem && <p className="liderancas-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {mensagem}</p>}
      {lista.length === 0 ? (
        <p className="liderancas-vazio">{termo ? 'Nada com essa busca.' : 'Nenhuma coordenação com equipes ainda.'}</p>
      ) : (
        <ul className="admin-equipes-grade">
          {lista.map((unidade) => {
            const suasEquipes = equipesDe(unidade.unidadeId);
            const seusGrupos = gruposDe(unidade.unidadeId);
            return (
              <li key={unidade.unidadeId} className="admin-equipe-cartao" data-inativa={unidade.ativa === false ? '' : undefined}>
                <div className="admin-equipe-topo">
                  <span className="admin-equipe-icone" aria-hidden="true"><Building2 size={18} /></span>
                  <span className="admin-equipe-nome">
                    <strong>{unidade.nome}{unidade.sigla ? ` (${unidade.sigla})` : ''}</strong>
                    <small>{TIPO[unidade.tipo] ?? unidade.tipo}{caminhoTexto(unidade) ? ` · ${caminhoTexto(unidade)}` : ''}</small>
                  </span>
                  {unidade.ativa === false && <span className="admin-selo">Inativa</span>}
                </div>
                <div className="coordenacao-itens">
                  {suasEquipes.length === 0 && seusGrupos.length === 0 && <small className="liderancas-vazio">Sem equipes.</small>}
                  {suasEquipes.map((equipe) => <span key={equipe.id} className="coordenacao-chip"><CalendarDays size={12} aria-hidden="true" /> {equipe.nome}</span>)}
                  {seusGrupos.map((grupo) => <span key={grupo.grupoId} className="coordenacao-chip" data-plantao=""><Radio size={12} aria-hidden="true" /> {grupo.nome}</span>)}
                </div>
                <div className="admin-equipe-acoes">
                  <button type="button" className="secondary-button compact-button" onClick={() => { setMensagem(''); setEditando(unidade); }}><Pencil size={14} /> Renomear</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editando !== null && (
        <UnidadeModal
          unidade={editando === 'nova' ? null : editando}
          unidades={unidades}
          onFechar={() => setEditando(null)}
          onSalvar={async (dados) => {
            if (editando === 'nova') {
              const pai = dados.parentId ? porId.get(dados.parentId) ?? null : null;
              const id = idParaNovaUnidade(dados.sigla || dados.nome, new Set(unidades.map((item) => item.unidadeId)));
              await onSalvar({
                unidadeId: id, nome: dados.nome, sigla: dados.sigla, tipo: dados.tipo, parentId: pai?.unidadeId ?? null,
                caminho: [...(pai?.caminho ?? []), id], ativa: true, criadoPorLogin: autorLogin, criadoEm: new Date().toISOString(), schemaVersion: 1,
              });
              setMensagem(`${dados.nome} criada.`);
            } else {
              await onSalvar({ ...editando, nome: dados.nome, sigla: dados.sigla });
              setMensagem(`${dados.nome} atualizada.`);
            }
            setEditando(null);
          }}
        />
      )}
    </section>
  );
}

function UnidadeModal({ unidade, unidades, onFechar, onSalvar }: {
  unidade: UnidadeOrganizacional | null;
  unidades: readonly UnidadeOrganizacional[];
  onFechar: () => void;
  onSalvar: (dados: { nome: string; sigla: string; tipo: TipoUnidadeOrganizacional; parentId: string }) => Promise<void>;
}) {
  const [nome, setNome] = useState(unidade?.nome ?? '');
  const [sigla, setSigla] = useState(unidade?.sigla ?? '');
  const [tipo, setTipo] = useState<TipoUnidadeOrganizacional>(unidade?.tipo ?? 'COORDENACAO');
  const [parentId, setParentId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const opcoesPai = [...unidades].filter((item) => item.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  async function salvar() {
    setErro('');
    if (nome.trim().length < 2) { setErro('Dê um nome.'); return; }
    if (!unidade && parentId === '') { setErro('Escolha dentro de qual unidade ela fica.'); return; }
    setOcupado(true);
    try {
      await onSalvar({ nome: nome.replace(/\s+/gu, ' ').trim(), sigla: sigla.trim().toUpperCase(), tipo, parentId });
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Sem permissão para esta ação.' : texto || 'Não foi possível salvar agora.');
      setOcupado(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={ocupado ? undefined : onFechar}>
      <section className="edit-modal criar-equipe-modal" role="dialog" aria-modal="true" aria-label={unidade ? 'Renomear' : 'Nova coordenação'} onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Building2 size={18} /></span>
          <div><h2>{unidade ? `Renomear ${unidade.nome}` : 'Nova coordenação'}</h2><p>{unidade ? 'O nome e a sigla que aparecem nas telas.' : 'Escolha o tipo e dentro de qual unidade ela fica.'}</p></div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={ocupado} aria-label="Fechar"><X size={18} /></button>
        </header>
        <label className="criar-equipe-campo"><span>Nome</span><input autoFocus value={nome} maxLength={80} onChange={(evento) => setNome(evento.target.value)} /></label>
        <label className="criar-equipe-campo"><span>Sigla</span><input value={sigla} maxLength={16} placeholder="Ex.: COSI" onChange={(evento) => setSigla(evento.target.value)} /></label>
        {!unidade && (
          <>
            <label className="criar-equipe-campo"><span>Tipo</span>
              <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoUnidadeOrganizacional)}>
                {TIPOS_NOVA.map((opcao) => <option key={opcao} value={opcao}>{TIPO[opcao]}</option>)}
              </select>
            </label>
            <label className="criar-equipe-campo"><span>Dentro de</span>
              <select value={parentId} onChange={(evento) => setParentId(evento.target.value)}>
                <option value="">Escolha…</option>
                {opcoesPai.map((item) => <option key={item.unidadeId} value={item.unidadeId}>{item.nome}{item.sigla ? ` (${item.sigla})` : ''}</option>)}
              </select>
            </label>
          </>
        )}
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="criar-equipe-acoes">
          <button type="button" className="secondary-button" disabled={ocupado} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button" disabled={ocupado} onClick={() => void salvar()}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </section>
    </div>
  );
}
