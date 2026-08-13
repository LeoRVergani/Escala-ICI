import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import {
  abreviarDeviceId,
  auditDevicesByLogin,
  deactivateDevice,
  listActiveDevices,
} from '../src/deviceRepository.js';
import { lerLoginAuditoriaDoArgv } from '../src/deviceAuditCli.js';
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

describe('auditDevicesByLogin / devices:audit', () => {
  it('CLI exige --login', () => {
    expect(() => lerLoginAuditoriaDoArgv([])).toThrow(/devices:audit/);
    expect(() => lerLoginAuditoriaDoArgv(['--login='])).toThrow(/devices:audit/);
    expect(lerLoginAuditoriaDoArgv(['--login=lvergani'])).toBe('lvergani');
  });

  it('abreviação do deviceId é estável e não expõe o identificador completo', () => {
    expect(abreviarDeviceId('web-1234567890abcdef')).toBe('abcdef');
  });

  it('ordena por confirmação mais recente e imprime apenas campos sanitizados', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'web-antigo-111111', {
      login: 'lvergani',
      ativo: true,
      environment: 'STAGING',
      plataforma: 'WEB',
      fid: 'fid-nao-imprimir-antigo',
      token: 'token-nao-imprimir-antigo',
      criadoEm: '2026-08-10T10:00:00.000Z',
      atualizadoEm: '2026-08-11T10:00:00.000Z',
      ultimaConfirmacaoEm: '2026-08-11T10:00:00.000Z',
    });
    fake.seed('dispositivosPush', 'web-novo-222222', {
      login: 'lvergani',
      ativo: true,
      environment: 'STAGING',
      plataforma: 'WEB',
      fid: 'fid-nao-imprimir-novo',
      token: 'token-nao-imprimir-novo',
      criadoEm: '2026-08-10T10:00:00.000Z',
      atualizadoEm: '2026-08-12T10:00:00.000Z',
      ultimaConfirmacaoEm: '2026-08-12T10:00:00.000Z',
    });

    const resultado = await auditDevicesByLogin(db, 'lvergani');
    const serializado = JSON.stringify(resultado);

    expect(resultado.total).toBe(2);
    expect(resultado.dispositivos.map((d) => d.deviceId)).toEqual(['222222', '111111']);
    expect(resultado.dispositivos[0]?.posicaoRelativa).toBe('mais recente');
    expect(resultado.dispositivos[0]?.fidPresente).toBe(true);
    expect(serializado).not.toContain('fid-nao-imprimir');
    expect(serializado).not.toContain('token-nao-imprimir');
    expect(serializado).not.toContain('lvergani@');
  });

  it('auditoria é somente leitura — não executa update/set', async () => {
    const { fake, db } = criarDb();
    fake.seed('dispositivosPush', 'web-333333', {
      login: 'lvergani',
      ativo: true,
      environment: 'STAGING',
      plataforma: 'WEB',
      fid: 'fid-presente',
      atualizadoEm: '2026-08-12T10:00:00.000Z',
    });
    const ref = db.collection('dispositivosPush').doc('web-333333');
    const update = vi.spyOn(ref, 'update');
    const set = vi.spyOn(ref, 'set');

    await auditDevicesByLogin(db, 'lvergani');

    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
