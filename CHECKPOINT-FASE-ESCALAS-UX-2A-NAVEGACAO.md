# Checkpoint — Fase ESCALAS-UX-2A (simplificação da navegação do Dashboard)

Data: 2026-08-17. Escopo: primeira fase de IMPLEMENTAÇÃO do redesign
definido em `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` — alterar SOMENTE
a arquitetura de navegação e os caminhos de acesso às telas já
existentes. **`ContextoEscalaAtivo`, seletor de escala no header,
workspace unificado, roster lateral, drag-and-drop, padrão de horário,
nova Contabilidade/Lista, publicação e qualquer mudança de schema
continuam explicitamente FORA de escopo** — nada disso foi
implementado nesta fase.

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git rev-parse --show-toplevel /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git status --short            ?? apps/dashboard/.sites-runtime/
                               ?? packages/contrato/.sites-runtime/
git rev-parse HEAD            56e5027bb8ddfcce73cdcc67ccdd146567287a7c
git rev-parse origin/main     0c119e17f67ebf012d0b9fde398ac6199162190e
git log --oneline -16          (confirmado — 56e5027 no topo, série
                                 ESCALAS-UX-1A..1C + docs(ux) redesign)
```

Working tree limpo no precheck, exceto os diretórios de cache de build
não rastreados `.sites-runtime/` (não commitados, não removidos, sem
regra nova de `.gitignore` criada — exatamente como instruído). Nenhum
outro arquivo inesperado encontrado. Baseline de testes confirmado:
`test:unit` 842/842, `test:boundaries` 185/185, `test:firestore-rules`
155/155.

## 1. Método

Leitura obrigatória de `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`docs/spec/HIERARQUIA_ORGANIZACIONAL.md`,
`docs/spec/UI_CASCADE_E_HERANCA.md`,
`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` e do checkpoint da fase de
design (`CHECKPOINT-FASE-ESCALAS-UX-2-REDESIGN-WORKSPACE.md`), seguida
de um mapeamento factual exaustivo (via agente de exploração, read-only)
de TODO call site de `setTela(...)`, todo guard `tela === '...'`, a
computação do item ativo da sidebar (`AppFrame.tsx`), a estrutura atual
de "Administração"/"Escalas"/"Grade"/"Plantões", CSS de tabs/sidebar já
existente, e toda referência de boundary test a `NAVEGACAO`/rótulos de
navegação — antes de qualquer edição.

## 2. Sidebar anterior

```ts
const NAVEGACAO: ItemNavegacao[] = [
  { id: 'visao', rotulo: 'Visão geral', icone: 'home' },
  { id: 'importar', rotulo: 'Importar escala', icone: 'upload' },
  { id: 'escalas', rotulo: 'Escalas', icone: 'calendar' },
  { id: 'grade', rotulo: 'Grade', icone: 'grid' },
  { id: 'trocas', rotulo: 'Trocas', icone: 'trocas' },
  { id: 'usuarios', rotulo: 'Usuários', icone: 'users' },
  { id: 'plantoes', rotulo: 'Plantões', icone: 'plantao' },
  { id: 'administracao', rotulo: 'Administração', icone: 'admin' },
];
```
8 itens, `Tela = 'visao' | 'importar' | 'escalas' | 'grade' | 'usuarios' |
'trocas' | 'plantoes' | 'administracao'` (`DashboardApp.tsx:287`).

## 3. Sidebar final

```ts
const NAVEGACAO: ItemNavegacao[] = [
  { id: 'visao', rotulo: 'Visão geral', icone: 'home' },
  { id: 'escalas', rotulo: 'Escalas', icone: 'calendar' },
  { id: 'trocas', rotulo: 'Trocas', icone: 'trocas' },
  { id: 'usuarios', rotulo: 'Usuários', icone: 'users' },
  { id: 'administracao', rotulo: 'Administração', icone: 'admin' },
];
```
5 itens. `type Tela` **permanece inalterado** (`'importar'`/`'grade'`/
`'plantoes'` continuam no union) — nenhuma refatoração de roteamento
para "reduzir o union" foi feita, conforme instruído.

## 4. Itens removidos da sidebar (nunca das telas)

| Item removido | Destino |
| --- | --- |
| Importar escala | Vira ação "Importar escala" dentro da tela "Escalas" (botão no cabeçalho) e continua acessível pelos fluxos internos já existentes (`escolherJornadaNovaEscala`, `importarPlanilhaNovoPlantao`, "Abrir rascunho", "Descartar rascunho" etc. — nenhum desses `setTela('importar')` foi alterado). |
| Grade | Vira ação "Abrir grade" dentro da tela "Escalas" (botão no cabeçalho, além do "Revisar grade" já existente dentro do card de competência). |
| Plantões | Vira sub-tela "Grupos de Plantão" dentro de "Administração", acessível por uma sub-navegação local (`AdministracaoSubnav`). Nome de UI mudou de "Plantões" para "Grupos de Plantão" (`<h1>`); zero mudança de lógica. |

## 5. Estrutura de Administração

`AdministracaoSubnav` (novo componente, `DashboardApp.tsx`) — reaproveita
`.segmented-control` (mesmo padrão já usado nos filtros de "Trocas",
nenhuma classe nova de tab/subnav criada). Duas abas:

```
Administração
[ Organização ]  [ Grupos de Plantão ]
```

- "Organização" (`aba='organizacao'`) → `setTela('administracao')` —
  conteúdo já existente (resumo organizacional, unidades, equipes,
  usuários, simular gestor, limpeza/histórico, setores legado),
  **zero mudança de conteúdo**.
- "Grupos de Plantão" (`aba='plantao'`) → `setTela('plantoes')` —
  conteúdo já existente (`tela === 'plantoes'`, CRUD de Grupo/
  participantes/contatos/ACL/rascunhos), **zero mudança de lógica**, só
  o `<h1>` renomeado e a sub-navegação adicionada ao cabeçalho.
- A aba "Grupos de Plantão" só aparece para quem já podia acessar a
  antiga tela "Plantões" (`podeAcessarPlantoes`) — mesma regra de
  autorização de antes, nenhum novo gate.
- `OrganizationTree`/`OrganizationTeamPicker` não foram tocados.

## 6. Mapeamento tela → área

`lib/navegacaoDashboard.ts` (novo, puro — sem React/Firebase):

```ts
export function areaNavegacaoDaTela(tela: TelaDashboard): AreaNavegacaoDashboard {
  switch (tela) {
    case 'importar':
    case 'grade':
      return 'escalas';
    case 'plantoes':
      return 'administracao';
    default:
      return tela;
  }
}
```

| Tela interna | Área destacada na sidebar |
| --- | --- |
| `visao` | Visão geral |
| `escalas` | Escalas |
| `importar` | **Escalas** |
| `grade` | **Escalas** |
| `trocas` | Trocas |
| `usuarios` | Usuários |
| `administracao` | Administração |
| `plantoes` | **Administração** |

Usado no lugar de `ativo={tela}` → `ativo={areaNavegacaoDaTela(tela)}`
(`DashboardApp.tsx`, prop passada para `AppFrame`) — nenhum ternário
espalhado pelo JSX, um único ponto de mapeamento.

## 7. Comportamento do item ativo

- `tela = 'importar'` → sidebar destaca **Escalas**.
- `tela = 'grade'` → sidebar destaca **Escalas**.
- `tela = 'plantoes'` → sidebar destaca **Administração**.

Confirmado por teste unitário (`lib/navegacaoDashboard.test.ts`, 8
casos, um por valor de `Tela`) e por boundary test estático
(`tests/dashboard-navegacao-boundaries.test.mjs`, teste 7).

## 8. Pontes transitórias adicionadas

- **Escalas → Importar escala**: botão no cabeçalho (`UploadCloud`),
  `onClick={() => setTela('importar')}`.
- **Escalas → Abrir grade**: botão no cabeçalho (`Grid3X3`),
  `onClick={() => setTela('grade')}` (além do "Revisar grade" já
  existente dentro do card de competência, preservado).
- **Importar/Grade → "← Voltar para Escalas"**: breadcrumb simples
  (`.tela-breadcrumb` + `.link-button`, generalizado do padrão já
  usado na ESCALAS-UX-1C) no topo de cada uma das duas telas.
- **Administração ↔ Grupos de Plantão**: `AdministracaoSubnav` nos dois
  sentidos (§ 5).
- Botão "Nova escala" na tela Escalas passou a ser a AÇÃO PRIMÁRIA
  (`.primary-button`) — antes era secundária e "Importar" era a
  primária, invertido; corresponde à hierarquia pedida pelo redesign
  (§ 6 de `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`).

## 9. Telas internas preservadas

Confirmado por boundary test (`tests/dashboard-navegacao-boundaries.test.mjs`,
teste 5): `type Tela` continua com `'importar'`/`'grade'`/`'plantoes'`;
os três blocos `{tela === '...' && (...)}` continuam existindo e
renderizando exatamente o mesmo conteúdo de antes (só cabeçalhos
ganharam breadcrumb/subnav — nenhum componente interno alterado).
Nenhuma lógica de `criarAtribuicoesEditaveis`/`montarAtribuicoesPlantaoRascunho`/
`ScheduleGrid`/parser tocada.

## 10. Comportamento mobile

Nenhuma mudança de comportamento de colapso/expansão da sidebar
(`components/AppFrame.tsx` inalterado além de nenhuma edição — 0 linhas
diff). A lista de 5 itens é curta o suficiente para caber no mesmo
espaço que antes acomodava 8; a sub-navegação de Administração
(`.segmented-control`) já é o mesmo componente usado em "Trocas", que
já funciona por toque em mobile hoje — nenhum ajuste responsivo novo
foi necessário.

## 11. Acessibilidade

- Item ativo da sidebar: inalterado (`aria-current="page"` +
  `.active`, já existente em `AppFrame.tsx`), agora recebendo a ÁREA
  (via `areaNavegacaoDaTela`) em vez da tela crua.
- `AdministracaoSubnav`: botões reais (`<button type="button">`),
  `aria-current="page"` no botão ativo (mesmo padrão já usado pela
  sidebar principal, em vez de introduzir um padrão ARIA Tabs
  incompleto/novo), `aria-label="Áreas de Administração"` no container.
- Breadcrumbs "← Voltar para Escalas": `<button>` real, foco visível
  herdado do estilo padrão de botão, sem nenhuma biblioteca nova.
- Navegação por teclado: preservada — nenhum elemento novo depende de
  mouse/drag.

## 12. Arquivos criados

- `lib/navegacaoDashboard.ts` — `areaNavegacaoDaTela()` + tipos
  `TelaDashboard`/`AreaNavegacaoDashboard`.
- `lib/navegacaoDashboard.test.ts` — 8 testes (um por valor de `Tela`).
- `tests/dashboard-navegacao-boundaries.test.mjs` — 14 boundary tests.
- `CHECKPOINT-FASE-ESCALAS-UX-2A-NAVEGACAO.md` (este arquivo).

## 13. Arquivos alterados

- `apps/dashboard/src/DashboardApp.tsx` — `NAVEGACAO` (5 itens),
  `navegacaoVisivel` simplificado, import de `areaNavegacaoDaTela` e do
  ícone `Grid3X3`, `ativo={areaNavegacaoDaTela(tela)}`, novo componente
  `AdministracaoSubnav`, cabeçalhos de Escalas/Importar/Grade/Plantões/
  Administração atualizados com as pontes/breadcrumbs/subnav do § 8.
- `app/globals.css` — `.link-button` generalizada (deixou de ser
  escopada só a `.plantao-selecao-ativa`), `.tela-breadcrumb` e
  `.administracao-subnav` (só espaçamento, reaproveitando tokens
  existentes — nenhuma estética nova).
- `package.json` — `test:boundaries` passou a incluir
  `tests/dashboard-navegacao-boundaries.test.mjs`.
- `tests/plantao-dashboard-administracao-boundaries.test.mjs` — o
  teste 6 usava `id: 'plantoes'` (o antigo item de `NAVEGACAO`) como
  âncora de busca; corrigido para `tela === 'plantoes'` (o bloco de
  renderização, que continua existindo) — mesmo teste, mesma
  asserção final (nenhum botão/rótulo de publicação de Plantão),
  adaptado à mudança de estrutura autorizada por esta fase. Nenhum
  teste foi removido.

## 14. Testes

- `lib/navegacaoDashboard.test.ts`: 8/8.
- `tests/dashboard-navegacao-boundaries.test.mjs`: 14/14.
- `test:unit` total: 850/850 (baseline 842 + 8 novos).
- `test:boundaries` total: 199/199 (baseline 185 + 14 novos; um teste
  pré-existente adaptado, ver § 13, nenhum removido).
- `test:firestore-rules`: 155/155, **inalterado** (`firestore.rules`
  com diff zero confirmado por `git diff --stat`).

## 15. Validação completa

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros, só os 6 warnings pré-existentes já
conhecidos, não relacionados), `build:dashboard`, `build:app:pages`,
`build:apps`, `validate:pwa`, `validate:artifact`, `git diff --check` —
todos OK. `packages/contrato` isolado confirma os mesmos 3 erros
pré-existentes inalterados (`jornada.ts:260`,
`detectorPlanilha.test.ts`, `parserPlantao.test.ts`).

## 16. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.rules`, `firestore.indexes.json`,
`lib/editorPlantao.ts`, `lib/montagemRascunhoPlantao.ts`,
`components/plantao/`, `packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/firebase/authRepository.ts`, `apps/app/`, `apps/push-worker/`,
`components/organizacao/`, `components/ScheduleGrid.tsx` — **vazio**,
confirmando zero mudança funcional em Plantão (`IMPORTADO`/`MANUAL`/
`COPIADO` inalterados), 6x1, Auth, App, Push e Organização.

## 17. Validação visual

Nenhum navegador disponível neste ambiente — **auditoria estática**
(leitura direta do JSX resultante + sucesso de build/typecheck, que já
garante JSX válido) foi a validação realizada, consistente com a
preferência já registrada de que o usuário testa mudanças de UI
diretamente.

## 18. Confirmação — o que NÃO foi implementado nesta fase

`ContextoEscalaAtivo`, seletor de escala no header, `ScheduleHeader`/
`ScheduleWorkspace`/`ScheduleContextSwitcher`, roster lateral,
drag-and-drop, padrão de horário por Grupo, nova Contabilidade/Lista,
publicação, qualquer mudança de schema Firestore — nenhum desses foi
tocado. Confirmado por boundary test dedicado
(`tests/dashboard-navegacao-boundaries.test.mjs`, teste 10).

## 19. Git

Commit local único, mensagem sugerida
`feat(ux): simplifica navegacao do dashboard`. Nenhum push, deploy,
merge, rebase, amend, reset ou stash. Diretórios `.sites-runtime/` não
rastreados permanecem intocados.

## 20. Próximos passos (não iniciados)

Esta fase **para aqui** — `ESCALAS-UX-2A.1`, `PLANTAO-PADRAO-1` e
`PLANTÃO-3C` aguardam decisão e autorização explícitas em uma fase
futura própria.
