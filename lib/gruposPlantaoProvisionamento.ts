import { equipesConsultaEfetivas, type GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe } from './modelos';

/**
 * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1
 * (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção "Provisionamento
 * de Grupo de Plantão") — fonte única de como um `GrupoPlantao` é
 * construído a partir da equipe responsável já escolhida na UI (Wizard ou
 * `ModalGrupoPlantao` em Administração), para nunca duplicar essa
 * derivação em dois lugares divergentes.
 *
 * `Equipe` não é `GrupoPlantao`: uma equipe (mesmo com "Plantão" no nome)
 * nunca vira administrável para Plantão sozinha — só o `GrupoPlantao`
 * criado a partir dela é. Este módulo nunca decide QUANDO oferecer a
 * criação (isso é `lib/escoposOperacionais.ts`) — só COMO construir o
 * payload corretamente quando o usuário decide criar.
 */

export const TIMEZONE_PADRAO_GRUPO_PLANTAO = 'America/Sao_Paulo';

/** Nome inicial editável do Grupo: o nome real da equipe responsável já resolvida. */
export function sugerirNomeGrupoPlantao(
  equipeResponsavel: Pick<Equipe, 'nome'> | undefined,
): string {
  return equipeResponsavel?.nome.trim() ?? '';
}

/**
 * `unidadeResponsavelId`/`caminhoUnidadeResponsavel` NUNCA são digitados
 * pelo usuário — sempre copiados de `Equipe.unidadeId`/`caminhoUnidade` da
 * equipe responsável. Equipe sem unidade (legada, `unidadeId` ausente) ou
 * ainda não escolhida (`undefined`) produz os dois campos `undefined` —
 * retrocompatível, nunca inventa uma unidade.
 */
export function derivarUnidadeResponsavelDoGrupoPlantao(
  equipeResponsavel: Pick<Equipe, 'unidadeId' | 'caminhoUnidade'> | undefined,
): Pick<GrupoPlantao, 'unidadeResponsavelId' | 'caminhoUnidadeResponsavel'> {
  return {
    unidadeResponsavelId: equipeResponsavel?.unidadeId,
    caminhoUnidadeResponsavel: equipeResponsavel?.caminhoUnidade,
  };
}

/**
 * Constrói um `GrupoPlantao` novo, pronto para `validarGrupoPlantao()` +
 * `salvarGrupoPlantao()`, a partir da equipe responsável já resolvida.
 * `equipesConsulta` sempre passa por `equipesConsultaEfetivas()` — nunca
 * fica sem a própria equipe responsável, mesmo que o chamador esqueça de
 * incluí-la.
 */
export function construirGrupoPlantaoOficial(params: {
  grupoId: string;
  nome: string;
  descricao?: string;
  equipeResponsavel: Pick<Equipe, 'id' | 'unidadeId' | 'caminhoUnidade'>;
  equipesConsultaAdicionais?: readonly string[];
  criadoPorLogin: string;
  criadoEm: string;
}): GrupoPlantao {
  const { unidadeResponsavelId, caminhoUnidadeResponsavel } = derivarUnidadeResponsavelDoGrupoPlantao(params.equipeResponsavel);
  return {
    grupoId: params.grupoId,
    nome: params.nome,
    descricao: params.descricao,
    equipeResponsavelId: params.equipeResponsavel.id,
    equipesConsulta: equipesConsultaEfetivas(params.equipeResponsavel.id, params.equipesConsultaAdicionais),
    unidadeResponsavelId,
    caminhoUnidadeResponsavel,
    timezone: TIMEZONE_PADRAO_GRUPO_PLANTAO,
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: params.criadoPorLogin,
    criadoEm: params.criadoEm,
    atualizadoEm: params.criadoEm,
  };
}
