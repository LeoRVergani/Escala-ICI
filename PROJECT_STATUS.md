# Estado atual do projeto — Escala ICI

Atualizado em: 2026-08-15
Commit auditado: `3aab9a676f8b0434ae966566e538d12f5bade78c` (`main` local,
merge do ciclo Lembretes/consulta diária)
Branch: `main` (local, **14 commits à frente de `origin/main`** — `git
push` não pôde ser executado neste ambiente por falta de credenciais de
escrita no GitHub; ver "Ciclo Lembretes / consulta diária" abaixo)
PR relacionado: #1 (aberto, em **draft** — descrição ainda retrata só a
primeira versão do push-worker, anterior ao ciclo de Lembretes)

Este documento é a fonte central de verdade sobre o estado real do projeto.
Documentos específicos (specs, runbooks, checkpoints) continuam existindo
para profundidade técnica e histórico — ver `docs/README.md` para o índice
completo. Onde este documento e um checkpoint histórico divergirem, este
documento reflete o estado mais recente.

## Visão geral do produto

Escala ICI é uma plataforma de gestão de escalas para equipes de operação
(SOC/CODB/NOC), com dois aplicativos web separados (Dashboard administrativo
e App do colaborador), um pacote de contrato compartilhado, e um serviço de
push (FCM) independente. Autenticação e persistência via Firebase
(Authentication + Cloud Firestore).

## Componentes

- **Dashboard** (`apps/dashboard`) — SPA Vite para importação de planilha
  XLS/XLSX, correção, preview, rascunho, grade, gestão de usuários/equipes/
  unidades organizacionais, Administração, publicação de escala, decisão de
  Trocas. Único aplicativo com escrita administrativa.
- **App/PWA** (`apps/app`) — SPA Vite/PWA instalável para o colaborador:
  Hoje, Minha escala, Escala da equipe, Perfil, Trocas, notificações push.
  Somente leitura sobre a escala publicada; escreve apenas em `trocasEscala`,
  `notificacoesTroca` e `dispositivosPush` (registro de push).
- **`packages/contrato`** — parser SheetJS, tipos, normalização, totais e
  IDs compartilhados entre Dashboard e App.
- **`apps/push-worker`** — serviço Node.js separado (Docker, perfil `push`),
  nunca importado por Dashboard/App. Assina `notificacoesTroca` no Firestore
  de `escala-ici-staging` e retransmite como push via Firebase Cloud
  Messaging. Único consumidor de `firebase-admin` no monorepo.

## Ambientes

- **Laboratório Firebase local** — Auth + Firestore + Rules via Emulator
  Suite, dados fictícios, sem risco. Inicializadores automáticos para
  Windows/Linux (`executar-laboratorio-*`).
- **Staging Firebase** — projeto `escala-ici-staging`, escrita oficial
  liberada só quando `VITE_FIREBASE_ENVIRONMENT=staging` e o Project ID
  termina em `-staging`/`-hml`/`-homolog`.
- **Cloudflare Pages staging** — projeto Pages real: `escala-ici-staging`.
  Alias público: `https://staging.escala-ici-staging.pages.dev`. Build
  publicado: `dist/apps/app` (App/PWA), branch Pages `staging`.
- **Dashboard Docker na VM** — imagem multi-stage, Nginx sem privilégios,
  usuário não-root, filesystem somente leitura, sem exposição pública direta.
- **Produção** — ainda separada e **não presumida**. Nenhum ambiente descrito
  aqui é produção; nada neste documento autoriza tratá-lo como tal.

## URLs públicas não secretas

- PWA staging: `https://staging.escala-ici-staging.pages.dev`
- Projeto Cloudflare Pages: `escala-ici-staging`
- Projeto Firebase: `escala-ici-staging`

## Branch e PR em andamento

`feature/push-fcm-staging` já foi integrada a `main` (histórico linear,
sem merge commit dedicado) em fase anterior a este documento. O ciclo atual
— `feature/lembretes-consulta-dia-hoje`, 12 commits à frente de `main` — está
sendo mesclado a `main` nesta Fase 8 (release de encerramento). PR #1
continua aberto em draft, com descrição desatualizada (só a primeira versão
do push-worker); não foi atualizado automaticamente.

## Ciclo Lembretes / consulta diária — ESTÁVEL EM STAGING

Ciclo encerrado nesta Fase 8, cobrindo tela Hoje (consulta de equipe por
dia sem sair da tela), Lembretes pessoais e Lembretes atribuídos pelo
gestor. Fonte funcional completa: `docs/spec/LEMBRETES.md`. Regra de
CSS/cascade obrigatória para qualquer alteração visual futura no módulo:
`docs/spec/UI_CASCADE_E_HERANCA.md`.

- **Tela Hoje**: tocar em outro dia da semana consulta a equipe daquele dia
  sem navegar para fora da tela Hoje; hoje real permanece identificado
  visualmente; botão "Voltar para hoje" funciona; Agenda continua
  independente. Validado manualmente pelo usuário.
- **Lembretes pessoais** (`usuarios/{login}/lembretes`, privados por
  estrutura de path — gestor/admin nunca leem): CRUD completo, calendário
  próprio, "Próximos Lembretes", persistência real confirmada em staging
  (sobrevive a F5). Validado manualmente.
- **Lembretes atribuídos** (`lembretesAtribuidos`, top-level): gestor cria
  (única ou série), edita conteúdo, cancela (`ATIVO -> CANCELADO`, nunca
  delete físico, nunca reativa) direto na tela Usuários do Dashboard; o
  colaborador vê no App, com indicação de origem administrativa, e não pode
  editar/excluir. Validado manualmente (Dashboard e PWA).
- **Realtime**: validado manualmente em staging real — o gestor atribuiu um
  lembrete no Dashboard e ele apareceu na PWA do colaborador na mesma hora,
  sem F5 (fluxo Dashboard → Firestore → listener → PWA).
- **Responsividade**: App e Dashboard validados manualmente pelo usuário,
  sem defeitos encontrados.
- **Privacidade**: Dashboard nunca importa leitura/escrita de lembretes
  pessoais — garantido por teste de fronteira automatizado
  (`tests/app-boundaries.test.mjs`).
- **Correção Fase 5.1**: a query administrativa do Dashboard precisou
  passar a filtrar também por `destinatarioEquipeId` — Firestore não trata
  Security Rules como filtro pós-consulta; um `list` só é aprovado se cada
  `where()` do cliente já prova a condição da Rule para qualquer resultado
  possível. A Rule em si não mudou. Índice composto novo
  (`destinatarioLogin+destinatarioEquipeId+data`) confirmado presente em
  `escala-ici-staging`.
- **Push de Lembretes**: **não implementado neste ciclo** (decisão
  deliberada). `alertasAntecedenciaMin` continua só como dado preparado.
  Evolução futura: reutilizar `apps/push-worker` e a infraestrutura FCM/FID
  existente — nunca um segundo backend/worker.
- **Deploy Fase 8**: PWA republicado em `escala-ici-staging` (Cloudflare
  Pages, deployment `48265176`); Dashboard reconstruído e reiniciado via
  Docker (`escala-ici-dashboard:3k-c1-staging`, container saudável em
  `127.0.0.1:4173`). Firestore Rules/Indexes não precisaram de novo deploy
  (já publicados e confirmados).
- **Git**: merge para `main` feito localmente (commit `3aab9a6`), mas
  `git push` (feature branch e `main`) **não pôde ser executado neste
  ambiente** — sem credenciais de escrita para o GitHub. `main` local está
  14 commits à frente de `origin/main`; o usuário precisa fazer `git push`
  de uma máquina com credenciais válidas para sincronizar o GitHub com o
  que já está publicado em staging.
- **Produção**: inalterada por este ciclo.

## Funcionalidades concluídas

- Importação e publicação de escala (parser XLS/XLSX, rascunho, revisão
  imutável, rollback sem perda de histórico).
- Revisões e rollback de publicações.
- Gestão de usuários e equipes.
- Administração com hierarquia flexível (`ADMIN_SISTEMA`/`GESTOR_UNIDADE`/
  `GESTOR_EQUIPE`), unidades organizacionais, perfis administrativos, modo de
  simulação de gestor, auditoria de ações simuladas — ver
  `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`.
- Unidades organizacionais com hierarquia por `parentId`, resolvida no
  cliente; Rules protegem por array explícito de permissões, não por
  travessia de árvore.
- Trocas de escala — fluxo real de 7 estados (solicitação → resposta do
  colega → decisão do gestor, aprovação e publicação no mesmo passo),
  persistido em `trocasEscala`/`notificacoesTroca`, com Rules reais e
  revalidação transacional de snapshot — ver
  `docs/spec/TROCA_ESCALA_PLANO.md`.
- Notificações em tempo real (sino de Trocas no App, alertas operacionais no
  Dashboard).
- PWA instalável (Android, Windows, macOS, navegadores compatíveis; iOS via
  "Adicionar à Tela de Início").
- Registro de FID (Firebase Installation ID) para push web — opt-in
  explícito pelo card "Notificações" do Perfil.
- Push-worker Docker com kill switch, auditoria sanitizada de dispositivos,
  teste local e teste real controlado.
- Diagnóstico local de notificação e clique, validado em dois dispositivos
  reais (computador e celular).
- Tela Hoje com consulta de equipe independente por dia da semana, sem sair
  da tela (não navega para Agenda).
- Lembretes pessoais e atribuídos pelo gestor, com realtime, privacidade
  estrutural e responsividade validados manualmente em staging — ver seção
  "Ciclo Lembretes / consulta diária" acima e `docs/spec/LEMBRETES.md`.

## Situação atual do push (FCM)

- Worker permanente (`push-worker-push-worker-1`) saudável, sem porta
  pública, usuário não-root, secret montado por grupo suplementar dedicado.
- Contrato de dispositivo usa **FID**, nunca token de push cru — decisão de
  auditoria arquitetural (PUSH-PWA-1.1), documentos com `token` legado são
  ignorados com segurança, nunca apagados.
- Payload FCM é **somente `data`** — nunca `notification` nativo — para
  evitar exibição automática pelo SDK e duplicidade com o
  `onBackgroundMessage` do service worker.
- `PUSH_ENABLED=false` é o estado permanente do serviço em execução contínua.
  Só é elevado a `true` de forma temporária, em container efêmero
  (`docker compose run --rm`), para um teste controlado, e retorna a `false`
  automaticamente ao final (o serviço permanente nunca herda essa mudança).
- **Resultado real mais recente** (fase PUSH-PWA-2B.2C, 2026-08-14):
  saneamento reversível de 5 registros antigos (`ativo: false`, sem exclusão
  de documentos), exatamente 2 dispositivos ativos confirmados para
  `lvergani` (PC e celular, ambos WEB/STAGING/FID presente). Um único envio
  FCM real em container efêmero: `devicesFound: 2`, `successCount: 2`,
  `failureCount: 0`. Computador e celular receberam exatamente uma
  notificação cada, sem duplicidade. **Achado residual**: o clique na
  notificação não abriu nem focou o PWA em nenhum dos dois dispositivos —
  ver limitações abaixo. Aprovação da fase classificada como **parcial**.
- **Correção do clique** (fase PUSH-PWA-2B.2D, 2026-08-14): causa raiz mais
  provável identificada e corrigida — `onBackgroundMessage()` não aguardava
  a Promise de `showNotification()`, destacando a exibição da notificação
  da vida útil do evento `push` e arriscando perda do `data` persistido.
  Corrigido com um envelope interno versionado, `notificationclick`
  reconhecendo explicitamente notificações próprias, e um protocolo de
  fallback SW→janela (`ESCALA_ICI_NOTIFICATION_CLICK`) quando
  `WindowClient.navigate()` está ausente ou falha. Validado por 24 testes
  comportamentais novos e pela suíte completa (`test:boundaries` 76/76,
  `test:unit` 399/399, typecheck/lint/build OK) — ver
  `CHECKPOINT-FASE-PUSH-PWA-2B.2D.md`. **Ainda sem commit, deploy ou reteste
  real** — aprovação depende de um novo teste FCM real nos dois
  dispositivos.

## Limitações

- Clique em notificação push real não abria/focava o PWA (computador e
  celular) — código corrigido na fase PUSH-PWA-2B.2D (ver acima), mas a
  correção **ainda não foi validada por um teste real** — só um reteste nos
  dois dispositivos confirma que o problema foi de fato resolvido.
- Push para Android nativo continua pendente — nenhum código cliente Android
  existe neste repositório.
- `EXPIRADA` (estado de Troca) não tem mecanismo de expiração automática
  implementado.
- Auditoria administrativa (`auditoriaAdmin`) só registra ações feitas
  durante simulação ativa, não ações diretas de admin/gestor de unidade.
- Não existe notificação de gestor sobre troca pendente de aprovação.

## Pendências reais

- Confirmar por reteste real (2 dispositivos) que a correção do
  `notificationclick` (fase PUSH-PWA-2B.2D, código já corrigido e validado
  automaticamente) resolve de fato o clique que não abria o PWA — requer
  commit e deploy de staging antes do reteste.
- Runbook de push (`docs/operacao/PUSH-FCM-OPERACAO.md`) ainda não documenta
  como procedimento operacional formal: teste local, reconfiguração de
  dispositivo, saneamento reversível com dry-run, diagnóstico de
  duplicidade, limites do FCM.
- `.env.staging.app.example` e `.env.staging.dashboard.example` tinham o
  nome/URL do projeto Cloudflare incorretos (`escala-ici-app-staging`) —
  corrigidos nesta fase para `escala-ici-staging`/
  `staging.escala-ici-staging.pages.dev`.
- PR #1 com descrição desatualizada (só primeira versão do worker) — proposta
  de nova descrição entregue no relatório da fase DOCS-1, não aplicada
  automaticamente.

## Próximo marco

Commit da correção do clique (PUSH-PWA-2B.2D), deploy de staging controlado
e um único reteste FCM real nos dois dispositivos existentes, antes de
qualquer nova fase de ativação contínua do push.

## Fora do escopo (explicitamente)

- Android nativo.
- Produção (qualquer ambiente além dos listados acima).
- Ativação contínua de push (`PUSH_ENABLED=true` permanente) sem autorização
  explícita e nova fase dedicada.
- Push/alerta automático para Lembretes (`alertasAntecedenciaMin` continua
  só dado preparado) — evolução futura, reutilizando `apps/push-worker`.
- React Native / app nativo.
