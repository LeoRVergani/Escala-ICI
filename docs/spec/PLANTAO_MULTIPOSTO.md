# Especificação — Plantão multi-função (multiposto)

Fases FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1 (tabs/cards/calendário/Nova
escala) e FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (criação/edição de
posto, vínculos contextuais, pré-publicação, gate de publicação,
validação da importação contra o Grupo). Spec genérica: qualquer Grupo de
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
arquitetura explicitamente fora desta fase — ver seção 16.

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

### 6.5 Atribuição sem função

`SaudeFuncaoPlantao.atribuicoesSemFuncao` — em Grupo multiposto, uma
atribuição sem `funcao` é sempre `CRITICO`/bloqueante (nunca aceita
silenciosamente, seção 7.3). Só populado em `'TODOS'`: filtrar por uma
função específica já exclui, por definição, qualquer atribuição sem
função.

### 6.6 Ocorrências do período

`SaudeFuncaoPlantao.ocorrencias` — total de ocorrências do período
inteiro (mesmo valor em `todos` e em cada função, já que todo posto é
esperado em toda ocorrência de um Grupo multiposto); usado pelo resumo
geral da pré-publicação (seção 9).

## 7. Criação e edição de atribuição

### 7.1 Criar a partir de uma aba específica

Clicar "+ Adicionar plantão" com a aba DBA/Linux/Telecom/Windows
selecionada preenche o campo Posto automaticamente com aquela função
(`abrirCriacaoAtribuicaoPlantao()` lê `funcaoSelecionadaPlantao`) — o
coordenador ainda pode trocar antes de salvar.

### 7.2 Criar a partir de "Todos"

O campo Posto nasce vazio; `funcoesDisponiveis` (prop do Modal) lista
`grupo.funcoesEsperadas` — nunca hardcoded, nunca um valor específico de
CODB. `validarAtribuicaoEditavel(entrada, funcoesEsperadas)`
(`lib/editorPlantao.ts`) bloqueia "Salvar" enquanto `funcao` estiver
ausente e `funcoesEsperadas` não for vazio.

### 7.3 Posto único

Para Grupo sem `funcoesEsperadas`, o Modal nunca mostra o campo Posto
(`funcoesDisponiveis` ausente/vazio → `mostrarCampoPosto === false`) e
`validarAtribuicaoEditavel()` nunca exige `funcao` — retrocompatibilidade
total, zero mudança de comportamento para Plantão COSI.

### 7.4 Editar o posto de uma atribuição

`ModalEditarAtribuicaoPlantao` mostra o campo Posto também ao editar,
pré-preenchido com `atribuicao.funcao`. Alterar o valor é uma edição
REAL da atribuição (`editarAtribuicaoEditavel(atribuicoes, idLocal, {
..., funcao })`, `lib/editorPlantao.ts`) — nunca altera cadastro/perfil
do usuário, só `atribuicao.funcao`. Editar SEM tocar o campo Posto nunca
apaga um `funcao` já existente (edição de horário/pessoa preserva o
posto). Um banner de confirmação simples ("Alterar o posto desta
atribuição de DBA para Linux? A pessoa será movida somente nesta
ocorrência — o cadastro dela não muda.") aparece quando o posto muda em
modo de edição — nunca `window.confirm()` (ver
`components/escalas/UnsavedChangesDialog.tsx`), nunca a linguagem "mover
para equipe X" (não é equipe organizacional). Tudo fica na working copy
até "Salvar rascunho" — nunca grava Firestore direto.

### 7.5 `funcaoPermitidaNoGrupo()`

Helper puro (`lib/plantaoMultiposto.ts`) — Grupo de posto único sempre
aceita `funcao` ausente; Grupo multiposto exige `funcao` presente E
pertencente a `funcoesEsperadas`.

## 8. Nova escala multiposto

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

## 9. Vínculos contextuais por função

Aba Vínculos passa a priorizar quem tem atribuição na função selecionada
(`participantesExibidosVinculos`, `PreviewPlantao`): com uma função
específica ativa, a tabela mostra só os participantes com atribuição
naquela função; um banner explícito ("Vínculos — DBA (N participante(s))")
com ação **Mostrar todos os vínculos** garante que o contexto nunca se
perde de vez. Em "Todos", a tabela continua mostrando todo mundo, sem
filtro. A contagem GLOBAL de pendências (`contarPendenciasVinculoPlantao()`)
nunca muda por causa deste filtro visual — só a APRESENTAÇÃO da tabela é
recortada; a mesma pessoa pendente em DBA e Linux ainda conta 1 vez no
total global (seção 6.2). Reseta para "Todos" ao trocar de função (nunca
herda "mostrar todos" de uma função para outra).

## 10. Pré-publicação e gate de publicação

`components/plantao/RevisarPublicacaoPlantaoModal.tsx` — modal "Revisar
publicação", aberto por um botão **Revisar publicação** ao lado de
"Publicar Plantão" (só para Grupo multiposto). `avaliarSaudePlantao()` é
a ÚNICA fonte: o modal nunca recalcula erro/status, só apresenta e
navega. Mostra o resumo geral (ocorrências/atribuições/pessoas + status
geral ✓/⚠/✕) e uma linha por posto (status + problemas, ou "Pronto"),
cada linha clicável — navega para Calendário (posto faltando/conflito/erro
de origem) ou Vínculos (só pendência), fechando o modal e sincronizando
`funcaoSelecionadaPlantao`/`abaPreviaPlantao`.

O botão **Publicar Plantão** usa `ResultadoSaudePlantao.podePublicar`
como gate normativo (`podePublicarPlantaoPelaSaude`, `DashboardApp.tsx`)
— nunca `alertas.length > 0` (um `status: 'ATENCAO'` nunca bloqueia; só
`'CRITICO'`, refletido em `podePublicar === false`, bloqueia de fato).
Para Grupo de posto único, `saudePlantaoRascunho` é sempre `null` e o
gate antigo (`rascunhoPlantaoProntoParaPublicar`) continua a única
condição — zero mudança de comportamento para Plantão COSI.

## 11. Importação — validação contra o Grupo específico

`validarFuncoesContraGrupo(atribuicoes, funcoesEsperadas)`
(`lib/plantaoMultiposto.ts`) — chamada em `receberArquivo()`
(`DashboardApp.tsx`) logo após resolver o Grupo alvo, ANTES de
`interpretarPlantao()`. O parser multi-fonte já valida a função
encontrada contra o enum GLOBAL (`funcaoPlantaoDaFonte()` — uma fonte
totalmente desconhecida, ex. "Oracle", já gerava erro nomeado); esta
validação adicional cobre o caso em que a função É conhecida pelo enum
mas não pertence a ESTE Grupo (ex.: arquivo traz Telecom, mas o Grupo só
espera DBA/Linux) — erro bloqueante nomeado
("A função Telecom foi encontrada no arquivo, mas não está configurada
para este Plantão."), usando o mesmo formato de `coluna`
(`"Plantonista <fonte>"`) que o parser já produz, para que
`funcaoDoErroPlantao()` atribua o erro ao card certo sem lógica nova.
NUNCA adiciona a função a `funcoesEsperadas` sozinho, nunca cria posto
novo, nunca cria Grupo — o coordenador precisa corrigir
configuração/mapeamento explicitamente. Grupo de posto único
(`funcoesEsperadas` vazio) nunca passa por esta validação.

## 12. Publicação

Publicação continua sendo UMA só, para o Grupo inteiro — nunca uma
publicação por posto (inalterado desde FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1).

## 13. Rollback

Nenhuma mudança de schema além dos campos já opcionais e
retrocompatíveis `funcoesEsperadas`/`funcao` (existentes desde a fase
PLANTAO_CODB). Reverter esta fase = reverter o commit; nenhum dado
precisa migração.

## 14. Segurança

Nenhuma Rule alterada nesta fase (`docs/spec/PLANTAO_CODB.md` §20
continua a fonte normativa: autorização sempre no nível do Grupo,
`podeAdministrarEscalaPlantao(grupoId)`, nunca por função/posto).

## 15. Testes

- `lib/plantaoMultiposto.test.ts` — isolamento por função, mesma pessoa
  em funções diferentes, card de pendências por função (local vs.
  global), sobreposição correta (postos diferentes nunca é conflito;
  mesma pessoa ou mesmo posto continua sendo), posto ausente vira gap
  (nunca some), status/podePublicar, atribuição sem função sempre
  bloqueante em Grupo multiposto (nunca em posto único),
  `funcaoPermitidaNoGrupo()`, `validarFuncoesContraGrupo()` (incluindo o
  caso real CODB completo e o Grupo reduzido DBA/Linux com Telecom
  bloqueado).
- `lib/editorPlantao.test.ts` — `editarAtribuicaoEditavel()` troca o
  posto sem afetar mais nada e nunca apaga um `funcao` existente quando
  a edição não o toca; `adicionarAtribuicaoEditavel()` persiste `funcao`
  passada e nunca inventa uma quando ausente;
  `validarAtribuicaoEditavel()` exige `funcao` só quando
  `funcoesEsperadas` não é vazio.
- `lib/gruposPlantaoProvisionamento.test.ts` — `funcoesEsperadas`
  ausente/vazio nunca persiste `[]`; presente persiste exatamente os
  postos escolhidos; sempre UM `GrupoPlantao`.
- `tests/plantao-multiposto-boundaries.test.mjs` — pureza de
  `lib/plantaoMultiposto.ts`/`CardFuncaoPlantao.tsx`; nenhum componente
  específico por posto; tabs geradas por `.map()`, nunca hardcoded;
  filtro usa o helper único; seleção de função é puro `useState`;
  `construirGrupoPlantaoOficial` nunca itera para criar múltiplos
  Grupos; Rules não tocadas.
- `tests/plantao-editor-boundaries.test.mjs`/`tests/plantao-preview-boundaries.test.mjs`
  (atualizados) — o Calendário consome `atribuicoesFiltradas`, uma
  projeção pura de `atribuicoesEditaveis` (a working copy), nunca uma
  cópia paralela; a importação valida contra `grupo.funcoesEsperadas`
  específico antes de `interpretarPlantao()`, sempre derivando de
  `processado.resultado` (nunca um segundo parse).

## 16. Dívidas técnicas reais

- Tela dedicada de mapeamento manual de coluna → posto quando a
  importação encontra uma função fora do Grupo (`[Mapear para posto
  existente] [Voltar]`, citada no pedido original) — hoje o coordenador
  só vê o erro nomeado e precisa corrigir a planilha ou a configuração
  do Grupo manualmente; a ação de mapeamento em UI não foi construída.
- Postos além do enum fechado `FuncaoPlantao` (ex.: um futuro Plantão
  Infra com N1/N2/Cloud) exigem evolução de modelo — não implementado,
  proposta explícita necessária antes de qualquer código
  (FASE-PLANTAO-POSTOS-CONFIGURAVEIS-1, ainda não iniciada).
- Homologação visual (screenshots reais de Todos/DBA/Linux/Telecom/
  Windows, Nova escala multiposto, mobile, dark mode) depende do usuário
  abrir o Dashboard localmente — ver instruções de homologação entregues
  junto com esta fase; nenhuma captura automática foi feita.
