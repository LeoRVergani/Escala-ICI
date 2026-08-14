# Checkpoint — Fase PUSH-PWA-2B.2D (correção do clique da notificação FCM real)

Data: 2026-08-14. Escopo: diagnóstico, implementação e validação automatizada
da falha real registrada na fase PUSH-PWA-2B.2C — clique/toque na
notificação push não abria nem focava o PWA em nenhum dos dois dispositivos.
**Nenhum deploy, envio FCM real ou commit foi feito nesta fase.**

## Estado excepcional da working tree nesta fase

Esta fase foi retomada de uma implementação parcial iniciada em sessão
anterior, interrompida antes de testes/validações rodarem. A retomada
auditou o código parcial antes de continuar (ver seção abaixo) em vez de
reiniciar do zero.

## Auditoria do trabalho parcial (antes de continuar)

Backup do diff parcial salvo em `/tmp/push-pwa-2b2d-parcial.patch`
(hash SHA-256 registrado no relatório da sessão, não neste documento).

O que já estava implementado corretamente:
- Módulo puro `apps/app/src/sw/pushClickRouting.js` com envelope interno
  versionado, reconhecimento de notificações próprias, resolução de URL só
  por `trocaId`/diagnóstico, e abertura de janela com fallback
  navigate→mensagem→focus→openWindow, cada etapa com try/catch próprio.
- `serviceWorker.js` já importava e usava o módulo: `notificationclick`
  reconhecendo o envelope antes de agir, `onBackgroundMessage` delegando
  para `processarMensagemEmSegundoPlano` (retornando a Promise, não mais
  `void`).
- `EmployeeApp.tsx` já tinha o listener `serviceWorker.addEventListener('message', ...)`
  para o protocolo `ESCALA_ICI_NOTIFICATION_CLICK`, reaproveitando
  `setDeepLinkTrocaId`/`setPushDiagnosticoNaUrl` — nenhuma segunda regra de
  navegação.

O que faltava (concluído nesta retomada):
- Nenhum teste automatizado existia ainda para o módulo novo.
- Os testes textuais existentes em `tests/pwa-push-boundaries.test.mjs` que
  apontavam para funções antigas (`resolverUrlInternaNotificacao`,
  `abrirUrlInternaNaJanela`, ambas removidas de `serviceWorker.js` na
  extração) ainda não tinham sido atualizados — quebrariam a suíte.
- Nenhuma validação (`typecheck`, `test:boundaries`, `build`, etc.) tinha
  sido executada sobre o código parcial.
- Não havia checkpoint nem atualização do runbook/`PROJECT_STATUS.md`.

Nenhum erro de lógica foi encontrado no código parcial em si — a auditoria
confirmou que o desenho (envelope + fallback robusto) estava correto; o
trabalho pendente era de teste, validação e documentação, não de correção de
bug no código já escrito.

## Reprodução automatizada do problema

`apps/app/src/sw/pushClickRouting.test.mjs` inclui um teste que recria
literalmente a forma do handler anterior (`void exibirNotificacaoEscala(...)`,
sem `return`) e demonstra que, nesse padrão, quem aguarda o retorno do
handler **nunca espera `showNotification()` terminar** — o teste falha essa
propriedade contra o padrão antigo e passa contra `processarMensagemEmSegundoPlano`
(o handler corrigido). Os demais 23 testes do arquivo cobrem os 12 cenários
exigidos (payload real de `pushTest.ts`, clique com/sem janela, `navigate()`
funcionando/ausente/lançando erro, `focus()` funcionando/falhando, fallback
por mensagem SW→janela, fallback final por `openWindow()`, notificação
alheia não interceptada, rejeição de URL externa, ausência de `trocaId`).

## Causa raiz comprovada (mais provável, com evidência de código)

O `onBackgroundMessage()` anterior usava `void exibirNotificacaoEscala(...)`
sem retornar/aguardar a Promise. O código-fonte instalado do SDK
(`node_modules/firebase/node_modules/@firebase/messaging/dist/esm/index.sw.esm.js`,
função `onPush`) faz:

```js
if (!!messaging.onBackgroundMessageHandler) {
  const payload = externalizePayload(internalPayload);
  await messaging.onBackgroundMessageHandler(payload);   // <- nosso handler
}
```

e todo `onPush(event, messaging)` é o que o próprio SDK passa a
`event.waitUntil()` no listener do evento `push`
(`self.addEventListener('push', e => { e.waitUntil(onPush(e, messaging)); })`).
Como o handler antigo retornava `undefined` (por causa do `void`), o
`await` acima resolvia quase imediatamente — **antes** de
`showNotification()` (chamada dentro de `exibirNotificacaoEscala`, mas nunca
aguardada) terminar de fato. Isso destaca a chamada real de
`showNotification()` da vida útil estendida do evento `push`: o navegador
fica livre para encerrar o service worker assim que `onPush()` resolve, o
que pode interromper a gravação da notificação (incluindo seu `data`) antes
de ela ser persistida de forma confiável — consistente com o sintoma real
observado: a notificação apareceu (título/corpo, que são passados
diretamente à API do SO), mas o clique não encontrou `trocaId` em
`event.notification.data` (nenhuma navegação, nenhuma janela aberta).

Esta é a hipótese mais bem sustentada por evidência de código e pela
especificação do Push API (`waitUntil` deve envolver *todo* trabalho
assíncrono crítico do evento). **Só um novo teste real nos dois
dispositivos confirma definitivamente que essa era a causa completa** — não
foi feito nesta fase (proibido pelo escopo).

## Diferença entre diagnóstico local e FCM real

O teste local (`ESCALA_ICI_LOCAL_NOTIFICATION_TEST`) já usava
`event.waitUntil(exibirNotificacaoEscala(...).then(...).catch(...))` —
corretamente aguardado desde a Fase PUSH-PWA-2B.2A. Por isso o diagnóstico
local sempre funcionou: nunca teve o defeito de ciclo de vida do
`onBackgroundMessage`, que só existe no caminho de push real (evento `push`
do FCM, não no `postMessage` do teste local).

## Arquivos criados e alterados nesta fase

Criados:
- `apps/app/src/sw/pushClickRouting.js` (já existia da sessão anterior,
  preservado sem reescrita).
- `tests/pwa-push-click-routing.test.mjs` (novo, 24 testes; criado
  inicialmente em `apps/app/src/sw/pushClickRouting.test.mjs` e movido para
  este caminho numa correção posterior desta mesma fase, para poder ser
  descoberto por `npm run test:boundaries`).
- `CHECKPOINT-FASE-PUSH-PWA-2B.2D.md` (este arquivo).

Alterados:
- `apps/app/src/sw/serviceWorker.js` (já alterado pela sessão anterior,
  preservado sem reescrita — só a versão do marcador público mudou de
  `push-pwa-2b2a` para `push-pwa-2b2d`).
- `apps/app/src/EmployeeApp.tsx` (já alterado pela sessão anterior,
  preservado sem reescrita).
- `tests/pwa-push-boundaries.test.mjs` (4 testes atualizados para apontar
  para `pushClickRouting.js` em vez de funções removidas de
  `serviceWorker.js`; 1 teste atualizado para o novo marcador de versão).
- `docs/operacao/PUSH-FCM-OPERACAO.md` (referência ao marcador de versão
  atualizada para `push-pwa-2b2d`).
- `PROJECT_STATUS.md` (registro do resultado desta fase).
- `package.json` (script `test:boundaries` passou a incluir
  `tests/pwa-push-click-routing.test.mjs` — única linha alterada,
  `package-lock.json` não tocado).

## Formato final do envelope interno

```js
{
  escalaIci: 'ESCALA_ICI_PUSH',   // marcador — nunca colide com o wrapper FCM_MSG do SDK
  envelopeVersao: 1,
  origem: 'PWA_WEB',
  diagnostico: false,             // true só no teste local
  eventId: string | null,
  trocaId: string | null,
  tipo: string | null,
  route: string | null,
}
```

Nunca contém FID, token, login, e-mail, credencial, `titulo`/`corpo` ou
qualquer campo arbitrário do payload bruto (`url`, `link`, `click_action`,
`fcmOptions`, etc. são descartados por `construirEnvelopeTroca`, mesmo se
presentes na entrada).

## Funcionamento do `notificationclick`

Reconhece o envelope de forma síncrona (`envelopeEscalaIciReconhecido`),
antes de qualquer `await` — só então chama `event.stopImmediatePropagation()`
e `event.notification.close()`, e delega a abertura para
`event.waitUntil(processarAberturaClique(...))`. Notificações alheias (sem o
marcador) retornam sem interferir em nenhum outro listener.

## Funcionamento do protocolo SW → janela

Mensagem `{ type: 'ESCALA_ICI_NOTIFICATION_CLICK', trocaId }` ou
`{ type: 'ESCALA_ICI_NOTIFICATION_CLICK', diagnostico: true }`, enviada à
janela existente via `postMessage`, sempre além de (nunca em vez de) tentar
`navigate()`. `EmployeeApp.tsx` escuta `serviceWorker.addEventListener('message', ...)`
e aplica exatamente os mesmos estados (`setDeepLinkTrocaId`/
`setPushDiagnosticoNaUrl`) e os mesmos efeitos já usados pelo deep link por
URL — nenhuma segunda regra de navegação.

## Fallbacks de navegação

1. Sem janela: `clients.openWindow(url)`.
2. Com janela: tenta `navigate()` (try próprio) → sempre tenta `postMessage()`
   (try próprio) → tenta `focus()` (try próprio). Só cai para
   `openWindow()` se **nenhuma** das três teve efeito — corrigindo o achado
   anterior de que `focus()` sem proteção própria podia derrubar toda a
   promessa sem nunca abrir nada.

## Proteção contra URL externa

`resolverUrlInternaDoEnvelope` constrói a URL exclusivamente a partir de
`self.location.origin` (injetado como `origin`) e `trocaId`/diagnóstico
validados internamente — nunca lê `url`/`link`/`click_action`/
`fcmOptions.link`/host/origem arbitrários do payload. Testado inclusive com
`trocaId` contendo caracteres de path traversal (`abc/../../evil`) para
confirmar que a URL final nunca escapa da própria origem.

## Proteção contra interferência do listener do Firebase

O listener do SDK só age sobre notificações com o wrapper `FCM_MSG` — nunca
presente nas notificações do Escala ICI. Ainda assim,
`stopImmediatePropagation()` é chamado de forma síncrona, garantindo
explicitamente (não só por ordem de registro) que o listener do SDK nunca
processa um clique já assumido pelo Escala ICI.

## Confirmação de `showNotification()` aguardado

`processarMensagemEmSegundoPlano` retorna a Promise de `exibirNotificacao`
(nunca `void`); `onBackgroundMessage(messaging, (payload) => processarMensagemEmSegundoPlano(...))`
propaga essa Promise ao `await` interno do SDK. Confirmado por teste
comportamental (quem aguarda o retorno espera `showNotification` terminar).

## Proteção contra duplicidade

Preservado sem alteração: payload FCM continua só `data` (nunca
`notification` no nível superior); `onBackgroundMessage` continua sendo o
único chamador de `showNotification` (confirmado por teste de contagem, 1
única ocorrência no bundle e na fonte).

## Testes criados e ajustados

- `tests/pwa-push-click-routing.test.mjs` (movido de
  `apps/app/src/sw/pushClickRouting.test.mjs` numa correção posterior desta
  mesma fase, import relativo ajustado para
  `../apps/app/src/sw/pushClickRouting.js`): 24 testes, cobrindo os 12
  cenários exigidos com o payload real de `pushTest.ts`. **Integrado a
  `npm run test:boundaries`** via `package.json` — não depende mais de
  execução manual.
- `tests/pwa-push-boundaries.test.mjs`: 4 testes redirecionados para
  `pushClickRouting.js` (funções extraídas), 1 teste com o marcador de
  versão atualizado. Total do arquivo permanece verde.

## Totais das suítes

- `npm run test:boundaries`: **100/100 passando** (76 anteriores + 24 de
  `tests/pwa-push-click-routing.test.mjs`).
- `npm run test:unit`: **399/399 passando** (37 arquivos).
- `npm run test:push-worker`: **48/48 passando** (não afetado).
- `npm run test:firestore-rules`: **98/98 passando** (não afetado).

## Typecheck, lint e builds

- `npm run typecheck`: OK.
- `npm run typecheck:apps`: OK (Dashboard e App).
- `npm run typecheck:worker`: OK (não afetado).
- `npm run lint`: 0 erros, 2 avisos pré-existentes não relacionados
  (`authRepository.test.ts`).
- `npm run build:apps`: OK.
- `npm run build:app:pages`: OK, "Cloudflare Pages validado: App
  independente, SPA e PWA na raiz."

## Inspeção do service worker gerado

`dist/apps/app/service-worker.js`:
- marcador `push-pwa-2b2d` presente;
- `notificationclick` presente (1 ocorrência de handler próprio, confirmado
  por análise de execução via teste de fonte — a posição textual no bundle
  minificado não reflete ordem de execução por causa de hoisting de função;
  a ordem real é garantida e testada na fonte não minificada);
- marcador de envelope `ESCALA_ICI_PUSH` presente, bem no início do bundle
  (nosso módulo);
- protocolo `ESCALA_ICI_NOTIFICATION_CLICK` presente;
- fallback `openWindow` presente;
- exatamente um `registration.showNotification` próprio;
- ocorrências de `click_action`/`fcmOptions` no bundle pertencem
  exclusivamente ao código interno do SDK do Firebase (função
  `propagateFcmOptions`), nunca ao código do Escala ICI — confirmado lendo o
  bundle ao redor dessas ocorrências;
- nenhuma credencial, chave privada ou `client_email` no bundle.

## Validações PWA

`npm run validate:pwa`: "PWA validado: manifesto, ícones, atualização segura
e artefatos distribuídos." `npm run validate:artifact` e
`npm run validate:deployments`: OK.

## Riscos residuais

- A causa raiz é a mais bem sustentada por evidência de código e
  especificação, mas **não foi confirmada por um novo teste real** — só um
  reteste nos dois dispositivos comprova que o clique passa a funcionar de
  fato.
- O protocolo de mensagem SW→janela depende de a janela existente já ter o
  listener montado (`useEffect` sem dependências, montado uma vez); se o
  clique ocorrer antes do React montar esse efeito (janela recém-aberta),
  a mensagem pode ser perdida — mitigado pelo fato de `navigate()` (quando
  suportado) já cobrir esse caso via reload completo.
- Título exibido relatado como "Escala ICI" em vez de "Teste Escala ICI" no
  teste real anterior não foi reproduzido como bug de código — `titulo`/
  `corpo` são passados inalterados de `payload.data` para
  `showNotification`; a causa mais provável é a mesma falta de `await`
  (processo pode ter sido interrompido antes de persistir os dados
  completos) ou imprecisão do relato do usuário, não uma transformação
  incorreta no código.

## Estado final

- Nenhum commit, push, deploy ou envio FCM real foi feito.
- `PUSH_ENABLED` permanece `false` no worker permanente.
- Aprovação desta fase é **condicional**: código corrigido e validado
  automaticamente; a aprovação final ainda depende de commit, deploy de
  staging controlado e um único reteste real nos dois dispositivos
  (computador `f4bbf0` e celular `8e16c9`).

## Próximo checkpoint

Commit desta correção, deploy de staging controlado do PWA e um único
reteste FCM real nos dois dispositivos — só então a fase PUSH-PWA-2B pode
ser considerada aprovada de ponta a ponta.
