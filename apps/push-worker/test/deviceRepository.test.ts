import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { deactivateDevice, listActiveDevices } from '../src/deviceRepository.js';
import { FirestoreFake } from './_fakes/firestoreFake.js';

function criarDb(): { fake: FirestoreFake; db: Firestore } {
  const fake = new FirestoreFake();
  return { fake, db: fake as unknown as Firestore };
}

describe('deviceRepository', () => {
  it('retorna apenas dispositivos ativos, do login certo e do ambiente STAGING', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', token: 'tok-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: false, environment: 'STAGING', token: 'tok-b' });
    fake.seed('dispositivosPush', 'dev-c', { deviceId: 'dev-c', login: 'outro', ativo: true, environment: 'STAGING', token: 'tok-c' });
    fake.seed('dispositivosPush', 'dev-d', { deviceId: 'dev-d', login: 'lvergani', ativo: true, environment: 'PRODUCTION', token: 'tok-d' });

    const dispositivos = await listActiveDevices(db, 'lvergani');

    expect(dispositivos).toHaveLength(1);
    expect(dispositivos[0]?.deviceId).toBe('dev-a');
  });

  it('retorna lista vazia quando não há dispositivos', async () => {
    const { db } = criarDb();
    const dispositivos = await listActiveDevices(db, 'sem-dispositivo');
    expect(dispositivos).toHaveLength(0);
  });

  it('desativa somente o dispositivo indicado', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', token: 'tok-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: true, environment: 'STAGING', token: 'tok-b' });

    await deactivateDevice(db, 'dev-a');

    const restantes = await listActiveDevices(db, 'lvergani');
    expect(restantes.map((d) => d.deviceId)).toEqual(['dev-b']);
  });
});
