import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch, type Unsubscribe,
} from 'firebase/firestore';

import { chaveLimite, diaDoLimite, lerRecado, VALIDADE_APOS_RESPOSTA_HORAS, type Recado } from '../recados';
import { exigirFirebase } from './shared';

/**
 * RECADOS-1 — `recados` (remetente e destinatário) e `recadosLimite` (contador diário, gravado no MESMO
 * lote do recado — as Regras recusam o recado sem ele). Sem histórico: o remetente apaga ao dispensar e o
 * que expira some sozinho (TTL em `expiraEm`).
 */
export const COLECAO_RECADOS = 'recados';
export const COLECAO_LIMITE_RECADOS = 'recadosLimite';

function paraIso(valor: unknown): string | null {
  if (typeof valor === 'string') return valor;
  if (valor !== null && typeof valor === 'object' && typeof (valor as { toDate?: unknown }).toDate === 'function') {
    return (valor as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function lerLista(documentos: ReadonlyArray<{ id: string; data: (opcoes?: { serverTimestamps: 'estimate' }) => Record<string, unknown> }>): Recado[] {
  const lista: Recado[] = [];
  for (const documento of documentos) {
    // `estimate`: um recado recém-enviado (hora do servidor ainda pendente) já aparece na tela
    const dados = documento.data({ serverTimestamps: 'estimate' });
    const recado = lerRecado(documento.id, {
      ...dados, criadoEm: paraIso(dados.criadoEm), respondidoEm: paraIso(dados.respondidoEm), expiraEm: paraIso(dados.expiraEm),
    });
    if (recado !== null) lista.push(recado);
  }
  return lista;
}

const falhaConhecida = (falha: unknown) => (falha instanceof Error ? falha : new Error('Falha ao acompanhar os recados.'));

/** Os recados que EU enviei (ainda não apagados). */
export function observarRecadosEnviados(login: string, aoAtualizar: (lista: Recado[]) => void, aoFalhar: (erro: Error) => void): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(collection(db, COLECAO_RECADOS), where('remetenteLogin', '==', login)),
    (snapshot) => aoAtualizar(lerLista(snapshot.docs)), (falha) => aoFalhar(falhaConhecida(falha)));
}

/** Os recados endereçados a MIM. */
export function observarRecadosRecebidos(login: string, aoAtualizar: (lista: Recado[]) => void, aoFalhar: (erro: Error) => void): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(collection(db, COLECAO_RECADOS), where('destinatarioLogin', '==', login)),
    (snapshot) => aoAtualizar(lerLista(snapshot.docs)), (falha) => aoFalhar(falhaConhecida(falha)));
}

function consultaContador(login: string, dia: string) {
  const { db } = exigirFirebase();
  return query(collection(db, COLECAO_LIMITE_RECADOS), where('login', '==', login), where('dia', '==', dia));
}

export function observarContagemDoDia(login: string, dia: string, aoAtualizar: (contagem: number) => void, aoFalhar: (erro: Error) => void): Unsubscribe {
  return onSnapshot(consultaContador(login, dia),
    (snapshot) => aoAtualizar(Number(snapshot.docs[0]?.data().contagem ?? 0)), (falha) => aoFalhar(falhaConhecida(falha)));
}

export async function lerContagemDoDia(login: string, dia: string): Promise<number> {
  const snapshot = await getDocs(consultaContador(login, dia));
  return Number(snapshot.docs[0]?.data().contagem ?? 0);
}

/** Grava o recado e o contador do dia num lote só (as Regras exigem os dois). Devolve a nova contagem. */
export async function enviarRecado(recado: Recado, contagemAtual: number): Promise<number> {
  const { db } = exigirFirebase();
  const agoraIso = new Date().toISOString();
  const nova = contagemAtual + 1;
  const lote = writeBatch(db);
  lote.set(doc(db, COLECAO_RECADOS, recado.id), {
    ...recado, criadoEm: serverTimestamp(), respondidoEm: null, expiraEm: Timestamp.fromDate(new Date(recado.expiraEm)),
  });
  lote.set(doc(db, COLECAO_LIMITE_RECADOS, chaveLimite(recado.remetenteLogin, agoraIso)), { login: recado.remetenteLogin, dia: diaDoLimite(agoraIso), contagem: nova });
  await lote.commit();
  return nova;
}

/** O destinatário responde (texto livre); o recado ainda vive 24 h para o remetente ver e depois some. */
export async function responderRecado(recadoId: string, resposta: string): Promise<void> {
  const { db } = exigirFirebase();
  await updateDoc(doc(db, COLECAO_RECADOS, recadoId), {
    status: 'RESPONDIDO', resposta: resposta.trim(), respondidoEm: serverTimestamp(),
    expiraEm: Timestamp.fromMillis(Date.now() + VALIDADE_APOS_RESPOSTA_HORAS * 3_600_000),
  });
}

export async function apagarRecado(recadoId: string): Promise<void> {
  const { db } = exigirFirebase();
  await deleteDoc(doc(db, COLECAO_RECADOS, recadoId));
}
