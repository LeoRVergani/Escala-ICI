import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const caminho = (...partes) => resolve(raiz, ...partes);

function dimensoesPng(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    largura: buffer.readUInt32BE(16),
    altura: buffer.readUInt32BE(20),
  };
}

const manifesto = JSON.parse(
  await readFile(caminho('public/manifest.webmanifest'), 'utf8'),
);
const manifestoCompatibilidade = JSON.parse(
  await readFile(caminho('public/manifest-app.webmanifest'), 'utf8'),
);

assert.equal(manifesto.name, 'Escala ICI');
assert.equal(manifesto.short_name, 'Escala ICI');
assert.equal(manifesto.id, '/');
assert.equal(manifesto.start_url, '/');
assert.equal(manifesto.scope, '/');
assert.equal(manifesto.display, 'standalone');
assert.equal(manifesto.orientation, 'any');
assert.equal(manifesto.lang, 'pt-BR');
assert.equal(manifestoCompatibilidade.id, '/app');
assert.equal(manifestoCompatibilidade.start_url, '/app');
assert.equal(manifestoCompatibilidade.scope, '/app');
assert.equal(manifestoCompatibilidade.name, manifesto.name);

const iconesEsperados = new Map([
  ['/icons/icon-192.png', 192],
  ['/icons/icon-512.png', 512],
  ['/icons/icon-maskable-192.png', 192],
  ['/icons/icon-maskable-512.png', 512],
]);

for (const icone of manifesto.icons) {
  const tamanho = iconesEsperados.get(icone.src);
  if (tamanho === undefined) {
    continue;
  }
  const buffer = await readFile(caminho('public', icone.src.replace(/^\//, '')));
  assert.deepEqual(dimensoesPng(buffer), {
    largura: tamanho,
    altura: tamanho,
  });
  iconesEsperados.delete(icone.src);
}
assert.equal(iconesEsperados.size, 0, 'Todos os ícones PWA obrigatórios devem existir.');
assert.equal(
  manifesto.icons.filter((icone) => icone.purpose === 'maskable').length,
  2,
);

const [serviceWorker, provider, htmlApp, swFcm] = await Promise.all([
  readFile(caminho('public/service-worker.js'), 'utf8'),
  readFile(caminho('components/PwaProvider.tsx'), 'utf8'),
  readFile(caminho('apps/app/index.html'), 'utf8'),
  readFile(caminho('apps/app/src/sw/serviceWorker.js'), 'utf8'),
]);

assert.match(serviceWorker, /caches\.open\(CACHE_SHELL\)/);
assert.match(serviceWorker, /SCOPE_PATH/);
assert.match(serviceWorker, /APP_ENTRY/);
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
assert.match(serviceWorker, /event\.data\?\.type === 'SKIP_WAITING'/);
assert.doesNotMatch(
  serviceWorker.match(/self\.addEventListener\('install'[\s\S]*?\n}\);/)?.[0] ?? '',
  /skipWaiting/,
  'A instalação não deve forçar uma atualização incompatível.',
);
assert.doesNotMatch(
  serviceWorker,
  /firebase\/messaging|getMessaging|onBackgroundMessage/,
  'public/service-worker.js (servido pela Sites Worker/Next) deve continuar genérico — a integração FCM vive em apps/app/src/sw/serviceWorker.js',
);
assert.match(provider, /beforeinstallprompt/);
assert.match(provider, /updateViaCache: 'none'/);
assert.match(provider, /scope: escopo/);
assert.match(provider, /window\.location\.pathname === '\/app'/);
assert.match(htmlApp, /rel="manifest" href="\/manifest\.webmanifest"/);

// Fonte do service worker com FCM (Fase PUSH-PWA-1.1) — build separado,
// ver apps/app/vite.sw.config.ts. Preserva a mesma lógica de cache/offline
// (mesmos identificadores) e adiciona a integração com
// `firebase/messaging/sw`.
assert.match(swFcm, /caches\.open\(CACHE_SHELL\)/);
assert.match(swFcm, /event\.data\?\.type === 'SKIP_WAITING'/);
assert.match(swFcm, /from 'firebase\/messaging\/sw'/);
assert.match(swFcm, /onBackgroundMessage\(/);
assert.doesNotMatch(swFcm, /\bnotification\.click_action\b/);
assert.doesNotMatch(swFcm, /payload\.fcmOptions/);
{
  const indiceNotificationClick = swFcm.indexOf("addEventListener('notificationclick'");
  const indiceGetMessaging = swFcm.indexOf('getMessaging(app)');
  assert.notEqual(indiceNotificationClick, -1, 'o worker deve registrar notificationclick');
  assert.notEqual(indiceGetMessaging, -1, 'o worker deve chamar getMessaging');
  assert.ok(
    indiceNotificationClick < indiceGetMessaging,
    'notificationclick deve ser registrado antes de getMessaging (documentação oficial do FCM Web) para o handler do FCM nunca bloquear o nosso',
  );
}

const arquivosDist = await readdir(caminho('dist/apps/app'), {
  recursive: true,
  withFileTypes: true,
});
const nomesDistribuidos = new Set(
  arquivosDist
    .filter((item) => item.isFile())
    .map((item) => item.name),
);
assert.equal(nomesDistribuidos.has('manifest.webmanifest'), true);
assert.equal(nomesDistribuidos.has('service-worker.js'), true);
assert.equal(
  nomesDistribuidos.has('firebase-messaging-sw.js'),
  false,
  'deve haver um único service worker — nunca um firebase-messaging-sw.js separado',
);

console.log('PWA validado: manifesto, ícones, atualização segura e artefatos distribuídos.');
