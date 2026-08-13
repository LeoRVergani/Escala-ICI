/**
 * Repositório exclusivo de `dispositivosPush` (Fase PUSH-PWA-1) — nunca
 * importa `writeRepository` (aquele é o caminho administrativo, guardado
 * por `exigirEscritaAdministrativaHabilitada()`; a autoinscrição do
 * próprio dispositivo é liberada pelas Firestore Rules — `login ==
 * loginDoAuth()` — e não deve depender da trava
 * `VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE`, que é administrativa).
 *
 * Contrato do documento (igual ao worker, `apps/push-worker/src/types.ts`):
 * `deviceId`/`login`/`plataforma`/`fid`/`ativo`/`criadoEm`/`atualizadoEm`/
 * `ultimaConfirmacaoEm`/`appVersion`/`environment`/`schemaVersion`. Nunca
 * grava `token`. Nunca loga `fid`.
 */
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { gerarUuid } from '../uuid';
import { exigirFirebase } from './shared';

const COLECAO = 'dispositivosPush';
export const SCHEMA_VERSION_DISPOSITIVO_PUSH = 1;

export interface DispositivoPushWeb {
  deviceId: string;
  login: string;
  plataforma: 'WEB';
  fid: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  ultimaConfirmacaoEm: string | null;
  appVersion: string | null;
  environment: 'STAGING';
  schemaVersion: number;
}

type ArmazenamentoChaveValor = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function chaveDeviceId(login: string): string {
  return `escala-ici-push-device-id-${login}`;
}

/**
 * `deviceId` estável por combinação de instalação (este navegador) + login:
 * a chave de armazenamento já inclui o login, então trocar de conta no
 * mesmo navegador nunca reaproveita o `deviceId` de outra pessoa — cada
 * login recebe o seu na primeira ativação. Nunca usa e-mail nem UID do
 * Firebase Auth como base; só um identificador opaco gerado localmente.
 */
export function obterOuCriarDeviceId(
  login: string,
  armazenamento: ArmazenamentoChaveValor = window.localStorage,
): string {
  const chave = chaveDeviceId(login);
  const existente = armazenamento.getItem(chave);
  if (existente !== null && existente.trim() !== '') {
    return existente;
  }
  const novo = `web-${gerarUuid()}`;
  armazenamento.setItem(chave, novo);
  return novo;
}

/** Só lê — nunca cria. Usado no logout: não faz sentido gerar um `deviceId` novo só para desativá-lo. */
export function deviceIdExistenteLocal(
  login: string,
  armazenamento: ArmazenamentoChaveValor = window.localStorage,
): string | null {
  const existente = armazenamento.getItem(chaveDeviceId(login));
  return existente !== null && existente.trim() !== '' ? existente : null;
}

export function removerDeviceIdLocal(
  login: string,
  armazenamento: ArmazenamentoChaveValor = window.localStorage,
): void {
  armazenamento.removeItem(chaveDeviceId(login));
}

export interface RegistrarDispositivoParams {
  deviceId: string;
  login: string;
  fid: string;
  appVersion?: string | null;
}

/**
 * Cria o documento na primeira ativação; nas seguintes (mesmo `deviceId`)
 * só renova `fid`/`ativo`/`atualizadoEm`/`ultimaConfirmacaoEm`, preservando
 * `criadoEm`. Idempotente: chamar de novo com o mesmo FID é inofensivo —
 * mesma escrita, sem duplicar documento. `onRegistered` pode disparar mais
 * de uma vez (registro manual, renovação de FID, `pushsubscriptionchange`)
 * e todas devem convergir para este mesmo caminho.
 */
export async function registrarOuRenovarDispositivo(params: RegistrarDispositivoParams): Promise<void> {
  const { db } = exigirFirebase();
  const ref = doc(db, COLECAO, params.deviceId);
  const agora = new Date().toISOString();
  const apiVersion = params.appVersion ?? null;

  const existente = await getDoc(ref);
  if (existente.exists()) {
    await updateDoc(ref, {
      fid: params.fid,
      ativo: true,
      atualizadoEm: agora,
      ultimaConfirmacaoEm: agora,
      appVersion: apiVersion,
    });
    return;
  }

  const documento: DispositivoPushWeb = {
    deviceId: params.deviceId,
    login: params.login,
    plataforma: 'WEB',
    fid: params.fid,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
    ultimaConfirmacaoEm: agora,
    appVersion: apiVersion,
    environment: 'STAGING',
    schemaVersion: SCHEMA_VERSION_DISPOSITIVO_PUSH,
  };
  await setDoc(ref, documento);
}

/** Só `get` do documento conhecido — nunca `list` (as Rules proíbem). */
export async function verificarDispositivoAtivo(deviceId: string): Promise<boolean> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, COLECAO, deviceId));
  return snapshot.exists() && snapshot.data().ativo === true;
}

export type StatusDispositivoPush = 'ATIVO' | 'PRECISA_REPARO' | 'INATIVO';

export interface ResultadoStatusDispositivo {
  status: StatusDispositivoPush;
  /** Campo já existente no contrato — nunca introduz dado novo, só o repassa para a UI decidir um rótulo relativo. */
  ultimaConfirmacaoEm: string | null;
}

/**
 * Verificação mais rica que `verificarDispositivoAtivo`: um documento com
 * `ativo: true` mas sem FID válido (ou com `plataforma`/`environment` fora
 * do contrato desta fase) não é uma instalação funcional — é só um registro
 * "zumbi" que nunca mais vai receber push (cenário observado no checkpoint
 * de push real: card mostrando `Ativo` no celular com uma instalação que
 * nunca recebeu nada). `PRECISA_REPARO` sinaliza esse caso para a UI
 * oferecer o reparo, sem desativar nada automaticamente.
 */
export async function obterStatusDispositivo(
  deviceId: string,
  loginEsperado?: string,
): Promise<ResultadoStatusDispositivo> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, COLECAO, deviceId));
  if (!snapshot.exists()) {
    return { status: 'INATIVO', ultimaConfirmacaoEm: null };
  }
  const dados = snapshot.data();
  const ultimaConfirmacaoEm = typeof dados.ultimaConfirmacaoEm === 'string' ? dados.ultimaConfirmacaoEm : null;
  if (loginEsperado !== undefined && dados.login !== loginEsperado) {
    return { status: 'INATIVO', ultimaConfirmacaoEm };
  }
  if (dados.ativo !== true) {
    return { status: 'INATIVO', ultimaConfirmacaoEm };
  }
  const fidValido = typeof dados.fid === 'string' && dados.fid.trim() !== '';
  const contratoValido = dados.plataforma === 'WEB' && dados.environment === 'STAGING';
  return {
    status: fidValido && contratoValido ? 'ATIVO' : 'PRECISA_REPARO',
    ultimaConfirmacaoEm,
  };
}

function documentoInexistente(falha: unknown): boolean {
  return typeof falha === 'object' && falha !== null && 'code' in falha
    && (falha as { code?: unknown }).code === 'not-found';
}

/**
 * Desativação (Perfil ou logout) marca `ativo: false` — decisão: nunca
 * apaga o documento. Preserva o histórico do `deviceId` para que uma
 * reativação futura no mesmo navegador/login renove o mesmo documento em
 * vez de criar um órfão, e mantém a limpeza simétrica com o que o
 * push-worker já faz para FIDs inválidos (`deactivateDevice`,
 * `apps/push-worker/src/deviceRepository.ts`). Nunca reintroduz `token`;
 */
export async function desativarDispositivo(deviceId: string): Promise<void> {
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  try {
    await updateDoc(doc(db, COLECAO, deviceId), {
      ativo: false,
      atualizadoEm: agora,
    });
  } catch (falha) {
    if (documentoInexistente(falha)) {
      return;
    }
    throw falha;
  }
}
