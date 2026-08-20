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

  const jornadasAdministraveis = admin
    ? equipesAtivas
    : equipesAtivas.filter((equipe) =>
      usuarioAdministraEscopo(usuario, escopoDoAlvo(escoposOperacionais, 'JORNADA', equipe.id)));

  const plantoesAdministraveis = admin
    ? gruposAtivos
    : gruposAtivos.filter((grupo) =>
      usuarioAdministraEscopo(usuario, escopoDoAlvo(escoposOperacionais, 'PLANTAO', grupo.grupoId)));

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
  };
}

export function criarIdEscopoOperacional(tipo: EscopoOperacional['tipo'], alvoId: string): string {
  return `${tipo}_${alvoId}`.replace(/[^A-Za-z0-9_-]/gu, '_');
}
