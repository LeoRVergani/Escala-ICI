import type { RegraEscala } from './regrasEscala';

/**
 * REGRAS-ESCALA-3 — pontos de partida para o construtor: situações reais de
 * escala, já montadas, para o administrador ajustar em vez de começar do zero.
 */
export type ModeloRegra = Omit<RegraEscala, 'id'>;

export interface ExemploRegra {
  chave: string;
  titulo: string;
  descricao: string;
  modelo: ModeloRegra;
}

const base = { categoria: 'EMPRESA', ativa: true, vale: { tipo: 'TODAS' }, origem: 'ADMIN', schemaVersion: 1 } as const;

export const EXEMPLOS_REGRA: readonly ExemploRegra[] = [
  {
    chave: 'cinco-dias',
    titulo: 'Máximo de 5 dias seguidos',
    descricao: 'Para uma escala em que se trabalha 5 dias e se folga 2.',
    modelo: {
      ...base, nome: 'Máximo de 5 dias seguidos', descricao: 'Avisa quando a pessoa passa de 5 dias de trabalho sem folga.',
      quando: { logica: 'E', condicoes: [{ variavel: 'diasSeguidosTrabalho', op: '>', valor: 5 }] },
      entao: { gravidade: 'AVISO', bloqueiaPublicacao: false, mensagem: '{pessoa} trabalha {diasSeguidosTrabalho} dias seguidos — o máximo é {limite}', agrupar: 'PRIMEIRO_DIA_DA_SEQUENCIA' },
    },
  },
  {
    chave: 'turno-longo',
    titulo: 'Turno longo demais',
    descricao: 'Para escalas de turnos compridos, como 12 por 36.',
    modelo: {
      ...base, nome: 'Turno longo demais', descricao: 'Avisa quando o turno do dia passa do limite de horas.',
      quando: { logica: 'E', condicoes: [{ variavel: 'horasNoDia', op: '>', valor: 12 }] },
      entao: { gravidade: 'AVISO', bloqueiaPublicacao: false, mensagem: '{pessoa} tem turno de {horasNoDia} h no dia {dia} — o limite é {limite} h', agrupar: 'CADA_DIA' },
    },
  },
  {
    chave: 'descanso-12',
    titulo: 'Descanso de 12 h entre turnos',
    descricao: 'Uma versão mais rígida do descanso mínimo legal.',
    modelo: {
      ...base, nome: 'Descanso de 12 h entre turnos', descricao: 'Exige mais descanso que o mínimo legal entre dois turnos em dias seguidos.',
      quando: { logica: 'E', condicoes: [{ variavel: 'descansoHoras', op: '<', valor: 12 }, { variavel: 'folgasEntreTurnos', op: '==', valor: 0 }] },
      entao: { gravidade: 'CRITICO', bloqueiaPublicacao: false, mensagem: '{pessoa} tem só {descansoHoras} h de descanso antes do turno do dia {dia} — o combinado é {limite} h', agrupar: 'CADA_DIA' },
    },
  },
  {
    chave: 'domingo',
    titulo: 'Trabalho aos domingos',
    descricao: 'Só informa quem trabalha no domingo, para acompanhar o rodízio.',
    modelo: {
      ...base, nome: 'Trabalho aos domingos', descricao: 'Informa os domingos em que a pessoa está escalada.',
      quando: { logica: 'E', condicoes: [{ variavel: 'diaDaSemana', op: '==', valor: 0 }, { variavel: 'horasNoDia', op: '>', valor: 0 }] },
      entao: { gravidade: 'INFO', bloqueiaPublicacao: false, mensagem: '{pessoa} trabalha no domingo, dia {dia}', agrupar: 'CADA_DIA' },
    },
  },
];
