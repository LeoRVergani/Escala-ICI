# Checkpoint — Fase UI-ORG-1 (árvore organizacional moderna + seletor reutilizável de equipes)

Data: 2026-08-16. Escopo: só UI/UX — modernizar a visualização da árvore de
Unidades Organizacionais na Administração e extrair uma fundação
reutilizável de árvore/seleção, aplicada também ao seletor de equipe do
`ModalGrupoPlantao` (PLANTÃO-3B). **Nenhuma mudança de schema Firestore,
Rules, repositórios de Plantão, autenticação, publicação ou App do
colaborador.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD            f42622d790c36f03385ee9a82793a62a89ab3186
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 6]
```

`ahead 6` confirmado, working tree limpa exceto `docs/spec/
SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md` (arquivo estranho — a
premissa da fase de que ele "deve estar fora do repositório" continua não
se confirmando; segue untracked, não tocado, não versionado, exatamente
como nas duas fases anteriores) e `packages/contrato/.sites-runtime/`
(cache de ferramenta, também não versionado).

Baseline de testes confirmado antes de qualquer mudança: unit 666/666,
boundaries 129/129, Rules 153/153, typechecks OK, lint 0 erros, builds OK.

## Leitura prévia obrigatória

`docs/spec/HIERARQUIA_ORGANIZACIONAL.md` (inteiro, incluindo § 12 —
"Componente futuro de seleção organizacional", que previa exatamente este
componente), `HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`,
`ADMINISTRACAO_E_HIERARQUIA.md`, `PLANTOES.md` (§§ 20-21),
`UI_CASCADE_E_HERANCA.md`, `CHECKPOINT-FASE-HIERARQUIA-1-FONTE-DE-VERDADE.md`,
`CHECKPOINT-FASE-PLANTAO-3B-DASHBOARD-RASCUNHO.md`, e auditoria de
`lib/organizacao.ts`/`lib/organizacao.test.ts`/`lib/modelos.ts`/
`apps/dashboard/src/DashboardApp.tsx` (padrões de modal/árvore/`<select>`
já existentes) e `app/globals.css` (seção `.org-tree*`, `.admin-form-grid`,
`.checkbox-inline`).

## Arquivos criados

- `lib/hooks/useTeclaEsc.ts` — hook extraído de `DashboardApp.tsx` (estava
  privado ao arquivo; agora reutilizado pelos novos componentes sem
  duplicar as mesmas 10 linhas).
- `components/organizacao/OrganizationBreadcrumb.tsx` — breadcrumb de
  caminho organizacional (`unidadeId[] → rótulos`), reaproveitando
  `rotuloUnidadePorId()` (nova, extraída da função privada `rotuloDoId()`).
- `components/organizacao/OrganizationTree.tsx` — árvore compacta com
  busca, expand/collapse, seleção e navegação por teclado (`role="tree"`,
  lista achatada e visível — ver § "Acessibilidade" abaixo).
- `components/organizacao/OrganizationTeamPicker.tsx` — modal de seleção
  de equipes, modo `single`/`multiple`, construído sobre `OrganizationTree`
  com `ehNoSelecionavel = (no) => no.tipo === 'equipe'`.
- `tests/ui-org-boundaries.test.mjs` — 11 testes de fronteira novos.
- Este checkpoint.

## Arquivos alterados

- `lib/organizacao.ts` — nova seção "Árvore organizacional mista":
  `NoArvoreOrganizacional` (union `unidade`/`equipe`),
  `construirArvoreOrganizacional()`, `achatarArvoreOrganizacional()`,
  `nosVisiveisNaArvoreOrganizacional()`, `buscarNaArvoreOrganizacional()`,
  `chaveDoNoOrganizacional()`, `raizesComEquipesSemUnidade()`,
  `rotuloUnidadePorId()` (pública). `construirArvoreUnidades()`/
  `rotuloDoId()` tiveram o parâmetro alargado para `readonly
  UnidadeOrganizacional[]` (mudança não-quebra — todo array mutável já
  aceito continua aceito).
- `lib/organizacao.test.ts` — 22 testes novos.
- `apps/dashboard/src/DashboardApp.tsx` — painel "Unidades organizacionais"
  reescrito (árvore+detalhe no lugar de árvore-de-cards+tabela);
  `ModalGrupoPlantao` passa a usar `OrganizationTeamPicker` no lugar do
  `<select>`/checkboxes; `ArvoreUnidadesOrganizacionais` (componente antigo)
  removida.
- `app/globals.css` — `.org-tree*` (cards antigos) removido; `.organization-*`
  novo (ver § "CSS" abaixo).
- `docs/spec/PLANTOES.md` — nova seção 22.
- `docs/spec/HIERARQUIA_ORGANIZACIONAL.md` — § 12 atualizada de "adiada"
  para "implementada", sem mudar nenhuma semântica normativa.
- `tests/plantao-dashboard-administracao-boundaries.test.mjs` — teste 5
  atualizado (o seletor de equipe do `ModalGrupoPlantao` agora é o
  `OrganizationTeamPicker`, não mais um `<select>` com `trechoFinalCaminho()`
  direto — a fundação de árvore continua sendo `lib/organizacao.ts`, só
  que indiretamente via o componente compartilhado).
- `package.json` — `test:boundaries` passa a incluir
  `tests/ui-org-boundaries.test.mjs`.

## Fundação única — nenhuma segunda árvore

`construirArvoreOrganizacional(unidades, equipes)` reaproveita
`construirArvoreUnidades()` para o esqueleto de Unidades (nunca uma segunda
travessia de `parentId`) e enxerta cada Equipe como folha da unidade
correspondente (`equipe.unidadeId`), ordenando irmãos (unidades e equipes
juntas) por nome. Equipes sem `unidadeId` (ou apontando para uma unidade
fora do conjunto carregado) vão para `equipesSemUnidade` — nunca um parent
inventado. Unidades inalcançáveis a partir de nenhuma raiz (ciclo entre IDs
já existentes) são sinalizadas em `unidadesInalcancaveis`, nunca corrigidas
automaticamente.

A Administração (`OrganizationTree` com todo nó navegável, só Unidade
editável ali) e o `OrganizationTeamPicker` (só Equipe selecionável)
consomem exatamente as mesmas funções de `lib/organizacao.ts` — confirmado
por teste de fronteira (`tests/ui-org-boundaries.test.mjs`, testes 3 e 8/9)
que nenhum dos dois componentes declara sua própria função de árvore ou
percorre `parentId` diretamente.

## Comportamento — expand/collapse, seleção, busca, breadcrumb

- **Expand/collapse**: estado local do componente (`Set<string>` de
  chaves expandidas), nunca persistido no Firestore. `nosVisiveisNaArvoreOrganizacional()`
  (pura, testada) computa a lista visível respeitando esse estado.
- **Seleção**: `chaveSelecionada`/`onSelecionarNo` controlados pelo
  caller — a Administração guarda a chave selecionada para o painel de
  detalhes; o picker guarda um rascunho local (`single`: `string | null`;
  `multiple`: `Set<string>`) só confirmado ao clicar "Confirmar".
- **Busca**: `buscarNaArvoreOrganizacional()` (pura, por nome/sigla,
  acento/caixa-insensível via `normalizarNome()` já existente) devolve as
  chaves encontradas e as chaves de UNIDADE que precisam expandir para
  revelar cada resultado (inclui ancestrais de uma Equipe profunda
  encontrada). O termo buscado nunca é persistido em `chavesExpandidas`
  (estado manual) — é só somado por render; limpar a busca volta sozinho
  ao estado de expansão manual anterior, sem precisar de nenhum efeito
  sincronizando um `Set` dentro do outro.
- **Breadcrumb**: `OrganizationBreadcrumb` resolve cada segmento do
  `caminho` (array de `unidadeId`, já existente em
  `UnidadeOrganizacional.caminho`/`Equipe.caminhoUnidade`) via
  `rotuloUnidadePorId()` — nunca recalcula rótulo por conta própria.
- **Profundidade arbitrária**: indentação via `profundidade * 20px`
  (calculada, sem classes `level-1`/`level-2`/etc. que limitariam
  níveis) — testado com a árvore de fixture de 5 níveis
  (`DIRETOR_PRESIDENTE > ... > SUPERVISOR_TI`) em `lib/organizacao.test.ts`.
- **Ciclo**: `unidadesInalcancaveis` exibido como alerta na Administração
  ("N unidade(s) não aparecem na árvore — possível ciclo..."), nunca
  corrigido automaticamente — mesma disciplina de `formariaCiclo()`
  (só previne ciclo NOVO no cliente).
- **Equipe sem unidade**: seção própria "Equipes sem unidade associada" na
  Administração (fora da árvore principal, sem inventar parent); no
  picker, `raizesComEquipesSemUnidade()` as anexa como raízes soltas
  (profundidade 0) para continuarem selecionáveis.

## Tabela antiga — removida, não duplicada

A tabela de Unidades (ID/Nome/Tipo/Caminho/Status/editar) duplicava
inteiramente o que a árvore de cards já mostrava, exceto por dois campos:
ID (`unidadeId`) e Caminho completo. O novo painel de detalhes (aberto ao
selecionar um nó) mostra exatamente esses dois campos (mais pai, contagem
de filhos/equipes) — a tabela foi removida por completo, não convertida em
"modo alternativo", porque nada nela ficaria sem cobertura equivalente.
Confirmado por teste de fronteira (`tests/ui-org-boundaries.test.mjs`,
teste 10: `.org-tree-node`/`ArvoreUnidadesOrganizacionais` não sobrevivem
como dead code).

## Desktop / mobile

Desktop: `.organization-layout` é um grid de duas colunas (árvore 1.3fr +
detalhe 1fr), `align-items: start`. Abaixo de 960px vira uma coluna só —
árvore em cima, painel de detalhes embaixo (sem tentar lado a lado no
mobile, conforme a fase pede). O picker (`OrganizationTeamPicker`) já é um
modal em toda largura de tela — no mobile ocupa `100%` da largura
disponível (`@media (max-width: 640px)`), com a árvore interna limitada a
`50vh` para a busca e as ações "Cancelar"/"Confirmar" ficarem sempre
visíveis sem precisar rolar até o fim.

## Acessibilidade / ARIA / teclado

`OrganizationTree` usa o padrão "lista achatada" das WAI-ARIA Authoring
Practices para tree view (alternativa válida a `<ul>` aninhado): container
`role="tree"`, cada linha `role="treeitem"` com `aria-level` (=
`profundidade + 1`), `aria-expanded` (só em nós expansíveis) e
`aria-selected` (só em nós selecionáveis). Teclado: ↑/↓ move o foco entre
itens visíveis (roving tabindex — só o item com foco tem `tabIndex={0}`);
→ expande um nó fechado ou avança para o primeiro filho de um já aberto; ←
recolhe um nó aberto ou volta para o pai (mapa pai↔filho construído uma vez
por render, sem repetir a travessia da árvore); Enter/Espaço aciona
`onSelecionarNo`. O checkbox do modo `multiple` do picker tem
`aria-label` próprio e `stopPropagation` no clique para não disparar
também o `onClick` da linha (evita alternar a seleção duas vezes).

**Limitação assumida**: o modo `multiple` não implementa o padrão
`aria-multiselectable`/`aria-checked` completo das ARIA Authoring
Practices para árvores multi-seleção — usa `aria-selected` (semântica de
seleção única) e depende do estado nativo do `<input type="checkbox">`
para leitores de tela. Documentado aqui como simplificação deliberada, não
como lacuna escondida.

## Light / dark

Nenhum token de cor novo — todas as classes `.organization-*` usam as
variáveis já existentes (`--surface`, `--border`, `--primary`,
`--primary-soft`, `--muted`, `--warning-soft`), que já têm par light/dark
definido em `app/globals.css`. **Validação visual real não foi feita —
nenhum browser disponível neste ambiente. Auditoria estática apenas.**

## CSS

`.organization-tree*`/`.organization-detail-panel`/`.organization-breadcrumb*`/
`.organization-layout`/`.organization-team-picker*`/`.organization-picker-*`/
`.organization-sem-unidade*` — todas novas, escopadas (nenhuma classe
existente foi reescrita fora do seu contexto estrutural). `.org-tree`/
`.org-tree-node*` (cards antigos) removidas por completo — confirmado, via
grep, que nenhum `.tsx` do repositório ainda referenciava essas classes
antes da remoção.

## Testes

- `lib/organizacao.test.ts`: **22 testes novos** (`construirArvoreOrganizacional`
  — 1 nível, múltiplos níveis, ordenação mista unidade+equipe, equipe sem
  unidade, equipe em unidade profunda, ciclo/inalcançável, nó desconhecido
  não quebra; `nosVisiveisNaArvoreOrganizacional`; `buscarNaArvoreOrganizacional`
  — nome, sigla, ancestrais preservados, sem correspondência;
  `achatarArvoreOrganizacional`/`chaveDoNoOrganizacional`; `rotuloUnidadePorId`;
  `raizesComEquipesSemUnidade`).
- `tests/ui-org-boundaries.test.mjs`: **11 testes novos** — Tree/Picker sem
  Firebase, sem segunda árvore, sem hardcode organizacional, ACL só em
  `GrupoPlantao.equipesConsulta`, App sem componentes novos, sem parser
  XLS/catálogo 6x1, Tree genérica (não conhece Plantão), Picker genérico
  (não conhece GrupoPlantao), tabela/componente antigos removidos (não
  dead code), Rules/modelo de Plantão com diff zero.
- `tests/plantao-dashboard-administracao-boundaries.test.mjs`: teste 5
  atualizado (não removido) para a nova arquitetura.

**Testes de componente (render/DOM/expand/collapse/seleção/teclado/ARIA em
tempo de execução) NÃO foram adicionados.** Perguntado explicitamente ao
usuário se deveria introduzir `@testing-library/react` + ambiente jsdom
(inexistentes neste repositório — os 688 testes unitários existentes
rodam todos em `environment: 'node'`, só função pura); a resposta foi
**não adicionar essa infraestrutura nesta fase**. Cobertura real hoje:
toda a LÓGICA que orienta o comportamento do componente (visibilidade
respeitando expansão, busca com ancestrais, ordenação, ciclo, equipe sem
unidade) está testada como função pura em `lib/organizacao.test.ts`; o que
NÃO está coberto por nenhum teste automatizado é a interação real
(disparo de evento de teclado, foco do DOM, atributos ARIA renderizados,
clique). Registrado aqui explicitamente, não escondido.

## Verificação completa

```
npm run typecheck            OK
npm run typecheck:apps       OK (dashboard + app-web)
npm run typecheck:worker     OK
npm run lint                 OK (0 erros; 5 warnings pré-existentes,
                              arquivos não tocados nesta fase)
npm run test:unit            688 passed (era 666)
npm run test:boundaries      140 passed (era 129)
npm run test:firestore-rules 153 passed (inalterado — Rules não tocadas)
npm run build:dashboard      OK
npm run build:app:pages      OK
npm run build:apps           OK
npm run validate:pwa         OK
npm run validate:artifact    OK
git diff --check             sem problema de espaço em branco
```

## Auditoria de PII

`git diff` de todas as linhas adicionadas varrido por padrão de telefone
plausível e por nomes: nenhum encontrado (só ícones `size={N}` e tokens de
cor, nenhum falso positivo desta vez). Nenhum nome fictício novo foi
introduzido nesta fase (nenhuma fixture de pessoa nova).
`docs/spec/SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md` não foi lido,
copiado nem referenciado por conteúdo.

## Estado final (git)

```
git diff --stat -- apps/app/                        (vazio — diff zero)
git diff --stat -- firestore.rules firestore.indexes.json   (vazio — diff zero)
git diff --stat -- lib/firebase/authRepository.ts    (vazio — diff zero)
git diff --stat -- apps/push-worker/                 (vazio — diff zero)
git diff --stat -- lib/firebase/plantaoReadRepository.ts lib/firebase/plantaoWriteRepository.ts  (vazio — diff zero)
```

Commit único local (`feat(ui): moderniza arvore organizacional e seletor
de equipes`), sem `--amend`, sem rebase, sem merge. **NÃO houve push. NÃO
houve deploy. Firebase não foi alterado (nenhum diff em Rules/índices).
Modelo organizacional (`UnidadeOrganizacional`/`Equipe`) não foi alterado
— só a apresentação. Modelo de Plantão (`GrupoPlantao`/payload persistido)
não foi alterado. Produção não foi tocada.**
