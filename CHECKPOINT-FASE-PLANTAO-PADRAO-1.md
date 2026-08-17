# Checkpoint — Fase PLANTAO-PADRAO-1 (padrão semanal configurável por Grupo de Plantão)

Data: 2026-08-17. Entrega a FONTE DE VERDADE para "horários normalmente
usados por um Grupo de Plantão, por dia da semana" — modelo persistente,
validação, persistência, Rules, Administração do Grupo, preview
compreensível, helpers puros e testes. **Não implementa** o consumo desse
padrão pelo Editor mensal (clicar no calendário → preencher horário,
drag → criar atribuição, "Aplicar padrão em lote") — isso é
`ESCALAS-UX-2B`. Não normaliza nenhuma atribuição/rascunho/importação já
existente.

## Baseline (precheck)

```
pwd                            /root/projetos/Escala-ICI-main
git rev-parse --show-toplevel  /root/projetos/Escala-ICI-main
git branch --show-current      main
git status --short             (limpo)
git rev-parse HEAD             882d858163b54ad9f866f09c12e3e75c61a463a6
git rev-parse origin/main      882d858163b54ad9f866f09c12e3e75c61a463a6
```

HEAD == origin/main no precheck. Baseline de testes confirmado:
`test:unit` 862/862, `test:boundaries` 225/225, `test:firestore-rules`
155/155.

## 1. Mapa de auditoria (antes de alterar)

```
modelo (packages/contrato/src/modeloPlantaoPersistente.ts)
  ↓ GrupoPlantao (grupoId, nome, descricao?, equipeResponsavelId,
    equipesConsulta, timezone, ativo, schemaVersion, criadoPorLogin,
    criadoEm, atualizadoEm) — validarGrupoPlantao() já existente
  ↓
validação (montarGrupoPlantaoParaSalvar em lib/montagemRascunhoPlantao.ts
  — normaliza antes de salvar, testado mas NÃO usado pelo Dashboard real
  hoje; o modal builda `candidato` por spread direto de `form`)
  ↓
repository (lib/firebase/plantaoWriteRepository.ts:salvarGrupoPlantao —
  valida + setDoc(removerUndefined(grupo)), spread completo, nenhum
  mapeamento campo a campo; lib/firebase/plantaoReadRepository.ts:
  obterGrupoPlantao/listarGruposPlantaoPermitidos/listarTodosGruposPlantao
  — cast direto do snapshot, nenhum mapeamento campo a campo)
  ↓
Dashboard (apps/dashboard/src/DashboardApp.tsx:ModalGrupoPlantao — form
  state = GrupoPlantao diretamente; abrirNovoGrupoPlantao() constrói o
  literal inicial; salvarGrupoPlantaoDoModal() salva/atualiza o estado
  local `gruposPlantaoAdmin`)
  ↓
Rules (firestore.rules:match /gruposPlantao/{grupoId} — create/update
  com keys().hasOnly([...]) allowlist fechada + validação de tipo/faixa
  por campo; padrão de validação de array-de-objetos já estabelecido por
  contatoPlantonistaValido()/contatosPlantonistaValidos(), até 3
  posições fixas)
  ↓
testes (packages/contrato/test/modeloPlantaoPersistente.test.ts,
  lib/montagemRascunhoPlantao.test.ts, lib/firebase/plantaoWriteRepository.test.ts,
  lib/firebase/plantaoReadRepository.test.ts, tests/firebase/firestore.rules.test.ts
  — describe "Plantão — Grupo/..." Fase PLANTÃO-3A)
```

Como os repositories fazem spread/cast completo do objeto (nunca
mapeamento campo a campo), um novo campo OPCIONAL em `GrupoPlantao` flui
automaticamente por leitura/escrita sem nenhuma mudança de código ali —
só a Rule (que usa uma allowlist fechada, `keys().hasOnly([...])`)
precisava de uma mudança explícita para não rejeitar o documento.

Nenhuma lógica foi duplicada: dia da semana reaproveita a MESMA convenção
de índice já usada internamente por `Date#getUTCDay()`/`NOMES_DIA_SEMANA`
(privado) em `parserPlantao.ts`; formato `HH:mm` reaproveita o mesmo
princípio de `REGEX_HORARIO` (`lib/lembretes.ts`, reimplementado
localmente em `packages/contrato` porque este pacote não depende de
`lib/`); validação de array-de-objetos até N posições fixas reaproveita
o padrão já usado por `contatosPlantonistaValidos()`.

## 2. Modelo criado

`packages/contrato/src/modeloPlantaoPersistente.ts`:

```ts
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo

export interface PadraoHorarioPlantaoDia {
  diaSemana: DiaSemana;
  horaInicio: string;  // "HH:mm", 24h
  horaFim: string;     // "HH:mm", 24h
  fimDiaOffset: 0 | 1; // 1 = termina no dia seguinte — NUNCA inferido numericamente
}
```

Array tipado (`PadraoHorarioPlantaoDia[]`), não um objeto com 7
propriedades fixas por nome de dia — mais fácil validar/ordenar/detectar
duplicidade, independente de idioma na persistência.

## 3. Campo adicionado ao `GrupoPlantao`

```ts
interface GrupoPlantao {
  // ...campos existentes, inalterados...
  padraoHorarioSemanal?: PadraoHorarioPlantaoDia[];
}
```

## 4. Backward compatibility

100% opcional. Nenhum `GrupoPlantao` persistido antes desta fase precisa
de migração — ausência do campo é equivalente semanticamente a "nenhum
padrão configurado". Nenhum script de migração criado; nenhum documento
existente tocado (confirmado — `git diff` não tocou nenhum dado, só
código/schema/Rules/testes/docs).

## 5. Representação do dia da semana

Mesmo índice de `Date#getUTCDay()` (0 = domingo), já usado internamente
por `parserPlantao.ts` (`NOMES_DIA_SEMANA`, privado àquele arquivo) —
reaproveitado como a ÚNICA convenção pública de dia da semana do pacote
(`DiaSemana`/`DIAS_SEMANA`/`NOMES_DIA_SEMANA`, agora exportados de
`modeloPlantaoPersistente.ts`). Nenhuma segunda numeração foi criada.
Testado (`diaSemanaCivil` — casos 2026-08-16 domingo, 2026-08-17 segunda,
2026-08-21 sexta, 2026-08-22 sábado, 2026-01-01 quinta).

## 6. Formato dos horários

`HH:mm`, 24h, `00–23`/`00–59`, sempre dois dígitos —
`horarioPlantaoValido()` (regex `^([01]\d|2[0-3]):[0-5]\d$`, mesmo nível
de `REGEX_HORARIO` de `lib/lembretes.ts`, reimplementado localmente pois
`packages/contrato` não depende de `lib/`). `7:00`, `25:00`, `19h00`,
vazio, `19:60` — todos inválidos (testado).

## 7. `fimDiaOffset`

Persistido EXPLICITAMENTE — nunca inferido comparando `horaFim` com
`horaInicio` numericamente. `19:00 → 07:00` só significa "termina no dia
seguinte" porque `fimDiaOffset = 1` diz isso.

## 8. Cálculo de duração

`duracaoMinutosPadraoHorarioPlantaoDia()` — minutos desde meia-noite de
cada horário (`HH:mm` → inteiro, sem `Date`) + `fimDiaOffset * 1440`,
imune ao timezone da máquina que roda o código.

## 9. Tratamento de 12h

`19:00 → 07:00` com `fimDiaOffset = 1` = 720 min = 12h. Testado.

## 10. Tratamento de 24h

`19:00 → 19:00` com `fimDiaOffset = 1` = 1440 min = 24h (`horaInicio ==
horaFim` é válido só quando `fimDiaOffset = 1`). O MESMO par com
`fimDiaOffset = 0` resulta em duração zero — inválido
(`validarPadraoHorarioSemanal` rejeita duração ≤ 0). Testado nos dois
sentidos.

## 11. Dias sem padrão

Ausência de entrada para um dia = "sem horário padrão configurado" —
nunca uma entrada artificial `00:00 → 00:00`. Grupo pode ter de 0 a 7
dias configurados; `obterPadraoHorarioParaDia()` retorna `null` para um
dia sem entrada.

## 12. Validações (`validarPadraoHorarioSemanal`)

`diaSemana` inteiro 0..6, sem dias duplicados, `horaInicio`/`horaFim`
válidos (`HH:mm`), `fimDiaOffset` só 0 ou 1, duração > 0, máximo 7
entradas. Nenhuma restrição adicional de negócio (ex.: duração máxima)
foi inventada silenciosamente — não avaliada como necessária pelo pedido,
nenhuma decisão pendente registrada. Array vazio é válido (nenhum padrão
configurado). Propagado por `validarGrupoPlantao()` quando o campo está
presente.

## 13. Helper de consulta

`obterPadraoHorarioParaDia(padraoHorarioSemanal, diaSemana)` — `null` =
nenhum padrão para o dia. `obterPadraoHorarioGrupoParaData(grupo,
dataCivil)` — combinação com `diaSemanaCivil()`, o ponto de entrada real
reutilizável para `ESCALAS-UX-2B`. Nenhum dos dois acopla React ou
Firebase.

## 14. Comportamento com data civil

`diaSemanaCivil(dataCivil)` — determinístico via `Date.UTC()` sobre
componentes já extraídos por regex (nunca `new Date("AAAA-MM-DD")`,
sujeito a interpretação inconsistente entre ambientes/timezones).
Testado com `2026-08-16` (domingo), `2026-08-17` (segunda), `2026-08-21`
(sexta), independente do timezone do runner.

## 15. Timezone

`GrupoPlantao.timezone` inalterado. O padrão representa horário CIVIL no
MESMO timezone do Grupo — "domingo 19:00" significa 19:00 no fuso do
Grupo. A conversão para instante UTC ao aplicar o padrão numa atribuição
real fica para `ESCALAS-UX-2B` (reaproveitando
`converterMomentoParaInstanteUtc()` já existente, nunca uma segunda
função) — esta fase não precisa converter nada.

## 16. Repository

`salvarGrupoPlantao()` (`lib/firebase/plantaoWriteRepository.ts`) já fazia
`setDoc(doc(...), removerUndefined(grupo))` — spread completo do objeto,
nenhum mapeamento campo a campo — então o campo novo flui
automaticamente. `removerUndefined()` (`lib/firebase/sanitizar.ts`) já é
recursivo em arrays/objetos aninhados, então `padraoHorarioSemanal:
undefined` é removido corretamente antes de chegar ao Firestore. Nenhuma
mudança de código foi necessária no repository além de validar o campo
ANTES do `setDoc` (via `validarGrupoPlantao`, que já roda ali).
`montarGrupoPlantaoParaSalvar()` (`lib/montagemRascunhoPlantao.ts`,
testado mas hoje não chamado pelo Dashboard real) ganhou um parâmetro
opcional `padraoHorarioSemanal?` — omitido preserva o valor já existente
no Grupo (edição sem tocar o padrão); `[]` explícito remove o padrão
(vira `undefined` na persistência).

## 17. Criação de Grupo

`abrirNovoGrupoPlantao()` inicializa `padraoHorarioSemanal: undefined`
explicitamente. Nenhum padrão é obrigatório — criar sem nenhum dia
configurado funciona normalmente.

## 18. Edição de Grupo existente

Grupo antigo sem o campo mostra a seção "Padrão de horário" vazia (todos
os 7 dias desmarcados) — o gestor pode adicionar e salvar normalmente.

## 19. Remoção de padrão

Desmarcar todos os dias resulta em `padraoHorarioSemanal` vazio, que
`aoClicarSalvar()` converte para `undefined` antes de validar/salvar
(mesmo princípio de `descricao` em branco virando `undefined`, já
existente). Nenhum dado residual fica preso no Firestore.

## 20. UI administrativa

`components/plantao/PadraoHorarioSemanalCampo.tsx` (novo, componente de
apresentação puro, sem Firebase) — seção "Padrão de horário" dentro de
`ModalGrupoPlantao`, um card por dia da semana (Domingo→Sábado, nunca uma
tabela horizontal), cada um com: toggle habilitar/desabilitar
(`.checkbox-row`, mesmo padrão já usado para "Ativo"), `<input
type="time">` de início/fim (reaproveita `.admin-form-grid input`, mesma
altura/cor de todo campo do modal), toggle "Termina no dia seguinte", e
resumo humano. Habilitar um dia cria uma entrada vazia (nunca um horário
pré-preenchido/inventado); desabilitar remove a entrada por completo
(nunca `ativo: false` residual). Validação inline por dia (decisão do
usuário desta fase) — cada card mostra o próprio erro
(`.admin-form-erro`) ou preview (`.admin-form-preview`) junto dos campos
daquele dia, nunca um banner agregado só no rodapé do modal.

## 21. Preview humano

`previewPadraoHorarioPlantaoDia()` — `"19:00 → 07:00 (+1 dia) · 12h"` /
`"19:00 → 19:00 (+1 dia) · 24h"` / `"08:00 → 18:00 · 10h"` (sem sufixo
quando `fimDiaOffset = 0`). Nunca expõe `fimDiaOffset` cru ao usuário.
Campos ainda vazios (dia recém-habilitado) mostram "Informe início e fim
(HH:mm)." em vez de tentar calcular uma duração de campo incompleto.

## 22. Mobile

Um card por dia (`<li>` com borda própria), nunca uma tabela horizontal
que exigiria scroll. `.padrao-horario-semanal-campos` empilha em coluna
abaixo de 560px (mesmo breakpoint já usado por `.contato-plantonista-linha`,
o padrão de linha-flex-com-campos-lado-a-lado mais próximo já existente
no codebase). Auditoria estática (CSS + JSX + sucesso de build) — sem
navegador disponível neste ambiente, consistente com a preferência já
registrada de que o usuário valida UI diretamente.

## 23. Acessibilidade

Cada `<input>` tem `<label htmlFor>` real (Início/Fim) + `aria-label`
específico por dia ("Domingo — horário de início"/"...de fim") para
leitores de tela distinguirem os 7 blocos de início/fim idênticos. Toggle
"Termina no dia seguinte" com `<span>` de texto explícito ao lado do
checkbox (`.checkbox-row`, nunca só o checkbox solto). Nada depende só de
cor — erro/preview sempre têm texto. Foco visível herdado do estilo
padrão de `input`/`button` já estabelecido no projeto.

## 24. Firestore Rules

`gruposPlantao/{grupoId}` — `padraoHorarioSemanal` adicionado à allowlist
de chaves (`keys().hasOnly([...])`) de `create` E `update`. Duas funções
novas: `padraoHorarioPlantaoDiaValido(entrada)` (estrutura/tipos/faixas
de uma entrada — `diaSemana` 0..6, `horaInicio`/`horaFim` `HH:mm`
00–23/00–59, `fimDiaOffset` em `[0, 1]`, `keys().hasOnly([...])`) e
`padraoHorarioSemanalValido(padrao)` (lista, até 7 posições, mesmo padrão
de validação fixa-por-posição já usado por `contatosPlantonistaValidos()`).
`padraoHorarioSemanalDoRequestValido(dados)` trata a ausência do campo
como válida (`!('padraoHorarioSemanal' in dados) || ...`) —
retrocompatibilidade real na própria Rule, não só no client.

**Limitação documentada, não uma omissão silenciosa**: duplicidade de
`diaSemana` entre elementos da lista NÃO é validada pela Rule — exigiria
comparação par-a-par de até 7 posições (21 combinações), avaliado como
desproporcional frente à defesa real já existente client-side
(`validarPadraoHorarioSemanal()`, que roda antes de qualquer
`setDoc`/`updateDoc` nos dois únicos call sites de escrita do projeto).
Testado explicitamente (`tests/firebase/firestore.rules.test.ts`, "dia
duplicado NÃO é bloqueado pela Rule") para nunca ser confundido com uma
falha descoberta depois.

Regra de LEITURA **inalterada** — confirmado por teste dedicado.

## 25. Autorização

Nenhuma mudança em `podeGerenciarGrupoPlantao()`/`podeGerenciarEsteGrupoPlantao()`/
`equipesPermitidasEfetivas()`/`equipesConsulta`. Configurar o padrão exige
exatamente a mesma autorização de sempre para administrar o Grupo — quem
já podia criar/editar o Grupo, e só esse, pode alterar
`padraoHorarioSemanal`.

## 26. Confirmação de grupo consulta-only sem escrita

Testado em Rules: um usuário cuja equipe está só em `equipesConsulta`
(não é `equipeResponsavelId`) continua sem conseguir `update` o Grupo,
inclusive tentando gravar só o padrão semanal. Um gestor fora do escopo
da equipe responsável também continua bloqueado.

## 27. Confirmação de nenhum hardcode

Nenhum `if COSI`/`if SOC`/`if NOC`/`if CODB`, nenhuma sigla literal, em
nenhum arquivo desta fase (modelo, montagem, repositories, componente,
Dashboard, Rules) — confirmado por boundary test dedicado
(`tests/plantao-padrao-horario-boundaries.test.mjs`, teste 3). Nenhuma
regra hardcoded por dia da semana em prosa (`if sexta`/`if sábado`) na
lógica de validação (teste 4). Uma única convenção pública de dia da
semana (`DiaSemana`/`DIAS_SEMANA`), nunca uma segunda numeração (teste 5).

## 28. Confirmação de nenhum padrão real criado automaticamente

Nenhum documento `GrupoPlantao` real foi tocado no Firestore. Onde um
padrão técnico fictício era necessário para provar ausência de hardcode
(testes), foi usado um horário fictício (`domingo 18:00 → 06:00 +1` em
alguns testes de Rules, `19:00 → 07:00 +1` em outros) — nenhum dado
pessoal, nenhuma planilha real.

## 29. Confirmação de nenhuma alteração em atribuições existentes

`montarAtribuicoesPlantaoRascunho()`/`copiarAtribuicoesParaNovaCompetencia()`
(`lib/montagemRascunhoPlantao.ts`) não referenciam o padrão semanal —
confirmado por boundary test dedicado (teste 7). Nenhuma escala
importada, rascunho salvo, ou intervalo atípico (ex.: 43h/5h de uma
planilha real) é recalculado por esta fase.

## 30. Confirmação de nenhuma normalização de importações

Mesmo ponto acima — o parser (`parserPlantao.ts`) e o pipeline de
importação (`interpretarPlantao()`) não foram tocados; `git diff` sobre
esses arquivos é vazio.

## 31. Confirmação de nenhum drag

Nenhum `onDragStart`/`onDragOver`/`onDrop`/`draggable` em nenhum arquivo
novo desta fase — confirmado por boundary test (teste 8).

## 32. Confirmação de nenhum quick-add

O card "Padrão do grupo" com botão "Adicionar" (preencher um novo plantão
com um clique a partir do padrão, descrito em
`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 18) **não foi implementado**
— pertence a `ESCALAS-UX-2B`. `PadraoHorarioSemanalCampo` só existe
dentro de `ModalGrupoPlantao` (Administração), nunca dentro do fluxo de
criação de atribuição do Editor (`ModalEditarAtribuicaoPlantao`,
`PlantaoCalendario`) — confirmado por boundary test (teste 6, verifica
ausência de `obterPadraoHorarioGrupoParaData`/`padraoHorarioSemanal`
nesses arquivos).

## 33. Confirmação de nenhuma publicação Plantão

`publicarPlantao()` continua inexistente — confirmado por boundary test
(teste 9). `competenciasPlantao` continua com escrita bloqueada
(`allow create, update, delete: if false;`, inalterado).

## 34. Testes novos

- `packages/contrato/test/modeloPlantaoPersistente.test.ts`: +33 (55→88)
  — `validarPadraoHorarioSemanal` (14), `ordenarPadraoHorarioSemanal` (1),
  `horarioPlantaoValido` (2), `obterPadraoHorarioParaDia` (9, um por dia
  0-6 + 2 casos de ausência), `diaSemanaCivil` (6),
  `obterPadraoHorarioGrupoParaData` (1).
- `lib/montagemRascunhoPlantao.test.ts`: +6 (72→78) — criar sem/com
  padrão, editar, editar sem tocar (omitir parâmetro preserva), remover
  (`[]` → `undefined`), preserva demais campos.
- `lib/firebase/plantaoWriteRepository.test.ts`: +4 (18→22) — persiste
  padrão válido, rejeita horário malformado, rejeita dia duplicado,
  Grupo sem o campo continua válido.
- `lib/firebase/plantaoReadRepository.test.ts`: +2 (11→13) — leitura
  retorna o padrão persistido, Grupo sem o campo lido normalmente.
- `components/plantao/PadraoHorarioSemanalCampo.test.ts` (novo arquivo,
  14 testes) — lógica pura de toggle/edição/preview do componente
  (`alternarDiaNoPadraoHorarioSemanal`/`atualizarDiaNoPadraoHorarioSemanal`/
  `previewPadraoHorarioPlantaoDia`, exportadas do próprio componente para
  serem testáveis sem depender de renderização de DOM — este projeto não
  usa uma biblioteca de testes de componente).
- `tests/firebase/firestore.rules.test.ts`: +11 (155→166) — documento
  antigo sem o campo, create/update válidos, remover padrão, horário
  inválido, dia inválido, offset inválido, campo extra, mais de 7
  entradas, dia duplicado (permitido — limitação documentada), usuário
  não autorizado, consulta-only não edita.
- `tests/plantao-padrao-horario-boundaries.test.mjs` (novo arquivo, 12
  testes) — cobertura estrutural completa do § 39 do pedido.
- `tests/dashboard-contexto-escala-boundaries.test.mjs` (teste 20,
  ajustado): `padraoHorario`/`PadraoHorarioSemanal` deixaram de ser
  proibidos em `DashboardApp.tsx`/`modeloPlantaoPersistente.ts` (esta
  fase os autoriza explicitamente); continuam proibidos nos componentes
  de `ContextoEscalaAtivo` (`components/escalas/*`), que não ganharam
  nenhum conhecimento de Plantão além do que já tinham.

`vitest.config.ts` ganhou `components/**/*.test.ts` no `include` — este é
o primeiro teste de lógica de componente do projeto
(`PadraoHorarioSemanalCampo.test.ts`), sem essa entrada `npm run
test:unit` não o executava.

## 35. Totais

- `test:unit`: 921/921 (baseline 862 + 33 + 6 + 4 + 2 + 14 = 921).
- `test:boundaries`: 237/237 (baseline 225 + 12 novos; 1 pré-existente
  ajustado — ver § 34).
- `test:firestore-rules`: 166/166 (baseline 155 + 11 novos).

## 36. Typechecks/lint/builds

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros — só os 6 warnings pré-existentes já
conhecidos, inalterados), `build:dashboard`, `build:app:pages`,
`build:apps`, `validate:pwa`, `validate:artifact`, `git diff --check` —
todos OK.

## 37. Validação visual

Nenhum navegador disponível neste ambiente — auditoria estática (leitura
direta do JSX/CSS resultante + sucesso de build/typecheck, que já garante
JSX válido e CSS sem erro de sintaxe) foi a validação realizada,
consistente com a preferência já registrada de que o usuário testa
mudanças de UI diretamente (nenhum padrão vazio/um dia/12h/24h/vários
dias/salvar/reabrir foi exercitado num navegador real por este agente).

## 38. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.indexes.json`, `lib/editorPlantao.ts`,
`components/plantao/PlantaoCalendario.tsx`,
`components/plantao/ModalEditarAtribuicaoPlantao.tsx`,
`components/ScheduleGrid.tsx`, `lib/firebase/authRepository.ts`,
`apps/app/`, `apps/push-worker/`, `components/organizacao/`,
`lib/contextoEscala.ts`, `components/escalas/`, `lib/sessao.ts` —
**vazio**. Jornada 6x1, `ContextoEscalaAtivo`, os dirty guards
(`jornadaPossuiAlteracoesNaoSalvas`/`plantaoPossuiAlteracoesNaoSalvas`),
App, Auth, Push e Organização permanecem intactos.

## 39. Arquivos alterados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`firestore.rules`, `lib/firebase/plantaoReadRepository.test.ts`,
`lib/firebase/plantaoWriteRepository.test.ts`,
`lib/montagemRascunhoPlantao.test.ts`, `lib/montagemRascunhoPlantao.ts`,
`package.json` (lista de arquivos de `test:boundaries`),
`packages/contrato/src/modeloPlantaoPersistente.ts`,
`packages/contrato/test/modeloPlantaoPersistente.test.ts`,
`tests/dashboard-contexto-escala-boundaries.test.mjs`,
`tests/firebase/firestore.rules.test.ts`, `vitest.config.ts`,
`docs/spec/PLANTOES.md`, `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`.

## 40. Arquivos criados

`components/plantao/PadraoHorarioSemanalCampo.tsx`,
`components/plantao/PadraoHorarioSemanalCampo.test.ts`,
`tests/plantao-padrao-horario-boundaries.test.mjs`,
`CHECKPOINT-FASE-PLANTAO-PADRAO-1.md`.

## 41. Git

Commit local único, mensagem `feat(plantao): adiciona padrao semanal por
grupo`. Nenhum push, deploy, merge, rebase, amend, reset ou stash.

## 42. Confirmação

NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. PRODUÇÃO NÃO FOI TOCADA.

Esta fase **para aqui** — não inicia `ESCALAS-UX-2B`, `ESCALAS-UX-2C` nem
`PLANTÃO-3C`.
