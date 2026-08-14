# @escala-ici/push-worker

Serviço Node.js separado (não é parte do Dashboard/App) que assina a coleção
`notificacoesTroca` no Firestore de `escala-ici-staging` e reenvia cada
notificação de domínio como push via Firebase Cloud Messaging.

Documentação operacional completa: `docs/operacao/PUSH-FCM-OPERACAO.md`
(auditoria de dispositivos, teste local, teste real controlado, kill switch,
saneamento com dry-run, deep link, limites do FCM).

Histórico de fases (raiz do repo): `CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md`
(infraestrutura inicial, contrato `token`), `CHECKPOINT-FASE-PUSH-1B-FID.md`
(migração para FID), `CHECKPOINT-FASE-PUSH-PWA-1.md` (registro FID no PWA),
`CHECKPOINT-FASE-PUSH-PWA-2B.md` (consolidado: deploy, saneamento e teste
FCM real). Estado atual resumido: `PROJECT_STATUS.md` (raiz do repo).

Contrato de dispositivo: `WEB` (implementado) e `ANDROID` (reservado no
schema, sem cliente nesta base de código). Identificador é sempre FID
(Firebase Installation ID) — nunca token de push cru; payload FCM é sempre
`data`-only.

Este pacote nunca deve ser importado por `apps/dashboard` ou `apps/app`
(ver `tests/push-worker-boundaries.test.mjs`), e `firebase-admin` só existe
como dependência aqui. Roda como usuário não-root, sem porta pública, com o
secret da credencial montado via grupo suplementar dedicado (`group_add`,
nunca variável de ambiente). Serviço permanente sempre com `PUSH_ENABLED=false`;
só é elevado temporariamente em container efêmero para teste controlado.
