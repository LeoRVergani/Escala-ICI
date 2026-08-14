# Checkpoint — Fase PUSH-1B (migração de tokens para Firebase Installation IDs)

## Objetivo

Migrar o push-worker (`apps/push-worker`) de registration tokens FCM
(obsoletos, campo `token`) para Firebase Installation IDs — FIDs — usando a
API já disponível em `firebase-admin@14.2.0`. Esta fase só toca
`apps/push-worker`, o contrato `dispositivosPush`, as regras/testes
relacionados e a documentação operacional — Dashboard, PWA, Cloudflare
Pages e o repositório Android EscalaSOC não foram tocados.

## Motivo da migração

`MulticastMessage.tokens` está marcado `@deprecated` no `firebase-admin`
14.x. A Fase PUSH-1A (`CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md`) documentou
isso como pendência futura deliberada, para não bloquear a entrega da
infraestrutura básica. Como ainda não existe nenhuma base funcional de
clientes push em produção usando `token` (nem PWA nem Android escrevem
`dispositivosPush` hoje), esta fase faz a migração **direta**: não há dois
sistemas de registro concorrentes, e o cliente futuro (PWA) só vai escrever
`fid`.

## API de FID confirmada no `firebase-admin@14.2.0` instalado

Confirmado lendo os `.d.ts`/`.js` reais em `node_modules/firebase-admin`
(não memória, não documentação antiga):

- `node_modules/firebase-admin/lib/messaging/messaging-api.d.ts`:
  - `MulticastMessage` (a interface antiga, `tokens: string[]` obrigatório,
    `fids?: string[]` opcional) está `@deprecated` em favor de
    `FidMulticastMessage`.
  - `FidMulticastMessage extends BaseMessage { fids: string[] }` — **sem**
    campo `tokens` — é o tipo usado nesta migração.
- `node_modules/firebase-admin/lib/messaging/messaging.d.ts`:
  `sendEachForMulticast` é sobrecarregado — aceita `MulticastMessage` OU
  `FidMulticastMessage`, ambos com `dryRun?: boolean` e retorno
  `Promise<BatchResponse>`. Comentário do próprio `.d.ts`: "A multicast
  message containing up to 500 fids" — **limite de 500 FIDs por lote**
  (mesmo `FCM_MAX_BATCH_SIZE` do caminho de tokens, confirmado em
  `messaging.js`).
- `BatchResponse`/`SendResponse` (formato de resposta individual) são os
  **mesmos tipos** usados pelo caminho de tokens — nenhuma mudança de
  contrato de resposta; a correspondência posicional entre `fids[i]` e
  `responses[i]` é a mesma que já existia para `tokens[i]`/`responses[i]`
  (documentado no próprio `.d.ts`: "The responses list … corresponds to
  the order of fids in the FidMulticastMessage").
- Código de erro para FID definitivamente inválido/não registrado —
  confirmado em `node_modules/firebase-admin/lib/messaging/error.js`: o
  servidor FCM retorna o código canônico `UNREGISTERED_FID`, mapeado para
  `MessagingErrorCode.INSTALLATION_ID_NOT_REGISTERED` =
  `'installation-id-not-registered'`, exposto ao cliente como
  **`messaging/installation-id-not-registered`** (prefixo `messaging/`,
  `this.codePrefix = 'messaging'` em `error.js:291`). É um código próprio
  para FID — não reaproveita o texto de
  `messaging/registration-token-not-registered`. Não existe, nesta versão,
  um código específico de "FID malformado" análogo a
  `messaging/invalid-registration-token`; um FID mal formado cai no
  genérico `messaging/invalid-argument` (não exclusivo de dispositivo), por
  isso não é tratado como desativação definitiva.
- `dryRun` continua válido com `FidMulticastMessage` — mesma assinatura
  (`sendEachForMulticast(message: FidMulticastMessage, dryRun?: boolean)`),
  usado em `src/cli/check.ts`.

A API FID esperada existe exatamente como necessário — não foi preciso
alterar a versão do `firebase-admin`.

## Contrato atualizado de `dispositivosPush`

`apps/push-worker/src/types.ts`:

```ts
export type PlataformaDispositivo = 'WEB' | 'ANDROID';

export interface DispositivoPush {
  deviceId: string;
  login: string;
  plataforma: PlataformaDispositivo;
  fid: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  ultimaConfirmacaoEm: string | null;
  appVersion: string | null;
  environment: 'STAGING';
  schemaVersion: number;
}
```

- `token` → `fid` (rename direto, um único nome em todo o código: nunca
  `installationId` em um lugar e `fid` em outro).
- `plataforma` passou a aceitar `'WEB' | 'ANDROID'` (antes só `'ANDROID'`)
  — preparação para o PWA futuro, sem implementar nada do lado cliente
  nesta fase.
- `schemaVersion: number` é novo, valor atual `1` — segue a convenção já
  usada no projeto para outras coleções (`SCHEMA_VERSION = 1` em
  `packages/contrato/src/tipos.ts`, replicado em `turnosMes`,
  `rascunhosTurnosMes` etc. via `schemaVersion in [1]` nas Rules).
  Adotado porque o padrão já existe no repositório e a coleção
  `dispositivosPush` vai evoluir (PWA, depois Android) — ter uma versão de
  schema desde já evita migração silenciosa depois.

## Ausência de compatibilidade ativa com registration token

Nenhum caminho do worker aceita, envia ou reativa `token`. Não existe
fallback "se não tiver `fid`, tenta `token`". A decisão foi migração
direta, sem os dois sistemas coexistindo — exatamente como pedido.

## Tratamento de documentos legados (só `token`, sem `fid`)

`apps/push-worker/src/deviceRepository.ts` — `listActiveDevices` mantém a
mesma consulta do Firestore (login/ativo/environment, sem novo índice
composto) e adiciona um filtro em memória (`possuiFidValido`): só entram no
resultado documentos com `fid` string não vazia. Um documento legado com só
`token`:

- não é interpretado como FID (nunca lido como se `token` fosse `fid`);
- não causa exceção (filtro silencioso, `Array.prototype.filter`);
- não é enviado (fica de fora do array retornado, então nunca chega a
  `buildMessage`/`sendToDevices`);
- não é apagado nem desativado automaticamente por este filtro (fica
  intacto no Firestore; só seria desativado se o FCM efetivamente
  rejeitasse um FID daquele mesmo documento, o que não pode acontecer
  porque ele nunca é enviado).
- `token` nunca é lido nem logado em nenhum ponto do filtro.

Coberto por `apps/push-worker/test/deviceRepository.test.ts` ("ignora com
segurança documentos legados que só têm token (Fase PUSH-1A), sem lançar
exceção").

## Segurança

- Nenhum segredo, `.env` real ou JSON de service account foi tocado, lido
  ou impresso nesta sessão.
- `/opt/escala-ici/secrets` não foi alterado.
- `VITE_FIREBASE_VAPID_KEY` não foi lida, copiada nem referenciada em
  nenhum arquivo — a fase nem toca Cloudflare Pages ou PWA.
- Nenhum FID real existe nesta fase (não há cliente escrevendo
  `dispositivosPush` ainda); os únicos "FIDs" em código são strings de
  teste óbvias (`'fid-1'`, `'fid-teste-1'`, `'FID_SECRETO_NAO_DEVE_APARECER'`
  — esta última deliberadamente usada em teste para provar que nenhum log
  a contém).
- `pushSender.ts`/`deliveryOrchestrator.ts`/`deviceRepository.ts`/CLIs
  continuam nunca logando `fid` (nem `token`) — só `eventId`, `tipo`,
  `destinatarioLogin` (login, não e-mail), `deviceId`, contadores e código
  de erro sanitizado. Verificado por teste dedicado
  (`deliveryOrchestrator.test.ts`, "nenhum log emitido... contém o FID").
- Firestore Rules (`dispositivosPush`) continuam exigindo
  `login == loginDoAuth()` em toda operação, sem `list`, e agora rejeitam
  explicitamente qualquer campo `token` (`!('token' in
  request.resource.data)` + `keys().hasOnly([...])` fechando o conjunto de
  campos aceitos).
- `pushEntregas` não foi alterado (`allow read, write: if false`
  inalterado).
- Docker: `Dockerfile` continua `USER node`; `compose.yaml` não define
  `user:`; nenhuma porta nova; `read_only`/`cap_drop: ALL`/
  `no-new-privileges` inalterados (arquivos de deploy não tocados nesta
  fase, exceto leitura para os testes de fronteira).
- `PUSH_ENABLED` permanece `false` (`.env.staging.push-worker` não foi
  modificado).
- Nenhum container foi recriado, reiniciado ou parado — `push-worker-push-worker-1`
  continuou `Up ... (healthy)` na imagem antiga durante toda a sessão; o
  `docker build` desta fase só gerou uma imagem nova localmente, sem
  `docker compose up`.
- Nenhum push real foi enviado — nenhum teste chama a API real do FCM;
  todos usam dublês (`vi.fn()`/`FirestoreFake`) ou o emulador do Firestore
  (`test:firestore-rules`), nunca credenciais reais.

## Testes

- `apps/push-worker/test/pushSender.test.ts` — reescrito para `fids`:
  mensagem contém `fids` e nunca `tokens`; envio único, múltiplos FIDs,
  sucesso parcial (código `messaging/installation-id-not-registered`),
  falha total.
- `apps/push-worker/test/deviceRepository.test.ts` — ampliado: filtro
  login/ativo/STAGING (fixtures agora com `fid`/`plataforma`), WEB e
  ANDROID aceitos, documento legado só-`token` ignorado sem exceção, `fid`
  vazio ignorado sem exceção, desativação continua atingindo só o
  `deviceId` certo.
- `apps/push-worker/test/deliveryOrchestrator.test.ts` (novo) — pipeline
  completo via `handleNotificacao`: mensagem construída com os FIDs dos
  dispositivos ativos (nunca `tokens`); sucesso parcial desativa só o
  dispositivo do FID inválido e o outro dispositivo do mesmo usuário
  continua ativo; falha total com código FID-inválido em todos os
  dispositivos marca `ERRO_FINAL` e desativa todos; falha total com erro
  transitório (`messaging/internal-error`) marca `ERRO_RETRY` e não
  desativa nenhum dispositivo; nenhum log contém o FID.
- `apps/push-worker/test/notificationWatcher.test.ts` — fixture do
  dispositivo atualizada para `fid`/`plataforma` (comportamento do watcher
  em si não mudou).
- `tests/firebase/firestore.rules.test.ts` — novo `describe('dispositivosPush
  (Fase PUSH-1B — FID, sem token)')` com 14 testes: criar WEB própria,
  criar ANDROID própria, negar criar para outro login, negar `list`, negar
  campo `token`, negar `fid` vazio, negar `environment` diferente de
  STAGING, negar `deviceId` do corpo divergente do ID do documento, `get`
  próprio vs. negado a outro login, renovação controlada do `fid`,
  imutabilidade de `login`/`deviceId`/`environment` na atualização, negar
  update que reintroduz `token`, negar update de outro usuário, `delete`
  só do próprio dispositivo.
- Os testes de `pushSender`/`deviceRepository`/`deliveryOrchestrator` e as
  novas regras falham contra a implementação antiga baseada em `tokens`
  (ex.: `mensagem.fids` seria `undefined`, `'tokens' in mensagem` seria
  `true`, um documento só-`token` sem `fid` não seria filtrado, e a regra
  antiga não validava nem rejeitava `token`) e passam depois da migração —
  verificado incrementalmente durante a implementação.

## Comandos executados (validação)

| Comando | Resultado |
|---|---|
| `git status -sb` / `git diff --check` | ✅ limpo, sem CR/whitespace issues |
| `npm run typecheck` | ✅ |
| `npm run typecheck:worker` | ✅ |
| `npm run test:push-worker` | ✅ 43 testes, 7 arquivos |
| `npm run test:unit` | ✅ 281 testes, 33 arquivos (273 antes + 8 novos desta fase) |
| `npm run test:boundaries` | ✅ 43 (sem mudança — nenhum teste de fronteira novo foi necessário) |
| `npm run test:firestore-rules` | ✅ 85 testes (71 antes + 14 novos de `dispositivosPush`) |
| `npm run lint` | ✅ 0 erros (2 warnings pré-existentes, não relacionados) |
| `npm run build --workspace @escala-ici/push-worker` | ✅ `tsc -p tsconfig.build.json` |
| `docker compose --env-file .env.staging.push-worker -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml --profile push config --quiet` | ✅ |
| `npm run docker:push-worker:staging:build` | ✅ nova imagem `escala-ici-push-worker:staging` |
| `docker image inspect escala-ici-push-worker:staging --format '{{.Config.User}}'` | ✅ `node` |

Falhas pré-existentes fora do escopo desta fase (`validate:firebase-contract`,
`test:firebase-integration`) não foram investigadas nem alteradas — mesma
situação documentada em `CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md`, nenhum
arquivo relacionado foi tocado nesta sessão.

## Ausência de push real / ausência de deploy

- Nenhum teste chama FCM real; todos usam dublês ou o emulador Firestore.
- `PUSH_ENABLED` permanece `false`.
- Nenhum `docker compose up`/`down`/`restart` foi executado; o container
  em produção-staging (`push-worker-push-worker-1`) não foi tocado.
- Nenhum `firebase deploy` (regras, hosting ou qualquer outro alvo) foi
  executado.
- Nenhum commit, push ou merge foi realizado nesta sessão.

## PWA ainda pendente

O PWA (`apps/app`) não foi alterado nesta fase e ainda não registra FID,
não pede permissão de notificação e não tem service worker de FCM. Fica
inteiramente para a próxima fase (`PUSH-PWA-1`).

## Android ainda pendente

O repositório EscalaSOC continua fora desta máquina (mesma constatação da
Fase PUSH-1A) — nenhuma alteração do lado Android foi ou poderia ser feita.
Quando esse repositório existir, ele precisará escrever `fid` (não mais
`token`) em `dispositivosPush`, seguindo o contrato desta fase.

## Próxima fase recomendada

**`PUSH-PWA-1`** — registro de FID, pedido de permissão de notificação e
service worker de FCM no PWA (`apps/app`), consumindo o contrato
`dispositivosPush` (`fid`/`plataforma: 'WEB'`) estabelecido nesta fase.

## Git

- Branch `feature/push-fcm-staging`, HEAD inicial `83ed55b` (PR #1,
  draft, aberto, não mesclado).
- Nenhum commit, push ou merge realizado nesta sessão — alterações ficam
  no working tree para revisão e aprovação.

## Nota de estado posterior

"PWA ainda pendente" e "nenhum FID real existe nesta fase", verdadeiras
quando este checkpoint foi escrito, foram resolvidas por
`CHECKPOINT-FASE-PUSH-PWA-1.md` (registro real de FID no PWA) e
`CHECKPOINT-FASE-PUSH-PWA-2B.md` (saneamento e teste FCM real com
dispositivos reais). O estado atual consolidado está em `PROJECT_STATUS.md`
(raiz do repo). Android continua pendente, como registrado aqui.
