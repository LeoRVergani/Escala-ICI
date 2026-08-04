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
