import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, EscopoOperacional, PerfilUsuario, Usuario } from './modelos';
import { ehAdminSistema, equipesPermitidasEfetivas, perfilEfetivo } from './sessao';

export const PERFIS_RESPONSAVEL_OPERACIONAL_ELEGIVEIS: ReadonlySet<PerfilUsuario> = new Set([
  'ADMIN_SISTEMA',
  'GESTOR_UNIDADE',
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
]);

export interface ResultadoMatrizOperacional {
  jornadasAdministraveis: Equipe[];
  plantoesAdministraveis: GrupoPlantao[];
  plantoesMonitorados: GrupoPlantao[];
  plantoesConsultaveis: GrupoPlantao[];
  alvosDisponiveisParaConfiguracao: {
    jornadas: Equipe[];
    plantoes: GrupoPlantao[];
  };
  alvoTemMatriz: (tipo: EscopoOperacional['tipo'], alvoId: string) => boolean;
  /**
   * HOTFIX-STAGING-MATRIZ-BOOTSTRAP-1 — `true` quando o fallback AMPLO de
   * staging (`permitirAmploStaging`, espelha `souCoordenadorOperacionalStaging()`
   * de `firestore.rules`) ainda pode complementar a Matriz para este alvo:
   * sem Matriz nenhuma, OU Matriz só com o placeholder técnico de bootstrap
   * (ver `estadoMatrizOperacional()`). Nunca usado pelo fallback LEGADO
   * (`permitirFallbackLegado`), que continua gateado só por `alvoTemMatriz`
   * — sua semântica é fixada por `tests/dashboard-contexto-escala-boundaries.test.mjs`
   * e não muda nesta fase.
   */
  fallbackStagingPermitidoParaAlvo: (tipo: EscopoOperacional['tipo'], alvoId: string) => boolean;
}

/** Versão SEM o filtro `.ativo` de `escopoDoAlvo()` — precisa enxergar Matriz INATIVA para classificar estado. */
function escopoBrutoDoAlvo(
  escopos: readonly EscopoOperacional[],
  tipo: EscopoOperacional['tipo'],
  alvoId: string,
): EscopoOperacional | undefined {
  return escopos.find((escopo) => escopo.tipo === tipo && escopo.alvoId === alvoId);
}

function escopoDoAlvo(
  escopos: readonly EscopoOperacional[],
  tipo: EscopoOperacional['tipo'],
  alvoId: string,
): EscopoOperacional | undefined {
  return escopos.find((escopo) => escopo.tipo === tipo && escopo.alvoId === alvoId && escopo.ativo);
}

function alvoTemQualquerMatriz(
  escopos: readonly EscopoOperacional[],
  tipo: EscopoOperacional['tipo'],
  alvoId: string,
): boolean {
  return escopos.some((escopo) => escopo.tipo === tipo && escopo.alvoId === alvoId);
}

/**
 * Login técnico do seed inicial de staging (`scripts/staging/hierarquia-ici.mjs`,
 * `MATRIZ_INICIAL`) — uma conta técnica genérica, nunca uma pessoa real.
 * Preenche a exigência de schema de `escopoOperacionalValido()` (`responsaveisLogin`
 * ou `responsaveisEquipe` não vazio) enquanto nenhum responsável humano foi
 * cadastrado ainda. Nunca espalhar a string literal `'admin'` por outros
 * módulos — importar esta constante.
 */
export const LOGIN_ADMIN_TECNICO_STAGING = 'admin';

export type EstadoMatrizOperacional = 'AUSENTE' | 'BOOTSTRAP' | 'CONFIGURADA' | 'INATIVA';

/**
 * HOTFIX-STAGING-MATRIZ-BOOTSTRAP-1 — classifica a Matriz de um alvo em um
 * dos quatro estados que decidem se o fallback AMPLO de staging pode
 * complementá-la (`docs/spec/PLANTAO_CODB.md`, seção "Precedência da Matriz
 * em staging"):
 *
 * - `AUSENTE`: nenhum documento de Matriz para tipo+alvoId — fallback pode
 *   ajudar (finalidade original de staging).
 * - `BOOTSTRAP`: Matriz ativa, mas só lista o placeholder técnico
 *   (`responsaveisLogin` contém SOMENTE `LOGIN_ADMIN_TECNICO_STAGING`,
 *   `responsaveisEquipe` vazio) — nenhuma responsabilidade humana real
 *   ainda cadastrada, fallback pode ajudar.
 * - `CONFIGURADA`: Matriz ativa com pelo menos uma responsabilidade real
 *   (um login diferente do técnico, OU `responsaveisEquipe` não vazio) — a
 *   Matriz passa a ser autoridade única; fallback nunca complementa, mesmo
 *   que o próprio usuário não esteja entre os responsáveis listados.
 * - `INATIVA`: `ativo === false` — decisão operacional explícita (ex.:
 *   `escoposOperacionais/PLANTAO_NOC`, tombstone temporário de um Grupo
 *   legado desativado). Fail-closed: nenhum fallback (legado ou amplo)
 *   pode reviver o alvo.
 */
export function estadoMatrizOperacional(
  escopos: readonly EscopoOperacional[],
  tipo: EscopoOperacional['tipo'],
  alvoId: string,
): EstadoMatrizOperacional {
  const escopo = escopoBrutoDoAlvo(escopos, tipo, alvoId);
  if (escopo === undefined) {
    return 'AUSENTE';
  }
  if (!escopo.ativo) {
    return 'INATIVA';
  }
  const somenteAdminTecnico = escopo.responsaveisLogin.every((login) => login === LOGIN_ADMIN_TECNICO_STAGING);
  const semResponsavelDeEquipe = escopo.responsaveisEquipe.length === 0;
  return somenteAdminTecnico && semResponsavelDeEquipe ? 'BOOTSTRAP' : 'CONFIGURADA';
}

function calcularFallbackStagingPermitidoParaAlvo(
  escopos: readonly EscopoOperacional[],
  tipo: EscopoOperacional['tipo'],
  alvoId: string,
): boolean {
  const estado = estadoMatrizOperacional(escopos, tipo, alvoId);
  return estado === 'AUSENTE' || estado === 'BOOTSTRAP';
}

/**
 * Responsável operacional administra escala. A regra usa `perfil` explícito
 * via `perfilEfetivo()`. O fallback por `nivelHierarquico` existe apenas
 * como compatibilidade transitória para documentos legados sem `perfil`.
 */
export function usuarioEhResponsavelOperacionalElegivel(usuario: Usuario): boolean {
  return usuario.ativo && PERFIS_RESPONSAVEL_OPERACIONAL_ELEGIVEIS.has(perfilEfetivo(usuario));
}

export function usuariosResponsaveisOperacionaisElegiveis(usuarios: readonly Usuario[]): Usuario[] {
  return usuarios
    .filter(usuarioEhResponsavelOperacionalElegivel)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function particionarResponsaveisLoginPorElegibilidade(
  logins: readonly string[],
  usuarios: readonly Usuario[],
): { elegiveis: string[]; naoElegiveis: string[] } {
  return logins.reduce<{ elegiveis: string[]; naoElegiveis: string[] }>((resultado, login) => {
    const usuario = usuarios.find((item) => item.login === login);
    if (usuario !== undefined && usuarioEhResponsavelOperacionalElegivel(usuario)) {
      resultado.elegiveis.push(login);
    } else {
      resultado.naoElegiveis.push(login);
    }
    return resultado;
  }, { elegiveis: [], naoElegiveis: [] });
}

function usuarioAdministraEscopo(usuario: Usuario, escopo: EscopoOperacional | undefined): boolean {
  if (escopo === undefined || !escopo.ativo) {
    return false;
  }
  if (escopo.responsaveisLogin.includes(usuario.login) && usuarioEhResponsavelOperacionalElegivel(usuario)) {
    return true;
  }
  const equipesUsuario = equipesPermitidasEfetivas(usuario);
  return escopo.responsaveisEquipe.some((equipeId) => equipesUsuario.includes(equipeId));
}

function usuarioConsultaEscopo(usuario: Usuario, escopo: EscopoOperacional | undefined): boolean {
  if (escopo === undefined || !escopo.ativo) {
    return false;
  }
  const equipesUsuario = equipesPermitidasEfetivas(usuario);
  return escopo.equipesConsulta.some((equipeId) => equipesUsuario.includes(equipeId));
}

/** Gate puro compartilhável por comandos de abrir/salvar/publicar. */
export function usuarioPodeAdministrarAlvoOperacional(
  usuario: Usuario,
  escopos: readonly EscopoOperacional[],
  tipo: EscopoOperacional['tipo'],
  alvoId: string,
): boolean {
  return ehAdminSistema(usuario) || usuarioAdministraEscopo(usuario, escopoDoAlvo(escopos, tipo, alvoId));
}

/** Consulta/monitoramento nunca equivale ao gate de administração acima. */
export function usuarioPodeConsultarPlantaoOperacional(
  usuario: Usuario,
  escopos: readonly EscopoOperacional[],
  grupoId: string,
): boolean {
  return ehAdminSistema(usuario)
    || usuarioAdministraEscopo(usuario, escopoDoAlvo(escopos, 'PLANTAO', grupoId))
    || usuarioConsultaEscopo(usuario, escopoDoAlvo(escopos, 'PLANTAO', grupoId));
}

export function resolverMatrizOperacional(params: {
  usuario: Usuario;
  equipes: readonly Equipe[];
  gruposPlantao: readonly GrupoPlantao[];
  escoposOperacionais: readonly EscopoOperacional[];
}): ResultadoMatrizOperacional {
  const { usuario, equipes, gruposPlantao, escoposOperacionais } = params;
  const admin = ehAdminSistema(usuario);
  const equipesAtivas = equipes.filter((equipe) => equipe.ativa);
  const gruposAtivos = gruposPlantao.filter((grupo) => grupo.ativo);

  const jornadasAdministraveis = equipesAtivas.filter((equipe) => {
    const escopo = escopoDoAlvo(escoposOperacionais, 'JORNADA', equipe.id);
    return admin ? escopo !== undefined : usuarioAdministraEscopo(usuario, escopo);
  });

  const plantoesAdministraveis = gruposAtivos.filter((grupo) => {
    const escopo = escopoDoAlvo(escoposOperacionais, 'PLANTAO', grupo.grupoId);
    return admin ? escopo !== undefined : usuarioAdministraEscopo(usuario, escopo);
  });

  const idsPlantoesAdministraveis = new Set(plantoesAdministraveis.map((grupo) => grupo.grupoId));
  const plantoesConsultaveis = admin
    ? []
    : gruposAtivos.filter((grupo) =>
      !idsPlantoesAdministraveis.has(grupo.grupoId)
      && usuarioConsultaEscopo(usuario, escopoDoAlvo(escoposOperacionais, 'PLANTAO', grupo.grupoId)));

  return {
    jornadasAdministraveis,
    plantoesAdministraveis,
    plantoesMonitorados: plantoesConsultaveis,
    plantoesConsultaveis,
    alvosDisponiveisParaConfiguracao: {
      jornadas: equipesAtivas,
      plantoes: gruposAtivos,
    },
    alvoTemMatriz: (tipo, alvoId) => alvoTemQualquerMatriz(escoposOperacionais, tipo, alvoId),
    fallbackStagingPermitidoParaAlvo: (tipo, alvoId) => calcularFallbackStagingPermitidoParaAlvo(escoposOperacionais, tipo, alvoId),
  };
}

export function criarIdEscopoOperacional(tipo: EscopoOperacional['tipo'], alvoId: string): string {
  return `${tipo}_${alvoId}`.replace(/[^A-Za-z0-9_-]/gu, '_');
}
