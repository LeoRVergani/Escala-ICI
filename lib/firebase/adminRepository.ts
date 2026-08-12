import {
  collection,
  deleteDoc,
  doc,
  type Firestore,
  getDocs,
  query,
  type Query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import type { Equipe, Setor, UnidadeOrganizacional, Usuario } from '../modelos';
import { fatiarEmLotes } from './batches';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase, lerUsuario } from './shared';

/**
 * Operações administrativas cross-equipe do ADMIN_SISTEMA — deliberadamente
 * fora de `writeRepository.ts`/`readRepository.ts`, que são todas
 * parametrizadas por uma única `equipeId`.
 */

async function excluirPorConsultaEmLotes(db: Firestore, consulta: Query): Promise<number> {
  const snapshot = await getDocs(consulta);
  for (const lote of fatiarEmLotes(snapshot.docs, 500)) {
    const batch = writeBatch(db);
    for (const documento of lote) {
      batch.delete(documento.ref);
    }
    await batch.commit();
  }
  return snapshot.docs.length;
}

export async function listarTodosUsuarios(): Promise<Usuario[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'usuarios'));
  return resultado.docs.map((snapshot) => lerUsuario(snapshot.id, snapshot.data()));
}

export interface OpcoesExclusaoUsuario {
  cadastro: boolean;
  escalasPublicadas: boolean;
  rascunhos: boolean;
  trocas: boolean;
  notificacoes: boolean;
}

/**
 * Exclusão seletiva — o admin escolhe quais categorias de dados vinculadas
 * ao login apagar. `cadastro` (usuarios/{login}) vem por último de
 * propósito: se algo falhar nas categorias acima, a identidade do usuário
 * continua existindo e a operação pode ser repetida com segurança.
 *
 * Recebe `equipeId` do candidato (não só o login) porque as rules de leitura
 * de `turnosMes`/`rascunhosTurnosMes`/`trocasEscala`/`notificacoesTroca`
 * autorizam o ADMIN_SISTEMA cross-equipe checando `resource.data.equipeId`
 * — e uma consulta (`list`) só avalia essa condição sem erro quando a
 * própria consulta também filtra por `equipeId` (confirmado com teste
 * isolado no emulador; ver comentário em firestore.rules). Por isso toda
 * consulta abaixo inclui `where('equipeId', '==', candidato.equipeId)`
 * junto do filtro por login.
 */
export async function excluirUsuario(
  candidato: Pick<Usuario, 'login' | 'equipeId'>,
  opcoes: OpcoesExclusaoUsuario,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const { login, equipeId } = candidato;
  const porEquipe = where('equipeId', '==', equipeId);

  if (opcoes.escalasPublicadas) {
    await excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'turnosMes'), porEquipe, where('login', '==', login)),
    );
  }
  if (opcoes.rascunhos) {
    await excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'rascunhosTurnosMes'), porEquipe, where('login', '==', login)),
    );
  }
  if (opcoes.trocas) {
    await excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'trocasEscala'), porEquipe, where('solicitanteLogin', '==', login)),
    );
    await excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'trocasEscala'), porEquipe, where('destinatarioLogin', '==', login)),
    );
  }
  if (opcoes.notificacoes) {
    await excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'notificacoesTroca'), porEquipe, where('destinatarioLogin', '==', login)),
    );
    await excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'notificacoesTroca'), porEquipe, where('criadoPorLogin', '==', login)),
    );
  }
  if (opcoes.cadastro) {
    await deleteDoc(doc(db, 'usuarios', login));
  }
}

/**
 * Exclusão de escala antiga — nunca toca `usuarios` (invariante deliberada:
 * função separada de `excluirUsuario`, sem caminho de código compartilhado
 * que possa apagar cadastro por engano a partir daqui) nem
 * `historicoPublicacoes`/`versoesEscala`/`publicacoesEscala` (append-only
 * por design em todo o resto do sistema — apagar o histórico junto
 * contradiria essa decisão de arquitetura já tomada no projeto).
 */
export async function excluirEscalaPublicada(
  equipeId: string,
  competencia: string,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();

  const restricoes = [where('equipeId', '==', equipeId), where('competencia', '==', competencia)];
  await excluirPorConsultaEmLotes(db, query(collection(db, 'turnosMes'), ...restricoes));
  await excluirPorConsultaEmLotes(db, query(collection(db, 'rascunhosTurnosMes'), ...restricoes));
}

export async function listarEquipes(): Promise<Equipe[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'equipes'));
  return resultado.docs.map((snapshot) => snapshot.data() as Equipe);
}

export async function salvarEquipe(equipe: Equipe): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'equipes', equipe.id), removerUndefined(equipe), { merge: true });
}

export async function listarSetores(): Promise<Setor[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'setores'));
  return resultado.docs.map((snapshot) => snapshot.data() as Setor);
}

export async function salvarSetor(setor: Setor): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'setores', setor.id), removerUndefined(setor), { merge: true });
}

/**
 * Hierarquia organizacional flexível — coleção aditiva, não substitui
 * `listarSetores`/`salvarSetor` (mantidas intactas por compatibilidade).
 */
export async function listarUnidadesOrganizacionais(): Promise<UnidadeOrganizacional[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'unidadesOrganizacionais'));
  return resultado.docs.map((snapshot) => snapshot.data() as UnidadeOrganizacional);
}

export async function salvarUnidadeOrganizacional(unidade: UnidadeOrganizacional): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(
    doc(db, 'unidadesOrganizacionais', unidade.unidadeId),
    removerUndefined({ ...unidade, atualizadoEm: new Date().toISOString() }),
    { merge: true },
  );
}
