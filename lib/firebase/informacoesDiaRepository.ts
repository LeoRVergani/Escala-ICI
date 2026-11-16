import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, where, type Unsubscribe } from 'firebase/firestore';

import { lerInformacao, type InformacaoDia } from '../informacoesDia';
import { exigirFirebase } from './shared';

/**
 * INFORMACOES-DIA-1 — `informacoesDia`: o chefe da equipe lê e grava; o colaborador só lê o que
 * foi liberado a ele. As Rules decidem; aqui só as consultas que elas aceitam (igualdade por
 * equipe, ou por login + liberada) e o ignorar de documento malformado.
 */
export const COLECAO_INFORMACOES_DIA = 'informacoesDia';

function lerLista(documentos: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>): InformacaoDia[] {
  const lista: InformacaoDia[] = [];
  for (const documento of documentos) {
    const informacao = lerInformacao(documento.id, documento.data());
    if (informacao !== null) lista.push(informacao);
  }
  return lista;
}

/** Tudo que ainda vale (`dataFim` a partir de `desdeIso`) numa equipe — para a liderança. */
export function observarInformacoesDaEquipe(
  equipeId: string,
  desdeIso: string,
  aoAtualizar: (lista: InformacaoDia[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(
    query(collection(db, COLECAO_INFORMACOES_DIA), where('equipeId', '==', equipeId), where('dataFim', '>=', desdeIso), orderBy('dataFim')),
    (snapshot) => aoAtualizar(lerLista(snapshot.docs)),
    (falha) => aoFalhar(falha instanceof Error ? falha : new Error('Falha ao acompanhar as informações.')),
  );
}

/** Só as liberadas para o colaborador, dele mesmo — para o App. */
export function observarInformacoesDoColaborador(
  login: string,
  desdeIso: string,
  aoAtualizar: (lista: InformacaoDia[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(
    query(
      collection(db, COLECAO_INFORMACOES_DIA),
      where('login', '==', login),
      where('visivelParaColaborador', '==', true),
      where('dataFim', '>=', desdeIso),
      orderBy('dataFim'),
    ),
    (snapshot) => aoAtualizar(lerLista(snapshot.docs)),
    (falha) => aoFalhar(falha instanceof Error ? falha : new Error('Falha ao acompanhar as informações.')),
  );
}

export async function salvarInformacao(informacao: InformacaoDia): Promise<void> {
  const { db } = exigirFirebase();
  await setDoc(doc(db, COLECAO_INFORMACOES_DIA, informacao.id), informacao);
}

export async function excluirInformacao(informacaoId: string): Promise<void> {
  const { db } = exigirFirebase();
  await deleteDoc(doc(db, COLECAO_INFORMACOES_DIA, informacaoId));
}
