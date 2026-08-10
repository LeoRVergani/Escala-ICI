import type { Firestore } from 'firebase-admin/firestore';
import type { DispositivoPush } from './types.js';

const COLECAO = 'dispositivosPush';

/**
 * Dispositivos ativos do login, filtrando por ambiente STAGING — nunca
 * mistura com eventuais dispositivos de produção (que nesta fase nem
 * deveriam existir, mas o filtro é defensivo).
 */
export async function listActiveDevices(db: Firestore, login: string): Promise<DispositivoPush[]> {
  const snapshot = await db
    .collection(COLECAO)
    .where('login', '==', login)
    .where('ativo', '==', true)
    .where('environment', '==', 'STAGING')
    .get();
  return snapshot.docs.map((doc) => doc.data() as DispositivoPush);
}

/**
 * Desativa exatamente o dispositivo indicado — nunca outros dispositivos
 * do mesmo login. Não loga `deviceId` nem token; quem chama decide o que
 * logar (nunca o token, ver pushSender.ts).
 */
export async function deactivateDevice(db: Firestore, deviceId: string): Promise<void> {
  await db.collection(COLECAO).doc(deviceId).update({
    ativo: false,
    atualizadoEm: new Date().toISOString(),
  });
}
