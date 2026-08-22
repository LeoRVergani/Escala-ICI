import { normalizarNome } from './nomes';
import type { Usuario } from './modelos';

/**
 * PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — filtros PUROS (nunca escrevem
 * nada, nunca decidem quem entra na consulta) para a tela Usuários do
 * Dashboard. Dois problemas separados, um módulo:
 *
 * 1. No contexto de um Grupo de Plantão, a tela já lista o pool amplo
 *    (equipe responsável + `equipesConsulta` + unidade responsável — ver
 *    `listarUsuariosElegiveisPlantao`), o que mistura visualmente
 *    plantonistas com técnicos de outras equipes que só CONSULTAM o Grupo.
 *    `opcoesFiltroSetorUsuariosPlantao`/`usuarioPertenceAoFiltroSetorPlantao`
 *    só CLASSIFICAM esse pool já carregado — geradas a partir do próprio
 *    Grupo, nunca hardcoded por sigla ("COSI"/"SOC" nunca aparecem como
 *    literal aqui).
 * 2. A busca textual da tela só cobria nome/login; `usuarioCorrespondeBuscaTextual`
 *    estende para email/aliases/cargo, na ordem pool → filtro de setor →
 *    busca (nunca decide sozinha quem aparece — só refina o resultado do
 *    filtro de setor, igual ao padrão já usado por `buscarUsuariosPlantao`
 *    em `lib/conciliacaoPlantoes.ts`, mas para esta tela).
 *
 * Nunca altera `perfil`/`escopo`/`equipeId`/`cargo`/participação de
 * ninguém — só leitura/classificação para apresentação.
 */

/** Forma mínima de GrupoPlantao que este módulo precisa — mesmo padrão de lib/sessao.ts. */
export interface GrupoPlantaoParaFiltroSetor {
  grupoId: string;
  nome: string;
  equipeResponsavelId: string;
  equipesConsulta: readonly string[];
  unidadeResponsavelId?: string;
}

export interface OpcaoFiltroSetorUsuarios {
  id: string;
  rotulo: string;
}

export const FILTRO_SETOR_TODOS = 'todos';
const FILTRO_SETOR_PLANTAO = 'plantao';
const FILTRO_SETOR_UNIDADE = 'unidade';
const PREFIXO_FILTRO_SETOR_EQUIPE = 'equipe:';

/**
 * Opções do seletor, na ordem de exibição. "Todos" sempre primeiro; um item
 * por equipe de `equipesConsulta` que não seja a própria equipe responsável
 * (rotulado pelo nome real da equipe, nunca pelo id técnico quando
 * conhecido); "<unidade> inteiro" só quando o Grupo tiver
 * `unidadeResponsavelId`.
 */
export function opcoesFiltroSetorUsuariosPlantao(
  grupo: GrupoPlantaoParaFiltroSetor,
  nomePorEquipeId: ReadonlyMap<string, string>,
  nomePorUnidadeId: ReadonlyMap<string, string>,
): OpcaoFiltroSetorUsuarios[] {
  const opcoes: OpcaoFiltroSetorUsuarios[] = [
    { id: FILTRO_SETOR_TODOS, rotulo: 'Todos' },
    { id: FILTRO_SETOR_PLANTAO, rotulo: `Plantão ${grupo.nome}` },
  ];
  for (const equipeId of grupo.equipesConsulta) {
    if (equipeId === grupo.equipeResponsavelId) {
      continue;
    }
    opcoes.push({ id: `${PREFIXO_FILTRO_SETOR_EQUIPE}${equipeId}`, rotulo: nomePorEquipeId.get(equipeId) ?? equipeId });
  }
  if (grupo.unidadeResponsavelId !== undefined) {
    const nomeUnidade = nomePorUnidadeId.get(grupo.unidadeResponsavelId) ?? grupo.unidadeResponsavelId;
    opcoes.push({ id: FILTRO_SETOR_UNIDADE, rotulo: `${nomeUnidade} inteiro` });
  }
  return opcoes;
}

/**
 * Critério técnico (ver docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md):
 * - Plantão: equipeId da equipe responsável, OU cadastroOperacional
 *   PLANTAO apontando este grupo, OU login participante ativo publicado.
 * - Unidade: unidadeId (ou unidadesPermitidas) igual à unidade responsável.
 * - Equipe (equipesConsulta): equipeId exatamente igual à equipe do filtro.
 * - Todos: sempre verdadeiro.
 */
export function usuarioPertenceAoFiltroSetorPlantao(
  usuario: Usuario,
  filtroId: string,
  grupo: GrupoPlantaoParaFiltroSetor,
  loginsParticipantesAtivos: ReadonlySet<string>,
): boolean {
  if (filtroId === FILTRO_SETOR_TODOS) {
    return true;
  }
  if (filtroId === FILTRO_SETOR_PLANTAO) {
    return usuario.equipeId === grupo.equipeResponsavelId
      || (usuario.cadastroOperacional?.tipo === 'PLANTAO' && usuario.cadastroOperacional.alvoId === grupo.grupoId)
      || loginsParticipantesAtivos.has(usuario.login);
  }
  if (filtroId === FILTRO_SETOR_UNIDADE) {
    return grupo.unidadeResponsavelId !== undefined
      && (usuario.unidadeId === grupo.unidadeResponsavelId
        || (usuario.unidadesPermitidas ?? []).includes(grupo.unidadeResponsavelId));
  }
  if (filtroId.startsWith(PREFIXO_FILTRO_SETOR_EQUIPE)) {
    return usuario.equipeId === filtroId.slice(PREFIXO_FILTRO_SETOR_EQUIPE.length);
  }
  return true;
}

/**
 * Busca textual da tela Usuários — nome, login, e-mail, aliases da
 * planilha e cargo. Termo vazio sempre corresponde (nenhum filtro).
 */
export function usuarioCorrespondeBuscaTextual(usuario: Usuario, termo: string): boolean {
  const chave = normalizarNome(termo);
  if (chave === '') {
    return true;
  }
  const termoEmail = termo.trim().toLowerCase();
  return normalizarNome(usuario.nome).includes(chave)
    || normalizarNome(usuario.login).includes(chave)
    || (termoEmail !== '' && usuario.email.toLowerCase().includes(termoEmail))
    || normalizarNome(usuario.cargo).includes(chave)
    || (usuario.loginAliases ?? []).some((alias) => normalizarNome(alias).includes(chave))
    || (usuario.aliasesPlanilha ?? []).some((alias) => normalizarNome(alias).includes(chave));
}
