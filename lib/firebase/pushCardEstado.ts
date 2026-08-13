/**
 * Decisões puras do card "Notificações" (Fase PUSH-PWA-2B.1) — extraídas de
 * `EmployeeApp.tsx` para serem testáveis sem React/DOM (o projeto não tem
 * ambiente de teste com DOM configurado para `apps/app/src`). Nenhuma
 * função aqui toca Firestore, `localStorage` ou o SDK do FCM.
 */
import type { StatusDispositivoPush } from './pushDeviceRepository';

export type EstadoCardDerivadoDeStatus = 'ATIVO' | 'PRECISA_REPARO' | 'DISPONIVEL';

/**
 * Traduz o status enriquecido do documento (`obterStatusDispositivo`) para
 * o estado do card. Nunca trata `PRECISA_REPARO` como `ATIVO` — essa é
 * exatamente a distinção que faltava antes da auditoria PUSH-PWA-2B.1 (um
 * documento com FID obsoleto não é uma instalação funcional).
 */
export function decidirEstadoCardPush(
  status: StatusDispositivoPush,
  messagingInicializado = true,
): EstadoCardDerivadoDeStatus {
  if (status === 'ATIVO') {
    return messagingInicializado ? 'ATIVO' : 'PRECISA_REPARO';
  }
  if (status === 'PRECISA_REPARO') {
    return 'PRECISA_REPARO';
  }
  return 'DISPONIVEL';
}

/**
 * Últimos 6 caracteres do `deviceId` — o suficiente para o usuário comparar
 * com um resumo sanitizado do Firestore durante um teste, sem expor o
 * identificador completo (que já não é sensível, mas não há motivo para
 * mostrá-lo inteiro na UI).
 */
export function identificadorDispositivoAbreviado(deviceId: string | null): string | null {
  if (deviceId === null || deviceId.trim().length < 6) {
    return null;
  }
  return deviceId.slice(-6);
}

const JANELA_CONFIRMACAO_RECENTE_MS = 5 * 60 * 1000;

/** Rótulo relativo — nunca expõe o timestamp bruto na UI. */
export function rotuloConfirmacaoPush(ultimaConfirmacaoEm: string | null, agora: number = Date.now()): string | null {
  if (ultimaConfirmacaoEm === null) {
    return null;
  }
  const instante = Date.parse(ultimaConfirmacaoEm);
  if (Number.isNaN(instante)) {
    return null;
  }
  return agora - instante < JANELA_CONFIRMACAO_RECENTE_MS ? 'Confirmado agora' : 'Confirmado recentemente';
}
