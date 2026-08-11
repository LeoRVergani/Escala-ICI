# Operação do Push Worker (FCM, staging)

Runbook do serviço `apps/push-worker` (Docker, perfil `push`, ver
`deploy/push-worker/`). Sem segredo real neste documento.

## Pré-requisito único vez

1. Service account dedicada `escala-ici-push-worker` no projeto
   `escala-ici-staging`, papéis `roles/firebasecloudmessaging.admin` e
   `roles/datastore.user` (nunca Owner).
2. Chave JSON dessa service account em
   `/opt/escala-ici/secrets/escala-ici-staging-push-worker.json` na VM,
   dono `root`, permissões restritas — ver provisionamento do grupo abaixo.
3. `cp .env.staging.push-worker.example .env.staging.push-worker`, ajustar
   `PUSH_ACTIVATED_AT` (ISO, estável — não mudar depois de ativado),
   definir `PUSH_SECRET_GID` (ver abaixo) e manter `PUSH_ENABLED=false` até
   validar a infraestrutura.

### Provisionamento do grupo de leitura do secret (uma vez por VM)

Quando o secret do Compose tem origem `file:` (é o caso aqui), o Docker usa
bind mount e **ignora** `uid`/`gid`/`mode` declarados na sintaxe longa de
`secrets:` — o arquivo chega ao container com o dono/permissão que tem no
host. Como o processo do worker roda como usuário `node` (nunca root), a
única forma de dar acesso de leitura sem afrouxar a permissão para todo
mundo é um **grupo suplementar dedicado**, referenciado via `group_add` no
Compose (`deploy/push-worker/compose.yaml`).

Rodar na VM, uma única vez:

```bash
# 1. Confirmar que o GID 3999 está livre antes de criar o grupo.
getent group 3999 || echo "3999 livre"

# 2. Criar o grupo dedicado (nenhum usuário humano entra aqui).
groupadd -g 3999 escala-ici-push-secret

# 3. Trocar o grupo do arquivo da credencial (dono continua root).
chown root:escala-ici-push-secret \
  /opt/escala-ici/secrets/escala-ici-staging-push-worker.json

# 4. Aplicar o modo mínimo: leitura para root e para o grupo, nada além
#    disso. Nunca 0444 (leitura pública) nem 0777.
chmod 0440 /opt/escala-ici/secrets/escala-ici-staging-push-worker.json

# 5. Confirmar.
ls -l /opt/escala-ici/secrets/escala-ici-staging-push-worker.json
```

Não adicionar `lvergani`, `docker` ou qualquer outro usuário humano ao
grupo `escala-ici-push-secret` — ele existe só para ser apontado pelo
`group_add` do container, nunca para login interativo.

Em `.env.staging.push-worker`, definir:

```
PUSH_SECRET_GID=3999
```

Esse número **precisa ser idêntico** ao GID criado no passo 2 acima. Se o
GID 3999 já estiver em uso por outro grupo na VM (passo 1 acima retornou um
grupo existente), escolher outro GID livre — por exemplo `getent group` para
listar os já usados — e usar esse mesmo número tanto no `groupadd -g <GID>`
do host quanto em `PUSH_SECRET_GID=<GID>` no `.env.staging.push-worker`. Os
dois valores têm que coincidir; não há um GID "certo" além de precisar ser
livre e consistente entre host e `.env`.

Depois de provisionado, testar **sem** `--user 0` (ver seção "Como testar a
conexão sem enviar push" abaixo) — deve funcionar como usuário `node` normal
do container.

## Como subir

```bash
npm run docker:push-worker:staging:build
npm run docker:push-worker:staging:up
docker compose --env-file .env.staging.push-worker \
  -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push ps
```

## Como parar

```bash
npm run docker:push-worker:staging:down
```

## Como ver logs

```bash
docker compose --env-file .env.staging.push-worker \
  -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push logs --tail=100 push-worker
```

Esperado, sem nenhum segredo: `environment=staging`,
`project=escala-ici-staging`, `pushEnabled=...`, `firestore=connected`/
listener iniciado.

## Como testar a conexão sem enviar push

```bash
docker compose --env-file .env.staging.push-worker \
  -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push run --rm push-worker node dist/cli/check.js
```

Confere config, credencial, `project_id`, 1 leitura Firestore e 1 chamada
FCM com `dryRun=true`. Nunca envia push de verdade.

## Como enviar um push de teste

Requer `PUSH_ENABLED=true` (o `push:test` respeita o kill switch — não faz
bypass):

```bash
docker compose --env-file .env.staging.push-worker \
  -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push run --rm -e PUSH_ENABLED=true push-worker node dist/cli/pushTest.js --login=<login>
```

Retorna só `devicesFound`/`successCount`/`failureCount` — nunca um FID.

## Como desativar push (kill switch)

```bash
# editar .env.staging.push-worker: PUSH_ENABLED=false
npm run docker:push-worker:staging:up
```

O worker continua rodando e assinando o Firestore, só não chama o FCM. Isso
**não** afeta o Dashboard, o PWA, o Firestore nem as Trocas — eles continuam
funcionando normalmente por conta própria (push é só aviso).

## Como identificar FID inválido

Um dispositivo com FID (Firebase Installation ID) permanentemente inválido
ou não registrado é automaticamente marcado `ativo: false` em
`dispositivosPush` pelo próprio worker (nunca aparece nos logs). Para
investigar manualmente: no Console do Firestore, filtrar `dispositivosPush`
por `ativo == false` e `login == <login>`.

Desde a Fase PUSH-1B, `dispositivosPush` usa `fid` como identificador —
`token` não é mais o contrato oficial (ver `CHECKPOINT-FASE-PUSH-1B-FID.md`).
Documentos legados que só têm `token` são ignorados com segurança pelo
worker (nunca causam erro, nunca são apagados automaticamente).

Desde a Fase PUSH-PWA-1, o PWA (`apps/app`) já sabe registrar dispositivos
`WEB` pelo card "Notificações" do Perfil (ver
`CHECKPOINT-FASE-PUSH-PWA-1.md`) — exige
`VITE_FIREBASE_MESSAGING_SENDER_ID`/`VITE_FIREBASE_VAPID_KEY` configurados
no ambiente do App (Cloudflare Pages em staging), fora deste repositório.
Sem esses dois valores, o App continua funcionando normalmente; só o card
fica em "Não configuradas neste ambiente".

## Como recuperar de um restart

Não é preciso fazer nada manualmente. `docker compose restart push-worker`
(ou qualquer reinício de container) é seguro: o primeiro snapshot do
listener sempre redelivera as notificações elegíveis como "added", mas
`pushEntregas` já marcadas `ENVIADO` nunca são reclamadas de novo — nenhum
push duplicado. Um evento que ficou `PROCESSANDO` porque o worker morreu no
meio do envio é retomado automaticamente depois que a lease expira (alguns
minutos), sem intervenção manual.

## Como rotacionar a credencial

1. Gerar uma nova chave JSON da mesma service account no Console GCP.
2. Substituir o arquivo em
   `/opt/escala-ici/secrets/escala-ici-staging-push-worker.json` na VM.
3. `npm run docker:push-worker:staging:up` (recria o container, remonta o
   secret).
4. Revogar a chave antiga no Console GCP.
5. Rodar `check` (ver acima) para confirmar que a nova credencial funciona
   antes de considerar a rotação concluída.

## Riscos e limites conhecidos

- `SEM_DISPOSITIVO` não é retentado automaticamente se o usuário registrar
  um dispositivo depois do envio original — o próximo evento de domínio
  chegará normalmente pelo dispositivo novo.
- Push nunca é fonte da verdade — se ele não chegar por qualquer motivo, o
  Firestore ainda mostra o estado correto quando o app abrir.
- Notificação de gestor sobre troca pendente de aprovação não existe hoje no
  domínio (`notificacoesTroca` nunca tem `destinatarioLogin` de gestor) — o
  worker não inventa isso; é uma pendência de domínio, não de transporte.
