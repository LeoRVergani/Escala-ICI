# Checkpoint — Fase ESCALAS-UX-2A.1 (contexto ativo de escala + seletores reais no header)

Data: 2026-08-17. Escopo: segunda fase de implementação do redesign
definido em `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` — introduzir o
modelo central `ContextoEscalaAtivo` e os controles reais de "Escala
atual"/"Competência"/"Status" no header, substituindo a string estática
anterior. **Escopo reduzido em relação ao § 36 original**: não incluiu o
redesign do `NewScheduleDialog` nem "Criar vazia"/"Usar anterior" para
Jornada 6x1 — o pedido que autorizou esta fase explicitamente cortou
esse pedaço, deixando-o como follow-up. **Workspace final, roster
lateral, drag-and-drop, padrão semanal de Plantão, nova Contabilidade/
Lista, Pendências em drawer, importação inline, publicação e qualquer
mudança de schema Firestore continuam fora de escopo.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git rev-parse --show-toplevel /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git status --short            ?? apps/dashboard/.sites-runtime/
                               ?? packages/contrato/.sites-runtime/
git rev-parse HEAD            8cec97054746e72b5a110f4b10e0bdfc6d4f74e9
git rev-parse origin/main     0c119e17f67ebf012d0b9fde398ac6199162190e
```

Working tree limpo no precheck, exceto os diretórios de cache de build
não rastreados `.sites-runtime/` (não commitados, não removidos, sem
regra nova de `.gitignore`). Nenhum outro arquivo inesperado. Baseline
de testes confirmado: `test:unit` 850/850, `test:boundaries` 199/199,
`test:firestore-rules` 155/155.

## 1. Método

Leitura obrigatória das fontes de verdade + checkpoints listados no
pedido, seguida de um mapeamento factual exaustivo (via agente de
exploração, read-only) do estado atual de Jornada/Plantão em
`DashboardApp.tsx` — especificamente: ausência de qualquer `equipeId`/
competência selecionável para Jornada hoje (sempre implícito ao usuário
logado, competência sempre o literal `'2026-08'`), ausência de dirty
state para Jornada (Plantão já tinha), listas de autorização existentes
(`equipesPermitidasEfetivas`, `gruposPlantaoAdmin`/`podeAcessarPlantoes`/
`podeGerenciarEsteGrupoPlantao`), o padrão de menu já usado pelo "Menu
da conta" (`AppFrame.tsx`) para reaproveitar como base visual, e o
padrão de modal de confirmação já existente ("Descartar rascunho?").

## 2. Modelo `ContextoEscalaAtivo`

`lib/contextoEscala.ts` (novo, puro — sem React/Firebase):

```ts
export type ContextoEscalaAtivo =
  | { tipo: 'JORNADA'; equipeId: string; competencia: string }
  | { tipo: 'PLANTAO'; grupoId: string; competencia: string };
```

Helpers puros: `contextoEhJornada()`, `contextoEhPlantao()` (type
guards), `chaveContextoEscala()` (identidade estável, sempre por ID —
nunca nome/sigla/UID/cargo), `contextosEscalaIguais()`. Nenhuma
persistência nesta fase — estado de sessão React apenas
(`useState<ContextoEscalaAtivo | null>` em `DashboardApp.tsx`).

## 3. Contextos de Jornada — como são descobertos

`minhasEquipesPermitidas` (`equipesPermitidasEfetivas(usuarioReal)`, já
existente) fornece os `equipeId` acessíveis; `equipesAdmin` (`Equipe[]`,
já existente, agora carregado mais cedo — ver § 6) resolve `equipeId` →
nome para o rótulo. Nenhum hardcode de sigla — confirmado por teste
(`lib/contextoEscala.test.ts`, caso 10, roda com siglas arbitrárias
incluindo uma inventada). O modelo funciona para qualquer quantidade de
equipes permitidas, de 0 a N.

## 4. Contextos de Plantão — como são descobertos

`gruposPlantaoAdmin` (`GrupoPlantao[]`, já existente — inclui grupos
administrados E grupos só consultados via `equipesConsulta`, confirmado
por auditoria da função `listarGruposPlantaoPermitidos()`) fornece os
`grupoId` acessíveis; `equipesAdmin` resolve `equipeResponsavelId` →
nome para o rótulo secundário. Gate de "quem vê Plantão no seletor"
continua sendo `podeAcessarPlantoes` (`souGestorDePlantao()`, EXATAMENTE
o mesmo já usado pela antiga tela "Plantões") — nenhuma ampliação de
autorização; Rules continuam sendo a fonte de verdade do que cada
leitura de fato retorna.

## 5. Confirmação de zero hardcode SOC/NOC/COSI

`ContextoEscalaAtivo`/`ScheduleContextSwitcher` nunca referenciam sigla
nenhuma — os rótulos vêm sempre de `equipesAdmin`/`gruposPlantaoAdmin`
(dados reais). Testado (`lib/contextoEscala.test.ts` caso 10) e
verificado por boundary test estático.

## 6. `equipesAdmin`/`gruposPlantaoAdmin` — carregamento eager

Ambos hoje só carregavam de forma preguiçosa (ao visitar "Plantões"/
"Administração"/abrir "+ Nova escala"). Como o cluster de contexto
aparece em TODA tela (header global), dois ajustes:

- O efeito que carrega `gruposPlantaoAdmin` deixou de exigir
  `tela === 'plantoes' || tipoArquivoDetectado === 'PLANTAO' || novaEscalaEtapa !== null`
  — agora dispara sempre que `podeAcessarPlantoes` (mesmo gate de
  autorização de sempre, só sem esperar uma tela específica).
- Um novo efeito dedicado carrega `equipesAdmin` sozinho (só se ainda
  vazio) para quem NÃO é gestor de Plantão também poder ver o rótulo da
  própria Jornada — `equipes` é coleção de leitura franqueada a
  qualquer autenticado (já documentado em
  `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`), então isso não amplia
  nenhuma autorização, só evita esperar por uma tela específica. Modo
  demo (sem Firestore) semeia `equipesAdmin` com `EQUIPE_DEMO` (a mesma
  constante fixa já usada pelo resto do laboratório local) diretamente
  em `autenticar()`, nunca dentro de um efeito.

## 7. Comportamento sem contexto

Antes de qualquer seleção, `contextoEscalaAtivo` é `null` — o gatilho
do seletor mostra "Selecionar escala" (nunca SOC hardcoded, nunca o
primeiro item escolhido arbitrariamente).

## 8. Contexto inicial a partir do trabalho atual

Sincronizado por chamada EXPLÍCITA (nunca por `useEffect` reativo — ver
§ 12 sobre por que essa abordagem foi descartada) nos pontos onde
evidência inequívoca já existe: `carregarDadosDaEquipe()` (login/troca
de simulação), o carregamento demo (`carregarEscalaDemonstracao()`),
`interpretar()` (importação de XLS de Jornada), `criarPlantaoEmBrancoAcao()`,
`usarPeriodoAnteriorAcao()`, `abrirRascunhoNoEditorAcao()`, e o
`<select>` de Grupo do formulário "salvar rascunho de Plantão importado".
Cobertura parcial documentada como limitação conhecida — ver § 22.

## 9. Seletor "Escala atual"

`components/escalas/ScheduleContextSwitcher.tsx` — mesmo padrão de
gatilho+popover já usado pelo "Menu da conta" (`useState` + click-outside/
Escape própria, nunca uma biblioteca nova). Agrupa "Jornadas"/"Plantões"
(rótulo `<p>` de grupo, omitido quando vazio). Busca só aparece quando o
total de opções passa de 8. Foco devolvido ao gatilho ao fechar
(clique fora, Escape, ou seleção).

## 10. Competência dinâmica

`components/escalas/ScheduleCompetenceControl.tsx` — rótulo amigável via
`formatarCompetencia()` (já existente, `@escala-ici/contrato` —
reaproveitado, nunca duplicado); período 26→25 exibido abaixo via
`formatarData()` (mesmo padrão já usado em `ModalNovaEscala`). Seleção
real via `<input type="month">` nativo dentro de um popover (mesmo
padrão de gatilho+popover do switcher) — trigger sempre mostra o
rótulo formatado em pt-BR (o texto interno de um `<input type="month">`
segue o locale do navegador/SO, não garantidamente pt-BR; limitação
documentada, aceita por ser um controle nativo real e acessível).

## 11. Confirmação de remoção da string fixa

`competencia="Agosto 2026"` (`DashboardApp.tsx`, prop do `AppFrame`) foi
removida — confirmado por boundary test
(`tests/dashboard-contexto-escala-boundaries.test.mjs`, teste 1). A
prop `competencia` (mantida por compatibilidade com `apps/app`, que a
usa para seu próprio propósito, zero diff lá) agora recebe um valor
dinâmico derivado do contexto real (`formatarCompetencia(contextoEscalaAtivo.competencia)`
ou "Nenhuma escala selecionada"). O conteúdo visual real vem do novo
slot opcional `contextoEscala?: ReactNode` de `AppFrame` — quando
ausente (uso de `apps/app`), cai no `.competence-control` estático de
sempre, zero mudança de comportamento lá.

## 12. Período 26→25

Reaproveitado de `periodoDaCompetencia()` (`lib/montagemRascunhoPlantao.ts`,
já existente desde ESCALAS-UX-1A) para os dois tipos de escala — nenhum
cálculo duplicado, confirmado por boundary test.

## 13. Comportamento competência existente / inexistente

`aplicarTrocaContexto()`/`aplicarTrocaCompetencia()`: para Plantão,
consulta `obterCompetenciaPlantaoRascunho()` (já existente); se existir,
reaproveita INTEGRALMENTE `abrirRascunhoNoEditorAcao()` (nenhum segundo
caminho de reidratação). Para Jornada, consulta `carregarEscalasEquipe()`
(já existente, agora parametrizada pela competência do alvo em vez do
literal fixo de sempre) com `somentePublicadas=false` (rascunho ou
publicada, mesma semântica do lado Plantão). Quando NÃO existe nada:
`contextoSemEscala` vira `true`, o contexto/competência são atualizados
mesmo assim (para o header refletir o que foi selecionado), navega para
"Escalas", que mostra "Nenhuma escala criada para {competência}" com a
mesma ação "+ Nova escala" de sempre — **nunca cria nada
automaticamente**. Confirmado por boundary tests dedicados (§ 50 do
pedido).

## 14. Status

`components/escalas/ScheduleStatusBadge.tsx` — reaproveita
`.status-badge` (variantes `success`/`warning`/`neutral` já existentes,
nenhuma classe nova). Três estados: `rascunho` (warning), `publicada`
(success, só para Jornada — reflete o cálculo já existente
`publicados.length === documentos.length`, nunca uma funcionalidade
nova), `sem-escala` (neutral). Plantão nunca mostra "Publicada" nesta
fase (PLANTÃO-3C não existe). Nunca vira controle editável — só texto
visível (nunca só cor).

## 15. Troca Jornada → Plantão / Plantão → Jornada

`solicitarTrocaContexto()` é o único ponto de entrada — verifica
`contextosEscalaIguais()` (no-op se igual), depois a guarda de
alterações não salvas (§ 16), depois `aplicarTrocaContexto()`. Trocar
NUNCA "apaga" a outra escala — o estado da Jornada (`resultado`) e o
estado do Plantão (`atribuicoesEditaveisPlantao`/`grupoRascunhoEscolhido`/
etc.) são blocos de estado React INDEPENDENTES; só o que muda é
`contextoEscalaAtivo` + qual bloco o header/telas usam para decidir o
que mostrar. Ver § 22 sobre a decisão de NÃO cachear múltiplas working
copies (deliberado, não uma limitação).

## 16. Contexto preservado fora de "Escalas"

O cluster de contexto (`contextoEscala` prop de `AppFrame`) é renderizado
uma única vez, fora do corpo condicional de cada `tela`, então aparece
em QUALQUER tela (Visão geral, Trocas, Usuários, Administração) sem
nenhuma duplicação de header. `contextoEscalaAtivo` nunca é limpo ao
navegar entre telas — só no logout (`encerrarSessao()`).

## 17. Comportamento em Administração

Entrar em "Administração" (Organização OU Grupos de Plantão) nunca
chama `solicitarTrocaContexto()`/`aplicarTrocaContexto()` — a navegação
para essas telas é feita via `setTela(...)` puro, sem tocar em
`contextoEscalaAtivo`. Confirmado por leitura direta: nenhuma chamada
dessas funções existe dentro dos blocos `tela === 'administracao'`/
`tela === 'plantoes'`.

## 18. Dirty guard — Plantão

Reaproveita `plantaoEditadoDesdeImportacao` (já existente desde a
ESCALAS-UX-1A) — nenhuma mudança na lógica que o define, só uma nova
LEITURA em `existeAlteracaoNaoSalvaNoContextoAtivo()`.

## 19. Dirty guard — Jornada

**Não existia.** Auditoria confirmou: `editarCelula()` sempre gravou
direto em `resultado` sem nenhum sinal de "alterado, ainda não salvo".
Esta fase adicionou o equivalente mínimo — `jornadaEditadaDesdeCarregamento`
(novo estado), setado `true` no ÚNICO ponto de edição local
(`editarCelula()`) e resetado `false` em TODO outro ponto que substitui
`resultado` por um valor confiavelmente sincronizado com a fonte
(carregamento, importação, conciliação, salvar, publicar, descartar,
restaurar revisão, logout) — nunca nos pontos que só acrescentam/removem
um membro (`adicionarMembroRascunho`/`excluirRascunho`, já persistidos
imediatamente no Firestore, deliberadamente NÃO tratados como "reset de
dirty" porque não invalidam uma edição de célula pendente em outro
lugar da grade). Confirmado por boundary test que garante exatamente UM
ponto de `setJornadaEditadaDesdeCarregamento(true)` em todo o arquivo.

## 20. Cancelar / confirmar a troca

`cancelarTrocaEscalaPendente()` só limpa a intenção pendente — nenhuma
outra chamada de estado (confirmado por boundary test: a função não tem
NENHUM outro `setState` além de `setIntencaoTrocaEscalaPendente(null)`).
`confirmarDescarteETrocarEscala()` só executa a troca de fato DEPOIS da
confirmação explícita do usuário no `UnsavedChangesDialog` — nunca antes,
nunca "atrás do modal".

## 21. Componentes criados

- `lib/contextoEscala.ts` (+ `.test.ts`, 12 testes).
- `components/escalas/ScheduleContextSwitcher.tsx`.
- `components/escalas/ScheduleCompetenceControl.tsx`.
- `components/escalas/ScheduleStatusBadge.tsx`.
- `components/escalas/UnsavedChangesDialog.tsx`.

Nenhum importa Firebase diretamente (confirmado por boundary test).
`components/AppFrame.tsx` ganhou o slot opcional `contextoEscala?: ReactNode`
— continua sem importar nenhum tipo de domínio de Plantão/Jornada/Equipe.

## 22. Funções puras / decisões de design registradas

- `contextoEhJornada()`/`contextoEhPlantao()`/`chaveContextoEscala()`/
  `contextosEscalaIguais()` (`lib/contextoEscala.ts`).
- `rotuloCompetencia()` **não foi criado** — `formatarCompetencia()`
  (já existente em `@escala-ici/contrato`) já faz exatamente isso;
  criar um segundo helper seria duplicação (§ 44 do pedido: "não criar
  helpers redundantes").
- **Sincronização por chamada direta, não por `useEffect` reativo**:
  a primeira versão desta fase usava dois `useEffect` observando
  `grupoRascunhoEscolhido`/`competenciaRascunho`/`origemPlantaoAtual`
  (Plantão) e `resultado`/`usuarioEfetivo` (Jornada) para sincronizar
  `contextoEscalaAtivo` reativamente. O lint do projeto
  (`react-hooks/set-state-in-effect`) rejeitou esse padrão como erro
  real (setState síncrono dentro do corpo de um efeito, sem
  assinatura/callback assíncrono) — corrigido movendo a sincronização
  para chamadas EXPLÍCITAS exatamente nos pontos onde
  Grupo+competência/Jornada+equipe passam a existir (§ 8). Mais
  verboso (7 pontos de chamada em vez de 2 efeitos), mas correto
  segundo as regras do projeto e mais fácil de rastrear ("por que o
  contexto mudou" tem uma resposta em cada call site, não uma
  reação implícita).
- **`workingCopies` indexadas por contexto — deliberadamente NÃO
  implementado** (§ 28 do pedido): trocar de contexto com alterações
  não salvas exige decisão consciente (salvar ou descartar), nunca um
  cache oculto preservando tudo em memória. Mantém o modelo de estado
  simples — um único bloco de estado por domínio (Jornada/Plantão),
  nunca N blocos por contexto visitado.
- **Cobertura parcial da sincronização de contexto inicial para
  Jornada** (limitação registrada, não uma omissão silenciosa): dois
  caminhos secundários (reparse pós-cadastro de usuários faltantes,
  restauração de revisão) não recebem sincronização explícita de
  `contextoEscalaAtivo` — nesses casos o header pode continuar
  mostrando o contexto anterior por mais um instante até a próxima
  ação de contexto real. Nunca causa perda de dado ou abertura da
  escala errada — só um atraso cosmético na atualização do rótulo do
  header nesses dois fluxos secundários.

## 23. Comportamento mobile

Sem breakpoint dedicado novo nesta fase — os três controles (`escala-context-switcher`/
`escala-competencia-control`/`escala-status-control`) usam `flex`/`min-width: 0`/
`max-width` para caber junto do restante do header responsivo já
existente. Auditoria estática (sem navegador neste ambiente) confirma
que os popovers usam `width: min(Npx, calc(100vw - 28px))`, mesmo
padrão já usado por `.account-popover` — nunca ultrapassam a viewport
em telas estreitas. Validação REAL em 412/390/360 fica para o usuário
(consistente com a preferência já registrada).

## 24. Acessibilidade

Seletor de contexto: `<button aria-haspopup="menu" aria-expanded>`, item
ativo com `aria-current="true"`, Escape fecha e devolve foco ao
gatilho, clique fora fecha. Competência: `<label>` real associado ao
`<input type="month">`, foco visível herdado do estilo padrão. Status:
texto sempre visível (nunca só cor). Modal de alterações não salvas:
`role="dialog"` + `aria-modal` + `aria-labelledby` (mesmo padrão de
todos os outros modais do Dashboard), Escape aciona "Continuar editando"
(nunca confirma o descarte), ação destrutiva com classe
`danger-button` já estabelecida.

## 25. Testes

- `lib/contextoEscala.test.ts`: 12/12 (10 exigidos pelo § 45 + 2 casos
  extras de borda — `null`/`null`).
- `tests/dashboard-contexto-escala-boundaries.test.mjs`: 20/20 — cobre
  header (§ 48), guarda de alterações não salvas (§ 47), integração com
  o pipeline já existente de Plantão (§ 49), competência ausente nunca
  cria automaticamente (§ 50), status (§ 51), e confirmação de escopo
  (roster/drag/padrão de horário/importação inline continuam fora).
- `test:unit` total: 862/862 (baseline 850 + 12 novos).
- `test:boundaries` total: 219/219 (baseline 199 + 20 novos; um teste
  pré-existente de ESCALAS-UX-2A adaptado — ver § 26 — nenhum removido).
- `test:firestore-rules`: 155/155, inalterado.

## 26. Ajuste em teste pré-existente

`tests/dashboard-navegacao-boundaries.test.mjs`, teste 10 — a fase
ESCALAS-UX-2A original proibia `ContextoEscalaAtivo`/
`ScheduleContextSwitcher` (corretos NA ÉPOCA, já que aquela fase
explicitamente não os implementava). Esta fase os implementa como
planejado; o teste foi ajustado para continuar protegendo o que ainda é
fora de escopo de QUALQUER fase concluída até agora (`ScheduleWorkspace`,
o workspace final único) — nenhuma asserção foi removida, só adaptada à
mudança de escopo autorizada.

## 27. Validação completa

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros — corrigidos 3 erros reais de
`react-hooks/set-state-in-effect` durante o desenvolvimento, ver § 22;
só os 6 warnings pré-existentes já conhecidos permanecem),
`build:dashboard`, `build:app:pages`, `build:apps`, `validate:pwa`,
`validate:artifact`, `git diff --check` — todos OK. `packages/contrato`
isolado confirma os mesmos 3 erros pré-existentes inalterados.

## 28. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.rules`, `firestore.indexes.json`,
`lib/editorPlantao.ts`, `lib/montagemRascunhoPlantao.ts`,
`components/plantao/`, `packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/firebase/authRepository.ts`, `apps/app/`, `apps/push-worker/`,
`components/organizacao/`, `components/ScheduleGrid.tsx` — **vazio**,
confirmando zero mudança funcional em Plantão (`IMPORTADO`/`MANUAL`/
`COPIADO` inalterados), 6x1, Auth, App, Push, Organização, schema e
Rules.

## 29. Validação visual

Nenhum navegador disponível neste ambiente — auditoria estática (leitura
direta do JSX/CSS resultante + sucesso de build/typecheck, que já
garante JSX válido e CSS sem erro de sintaxe) foi a validação realizada,
consistente com a preferência já registrada de que o usuário testa
mudanças de UI diretamente.

## 30. Git

Commit local único, mensagem sugerida
`feat(ux): adiciona contexto ativo de escala`. Nenhum push, deploy,
merge, rebase, amend, reset ou stash. Diretórios `.sites-runtime/` não
rastreados permanecem intocados.

## 31. Próximos passos (não iniciados)

Esta fase **para aqui** — `PLANTAO-PADRAO-1`, `ESCALAS-UX-2B` e
`PLANTÃO-3C` aguardam decisão e autorização explícitas em uma fase
futura própria. O redesign do `NewScheduleDialog`/"Criar vazia"/"Usar
anterior" para Jornada 6x1 (parte do § 36 original da ESCALAS-UX-2A.1
que ficou de fora do escopo real desta execução) também permanece como
follow-up a ser nomeado.
