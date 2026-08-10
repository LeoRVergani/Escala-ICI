# @escala-ici/push-worker

Serviço Node.js separado (não é parte do Dashboard/App) que assina a coleção
`notificacoesTroca` no Firestore de `escala-ici-staging` e reenvia cada
notificação de domínio como push via Firebase Cloud Messaging.

Documentação operacional completa: `docs/operacao/PUSH-FCM-OPERACAO.md`.
Checkpoint desta fase: `CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md` (raiz do repo).

Este pacote nunca deve ser importado por `apps/dashboard` ou `apps/app`
(ver `tests/push-worker-boundaries.test.mjs`), e `firebase-admin` só existe
como dependência aqui.
