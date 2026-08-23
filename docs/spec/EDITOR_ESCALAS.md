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

## 14. Vínculos da importação de Jornada/6x1 (Fase JORNADA-IMPORTACAO-VINCULOS-UX-1)

### 14.1 Causa raiz do problema: uma UI existente, mas inatingível no fluxo real

A Jornada/6x1 já tinha seu próprio mecanismo de conciliação nome→usuário
(`lib/conciliacaoUsuarios.ts`, irmão — mas não o mesmo código — de
`lib/conciliacaoPlantoes.ts`, usado pelo Plantão): uma tabela com seletor de
usuário, "salvar como alias" e "ignorar". O defeito não era a ausência dessa
lógica, e sim onde ela era renderizada: essa tabela só existia dentro da tela
`'importar'` de `DashboardApp.tsx`. O wizard "Nova escala" para Jornada,
porém, pula direto para a tela `'grade'` (`setTela(wizardTipo === 'JORNADA' ?
'grade' : 'importar')`), que renderiza somente `ScheduleImportReview` — sem a
tabela de conciliação. Resultado: no fluxo real de importação de Jornada, a
pessoa nunca via nem alcançava a única UI de vínculo já existente. Os
contadores de "alertas" e o texto "Revisar" da Saúde da origem também eram
puramente decorativos — nenhum tinha `onClick`.

### 14.2 Correção: o painel de conciliação virou parte do `ScheduleImportReview`

A tabela de conciliação (associar/criar/alias/marcar pendente/ignorar) saiu
de `DashboardApp.tsx` e passou a viver dentro de `components/
ScheduleImportReview.tsx`, numa seção "Pendências e vínculos" com âncora
própria (`id="soc-import-review-pendencias"`) — como o componente é usado nas
duas telas (`'importar'` e `'grade'`), o painel agora aparece nas duas, sem
duplicar a lógica. `DashboardApp.tsx` continua dono de todo o estado e das
escritas (Firestore, auditoria) — só repassa os handlers via props
(`onSelecionarVinculo`, `onCriarUsuario`, `onSalvarAlias`, `onMarcarPendente`,
`onIgnorar`).

Ficaram acionáveis:

- O contador "N alertas" do resumo (agora `<button>`) rola até a seção de
  pendências.
- A badge "Revisão necessária" e o botão "Revisar pendências" do card
  "Saúde da origem" fazem a mesma rolagem.
- Cada linha do colaborador na lista lateral que ainda tem pendência de
  conciliação (`role="button"`) abre um modal "Vincular colaborador
  importado" com o nome como veio da planilha, iniciais, turnos importados
  e status — e permite associar a um usuário existente, criar um novo,
  salvar alias ou ignorar, sem sair da tela de importação.
- Cada linha acionável de "Pendências da fonte" (as que correspondem a uma
  linha de conciliação) abre o mesmo modal.

Nenhuma correspondência por semelhança/fuzzy foi introduzida:
`conciliarNome()` continua exata (login/alias/e-mail/nome normalizado);
"possível correspondência" continua modelada pelo status `CONFLITO_ALIAS`
(múltiplos candidatos), nunca por um score de similaridade.

### 14.3 "Criar usuário" a partir de uma pendência sempre herda a equipe da importação

`abrirCadastroUsuarioParaConciliacao(linha)` pré-preenche `nome` e
`aliasesPlanilha` com o nome como veio da planilha (nivelHierarquico 6,
perfil/escopo padrão, mesmo desenho do "Criar e vincular" do Plantão). A
equipe do cadastro nunca é a equipe do próprio coordenador nem uma escolha
livre — é sempre a equipe da Jornada em importação
(`contextoEscalaAtivo.alvoId`), inclusive quando o "cadastro livre de
staging" (`STAGING_RESET_HIERARQUIA_ICI.md`) está ativo: esse modo fica
desligado especificamente para este fluxo, porque o alvo já é conhecido pela
importação. Ao salvar, o usuário criado resolve a pendência automaticamente
(`resolverManualmente`) — sem passo manual adicional.

### 14.4 Reaproveitamento do padrão do Plantão — o que foi e o que não foi compartilhado

Compartilhado: o modal de cadastro/edição de usuário (`formularioUsuario` e
todo o seu ciclo de vida em `DashboardApp.tsx`), incluindo o mesmo padrão de
"estado paralelo" que o Plantão já usava (`participanteVinculoCadastro`) —
Jornada ganhou seu próprio estado irmão (`linhaConciliacaoVinculoCadastro`),
mutuamente exclusivo com o do Plantão. Os textos e o rótulo do botão
("Criar e vincular colaborador") do modal também passaram a cobrir os dois
casos.

Não compartilhado (propositalmente): a lógica de matching em si
(`lib/conciliacaoUsuarios.ts` vs. `lib/conciliacaoPlantoes.ts`) — Jornada
concilia por **linha de planilha** (`LinhaConciliacao`, N nomes → N
usuários), Plantão concilia por **participante do Grupo** (identidade já é o
`login`, quando existe). Forçar um modelo único nesta fase teria sido reescrever
os dois fluxos sem necessidade — os dois continuam sendo "irmãos", não a
mesma função.

### 14.5 Auditoria

`registrarAuditoriaAdmin()` ganhou campos opcionais (`unidadeId`,
`competencia`, `nomeImportado`, `usuarioVinculadoLogin`, `origem`), todos
`null` quando omitidos — nenhuma chamada existente muda de comportamento, e
as Rules de `auditoriaAdmin` (`souAdminSistema() || souCoordenadorOperacionalStaging()`)
não têm allowlist de campos, então nada precisou mudar lá. Passaram a
auditar (antes não auditavam): associar usuário existente
(`ASSOCIAR_USUARIO_IMPORTACAO`), adicionar alias
(`ADICIONAR_ALIAS_IMPORTACAO`) e ignorar pendência
(`IGNORAR_PENDENCIA_IMPORTACAO`); criar usuário continua sob
`SALVAR_USUARIO`, agora com o contexto de importação anexado quando aplicável.

### 14.6 Nenhuma regra nova em `firestore.rules`

Todas as escritas do novo fluxo (criar usuário via
`contextoCadastroOperacionalAutorizaUsuario`, atualizar `aliasesPlanilha` via
o ramo de update já existente, gravar `auditoriaAdmin`) já eram autorizadas
pelas regras das fases STAGING-RESET-HIERARQUIA-ICI-1/2, inclusive em
staging via `souCoordenadorOperacionalStaging()`. Confirmado por teste
(`tests/firebase/firestore.rules.test.ts`, describe
`JORNADA-IMPORTACAO-VINCULOS-UX-1`) antes de descartar a hipótese de
alteração nas Rules.

## 15. PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — publicação, diagnóstico e visualização compacta/edição

### 15.1 Publicação de Plantão desbloqueada (causa raiz em `firestore.rules`)

A mensagem "As regras de escrita ainda não reconhecem a matriz operacional
neste ambiente." bloqueava a **publicação** de um Plantão mesmo com o
`GESTOR_UNIDADE` corretamente reconhecido pela Matriz (rascunho salvava
normalmente). Causa raiz: `publicarCompetenciaPlantao()`
(`lib/firebase/plantaoWriteRepository.ts`) sempre faz um `getDoc()` em
`competenciasPlantao/{id}` antes de escrever, para saber se já existe uma
revisão anterior a substituir. Na primeira publicação de uma competência esse
documento ainda não existe — `resource` é `null` em `firestore.rules`, e
`resource.data.grupoId` não podia ser resolvido, o que estourava o limite de
1000 expressões da regra (erro de avaliação, reportado ao client como
`permission-denied` comum). Corrigido com curto-circuito na leitura de
`competenciasPlantao/{id}`: `!exists(...) || podeLerEscalaPlantao(...)`. Ver
`docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md` § 9.6/§ 10 para o texto completo e
`tests/firebase/firestore.rules.test.ts` (describe
`PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1`) para a prova empírica.

Do lado client, `publicarPlantaoAcao()` também passou a recalcular
`podeGerenciarEsteGrupoPlantao(grupo)` no momento da falha (antes usava um
`true` fixo), igual a `salvarRascunhoPlantaoAcao()` — a mensagem de "matriz"
só aparece quando o usuário atual de fato não é reconhecido. Um diagnóstico
(`diagnosticarFalhaEscritaPlantao()`, só fora de produção, nunca loga
login/e-mail/nome) mostra no console operação/caminho/`grupoId`/`unidadeId`/
`equipeId`/perfil/escopo/código do erro real.

### 15.2 Visualização compacta/edição do calendário de Plantão

O calendário (`PlantaoCalendario`) já tinha dois modos visuais distintos —
`modo="importacao"` (um mês por vez, legenda lateral, foco em conferência,
sem roster/arrastar) e `modo="editor"` (grade da competência inteira, roster
lateral, criar/editar/arrastar) — mas a escolha entre eles era automática
(`resultado !== null`), então reabrir um rascunho salvo (`resultado` volta a
`null`) trocava de visual sem o usuário pedir, dando a impressão de duas
telas diferentes para a mesma escala.

`PreviewPlantao` agora expõe essa escolha como um seletor visível
("Compacta" / "Edição (arrastar)"), reaproveitando os dois modos já
existentes — nenhum componente novo, nenhuma lógica de negócio duplicada. A
preferência persiste em `localStorage` (`escalaIci.plantao.viewMode`,
valores `compacta`/`edicao`) só para lembrar a escolha entre sessões; nunca é
lida como fonte de participantes/atribuições/vínculos, e nunca influencia o
que é salvo ou publicado. Quando o Plantão é `somenteConsulta` (permissão
real de só-consulta), o seletor some e o calendário fica sempre em
`modo="consulta"`, independente da preferência salva — permissão real nunca
é sobreposta por preferência cosmética.

## 16. PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — cargo real, usuários por escopo de Plantão e mensagem do App

Três correções cirúrgicas, sem tocar seed/reset, sem novo grupo, sem alterar
a publicação do Plantão COSI. Base de leitura para uma futura visão completa
de Plantão no App — **não implementada nesta fase**.

### 16.1 Cargo real prevalece sobre o fallback

O cabeçalho do App (`components/AppFrame.tsx`) mostrava um rótulo fixo —
`usuario.nivelHierarquico <= 5 ? 'Coordenador' : 'Analista SOC'` — que nunca
lia `usuario.cargo`, mesmo quando o cargo real (ex.: "Analista de Segurança
da Informação") já estava cadastrado em `usuarios/{login}`. A leitura
(`lerUsuario()`, `lib/firebase/shared.ts`) e a escrita (criar/editar usuário,
`DashboardApp.tsx`) já preservavam `cargo` corretamente — o bug era só de
apresentação, em um único componente.

Corrigido com `rotuloCargoExibicao(usuario)` (`lib/sessao.ts`): retorna
`usuario.cargo` sempre que não estiver vazio; só cai no fallback (baseado em
`perfilEfetivo()` — "Coordenador" para ADMIN_SISTEMA/GESTOR_EQUIPE/
GESTOR_UNIDADE/SUPERVISOR_EQUIPE, "Analista SOC" para o resto) quando o
cargo está vazio. O fallback nunca é persistido — é só uma função de
formatação para exibição, chamada a cada render.

### 16.2 Usuários visíveis no contexto Plantão

A tela Usuários do Dashboard renderiza direto o estado `usuarios` — quem o
alimenta é quem troca de contexto. `aplicarTrocaContexto()` já reidratava
esse pool corretamente (via `listarUsuariosElegiveisPlantao(equipeResponsavelId,
grupoId, unidadeResponsavelId, equipesConsulta)` — equipe responsável +
equipesConsulta + unidade responsável, o mesmo pool amplo que o vínculo/
importação de Plantão já usa) **somente quando havia um rascunho para
reidratar** (dentro de `abrirRascunhoNoEditorAcao()`). Um Plantão já
Publicado, sem rascunho aberto — o caso mais comum depois de publicar —
tomava o branch de retorno antecipado sem popular `usuarios`, deixando a
tela com o pool da última troca de equipe (ex.: busca por "jean" vazia,
mesmo com Jean vinculado como participante ativo do Plantão COSI).

Corrigido acrescentando a mesma chamada, tolerante a falha (nunca deriva a
tela inteira), ao `Promise.allSettled` que já lê rascunho/publicada do
Plantão em `aplicarTrocaContexto()` — populando `usuarios` incondicionalmente
ao entrar no contexto, antes de qualquer branch de "sem rascunho". Nenhuma
regra nova: mesma função, mesmo pool, um ponto de chamada a mais (5 no
total, ver `tests/plantao-vinculo-gestor-participante-boundaries.test.mjs`).

### 16.3 Participação em Plantão nunca altera perfil/cargo/equipe principal

Confirmado (schema + testes): `ParticipantePlantao`
(`packages/contrato/src/modeloPlantaoPersistente.ts`) não tem `perfil`,
`escopo` nem `equipeId` — só `grupoId`/`login`/`ativo`/`contatos`/metadados
de auditoria. Um usuário SOC (`equipeId GEDSI_COSI_SOC`) pode participar do
Plantão COSI (`gruposPlantao/{grupoId}/participantes/{login}`) sem que isso
toque `usuarios/{login}.perfil`/`.cargo`/`.equipeId` — vínculo de escala e
cadastro de acesso são registros completamente separados, na mesma linha já
estabelecida por `docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md`.

### 16.4 App diferencia ausência de Jornada de participação em Plantão

Antes, não encontrar uma Jornada 6x1 publicada (`carregarMinhaEscala()`,
único caminho consultado) sempre gerava "Nenhuma escala publicada foi
encontrada para o seu login neste período." — mesmo para um login (como
Jean) sem Jornada mas **com** participação real em Plantão. O App nunca
consultava Plantão.

`mensagemAusenciaEscalaAcao()` (`apps/app/src/EmployeeApp.tsx`) agora
verifica, de forma tolerante (uma Rules/Matriz que ainda não reconhece a
consulta neste ambiente nunca quebra o login — cai no fallback), se o login
aparece como participante ativo em algum Grupo de Plantão que a própria
equipe já pode consultar (`listarGruposPlantaoPermitidos(equipeId)` +
`listarParticipantesPlantao(grupoId)`, funções de leitura já existentes,
nenhuma Rule nova). Duas mensagens, nunca mais uma genérica:

- Sem Jornada e sem Plantão: **"Nenhuma jornada 6x1 encontrada para este
  período."**
- Sem Jornada, mas com participação em Plantão: **"Você possui participação
  em Plantão. A visualização detalhada será exibida na aba Plantão."**

**Esta fase não implementa** a visão detalhada de Plantão no App (calendário,
aba própria) — só a leitura/mensagem-base. Hoje, Agenda e Trocas continuam
inalterados (nenhuma tela nova, nenhuma escrita administrativa de Plantão no
App).

## 17. PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — navegação preservada na troca de contexto e filtro de setor em Usuários

### 17.1 Trocar contexto não força mais "Escalas"

`aplicarTrocaContexto()` sempre chamava `setTela('escalas')`/`setTela('grade')`
ao trocar o seletor superior (SOC ⇄ Plantão COSI), mesmo quando o usuário
estava numa tela de navegação principal (Usuários, Visão geral, Trocas,
Administração) — telas que continuam perfeitamente válidas em qualquer
contexto, já que não dependem do editor/rascunho da escala ativa.

Corrigido capturando `telaAntesDaTroca` logo no início da função (antes de
qualquer leitura assíncrona ou branch PLANTAO/JORNADA) e só disparando os
quatro pontos de navegação automática existentes quando essa tela já era uma
das que DEPENDEM do contexto: `TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA =
{'escalas', 'grade', 'importar'}`. Qualquer outra tela (`visao`, `usuarios`,
`trocas`, `administracao`, `responsaveisEscala`, `plantoes`) nunca é
abandonada só porque o contexto mudou — o dado por trás (`usuarios`,
`resultado`, `contextoEscalaAtivo` etc.) continua sendo recarregado
normalmente em toda troca, só a navegação é preservada.

### 17.2 Filtro de setor/equipe na tela Usuários

O contexto de um Grupo de Plantão já lista o pool amplo
(`listarUsuariosElegiveisPlantao`: equipe responsável + `equipesConsulta` +
unidade responsável — ver `docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md`), o que
mistura visualmente plantonistas com técnicos de equipes que só CONSULTAM o
Grupo (ex.: Plantão COSI consulta `GEDSI_COSI_SOC`). Isso é o comportamento
correto do pool — o problema era só de apresentação.

`lib/usuariosTelaFiltros.ts` (novo, puro, sem Firebase/React) resolve isso
com um seletor ao lado da busca, só visível quando o contexto ativo é um
Grupo de Plantão:

- **Todos** — pool completo, sem filtro.
- **Plantão \<nome do Grupo\>** — `equipeId` da equipe responsável, OU
  `cadastroOperacional` tipo `PLANTAO` apontando este grupo, OU login
  participante ativo publicado (cobre alguém como Jean: `equipeId` de SOC,
  mas plantonista real).
- Uma opção por equipe de `equipesConsulta` (exceto a responsável, já
  coberta acima) — rotulada pelo nome real da equipe, nunca por sigla
  hardcoded.
- **\<unidade\> inteiro** — só quando o Grupo tem `unidadeResponsavelId`:
  `unidadeId` ou `unidadesPermitidas` contendo essa unidade.

A ordem é sempre pool do contexto → filtro de setor → busca textual (agora
cobrindo nome/login/e-mail/aliases/cargo, não só nome/login). O filtro
reseta para "Todos" a cada troca de contexto (`aplicarTrocaContexto`), nunca
herda um id de equipe que pode não existir no novo Grupo. Confirmado (ver
§ 16.3) que um usuário pode aparecer simultaneamente em SOC e em Plantão sem
duplicar na lista — a classificação é sobre o mesmo pool já deduplicado por
login, nunca uma união de arrays.

## 18. PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — operações canônicas e status único

### 18.1 Regra principal: uma única função de operações visíveis

Antes desta fase, "quais operações o usuário vê" era decidido de forma
independente em pelo menos quatro lugares: o seletor superior (três listas
próprias, `opcoesContextoJornada`/`opcoesContextoPlantao`/
`opcoesContextoPlantaoMonitorados`, mapeando `escoposOperacionais` direto),
a Visão geral (dois "slots" fixos — `equipeJornadaDashboard`/
`grupoPlantaoDashboard` — nunca uma lista), o status do contexto ativo no
topo (`statusContextoAtivo`, com sua PRÓPRIA fórmula para "Jornada
publicada") e a "Publicação da escala" (um booleano ad-hoc para Plantão que
nunca checava se havia competência publicada). Nada impedia essas quatro
lógicas divergirem para a mesma operação/competência.

`resolverOperacoesDashboard(usuario, contexto, dados)`
(`lib/operacoesDashboard.ts`, puro, sem React/Firebase) é agora a única
fonte: recebe o `EscoposOperacionais` já resolvido (`resolverEscoposOperacionais`,
inalterado — continua a autoridade normativa de quem administra/consulta o
quê) e devolve uma lista de `OperacaoDashboard` (`tipo`, `alvoId`, `nome`,
`status`, `ativa`, `consulta`). Cada item vem SEMPRE de um `Equipe`/
`GrupoPlantao` real de `escopos.jornadasAdministraveis`/
`plantoesAdministraveis`/`plantoesMonitorados` — a função não tem como
inventar uma operação sem `alvoId` real. O seletor superior e a Visão geral
agora leem essa MESMA lista (`operacoesDashboard`, calculada uma única vez
por render) — nunca podem mais divergir sobre quais operações existem.

### 18.2 Não existe operação genérica "Plantão"

Causa raiz do card genérico duplicado: `nomePlantaoDashboard` (a Visão
geral) já caía num fallback textual `'Plantão'` quando o usuário não tinha
nenhum Grupo de Plantão no escopo (`grupoPlantaoDashboard === null`) — mas
o card/linha correspondente em QUATRO seções (cards superiores, "Saúde das
escalas", "Publicação da escala", "Alertas por operação") era renderizado
incondicionalmente. Uma das quatro (`<strong>Plantão</strong>` na "Saúde
das escalas") nem usava essa variável — era um literal fixo, sempre visível
ao lado do card corretamente rotulado "Plantão COSI".

Corrigido com um único gate, `possuiOperacaoPlantaoDashboard = grupoPlantaoDashboard
!== null`, aplicado nas quatro seções: sem Grupo de Plantão no escopo, a
seção inteira não aparece — nunca um card com nome genérico. Com Grupo no
escopo, todas as quatro usam `{nomePlantaoDashboard}` (o nome real, ex.:
"Plantão COSI"), nunca o literal fixo.

### 18.3 Status operacional único (4 estados)

`StatusOperacaoDashboard` (`lib/operacoesDashboard.ts`) tem 4 valores —
`sem-escala` / `rascunho` / `publicada` / `publicada-com-rascunho-pendente`
— derivados por uma única função pura, `derivarStatusOperacaoDashboard(temRascunho,
temPublicada)`. Antes, Jornada e Plantão tinham cada uma sua própria fórmula
inline, e NENHUMA delas distinguia "publicada" de "publicada com rascunho
pendente": um rascunho aberto por cima de uma competência já publicada
aparecia só como "Rascunho", escondendo que já existe algo publicado — e a
"Publicação da escala" de Plantão nem chegava a checar se havia publicação
(`plantaoPossuiEscalaDashboard ? 'Rascunho' : 'Sem escala'`, nunca
"Publicada"). O badge do contexto ativo (topo/aba Escalas,
`ScheduleStatusBadge`) também tinha uma TERCEIRA fórmula independente só
para Jornada (`documentos.length > 0 && publicados.length === documentos.length`).

As três foram substituídas por chamadas à mesma função: `estadoJornadaDashboard`/
`estadoPlantaoDashboard` (Visão geral, Publicação, Alertas) e
`statusContextoAtivo` (badge do topo/aba Escalas) agora sempre derivam do
mesmo `derivarStatusOperacaoDashboard`, nunca uma fórmula própria. Plantão
COSI publicado aparece como "Publicada" em todo lugar — nunca "Sem escala"
numa tela e "Publicada" em outra.
