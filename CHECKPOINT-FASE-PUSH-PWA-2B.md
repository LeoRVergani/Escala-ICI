# Checkpoint consolidado — Fase PUSH-PWA-2B

Data de consolidação: 2026-08-14. Este checkpoint reúne, sem repetir logs
extensos, o conjunto de sub-fases entre o deploy coordenado do PWA/Rules e a
validação real de FCM em dois dispositivos, cobrindo
`CHECKPOINT-FASE-PUSH-PWA-2B.2A.md` e o saneamento/teste real executado na
sequência (internamente chamada PUSH-PWA-2B.2C). Todos os resultados abaixo
vêm de relatórios já produzidos nesta branch — nenhum número foi inventado.

## Escopo consolidado

- Deploy de Rules e do PWA em staging.
- Registro real de FID em dois dispositivos (computador e celular).
- Diagnóstico local de notificação e clique.
- Auditoria sanitizada e saneamento reversível de dispositivos antigos.
- Um teste FCM real controlado, em container efêmero.

## Deploy de Rules e do worker

Regras (`firestore.rules`) e o contrato de `dispositivosPush` (FID, nunca
token) já estavam em produção-staging antes desta fase, herdados de
PUSH-1B/PUSH-PWA-1. Nenhuma mudança de regra foi feita nesta fase — apenas
validação de que o comportamento observado bate com as regras já publicadas.

## Configuração segura da VM

- Push-worker roda como serviço Docker permanente, perfil `push`, usuário
  não-root, sem porta publicada.
- Credencial da service account montada por `secrets:` (bind mount),
  legível pelo grupo suplementar dedicado `escala-ici-push-secret`
  (`group_add`), nunca por variável de ambiente nem por permissão pública.
- `PUSH_ENABLED=false` é o estado permanente do serviço.

## PWA e FID

- Deploy do PWA publicado antes do saneamento: commit `138a509`, deploy
  `e19d907a`, alias `https://staging.escala-ici-staging.pages.dev`.
- Service worker publicado: `push-pwa-2b2a`.
- Dois dispositivos WEB/STAGING com FID real e válido: computador (`f4bbf0`)
  e celular (`8e16c9`).

## Diagnóstico local

Confirmado em ambos os dispositivos: botão "Testar neste dispositivo" exibiu
"Teste local — Escala ICI"; clique abriu o PWA; comportamento equivalente nos
dois aparelhos. Este teste **não** usa FCM — só valida permissão e o handler
de clique do service worker no navegador/SO.

## Saneamento reversível de dispositivos antigos

Auditoria (`devices:audit --login=lvergani`) encontrou 9 documentos. Gate de
identidade sem divergências: `f4bbf0` e `8e16c9` ativos (preservar);
`9e4022`/`2b11c8` já inativos (não tocados); `ee9565`, `f349d2`, `325638`,
`76e2e3`, `a71532` ativos antigos (candidatos).

Após dry-run e autorização explícita, os 5 candidatos foram desativados
(`ativo: false`, `atualizadoEm` atualizado — nenhum outro campo alterado,
nenhum documento apagado). Auditoria posterior confirmou exatamente 2
dispositivos ativos (`f4bbf0`, `8e16c9`), ambos WEB/STAGING com FID presente;
os 7 restantes inativos.

## Teste FCM real

Único envio, via container efêmero (`docker compose run --rm`, override
`PUSH_ENABLED=true` só nesse container), restrito a `--login=lvergani`.

```
devicesFound: 2
successCount: 2
failureCount: 0
exit code: 0
```

### Resultado no computador (`f4bbf0`)

Uma notificação exibida, título "Escala ICI" (corpo não registrado pelo
usuário no momento). Sem duplicidade, sem mensagem adicional de "rodando em
segundo plano". Clique na notificação **não** abriu nem focou o PWA — apenas
fechou a notificação.

### Resultado no celular (`8e16c9`)

Uma notificação exibida (tela bloqueada, PWA já aberto em segundo plano no
momento do envio). Sem duplicidade. Toque na notificação **não** abriu o
PWA — apenas fechou a notificação.

### Clique

Falhou em ambos os dispositivos — nenhum focou/abriu o PWA nem a área de
Trocas, apesar de o mesmo comportamento funcionar no diagnóstico local
(notificação simulada via `postMessage`, não via FCM real).

### Duplicidade

Nenhuma — uma notificação por dispositivo, consistente com o payload
`data`-only e a ausência de retentativa.

## Estado final do worker

Container permanente (`push-worker-push-worker-1`) saudável, sem alteração,
`PUSH_ENABLED=false` confirmado após o teste. Hash de `PUSH_ACTIVATED_AT`
idêntico antes e depois. Nenhum container efêmero remanescente (`--rm`
removeu automaticamente). Árvore Git limpa durante toda a operação — nenhum
commit, push, merge, deploy, seed ou reinício de Dashboard.

## Riscos residuais

Clique em notificação real via FCM não abre/foca o PWA em nenhum dos dois
dispositivos testados — suspeita não confirmada de divergência entre o
payload do teste local e o payload real recebido por `onBackgroundMessage`.
Não investigado nem corrigido nesta fase (fora do escopo autorizado).

## Decisão final

Aprovação **parcial**: saneamento, contagem de dispositivos, envio único e
integridade do worker plenamente atendidos; critério de clique
abrir/focar o PWA não atendido em nenhum dos dois aparelhos.

## Próximo marco

Investigar o handler `notificationclick` do service worker para notificações
reais via FCM (possível divergência de payload entre teste local e FCM real)
antes de qualquer fase de ativação contínua do push.
