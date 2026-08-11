import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { DispositivoPush } from './types.js';

const COLECAO = 'dispositivosPush';

/**
 * Documento legado da Fase PUSH-1A (só `token`, sem `fid`) — nunca
 * interpretado como FID. `token` nunca é lido nem logado aqui; a função
 * checa apenas a ausência/vacuidade de `fid`.
 */
function possuiFidValido(data: DocumentData): boolean {
  return typeof data.fid === 'string' && data.fid.trim() !== '';
}

/**
 * Dispositivos ativos do login, filtrando por ambiente STAGING — nunca
 * mistura com eventuais dispositivos de produção (que nesta fase nem
 * deveriam existir, mas o filtro é defensivo). Aceita `WEB` e `ANDROID`
 * (nenhum filtro de plataforma na consulta — não é preciso e evitaria um
 * índice composto novo). Documentos legados que só têm `token` (Fase
 * PUSH-1A) são ignorados com segurança pelo filtro de `fid` — nunca causam
 * exceção, nunca são apagados aqui.
 */
export async function listActiveDevices(db: Firestore, login: string): Promise<DispositivoPush[]> {
  const snapshot = await db
    .collection(COLECAO)
    .where('login', '==', login)
    .where('ativo', '==', true)
    .where('environment', '==', 'STAGING')
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .filter(possuiFidValido)
    .map((data) => data as DispositivoPush);
}

/**
 * Desativa exatamente o dispositivo indicado — nunca outros dispositivos
 * do mesmo login. Não loga `deviceId` nem FID; quem chama decide o que
 * logar (nunca o FID, ver pushSender.ts).
 */
export async function deactivateDevice(db: Firestore, deviceId: string): Promise<void> {
  await db.collection(COLECAO).doc(deviceId).update({
    ativo: false,
    atualizadoEm: new Date().toISOString(),
  });
}
