# Estado atual do projeto — Escala ICI

Atualizado em: 2026-08-14
Commit auditado: `441e25bf2e8f2bdc92ac6ad8871118d1a3e8e9f9`
Branch: `feature/push-fcm-staging` (8 commits à frente de `main`, 0 atrás)
PR relacionado: #1 (aberto, em **draft**)

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

`feature/push-fcm-staging`, 8 commits à frente de `main`, 0 atrás, upstream
sincronizado. PR #1 aberto em draft — descrição ainda retrata só a primeira
versão do push-worker (ver proposta de descrição atualizada no relatório da
fase DOCS-1, a ser usada quando o usuário decidir atualizar o PR
manualmente).

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

## Limitações

- Clique em notificação push real não abre/foca o PWA (computador e
  celular) — diverge do comportamento validado no diagnóstico local
  (notificação simulada). Possível divergência entre o payload de teste
  local e o payload real do FCM no handler `notificationclick`. Não
  investigado nem corrigido ainda.
- Push para Android nativo continua pendente — nenhum código cliente Android
  existe neste repositório.
- `EXPIRADA` (estado de Troca) não tem mecanismo de expiração automática
  implementado.
- Auditoria administrativa (`auditoriaAdmin`) só registra ações feitas
  durante simulação ativa, não ações diretas de admin/gestor de unidade.
- Não existe notificação de gestor sobre troca pendente de aprovação.

## Pendências reais

- Investigar e corrigir o `notificationclick` do service worker para
  notificações reais via FCM.
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

Investigar a divergência de comportamento do clique em notificação push real
(handler `notificationclick` vs. payload FCM real) antes de qualquer nova
fase de ativação contínua do push.

## Fora do escopo (explicitamente)

- Android nativo.
- Produção (qualquer ambiente além dos listados acima).
- Ativação contínua de push (`PUSH_ENABLED=true` permanente) sem autorização
  explícita e nova fase dedicada.
