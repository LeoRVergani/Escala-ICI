import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { claim, finalizeEnvio, markSemDispositivo } from '../src/deliveryRepository.js';
import type { NotificacaoTroca } from '../src/types.js';
import { FirestoreFake } from './_fakes/firestoreFake.js';

function criarDb(): { fake: FirestoreFake; db: Firestore } {
  const fake = new FirestoreFake();
  return { fake, db: fake as unknown as Firestore };
}

const notificacao: NotificacaoTroca = {
  id: 'notif-1',
  destinatarioLogin: 'lvergani',
  equipeId: 'equipe-1',
  tipo: 'TROCA_SOLICITADA',
  titulo: 'Nova solicitação de troca',
  mensagem: 'Você recebeu uma solicitação de troca de escala.',
  trocaId: 'troca-1',
  criadoPorLogin: 'outro.login',
  criadoEm: '2026-08-05T10:00:00.000Z',
  lidaEm: null,
  acao: 'ABRIR_TROCA',
};

describe('deliveryRepository.claim', () => {
  it('reclama quando não existe pushEntregas para a notificação', async () => {
    const { db } = criarDb();
    const resultado = await claim(db, notificacao, { workerId: 'worker-a', leaseDurationMs: 60_000 });
    expect(resultado).toEqual({ claimed: true });
  });

  it('não reclama de novo quando já está ENVIADO (restart não reenvia)', async () => {
    const { fake, db } = criarDb();
    fake.seed('pushEntregas', 'notif-1', {
      notificacaoId: 'notif-1',
      status: 'ENVIADO',
      tentativas: 1,
      leaseExpiraEm: null,
    });

    const resultado = await claim(db, notificacao, { workerId: 'worker-a', leaseDurationMs: 60_000 });
    expect(resultado).toEqual({ claimed: false, reason: 'ja-enviado' });
  });

  it('não reclama quando outro worker tem lease PROCESSANDO ainda válida (dois workers concorrentes)', async () => {
    const { fake, db } = criarDb();
    const agora = new Date('2026-08-05T12:00:00.000Z');
    fake.seed('pushEntregas', 'notif-1', {
      notificacaoId: 'notif-1',
      status: 'PROCESSANDO',
      workerId: 'worker-a',
      processandoDesde: agora.toISOString(),
      leaseExpiraEm: new Date(agora.getTime() + 60_000).toISOString(),
      tentativas: 1,
    });

    const resultado = await claim(db, notificacao, {
      workerId: 'worker-b',
      leaseDurationMs: 60_000,
      now: () => new Date('2026-08-05T12:00:10.000Z'),
    });
    expect(resultado).toEqual({ claimed: false, reason: 'lease-em-vigor' });
  });

  it('retoma com segurança um PROCESSANDO com lease vencida', async () => {
    const { fake, db } = criarDb();
    const inicio = new Date('2026-08-05T12:00:00.000Z');
    fake.seed('pushEntregas', 'notif-1', {
      notificacaoId: 'notif-1',
      status: 'PROCESSANDO',
      workerId: 'worker-a',
      processandoDesde: inicio.toISOString(),
      leaseExpiraEm: new Date(inicio.getTime() + 60_000).toISOString(),
      tentativas: 1,
    });

    const resultado = await claim(db, notificacao, {
      workerId: 'worker-b',
      leaseDurationMs: 60_000,
      now: () => new Date('2026-08-05T12:05:00.000Z'),
    });
    expect(resultado).toEqual({ claimed: true });

    const doc = await fake.collection('pushEntregas').doc('notif-1').get();
    expect(doc.data()?.workerId).toBe('worker-b');
    expect(doc.data()?.tentativas).toBe(2);
  });

  it('reclama PENDENTE e ERRO_RETRY normalmente', async () => {
    const { fake, db } = criarDb();
    fake.seed('pushEntregas', 'notif-1', {
      notificacaoId: 'notif-1',
      status: 'ERRO_RETRY',
      workerId: null,
      leaseExpiraEm: null,
      tentativas: 1,
    });
    const resultado = await claim(db, notificacao, { workerId: 'worker-a', leaseDurationMs: 60_000 });
    expect(resultado).toEqual({ claimed: true });
  });
});

describe('deliveryRepository.markSemDispositivo / finalizeEnvio', () => {
  it('marca SEM_DISPOSITIVO e limpa a lease', async () => {
    const { fake, db } = criarDb();
    fake.seed('pushEntregas', 'notif-1', { notificacaoId: 'notif-1', status: 'PROCESSANDO', workerId: 'worker-a', leaseExpiraEm: '2026-01-01T00:00:00.000Z', tentativas: 1 });
    await markSemDispositivo(db, 'notif-1');
    const doc = await fake.collection('pushEntregas').doc('notif-1').get();
    expect(doc.data()?.status).toBe('SEM_DISPOSITIVO');
    expect(doc.data()?.workerId).toBeNull();
    expect(doc.data()?.leaseExpiraEm).toBeNull();
  });

  it('finaliza como ENVIADO com successCount/failureCount', async () => {
    const { fake, db } = criarDb();
    fake.seed('pushEntregas', 'notif-1', { notificacaoId: 'notif-1', status: 'PROCESSANDO', workerId: 'worker-a', leaseExpiraEm: '2026-01-01T00:00:00.000Z', tentativas: 1 });
    await finalizeEnvio(db, 'notif-1', { status: 'ENVIADO', successCount: 1, failureCount: 1, erroCodigo: 'messaging/registration-token-not-registered' });
    const doc = await fake.collection('pushEntregas').doc('notif-1').get();
    expect(doc.data()?.status).toBe('ENVIADO');
    expect(doc.data()?.enviadoEm).not.toBeNull();
    expect(doc.data()?.successCount).toBe(1);
    expect(doc.data()?.failureCount).toBe(1);
  });
});
