'use client';

import { ChevronRight, LoaderCircle, Search, Users2 } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
  achatarArvoreOrganizacional,
  buscarNaArvoreOrganizacional,
  chaveDoNoOrganizacional,
  chaveFocavelNaArvore,
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
 * com `aria-level`/`aria-expanded`, o padrão "flat list" documentado nas
 * WAI-ARIA Authoring Practices para tree view (alternativa válida a `<ul>`
 * aninhado, e a que casa naturalmente com `nosVisiveisNaArvoreOrganizacional()`,
 * que já devolve exatamente essa lista). Duas variantes de seleção (Fase
 * UI-ORG-1A):
 * - `modoSelecao="unica"` (default, Administração e picker single): cada
 *   linha selecionável usa `aria-selected`, uma só pode estar marcada de
 *   cada vez (`chaveSelecionada`).
 * - `modoSelecao="multipla"` (picker multiple): o container ganha
 *   `aria-multiselectable="true"` e cada linha selecionável usa
 *   `aria-checked` (semântica de "árvore com checkbox", não de seleção
 *   única) — nunca os dois atributos ao mesmo tempo. Unidades nunca
 *   recebem nenhum dos dois (não são selecionáveis em nenhum modo),
 *   distinguindo estrutural / equipe-desmarcada / equipe-marcada para
 *   leitor de tela.
 *
 * Teclado: ↑/↓ move o foco entre itens visíveis; → expande um nó fechado ou
 * avança pro primeiro filho de um nó já aberto; ← recolhe um nó aberto ou
 * volta pro pai; Enter/Espaço aciona `onSelecionarNo`. Roving tabindex: só
 * um item tem `tabIndex=0` por vez — se o item com foco lógico não estiver
 * mais visível (ancestral recolhido), o primeiro item visível assume o
 * tabIndex, nunca deixando a árvore inteira sem nenhum item alcançável via
 * Tab.
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
  /** `true` enquanto os dados de origem (`raizes`) ainda estão carregando — nunca confundir com "vazio". */
  carregando?: boolean;
  /** Mensagem de falha ao carregar — nunca confundir com "vazio"; some quando `carregando` é `true`. */
  erro?: string | null;
  /**
   * `unica` (default): `aria-selected`, uma seleção por vez. `multipla`:
   * `aria-checked` + `aria-multiselectable="true"` no container — usar
   * junto de `chavesSelecionadas` (ver abaixo), nunca com `chaveSelecionada`.
   */
  modoSelecao?: 'unica' | 'multipla';
  /** Só relevante quando `modoSelecao === 'multipla'` — chaves marcadas. */
  chavesSelecionadas?: ReadonlySet<string>;
  /** Foco inicial no campo de busca ao montar — usado pelo `OrganizationTeamPicker` (modal); a árvore da Administração (não-modal) não usa. */
  autoFocarBusca?: boolean;
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
  carregando = false,
  erro = null,
  modoSelecao = 'unica',
  chavesSelecionadas,
  autoFocarBusca = false,
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
  const buscaSemResultado = termoBusca.trim() !== '' && resultadoBusca.chavesEncontradas.size === 0;

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

  if (carregando) {
    return (
      <div className="organization-tree-container">
        <p className="organization-tree-status">
          <LoaderCircle className="spin" size={15} aria-hidden="true" /> Carregando…
        </p>
      </div>
    );
  }

  if (erro !== null) {
    return (
      <div className="organization-tree-container">
        <p className="organization-tree-status organization-tree-status-erro" role="alert">{erro}</p>
      </div>
    );
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
            autoFocus={autoFocarBusca}
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
          autoFocus={autoFocarBusca}
        />
      </label>
      {buscaSemResultado && (
        <p className="empty-inline">Nenhum resultado encontrado para &ldquo;{termoBusca.trim()}&rdquo;.</p>
      )}
      <div
        className="organization-tree"
        role="tree"
        aria-label={labelAria}
        aria-multiselectable={modoSelecao === 'multipla' ? true : undefined}
        ref={listaRef}
      >
        {(() => {
          const chaveFocavelEfetiva = chaveFocavelNaArvore(visiveis, chaveComFoco);

          return visiveis.map((no) => {
            const chave = chaveDoNoOrganizacional(no);
            const selecionavel = ehNoSelecionavel(no);
            const selecionado = modoSelecao === 'multipla'
              ? (chavesSelecionadas?.has(chave) ?? false)
              : chaveSelecionada === chave;
            const expansivel = no.tipo === 'unidade' && no.filhos.length > 0;
            const expandido = expansivel && chavesExpandidasEfetivas.has(chave);
            const encontrado = resultadoBusca.chavesEncontradas.has(chave);
            const nome = no.tipo === 'unidade' ? no.unidade.nome : no.equipe.nome;
            const sigla = no.tipo === 'unidade' ? no.unidade.sigla : no.equipe.sigla;
            const focavel = chave === chaveFocavelEfetiva;
            const atributosSelecao = modoSelecao === 'multipla'
              ? { 'aria-checked': selecionavel ? selecionado : undefined }
              : { 'aria-selected': selecionavel ? selecionado : undefined };

            return (
              <div
                key={chave}
                data-chave={chave}
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- padrão "tree com checkbox" das WAI-ARIA Authoring Practices: em modoSelecao="multipla" o treeitem usa só aria-checked, nunca aria-selected junto (seria redundante/contraditório anunciar os dois estados para a mesma marcação).
                role="treeitem"
                aria-level={no.profundidade + 1}
                aria-expanded={expansivel ? expandido : undefined}
                {...atributosSelecao}
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
