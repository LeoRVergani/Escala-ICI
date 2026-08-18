import type { GrupoPlantao } from '@escala-ici/contrato';

import type { Equipe, Usuario } from './modelos';
import { ehAdminSistema, podeGerenciarEquipe, podeGerenciarGrupoPlantao, unidadesPermitidasEfetivas } from './sessao';

/**
 * Fase ESCALAS-SIMPLES-1 — "Área de gestão ativa" (`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`).
 * Puro, sem React/Firebase. NUNCA concede autorização — é só QUAL das
 * unidades já autorizadas está em foco agora na UI; a autorização real
 * continua exclusivamente em `podeGerenciarEquipe`/`podeGerenciarGrupoPlantao`
 * (que por sua vez espelham as Rules). ADMIN_SISTEMA pode escolher entre
 * QUALQUER unidade cadastrada (nunca preso a uma só — não faria sentido
 * restringi-lo a `unidadesPermitidasEfetivas`, que para ele tipicamente é
 * vazia); os demais perfis só entre as unidades que já os autorizam.
 */
export function unidadesDisponiveisParaGestao(
  usuario: Usuario,
  todasUnidadesIds: readonly string[],
): string[] {
  return ehAdminSistema(usuario) ? [...todasUnidadesIds] : unidadesPermitidasEfetivas(usuario);
}

/**
 * `null` = nenhuma resolução automática possível (zero ou mais de uma
 * disponível) — cabe à UI decidir o que fazer (mostrar seletor, ou operar
 * sem filtro de unidade quando não há nenhuma). Exatamente uma disponível
 * sempre vence, sem perguntar nada (§7 do pedido).
 */
export function resolverAreaGestaoAutomatica(disponiveis: readonly string[]): string | null {
  return disponiveis.length === 1 ? disponiveis[0] : null;
}

/**
 * Área ativa inicial: a preferência salva (sessão/local, nunca autorização —
 * ver §10 do pedido) só é usada quando ainda está entre as disponíveis
 * atuais — nunca escolhe algo fora do escopo vigente (ex.: usuário perdeu
 * acesso à unidade salva). Sem preferência válida, cai na resolução
 * automática (única disponível) ou `null`.
 */
export function areaGestaoInicial(
  disponiveis: readonly string[],
  preferenciaSalva: string | null,
): string | null {
  if (preferenciaSalva !== null && disponiveis.includes(preferenciaSalva)) {
    return preferenciaSalva;
  }
  return resolverAreaGestaoAutomatica(disponiveis);
}

/**
 * Equipes que o usuário realmente ADMINISTRA (nunca só pertencimento —
 * `podeGerenciarEquipe`) dentro da área de gestão ativa. `areaId === null`
 * significa "sem filtro de unidade" (usuário sem nenhuma unidade
 * cadastrada/resolvida) — nunca esconde equipes administráveis só porque o
 * conceito de área não se aplica a este usuário ainda.
 */
export function equipesAdministraveisNaArea(
  usuario: Usuario,
  equipes: readonly Equipe[],
  areaId: string | null,
): Equipe[] {
  return equipes.filter((equipe) => (
    podeGerenciarEquipe(usuario, equipe.id)
    && (areaId === null || equipe.unidadeId === areaId)
  ));
}

/**
 * Grupos de Plantão que o usuário realmente ADMINISTRA
 * (`podeGerenciarGrupoPlantao` — nunca `equipesConsulta`/pertencimento)
 * dentro da área de gestão ativa, resolvida pela unidade da EQUIPE
 * RESPONSÁVEL do grupo (um Grupo não tem `unidadeId` próprio).
 */
export function gruposAdministraveisNaArea(
  usuario: Usuario,
  grupos: readonly GrupoPlantao[],
  equipes: readonly Equipe[],
  areaId: string | null,
): GrupoPlantao[] {
  const unidadePorEquipe = new Map(equipes.map((equipe) => [equipe.id, equipe.unidadeId]));
  return grupos.filter((grupo) => (
    podeGerenciarGrupoPlantao(usuario, grupo.equipeResponsavelId)
    && (areaId === null || unidadePorEquipe.get(grupo.equipeResponsavelId) === areaId)
  ));
}
