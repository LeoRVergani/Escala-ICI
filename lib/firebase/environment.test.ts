import { describe, expect, it } from 'vitest';

import { resolverPoliticaFirebase } from './environment';

describe('política de conexão e escrita do Firebase', () => {
  it('mantém produção somente leitura por padrão', () => {
    expect(resolverPoliticaFirebase({
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'false',
      VITE_FIREBASE_USE_EMULATORS: 'false',
    }, 'escala.exemplo.com')).toEqual({
      emuladoresLocais: false,
      emuladoresLan: false,
      emuladoresLaboratorio: false,
      escritaOficial: false,
      escritaAdministrativa: false,
      ambiente: 'indefinido',
      projetoStaging: false,
    });
  });

  it('libera escrita somente para emuladores em host local', () => {
    expect(resolverPoliticaFirebase({
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'false',
      VITE_FIREBASE_USE_EMULATORS: 'true',
    }, 'localhost')).toMatchObject({
      emuladoresLocais: true,
      emuladoresLaboratorio: true,
      escritaOficial: false,
      escritaAdministrativa: true,
    });
  });

  it('libera laboratório LAN somente no IPv4 privado exato e explicitamente autorizado', () => {
    const ambiente = {
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'false',
      VITE_FIREBASE_USE_EMULATORS: 'true',
      VITE_FIREBASE_ENVIRONMENT: 'local',
      VITE_FIREBASE_LAN_MODE: 'true',
      VITE_FIREBASE_LAN_HOST: '172.31.6.111',
    };

    expect(resolverPoliticaFirebase(ambiente, '172.31.6.111')).toMatchObject({
      emuladoresLocais: false,
      emuladoresLan: true,
      emuladoresLaboratorio: true,
      escritaOficial: false,
      escritaAdministrativa: true,
    });
    expect(resolverPoliticaFirebase(ambiente, '172.31.6.112')).toMatchObject({
      emuladoresLan: false,
      emuladoresLaboratorio: false,
      escritaAdministrativa: false,
    });
  });

  it('não aceita IP público nem modo LAN fora do ambiente local', () => {
    const base = {
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'false',
      VITE_FIREBASE_USE_EMULATORS: 'true',
      VITE_FIREBASE_LAN_MODE: 'true',
    };

    expect(resolverPoliticaFirebase({
      ...base,
      VITE_FIREBASE_ENVIRONMENT: 'local',
      VITE_FIREBASE_LAN_HOST: '8.8.8.8',
    }, '8.8.8.8').emuladoresLaboratorio).toBe(false);
    expect(resolverPoliticaFirebase({
      ...base,
      VITE_FIREBASE_ENVIRONMENT: 'producao',
      VITE_FIREBASE_LAN_HOST: '172.31.6.111',
    }, '172.31.6.111').emuladoresLaboratorio).toBe(false);
  });

  it('não aceita a flag de emulador em site hospedado', () => {
    expect(resolverPoliticaFirebase({
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'false',
      VITE_FIREBASE_USE_EMULATORS: 'true',
    }, 'escala.exemplo.com').escritaAdministrativa).toBe(false);
  });

  it('libera escrita oficial somente para um projeto declarado de staging', () => {
    expect(resolverPoliticaFirebase({
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
      VITE_FIREBASE_USE_EMULATORS: 'false',
      VITE_FIREBASE_ENVIRONMENT: 'staging',
      VITE_FIREBASE_PROJECT_ID: 'escala-ici-staging',
    }, 'escala.exemplo.com')).toMatchObject({
      escritaOficial: true,
      escritaAdministrativa: true,
      ambiente: 'staging',
      projetoStaging: true,
    });
  });

  it('mantém produção bloqueada mesmo com a flag de escrita ligada', () => {
    expect(resolverPoliticaFirebase({
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
      VITE_FIREBASE_USE_EMULATORS: 'false',
      VITE_FIREBASE_ENVIRONMENT: 'producao',
      VITE_FIREBASE_PROJECT_ID: 'escala-ici-producao',
    }, 'escala.ici.example').escritaAdministrativa).toBe(false);
  });

  it('rejeita projeto sem sufixo de homologação', () => {
    expect(resolverPoliticaFirebase({
      VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE: 'true',
      VITE_FIREBASE_USE_EMULATORS: 'false',
      VITE_FIREBASE_ENVIRONMENT: 'staging',
      VITE_FIREBASE_PROJECT_ID: 'escala-ici',
    }, 'staging.escala.example').escritaAdministrativa).toBe(false);
  });
});
