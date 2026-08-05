export type TipoProduto = 'dashboard' | 'app';

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
