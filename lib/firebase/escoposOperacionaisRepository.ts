import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

import type { EscopoOperacional } from '../modelos';
import { criarIdEscopoOperacional } from '../escoposOperacionaisMatriz';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

export async function listarEscoposOperacionais(): Promise<EscopoOperacional[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'escoposOperacionais'));
  return resultado.docs.map((snapshot) => snapshot.data() as EscopoOperacional);
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
