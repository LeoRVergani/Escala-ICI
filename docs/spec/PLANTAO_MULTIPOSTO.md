# Especificação — Plantão multi-função (multiposto)

Fase FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1. Spec genérica: qualquer Grupo de
Plantão com mais de um posto/função (hoje só Plantão CODB — DBA/Linux/
Telecom/Windows), não uma spec de CODB especificamente.

## 1. Conceito

Um `GrupoPlantao` multi-função continua sendo **UM** Grupo, **UMA**
competência, **UMA** publicação, **UMA** Matriz de responsabilidade. Os
postos vivem só como `FuncaoPlantao` na ATRIBUIÇÃO
(`AtribuicaoPlantaoPersistida.funcao`/`AtribuicaoPlantaoBruta.funcao`),
nunca como Equipe/Grupo/Matriz/publicação paralela. A função pertence à
atribuição, nunca ao usuário — a mesma pessoa pode aparecer em funções
diferentes em ocorrências diferentes (nunca `usuario.funcaoFixa`).

## 2. `funcoesEsperadas`

`GrupoPlantao.funcoesEsperadas?: FuncaoPlantao[]` — presente e não vazio
⇒ Grupo multi-função; ausente/vazio ⇒ Grupo de posto único (ex.: Plantão
COSI, comportamento de sempre, inalterado). Toda tela/helper desta spec
lê esse campo para decidir se mostra tabs/cards de posto — nunca decide
por nome do Grupo, nem hardcode de sigla.

`FuncaoPlantao` continua o enum fechado `'DBA' | 'LINUX' | 'TELECOM' |
'WINDOWS'` (`packages/contrato/src/modeloPlantaoPersistente.ts`) — esta
fase NÃO o expande. Um posto fora desse conjunto (ex.: "N1"/"Cloud"/"SOC",
citados como exemplo de um futuro Plantão Infra/Segurança) exige evoluir
o modelo para uma lista de postos configurável por Grupo, uma decisão de
arquitetura explicitamente fora desta fase — ver seção 13.

## 3. Tabs

`components/plantao/` (dentro de `PreviewPlantao`, `apps/dashboard/src/DashboardApp.tsx`):
tabs geradas via `funcoesEsperadas.map(...)` — nunca 4 tabs hardcoded no
JSX. "Todos" sempre existe; as demais só aparecem para
`funcoesEsperadas` presente. Estado: `FiltroFuncaoPlantao = 'TODOS' |
FuncaoPlantao` (`lib/plantaoMultiposto.ts`), puramente visual — trocar de
aba nunca grava Firestore, nunca reprocessa a importação, nunca altera
`funcao` de nenhuma atribuição existente.

## 4. Cards

`components/plantao/CardFuncaoPlantao.tsx` — componente genérico (recebe
`rotulo`/`saude`/`selecionado`/`onSelecionar`), nunca `CardDBA.tsx`/
`CardLinux.tsx`/etc. Reaproveita as classes `.overview-operation-card`/
`-heading`/`-meta`/`-action` já usadas pelos cards de operação da Visão
Geral (Design System existente, nenhuma classe nova de card). Clicar no
card seleciona a função (`onMudarFuncaoSelecionada`) e abre a aba
Calendário — card e tab ficam sempre sincronizados.

## 5. Filtro

`filtrarAtribuicoesPlantaoPorFuncao(atribuicoes, filtro)`
(`lib/plantaoMultiposto.ts`) — único helper de filtro, reaproveitado por
toda tela; nunca uma condicional `atribuicao.funcao === 'DBA'` duplicada
em outro componente. `'TODOS'` é a identidade (retorna todas) — para um
Grupo de posto único, `funcaoSelecionada` nunca deixa de ser `'TODOS'`
(nenhuma tab aparece), então o comportamento é idêntico ao de antes desta
fase.

O calendário (`PlantaoCalendario`), o roster (`resumirPorPessoa`) e o
resumo "Escala atual" (aba Contabilidade) recebem sempre a lista JÁ
FILTRADA (`atribuicoesFiltradas`) — nenhuma condicional de função dentro
de célula/linha individual.

## 6. Saúde por posto

`avaliarSaudePlantao()` (`lib/plantaoMultiposto.ts`) — painel único
(§51 do pedido original), nunca regra de habilitar/desabilitar
publicação espalhada pela UI. Para cada função (e para `'TODOS'`):
`atribuicoes`, `pessoasUnicas`, `minutosCobertura`, `postosFaltando`,
`vinculosPendentes`, `conflitos`, `errosOrigem`, `avisos`, e um `status`
calculado (`OK`/`ATENCAO`/`CRITICO`). `podePublicar`/`bloqueiosGlobais`
vêm do mesmo resultado — nunca um segundo cálculo.

### 6.1 Postos incompletos

`agruparOcorrenciasPlantao()` deriva as OCORRÊNCIAS a partir de TODAS as
atribuições (nunca só das de uma função) e só depois associa quem
preenche cada posto — uma ocorrência com Telecom faltando aparece como
gap na aba Telecom (nunca desaparece) e conta em `postosFaltando`, tanto
em "Todos" quanto na aba Telecom especificamente.

### 6.2 Vínculos por função

`vinculosPendentesPorFuncao()` — quebra por função de
`contarPendenciasVinculoPlantao()` (global). A mesma pessoa pendente em
DBA e Linux conta 1 em CADA função (impacto local) mas 1 só no total
global (identidade única) — nunca a soma das contagens por função vira
"total de pessoas pendentes".

### 6.3 Sobreposição/conflito

`conflitosRelevantesPlantao()` — `detectarSobreposicoesPlantao()`
(`@escala-ici/contrato`) continua um detector genérico, sem mudança, e
correto para posto único (duas pessoas no mesmo horário/posto único É
conflito real). Num Grupo multi-função, postos diferentes cobrindo o
mesmo horário são a estrutura esperada, NUNCA conflito — só conta como
conflito relevante quando: (a) a mesma pessoa está em dois lugares ao
mesmo tempo (`MESMO_PLANTONISTA`, qualquer função), ou (b) duas pessoas
diferentes no MESMO posto e mesmo horário (double-booking dentro do
posto). Aplicado só quando `funcoesEsperadas` é não vazio — para posto
único, o filtro é a identidade (comportamento inalterado).

### 6.4 Erros de origem por função

`funcaoDoErroPlantao()` — melhor esforço: deriva a função de
`erro.coluna` (`"Plantonista <fonte>"`) via `funcaoPlantaoDaFonte()`
(mesma normalização do parser). Um erro sem coluna de posto reconhecível
(ex.: a própria fonte desconhecida que gerou o erro) fica só em "Todos".

## 7. Nova escala multiposto

No Wizard (`components/escalas/ScheduleStartWizard.tsx`), ao criar um
Plantão: escolher **Posto único** (comportamento de sempre) ou
**Múltiplos postos** (checkboxes sobre os quatro valores conhecidos de
`FuncaoPlantao` — nunca texto livre). `onCriarGrupo(nome, equipeId,
funcoesEsperadas?)` chama `construirGrupoPlantaoOficial()`
(`lib/gruposPlantaoProvisionamento.ts`) uma única vez — sempre **UM**
`GrupoPlantao`, nunca um por posto. Ao menos um posto precisa estar
marcado para "Múltiplos postos" (validação bloqueia o botão "Criar
Plantão" enquanto vazio).

Depois de criado, o workspace (tabs + cards) já funciona automaticamente
— nenhum código adicional específico do Grupo novo, porque tudo deriva
de `grupo.funcoesEsperadas` (seção 2/3).

## 8. Importação

O parser multi-fonte (`docs/spec/PLANTAO_CODB.md`/`IMPORTADOR_UNIVERSAL_ESCALAS.md`)
já valida a função encontrada contra o conjunto conhecido
(`funcaoPlantaoDaFonte()`) — uma fonte desconhecida (ex.: "Oracle") gera
erro nomeado, nunca é silenciosamente descartada nem corrompe o Grupo.
Validar a função encontrada contra `grupo.funcoesEsperadas` especificamente
(em vez de só contra o enum global) fica para quando a importação real
para Grupos multi-função for integrada ao Dashboard (dívida, seção 13).

## 9. Publicação

Publicação continua sendo UMA só, para o Grupo inteiro — nunca uma
publicação por posto. O resumo de pré-publicação (por função, com ✓/⚠)
descrito no pedido original (§50) e o gate de "Publicar desabilitado"
quando há bloqueio (`ResultadoSaudePlantao.podePublicar`) ainda não têm
UI própria nesta fase — `avaliarSaudePlantao()` já calcula tudo que essa
UI precisaria consumir (dívida, seção 13).

## 10. Rollback

Nenhuma mudança de schema além do campo já opcional e retrocompatível
`funcoesEsperadas`/`funcao` (já existentes desde a fase PLANTAO_CODB).
Reverter esta fase = reverter o commit; nenhum dado precisa migração.

## 11. Segurança

Nenhuma Rule alterada nesta fase (`docs/spec/PLANTAO_CODB.md` §20
continua a fonte normativa: autorização sempre no nível do Grupo,
`podeAdministrarEscalaPlantao(grupoId)`, nunca por função/posto).

## 12. Testes

- `lib/plantaoMultiposto.test.ts` — isolamento por função, mesma pessoa
  em funções diferentes, card de pendências por função (local vs.
  global), sobreposição correta (postos diferentes nunca é conflito;
  mesma pessoa ou mesmo posto continua sendo), posto ausente vira gap
  (nunca some), status/podePublicar.
- `lib/gruposPlantaoProvisionamento.test.ts` — `funcoesEsperadas`
  ausente/vazio nunca persiste `[]`; presente persiste exatamente os
  postos escolhidos; sempre UM `GrupoPlantao`.
- `tests/plantao-multiposto-boundaries.test.mjs` — pureza de
  `lib/plantaoMultiposto.ts`/`CardFuncaoPlantao.tsx`; nenhum componente
  específico por posto; tabs geradas por `.map()`, nunca hardcoded;
  filtro usa o helper único; seleção de função é puro `useState`;
  `construirGrupoPlantaoOficial` nunca itera para criar múltiplos
  Grupos; Rules não tocadas.
- `tests/plantao-editor-boundaries.test.mjs` (teste 7, atualizado) — o
  Calendário consome `atribuicoesFiltradas`, uma projeção pura de
  `atribuicoesEditaveis` (a working copy), nunca uma cópia paralela.

## 13. Dívidas técnicas reais

- `FormularioAtribuicaoPlantao`/`ModalEditarAtribuicaoPlantao` ainda não
  têm campo de posto — uma atribuição criada a partir de "Todos" (não de
  uma aba específica) nasce sem `funcao`. Criar a partir de uma aba
  específica (DBA/Linux/Telecom/Windows) já herda a função automaticamente
  (`criarAtribuicaoPlantaoNaWorkingCopy`), mas editar a função de uma
  atribuição já existente ainda exige um campo próprio no Modal —
  intencionalmente fora desta fase (movida a função de uma atribuição é
  uma edição explícita, com confirmação/auditoria se o produto exigir).
- Aba Vínculos ainda não prioriza por função selecionada (só os cards já
  mostram pendências por posto) — nice-to-have documentado, não
  implementado.
- Tela de resumo de pré-publicação por posto (§50 do pedido original) e o
  gate visual "Publicar desabilitado" ainda não têm UI própria —
  `avaliarSaudePlantao()` já expõe os dados necessários.
- Validação da função encontrada na importação contra
  `grupo.funcoesEsperadas` específico (hoje só contra o enum global) —
  pendente até a importação real para Grupo multi-função ser integrada ao
  Dashboard.
- Postos além do enum fechado `FuncaoPlantao` (ex.: um futuro Plantão
  Infra com N1/N2/Cloud) exigem evolução de modelo — não implementado,
  proposta explícita necessária antes de qualquer código (§39 do pedido
  original).
