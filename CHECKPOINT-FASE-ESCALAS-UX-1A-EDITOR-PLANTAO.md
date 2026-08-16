# Checkpoint — Fase ESCALAS-UX-1A (Editor visual de Plantão importado)

Data: 2026-08-16. Escopo: substituir a prévia "só-leitura + tabela" de
Plantão por um Editor visual baseado em calendário, com uma **working
copy** editável como única fonte de verdade pós-importação. Princípio
permanente registrado: "Importação nunca é um destino. Importação é
apenas uma forma de preencher o Editor de Escala." **Nenhuma publicação,
nenhuma mudança de Firestore Rules/schema persistente/árvore
organizacional/6x1.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD            a8fb495a972677a3af1727f0e75697fa9a8f0494
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 9]
```

Working tree limpo no precheck (sem cache `.sites-runtime` aninhado
desta vez). Baseline de testes confirmado antes de qualquer edição:
`test:unit` 716/716, `test:boundaries` 153/153, `test:firestore-rules`
153/153, typechecks OK, lint 0 erros.

Durante a fase, rodar `npx tsc` dentro de `packages/contrato/` recriou
`packages/contrato/.sites-runtime/` (cache de ferramenta, mesmo padrão
já observado na PLANTÃO-3B.1 — coberto só pelo `.gitignore` de raiz,
não aninhado) — removido antes do commit.

## Leitura prévia

`docs/spec/PLANTOES.md` (seção 12 — "Nova escala — visão futura",
confirmada como fora de escopo desta fase; seção 15 — roadmap,
confirma PLANTÃO-5/gerador determinístico como fase distinta),
`ADMINISTRACAO_E_HIERARQUIA.md`, `HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`,
`UI_CASCADE_E_HERANCA.md`; checkpoints PLANTÃO-1/2/3A/3B/3B.1/UI-ORG-1A;
`packages/contrato/src/{tiposPlantao,parserPlantao,modeloPlantaoPersistente}.ts`,
`lib/conciliacaoPlantoes.ts`, `lib/montagemRascunhoPlantao.ts`,
`components/lembretes/LembretesCalendario.tsx`, `lib/lembretesUi.ts`,
`components/ScheduleGrid.tsx` (confirmado como grid pessoa×dia, não
calendário — não reaproveitável), `app/globals.css` (famílias
`.calendar-grid`/`.lembretes-grid` e a colisão de CSS documentada),
o bloco `PreviewPlantao`/`ModalGrupoPlantao`/`ModalContatosParticipante`
de `apps/dashboard/src/DashboardApp.tsx`.

## Bug real corrigido durante a fase: `sugerirCompetenciaPlantao()` usava mês calendário, não a janela 26→25

Antes desta fase, `periodoInicio`/`periodoFim` eram calculados como
"dia 1 ao último dia do mês calendário" — divergente da convenção real
do Escala ICI (26→25, já usada por `competenciaOperacional()` na 6x1 e
pela fixture de Rules `periodoInicio:'2026-07-26'`/`periodoFim:'2026-08-25'`
para competência `'2026-08'`). Isso nunca tinha sido pego porque nenhuma
fase anterior tinha um requisito explícito o bastante sobre a janela
26→25 — o Editor visual, que PRECISA distinguir dia de contexto de dia
de competência para destacar a janela corretamente no calendário, expôs
a divergência.

**Correção**: duas funções puras novas em `lib/montagemRascunhoPlantao.ts`
— `competenciaDoDia()` (dia ≤ 25 fica no próprio mês; dia ≥ 26 vira
competência do mês seguinte) e `periodoDaCompetencia()` (26 do mês
anterior → 25 do próprio mês, nunca dependente de quantos dias o mês
tem). `sugerirCompetenciaPlantao()` reescrita para agrupar por essa
janela em vez de mês calendário.

**Reaproveitamento em vez de duplicação**: a regra de rollover em si já
existia como `competenciaOperacional()` (`packages/contrato/src/jornada.ts`,
usada pela 6x1/`EmployeeApp`) — `competenciaDoDia()` foi reescrita para
DELEGAR a ela, mantendo só a validação defensiva (mês/ano fora de
alcance devolve `null` em vez de lançar, necessário porque uma planilha
importada pode ter uma linha com data quebrada e a sugestão de
competência não pode derrubar a importação inteira por isso).

Verificado empiricamente contra a fixture real sanitizada (script
temporário, criado e apagado só para essa verificação): a competência
sugerida bate exatamente com `{competencia:"2026-08",
periodoInicio:"2026-07-26", periodoFim:"2026-08-25"}`, e as duas
atribuições de borda da fixture (43h começando 25/07, 5h terminando
26/08) são precisamente os dois casos de borda que os testes cobrem.

## Arquitetura — a working copy

`lib/editorPlantao.ts` (novo, puro — sem Firestore, sem React):

- `AtribuicaoPlantaoEditavel` — estende `AtribuicaoPlantaoBruta` com
  `idLocal` (identidade local estável, nunca persistida, nunca baseada
  em `linhaOrigem`) e `origemImportacao` (`true`=veio do XLS,
  `false`=adicionada manualmente). Por ESTENDER em vez de criar um tipo
  paralelo, é estruturalmente compatível com `AtribuicaoPlantaoBruta[]`
  — nenhum adaptador foi necessário para reaproveitar
  `calcularDuracaoBrutaDosIntervalos`, `detectarSobreposicoesPlantao`,
  `identificarLacunasPlantao`, `consolidarParticipantesPlantao`,
  `aplicarVinculosNasAtribuicoes` (todas pré-existentes, inalteradas).
- `criarAtribuicoesEditaveis()` / `editarAtribuicaoEditavel()` /
  `adicionarAtribuicaoEditavel()` / `excluirAtribuicaoEditavel()` —
  mutação pura (sempre devolve um array novo, nunca muta o array
  recebido nem a fonte original).
- `validarAtribuicaoEditavel()` — bloqueia só plantonista/datas vazias e
  fim ≤ início; duração atípica é aviso, nunca bloqueio.
- `agruparAtribuicoesPorDia()`, `nomeCurtoPlantonista()`,
  `indiceIdentidadePlantonista()` (hash determinístico do nome, mod 8 —
  nunca posição no array, para uma pessoa nunca mudar de cor quando
  outra é adicionada/removida), `resumirPorPessoa()` (inclui pessoas
  com 0 atribuições atuais, ex.: alguém só na contabilidade declarada),
  `ehDiaDeContexto()`, `conferirEscalaAtualPlantao()`.
- `duracaoPlantaoAtipica()` e `rotuloHorarioCartaoPlantao()` — a
  primeira foi MOVIDA de `DashboardApp.tsx` para cá (era uma função
  módulo-local ali) porque o calendário precisa da MESMA regra que a
  Lista/Contabilidade já usavam — nunca uma segunda definição de
  "atípico" duplicada entre os dois lugares.

## O calendário e o modal

- `components/plantao/PlantaoCalendario.tsx` — grade própria
  (`.plantao-grid`, terceira família de CSS paralela a
  `.calendar-grid`/`.lembretes-grid`, mesmo raciocínio de colisão já
  documentado para Lembretes em `app/globals.css`). Cobre a janela
  inteira da competência (26→25) mais os dias necessários para
  completar semanas de domingo a sábado — esses dias extras são DIAS
  REAIS (dias de contexto, estilo discreto via `.plantao-dia.contexto`),
  nunca células em branco, porque a fixture real já tem atribuições
  começando/terminando exatamente neles. Sem navegação de mês (diferente
  de `LembretesCalendario`) — o Editor mostra sempre a única competência
  já carregada pela importação. Cada célula tem um `+ Adicionar` sempre
  presente (nunca condicional) e um cartão por atribuição
  (`nomeCurtoPlantonista` + `rotuloHorarioCartaoPlantao` — "19:00 →
  07:00"/"24h"/"⚠ 43h"), identidade visual via
  `data-identidade={indiceIdentidadePlantonista(...)}` (paleta de 8
  cores nova em `app/globals.css`, light+dark, nome sempre visível —
  nunca só cor).
- `components/plantao/ModalEditarAtribuicaoPlantao.tsx` — modal único
  para criar OU editar (reaproveita `useTeclaEsc`, `modal-backdrop`/
  `edit-modal admin-modal`/`panel-title`/`rollback-actions`, o mesmo
  esqueleto de `ModalContatosParticipante`). Plantonista é um **select**
  sobre os participantes já conhecidos da competência (nunca texto
  livre) — decisão deliberada para nunca introduzir, via calendário, um
  nome que a conciliação de vínculos desconhece; isso teria exigido
  reconciliar `vinculosPlantao` a cada edição, um sistema mais complexo
  do que esta fase pede ("não construir sistema complexo"). Nenhum
  horário padrão pré-preenchido (nem 19:00/07:00 nem qualquer outro).
  "Excluir" (só em modo edição) e "Salvar" só atualizam a working copy
  em memória — persistência real continua exclusivamente pelo "Salvar
  rascunho" já existente.

## `DashboardApp.tsx` — fiação

- Novo estado: `atribuicoesEditaveisPlantao` (a working copy),
  `plantaoEditadoDesdeImportacao` (dirty flag), `modalAtribuicaoPlantao`
  (estado do modal criar/editar).
- `interpretarPlantao()` agora cria a working copy
  (`criarAtribuicoesEditaveis`) e já calcula a sugestão de competência
  na importação (antes só acontecia em "Validar prévia") — o calendário
  precisa da janela 26→25 antes mesmo dos vínculos serem resolvidos
  (vínculo pendente nunca bloqueia visualização).
- **A mudança crítica**: `participantesPlantao` e
  `atribuicoesPlantaoComVinculo` (useMemo) passaram a derivar de
  `atribuicoesEditaveisPlantao` em vez de `resultadoPlantao.atribuicoes`.
  Como `salvarRascunhoPlantaoAcao()` já usava
  `atribuicoesPlantaoComVinculo` para montar o payload
  (`montarAtribuicoesPlantaoRascunho`), e a aba "Lista" (antes
  "Plantões") já renderizava a partir da mesma variável, essa única
  mudança de fonte fez a Lista, o Calendário e o payload de salvar
  convergirem automaticamente para a MESMA working copy — sem duplicar
  nenhuma lógica de leitura.
- `resultadoPlantao`/`resultadoPlantao.atribuicoes` continuam
  intocados/congelados — usados só por `conferirContabilidadePlantao()`
  (Conferência da fonte) e por `montarCompetenciaPlantaoRascunho()`
  (que precisa dos totais DECLARADOS na origem, nunca dos atuais).
- `PreviewPlantao`: nova aba "Calendário" (padrão após importar,
  primeira no `segmented-control`); aba "Plantões" renomeada
  visualmente para "Lista" (chave interna `'plantoes'` inalterada,
  para minimizar diff); "Resumo do editor" (Plantonistas/Plantões/
  Horas atuais/Alertas, reaproveitando `.import-summary.plantao-resumo-grid`
  já existente); "Resumo por pessoa"; "Alertas clicáveis" (durações
  atípicas abre o modal na primeira atribuição atípica; vínculos
  pendentes muda para a aba Vínculos — sem nenhum sistema de roteamento
  de alertas); banner "N usuário(s) precisam ser vinculados" (nunca
  bloqueia o calendário, só aparece como aviso); indicador de estado
  "Alterações não salvas"/"Nenhuma alteração desde a importação"; aba
  "Contabilidade" ganhou o painel "Escala atual (working copy editada)"
  antes da tabela "Fonte original" já existente, com a frase "Estes
  valores representam o arquivo importado original."

## Testes

- `lib/editorPlantao.test.ts` (novo) — 39 testes: criação/edição/
  exclusão/adição da working copy, imutabilidade da fonte original após
  um ciclo completo de edição, validação (bloqueia só os 4 erros
  objetivos, duração atípica não bloqueia), agrupamento por dia, nome
  curto, identidade estável (índice não muda quando uma pessoa nova é
  adicionada), resumo por pessoa (inclui zero-atribuições), dia de
  contexto, conferência da escala atual, `duracaoPlantaoAtipica`/
  `rotuloHorarioCartaoPlantao`.
- `lib/montagemRascunhoPlantao.test.ts` — 8 testes novos para
  `competenciaDoDia`/`periodoDaCompetencia`, 2 testes de borda dia-25/
  dia-26 para `sugerirCompetenciaPlantao`, 3 testes atualizados para a
  nova janela 26→25 (substituindo asserções do cálculo antigo de mês
  calendário), e o describe **CRÍTICO** (3 testes) provando que o
  payload de `montarAtribuicoesPlantaoRascunho()` reflete edição/
  exclusão/adição feitas na working copy — nunca os valores originais
  do parser.
- `tests/plantao-editor-boundaries.test.mjs` (novo, 9 testes) —
  `lib/editorPlantao.ts` puro (sem Firestore/React); componentes novos
  sem Firestore direto; nenhuma função `publicarPlantao`/referência a
  `competenciasPlantao` nos arquivos novos; nenhum hardcode de
  COSI/CODB/SOC/NOC/GEDSI; modal sem horário padrão 19:00/07:00; sem
  drag-and-drop/gerador automático/cópia de período; Lista e Calendário
  provados como consumindo a MESMA working copy (regex sobre
  `DashboardApp.tsx`); `lib/editorPlantao.ts` nunca importa os
  repositórios Firestore de Plantão; nenhuma dependência
  testing-library/jsdom adicionada.

## Auditoria de NOC (documentada, não corrigida)

Por instrução explícita desta fase: uma equipe/unidade real encontrada
faltando ou quebrada deve ser documentada, nunca corrigida
silenciosamente. `EQ_NOC` (NOC) existe só em `scripts/seed-organizacao.mjs`
(dado de seed, nunca confirmado como executado num ambiente real) e em
fixtures de teste — nenhum código de produção trata NOC como caso
especial, e não há confirmação de que a equipe exista de fato no
Firestore de nenhum ambiente. Nada foi alterado a respeito; registrado
também em `docs/spec/PLANTOES.md` § 24.7 para decisão futura.

## Validação final

```
npm run typecheck            OK (0 erros)
npm run typecheck:apps       OK (dashboard + app-web)
npm run typecheck:worker     OK
cd packages/contrato && npx tsc --noEmit
                              3 erros PRÉ-EXISTENTES, fora de escopo
                              (jornada.ts:260, detectorPlanilha.test.ts,
                              parserPlantao.test.ts) — mesmos de antes
                              desta fase, confirmados via git-stash em
                              fases anteriores.
npm run lint                  0 erros (5 warnings pré-existentes,
                               arquivos não tocados nesta fase)
npm run test:unit             766/766 (baseline 716 — cresceu, nada
                               removido)
npm run test:boundaries       162/162 (baseline 153 — cresceu, nada
                               removido)
npm run test:firestore-rules  153/153 (EXATAMENTE igual ao baseline —
                               Rules intocadas)
npm run build:dashboard       OK
npm run build:app:pages       OK (inclui validate-deployments --app-only)
npm run build:apps            OK
npm run validate:pwa          OK
npm run validate:artifact     OK
git diff --check              limpo (sem erros de whitespace)
```

## Diff-zero confirmado

`apps/app/`, `firestore.rules`, `firestore.indexes.json`,
`lib/firebase/authRepository.ts`, `apps/push-worker/`,
`components/organizacao/`, `lib/organizacao.ts`,
`components/ScheduleGrid.tsx`, `packages/contrato/src/tiposPlantao.ts`,
`packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/conciliacaoPlantoes.ts`, `lib/firebase/plantaoWriteRepository.ts`,
`lib/firebase/plantaoReadRepository.ts` — todos com diff zero
(`git diff --stat` vazio para cada um).

## PII

Nenhum nome/telefone/e-mail real em nenhum arquivo novo ou modificado —
só os nomes já sanitizados da fixture (Ana Costa/Bruno Lima/Carlos
Nunes/Daniela Rocha), já usados em fases anteriores.

## Arquivos modificados/criados

Modificados: `app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`docs/spec/PLANTOES.md`, `lib/montagemRascunhoPlantao.ts`,
`lib/montagemRascunhoPlantao.test.ts`, `package.json` (registro do novo
arquivo de boundary test), `packages/contrato/src/parserPlantao.ts`
(nova função `calcularDuracaoEntreMomentos`).

Criados: `lib/editorPlantao.ts`, `lib/editorPlantao.test.ts`,
`components/plantao/PlantaoCalendario.tsx`,
`components/plantao/ModalEditarAtribuicaoPlantao.tsx`,
`docs/spec/EDITOR_ESCALAS.md`,
`tests/plantao-editor-boundaries.test.mjs`,
`CHECKPOINT-FASE-ESCALAS-UX-1A-EDITOR-PLANTAO.md`.

## O que esta fase explicitamente NÃO fez

- Nenhuma publicação (`publicarPlantao()` continua inexistente).
- Nenhum arrastar-e-soltar.
- Nenhum "+ Nova escala vazia" nem "Copiar período anterior" (adiados
  para ESCALAS-UX-1B).
- Nenhum gerador/distribuição automática/rotação/autocomplete.
- Nenhuma mudança funcional na escala 6x1.
- Nenhuma mudança em `OrganizationTree`/`OrganizationTeamPicker`/
  `lib/organizacao.ts`/`equipes`/`unidadesOrganizacionais`.
- Nenhum hardcode/correção silenciosa de NOC.
- Nenhuma mudança no modelo de timezone.
- `@testing-library/react`/jsdom continuam não adicionados.

**NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. FIREBASE PRODUÇÃO NÃO FOI ALTERADO.
NENHUM PLANTÃO FOI PUBLICADO. PRODUÇÃO NÃO FOI TOCADA.**
