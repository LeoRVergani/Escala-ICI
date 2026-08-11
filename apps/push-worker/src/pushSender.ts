import type { FidMulticastMessage, Messaging } from 'firebase-admin/messaging';
import type { NotificacaoTroca, TipoNotificacaoTroca } from './types.js';

/** Push é aviso, não fonte da verdade — TTL curto; se a pessoa abrir depois, o Firestore sincroniza o estado real. */
const TTL_MS = 24 * 60 * 60 * 1000;

const ROTA_DETALHE_TROCA = 'trocas/detalhe';

/**
 * Código de erro do FCM (Admin SDK) que indica um Firebase Installation ID
 * (FID) definitivamente inválido/não registrado — nunca vale retentar, o
 * dispositivo deve ser desativado. Confirmado lendo
 * `node_modules/firebase-admin/lib/messaging/error.js` (14.2.0): o servidor
 * FCM retorna o código canônico `UNREGISTERED_FID` para um FID não
 * registrado, que o Admin SDK mapeia para `MessagingErrorCode.INSTALLATION_ID_NOT_REGISTERED`
 * (`'installation-id-not-registered'`), exposto ao cliente com o prefixo
 * `messaging/` (mesmo mecanismo do antigo `messaging/registration-token-not-registered`,
 * só que com um código próprio para FID — não é o mesmo string). Não há,
 * nesta versão do SDK, um código específico de "FID malformado" análogo ao
 * antigo `messaging/invalid-registration-token`; um FID com formato
 * inválido cai no genérico `messaging/invalid-argument`, que não é
 * exclusivo de dispositivo (pode indicar erro no restante do payload) —
 * por isso não é tratado aqui como desativação definitiva.
 */
export const CODIGOS_FID_INVALIDO = new Set(['messaging/installation-id-not-registered']);

const TEXTOS_PADRAO: Record<TipoNotificacaoTroca, { titulo: string; corpo: string }> = {
  TROCA_SOLICITADA: { titulo: 'Nova solicitação de troca', corpo: 'Você recebeu uma solicitação de troca de escala.' },
  TROCA_RECUSADA_USUARIO: { titulo: 'Troca recusada', corpo: 'Sua solicitação de troca foi recusada.' },
  TROCA_ACEITA_AGUARDANDO_GESTOR: { titulo: 'Troca aceita', corpo: 'Sua solicitação foi aceita e aguarda o gestor.' },
  TROCA_RECUSADA_GESTOR: { titulo: 'Troca recusada pelo gestor', corpo: 'O gestor recusou a troca de escala.' },
  TROCA_APROVADA_PUBLICADA: { titulo: 'Troca aprovada', corpo: 'Sua troca foi aprovada. Abra o app para ver a escala atualizada.' },
  TROCA_CANCELADA: { titulo: 'Troca cancelada', corpo: 'A solicitação de troca foi cancelada.' },
};

/**
 * Monta o payload FCM — **só `data`, nunca `notification` no nível
 * superior** (decisão da auditoria PUSH-PWA-1.1, ver
 * `CHECKPOINT-FASE-PUSH-PWA-1.md`). Motivo: a documentação oficial do FCM
 * Web confirma que um payload com `notification` faz o SDK/navegador
 * exibir a notificação automaticamente — se o service worker (que agora
 * integra `firebase/messaging/sw` para renovação de FID via
 * `pushsubscriptionchange`) também chamar `showNotification()` em
 * `onBackgroundMessage`, o mesmo evento apareceria duplicado. Indo
 * só-`data`, o único código que chama `showNotification()` é o
 * `onBackgroundMessage` do PWA (`apps/app/src/sw/serviceWorker.js`), que
 * também dá controle total sobre ícone/badge — impossível com a exibição
 * automática do SDK. `titulo`/`corpo` viajam como campos de `data`
 * (strings, como o restante do payload) para o worker/SW montar a
 * notificação com o mesmo conteúdo que antes vinha em `notification`.
 * Preserva `eventId`/`trocaId`/`tipo`/`route`. TTL de 24h. Usa
 * `FidMulticastMessage` (só `fids`, sem `tokens`).
 */
export function buildMessage(notificacao: NotificacaoTroca, fids: string[]): FidMulticastMessage {
  const padrao = TEXTOS_PADRAO[notificacao.tipo];
  return {
    fids,
    data: {
      eventId: notificacao.id,
      trocaId: notificacao.trocaId,
      tipo: notificacao.tipo,
      route: ROTA_DETALHE_TROCA,
      titulo: notificacao.titulo || padrao.titulo,
      corpo: notificacao.mensagem || padrao.corpo,
    },
    android: {
      priority: 'normal',
      ttl: TTL_MS,
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
 * Envia via `sendEachForMulticast` — mesmo método do Admin SDK usado para
 * tokens, agora chamado com a sobrecarga que recebe `FidMulticastMessage`
 * (confirmada em `messaging.d.ts`: `sendEachForMulticast(message:
 * FidMulticastMessage, dryRun?: boolean): Promise<BatchResponse>`, até 500
 * FIDs por lote). A resposta tem o mesmo formato (`BatchResponse`/
 * `SendResponse`) e a mesma correspondência posicional entre cada entrada
 * de `fids` e `responses[i]` que o caminho de tokens sempre teve — nenhuma
 * mudança de contrato para quem consome `ResultadoEnvio`. Falhas por FID
 * são reportadas individualmente; uma falha nunca invalida o envio aos
 * demais dispositivos.
 */
export async function sendToDevices(messaging: Messaging, message: FidMulticastMessage): Promise<ResultadoEnvio> {
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
