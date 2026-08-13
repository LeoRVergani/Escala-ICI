/**
 * Adapter dedicado ao Firebase Cloud Messaging Web (Fase PUSH-PWA-1) — só
 * Firebase Installation ID (FID), nunca registration token. Migração
 * confirmada lendo os `.d.ts` reais instalados (`firebase@12.17.1`,
 * `@firebase/messaging@0.13.1`): `getToken`/`deleteToken` estão
 * `@deprecated` em favor de `register`/`onRegistered`/`unregister`/
 * `onUnregistered` — este módulo nunca chama os dois primeiros.
 *
 * `register()` nunca devolve o FID no retorno — ele chega
 * assincronamente via `onRegistered`, por isso o observer é instalado
 * *antes* de chamar `register()` (senão a primeira entrega poderia ser
 * perdida). Toda dependência do navegador/SDK é injetável
 * (`PushMessagingDeps`) para os testes rodarem em `environment: 'node'`
 * sem `Notification`/`navigator.serviceWorker` reais.
 */
import type { FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  isSupported,
  onMessage as onMessageFirebase,
  onRegistered as onRegisteredFirebase,
  register as registerFirebase,
  unregister as unregisterFirebase,
  type Messaging,
  type MessagePayload,
  type Unsubscribe,
} from 'firebase/messaging';

import { obterFirebase, obterVapidKeyPublica, pushConfigurado } from './client';

export type EstadoPush =
  | 'NAO_CONFIGURADO'
  | 'NAO_SUPORTADO'
  | 'PERMISSAO_NAO_SOLICITADA'
  | 'PERMISSAO_NEGADA'
  | 'ATIVANDO'
  | 'ATIVO'
  | 'ERRO';

export interface ResultadoAtivacao {
  estado: EstadoPush;
  fid?: string;
  erro?: string;
}

export const PUSH_SW_STATUS_REQUEST = 'ESCALA_ICI_SW_STATUS';
export const PUSH_SW_STATUS_RESPONSE = 'ESCALA_ICI_SW_STATUS_RESULT';
export const PUSH_LOCAL_TEST_REQUEST = 'ESCALA_ICI_LOCAL_NOTIFICATION_TEST';
export const PUSH_LOCAL_TEST_RESPONSE = 'ESCALA_ICI_LOCAL_NOTIFICATION_TEST_RESULT';

export interface StatusServiceWorkerPush {
  controlador: boolean;
  versao: string | null;
  origem: string | null;
  consultadoEm: string;
  erro?: string;
}

export interface ResultadoTesteLocalPush {
  aceito: boolean;
  versao: string | null;
  consultadoEm: string;
  erro?: string;
}

type PortaMensagemPush = Pick<MessagePort, 'onmessage' | 'postMessage' | 'close'>;

interface CanalMensagemPush {
  port1: PortaMensagemPush;
  port2: PortaMensagemPush;
}

export interface PushServiceWorkerDiagnosticsDeps {
  controller: () => Pick<ServiceWorker, 'postMessage'> | null;
  criarCanal: () => CanalMensagemPush;
  setTimeout: (callback: () => void, timeoutMs: number) => unknown;
  clearTimeout: (id: unknown) => void;
  agora: () => string;
}

function depsDiagnosticoPadrao(): PushServiceWorkerDiagnosticsDeps {
  return {
    controller: () => (typeof navigator === 'undefined' || !('serviceWorker' in navigator)
      ? null
      : navigator.serviceWorker.controller),
    criarCanal: () => new MessageChannel(),
    setTimeout: (callback, timeoutMs) => window.setTimeout(callback, timeoutMs),
    clearTimeout: (id) => window.clearTimeout(id as number),
    agora: () => new Date().toISOString(),
  };
}

/**
 * Tudo que este módulo precisa do navegador/SDK, isolado para injeção em
 * teste. As implementações padrão (abaixo) são as reais; um teste passa um
 * subconjunto — só o que o cenário exercita.
 */
export interface PushMessagingDeps {
  isSupported: () => Promise<boolean>;
  getMessaging: (app: FirebaseApp) => Messaging;
  register: (messaging: Messaging, options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }) => Promise<void>;
  unregister: (messaging: Messaging) => Promise<void>;
  onRegistered: (messaging: Messaging, callback: (fid: string) => void) => Unsubscribe;
  onMessage: (messaging: Messaging, callback: (payload: MessagePayload) => void) => Unsubscribe;
  requestPermission: () => Promise<NotificationPermission>;
  permissaoAtual: () => NotificationPermission;
  notificationDisponivel: () => boolean;
  serviceWorkerReady: () => Promise<ServiceWorkerRegistration>;
}

function permissaoAtualPadrao(): NotificationPermission {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission;
}

export const dependenciasPadrao: PushMessagingDeps = {
  isSupported: () => isSupported().catch(() => false),
  getMessaging,
  register: (messaging, options) => registerFirebase(messaging, options),
  unregister: (messaging) => unregisterFirebase(messaging),
  onRegistered: (messaging, callback) => onRegisteredFirebase(messaging, callback),
  onMessage: (messaging, callback) => onMessageFirebase(messaging, callback),
  requestPermission: () => Notification.requestPermission(),
  permissaoAtual: permissaoAtualPadrao,
  notificationDisponivel: () => typeof Notification !== 'undefined',
  serviceWorkerReady: () => navigator.serviceWorker.ready,
};

/**
 * Só usado para evitar dois `register()` concorrentes (clique duplo, dois
 * componentes montando em React StrictMode). Não é cache do resultado —
 * cada chamada nova, depois que a anterior termina, reavalia tudo de novo.
 */
let operacaoEmAndamento: Promise<ResultadoAtivacao> | null = null;

const TEMPO_LIMITE_REGISTRO_MS = 15_000;

/**
 * Fluxo completo de ativação: suporte → HTTPS/ambiente (via
 * `pushConfigurado()`) → permissão (só pede se `default`, nunca se já
 * `denied`) → `register()` com `onRegistered` já instalado. Nunca lança —
 * todo caminho de falha volta como `{ estado, erro }`, nunca imprime o FID
 * (só o devolve para quem chamou persistir).
 */
export async function ativarPush(deps: PushMessagingDeps = dependenciasPadrao): Promise<ResultadoAtivacao> {
  if (operacaoEmAndamento) {
    return operacaoEmAndamento;
  }
  const execucao = executarAtivacao(deps);
  operacaoEmAndamento = execucao;
  try {
    return await execucao;
  } finally {
    operacaoEmAndamento = null;
  }
}

async function executarAtivacao(deps: PushMessagingDeps): Promise<ResultadoAtivacao> {
  if (!pushConfigurado()) {
    return { estado: 'NAO_CONFIGURADO' };
  }

  if (!deps.notificationDisponivel()) {
    return { estado: 'NAO_SUPORTADO' };
  }

  const suportado = await deps.isSupported();
  if (!suportado) {
    return { estado: 'NAO_SUPORTADO' };
  }

  const permissaoJaConcedida = deps.permissaoAtual();
  if (permissaoJaConcedida === 'denied') {
    return { estado: 'PERMISSAO_NEGADA' };
  }

  // Nunca chama `requestPermission()` quando a permissão já é conhecida
  // (auditoria PUSH-PWA-1.1) — cobre tanto o clique manual (`granted` só
  // depois da concessão) quanto a retomada automática no recarregamento
  // (permissão já `granted` de uma adesão anterior): o navegador nunca
  // mostra prompt de novo nesse caso, mas o código evita até a chamada.
  let permissao: NotificationPermission = permissaoJaConcedida;
  if (permissaoJaConcedida === 'default') {
    try {
      permissao = await deps.requestPermission();
    } catch (falha) {
      return { estado: 'ERRO', erro: mensagemErro(falha) };
    }
  }
  if (permissao !== 'granted') {
    return { estado: 'PERMISSAO_NEGADA' };
  }

  const firebase = obterFirebase();
  const vapidKey = obterVapidKeyPublica();
  if (firebase === null || !vapidKey) {
    return { estado: 'NAO_CONFIGURADO' };
  }

  try {
    const serviceWorkerRegistration = await deps.serviceWorkerReady();
    const messaging = deps.getMessaging(firebase.app);

    const fid = await new Promise<string>((resolve, reject) => {
      let liquidado = false;
      const temporizador = setTimeout(() => {
        if (!liquidado) {
          liquidado = true;
          desinscrever();
          reject(new Error('Tempo esgotado aguardando o registro do dispositivo.'));
        }
      }, TEMPO_LIMITE_REGISTRO_MS);

      const desinscrever = deps.onRegistered(messaging, (fidRecebido) => {
        if (liquidado) {
          return;
        }
        liquidado = true;
        clearTimeout(temporizador);
        desinscrever();
        resolve(fidRecebido);
      });

      deps.register(messaging, { vapidKey, serviceWorkerRegistration }).catch((falha: unknown) => {
        if (liquidado) {
          return;
        }
        liquidado = true;
        clearTimeout(temporizador);
        desinscrever();
        reject(falha instanceof Error ? falha : new Error(String(falha)));
      });
    });

    return { estado: 'ATIVO', fid };
  } catch (falha) {
    return { estado: 'ERRO', erro: mensagemErro(falha) };
  }
}

/** Nunca inclui o FID na mensagem — só o texto do erro do SDK/navegador. */
function mensagemErro(falha: unknown): string {
  return falha instanceof Error ? falha.message : 'Não foi possível ativar as notificações.';
}

/** Checagem de suporte sem pedir permissão nem registrar nada — segura para chamar ao só exibir a tela. */
export async function avaliarSuporte(deps: PushMessagingDeps = dependenciasPadrao): Promise<boolean> {
  if (!deps.notificationDisponivel()) {
    return false;
  }
  return deps.isSupported();
}

export type ResultadoRetomada = ResultadoAtivacao | { estado: 'NAO_ADERIU' };

export interface RetomarAutomaticoParams {
  /** `null` quando este login nunca aderiu neste navegador — nenhuma adesão anterior, nenhuma ação. */
  deviceIdExistente: string | null;
  /** `get` do documento conhecido — nunca `list`. */
  verificarDispositivoAtivo: (deviceId: string) => Promise<boolean>;
}

/**
 * Decisão pura e testável (auditoria PUSH-PWA-1.1, item 5 — "reabertura e
 * recarregamento") sobre retomar push automaticamente, extraída de
 * `EmployeeApp.tsx` para não depender de infraestrutura React nos testes.
 * Só chama `ativarPush()` (que, por sua vez, nunca chama
 * `requestPermission()` quando a permissão já é conhecida) quando **todas**
 * as condições de adesão anterior já confirmada se cumprem:
 *
 * - `Notification.permission` já `granted` (nunca solicitada aqui);
 * - existe um `deviceId` local para este login (adesão anterior neste
 *   navegador);
 * - o navegador ainda oferece suporte ao SDK;
 * - o documento correspondente ainda está `ativo` no Firestore (uma
 *   desativação feita por outro dispositivo/sessão nunca é revertida
 *   automaticamente).
 *
 * Qualquer condição faltando devolve `{ estado: 'NAO_ADERIU' }` sem pedir
 * permissão nem chamar `register()` — cobre exatamente "usuário sem
 * adesão anterior não registra no carregamento".
 */
export async function retomarPushSeAderido(
  params: RetomarAutomaticoParams,
  deps: PushMessagingDeps = dependenciasPadrao,
): Promise<ResultadoRetomada> {
  if (!pushConfigurado()) {
    return { estado: 'NAO_CONFIGURADO' };
  }
  if (!deps.notificationDisponivel() || deps.permissaoAtual() !== 'granted') {
    return { estado: 'NAO_ADERIU' };
  }
  if (params.deviceIdExistente === null) {
    return { estado: 'NAO_ADERIU' };
  }
  const suportado = await deps.isSupported().catch(() => false);
  if (!suportado) {
    return { estado: 'NAO_ADERIU' };
  }
  const ativo = await params.verificarDispositivoAtivo(params.deviceIdExistente).catch(() => false);
  if (!ativo) {
    return { estado: 'NAO_ADERIU' };
  }
  return ativarPush(deps);
}

/**
 * Assinatura de longa duração para renovação de FID (`onRegistered`
 * disparado de novo por `pushsubscriptionchange` ou por uma nova chamada a
 * `register()` em outra aba) — separada do `Promise` de um-tiro usado
 * dentro de `ativarPush`, que se desinscreve após o primeiro FID. Só deve
 * ficar ativa enquanto o dispositivo já está `ATIVO`.
 */
export function assinarRenovacaoFid(
  aoRenovar: (fid: string) => void,
  deps: PushMessagingDeps = dependenciasPadrao,
): Unsubscribe | null {
  const firebase = obterFirebase();
  if (firebase === null) {
    return null;
  }
  const messaging = deps.getMessaging(firebase.app);
  return deps.onRegistered(messaging, aoRenovar);
}

/**
 * Reparo de uma instalação com registro "zumbi" (documento `ativo: true`
 * mas FID inválido/obsoleto — ver `obterStatusDispositivo`). Força o
 * `unregister()` oficial do FCM antes de renovar, para não depender de o
 * navegador emitir `pushsubscriptionchange` sozinho; a renovação em si
 * reusa `ativarPush()` (mesma ordem onRegistered→register, mesmo
 * `deviceId`, nunca pede permissão de novo pois já está `granted`). Melhor
 * esforço no `unregister()`: se não houver nada para desfazer, a renovação
 * a seguir ainda funciona normalmente.
 */
export async function repararPush(deps: PushMessagingDeps = dependenciasPadrao): Promise<ResultadoAtivacao> {
  const firebase = obterFirebase();
  if (firebase === null) {
    return { estado: 'NAO_CONFIGURADO' };
  }
  const suportado = await deps.isSupported().catch(() => false);
  if (suportado) {
    try {
      const messaging = deps.getMessaging(firebase.app);
      await deps.unregister(messaging);
    } catch {
      // Nada para desfazer, ou falha ao desfazer — a renovação abaixo ainda
      // pode funcionar mesmo assim.
    }
  }
  return ativarPush(deps);
}

const TEMPO_LIMITE_DIAGNOSTICO_SW_MS = 4_000;

async function enviarMensagemAoServiceWorker<T>(
  tipo: string,
  deps: PushServiceWorkerDiagnosticsDeps,
  timeoutMs = TEMPO_LIMITE_DIAGNOSTICO_SW_MS,
): Promise<T> {
  const controller = deps.controller();
  if (controller === null) {
    throw new Error('Nenhum service worker está controlando esta página.');
  }

  const canal = deps.criarCanal();
  return new Promise<T>((resolve, reject) => {
    let liquidado = false;
    const encerrar = (fn: () => void) => {
      if (liquidado) {
        return;
      }
      liquidado = true;
      deps.clearTimeout(temporizador);
      canal.port1.close();
      fn();
    };
    const temporizador = deps.setTimeout(() => {
      encerrar(() => reject(new Error('Tempo esgotado aguardando resposta do service worker.')));
    }, timeoutMs);

    canal.port1.onmessage = (event: MessageEvent) => {
      encerrar(() => resolve(event.data as T));
    };

    try {
      controller.postMessage({ type: tipo }, [canal.port2 as MessagePort]);
    } catch (falha) {
      encerrar(() => reject(falha instanceof Error ? falha : new Error(String(falha))));
    }
  });
}

export async function consultarServiceWorkerPush(
  deps: PushServiceWorkerDiagnosticsDeps = depsDiagnosticoPadrao(),
): Promise<StatusServiceWorkerPush> {
  const consultadoEm = deps.agora();
  if (deps.controller() === null) {
    return {
      controlador: false,
      versao: null,
      origem: null,
      consultadoEm,
      erro: 'Nenhum service worker está controlando esta página.',
    };
  }

  try {
    const resposta = await enviarMensagemAoServiceWorker<{
      ok?: boolean;
      version?: unknown;
      origin?: unknown;
      checkedAt?: unknown;
      error?: unknown;
    }>(PUSH_SW_STATUS_REQUEST, deps);
    if (resposta.ok !== true) {
      return {
        controlador: true,
        versao: null,
        origem: null,
        consultadoEm,
        erro: typeof resposta.error === 'string' ? resposta.error : 'Service worker não confirmou o diagnóstico.',
      };
    }
    return {
      controlador: true,
      versao: typeof resposta.version === 'string' ? resposta.version : null,
      origem: typeof resposta.origin === 'string' ? resposta.origin : null,
      consultadoEm: typeof resposta.checkedAt === 'string' ? resposta.checkedAt : consultadoEm,
    };
  } catch (falha) {
    return {
      controlador: true,
      versao: null,
      origem: null,
      consultadoEm,
      erro: mensagemErro(falha),
    };
  }
}

export async function testarNotificacaoLocalPush(
  deps: PushServiceWorkerDiagnosticsDeps = depsDiagnosticoPadrao(),
): Promise<ResultadoTesteLocalPush> {
  const consultadoEm = deps.agora();
  try {
    const resposta = await enviarMensagemAoServiceWorker<{
      ok?: boolean;
      version?: unknown;
      checkedAt?: unknown;
      error?: unknown;
    }>(PUSH_LOCAL_TEST_REQUEST, deps);
    if (resposta.ok !== true) {
      return {
        aceito: false,
        versao: typeof resposta.version === 'string' ? resposta.version : null,
        consultadoEm,
        erro: typeof resposta.error === 'string' ? resposta.error : 'Service worker não aceitou o teste local.',
      };
    }
    return {
      aceito: true,
      versao: typeof resposta.version === 'string' ? resposta.version : null,
      consultadoEm: typeof resposta.checkedAt === 'string' ? resposta.checkedAt : consultadoEm,
    };
  } catch (falha) {
    return {
      aceito: false,
      versao: null,
      consultadoEm,
      erro: mensagemErro(falha),
    };
  }
}

export async function desativarPush(deps: PushMessagingDeps = dependenciasPadrao): Promise<void> {
  const firebase = obterFirebase();
  if (firebase === null) {
    return;
  }
  const suportado = await deps.isSupported().catch(() => false);
  if (!suportado) {
    return;
  }
  const messaging = deps.getMessaging(firebase.app);
  await deps.unregister(messaging);
}

const TEMPO_LIMITE_LOGOUT_MS = 3_000;

export interface LimparPushAoSairParams {
  /** `null` quando este login nunca aderiu neste navegador — nada a desativar remotamente. */
  deviceIdExistente: string | null;
  desativarDispositivo: (deviceId: string) => Promise<void>;
  /** Só para teste — padrão 3s. */
  timeoutMs?: number;
}

/**
 * Orquestra a limpeza de push no logout (auditoria PUSH-PWA-1.1, item 6) —
 * extraída de `EmployeeApp.tsx` para ser testável sem React. Nunca lança,
 * nunca bloqueia por mais que `timeoutMs`: tenta `unregister()` e, se
 * havia um `deviceId` local, `desativarDispositivo()` (`ativo: false` —
 * nunca apaga o histórico do dispositivo). Quem chama decide se limpa o
 * `deviceId` local depois (`removerDeviceIdLocal`, fora deste módulo).
 */
export async function limparPushAoSair(
  params: LimparPushAoSairParams,
  deps: PushMessagingDeps = dependenciasPadrao,
): Promise<void> {
  const limpeza = (async () => {
    await desativarPush(deps).catch(() => {});
    if (params.deviceIdExistente !== null) {
      await params.desativarDispositivo(params.deviceIdExistente).catch(() => {});
    }
  })();
  const tempoLimite = new Promise<void>((resolve) => {
    setTimeout(resolve, params.timeoutMs ?? TEMPO_LIMITE_LOGOUT_MS);
  });
  await Promise.race([limpeza, tempoLimite]).catch(() => {});
}

/**
 * Avisa sobre mensagem recebida em foreground — quem chama decide o que
 * fazer (o Firestore em tempo real já é a fonte da verdade; este canal só
 * sinaliza, nunca substitui). Nunca loga o payload inteiro.
 */
export function assinarMensagensEmPrimeiroPlano(
  aoReceber: (payload: MessagePayload) => void,
  deps: PushMessagingDeps = dependenciasPadrao,
): Unsubscribe | null {
  const firebase = obterFirebase();
  if (firebase === null) {
    return null;
  }
  const messaging = deps.getMessaging(firebase.app);
  return deps.onMessage(messaging, aoReceber);
}
