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

## 7. Origens suportadas pelo mesmo Editor

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
  rascunho, o fluxo "+ Nova escala" e (Fase ESCALAS-UX-1B.1) "Abrir
  rascunho" (tela "Plantões" e o atalho dentro de "+ Nova escala");
  nenhuma lógica de domínio nova mora aqui além da fiação de
  estado/props.

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
