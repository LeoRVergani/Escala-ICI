import type { Equipe, NivelHierarquicoOrganizacional, PerfilUsuario, UnidadeOrganizacional, Usuario } from './modelos';
import { normalizarNome } from './nomes';
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

function rotuloDoId(id: string, todasUnidades: readonly UnidadeOrganizacional[]): string {
  const unidade = todasUnidades.find((item) => item.unidadeId === id);
  return unidade ? rotuloCompacto(unidade) : id;
}

/** Versão pública de `rotuloDoId` — usada por `OrganizationBreadcrumb` (Fase UI-ORG-1) para resolver cada segmento de um `caminho` sem duplicar a busca por unidade. */
export function rotuloUnidadePorId(id: string, todasUnidades: readonly UnidadeOrganizacional[]): string {
  return rotuloDoId(id, todasUnidades);
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

/**
 * STAGING-RESET-HIERARQUIA-ICI-2 — rótulo de opção para o cadastro LIVRE de
 * unidade/equipe (`souCoordenadorOperacionalStaging()`), onde a lista não é
 * uma árvore com indentação, e sim uma seleção direta. O valor técnico
 * (`unidadeId`) sempre vem primeiro — nunca `nome`/`sigla` como principal
 * (`docs/spec/STAGING_RESET_HIERARQUIA_ICI.md` § 4). `nome` só aparece como
 * complemento, entre parênteses, e só quando é distinto do próprio ID.
 */
export function rotuloTecnicoUnidade(unidade: Pick<UnidadeOrganizacional, 'unidadeId' | 'nome'>): string {
  return unidade.nome && unidade.nome !== unidade.unidadeId
    ? `${unidade.unidadeId} (${unidade.nome})`
    : unidade.unidadeId;
}

/** Mesma regra de `rotuloTecnicoUnidade()`, para `Equipe`: `id` técnico sempre primeiro. */
export function rotuloTecnicoEquipe(equipe: Pick<Equipe, 'id' | 'nome'>): string {
  return equipe.nome && equipe.nome !== equipe.id
    ? `${equipe.id} (${equipe.nome})`
    : equipe.id;
}

const TIPOS_FORA_DO_CODIGO_ORGANIZACIONAL = new Set<UnidadeOrganizacional['tipo']>([
  'PRESIDENCIA',
  'DIRETORIA',
  'SUPERVISAO',
]);

function segmentosCodigoOrganizacional(valor: string): string[] {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/gu)
    .filter(Boolean);
}

/**
 * Código humano derivado da posição atual da equipe, sem substituir o
 * `Equipe.id` persistido. Começa na Gerência, mantém as áreas/coordenações e
 * acrescenta a sigla da equipe. Presidência/Diretoria são contexto amplo
 * demais; Supervisão descreve a função de chefia, não o destino operacional.
 *
 * Exemplo da estrutura de referência:
 * - GEDSI > COSI + SOC            -> GEDSI_COSI_SOC
 * - GEDSI > CODB > Supervisão + NOC -> GEDSI_CODB_NOC
 * - GEDSI > COSI + PLANTAO_COSI  -> GEDSI_COSI_PLANTAO
 *
 * O código é calculado, portanto acompanha uma mudança organizacional sem
 * renomear documentos de escala, usuários, matriz ou histórico.
 */
export function codigoOrganizacionalEquipe(
  equipe: Pick<Equipe, 'id' | 'nome' | 'sigla' | 'unidadeId' | 'caminhoUnidade'>,
  todasUnidades: readonly UnidadeOrganizacional[],
): string {
  const unidadesPorId = new Map(todasUnidades.map((unidade) => [unidade.unidadeId, unidade]));
  const caminho = equipe.caminhoUnidade ?? (equipe.unidadeId ? [equipe.unidadeId] : []);
  const unidadesDoCaminho = caminho.map((unidadeId) => unidadesPorId.get(unidadeId)).filter((unidade) => unidade !== undefined);
  const indiceGerencia = unidadesDoCaminho.findIndex((unidade) => unidade.tipo === 'GERENCIA');
  const unidadesDoCodigo = (indiceGerencia >= 0 ? unidadesDoCaminho.slice(indiceGerencia) : unidadesDoCaminho)
    .filter((unidade) => !TIPOS_FORA_DO_CODIGO_ORGANIZACIONAL.has(unidade.tipo));
  const segmentosUnidade = unidadesDoCodigo.flatMap((unidade) =>
    segmentosCodigoOrganizacional(unidade.sigla || unidade.unidadeId));

  const origemEquipe = equipe.sigla || equipe.nome || equipe.id.replace(/^EQ_/u, '');
  const segmentosEquipeOriginais = segmentosCodigoOrganizacional(origemEquipe);
  const segmentosUnidadeConhecidos = new Set(segmentosUnidade);
  const segmentosEquipeSemRepeticao = segmentosEquipeOriginais.length > 1
    ? segmentosEquipeOriginais.filter((segmento) => !segmentosUnidadeConhecidos.has(segmento))
    : segmentosEquipeOriginais;
  const segmentosEquipe = segmentosEquipeSemRepeticao.length > 0
    ? segmentosEquipeSemRepeticao
    : segmentosEquipeOriginais;
  const segmentos = [...segmentosUnidade, ...segmentosEquipe];

  if (segmentos.length > 0) {
    return segmentos.join('_');
  }
  return segmentosCodigoOrganizacional(equipe.id).join('_') || equipe.id;
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
export function construirArvoreUnidades(unidades: readonly UnidadeOrganizacional[]): NoArvoreUnidade[] {
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

// ---------------------------------------------------------------------------
// Árvore organizacional mista (Unidades + Equipes) — Fase UI-ORG-1.
//
// Fundação ÚNICA reutilizada tanto pela Administração (visualização/edição
// de Unidades) quanto pelo `OrganizationTeamPicker` (seleção de Equipes para
// `GrupoPlantao.equipeResponsavelId`/`equipesConsulta`) — nunca duas
// implementações de árvore independentes. Reaproveita `construirArvoreUnidades()`
// para o esqueleto de Unidades (nunca recalcula `parentId` de outra forma) e
// só enxerta as Equipes como folhas do nível correspondente.
// ---------------------------------------------------------------------------

export type NoArvoreOrganizacional =
  | { chave: string; tipo: 'unidade'; unidade: UnidadeOrganizacional; profundidade: number; filhos: NoArvoreOrganizacional[] }
  | { chave: string; tipo: 'equipe'; equipe: Equipe; profundidade: number };

export interface ArvoreOrganizacional {
  raizes: NoArvoreOrganizacional[];
  /** Equipes sem `unidadeId` (ou apontando para uma unidade fora do conjunto carregado) — nunca inventa um parent para elas. */
  equipesSemUnidade: Equipe[];
  /**
   * Unidades presentes em `unidades` mas inalcançáveis a partir de nenhuma
   * raiz — sintoma de ciclo entre IDs já existentes (ver `formariaCiclo()`,
   * que só previne ciclo NOVO no cliente; um ciclo já gravado direto no
   * Firestore não é corrigido aqui, só sinalizado). Vazio no caso comum.
   */
  unidadesInalcancaveis: UnidadeOrganizacional[];
}

/** `unidade:{id}` / `equipe:{id}` — chave estável de nó, usada por estado de expansão/seleção da UI. */
export function chaveDoNoOrganizacional(no: NoArvoreOrganizacional): string {
  return no.tipo === 'unidade' ? `unidade:${no.unidade.unidadeId}` : `equipe:${no.equipe.id}`;
}

function ordenarNos(nos: NoArvoreOrganizacional[]): NoArvoreOrganizacional[] {
  return nos.slice().sort((a, b) => {
    const nomeA = a.tipo === 'unidade' ? a.unidade.nome : a.equipe.nome;
    const nomeB = b.tipo === 'unidade' ? b.unidade.nome : b.equipe.nome;
    return nomeA.localeCompare(nomeB);
  });
}

export function construirArvoreOrganizacional(
  unidades: readonly UnidadeOrganizacional[],
  equipes: readonly Equipe[],
): ArvoreOrganizacional {
  const arvoreUnidades = construirArvoreUnidades(unidades);
  const idsConhecidos = new Set(unidades.map((item) => item.unidadeId));
  const equipesPorUnidade = new Map<string, Equipe[]>();
  const equipesSemUnidade: Equipe[] = [];
  for (const equipe of equipes) {
    if (equipe.unidadeId !== undefined && idsConhecidos.has(equipe.unidadeId)) {
      const lista = equipesPorUnidade.get(equipe.unidadeId) ?? [];
      lista.push(equipe);
      equipesPorUnidade.set(equipe.unidadeId, lista);
    } else {
      equipesSemUnidade.push(equipe);
    }
  }
  equipesSemUnidade.sort((a, b) => a.nome.localeCompare(b.nome));

  function converter(nos: NoArvoreUnidade[]): NoArvoreOrganizacional[] {
    return ordenarNos(nos.flatMap((no): NoArvoreOrganizacional[] => {
      const noUnidade: NoArvoreOrganizacional = {
        chave: `unidade:${no.unidade.unidadeId}`,
        tipo: 'unidade',
        unidade: no.unidade,
        profundidade: no.profundidade,
        filhos: ordenarNos([
          ...converter(no.filhos),
          ...(equipesPorUnidade.get(no.unidade.unidadeId) ?? []).map((equipe): NoArvoreOrganizacional => ({
            chave: `equipe:${equipe.id}`,
            tipo: 'equipe',
            equipe,
            profundidade: no.profundidade + 1,
          })),
        ]),
      };
      return [noUnidade];
    }));
  }

  const raizes = converter(arvoreUnidades);

  const alcancaveis = new Set(achatarArvore(arvoreUnidades).map((no) => no.unidade.unidadeId));
  const unidadesInalcancaveis = unidades.filter((item) => !alcancaveis.has(item.unidadeId));

  return { raizes, equipesSemUnidade, unidadesInalcancaveis };
}

/**
 * Para o `OrganizationTeamPicker` (Fase UI-ORG-1): equipes sem `unidadeId`
 * continuam SELECIONÁVEIS, mesmo sem aparecer dentro da hierarquia de
 * Unidades — anexadas como raízes soltas (profundidade 0), nunca com um
 * `parentId` inventado. A Administração NÃO usa isto (mostra
 * `equipesSemUnidade` à parte, fora da árvore principal) — só o picker
 * precisa de uma lista "achatada o bastante para toda equipe válida
 * aparecer selecionável".
 */
export function raizesComEquipesSemUnidade(arvore: ArvoreOrganizacional): NoArvoreOrganizacional[] {
  return [
    ...arvore.raizes,
    ...arvore.equipesSemUnidade.map((equipe): NoArvoreOrganizacional => ({
      chave: `equipe:${equipe.id}`,
      tipo: 'equipe',
      equipe,
      profundidade: 0,
    })),
  ];
}

/** Pré-ordem, TODOS os nós (unidade + equipe), ignorando qualquer estado de expansão da UI — usado para busca/índice. */
export function achatarArvoreOrganizacional(nos: readonly NoArvoreOrganizacional[]): NoArvoreOrganizacional[] {
  return nos.flatMap((no) => (no.tipo === 'unidade' ? [no, ...achatarArvoreOrganizacional(no.filhos)] : [no]));
}

/**
 * Só os nós VISÍVEIS respeitando quais unidades estão expandidas
 * (`chavesExpandidas`) — pura, sem estado próprio; o componente de árvore
 * guarda o `Set` de expansão e chama isto a cada render para saber o que
 * desenhar/para onde a navegação por teclado deve se mover.
 */
export function nosVisiveisNaArvoreOrganizacional(
  nos: readonly NoArvoreOrganizacional[],
  chavesExpandidas: ReadonlySet<string>,
): NoArvoreOrganizacional[] {
  return nos.flatMap((no) => {
    if (no.tipo !== 'unidade') {
      return [no];
    }
    const expandido = chavesExpandidas.has(no.chave);
    return expandido
      ? [no, ...nosVisiveisNaArvoreOrganizacional(no.filhos, chavesExpandidas)]
      : [no];
  });
}

export interface BuscaArvoreOrganizacional {
  /** Chaves dos nós (unidade OU equipe) cujo nome/sigla bate com o termo. */
  chavesEncontradas: Set<string>;
  /** Chaves de UNIDADE que precisam estar expandidas para revelar algum resultado — inclui ancestrais de equipes encontradas. */
  chavesParaExpandir: Set<string>;
}

function bateComTermo(nomeOuSigla: readonly string[], chave: string): boolean {
  return nomeOuSigla.some((texto) => normalizarNome(texto).includes(chave));
}

/**
 * Busca por nome/sigla (acento/caixa insensível, via `normalizarNome()` —
 * mesma função já usada por `lib/conciliacaoPlantoes.ts`, nunca uma segunda
 * normalização de texto). Termo vazio não altera nada (retorna conjuntos
 * vazios — a árvore volta ao estado de expansão manual do usuário).
 */
export function buscarNaArvoreOrganizacional(
  raizes: readonly NoArvoreOrganizacional[],
  termo: string,
): BuscaArvoreOrganizacional {
  const chave = normalizarNome(termo);
  const chavesEncontradas = new Set<string>();
  const chavesParaExpandir = new Set<string>();
  if (chave === '') {
    return { chavesEncontradas, chavesParaExpandir };
  }

  function visitar(nos: readonly NoArvoreOrganizacional[], ancestrais: readonly string[]): boolean {
    let algumFilhoBateu = false;
    for (const no of nos) {
      const rotulos = no.tipo === 'unidade' ? [no.unidade.nome, no.unidade.sigla] : [no.equipe.nome, no.equipe.sigla];
      const proprioBate = bateComTermo(rotulos, chave);
      const filhoBate = no.tipo === 'unidade' ? visitar(no.filhos, [...ancestrais, no.chave]) : false;
      if (proprioBate) {
        chavesEncontradas.add(no.chave);
      }
      if (proprioBate || filhoBate) {
        for (const ancestral of ancestrais) {
          chavesParaExpandir.add(ancestral);
        }
        algumFilhoBateu = true;
      }
    }
    return algumFilhoBateu;
  }

  visitar(raizes, []);
  return { chavesEncontradas, chavesParaExpandir };
}

/**
 * Fase UI-ORG-1A — roving tabindex de `OrganizationTree`: qual chave deve
 * ter `tabIndex=0` agora. Se a chave com foco lógico ainda está entre os
 * nós VISÍVEIS (respeitando expand/collapse), ela continua sendo a
 * focável; senão (o ancestral que a revelava foi recolhido, por exemplo),
 * cai para o primeiro nó visível — nunca deixa a árvore inteira sem
 * nenhum item alcançável via Tab (o bug que uma versão anterior tinha:
 * comparar só com `null` em vez de "está realmente visível?").
 */
export function chaveFocavelNaArvore(
  visiveis: readonly NoArvoreOrganizacional[],
  chaveComFoco: string | null,
): string | null {
  if (chaveComFoco !== null && visiveis.some((no) => chaveDoNoOrganizacional(no) === chaveComFoco)) {
    return chaveComFoco;
  }
  return visiveis[0] ? chaveDoNoOrganizacional(visiveis[0]) : null;
}

/**
 * Fase UI-ORG-1A — alterna uma equipe no conjunto de seleção múltipla do
 * `OrganizationTeamPicker`. Nunca remove `equipeTravadaId` (a equipe
 * responsável, sempre incluída em `equipesConsulta` pela invariante de
 * `equipesConsultaEfetivas()`) — chamar com o próprio ID travado devolve o
 * mesmo conjunto (novo objeto, mesmo conteúdo), sem exceção nem efeito
 * colateral.
 */
export function alternarSelecaoMultipla(
  atuais: ReadonlySet<string>,
  equipeId: string,
  equipeTravadaId?: string,
): Set<string> {
  if (atuais.has(equipeId)) {
    if (equipeId === equipeTravadaId) {
      return new Set(atuais);
    }
    const proximo = new Set(atuais);
    proximo.delete(equipeId);
    return proximo;
  }
  return new Set(atuais).add(equipeId);
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

const PERFIS_SIMULAVEIS: ReadonlySet<PerfilUsuario> = new Set(['GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE']);

/**
 * Lista de gestores para o select de "Simular gestor" — nunca ADMIN_SISTEMA
 * (não faz sentido simular quem já tem acesso total) e nunca cadastro
 * técnico/fake (`ehUsuarioTecnicoOuFake`).
 *
 * Deduplicação: a causa real da duplicidade observada ("Marina aparece
 * duas vezes") é histórica — a migração de `usuarios/{uid}` para
 * `usuarios/{login}` (ver `scripts/migrate-usuarios-login.mjs`) nunca apaga
 * o documento antigo, então um mesmo colaborador pode ter dois documentos
 * com o mesmo `nome`. Agrupamos por nome normalizado e, ao encontrar mais
 * de um candidato com o mesmo nome, mantemos o que tem "cara" de login
 * humano (contém `.`, como `nome.sobrenome`) em vez do documento técnico
 * (ID legado, sem ponto) — o mesmo critério usado em
 * `ehUsuarioTecnicoOuFake()`.
 */
export function gestoresParaSimulacao(usuarios: Usuario[]): Usuario[] {
  const candidatos = usuarios.filter((usuario) => (
    PERFIS_SIMULAVEIS.has(perfilEfetivo(usuario)) && !ehUsuarioTecnicoOuFake(usuario)
  ));

  const porNome = new Map<string, Usuario>();
  for (const usuario of candidatos) {
    const chave = usuario.nome.trim().toLowerCase() || usuario.login;
    const existente = porNome.get(chave);
    if (existente === undefined) {
      porNome.set(chave, usuario);
      continue;
    }
    const existenteParecehumano = existente.login.includes('.');
    const candidatoParecehumano = usuario.login.includes('.');
    if (candidatoParecehumano && !existenteParecehumano) {
      porNome.set(chave, usuario);
    }
  }
  return [...porNome.values()];
}

/**
 * STAGING-RESET-HIERARQUIA-ICI-2 — descrição textual de `Usuario.nivelHierarquico`
 * (número 0-6). Nunca mostrar o número cru na UI (cadastro/edição de
 * unidade, equipe, usuário, telas de administração/hierarquia, tabelas,
 * validações visuais) sem esta descrição ao lado — "nível 6" sozinho não diz
 * nada a quem está cadastrando. Diferente de `NivelHierarquicoOrganizacional`
 * (classificação de ECHELON da unidade — `DELIBERATIVO`/`ESTRATEGICO`/
 * `TATICO`/`OPERACIONAL`, ver `descreverClassificacaoHierarquica()`): este é
 * o nível NUMÉRICO do usuário (0 = administração do sistema, 6 = execução
 * diária), um conceito relacionado mas não idêntico — um `GESTOR_UNIDADE`
 * de nível 4 administra uma unidade cuja classificação é `TATICO`, mas os
 * dois campos vivem em documentos diferentes (`Usuario` vs.
 * `UnidadeOrganizacional`) e não precisam coincidir numericamente.
 */
const DESCRICOES_NIVEL_HIERARQUICO: Readonly<Record<number, { titulo: string; descricao: string }>> = {
  0: { titulo: 'Administração do sistema', descricao: 'acesso administrativo global (ADMIN_SISTEMA).' },
  1: { titulo: 'Presidência', descricao: 'topo institucional.' },
  2: { titulo: 'Diretoria', descricao: 'decisão estratégica.' },
  3: { titulo: 'Gerência', descricao: 'gestão tática.' },
  4: { titulo: 'Coordenação', descricao: 'administra uma coordenação, como GEDSI_COSI ou GEDSI_CODB.' },
  5: { titulo: 'Supervisão', descricao: 'acompanha uma equipe operacional específica.' },
  6: { titulo: 'Operacional', descricao: 'usuário ou equipe de execução diária.' },
};

export function descreverNivelHierarquico(nivel: number): string {
  const descricao = DESCRICOES_NIVEL_HIERARQUICO[nivel];
  if (descricao === undefined) {
    return `Nível ${nivel} — sem descrição cadastrada.`;
  }
  return `Nível ${nivel} — ${descricao.titulo}: ${descricao.descricao}`;
}

/**
 * Descrição textual da classificação de echelon de `UnidadeOrganizacional.nivelHierarquico`
 * (`DELIBERATIVO`/`ESTRATEGICO`/`TATICO`/`OPERACIONAL`). Ver o comentário de
 * `descreverNivelHierarquico()` para a diferença em relação ao nível
 * numérico do usuário.
 */
const DESCRICOES_CLASSIFICACAO_HIERARQUICA: Readonly<Record<NivelHierarquicoOrganizacional, string>> = {
  DELIBERATIVO: 'Deliberativo — conselho/presidência, decisão máxima.',
  ESTRATEGICO: 'Estratégico — diretorias e assessorias, decisão estratégica.',
  TATICO: 'Tático — gerências, coordenações e supervisões, gestão tática.',
  OPERACIONAL: 'Operacional — equipes e colaboradores, execução diária.',
};

export function descreverClassificacaoHierarquica(valor: NivelHierarquicoOrganizacional): string {
  return DESCRICOES_CLASSIFICACAO_HIERARQUICA[valor];
}
