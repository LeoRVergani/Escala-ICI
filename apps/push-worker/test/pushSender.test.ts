import type { Messaging } from 'firebase-admin/messaging';
import { describe, expect, it, vi } from 'vitest';
import { buildMessage, sendToDevices } from '../src/pushSender.js';
import type { NotificacaoTroca } from '../src/types.js';

const notificacao: NotificacaoTroca = {
  id: 'notif-1',
  destinatarioLogin: 'lvergani',
  equipeId: 'equipe-1',
  tipo: 'TROCA_APROVADA_PUBLICADA',
  titulo: 'Troca aprovada',
  mensagem: 'Sua troca foi aprovada.',
  trocaId: 'troca-1',
  criadoPorLogin: 'gestor.login',
  criadoEm: '2026-08-05T10:00:00.000Z',
  lidaEm: null,
  acao: 'ABRIR_TROCA',
};

function criarMessagingFake(sendEachForMulticast: Messaging['sendEachForMulticast']): Messaging {
  return { sendEachForMulticast } as unknown as Messaging;
}

describe('buildMessage', () => {
  it('inclui eventId/trocaId/tipo/route nos dados e mantém notification curta', () => {
    const mensagem = buildMessage(notificacao, ['tok-1']);
    expect(mensagem.tokens).toEqual(['tok-1']);
    expect(mensagem.notification).toEqual({ title: 'Troca aprovada', body: 'Sua troca foi aprovada.' });
    expect(mensagem.data).toEqual({
      eventId: 'notif-1',
      trocaId: 'troca-1',
      tipo: 'TROCA_APROVADA_PUBLICADA',
      route: 'trocas/detalhe',
    });
    expect(mensagem.android?.priority).toBe('normal');
    expect(mensagem.android?.notification?.channelId).toBe('trocas_escala');
  });
});

describe('sendToDevices', () => {
  it('envia com sucesso para um único dispositivo', async () => {
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
    const messaging = criarMessagingFake(sendEachForMulticast);

    const resultado = await sendToDevices(messaging, buildMessage(notificacao, ['tok-1']));

    expect(resultado).toEqual({ successCount: 1, failureCount: 0, responses: [{ success: true, errorCode: null }] });
  });

  it('trata multicast para dois dispositivos', async () => {
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });
    const messaging = criarMessagingFake(sendEachForMulticast);

    const resultado = await sendToDevices(messaging, buildMessage(notificacao, ['tok-1', 'tok-2']));

    expect(resultado.successCount).toBe(2);
    expect(resultado.responses).toHaveLength(2);
  });

  it('reporta sucesso parcial: 1 sucesso + 1 token inválido, sem invalidar o lote inteiro', async () => {
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });
    const messaging = criarMessagingFake(sendEachForMulticast);

    const resultado = await sendToDevices(messaging, buildMessage(notificacao, ['tok-1', 'tok-2']));

    expect(resultado.successCount).toBe(1);
    expect(resultado.failureCount).toBe(1);
    expect(resultado.responses[1]).toEqual({ success: false, errorCode: 'messaging/registration-token-not-registered' });
  });

  it('reporta falha total sem lançar exceção', async () => {
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
        { success: false, error: { code: 'messaging/internal-error' } },
      ],
    });
    const messaging = criarMessagingFake(sendEachForMulticast);

    const resultado = await sendToDevices(messaging, buildMessage(notificacao, ['tok-1', 'tok-2']));

    expect(resultado.successCount).toBe(0);
    expect(resultado.failureCount).toBe(2);
  });
});
