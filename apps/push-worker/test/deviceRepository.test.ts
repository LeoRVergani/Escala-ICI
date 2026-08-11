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
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: false, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-b' });
    fake.seed('dispositivosPush', 'dev-c', { deviceId: 'dev-c', login: 'outro', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-c' });
    fake.seed('dispositivosPush', 'dev-d', { deviceId: 'dev-d', login: 'lvergani', ativo: true, environment: 'PRODUCTION', plataforma: 'ANDROID', fid: 'fid-d' });

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
    fake.seed('dispositivosPush', 'dev-a', { deviceId: 'dev-a', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-a' });
    fake.seed('dispositivosPush', 'dev-b', { deviceId: 'dev-b', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-b' });

    await deactivateDevice(db, 'dev-a');

    const restantes = await listActiveDevices(db, 'lvergani');
    expect(restantes.map((d) => d.deviceId)).toEqual(['dev-b']);
  });

  it('aceita dispositivos WEB e ANDROID', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'dev-web', { deviceId: 'dev-web', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'WEB', fid: 'fid-web' });
    fake.seed('dispositivosPush', 'dev-android', { deviceId: 'dev-android', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-android' });

    const dispositivos = await listActiveDevices(db, 'lvergani');

    expect(dispositivos.map((d) => d.plataforma).sort()).toEqual(['ANDROID', 'WEB']);
  });

  it('ignora com segurança documentos legados que só têm token (Fase PUSH-1A), sem lançar exceção', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'dev-legado', { deviceId: 'dev-legado', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', token: 'tok-antigo' });
    fake.seed('dispositivosPush', 'dev-fid', { deviceId: 'dev-fid', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: 'fid-novo' });

    const dispositivos = await listActiveDevices(db, 'lvergani');

    expect(dispositivos).toHaveLength(1);
    expect(dispositivos[0]?.deviceId).toBe('dev-fid');
  });

  it('ignora documento com fid vazio, sem lançar exceção', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'dev-fid-vazio', { deviceId: 'dev-fid-vazio', login: 'lvergani', ativo: true, environment: 'STAGING', plataforma: 'ANDROID', fid: '' });

    const dispositivos = await listActiveDevices(db, 'lvergani');

    expect(dispositivos).toHaveLength(0);
  });
});
