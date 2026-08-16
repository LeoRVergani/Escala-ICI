# Checkpoint — Fase UI-ORG-1A (fechamento de acessibilidade + validação visual)

Data: 2026-08-16. Microfase: fecha as lacunas de acessibilidade registradas
no checkpoint da UI-ORG-1 (`aria-multiselectable`/`aria-checked` do modo
`multiple`, roving tabindex, foco), aplica os ajustes visuais/copy
confirmados em teste real (§ 17A do prompt) e corrige um bug real de
carregamento descoberto durante essa mesma inspeção. **Nenhuma árvore
redesenhada, nenhum modelo (organizacional ou de Plantão) alterado,
nenhuma mudança de Firestore/Rules/repositórios.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD           1cd99e32817c2178066f0d13c70ed84305ce477f
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 7]
```

Working tree limpa, exceto `packages/contrato/.sites-runtime/` (cache de
ferramenta, untracked, não criado por esta fase — reportado, não removido).
`docs/spec/SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md` **não existe
mais** no repositório — a premissa desta fase, ao contrário das duas fases
anteriores, se confirmou.

Baseline de testes confirmado antes de qualquer mudança: unit 688/688,
boundaries 140/140, Rules 153/153, typechecks OK, lint 0 erros.

## Leitura prévia

`docs/spec/UI_CASCADE_E_HERANCA.md`, `HIERARQUIA_ORGANIZACIONAL.md`,
`PLANTOES.md`, `CHECKPOINT-FASE-UI-ORG-1-ARVORE-PICKER.md`; auditoria de
`components/organizacao/{OrganizationTree,OrganizationTeamPicker,
OrganizationBreadcrumb}.tsx`, `lib/organizacao.ts`, o bloco "Plantões"/
`ModalGrupoPlantao` de `apps/dashboard/src/DashboardApp.tsx`, e a seção
`.organization-*`/`.admin-form-*`/`.checkbox-row` de `app/globals.css`.

## 1-3. Acessibilidade do MULTIPLE picker

`OrganizationTree` ganhou `modoSelecao?: 'unica' | 'multipla'` +
`chavesSelecionadas?: ReadonlySet<string>` (novos, opcionais — Administração
e o picker `single` continuam no comportamento default `'unica'`, sem
nenhuma mudança de props existentes).

- **`modoSelecao="multipla"`**: o container `role="tree"` ganha
  `aria-multiselectable="true"`; cada linha selecionável usa `aria-checked`
  (nunca `aria-selected` junto — seria redundante/contraditório anunciar os
  dois estados para a mesma marcação, exatamente o que a fase proíbe).
  `eslint-plugin-jsx-a11y` acusa `role-has-required-aria-props` porque sua
  definição de `treeitem` não conhece o padrão "árvore com checkbox" das
  WAI-ARIA Authoring Practices — suprimido com comentário justificando (não
  é falso positivo escondido, é uma exceção documentada).
- **Unidades nunca recebem `aria-checked` nem `aria-selected`** em nenhum
  modo (`selecionavel` continua `false` para elas) — leitor de tela
  distingue estrutural (nenhum atributo de seleção) / equipe desmarcada
  (`aria-checked="false"`) / equipe marcada (`aria-checked="true"`).
- **Checkbox visual e ARIA nunca divergem**: os dois lêem do mesmo
  `rascunhoMultiple` (o `<input type="checkbox" checked={...}>` e o
  `aria-checked` do `treeitem` pai usam a mesma função `chavesSelecionadas.has(chave)`).

## 4-5. SINGLE picker

Sem mudança de comportamento — já usava `aria-selected`/seleção única antes
desta fase; confirmado que `modoSelecao` default (`'unica'`) preserva
exatamente o código anterior. Selecionar outra equipe substitui a anterior
(`setRascunhoSingle`, não um `Set`). Enter/Espaço continuam acionando
`onSelecionarNo` via o `treeitem` (`ehNoSelecionavel` filtra só Equipes).

## 6-7. Tree administrativa e teclado

`aria-expanded` só em nós com filhos (`expansivel`), nunca em folhas — já
estava correto, confirmado por leitura. **Bug real corrigido**: o cálculo
de "qual item tem `tabIndex=0`" comparava `chaveComFoco` só contra `null`;
se o nó com foco lógico deixasse de estar visível (ex.: o ancestral foi
recolhido), NENHUM item ficava com `tabIndex=0` — a árvore inteira ficava
inalcançável via Tab. Extraído para `chaveFocavelNaArvore()`
(`lib/organizacao.ts`, pura, testada): usa a chave com foco se ela ainda
está entre os nós visíveis, senão cai para o primeiro nó visível — nunca
zero itens alcançáveis. ↑/↓/→/←/Enter/Espaço confirmados por leitura, sem
mudança de comportamento (já corretos desde a UI-ORG-1).

## 8. Busca e teclado

Confirmado (não alterado): o `onKeyDown` de navegação da árvore está só
nas linhas (`role="treeitem"`), nunca no `<input>` de busca — setas/espaço
no campo de busca já eram edição de texto normal do navegador, nunca
capturados pela árvore. Nenhuma mudança necessária.

## 9. Foco

- **Abertura do picker**: `OrganizationTree` ganhou `autoFocarBusca?: boolean`
  (novo, default `false` — Administração não usa); `OrganizationTeamPicker`
  sempre passa `autoFocarBusca` (o campo de busca recebe foco ao abrir o
  modal).
- **Fechamento devolve foco ao botão que abriu**: `ModalGrupoPlantao` ganhou
  duas refs (`botaoEquipeResponsavelRef`/`botaoEquipesConsultaRef`) e duas
  funções `fecharPicker*()` que fecham o modal e chamam `.focus()` no botão
  correspondente — usadas tanto por `onFechar` (cancelar) quanto por
  `onConfirmar` (após aplicar a escolha). Nenhuma biblioteca nova.
- **Seleção não perde foco**: nenhuma remontagem do item ao selecionar
  (só re-render com `checked`/`aria-*` atualizados), foco do DOM
  permanece no elemento.
- **Trap de foco**: o projeto não tinha nenhum padrão de focus-trap em
  modal antes desta fase (confirmado por busca no código) — nenhum foi
  adicionado, conforme instrução de não introduzir mecanismo novo.

## 10-11. Validação visual

**Nenhum navegador disponível neste ambiente — auditoria estática apenas,
declarado explicitamente (nunca apresentada como inspeção real).** A
correção de `chaveFocavelNaArvore()` e a adição de `aria-checked`/
`aria-multiselectable` foram verificadas por leitura de código + testes
puros (`lib/organizacao.test.ts`), não por DevTools.

## Ajustes visuais/copy confirmados em teste real (§ 17A)

- **A.** Removido o texto de desenvolvimento "Domínio paralelo à escala 6x1
  — nunca publica nesta fase" do cabeçalho da tela Plantões — substituído
  por um eyebrow de produto ("Escalas de sobreaviso"), no mesmo padrão de
  toda outra tela (`Visão geral`, `Importar`, `Usuários` etc. já têm
  eyebrow curto e descritivo). Duas outras strings com o mesmo problema
  ("nesta fase", referência de fase de desenvolvimento vazando pra UI)
  foram corrigidas por extensão, no mesmo espírito: a nota de "Prévia
  validada" (2 ocorrências) e a descrição do painel "Salvar como
  rascunho" — nenhuma mudança de comportamento, só de texto. Nenhuma
  proteção técnica contra publicação foi tocada; publicação continua
  inexistente.
- **B.** "Identificador" → "Identificador técnico" em `ModalGrupoPlantao`,
  com `<small>Usado internamente pelo sistema.</small>` (mais "Não pode ser
  alterado depois de criado." quando `modo === 'editar'`). Formato,
  validação, payload e Rules do campo `grupoId` inalterados.
- **C.** O campo "Ativo" deixou de ser um `<label className="checkbox-row
  admin-form-active">` solto (alinhado ao rodapé da célula ao lado de
  Timezone, sem rótulo próprio) e passou a ser um `label` comum de
  `.admin-form-grid` com o texto "Status" acima — mesmo padrão visual de
  todo campo vizinho (`Timezone`, `Nome`, etc.), com o checkbox+"Ativo"
  dentro. Nova classe `.admin-form-status-checkbox` só ajusta a altura
  mínima do `.checkbox-row` interno (40px, para bater com os inputs ao
  lado) — `.checkbox-row`/`.admin-form-active` continuam intocadas para
  os demais usos (`ModalUnidadeOrganizacional`, `ModalEquipe`,
  `ModalContatosParticipante`). Campo persistido (`form.ativo`) inalterado.
- **D. e F. (mesma causa raiz)** — investigado o sintoma relatado
  ("buscar 'soc' no picker mostra 'Nenhuma equipe cadastrada ainda'"):
  como a busca da árvore só destaca/expande (nunca filtra nós para fora —
  ver UI-ORG-1), esse texto só aparece quando a árvore está genuinamente
  vazia, então o sintoma real não era "busca sem resultado" e sim
  **`equipesAdmin`/`unidadesAdmin` nunca carregando** — porque o efeito de
  carregamento de Plantão usava `Promise.all` num array que inclui
  `listarGruposPlantao*()`: se essa chamada falhasse (ex.: Rules de
  Plantão ainda não deployadas em staging), o `Promise.all` inteiro
  rejeitava e `equipesAdmin`/`unidadesAdmin` nunca eram setados, mesmo que
  as leituras deles tivessem sucesso. **Corrigido**: trocado por
  `Promise.allSettled`, cada leitura resolve/rejeita independentemente;
  `equipesAdmin` tem seu próprio erro (`erroEquipesPlantao`), separado do
  erro de grupos (`erroPlantaoAdmin`). `OrganizationTree`/
  `OrganizationTeamPicker` ganharam `carregando`/`erro` (novos, opcionais)
  e agora distinguem 4 estados: carregando (`<LoaderCircle/> Carregando…`),
  erro (mensagem real, `role="alert"`, nunca mascarada como array vazio),
  vazio de verdade ("Nenhuma equipe cadastrada."), e busca sem
  correspondência (nova linha informativa "Nenhum resultado encontrado
  para "X"." acima da árvore, que continua toda visível — não filtra
  nós, só avisa). Nenhuma mudança de Firestore/Rules — o erro de
  permissão (Rules de Plantão não deployadas) continua existindo up
  stream; agora só fica visível e correto em vez de mascarado.
- **E.** Empty state da tela Plantões: ícone (`Radio`, já usado no
  cabeçalho da tela), título curto ("Nenhum grupo de Plantão ainda") e
  descrição — sem um segundo botão "Novo grupo" (o cabeçalho já tem um,
  sempre visível acima do empty state; duplicá-lo teria sido exatamente o
  "CTA visualmente pesado" que a fase pede pra evitar). Só aparece quando
  não há erro (`!erroPlantaoAdmin`) — nunca ao mesmo tempo que o alerta de
  erro.

## 12-13. Testes puros novos (sem DOM)

Duas funções puras extraídas de dentro dos componentes para
`lib/organizacao.ts`, ambas cobrindo exatamente o comportamento pedido
pela fase sem precisar de `@testing-library/react`:

- `chaveFocavelNaArvore(visiveis, chaveComFoco)` — 4 testes: mantém a
  chave em foco quando visível; cai para o primeiro item quando o alvo
  não está mais visível (o próprio bug corrigido); `null` cai pro
  primeiro item; lista vazia devolve `null` sem lançar.
- `alternarSelecaoMultipla(atuais, equipeId, equipeTravadaId?)` — 5
  testes: adiciona; remove (toggle); nunca remove a travada; sem trava
  informada, qualquer equipe é removível; imutabilidade (nunca muta o
  `Set` original).

Total: **9 testes novos** em `lib/organizacao.test.ts` (688→697).
`construirArvoreOrganizacional`/`buscarNaArvoreOrganizacional`/
`nosVisiveisNaArvoreOrganizacional` (UI-ORG-1) já cobriam expansão
calculada e busca com ancestrais preservados — nada novo necessário ali.

Nenhuma abstração artificial foi criada só para aumentar contagem — as
duas funções substituem lógica que já existia inline nos componentes
(extração, não invenção).

## Component tests — dívida técnica confirmada, não resolvida

Reconfirmado nesta fase: o repositório não tem `@testing-library/react`/
`@testing-library/user-event`/`jsdom`, e esta microfase **não os
adicionou** (instrução explícita, § 13 do prompt). Novo teste de fronteira
(`tests/ui-org-boundaries.test.mjs`, teste 12) trava essa decisão contra
reintrodução acidental futura sem uma decisão explícita equivalente.
Cobertura real hoje: toda a lógica pura que orienta o comportamento
(visibilidade, busca, foco roving, toggle de seleção múltipla, trava da
equipe responsável) está testada; interação real de DOM/evento de teclado/
clique continua sem nenhum teste automatizado.

## Verificação completa

```
npm run typecheck            OK
npm run typecheck:apps       OK
npm run typecheck:worker     OK
npm run lint                 OK (0 erros; 5 warnings pré-existentes,
                              arquivos não tocados nesta fase)
npm run test:unit            697 passed (era 688)
npm run test:boundaries      142 passed (era 140)
npm run test:firestore-rules 153 passed (inalterado — Rules não tocadas)
npm run build:dashboard      OK
npm run build:app:pages      OK
npm run build:apps           OK (bundle JS de apps/app inalterado: 993.11 kB)
npm run validate:pwa         OK
npm run validate:artifact    OK
git diff --check             sem problema de espaço em branco
```

## Auditoria de PII

`git diff` de todas as linhas adicionadas varrido por padrão de telefone
plausível e nomes: nenhum encontrado. Nenhuma fixture de pessoa nova.

## Estado final (git)

```
git diff --stat -- apps/app/                                              (vazio — diff zero)
git diff --stat -- firestore.rules firestore.indexes.json                 (vazio — diff zero)
git diff --stat -- lib/firebase/authRepository.ts                         (vazio — diff zero)
git diff --stat -- apps/push-worker/                                      (vazio — diff zero)
git diff --stat -- lib/firebase/plantaoReadRepository.ts lib/firebase/plantaoWriteRepository.ts   (vazio — diff zero)
git diff --stat -- packages/contrato/src/modeloPlantaoPersistente.ts      (vazio — diff zero)
```

Arquivos alterados: `app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`components/organizacao/OrganizationTree.tsx`,
`components/organizacao/OrganizationTeamPicker.tsx`, `lib/organizacao.ts`,
`lib/organizacao.test.ts`, `tests/ui-org-boundaries.test.mjs`. Nenhum
arquivo criado além deste checkpoint.

Commit único local (`fix(ui): fecha acessibilidade da arvore
organizacional`), sem `--amend`, sem rebase, sem merge. **NÃO houve push.
NÃO houve deploy. Firebase não foi alterado. Modelo organizacional
(`UnidadeOrganizacional`/`Equipe`) não foi alterado. Modelo de Plantão
(`GrupoPlantao`/payload persistido) não foi alterado. Produção não foi
tocada.**
