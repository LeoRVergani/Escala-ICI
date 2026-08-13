import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { DispositivoPush } from './types.js';

const COLECAO = 'dispositivosPush';

export interface DispositivoAuditado {
  readonly ordem: number;
  readonly posicaoRelativa: string;
  readonly deviceId: string;
  readonly ativo: boolean;
  readonly plataforma: string | null;
  readonly environment: string | null;
  readonly fidPresente: boolean;
  readonly criadoEm: string | null;
  readonly atualizadoEm: string | null;
  readonly ultimaConfirmacaoEm: string | null;
}

export interface ResultadoAuditoriaDispositivos {
  readonly total: number;
  readonly dispositivos: DispositivoAuditado[];
}

/**
 * Documento legado da Fase PUSH-1A (só `token`, sem `fid`) — nunca
 * interpretado como FID. `token` nunca é lido nem logado aqui; a função
 * checa apenas a ausência/vacuidade de `fid`.
 */
function possuiFidValido(data: DocumentData): boolean {
  return typeof data.fid === 'string' && data.fid.trim() !== '';
}

export function abreviarDeviceId(deviceId: string): string {
  return deviceId.trim().slice(-6);
}

function stringOuNull(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function timestampDeAuditoria(data: DocumentData): number {
  const candidato = stringOuNull(data.ultimaConfirmacaoEm)
    ?? stringOuNull(data.atualizadoEm)
    ?? stringOuNull(data.criadoEm);
  const timestamp = candidato === null ? Number.NaN : Date.parse(candidato);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function ordenarDocsAuditoria(a: { id: string; data: DocumentData }, b: { id: string; data: DocumentData }): number {
  const porTimestamp = timestampDeAuditoria(b.data) - timestampDeAuditoria(a.data);
  if (porTimestamp !== 0) {
    return porTimestamp;
  }
  return a.id.localeCompare(b.id);
}

export async function auditDevicesByLogin(db: Firestore, login: string): Promise<ResultadoAuditoriaDispositivos> {
  const snapshot = await db
    .collection(COLECAO)
    .where('login', '==', login)
    .get();
  const docs = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .sort(ordenarDocsAuditoria);

  const dispositivos = docs.map(({ id, data }, index): DispositivoAuditado => ({
    ordem: index + 1,
    posicaoRelativa: index === 0 ? 'mais recente' : `${index + 1}º mais recente`,
    deviceId: abreviarDeviceId(id),
    ativo: data.ativo === true,
    plataforma: stringOuNull(data.plataforma),
    environment: stringOuNull(data.environment),
    fidPresente: possuiFidValido(data),
    criadoEm: stringOuNull(data.criadoEm),
    atualizadoEm: stringOuNull(data.atualizadoEm),
    ultimaConfirmacaoEm: stringOuNull(data.ultimaConfirmacaoEm),
  }));

  return {
    total: dispositivos.length,
    dispositivos,
  };
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
