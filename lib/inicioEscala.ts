import type { Equipe, UnidadeOrganizacional } from './modelos';
import type { GrupoPlantao } from '@escala-ici/contrato';

/** Resultado comum para decisões que só devem perguntar quando existe ambiguidade real. */
export type ResultadoResolucao<T> =
  | { estado: 'RESOLVIDO'; valor: T }
  | { estado: 'SELECIONAR'; opcoes: T[] }
  | { estado: 'CRIAR' };

export function resolverUnicoOuAmbiguo<T>(opcoes: readonly T[]): ResultadoResolucao<T> {
  if (opcoes.length === 0) {
    return { estado: 'CRIAR' };
  }
  if (opcoes.length === 1) {
    return { estado: 'RESOLVIDO', valor: opcoes[0] as T };
  }
  return { estado: 'SELECIONAR', opcoes: [...opcoes] };
}

/**
 * Unidades que o usuário administra, preservando a ordem do cadastro e sem
 * inferir autorização por tipo, nome, sigla ou posição na árvore.
 */
export function unidadesAdministraveis(
  unidades: readonly UnidadeOrganizacional[],
  unidadesPermitidas: readonly string[],
  ehAdminSistema: boolean,
): UnidadeOrganizacional[] {
  return unidades.filter((unidade) =>
    unidade.ativa && (ehAdminSistema || unidadesPermitidas.includes(unidade.unidadeId)),
  );
}

/** Equipes operacionais administráveis dentro da área ativa. */
export function equipesAdministraveisNaUnidade(
  equipes: readonly Equipe[],
  unidadeId: string | null,
  equipesPermitidas: readonly string[],
  ehAdminSistema: boolean,
): Equipe[] {
  return equipes.filter((equipe) =>
    equipe.ativa
      && (ehAdminSistema || equipesPermitidas.includes(equipe.id))
      && (unidadeId === null || equipe.unidadeId === unidadeId),
  );
}

/** Grupos de Plantão administráveis, nunca apenas consultáveis. */
export function gruposPlantaoAdministraveis(
  grupos: readonly GrupoPlantao[],
  podeGerenciar: (grupo: GrupoPlantao) => boolean,
): GrupoPlantao[] {
  return grupos.filter((grupo) => grupo.ativo && podeGerenciar(grupo));
}

export function resolverAreaAtiva(
  unidades: readonly UnidadeOrganizacional[],
  unidadesPermitidas: readonly string[],
  ehAdminSistema: boolean,
): ResultadoResolucao<UnidadeOrganizacional> {
  return resolverUnicoOuAmbiguo(unidadesAdministraveis(unidades, unidadesPermitidas, ehAdminSistema));
}

export function resolverEquipeParaJornada(
  equipes: readonly Equipe[],
  unidadeId: string | null,
  equipesPermitidas: readonly string[],
  ehAdminSistema: boolean,
  equipeJornadaPreferidaId: string | null = null,
): ResultadoResolucao<Equipe> {
  const candidatas = equipesAdministraveisNaUnidade(equipes, unidadeId, equipesPermitidas, ehAdminSistema);
  const preferida = equipeJornadaPreferidaId === null
    ? undefined
    : candidatas.find((equipe) => equipe.id === equipeJornadaPreferidaId);
  return preferida === undefined ? resolverUnicoOuAmbiguo(candidatas) : { estado: 'RESOLVIDO', valor: preferida };
}

export function resolverGrupoParaPlantao(
  grupos: readonly GrupoPlantao[],
  podeGerenciar: (grupo: GrupoPlantao) => boolean,
): ResultadoResolucao<GrupoPlantao> {
  return resolverUnicoOuAmbiguo(gruposPlantaoAdministraveis(grupos, podeGerenciar));
}

/**
 * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — equipes candidatas a "equipe
 * responsável" de um Grupo de Plantão NOVO. A mesma lista de equipes
 * administráveis da área, exceto a equipe que já está ativa como Jornada
 * NESTE MOMENTO (`equipeJornadaAtivaId`, tipicamente a equipe do contexto
 * `contextoEscalaAtivo` aberto quando o usuário abriu "Nova escala") —
 * nunca oferecida/escolhida silenciosamente como responsável por um
 * Plantão novo, porque essa equipe já tem uso real de Jornada.
 *
 * NUNCA decidido por nome/sigla — só pelo vínculo já conhecido com a
 * Jornada. Se excluir essa equipe zerar a lista, a UI ainda a mantém como
 * opção manual, mas `resolverEquipeResponsavelParaPlantao()` exige que o
 * usuário a escolha explicitamente; ela nunca volta a ser fallback
 * automático de Plantão.
 */
export function equipesCandidatasParaPlantao(
  equipes: readonly Equipe[],
  equipeJornadaAtivaId: string | null,
): Equipe[] {
  if (equipeJornadaAtivaId === null) {
    return [...equipes];
  }
  const semAJornadaAtiva = equipes.filter((equipe) => equipe.id !== equipeJornadaAtivaId);
  return semAJornadaAtiva.length > 0 ? semAJornadaAtiva : [...equipes];
}

export function resolverEquipeResponsavelParaPlantao(
  equipes: readonly Equipe[],
  equipeJornadaAtivaId: string | null,
): ResultadoResolucao<Equipe> {
  if (equipes.length === 0) {
    return { estado: 'CRIAR' };
  }
  if (equipeJornadaAtivaId === null) {
    return resolverUnicoOuAmbiguo(equipes);
  }
  const candidatasSemAJornada = equipes.filter((equipe) => equipe.id !== equipeJornadaAtivaId);
  if (candidatasSemAJornada.length === 0) {
    return { estado: 'SELECIONAR', opcoes: [...equipes] };
  }
  return resolverUnicoOuAmbiguo(candidatasSemAJornada);
}

/**
 * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — "área de gestão" a EXIBIR no
 * Wizard nunca deveria dizer "não cadastrada" quando a equipe já
 * resolvida/selecionada carrega, ela mesma, uma unidade real
 * (`Equipe.unidadeId`) — mesmo que o usuário não administre nenhuma
 * `UnidadeOrganizacional` diretamente (ex.: um `GESTOR_EQUIPE` comum, sem
 * `GESTOR_UNIDADE`). `unidadesAdministraveis` continua a fonte de
 * AUTORIZAÇÃO (inalterada); esta função só resolve o que MOSTRAR: as
 * unidades administráveis quando existirem, senão a unidade da equipe já
 * resolvida, quando ela existir no cadastro carregado.
 */
export function areasParaExibicaoNoWizard(
  unidadesAdministraveis: readonly UnidadeOrganizacional[],
  unidades: readonly UnidadeOrganizacional[],
  equipeResolvida: Pick<Equipe, 'unidadeId'> | undefined,
): UnidadeOrganizacional[] {
  if (unidadesAdministraveis.length > 0) {
    return [...unidadesAdministraveis];
  }
  const unidadeDaEquipe = equipeResolvida?.unidadeId !== undefined
    ? unidades.find((unidade) => unidade.unidadeId === equipeResolvida.unidadeId)
    : undefined;
  return unidadeDaEquipe !== undefined ? [unidadeDaEquipe] : [];
}

/**
 * IDs técnicos aceitos para criação inline. A regra de unicidade continua
 * sendo a do repositório/modal administrativo; este helper só normaliza o
 * texto fornecido pelo gestor.
 */
export function normalizarIdentificadorTecnico(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

/** ID estável do Grupo novo, derivado da identidade técnica da equipe e nunca do nome editável do Grupo. */
export function identificadorGrupoPlantaoDaEquipe(
  equipeResponsavel: Pick<Equipe, 'id' | 'sigla'>,
): string {
  return normalizarIdentificadorTecnico(equipeResponsavel.sigla || equipeResponsavel.id);
}

export function validarCadastroInline(nome: string, identificador: string): string[] {
  const erros: string[] = [];
  if (nome.trim() === '') {
    erros.push('Informe um nome.');
  }
  if (identificador.trim() === '') {
    erros.push('Informe um identificador.');
  }
  return erros;
}
