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

## Como auditar dispositivos sem enviar FCM

Desde a Fase PUSH-PWA-2B.2A, o pacote do worker oferece uma CLI somente
leitura para listar os documentos de `dispositivosPush` de um login sem
exibir FID, token, e-mail, UID ou credencial:

```bash
npm run devices:audit --workspace @escala-ici/push-worker -- --login=<login>
```

No container/ambiente do worker, ela usa a mesma configuração operacional do
serviço. Em execução local, defina apenas as variáveis operacionais já fixas
no Compose (`FIREBASE_PROJECT_ID=escala-ici-staging`,
`PUSH_ENVIRONMENT=staging`, `GOOGLE_APPLICATION_CREDENTIALS=<caminho>` e
`PUSH_ACTIVATED_AT`), sem imprimir o conteúdo do `.env` nem da credencial.

A saída é estável e sanitizada: `deviceId` abreviado, `ativo`, `plataforma`,
`environment`, presença de FID como booleano, timestamps e posição relativa.
Essa CLI não envia FCM, não grava no Firestore e não desativa dispositivos.
Use-a antes de qualquer saneamento para comparar os IDs abreviados exibidos
no card do PWA em cada instalação.

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

## Como testar no card do PWA (teste local, sem FCM)

O botão "Testar neste dispositivo" no card "Notificações" do Perfil
(`apps/app/src/EmployeeApp.tsx`) **nunca chama o FCM nem o push-worker** —
envia uma mensagem interna (`postMessage`/`MessageChannel`) direto ao service
worker do próprio navegador, que exibe uma notificação local
("Teste local — Escala ICI"). Serve para validar permissão do navegador/SO e
o comportamento de clique do service worker (`push-pwa-2b2d`), sem depender
de rede, FCM ou do worker estar de pé. Não substitui um teste FCM real — só
confirma a metade "exibição e clique local" do caminho.

## Como reconfigurar um dispositivo (reparo de FID)

Um registro pode ficar "zumbi" — `ativo: true` no Firestore, mas com FID
inválido ou não mais reconhecido pelo navegador (ex.: dados do site
limpos). O botão "Reconfigurar neste dispositivo" no mesmo card força
`unregister()` seguido de um novo registro completo, substituindo o FID
salvo. Use isso antes de qualquer saneamento manual quando o card mostrar
"Ativo" mas o dispositivo nunca receber push de teste.

## Saneamento reversível de dispositivos antigos

Regra permanente: **nunca apagar documentos de `dispositivosPush`**. Um
dispositivo antigo/duplicado é desativado (`ativo: false`), nunca excluído —
mantém o histórico e permite reverter manualmente se necessário.

Procedimento obrigatório, nesta ordem:

1. Rodar `devices:audit` (seção acima) e comparar os IDs abreviados exibidos
   contra o card de cada dispositivo físico que deve continuar ativo.
2. Preparar um **dry-run**: listar explicitamente, por sufixo abreviado, qual
   dispositivo será preservado e qual será desativado. Não escrever nada
   nesta etapa.
3. Confirmar explicitamente com quem pediu a operação antes de qualquer
   escrita — nunca desativar em lote sem essa confirmação.
4. Desativar cada dispositivo pelo documento resolvido de forma única pelo
   sufixo (nunca por prefixo ambíguo ou correspondência parcial que possa
   acertar mais de um documento). Alterar somente `ativo: false` e
   `atualizadoEm`; preservar todos os demais campos.
5. Rodar `devices:audit` de novo (somente leitura) para confirmar o resultado
   antes de considerar o saneamento concluído.

Nunca prosseguir para um teste FCM real sem antes confirmar, pela auditoria,
que a contagem de dispositivos ativos é exatamente a esperada.

## Como testar um envio FCM real (container efêmero)

Use um container efêmero com `--rm`, nunca o serviço permanente, e restrinja
sempre a um único `--login=`:

```bash
PUSH_ENABLED=true docker compose --env-file .env.staging.push-worker \
  -f deploy/push-worker/compose.yaml -f deploy/push-worker/compose.staging.yaml \
  --profile push run --rm push-worker node dist/cli/pushTest.js --login=<login>
```

O `PUSH_ENABLED=true` vale **só para esse container efêmero** — o serviço
permanente, que já está de pé com `PUSH_ENABLED=false`, não é afetado e
continua com o kill switch desligado depois do teste. Resultado esperado:
`devicesFound`/`successCount`/`failureCount` batendo com a contagem de
dispositivos ativos confirmada na auditoria anterior. Não repetir o envio se
algum dispositivo não exibir a notificação — registrar como falha específica
daquele aparelho e investigar separadamente (não é seguro reenviar sem
entender a causa).

Depois do teste, confirmar que nenhum container efêmero ficou remanescente
(`docker ps -a` não deve listar nada além do serviço permanente) e que o
serviço permanente segue com `PUSH_ENABLED=false`.

## Deep link do clique na notificação

O `notificationclick` do service worker (`apps/app/src/sw/serviceWorker.js`)
é registrado **antes** de importar/inicializar o SDK do Firebase Messaging —
ordem exigida pela documentação oficial do FCM Web e verificada por
`scripts/validate-pwa.mjs`. Só dois destinos são aceitos a partir do payload:
diagnóstico local (`?pushDiagnostico=1`) ou abrir uma troca específica
(`?trocaId=<id>`) — nunca uma URL arbitrária vinda do payload. O handler
tenta focar/navegar uma janela já aberta da mesma origem antes de abrir uma
nova (`clients.openWindow()` como último recurso).

**Achado conhecido**: em teste real via FCM (fase PUSH-PWA-2B.2C,
2026-08-14), o clique na notificação real não abriu nem focou o PWA em
nenhum dos dois dispositivos testados (computador e celular), embora o
mesmo comportamento funcione no teste local. Suspeita não confirmada:
divergência entre o payload usado no teste local (`postMessage` direto) e o
payload real do FCM recebido por `onBackgroundMessage`. Pendência registrada
em `PROJECT_STATUS.md`, não corrigida ainda.

## Diagnóstico de duplicidade

O payload do FCM enviado pelo worker é **somente `data`** (nunca
`notification` nativo) — decisão deliberada para que só o
`onBackgroundMessage` do service worker decida quando chamar
`showNotification()`, evitando que o próprio SDK do navegador exiba uma
notificação automática além da que o código controla. Em foreground, o App
tem deduplicação por `eventId` (nunca exibe a mesma notificação duas vezes,
nunca navega sozinho — o Firestore continua sendo a fonte da verdade). Se
mais de uma notificação aparecer para o mesmo evento, isso é uma regressão a
investigar nessas duas camadas (payload do worker e dedup client-side), não
comportamento esperado.

## Limites do FCM a considerar

- Multicast por FID é enviado em lotes; o SDK do Admin limita cada chamada de
  multicast a até 500 destinatários — irrelevante hoje (poucos dispositivos
  ativos por login), mas relevante se o número de dispositivos crescer muito.
- Um FID pode se tornar permanentemente inválido a qualquer momento (app
  desinstalado, dados do navegador limpos, certificado expirado) — o worker
  já trata isso desativando o dispositivo automaticamente, sem alertar quem
  opera.
- Push nunca é fonte da verdade: se uma mensagem não chegar por qualquer
  limite ou falha do FCM, o Firestore ainda mostra o estado correto quando o
  app abrir.

## Ausência de portas públicas

O push-worker não expõe nenhuma porta (nenhuma diretiva `ports:` no
Compose, nenhum `EXPOSE` no Dockerfile) — só faz saída HTTPS para os
serviços do Google/Firebase. Uma falha ou reinício deste serviço nunca
derruba Dashboard, App ou Firestore, e nada externo consegue alcançá-lo
diretamente pela rede.

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
- Clique em notificação real via FCM não abre/foca o PWA (ver seção "Deep
  link do clique na notificação" acima) — achado da fase PUSH-PWA-2B.2C,
  não corrigido.

## Estado operacional mais recente

Fase PUSH-PWA-2B.2C (2026-08-14): saneamento reversível de 5 registros
antigos concluído (nenhum documento apagado), exatamente 2 dispositivos
ativos confirmados (WEB/STAGING/FID presente). Um único teste FCM real via
container efêmero: `devicesFound: 2`, `successCount: 2`, `failureCount: 0`,
uma notificação recebida em cada dispositivo, sem duplicidade. Worker
permanente retornou e permaneceu com `PUSH_ENABLED=false`. Aprovação da fase
classificada como parcial, por causa do achado de clique acima. Ver
`CHECKPOINT-FASE-PUSH-PWA-2B.md` para o consolidado completo.
