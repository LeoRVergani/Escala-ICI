import type { AtribuicaoPlantaoPersistida, FuncaoPlantao } from '@escala-ici/contrato';

import { intervaloPlantaoCivil } from './plantaoApp';

/**
 * HOJE-PLANTONISTA-1 — a tela Hoje de quem é plantonista (sem escala 6x1):
 * o meu plantão (agora ou o próximo), a passagem do plantão (anterior, agora,
 * próximo — no meu posto, se for multi-posto) e a minha semana de plantões.
 * Lógica pura (testada); a tela fica em HojePlantonista.tsx.
 */
type Atribuicao = AtribuicaoPlantaoPersistida;

export interface SequenciaPlantao {
  anterior: Atribuicao | null;
  atual: Atribuicao | null;
  proximo: Atribuicao | null;
}

/** Anterior, agora e próximo no mesmo posto (posto único: `funcao` indefinida). */
export function sequenciaDoPosto(
  atribuicoes: readonly Atribuicao[],
  agoraIso: string,
  funcao?: FuncaoPlantao | null,
): SequenciaPlantao {
  const doPosto = atribuicoes
    .filter((atribuicao) => funcao === undefined || (atribuicao.funcao ?? null) === funcao)
    .slice()
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const atual = doPosto.find((atribuicao) => atribuicao.inicio <= agoraIso && agoraIso < atribuicao.fim) ?? null;
  const referenciaAnterior = atual?.inicio ?? agoraIso;
  const anteriores = doPosto.filter((atribuicao) => atribuicao.fim <= referenciaAnterior && atribuicao !== atual);
  const anterior = anteriores.at(-1) ?? null;
  const referenciaProximo = atual?.fim ?? agoraIso;
  const proximo = doPosto.find((atribuicao) => atribuicao !== atual && atribuicao.inicio >= referenciaProximo) ?? null;
  return { anterior, atual, proximo };
}

export type EstadoMeuPlantao =
  | { estado: 'AGORA'; atribuicao: Atribuicao; minutosParaFim: number; progresso: number }
  | { estado: 'PROXIMO'; atribuicao: Atribuicao; minutosParaInicio: number }
  | { estado: 'NENHUM' };

export function meuPlantaoEmDestaque(login: string, atribuicoes: readonly Atribuicao[], agoraIso: string): EstadoMeuPlantao {
  const meus = atribuicoes
    .filter((atribuicao) => atribuicao.plantonistaLogin === login && atribuicao.fim > agoraIso)
    .slice()
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const primeiro = meus[0];
  if (!primeiro) return { estado: 'NENHUM' };
  const agora = Date.parse(agoraIso);
  const inicio = Date.parse(primeiro.inicio);
  const fim = Date.parse(primeiro.fim);
  if (inicio <= agora) {
    return {
      estado: 'AGORA',
      atribuicao: primeiro,
      minutosParaFim: Math.max(0, Math.round((fim - agora) / 60_000)),
      progresso: Math.min(1, Math.max(0, (agora - inicio) / Math.max(1, fim - inicio))),
    };
  }
  return { estado: 'PROXIMO', atribuicao: primeiro, minutosParaInicio: Math.round((inicio - agora) / 60_000) };
}

/** "em 45 min", "em 5 h 20 min", "em 3 dias". */
export function rotuloTempoAte(minutos: number): string {
  if (minutos < 60) return `em ${Math.max(1, minutos)} min`;
  if (minutos < 24 * 60) {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return resto === 0 ? `em ${horas} h` : `em ${horas} h ${resto} min`;
  }
  const dias = Math.round(minutos / (24 * 60));
  return dias === 1 ? 'amanhã' : `em ${dias} dias`;
}

export interface DiaDaMinhaSemana {
  data: string;
  hoje: boolean;
  /** Meus plantões que COMEÇAM nesse dia (horário local do Grupo). */
  plantoes: Array<{ atribuicao: Atribuicao; horaInicio: string; horaFim: string }>;
  /** Estou de plantão em parte desse dia vindo do dia anterior (ex.: 19:00 → 07:00). */
  continuacao: boolean;
}

function somarDiasCivil(data: string, dias: number): string {
  const base = new Date(`${data}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export function minhaSemanaDePlantao(
  login: string,
  atribuicoes: readonly Atribuicao[],
  dataHoje: string,
  timezone: string,
  dias = 7,
): DiaDaMinhaSemana[] {
  const meus = atribuicoes
    .filter((atribuicao) => atribuicao.plantonistaLogin === login)
    .map((atribuicao) => ({ atribuicao, intervalo: intervaloPlantaoCivil(atribuicao, timezone) }))
    .filter(({ intervalo }) => intervalo.valido);
  return Array.from({ length: dias }, (_, indice) => {
    const data = somarDiasCivil(dataHoje, indice);
    return {
      data,
      hoje: indice === 0,
      plantoes: meus
        .filter(({ intervalo }) => intervalo.dataInicio === data)
        .sort((a, b) => a.atribuicao.inicio.localeCompare(b.atribuicao.inicio))
        .map(({ atribuicao, intervalo }) => ({ atribuicao, horaInicio: intervalo.horaInicio, horaFim: intervalo.horaFim })),
      continuacao: meus.some(({ intervalo }) => intervalo.dataInicio < data && intervalo.dataFim >= data),
    };
  });
}
