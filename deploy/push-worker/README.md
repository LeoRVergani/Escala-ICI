# Push Worker Escala ICI em Docker

Serviço separado do Dashboard: assina `notificacoesTroca` no Firestore de
`escala-ici-staging` e reenvia como push via Firebase Cloud Messaging. Não
expõe porta pública, não recebe tráfego do celular — só saída HTTPS para
Google/Firebase. Uma falha aqui nunca derruba o Dashboard.

Documentação operacional completa: `docs/operacao/PUSH-FCM-OPERACAO.md`.

## Pré-requisitos (ação manual, fora deste repositório)

1. Service account dedicada `escala-ici-push-worker` no projeto
   `escala-ici-staging`, com papéis `roles/firebasecloudmessaging.admin` e
   `roles/datastore.user` (nunca Owner, nunca credencial pessoal).
2. Chave JSON dessa service account salva em
   `/opt/escala-ici/secrets/escala-ici-staging-push-worker.json` na VM,
   permissões restritas, dono `root`.
3. `cp .env.staging.push-worker.example .env.staging.push-worker` na raiz do
   repo e ajustar `PUSH_ACTIVATED_AT` (e manter `PUSH_ENABLED=false` até
   validar tudo).

Nenhum destes três passos é feito por este repositório nem por automação —
são deliberadamente manuais.

## Subir (perfil `push`, não sobe junto com o Dashboard por padrão)

```bash
npm run docker:push-worker:staging:build
npm run docker:push-worker:staging:up
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml ps
```

## Verificar sem enviar push

```bash
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push run --rm push-worker node dist/cli/check.js
```

## Parar

```bash
npm run docker:push-worker:staging:down
```

## Build local sem credencial (só para validar a imagem)

```bash
docker build -f deploy/push-worker/Dockerfile -t escala-ici-push-worker:local .
docker compose -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml config
```
