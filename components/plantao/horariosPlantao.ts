import {
  duracaoMinutosPadraoHorarioPlantaoDia,
  type PadraoHorarioPlantaoDia,
} from '@escala-ici/contrato';

export type TomHorarioPlantao = 'madrugada' | 'manha' | 'tarde' | 'noite' | 'vinte-quatro-horas';

export interface PadraoHorarioPlantaoModal {
  id: string;
  titulo: string;
  subtitulo: string;
  horaInicio: string;
  horaFim: string;
  fimDiaOffset: 0 | 1;
  duracaoMinutos: number;
  tom: TomHorarioPlantao;
}

/**
 * Presets de segurança para grupos antigos sem `padraoHorarioSemanal`.
 * Eles são sugestões visuais para novas atribuições; não alteram o Grupo nem
 * substituem o valor persistido. Os horários refletem os padrões operacionais
 * aprovados para criação rápida no editor de Plantão.
 */
export const PADROES_HORARIO_PLANTAO_FALLBACK: readonly PadraoHorarioPlantaoModal[] = [
  {
    id: 'noturno-19-07',
    titulo: 'Noturno',
    subtitulo: '19:00 → 07:00 · 12h',
    horaInicio: '19:00',
    horaFim: '07:00',
    fimDiaOffset: 1,
    duracaoMinutos: 12 * 60,
    tom: 'noite',
  },
  {
    id: 'cinco-horas-19-00',
    titulo: '5 horas',
    subtitulo: '19:00 → 00:00 · 5h',
    horaInicio: '19:00',
    horaFim: '00:00',
    fimDiaOffset: 1,
    duracaoMinutos: 5 * 60,
    tom: 'noite',
  },
  {
    id: 'vinte-quatro-19-19',
    titulo: '24 horas',
    subtitulo: '19:00 → 19:00 · 24h',
    horaInicio: '19:00',
    horaFim: '19:00',
    fimDiaOffset: 1,
    duracaoMinutos: 24 * 60,
    tom: 'vinte-quatro-horas',
  },
];

function minutos(hora: string): number {
  const [horaParte, minutoParte] = hora.split(':').map(Number);
  return (horaParte ?? 0) * 60 + (minutoParte ?? 0);
}

function identidadeHorario(horaInicio: string, horaFim: string, fimDiaOffset: 0 | 1): string {
  return `${horaInicio}-${horaFim}-${fimDiaOffset}`;
}

function classificarTom(horaInicio: string, horaFim: string, fimDiaOffset: 0 | 1, duracaoMinutos: number): TomHorarioPlantao {
  if (duracaoMinutos >= 24 * 60) {
    return 'vinte-quatro-horas';
  }
  if (horaInicio === '19:00' && horaFim === '07:00' && fimDiaOffset === 1) {
    return 'noite';
  }
  if (horaInicio === '19:00' && horaFim === '00:00' && fimDiaOffset === 1) {
    return 'noite';
  }
  const inicio = minutos(horaInicio);
  if (inicio < 6 * 60) {
    return 'madrugada';
  }
  if (inicio < 12 * 60) {
    return 'manha';
  }
  return 'tarde';
}

function tituloHorario(horaInicio: string, horaFim: string, fimDiaOffset: 0 | 1, duracaoMinutos: number): string {
  if (duracaoMinutos >= 24 * 60) {
    return '24 horas';
  }
  if (horaInicio === '19:00' && horaFim === '07:00' && fimDiaOffset === 1) {
    return 'Noturno';
  }
  if (horaInicio === '19:00' && horaFim === '00:00' && fimDiaOffset === 1) {
    return '5 horas';
  }
  if (horaInicio === '00:00') {
    return 'Madrugada';
  }
  if (minutos(horaInicio) < 12 * 60) {
    return 'Manhã';
  }
  return 'Tarde';
}

function montarPadrao(horaInicio: string, horaFim: string, fimDiaOffset: 0 | 1): PadraoHorarioPlantaoModal {
  const duracaoMinutos = Math.max(0, duracaoMinutosPadraoHorarioPlantaoDia({ horaInicio, horaFim, fimDiaOffset }));
  const id = identidadeHorario(horaInicio, horaFim, fimDiaOffset);
  return {
    id,
    titulo: tituloHorario(horaInicio, horaFim, fimDiaOffset, duracaoMinutos),
    subtitulo: `${horaInicio} → ${horaFim} · ${Math.floor(duracaoMinutos / 60)}h`,
    horaInicio,
    horaFim,
    fimDiaOffset,
    duracaoMinutos,
    tom: classificarTom(horaInicio, horaFim, fimDiaOffset, duracaoMinutos),
  };
}

/**
 * Converte os horários semanais do Grupo em opções únicas para o modal.
 * Os padrões do grupo aparecem primeiro; os presets de compatibilidade entram
 * apenas quando ainda não existem no grupo, mantendo sempre uma alternativa
 * operacional para grupos antigos.
 */
export function derivarPadroesHorarioPlantao(
  valor: readonly PadraoHorarioPlantaoDia[] | undefined,
): PadraoHorarioPlantaoModal[] {
  const encontrados = new Map<string, PadraoHorarioPlantaoModal>();
  for (const entrada of valor ?? []) {
    const chave = identidadeHorario(entrada.horaInicio, entrada.horaFim, entrada.fimDiaOffset);
    if (encontrados.has(chave)) {
      continue;
    }
    encontrados.set(chave, montarPadrao(entrada.horaInicio, entrada.horaFim, entrada.fimDiaOffset));
  }
  for (const preset of PADROES_HORARIO_PLANTAO_FALLBACK) {
    const chave = identidadeHorario(preset.horaInicio, preset.horaFim, preset.fimDiaOffset);
    if (!encontrados.has(chave)) {
      encontrados.set(chave, { ...preset, id: chave });
    }
  }
  const ordemVisual = new Map(
    PADROES_HORARIO_PLANTAO_FALLBACK.map((preset, indice) => [
      identidadeHorario(preset.horaInicio, preset.horaFim, preset.fimDiaOffset),
      indice,
    ]),
  );
  return [...encontrados.values()].sort((a, b) => (ordemVisual.get(a.id) ?? 99) - (ordemVisual.get(b.id) ?? 99));
}

export function padraoHorarioParaValores(
  padrao: PadraoHorarioPlantaoModal,
  dataInicial: string,
): { dataFinal: string; horaInicial: string; horaFinal: string } {
  const data = new Date(`${dataInicial}T12:00:00`);
  if (padrao.fimDiaOffset === 1) {
    data.setDate(data.getDate() + 1);
  }
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return {
    dataFinal: `${ano}-${mes}-${dia}`,
    horaInicial: padrao.horaInicio,
    horaFinal: padrao.horaFim,
  };
}

export function padraoHorarioCorrespondente(
  padroes: readonly PadraoHorarioPlantaoModal[],
  horaInicio: string,
  horaFim: string,
  dataInicial: string,
  dataFinal: string,
): PadraoHorarioPlantaoModal | null {
  const deslocamento = dataFinal !== dataInicial ? 1 : 0;
  return padroes.find((padrao) => padrao.horaInicio === horaInicio
    && padrao.horaFim === horaFim
    && padrao.fimDiaOffset === deslocamento) ?? null;
}
