'use client';

import { ChevronRight, Search, Users2 } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
  achatarArvoreOrganizacional,
  buscarNaArvoreOrganizacional,
  chaveDoNoOrganizacional,
  nosVisiveisNaArvoreOrganizacional,
  type NoArvoreOrganizacional,
} from '@/lib/organizacao';

/**
 * Árvore organizacional moderna e reutilizável (Fase UI-ORG-1) — substitui
 * `ArvoreUnidadesOrganizacionais` (cards grandes, Fase de correção UX/UI
 * anterior) por linhas compactas com expand/collapse, busca e navegação por
 * teclado. Usada tanto pela Administração (visualizar/editar Unidades, todo
 * nó selecionável) quanto pelo `OrganizationTeamPicker` (só Equipes
 * selecionáveis, Unidades só navegáveis) — nenhuma lógica de árvore duplicada
 * entre os dois usos: ambos consomem `lib/organizacao.ts`
 * (`construirArvoreOrganizacional`/`buscarNaArvoreOrganizacional`/
 * `nosVisiveisNaArvoreOrganizacional`) e este único componente de
 * apresentação+interação.
 *
 * Semântica ARIA: `role="tree"` num container com a lista VISÍVEL já
 * achatada (respeitando expand/collapse) — cada linha é `role="treeitem"`
 * com `aria-level`/`aria-expanded`/`aria-selected`, o padrão "flat list"
 * documentado nas WAI-ARIA Authoring Practices para tree view (alternativa
 * válida a `<ul>` aninhado, e a que casa naturalmente com
 * `nosVisiveisNaArvoreOrganizacional()`, que já devolve exatamente essa
 * lista). Teclado: ↑/↓ move o foco entre itens visíveis; → expande um nó
 * fechado ou avança pro primeiro filho de um nó já aberto; ← recolhe um nó
 * aberto ou volta pro pai; Enter/Espaço aciona `onSelecionarNo`.
 */
export interface OrganizationTreeProps {
  raizes: NoArvoreOrganizacional[];
  labelAria: string;
  termoBusca: string;
  onMudarBusca: (termo: string) => void;
  placeholderBusca?: string;
  chaveSelecionada: string | null;
  onSelecionarNo: (no: NoArvoreOrganizacional) => void;
  /** Default: todo nó é selecionável. O picker de equipe passa `(no) => no.tipo === 'equipe'`. */
  ehNoSelecionavel?: (no: NoArvoreOrganizacional) => boolean;
  /** Conteúdo à direita da linha — badge de status na Administração, checkbox/radio no picker. */
  renderTrilha?: (no: NoArvoreOrganizacional, selecionavel: boolean, selecionado: boolean) => ReactNode;
  mensagemVazia?: string;
  /** Chaves de unidade expandidas por padrão na primeira renderização (ex.: o caminho até a equipe já escolhida). */
  chavesExpandidasIniciais?: ReadonlySet<string>;
}

function construirMapaDePais(raizes: readonly NoArvoreOrganizacional[]): Map<string, string | null> {
  const paiPorChave = new Map<string, string | null>();
  function visitar(nos: readonly NoArvoreOrganizacional[], pai: string | null) {
    for (const no of nos) {
      const chave = chaveDoNoOrganizacional(no);
      paiPorChave.set(chave, pai);
      if (no.tipo === 'unidade') {
        visitar(no.filhos, chave);
      }
    }
  }
  visitar(raizes, null);
  return paiPorChave;
}

function destacarTermo(texto: string, termo: string): ReactNode {
  const chave = termo.trim();
  if (chave === '') {
    return texto;
  }
  const indice = texto.toLowerCase().indexOf(chave.toLowerCase());
  if (indice === -1) {
    return texto;
  }
  return (
    <>
      {texto.slice(0, indice)}
      <mark>{texto.slice(indice, indice + chave.length)}</mark>
      {texto.slice(indice + chave.length)}
    </>
  );
}

export function OrganizationTree({
  raizes,
  labelAria,
  termoBusca,
  onMudarBusca,
  placeholderBusca = 'Buscar por nome ou sigla…',
  chaveSelecionada,
  onSelecionarNo,
  ehNoSelecionavel = () => true,
  renderTrilha,
  mensagemVazia = 'Nenhum item cadastrado ainda.',
  chavesExpandidasIniciais,
}: OrganizationTreeProps) {
  const [chavesExpandidas, setChavesExpandidas] = useState<Set<string>>(
    () => new Set(chavesExpandidasIniciais ?? []),
  );
  const [chaveComFoco, setChaveComFoco] = useState<string | null>(chaveSelecionada);
  const listaRef = useRef<HTMLDivElement>(null);

  const resultadoBusca = useMemo(() => buscarNaArvoreOrganizacional(raizes, termoBusca), [raizes, termoBusca]);

  /**
   * As chaves reveladas pela busca nunca são gravadas em `chavesExpandidas`
   * (estado manual do usuário) — só somadas aqui, a cada render, para a
   * exibição. Isso é o que faz limpar a busca voltar sozinho ao estado de
   * expansão manual anterior, sem precisar de nenhum efeito sincronizando
   * um Set dentro do outro (nunca `setState` dentro de `useEffect` só para
   * espelhar um valor já derivável durante o render).
   */
  const chavesExpandidasEfetivas = termoBusca.trim() === ''
    ? chavesExpandidas
    : new Set([...chavesExpandidas, ...resultadoBusca.chavesParaExpandir]);

  const visiveis = nosVisiveisNaArvoreOrganizacional(raizes, chavesExpandidasEfetivas);
  const todosOsNos = useMemo(() => achatarArvoreOrganizacional(raizes), [raizes]);
  const paiPorChave = useMemo(() => construirMapaDePais(raizes), [raizes]);

  function alternarExpansao(chave: string) {
    setChavesExpandidas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(chave)) {
        proximas.delete(chave);
      } else {
        proximas.add(chave);
      }
      return proximas;
    });
  }

  function moverFoco(chave: string) {
    setChaveComFoco(chave);
    requestAnimationFrame(() => {
      listaRef.current?.querySelector<HTMLElement>(`[data-chave="${CSS.escape(chave)}"]`)?.focus();
    });
  }

  function aoTeclarNaLinha(evento: KeyboardEvent<HTMLDivElement>, no: NoArvoreOrganizacional) {
    const chave = chaveDoNoOrganizacional(no);
    const indiceAtual = visiveis.findIndex((item) => chaveDoNoOrganizacional(item) === chave);

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      const proximo = visiveis[indiceAtual + 1];
      if (proximo) {
        moverFoco(chaveDoNoOrganizacional(proximo));
      }
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      const anterior = visiveis[indiceAtual - 1];
      if (anterior) {
        moverFoco(chaveDoNoOrganizacional(anterior));
      }
      return;
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      if (no.tipo !== 'unidade' || no.filhos.length === 0) {
        return;
      }
      if (!chavesExpandidasEfetivas.has(chave)) {
        alternarExpansao(chave);
        return;
      }
      const primeiroFilho = no.filhos[0];
      if (primeiroFilho) {
        moverFoco(chaveDoNoOrganizacional(primeiroFilho));
      }
      return;
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      if (no.tipo === 'unidade' && no.filhos.length > 0 && chavesExpandidasEfetivas.has(chave)) {
        alternarExpansao(chave);
        return;
      }
      const paiChave = paiPorChave.get(chave);
      if (paiChave) {
        moverFoco(paiChave);
      }
      return;
    }
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      if (ehNoSelecionavel(no)) {
        onSelecionarNo(no);
      } else if (no.tipo === 'unidade' && no.filhos.length > 0) {
        alternarExpansao(chave);
      }
    }
  }

  if (todosOsNos.length === 0) {
    return (
      <div className="organization-tree-container">
        <label className="organization-tree-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={termoBusca}
            onChange={(evento) => onMudarBusca(evento.target.value)}
            placeholder={placeholderBusca}
            aria-label={placeholderBusca}
          />
        </label>
        <p className="empty-inline">{mensagemVazia}</p>
      </div>
    );
  }

  return (
    <div className="organization-tree-container">
      <label className="organization-tree-search">
        <Search size={14} aria-hidden="true" />
        <input
          value={termoBusca}
          onChange={(evento) => onMudarBusca(evento.target.value)}
          placeholder={placeholderBusca}
          aria-label={placeholderBusca}
        />
      </label>
      <div className="organization-tree" role="tree" aria-label={labelAria} ref={listaRef}>
        {(() => {
          const primeiraChaveVisivel = visiveis[0] ? chaveDoNoOrganizacional(visiveis[0]) : null;
          return visiveis.map((no) => {
            const chave = chaveDoNoOrganizacional(no);
            const selecionavel = ehNoSelecionavel(no);
            const selecionado = chaveSelecionada === chave;
            const expansivel = no.tipo === 'unidade' && no.filhos.length > 0;
            const expandido = expansivel && chavesExpandidasEfetivas.has(chave);
            const encontrado = resultadoBusca.chavesEncontradas.has(chave);
            const nome = no.tipo === 'unidade' ? no.unidade.nome : no.equipe.nome;
            const sigla = no.tipo === 'unidade' ? no.unidade.sigla : no.equipe.sigla;
            const focavel = chaveComFoco === null ? chave === primeiraChaveVisivel : chaveComFoco === chave;

            return (
              <div
                key={chave}
                data-chave={chave}
                role="treeitem"
                aria-level={no.profundidade + 1}
                aria-expanded={expansivel ? expandido : undefined}
                aria-selected={selecionavel ? selecionado : undefined}
                tabIndex={focavel ? 0 : -1}
                className={[
                  'organization-tree-row',
                  no.tipo === 'equipe' ? 'organization-tree-row-equipe' : '',
                  selecionado ? 'is-selected' : '',
                  encontrado ? 'is-found' : '',
                  selecionavel ? '' : 'is-nao-selecionavel',
                ].filter(Boolean).join(' ')}
                style={{ paddingLeft: `${no.profundidade * 20 + 10}px` }}
                onClick={() => (selecionavel ? onSelecionarNo(no) : expansivel && alternarExpansao(chave))}
                onFocus={() => setChaveComFoco(chave)}
                onKeyDown={(evento) => aoTeclarNaLinha(evento, no)}
              >
                {expansivel ? (
                  <button
                    type="button"
                    className="organization-tree-chevron"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={(evento) => {
                      evento.stopPropagation();
                      alternarExpansao(chave);
                    }}
                  >
                    <ChevronRight size={14} className={expandido ? 'is-expanded' : ''} />
                  </button>
                ) : (
                  <span className="organization-tree-chevron-spacer" aria-hidden="true" />
                )}
                {no.tipo === 'equipe' && <Users2 size={13} aria-hidden="true" className="organization-tree-icon" />}
                <span className="organization-tree-nome">{destacarTermo(nome, termoBusca)}</span>
                <span className="organization-tree-sigla">{sigla}</span>
                {renderTrilha && (
                  <span className="organization-tree-trilha">{renderTrilha(no, selecionavel, selecionado)}</span>
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
