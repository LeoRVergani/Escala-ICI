# Operação do Push Worker (FCM, staging)

Runbook do serviço `apps/push-worker` (Docker, perfil `push`, ver
`deploy/push-worker/`). Sem segredo real neste documento.

## Pré-requisito único vez

1. Service account dedicada `escala-ici-push-worker` no projeto
   `escala-ici-staging`, papéis `roles/firebasecloudmessaging.admin` e
   `roles/datastore.user` (nunca Owner).
2. Chave JSON dessa service account em
   `/opt/escala-ici/secrets/escala-ici-staging-push-worker.json` na VM,
   dono `root`, permissões restritas.
3. `cp .env.staging.push-worker.example .env.staging.push-worker`, ajustar
   `PUSH_ACTIVATED_AT` (ISO, estável — não mudar depois de ativado) e manter
   `PUSH_ENABLED=false` até validar a infraestrutura.

## Como subir

```bash
npm run docker:push-worker:staging:build
npm run docker:push-worker:staging:up
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml ps
```

## Como parar

```bash
npm run docker:push-worker:staging:down
```

## Como ver logs

```bash
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml logs --tail=100 push-worker
```

Esperado, sem nenhum segredo: `environment=staging`,
`project=escala-ici-staging`, `pushEnabled=...`, `firestore=connected`/
listener iniciado.

## Como testar a conexão sem enviar push

```bash
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push run --rm push-worker node dist/cli/check.js
```

Confere config, credencial, `project_id`, 1 leitura Firestore e 1 chamada
FCM com `dryRun=true`. Nunca envia push de verdade.

## Como enviar um push de teste

Requer `PUSH_ENABLED=true` (o `push:test` respeita o kill switch — não faz
bypass):

```bash
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push run --rm -e PUSH_ENABLED=true push-worker node dist/cli/pushTest.js --login=<login>
```

Retorna só `devicesFound`/`successCount`/`failureCount` — nunca um token.

## Como desativar push (kill switch)

```bash
# editar .env.staging.push-worker: PUSH_ENABLED=false
npm run docker:push-worker:staging:up
```

O worker continua rodando e assinando o Firestore, só não chama o FCM. Isso
**não** afeta o Dashboard, o PWA, o Firestore nem as Trocas — eles continuam
funcionando normalmente por conta própria (push é só aviso).

## Como identificar token inválido

Um dispositivo com token permanentemente inválido é automaticamente marcado
`ativo: false` em `dispositivosPush` pelo próprio worker (nunca aparece nos
logs). Para investigar manualmente: no Console do Firestore, filtrar
`dispositivosPush` por `ativo == false` e `login == <login>`.

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
