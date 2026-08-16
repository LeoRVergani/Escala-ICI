import {
  idCompetenciaPlantao,
  type AtribuicaoPlantaoPersistida,
  type CompetenciaPlantao,
  type GrupoPlantao,
  type ParticipantePlantao,
} from '@escala-ici/contrato';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { exigirFirebase } from './shared';

/**
 * Leitura pura de Plantão (Fase PLANTÃO-3A) — sem React, sem parser XLS.
 * Cada função corresponde a uma consulta da seção "Operações de leitura"
 * de `docs/spec/PLANTOES.md`. Deliberadamente NÃO inclui
 * `localizarPlantaoNoInstante()`/`localizarProximoPlantao()` — essas só
 * fazem sentido sobre `competenciasPlantao` (PUBLICADA), que hoje não tem
 * nenhum dado real (a escrita está bloqueada até PLANTÃO-3C); adicionar
 * essas funções agora seria API especulativa sem dado para exercitar.
 */

export async function obterGrupoPlantao(grupoId: string): Promise<GrupoPlantao | null> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'gruposPlantao', grupoId));
  return snapshot.exists() ? (snapshot.data() as GrupoPlantao) : null;
}

/** Grupos cuja `equipesConsulta` inclui `equipeId` — "grupos que posso consultar" (seção 19 da spec). */
export async function listarGruposPlantaoPermitidos(equipeId: string): Promise<GrupoPlantao[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'gruposPlantao'),
    where('equipesConsulta', 'array-contains', equipeId),
  ));
  return resultado.docs.map((snapshot) => snapshot.data() as GrupoPlantao);
}

/**
 * Todos os Grupos, sem filtro de `equipesConsulta` — só ADMIN_SISTEMA
 * consegue de fato (a Rule de `gruposPlantao` dispensa o filtro só para
 * `souAdminSistema()`; qualquer outro perfil que chamar isto recebe
 * `permission-denied` do próprio Firestore, porque a query sem `where`
 * exigiria que TODO documento da coleção passasse na regra de leitura, não
 * só os que já viriam por `listarGruposPlantaoPermitidos()`). Usado pela
 * tela Administração › Plantões (Fase PLANTÃO-3B) para o ADMIN_SISTEMA
 * enxergar todos os grupos, inclusive os que sua própria equipe não
 * consulta.
 */
export async function listarTodosGruposPlantao(): Promise<GrupoPlantao[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'gruposPlantao'));
  return resultado.docs.map((snapshot) => snapshot.data() as GrupoPlantao);
}

export async function listarParticipantesPlantao(grupoId: string): Promise<ParticipantePlantao[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'gruposPlantao', grupoId, 'participantes'));
  return resultado.docs.map((snapshot) => snapshot.data() as ParticipantePlantao);
}

export async function obterCompetenciaPlantaoRascunho(
  grupoId: string,
  competencia: string,
): Promise<CompetenciaPlantao | null> {
  const { db } = exigirFirebase();
  const id = idCompetenciaPlantao(grupoId, competencia);
  const snapshot = await getDoc(doc(db, 'rascunhosCompetenciasPlantao', id));
  return snapshot.exists() ? (snapshot.data() as CompetenciaPlantao) : null;
}

export async function listarAtribuicoesPlantaoRascunho(
  grupoId: string,
  competencia: string,
): Promise<AtribuicaoPlantaoPersistida[]> {
  const { db } = exigirFirebase();
  const id = idCompetenciaPlantao(grupoId, competencia);
  const resultado = await getDocs(
    collection(db, 'rascunhosCompetenciasPlantao', id, 'atribuicoes'),
  );
  return resultado.docs.map((snapshot) => snapshot.data() as AtribuicaoPlantaoPersistida);
}
