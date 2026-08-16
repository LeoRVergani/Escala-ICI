# Especificação — Editor de Escalas (conceito compartilhado, Fases ESCALAS-UX-1A/1B)

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
parser. Ver § 8 abaixo ("Origens suportadas pelo mesmo Editor").

Estes três princípios são permanentes — valem para qualquer fase futura
que toque o Editor (ESCALAS-UX-1B, PLANTÃO-3C, ou qualquer evolução da
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

- Arrastar-e-soltar (drag-and-drop) para mover uma atribuição.
- Geração automática / distribuição / rotação / autocomplete de
  plantonista.
- "+ Nova escala vazia" e "Copiar período anterior" (criação sem
  importação) — adiados para ESCALAS-UX-1B.
- Múltiplos modos de cartão, customização manual de cor, compactação
  configurável — nenhum foi trazido dos protótipos antigos do
  dashboard; só a filosofia ("calendário fácil de ler + clique fácil
  para editar") foi reaproveitada, nunca a complexidade acumulada.
- Publicação (`publicarPlantao()` ou qualquer mudança de Firestore
  Rules) — fora de escopo desta fase e da definição de Editor em si;
  quando existir, será uma etapa POSTERIOR ao rascunho, nunca parte da
  edição em memória.

## 8. Origens suportadas pelo mesmo Editor

Fase ESCALAS-UX-1B formaliza a `origem` (`OrigemPlantao`, já existente
no contrato persistido desde a PLANTÃO-3A) como o único diferencial
entre as portas de entrada do Editor — nunca um segundo pipeline:

| Origem | Como a working copy nasce | `resultadoPlantao` (fonte congelada) |
| --- | --- | --- |
| `IMPORTADO` | `criarAtribuicoesEditaveis(resultado.atribuicoes)` a partir do parser | preenchido — alimenta a "Conferência da fonte" |
| `MANUAL` | `criarAtribuicoesEditaveis([])` — "+ Nova escala" → Plantão → Grupo + competência → Criar escala vazia | `null` — nunca uma `ResultadoParsePlantao` XLS fingida com 0/0/0 |
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

Registrado para uma fase futura, ainda NÃO implementado: **`COPIADO`**
— copiar a escala de uma competência anterior como ponto de partida
(mencionado como possibilidade em PLANTOES.md § 12, adiado
explicitamente para ESCALAS-UX-1C). Quando existir, deve seguir a MESMA
regra: nasce como uma working copy comum via `criarAtribuicoesEditaveis()`
(populada a partir da competência anterior), nunca um quarto pipeline.

## 9. Onde isso vive hoje

- `lib/editorPlantao.ts` — working copy pura (tipos + funções, sem
  React, sem Firestore) — igual para `IMPORTADO` e `MANUAL`.
- `lib/conciliacaoPlantoes.ts` — além da conciliação nome→login da
  planilha (`IMPORTADO`), ganhou na Fase ESCALAS-UX-1B
  `consolidarParticipantesGrupoPlantao()`/`vinculosDeParticipantesGrupoPlantao()`/
  `nomeParticipantePlantao()` — os equivalentes para `MANUAL` (participantes
  do Grupo, não da planilha).
- `lib/montagemRascunhoPlantao.ts` — `montarCompetenciaPlantaoRascunho()`/
  `montarAtribuicoesPlantaoRascunho()` recebem `origem` como parâmetro
  (Fase ESCALAS-UX-1B — antes hardcoded para `'IMPORTADO'`) e
  `validarNovoPlantaoEmBranco()` (novo) valida só Grupo + competência.
- `components/plantao/PlantaoCalendario.tsx` — visão de calendário.
- `components/plantao/ModalEditarAtribuicaoPlantao.tsx` — modal único
  de criar/editar.
- `apps/dashboard/src/DashboardApp.tsx` (`PreviewPlantao`,
  `ModalNovaEscala`) — orquestra a working copy, a conferência dupla e o
  rascunho, e (Fase ESCALAS-UX-1B) o fluxo "+ Nova escala"; nenhuma
  lógica de domínio nova mora aqui além da fiação de estado/props.

A escala 6x1 não foi tocada nestas fases — este documento descreve o
conceito para que uma fase futura que precise dar ao 6x1 um Editor
equivalente (célula a célula, já existe de forma mais simples via
`celulaEditando`) tenha uma referência de vocabulário e princípios, não
para forçar uma unificação de código agora.
