# Checkpoint — Fase PLANTÃO-0 (arquitetura + correções visuais isoladas)

Data: 2026-08-15. Escopo: (1) duas correções visuais pequenas e comprovadas
no App do colaborador; (2) especificação arquitetural do futuro módulo de
Plantões (`docs/spec/PLANTOES.md`), sem qualquer implementação funcional.
**Nenhuma escrita em Firestore/Rules/Auth/Push. Nenhum deploy. Nenhum push
ao remoto. Apenas um commit local ao final.**

## Baseline (precheck)

```
pwd                    /home/vergani/projetos/Escala-ICI
git rev-parse --show-toplevel   idem
git branch --show-current       main
git status --short              (vazio)
git fetch origin                ok
git rev-parse HEAD               0c119e17f67ebf012d0b9fde398ac6199162190e
git rev-parse origin/main        0c119e17f67ebf012d0b9fde398ac6199162190e
```

HEAD local == origin/main == commit de referência esperado. Working tree
limpa. Nenhuma ação destrutiva (reset/rebase/merge/stash/checkout/amend) foi
necessária ou executada.

## Correção A — botão "Solicitar troca deste dia"

**Sintoma:** o botão ficava visualmente colado à borda lateral do card de
detalhe do dia, sem o mesmo respiro dos blocos irmãos.

**Mapeamento (regra de `docs/spec/UI_CASCADE_E_HERANCA.md`):**

- Componente: `DetalheDia` (`apps/app/src/EmployeeApp.tsx:387-448`).
- DOM real: `<aside class="panel selected-day-card">` contendo, em ordem,
  `.selected-day-date`, `.selected-day-shift`, `.selected-day-facts`,
  `<button class="secondary-button selected-day-troca-button">` (condicional)
  e `<p class="selected-day-note">`.
- Pai imediato do botão: o próprio `.selected-day-card`.
- Ancestral relevante: `.app-shell.product-app .selected-day-card { padding:
  0; overflow: hidden; ... }` (`app/globals.css:2439-2444`) — o card zera o
  próprio padding de propósito (Design System da Fase 3F, mesmo padrão já
  documentado no Caso 3 de `UI_CASCADE_E_HERANCA.md`), esperando que **cada
  filho direto** proveja seu próprio gutter horizontal.
- Classes irmãs que já fazem essa compensação: `.selected-day-shift`,
  `.selected-day-facts` e `.selected-day-note` — todas com `margin: 0 14px
  14px` no desktop (`app/globals.css:2451-2526`) e `.selected-day-shift`
  com `margin: 0 10px 10px` no breakpoint `≤780px`
  (`app/globals.css:2724-2728`).
- `.selected-day-troca-button` (`app/globals.css:4003-4007`, antes da
  correção) era a **única** exceção: `width: 100%; margin-top: 12px;
  justify-content: center;` — sem margem horizontal em nenhum breakpoint,
  sem regra própria em `≤780px`. Confirmado por busca exaustiva
  (`grep -n "selected-day-troca-button" app/globals.css`) — só existia essa
  única declaração.

**Causa raiz exata:** o botão nunca recebeu a compensação de gutter que o
Design System já dá aos demais filhos diretos de `.selected-day-card` — não
um problema do próprio `.selected-day-card` (que continua correto e
intocado), nem um caso que peça um wrapper novo (diferente do Caso 3 de
Lembretes, aqui os irmãos já resolvem via margin direto, não via wrapper).

**Correção aplicada** (`app/globals.css`):

```css
.selected-day-troca-button {
  display: flex;
  margin: 0 14px 14px;
  justify-content: center;
}
```

più, dentro do bloco já existente `@media (max-width: 780px)` escopado em
`.app-shell.product-app .selected-day-card { ... }`:

```css
.app-shell.product-app .selected-day-troca-button { margin: 0 10px 10px; }
```

`display: flex` substitui `width: 100%`: a base `.primary-button,
.secondary-button` já é `display: inline-flex`
(`app/globals.css:324-328`); um `width: 100%` sobre um elemento
inline-level, somado a margem horizontal, estouraria a caixa (100% + 28px)
e seria cortado pelo `overflow: hidden` do card. Trocando para `display:
flex` (block-level), o botão passa a se comportar exatamente como os
`<div>` irmãos — `width: auto` preenche o espaço disponível **descontando**
a margem, sem cálculo manual (`calc()`) nem valor mágico. Efeito colateral
corrigido de brinde: como bônus, o botão (que antes tinha `margin-bottom:
0` implícito) ganhou o mesmo `margin-bottom: 14px`/`10px` dos irmãos,
resolvendo também o espaçamento vertical zero que existia entre o botão e
`.selected-day-note` (`margin-top: 0` nesta última) quando o botão era
renderizado.

Nenhuma alteração em `.selected-day-card`, `.selected-day-shift`,
`.selected-day-facts` ou `.selected-day-note` — nenhuma regressão possível
em `DetalheDia`/Lembretes por esse lado, e nenhuma funcionalidade de troca,
elegibilidade ou repositório foi tocada (só CSS).

## Correção B — cabeçalho "SÁB" cortado

**Sintoma:** no calendário mensal (`DOM SEG TER QUA QUI SEX SÁB`), o último
cabeçalho aparecia comprimido/cortado na extremidade direita.

**Mapeamento:**

- Componente: `VisualizacaoEscala` (`apps/app/src/EmployeeApp.tsx:465-470`)
  — renderiza `<div class="calendar-weekdays">` com 7 `<span>` (`Dom` …
  `Sáb`), sem largura/classe individual — texto puro, uppercase via CSS.
- Regra base compartilhada por header e grade
  (`app/globals.css:868`, antes da correção):
  `.calendar-weekdays, .calendar-grid { display: grid; grid-template-columns:
  repeat(7, 1fr); }` — mesma declaração define as 7 colunas de **ambos**,
  garantindo alinhamento vertical entre cabeçalho e dias.
- `.calendar-weekdays span { text-transform: uppercase; padding: 9px; }`
  (linha 870) e, mais adiante no arquivo (maior ordem de cascade, mesma
  especificidade), `.app-shell.product-app .calendar-weekdays span {
  font-size: 0.8rem; letter-spacing: 0.05em; }` (desktop,
  `app/globals.css:3711-3714`) e uma segunda vez dentro de `@media
  (max-width: 768px)` com `font-size: 0.88rem; letter-spacing: 0.04em;
  padding: 10px 2px;` (`app/globals.css:3790-3794`) — ambas aumentam
  legibilidade, nenhuma delas define `overflow`/`min-width` na coluna.
- Nenhum ancestral (`.calendar-view`, `.employee-calendar-panel`, `.panel`)
  tem `overflow: hidden` — só `overflow: visible` (App, mobile,
  `app/globals.css:2173`) ou `overflow-x: auto` (regra genérica não
  escopada em `.app-shell`, sobrescrita pela versão mais específica do App).

**Causa raiz exata:** `grid-template-columns: repeat(7, 1fr)`, sem
`minmax(0, ...)`, dá a cada coluna um **mínimo automático implícito** igual
ao seu conteúdo intrínseco (min-content) — comportamento padrão de CSS Grid
para faixas `fr`. Em telas estreitas, o texto de "SÁB" (com o acento da
letra "Á", ampliado por `text-transform: uppercase` + `letter-spacing`)
pode precisar de mais espaço do que 1/7 do container; como o container do
App em mobile usa `overflow: visible` (não scroll/clip), a faixa da grade
inteira acaba maior que o container, e o excesso — sempre a **última**
coluna, por ser a mais à direita — fica fora da área visível, lido como
"cortado". As colunas centrais nunca mostram o sintoma porque, sem borda
entre `<span>`s, um leve estouro de conteúdo simplesmente se sobrepõe ao
espaço do vizinho (mesmo fundo, invisível); só a última coluna tem, à sua
direita, a borda real do container — daí o defeito ser visualmente
exclusivo do "SÁB".

**Correção aplicada** (`app/globals.css:868`, agora com comentário
explicando o porquê):

```css
.calendar-weekdays, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
```

`minmax(0, 1fr)` remove o mínimo automático implícito, travando as 7
colunas em frações realmente iguais do container, nunca maiores que 1/7
por causa do conteúdo. Correção no nível responsável (a declaração
compartilhada por cabeçalho e grade, `app/globals.css:868`) — não uma
redução de fonte isolada em "SÁB", não `overflow: hidden` mascarando o
sintoma, não um `!important`. `.calendar-weekdays` e `.calendar-grid`
continuam alinhados entre si porque ambos usam a mesma declaração.

`LembretesCalendario.tsx` reaproveita a mesma classe `.calendar-weekdays`
para seu próprio cabeçalho — beneficia-se da mesma correção
automaticamente, sem alteração adicional. `.lembretes-grid` (grade de dias
do módulo de Lembretes, `app/globals.css:4205-4210`) é uma classe
**diferente**, fora do escopo desta correção, e não foi tocada.

## Arquivos alterados

- `app/globals.css` — as duas correções acima (13 inserções, 3 remoções,
  `git diff --stat`).
- `docs/spec/PLANTOES.md` — novo, especificação arquitetural do módulo de
  Plantões.
- `CHECKPOINT-FASE-PLANTAO-0-ARQUITETURA-UI.md` — este documento.

Nenhum outro arquivo foi alterado.

## Resumo de `docs/spec/PLANTOES.md`

Documento de planejamento (nada implementado). Principais decisões
registradas:

- **Dois domínios**: Escala de Jornada (6x1, existente) e Plantão (novo,
  conceitual) — `USUÁRIO ≠ ESCALA`, participação em plantão é relação N:N
  usuário↔grupo, nunca um campo escalar em `Usuario`.
- **Plantão ≠ política de escalonamento** — desacoplados desde o desenho;
  esta fase não implementa escalonamento automático.
- **Conceitos de domínio**: Grupo de Plantão, Participante (chave = login
  funcional, nunca UID/nome), Turno/intervalo de plantão, e os três níveis
  Base → Override → Efetiva (override não implementado ainda, só previsto).
- **Contatos**: estrutura semântica (`rotulo`/`numero`/`ativo`), até 3 por
  participante, dado autenticado — nunca público, nunca no bundle, nunca
  versionado.
- **Central de Plantões** (conceito futuro, sem tocar a navegação inferior
  atual — `Hoje`/`Agenda`/`Trocas`/`Equipe`/`Perfil` continuam intactos):
  card na tela Hoje, sub-aba em Equipe, área com "Em plantão agora" /
  "Próximos" / "Todos" / "Meus plantões".
- **Participar vs. consultar** — dois conceitos formalmente separados,
  nunca fundidos numa única flag.
- **Regras de cobertura configuráveis por grupo** — nunca hardcode global.
- **Importação futura**: `detectarTipoPlanilha()` por estrutura/conteúdo
  (nunca nome de arquivo), roteando para `parsePlanilhaEscala` (6x1,
  intocado) ou um futuro `parsePlanilhaPlantao()` isolado. Planilha real
  não versionada; fixture sanitizada prevista para PLANTÃO-1.
- **Nome do XLS → login real**: conciliação obrigatória com confirmação do
  gestor, nunca aproximação silenciosa, nunca publicação com plantonista
  sem login conciliado.
- **Contabilidade**: sempre recalculada a partir dos intervalos reais;
  divergência do XLS gera aviso, nunca sobrescrita silenciosa.
- **Nova escala** (6x1 e Plantão): sempre rascunho revisado pelo gestor,
  gerador determinístico — nunca IA decidindo escala operacional.
- **Sequência de fases**: PLANTÃO-0 (esta) → 1 (parser) → 2 (preview +
  conciliação) → 3 (persistência/Rules) → 4 (Central no App) → 5 (nova
  escala) → 6 (overrides/trocas) → 7 (homologação staging).

## Confirmações de escopo

- **Nenhum código funcional de Plantão foi implementado** — só
  `docs/spec/PLANTOES.md` (Markdown), zero coleção/tipo/componente novo.
- **`parsePlanilhaEscala` (`packages/contrato/src/parser.ts:501`) e o
  catálogo SOC (`packages/contrato/src/catalogo.ts`) permanecem intactos**
  — nenhuma linha alterada, confirmado pelo diff (`git diff --stat` só
  mostra `app/globals.css`).
- **Firestore Rules, Firebase/Microsoft Auth e o push worker permanecem
  intactos** — nenhum arquivo em `firestore.rules`, `apps/push-worker/`,
  `lib/firebase/authRepository.ts` ou equivalentes foi tocado.
- Nenhuma dependência instalada, nenhum `package.json`/`package-lock.json`
  alterado (confirmado: `git diff --stat -- package.json package-lock.json`
  vazio antes do commit).

## Testes executados

```
npm run typecheck          OK
npm run typecheck:apps     OK (dashboard + app-web)
npm run typecheck:worker   OK (push-worker)
npm run test:unit          512/512 passou (41 arquivos)
npm run test:boundaries    102/102 passou
npm run lint               0 erros, 5 warnings pré-existentes
                            (lib/firebase/authRepository.test.ts,
                            lib/firebase/lembretesRepository.test.ts —
                            nenhum desses arquivos foi tocado nesta fase)
npm run build:app:pages    OK ("Cloudflare Pages validado: App
                            independente, SPA e PWA na raiz.")
npm run validate:pwa       OK ("PWA validado: manifesto, ícones,
                            atualização segura e artefatos distribuídos.")
npm run validate:artifact  OK ("Validated Sites artifact: ESM Worker
                            default.fetch and hosting manifest are present.")
git diff --check           limpo (sem trailing whitespace/erro)
```

Baseline mínima (512 unit / 102 boundaries / lint zero erros) atingida
exatamente, sem regressão.

## Validação visual

**Auditoria estática, não inspeção real de DevTools** — este ambiente não
tem navegador disponível para abrir o App e inspecionar computed style ao
vivo. A análise acima (causa raiz A e B) foi feita lendo JSX, CSS, ordem de
cascade, especificidade e media queries — não uma inspeção de DevTools
real. Isso é declarado explicitamente, conforme exigido por
`docs/spec/UI_CASCADE_E_HERANCA.md`, para não confundir uma coisa com a
outra.

Larguras/temas que a correção foi desenhada para cobrir (raciocínio
estático, não capturas de tela reais): `360x800`, `390x844`, `412x915`,
`768px`, desktop; `light` e `dark`. A correção A não introduz nenhuma
propriedade sensível a tema (usa `display`/`margin`/`justify-content`); a
correção B não introduz nenhuma cor. Nenhuma das duas altera nenhum token
de tema.

A validação visual real (abrir o App e conferir com os próprios olhos) fica
a cargo do usuário, como de costume neste projeto.

## Riscos conhecidos

- A correção B depende do comportamento padrão do algoritmo de
  dimensionamento de grid (`minmax(0, 1fr)`) suportado por todos os
  browsers relevantes do projeto (comportamento estável há anos em
  Chromium/Firefox/Safari) — risco considerado desprezível.
- Nenhum risco identificado na correção A além dos já mitigados
  (overflow do card, `display: flex` vs `inline-flex`).
- `docs/spec/PLANTOES.md` deixa deliberadamente schema Firestore, relação
  grupo↔equipe e mecanismo de visibilidade em aberto — riscos de desenho a
  resolver em PLANTÃO-3, não desta fase.

## Próxima fase prevista

PLANTÃO-1 — detector de planilha + parser isolado (`parsePlanilhaPlantao`)
+ fixture sanitizada, sem tocar o parser 6x1 nem persistência.

## Git

```
git status --short        (após stage/commit, ver abaixo)
git diff --check          limpo
```

Commit local criado (mensagem `docs(ui): define arquitetura de plantões e
corrige agenda`). **Nenhum push. Nenhum deploy. Produção não foi tocada.**
