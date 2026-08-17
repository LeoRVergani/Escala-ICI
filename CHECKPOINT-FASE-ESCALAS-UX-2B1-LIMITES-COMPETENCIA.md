# Checkpoint — Fase ESCALAS-UX-2B.1 (limites da competência no quick-add e drag)

Data: 2026-08-17. Microcorreção da ESCALAS-UX-2B: impede que uma NOVA
atribuição de Plantão seja iniciada em dias exibidos apenas como
contexto visual, fora do período real da competência ativa.

## Baseline (precheck)

```
pwd                            /root/projetos/Escala-ICI-main
git rev-parse --show-toplevel  /root/projetos/Escala-ICI-main
git branch --show-current      main
git status --short             (limpo)
git rev-parse HEAD             b3b46f8c7c421e3aa26273111e5321e823d26092
git rev-parse origin/main      fcbbcfdd2223e2e505f473854cb530ac089c39db
```

HEAD à frente de `origin/main` (commit local da ESCALAS-UX-2B ainda não
enviado — consistente com "nenhum push autorizado" registrado naquele
checkpoint). Baseline de testes confirmado: `test:unit` 932/932,
`test:boundaries` 257/257, `test:firestore-rules` 166/166.

## 1. Problema

`solicitarNovaAtribuicaoPlantao()` (ESCALAS-UX-2B) não verificava se a
data clicada/arrastada pertencia ao período real da competência
(`periodoInicio..periodoFim`, janela 26→25) — funcionava igualmente em
dias exibidos só como contexto visual (`ehDiaDeContexto()`, dias antes
do 26 ou depois do 25 que só existem para completar as semanas do
calendário). Isso permitia iniciar uma atribuição "pertencente" a um mês
errado sem nenhum aviso.

## 2. Regra implementada

Uma NOVA atribuição criada por click, drag/drop, "+ Adicionar" ou
quick-add só pode ter **data inicial** dentro de
`periodoInicio <= dataInicial <= periodoFim`. O **término pode
ultrapassar o período livremente** — nunca limitado: `25/08 19:00 →
26/08 07:00` (12h) e `25/08 19:00 → 26/08 19:00` (24h) continuam válidos
porque o início (25/08) pertence à competência.

## 3. Helper — `dataPertenceCompetencia()`

`lib/montagemRascunhoPlantao.ts`, ao lado de `periodoDaCompetencia()`:

```ts
export function dataPertenceCompetencia(dataIso: string, competencia: string): boolean {
  if (!PADRAO_DATA_ISO.test(dataIso)) {
    return false;
  }
  const periodo = periodoDaCompetencia(competencia);
  if (periodo === null) {
    return false;
  }
  return dataIso >= periodo.periodoInicio && dataIso <= periodo.periodoFim;
}
```

Reaproveita INTEGRALMENTE `periodoDaCompetencia()` — nenhum segundo
cálculo 26→25. `dataIso`/`competencia` inválidos retornam `false` (nunca
lançam, nunca assumem um período "default"). Puro, sem React/Firebase.

## 4. Gate definitivo — `solicitarNovaAtribuicaoPlantao()`

Primeiro passo da função (antes de qualquer outro branch):

```ts
function solicitarNovaAtribuicaoPlantao(plantonistaNomeOriginal: string, dataIso: string) {
  if (!dataPertenceCompetencia(dataIso, competenciaRascunho)) {
    return;
  }
  // ...resto da função, inalterado
}
```

No-op silencioso — nenhuma mudança na working copy, nenhum dirty, nenhum
`quickAddPlantao` aberto. Este é o ÚNICO funil real de click/drag/
"+ Adicionar"/quick-add (mesma função desde a ESCALAS-UX-2B) — a
validação vive aqui, não espalhada por múltiplos call sites.

## 5. Omissão de UI em `PlantaoCalendario`

Reforço visual (nunca a única defesa — o gate real é o item 4):

- `podeCriar = !contexto` — variável explícita derivada de
  `ehDiaDeContexto()` (já existente, nenhum cálculo duplicado).
- "**+ Adicionar**" só é renderizado quando `podeCriar` — em dia de
  contexto, o botão simplesmente não existe.
- **Clique de fundo** do dia só chama `onSolicitarNovaAtribuicao` quando
  `podeCriar && plantonistaSelecionado !== null`.
- **Drag**: `onDragOver` só chama `preventDefault()` quando `podeCriar`
  — sem isso, o navegador recusa o drop NATIVAMENTE (cursor "não
  permitido"), o usuário percebe ANTES de soltar, nunca um erro depois
  (§7 do pedido). `onDragEnter` só acende o realce visual
  (`drop-alvo`) quando `podeCriar`.
- **Drop**: `aoSoltarNoDia()` ganhou um terceiro parâmetro (`podeReceber`)
  — defesa em profundidade além do `preventDefault()` condicional.
- **Atribuições já existentes** num dia de contexto continuam
  renderizadas normalmente (`atribuicoesDoDia`, sem nenhum filtro novo)
  — a omissão de UI afeta só a AÇÃO de criar, nunca a leitura/exibição.

## 6. Acessibilidade

`aria-label` do dia de contexto passou a explicar a restrição em texto
("... fora do período desta competência — não aceita novos plantões") —
nunca só uma cor. Nenhuma implementação de "drag por teclado" continua
sendo necessária (inalterado desde a ESCALAS-UX-2B) — "+ Adicionar"
simplesmente não existe em dias de contexto, então não há nada para
"esconder" do teclado além do que já não existe visualmente.

## 7. Importados/existentes intactos

`dataPertenceCompetencia()` NUNCA é chamado por `lib/editorPlantao.ts`
nem `lib/conciliacaoPlantoes.ts` (confirmado por boundary test) — a
regra se aplica SOMENTE à criação de novas atribuições pela UI, nunca a
atribuições já existentes/importadas. Working copies com intervalos
atípicos (43h/5h) que caem parcial ou totalmente num dia de contexto
continuam renderizadas e intactas — nenhuma normalização, nenhum filtro.

## 8. Dirty

Tentativa bloqueada (dia de contexto): a função retorna antes de
qualquer `setAtribuicoesEditaveisPlantao`/`marcarPlantaoEditadoNoEditor`/
`setQuickAddPlantao` — confirmado por boundary test (o bloco do gate
contém só o `return`). Criação válida: comportamento inalterado desde a
ESCALAS-UX-2B (`plantaoPossuiAlteracoesNaoSalvas = true` via
`marcarPlantaoEditadoNoEditor()`).

## 9. Testes novos

- `lib/montagemRascunhoPlantao.test.ts`: +9 (78→87) —
  `dataPertenceCompetencia`: dia anterior (`false`), primeiro dia
  (`true`), dia comum (`true`), último dia (`true`), dia posterior
  (`false`), dia bem posterior (`false`), competência malformada
  (`false`), data malformada (`false`), virada de ano (janeiro).
- `tests/plantao-limites-competencia-boundaries.test.mjs` (novo arquivo,
  11 testes) — gate como primeiro passo da função, gate nunca toca
  working copy/dirty, helper reaproveita `periodoDaCompetencia`,
  "+ Adicionar" condicionado a `podeCriar`, clique de fundo condicionado,
  `onDragOver`/`onDragEnter` condicionados, `onDrop` revalida
  `podeReceber`, atribuições existentes nunca filtradas, o gate nunca
  vaza para módulos de domínio puro, acessibilidade (aria-label
  explicativo), nenhuma mudança em padrão semanal/contexto ativo/dirty
  guards/Rules/schema.

## 10. Totais

- `test:unit`: 941/941 (baseline 932 + 9 novos).
- `test:boundaries`: 268/268 (baseline 257 + 11 novos; nenhum removido).
- `test:firestore-rules`: 166/166 (inalterado — nenhuma mudança de
  Rules/schema nesta fase).

## 11. Typechecks/lint/builds

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros — só os 6 warnings pré-existentes já
conhecidos, inalterados), `build:dashboard`, `build:app:pages`,
`build:apps`, `validate:pwa`, `validate:artifact`, `git diff --check` —
todos OK.

## 12. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.rules`, `firestore.indexes.json`,
`packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/contextoEscala.ts`, `components/escalas/`, `apps/app/`,
`apps/push-worker/`, `components/organizacao/`,
`lib/firebase/authRepository.ts`, `components/ScheduleGrid.tsx`,
`lib/sessao.ts` — **vazio**. `GrupoPlantao.padraoHorarioSemanal`,
`ContextoEscalaAtivo`, os dirty guards, Jornada 6x1, Firebase/Rules,
Auth, App e Push permanecem intactos. Nenhum campo novo persistente;
nenhuma Rule nova; nenhuma publicação de Plantão introduzida.

## 13. Arquivos alterados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`components/plantao/PlantaoCalendario.tsx`,
`lib/montagemRascunhoPlantao.test.ts`, `lib/montagemRascunhoPlantao.ts`,
`package.json` (lista de arquivos de `test:boundaries`),
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md` (errata).

## 14. Arquivos criados

`tests/plantao-limites-competencia-boundaries.test.mjs`,
`CHECKPOINT-FASE-ESCALAS-UX-2B1-LIMITES-COMPETENCIA.md`.

## 15. Git

Commit local único, mensagem `fix(plantao): limita novas atribuicoes a
competencia`. Nenhum push, deploy, merge, rebase, amend, reset ou stash.

## 16. Confirmação

NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. PRODUÇÃO NÃO FOI TOCADA.

Esta fase **para aqui** — não inicia `ESCALAS-UX-2C` nem `PLANTÃO-3C`.
