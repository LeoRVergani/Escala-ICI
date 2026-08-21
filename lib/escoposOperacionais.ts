import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, EscopoOperacional, PerfilUsuario, UnidadeOrganizacional, Usuario } from './modelos';
import { resolverMatrizOperacional } from './escoposOperacionaisMatriz';
import {
  ehAdminSistema,
  equipesPermitidasEfetivas,
  perfilEfetivo,
  podeGerenciarGrupoPlantao,
  unidadesPermitidasEfetivas,
} from './sessao';

/**
 * Fonte única do escopo operacional do usuário (Fase
 * ESCOPO-GESTOR-UNIDADE-1) — ver `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`.
 *
 * Módulo puro: recebe o usuário efetivo e os dados já carregados
 * (nunca busca nada sozinho, nunca depende de Firestore/React) e devolve
 * as cinco listas que Administração, Escalas, Jornada 6x1, Plantão e o
 * seletor superior consomem — para nenhum desses lugares reimplementar a
 * mesma regra de autorização de formas ligeiramente diferentes (a mesma
 * causa raiz que deixou `GESTOR_UNIDADE` sem conseguir administrar
 * Plantão apesar de `firestore.rules`/`ADMINISTRACAO_E_HIERARQUIA.md` já
 * preverem o poder de gestor sobre a unidade).
 */
export interface EscoposOperacionais {
  /** Unidades organizacionais ativas dentro do escopo administrativo do usuário. */
  unidadesAdministraveis: UnidadeOrganizacional[];
  /** Toda equipe ativa administrável — inclui as que existem exclusivamente para Plantão. */
  equipesAdministraveis: Equipe[];
  /**
   * Subconjunto de `equipesAdministraveis` que NÃO é a equipe responsável de
   * nenhum Grupo de Plantão conhecido — as únicas equipes que fazem sentido
   * como destino de uma Jornada 6x1. Nunca decidido por nome/sigla: só pela
   * relação `GrupoPlantao.equipeResponsavelId` já cadastrada.
   */
  jornadasAdministraveis: Equipe[];
  /** Grupos de Plantão (ativos ou não) que o usuário administra de fato. */
  gruposPlantaoAdministraveis: GrupoPlantao[];
  /** Alias de `gruposPlantaoAdministraveis` — nome usado pelo seletor superior/Wizard ao oferecer destinos de "Nova escala > Plantão". */
  plantoesAdministraveis: GrupoPlantao[];
  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — Grupos ATIVOS que alguma equipe do
   * usuário (`equipesPermitidasEfetivas`, a mesma equipe que ele pertence/
   * administra) consulta (`equipesConsulta`), mas que ele NÃO administra
   * de fato (mutuamente exclusivo de `gruposPlantaoAdministraveis` — regra
   * 8 do resolver). Nunca é destino de "Nova escala"/"Importar escala" —
   * consulta não é administração (`docs/spec/HIERARQUIA_ORGANIZACIONAL.md`
   * § 9). `ADMIN_SISTEMA` nunca tem nada aqui — para ele tudo é
   * administrável, nunca "só consulta".
   */
  plantoesConsultaveis: GrupoPlantao[];
  /** Alias semântico usado pela UI: monitoramento é consulta, não edição. */
  plantoesMonitorados: GrupoPlantao[];
  alvosDisponiveisParaConfiguracao: {
    jornadas: Equipe[];
    plantoes: GrupoPlantao[];
  };
}

const PERFIS_GESTOR_DE_EQUIPE: ReadonlySet<PerfilUsuario> = new Set(['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE']);

/**
 * `true` se `unidadeId` está literalmente em `permitidas`, OU se `caminho`
 * (o caminho materializado raiz -> nó, já calculado na criação — nunca
 * travessia de `parentId` em tempo de leitura) contém alguma unidade
 * permitida como ancestral. É o mesmo mecanismo usado por
 * `Equipe.caminhoUnidade`/`GrupoPlantao.caminhoUnidadeResponsavel` para
 * autorizar um `GESTOR_UNIDADE` sobre toda a subárvore da sua unidade, não
 * só o nó exato.
 */
function dentroDoEscopoPermitido(
  unidadeId: string | undefined,
  caminho: readonly string[] | undefined,
  permitidas: readonly string[],
): boolean {
  if (unidadeId !== undefined && permitidas.includes(unidadeId)) {
    return true;
  }
  return caminho?.some((id) => permitidas.includes(id)) ?? false;
}

export function resolverEscoposOperacionais(
  usuarioEfetivo: Usuario,
  unidadesOrganizacionais: readonly UnidadeOrganizacional[],
  equipes: readonly Equipe[],
  gruposPlantao: readonly GrupoPlantao[],
  escoposOperacionais: readonly EscopoOperacional[] = [],
  opcoes: { permitirFallbackLegado?: boolean } = {},
): EscoposOperacionais {
  const admin = ehAdminSistema(usuarioEfetivo);
  const perfil = perfilEfetivo(usuarioEfetivo);
  const unidadesPermitidas = unidadesPermitidasEfetivas(usuarioEfetivo);
  const equipesPermitidasExplicitas = equipesPermitidasEfetivas(usuarioEfetivo);
  const ehGestorUnidade = perfil === 'GESTOR_UNIDADE';
  const ehGestorDeEquipe = PERFIS_GESTOR_DE_EQUIPE.has(perfil);

  const unidadesAdministraveis = unidadesOrganizacionais.filter((unidade) =>
    unidade.ativa
    && (admin || (ehGestorUnidade && dentroDoEscopoPermitido(unidade.unidadeId, unidade.caminho, unidadesPermitidas))));

  const equipesAdministraveis = equipes.filter((equipe) =>
    equipe.ativa
    && (
      admin
      || (ehGestorUnidade && dentroDoEscopoPermitido(equipe.unidadeId, equipe.caminhoUnidade, unidadesPermitidas))
      || (ehGestorDeEquipe && equipesPermitidasExplicitas.includes(equipe.id))
    ));

  const matriz = resolverMatrizOperacional({
    usuario: usuarioEfetivo,
    equipes,
    gruposPlantao,
    escoposOperacionais,
  });

  const idsEquipeResponsavelPlantao = new Set(gruposPlantao.filter((grupo) => grupo.ativo).map((grupo) => grupo.equipeResponsavelId));
  const permitirFallbackLegado = opcoes.permitirFallbackLegado === true;
  const jornadasFallback = permitirFallbackLegado
    ? equipesAdministraveis.filter((equipe) => !idsEquipeResponsavelPlantao.has(equipe.id))
    : [];
  const jornadasAdministraveis = [
    ...matriz.jornadasAdministraveis,
    ...jornadasFallback.filter((equipe) => !matriz.alvoTemMatriz('JORNADA', equipe.id)),
  ].filter((equipe, indice, lista) => lista.findIndex((item) => item.id === equipe.id) === indice);

  const gruposPlantaoFallback = permitirFallbackLegado
    ? gruposPlantao.filter((grupo) => grupo.ativo && podeGerenciarGrupoPlantao(usuarioEfetivo, grupo))
    : [];
  const gruposPlantaoAdministraveis = [
    ...matriz.plantoesAdministraveis,
    ...gruposPlantaoFallback.filter((grupo) => !matriz.alvoTemMatriz('PLANTAO', grupo.grupoId)),
  ].filter((grupo, indice, lista) => lista.findIndex((item) => item.grupoId === grupo.grupoId) === indice);

  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — `equipesPermitidasEfetivas()` (não
   * `equipesAdministraveis` acima) é a base certa aqui: qualquer membro de
   * uma equipe (não só quem a administra) já pode CONSULTAR um Grupo cuja
   * equipe esteja em `equipesConsulta` (`podeConsultarGrupoPlantao()` em
   * `firestore.rules`) — a mesma semântica vale para o agregado do
   * resolver. `ADMIN_SISTEMA` nunca aparece aqui: para ele, tudo já é
   * `gruposPlantaoAdministraveis`.
   */
  const idsGruposAdministraveis = new Set(gruposPlantaoAdministraveis.map((grupo) => grupo.grupoId));
  const equipesConsultaBase = equipesPermitidasEfetivas(usuarioEfetivo);
  const plantoesConsultaveisFallback = admin || !permitirFallbackLegado
    ? []
    : gruposPlantao.filter((grupo) =>
      grupo.ativo
      && !idsGruposAdministraveis.has(grupo.grupoId)
      && !matriz.alvoTemMatriz('PLANTAO', grupo.grupoId)
      && grupo.equipesConsulta.some((equipeId) => equipesConsultaBase.includes(equipeId)));
  const plantoesConsultaveis = [
    ...matriz.plantoesConsultaveis.filter((grupo) => !idsGruposAdministraveis.has(grupo.grupoId)),
    ...plantoesConsultaveisFallback,
  ].filter((grupo, indice, lista) => lista.findIndex((item) => item.grupoId === grupo.grupoId) === indice);

  return {
    unidadesAdministraveis,
    equipesAdministraveis,
    jornadasAdministraveis,
    gruposPlantaoAdministraveis,
    plantoesAdministraveis: gruposPlantaoAdministraveis,
    plantoesConsultaveis,
    plantoesMonitorados: plantoesConsultaveis,
    alvosDisponiveisParaConfiguracao: matriz.alvosDisponiveisParaConfiguracao,
  };
}

/**
 * Fase ESCOPO-CONSULTA-PLANTAO-1 — "Plantões monitorados pela equipe":
 * dado um `equipeId` ESPECÍFICO (o gestor/supervisor pode administrar mais
 * de uma equipe — a Administração escolhe uma por vez, ex.: NOC), quais
 * Grupos ATIVOS essa equipe já consulta. Puro e parametrizado por equipe
 * (não pelo usuário logado) porque a tela "Plantões monitorados" configura
 * uma EQUIPE, não a sessão do usuário — ver `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`.
 */
export function plantoesMonitoradosPelaEquipe(
  gruposPlantao: readonly GrupoPlantao[],
  equipeId: string,
): GrupoPlantao[] {
  return gruposPlantao.filter((grupo) => grupo.ativo && grupo.equipesConsulta.includes(equipeId));
}

/** Complemento de `plantoesMonitoradosPelaEquipe()` — Grupos ativos que a equipe ainda NÃO consulta, candidatos a marcar. */
export function plantoesDisponiveisParaMonitoramento(
  gruposPlantao: readonly GrupoPlantao[],
  equipeId: string,
): GrupoPlantao[] {
  return gruposPlantao.filter((grupo) => grupo.ativo && !grupo.equipesConsulta.includes(equipeId));
}
