import type { Usuario } from './modelos';
import { perfilEfetivo } from './sessao';

const PERFIS_COM_PODER_DE_GESTAO = new Set([
  'ADMIN_SISTEMA',
  'GESTOR_UNIDADE',
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
]);

const PERFIS_DELEGAVEIS_POR_RESPONSAVEL = new Set([
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
]);

/**
 * STAGING-RESET-HIERARQUIA-ICI-2 — em staging (`permitirAmploStaging`),
 * coordenador/supervisor também pode cadastrar outro `GESTOR_UNIDADE` (não
 * só `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE`), espelhando
 * `perfilCadastroLivreStagingValido()` de `firestore.rules`. `ADMIN_SISTEMA`
 * nunca entra aqui, em nenhum dos dois conjuntos.
 */
const PERFIS_DELEGAVEIS_STAGING = new Set([
  'GESTOR_UNIDADE',
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
]);

/**
 * Detecta se um cadastro novo já nasceria com poder de gestão. Isso inclui
 * documentos legados sem `perfil`: `nivelHierarquico <= 5` ainda cai em
 * GESTOR_EQUIPE por compatibilidade, portanto não pode ser usado por um
 * gestor comum como atalho para promover outra pessoa.
 */
export function cadastroUsuarioConcedeGestao(candidato: Usuario): boolean {
  return PERFIS_COM_PODER_DE_GESTAO.has(perfilEfetivo(candidato));
}

/**
 * Um coordenador responsável pode formar outro coordenador/supervisor somente
 * no escopo da equipe do alvo. Perfis globais continuam exclusivos do
 * ADMIN_SISTEMA. Fora de staging, gestão de unidade (`GESTOR_UNIDADE`)
 * também continua exclusiva do ADMIN_SISTEMA — `permitirAmploStaging` (só
 * `true` quando `VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true`) abre esse
 * terceiro perfil, espelhando `perfilCadastroLivreStagingValido()` nas
 * Rules.
 */
export function perfilDelegavelPorResponsavelOperacional(
  perfil: Usuario['perfil'],
  permitirAmploStaging = false,
): boolean {
  if (perfil === undefined) {
    return false;
  }
  return permitirAmploStaging
    ? PERFIS_DELEGAVEIS_STAGING.has(perfil)
    : PERFIS_DELEGAVEIS_POR_RESPONSAVEL.has(perfil);
}

/** Bloqueio de autoexclusão: o admin nunca pode excluir a própria conta logada. */
export function podeExcluirUsuario(candidato: Usuario, atorReal: Usuario): boolean {
  return candidato.login !== atorReal.login;
}

/**
 * `true` quando excluir `loginParaExcluir` deixaria a lista sem nenhum
 * GESTOR_EQUIPE/ADMIN_SISTEMA restante — sinal para a UI pedir uma segunda
 * confirmação explícita antes de prosseguir.
 */
export function exclusaoZeraGestores(
  usuarios: readonly Usuario[],
  loginParaExcluir: string,
): boolean {
  const restantes = usuarios.filter((usuario) => usuario.login !== loginParaExcluir);
  return !restantes.some((usuario) => (
    perfilEfetivo(usuario) === 'GESTOR_EQUIPE' || perfilEfetivo(usuario) === 'ADMIN_SISTEMA'
  ));
}

/**
 * Trava "preferencialmente bloquear a competência atual" na exclusão de
 * escalas antigas — client-side de propósito (ver firestore.rules, não há
 * um jeito limpo de uma rule saber qual é "a" competência atual sem mais um
 * documento de config só para isso).
 */
export function podeExcluirCompetencia(competencia: string, competenciaAtual: string): boolean {
  return competencia !== competenciaAtual;
}
