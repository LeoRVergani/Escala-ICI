# Checkpoint — Fase ESCALAS-UX-1C (facilidades de distribuição: "Usar período anterior" + distribuição rápida por clique)

Data: 2026-08-17. Escopo: reduzir o esforço de montar uma competência de
Plantão nova sem complicar o Editor — terceira forma de começar ("Usar
período anterior", `origem: 'COPIADO'`) e distribuição rápida por clique
(seleção de plantonista + toque no dia vazio). **Nenhuma publicação,
nenhum gerador automático, nenhuma rotação, nenhuma regra COSI/NOC
hardcoded, drag-and-drop deliberadamente não implementado.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD            86dd0bffb7c0f6b699d1da86e3f50d44b9ab3d0b
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 12]
```

Working tree limpo no precheck. Baseline confirmado antes de qualquer
edição: `test:unit` 817/817, `test:boundaries` 178/178,
`test:firestore-rules` 154/154, typechecks OK, lint 0 erros, builds OK.
`packages/contrato` isolado com os mesmos 3 erros pré-existentes fora de
escopo (`jornada.ts:260`, `detectorPlanilha.test.ts`,
`parserPlantao.test.ts` — confirmados inalterados, não corrigidos nesta
fase).

## 1. Arquivos criados

- `CHECKPOINT-FASE-ESCALAS-UX-1C-FACILIDADES-DISTRIBUICAO.md` (este
  arquivo).

Nenhum arquivo de código novo — toda a fase coube em extensões pontuais
de módulos já existentes, confirmando que nenhum segundo Editor/
pipeline foi necessário.

## 2. Arquivos alterados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`firestore.rules`, `lib/conciliacaoPlantoes.ts` (+ `.test.ts`),
`lib/editorPlantao.ts` (+ `.test.ts`),
`lib/montagemRascunhoPlantao.ts` (+ `.test.ts`),
`packages/contrato/src/modeloPlantaoPersistente.ts` (+ `.test.ts`),
`tests/firebase/firestore.rules.test.ts`,
`tests/plantao-editor-boundaries.test.mjs`.

## 3. "Usar período anterior" — terceira forma de começar

`ModalNovaEscala` ganhou um terceiro botão em "Como começar?", ao lado
de "Importar planilha"/"Criar escala vazia": "Usar período anterior".
Fica desabilitado (com `title` explicativo) quando a competência
EXATAMENTE anterior não tem rascunho persistido para o Grupo escolhido —
nunca "a mais recente disponível". `mudarGrupoNovoPlantao()` passou a
carregar `rascunhosPlantaoPorGrupo` (mesmo cache já usado pela tela
"Plantões") assim que o Grupo é selecionado, para o botão já nascer no
estado certo.

`usarPeriodoAnteriorAcao()` (novo, `apps/dashboard/src/DashboardApp.tsx`):
mesma checagem de duplicata de `criarPlantaoEmBrancoAcao()`
(`obterCompetenciaPlantaoRascunho`), depois lê a competência anterior
(`listarAtribuicoesPlantaoRascunho` + participantes ativos — leitura
pura, nunca grava nela), chama `copiarAtribuicoesParaNovaCompetencia()`
+ `vinculosDeCopiaAnterior()`, e alimenta exatamente o mesmo conjunto de
estado que `criarPlantaoEmBrancoAcao()`/`abrirRascunhoNoEditorAcao()` já
usam — o Editor que abre em seguida é o mesmo, com `origem: 'COPIADO'`.

## 4. Cálculo da competência anterior

`competenciaAnterior(competencia)` (`lib/montagemRascunhoPlantao.ts`) —
pura, determinística, nunca depende do relógio da máquina: decrementa
mês/ano reaproveitando a MESMA aritmética já usada em
`periodoDaCompetencia()` (nenhuma lógica de calendário duplicada).
`2026-09` → `2026-08`; `2026-01` → `2025-12` (rollover de ano);
competência malformada → `null`. Testado em
`lib/montagemRascunhoPlantao.test.ts` (4 casos, incluindo o rollover e
determinismo).

## 5. Qual competência copiar / anterior inexistente

A busca usa o cache já existente de `listarCompetenciasPlantaoRascunho()`
(ESCALAS-UX-1B.1) — nenhuma query nova no Firestore, nenhum índice novo
(`firestore.indexes.json` inalterado). Se a competência anterior não
tiver rascunho persistido, o botão fica desabilitado e, se acionado
mesmo assim, `usarPeriodoAnteriorAcao()` mostra "Não existe uma escala
anterior para este Plantão." — nunca cria uma escala vazia disfarçada.

## 6. Tradução de datas — offset + span, nunca "+31 dias"

`copiarAtribuicoesParaNovaCompetencia()` (`lib/montagemRascunhoPlantao.ts`):
para cada atribuição anterior, converte início/fim para civil
(`converterInstanteUtcParaMomento`), calcula `offsetInicio` (posição do
dia de início relativa ao começo da janela anterior — pode ser
negativo, dia de contexto) e `spanDias` (duração intrínseca em dias,
tipicamente 0-2). Aplica o MESMO offset ao início da janela nova e
recalcula o fim somando o mesmo `spanDias` — nunca recalcula a partir de
zero, nunca soma um número fixo de dias. Isso preserva a posição
relativa (1º dia da janela anterior → 1º dia da janela nova)
independente de quantos dias cada mês tem.

## 7. Competências de tamanhos diferentes (28/29/30/31 dias)

Quando o início traduzido cai fora de `[períodoNovoInício - 1 dia,
períodoNovoFim + 1 dia]` (mesma tolerância de "dia de contexto" de
`ehDiaDeContexto()`), a atribuição é EXCLUÍDA da cópia — nunca
deslocada para uma posição arbitrária, nunca truncada silenciosamente.
`quantidadeNaoCopiada` é retornada para a UI avisar o coordenador
(`usarPeriodoAnteriorAcao()` mostra a contagem na mensagem de sucesso
quando `> 0`). Testado com um cenário deliberado de 31 dias → 28 dias:
uma atribuição com offset 30 corretamente excluída
(`quantidadeNaoCopiada: 1`), uma com offset 0 corretamente copiada.

## 8. Horário civil e durações atípicas (43h/5h)

`hora` nunca é alterado — só a data muda. `duracaoMinutos` é copiado
verbatim do registro persistido (nunca recalculado a partir das datas
traduzidas), então uma duração atípica sobrevive exatamente igual.
Testado com um caso de fronteira de 43h (span de 1 dia com hora de fim
19:00) confirmando início/fim traduzidos e duração inalterada.

## 9. Participante inativo/desconhecido

`vinculosDeCopiaAnterior()` (`lib/conciliacaoPlantoes.ts`) reaproveita o
MESMO mecanismo de vínculo pendente/sugestão já usado para `IMPORTADO`:
login ainda ativo → `VINCULADO` automático; login conhecido mas não mais
participante ativo → `PENDENTE` com uma `sugestao` apontando para o
próprio login (um clique na aba Vínculos reconfirma e reativa via
`confirmarVinculoPlantao()`/`montarParticipantesPlantaoParaSalvar()`,
já existente, sem UI nova); login desconhecido →
`USUARIO_NAO_ENCONTRADO`. Nunca troca automaticamente por outra pessoa —
"Salvar rascunho" continua bloqueado por pendências.

## 10. Origem usada e justificativa

`OrigemPlantao` ganhou `'COPIADO'` (`packages/contrato/src/modeloPlantaoPersistente.ts`),
já reservado desde a ESCALAS-UX-1B em `docs/spec/EDITOR_ESCALAS.md` § 7.
Diferente das fases anteriores desta série, que mantiveram
`firestore.rules` com diff zero, esta fase precisou adicionar
`'COPIADO'` à lista de origens aceitas em 4 ocorrências de `origem in
[...]` (mesmo bloco `rascunhosCompetenciasPlantao/{id}` de sempre).
Avaliada como mudança mecânica e NÃO significativa: simétrica ao padrão
já usado para os 3 valores anteriores, nenhuma condição de autorização
nova, nenhum campo/coleção nova. Verificada empiricamente no emulador —
`test:firestore-rules` 154/154 preservados + 1 teste novo (`origem
COPIADO é aceita... para o gestor autorizado`) = 155/155.

## 11. Working copy independente / competência anterior nunca alterada

`criarAtribuicaoEditavelDeCompetenciaAnterior()` gera `idLocal =
"copiado-N"` (nunca reaproveita `"importado-"`/`"rehidratado-"`) e
constrói um objeto NOVO a cada chamada — nunca reaproveita
referência da atribuição persistida anterior. `usarPeriodoAnteriorAcao()`
só LÊ a competência anterior (`listarAtribuicoesPlantaoRascunho`, leitura
pura) — nunca a reidrata como working copy, nunca grava nela. Testado:
`copiarAtribuicoesParaNovaCompetencia()` não muta o array de entrada
`atribuicoesAnteriores` (teste dedicado). "Salvar rascunho"
(`salvarRascunhoPlantaoAcao()`) grava sempre na competência NOVA
(`idCompetenciaPlantao(grupo.grupoId, competencia)`, onde `competencia`
vem do estado `competenciaRascunho`) — nunca referencia a competência
anterior em nenhum ponto (confirmado por boundary test estático,
§ "12. Testes" abaixo, teste 32).

## 12. Distribuição rápida por clique

Painel "Resumo por pessoa" (já existente) ganhou um botão semântico por
pessoa (`aria-pressed`, classe `.plantao-pessoa-selecionar`/`.selecionado`)
— seleção puramente de UI (`plantonistaSelecionadoPlantao`, estado do
Dashboard, nunca grava no Firestore/Grupo), reiniciada em TODA entrada
nova no Editor (`interpretarPlantao`, `criarPlantaoEmBrancoAcao`,
`abrirRascunhoNoEditorAcao`, `usarPeriodoAnteriorAcao`). Com uma pessoa
selecionada, tocar um dia vazio (`abrirCriacaoAtribuicaoPlantao`) abre o
MESMO modal de criação já com "Plantonista" preenchido — início/fim
continuam SEMPRE vazios (nunca um horário inventado); sem seleção, o
comportamento é idêntico ao de antes desta fase. Um banner
"Adicionando plantões para X" com ação "cancelar seleção" aparece acima
do calendário quando há seleção ativa.

## 13. Contadores ao vivo / "dias sem atribuição"

Inalterados nesta fase — `resumirPorPessoa()`/`conferirEscalaAtualPlantao()`
já recalculavam a partir da working copy a cada renderização; a seleção
de plantonista não interfere nesse cálculo (é um estado separado, só de
UI). Nenhuma linguagem de "escala injusta"/"falha de cobertura" foi
introduzida — os números continuam neutros ("N plantões · Xh").

## 14. Drag-and-drop — deliberadamente NÃO implementado

Avaliado e descartado por três razões concretas: (a) nenhum precedente
de arrastar-elemento existe no código (o único `onDrop`/`draggable` é o
dropzone de upload de planilha, um caso não relacionado); (b) nenhuma
biblioteca de drag (`dnd-kit`/`react-dnd`) está instalada; (c) a
alternativa nativa HTML5 introduziria um padrão de interação novo sem
nenhum equivalente acessível-por-teclado já estabelecido no projeto para
copiar — risco real de acessibilidade, não uma preferência estética.
**Distribuição por clique está completa. Drag-and-drop continua
melhoria opcional futura.** Confirmado por teste (boundary test 30):
`onDragStart`/`onDragOver`/`draggable={true}` ausentes de todos os
arquivos do Editor; o painel de seleção continua um botão clicável.

"Repetir último horário" (§ 22 do pedido original) também foi avaliado e
não implementado — mesmo critério de simplicidade: o ganho é pequeno
frente ao risco de criar uma segunda forma de preencher horário que o
coordenador precisaria aprender.

## 15. Mesmo Editor para as quatro origens/portas de entrada

`IMPORTADO`, `MANUAL`, `COPIADO` e "reabrir um rascunho existente" (de
qualquer origem) terminam todos no mesmo `AtribuicaoPlantaoEditavel[]` →
mesmo `PlantaoCalendario` → mesmo `ModalEditarAtribuicaoPlantao` → mesma
Lista → mesma Contabilidade → mesmo "Salvar rascunho". Confirmado por
boundary test (teste 26): exatamente UMA definição de
`AtribuicaoPlantaoEditavel`, UM `PlantaoCalendario`, UM
`ModalEditarAtribuicaoPlantao`, UMA `copiarAtribuicoesParaNovaCompetencia`,
UMA `criarAtribuicaoEditavelDeCompetenciaAnterior` — nenhum
Editor/tipo próprio para "Usar período anterior".

## 16. Testes

- `packages/contrato/test/modeloPlantaoPersistente.test.ts`: 55/55 —
  `'COPIADO'` incluído no teste de origem válida.
- `lib/editorPlantao.test.ts`: 41/41 (39 + 2 novos) —
  `criarAtribuicaoEditavelDeCompetenciaAnterior`.
- `lib/conciliacaoPlantoes.test.ts`: 35/35 (30 + 5 novos) —
  `vinculosDeCopiaAnterior` (ativo/inativo/desconhecido/dedup/bloqueio
  de "Salvar rascunho").
- `lib/montagemRascunhoPlantao.test.ts`: 72/72 (54 + 18 novos) —
  `competenciaAnterior` (4) e `copiarAtribuicoesParaNovaCompetencia`
  (~18: identidade da working copy, preservação de nome/horário/data/
  duração incluindo o caso de 43h, não-mutação da entrada, entrada
  vazia, participante inativo, competências de tamanhos diferentes,
  não-rotação, `origem: 'COPIADO'` via `montarCompetenciaPlantaoRascunho`).
- `tests/firebase/firestore.rules.test.ts`: 155/155 (154 + 1 novo) —
  `origem: 'COPIADO'` aceita para o gestor autorizado.
- `tests/plantao-editor-boundaries.test.mjs`: 32/32 (25 + 7 novos,
  testes 26-32) — unificação de Editor, ausência de gerador/rotação,
  distribuição rápida nunca inventa horário, seleção puramente de UI,
  drag-and-drop ausente, competência anterior nunca escrita, "Salvar
  rascunho" sempre grava na competência nova.
- `test:unit` total: 842/842 (baseline 817 + 25 novos).
- `test:boundaries` total: 185/185 (baseline 178 + 7 novos).

## 17. Validação completa

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros, só os 6 warnings pré-existentes já
conhecidos em arquivos de teste não relacionados),
`build:dashboard`, `build:app:pages`, `build` (artefato Cloudflare
raiz), `validate:pwa`, `validate:artifact`, `git diff --check` — todos
OK. `packages/contrato` isolado confirma os mesmos 3 erros pré-existentes
inalterados.

## 18. Limitações registradas (não resolvidas nesta fase)

- Risco de timezone do Grupo mudar depois de um rascunho salvo (já
  registrado desde a ESCALAS-UX-1B.1) — inalterado.
- "Conferência da fonte" não reconstruível para um rascunho `IMPORTADO`
  reaberto (já registrado) — `COPIADO` nunca teve uma "fonte XLS" para
  começar, então não é afetado por essa limitação.
- Drag-and-drop e "repetir último horário" — deliberadamente adiados
  (§ 14 acima), não uma omissão.
- Nenhuma indicação visual persistente de "esta escala foi baseada na
  competência anterior 2026-08" além da mensagem de sucesso mostrada no
  momento da criação — o `origem: 'COPIADO'` já existe no modelo
  persistido para uma fase futura decidir se quer expor isso de forma
  mais visível (ex.: um rótulo na tela "Plantões"); fora de escopo desta
  fase adicionar UI nova para isso.

## 19. O que esta fase explicitamente NÃO faz

Ver `docs/spec/PLANTOES.md` § 27.5 para a lista completa (publicação,
gerador/rotação/autocomplete, regra COSI/NOC, drag-and-drop, "repetir
último horário", customização de cor/modo de calendário, mudança na
escala 6x1/árvore organizacional).
