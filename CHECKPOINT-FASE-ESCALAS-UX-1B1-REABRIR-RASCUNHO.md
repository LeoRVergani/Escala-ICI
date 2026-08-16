# Checkpoint — Fase ESCALAS-UX-1B.1 (reabrir rascunho de Plantão no mesmo Editor)

Data: 2026-08-16. Escopo: fechar o ciclo básico do Editor de Plantão —
criar/importar → editar → salvar → fechar → **reabrir** → continuar
editando → salvar de novo — resolvendo o round-trip UTC↔civil que a
ESCALAS-UX-1B tinha registrado como faltante. **Nenhuma publicação,
nenhuma mudança de Firestore Rules/schema persistente/6x1/árvore
organizacional.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD            b26d2eae0cd7188ece3ff174e6ff55396851e4de
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 11]
```

Working tree limpo no precheck. Baseline confirmado antes de qualquer
edição: `test:unit` 784/784, `test:boundaries` 172/172,
`test:firestore-rules` 153/153, typechecks OK, lint 0 erros, builds OK.
`packages/contrato` isolado com os mesmos 3 erros pré-existentes fora de
escopo (não corrigidos nesta fase).

## 1. Causa da impossibilidade anterior de reabrir

A ESCALAS-UX-1B registrou explicitamente (checkpoint próprio, seção "O
que NÃO foi feito"): "Abrir rascunho existente" não reabria o rascunho
dentro do calendário porque faltava a conversão inversa de instante UTC
persistido para momento civil — `converterMomentoParaInstanteUtc()` só
ia num sentido — mais uma reconciliação de IDs para a idempotência do
resave continuar valendo. Auditoria desta fase confirmou DOIS problemas
adicionais, não previstos no registro anterior:

- **Leitura bloqueada para GESTOR_EQUIPE**: a Rule de
  `rascunhosCompetenciasPlantao/{id}/atribuicoes/{atribuicaoId}` depende
  de `resource.data.grupoId` (campo do documento, não variável de path)
  — um `list` sem `where` correspondente falha no emulador com
  "Property grupoId is undefined on object" para qualquer perfil além
  de ADMIN_SISTEMA (achado original da PLANTÃO-3A, nunca antes
  bloqueante porque nenhum fluxo chamava essa função). Reabrir rascunho
  é justamente o fluxo que precisa dela, e quem reabre é quase sempre um
  GESTOR_EQUIPE.
- **Documentos órfãos**: `salvarAtribuicoesPlantaoRascunho()` sempre foi
  só upsert — nunca removeu um documento cujo `atribuicaoId` (posicional,
  `idAtribuicaoPlantao(indice)`) deixou de existir na lista nova. Sem
  reabertura, esse caminho nunca era exercitado; com reabertura, excluir
  uma atribuição no meio da lista e salvar de novo reindexaria as
  restantes e deixaria o documento de ID mais alto órfão no Firestore.

## 2. Arquivos criados

Nenhum. Toda a fase coube em extensões pontuais de módulos já
existentes — confirma que nenhum segundo Editor/pipeline foi necessário.

Criado apenas: `CHECKPOINT-FASE-ESCALAS-UX-1B1-REABRIR-RASCUNHO.md`.

## 3. Arquivos alterados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`lib/editorPlantao.ts`, `lib/firebase/plantaoReadRepository.ts` (+
`.test.ts`), `lib/firebase/plantaoWriteRepository.ts` (+ `.test.ts`),
`lib/montagemRascunhoPlantao.ts` (+ `.test.ts`),
`packages/contrato/src/modeloPlantaoPersistente.ts` (+ `.test.ts`),
`tests/firebase/firestore.rules.test.ts`,
`tests/plantao-editor-boundaries.test.mjs`.

## 4. Função UTC → civil

`converterInstanteUtcParaMomento(instanteUtc, timezone)` (nova,
`packages/contrato/src/modeloPlantaoPersistente.ts`) — inverso exato de
`converterMomentoParaInstanteUtc()`. Formata o `Date` (um instante já
inequívoco) via `Intl.DateTimeFormat({ timeZone, hourCycle: 'h23' })` e
lê os componentes civis de volta — mais simples que a direção direta
porque não precisa da estimativa em duas passadas (essa só existe
porque, indo de civil para UTC, o offset é desconhecido no início).
Rejeita timezone inválida (`timezoneValida()`, reaproveitada) e instante
malformado; nunca cai na timezone da máquina.

## 5. Estratégia de timezone

Sempre explícita via `grupo.timezone` (IANA), nunca a timezone do
processo/SO — mesma estratégia da direção direta, reaproveitada sem
mudança de abordagem. `Intl.DateTimeFormat` com `timeZone` explícito é
determinístico independente de onde o código roda.

## 6. Teste de round-trip

`packages/contrato/test/modeloPlantaoPersistente.test.ts` — 13 testes
novos: inversos exatos dos 4 fixtures diretos já existentes (19:00↔22:00
UTC, 07:00↔10:00 UTC, 00:00↔03:00 UTC, virada de dia 23:00↔02:00 UTC do
dia seguinte), duração de 12h/24h preservada, as duas bordas reais da
fixture (43h/5h) preservadas exatamente, timezone inválida rejeitada,
instante malformado rejeitado, determinismo, e um teste de propriedade
round-trip (civil → UTC → civil = original) para 6 combinações de
data/hora/timezone (`America/Sao_Paulo`, `UTC`, `America/New_York`,
`Asia/Tokyo`).

## 7. Arquitetura da reidratação

`reidratarRascunhoPlantao({ grupo, competencia, atribuicoesPersistidas,
participantes, usuarios })` (nova, `lib/montagemRascunhoPlantao.ts`) —
módulo puro, sem React, sem Firebase. Resolve `plantonistaLogin → nome`
via `nomeParticipantePlantao()` (ESCALAS-UX-1B, reaproveitada), converte
`inicio`/`fim` via `converterInstanteUtcParaMomento()`, e constrói cada
`AtribuicaoPlantaoEditavel` via `criarAtribuicaoEditavelDePersistida()`
(nova, `lib/editorPlantao.ts`) — `idLocal = "rehidratado-${atribuicaoId}"`,
nunca posicional (diferente de `criarAtribuicoesEditaveis()`, correta só
para uma leitura fresca do parser). Vínculos vêm de
`vinculosDeParticipantesGrupoPlantao()` (ESCALAS-UX-1B, reaproveitada)
sobre os participantes ATIVOS; a lista de `participantes` passada para a
reidratação inclui ativos E inativos, para uma atribuição referenciando
alguém desativado depois de salvo continuar aparecendo.

## 8. Confirmação de working copy única

Boundary test novo (`tests/plantao-editor-boundaries.test.mjs`, #22):
conta ocorrências de `interface AtribuicaoPlantaoEditavel`, `function
PlantaoCalendario`, `function ModalEditarAtribuicaoPlantao` e `function
reidratarRascunhoPlantao` em todo o Editor — exatamente 1 cada. Nenhum
`EditorRascunhoPlantao`/`CalendarioRascunhoPlantao`/
`AtribuicaoPlantaoRascunhoEditavelV2` foi criado.

## 9. Origem MANUAL

Preservada exatamente como persistida — `reidratado.origem =
competencia.origem` (nunca hardcoded). Testado explicitamente (item 3
do describe `reidratarRascunhoPlantao`).

## 10. Origem IMPORTADO

Preservada exatamente como persistida — mesmo teste, item 4. Nunca "cai"
para MANUAL por ter passado pelo Editor.

## 11. Comportamento da conferência original ao reabrir

Para `IMPORTADO` reaberto, `resultadoPlantao` permanece `null` — a
"Conferência da fonte" (32/504h, 31/480h, 31/468h) NÃO é reconstruída,
porque o modelo persistido nunca guardou a contabilidade por
plantonista declarada na planilha (só os dois agregados da competência).
Registrado como limitação explícita em `docs/spec/EDITOR_ESCALAS.md` § 10
e `docs/spec/PLANTOES.md` § 26.2 — nunca inventado, nunca fabricado.

## 12. Leitura do Grupo

`obterGrupoPlantao()`/cache local `gruposPlantaoAdmin` (já existente) —
`abrirRascunhoNoEditorAcao()` recebe o `GrupoPlantao` já carregado
(vindo do card clicado ou do `<select>` de "+ Nova escala"), nunca uma
query nova só para isso; a versão usada é sempre a ATUAL (nenhum
snapshot).

## 13. Leitura da competência

`obterCompetenciaPlantaoRascunho()` (já existente, PLANTÃO-3B) —
re-lida no momento de abrir (não só a partir do cache da listagem), para
pegar a versão mais fresca e detectar corretamente "não encontrado" se
o rascunho foi removido entre a listagem e o clique.

## 14. Leitura das atribuições

`listarAtribuicoesPlantaoRascunho()` (já existente, ganhou
`where('grupoId', ...)` + `orderBy('atribuicaoId')` nesta fase — ver
item 40). Nenhuma query nova no Dashboard; toda leitura passa por
`plantaoReadRepository.ts`.

## 15. Fluxo "Abrir rascunho"

Duas entradas, uma ação (`abrirRascunhoNoEditorAcao`): (a) tela
"Plantões", seção "Rascunhos" de cada Grupo expandido, um card por
competência com botão "Abrir rascunho" (só para quem administra); (b)
dentro de "+ Nova escala", quando já existe rascunho para o
Grupo/competência escolhidos, o botão "Abrir rascunho existente" chama
o MESMO fluxo diretamente (antes só levava à tela "Plantões" com o
grupo expandido — limitação da ESCALAS-UX-1B, resolvida aqui).

## 16. Estado loading

`abrirRascunhoPlantaoStatus = { fase: 'carregando' }` — o calendário só
aparece depois que Grupo/competência/atribuições/participantes
terminaram de carregar; nunca abre vazio enquanto a leitura está
pendente. Botão "Abrir rascunho" mostra spinner e fica desabilitado
durante a leitura.

## 17. Estado error

`{ fase: 'erro', mensagem }` — usa `mensagemErroFirebase()` (já
existente) para produzir uma mensagem legível, inclusive para
`permission-denied`. Nunca mascarado como "não encontrado".

## 18. Rascunho inexistente

`{ fase: 'nao-encontrado' }` — só quando `obterCompetenciaPlantaoRascunho()`
(relida no momento de abrir) retorna `null`; nunca cria outro rascunho
automaticamente.

## 19. Permissão negada

Cai no mesmo `{ fase: 'erro' }`, com a mensagem que
`mensagemErroFirebase()` produz para `permission-denied` — distinto de
"não encontrado" por construção (só vira "não encontrado" quando a
competência genuinamente não existe, nunca quando a leitura lançou uma
exceção).

## 20. Dirty inicial

`reidratado.dirtyInicial = false` sempre — testado explicitamente
(`reidratarRascunhoPlantao`, item 10). No Dashboard,
`setPlantaoEditadoDesdeImportacao(false)` é chamado ao final de
`abrirRascunhoNoEditorAcao()` bem-sucedida.

## 21. Dirty após editar

Inalterado — mesma `marcarPlantaoEditadoNoEditor()` da ESCALAS-UX-1A,
chamada pelos mesmos `editarAtribuicaoEditavel`/`adicionarAtribuicaoEditavel`/
`excluirAtribuicaoEditavel` reaproveitados sem nenhuma operação especial
para rascunho reaberto.

## 22. Dirty após salvar

**Corrigido nesta fase** — `salvarRascunhoPlantaoAcao()` NUNCA zerava
`plantaoEditadoDesdeImportacao` depois de um salvamento bem-sucedido (bug
pré-existente desde a ESCALAS-UX-1A, só percebido pelo requisito
explícito desta fase). Agora zera, e também atualiza o cache de
`rascunhosPlantaoPorGrupo` para a tela "Plantões" refletir o rascunho
recém-salvo sem recarregar a página.

## 23. Competência 26→25

Preservada exatamente como persistida (`competencia.competencia`/
`.periodoInicio`/`.periodoFim`) — nunca recalculada a partir das
atribuições, nunca mês civil. Testado explicitamente (item 5).

## 24. 43h

Preservada exatamente no round-trip — testado em
`modeloPlantaoPersistente.test.ts` (borda real de 43h) e implicitamente
em toda a cadeia (a duração vem de `AtribuicaoPlantaoPersistida.duracaoMinutos`,
nunca recalculada).

## 25. 5h

Mesma garantia, mesma cobertura de teste, para a outra borda real da
fixture.

## 26. Participante inativo

`reidratarRascunhoPlantao()` resolve o nome de QUALQUER participante do
Grupo (ativo ou inativo) para as atribuições existentes — a atribuição
nunca desaparece. Testado explicitamente (item 11). No Dashboard,
`participantesPlantao` (useMemo) foi generalizado para incluir um
inativo SE E SÓ SE ele for referenciado por alguma atribuição da working
copy atual — evita que o `<select>` do modal de edição fique sem opção
correspondente ao nome já atribuído. Rótulo visual "(Inativo)" no
`<select>` foi deixado de fora — item explicitamente opcional no pedido
("pode marcar"), registrado como refinamento futuro.

## 27. Comportamento se Grupo mudou

`abrirRascunhoNoEditorAcao()` sempre usa o `GrupoPlantao` ATUAL (nome,
timezone, participantes) para UI/autorização — nunca um snapshot de
quando o rascunho foi salvo. As atribuições persistidas em si nunca são
alteradas por isso.

## 28. Risco/decisão sobre timezone alterada

Registrado, não resolvido: se a timezone do Grupo mudar DEPOIS de um
rascunho ser salvo, reabrir usa a timezone ATUAL para converter os
instantes UTC persistidos de volta para civil — um instante salvo sob a
timezone antiga seria exibido com o horário civil errado. O modelo
persistido não guarda snapshot de timezone por competência; mudar o
schema para isso exigiria autorização explícita de uma fase própria —
não feito aqui. Documentado em `docs/spec/EDITOR_ESCALAS.md` § 10 e
`docs/spec/PLANTOES.md` § 26.2.

## 29. Quantidade antes/depois de salvar sem alterações

Testado (`lib/firebase/plantaoWriteRepository.test.ts`, "salvar de novo
sem alterações não gera nenhuma exclusão nem duplicata"): 1 persistida →
salvar as mesmas 1 → 0 exclusões, 1 `set`. Também testado no nível puro
(`montagemRascunhoPlantao.test.ts`, idempotência § 22 do pedido): criar 3
→ salvar → editar 1 → salvar de novo → ainda 3 atribuições, IDs
0001/0002/0003 em ambas as vezes.

## 30. Teste de edição após reabrir

Cobrir via reaproveitamento direto de `editarAtribuicaoEditavel()` —
nenhuma operação especial; o teste de idempotência (item 29) já exercita
exatamente "reabrir → editar 1 → salvar de novo".

## 31. Teste de exclusão após reabrir

`lib/montagemRascunhoPlantao.test.ts` ("excluir uma atribuição MANUAL
antes de salvar reduz o payload") e `plantaoWriteRepository.test.ts`
("exclui do Firestore o documento cujo atribuicaoId não está mais na
lista nova") — 3 persistidas, exclui 1 do meio, salva, confirma que
exatamente o órfão certo (`0003`) foi excluído.

## 32. Teste de adição após reabrir

`plantaoWriteRepository.test.ts` ("adicionar uma atribuição nova... só
grava a nova, sem excluir as anteriores") — 1 persistida, adiciona 1,
salva, confirma 0 exclusões e 2 `set`.

## 33. Confirmação de ausência de stale documents

`salvarAtribuicoesPlantaoRascunho()` agora lê os `atribuicaoId` já
persistidos desta competência (`where('grupoId', ...)`) e inclui
`batch.delete()` para os que saíram da lista nova — no MESMO lote das
atualizações. Testado: excluir 1 de 3 limpa exatamente 1; excluir todas
(array vazio) limpa todas as 3; nenhuma exclusão espúria quando nada
muda ou só se adiciona.

## 34. Estratégia de sincronização

Diff completo (não incremental): a cada salvamento, a função sempre lê
o estado atual do Firestore para esta competência e calcula a diferença
contra a lista nova — nunca tenta rastrear "o que mudou desde a última
vez" no cliente. Mais simples e mais seguro (não depende de nenhum
estado local ficar sincronizado entre sessões).

## 35. Atomicidade

`set`+`delete` no MESMO `writeBatch`, fatiados em lotes de até 499 (limite
já existente, mantido). Uma falha no meio de um lote não deixa
metade-atualizado-metade-órfão DENTRO desse lote — mas, como antes desta
fase, múltiplos lotes (>499 operações) não são atômicos ENTRE si, mesma
limitação pré-existente da função original, não uma regressão desta
fase.

## 36. Rules alteradas ou não

**Não alteradas — diff zero em `firestore.rules`.** A correção da
leitura para GESTOR_EQUIPE foi feita inteiramente no repository
(`where('grupoId', ...)`), confirmada empiricamente no emulador real
(não apenas por leitura de código): a mesma consulta, com o filtro,
passa a funcionar para `usuarios.gestor` e continua falhando para
`gestorForaEscopo` — nenhuma permissão foi ampliada.

## 37. Quantidade de testes novos

41 testes novos: 13 em `packages/contrato/test/modeloPlantaoPersistente.test.ts`
(round-trip temporal), 14 em `lib/montagemRascunhoPlantao.test.ts`
(reidratação + unificação + idempotência), 6 em
`lib/firebase/plantaoWriteRepository.test.ts` (limpeza de órfãos), 2 em
`lib/firebase/plantaoReadRepository.test.ts` (nova função +
ordenação/filtro), 1 em `tests/firebase/firestore.rules.test.ts`
(GESTOR_EQUIPE lendo rascunhos via `where`), 6 em
`tests/plantao-editor-boundaries.test.mjs`.

## 38. Unit total

817/817 (baseline 784 — cresceu, nada removido).

## 39. Boundaries total

178/178 (baseline 172 — cresceu, nada removido).

## 40. Rules total

154/154 (baseline 153 + 1 teste novo, todos os 153 originais
inalterados — `firestore.rules` com diff zero).

## 41. Typechecks

Raiz, dashboard, app-web, worker: todos OK. `packages/contrato` isolado:
os mesmos 3 erros pré-existentes fora de escopo
(`jornada.ts:260`, `detectorPlanilha.test.ts`, `parserPlantao.test.ts`),
nenhum novo.

## 42. Lint

0 erros. 6 warnings — todos pré-existentes ou da MESMA categoria já
aceita (parâmetro de mock com prefixo `_` não suprimido pela config
atual de ESLint, mesmo padrão de `_auth`/`_email`/`_db` já presentes
antes desta fase).

## 43. Builds

`build:dashboard`, `build:app:pages` (inclui `validate-deployments
--app-only`), `build:apps`: todos OK.

## 44. Validação visual

**Auditoria estática** — sem navegador disponível neste ambiente. A
seção "Rascunhos" (`.plantao-rascunhos-secao`/`-lista`/`-item`) e o botão
"+ Nova escala" reaproveitam classes/paletas já responsivas
(`.plantao-rascunho-item` com `flex-wrap`, `.admin-modal`/`.rollback-actions`
já validados em 412/390/360px em fases anteriores) — nenhum media query
novo foi necessário. Não houve execução real em breakpoints nem
alternância de tema; esta fase declara auditoria por leitura de
código/CSS, não inspeção de DevTools real.

## 45. PII

Nenhum nome/telefone/e-mail real — só fixtures sintéticas já usadas em
fases anteriores (Ana Costa/Bruno Lima, acosta/blima/gestor1).

## 46. git diff --check

Limpo.

## 47. 6x1 intacto

Diff zero confirmado (`components/ScheduleGrid.tsx`,
`packages/contrato/src/parserPlantao.ts` — este último é o parser de
Plantão, também diff zero, e nenhum arquivo 6x1 foi tocado).

## 48. App intacto

`apps/app/` diff zero — confirmado por boundary test (#19, herdado da
ESCALAS-UX-1B, reconfirmado).

## 49. Auth intacto

`lib/firebase/authRepository.ts` diff zero.

## 50. Push intacto

`apps/push-worker/` diff zero.

## 51. Organização intacta

`components/organizacao/`, `lib/organizacao.ts` diff zero. NOC
reconfirmado sem hardcode (só seed/fixtures, nenhum código de produção).

## 52-54. Confirmações finais

- Copiar anterior: **NÃO implementado.**
- Drag-and-drop: **NÃO implementado.**
- Publicação: **NÃO implementada** (`publicarPlantao()` continua
  inexistente; `competenciasPlantao` sem escrita; Rule de bloqueio
  intocada).

## Arquivos com diff zero confirmado

`apps/app/`, `firestore.rules`, `firestore.indexes.json`,
`lib/firebase/authRepository.ts`, `apps/push-worker/`,
`components/organizacao/`, `lib/organizacao.ts`,
`components/ScheduleGrid.tsx`, `packages/contrato/src/tiposPlantao.ts`,
`packages/contrato/src/parserPlantao.ts`, `components/plantao/`,
`lib/conciliacaoPlantoes.ts`.

**NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. FIREBASE STAGING NÃO FOI ALTERADO.
FIREBASE PRODUÇÃO NÃO FOI ALTERADO. NENHUM PLANTÃO FOI PUBLICADO.
PRODUÇÃO NÃO FOI TOCADA.**
