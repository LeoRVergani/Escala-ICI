import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const existe = (caminho) => access(new URL(caminho, raiz)).then(() => true).catch(() => false);

test('SDK do Firebase instalado (12.17.1) expõe register/onRegistered/unregister/onUnregistered', async () => {
  const publico = await ler('node_modules/firebase/node_modules/@firebase/messaging/dist/index-public.d.ts');
  assert.match(publico, /export declare function register\(/);
  assert.match(publico, /export declare function onRegistered\(/);
  assert.match(publico, /export declare function unregister\(/);
  assert.match(publico, /export declare function onUnregistered\(/);
});

test('nenhum código novo do App chama getToken/deleteToken (API obsoleta de registration token)', async () => {
  const [pushMessaging, client, employeeApp] = await Promise.all([
    ler('lib/firebase/pushMessaging.ts'),
    ler('lib/firebase/client.ts'),
    ler('apps/app/src/EmployeeApp.tsx'),
  ]);
  const fonte = `${pushMessaging}\n${client}\n${employeeApp}`;
  assert.doesNotMatch(fonte, /\bgetToken\s*\(/);
  assert.doesNotMatch(fonte, /\bdeleteToken\s*\(/);
});

test('nenhum documento de dispositivosPush é gravado com o campo token no repositório do App', async () => {
  const repositorio = await ler('lib/firebase/pushDeviceRepository.ts');
  assert.doesNotMatch(repositorio, /\btoken\s*:/);
  assert.match(repositorio, /\bfid\s*:/);
  assert.match(repositorio, /environment:\s*'STAGING'/);
  assert.match(repositorio, /schemaVersion/);
});

test('o repositório de push do App nunca importa writeRepository (autoinscrição via Rules, não via caminho administrativo)', async () => {
  const repositorio = await ler('lib/firebase/pushDeviceRepository.ts');
  const linhasDeImport = repositorio.split('\n').filter((linha) => /^\s*import\b/.test(linha));
  for (const linha of linhasDeImport) {
    assert.doesNotMatch(linha, /writeRepository/, linha);
    assert.doesNotMatch(linha, /exigirEscritaAdministrativaHabilitada/, linha);
  }
  assert.ok(linhasDeImport.length > 0, 'o arquivo deveria ter pelo menos um import — a varredura pode estar quebrada');
});

test('existe somente um service worker — nenhum firebase-messaging-sw.js é criado', async () => {
  assert.equal(await existe('public/firebase-messaging-sw.js'), false);
  assert.equal(await existe('apps/app/public/firebase-messaging-sw.js'), false);
  assert.equal(await existe('apps/app/src/sw/firebase-messaging-sw.js'), false);
  const provider = await ler('components/PwaProvider.tsx');
  const registros = provider.match(/\.register\(/g) ?? [];
  assert.equal(registros.length, 1, 'PwaProvider deve continuar chamando .register() uma única vez');
  assert.match(provider, /register\('\/service-worker\.js'/);
});

test('register() do FCM recebe o ServiceWorkerRegistration explicitamente — nunca deixa o Firebase procurar outro worker', async () => {
  const pushMessaging = await ler('lib/firebase/pushMessaging.ts');
  assert.match(pushMessaging, /serviceWorkerReady\s*\(\s*\)/);
  assert.match(pushMessaging, /register\(messaging,\s*\{\s*vapidKey,\s*serviceWorkerRegistration\s*\}\)/);
});

test('o clique de notificação só abre rota interna baseada em trocaId — nunca uma URL vinda do payload', async () => {
  const worker = await ler('apps/app/src/sw/serviceWorker.js');
  assert.match(worker, /self\.addEventListener\('notificationclick'/);
  assert.match(worker, /encodeURIComponent\(trocaId\)/);
  assert.doesNotMatch(worker, /payload\.fcmOptions/);
  assert.doesNotMatch(worker, /notification\.click_action/);
  assert.doesNotMatch(worker, /clients\.openWindow\(\s*(payload|dados|event)/);
});

test('o service worker preserva cache/offline/SKIP_WAITING — a integração de push foi anexada ao final, sem tocar a lógica existente', async () => {
  const original = await ler('public/service-worker.js');
  const fonte = await ler('apps/app/src/sw/serviceWorker.js');
  assert.doesNotMatch(
    original,
    /firebase|getMessaging|onBackgroundMessage/i,
    'public/service-worker.js (servido pela Sites Worker/Next) deve continuar 100% genérico',
  );
  assert.match(fonte, /caches\.open\(CACHE_SHELL\)/);
  assert.match(fonte, /SCOPE_PATH/);
  assert.match(fonte, /APP_ENTRY/);
  assert.match(fonte, /event\.data\?\.type === 'SKIP_WAITING'/);
  assert.doesNotMatch(fonte, /importScripts\(/);
});

test('a integração de push do service worker usa firebase/messaging/sw (getMessaging + onBackgroundMessage) — auditoria PUSH-PWA-1.1', async () => {
  const fonte = await ler('apps/app/src/sw/serviceWorker.js');
  assert.match(fonte, /from 'firebase\/app'/);
  assert.match(fonte, /from 'firebase\/messaging\/sw'/);
  assert.match(fonte, /getMessaging\(/);
  assert.match(fonte, /onBackgroundMessage\(/);
  // Nenhuma dependência hardcoded do SDK dentro do repositório — só as
  // mesmas variáveis de build já usadas em lib/firebase/client.ts.
  assert.match(fonte, /import\.meta\.env\.VITE_FIREBASE_API_KEY/);
  assert.match(fonte, /import\.meta\.env\.VITE_FIREBASE_MESSAGING_SENDER_ID/);
});

test('notificationclick é registrado antes de getMessaging (ordem exigida pela documentação oficial do FCM Web)', async () => {
  const fonte = await ler('apps/app/src/sw/serviceWorker.js');
  const indiceClick = fonte.indexOf("addEventListener('notificationclick'");
  const indiceGetMessaging = fonte.indexOf('getMessaging(app)');
  assert.notEqual(indiceClick, -1);
  assert.notEqual(indiceGetMessaging, -1);
  assert.ok(indiceClick < indiceGetMessaging, 'notificationclick deve vir antes da inicialização do FCM');
});

test('showNotification só é chamado uma vez no service worker — impossível duplicar a mesma notificação', async () => {
  const fonte = await ler('apps/app/src/sw/serviceWorker.js');
  const chamadas = fonte.match(/\.showNotification\(/g) ?? [];
  assert.equal(chamadas.length, 1, 'deve existir exatamente um chamador de showNotification');
});

test('o service worker não empacota código-fonte do Firebase copiado manualmente (é bundle do pacote npm, via build próprio)', async () => {
  const fonte = await ler('apps/app/src/sw/serviceWorker.js');
  assert.doesNotMatch(fonte, /Copyright \d{4} Google LLC/);
  assert.ok(fonte.length < 15_000, 'a fonte deve ser só a integração do App — o bundle real vem do build (vite.sw.config.ts)');
});

test('o build do service worker (apps/app/vite.sw.config.ts) produz um único arquivo fixo, sem apagar o resto do build principal', async () => {
  const config = await ler('apps/app/vite.sw.config.ts');
  assert.match(config, /fileName: \(\) => 'service-worker\.js'/);
  assert.match(config, /emptyOutDir: false/);
  assert.match(config, /publicDir: false/);
  const pacoteApp = JSON.parse(await ler('apps/app/package.json'));
  assert.match(pacoteApp.scripts.build, /vite\.config\.ts.*&&.*vite\.sw\.config\.ts/);
});

test('o Dashboard não importa Firebase Messaging', async () => {
  const dashboardApp = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.doesNotMatch(dashboardApp, /firebase\/messaging/);
  const dashboardPkg = JSON.parse(await ler('apps/dashboard/package.json'));
  assert.equal('firebase-admin' in (dashboardPkg.dependencies ?? {}), false);
});

test('firebase-admin permanece exclusivo do push-worker mesmo após o bump do firebase Web para 12.17.1', async () => {
  const [raizPkg, appPkg, dashboardPkg] = await Promise.all([
    ler('package.json'),
    ler('apps/app/package.json'),
    ler('apps/dashboard/package.json'),
  ]);
  for (const [nome, conteudo] of [['raiz', raizPkg], ['app', appPkg], ['dashboard', dashboardPkg]]) {
    const pacote = JSON.parse(conteudo);
    assert.equal('firebase-admin' in (pacote.dependencies ?? {}), false, `${nome} não deve depender de firebase-admin`);
  }
  const admin = JSON.parse(await ler('node_modules/firebase-admin/package.json'));
  assert.equal(admin.version, '14.2.0', 'firebase-admin não deve ser alterado nesta fase');
});

test('firebase Web está pinado em 12.17.1, sem faixa (^/~), igual na raiz e em apps/app', async () => {
  const [raizPkg, appPkg] = await Promise.all([
    ler('package.json'),
    ler('apps/app/package.json'),
  ]);
  const raiz = JSON.parse(raizPkg);
  const app = JSON.parse(appPkg);
  assert.equal(raiz.dependencies.firebase, '12.17.1');
  assert.equal(app.dependencies.firebase, '12.17.1');
});

test('dispositivosPush continua sem list para o client SDK (Rules)', async () => {
  const rules = await ler('firestore.rules');
  const blocoDispositivos = rules.match(/match \/dispositivosPush\/\{deviceId\} \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
  assert.match(blocoDispositivos, /allow list: if false;/);
});

test('o push-worker envia só data (nunca notification no nível superior) — estratégia única contra notificação duplicada', async () => {
  const pushSender = await ler('apps/push-worker/src/pushSender.ts');
  assert.doesNotMatch(pushSender, /\bnotification:\s*\{/, 'buildMessage não deve montar um campo notification de nível superior');
  assert.match(pushSender, /titulo:/);
  assert.match(pushSender, /corpo:/);
});

test('o clique de notificação nunca deixa de agir em silêncio: navigate e focus têm tratamento de falha próprio, com fallback para openWindow', async () => {
  const worker = await ler('apps/app/src/sw/serviceWorker.js');
  // Achado real (checkpoint de push real): a versão anterior só protegia
  // `navigate()` com try/catch — se `focus()` também lançasse, a promessa
  // inteira rejeitava sem nunca abrir/focar nada, e o clique parecia não
  // fazer nada. Agora cada etapa tem seu próprio try/catch.
  const chamadasTry = worker.match(/\btry\s*\{/g) ?? [];
  assert.ok(chamadasTry.length >= 2, 'navigate() e focus() devem ter blocos try próprios, não compartilhados');
  assert.match(worker, /\.navigate\(url\.href\)/);
  assert.match(worker, /\.focus\(\)/);
  assert.match(worker, /clients\.openWindow\(url\.href\)/);
});

test('showNotification continua único mesmo após a correção do clique — nenhuma regressão de duplicidade', async () => {
  const worker = await ler('apps/app/src/sw/serviceWorker.js');
  const chamadas = worker.match(/\.showNotification\(/g) ?? [];
  assert.equal(chamadas.length, 1);
});

test('apenas um service worker de messaging continua registrado (getMessaging chamado uma única vez)', async () => {
  const worker = await ler('apps/app/src/sw/serviceWorker.js');
  const chamadasGetMessaging = worker.match(/\bgetMessaging\(/g) ?? [];
  assert.equal(chamadasGetMessaging.length, 1, 'só pode existir uma inicialização de Firebase Messaging no service worker');
});

test('a instalação móvel com FID obsoleto não é tratada como Ativo — verificação enriquecida existe e é usada pelo App', async () => {
  const repositorio = await ler('lib/firebase/pushDeviceRepository.ts');
  const employeeApp = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(repositorio, /export async function obterStatusDispositivo/);
  assert.match(repositorio, /PRECISA_REPARO/);
  assert.match(employeeApp, /obterStatusDispositivo/);
  assert.match(employeeApp, /PRECISA_REPARO/);
});

test('o reparo da instalação atual nunca cria um novo deviceId — reusa o mesmo via obterOuCriarDeviceId/deviceIdPushRef', async () => {
  const employeeApp = await ler('apps/app/src/EmployeeApp.tsx');
  const funcao = employeeApp.match(/async function repararNotificacoesPush\(\)[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(funcao.length > 0, 'repararNotificacoesPush deve existir');
  assert.match(funcao, /deviceIdPushRef\.current \?\? obterOuCriarDeviceId/);
});

test('repararPush existe em pushMessaging.ts e chama unregister antes de renovar (API oficial do FCM)', async () => {
  const pushMessaging = await ler('lib/firebase/pushMessaging.ts');
  assert.match(pushMessaging, /export async function repararPush/);
  const funcao = pushMessaging.match(/export async function repararPush[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(funcao, /deps\.unregister\(/);
  assert.match(funcao, /return ativarPush\(deps\)/);
});

test('nenhum valor de VAPID key aparece hardcoded em código versionado', async () => {
  const [client, pushMessaging, envExample] = await Promise.all([
    ler('lib/firebase/client.ts'),
    ler('lib/firebase/pushMessaging.ts'),
    ler('.env.staging.app.example'),
  ]);
  const fonte = `${client}\n${pushMessaging}\n${envExample}`;
  // Chaves VAPID reais são Base64url longas (~87 caracteres); garante que
  // nenhuma string desse formato foi commitada perto de "vapid".
  assert.doesNotMatch(fonte, /VITE_FIREBASE_VAPID_KEY\s*=\s*[A-Za-z0-9_-]{40,}/);
  assert.doesNotMatch(fonte, /vapidKey:\s*['"][A-Za-z0-9_-]{40,}['"]/);
});
