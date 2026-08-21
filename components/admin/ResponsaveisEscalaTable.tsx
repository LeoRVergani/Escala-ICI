import { Pencil, Plus, Power, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, EscopoOperacional, UnidadeOrganizacional, Usuario } from '@/lib/modelos';
import { particionarResponsaveisLoginPorElegibilidade } from '@/lib/escoposOperacionaisMatriz';
import { codigoOrganizacionalEquipe } from '@/lib/organizacao';

function nomesEquipes(
  ids: readonly string[],
  equipes: readonly Equipe[],
  unidades: readonly UnidadeOrganizacional[],
): string {
  if (ids.length === 0) return '-';
  return ids.map((id) => {
    const equipe = equipes.find((item) => item.id === id);
    return equipe === undefined ? id : `${equipe.nome} · ${codigoOrganizacionalEquipe(equipe, unidades)}`;
  }).join(', ');
}

function nomesUsuarios(logins: readonly string[], usuarios: readonly Usuario[]): string {
  if (logins.length === 0) return '';
  return logins.map((login) => usuarios.find((usuario) => usuario.login === login)?.nome ?? login).join(', ');
}

function textosEquipes(
  ids: readonly string[],
  equipes: readonly Equipe[],
  unidades: readonly UnidadeOrganizacional[],
): string[] {
  return ids.flatMap((id) => {
    const equipe = equipes.find((item) => item.id === id);
    return equipe === undefined ? [id] : [id, equipe.nome, equipe.sigla, codigoOrganizacionalEquipe(equipe, unidades)];
  });
}

function textosUsuarios(logins: readonly string[], usuarios: readonly Usuario[]): string[] {
  return logins.flatMap((login) => {
    const usuario = usuarios.find((item) => item.login === login);
    return usuario === undefined ? [login] : [login, usuario.nome, usuario.email];
  });
}

function caminhoUnidade(escopo: EscopoOperacional, unidades: readonly UnidadeOrganizacional[]): string {
  const caminho = escopo.caminhoUnidade ?? (escopo.unidadeId ? [escopo.unidadeId] : []);
  if (caminho.length === 0) return '-';
  return caminho.map((id) => unidades.find((unidade) => unidade.unidadeId === id)?.sigla ?? id).join(' > ');
}

export interface ResponsaveisEscalaTableProps {
  escopos: EscopoOperacional[];
  equipes: Equipe[];
  grupos: GrupoPlantao[];
  unidades: UnidadeOrganizacional[];
  usuarios: Usuario[];
  onNovo: () => void;
  onEditar: (escopo: EscopoOperacional) => void;
  onAlternarStatus: (escopo: EscopoOperacional, ativo: boolean) => void | Promise<void>;
  podeEditar?: boolean;
  processando?: boolean;
}

export function ResponsaveisEscalaTable({
  escopos,
  equipes,
  grupos,
  unidades,
  usuarios,
  onNovo,
  onEditar,
  onAlternarStatus,
  podeEditar = false,
  processando = false,
}: ResponsaveisEscalaTableProps) {
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('ATIVO');
  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(() => escopos.filter((escopo) => {
    const texto = [
      escopo.tipo,
      escopo.alvoNome,
      escopo.alvoId,
      escopo.unidadeId ?? '',
      ...textosUsuarios(escopo.responsaveisLogin, usuarios),
      ...textosEquipes(escopo.responsaveisEquipe, equipes, unidades),
      ...textosEquipes(escopo.equipesConsulta, equipes, unidades),
    ].join(' ').toLowerCase();
    return (termo === '' || texto.includes(termo))
      && (tipo === '' || escopo.tipo === tipo)
      && (status === '' || (status === 'ATIVO' ? escopo.ativo : !escopo.ativo));
  }), [equipes, escopos, status, termo, tipo, unidades, usuarios]);

  return (
    <article className="panel grid-panel">
      <div className="panel-title">
        <div>
          <h2>Responsáveis por escala</h2>
          <p>Esta configuração define quem administra a escala. Consulta não concede edição.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={!podeEditar || processando}
          title={podeEditar ? 'Criar novo vínculo operacional' : 'Somente ADMIN_SISTEMA edita responsáveis por escala nesta fase'}
          onClick={onNovo}
        >
          <Plus size={16} /> Novo vínculo
        </button>
      </div>
      <div className="toolbar">
        <label className="search-control">
          <Search size={16} />
          <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar escala, equipe, usuário ou unidade" />
        </label>
        <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="JORNADA">Jornada</option>
          <option value="PLANTAO">Plantão</option>
        </select>
        <select value={status} onChange={(evento) => setStatus(evento.target.value)}>
          <option value="">Todos os status</option>
          <option value="ATIVO">Ativos</option>
          <option value="INATIVO">Inativos</option>
        </select>
        <span>{filtrados.length} vínculo(s)</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Escala/Equipe/Grupo</th>
              <th>Unidade/Área</th>
              <th>Responsáveis</th>
              <th>Equipes que consultam</th>
              <th>Status</th>
              {podeEditar && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((escopo) => {
              const responsaveisLoginParticionados = particionarResponsaveisLoginPorElegibilidade(escopo.responsaveisLogin, usuarios);
              const responsaveis = [
                nomesUsuarios(responsaveisLoginParticionados.elegiveis, usuarios),
                nomesEquipes(escopo.responsaveisEquipe, equipes, unidades),
              ].filter(Boolean).join(', ') || '-';
              const alvoExiste = escopo.tipo === 'JORNADA'
                ? equipes.some((equipe) => equipe.id === escopo.alvoId)
                : grupos.some((grupo) => grupo.grupoId === escopo.alvoId);
              return (
                <tr key={`${escopo.tipo}:${escopo.alvoId}`}>
                  <td>{escopo.tipo === 'JORNADA' ? 'Jornada' : 'Plantão'}</td>
                  <td>
                    <strong>{escopo.alvoNome}</strong>
                    {!alvoExiste && <small>Alvo não encontrado no cadastro atual</small>}
                  </td>
                  <td>{caminhoUnidade(escopo, unidades)}</td>
                  <td>
                    <span>{responsaveis}</span>
                    {responsaveisLoginParticionados.naoElegiveis.length > 0 && (
                      <span className="status-badge warning" title={responsaveisLoginParticionados.naoElegiveis.join(', ')}>
                        Responsável não elegível
                      </span>
                    )}
                  </td>
                  <td>{escopo.tipo === 'PLANTAO' ? nomesEquipes(escopo.equipesConsulta, equipes, unidades) : '-'}</td>
                  <td><span className={`status-badge ${escopo.ativo ? 'success' : 'neutral'}`}>{escopo.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  {podeEditar && (
                    <td>
                      <div className="conciliation-actions">
                        <button className="icon-button" type="button" title="Editar" aria-label={`Editar ${escopo.alvoNome}`} onClick={() => onEditar(escopo)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          disabled={processando}
                          title={escopo.ativo ? 'Desativar vínculo' : 'Reativar vínculo'}
                          aria-label={escopo.ativo ? `Desativar ${escopo.alvoNome}` : `Reativar ${escopo.alvoNome}`}
                          onClick={() => void onAlternarStatus(escopo, !escopo.ativo)}
                        >
                          {escopo.ativo ? <Power size={14} /> : <RotateCcw size={14} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={podeEditar ? 7 : 6}>
                  {podeEditar
                    ? 'Nenhum vínculo encontrado. Use Novo vínculo para configurar o primeiro responsável por escala.'
                    : 'Nenhum vínculo encontrado. Somente ADMIN_SISTEMA cria ou edita vínculos nesta fase.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
