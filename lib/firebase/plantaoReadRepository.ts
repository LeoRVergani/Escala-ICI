import {
  idCompetenciaPlantao,
  type AtribuicaoPlantaoPersistida,
  type CompetenciaPlantao,
  type GrupoPlantao,
  type ParticipantePlantao,
} from '@escala-ici/contrato';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';

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
 * Fase ESCOPO-GESTOR-UNIDADE-1 — Grupos cuja `unidadeResponsavelId`
 * (denormalizado, opcional/retrocompatível — ver `@escala-ici/contrato`)
 * é `unidadeId`. Complementa `listarGruposPlantaoPermitidos()`: aquela
 * função encontra Grupos pela ACL de CONSULTA (`equipesConsulta`), que não
 * necessariamente inclui a equipe pessoal de um `GESTOR_UNIDADE` — esta
 * encontra Grupos pela ADMINISTRAÇÃO por unidade, independente de o
 * gestor consultar o Grupo ou não (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`).
 * Um Grupo antigo sem o campo nunca aparece aqui — só em
 * `listarGruposPlantaoPermitidos()`/`listarTodosGruposPlantao()`.
 */
export async function listarGruposPlantaoPorUnidadeResponsavel(unidadeId: string): Promise<GrupoPlantao[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'gruposPlantao'),
    where('unidadeResponsavelId', '==', unidadeId),
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

/**
 * Fase ESCALAS-UX-1B.1 — todos os rascunhos (qualquer competência) de um
 * Grupo, para a tela "Plantões" listar "Abrir rascunho" sem o coordenador
 * precisar saber de antemão qual competência já foi salva. Mesmo
 * raciocínio do `where('grupoId', ...)` de `listarAtribuicoesPlantaoRascunho()`:
 * a Rule de `rascunhosCompetenciasPlantao/{id}` também depende de
 * `resource.data.grupoId` (não de uma variável de path), então o filtro
 * aqui é o que permite o Firestore validar este `list` para um
 * GESTOR_EQUIPE autorizado, não só para ADMIN_SISTEMA.
 */
export async function listarCompetenciasPlantaoRascunho(grupoId: string): Promise<CompetenciaPlantao[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'rascunhosCompetenciasPlantao'),
    where('grupoId', '==', grupoId),
  ));
  return resultado.docs.map((snapshot) => snapshot.data() as CompetenciaPlantao);
}

/**
 * Fase ESCALAS-UX-1B.1 — o `where('grupoId', ...)` aqui não é um filtro de
 * negócio (todo documento desta subcoleção já pertence a este `grupoId`
 * pelo próprio caminho) — é o que permite a Rule desta subcoleção (que
 * depende de `resource.data.grupoId`, não de uma variável de path, ver
 * `docs/spec/PLANTOES.md` § 21.8/§ 26.3) ser validada estaticamente pelo
 * Firestore para um `list` sem precisar avaliar a regra contra a coleção
 * inteira. Sem esse `where`, a mesma consulta falha no emulador para um
 * GESTOR_EQUIPE autorizado (funciona só para ADMIN_SISTEMA) — corrigido
 * aqui, no repository, sem nenhuma mudança em `firestore.rules`.
 * `orderBy('atribuicaoId')` garante ordem determinística (0001, 0002, ...)
 * — necessária para reidratar a working copy na mesma ordem em que foi
 * salva, já que `getDocs()` sem `orderBy` não garante ordem alguma.
 */
export async function listarAtribuicoesPlantaoRascunho(
  grupoId: string,
  competencia: string,
): Promise<AtribuicaoPlantaoPersistida[]> {
  const { db } = exigirFirebase();
  const id = idCompetenciaPlantao(grupoId, competencia);
  const resultado = await getDocs(query(
    collection(db, 'rascunhosCompetenciasPlantao', id, 'atribuicoes'),
    where('grupoId', '==', grupoId),
    orderBy('atribuicaoId'),
  ));
  return resultado.docs.map((snapshot) => snapshot.data() as AtribuicaoPlantaoPersistida);
}
