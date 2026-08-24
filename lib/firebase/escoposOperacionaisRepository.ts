import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

import type { EscopoOperacional, TipoEscopoOperacional } from '../modelos';
import { criarIdEscopoOperacional } from '../escoposOperacionaisMatriz';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

export async function listarEscoposOperacionais(): Promise<EscopoOperacional[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'escoposOperacionais'));
  return resultado.docs.map((snapshot) => snapshot.data() as EscopoOperacional);
}

/**
 * Leitura pontual de UM escopo — usada pelo App (FASE-TROCAS-PLANTAO-1) para
 * descobrir quem administra um Grupo de Plantão e notificá-lo, sem varrer a
 * coleção inteira (`listarEscoposOperacionais()` é para o Dashboard, que já
 * precisa de todos os escopos de qualquer forma).
 */
export async function obterEscopoOperacional(
  tipo: TipoEscopoOperacional,
  alvoId: string,
): Promise<EscopoOperacional | null> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'escoposOperacionais', criarIdEscopoOperacional(tipo, alvoId)));
  return snapshot.exists() ? (snapshot.data() as EscopoOperacional) : null;
}

export async function salvarEscopoOperacional(escopo: EscopoOperacional): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(
    doc(db, 'escoposOperacionais', criarIdEscopoOperacional(escopo.tipo, escopo.alvoId)),
    removerUndefined(escopo),
    { merge: true },
  );
}
