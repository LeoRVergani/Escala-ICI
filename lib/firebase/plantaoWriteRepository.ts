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
import { collection, doc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

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
 *
 * Fase ESCALAS-UX-1B.1 — o estado persistido de um RASCUNHO precisa
 * refletir EXATAMENTE a working copy no momento de salvar, nunca só
 * "tudo que está em `atribuicoes` foi gravado" — o `atribuicaoId`
 * (`idAtribuicaoPlantao(indice)`) é posicional, então reabrir um
 * rascunho e EXCLUIR uma atribuição no meio reduz o comprimento do
 * array e reatribui IDs às atribuições restantes; sem uma etapa de
 * limpeza, o documento que tinha o ID mais alto antes nunca é
 * sobrescrito nem apagado — fica órfão no Firestore para sempre. Por
 * isso esta função agora lê os IDs já persistidos desta competência
 * (`grupoId` é parâmetro explícito, nunca derivado de `atribuicoes[0]` —
 * excluir TODAS as atribuições produz um array vazio, que não teria
 * como indicar de quem são os documentos a limpar) e inclui um
 * `batch.delete()` para cada ID que não está mais na lista nova, no
 * MESMO lote de escrita das atualizações — nunca uma segunda chamada
 * separada que poderia falhar sozinha e deixar o Firestore num estado
 * misto.
 */
export async function salvarAtribuicoesPlantaoRascunho(
  grupoId: string,
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
  const colecaoAtribuicoes = collection(db, 'rascunhosCompetenciasPlantao', competenciaId, 'atribuicoes');

  const idsAtuais = new Set(atribuicoes.map((atribuicao) => atribuicao.atribuicaoId));
  const existentes = await getDocs(query(colecaoAtribuicoes, where('grupoId', '==', grupoId)));
  const idsParaExcluir = existentes.docs
    .map((snapshot) => snapshot.id)
    .filter((id) => !idsAtuais.has(id));

  type OperacaoLote =
    | { tipo: 'set'; atribuicaoId: string; dados: AtribuicaoPlantaoPersistida }
    | { tipo: 'delete'; atribuicaoId: string };
  const operacoes: OperacaoLote[] = [
    ...atribuicoes.map((atribuicao): OperacaoLote => ({ tipo: 'set', atribuicaoId: atribuicao.atribuicaoId, dados: atribuicao })),
    ...idsParaExcluir.map((atribuicaoId): OperacaoLote => ({ tipo: 'delete', atribuicaoId })),
  ];

  const lotes = fatiarEmLotes(operacoes, 499);
  for (const lote of lotes) {
    const batch = writeBatch(db);
    for (const operacao of lote) {
      const referencia = doc(db, 'rascunhosCompetenciasPlantao', competenciaId, 'atribuicoes', operacao.atribuicaoId);
      if (operacao.tipo === 'set') {
        batch.set(referencia, removerUndefined(operacao.dados));
      } else {
        batch.delete(referencia);
      }
    }
    await batch.commit();
  }
}
