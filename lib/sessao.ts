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

/**
 * `unidadesPermitidas` explícito (não-vazio) manda. Na ausência, um
 * `unidadeId` único vira lista implícita de 1 elemento (compat: usuário
 * migrado que só tem `unidadeId`, sem lista). Sem nenhum dos dois, lista
 * vazia — nunca lança erro. GESTOR_EQUIPE/ANALISTA_SOC de hoje tipicamente
 * não têm unidade, e isso é esperado (o recurso simplesmente não se aplica
 * a eles). Espelhado 1:1 em `firestore.rules`, função
 * `minhasUnidadesPermitidas()` — qualquer mudança aqui exige a mudança
 * gêmea lá.
 */
export function unidadesPermitidasEfetivas(usuario: Usuario): string[] {
  if (usuario.unidadesPermitidas && usuario.unidadesPermitidas.length > 0) {
    return usuario.unidadesPermitidas;
  }
  return usuario.unidadeId ? [usuario.unidadeId] : [];
}

/**
 * `equipesPermitidas` explícito (não-vazio) manda. Na ausência, `equipeId`
 * (sempre presente em `Usuario`) vira lista implícita de 1 elemento — é o
 * que mantém TODO GESTOR_EQUIPE/ANALISTA_SOC existente funcionando sem
 * qualquer migração de dado. Espelhado 1:1 em `firestore.rules`, função
 * `minhasEquipesPermitidas()`.
 */
export function equipesPermitidasEfetivas(usuario: Usuario): string[] {
  if (usuario.equipesPermitidas && usuario.equipesPermitidas.length > 0) {
    return usuario.equipesPermitidas;
  }
  return [usuario.equipeId];
}

/**
 * ADMIN_SISTEMA sempre pode gerenciar (criar/editar) qualquer unidade.
 * Fora disso, só GESTOR_UNIDADE, e só quando `unidadeId` está em
 * `unidadesPermitidasEfetivas()` — nunca por travessia de `parentId`.
 */
export function podeGerenciarUnidade(usuario: Usuario, unidadeId: string): boolean {
  if (ehAdminSistema(usuario)) {
    return true;
  }
  return (
    perfilEfetivo(usuario) === 'GESTOR_UNIDADE'
    && unidadesPermitidasEfetivas(usuario).includes(unidadeId)
  );
}

/**
 * ADMIN_SISTEMA sempre pode gerenciar (operar sobre) qualquer equipe. Fora
 * disso, qualquer perfil com `equipeId` em `equipesPermitidasEfetivas()` —
 * é o que mantém o fallback por `equipeId` funcionando para GESTOR_EQUIPE/
 * ANALISTA_SOC de hoje. Não autoriza CRIAR uma equipe nova (isso depende de
 * `podeGerenciarUnidade()` sobre a unidade-pai pretendida) — só operar
 * sobre uma equipe já existente.
 */
export function podeGerenciarEquipe(usuario: Usuario, equipeId: string): boolean {
  if (ehAdminSistema(usuario)) {
    return true;
  }
  return equipesPermitidasEfetivas(usuario).includes(equipeId);
}

/**
 * Espelha `souGestor()` de `firestore.rules` — deliberadamente NÃO inclui
 * GESTOR_UNIDADE (diferente de `podeAcessarAdministracao` no Dashboard, que
 * é `souAdmin || souGestorUnidade`). Um Grupo de Plantão é administrado por
 * quem gerencia a EQUIPE responsável, não por quem gerencia a unidade
 * organizacional acima dela — ver `docs/spec/HIERARQUIA_ORGANIZACIONAL.md`
 * § 7 e `docs/spec/PLANTOES.md`, seção 20.
 */
export function souGestorDePlantao(usuario: Usuario): boolean {
  return ehAdminSistema(usuario) || perfilEfetivo(usuario) === 'GESTOR_EQUIPE';
}

/**
 * Espelha `podeGerenciarGrupoPlantao()` de `firestore.rules`:
 * `souGestor() && podeOperarNaEquipe(grupoDoc.equipeResponsavelId)`. Só UX —
 * esconder/mostrar botões no Dashboard; a autorização real continua nas
 * Rules. Pertencer à equipe responsável (`equipesPermitidasEfetivas`) sozinho
 * NUNCA basta — precisa também ser GESTOR_EQUIPE (ou ADMIN_SISTEMA), mesmo
 * bug já corrigido uma vez em `podeGerenciarGrupoPlantao()` das Rules
 * (Fase PLANTÃO-3A): pertencimento à equipe não é autorização de gestor.
 */
export function podeGerenciarGrupoPlantao(usuario: Usuario, equipeResponsavelId: string): boolean {
  if (!souGestorDePlantao(usuario)) {
    return false;
  }
  return ehAdminSistema(usuario) || equipesPermitidasEfetivas(usuario).includes(equipeResponsavelId);
}
