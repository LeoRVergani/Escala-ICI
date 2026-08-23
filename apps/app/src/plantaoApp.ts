import {
  converterInstanteUtcParaMomento,
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
