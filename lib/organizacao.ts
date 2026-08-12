import type { Equipe, PerfilUsuario, UnidadeOrganizacional, Usuario } from './modelos';
import { equipesPermitidasEfetivas, perfilEfetivo, unidadesPermitidasEfetivas } from './sessao';

/**
 * Rótulo compacto de uma unidade: `nome` quando ele já é curto (a maioria
 * dos cadastros reais — "COSI", "CODB", "Supervisor de TI"), senão `sigla`
 * (para nomes longos como "Gerência de Data Center e Segurança da
 * Informação" -> "GEDSI"). Limiar arbitrário, só para caber em uma linha de
 * tabela/select sem quebrar.
 */
const LIMIAR_NOME_LONGO = 24;

export function rotuloCompacto(unidade: Pick<UnidadeOrganizacional, 'nome' | 'sigla'>): string {
  if (unidade.nome.length <= LIMIAR_NOME_LONGO) {
    return unidade.nome;
  }
  return unidade.sigla || unidade.nome;
}

function rotuloDoId(id: string, todasUnidades: UnidadeOrganizacional[]): string {
  const unidade = todasUnidades.find((item) => item.unidadeId === id);
  return unidade ? rotuloCompacto(unidade) : id;
}

/** Caminho completo e legível — usado em tooltip/`title` (texto secundário). */
export function caminhoLegivel(caminho: string[], todasUnidades: UnidadeOrganizacional[]): string {
  return caminho.map((id) => rotuloDoId(id, todasUnidades)).join(' > ');
}

/** Só os últimos `niveis` segmentos do caminho, sem indicação de corte. */
export function trechoFinalCaminho(
  caminho: string[],
  todasUnidades: UnidadeOrganizacional[],
  niveis = 2,
): string {
  return caminho.slice(-niveis).map((id) => rotuloDoId(id, todasUnidades)).join(' > ');
}

/**
 * Breadcrumb curto para tabelas: últimos `niveis` segmentos, com "…" na
 * frente quando o caminho é mais longo que isso. O caminho completo continua
 * disponível via `caminhoLegivel()` (tooltip/`title`).
 */
export function caminhoCurto(
  caminho: string[],
  todasUnidades: UnidadeOrganizacional[],
  niveis = 2,
): string {
  const trecho = trechoFinalCaminho(caminho, todasUnidades, niveis);
  return caminho.length > niveis ? `… > ${trecho}` : trecho;
}

/**
 * Rótulo de opção de select: `{unidadeId} — {parente > própria}` — o
 * `unidadeId` à esquerda é o valor técnico (o que se busca/reconhece), o
 * trecho à direita é só contexto legível. Curto mesmo para unidades bem
 * profundas na árvore, porque só mostra os últimos 2 níveis.
 */
export function rotuloOpcaoUnidade(unidade: UnidadeOrganizacional, todasUnidades: UnidadeOrganizacional[]): string {
  return `${unidade.unidadeId} — ${trechoFinalCaminho(unidade.caminho, todasUnidades, 2)}`;
}

export interface NoArvoreUnidade {
  unidade: UnidadeOrganizacional;
  profundidade: number;
  filhos: NoArvoreUnidade[];
}

/**
 * Monta a árvore a partir de `parentId` — só em memória, no cliente; nunca
 * em firestore.rules (que não percorre `parentId`, só lê arrays explícitos).
 * Uma unidade cujo `parentId` não existe no conjunto carregado (órfã, ou
 * apontando pra algo que o GESTOR_UNIDADE não tem permissão de ver) vira
 * raiz da árvore em vez de desaparecer silenciosamente.
 */
export function construirArvoreUnidades(unidades: UnidadeOrganizacional[]): NoArvoreUnidade[] {
  const idsConhecidos = new Set(unidades.map((unidade) => unidade.unidadeId));
  const filhosPorPai = new Map<string | null, UnidadeOrganizacional[]>();
  for (const unidade of unidades) {
    const pai = unidade.parentId !== null && idsConhecidos.has(unidade.parentId) ? unidade.parentId : null;
    const lista = filhosPorPai.get(pai) ?? [];
    lista.push(unidade);
    filhosPorPai.set(pai, lista);
  }
  for (const lista of filhosPorPai.values()) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  function montar(pai: string | null, profundidade: number): NoArvoreUnidade[] {
    return (filhosPorPai.get(pai) ?? []).map((unidade) => ({
      unidade,
      profundidade,
      filhos: montar(unidade.unidadeId, profundidade + 1),
    }));
  }

  return montar(null, 0);
}

/** Pré-ordem (pai antes dos filhos) — usada para ordenar opções de select. */
export function achatarArvore(nos: NoArvoreUnidade[]): NoArvoreUnidade[] {
  return nos.flatMap((no) => [no, ...achatarArvore(no.filhos)]);
}

/**
 * `unidadesOrdenadasEmArvore` é o que alimenta o `<select>` de unidade: mesma
 * ordem hierárquica da árvore visual, para a indentação (`profundidade`)
 * fazer sentido nas opções.
 */
export function unidadesOrdenadasEmArvore(unidades: UnidadeOrganizacional[]): NoArvoreUnidade[] {
  return achatarArvore(construirArvoreUnidades(unidades));
}

/**
 * `novoParentId === unidadeId` é o ciclo trivial (auto-referência). Além
 * disso, percorre a cadeia de `parentId` a partir de `novoParentId`: se em
 * algum ponto ela chegar em `unidadeId`, colocar `unidadeId` como pai de
 * `novoParentId` (ou de qualquer unidade abaixo dele) formaria um laço.
 * `unidadeId` vazio (cadastro novo, ainda sem ID definitivo) nunca forma
 * ciclo — não há nada existente que possa referenciá-lo ainda.
 */
export function formariaCiclo(
  unidadeId: string,
  novoParentId: string | null,
  unidadesExistentes: UnidadeOrganizacional[],
): boolean {
  if (novoParentId === null || unidadeId === '') {
    return false;
  }
  if (novoParentId === unidadeId) {
    return true;
  }
  const porId = new Map(unidadesExistentes.map((unidade) => [unidade.unidadeId, unidade]));
  const visitados = new Set<string>();
  let atual: string | null = novoParentId;
  while (atual !== null) {
    if (atual === unidadeId) {
      return true;
    }
    if (visitados.has(atual)) {
      return false;
    }
    visitados.add(atual);
    atual = porId.get(atual)?.parentId ?? null;
  }
  return false;
}

const PREFIXOS_LOGIN_TECNICO = ['usuario-', 'pendente-'];

/**
 * Heurística de detecção — nunca 100% precisa, só para destacar
 * visualmente candidatos a cadastro técnico/fake na lista de Usuários
 * (nunca exclui nada automaticamente):
 *   1. login começa com um prefixo técnico conhecido (`usuario-`,
 *      `pendente-`);
 *   2. login parece um UID do Firebase (só letras/dígitos, sem ponto,
 *      comprimento típico de UID >= 20) em vez de `nome.sobrenome`;
 *   3. quando há e-mail, o texto antes do `@` diverge do login — indício
 *      de cadastro de teste criado sem seguir a convenção `login ==
 *      email antes do @`.
 */
export function ehUsuarioTecnicoOuFake(usuario: Pick<Usuario, 'login' | 'email'>): boolean {
  const login = usuario.login.trim().toLowerCase();
  if (login === '') {
    return true;
  }
  if (PREFIXOS_LOGIN_TECNICO.some((prefixo) => login.startsWith(prefixo))) {
    return true;
  }
  const pareceUidFirebase = !login.includes('.') && login.length >= 20 && /^[a-z0-9]+$/i.test(login);
  if (pareceUidFirebase) {
    return true;
  }
  const email = usuario.email?.trim().toLowerCase() ?? '';
  if (email.includes('@')) {
    const usuarioDoEmail = email.split('@')[0] ?? '';
    if (usuarioDoEmail !== '' && usuarioDoEmail !== login) {
      return true;
    }
  }
  return false;
}

const PERFIS_GESTOR: ReadonlySet<PerfilUsuario> = new Set(['GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE']);

export interface ResumoOrganizacional {
  totalUnidades: number;
  totalEquipes: number;
  usuariosAtivos: number;
  usuariosTecnicosOuFake: number;
  totalGestores: number;
  equipesSemUnidade: number;
}

export function calcularResumoOrganizacional(
  unidades: UnidadeOrganizacional[],
  equipes: Equipe[],
  usuarios: Usuario[],
): ResumoOrganizacional {
  return {
    totalUnidades: unidades.length,
    totalEquipes: equipes.length,
    usuariosAtivos: usuarios.filter((usuario) => usuario.ativo).length,
    usuariosTecnicosOuFake: usuarios.filter(ehUsuarioTecnicoOuFake).length,
    totalGestores: usuarios.filter((usuario) => PERFIS_GESTOR.has(perfilEfetivo(usuario))).length,
    equipesSemUnidade: equipes.filter((equipe) => !equipe.unidadeId).length,
  };
}

/**
 * Rótulo do select de "Simular gestor": nome — perfil — unidades/equipes
 * permitidas (com fallback, mesma fonte usada para autorização de fato —
 * ver `unidadesPermitidasEfetivas`/`equipesPermitidasEfetivas` em
 * `lib/sessao.ts`), para o admin escolher entre gestores sem abrir o
 * cadastro de cada um.
 */
export function rotuloGestorParaSimulacao(usuario: Usuario): string {
  const perfil = perfilEfetivo(usuario);
  const permitidas = perfil === 'GESTOR_UNIDADE'
    ? unidadesPermitidasEfetivas(usuario)
    : equipesPermitidasEfetivas(usuario);
  return `${usuario.nome} — ${perfil} — ${permitidas.length > 0 ? permitidas.join(', ') : '—'}`;
}
