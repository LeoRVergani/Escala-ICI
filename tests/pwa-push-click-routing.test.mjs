import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ESCALA_ICI_ENVELOPE_MARCADOR,
  ESCALA_ICI_ENVELOPE_VERSAO,
  TIPO_MENSAGEM_CLIQUE_NOTIFICACAO,
  construirEnvelopeDiagnosticoLocal,
  construirEnvelopeTroca,
  construirMensagemCliqueParaJanela,
  envelopeEscalaIciReconhecido,
  executarAberturaDeJanela,
  processarAberturaClique,
  processarMensagemEmSegundoPlano,
  resolverUrlInternaDoEnvelope,
} from '../apps/app/src/sw/pushClickRouting.js';

// Payload exato produzido por apps/push-worker/src/cli/pushTest.ts +
// apps/push-worker/src/pushSender.ts (buildMessage) para --login=<login>.
const PAYLOAD_REAL_PUSH_TEST = {
  data: {
    eventId: 'push-test-1755123456789',
    trocaId: 'push-test',
    tipo: 'TROCA_SOLICITADA',
    route: 'trocas/detalhe',
    titulo: 'Teste Escala ICI',
    corpo: 'Push staging funcionando.',
  },
};

const ORIGEM = 'https://staging.escala-ici-staging.pages.dev';
const APP_ENTRY = '/';

function criarClienteFalso(overrides = {}) {
  return {
    url: `${ORIGEM}/`,
    navigate: async () => {},
    focus: async () => {},
    postMessage: () => {},
    ...overrides,
  };
}

// --- 1/2/3: onBackgroundMessage → showNotification → notification.data ---

test('processarMensagemEmSegundoPlano retorna (não void) a Promise de exibirNotificacao — nunca perde o ciclo de vida do evento push', async () => {
  let promiseResolvida = false;
  const exibirNotificacao = async (args) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    promiseResolvida = true;
    return { args };
  };

  const retorno = processarMensagemEmSegundoPlano(PAYLOAD_REAL_PUSH_TEST, { exibirNotificacao });
  assert.ok(retorno instanceof Promise, 'deve retornar uma Promise, nunca undefined (void)');
  await retorno;
  assert.equal(promiseResolvida, true, 'quem aguarda a Promise retornada deve esperar showNotification terminar de verdade');
});

test('o envelope entregue a showNotification usa o payload real de push:test — eventId/trocaId/tipo/route preservados', async () => {
  let argsRecebidos = null;
  const exibirNotificacao = async (args) => {
    argsRecebidos = args;
    return 'ok';
  };

  await processarMensagemEmSegundoPlano(PAYLOAD_REAL_PUSH_TEST, { exibirNotificacao });

  assert.equal(argsRecebidos.titulo, 'Teste Escala ICI');
  assert.equal(argsRecebidos.corpo, 'Push staging funcionando.');
  const envelope = argsRecebidos.dados;
  assert.equal(envelope.escalaIci, ESCALA_ICI_ENVELOPE_MARCADOR);
  assert.equal(envelope.envelopeVersao, ESCALA_ICI_ENVELOPE_VERSAO);
  assert.equal(envelope.eventId, 'push-test-1755123456789');
  assert.equal(envelope.trocaId, 'push-test');
  assert.equal(envelope.tipo, 'TROCA_SOLICITADA');
  assert.equal(envelope.route, 'trocas/detalhe');
  assert.equal(envelope.diagnostico, false);
});

test('reprodução do bug real (achado PUSH-PWA-2B.2C): o padrão antigo "void exibirNotificacaoEscala(...)" NUNCA retorna a Promise — por isso este teste falharia contra o código anterior à correção', async () => {
  // Recria literalmente a forma do handler anterior (serviceWorker.js antes
  // desta fase): `void exibirNotificacaoEscala(...)` dentro do callback de
  // onBackgroundMessage, sem `return`. `onPush()` do SDK faz `await
  // messaging.onBackgroundMessageHandler(payload)` dentro do próprio
  // `event.waitUntil()` do evento `push` — se o handler não retorna a
  // Promise real, esse `await` resolve quase imediatamente, destacando o
  // `showNotification()` (ainda em andamento) da vida útil do evento. O
  // navegador pode então encerrar o service worker antes da notificação
  // (e seus `data`) serem de fato persistidos — consistente com o clique
  // real não encontrando `trocaId` em `event.notification.data`.
  function handlerAntigoComBug(payload, exibirNotificacaoEscala) {
    const dados = payload && payload.data;
    if (!dados) {
      return undefined;
    }
    void exibirNotificacaoEscala({ titulo: dados.titulo, corpo: dados.corpo, dados });
    return undefined;
  }

  let promiseDeExibicaoAindaPendente = true;
  const exibirNotificacaoEscala = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    promiseDeExibicaoAindaPendente = false;
  };

  const retornoAntigo = handlerAntigoComBug(PAYLOAD_REAL_PUSH_TEST, exibirNotificacaoEscala);
  assert.equal(retornoAntigo, undefined, 'o padrão antigo retorna undefined — nada para o SDK aguardar');
  await Promise.resolve(retornoAntigo);
  assert.equal(
    promiseDeExibicaoAindaPendente,
    true,
    'no padrão antigo, quem aguarda o retorno do handler NUNCA espera showNotification terminar — exatamente o bug',
  );

  // Contraste: o handler corrigido (processarMensagemEmSegundoPlano) retorna
  // a Promise real e só resolve depois de showNotification concluir.
  let promiseNoHandlerCorrigidoAindaPendente = true;
  const exibirNotificacaoCorrigida = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    promiseNoHandlerCorrigidoAindaPendente = false;
  };
  await processarMensagemEmSegundoPlano(PAYLOAD_REAL_PUSH_TEST, { exibirNotificacao: exibirNotificacaoCorrigida });
  assert.equal(promiseNoHandlerCorrigidoAindaPendente, false, 'o handler corrigido garante que showNotification já terminou');
});

test('o envelope de clique nunca inclui titulo/corpo nem campos arbitrários vindos do payload — só os campos conhecidos', () => {
  const envelope = construirEnvelopeTroca({
    eventId: 'ev1',
    trocaId: 'troca-1',
    tipo: 'TROCA_SOLICITADA',
    route: 'trocas/detalhe',
    titulo: 'não deveria aparecer',
    corpo: 'não deveria aparecer',
    url: 'https://evil.example/phish',
    link: 'https://evil.example/phish',
    click_action: 'https://evil.example/phish',
    fcmOptions: { link: 'https://evil.example/phish' },
    fid: 'fid-secreto',
    token: 'token-secreto',
  });
  assert.deepEqual(Object.keys(envelope).sort(), [
    'diagnostico', 'envelopeVersao', 'escalaIci', 'eventId', 'origem', 'route', 'tipo', 'trocaId',
  ].sort());
  assert.equal(envelope.eventId, 'ev1');
  assert.equal(envelope.trocaId, 'troca-1');
});

test('processarMensagemEmSegundoPlano não chama exibirNotificacao quando o payload não tem data (nunca duplica nem inventa notificação)', async () => {
  let chamadas = 0;
  const exibirNotificacao = async () => {
    chamadas += 1;
  };
  const resultado = await processarMensagemEmSegundoPlano({}, { exibirNotificacao });
  assert.equal(chamadas, 0);
  assert.equal(resultado, undefined);
});

// --- Reconhecimento do envelope / proteção contra notificação alheia ---

test('envelopeEscalaIciReconhecido rejeita notificações alheias (ex.: wrapper interno FCM_MSG do SDK do Firebase)', () => {
  assert.equal(envelopeEscalaIciReconhecido({ FCM_MSG: { notification: {} } }), false);
  assert.equal(envelopeEscalaIciReconhecido({ escalaIci: 'outra-coisa', envelopeVersao: 1 }), false);
  assert.equal(envelopeEscalaIciReconhecido({ escalaIci: ESCALA_ICI_ENVELOPE_MARCADOR, envelopeVersao: 999 }), false);
  assert.equal(envelopeEscalaIciReconhecido(null), false);
  assert.equal(envelopeEscalaIciReconhecido(undefined), false);
});

test('envelopeEscalaIciReconhecido aceita o envelope real construído a partir do payload de push:test', () => {
  const envelope = construirEnvelopeTroca(PAYLOAD_REAL_PUSH_TEST.data);
  assert.equal(envelopeEscalaIciReconhecido(envelope), true);
});

// --- Resolução de URL: trocaId, diagnóstico local, ausência de trocaId, URL externa ---

test('resolverUrlInternaDoEnvelope constrói a URL de Trocas a partir de trocaId — nunca de campo externo', () => {
  const envelope = construirEnvelopeTroca(PAYLOAD_REAL_PUSH_TEST.data);
  const url = resolverUrlInternaDoEnvelope(envelope, { origin: ORIGEM, appEntry: APP_ENTRY });
  assert.equal(url.origin, ORIGEM);
  assert.equal(url.pathname, '/');
  assert.equal(url.searchParams.get('trocaId'), 'push-test');
  assert.equal(url.searchParams.has('pushDiagnostico'), false);
});

test('resolverUrlInternaDoEnvelope do diagnóstico local aponta para ?pushDiagnostico=1, nunca trocaId', () => {
  const envelope = construirEnvelopeDiagnosticoLocal();
  const url = resolverUrlInternaDoEnvelope(envelope, { origin: ORIGEM, appEntry: APP_ENTRY });
  assert.equal(url.searchParams.get('pushDiagnostico'), '1');
  assert.equal(url.searchParams.has('trocaId'), false);
});

test('resolverUrlInternaDoEnvelope retorna null quando não há trocaId nem diagnóstico (nunca abre destino vazio)', () => {
  const envelope = construirEnvelopeTroca({ eventId: 'ev1' });
  const url = resolverUrlInternaDoEnvelope(envelope, { origin: ORIGEM, appEntry: APP_ENTRY });
  assert.equal(url, null);
});

test('resolverUrlInternaDoEnvelope retorna null para envelope não reconhecido, mesmo contendo trocaId', () => {
  const url = resolverUrlInternaDoEnvelope({ trocaId: 'x' }, { origin: ORIGEM, appEntry: APP_ENTRY });
  assert.equal(url, null);
});

test('a URL nunca é construída a partir de url/link/click_action/fcmOptions — só self.location.origin + trocaId codificado', () => {
  const envelope = construirEnvelopeTroca({
    trocaId: 'abc/../../evil?x=1',
    url: 'https://evil.example',
    link: 'https://evil.example',
  });
  const url = resolverUrlInternaDoEnvelope(envelope, { origin: ORIGEM, appEntry: APP_ENTRY });
  assert.equal(url.origin, ORIGEM);
  assert.equal(url.searchParams.get('trocaId'), 'abc/../../evil?x=1');
  assert.doesNotMatch(url.href, /evil\.example/);
});

// --- Mensagem SW → janela ---

test('construirMensagemCliqueParaJanela só aceita trocaId/diagnostico — nunca URL', () => {
  const msgTroca = construirMensagemCliqueParaJanela(construirEnvelopeTroca({ trocaId: 'push-test' }));
  assert.deepEqual(msgTroca, { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' });

  const msgDiag = construirMensagemCliqueParaJanela(construirEnvelopeDiagnosticoLocal());
  assert.deepEqual(msgDiag, { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, diagnostico: true });

  assert.equal(construirMensagemCliqueParaJanela({ trocaId: 'x' }), null);
});

// --- executarAberturaDeJanela: todas as combinações de navigate/focus/postMessage/openWindow ---

test('sem janela existente: abre com clients.openWindow()', async () => {
  let urlAberta = null;
  const resultado = await executarAberturaDeJanela({
    cliente: null,
    url: `${ORIGEM}/?trocaId=push-test`,
    mensagem: { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' },
    abrirNovaJanela: async (destino) => { urlAberta = destino; },
  });
  assert.equal(urlAberta, `${ORIGEM}/?trocaId=push-test`);
  assert.equal(resultado.estrategia, 'openWindow-sem-cliente');
});

test('janela existente com navigate() funcional: navega, envia mensagem e foca — nunca cai para openWindow', async () => {
  let navegouPara = null;
  let mensagemRecebida = null;
  let focuOk = false;
  let abriuNovaJanela = false;
  const cliente = criarClienteFalso({
    navigate: async (url) => { navegouPara = url; },
    postMessage: (msg) => { mensagemRecebida = msg; },
    focus: async () => { focuOk = true; },
  });
  const resultado = await executarAberturaDeJanela({
    cliente,
    url: `${ORIGEM}/?trocaId=push-test`,
    mensagem: { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' },
    abrirNovaJanela: async () => { abriuNovaJanela = true; },
  });
  assert.equal(navegouPara, `${ORIGEM}/?trocaId=push-test`);
  assert.deepEqual(mensagemRecebida, { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' });
  assert.equal(focuOk, true);
  assert.equal(abriuNovaJanela, false);
  assert.equal(resultado.estrategia, 'janela-existente');
  assert.equal(resultado.navegou, true);
});

test('navigate() ausente (navegador sem suporte): usa mensagem + focus, nunca precisa de openWindow', async () => {
  let mensagemRecebida = null;
  let focuOk = false;
  let abriuNovaJanela = false;
  const cliente = { url: `${ORIGEM}/`, postMessage: (msg) => { mensagemRecebida = msg; }, focus: async () => { focuOk = true; } };
  const resultado = await executarAberturaDeJanela({
    cliente,
    url: `${ORIGEM}/?trocaId=push-test`,
    mensagem: { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' },
    abrirNovaJanela: async () => { abriuNovaJanela = true; },
  });
  assert.equal(mensagemRecebida.trocaId, 'push-test');
  assert.equal(focuOk, true);
  assert.equal(abriuNovaJanela, false);
  assert.equal(resultado.navegou, false);
  assert.equal(resultado.mensagemEnviada, true);
});

test('navigate() lançando erro: não interrompe o fluxo — mensagem e focus ainda são tentados', async () => {
  let mensagemRecebida = null;
  let focuOk = false;
  const cliente = criarClienteFalso({
    navigate: async () => { throw new Error('navigate indisponível neste estado'); },
    postMessage: (msg) => { mensagemRecebida = msg; },
    focus: async () => { focuOk = true; },
  });
  const resultado = await executarAberturaDeJanela({
    cliente,
    url: `${ORIGEM}/?trocaId=push-test`,
    mensagem: { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' },
    abrirNovaJanela: async () => { throw new Error('não deveria ser chamado'); },
  });
  assert.equal(resultado.navegou, false);
  assert.equal(mensagemRecebida.trocaId, 'push-test');
  assert.equal(focuOk, true);
});

test('focus() lançando erro depois de navigate() falhar: achado real corrigido — ainda tenta mensagem e só cai pra openWindow se nada funcionou', async () => {
  let abriuNovaJanela = false;
  const cliente = criarClienteFalso({
    navigate: async () => { throw new Error('sem suporte'); },
    postMessage: () => { throw new Error('canal fechado'); },
    focus: async () => { throw new Error('foco negado pelo navegador'); },
  });
  const resultado = await executarAberturaDeJanela({
    cliente,
    url: `${ORIGEM}/?trocaId=push-test`,
    mensagem: { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' },
    abrirNovaJanela: async () => { abriuNovaJanela = true; },
  });
  assert.equal(abriuNovaJanela, true, 'só quando navigate, mensagem e focus falham juntos é que cai para openWindow');
  assert.equal(resultado.estrategia, 'openWindow-fallback');
});

test('focus() funciona mesmo com navigate() ausente e mensagem entregue — não é preciso abrir nova janela', async () => {
  let abriuNovaJanela = false;
  const cliente = { url: `${ORIGEM}/`, postMessage: () => {}, focus: async () => {} };
  const resultado = await executarAberturaDeJanela({
    cliente,
    url: `${ORIGEM}/?trocaId=push-test`,
    mensagem: { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' },
    abrirNovaJanela: async () => { abriuNovaJanela = true; },
  });
  assert.equal(abriuNovaJanela, false);
  assert.equal(resultado.focou, true);
});

// --- processarAberturaClique: orquestração ponta a ponta com o payload real ---

test('processarAberturaClique (payload real de push:test): resolve destino, envia mensagem e reporta sucesso', async () => {
  let mensagemRecebida = null;
  const clienteExistente = criarClienteFalso({ postMessage: (msg) => { mensagemRecebida = msg; } });
  const envelope = construirEnvelopeTroca(PAYLOAD_REAL_PUSH_TEST.data);

  const resultado = await processarAberturaClique(envelope, {
    origin: ORIGEM,
    appEntry: APP_ENTRY,
    listarClientes: async () => [clienteExistente],
    abrirNovaJanela: async () => { throw new Error('não deveria abrir nova janela — já existe cliente'); },
  });

  assert.equal(resultado.aberto, true);
  assert.match(resultado.url, /\?trocaId=push-test$/);
  assert.deepEqual(mensagemRecebida, { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: 'push-test' });
});

test('processarAberturaClique com lista de clientes vazia (PWA fechado): abre nova janela na URL correta', async () => {
  let urlAberta = null;
  const envelope = construirEnvelopeTroca(PAYLOAD_REAL_PUSH_TEST.data);
  const resultado = await processarAberturaClique(envelope, {
    origin: ORIGEM,
    appEntry: APP_ENTRY,
    listarClientes: async () => [],
    abrirNovaJanela: async (url) => { urlAberta = url; },
  });
  assert.equal(resultado.aberto, true);
  assert.equal(urlAberta, `${ORIGEM}/?trocaId=push-test`);
});

test('processarAberturaClique ignora cliente de outra origem (nunca navega/foca janela de outro site)', async () => {
  let abriuNovaJanela = false;
  const clienteOutraOrigem = criarClienteFalso({ url: 'https://outra-origem.example/' });
  const envelope = construirEnvelopeTroca(PAYLOAD_REAL_PUSH_TEST.data);
  const resultado = await processarAberturaClique(envelope, {
    origin: ORIGEM,
    appEntry: APP_ENTRY,
    listarClientes: async () => [clienteOutraOrigem],
    abrirNovaJanela: async () => { abriuNovaJanela = true; },
  });
  assert.equal(abriuNovaJanela, true);
  assert.equal(resultado.estrategia, 'openWindow-sem-cliente');
});

test('processarAberturaClique com envelope de diagnóstico local abre a URL de diagnóstico, nunca Trocas', async () => {
  const envelope = construirEnvelopeDiagnosticoLocal();
  const resultado = await processarAberturaClique(envelope, {
    origin: ORIGEM,
    appEntry: APP_ENTRY,
    listarClientes: async () => [],
    abrirNovaJanela: async () => {},
  });
  assert.match(resultado.url, /pushDiagnostico=1$/);
});

test('processarAberturaClique não abre nada quando o envelope não tem destino (nem trocaId nem diagnóstico)', async () => {
  let chamouListarClientes = false;
  let chamouAbrirJanela = false;
  const envelope = construirEnvelopeTroca({ eventId: 'sem-troca-id' });
  const resultado = await processarAberturaClique(envelope, {
    origin: ORIGEM,
    appEntry: APP_ENTRY,
    listarClientes: async () => { chamouListarClientes = true; return []; },
    abrirNovaJanela: async () => { chamouAbrirJanela = true; },
  });
  assert.equal(resultado.aberto, false);
  assert.equal(chamouListarClientes, false, 'não deve nem consultar clientes se não há destino');
  assert.equal(chamouAbrirJanela, false);
});
