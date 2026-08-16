# Especificação — Editor de Escalas (conceito compartilhado, Fase ESCALAS-UX-1A)

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

## 7. Onde isso vive hoje (Fase ESCALAS-UX-1A, Plantão)

- `lib/editorPlantao.ts` — working copy pura (tipos + funções, sem
  React, sem Firestore).
- `components/plantao/PlantaoCalendario.tsx` — visão de calendário.
- `components/plantao/ModalEditarAtribuicaoPlantao.tsx` — modal único
  de criar/editar.
- `apps/dashboard/src/DashboardApp.tsx` (`PreviewPlantao`) — orquestra
  a working copy, a conferência dupla e o rascunho; nenhuma lógica de
  domínio nova mora aqui além do fiação de estado/props.

A escala 6x1 não foi tocada nesta fase — este documento descreve o
conceito para que uma fase futura que precise dar ao 6x1 um Editor
equivalente (célula a célula, já existe de forma mais simples via
`celulaEditando`) tenha uma referência de vocabulário e princípios, não
para forçar uma unificação de código agora.
