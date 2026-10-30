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
  /** EXCLUSAO-USUARIO-1 — remove o usuário dos Grupos de Plantão informados. */
  participacoesPlantao?: boolean;
}

/**
 * EXCLUSAO-USUARIO-1 — resultado por etapa. Antes, a primeira etapa que
 * falhasse (ex.: escalas) interrompia tudo e o cadastro nunca era apagado;
 * agora cada etapa roda de forma independente e o chamador mostra o que
 * deu certo e o que falhou.
 */
export interface ResultadoExclusaoUsuario {
  concluidas: string[];
  falhas: Array<{ etapa: string; erro: unknown }>;
  cadastroExcluido: boolean;
}

export async function excluirUsuario(
  candidato: Pick<Usuario, 'login' | 'equipeId'>,
  opcoes: OpcoesExclusaoUsuario,
  contexto: { gruposPlantaoIds?: readonly string[] } = {},
): Promise<ResultadoExclusaoUsuario> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const { login, equipeId } = candidato;
  const porEquipe = where('equipeId', '==', equipeId);
  const resultado: ResultadoExclusaoUsuario = { concluidas: [], falhas: [], cadastroExcluido: false };

  async function etapa(nome: string, executar: () => Promise<unknown>) {
    try {
      await executar();
      resultado.concluidas.push(nome);
    } catch (erro) {
      resultado.falhas.push({ etapa: nome, erro });
    }
  }

  if (opcoes.escalasPublicadas) {
    await etapa('Escalas publicadas', () => excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'turnosMes'), porEquipe, where('login', '==', login)),
    ));
  }
  if (opcoes.rascunhos) {
    await etapa('Rascunhos', () => excluirPorConsultaEmLotes(
      db,
      query(collection(db, 'rascunhosTurnosMes'), porEquipe, where('login', '==', login)),
    ));
  }
  if (opcoes.trocas) {
    await etapa('Trocas', async () => {
      await excluirPorConsultaEmLotes(
        db,
        query(collection(db, 'trocasEscala'), porEquipe, where('solicitanteLogin', '==', login)),
      );
      await excluirPorConsultaEmLotes(
        db,
        query(collection(db, 'trocasEscala'), porEquipe, where('destinatarioLogin', '==', login)),
      );
    });
  }
  if (opcoes.notificacoes) {
    await etapa('Notificações', async () => {
      await excluirPorConsultaEmLotes(
        db,
        query(collection(db, 'notificacoesTroca'), porEquipe, where('destinatarioLogin', '==', login)),
      );
      await excluirPorConsultaEmLotes(
        db,
        query(collection(db, 'notificacoesTroca'), porEquipe, where('criadoPorLogin', '==', login)),
      );
    });
  }
  if (opcoes.participacoesPlantao && (contexto.gruposPlantaoIds?.length ?? 0) > 0) {
    await etapa('Participação em Plantões', async () => {
      for (const grupoId of contexto.gruposPlantaoIds ?? []) {
        await deleteDoc(doc(db, 'gruposPlantao', grupoId, 'participantes', login));
      }
    });
  }
  // Cadastro por último: as demais etapas usam o login, e mesmo que alguma
  // falhe o cadastro ainda é apagado quando foi pedido.
  if (opcoes.cadastro) {
    await etapa('Cadastro', () => deleteDoc(doc(db, 'usuarios', login)));
    resultado.cadastroExcluido = resultado.concluidas.includes('Cadastro');
  }
  return resultado;
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
