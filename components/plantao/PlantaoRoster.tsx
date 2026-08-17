import { formatarMinutos } from '@escala-ici/contrato';
import { useMemo, useState } from 'react';

import { indiceIdentidadePlantonista, type ResumoPessoaPlantao } from '@/lib/editorPlantao';
import { normalizarNome } from '@/lib/nomes';

/** Roster com mais de este tanto de pessoas ganha um campo de busca — mesmo critério de "pesquisável quando houver muitas pessoas" do § 14/§ 32 do pedido. */
const LIMITE_PESSOAS_SEM_BUSCA = 8;

export interface PlantaoRosterProps {
  pessoas: readonly ResumoPessoaPlantao[];
  plantonistaSelecionado: string | null;
  onSelecionarPlantonista: (nomeOriginal: string) => void;
  /** Nomes normalizados (`normalizarNome`) de participantes inativos, mas referenciados por alguma atribuição existente — nunca escondidos (§ 8 do pedido). */
  nomesInativos?: ReadonlySet<string>;
  /** Nomes normalizados (`normalizarNome`) com vínculo pendente/não encontrado/conflito. */
  nomesPendentes?: ReadonlySet<string>;
}

/**
 * Fase ESCALAS-UX-2B — roster lateral de plantonistas: substitui o antigo
 * bloco "Resumo por pessoa" (que ficava abaixo do calendário, exigindo
 * scroll) por um painel compacto sempre visível. Reaproveita EXATAMENTE o
 * mecanismo de seleção já existente desde ESCALAS-UX-1C
 * (`plantonistaSelecionado`/`onSelecionarPlantonista`, `aria-pressed`) —
 * nenhuma reimplementação, só reposicionamento visual. Contadores vêm de
 * `resumirPorPessoa()` (já calculado pelo chamador, nunca recalculado
 * aqui — § 6 do pedido). Identidade visual reaproveita
 * `indiceIdentidadePlantonista()` (mesmo hash determinístico já usado
 * pelos cartões do calendário) — nenhuma paleta paralela, nenhum seletor
 * manual de cor.
 *
 * Cada pessoa é `draggable` no desktop (arrastar para um dia do
 * calendário) — clique/toque continua sendo a alternativa universal e
 * obrigatória (§ 9/§ 34 do pedido), nunca substituída pelo drag.
 */
export function PlantaoRoster({
  pessoas,
  plantonistaSelecionado,
  onSelecionarPlantonista,
  nomesInativos,
  nomesPendentes,
}: PlantaoRosterProps) {
  const [busca, setBusca] = useState('');
  const mostrarBusca = pessoas.length > LIMITE_PESSOAS_SEM_BUSCA;
  const buscaNormalizada = normalizarNome(busca);
  const pessoasFiltradas = useMemo(
    () => (buscaNormalizada === ''
      ? pessoas
      : pessoas.filter((pessoa) => normalizarNome(pessoa.nomeOriginal).includes(buscaNormalizada))),
    [pessoas, buscaNormalizada],
  );

  return (
    <aside className="plantao-roster" aria-label="Plantonistas">
      <div className="plantao-roster-cabecalho">
        <h3>Plantonistas</h3>
        <p className="plantao-roster-dica">
          Selecione uma pessoa e depois toque um dia do calendário — ou arraste a pessoa até o dia (desktop).
        </p>
      </div>
      {mostrarBusca && (
        <label className="search-control plantao-roster-busca">
          <input
            type="search"
            placeholder="Buscar plantonista..."
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            aria-label="Buscar plantonista no roster"
          />
        </label>
      )}
      <ul className="plantao-roster-lista">
        {pessoasFiltradas.map((pessoa) => {
          const chave = normalizarNome(pessoa.nomeOriginal);
          const selecionado = plantonistaSelecionado === pessoa.nomeOriginal;
          const inativo = nomesInativos?.has(chave) ?? false;
          const pendente = nomesPendentes?.has(chave) ?? false;
          return (
            <li key={pessoa.nomeOriginal}>
              <button
                type="button"
                className={`plantao-roster-pessoa${selecionado ? ' selecionado' : ''}`}
                aria-pressed={selecionado}
                data-identidade={indiceIdentidadePlantonista(pessoa.nomeOriginal)}
                draggable
                onDragStart={(evento) => {
                  evento.dataTransfer.setData('text/plain', pessoa.nomeOriginal);
                  evento.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onSelecionarPlantonista(pessoa.nomeOriginal)}
              >
                <span className="plantao-roster-pessoa-identidade" aria-hidden="true" />
                <span className="plantao-roster-pessoa-info">
                  <span className="plantao-roster-pessoa-nome">
                    {pessoa.nomeOriginal}
                    {inativo && <span className="status-badge neutral">Inativo</span>}
                    {pendente && <span className="status-badge warning">Pendente</span>}
                  </span>
                  <span className="plantao-roster-pessoa-contador">
                    {pessoa.quantidade} plantões · {formatarMinutos(pessoa.minutos)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {pessoasFiltradas.length === 0 && (
          <li className="empty-inline">Nenhum plantonista encontrado.</li>
        )}
      </ul>
    </aside>
  );
}
