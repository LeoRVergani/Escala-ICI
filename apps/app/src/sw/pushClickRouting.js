/**
 * Módulo puro (sem `self`/`window`/Firebase) extraído de `serviceWorker.js`
 * para permitir testes comportamentais reais do clique em notificação —
 * ver `CHECKPOINT-FASE-PUSH-PWA-2B.2D.md` para a causa raiz corrigida aqui.
 *
 * Envelope interno: nunca reexpõe o objeto bruto recebido do FCM. Só campos
 * conhecidos (`eventId`/`trocaId`/`tipo`/`route`) sobrevivem à normalização
 * — nunca FID, token, login, e-mail, credencial ou URL externa do payload.
 */

export const ESCALA_ICI_ENVELOPE_MARCADOR = 'ESCALA_ICI_PUSH';
export const ESCALA_ICI_ENVELOPE_VERSAO = 1;
export const TIPO_MENSAGEM_CLIQUE_NOTIFICACAO = 'ESCALA_ICI_NOTIFICATION_CLICK';

function textoOuNulo(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

/** Envelope do teste local (`ESCALA_ICI_LOCAL_NOTIFICATION_TEST`) — nunca passa pelo FCM. */
export function construirEnvelopeDiagnosticoLocal() {
  return {
    escalaIci: ESCALA_ICI_ENVELOPE_MARCADOR,
    envelopeVersao: ESCALA_ICI_ENVELOPE_VERSAO,
    origem: 'PWA_WEB',
    diagnostico: true,
    trocaId: null,
    eventId: null,
    tipo: 'DIAGNOSTICO_LOCAL',
    route: null,
  };
}

/**
 * Envelope de uma notificação de Troca real, a partir de `payload.data` do
 * FCM (`apps/push-worker/src/pushSender.ts`: `eventId`/`trocaId`/`tipo`/
 * `route`/`titulo`/`corpo`). `titulo`/`corpo` ficam de fora de propósito —
 * são usados só para exibir a notificação (`exibirNotificacaoEscala`),
 * nunca precisam viajar no envelope de clique.
 */
export function construirEnvelopeTroca(dadosBrutos) {
  const bruto = dadosBrutos || {};
  return {
    escalaIci: ESCALA_ICI_ENVELOPE_MARCADOR,
    envelopeVersao: ESCALA_ICI_ENVELOPE_VERSAO,
    origem: 'PWA_WEB',
    diagnostico: false,
    eventId: textoOuNulo(bruto.eventId),
    trocaId: textoOuNulo(bruto.trocaId),
    tipo: textoOuNulo(bruto.tipo),
    route: textoOuNulo(bruto.route),
  };
}

/**
 * Reconhece exclusivamente o envelope do próprio Escala ICI — nunca uma
 * notificação de outra origem (ex.: o wrapper interno do SDK do Firebase,
 * que usa a chave `FCM_MSG`, nunca `escalaIci`).
 */
export function envelopeEscalaIciReconhecido(dados) {
  return Boolean(
    dados
    && dados.escalaIci === ESCALA_ICI_ENVELOPE_MARCADOR
    && dados.envelopeVersao === ESCALA_ICI_ENVELOPE_VERSAO,
  );
}

/**
 * Constrói a URL só a partir de campos conhecidos do envelope — nunca
 * aceita `url`/`link`/`click_action`/`fcmOptions.link` nem qualquer campo
 * arbitrário vindo do payload.
 */
export function resolverUrlInternaDoEnvelope(dados, { origin, appEntry }) {
  if (!envelopeEscalaIciReconhecido(dados)) {
    return null;
  }
  if (dados.diagnostico) {
    return new URL(`${appEntry}?pushDiagnostico=1`, origin);
  }
  if (!dados.trocaId) {
    return null;
  }
  return new URL(`${appEntry}?trocaId=${encodeURIComponent(dados.trocaId)}`, origin);
}

/**
 * Mensagem enviada à janela existente como reforço/fallback de
 * `WindowClient.navigate()` — o PWA já em execução aplica a mesma regra de
 * `?trocaId=`/`?pushDiagnostico=1` sem precisar de reload. Protocolo aceita
 * só `trocaId`/`diagnostico`, nunca URL arbitrária.
 */
export function construirMensagemCliqueParaJanela(dados) {
  if (!envelopeEscalaIciReconhecido(dados)) {
    return null;
  }
  if (dados.diagnostico) {
    return { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, diagnostico: true };
  }
  if (!dados.trocaId) {
    return null;
  }
  return { type: TIPO_MENSAGEM_CLIQUE_NOTIFICACAO, trocaId: dados.trocaId };
}

/**
 * Abre ou foca a janela de destino. Cada etapa (`navigate`/`postMessage`/
 * `focus`) tem seu próprio try/catch — uma falha isolada nunca impede as
 * demais (achado real: uma versão anterior deixava `focus()` sem proteção
 * própria e, se ele lançasse depois de `navigate()` falhar, a promessa
 * inteira rejeitava sem nunca abrir nada). Só cai para `openWindow()` se
 * NENHUMA das três estratégias teve efeito sobre a janela existente — não
 * basta `navigate()` ter falhado, nem basta `focus()` ter funcionado
 * sozinho sem garantir que a intenção de navegação chegou ao app.
 */
export async function executarAberturaDeJanela({ cliente, url, mensagem, abrirNovaJanela }) {
  if (!cliente) {
    await abrirNovaJanela(url);
    return { estrategia: 'openWindow-sem-cliente', navegou: false, mensagemEnviada: false, focou: false };
  }

  let navegou = false;
  if (typeof cliente.navigate === 'function') {
    try {
      await cliente.navigate(url);
      navegou = true;
    } catch {
      navegou = false;
    }
  }

  let mensagemEnviada = false;
  if (mensagem !== null && typeof cliente.postMessage === 'function') {
    try {
      cliente.postMessage(mensagem);
      mensagemEnviada = true;
    } catch {
      mensagemEnviada = false;
    }
  }

  let focou = false;
  if (typeof cliente.focus === 'function') {
    try {
      await cliente.focus();
      focou = true;
    } catch {
      focou = false;
    }
  }

  if (navegou || mensagemEnviada || focou) {
    return { estrategia: 'janela-existente', navegou, mensagemEnviada, focou };
  }

  await abrirNovaJanela(url);
  return { estrategia: 'openWindow-fallback', navegou: false, mensagemEnviada: false, focou: false };
}

/**
 * Orquestra o clique reconhecido de ponta a ponta — só chamada depois que
 * `envelopeEscalaIciReconhecido` já validou o envelope de forma síncrona
 * (no listener de `notificationclick`, antes de qualquer `await`, para que
 * `stopImmediatePropagation()` tenha efeito real sobre o listener do SDK
 * do Firebase, registrado depois do nosso).
 */
export async function processarAberturaClique(dados, { origin, appEntry, listarClientes, abrirNovaJanela }) {
  const url = resolverUrlInternaDoEnvelope(dados, { origin, appEntry });
  if (url === null) {
    return { aberto: false, motivo: 'sem-destino' };
  }
  const mensagem = construirMensagemCliqueParaJanela(dados);
  const clientes = await listarClientes();
  const cliente = clientes.find((candidato) => new URL(candidato.url).origin === url.origin) ?? null;
  const resultado = await executarAberturaDeJanela({ cliente, url: url.href, mensagem, abrirNovaJanela });
  return { aberto: true, url: url.href, ...resultado };
}

/**
 * Handler de `onBackgroundMessage` — retorna (nunca `void`) a Promise de
 * `exibirNotificacao`, para que `onPush()` do SDK (que faz `await
 * messaging.onBackgroundMessageHandler(payload)` dentro do próprio
 * `event.waitUntil()`) só resolva depois que a notificação, com seus
 * dados, estiver de fato registrada — nunca antes.
 */
export function processarMensagemEmSegundoPlano(payload, { exibirNotificacao }) {
  const dados = payload && payload.data;
  if (!dados) {
    return Promise.resolve();
  }
  return exibirNotificacao({
    titulo: dados.titulo,
    corpo: dados.corpo,
    dados: construirEnvelopeTroca(dados),
  });
}
