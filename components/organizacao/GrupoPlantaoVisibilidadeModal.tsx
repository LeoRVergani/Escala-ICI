'use client';

import { useMemo, useState } from 'react';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, UnidadeOrganizacional } from '@/lib/modelos';
import { normalizarNome } from '@/lib/nomes';
import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — modal único e
 * simples para o chefe de equipe escolher quais Plantões sua equipe
 * consulta (Parte 2 do pedido original). Substitui o bloco inline que
 * existia em Administração > Organização (escrita imediata por clique,
 * sem Cancelar/Salvar, erro nunca renderizado nesta tela) por um rascunho
 * local com Cancelar/"Salvar visibilidade" — mesmo esqueleto de
 * `OrganizationTeamPicker` (`.modal-backdrop`/`.edit-modal`/`.panel-title`/
 * `.rollback-actions`), mas a lista é de `GrupoPlantao`, agrupada por
 * fonte administradora — não a árvore de equipes/unidades.
 *
 * Nunca menciona `equipesConsulta`/ACL/Matriz/IDs técnicos no texto
 * visível — só nomes amigáveis (`grupo.nome`, nome da equipe/unidade
 * responsável).
 */

interface GrupoComFonte {
  grupo: GrupoPlantao;
  rotuloFonte: string;
}

function agruparPorFonte(
  grupos: readonly GrupoPlantao[],
  equipes: readonly Equipe[],
  unidades: readonly UnidadeOrganizacional[],
): GrupoComFonte[] {
  return grupos.map((grupo) => {
    if (grupo.unidadeResponsavelId) {
      const unidade = unidades.find((item) => item.unidadeId === grupo.unidadeResponsavelId);
      if (unidade) {
        return { grupo, rotuloFonte: unidade.nome };
      }
    }
    const equipe = equipes.find((item) => item.id === grupo.equipeResponsavelId);
    return { grupo, rotuloFonte: equipe?.nome ?? 'Outras fontes' };
  });
}

export function GrupoPlantaoVisibilidadeModal({
  equipeNome,
  equipeTravadaId,
  grupos,
  equipes,
  unidades,
  valoresIniciais,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: {
  /** Nome amigável da equipe cuja visibilidade está sendo configurada — nunca o ID técnico. */
  equipeNome: string;
  /** `grupoId` do(s) Grupo(s) cuja equipe responsável É a equipe atual — sempre marcado, nunca desmarcável. */
  equipeTravadaId: string;
  grupos: readonly GrupoPlantao[];
  equipes: readonly Equipe[];
  unidades: readonly UnidadeOrganizacional[];
  valoresIniciais: readonly string[];
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: (grupoIdsSelecionados: string[]) => void;
}) {
  useTeclaEsc(onFechar);
  const [termoBusca, setTermoBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set(valoresIniciais));

  const gruposComFonte = useMemo(() => agruparPorFonte(grupos, equipes, unidades), [grupos, equipes, unidades]);
  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — cor por `grupoId`
   * fixada na ordem de `grupos` (nunca na ordem filtrada/agrupada), para
   * a mesma fonte manter sempre a mesma cor ao digitar na busca.
   * Reaproveita a paleta categórica `[data-identidade]` já usada no
   * calendário de Plantão do App — nunca uma paleta nova.
   */
  const indicePorGrupo = useMemo(() => new Map(grupos.map((grupo, indice) => [grupo.grupoId, indice % 8])), [grupos]);
  const filtrados = termoBusca.trim() === ''
    ? gruposComFonte
    : gruposComFonte.filter((item) => normalizarNome(item.grupo.nome).includes(normalizarNome(termoBusca)));

  const porFonte = new Map<string, GrupoComFonte[]>();
  for (const item of filtrados) {
    const lista = porFonte.get(item.rotuloFonte) ?? [];
    lista.push(item);
    porFonte.set(item.rotuloFonte, lista);
  }

  function alternar(grupoId: string) {
    if (grupoId === equipeTravadaId) {
      return;
    }
    setSelecionados((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(grupoId)) {
        proximo.delete(grupoId);
      } else {
        proximo.add(grupoId);
      }
      return proximo;
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal plantao-visibilidade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plantao-visibilidade-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="plantao-visibilidade-title">Plantões visíveis para esta equipe</h2>
            <p>
              Escolha quais plantões {equipeNome} poderá consultar. Isso libera apenas visualização. Não
              permite editar participantes, contatos, rascunhos, publicações ou trocas do plantão de outra
              equipe.
            </p>
          </div>
        </div>

        <label className="busca-simples" htmlFor="plantao-visibilidade-busca">
          Buscar Plantão
          <input
            id="plantao-visibilidade-busca"
            type="text"
            autoFocus
            placeholder="Buscar por nome (ex.: COSI, NOC, DBA)"
            value={termoBusca}
            onChange={(evento) => setTermoBusca(evento.target.value)}
          />
        </label>

        <div className="plantao-visibilidade-lista">
          {porFonte.size === 0 && <p className="empty-inline">Nenhum Plantão encontrado para esse termo.</p>}
          {[...porFonte.entries()].map(([rotuloFonte, itens]) => (
            <fieldset className="plantao-visibilidade-grupo" key={rotuloFonte}>
              <legend>{rotuloFonte}</legend>
              {itens.map(({ grupo }) => {
                const travado = grupo.grupoId === equipeTravadaId;
                const marcado = travado || selecionados.has(grupo.grupoId);
                return (
                  <label key={grupo.grupoId} className="plantao-visibilidade-item">
                    <span className="plantao-grupo-chip-badge" data-identidade={indicePorGrupo.get(grupo.grupoId) ?? 0}>
                      {grupo.nome.replace(/^Plantão\s+/i, '').trim().slice(0, 2).toUpperCase() || grupo.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="plantao-visibilidade-item-nome">{grupo.nome}</span>
                    {travado && <span className="status-badge neutral inline-badge">sempre visível</span>}
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={travado}
                      onChange={() => alternar(grupo.grupoId)}
                    />
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        {erro && <div className="alert error" role="alert">{erro}</div>}

        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button
            className="primary-button"
            type="button"
            disabled={salvando}
            onClick={() => onSalvar([...selecionados])}
          >
            {salvando ? 'Salvando…' : 'Salvar visibilidade'}
          </button>
        </div>
      </section>
    </div>
  );
}
