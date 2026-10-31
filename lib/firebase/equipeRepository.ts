import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import type { Usuario } from '../modelos';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * FASE1-EQUIPE-SIMPLES — "Minha equipe": trazer uma pessoa que já existe no
 * cadastro para a equipe do coordenador. Se ela estava em outra equipe, é
 * TRANSFERIDA (só `equipeId` muda) e quem administra a equipe antiga recebe
 * um aviso em `avisosGestao`, no mesmo lote (tudo ou nada).
 */
export interface AvisoGestao {
  id: string;
  tipo: 'TRANSFERENCIA_COLABORADOR';
  equipeAvisadaId: string;
  equipeDestinoId: string;
  colaboradorLogin: string;
  colaboradorNome: string;
  criadoPorLogin: string;
  criadoPorNome: string;
  criadoEm: string;
  lido: boolean;
  lidoPorLogin: string | null;
  lidoEm: string | null;
  schemaVersion: 1;
}

export async function trazerUsuarioParaEquipe(parametros: {
  usuario: Pick<Usuario, 'login' | 'nome' | 'equipeId'>;
  equipeDestinoId: string;
  autor: Pick<Usuario, 'login' | 'nome'>;
}): Promise<{ transferido: boolean }> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const { usuario, equipeDestinoId, autor } = parametros;
  const agora = new Date().toISOString();
  const equipeOrigem = usuario.equipeId?.trim() ? usuario.equipeId : null;
  const lote = writeBatch(db);
  lote.update(doc(db, 'usuarios', usuario.login), { equipeId: equipeDestinoId, atualizadoEm: agora });
  const transferido = equipeOrigem !== null && equipeOrigem !== equipeDestinoId;
  if (transferido) {
    const aviso: Omit<AvisoGestao, 'id'> = {
      tipo: 'TRANSFERENCIA_COLABORADOR',
      equipeAvisadaId: equipeOrigem,
      equipeDestinoId,
      colaboradorLogin: usuario.login,
      colaboradorNome: usuario.nome,
      criadoPorLogin: autor.login,
      criadoPorNome: autor.nome,
      criadoEm: agora,
      lido: false,
      lidoPorLogin: null,
      lidoEm: null,
      schemaVersion: 1,
    };
    lote.set(doc(collection(db, 'avisosGestao')), aviso);
  }
  await lote.commit();
  return { transferido };
}

/** Avisos ainda não lidos das equipes que o usuário administra (uma consulta por equipe, como as Rules exigem). */
export async function listarAvisosGestaoPendentes(equipeIds: readonly string[]): Promise<AvisoGestao[]> {
  const { db } = exigirFirebase();
  const resultados = await Promise.allSettled(equipeIds.map((equipeId) => getDocs(query(
    collection(db, 'avisosGestao'),
    where('equipeAvisadaId', '==', equipeId),
    where('lido', '==', false),
  ))));
  return resultados
    .flatMap((resultado) => (resultado.status === 'fulfilled' ? resultado.value.docs : []))
    .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as Omit<AvisoGestao, 'id'>) }))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function marcarAvisoGestaoComoLido(avisoId: string, login: string): Promise<void> {
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'avisosGestao', avisoId), {
    lido: true,
    lidoPorLogin: login,
    lidoEm: new Date().toISOString(),
  });
}
