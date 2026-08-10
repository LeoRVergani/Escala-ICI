import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { claim, finalizeEnvio, markSemDispositivo } from './deliveryRepository.js';
import { deactivateDevice, listActiveDevices } from './deviceRepository.js';
import { buildMessage, CODIGOS_TOKEN_INVALIDO, sendToDevices, type RespostaEnvio } from './pushSender.js';
import type { PushWorkerConfig } from './config.js';
import type { NotificacaoTroca } from './types.js';

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface DeliveryDeps {
  db: Firestore;
  messaging: Messaging;
  config: PushWorkerConfig;
  logger?: Logger;
}

export type ResultadoProcessamento =
  | { outcome: 'ignorado-pre-ativacao' }
  | { outcome: 'ignorado-ja-lido' }
  | { outcome: 'ignorado-push-desabilitado' }
  | { outcome: 'nao-reclamado'; motivo: 'ja-enviado' | 'lease-em-vigor' }
  | { outcome: 'sem-dispositivo' }
  | { outcome: 'enviado'; successCount: number; failureCount: number }
  | { outcome: 'erro'; status: 'ERRO_RETRY' | 'ERRO_FINAL'; successCount: number; failureCount: number };

const logConsole: Logger = {
  info: (message, meta) => console.info(message, meta ?? {}),
  warn: (message, meta) => console.warn(message, meta ?? {}),
  error: (message, meta) => console.error(message, meta ?? {}),
};

/**
 * Pipeline completo para uma notificação: filtros pré-claim (ativação,
 * já-lida, kill switch) → claim idempotente/com lease → busca de
 * dispositivos → envio multicast → desativação de tokens inválidos →
 * finalização do registro técnico. Nunca loga token, e-mail completo ou
 * conteúdo de credencial — apenas `eventId`, `tipo`, `destinatarioLogin`
 * (login corporativo, não e-mail) e contadores/códigos de erro.
 */
export async function handleNotificacao(
  notificacao: NotificacaoTroca,
  deps: DeliveryDeps,
): Promise<ResultadoProcessamento> {
  const { db, messaging, config } = deps;
  const logger = deps.logger ?? logConsole;
  const contexto = { eventId: notificacao.id, tipo: notificacao.tipo, destinatarioLogin: notificacao.destinatarioLogin };

  if (notificacao.criadoEm < config.pushActivatedAt) {
    logger.info('notificacao anterior a PUSH_ACTIVATED_AT ignorada', contexto);
    return { outcome: 'ignorado-pre-ativacao' };
  }

  if (notificacao.lidaEm !== null) {
    logger.info('notificacao já lida antes do processamento, push não enviado', contexto);
    return { outcome: 'ignorado-ja-lido' };
  }

  if (!config.pushEnabled) {
    logger.info('PUSH_ENABLED=false, nenhum envio realizado', contexto);
    return { outcome: 'ignorado-push-desabilitado' };
  }

  const resultadoClaim = await claim(db, notificacao, {
    workerId: config.workerId,
    leaseDurationMs: config.leaseDurationMs,
  });
  if (!resultadoClaim.claimed) {
    logger.info('claim recusado', { ...contexto, motivo: resultadoClaim.reason });
    return { outcome: 'nao-reclamado', motivo: resultadoClaim.reason };
  }

  const dispositivos = await listActiveDevices(db, notificacao.destinatarioLogin);
  if (dispositivos.length === 0) {
    await markSemDispositivo(db, notificacao.id);
    logger.info('sem dispositivo ativo para o destinatário', contexto);
    return { outcome: 'sem-dispositivo' };
  }

  const mensagem = buildMessage(notificacao, dispositivos.map((dispositivo) => dispositivo.token));
  const resultado = await sendToDevices(messaging, mensagem);

  await Promise.all(
    resultado.responses.map((resposta, index) => {
      const dispositivo = dispositivos[index];
      if (dispositivo && !resposta.success && ehTokenInvalido(resposta)) {
        return deactivateDevice(db, dispositivo.deviceId);
      }
      return undefined;
    }),
  );

  const status = resolverStatusFinal(resultado.responses, resultado.successCount);
  const erroCodigo = resultado.responses.find((resposta) => !resposta.success)?.errorCode ?? null;

  await finalizeEnvio(db, notificacao.id, {
    status,
    successCount: resultado.successCount,
    failureCount: resultado.failureCount,
    erroCodigo,
  });

  logger.info('processamento concluído', {
    ...contexto,
    devicesFound: dispositivos.length,
    successCount: resultado.successCount,
    failureCount: resultado.failureCount,
    status,
  });

  if (status === 'ENVIADO') {
    return { outcome: 'enviado', successCount: resultado.successCount, failureCount: resultado.failureCount };
  }
  return { outcome: 'erro', status, successCount: resultado.successCount, failureCount: resultado.failureCount };
}

function ehTokenInvalido(resposta: RespostaEnvio): boolean {
  return resposta.errorCode !== null && CODIGOS_TOKEN_INVALIDO.has(resposta.errorCode);
}

function resolverStatusFinal(respostas: RespostaEnvio[], successCount: number): 'ENVIADO' | 'ERRO_RETRY' | 'ERRO_FINAL' {
  if (successCount > 0) {
    return 'ENVIADO';
  }
  const todasPermanentes = respostas.every((resposta) => resposta.success || ehTokenInvalido(resposta));
  return todasPermanentes ? 'ERRO_FINAL' : 'ERRO_RETRY';
}
