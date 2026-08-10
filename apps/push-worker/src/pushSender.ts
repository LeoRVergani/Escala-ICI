import type { Messaging, MulticastMessage } from 'firebase-admin/messaging';
import type { NotificacaoTroca, TipoNotificacaoTroca } from './types.js';

/** Push é aviso, não fonte da verdade — TTL curto; se a pessoa abrir depois, o Firestore sincroniza o estado real. */
const TTL_MS = 24 * 60 * 60 * 1000;

const CANAL_TROCAS_ESCALA = 'trocas_escala';
const ROTA_DETALHE_TROCA = 'trocas/detalhe';

/** Códigos de erro do FCM (Admin SDK) que indicam token permanentemente inválido — nunca vale retentar, o dispositivo deve ser desativado. */
export const CODIGOS_TOKEN_INVALIDO = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const TEXTOS_PADRAO: Record<TipoNotificacaoTroca, { titulo: string; corpo: string }> = {
  TROCA_SOLICITADA: { titulo: 'Nova solicitação de troca', corpo: 'Você recebeu uma solicitação de troca de escala.' },
  TROCA_RECUSADA_USUARIO: { titulo: 'Troca recusada', corpo: 'Sua solicitação de troca foi recusada.' },
  TROCA_ACEITA_AGUARDANDO_GESTOR: { titulo: 'Troca aceita', corpo: 'Sua solicitação foi aceita e aguarda o gestor.' },
  TROCA_RECUSADA_GESTOR: { titulo: 'Troca recusada pelo gestor', corpo: 'O gestor recusou a troca de escala.' },
  TROCA_APROVADA_PUBLICADA: { titulo: 'Troca aprovada', corpo: 'Sua troca foi aprovada. Abra o app para ver a escala atualizada.' },
  TROCA_CANCELADA: { titulo: 'Troca cancelada', corpo: 'A solicitação de troca foi cancelada.' },
};

/**
 * Monta o payload FCM: `notification` curto (seguro para lockscreen, sem
 * dados de escala) + `data` com o mínimo necessário para o Android
 * deduplicar (`eventId`) e navegar (`route`/`trocaId`). Prioridade normal
 * (nunca alta/alarme) e TTL de 24h.
 */
export function buildMessage(notificacao: NotificacaoTroca, tokens: string[]): MulticastMessage {
  const padrao = TEXTOS_PADRAO[notificacao.tipo];
  return {
    tokens,
    notification: {
      title: notificacao.titulo || padrao.titulo,
      body: notificacao.mensagem || padrao.corpo,
    },
    data: {
      eventId: notificacao.id,
      trocaId: notificacao.trocaId,
      tipo: notificacao.tipo,
      route: ROTA_DETALHE_TROCA,
    },
    android: {
      priority: 'normal',
      ttl: TTL_MS,
      notification: {
        channelId: CANAL_TROCAS_ESCALA,
      },
    },
  };
}

export interface RespostaEnvio {
  success: boolean;
  errorCode: string | null;
}

export interface ResultadoEnvio {
  successCount: number;
  failureCount: number;
  responses: RespostaEnvio[];
}

/**
 * Envia via `sendEachForMulticast` — API atual e não obsoleta do Admin SDK
 * (`sendMulticast`/`sendAll` não existem mais em firebase-admin 14.x; o
 * campo `tokens` de `MulticastMessage` está marcado `@deprecated` em favor
 * de FIDs, mas ainda é a via suportada para tokens de registro clássicos,
 * que é o que o Android SDK atual do EscalaSOC produzirá — ver seção 15 do
 * pedido original, migração para FIDs é pendência futura documentada, não
 * bloqueia esta fase). Falhas por token são reportadas individualmente;
 * uma falha nunca invalida o envio aos demais dispositivos.
 */
export async function sendToDevices(messaging: Messaging, message: MulticastMessage): Promise<ResultadoEnvio> {
  const resultado = await messaging.sendEachForMulticast(message);
  return {
    successCount: resultado.successCount,
    failureCount: resultado.failureCount,
    responses: resultado.responses.map((resposta) => ({
      success: resposta.success,
      errorCode: resposta.error?.code ?? null,
    })),
  };
}
