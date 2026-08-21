# Especificação — Editor de Escalas (conceito compartilhado, Fases ESCALAS-UX-1A/1B/1B.1)

## Por que este documento existe

O Escala ICI tem hoje duas jornadas de escala: a escala 6x1
(`docs/spec/` — parser/preview/publicação já maduros) e o Plantão
(`docs/spec/PLANTOES.md`). As duas são domínios diferentes (ver
PLANTOES.md § 1 — "dois domínios, não um") e este documento não muda
isso. O que as duas têm em comum, e que só ficou explícito nesta fase,
é o **conceito de Editor**: depois que uma escala é criada — por
importação de planilha, por publicação anterior, ou (no futuro) do
zero — ela precisa de um lugar único, editável, onde o coordenador
confere e corrige antes de salvar/publicar. Este documento define esse
conceito de forma independente de qual escala está sendo editada.

## 1. O princípio de simplicidade

> **Toda operação principal de escala deve poder ser entendida sem
> treinamento: criar/importar, visualizar, editar, conferir e
> salvar/publicar.**

> **Recursos avançados não podem ficar no caminho do fluxo principal.**

> **Importação nunca é um destino. Importação é apenas uma forma de
> preencher o Editor de Escala.**

Fase ESCALAS-UX-1B adiciona o princípio complementar, com o mesmo peso
permanente dos três acima:

> **Uma escala vazia também não possui editor próprio. Ela apenas inicia
> o mesmo Editor de Escala sem atribuições.**

Ou seja: "+ Nova escala" → "Criar escala vazia" não é uma segunda porta
de entrada com sua própria tela de montagem — é só uma segunda forma de
chegar à MESMA working copy, começando com `[]` em vez de vir de um
parser. Ver § 7 abaixo ("Origens suportadas pelo mesmo Editor").

Fase ESCALAS-UX-1B.1 adiciona o quarto princípio permanente, fechando o
ciclo básico de trabalho do Editor:

> **RASCUNHO É RETOMÁVEL.**

Salvar um rascunho e sair não é um ponto final — o coordenador precisa
poder voltar depois, abrir a mesma competência e continuar exatamente de
onde parou, sem reimportar XLS, sem recriar a escala, sem perder
edições. O ciclo completo é:

> **Criar/importar → editar → salvar → fechar → reabrir → continuar
> editando.**

Ver § 10 abaixo ("Rascunho é retomável — o round-trip completo").

Estes princípios são permanentes — valem para qualquer fase futura
que toque o Editor (PLANTÃO-3C, ESCALAS-UX-1C, ou qualquer evolução da
escala 6x1). Um recurso avançado (importação, geração automática, cópia
de período, arrastar-e-soltar) pode existir, mas nunca como pré-requisito
para o caminho comum de "ver o que já existe e corrigir uma célula".

## 2. Jornada 6x1 vs. jornada Plantão — onde elas convergem e onde não

| | Escala 6x1 | Plantão |
| --- | --- | --- |
| Unidade de trabalho | dia × colaborador (`ScheduleGrid`, uma célula por dia) | intervalo livre (início/fim civis, qualquer duração) |
| Período | competência 26→25, sempre um mês fixo | competência 26→25, sugerida a partir da planilha |
| Edição hoje | célula a célula, já publicado (`celulaEditando`) | working copy pós-importação (esta fase) |
| Publicação | já existe (`publicarEscalas`) | ainda não existe (PLANTÃO-3C) |

O que converge: as duas jornadas precisam de uma **working copy** (uma
cópia editável em memória, nunca o dado bruto de origem), de uma
**conferência** (o que está errado/incompleto, nunca escondido) e de um
**rascunho** (um estado salvo, revisável, antes de publicar). O que não
converge — o modelo de dado em si (célula fixa vs. intervalo livre) —
continua em módulos completamente separados; este documento não propõe
unificar os parsers, os modelos persistidos ou as Rules dos dois
domínios.

## 3. Working copy

A **working copy** é a única fonte de verdade que o Editor lê e escreve
depois que uma escala é carregada (por importação ou, no futuro, por
qualquer outro método de criação). Ela nunca é:

- o resultado bruto do parser (`ResultadoParsePlantao.atribuicoes`, no
  caso do Plantão) — esse fica congelado, usado só para a "Conferência
  da fonte";
- uma segunda cópia paralela por aba/tela — a Lista e o Calendário
  (Plantão) leem e escrevem a MESMA working copy; nunca duas fontes de
  verdade que podem divergir entre si.

No Plantão (Fase ESCALAS-UX-1A), a working copy é
`AtribuicaoPlantaoEditavel[]` (`lib/editorPlantao.ts`) — estende
`AtribuicaoPlantaoBruta` com `idLocal` (identidade estável local, nunca
persistida, nunca baseada em `linhaOrigem`) e `origemImportacao`
(`true` para o que veio do XLS, `false` para o que foi adicionado
manualmente nesta sessão). É estruturalmente compatível com
`AtribuicaoPlantaoBruta[]`, então todas as funções puras que já existiam
para conferência/conciliação (`calcularDuracaoBrutaDosIntervalos`,
`detectarSobreposicoesPlantao`, `identificarLacunasPlantao`,
`consolidarParticipantesPlantao`, `aplicarVinculosNasAtribuicoes`)
continuam funcionando sobre ela sem nenhum adaptador.

## 4. Rascunho

O **rascunho** é o que "Salvar rascunho" grava — sempre construído a
partir da working copy no momento do clique, nunca do dado de origem
congelado. Esta é a garantia mais importante desta fase: editar, excluir
ou adicionar uma atribuição no Editor e depois salvar precisa refletir
exatamente essa edição no rascunho gravado — nunca os valores
originais da importação (ver `lib/montagemRascunhoPlantao.test.ts`,
describe "CRÍTICO — o payload do rascunho reflete a working copy
EDITADA"). O rascunho nunca é a publicação — permanece revisável/
descartável até uma fase futura decidir publicar.

## 5. Conferência

A **conferência** relata o estado atual da working copy (quantidade de
atribuições, horas, lacunas, sobreposições, durações atípicas) — nunca
compara automaticamente contra "o correto" nem contra a fonte original.
Quando existe uma fonte externa de verdade (a planilha importada, no
caso do Plantão), ela tem sua PRÓPRIA conferência, congelada e separada
— nunca substituída nem reconciliada silenciosamente com a conferência
da working copy. As duas aparecem lado a lado na UI, cada uma com seu
rótulo ("Escala atual" vs. "Fonte original"), nunca um único número
combinado.

## 6. O que fica explicitamente FORA do fluxo principal do Editor

Estes recursos podem existir no produto, mas nunca como parte do
caminho comum de importar/ver/editar/conferir/salvar — cada um exige
uma decisão de fase própria antes de entrar no Editor:

- Arrastar-e-soltar (drag-and-drop) para mover uma atribuição — avaliado
  na ESCALAS-UX-1C e deliberadamente NÃO implementado (§ 11.6): sem
  precedente no código, sem biblioteca instalada, sem um caminho de
  acessibilidade por teclado equivalente já estabelecido para copiar. A
  distribuição por clique/toque (§ 11.5) já cobre o objetivo de reduzir
  cliques sem esse risco.
- Geração automática / distribuição / rotação / autocomplete de
  plantonista — "Usar período anterior" (§ 11) copia uma ESTRUTURA já
  existente, nunca gera ou rotaciona pessoas sozinho.
- Múltiplos modos de cartão, customização manual de cor, compactação
  configurável — nenhum foi trazido dos protótipos antigos do
  dashboard; só a filosofia ("calendário fácil de ler + clique fácil
  para editar") foi reaproveitada, nunca a complexidade acumulada.
- Publicação (`publicarPlantao()` ou qualquer mudança de Firestore
  Rules) — fora de escopo desta fase e da definição de Editor em si;
  quando existir, será uma etapa POSTERIOR ao rascunho, nunca parte da
  edição em memória.

## 7. Origens suportadas pelo mesmo Editor

Fase ESCALAS-UX-1B formaliza a `origem` (`OrigemPlantao`, já existente
no contrato persistido desde a PLANTÃO-3A) como o único diferencial
entre as portas de entrada do Editor — nunca um segundo pipeline:

| Origem | Como a working copy nasce | `resultadoPlantao` (fonte congelada) |
| --- | --- | --- |
| `IMPORTADO` | `criarAtribuicoesEditaveis(resultado.atribuicoes)` a partir do parser | preenchido — alimenta a "Conferência da fonte" |
| `MANUAL` | `criarAtribuicoesEditaveis([])` — "+ Nova escala" → Plantão → Grupo + competência → Criar escala vazia | `null` — nunca uma `ResultadoParsePlantao` XLS fingida com 0/0/0 |
| `COPIADO` (Fase ESCALAS-UX-1C) | `copiarAtribuicoesParaNovaCompetencia()` a partir das atribuições PERSISTIDAS da competência EXATAMENTE anterior — "+ Nova escala" → Plantão → Grupo + competência → Usar período anterior | `null` — mesma regra do `MANUAL`, nunca um XLS fingido |
| `GERADO` (futuro) | reservado para um gerador determinístico (ver PLANTOES.md § 12/§ 15) | a decidir na fase que implementar |

Depois que a working copy existe, o restante do Editor — calendário,
lista, modal de edição, "Resumo do editor", "Conferência da escala
atual", dirty state, "Salvar rascunho" — é **idêntico**, independente da
origem. A única diferença visível é o painel "Fonte original"/
"Conferência da fonte": para `IMPORTADO` mostra as três camadas de
verdade da planilha (§ 5 acima); para `MANUAL` mostra apenas "Escala
criada manualmente" — nunca um XLS fingido, nunca `0 intervalos
importados` como se fosse um fato da fonte.

Para `MANUAL`, os vínculos (nome↔login) nascem TODOS já resolvidos: um
participante do Grupo é identificado por `login` desde o início (nunca
um nome de planilha a conciliar), então `vinculosDeParticipantesGrupoPlantao()`
(`lib/conciliacaoPlantoes.ts`) monta a lista já `VINCULADO` — a mesma
função `previaPlantaoValidavel()` que hoje decide se "Salvar rascunho"
libera para `IMPORTADO` decide, sem nenhuma mudança de lógica, também
para `MANUAL`.

**`COPIADO`** (Fase ESCALAS-UX-1C, ver § 11 abaixo) — copiar a escala de
uma competência anterior como ponto de partida (mencionado como
possibilidade em PLANTOES.md § 12) — foi implementado seguindo a MESMA
regra das demais origens: a working copy nasce via
`criarAtribuicaoEditavelDeCompetenciaAnterior()` (o equivalente de
`criarAtribuicoesEditaveis()` para este caso, `idLocal = "copiado-N"`),
nunca um quarto pipeline paralelo.

**Reabrir um rascunho existente (Fase ESCALAS-UX-1B.1) não é uma quarta
origem** — é uma quarta PORTA DE ENTRADA que preserva a origem já
persistida (`IMPORTADO` continua `IMPORTADO`, `MANUAL` continua
`MANUAL`). Ver § 10 abaixo.

## 8. Onde isso vive hoje

- `lib/editorPlantao.ts` — working copy pura (tipos + funções, sem
  React, sem Firestore) — igual para `IMPORTADO` e `MANUAL`.
- `lib/conciliacaoPlantoes.ts` — além da conciliação nome→login da
  planilha (`IMPORTADO`), ganhou na Fase ESCALAS-UX-1B
  `consolidarParticipantesGrupoPlantao()`/`vinculosDeParticipantesGrupoPlantao()`/
  `nomeParticipantePlantao()` — os equivalentes para `MANUAL` (participantes
  do Grupo, não da planilha).
- `lib/montagemRascunhoPlantao.ts` — `montarCompetenciaPlantaoRascunho()`/
  `montarAtribuicoesPlantaoRascunho()` recebem `origem` como parâmetro
  (Fase ESCALAS-UX-1B — antes hardcoded para `'IMPORTADO'`),
  `validarNovoPlantaoEmBranco()` valida só Grupo + competência, e
  (Fase ESCALAS-UX-1B.1) `reidratarRascunhoPlantao()` é a operação
  INVERSA — persistido → working copy — para reabrir um rascunho.
- `packages/contrato/src/modeloPlantaoPersistente.ts` — Fase
  ESCALAS-UX-1B.1: `converterInstanteUtcParaMomento()`, o inverso de
  `converterMomentoParaInstanteUtc()` (instante UTC persistido +
  timezone do Grupo → momento civil).
- `lib/firebase/plantaoReadRepository.ts` — Fase ESCALAS-UX-1B.1:
  `listarCompetenciasPlantaoRascunho()` (novo, lista os rascunhos de um
  Grupo) e `listarAtribuicoesPlantaoRascunho()` (já existia, ganhou
  `where('grupoId', ...)` para funcionar para um GESTOR_EQUIPE
  autorizado, não só ADMIN_SISTEMA — ver § 9).
- `lib/firebase/plantaoWriteRepository.ts` — Fase ESCALAS-UX-1B.1:
  `salvarAtribuicoesPlantaoRascunho()` ganhou limpeza de documentos
  órfãos (uma atribuição excluída depois de reaberta precisa deixar de
  existir no Firestore, não só parar de ser sobrescrita).
- `components/plantao/PlantaoCalendario.tsx` — visão de calendário.
- `components/plantao/ModalEditarAtribuicaoPlantao.tsx` — modal único
  de criar/editar.
- `apps/dashboard/src/DashboardApp.tsx` (`PreviewPlantao`,
  `ModalNovaEscala`) — orquestra a working copy, a conferência dupla e o
  rascunho, o fluxo "+ Nova escala", (Fase ESCALAS-UX-1B.1) "Abrir
  rascunho" e (Fase ESCALAS-UX-1C) "Usar período anterior" +
  distribuição rápida por clique (tela interna `plantoes`, chamada de
  "Grupos de Plantão" na UI desde a ESCALAS-UX-2A — ver nota abaixo — e
  o atalho dentro de "+ Nova escala"); nenhuma lógica de domínio nova
  mora aqui além da fiação de estado/props — a tradução de datas e os
  vínculos vivem em `lib/montagemRascunhoPlantao.ts`/
  `lib/conciliacaoPlantoes.ts` (§ 11).

**Nota (Fase ESCALAS-UX-2A) — navegação principal ≠ telas internas.**
A sidebar do Dashboard passou a refletir ÁREAS do produto ("Escalas",
"Administração", ...), nunca mais 1:1 com cada `Tela` interna — "Importar"
e "Grade" são formas de trabalhar dentro de "Escalas"; a administração de
Grupo de Plantão (`tela === 'plantoes'`, hoje rotulada "Grupos de
Plantão" na UI) é uma sub-tela de "Administração". O mapeamento
tela→área é uma função pura (`areaNavegacaoDaTela()`,
`lib/navegacaoDashboard.ts`) — nunca espalhado em ternários pelo JSX.
Isso é só reorganização de NAVEGAÇÃO: o Editor em si (working copy,
`PlantaoCalendario`, `ModalEditarAtribuicaoPlantao`, o round-trip do
rascunho) continua exatamente o mesmo descrito nas seções acima. Ver
`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 5 e
`CHECKPOINT-FASE-ESCALAS-UX-2A-NAVEGACAO.md`.

**Nota (Fase ESCALAS-UX-2A.1) — `ContextoEscalaAtivo` (`lib/contextoEscala.ts`).**
Registra formalmente qual escala está ativa (`{tipo:'JORNADA', equipeId,
competencia}` ou `{tipo:'PLANTAO', grupoId, competencia}`) — estado de
FRONTEND apenas, nunca persistido, identidade sempre por ID real (nunca
nome/sigla). É sincronizado explicitamente nos mesmos pontos onde
Grupo+competência de Plantão (`grupoRascunhoEscolhido`/
`competenciaRascunho`) ou Jornada (`resultado`/`usuarioEfetivo.equipeId`)
já passam a existir — nunca um `useEffect` reativo genérico (evitado
deliberadamente por gerar cascata de re-renders). O header do Dashboard
ganhou controles reais de "Escala atual"/"Competência"/"Status"
(`components/escalas/ScheduleContextSwitcher.tsx`/
`ScheduleCompetenceControl.tsx`/`ScheduleStatusBadge.tsx`) substituindo a
string estática anterior — nenhuma mudança no Editor em si (mesmo
`PlantaoCalendario`/`ModalEditarAtribuicaoPlantao`, mesmo
`abrirRascunhoNoEditorAcao()`, reaproveitados integralmente). Trocar de
contexto/competência com alterações não salvas é bloqueado por um guard
explícito (`UnsavedChangesDialog`). **Correção ESCALAS-UX-2A.1-FIX**: a
versão original desta fase reaproveitou `plantaoEditadoDesdeImportacao`
como fonte do guard de Plantão — errado, porque esse estado só significa
"a working copy divergiu do conteúdo importado", não "existe algo não
persistido" (uma escala vazia ou copiada do período anterior nunca
diverge de uma importação que não existiu, mas é 100% não salva). O guard
de cada domínio agora lê um dirty state próprio e explícito:
`plantaoPossuiAlteracoesNaoSalvas` (Plantão) e
`jornadaPossuiAlteracoesNaoSalvas` (Jornada — antes
`jornadaEditadaDesdeCarregamento`, incompleto: só cobria `editarCelula()`,
nunca os pontos de importação em si). `plantaoEditadoDesdeImportacao`
continua existindo, só para o indicador visual "divergiu da importação" —
nunca mais como guard. Ver `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 32,
`CHECKPOINT-FASE-ESCALAS-UX-2A1-CONTEXTO-ATIVO.md` e
`CHECKPOINT-FASE-ESCALAS-UX-2A1-FIX-DIRTY.md`.

A escala 6x1 não foi tocada nestas fases — este documento descreve o
conceito para que uma fase futura que precise dar ao 6x1 um Editor
equivalente (célula a célula, já existe de forma mais simples via
`celulaEditando`) tenha uma referência de vocabulário e princípios, não
para forçar uma unificação de código agora.

## 9. Limitação pré-existente de leitura corrigida no repository, não na Rule

A Rule de `rascunhosCompetenciasPlantao/{id}` e de
`rascunhosCompetenciasPlantao/{id}/atribuicoes/{atribuicaoId}` depende de
`resource.data.grupoId` (um campo do documento, não uma variável de
path) — o Firestore não consegue validar um `list` sem filtro contra
essa regra para ninguém além de ADMIN_SISTEMA (achado original da
PLANTÃO-3A, ver PLANTOES.md § 21.8). A ESCALAS-UX-1B.1 precisava que um
GESTOR_EQUIPE comum conseguisse listar os próprios rascunhos para
reabri-los — resolvido adicionando `where('grupoId', '==', grupoId)` às
duas consultas, no **repository** (`lib/firebase/plantaoReadRepository.ts`),
nunca na Rule: `firestore.rules` permanece com diff zero. O `where` não
amplia quem pode ler (confirmado por teste de Rules com um gestor de
outro grupo, que continua sem acesso) — só dá ao Firestore a informação
que faltava para validar a consulta.

## 10. Rascunho é retomável — o round-trip completo

O ciclo básico do Editor só fica completo quando "salvar" e "reabrir"
são o inverso exato um do outro:

```
  criar/importar
        |
        v
  WORKING COPY  (AtribuicaoPlantaoEditavel[])
        |
        v      montarAtribuicoesPlantaoRascunho() + converterMomentoParaInstanteUtc()
   RASCUNHO PERSISTIDO  (AtribuicaoPlantaoPersistida[], instante UTC)
        |
        v      reidratarRascunhoPlantao() + converterInstanteUtcParaMomento()
  WORKING COPY  (de novo — mesmo tipo, mesmo Editor)
        |
        v
   editar / salvar de novo
```

Garantias que fazem esse ciclo seguro:

- **Round-trip temporal exato**: `converterInstanteUtcParaMomento()` é o
  inverso de `converterMomentoParaInstanteUtc()` — o horário civil que o
  coordenador digitou volta a ser exibido, nunca o instante UTC como se
  fosse a hora digitada. Testado para várias timezones/horas em
  `packages/contrato/test/modeloPlantaoPersistente.test.ts`, nunca
  dependente da timezone da máquina que roda o código.
- **Origem preservada**: reabrir nunca transforma `IMPORTADO` em
  `MANUAL` nem vice-versa (§ 7/§ 9 acima).
- **Identidade estável**: a working copy reidratada usa
  `idLocal = "rehidratado-${atribuicaoId}"` (nunca posicional) — editar/
  excluir depois de reabrir nunca confunde qual atribuição é qual.
- **Sincronização exata ao salvar de novo**: o conjunto persistido
  precisa ficar EXATAMENTE igual à working copy — nunca só "o que está
  na working copy foi gravado", também "o que não está mais na working
  copy foi removido". `salvarAtribuicoesPlantaoRascunho()` diz quais
  `atribuicaoId` já existiam (mesma competência) e inclui `batch.delete()`
  para os que saíram, no MESMO lote das atualizações — nunca uma segunda
  chamada separada que poderia deixar o Firestore num estado misto.
- **Participante inativo referenciado nunca desaparece**: uma
  atribuição persistida continua aparecendo mesmo que o participante
  tenha sido desativado depois de salva (`reidratarRascunhoPlantao()`
  resolve o nome de qualquer participante, ativo ou não); só o `<select>`
  de novas atribuições considera participantes ativos.
- **Conferência da fonte nunca é reconstruída**: para um rascunho
  reaberto — `IMPORTADO` ou `MANUAL` — `resultadoPlantao` permanece
  `null`. O modelo persistido nunca guardou a contabilidade por
  plantonista declarada na planilha original (só os dois agregados da
  competência, `totalBruto`/`totaisInformadosOrigem`); inventar essa
  reconstrução seria fabricar dado que não existe. Registrado como
  limitação conhecida, não uma omissão silenciosa — ver PLANTOES.md
  § 26.2.
- **Grupo sempre atual**: reabrir usa a configuração ATUAL do Grupo
  (nome, timezone, participantes) para a UI/autorização — nunca um
  snapshot de quando o rascunho foi salvo. As atribuições persistidas
  em si nunca mudam por isso. Se a timezone do Grupo mudar DEPOIS de um
  rascunho ser salvo, o round-trip usa a timezone ATUAL para reabrir —
  um instante UTC persistido sob uma timezone antiga seria exibido com
  o horário civil errado. O modelo não guarda um snapshot de timezone
  por competência; risco registrado (não resolvido nesta fase — mudar o
  schema para snapshot exigiria autorização explícita de uma fase
  própria).

## 11. "Usar período anterior" + distribuição rápida por clique (Fase ESCALAS-UX-1C)

Terceira forma de começar uma competência de Plantão, ao lado de
"Importar planilha" (§ 5) e "Criar escala vazia" (§ 7/`MANUAL`) — as
TRÊS terminam no mesmo `AtribuicaoPlantaoEditavel[]` → mesmo
`PlantaoCalendario` → mesmo `ModalEditarAtribuicaoPlantao` → mesma Lista
→ mesma Contabilidade → mesmo "Salvar rascunho" (testado em
`tests/plantao-editor-boundaries.test.mjs`, testes 26/31/32).

### 11.1 Competência anterior é exata, nunca "a mais recente"

`competenciaAnterior()` (`lib/montagemRascunhoPlantao.ts`) é uma função
pura que calcula a competência exatamente um mês antes (`2026-09` →
`2026-08`; `2026-01` → `2025-12`, com o rollover de ano) — nunca "a
competência mais recente disponível para o Grupo". Se essa competência
exata não tiver rascunho persistido, "Usar período anterior" fica
desabilitado no modal e, se acionado mesmo assim, mostra "Não existe uma
escala anterior para este Plantão." (nunca cria uma escala vazia
disfarçada).

### 11.2 Tradução de datas — offset + span, nunca "+31 dias"

`copiarAtribuicoesParaNovaCompetencia()` não soma um número fixo de
dias (competências têm 28/29/30/31 dias). Para cada atribuição
anterior: converte início/fim para civil (`converterInstanteUtcParaMomento`),
calcula `offsetInicio` (posição do dia de início relativa ao começo da
janela anterior — pode ser negativo, dia de contexto) e `spanDias` (a
duração intrínseca da atribuição em dias, tipicamente 0-2), aplica o
MESMO offset ao início da janela nova, e recalcula o fim somando o
mesmo `spanDias` — nunca recalculando a duração a partir de zero. Isso
preserva a posição relativa (1º dia da janela anterior → 1º dia da
janela nova) independente de quantos dias cada mês tem.

### 11.3 Competências de tamanhos diferentes — nunca truncar ou inventar

Quando a nova janela é mais curta que a anterior (ex.: anterior com 31
dias, nova com 28), uma atribuição cujo início traduzido cai fora de
`[períodoNovoInício - 1 dia, períodoNovoFim + 1 dia]` (mesma tolerância
de "dia de contexto" já usada por `ehDiaDeContexto()`) é EXCLUÍDA da
cópia — nunca deslocada para uma posição arbitrária, nunca truncada
silenciosamente. `copiarAtribuicoesParaNovaCompetencia()` retorna
`quantidadeNaoCopiada` para a UI poder avisar o coordenador quando isso
acontece (mensagem em `usarPeriodoAnteriorAcao()`).

### 11.4 Horário civil e durações atípicas preservados, nunca normalizados

O horário (`hora`) nunca é alterado — só a data muda. `duracaoMinutos`
é copiado verbatim do registro persistido (nunca recalculado a partir
das datas traduzidas), então uma duração atípica (43h, 5h) sobrevive
exatamente igual. Testado em `lib/montagemRascunhoPlantao.test.ts`
(inclui um caso de fronteira de 43h).

### 11.5 Vínculos — participante ativo nunca troca sozinho

`vinculosDeCopiaAnterior()` (`lib/conciliacaoPlantoes.ts`) reaproveita o
MESMO mecanismo de vínculo pendente/sugestão já usado para `IMPORTADO`
(§ 5): login ainda ativo no Grupo → `VINCULADO` automático; login
conhecido mas não mais um participante ativo → `PENDENTE` com uma
`sugestao` apontando para o próprio login (um clique reconfirma e
reativa, via `confirmarVinculoPlantao()`/`montarParticipantesPlantaoParaSalvar()`,
sem nenhuma UI nova); login desconhecido → `USUARIO_NAO_ENCONTRADO`.
Nunca troca automaticamente por outra pessoa — "Salvar rascunho"
continua bloqueado por pendências, exatamente como já acontecia para
planilhas com nomes ambíguos.

### 11.6 Distribuição rápida por clique — nunca inventa horário

Um painel compacto (dentro do já existente "Resumo por pessoa") permite
selecionar UM plantonista (seleção puramente de UI, nunca grava no
Firestore/Grupo — `plantonistaSelecionadoPlantao`, reiniciada em toda
entrada nova no Editor). Com uma pessoa selecionada, tocar um dia vazio
do calendário abre o MESMO modal de criação (`abrirCriacaoAtribuicaoPlantao`)
já com "Plantonista" preenchido — início/fim continuam vazios, o
coordenador sempre confirma o horário explicitamente. Sem seleção, o
comportamento é idêntico ao de antes desta fase.

> **Nota de implementação (ESCALAS-UX-2B)**: o "painel compacto dentro do
> Resumo por pessoa" descrito acima foi REPOSICIONADO para um roster
> lateral (`PlantaoRoster`) — mesmo mecanismo de seleção
> (`plantonistaSelecionadoPlantao`/`alternarPlantonistaSelecionado`),
> nenhuma reimplementação. Drag-and-drop, avaliado e adiado aqui, foi
> implementado nessa fase como um SEGUNDO gatilho para a mesma operação —
> ver seção 12.

Drag-and-drop foi avaliado e **deliberadamente NÃO implementado** nesta
fase (ESCALAS-UX-1C): não existe nenhum precedente de arrastar-elemento no código (só o
dropzone de upload de planilha, um caso não relacionado), nenhuma
biblioteca de drag está instalada, e a alternativa nativa HTML5
introduziria um padrão de interação novo sem um equivalente
acessível-por-teclado já estabelecido para copiar — um risco real de
acessibilidade. **Distribuição por clique está completa. Drag-and-drop
continua melhoria opcional futura.**

"Repetir último horário" (atalho de sessão sugerindo o último horário
digitado) foi avaliado e também NÃO implementado — mesmo critério de
simplicidade: o ganho é pequeno frente ao risco de criar uma segunda
forma de preencher horário que o coordenador precisaria aprender.

### 11.7 Origem `COPIADO` — decisão sobre `firestore.rules`

Diferente das fases anteriores desta série (que mantiveram
`firestore.rules` com diff zero), `COPIADO` exigiu adicionar o valor à
lista de enum aceita em 4 ocorrências de `origem in [...]` dentro do
mesmo bloco `rascunhosCompetenciasPlantao/{id}` já existente — uma
mudança mecânica e simétrica às 3 anteriores, sem nenhuma condição de
autorização nova, sem campo novo, sem coleção nova. Avaliada como NÃO
"significativa" pelo mesmo critério que barrou mudanças de schema mais
profundas nesta série de fases; verificada empiricamente no emulador
(`tests/firebase/firestore.rules.test.ts`, 155/155).

## 12. ESCALAS-UX-2B — roster lateral + montagem rápida + drag-and-drop

Primeira evolução visual/operacional do Editor de Plantão desde a
ESCALAS-UX-1A: reposiciona a seleção de plantonista para um roster
lateral sempre visível, adiciona drag-and-drop nativo HTML5 como segundo
gatilho da mesma criação por clique, e passa a consumir
`GrupoPlantao.padraoHorarioSemanal` (PLANTAO-PADRAO-1) como sugestão de
horário via um popover de confirmação. Nenhuma mudança de schema, Rules
ou domínio de Jornada 6x1.

### 12.1 Roster lateral (`PlantaoRoster`)

Substitui o antigo bloco "Resumo por pessoa" (que ficava abaixo do
calendário, full-width, exigindo scroll) por um painel lateral de
230–280px, sempre visível, com rolagem própria (`position: sticky`).
Reaproveita INTEGRALMENTE:

- `resumirPorPessoa()` para os contadores (nenhum recálculo);
- `plantonistaSelecionadoPlantao`/`alternarPlantonistaSelecionado()` para
  seleção (mesmo mecanismo desde ESCALAS-UX-1C);
- `indiceIdentidadePlantonista()` para a identidade visual (mesmo hash
  determinístico dos cartões do calendário — nenhuma paleta paralela,
  nenhum seletor manual de cor).

Busca aparece só quando a lista ultrapassa 8 pessoas
(`LIMITE_PESSOAS_SEM_BUSCA`). Participantes inativos (mas referenciados
por alguma atribuição) e com vínculo pendente ganham uma tag
(`.status-badge`) — nunca escondidos.

### 12.2 Operação comum de criação — click e drag convergem

`solicitarNovaAtribuicaoPlantao(plantonistaNomeOriginal, dataIso)`
(`DashboardApp.tsx`) é o ÚNICO ponto de entrada para uma nova atribuição,
independente de como o usuário chegou até ele:

- clicar uma pessoa no roster (seleciona) + clicar/tocar um dia do
  calendário;
- arrastar (`draggable`) uma pessoa do roster e soltar (`onDrop`) sobre
  um dia — desktop apenas, HTML5 nativo, nenhuma biblioteca adicionada;
- clicar "+ Adicionar" (sempre presente, acessível por teclado) com uma
  pessoa já selecionada.

A decisão que essa função toma (atualizada na ESCALAS-UX-2B.1 — ver §12.10):

```
data FORA do período da competência ativa (dataPertenceCompetencia)
    -> no-op silencioso, nada acontece

sem plantonista (string vazia)
    -> abre o editor completo (ModalEditarAtribuicaoPlantao), como sempre

com plantonista, sem padrão configurado para o dia
    -> abre o editor completo, plantonista pré-preenchido

com plantonista E padrão configurado (obterPadraoHorarioGrupoParaData)
    -> abre QuickAddPlantaoPopover (confirmação explícita)
```

O DROP em si **nunca grava nada** — só chama a mesma função que o clique
chama; quem decide o que abrir é sempre `solicitarNovaAtribuicaoPlantao`,
nunca o evento de drag em si.

### 12.3 Quick-add (`QuickAddPlantaoPopover`)

Confirmação contextual do padrão do Grupo — pessoa, data, e o preview
humano (`previewPadraoHorarioPlantaoDia()`, o MESMO helper já usado na
Administração do Grupo, PLANTAO-PADRAO-1 — nunca uma segunda
implementação, nunca expõe `fimDiaOffset` cru). Três ações: "Adicionar"
(confirma), "Outro horário" (fecha e abre o editor completo,
pré-preenchido), Escape/backdrop/X (cancela sem tocar a working copy).

Implementado como dialog pequeno central (`.edit-modal`, mesmo chrome de
todo modal do Dashboard) em vez de um popover ancorado à célula —
avaliado e decidido por confiabilidade: posicionamento ancorado exigiria
lidar com overflow do calendário, scroll interno e proximidade da borda
da tela, complexidade desproporcional ao ganho nesta primeira
implementação. Nenhuma biblioteca de posicionamento (Popper/Floating UI)
foi adicionada.

### 12.4 Construção pela padrão — `construirAtribuicaoDoPadraoHorario()`

Único helper puro (`lib/editorPlantao.ts`) que transforma
`{ plantonistaNomeOriginal, dataCivil, padrao }` em
`{ plantonistaNomeOriginal, inicio, fim }` — reaproveita `adicionarDias()`
(`@escala-ici/contrato`) para a virada de dia (`fimDiaOffset`), nunca um
cálculo de data manual. A data de INÍCIO é sempre `dataCivil`; a de FIM
é `dataCivil` ou `dataCivil + 1 dia`, conforme `fimDiaOffset`. O
resultado alimenta o MESMO `adicionarAtribuicaoEditavel()` que o modal
completo já usava — nenhum objeto de atribuição construído em outro
lugar (drag/click/quick-add/modal completo convergem para uma única
função de escrita na working copy,
`criarAtribuicaoPlantaoNaWorkingCopy()`).

### 12.5 Dirty guard — sem regressão da FIX

`criarAtribuicaoPlantaoNaWorkingCopy()` chama `marcarPlantaoEditadoNoEditor()`
(que seta `plantaoPossuiAlteracoesNaoSalvas = true`, o único sinal lido
pelo guard de troca de contexto desde `ESCALAS-UX-2A.1-FIX`) — nunca
`plantaoEditadoDesdeImportacao` sozinho. Toda nova atribuição, venha de
click, drag ou quick-add, passa por essa mesma função — nenhum caminho
novo escapa do dirty real.

### 12.6 Importados intactos

Adicionar uma atribuição pelo padrão nunca recalcula/normaliza as
atribuições já existentes — `adicionarAtribuicaoEditavel()` só
ACRESCENTA ao array, nunca mapeia/edita os elementos existentes.
Intervalos atípicos importados (43h/5h da fixture real) permanecem
byte-a-byte idênticos depois de uma criação via padrão — testado
explicitamente (`lib/editorPlantao.test.ts`, "atribuições importadas
atípicas permanecem intactas").

### 12.7 Mobile/tablet

Sem drag no mobile (toque não dispara eventos HTML5 de drag — nenhum
polyfill adicionado, comportamento nativo do navegador). Fluxo principal:
tocar pessoa (roster) → tocar dia → quick-add → "Adicionar", idêntico ao
desktop sem a etapa de arrastar. Roster stacka ACIMA do calendário
(`@media (max-width: 780px)`, mesmo breakpoint já estabelecido para o
calendário de Plantão) com sua lista de pessoas virando uma faixa
horizontal com rolagem PRÓPRIA (nunca a página inteira). Em telas
intermediárias (`@media (max-width: 960px)`) o roster estreita de 260px
para 200px antes de empilhar — nunca esmaga o calendário para manter uma
largura fixa.

### 12.8 Acessibilidade

Cada pessoa do roster é um `<button>` real com `aria-pressed` e
`draggable` no MESMO elemento (nunca um elemento paralelo só-para-drag).
"+ Adicionar" continua um `<button>` focável em todo dia — a alternativa
por teclado obrigatória mesmo com drag disponível (Tab até a pessoa →
Enter seleciona → Tab até o dia → Enter/clique em "+ Adicionar" abre a
criação). Nenhuma implementação de "drag por teclado" — a ação discreta
já é suficiente.

### 12.9 Limitações conhecidas

- O drop tem um pequeno flicker de estado visual (`drop-alvo`) quando o
  cursor passa por cima de um cartão/botão filho antes de sair do dia —
  aceitável, não usa animação, realce sutil (§21 do pedido).
- O quick-add é um dialog central, não um popover ancorado à célula —
  decisão deliberada de confiabilidade (seção 12.3), não uma limitação
  técnica.
- O redesign do Resumo/Contabilidade/Lista/Vínculos permanece fora de
  escopo (ESCALAS-UX-2C).

Ver `CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md` para o detalhamento
completo desta fase.

### 12.10 Limites da competência (Fase ESCALAS-UX-2B.1)

Correção: uma NOVA atribuição criada pela UI (click, drag, "+ Adicionar"
ou quick-add) só pode ter **data inicial** dentro do período real da
competência ativa — `periodoInicio <= dataInicial <= periodoFim`
(`periodoDaCompetencia()`, mesma janela 26→25 de sempre, reaproveitada
pelo novo helper `dataPertenceCompetencia(dataIso, competencia)`,
`lib/montagemRascunhoPlantao.ts`). Dias exibidos só como contexto visual
(antes do dia 26 ou depois do dia 25, servindo apenas para completar as
semanas do calendário — `ehDiaDeContexto()`) nunca aceitam iniciar uma
atribuição nova.

**O TÉRMINO pode ultrapassar o período** — nunca limitado. `25/08 19:00
→ 26/08 07:00` (12h) e `25/08 19:00 → 26/08 19:00` (24h) continuam
válidos porque o INÍCIO (25/08) pertence à competência; o fim cair um
dia depois nunca é bloqueado.

Gate único e definitivo: `solicitarNovaAtribuicaoPlantao()` (o mesmo
funil de click/drag/"+ Adicionar"/quick-add desde §12.2) verifica
`dataPertenceCompetencia(dataIso, competenciaRascunho)` como o PRIMEIRO
passo — fora do período, retorna sem tocar a working copy nem marcar
dirty (no-op silencioso). `PlantaoCalendario` também omite a UI de
criação num dia de contexto (sem "+ Adicionar", sem clique de fundo, sem
aceitar drop — `onDragOver` não chama `preventDefault()`, então o
navegador recusa o drop nativamente ANTES de soltar, nunca um erro
depois) — essa omissão de UI é só reforço, o gate real é sempre a função
do Dashboard.

**Atribuições já existentes/importadas NUNCA são normalizadas por esta
regra** — o gate só se aplica à criação de NOVAS atribuições pela UI.
Um dia de contexto continua mostrando qualquer atribuição que já exista
nele (ex.: a borda real de 43h de uma planilha importada, que começa um
dia antes do início da janela) — `dataPertenceCompetencia()` nunca é
chamado por `lib/editorPlantao.ts`/`lib/conciliacaoPlantoes.ts`
(confirmado por boundary test).

Ver `CHECKPOINT-FASE-ESCALAS-UX-2B1-LIMITES-COMPETENCIA.md` para o
detalhamento completo desta correção.

## 13. Hierarquia visual da revisão importada de Plantão

A revisão importada abre diretamente em **Calendário**, seguido pelos cards de
fonte e divergências. O upload identificado como Plantão usa uma faixa compacta
para substituir o arquivo. Permanecem apenas **Calendário**,
**Contabilidade** e **Vínculos**; as abas **Resumo** e **Lista** não integram
mais o editor. Isso não remove diagnóstico: erros estruturais, contabilidade
de origem e divergências continuam disponíveis abaixo da visualização
operacional.

Os cartões do calendário importado usam linha horizontal com iniciais maiores
e intervalo compacto (`19h–07h`). O valor completo continua no nome acessível
do botão e a working copy não é modificada pela formatação.

Em **Vínculos**, um participante sem correspondência oferece **Criar e
vincular**. O modal reutiliza o cadastro existente, vincula somente após
`salvarUsuario()` concluir e fixa a equipe no `equipeResponsavelId` do Grupo.
Não se usa a equipe nem o UID do coordenador como fallback, e falha de Rules
permanece erro do modal, sem vínculo local enganoso.
