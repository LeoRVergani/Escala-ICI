# Índice de documentação — Escala ICI

Ponto de entrada para toda a documentação do repositório. Para o estado atual
resumido do projeto, comece por
[`PROJECT_STATUS.md`](../PROJECT_STATUS.md) (raiz do repo).

## Visão atual

- [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) — fonte central de verdade:
  componentes, ambientes, funcionalidades concluídas, situação do push,
  limitações, pendências reais. **Fonte atual.**
- [`README.md`](../README.md) — guia de entrada do monorepo: execução local,
  laboratório Firebase, builds, deploys por fase, visão geral de
  Administração/Trocas/Push. **Fonte atual.**

## Especificações (`docs/spec/`)

- [`spec/ADMINISTRACAO_E_HIERARQUIA.md`](spec/ADMINISTRACAO_E_HIERARQUIA.md) —
  perfis, unidades organizacionais, matriz de permissões, modo de simulação,
  auditoria, bootstrap do primeiro admin. **Fonte atual**, baseada em código e
  Firestore Rules.
- [`spec/TROCA_ESCALA_PLANO.md`](spec/TROCA_ESCALA_PLANO.md) — especificação
  do modelo real de Trocas (7 estados, fluxo, Rules, riscos). **Fonte atual**
  na seção principal; o "Anexo histórico" ao final preserva o plano de design
  original (modelo de 8 estados, não implementado como tal) — não usar o
  anexo como referência de comportamento atual.

## Operação (`docs/operacao/`)

- [`operacao/PUSH-FCM-OPERACAO.md`](operacao/PUSH-FCM-OPERACAO.md) — runbook
  completo do push-worker: subir/parar, testar sem enviar, auditar
  dispositivos, saneamento reversível com dry-run, teste FCM real em
  container efêmero, deep link, diagnóstico de duplicidade, limites do FCM,
  recuperação de restart, rotação de credencial. **Fonte atual.**
- [`operacao/BOOTSTRAP_ADMIN_STAGING.md`](operacao/BOOTSTRAP_ADMIN_STAGING.md)
  — processo manual único de promoção do primeiro `ADMIN_SISTEMA` em
  staging via Console do Firebase. **Fonte atual.**

## Implantação (`deploy/`)

- [`../deploy/cloudflare-pages/README.md`](../deploy/cloudflare-pages/README.md)
  — deploy do App/PWA no Cloudflare Pages: projeto real `escala-ici-staging`,
  autenticação não interativa, verificação pós-deploy. **Fonte atual.**
- [`../deploy/push-worker/README.md`](../deploy/push-worker/README.md) —
  subir/parar o push-worker via Docker Compose (perfil `push`). **Fonte
  atual**, curto — detalhes operacionais estão no runbook acima.
- [`../deploy/dashboard/README.md`](../deploy/dashboard/README.md) — Dashboard
  em Docker (build, healthcheck, proxy reverso na VM).
- [`../deploy/firebase-staging/README.md`](../deploy/firebase-staging/README.md)
  — preflight e aceite de homologação do Firebase de staging (Fase 3K-B).
- [`../apps/push-worker/README.md`](../apps/push-worker/README.md) — fronteira
  do pacote `@escala-ici/push-worker` (nunca importado por Dashboard/App),
  contrato de dispositivo, referências cruzadas aos checkpoints. **Fonte
  atual.**

## Administração

Ver [`spec/ADMINISTRACAO_E_HIERARQUIA.md`](spec/ADMINISTRACAO_E_HIERARQUIA.md)
e [`operacao/BOOTSTRAP_ADMIN_STAGING.md`](operacao/BOOTSTRAP_ADMIN_STAGING.md)
acima.

## Trocas

Ver [`spec/TROCA_ESCALA_PLANO.md`](spec/TROCA_ESCALA_PLANO.md) acima. Módulo
canônico no código: `lib/trocasEscala.ts`. Não confundir com
`lib/trocaEscala.ts` (singular, histórico, não usado por tela nenhuma) nem
`lib/trocaEscalaMock.ts` (protótipo visual da fase de design).

## Push/PWA

Ver [`operacao/PUSH-FCM-OPERACAO.md`](operacao/PUSH-FCM-OPERACAO.md) e os
checkpoints de push abaixo, em ordem cronológica:

- [`../CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md`](../CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md)
  — infraestrutura inicial do push-worker (Fase PUSH-1A). **Histórico** —
  contrato inicial usava `token`, substituído pela fase seguinte; ver Nota de
  estado posterior no próprio arquivo.
- [`../CHECKPOINT-FASE-PUSH-1B-FID.md`](../CHECKPOINT-FASE-PUSH-1B-FID.md) —
  migração de `token` para FID (Fase PUSH-1B). **Histórico** — "PWA ainda
  pendente" descrito ali foi resolvido pela fase seguinte; ver Nota de estado
  posterior.
- [`../CHECKPOINT-FASE-PUSH-PWA-1.md`](../CHECKPOINT-FASE-PUSH-PWA-1.md) —
  registro de FID no PWA Web, card de Perfil, auditoria arquitetural
  PUSH-PWA-1.1. **Histórico** — deploy e teste real citados como pendentes
  ali já ocorreram; ver Nota de estado posterior.
- [`../CHECKPOINT-FASE-PUSH-PWA-2B.2A.md`](../CHECKPOINT-FASE-PUSH-PWA-2B.2A.md)
  — auditoria sanitizada de dispositivos e correção do teste local/clique,
  sem envio FCM real. **Histórico** — saneamento e teste real ocorreram na
  fase seguinte; ver Nota de estado posterior.
- [`../CHECKPOINT-FASE-PUSH-PWA-2B.md`](../CHECKPOINT-FASE-PUSH-PWA-2B.md) —
  checkpoint consolidado: deploy, PWA/FID, Cloudflare, diagnóstico local,
  saneamento reversível e teste FCM real (2/2 sucesso, ressalva no clique).
  **Fonte mais recente sobre o resultado real do push.**

## Laboratório local

Ver seção "Laboratório Firebase em localhost" em [`../README.md`](../README.md)
e `seed/README.md` (carga inicial de dados fictícios).

## Documentação obsoleta ou histórica

Checkpoints de fases anteriores à separação em Dashboard/App e à introdução
de Push/Administração/Trocas — registros técnicos datados, preservados sem
reescrita. Não descrevem o estado atual; cada um documenta uma sub-fase
específica no momento em que foi concluída:

`CHECKPOINT-FASE-3A.md`, `3B`, `3C`, `3D`, `3E`, `3F`, `3G`, `3H`, `3I`,
`3J-B`, `3J-C`, `3J-C.1`, `3J-C.2`, `3K-A`, `3K-B`, `3K-C`, `3K-C.1` — evolução
inicial do monorepo, competência dinâmica, experiência adaptativa, PWA/ícones,
sessão e regras, contrato visual responsivo, integração Firebase, laboratório
com emuladores, separação de implantações (Fase 3K-A), homologação staging
(Fase 3K-B), laboratório LAN na VM (Fase 3K-C/3K-C.1). Consulte cada arquivo
diretamente para o roteiro e as evidências daquela sub-fase.

`CHECKPOINT-FASE-3K-D1.md`, `CHECKPOINT-FASE-3K-D2.md` — desenho inicial de
Troca de escala (5 estados, ainda não implementado no momento). Superado pelo
modelo real de 7 estados — ver
[`spec/TROCA_ESCALA_PLANO.md`](spec/TROCA_ESCALA_PLANO.md).

`CHECKPOINT-FASE-3K-D2A-GRADE.md`, `CHECKPOINT-FASE-3K-D2C-VINCULO-UID.md`,
`CHECKPOINT-FASE-3K-D2D-UNDEFINED-TOAST.md` — correções pontuais de UI/UX e
bugs na Grade e no vínculo de usuários. Sem relação direta com Push/
Administração/Trocas; sem indicação de regressão nas fases posteriores lidas
para esta consolidação.
