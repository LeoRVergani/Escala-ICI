import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import type { ResultadoProcessamento } from '../src/deliveryOrchestrator.js';
import { iniciarWatcher } from '../src/notificationWatcher.js';
import type { NotificacaoTroca } from '../src/types.js';
import { FirestoreFake } from './_fakes/firestoreFake.js';

const baseEnv = {
  FIREBASE_PROJECT_ID: 'escala-ici-staging',
  PUSH_ENVIRONMENT: 'staging',
  PUSH_ACTIVATED_AT: '2026-08-05T00:00:00.000Z',
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

function aguardarResultado(): { promessa: Promise<ResultadoProcessamento>; onResultado: (n: NotificacaoTroca, r: ResultadoProcessamento) => void } {
  let resolver!: (r: ResultadoProcessamento) => void;
  const promessa = new Promise<ResultadoProcessamento>((resolve) => {
    resolver = resolve;
  });
  return { promessa, onResultado: (_n, r) => resolver(r) };
}

describe('iniciarWatcher', () => {
  it('não entrega notificação anterior a PUSH_ACTIVATED_AT (filtro é na própria consulta)', async () => {
    const fake = new FirestoreFake();
    const db = fake as unknown as Firestore;
    const config = loadConfig({ ...baseEnv, PUSH_ENABLED: 'true' });
    const sendEachForMulticast = vi.fn();
    const messaging = { sendEachForMulticast } as unknown as Messaging;

    fake.seed('notificacoesTroca', 'notif-antiga', notificacaoBase({ id: 'notif-antiga', criadoEm: '2026-08-01T00:00:00.000Z' }));

    const onResultado = vi.fn();
    const unsubscribe = iniciarWatcher({ db, messaging, config, onResultado });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onResultado).not.toHaveBeenCalled();
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('com PUSH_ENABLED=false, entrega a notificação ao pipeline mas não envia nada', async () => {
    const fake = new FirestoreFake();
    const db = fake as unknown as Firestore;
    const config = loadConfig({ ...baseEnv, PUSH_ENABLED: 'false' });
    const sendEachForMulticast = vi.fn();
    const messaging = { sendEachForMulticast } as unknown as Messaging;

    fake.seed('notificacoesTroca', 'notif-1', notificacaoBase());

    const { promessa, onResultado } = aguardarResultado();
    const unsubscribe = iniciarWatcher({ db, messaging, config, onResultado });

    const resultado = await promessa;
    expect(resultado).toEqual({ outcome: 'ignorado-push-desabilitado' });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('ignora notificação já lida (lidaEm != null) sem enviar push', async () => {
    const fake = new FirestoreFake();
    const db = fake as unknown as Firestore;
    const config = loadConfig({ ...baseEnv, PUSH_ENABLED: 'true' });
    const sendEachForMulticast = vi.fn();
    const messaging = { sendEachForMulticast } as unknown as Messaging;

    fake.seed('notificacoesTroca', 'notif-1', notificacaoBase({ lidaEm: '2026-08-06T11:00:00.000Z' }));

    const { promessa, onResultado } = aguardarResultado();
    const unsubscribe = iniciarWatcher({ db, messaging, config, onResultado });

    const resultado = await promessa;
    expect(resultado).toEqual({ outcome: 'ignorado-ja-lido' });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('processa e envia quando elegível e PUSH_ENABLED=true, com 1 dispositivo ativo', async () => {
    const fake = new FirestoreFake();
    const db = fake as unknown as Firestore;
    const config = loadConfig({ ...baseEnv, PUSH_ENABLED: 'true' });
    const sendEachForMulticast = vi.fn().mockResolvedValue({ successCount: 1, failureCount: 0, responses: [{ success: true }] });
    const messaging = { sendEachForMulticast } as unknown as Messaging;

    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('notificacoesTroca', 'notif-1', notificacaoBase());

    const { promessa, onResultado } = aguardarResultado();
    const unsubscribe = iniciarWatcher({ db, messaging, config, onResultado });

    const resultado = await promessa;
    expect(resultado).toEqual({ outcome: 'enviado', successCount: 1, failureCount: 0 });
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
