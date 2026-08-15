# Checkpoint final — Ciclo Lembretes / consulta diária (Fase 8)

Data de consolidação: 2026-08-15. Este checkpoint encerra o ciclo iniciado
para corrigir a consulta de equipe por dia na tela Hoje e para criar a
funcionalidade completa de Lembretes (pessoais e atribuídos pelo gestor),
incluindo privacidade estrutural, Firestore/Rules, Dashboard, realtime,
responsividade e a correção da query administrativa (Fase 5.1). Todos os
números abaixo vêm da execução real desta fase — nenhum foi copiado de
relatórios anteriores sem reexecutar.

## Cronologia (branch `feature/lembretes-consulta-dia-hoje`, a partir de `main`)

Ponto de partida (`main`/merge-base): `7a9b55c` — fix(pwa): corrige ciclo de
vida e roteamento do clique em notificação push real.

1. `e0a1c1c` — fix(app): consulta equipe por dia sem sair da tela Hoje
2. `e2b4866` — feat(lembretes): cria contrato e regras de domínio (Fase 2)
3. `2209e18` — feat(lembretes): adiciona persistência e regras de acesso (Fase 3)
4. `d8d5ea8` — fix(lembretes): preserva histórico de lembretes atribuídos
5. `6e3ebbd` — feat(app): adiciona interface de Lembretes à Agenda (Fase 4)
6. `46eefdd` — fix(app): refina UI mobile de Lembretes e tratamento de permissões (Fase 4.1)
7. `b13662e` — fix(app): refina calendário e hierarquia visual de Lembretes (Fase 4.2)
8. `d7d87b4` — fix(app): corrige espaçamento de Próximos Lembretes (Fase 4.2.1)
9. `3220630` — docs(ui): documenta regras de cascade e herança visual (Fase 4.2.2)
10. `27907a1` — feat(dashboard): permite atribuir Lembretes ao colaborador (Fase 5)
11. `4c6c12e` — test(dashboard): protege privacidade de Lembretes pessoais (Fase 5)
12. `d57df56` — fix(lembretes): alinha query administrativa às regras do Firestore (Fase 5.1)
13. *(esta fase)* — docs: consolida checkpoint final e release staging (Fase 8)

12 commits de código/documentação + este commit de encerramento, todos
lineares a partir de `main`, sem divergência (`git log --oneline HEAD..main`
vazio antes desta fase).

## Escopo entregue

- Tela Hoje: consulta de equipe por dia da semana sem sair da tela,
  seleção independente do dia atual, botão "Voltar para hoje", Agenda
  permanece isolada.
- Lembretes pessoais: domínio puro, Firestore (`usuarios/{login}/lembretes`),
  Rules, CRUD completo, calendário próprio, "Próximos Lembretes".
- Lembretes atribuídos: domínio puro, Firestore (`lembretesAtribuidos`,
  top-level), Rules, criação única/série, edição de conteúdo, cancelamento
  (nunca delete físico, nunca reativação), histórico visível ao gestor.
- Dashboard: ação "Lembretes atribuídos" por colaborador na tela Usuários,
  reaproveitando o domínio/repository e o componente `LembreteCard`
  compartilhado com o App.
- Realtime: Dashboard → Firestore → listener → PWA, validado manualmente
  sem F5.
- Privacidade estrutural: Dashboard nunca lê/escreve lembretes pessoais,
  garantido por teste de fronteira automatizado.
- Responsividade: App e Dashboard validados manualmente pelo usuário.
- Staging: Rules e índices publicados e confirmados; query administrativa
  corrigida (Fase 5.1) e validada end-to-end.

## Arquitetura

**App:**

```
EmployeeApp
  -> LembretesView (aba da Agenda)
  -> useLembretes (hook: estado + listeners + ações)
  -> LembretesCalendario / LembretesDia / LembreteCard / modais (componentes de apresentação)
  -> lib/firebase/lembretesRepository.ts (Firestore)
  -> lib/lembretesUi.ts (helpers de UI puros)
  -> lib/lembretes.ts (domínio puro)
```

**Dashboard:**

```
DashboardApp — tela Usuários
  -> botão "Lembretes atribuídos" por linha de colaborador
  -> ModalLembretesAtribuidos (lista + filtro Ativos/Todos + cancelar)
  -> ModalAtribuirLembrete (criar/editar, colaborador fixo, autoria = usuarioReal)
  -> lib/firebase/lembretesRepository.ts (listarLembretesAtribuidosDoGestor/observarLembretesAtribuidosDoGestor)
  -> Firestore (lembretesAtribuidos)
```

Duas famílias de funções no mesmo repository — nunca uma API paralela:
`...DoUsuario` (colaborador, própria consulta) e `...DoGestor` (Dashboard,
consulta com `destinatarioEquipeId`, Fase 5.1).

## Segurança

- Lembretes pessoais: invisíveis para gestor/admin por construção de path
  (`loginDoAuth() == login`, nunca um campo de `resource.data`) — um `list`
  sem filtro já é seguro por natureza.
- Lembretes atribuídos: leitura do destinatário ou do gestor em escopo;
  criação/edição só do gestor em escopo; `destinatarioLogin`,
  `destinatarioEquipeId`, `criadoPorLogin`, `criadoPorNome`, `criadoEm`
  imutáveis após criação.
- Ataque de equipe falsificada (destinatário de uma equipe com
  `destinatarioEquipeId` forjado de outra) bloqueado por
  `usuarioPorLogin()` conferindo o `equipeId` real antes de autorizar.
- Autoria falsificada (`criadoPorLogin`/`criadoPorNome` de outro gestor)
  bloqueada — sempre verificada contra `loginDoAuth()`/`eu().nome`.
- Delete físico de atribuído negado para todos, inclusive ADMIN_SISTEMA —
  única saída é `ATIVO -> CANCELADO` (unidirecional, sem reativação).
- Boundary test (`tests/app-boundaries.test.mjs`) garante que
  `DashboardApp.tsx` nunca importa `criarLembretePessoal`/
  `listarLembretesPessoais`/`observarLembretesPessoais`/
  `atualizarLembretePessoal`/`excluirLembretePessoal`, e que usa
  `observarLembretesAtribuidosDoGestor` (nunca a variante `DoUsuario`).
- Query administrativa alinhada ao escopo do gestor (Fase 5.1): Firestore
  não trata Security Rules como filtro pós-consulta — um `list` só é
  aprovado se cada `where()` do cliente já prova a condição da Rule para
  qualquer resultado possível. Corrigido acrescentando
  `where('destinatarioEquipeId', '==', ...)` à consulta do Dashboard, sem
  alterar a Rule em si. Ver `docs/spec/LEMBRETES.md`, seção "Correção Fase
  5.1", para a causa raiz completa.

## Validações automáticas (execução real desta fase, 2026-08-15)

| Validação | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpo |
| `npm run typecheck:apps` | ✅ limpo (Dashboard + App) |
| `npm run typecheck:worker` | ✅ limpo |
| `npm run test:unit` | ✅ 502/502 (41 arquivos) |
| `npm run test:boundaries` | ✅ 102/102 |
| `npm run test:push-worker` | ✅ 48/48 |
| `npm run test:firestore-rules` | ✅ 122/122 (Emulator) |
| `npm run lint` | ✅ 0 erros, 3 avisos pré-existentes não relacionados (`_auth`/`_email`/`_db` não usados em mocks de teste) |
| `npm run build:apps` | ✅ Dashboard + App |
| `npm run build:app:pages` | ✅ |
| `npm run validate:pwa` | ✅ |
| `npm run validate:artifact` | ✅ |
| `npm run validate:deployments` | ✅ |
| `git diff --check` | ✅ limpo |
| `npm run firebase:staging:preflight` | ✅ projeto `escala-ici-staging`, escrita oficial habilitada, emuladores desabilitados |
| `npm run test:firebase-integration` | ⚠️ 123/126 passam; 3 falhas pré-existentes (ver abaixo) |

### `test:firebase-integration` — falhas pré-existentes, não relacionadas a Lembretes

3 falhas, todas em `tests/firebase/firebase.integration.test.ts`, describe
"ciclo integrado Dashboard → Firestore → App":

1. "importa o XLS de exemplo, salva rascunho, publica e permite leitura no App"
2. "sincroniza a publicação em tempo real e entrega o antes e depois ao usuário afetado"
3. "mantém COSI/SOC isolado de CODB/NOC" (erro não tratado, `permission-denied` num `list`)

Todos os erros citam linhas de `firestore.rules` fora do bloco de Lembretes
(`usuarios`, `turnosMes`, `eventosEscala` — linhas 173, 137, 490, 494, 484).
`firestore.rules` tem **diff zero** nesta sessão (`git diff --stat
firestore.rules` vazio antes desta fase de correção — as únicas mudanças de
Rules do ciclo inteiro são as adições de Lembretes, puramente aditivas, ver
seção "Firebase" abaixo). O arquivo de teste não menciona "lembrete" em
nenhum lugar. Contagem e nomes de teste idênticos entre a execução da Fase
5.1 e a execução final desta Fase 8 — confirmado como falha pré-existente,
não uma regressão deste ciclo. Não investigado/corrigido por estar fora do
escopo (correção de escala/publicação, não de Lembretes).

## Validações manuais (reportadas pelo usuário, tratadas como reais)

- CRUD de Lembretes pessoais real em staging, persistência sobrevive a F5.
- Atribuição real pelo Dashboard, série com múltiplas datas funcionando.
- PWA do colaborador recebeu o lembrete atribuído, com badge/indicação de
  origem administrativa e detalhe em somente leitura.
- Colaborador não conseguiu editar/excluir um lembrete atribuído.
- Realtime sem F5: lembrete atribuído pelo Dashboard apareceu na PWA do
  colaborador na mesma hora.
- Responsividade de App e Dashboard sem defeitos aparentes.

## Firebase — Rules e Indexes

- `git diff main...HEAD -- firestore.rules firestore.indexes.json`: 167
  inserções, **0 remoções** — todo o diff do ciclo inteiro em Rules/Indexes
  é aditivo (dois novos blocos `match` para Lembretes + a função
  `usuarioPorLogin()`; dois índices compostos novos). Nenhuma regra
  pré-existente de outra coleção foi alterada.
- Índice composto `destinatarioLogin + data` (colaborador) e
  `destinatarioLogin + destinatarioEquipeId + data` (gestor, Fase 5.1)
  **confirmados presentes** em `escala-ici-staging` via `npx firebase-tools
  firestore:indexes --project escala-ici-staging` (executado nesta fase).
- Rules de Lembretes já estavam publicadas em staging antes desta fase
  (resolvido no histórico da Fase 4.1 — ver `docs/spec/LEMBRETES.md`,
  seção "Histórico — bloqueio de ambiente (Fase 4.1) — resolvido").

## Pendências conhecidas

- Push/alerta automático para Lembretes **não implementado neste ciclo**
  (decisão deliberada) — `alertasAntecedenciaMin` continua só como dado
  preparado. Evolução futura: reutilizar `apps/push-worker` e a
  infraestrutura FCM/FID existente, nunca um segundo backend/worker.
- `excluirUsuario()` ainda não limpa `lembretesAtribuidos`/subcoleção
  `lembretes` de um usuário excluído (documentado em
  `docs/spec/LEMBRETES.md`, "Riscos / pendências conhecidas").
- 3 falhas pré-existentes em `test:firebase-integration`, não relacionadas
  a Lembretes (ver acima) — fora do escopo deste ciclo.

## Dados da release (preenchidos ao final desta fase)

- Feature SHA final: `d57df56` (antes do commit de documentação desta fase)
- Commit de documentação Fase 8: *(ver seção "Release" abaixo, preenchida
  após o commit)*
- Merge SHA em `main`: *(preenchido após o merge)*
- `origin/main` SHA pós-push: *(preenchido após o push)*
- Deploy Rules: NÃO (já publicadas; sem alteração pendente)
- Deploy Indexes: NÃO (já confirmados presentes)
- Deploy PWA staging: *(preenchido após execução)*
- Deploy Dashboard staging: *(preenchido após execução)*
- Smoke tests: *(preenchidos após execução)*
- Data/hora de encerramento: *(preenchida ao final)*
