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
 * PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — o `cargo` real cadastrado em
 * `usuarios/{login}` sempre prevalece; o fallback (baseado em `perfil`, via
 * `perfilEfetivo()`, nunca em texto hardcoded por nome/equipe) só entra
 * quando `cargo` está vazio, e nunca sobrescreve o valor real — esta
 * função só formata para exibição, nunca grava nada.
 */
export function rotuloCargoExibicao(usuario: Usuario): string {
  if (usuario.cargo.trim() !== '') {
    return usuario.cargo;
  }
  const perfil = perfilEfetivo(usuario);
  return perfil === 'ADMIN_SISTEMA' || perfil === 'GESTOR_EQUIPE' || perfil === 'GESTOR_UNIDADE' || perfil === 'SUPERVISOR_EQUIPE'
    ? 'Coordenador'
    : 'Analista SOC';
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
 * Espelha `souGestor()` de `firestore.rules` MAIS `GESTOR_UNIDADE`.
 *
 * Mudança de regra aprovada na Fase ESCOPO-GESTOR-UNIDADE-1
 * (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`): até essa fase, esta
 * função deliberadamente NÃO incluía `GESTOR_UNIDADE` — um Grupo de
 * Plantão só era administrável por quem gerenciava a EQUIPE responsável
 * (`GESTOR_EQUIPE`/`ADMIN_SISTEMA`), nunca por quem gerenciava a unidade
 * organizacional acima dela. Essa regra se mostrou incorreta em produto: um
 * coordenador de unidade (ex.: COSI) que administra a árvore inteira da sua
 * unidade — incluindo a equipe "Plantão COSI" — não conseguia sequer abrir
 * a tela de Plantões para o próprio Grupo que sua unidade é responsável.
 *
 * A partir desta fase, `GESTOR_UNIDADE` entra aqui só para efeito de
 * VISIBILIDADE de tela (mostrar/esconder a aba Plantões e o item no
 * seletor superior) — a autorização real de administrar um Grupo
 * específico continua em `podeGerenciarGrupoPlantao()` abaixo (e em
 * `firestore.rules`), que exige o Grupo estar dentro do escopo de unidade
 * permitido, nunca "ser GESTOR_UNIDADE de qualquer unidade".
 *
 * Fase ESCOPO-CONSULTA-PLANTAO-1 — `SUPERVISOR_EQUIPE` também entra aqui
 * (mesmo alcance de `GESTOR_EQUIPE`, `docs/spec/HIERARQUIA_ORGANIZACIONAL.md`
 * § 6): sem isso, um supervisor de equipe (ex.: Wanessa, do NOC) nunca
 * carregaria `gruposPlantao` para configurar "Plantões monitorados pela
 * equipe" (autovínculo de consulta) nem veria a aba Plantões — mesmo
 * gate de VISIBILIDADE de sempre, nunca amplia autorização real.
 */
export function souGestorDePlantao(usuario: Usuario): boolean {
  const perfil = perfilEfetivo(usuario);
  return ehAdminSistema(usuario) || perfil === 'GESTOR_EQUIPE' || perfil === 'GESTOR_UNIDADE' || perfil === 'SUPERVISOR_EQUIPE';
}

/**
 * Espelha `podeGerenciarGrupoPlantao(grupoDoc)` de `firestore.rules`. Só
 * UX — esconder/mostrar botões no Dashboard; a autorização real continua
 * nas Rules. Recebe o "documento" do Grupo (ou o subconjunto de campos
 * necessário), igual à função-irmã das Rules, em vez de só o
 * `equipeResponsavelId` isolado — necessário desde a Fase
 * ESCOPO-GESTOR-UNIDADE-1 para também checar `unidadeResponsavelId`.
 *
 * Dois caminhos de autorização, nunca fundidos:
 * - `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE`/`ADMIN_SISTEMA`: pertencimento à
 *   equipe responsável (`equipesPermitidasEfetivas`) sozinho NUNCA basta —
 *   precisa também ser gestor/supervisor (ou admin), mesmo bug já corrigido
 *   uma vez nas Rules (Fase PLANTÃO-3A): pertencimento à equipe não é
 *   autorização de gestor. PATCH-NOC-SUPERVISAO-CONSULTA-PLANTAO-UX-1 —
 *   `SUPERVISOR_EQUIPE` tem o mesmo alcance de `GESTOR_EQUIPE` aqui, espelhando
 *   `souGestor()` em `firestore.rules`.
 * - `GESTOR_UNIDADE`: precisa que o Grupo tenha `unidadeResponsavelId`
 *   preenchido (campo opcional/retrocompatível, ver
 *   `@escala-ici/contrato`) E que essa unidade (ou uma unidade ANCESTRAL
 *   dela, via `caminhoUnidadeResponsavel` materializado — nunca travessia
 *   de `parentId`) esteja em `unidadesPermitidasEfetivas()`. Um Grupo
 *   antigo sem o campo simplesmente não fica administrável por
 *   `GESTOR_UNIDADE` nenhum — só pelo `GESTOR_EQUIPE`/`ADMIN_SISTEMA` de
 *   sempre, o mesmo comportamento de antes desta fase.
 */
export function podeGerenciarGrupoPlantao(
  usuario: Usuario,
  grupo: { equipeResponsavelId: string; unidadeResponsavelId?: string; caminhoUnidadeResponsavel?: string[] },
): boolean {
  if (ehAdminSistema(usuario)) {
    return true;
  }
  const perfil = perfilEfetivo(usuario);
  if (perfil === 'GESTOR_EQUIPE' || perfil === 'SUPERVISOR_EQUIPE') {
    return equipesPermitidasEfetivas(usuario).includes(grupo.equipeResponsavelId);
  }
  if (perfil === 'GESTOR_UNIDADE') {
    if (grupo.unidadeResponsavelId === undefined) {
      return false;
    }
    const permitidas = unidadesPermitidasEfetivas(usuario);
    return (
      permitidas.includes(grupo.unidadeResponsavelId)
      || (grupo.caminhoUnidadeResponsavel?.some((unidadeId) => permitidas.includes(unidadeId)) ?? false)
    );
  }
  return false;
}

/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — mirror client-side do CONJUNTO de
 * perfis de `souCoordenadorOperacionalStaging()` em `firestore.rules`. Não
 * decide sozinho se o ambiente é staging — isso vem de fora
 * (`opcoes.permitirAmploStaging` em `resolverEscoposOperacionais()`, ligado
 * por `VITE_ESCALA_STAGING_PERMISSAO_AMPLA`, só `true` em
 * `.env.staging.dashboard`). Só UX — a autorização real de escrita continua
 * inteiramente nas Rules; isto apenas evita esconder do coordenador uma
 * opção que ele já teria permissão de usar em staging.
 */
const PERFIS_COORDENADOR_OPERACIONAL_STAGING: ReadonlySet<PerfilUsuario> = new Set([
  'ADMIN_SISTEMA', 'GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE',
]);

export function ehPerfilElegivelParaAmploStaging(usuario: Usuario): boolean {
  return PERFIS_COORDENADOR_OPERACIONAL_STAGING.has(perfilEfetivo(usuario));
}

/**
 * Escopo (equipe OU unidade responsável) de um Grupo de Plantão dentro do
 * alcance do usuário — SEM checar perfil. Espelha
 * `escopoDoGrupoPlantaoNoMeuAlcance()` de `firestore.rules`. Usado só pela
 * liberação de staging (junto com `ehPerfilElegivelParaAmploStaging()` —
 * nunca sozinho, para não abrir a listagem para um analista comum que só
 * por acaso está na mesma equipe/unidade); a autorização real continua nas
 * Rules.
 */
export function escopoDoGrupoPlantaoNoMeuAlcance(
  usuario: Usuario,
  grupo: { equipeResponsavelId: string; unidadeResponsavelId?: string; caminhoUnidadeResponsavel?: string[] },
): boolean {
  if (equipesPermitidasEfetivas(usuario).includes(grupo.equipeResponsavelId)) {
    return true;
  }
  if (grupo.unidadeResponsavelId === undefined) {
    return false;
  }
  const permitidas = unidadesPermitidasEfetivas(usuario);
  return (
    permitidas.includes(grupo.unidadeResponsavelId)
    || (grupo.caminhoUnidadeResponsavel?.some((unidadeId) => permitidas.includes(unidadeId)) ?? false)
  );
}

/**
 * Fase ESCOPO-CONSULTA-PLANTAO-1
 * (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`, seção "Plantões
 * monitorados por equipe") — mirror client-side de
 * `podeAutoVincularConsultaPlantao()` em `firestore.rules`: um
 * `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` pode adicionar ou remover SOMENTE a
 * própria equipe administrada (`equipesPermitidasEfetivas`) em
 * `equipesConsulta` de um Grupo que ele NÃO administra — nunca precisa de
 * `podeGerenciarGrupoPlantao()` (a supervisora do NOC não administra o
 * Plantão de outra coordenação, só vincula a própria equipe à consulta
 * dele). Só UX — a autorização real continua em `firestore.rules`.
 *
 * Recebe as duas listas de `equipesConsulta` (antes/depois) para validar
 * exatamente a mesma invariante das Rules: exatamente UMA equipe muda
 * (nunca duas ao mesmo tempo), essa equipe está entre as que o usuário
 * administra, e `equipeResponsavelId` nunca sai da lista nova.
 */
export function podeAutoVincularConsultaPlantao(
  usuario: Usuario,
  equipesConsultaAntigo: readonly string[],
  equipesConsultaNovo: readonly string[],
  equipeResponsavelId: string,
): boolean {
  const perfil = perfilEfetivo(usuario);
  if (perfil !== 'GESTOR_EQUIPE' && perfil !== 'SUPERVISOR_EQUIPE') {
    return false;
  }
  if (!equipesConsultaNovo.includes(equipeResponsavelId)) {
    return false;
  }
  const adicionadas = equipesConsultaNovo.filter((equipeId) => !equipesConsultaAntigo.includes(equipeId));
  const removidas = equipesConsultaAntigo.filter((equipeId) => !equipesConsultaNovo.includes(equipeId));
  if (adicionadas.length + removidas.length !== 1) {
    return false;
  }
  const equipeAlterada = adicionadas[0] ?? removidas[0];
  return equipesPermitidasEfetivas(usuario).includes(equipeAlterada as string);
}
