import {
  deleteApp,
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';

import { resolverPoliticaFirebase } from './environment';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigurado = Object.values(firebaseConfig)
  .every((valor) => typeof valor === 'string' && valor.trim() !== '');

let services: FirebaseServices | null | undefined;
let usarCachePersistente = true;

export function configurarCachePersistente(habilitado: boolean): void {
  if (services === undefined) {
    usarCachePersistente = habilitado;
  }
}

export function emuladoresHabilitados(): boolean {
  return resolverPoliticaFirebase(
    import.meta.env,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  ).emuladoresLaboratorio;
}

export function obterFirebase(): FirebaseServices | null {
  if (services !== undefined) {
    return services;
  }

  if (typeof window === 'undefined' || !firebaseConfigurado) {
    services = null;
    return services;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: usarCachePersistente
        ? persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          })
        : memoryLocalCache(),
    });
  } catch {
    db = getFirestore(app);
  }

  const auth = getAuth(app);
  if (emuladoresHabilitados()) {
    connectAuthEmulator(
      auth,
      import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
    connectFirestoreEmulator(
      db,
      import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
      Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080),
    );
  }

  services = { app, auth, db };
  return services;
}

export async function limparFirebaseLocal(): Promise<void> {
  const firebase = services;
  services = undefined;
  if (firebase === null || firebase === undefined) {
    return;
  }

  try {
    await terminate(firebase.db);
    await clearIndexedDbPersistence(firebase.db);
  } catch {
    // Outra aba pode manter o IndexedDB aberto; o logout ainda permanece válido.
  }
  await deleteApp(firebase.app);
}
