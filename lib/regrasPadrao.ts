import { LIMITE_DIAS_CONSECUTIVOS_TRABALHO, MINIMO_DESCANSO_APOS_FOLGA_HORAS, MINIMO_DESCANSO_HORAS } from './alertasEscala';
import type { RegraEscala } from './regrasEscala';

/**
 * REGRAS-ESCALA-1 — as regras que o sistema já aplicava, agora no formato
 * "SE … ENTÃO …". Os números vêm das MESMAS constantes de `alertasEscala.ts`
 * e um teste prova que o motor novo gera exatamente os mesmos alertas.
 * Nenhuma delas cita um modelo de escala: o limite é só um valor, que o
 * administrador poderá ajustar quando existir outro modelo (5x2, 12x36…).
 */
export const REGRAS_PADRAO: readonly RegraEscala[] = [
  {
    id: 'padrao-dias-seguidos',
    nome: 'Máximo de dias seguidos de trabalho',
    descricao: 'Avisa quando a pessoa passa do limite de dias trabalhados sem uma folga no meio.',
    categoria: 'LEGAL',
    ativa: true,
    quando: { logica: 'E', condicoes: [{ variavel: 'diasSeguidosTrabalho', op: '>', valor: LIMITE_DIAS_CONSECUTIVOS_TRABALHO }] },
    entao: {
      gravidade: 'CRITICO',
      bloqueiaPublicacao: false,
      mensagem: '{pessoa} trabalha {diasSeguidosTrabalho} dias seguidos — o máximo é {limite}',
      agrupar: 'PRIMEIRO_DIA_DA_SEQUENCIA',
      sugestao: 'Revise a escala de {pessoa} para incluir um dia de descanso antes do dia {dia}.',
    },
    vale: { tipo: 'TODAS' },
    origem: 'PADRAO',
    schemaVersion: 1,
  },
  {
    id: 'padrao-interjornada',
    nome: 'Descanso mínimo entre dois turnos',
    descricao: 'Avisa quando o intervalo entre o fim de um turno e o início do seguinte (em dias seguidos) é menor que o mínimo.',
    categoria: 'LEGAL',
    ativa: true,
    quando: {
      logica: 'E',
      condicoes: [
        { variavel: 'descansoHoras', op: '<', valor: MINIMO_DESCANSO_HORAS },
        { variavel: 'folgasEntreTurnos', op: '==', valor: 0 },
      ],
    },
    entao: {
      gravidade: 'AVISO',
      bloqueiaPublicacao: false,
      mensagem: '{pessoa} tem só {descansoHoras} h de descanso antes do turno do dia {dia} — o mínimo é {limite} h',
      agrupar: 'CADA_DIA',
      sugestao: 'Ajuste um dos turnos para garantir pelo menos {limite} horas de descanso entre eles.',
    },
    vale: { tipo: 'TODAS' },
    origem: 'PADRAO',
    schemaVersion: 1,
  },
  {
    id: 'padrao-descanso-apos-folga',
    nome: 'Descanso mínimo depois de uma folga (DSR)',
    descricao: 'Avisa quando, depois de uma folga, o descanso total até o turno seguinte é menor que o mínimo (24 h de folga + interjornada).',
    categoria: 'LEGAL',
    ativa: true,
    quando: {
      logica: 'E',
      condicoes: [
        { variavel: 'descansoHoras', op: '<', valor: MINIMO_DESCANSO_APOS_FOLGA_HORAS },
        { variavel: 'folgasEntreTurnos', op: '>=', valor: 1 },
      ],
    },
    entao: {
      gravidade: 'CRITICO',
      bloqueiaPublicacao: false,
      mensagem: '{pessoa} tem só {descansoHoras} h de descanso depois da folga, antes do dia {dia} — o mínimo é {limite} h',
      agrupar: 'CADA_DIA',
      sugestao: 'Ajuste o turno anterior ou o de retorno (ex.: retorno à tarde em vez de manhã) para fechar pelo menos {limite} horas de descanso.',
    },
    vale: { tipo: 'TODAS' },
    origem: 'PADRAO',
    schemaVersion: 1,
  },
];
