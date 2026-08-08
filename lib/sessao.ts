import type { PerfilUsuario, EscopoUsuario, Usuario } from './modelos';

export type TipoProduto = 'dashboard' | 'app';

/**
 * O sistema hoje só opera sobre uma única competência ativa por vez — usada
 * na carga inicial de dados (`autenticar()`/`carregarDadosDaEquipe` no
 * Dashboard) e na trava de "não excluir a competência atual" (ver
 * `podeExcluirCompetencia` em `lib/adminGuards.ts`).
 */
export const COMPETENCIA_ATUAL = '2026-08';

/**
 * Estados possíveis da restauração de sessão do Firebase Auth.
 *
 * - `restaurando`: o Firebase ainda não confirmou se existe sessão local.
 *   Nenhum produto deve exibir login nesse estado.
 * - `ausente`: a restauração terminou e não há sessão válida.
 * - `ativa`: a restauração terminou, a sessão é válida e o usuário do
 *   Firestore já foi carregado.
 */
export type EstadoSessao = 'restaurando' | 'ausente' | 'ativa';

export const NIVEL_MAXIMO_GESTOR = 5;

export const MENSAGEM_SEM_PERMISSAO_DASHBOARD =
  'Seu perfil não possui permissão de gestor para acessar o dashboard.';

export function chavePreferenciaSessao(tipo: TipoProduto): string {
  return `escala-ici-sessao-${tipo}`;
}

/** O app do colaborador mantém a sessão por padrão; o dashboard não. */
export function preferenciaPadraoSessao(tipo: TipoProduto): boolean {
  return tipo === 'app';
}

export function resolverManterConectado(
  tipo: TipoProduto,
  valorArmazenado: string | null,
): boolean {
  if (valorArmazenado === null) {
    return preferenciaPadraoSessao(tipo);
  }
  return valorArmazenado === 'true';
}

export function estadoInicialSessao(opcoes: {
  firebaseConfigurado: boolean;
  restauracaoDelegada: boolean;
}): EstadoSessao {
  return opcoes.firebaseConfigurado && !opcoes.restauracaoDelegada
    ? 'restaurando'
    : 'ausente';
}

/**
 * A tela "Restaurando sessão…" tem prioridade sobre o login: enquanto for
 * `true`, o produto não pode exibir o formulário nem telas vazias. É o que
 * evita o flicker da tela inicial no PWA instalado.
 */
export function deveExibirRestauracao(estado: EstadoSessao): boolean {
  return estado === 'restaurando';
}

/**
 * Listeners em tempo real só podem ser criados depois da sessão resolvida e do
 * usuário do Firestore carregado, para não assinar consultas com equipe ou
 * competência indefinidas e para não deixar a carga inicial sobrescrever dados
 * que já chegaram pelo snapshot.
 *
 * Vale tanto para a sessão restaurada (`ativa`) quanto para o login manual
 * (`ausente`, porque o observador de sessão já se encerrou): o que precisa
 * estar concluído é a restauração em andamento.
 */
export function podeIniciarListeners(opcoes: {
  estado: EstadoSessao;
  usuarioCarregado: boolean;
  dadosIniciaisCarregados: boolean;
  modoDemonstracao: boolean;
}): boolean {
  return opcoes.estado !== 'restaurando'
    && opcoes.usuarioCarregado
    && opcoes.dadosIniciaisCarregados
    && !opcoes.modoDemonstracao;
}

export function nivelPermiteDashboard(nivelHierarquico: number): boolean {
  return nivelHierarquico <= NIVEL_MAXIMO_GESTOR;
}

/**
 * Fonte única da verdade de autorização. Se `usuario.perfil` já estiver
 * definido, ele manda — mesmo que contradiga `nivelHierarquico`. Se estiver
 * ausente, cai no comportamento de hoje: nivelHierarquico <= 5 vira
 * equivalente a gestor, senão equivalente a colaborador comum. Espelhado
 * 1:1 em `firestore.rules` na função `perfilDe()` — qualquer mudança aqui
 * exige a mudança gêmea lá.
 */
export function perfilEfetivo(usuario: Usuario): PerfilUsuario {
  if (usuario.perfil) {
    return usuario.perfil;
  }
  return usuario.nivelHierarquico <= NIVEL_MAXIMO_GESTOR ? 'GESTOR_EQUIPE' : 'ANALISTA_SOC';
}

/** Ausência de `escopo` equivale a 'EQUIPE' — o comportamento de hoje. */
export function escopoEfetivo(usuario: Usuario): EscopoUsuario {
  return usuario.escopo ?? 'EQUIPE';
}

export function ehAdminSistema(usuario: Usuario): boolean {
  return perfilEfetivo(usuario) === 'ADMIN_SISTEMA';
}
