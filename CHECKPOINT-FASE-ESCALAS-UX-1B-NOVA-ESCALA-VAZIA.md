# Checkpoint — Fase ESCALAS-UX-1B ("+ Nova escala" + Plantão criado vazio no mesmo Editor)

Data: 2026-08-16. Escopo: segunda porta de entrada do Editor de Escala —
criar uma escala de Plantão **sem planilha** (Grupo + competência → "Criar
escala vazia") e editá-la no MESMO calendário/lista/modal da ESCALAS-UX-1A.
**Nenhuma publicação, nenhuma mudança de Firestore Rules/schema
persistente/árvore organizacional/6x1.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD            6ee7603dadc96e42d2411e015ca62829be6dc5b2
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 10]
```

Working tree limpo no precheck. Baseline de testes confirmado antes de
qualquer edição: `test:unit` 766/766, `test:boundaries` 162/162,
`test:firestore-rules` 153/153, typechecks OK, lint 0 erros, builds OK.

Durante a fase, rodar `npx tsc --noEmit` dentro de `packages/contrato/`
recriou `packages/contrato/.sites-runtime/` (mesmo cache de ferramenta já
observado nas fases PLANTÃO-3B.1/ESCALAS-UX-1A — coberto só pelo
`.gitignore` de raiz, não aninhado) — removido antes do commit.

## Leitura prévia

`docs/spec/EDITOR_ESCALAS.md` (princípios verbatim preservados),
`docs/spec/PLANTOES.md` § 12 ("Nova escala — visão futura") e § 24
(ESCALAS-UX-1A), `HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`,
`ADMINISTRACAO_E_HIERARQUIA.md`, `UI_CASCADE_E_HERANCA.md`; checkpoints
ESCALAS-UX-1A/PLANTÃO-3B/PLANTÃO-3B.1; `lib/editorPlantao.ts`,
`components/plantao/{PlantaoCalendario,ModalEditarAtribuicaoPlantao}.tsx`,
`packages/contrato/src/modeloPlantaoPersistente.ts` (confirmado:
`OrigemPlantao` já incluía `'MANUAL'`/`'GERADO'` desde a PLANTÃO-3A —
nunca um valor novo), `lib/firebase/plantao{Read,Write}Repository.ts`
(confirmado: `obterCompetenciaPlantaoRascunho()` já existente, suficiente
para a checagem de duplicata), `components/organizacao/OrganizationTeamPicker.tsx`
(confirmado: seletor de EQUIPES da árvore organizacional, não de Grupos de
Plantão — não reutilizável para "escolher Grupo"; o `<select>` já usado no
painel "Salvar rascunho" é o padrão certo a reaproveitar), a árvore
completa de estado/funções de Plantão em `apps/dashboard/src/DashboardApp.tsx`
(`Tela`, navegação, `PreviewPlantaoProps`, `interpretarPlantao`,
`salvarRascunhoPlantaoAcao`, o efeito de carregamento de
`gruposPlantaoAdmin`).

## Gaps encontrados (auditoria) e como foram resolvidos

A auditoria prévia identificou 6 pontos concretos que impediam o mesmo
Editor de abrir para uma escala sem planilha — nenhum exigiu um segundo
pipeline, todos foram fechados no nível responsável:

1. **`PreviewPlantao` exigia `resultado`/`conferencia` não-nulos.**
   Resolvido: os dois se tornaram `| null` em `PreviewPlantaoProps`; uma
   nova prop `origem: OrigemPlantao` decide o que renderizar (painel
   "Fonte original"/divergências some quando `resultado === null`,
   substituído por "Escala criada manualmente"). O portão de renderização
   do Dashboard mudou de `resultadoPlantao !== null` para
   `origemPlantaoAtual !== null`.
2. **`participantesPlantao` dependia de `resultadoPlantao.contabilidadeInformada`.**
   Resolvido: para `origem === 'MANUAL'`, deriva de
   `consolidarParticipantesGrupoPlantao()` (nova, `lib/conciliacaoPlantoes.ts`)
   a partir dos participantes ATIVOS do Grupo, nunca da planilha.
3. **`salvarRascunhoPlantaoAcao()` exigia `resultadoPlantao !== null`.**
   Resolvido: guarda trocada para `origemPlantaoAtual !== null`; quando
   `resultadoPlantao` é `null`, um objeto `{totalBrutoCalculado:{quantidade:0,minutos:0},
   totaisInformados:null}` alimenta `montarCompetenciaPlantaoRascunho()` —
   nunca uma `ResultadoParsePlantao` XLS fingida.
4. **`montarCompetenciaPlantaoRascunho()`/`montarAtribuicoesPlantaoRascunho()`
   hardcodavam `origem: 'IMPORTADO'`** apesar do contrato já suportar
   `'MANUAL'`. Resolvido: ambas passaram a receber `origem: OrigemPlantao`
   como parâmetro obrigatório; os 11 pontos de chamada pré-existentes
   (todos do caminho `IMPORTADO`, em teste) foram atualizados para passar
   `origem: 'IMPORTADO'` explicitamente — nenhum comportamento mudou para
   eles, só ficou explícito.
5. **O painel "Salvar rascunho" dependia de `previaPlantaoValidada`**,
   que só era `true` via `validarPreviaPlantao()` (conciliação nome→login
   de planilha). Resolvido SEM mudar essa função: para `MANUAL`, os
   vínculos nascem TODOS já `VINCULADO` (`vinculosDeParticipantesGrupoPlantao()`,
   nova) — `previaPlantaoValidavel()` (inalterada) já retorna `true` para
   essa lista.
6. **`gruposPlantaoAdmin` só carregava em `tela==='plantoes'` ou
   `tipoArquivoDetectado==='PLANTAO'`.** Resolvido: o efeito de
   carregamento ganhou uma terceira condição, `novaEscalaEtapa !== null`
   — a lista de grupos já está disponível quando o coordenador chega no
   select de "Novo Plantão".

## Arquitetura entregue

### `lib/conciliacaoPlantoes.ts` (funções novas, participantes de uma escala MANUAL)

- `nomeParticipantePlantao(participante, usuarios)` — resolve
  `login → nome` do usuário cadastrado; cai no próprio login se o usuário
  não for encontrado (nunca lança, nunca inventa nome).
- `consolidarParticipantesGrupoPlantao(participantesAtivos, usuarios, atribuicoes)`
  — equivalente a `consolidarParticipantesPlantao()` para o caminho sem
  planilha; participante sem nenhuma atribuição permanece "0 plantões · 0h".
- `vinculosDeParticipantesGrupoPlantao(participantesAtivos, usuarios)` —
  vínculos já resolvidos (`VINCULADO`, sem `sugestao`) para cada
  participante ativo — nenhuma conciliação nome→login necessária, porque
  a identidade já é `login` desde o início.

### `lib/montagemRascunhoPlantao.ts`

- `montarCompetenciaPlantaoRascunho()`/`montarAtribuicoesPlantaoRascunho()`
  ganharam o parâmetro `origem: OrigemPlantao` (sem default — todo
  chamador decide explicitamente).
- `validarNovoPlantaoEmBranco({grupoId, competencia})` (nova) — só os
  dois campos exigidos por "Criar escala vazia": Grupo e competência
  (janela 26→25 via `periodoDaCompetencia()`, reaproveitada, nunca um
  cálculo de mês civil próprio).

### `apps/dashboard/src/DashboardApp.tsx`

- Novo estado: `origemPlantaoAtual` (`OrigemPlantao | null` — `null`
  quando não há nenhuma prévia de Plantão aberta), `novaEscalaEtapa`
  (`'tipo' | 'plantao' | null`), `novoPlantaoGrupoId`,
  `novoPlantaoCompetencia`, `novoPlantaoErro`, `novoPlantaoCriando`,
  `novoPlantaoRascunhoExistente`.
- `ModalNovaEscala` (novo componente local, mesmo padrão de
  `ModalGrupoPlantao`/`ModalContatosParticipante`) — duas etapas num
  único modal: `'tipo'` (dois cards, "Escala de jornada"/"Plantão") e
  `'plantao'` (select de Grupo com resumo compacto — nome, equipe
  responsável, participantes ativos — nunca o `grupoId` técnico como
  informação principal; input de competência com preview do período
  26→25; "Como começar?" com "Criar escala vazia"/"Importar planilha").
- `criarPlantaoEmBrancoAcao()` — valida via `validarNovoPlantaoEmBranco()`,
  checa duplicata via `obterCompetenciaPlantaoRascunho()` (já existente),
  carrega participantes ativos do Grupo, monta vínculos já resolvidos, e
  seta toda a fiação de estado do Editor (working copy `[]`,
  `origemPlantaoAtual='MANUAL'`, `resultadoPlantao=null`, competência/
  período, `tipoArquivoDetectado='PLANTAO'`) antes de navegar para a
  tela "Importar" — onde o Editor já vive.
- "+ Nova escala": botão novo no cabeçalho da tela "Escalas" (ao lado do
  já existente "Importar"), reaproveitando `.grade-header-actions` — sem
  item novo na navegação lateral.
- "Escala de jornada" e "Importar planilha" (dentro da etapa Plantão) só
  roteiam para `setTela('importar')` — nenhum parser/upload novo.
- "Abrir rascunho existente" leva à tela "Plantões" com o grupo
  expandido — ver limitação abaixo.

## O que NÃO foi feito (decisões deliberadas)

- **"Abrir rascunho existente" não reabre o rascunho dentro do
  calendário.** Reidratar a working copy a partir de
  `AtribuicaoPlantaoPersistida[]` exigiria uma conversão inversa de
  instante UTC → horário civil (não existe hoje —
  `converterMomentoParaInstanteUtc()` só vai num sentido; já era uma
  "pergunta aberta" registrada na ESCALAS-UX-1A) mais uma reconciliação
  cuidadosa de IDs para a idempotência do resave continuar valendo.
  Decisão deliberada de não construir isso agora — registrado como
  próximo passo explícito em `docs/spec/PLANTOES.md` § 25.5, não uma
  omissão silenciosa.
- **Nenhum gerador/distribuição automática** — `origem: 'GERADO'`
  permanece reservado no contrato, não implementado.
- **Nenhuma regra de cobertura COSI** (19→07/24h/12h por dia da semana)
  foi transplantada do dashboard antigo.
- **"Copiar escala anterior" não implementada** — registrada em
  `docs/spec/EDITOR_ESCALAS.md` § 8 como origem futura (`COPIADO`).
- **Nenhuma simplificação do formulário de Grupo de Plantão** (timezone/
  ACL/"equipe responsável") — fora de escopo para não misturar
  configuração rara do Grupo com criação mensal de escala.

## NOC (documentado, não corrigido — reconfirmado)

Reconfirmado nesta fase: `EQ_NOC` continua existindo só em
`scripts/seed-organizacao.mjs` (dado de seed) e em fixtures de teste —
nenhum código de produção (`lib/organizacao.ts`,
`components/organizacao/*`, `DashboardApp.tsx`) trata NOC como caso
especial, e não há confirmação de que a equipe exista de fato no
Firestore de nenhum ambiente. Nada foi alterado a respeito — mesmo
achado da ESCALAS-UX-1A § 24.7, apenas reafirmado.

## Testes

- `lib/conciliacaoPlantoes.test.ts` — 9 testes novos:
  `nomeParticipantePlantao` (resolve por login, cai no próprio login se
  não encontrado), `consolidarParticipantesGrupoPlantao` (consolida a
  partir do Grupo, participante sem atribuição continua visível, conta
  atribuições da working copy, ignora inativos), `vinculosDeParticipantesGrupoPlantao`
  (todo participante nasce VINCULADO, `previaPlantaoValidavel` já
  retorna `true`, lista vazia → `false` corretamente).
- `lib/montagemRascunhoPlantao.test.ts` — 11 testes novos: `origem`
  honrada (nunca hardcoded) nas duas funções de montagem;
  `validarNovoPlantaoEmBranco` (grupo/competência obrigatórios, nenhum
  outro campo exigido); e o describe **CRÍTICO — unificação do Editor**
  (4 testes) provando que os caminhos IMPORTADO e MANUAL produzem a
  MESMA forma de working copy/agrupamento por dia/resumo/conferência,
  que o payload MANUAL usa o `login` real do participante (nunca um
  nome de planilha), idempotência (3 atribuições → salvar → editar 1 →
  salvar de novo → ainda 3, nunca 6) e que excluir antes de salvar nunca
  deixa uma atribuição "fantasma" no payload.
- `tests/plantao-editor-boundaries.test.mjs` — 10 testes novos: existe
  UM único tipo de working copy/calendário/modal (nenhum segundo
  editor); a working copy MANUAL nasce sempre por
  `criarAtribuicoesEditaveis` (nunca `[]` seguido de um construtor
  paralelo); `lib/editorPlantao.ts`/`lib/conciliacaoPlantoes.ts` nunca
  importam o parser/XLSX; o parser nunca menciona `MANUAL`/`OrigemPlantao`;
  `montar*PlantaoRascunho` nunca hardcodam `origem: 'IMPORTADO'`;
  "+ Nova escala" não criou item de sidebar; nenhuma regra de cobertura
  COSI; a competência usa `periodoDaCompetencia` (nunca cálculo de mês
  civil próprio); nenhuma dependência da timezone do host;
  `apps/app/src/EmployeeApp.tsx` continua sem nenhum editor
  administrativo de Plantão.

## Validação final

```
npm run typecheck            OK (0 erros)
npm run typecheck:apps       OK (dashboard + app-web)
npm run typecheck:worker     OK
cd packages/contrato && npx tsc --noEmit
                              3 erros PRÉ-EXISTENTES, fora de escopo
                              (jornada.ts:260, detectorPlanilha.test.ts,
                              parserPlantao.test.ts) — idênticos ao
                              baseline, nenhum novo introduzido.
npm run lint                  0 erros (5 warnings pré-existentes,
                               arquivos não tocados nesta fase)
npm run test:unit             784/784 (baseline 766 — cresceu, nada
                               removido)
npm run test:boundaries       172/172 (baseline 162 — cresceu, nada
                               removido)
npm run test:firestore-rules  153/153 (EXATAMENTE igual ao baseline —
                               Rules intocadas, diff zero em firestore.rules)
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
`packages/contrato/src/parserPlantao.ts`,
`lib/firebase/plantaoWriteRepository.ts`,
`lib/firebase/plantaoReadRepository.ts`, `components/plantao/`,
`lib/editorPlantao.ts` — todos com diff zero (`git diff --stat` vazio
para cada um). Nenhum arquivo 6x1 tocado.

## PII

Nenhum nome/telefone/e-mail real em nenhum arquivo modificado — só os
nomes já sanitizados da fixture (Ana Costa/Bruno Lima/Carlos Nunes) e
fixtures de usuário sintéticas (`acosta`/`blima`/`gestor1`), já usados
em fases anteriores.

## Arquivos modificados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`lib/conciliacaoPlantoes.ts`, `lib/conciliacaoPlantoes.test.ts`,
`lib/montagemRascunhoPlantao.ts`, `lib/montagemRascunhoPlantao.test.ts`,
`tests/plantao-editor-boundaries.test.mjs`.

Criado: `CHECKPOINT-FASE-ESCALAS-UX-1B-NOVA-ESCALA-VAZIA.md`.

Nenhum arquivo novo em `components/plantao/`, `lib/editorPlantao.ts` ou
`packages/contrato/` — confirma que nenhum segundo editor/pipeline foi
construído; toda a fase coube em extensões pontuais dos módulos já
existentes.

## Validação visual

Auditoria estática (sem navegador disponível neste ambiente) — cada
alteração de JSX/CSS foi conferida por leitura de código seguindo o
checklist de `docs/spec/UI_CASCADE_E_HERANCA.md` (componente → DOM →
classe → pai → ancestrais → media query → especificidade), não por
inspeção real de DevTools. `.grade-header-actions` (reaproveitada para
o botão "+ Nova escala") e `.admin-modal`/`.modal-backdrop`/
`.rollback-actions` (reaproveitadas para `ModalNovaEscala`) já são
responsivas nos breakpoints existentes (`≤780px`, `≤560px`) — nenhum
media query novo foi necessário para os dois cards de tipo
(`.nova-escala-tipos` colapsa para 1 coluna em `≤560px`, mesmo padrão
de `.import-summary`). Como não houve execução real em 412/390/360px
nem alternância de tema real, esta fase NÃO afirma ter confirmado
mobile/light/dark visualmente — apenas por leitura de CSS/classes
reaproveitadas que já foram validadas nesses cenários em fases
anteriores.

## Confirmações finais

- Drag-and-drop: **NÃO implementado.**
- Copiar escala anterior: **NÃO implementado** (registrado como origem
  futura `COPIADO`).
- Publicação: **NÃO implementada** (`publicarPlantao()` continua
  inexistente; `competenciasPlantao` continua sem escrita; Rule de
  bloqueio de publicação intocada).

**NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. FIREBASE STAGING NÃO FOI ALTERADO.
FIREBASE PRODUÇÃO NÃO FOI ALTERADO. NENHUM PLANTÃO FOI PUBLICADO.
PRODUÇÃO NÃO FOI TOCADA.**
