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
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

import { fatiarEmLotes } from './batches';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * Escrita de Plantão. As primitivas de rascunho permanecem separadas da
 * publicação explícita adicionada por ESCOPO-OPERACIONAL-MATRIZ-2.
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

/**
 * Fase ESCOPO-CONSULTA-PLANTAO-1
 * (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção "Plantões
 * monitorados por equipe") — autovínculo de CONSULTA: adiciona/remove
 * UMA equipe de `GrupoPlantao.equipesConsulta`, sem tocar em nenhum
 * outro campo. Deliberadamente separada de `salvarGrupoPlantao()`
 * (write genérico, exige administrar o Grupo inteiro) — esta função
 * autoriza um `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` a vincular a PRÓPRIA
 * equipe a um Grupo que ele não administra (`podeAutoVincularConsultaPlantao()`
 * em `firestore.rules`/`lib/sessao.ts` é quem valida isso de fato — esta
 * função só monta o payload mínimo e correto).
 *
 * Nunca remove `equipeResponsavelId` de `equipesConsulta` (lança erro
 * client-side antes mesmo de tentar — a Rule também nunca aceitaria).
 */
export async function atualizarEquipeConsultaPlantao(
  grupoId: string,
  equipeId: string,
  acao: 'ADICIONAR' | 'REMOVER',
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const referencia = doc(db, 'gruposPlantao', grupoId);
  const snapshot = await getDoc(referencia);
  if (!snapshot.exists()) {
    throw new Error(`Grupo de Plantão "${grupoId}" não encontrado.`);
  }
  const grupo = snapshot.data() as GrupoPlantao;
  if (acao === 'REMOVER' && equipeId === grupo.equipeResponsavelId) {
    throw new Error('A equipe responsável pelo Plantão não pode ser removida das equipes que consultam.');
  }
  const equipesConsultaAtual = grupo.equipesConsulta ?? [];
  const equipesConsultaNova = acao === 'ADICIONAR'
    ? [...new Set([...equipesConsultaAtual, equipeId])]
    : equipesConsultaAtual.filter((item) => item !== equipeId);
  await updateDoc(referencia, removerUndefined({
    equipesConsulta: equipesConsultaNova,
    atualizadoEm: new Date().toISOString(),
  }));
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

/** Recusa qualquer status diferente de `RASCUNHO`; publicação usa a função dedicada abaixo. */
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

/**
 * Publica a competência pelo `grupoId` que já faz parte do próprio modelo.
 * O Grupo — e nunca `equipeResponsavelId` — é a chave mensal. A cópia
 * publicada recebe uma revisão positiva e o rascunho é removido apenas
 * depois que todas as escritas publicadas terminam com sucesso.
 */
export async function publicarCompetenciaPlantao(
  competenciaRascunho: CompetenciaPlantao,
  atribuicoesRascunho: readonly AtribuicaoPlantaoPersistida[],
): Promise<CompetenciaPlantao> {
  exigirEscritaAdministrativaHabilitada();
  if (competenciaRascunho.status !== 'RASCUNHO') {
    throw new Error('Somente um rascunho de Plantão pode ser publicado.');
  }
  if (atribuicoesRascunho.some((atribuicao) =>
    atribuicao.grupoId !== competenciaRascunho.grupoId
    || atribuicao.competenciaId !== competenciaRascunho.id)) {
    throw new Error('Todas as atribuições devem pertencer ao mesmo Grupo e competência.');
  }

  const { db } = exigirFirebase();
  const publicadaRef = doc(db, 'competenciasPlantao', competenciaRascunho.id);
  const publicadaAtual = await getDoc(publicadaRef);
  const publicadaAnterior = publicadaAtual.exists() ? publicadaAtual.data() as CompetenciaPlantao : null;
  const revisao = Number(publicadaAnterior?.revisao ?? 0) + 1;
  const agora = new Date().toISOString();
  const publicada: CompetenciaPlantao = {
    ...competenciaRascunho,
    status: 'PUBLICADA',
    revisao,
    criadoPorLogin: publicadaAnterior?.criadoPorLogin ?? competenciaRascunho.criadoPorLogin,
    criadoEm: publicadaAnterior?.criadoEm ?? competenciaRascunho.criadoEm,
    atualizadoEm: agora,
  };
  const errosCompetencia = validarCompetenciaPlantao(publicada);
  if (errosCompetencia.length > 0) {
    throw new Error(errosCompetencia.join(' '));
  }
  const atribuicoesPublicadas = atribuicoesRascunho.map((atribuicao) => ({
    ...atribuicao,
    revisao,
    atualizadoEm: agora,
  }));
  for (const atribuicao of atribuicoesPublicadas) {
    const erros = validarAtribuicaoPlantaoPersistida(atribuicao);
    if (erros.length > 0) throw new Error(`Atribuição ${atribuicao.atribuicaoId}: ${erros.join(' ')}`);
  }

  const operacoes = [
    { tipo: 'competencia' as const },
    ...atribuicoesPublicadas.map((atribuicao) => ({ tipo: 'atribuicao' as const, atribuicao })),
  ];
  for (const lote of fatiarEmLotes(operacoes, 499)) {
    const batch = writeBatch(db);
    for (const operacao of lote) {
      if (operacao.tipo === 'competencia') {
        batch.set(publicadaRef, removerUndefined(publicada));
      } else {
        batch.set(
          doc(db, 'competenciasPlantao', publicada.id, 'atribuicoes', operacao.atribuicao.atribuicaoId),
          removerUndefined(operacao.atribuicao),
        );
      }
    }
    await batch.commit();
  }

  const rascunhos = await getDocs(query(
    collection(db, 'rascunhosCompetenciasPlantao', competenciaRascunho.id, 'atribuicoes'),
    where('grupoId', '==', competenciaRascunho.grupoId),
  ));
  for (const lote of fatiarEmLotes(rascunhos.docs, 499)) {
    const batch = writeBatch(db);
    for (const snapshot of lote) batch.delete(snapshot.ref);
    await batch.commit();
  }
  const batchFinal = writeBatch(db);
  batchFinal.delete(doc(db, 'rascunhosCompetenciasPlantao', competenciaRascunho.id));
  await batchFinal.commit();
  return publicada;
}
