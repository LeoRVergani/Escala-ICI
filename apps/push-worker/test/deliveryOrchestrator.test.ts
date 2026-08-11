import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { handleNotificacao, type Logger } from '../src/deliveryOrchestrator.js';
import { listActiveDevices } from '../src/deviceRepository.js';
import type { NotificacaoTroca } from '../src/types.js';
import { FirestoreFake } from './_fakes/firestoreFake.js';

const baseEnv = {
  FIREBASE_PROJECT_ID: 'escala-ici-staging',
  PUSH_ENVIRONMENT: 'staging',
  PUSH_ACTIVATED_AT: '2026-08-05T00:00:00.000Z',
  PUSH_ENABLED: 'true',
};

function notificacaoBase(overrides: Partial<NotificacaoTroca> = {}): NotificacaoTroca {
  return {
    id: 'notif-1',
    destinatarioLogin: 'lvergani',
    equipeId: 'equipe-1',
    tipo: 'TROCA_SOLICITADA',
    titulo: 'Nova solicitação de troca',
    mensagem: 'Você recebeu uma solicitação de troca de escala.',
    trocaId: 'troca-1',
    criadoPorLogin: 'outro.login',
    criadoEm: '2026-08-06T10:00:00.000Z',
    lidaEm: null,
    acao: 'ABRIR_TROCA',
    ...overrides,
  };
}

function criarAmbiente() {
  const fake = new FirestoreFake();
  const db = fake as unknown as Firestore;
  const config = loadConfig(baseEnv);
  return { fake, db, config };
}

function criarMessaging(resposta: unknown): { messaging: Messaging; sendEachForMulticast: ReturnType<typeof vi.fn> } {
  const sendEachForMulticast = vi.fn().mockResolvedValue(resposta);
  return { messaging: { sendEachForMulticast } as unknown as Messaging, sendEachForMulticast };
}

describe('handleNotificacao — multicast por FID', () => {
  it('constrói a mensagem com os FIDs dos dispositivos ativos e nunca com tokens', async () => {
    const { fake, db, config } = criarAmbiente();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'WEB', fid: 'fid-b' });
    const { messaging, sendEachForMulticast } = criarMessaging({ successCount: 2, failureCount: 0, responses: [{ success: true }, { success: true }] });

    await handleNotificacao(notificacaoBase(), { db, messaging, config });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const mensagemEnviada = sendEachForMulticast.mock.calls[0]?.[0];
    expect(mensagemEnviada.fids).toEqual(['fid-a', 'fid-b']);
    expect('tokens' in mensagemEnviada).toBe(false);
  });

  it('sucesso parcial: desativa somente o dispositivo do FID inválido, o outro dispositivo do mesmo usuário continua ativo', async () => {
    const { fake, db, config } = criarAmbiente();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-b' });
    const { messaging } = criarMessaging({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/installation-id-not-registered' } },
      ],
    });

    const resultado = await handleNotificacao(notificacaoBase(), { db, messaging, config });

    expect(resultado).toEqual({ outcome: 'enviado', successCount: 1, failureCount: 1 });
    const restantes = await listActiveDevices(db, 'lvergani');
    expect(restantes.map((d) => d.deviceId)).toEqual(['dev-a']);
  });

  it('falha total com FIDs definitivamente inválidos: ERRO_FINAL e desativa todos os dispositivos correspondentes', async () => {
    const { fake, db, config } = criarAmbiente();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-b' });
    const { messaging } = criarMessaging({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/installation-id-not-registered' } },
        { success: false, error: { code: 'messaging/installation-id-not-registered' } },
      ],
    });

    const resultado = await handleNotificacao(notificacaoBase(), { db, messaging, config });

    expect(resultado).toEqual({ outcome: 'erro', status: 'ERRO_FINAL', successCount: 0, failureCount: 2 });
    const restantes = await listActiveDevices(db, 'lvergani');
    expect(restantes).toHaveLength(0);
  });

  it('falha total com erro transitório (não FID inválido): ERRO_RETRY e nenhum dispositivo é desativado', async () => {
    const { fake, db, config } = criarAmbiente();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-b' });
    const { messaging } = criarMessaging({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/internal-error' } },
      ],
    });

    const resultado = await handleNotificacao(notificacaoBase(), { db, messaging, config });

    expect(resultado).toEqual({ outcome: 'erro', status: 'ERRO_RETRY', successCount: 0, failureCount: 2 });
    const restantes = await listActiveDevices(db, 'lvergani');
    expect(restantes).toHaveLength(2);
  });

  it('nenhum log emitido durante o processamento contém o FID do dispositivo', async () => {
    const { fake, db, config } = criarAmbiente();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'FID_SECRETO_NAO_DEVE_APARECER' });
    const { messaging } = criarMessaging({ successCount: 1, failureCount: 0, responses: [{ success: true }] });

    const chamadas: unknown[] = [];
    const logger: Logger = {
      info: (mensagem, meta) => chamadas.push([mensagem, meta]),
      warn: (mensagem, meta) => chamadas.push([mensagem, meta]),
      error: (mensagem, meta) => chamadas.push([mensagem, meta]),
    };

    await handleNotificacao(notificacaoBase(), { db, messaging, config, logger });

    const serializado = JSON.stringify(chamadas);
    expect(serializado).not.toContain('FID_SECRETO_NAO_DEVE_APARECER');
  });
});
