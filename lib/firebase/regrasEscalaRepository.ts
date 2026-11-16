import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { COLECAO_REGRAS_ESCALA, errosParaSalvar, lerRegraSalva, montarDocumentoRegra, type RegraEscalaSalva } from '../regrasPersistencia';
import type { RegraEscala } from '../regrasEscala';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * REGRAS-ESCALA-4 — regras da escala da empresa (`regrasEscala`). Leitura para qualquer
 * autenticado; escrita só ADMIN_SISTEMA (as Rules conferem). As regras LEGAIS ficam no
 * código e nunca passam por aqui.
 */
export function observarRegrasEscala(
  aoAtualizar: (regras: RegraEscalaSalva[], ignoradas: number) => void,
  aoFalhar: (erro: Error) => void,
): () => void {
  const { db } = exigirFirebase();
  return onSnapshot(
    collection(db, COLECAO_REGRAS_ESCALA),
    (snapshot) => {
      const regras: RegraEscalaSalva[] = [];
      let ignoradas = 0;
      for (const documento of snapshot.docs) {
        const regra = lerRegraSalva(documento.id, documento.data());
        if (regra === null) ignoradas += 1;
        else regras.push(regra);
      }
      aoAtualizar(regras.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), ignoradas);
    },
    aoFalhar,
  );
}

/** Cria ou atualiza. `existente` preserva quem criou e quando. Devolve o que foi gravado. */
export async function salvarRegraEscala(
  regra: RegraEscala,
  autorLogin: string,
  existente?: Pick<RegraEscalaSalva, 'criadoPorLogin' | 'criadoEm'> | null,
): Promise<RegraEscalaSalva> {
  exigirEscritaAdministrativaHabilitada();
  const erros = errosParaSalvar(regra);
  if (erros.length > 0) throw new Error(erros[0]);
  const { db } = exigirFirebase();
  const documento = montarDocumentoRegra(regra, autorLogin, new Date().toISOString(), existente);
  await setDoc(doc(db, COLECAO_REGRAS_ESCALA, documento.id), removerUndefined(documento));
  return documento;
}

export async function alternarRegraEscala(regra: RegraEscalaSalva, ativa: boolean, autorLogin: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, COLECAO_REGRAS_ESCALA, regra.id), {
    ativa,
    atualizadoPorLogin: autorLogin,
    atualizadoEm: new Date().toISOString(),
  });
}

export async function excluirRegraEscala(regraId: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await deleteDoc(doc(db, COLECAO_REGRAS_ESCALA, regraId));
}
