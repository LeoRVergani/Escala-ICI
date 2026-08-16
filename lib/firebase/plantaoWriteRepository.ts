import {
  validarAtribuicaoPlantaoPersistida,
  validarCompetenciaPlantao,
  validarGrupoPlantao,
  validarParticipantePlantao,
  type AtribuicaoPlantaoPersistida,
  type CompetenciaPlantao,
  type GrupoPlantao,
  type ParticipantePlantao,
} from '@escala-ici/contrato';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

import { fatiarEmLotes } from './batches';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * Escrita pura de Plantão (Fase PLANTÃO-3A) — primitivas administrativas
 * de fundação. NENHUMA função aqui publica (`publicarPlantao()` não
 * existe: ver `docs/spec/PLANTOES.md`, publicação é PLANTÃO-3C). O
 * preview da PLANTÃO-2 (`apps/dashboard/src/DashboardApp.tsx`) NÃO chama
 * nenhuma função deste arquivo — a integração é PLANTÃO-3B.
 *
 * Cada função valida com `validar*()` de `@escala-ici/contrato` ANTES de
 * qualquer chamada ao SDK — os mesmos campos são revalidados pelo
 * `firestore.rules`, mas a validação client-side dá uma mensagem de erro
 * legível em vez de um `permission-denied` genérico. `removerUndefined()`
 * (mesmo helper de `writeRepository.ts`) evita o erro "Unsupported field
 * value: undefined" em qualquer campo opcional ausente.
 */

export async function salvarGrupoPlantao(grupo: GrupoPlantao): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const erros = validarGrupoPlantao(grupo);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'gruposPlantao', grupo.grupoId), removerUndefined(grupo));
}

export async function salvarParticipantePlantao(participante: ParticipantePlantao): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const erros = validarParticipantePlantao(participante);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
  const { db } = exigirFirebase();
  await setDoc(
    doc(db, 'gruposPlantao', participante.grupoId, 'participantes', participante.login),
    removerUndefined(participante),
  );
}

/** Nunca exclui fisicamente — mesmo princípio de `equipes`/`unidadesOrganizacionais` (`ativo: false`). */
export async function desativarParticipantePlantao(grupoId: string, login: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'gruposPlantao', grupoId, 'participantes', login), {
    ativo: false,
    atualizadoEm: new Date().toISOString(),
  });
}

/** Recusa qualquer status diferente de `RASCUNHO` — publicar é PLANTÃO-3C, não esta fase. */
export async function salvarCompetenciaPlantaoRascunho(competencia: CompetenciaPlantao): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  if (competencia.status !== 'RASCUNHO') {
    throw new Error('Esta fase só permite salvar competências de Plantão como RASCUNHO.');
  }
  const erros = validarCompetenciaPlantao(competencia);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
  const { db } = exigirFirebase();
  await setDoc(
    doc(db, 'rascunhosCompetenciasPlantao', competencia.id),
    removerUndefined(competencia),
  );
}

/**
 * Grava as atribuições em lotes de até 499 (mesmo limite de
 * `salvarRascunho()` em `writeRepository.ts`, uma unidade abaixo do
 * máximo de 500 do Firestore). Valida cada atribuição antes de commitar
 * qualquer lote — uma atribuição inválida no meio da lista impede a
 * gravação de todas, em vez de gravar parcialmente.
 */
export async function salvarAtribuicoesPlantaoRascunho(
  competenciaId: string,
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();

  for (const atribuicao of atribuicoes) {
    const erros = validarAtribuicaoPlantaoPersistida(atribuicao);
    if (erros.length > 0) {
      throw new Error(`Atribuição ${atribuicao.atribuicaoId}: ${erros.join(' ')}`);
    }
  }

  const { db } = exigirFirebase();
  const lotes = fatiarEmLotes(atribuicoes, 499);
  for (const lote of lotes) {
    const batch = writeBatch(db);
    for (const atribuicao of lote) {
      batch.set(
        doc(db, 'rascunhosCompetenciasPlantao', competenciaId, 'atribuicoes', atribuicao.atribuicaoId),
        removerUndefined(atribuicao),
      );
    }
    await batch.commit();
  }
}
