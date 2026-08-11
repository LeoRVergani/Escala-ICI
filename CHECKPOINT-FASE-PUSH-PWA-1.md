# Checkpoint — Fase PUSH-PWA-1 (registro FID, permissão e push web no PWA)

## Objetivo

Implementar no PWA do colaborador (`apps/app`) o lado cliente da Fase Push:
permissão explícita por gesto do usuário, registro por Firebase
Installation ID (FID), persistência em `dispositivosPush` (contrato
definido na Fase PUSH-1B), integração com o service worker existente para
push em segundo plano, e um deep link seguro de clique em notificação para
a tela de Trocas. Nenhuma notificação real foi enviada; nenhum deploy foi
executado.

## Auditoria PUSH-PWA-1.1 — por que a arquitetura mudou depois da primeira versão

A primeira versão desta fase implementou `push`/`notificationclick` no
service worker com APIs nativas da Push/Notifications API, sem importar o
SDK do Firebase Messaging ali. Antes de aprovar o commit, uma auditoria
dedicada (Fase PUSH-PWA-1.1) verificou duas dúvidas em aberto: (1) se esse
caminho nativo é um contrato público suportado para FCM por FID, e (2) se
a renovação do FID funciona de verdade com o PWA fechado.

**Resultado da auditoria: não. A implementação nativa foi revertida e
substituída pela integração oficial (`getMessaging()` +
`onBackgroundMessage()` de `firebase/messaging/sw`).**

### O que é comportamento interno vs. API pública

Lendo o código-fonte real instalado
(`node_modules/firebase/node_modules/@firebase/messaging/dist/esm/index.sw.esm.js`,
`firebase@12.17.1`/`@firebase/messaging@0.13.1`):

- `getMessagePayloadInternal({ data }) { return data.json(); }` — **API
  pública, por equivalência**: o SDK não faz nenhuma transformação além do
  `event.data.json()` nativo. Ler o payload manualmente (o que a versão
  nativa fazia) produz exatamente o mesmo objeto que o SDK lê — isso não
  era o problema.
- `SwMessagingFactory` — **comportamento interno, não documentado como
  contrato**: é a função (não exportada) que registra
  `self.addEventListener('push'|'pushsubscriptionchange'|'notificationclick', ...)`
  dentro do service worker. Ela só executa na **primeira chamada** a
  `getMessaging()` no worker (padrão de fábrica/DI do Firebase).
- `onSubChange(event, messaging)` — a função que trata
  `pushsubscriptionchange`: chama `refreshFidRegistrationIfStored`/
  `getTokenInternal` e avisa as janelas visíveis via
  `sendFidRegisteredToWindows`. **Só existe dentro do listener que
  `SwMessagingFactory` registra** — nenhuma outra API pública expõe esse
  comportamento.
- `onPush(event, messaging)` — se `internalPayload.notification` existe,
  chama `showNotification()` automaticamente, **incondicionalmente**,
  independente de haver ou não um `onBackgroundMessageHandler` registrado.

### O que apenas funciona tecnicamente, mas não tinha garantia pública

A versão nativa (sem `getMessaging()`) **funcionava tecnicamente** para
exibir a notificação e tratar o clique — o parsing do payload é idêntico,
como mostrado acima. Mas como ela nunca chamava `getMessaging()`, o
listener de `pushsubscriptionchange` (`onSubChange`) **nunca era
registrado**. Isso significa: se o navegador renova a `PushSubscription`
subjacente (rotação de chave, expiração) enquanto o PWA está fechado, o
FID nunca era resincronizado com a nova subscription — o worker
continuaria "funcionando" até a próxima renovação, quando o FID
armazenado no Firestore ficaria dessincronizado da subscription real, sem
qualquer sinal de erro. Não é uma suposição: é uma consequência direta e
demonstrável do código-fonte lido acima — código interno de um pacote,
isoladamente, não transforma um comportamento em API pública suportada,
exatamente como o pedido desta auditoria exigia verificar.

### Confirmação pela documentação oficial

Consultada a documentação oficial do FCM Web
(`firebase.google.com/docs/cloud-messaging/js/client` e `.../js/receive`):

- "[`onRegistered`] is triggered every time a manual `register()`
  finishes, a FID change is detected, **or a `pushsubscriptionchange`
  event is fired**" — confirma que a renovação via
  `pushsubscriptionchange` é parte do contrato documentado de
  `onRegistered`, o que só existe através do mecanismo que
  `getMessaging()` liga.
- "All messages received while the app is in the background trigger a
  display notification in the browser" quando o payload tem
  `notification` — confirma o auto-display incondicional.
- "If you want to define customized behavior in the service worker when
  the notification is clicked, **make sure to handle `notificationclick`
  before you import FCM functions or libraries**. Otherwise, FCM may
  overwrite the custom behavior." — a ordem exigida está implementada
  literalmente (ver `apps/app/src/sw/serviceWorker.js`: o listener de
  `notificationclick` é registrado antes de `getMessaging()`/qualquer uso
  do SDK).
- Padrão documentado para controle total de título/corpo/ícone sem
  duplicidade: **mensagens só-`data` (sem `notification`) + único
  `showNotification()` dentro de `onBackgroundMessage()`**.

### Decisão

Adotado o "caminho preferencial" do pedido — nenhuma exceção foi possível
justificar com evidência pública, então a implementação nativa foi
revertida.

## Arquitetura do service worker — build próprio, dois arquivos

- `public/service-worker.js` (raiz do repo) — **revertido ao estado
  original**, cache/offline/`SKIP_WAITING` puro, sem nenhuma linha de
  push. Continua sendo o que a Sites Worker/Next (`worker/index.ts`) serve
  sem alteração.
- `apps/app/src/sw/serviceWorker.js` (novo) — mesma lógica de cache
  (copiada, não reescrita) **mais** a integração de push. Processado por
  um build Vite dedicado (`apps/app/vite.sw.config.ts`, modo `lib`,
  formato `iife`, nome de saída fixo `service-worker.js`) que roda depois
  do build principal do App e sobrescreve só esse arquivo em
  `dist/apps/app/service-worker.js` — nunca apaga o resto do build
  (`emptyOutDir: false`), nunca recopia `public/` (`publicDir: false`).

Por que dois arquivos em vez de um só: `public/service-worker.js` também é
servido, sem processamento nenhum (cópia verbatim), pela Sites Worker/Next
que hospeda este mesmo repositório — arquivos em `public/` não passam pelo
pipeline do Vite, então não resolvem `import.meta.env` nem podem ser
`import`ados de pacotes npm. O deployment real do App documentado em
`docs/operacao/PUSH-FCM-OPERACAO.md` é o Cloudflare Pages de
`apps/app` (`dist/apps/app`, `CLOUDFLARE_PAGES_PROJECT` em
`.env.staging.app.example`) — só esse artefato precisa (e agora tem) a
integração de FCM. A Sites Worker/Next não foi tocada nem precisa saber
disso.

Ordem de execução dentro de `apps/app/src/sw/serviceWorker.js` (confirmada
lendo o próprio bundle gerado, não só a fonte): `notificationclick` é
registrado **antes** de `getMessaging()` ser chamado — como
`SwMessagingFactory` só roda na primeira chamada a `getMessaging()`, e essa
chamada só acontece depois, o listener do FCM nunca tem chance de rodar
primeiro e bloquear o nosso via `stopImmediatePropagation()`.

## Atualização do Firebase Web SDK

Confirmado lendo os `.d.ts` reais instalados, não memória:

- `firebase@12.1.0` (`@firebase/messaging@0.12.23`,
  `node_modules/@firebase/messaging/dist/index-public.d.ts`, antes do
  bump): só expunha `getToken`/`deleteToken`/`isSupported`/`onMessage`/
  `getMessaging` — **sem** `register`/`onRegistered`/`unregister`/
  `onUnregistered`.
- `firebase@12.17.1` confirmado publicado no npm (`npm view
  firebase@12.17.1 version` → `12.17.1`).
- Depois do bump, `@firebase/messaging@0.13.1`
  (`node_modules/firebase/node_modules/@firebase/messaging/dist/index-public.d.ts`)
  expõe exatamente a API FID esperada:
  `register(messaging, options?: RegisterOptions): Promise<void>`
  (o FID chega só via `onRegistered`, nunca no retorno — por isso o
  adapter instala `onRegistered` *antes* de chamar `register`),
  `onRegistered`, `onUnregistered`, `unregister`,
  `RegisterOptions { vapidKey?, serviceWorkerRegistration? }`.
  `getToken`/`deleteToken` continuam existindo mas marcados `@deprecated`
  — nenhum código novo os chama (`tests/pwa-push-boundaries.test.mjs`
  garante isso).
- `firebase` atualizado para `12.17.1` **exato** (sem `^`/`~`) em
  `package.json` (raiz) e `apps/app/package.json`; `package-lock.json`
  regenerado via `npm install`. `apps/dashboard/package.json`
  **intencionalmente não foi tocado** — continua `firebase: 12.1.0`; o
  `npm install` resolveu isso corretamente com uma cópia aninhada em
  `apps/dashboard/node_modules/firebase` (confirmado com `npm ls firebase
  --workspaces --all`), sem conflito. `firebase-admin` continua
  `14.2.0`, inalterado.

## Estratégia contra notificação duplicada

O push-worker (`apps/push-worker/src/pushSender.ts`) foi alterado — único
arquivo de produção do worker tocado nesta auditoria, exatamente para
resolver a duplicidade — para enviar **só `data`, nunca `notification`**
no nível superior da mensagem. `titulo`/`corpo` (antes em `notification`)
viajam como campos string dentro de `data`. Motivo: com `getMessaging()`
agora ativo no service worker (necessário para a renovação de FID), um
payload com `notification` faria o SDK exibir a notificação
automaticamente; se `onBackgroundMessage` também chamasse
`showNotification()`, o mesmo evento apareceria duas vezes. Só-`data` +
único `showNotification()` dentro de `onBackgroundMessage` (em
`apps/app/src/sw/serviceWorker.js`) elimina essa combinação por
construção — é o único código deste worker que chama `showNotification`.
`eventId`/`trocaId`/`tipo`/`route` preservados; `android.notification.channelId`
removido (só fazia sentido junto de um `notification` de nível superior;
`android.priority`/`ttl` preservados).

Arquivos adicionais tocados por essa mudança, como pedido: apenas
`apps/push-worker/src/pushSender.ts` e seu teste
`apps/push-worker/test/pushSender.test.ts`.

## Contrato persistido em `dispositivosPush` (WEB)

Igual ao definido na Fase PUSH-1B (`apps/push-worker/src/types.ts`):

```ts
{
  deviceId: string;       // gerado localmente, nunca o FID, nunca e-mail/UID
  login: string;          // login corporativo
  plataforma: 'WEB';
  fid: string;            // nunca `token`
  ativo: boolean;
  criadoEm: string;       // preservado em renovações
  atualizadoEm: string;
  ultimaConfirmacaoEm: string | null;
  appVersion: string | null;
  environment: 'STAGING';
  schemaVersion: 1;
}
```

`deviceId` é estável por instalação (este navegador) + login: gerado com
`gerarUuid()` e persistido em `localStorage` sob
`escala-ici-push-device-id-{login}` — trocar de conta no mesmo navegador
nunca reaproveita o `deviceId` de outra pessoa; múltiplos dispositivos do
mesmo login (aba/instalação diferente) recebem `deviceId`s diferentes.
Escrita feita direto por `lib/firebase/pushDeviceRepository.ts`
(`doc/getDoc/setDoc/updateDoc`, nunca `list`), autorizada pelas Firestore
Rules (`login == loginDoAuth()`, ver PUSH-1B) — **não** passa por
`exigirEscritaAdministrativaHabilitada()`/`writeRepository`, então
funciona normalmente mesmo com `VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false`
(trava administrativa, não deveria bloquear autoinscrição do próprio
dispositivo).

## Permissão por gesto explícito

`ativarPush()` (`lib/firebase/pushMessaging.ts`) só é acionado por dois
caminhos: o clique em "Ativar notificações" no card do Perfil, ou a
retomada automática (próxima seção) — que só age quando a permissão já é
`granted`. Em nenhum dos dois casos `Notification.requestPermission()` é
chamado quando a permissão já é conhecida (`granted` ou `denied`) — só
quando é `default` (nunca solicitada). O card não avalia
suporte/permissão sozinho ao montar o App: a avaliação
(`avaliarEstadoNotificacoesPush`) só corre quando a aba Perfil é aberta, e
é puramente de leitura.

## Reabertura e recarregamento (retomada automática)

Extraído para uma função pura e testável,
`retomarPushSeAderido(params, deps)` em `lib/firebase/pushMessaging.ts`
(sem depender de React/DOM) — chamada uma vez por sessão autenticada,
depois que a carga inicial termina (`EmployeeApp.tsx`,
`retomarPushAutomaticamente`). Só age quando **todas** as condições de
adesão anterior confirmada se cumprem:

1. `Notification.permission` já `granted` — nunca solicitada de novo;
2. existe um `deviceId` local para este login (adesão anterior neste
   navegador — usuários que nunca aderiram não têm `deviceId` local,
   então a função devolve `NAO_ADERIU` sem tocar em nada);
3. o navegador ainda suporta o SDK (`isSupported()`);
4. o documento correspondente ainda está `ativo` no Firestore — uma
   desativação feita por outro dispositivo/sessão nunca é revertida
   automaticamente.

Quando todas se cumprem, chama `ativarPush()` (que instala `onRegistered`
antes de `register()`, idempotente) e persiste o FID renovado no mesmo
documento via `registrarOuRenovarDispositivo` — a UI só muda para `ATIVO`
depois que essa persistência confirma; falha de rede é silenciosa (o
usuário só veria o estado real ao abrir o Perfil). Uma assinatura de
longa duração separada (`assinarRenovacaoFid`), ativa enquanto o card
mostra `ATIVO`, cobre renovações que cheguem depois, via
`pushsubscriptionchange` (agora suportado de verdade — ver auditoria
acima) ou por outra aba.

Após logout, `desativarDispositivo` marca o documento `ativo: false`, então
um novo login do **mesmo** login/navegador não reativa notificações
automaticamente (condição 4 falha) — só reativaria sem nova adesão
explícita no caso residual de o logout ter ficado sem rede e o timeout de
3s ter interrompido a limpeza antes da escrita no Firestore; nesse caso
específico, tratado como continuação da preferência já expressa daquele
login/dispositivo (não uma reativação "do zero"), e não uma exceção
recém-introduzida sem teste — está coberta pelos testes de
`limparPushAoSair`.

## Desativação e logout

Pelo Perfil: `ativo: false` no documento (decisão — nunca apaga; preserva
o histórico do `deviceId` para uma reativação futura renovar o mesmo
documento em vez de criar um órfão, simétrico ao que o push-worker já faz
para FIDs inválidos) + `unregister()` do SDK + remoção do `deviceId` local.

No logout (`encerrarSessao` em `EmployeeApp.tsx`), a orquestração
(nunca lança, nunca bloqueia `sair()` por muito tempo — timeout de 3s
cobre o caso offline) foi extraída para `limparPushAoSair`
(`lib/firebase/pushMessaging.ts`, testável sem React); `EmployeeApp.tsx`
só resolve o `deviceId` local e limpa o armazenamento local depois. A
assinatura pública de `sair()` (`lib/firebase/authRepository.ts`) não foi
alterada. Se a limpeza falhar ou não der tempo, o registro remoto residual
continua existindo até o push-worker eventualmente marcá-lo inválido (FID
deixa de responder) — não é um vazamento permanente.

## Foreground sem duplicidade

`onMessage` (`assinarMensagensEmPrimeiroPlano`) só participa de uma
dedupe por `eventId` (`Set` em `useRef`) — nunca chama `new Notification()`
nem navega. O Firestore (`observarNotificacoesTroca`, já existente)
continua sendo a única fonte que atualiza a central de Trocas em tempo
real; o canal FCM em foreground é redundante por natureza (a mesma
alteração já chega pelos dois canais quase ao mesmo tempo) e este módulo
deliberadamente não faz nada visível com ele além de registrar o
`eventId` como visto.

## Background e clique

`apps/app/src/sw/serviceWorker.js`: `onBackgroundMessage` recebe o
payload só-`data` e chama `showNotification()` uma única vez — nunca há
auto-display concorrente (sem `notification` de nível superior, o SDK
nunca exibe nada por conta própria). `notificationclick` (registrado
antes da inicialização do FCM, ver auditoria acima) constrói a URL **só**
a partir do `trocaId` do `data` que a própria página passou para
`showNotification()` — nunca de um campo do payload controlado
externamente: `${APP_ENTRY}?trocaId=<id>`. Foca uma janela existente do
mesmo origin (`WindowClient.navigate()` + `focus()`) ou abre uma nova
(`clients.openWindow()`).

No lado do App, `EmployeeApp.tsx` lê `?trocaId=` uma única vez (via
inicializador tardio de `useState`, não um efeito) e limpa a URL
imediatamente; a aplicação do deep link espera `dadosCarregados` (nunca
perde o destino por a sessão ainda estar sendo restaurada) e reaproveita a
mesma lógica de abertura de troca já existente
(`tela = 'trocas'`, `trocaAbertaId`), marcando como lida a notificação
correspondente só depois que a troca é encontrada.

## Demonstração, emulador e HTTP

- **Demonstração**: `pushConfigurado()`/o card nunca pedem permissão nem
  registram nada; o card mostra "Notificações disponíveis somente com
  conta autenticada."
- **Emulador**: `pushConfigurado()` retorna `false` quando
  `emuladoresHabilitados()` é verdadeiro — nunca inicializa Messaging
  contra o emulador.
- **HTTP LAN**: `pushConfigurado()` exige HTTPS ou `localhost`/`127.0.0.1`
  — fora disso, o card mostra "Não configuradas neste ambiente", sem
  lançar erro; o resto do App continua funcionando normalmente.

## Segurança

- `.env.staging.app`/`.env.staging.push-worker` continuam ignorados pelo
  Git (`git check-ignore -v`), conteúdo nunca aberto nesta sessão.
- `.env.staging.app.example` só ganhou duas chaves **vazias**
  (`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_VAPID_KEY`).
- Nenhum valor de VAPID, FID real ou credencial entrou no diff — só nomes
  de variável/comentários/fixtures de teste óbvias (`fid-1`,
  `fid-retomado-no-reload` etc.).
- `apiKey`/`authDomain`/`projectId`/`appId`/`messagingSenderId` continuam
  vindo de `import.meta.env.VITE_FIREBASE_*` (igual ao padrão já existente
  em `lib/firebase/client.ts`) em **ambos** os arquivos do service worker
  — nunca duplicados como valor literal. Confirmado que, sem
  `.env.staging.app` local, o build resolve esses campos para `undefined`
  (o bloco de inicialização do Firebase é pulado, cache continua
  funcionando) — nenhum valor real foi baixado/embutido nesta sessão. A
  VAPID key nunca é usada dentro do service worker (só no lado da janela,
  em `register()`).
- `public/service-worker.js` (servido pela Sites Worker/Next) continua
  100% genérico — `scripts/validate-pwa.mjs` agora garante isso
  explicitamente (`doesNotMatch` para `firebase`/`getMessaging`/
  `onBackgroundMessage`).
- `apps/dashboard/src` e o repositório Android não foram tocados.
  `firebase-admin` continua exclusivo de `apps/push-worker`
  (`tests/pwa-push-boundaries.test.mjs`).
- Nenhum container foi recriado/reiniciado — `push-worker-push-worker-1`
  permaneceu `Up ... (healthy)` na mesma imagem durante toda a sessão.
- `PUSH_ENABLED` permanece `false`.
- Nenhum push real foi enviado — nenhum teste chama a API real do FCM.

## Testes

Cobertura automatizada (nova/ampliada na auditoria PUSH-PWA-1.1):

- `lib/firebase/pushMessaging.test.ts` (27 testes) — DI total, sem DOM
  real: ativação exige gesto/estados de erro/suporte; nunca chama
  `requestPermission` quando a permissão já é `granted` **ou** `denied`;
  `onRegistered` instalado antes de `register`; operações concorrentes
  compartilhadas; FID nunca aparece no campo `erro`;
  **`retomarPushSeAderido`**: sem adesão anterior não age, permissão não
  `granted` não age, documento desativado no Firestore não reativa
  (inclusive quando a consulta rejeita, não só quando devolve `false`),
  adesão confirmada registra de novo sem pedir permissão;
  **`limparPushAoSair`**: desativa só quando há `deviceId`, sempre chama
  `unregister()`, nunca lança, nunca trava além do timeout configurável
  (testado com temporizadores falsos); ausência de `getToken`/
  `deleteToken` nas dependências padrão.
- `lib/firebase/pushDeviceRepository.test.ts` (12 testes) — inalterado
  desde a primeira versão desta fase.
- `tests/pwa-push-boundaries.test.mjs` (19 testes) — API FID confirmada no
  SDK instalado; ausência de `getToken`/`deleteToken`/`token` no código
  novo; ausência de import de `writeRepository`; um único service worker
  (nenhum `firebase-messaging-sw.js`, um único `.register()` em
  `PwaProvider`); `register()` recebe o `ServiceWorkerRegistration`
  explicitamente; deep link só por `trocaId`; `public/service-worker.js`
  permanece genérico enquanto `apps/app/src/sw/serviceWorker.js` preserva
  cache/offline/`SKIP_WAITING` e integra `firebase/messaging/sw`;
  `notificationclick` registrado antes de `getMessaging` (checagem de
  ordem por posição textual); exatamente um `showNotification` no
  arquivo; ausência de código copiado manualmente do Firebase; o build do
  SW produz nome fixo sem apagar o build principal; push-worker envia só
  `data`; Dashboard não importa Firebase Messaging; `firebase-admin`
  exclusivo do worker; `firebase` pinado em `12.17.1` exato; `dispositivosPush`
  continua com `list: false`; ausência de valor VAPID hardcoded.
- `apps/push-worker/test/pushSender.test.ts` — atualizado para o payload
  só-`data` (título/corpo em `data.titulo`/`data.corpo`, sem
  `notification` de nível superior).
- `scripts/validate-pwa.mjs`/`scripts/validate-deployments.mjs`
  ampliados: build não pode conter `firebase-messaging-sw.js`;
  `SCOPE_PATH`/`APP_ENTRY` (nomes de identificador, não sobrevivem à
  minificação) checados na fonte legível
  (`apps/app/src/sw/serviceWorker.js`), não no artefato minificado;
  `onBackgroundMessage`/ausência de `firebase-messaging-sw` checados no
  artefato de fato distribuído (strings literais sobrevivem à
  minificação, confirmado empiricamente).

**Limitação assumida** (transparência, não uma lacuna escondida): os
itens de UI que dependem de renderização real de componente React
(responsividade, contraste, foco visível) continuam sem teste de
componente automatizado — este repositório roda os testes de `lib`/`apps`
em `environment: 'node'` (sem DOM/jsdom); adicionar jsdom + Testing
Library só para esta fase seria uma mudança de infraestrutura maior do
que o escopo pedia. Toda a *lógica* por trás de cada estado (o que decide
ativar/renovar/desativar) foi extraída para funções puras e está 100%
testada; só a renderização visual em si depende de inspeção manual.

## Comandos executados (validação, depois da auditoria)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ |
| `npm run typecheck:worker` | ✅ |
| `npm run test:push-worker` | ✅ 44 testes |
| `npm run test:unit` | ✅ 321 testes |
| `npm run test:boundaries` | ✅ 62 testes |
| `npm run test:firestore-rules` | ✅ 85 testes (regressão — nada mudou em `firestore.rules` nesta fase) |
| `npm run lint` | ✅ 0 erros (2 warnings pré-existentes, não relacionados) |
| `npm run build:apps` | ✅ (inclui o build dedicado do service worker) |
| `npm run build:app:pages` | ✅ |
| `npm run validate:pwa` | ✅ |
| `npm run validate:artifact` | ✅ |
| `npm run validate:deployments` | ✅ (regex de `SCOPE_PATH`/`APP_ENTRY` corrigido para ler a fonte legível, não o artefato minificado) |
| `npm run validate:firebase-contract` | ❌ pré-existente, não relacionado — ver abaixo |
| `git diff --check` | ✅ |

`validate:firebase-contract` falha com `9 !== 7` em
`exigirEscritaAdministrativaHabilitada()` — **mesma falha documentada em
`CHECKPOINT-FASE-PUSH-1-FCM-STAGING.md`**, confirmada com `git diff --stat
-- lib/firebase/writeRepository.ts scripts/validate-firebase-contract.mjs`
vazio (nenhum dos dois arquivos foi tocado nesta fase nem em nenhuma fase
Push anterior). Não investigada nem corrigida por estar fora de escopo;
permanece idêntica ao baseline, nada nesta fase a piorou.

## Ausência de deploy / ausência de envio real

Nenhum `firebase deploy`, `wrangler`/deploy Cloudflare, ou
`docker compose up/down/restart` foi executado. Nenhum push real foi
enviado — `PUSH_ENABLED` permanece `false` e nenhum teste toca a API real
do FCM.

## PWA/Android pendentes

Android continua fora desta máquina (mesma constatação das fases
anteriores) — quando existir, seu cliente FCM também precisará tratar
mensagens só-`data` manualmente (a mesma decisão de estratégia contra
duplicidade tomada aqui para o Web se aplica à Android também, não é uma
particularidade do PWA). Do lado PWA, esta fase entrega o registro/
persistência/UI/renovação — falta o teste real ponta a ponta com push de
verdade, que só deve acontecer numa fase de ativação coordenada.

## Procedimento futuro de ativação coordenada

1. Confirmar `VITE_FIREBASE_MESSAGING_SENDER_ID`/`VITE_FIREBASE_VAPID_KEY`
   configurados no Cloudflare Pages (staging).
2. Deploy do PWA (fora desta fase).
3. Um usuário opt-in ativa notificações pelo Perfil e confirma `ATIVO`.
4. Confirmar no Console do Firestore que `dispositivosPush` recebeu o
   documento `WEB` esperado (sem abrir/imprimir o `fid`).
5. Testar reabertura do PWA (fechar/abrir de novo) e confirmar que o
   estado `ATIVO` persiste sem novo pedido de permissão.
6. Só então considerar `PUSH_ENABLED=true` em staging, com um teste
   controlado (`push:test --login=<login>`) antes de qualquer ativação
   ampla — ver `PUSH-PWA-2`.

## Próxima fase recomendada

**`PUSH-PWA-2`** — deploy coordenado das Rules, do PWA e do worker FID,
seguido de teste real com todos os usuários opt-in.

## Git

- Branch `feature/push-fcm-staging`, HEAD inicial
  `e49ce663ccfedb79c95812ff9641b56083378034` (PR #1, draft, aberto, base
  `main`, head `feature/push-fcm-staging`).
- Nenhum commit, push ou merge realizado nesta sessão (nem na PUSH-PWA-1
  original, nem na auditoria PUSH-PWA-1.1).
