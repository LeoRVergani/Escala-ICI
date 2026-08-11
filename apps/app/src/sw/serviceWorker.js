const VERSION = 'fase-3k-c-v1';
const CACHE_SHELL = `escala-ici-shell-${VERSION}`;
const CACHE_RUNTIME = `escala-ici-runtime-${VERSION}`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const APP_ENTRY = SCOPE_PATH || '/';
const APP_MANIFEST = SCOPE_PATH === '/app'
  ? '/manifest-app.webmanifest'
  : '/manifest.webmanifest';
const APP_SHELL = [
  APP_ENTRY,
  APP_MANIFEST,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-48.png',
  '/icons/escala-ici-mark.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves
          .filter((chave) =>
            chave.startsWith('escala-ici-')
            && ![CACHE_SHELL, CACHE_RUNTIME].includes(chave))
          .map((chave) => caches.delete(chave)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

async function navegacaoApp(request) {
  try {
    const resposta = await fetch(request);
    if (resposta.ok) {
      const cache = await caches.open(CACHE_RUNTIME);
      await cache.put(APP_ENTRY, resposta.clone());
    }
    return resposta;
  } catch {
    return (await caches.match(APP_ENTRY))
      || new Response('Escala ICI indisponível offline neste dispositivo.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
  }
}

async function redePrimeiro(request) {
  try {
    const resposta = await fetch(request);
    if (resposta.ok) {
      const cache = await caches.open(CACHE_RUNTIME);
      await cache.put(request, resposta.clone());
    }
    return resposta;
  } catch {
    return (await caches.match(request))
      || new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function cachePrimeiro(request) {
  const armazenada = await caches.match(request);
  if (armazenada) {
    return armazenada;
  }
  const resposta = await fetch(request);
  if (resposta.ok) {
    const cache = await caches.open(CACHE_RUNTIME);
    await cache.put(request, resposta.clone());
  }
  return resposta;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navegacaoApp(request));
    return;
  }

  if (url.pathname.startsWith('/demo/')) {
    event.respondWith(redePrimeiro(request));
    return;
  }

  if (
    ['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)
    || url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cachePrimeiro(request));
  }
});

/**
 * Push FCM em segundo plano (Fase PUSH-PWA-1, corrigido na auditoria
 * PUSH-PWA-1.1 — ver CHECKPOINT-FASE-PUSH-PWA-1.md, seção "Auditoria").
 *
 * `notificationclick` é registrado ANTES de importar/inicializar o SDK do
 * Firebase Messaging — exatamente a ordem que a documentação oficial do
 * FCM Web exige ("make sure to handle notificationclick before you import
 * FCM functions or libraries", https://firebase.google.com/docs/cloud-messaging/js/receive).
 * O handler interno do próprio SDK (registrado só quando `getMessaging()`
 * é chamado, mais abaixo) chama `event.stopImmediatePropagation()` para
 * qualquer notificação que ele mesmo exibiu — se o nosso handler não
 * estivesse registrado primeiro, o dele rodaria e bloquearia o nosso.
 * Como aqui SEMPRE exibimos a notificação manualmente (nunca a via
 * automática do SDK — ver abaixo), `event.notification.data` é
 * exatamente o objeto `data` que passamos para `showNotification()`, sem
 * nenhum wrapper interno do SDK para desembrulhar.
 */
self.addEventListener('notificationclick', (event) => {
  const dados = event.notification && event.notification.data;
  const trocaId = dados && typeof dados.trocaId === 'string' ? dados.trocaId : null;
  event.notification.close();
  if (!trocaId) {
    return;
  }
  event.waitUntil(abrirTrocaNaJanela(trocaId));
});

/**
 * Constrói a URL só a partir do `trocaId` conhecido — nunca aceita link
 * arbitrário vindo do payload. `APP_ENTRY` já resolve `/` ou `/app`
 * conforme o escopo deste worker, preservando os dois.
 */
async function abrirTrocaNaJanela(trocaId) {
  const destino = `${APP_ENTRY}?trocaId=${encodeURIComponent(trocaId)}`;
  const url = new URL(destino, self.location.origin);
  const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const cliente of clientes) {
    if (new URL(cliente.url).origin === url.origin) {
      try {
        await cliente.navigate(url.href);
      } catch {
        // Nem todo navegador suporta WindowClient.navigate(); ainda tentamos focar.
      }
      await cliente.focus();
      return;
    }
  }
  await self.clients.openWindow(url.href);
}

/**
 * Integração com `firebase/messaging/sw` — decisão da auditoria
 * PUSH-PWA-1.1, revertendo a implementação nativa da Fase PUSH-PWA-1.
 *
 * Motivo (auditado lendo o código-fonte real instalado —
 * `node_modules/firebase/node_modules/@firebase/messaging/dist/esm/index.sw.esm.js`
 * — e confrontado com a documentação oficial): `pushsubscriptionchange`
 * (o evento que dispara quando a PushSubscription subjacente é renovada
 * pelo navegador, inclusive com o PWA fechado) só é tratado pelo listener
 * que o próprio SDK registra dentro de `SwMessagingFactory`, e essa
 * fábrica só roda na primeira chamada a `getMessaging()` no worker. A
 * implementação nativa anterior nunca chamava `getMessaging()` aqui, então
 * nunca reportava a renovação da subscription para o Firebase — a
 * documentação oficial confirma que `onRegistered()` deve disparar de novo
 * "quando um evento pushsubscriptionchange é emitido", o que só é possível
 * com essa integração. Sem ela, o FID podia ficar dessincronizado da
 * subscription real depois de uma renovação com o app fechado.
 *
 * Estratégia de payload (também decidida nesta auditoria, documentação
 * oficial confirma o risco de duplicidade): o push-worker agora envia
 * SOMENTE `data` (sem `notification` no nível superior) — ver
 * `apps/push-worker/src/pushSender.ts`. Isso impede o SDK de exibir a
 * notificação sozinho (`onPush` interno só chama `showNotification`
 * quando `internalPayload.notification` existe); `onBackgroundMessage`
 * abaixo é o ÚNICO código que chama `showNotification`, então não há
 * combinação possível de dupla notificação para o mesmo evento.
 *
 * Configuração: só valores públicos do Firebase Web (`apiKey`/
 * `authDomain`/`projectId`/`appId`/`messagingSenderId`), vindos de
 * `import.meta.env.VITE_FIREBASE_*` — as mesmas variáveis de build já
 * usadas em `lib/firebase/client.ts`, nunca duplicadas manualmente aqui
 * como valor literal. Este arquivo é processado pelo Vite
 * (`apps/app/vite.sw.config.ts`) especificamente para resolver esse
 * `import.meta.env` em build time — nenhum valor real fica no código-fonte
 * rastreado pelo Git. Se a configuração não estiver completa (ambiente sem
 * push configurado, ou build local sem `.env.staging.app`), a inicialização
 * é pulada e o restante do worker (cache/offline) continua funcionando.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    onBackgroundMessage(messaging, (payload) => {
      const dados = payload && payload.data;
      if (!dados) {
        return;
      }
      void self.registration.showNotification(dados.titulo || 'Escala ICI', {
        body: dados.corpo || '',
        icon: '/icons/icon-192.png',
        data: dados,
      });
    });
  } catch {
    // Ambiente sem suporte/config completa — worker continua funcional
    // para cache/offline mesmo sem push.
  }
}
