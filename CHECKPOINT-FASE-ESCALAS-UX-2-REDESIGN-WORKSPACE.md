# Checkpoint — Fase ESCALAS-UX-2 (redesign estrutural do workspace de escalas)

Data: 2026-08-17. Escopo: **fase de design/arquitetura de UX, sem
implementação**. Produzir uma proposta de reestruturação da navegação e
da experiência de "trabalhar em uma escala" (jornada 6x1 e Plantão),
substituindo a fragmentação atual (Importar/Escalas/Grade/Plantões como
destinos independentes) por um único workspace de escala, antes de
qualquer fase futura voltar a alterar código. **Nenhum código de
produto foi tocado nesta fase.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git rev-parse --show-toplevel /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git status --short            ?? apps/dashboard/.sites-runtime/
                               ?? packages/contrato/.sites-runtime/
git rev-parse HEAD            455147d3546af2f9f2d7431590cebacf038f3132
git rev-parse origin/main     0c119e17f67ebf012d0b9fde398ac6199162190e
git log --oneline -15          (confirmado — série ESCALAS-UX-1A..1C +
                                 histórico anterior, ver `git log`)
```

Working tree limpo no precheck, exceto os diretórios de cache de build
não rastreados `.sites-runtime/` (gerados por builds anteriores,
mencionados explicitamente no pedido como podendo existir — não
commitados, não removidos). Baseline de testes confirmado (herdado do
relatório final da ESCALAS-UX-1C, não reexecutado nesta fase por não
haver mudança de código a validar): `test:unit` 842/842,
`test:boundaries` 185/185, `test:firestore-rules` 155/155.

## 1. Método

Leitura obrigatória de `docs/spec/EDITOR_ESCALAS.md`,
`docs/spec/PLANTOES.md`, `docs/spec/HIERARQUIA_ORGANIZACIONAL.md`,
`docs/spec/HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`,
`docs/spec/UI_CASCADE_E_HERANCA.md`,
`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`, e dos 4 checkpoints da série
ESCALAS-UX-1 (1A/1B/1B.1/1C), seguida de auditoria factual direta
(via agente de exploração, read-only) de
`apps/dashboard/src/DashboardApp.tsx`, `components/AppFrame.tsx`,
`components/ScheduleGrid.tsx`, `components/plantao/`,
`components/organizacao/`, `lib/organizacao.ts`, `lib/editorPlantao.ts`,
`lib/montagemRascunhoPlantao.ts`, `app/globals.css` — com referências
exatas de arquivo:linha para cada achado citado na proposta.

## 2. Arquivos criados

- `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` — o documento de design
  completo (39 seções: problemas atuais, princípio central, sidebar,
  contexto de escala, "+ Nova escala" para Jornada e Plantão,
  importação inline, workspace desktop/mobile, roster lateral,
  drag-and-drop + alternativa, padrão de horário por Grupo, calendário,
  Grade, Resumo/Lista/Contabilidade/Pendências redesenhados, Grupos de
  Plantão vs Administração, timezone, arquitetura de componentes,
  modelo de estado/contexto, 12 wireframes ASCII, matriz atual→novo,
  riscos, plano de microfases).
- `CHECKPOINT-FASE-ESCALAS-UX-2-REDESIGN-WORKSPACE.md` (este arquivo).

## 3. Arquivos alterados

- `docs/README.md` — adicionadas entradas para
  `EDITOR_ESCALAS.md`/`PLANTOES.md`/`HIERARQUIA_ORGANIZACIONAL.md`
  (que ainda não estavam no índice, apesar de já serem "fonte atual")
  e para o novo `REDESIGN_WORKSPACE_ESCALAS.md`, marcado explicitamente
  como "documento de design, ainda NÃO implementado."

**Nenhum outro arquivo foi alterado.** Confirmado por
`git status`/`git diff` no relatório final desta fase:
`apps/dashboard/src/DashboardApp.tsx`, `app/globals.css`,
`components/`, `lib/`, `packages/`, `firestore.rules`,
`firestore.indexes.json` permanecem idênticos ao HEAD anterior a esta
fase.

## 4. Achados centrais da auditoria (resumo)

- O Editor de Plantão (calendário/working copy) hoje vive dentro da
  tela **"Importar escala"** (`DashboardApp.tsx:5689-5714`), nunca
  dentro de "Plantões" ou "Escalas" — confirmado por leitura direta.
- A tela **"Plantões"** é administração de Grupo (CRUD/participantes/
  contatos/ACL), nunca a experiência mensal de escala.
- A tela **"Escalas"** só conhece jornada 6x1 (`DashboardApp.tsx:6032-6079`,
  card fixo `"COSI > SOC"`) — Plantão não aparece ali de forma nenhuma.
- O `.competence-control` do header (`AppFrame.tsx:181-184`) é um
  `<span>` estático alimentado por uma string fixa
  (`competencia="Agosto 2026"`, `DashboardApp.tsx:5424`) — não é um
  seletor, nunca reage a estado real.
- Não existe, hoje, nenhuma variável de estado única "o que estou
  editando agora" — jornada e Plantão são dois blocos de estado
  paralelos e desconectados, e a "troca de contexto" relatada como bug
  em homologação (Plantão parecendo apagar a Jornada da Grade) é uma
  consequência direta dessa ausência, não um bug de renderização
  isolado.

Ver `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` §§ 1-3 para o detalhamento
completo, com todas as referências de arquivo:linha.

## 5. Proposta — resumo executivo

- **Sidebar**: de 8 para 5 itens (`Visão geral | Escalas | Trocas |
  Usuários | Administração`) — "Importar"/"Grade"/"Plantões" deixam de
  ser destinos (§ 5 do documento).
- **Contexto de escala**: novo seletor no header, à esquerda, separado
  dos elementos globais (notificações/tema/conta) à direita — baseado
  em dados reais (Equipes + Grupos de Plantão acessíveis), nunca
  hardcoded (§ 6/§ 7).
- **"+ Nova escala"**: primeira etapa preservada; segunda etapa
  redesenhada e agora simétrica para Jornada e Plantão (Equipe/Grupo +
  competência + "Como começar?" com 3 opções); importação vira
  progressive disclosure dentro do mesmo modal, nunca uma tela separada
  (§ 8-§ 12).
- **Workspace único**: duas áreas (roster lateral 230-280px + editor
  central flexível), nunca três colunas fixas; editor central =
  Grade (Jornada) ou Calendário (Plantão), nunca os dois ao mesmo tempo
  (§ 13/§ 21/§ 31).
- **Roster lateral**: substitui o atual "Resumo por pessoa" (hoje
  abaixo do calendário, exigindo scroll), reaproveitando integralmente
  o mecanismo de seleção já implementado na ESCALAS-UX-1C (§ 14).
- **Drag-and-drop**: proposto como atalho OPCIONAL de desktop, sempre
  com alternativa por clique/toque, mesma operação de domínio para os
  dois caminhos (§ 16).
- **Padrão de horário por Grupo**: domínio futuro configurável
  (`PLANTAO-PADRAO-1`), dado do Grupo — nunca condicional de código por
  nome/sigla (§ 17/§ 18).
- **Resumo/Lista/Contabilidade/Vínculos**: Resumo vira faixa
  persistente; Lista vira visualização alternativa (toggle) ao
  calendário/grade; Contabilidade separa claramente working copy de
  conferência da fonte; Vínculos vira painel "Pendências (N)" com uma
  linha por pessoa, nunca por atribuição (§ 22-§ 26).
- **Grupos de Plantão**: administração (CRUD) migra para
  Administração → Grupos de Plantão, separada do uso mensal (§ 27).
- **Mobile**: projetado explicitamente — roster como bottom sheet,
  nenhuma operação depende de drag (§ 30).
- **Arquitetura de componentes**: `ScheduleWorkspace`,
  `ScheduleContextSwitcher`, `ScheduleHeader`, `NewScheduleDialog`,
  `ScheduleRoster`, `ScheduleHealthSummary`, `PlantaoEditor`,
  `JornadaEditor`, `PlantaoAccounting`, `SchedulePendingIssues` — nomes
  ilustrativos, responsabilidades e fronteiras detalhadas no documento
  (§ 31).
- **Modelo de estado**: `ContextoEscalaAtivo` (tipo+alvo+competência)
  separado das working copies indexadas por contexto — nenhuma working
  copy é destruída ao trocar de contexto, resolvendo diretamente o bug
  de homologação relatado (§ 32).

## 6. Referência aos projetos antigos

`LeoRVergani/escala-dashboard` / `OnCallEditor.tsx` não estava
disponível neste ambiente — usado apenas como referência conceitual a
partir da descrição fornecida no pedido, sem leitura ou transplante de
código real. Padrões extraídos: roster lateral com contagem,
nomes arrastáveis (como atalho, nunca como único caminho), calendário
como editor central, "regra padrão mostrada ao usuário" (base para o
padrão de horário por Grupo). Explicitamente NÃO recuperados: múltiplos
modos de cartão, seletor manual de cor, botão "Compactar",
autocompletar automático, vários modos concorrentes — cada um avaliado
contra o teste "isso ajuda criar/conferir/corrigir uma escala?" e
descartado por não passar (detalhamento em § 15 do documento).

## 7. Wireframes

12 wireframes ASCII produzidos no documento (§ 33): sidebar nova,
header com seletor, modal Nova Jornada, modal Novo Plantão, importação
inline, workspace Plantão desktop, workspace Jornada desktop, roster
lateral, contabilidade, pendências, mobile Plantão, mobile Jornada.

## 8. Matriz atual → novo

Tabela completa em § 34 do documento, cobrindo obrigatoriamente:
Importar escala, Escalas, Grade, Plantões, Resumo, Lista, Contabilidade,
Vínculos, Novo Plantão, Novo Grupo, seletor de competência — cada linha
com problema / destino no redesign / reutilizar-remover-refatorar.

## 9. Plano de microfases proposto

`ESCALAS-UX-2A` (sidebar/navegação) → `ESCALAS-UX-2A.1` (context
switcher + header + modelo de estado + modal simétrico Jornada/Plantão,
separada de 2A por introduzir um conceito de estado novo) →
`PLANTAO-PADRAO-1` (padrão semanal por Grupo, isolada por risco de
schema) → `ESCALAS-UX-2B` (roster lateral + drag opcional) →
`ESCALAS-UX-2C` (contabilidade/pendências/limpeza de Lista-Resumo) →
`HOMOLOGAÇÃO VISUAL` → `PLANTÃO-3C` (publicação, só depois do workspace
estabilizado). Detalhamento e dependências em § 36 do documento.

## 10. Riscos registrados

7 riscos concretos documentados em § 35 do documento — destaque para:
migrar "Grade" de destino de sidebar exige plano de compatibilidade
para links/atalhos existentes (ex.: o sino de alertas 6x1 navega para
`tela='grade'` hoje); o modelo de contexto (§ 32) precisa decidir o que
fazer com working copies "sujas" ao trocar de contexto; aplicar a mesma
segunda etapa à Jornada 6x1 exige implementar "Criar vazia"/"Usar
anterior" para 6x1, que não existem hoje; remover abas Resumo/Vínculos
pode quebrar boundary tests existentes que verificam sua presença —
cada risco documentado, nenhum resolvido nesta fase (design, não
implementação).

## 11. Confirmação de zero mudanças funcionais

`apps/dashboard/src/DashboardApp.tsx`, `app/globals.css`, `components/`,
`lib/`, `packages/`, `firestore.rules`, `firestore.indexes.json` —
todos bit-a-bit idênticos ao HEAD anterior a esta fase. Apenas
documentação foi criada/alterada (§ 2/§ 3 acima). `git diff --check`
limpo; `test:unit`/`test:boundaries`/`test:firestore-rules` não
precisaram ser reexecutados (nenhum código tocado) — baseline herdado
da ESCALAS-UX-1C permanece válido.

## 12. Git

Commit local único de documentação, mensagem sugerida
`docs(ux): redesenha workspace unificado de escalas`. Nenhum push,
nenhum deploy, nenhum merge/rebase/amend/reset/stash. Diretórios
`.sites-runtime/` não rastreados permanecem intocados (nem commitados,
nem removidos).

## 13. Próximos passos (não iniciados)

Esta fase **para aqui** — nenhuma microfase do § 9/§ 36 foi iniciada:
`ESCALAS-UX-2A`, `PLANTAO-PADRAO-1` e `PLANTÃO-3C` aguardam decisão e
autorização explícitas em uma fase futura própria.
