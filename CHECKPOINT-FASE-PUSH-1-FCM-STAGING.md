# Checkpoint — Fase Push-1A (push-worker FCM, staging, custo zero)

## Objetivo

Preparar a infraestrutura de notificações push reais de Trocas de Escala:
um worker Node.js separado do Dashboard, que assina `notificacoesTroca` no
Firestore de `escala-ici-staging` e reenvia via Firebase Cloud Messaging —
sem Blaze, sem Cloud Functions/Cloud Run/Pub-Sub, sem produção.

Esta é a fase **PUSH-1A**: código, regras, Docker e testes, dentro do
repositório. Ela para deliberadamente na fronteira manual (service account,
credencial na VM, `docker compose up` real) e não toca o repositório Android
EscalaSOC — ver "Fronteira manual" e "Pendências" abaixo.

## Arquitetura

```
Firestore (escala-ici-staging)
  notificacoesTroca  →  apps/push-worker (Node 22, firebase-admin)  →  FCM  →  Android (fora desta sessão)
  dispositivosPush   ↑ (lido pelo worker; escrito pelo Android, fase futura)
  pushEntregas        (controle técnico de idempotência, só Admin SDK/IAM)
```

O Dashboard continua build estático → Nginx, sem alteração. O push-worker é
um serviço Docker independente, sem porta pública, `profiles: ["push"]`
(não sobe por padrão), falha isolada (não deve derrubar o Dashboard).

## O que foi implementado

### `apps/push-worker` (novo workspace)

- `src/config.ts` — valida `FIREBASE_PROJECT_ID` (deve ser
  `escala-ici-staging`), `PUSH_ENVIRONMENT` (deve ser `staging`),
  `PUSH_ACTIVATED_AT` (ISO obrigatório), `PUSH_ENABLED` (padrão `false`).
  Qualquer valor fora do esperado lança `ConfigError` com código
  identificável (`PUSH_WORKER_PROJECT_MISMATCH`,
  `PUSH_WORKER_ENVIRONMENT_INVALIDO`, etc.) — nunca cai para um padrão de
  produção.
- `src/firebaseAdmin.ts` — lê **somente** o campo `project_id` do arquivo
  apontado por `GOOGLE_APPLICATION_CREDENTIALS` (nunca `private_key`/
  `client_email`) e só chama `initializeApp({ credential:
  applicationDefault() })` depois de confirmar que esse `project_id`
  corresponde a `FIREBASE_PROJECT_ID`. Essa checagem é feita fora do
  próprio `app.options.projectId` deliberadamente: comparar um valor com o
  que nós mesmos passamos para `initializeApp()` não verificaria nada
  (seria uma tautologia) — o arquivo é a única fonte independente.
- `src/notificationWatcher.ts` — assina `notificacoesTroca` com a própria
  consulta já filtrando `where('criadoEm', '>=', PUSH_ACTIVADO_AT)` no
  servidor. O corte de ativação não depende de "ignorar o primeiro
  snapshot": como a consulta já exclui qualquer documento anterior ao
  corte, todo "added" que chega — no primeiro snapshot ou depois de um
  restart — já é elegível por construção.
- `src/deliveryRepository.ts` — `claim()` transacional em `pushEntregas`
  com **lease recuperável**: `workerId`, `processandoDesde`,
  `leaseExpiraEm`, `tentativas`. Um `PROCESSANDO` com lease vencida é
  retomado com segurança (reclamado de novo, `tentativas` incrementado); um
  `PROCESSANDO` com lease ainda válida (outro worker de fato processando)
  não é reclamado; um `ENVIADO` nunca é reclamado de novo — garante que
  restart do container e workers concorrentes não duplicam envio.
- `src/deviceRepository.ts` — dispositivos ativos por login/ambiente
  STAGING; desativa exatamente o dispositivo cujo token o FCM reportou como
  inválido, nunca outros do mesmo login.
- `src/pushSender.ts` — `sendEachForMulticast` (API atual do Admin SDK
  14.2.0; `sendMulticast`/`sendAll` não existem mais nesta versão —
  confirmado lendo os `.d.ts` instalados antes de escrever este arquivo).
  Payload `notification` curto (sem dados de escala) + `data`
  (`eventId`/`trocaId`/`tipo`/`route`), prioridade `normal`, TTL 24h, canal
  Android `trocas_escala`.
- `src/deliveryOrchestrator.ts` — pipeline completo: filtros pré-claim
  (ativação, já lida, kill switch) → claim → dispositivos → envio →
  desativação de token inválido → finalização. Nunca loga token, e-mail
  completo ou credencial — só `eventId`, `tipo`, `destinatarioLogin`
  (login, não e-mail), contadores e código de erro sanitizado.
- `src/cli/check.ts` (`npm run check`) — inicialização a seco: confere
  config/credencial/projectId, faz 1 leitura Firestore e 1 chamada FCM com
  `dryRun`, nunca envia de verdade.
- `src/cli/pushTest.ts` (`npm run push:test -- --login=X`) — envio manual de
  diagnóstico; **respeita `PUSH_ENABLED`** (não faz bypass do kill switch);
  nunca imprime token; não passa por `pushEntregas` (é diagnóstico, não
  evento de domínio).

### Firestore Rules (`firestore.rules`)

Dois blocos novos, inseridos entre o fim de `notificacoesTroca` e o
comentário de riscos aceitos:

- `dispositivosPush/{deviceId}` — usuário autenticado só `get`/`create`/
  `update`/`delete` do próprio dispositivo (`login == loginDoAuth()`); sem
  `list` (nunca enumera dispositivos de outra pessoa); token nunca fica
  publicamente legível.
- `pushEntregas/{notificacaoId}` — `allow read, write: if false` para
  qualquer client SDK. O Admin SDK usa IAM e ignora Security Rules; **as
  regras de `notificacoesTroca` não foram alteradas.**

### Docker (`deploy/push-worker/`)

- `Dockerfile` — multi-stage `node:22-alpine`, build TypeScript → runtime
  mínimo, `USER node` (não-root), sem shell necessário no runtime.
- `compose.yaml`/`compose.staging.yaml` — `profiles: ["push"]` (nunca sobe
  junto do Dashboard por acidente), sem `ports:`, hardening igual ao
  Dashboard (`read_only`, `tmpfs`, `no-new-privileges`, `cap_drop: ALL`,
  `restart: unless-stopped`), `secrets:` apontando para
  `/opt/escala-ici/secrets/escala-ici-staging-push-worker.json` (arquivo a
  ser criado manualmente pelo usuário — não por este repositório).
  `FIREBASE_PROJECT_ID`/`PUSH_ENVIRONMENT` são literais fixos no compose
  (nunca vindos de `--env-file`), para que nenhum `.env` consiga desviar a
  guarda de projeto.

### Scripts novos (`package.json` raiz)

`typecheck:worker`, `test:push-worker`, `docker:push-worker:build`,
`docker:push-worker:staging:build/up/down`. `test:boundaries` passou a
incluir `tests/push-worker-boundaries.test.mjs`.

## Testes

- `apps/push-worker/test/*.test.ts` (vitest, dublê Firestore em memória —
  não `@firebase/rules-unit-testing`, que é para regras, não para lógica de
  negócio): config, guarda de projeto/credencial, claim com lease
  (concorrência e retomada), dispositivos, multicast (sucesso total,
  parcial, falha total), watcher (pré-ativação, já-lida, kill switch,
  envio real via dublê).
- `tests/push-worker-boundaries.test.mjs` (novo, `node --test`):
  `apps/dashboard`/`apps/app`/raiz nunca declaram `firebase-admin`;
  varredura recursiva de todo `.ts`/`.tsx` em `apps/dashboard/src`,
  `apps/app/src`, `components`, `lib` confirmando ausência de
  `firebase-admin`/`apps/push-worker`; push-worker é o único a depender de
  `firebase-admin`.
- `npm run test:firestore-rules` — 71 testes existentes, todos passando com
  os dois blocos novos adicionados (nenhuma regra pré-existente mudou).

## Validação automatizada

Executado em 10 de agosto de 2026, branch `feature/push-fcm-staging`
(base `36587b3`):

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:worker` | ✅ |
| `npm run test:unit` | ✅ 273 (267 pré-existentes + 6 arquivos novos do push-worker) |
| `npm run test:boundaries` | ✅ 42 (3 novos) |
| `npm run test:firestore-rules` | ✅ 71 (regressão — nenhuma regra pré-existente mudou) |
| `npm run lint` | ✅ (2 warnings pré-existentes, não relacionados) |
| `npm run build --workspace @escala-ici/push-worker` | ✅ (`tsc -p tsconfig.build.json`) |
| `docker build -f deploy/push-worker/Dockerfile` | ✅ imagem `escala-ici-push-worker:local`, 841MB |
| `docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml --profile push config` | ✅ sintaxe válida |

**Falhas pré-existentes na baseline (confirmadas via `git diff --stat main`
vazio nos arquivos envolvidos — não causadas por esta fase, não
corrigidas por estar fora de escopo):**

- `npm run validate:firebase-contract` — assert de contagem de
  `exigirEscritaAdministrativaHabilitada();` em
  `lib/firebase/writeRepository.ts` espera 7 ocorrências, hoje há 9. Não
  toquei nesse arquivo nem no validador.
- `npm run test:firebase-integration` — 3 de 75 testes em
  `tests/firebase/firebase.integration.test.ts` falham com
  `PERMISSION_DENIED` num fluxo de rascunho/publicação/rollback que não
  envolve `notificacoesTroca`/`trocasEscala`/`dispositivosPush`/
  `pushEntregas`. Não toquei em `firestore.rules` nas seções envolvidas nem
  no teste. `npm run test:firestore-rules` (subconjunto específico de
  regras) passa 100%.

## Segurança

- Nenhum segredo criado, commitado ou impresso nesta sessão.
- Nenhuma credencial real tocada — `firebaseAdmin.test.ts` e
  `push:test`/`check` usam apenas leitores de arquivo injetados (dublês) ou
  exigem `GOOGLE_APPLICATION_CREDENTIALS` real (nunca fornecido aqui).
- `firebase-admin` só existe como dependência em `apps/push-worker`
  (garantido por teste de fronteira).
- Nenhuma porta nova exposta (`compose.yaml` do push-worker não tem
  `ports:`).

## Custo

- Cloud Functions: NÃO
- Cloud Run: NÃO
- Blaze: NÃO
- Pub/Sub: NÃO
- Secret Manager: NÃO
- Billing habilitado nesta fase: NÃO
- FCM: usado (via Admin SDK, gratuito)
- Firestore Spark: usado (2 coleções novas, sem novo composite index —
  o filtro `criadoEm >= PUSH_ACTIVATED_AT` usa índice single-field
  automático)
- VM/Docker existente: reaproveitada, novo serviço com perfil próprio

## Riscos residuais

- **Dependência transitiva `uuid` (moderada)** — `firebase-admin@14.2.0` →
  `@google-cloud/storage` → `teeny-request`/`retry-request` → `uuid <11.1.1`
  (GHSA-w5hq-g745-h8pq, buffer bounds check ausente quando `buf` é
  fornecido). O push-worker não usa Cloud Storage nem chama essa API
  diretamente; não há correção não-destrutiva disponível sem downgrade
  incompatível do `firebase-admin`. Monitorar em atualizações futuras do
  Admin SDK.
- Imagem Docker de 841MB — inclui `node_modules` hoisted de todo o
  monorepo (client SDKs de `apps/dashboard`/`apps/app` também ficam no
  `node_modules` raiz). Funciona e está isolada (multi-stage, sem
  devDependencies), mas não é minimizada; otimização futura possível
  (ex.: lockfile próprio do workspace) se o tamanho da imagem importar.
- ~~`pushSender.ts` usa `MulticastMessage.tokens`, campo marcado
  `@deprecated` no `firebase-admin` 14.x em favor de `fids`~~ — **resolvido
  na Fase PUSH-1B** (migração direta para FID, sem compatibilidade ativa
  com `token`; ver `CHECKPOINT-FASE-PUSH-1B-FID.md`). Nesta fase (PUSH-1A)
  o contrato de `dispositivosPush` ainda usava `token` como identificador
  — registrado aqui por fidelidade histórica, não é mais o estado atual do
  código.
- `SEM_DISPOSITIVO` não é retentado automaticamente se o usuário registrar
  um dispositivo depois — comportamento aceito nesta fase, documentado no
  runbook.

## Pendências explícitas (fora de escopo desta fase, não resolvidas)

- **Migração de `token` para FID** — resolvida na Fase PUSH-1B (ver
  `CHECKPOINT-FASE-PUSH-1B-FID.md`). Todo `token` mencionado neste
  documento é o identificador que a Fase PUSH-1A de fato usava na época;
  não reflete o contrato atual de `dispositivosPush` (`fid`).
- **`PUSH_GESTOR_EVENTO_DOMINIO_PENDENTE`** — auditado: `notificacoesTroca`
  nunca tem `destinatarioLogin` de um gestor hoje (confirmado lendo todos
  os pontos de criação em `lib/firebase/trocasRepository.ts`). O worker só
  encaminha o que já existe; não foi criada lógica paralela para inventar
  notificação de gestor.
- **`PARIDADE_REGRAS_TROCA_PWA_DASHBOARD_PENDENTE`**
- **`PUSH_PWA_PENDENTE`**
- **EscalaSOC (Android)** — repositório não existe nesta máquina (busca
  completa no filesystem não encontrou nenhum diretório EscalaSOC). Todo o
  lado Android (`FirebaseMessagingService`, `onNewToken`, escrita em
  `dispositivosPush`, canal `trocas_escala`, deep link, permissão
  `POST_NOTIFICATIONS`) fica pendente até esse repositório estar disponível
  e a fase R2/R2.1 de Trocas estar consolidada, conforme a própria regra
  de fallback do pedido original.
- Falhas pré-existentes de `validate:firebase-contract` e
  `test:firebase-integration` (ver "Validação automatizada") — não
  investigadas a fundo por estarem fora do escopo desta fase; recomendo
  tratá-las separadamente.

## Fronteira manual (não executado nesta sessão)

- GCP Console/IAM: criar service account `escala-ici-push-worker` em
  `escala-ici-staging`, conceder `roles/firebasecloudmessaging.admin` +
  `roles/datastore.user`, gerar a chave JSON, confirmar a API do Firebase
  Cloud Messaging habilitada.
- Colocar o JSON em
  `/opt/escala-ici/secrets/escala-ici-staging-push-worker.json` na VM.
- Criar `.env.staging.push-worker` real (copiar de
  `.env.staging.push-worker.example`), definir `PUSH_ACTIVATED_AT`, manter
  `PUSH_ENABLED=false` até validar tudo.
- `npm run docker:push-worker:staging:build`/`:up` na VM real; validar
  `docker compose ps`, logs, `ss -lntp` (sem porta nova).
- Todo o teste manual com celular real (ver
  `docs/operacao/PUSH-FCM-OPERACAO.md`).

## Git

- Branch `feature/push-fcm-staging`, criada a partir de `main` limpo
  (`36587b3`).
- Nenhum commit, push ou merge realizado nesta sessão.
