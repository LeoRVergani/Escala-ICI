import {
  adicionarDias,
  converterInstanteUtcParaMomento,
  TAMANHO_PALETA_IDENTIDADE_PLANTAO,
  type AtribuicaoPlantaoPersistida,
  type ContatoPlantonista,
  type ParticipantePlantao,
} from '@escala-ici/contrato';

import type { Usuario } from '@/lib/modelos';

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — lógica pura por trás da
 * visão "Plantão" do App: quem está de plantão agora, quem vem depois,
 * contatos ativos, e os próximos plantões do próprio usuário (quando ele é
 * plantonista). Sem dependência de DOM/React/Firebase, mesmo princípio de
 * `hojeConsulta.ts` — só lê o que já foi carregado (competência PUBLICADA +
 * atribuições + participantes), nunca decide autorização nem escreve nada.
 */

export interface PlantaoAgoraResumo {
  /** Atribuição cujo intervalo [inicio, fim) contém `agoraIso` — `null` se ninguém estiver de plantão agora. */
  atual: AtribuicaoPlantaoPersistida | null;
  /** Primeira atribuição com `inicio` estritamente depois de `agoraIso` — `null` se não houver nenhuma. */
  proximo: AtribuicaoPlantaoPersistida | null;
}

/**
 * Instantes UTC (`inicio`/`fim`) já vêm como string ISO 8601 de largura
 * fixa (`AAAA-MM-DDThh:mm:ss.sssZ`) — comparação lexicográfica de string já
 * é comparação cronológica correta, sem precisar construir `Date` (que
 * herdaria o timezone da máquina para qualquer formatação, o que este
 * módulo evita de propósito).
 */
export function resolverPlantaoAgora(
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  agoraIso: string,
): PlantaoAgoraResumo {
  const ordenadas = [...atribuicoes].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const atual = ordenadas.find((atribuicao) => atribuicao.inicio <= agoraIso && agoraIso < atribuicao.fim) ?? null;
  const proximo = ordenadas.find((atribuicao) => atribuicao.inicio > agoraIso) ?? null;
  return { atual, proximo };
}

export function nomeExibicaoPlantonista(login: string, usuarios: readonly Usuario[]): string {
  return usuarios.find((usuario) => usuario.login === login)?.nome ?? login;
}

export function inicialPlantonista(nome: string): string {
  return nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('').toUpperCase();
}

/** Só contatos `ativo: true` — o mesmo critério que o Dashboard já usa para não oferecer um número desligado/trocado. */
export function contatosAtivosDoPlantonista(
  login: string,
  participantes: readonly ParticipantePlantao[],
): ContatoPlantonista[] {
  return (participantes.find((participante) => participante.login === login)?.contatos ?? [])
    .filter((contato) => contato.ativo);
}

/** Próximos plantões do PRÓPRIO usuário (`plantonistaLogin === login`), já em ordem cronológica, limitado a `limite` itens. */
export function proximosPlantoesDoUsuario(
  login: string,
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  agoraIso: string,
  limite: number,
): AtribuicaoPlantaoPersistida[] {
  return atribuicoes
    .filter((atribuicao) => atribuicao.plantonistaLogin === login && atribuicao.fim > agoraIso)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, limite);
}

export interface HorarioPlantaoExibicao {
  /** "HH:mm". */
  horaInicio: string;
  /** "HH:mm". */
  horaFim: string;
  /** `true` quando o plantão termina num dia civil diferente do início, no timezone do Grupo. */
  cruzaDiaSeguinte: boolean;
}

export function horarioPlantaoParaExibicao(
  atribuicao: Pick<AtribuicaoPlantaoPersistida, 'inicio' | 'fim'>,
  timezone: string,
): HorarioPlantaoExibicao {
  const inicio = converterInstanteUtcParaMomento(atribuicao.inicio, timezone);
  const fim = converterInstanteUtcParaMomento(atribuicao.fim, timezone);
  return { horaInicio: inicio.hora, horaFim: fim.hora, cruzaDiaSeguinte: inicio.data !== fim.data };
}

export function rotuloHorarioPlantaoExibicao(horario: HorarioPlantaoExibicao): string {
  return `${horario.horaInicio}–${horario.horaFim}${horario.cruzaDiaSeguinte ? ' (+1 dia)' : ''}`;
}

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-2 — todos os dias civis
 * entre `periodoInicio` e `periodoFim` (inclusive), na ordem do calendário.
 * A competência de Plantão nem sempre alinha com o mês civil (pode ir de
 * 26/07 a 25/08, por exemplo) — por isso o calendário do App usa o período
 * REAL da competência publicada (`CompetenciaPlantao.periodoInicio/Fim`),
 * nunca o primeiro/último dia do mês calculado a partir da competência.
 * Comparação/iteração por string ISO (largura fixa), mesmo princípio do
 * restante do módulo.
 */
export function diasCivisNoPeriodo(periodoInicio: string, periodoFim: string): string[] {
  const dias: string[] = [];
  let cursor = periodoInicio;
  while (cursor <= periodoFim) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

/** Atribuições agrupadas pelo dia civil (no timezone do Grupo) em que CADA UMA começa — mesmo critério de `lib/editorPlantao.ts`. */
export function atribuicoesPorDiaCivil(
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  timezone: string,
): Map<string, AtribuicaoPlantaoPersistida[]> {
  const porDia = new Map<string, AtribuicaoPlantaoPersistida[]>();
  for (const atribuicao of atribuicoes) {
    const dia = converterInstanteUtcParaMomento(atribuicao.inicio, timezone).data;
    const lista = porDia.get(dia) ?? [];
    lista.push(atribuicao);
    porDia.set(dia, lista);
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }
  return porDia;
}

/**
 * Índice ESTÁVEL (0..7) na paleta categórica de identidade visual
 * (`TAMANHO_PALETA_IDENTIDADE_PLANTAO`, `app/globals.css`). Usa
 * `ParticipantePlantao.corPreferida` quando o próprio plantonista já
 * escolheu uma cor válida; caso contrário cai num hash determinístico do
 * LOGIN (identificador estável, ao contrário do nome digitado no XLS usado
 * por `lib/editorPlantao.ts` — por isso um hash próprio aqui, não o mesmo
 * cálculo). A mesma pessoa nunca muda de cor entre sessões sem escolher.
 */
export function indiceCorPlantonista(
  login: string,
  participantes: readonly ParticipantePlantao[],
): number {
  const preferida = participantes.find((participante) => participante.login === login)?.corPreferida;
  if (typeof preferida === 'number' && Number.isInteger(preferida) && preferida >= 0 && preferida < TAMANHO_PALETA_IDENTIDADE_PLANTAO) {
    return preferida;
  }
  let hash = 0;
  for (let indice = 0; indice < login.length; indice += 1) {
    hash = (hash * 31 + login.charCodeAt(indice)) >>> 0;
  }
  return hash % TAMANHO_PALETA_IDENTIDADE_PLANTAO;
}
