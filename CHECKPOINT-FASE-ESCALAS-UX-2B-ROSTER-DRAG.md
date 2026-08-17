# Checkpoint — Fase ESCALAS-UX-2B (roster lateral + montagem rápida + drag-and-drop do Plantão)

Data: 2026-08-17. Primeira evolução visual/operacional do Editor mensal
de Plantão desde a ESCALAS-UX-1A: roster lateral de plantonistas +
montagem rápida por clique/drag + consumo real de
`GrupoPlantao.padraoHorarioSemanal` (entregue em `PLANTAO-PADRAO-1`) como
sugestão de horário. Escopo limitado ao Plantão — Jornada 6x1
(`ScheduleGrid`) não foi tocada.

## Baseline (precheck)

```
pwd                            /root/projetos/Escala-ICI-main
git rev-parse --show-toplevel  /root/projetos/Escala-ICI-main
git branch --show-current      main
git status --short             (limpo)
git rev-parse HEAD             fcbbcfdd2223e2e505f473854cb530ac089c39db
git rev-parse origin/main      fcbbcfdd2223e2e505f473854cb530ac089c39db
```

HEAD == origin/main no precheck. Baseline confirmado: `test:unit`
921/921, `test:boundaries` 237/237, `test:firestore-rules` 166/166.

## 1. Mapa de auditoria (antes de alterar)

Fluxo de criação já existente (ESCALAS-UX-1C), reaproveitado
integralmente:

```
plantonistaSelecionadoPlantao (seleção pura de UI)
  ↓
abrirCriacaoAtribuicaoPlantao(dataIso) — pré-preenche plantonista, horário sempre vazio
  ↓
ModalEditarAtribuicaoPlantao (modo 'criar')
  ↓
salvarModalAtribuicaoPlantao → adicionarAtribuicaoEditavel → marcarPlantaoEditadoNoEditor
```

Nesta fase, o único ponto de entrada de criação passou a ser
`solicitarNovaAtribuicaoPlantao(plantonistaNomeOriginal, dataIso)` — uma
camada nova ANTES do fluxo acima, que decide se abre o quick-add
(padrão configurado) ou cai direto no fluxo de sempre (sem padrão/sem
plantonista). Nenhuma lógica pré-existente foi duplicada: o modal
completo, `adicionarAtribuicaoEditavel()` e `marcarPlantaoEditadoNoEditor()`
continuam exatamente os mesmos, agora chamados por um segundo caminho
também (`criarAtribuicaoPlantaoNaWorkingCopy()`, extraído de dentro de
`salvarModalAtribuicaoPlantao()` para ser reaproveitado pelo quick-add).

## 2. Roster lateral — `components/plantao/PlantaoRoster.tsx`

Substitui o bloco full-width "Resumo por pessoa" (removido, CSS morto
junto). Layout de duas áreas (`.plantao-editor-layout`, grid
`260px minmax(0, 1fr)`) — nunca três colunas permanentes. Reaproveita:

- `resumirPorPessoa()` (já calculado por `PreviewPlantao`, passado como
  prop `pessoas` — nenhum recálculo);
- `plantonistaSelecionadoPlantao`/`alternarPlantonistaSelecionado()`
  (mesmo mecanismo desde ESCALAS-UX-1C, só reposicionado visualmente);
- `indiceIdentidadePlantonista()` (mesmo hash determinístico dos
  cartões do calendário — nenhuma paleta paralela, nenhum seletor
  manual de cor).

Busca (`<input type="search">`) só aparece acima de 8 pessoas
(`LIMITE_PESSOAS_SEM_BUSCA`). Cada pessoa é um `<button>` real com
`aria-pressed` e `draggable` no MESMO elemento. Participantes inativos
referenciados e com vínculo pendente ganham uma tag
(`.status-badge neutral`/`warning`) — nunca escondidos (fonte:
`nomesInativosReferenciadosPlantao`, novo `useMemo` no Dashboard, e
`vinculos` — já uma prop existente de `PreviewPlantao` — filtrado por
`status !== 'VINCULADO'`).

## 3. Drag-and-drop — HTML5 nativo, sem biblioteca nova

`PlantaoRoster`: cada pessoa é `draggable`, grava o nome em
`dataTransfer.setData('text/plain', ...)` no `onDragStart`.
`PlantaoCalendario`: cada dia aceita `onDragOver`/`onDragEnter`/
`onDragLeave`/`onDrop` — o `onDrop` extrai o nome de
`dataTransfer.getData('text/plain')` e chama
`onSolicitarNovaAtribuicao(nome, data)`, a MESMA prop que o clique no
fundo do dia (quando alguém está selecionado) e o botão "+ Adicionar"
chamam. Nenhuma lógica de domínio paralela para drag — confirmado por
boundary test (≥3 chamadas de `onSolicitarNovaAtribuicao` no arquivo:
clique de fundo, "+ Adicionar", drop).

Feedback visual de drag-over: classe `.plantao-dia.drop-alvo` (outline
sutil + fundo suave), aplicada via estado local
(`diaEmDragOver`, `useState` dentro de `PlantaoCalendario` — UI pura,
nunca sobe ao Dashboard). Sem mobile: toque não dispara eventos HTML5 de
drag — nenhum polyfill adicionado, comportamento nativo do navegador.

## 4. Operação comum — `solicitarNovaAtribuicaoPlantao()`

```ts
function solicitarNovaAtribuicaoPlantao(plantonistaNomeOriginal: string, dataIso: string) {
  if (plantonistaNomeOriginal.trim() === '') {
    abrirCriacaoAtribuicaoPlantao(dataIso);
    return;
  }
  const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
  const padrao = grupo === undefined ? null : obterPadraoHorarioGrupoParaData(grupo, dataIso);
  if (padrao === null) {
    abrirCriacaoAtribuicaoPlantao(dataIso, plantonistaNomeOriginal);
    return;
  }
  setQuickAddPlantao({ plantonistaNomeOriginal, dataIso, padrao });
}
```

`abrirCriacaoAtribuicaoPlantao()` ganhou um segundo parâmetro opcional
(`plantonistaNomeOriginal?`) — drag pode arrastar uma pessoa diferente da
que está selecionada no roster; quando omitido, cai no comportamento de
sempre (`plantonistaSelecionadoPlantao ?? ''`).

## 5. Quick-add — `components/plantao/QuickAddPlantaoPopover.tsx`

Dialog pequeno central (`.edit-modal.plantao-quick-add-dialog`, mesmo
chrome de qualquer modal do Dashboard) — decidido por confiabilidade em
vez de popover ancorado à célula (posicionamento robusto exigiria lidar
com overflow do calendário/scroll interno/proximidade da borda da tela,
complexidade desproporcional nesta primeira implementação; nenhuma
biblioteca de posicionamento como Popper/Floating UI foi adicionada).

Mostra pessoa, data (`formatarData`, mesmo helper de sempre) e o preview
humano via `previewPadraoHorarioPlantaoDia()` — o MESMO helper já
exportado por `PadraoHorarioSemanalCampo.tsx` (PLANTAO-PADRAO-1), nunca
uma segunda implementação, nunca expõe `fimDiaOffset` cru. Três ações:

- **Adicionar** → `confirmarQuickAddPlantao()` → `construirAtribuicaoDoPadraoHorario()`
  + `criarAtribuicaoPlantaoNaWorkingCopy()`;
- **Outro horário** → `abrirOutroHorarioQuickAddPlantao()` → fecha o
  popover e abre `ModalEditarAtribuicaoPlantao` pré-preenchido
  (participante + data, horário vazio — mesmo princípio de "nunca
  inventar horário" de sempre);
- **Escape/backdrop/X** → `fecharQuickAddPlantao()` → não toca a working
  copy.

## 6. Construção pela padrão — `construirAtribuicaoDoPadraoHorario()`

`lib/editorPlantao.ts`, único helper puro de construção:

```ts
export function construirAtribuicaoDoPadraoHorario(opcoes: {
  plantonistaNomeOriginal: string;
  dataCivil: string;
  padrao: PadraoHorarioPlantaoDia;
}): { plantonistaNomeOriginal: string; inicio: MomentoPlantao; fim: MomentoPlantao } {
  const { plantonistaNomeOriginal, dataCivil, padrao } = opcoes;
  return {
    plantonistaNomeOriginal,
    inicio: { data: dataCivil, hora: padrao.horaInicio },
    fim: {
      data: padrao.fimDiaOffset === 1 ? adicionarDias(dataCivil, 1) : dataCivil,
      hora: padrao.horaFim,
    },
  };
}
```

Reaproveita `adicionarDias()` (`@escala-ici/contrato`) para a virada de
dia — nenhum cálculo de data manual. O resultado alimenta o MESMO
`adicionarAtribuicaoEditavel()` que o modal completo já usava
(`calcularDuracaoEntreMomentos()` calcula a duração internamente, sem
mudança). Chamada de um ÚNICO lugar (`confirmarQuickAddPlantao()`) —
confirmado por boundary test.

## 7. Virada de dia e 24h — testado

`2026-08-16` (domingo) + `19:00→07:00 +1` → início `2026-08-16 19:00`,
fim `2026-08-17 07:00` (12h). `2026-08-21` (sexta) + `19:00→19:00 +1` →
início `2026-08-21 19:00`, fim `2026-08-22 19:00` (24h). Testado com
`calcularDuracaoEntreMomentos()` + `adicionarAtribuicaoEditavel()`
encadeados (`lib/editorPlantao.test.ts`) — a duração real bate com o
esperado (720min/1440min), não só a data.

## 8. Importados intactos

`adicionarAtribuicaoEditavel()` só ACRESCENTA ao array — nunca mapeia/
edita os elementos existentes. Testado explicitamente: working copy com
uma atribuição de 43h e outra de 5h (mesmas bordas da fixture real)
recebe uma nova atribuição via padrão, e as duas originais permanecem com
`duracaoMinutos` byte-a-byte idêntico.

## 9. Dirty guard — sem regressão da FIX

`criarAtribuicaoPlantaoNaWorkingCopy()` chama `marcarPlantaoEditadoNoEditor()`
(seta `plantaoPossuiAlteracoesNaoSalvas = true`, único sinal lido pelo
guard de troca de contexto desde `ESCALAS-UX-2A.1-FIX`) —
`salvarModalAtribuicaoPlantao()` (modo `'criar'`) e
`confirmarQuickAddPlantao()` chamam a MESMA função; o ramo `'editar'`
continua chamando `marcarPlantaoEditadoNoEditor()` diretamente, como
antes. Nenhum caminho novo usa `plantaoEditadoDesdeImportacao` como
guard — confirmado por boundary test.

## 10. Sem padrão / sem seleção

Sem `padraoHorarioSemanal` para o dia, `solicitarNovaAtribuicaoPlantao()`
cai direto em `abrirCriacaoAtribuicaoPlantao()` — mesmo modal completo de
sempre, início/fim vazios, nunca inventa horário. Clicar "+ Adicionar"
sem ninguém selecionado (`plantonistaNomeOriginal === ''`) também cai
direto no editor completo — comportamento idêntico ao de antes desta
fase.

## 11. Mobile/tablet

Sem drag no mobile — toque não dispara eventos HTML5 de drag (nenhum
polyfill). Fluxo principal idêntico ao desktop, sem a etapa de arrastar:
tocar pessoa → tocar dia → quick-add → "Adicionar". Roster empilha ACIMA
do calendário em `@media (max-width: 780px)` (mesmo breakpoint já
estabelecido para o calendário de Plantão) — a lista de pessoas vira uma
faixa horizontal com `overflow-x: auto` PRÓPRIO (nunca a página inteira).
Em `@media (max-width: 960px)` o roster estreita de 260px para 200px
antes de empilhar — nunca esmaga o calendário para manter uma largura
fixa.

## 12. Acessibilidade

Cada pessoa do roster é um `<button>` real com `aria-pressed` — o
`draggable` vive no MESMO elemento acessível, nunca um handle separado
só-para-drag. "+ Adicionar" continua um `<button>` focável em todo dia —
a alternativa por teclado obrigatória mesmo com drag disponível (Tab até
a pessoa → Enter seleciona → Tab até o dia → Enter/clique em
"+ Adicionar" abre a criação). Nenhuma implementação de "drag por
teclado" — a ação discreta já é suficiente (confirmado com o pedido).
Quick-add: `useTeclaEsc()` (Escape cancela), foco inicial no título via
`aria-labelledby`, mesmo padrão de todo modal do Dashboard.

## 13. Validação visual

Nenhum navegador disponível neste ambiente — auditoria estática (leitura
direta do JSX/CSS resultante + sucesso de build/typecheck, que já
garante JSX válido e CSS sem erro de sintaxe) foi a validação realizada,
consistente com a preferência já registrada de que o usuário testa
mudanças de UI diretamente. Nenhum dos cenários de `desktop 1440/1280/
1024/768/mobile 412/390` foi exercitado num navegador real por este
agente.

## 14. Componentes criados

- `components/plantao/PlantaoRoster.tsx` (+ nenhum arquivo `.test.ts`
  dedicado — a lógica de filtro/seleção é trivial o suficiente para ser
  coberta pelos boundary tests + typecheck; a lógica REAL não-trivial
  desta fase, `construirAtribuicaoDoPadraoHorario()`, tem 11 testes
  próprios).
- `components/plantao/QuickAddPlantaoPopover.tsx`.

## 15. Helpers criados

- `lib/editorPlantao.ts`: `construirAtribuicaoDoPadraoHorario()`.

## 16. Componentes/funções alterados

- `components/plantao/PlantaoCalendario.tsx`: `onAdicionarPlantao`
  substituído por `onSolicitarNovaAtribuicao` + `plantonistaSelecionado`;
  handlers de drag/drop/click adicionados; classe `.drop-alvo`/
  `.selecao-ativa`.
- `apps/dashboard/src/DashboardApp.tsx`: novo estado `quickAddPlantao`;
  `abrirCriacaoAtribuicaoPlantao()` ganhou parâmetro opcional;
  `criarAtribuicaoPlantaoNaWorkingCopy()` extraída de
  `salvarModalAtribuicaoPlantao()`; `solicitarNovaAtribuicaoPlantao()`,
  `confirmarQuickAddPlantao()`, `abrirOutroHorarioQuickAddPlantao()`,
  `fecharQuickAddPlantao()` novas; `nomesInativosReferenciadosPlantao`
  novo `useMemo`; bloco JSX do "Resumo por pessoa" removido, substituído
  pelo layout de duas áreas com `PlantaoRoster`.

## 17. Testes novos

- `lib/editorPlantao.test.ts`: +11 (41→52) — `construirAtribuicaoDoPadraoHorario`
  (domingo 19→07+1, sexta 19→19+1, mesmo dia, primeiro/último dia do
  período, nome preservado, data de início nunca deslocada, data de fim
  conforme offset, duração 12h/24h reais via `adicionarAtribuicaoEditavel`,
  importados 43h/5h intactos).
- `tests/plantao-roster-drag-boundaries.test.mjs` (novo arquivo, 20
  testes) — cobertura estrutural completa do § 56 do pedido: roster
  existe, resumo antigo removido (JSX + CSS morto), layout de duas áreas,
  click/drag convergem para a mesma função, drop nunca grava, quick-add
  nunca grava, padrão vem de `GrupoPlantao` (nunca copiado para
  `ContextoEscalaAtivo`), sem padrão abre editor completo, "Outro
  horário" funciona, preview reaproveitado (nunca expõe `fimDiaOffset`),
  construção única (não duplicada), atribuições existentes preservadas,
  dirty real usado, nenhum Firebase nos componentes de apresentação,
  nenhum hardcode de sigla, nenhuma publicação, nenhuma biblioteca grande
  adicionada, mobile sem scroll horizontal de página, acessibilidade
  (`<button>` real + `aria-pressed`), "+ Adicionar" sempre focável.
- `tests/plantao-editor-boundaries.test.mjs`: 3 testes pré-existentes
  ajustados (ver § 18 abaixo) — nenhum removido, contagem total mantida
  (35 testes no arquivo, mesma quantidade de antes).

## 18. Ajuste em testes pré-existentes (erratas)

Três testes de `tests/plantao-editor-boundaries.test.mjs`, escritos na
ESCALAS-UX-1C, proibiam explicitamente drag-and-drop — correto NA ÉPOCA
(aquela fase avaliou e decidiu não implementar), incorreto agora que
ESCALAS-UX-2B autoriza exatamente isso:

- Teste 6 — a proibição de `onDragStart`/`onDrop`/`draggable` foi
  removida (geradores automáticos/cópia de período continuam proibidos,
  inalterado).
- Teste 28 — regex do corpo de `abrirCriacaoAtribuicaoPlantao()`
  atualizada para a nova assinatura (parâmetro opcional) — a asserção em
  si (início/fim sempre vazios, nenhum horário hardcoded) não mudou.
- Teste 30 — reescrito: em vez de "drag não existe em lugar nenhum",
  agora confirma que drag NUNCA vazou para os módulos de domínio puro
  (`lib/montagemRascunhoPlantao.ts`/`lib/conciliacaoPlantoes.ts`) — só a
  camada de apresentação (roster/calendário) manipula eventos de drag. A
  cobertura completa da nova garantia (drag e click convergem, drop nunca
  grava) vive em `tests/plantao-roster-drag-boundaries.test.mjs`.

## 19. Totais

- `test:unit`: 932/932 (baseline 921 + 11 novos).
- `test:boundaries`: 257/257 (baseline 237 + 20 novos; 3 pré-existentes
  ajustados — ver § 18, nenhum removido).
- `test:firestore-rules`: 166/166 (inalterado — nenhuma mudança de
  Rules/schema nesta fase).

## 20. Typechecks/lint/builds

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros — só os 6 warnings pré-existentes já
conhecidos, inalterados), `build:dashboard`, `build:app:pages`,
`build:apps`, `validate:pwa`, `validate:artifact`, `git diff --check` —
todos OK.

## 21. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.rules`, `firestore.indexes.json`,
`packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/firebase/authRepository.ts`, `apps/app/`, `apps/push-worker/`,
`components/organizacao/`, `components/escalas/`, `lib/contextoEscala.ts`,
`components/ScheduleGrid.tsx`, `lib/sessao.ts` — **vazio**. Jornada 6x1,
`ContextoEscalaAtivo`, os dirty guards, App, Auth, Push e Organização
permanecem intactos. Nenhum campo novo persistente; nenhuma Rule nova.

## 22. Arquivos alterados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`components/plantao/PlantaoCalendario.tsx`, `lib/editorPlantao.test.ts`,
`lib/editorPlantao.ts`, `package.json` (lista de arquivos de
`test:boundaries`), `tests/plantao-editor-boundaries.test.mjs`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`.

## 23. Arquivos criados

`components/plantao/PlantaoRoster.tsx`,
`components/plantao/QuickAddPlantaoPopover.tsx`,
`tests/plantao-roster-drag-boundaries.test.mjs`,
`CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md`.

## 24. Git

Commit local único, mensagem `feat(plantao): adiciona roster e montagem
rapida`. Nenhum push, deploy, merge, rebase, amend, reset ou stash.

## 25. Confirmação

NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. PRODUÇÃO NÃO FOI TOCADA.

Esta fase **para aqui** — não inicia `ESCALAS-UX-2C` nem `PLANTÃO-3C`.
