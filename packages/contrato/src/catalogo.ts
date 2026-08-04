import type { TipoTurno } from './tipos.js';

export const CATALOGO_SOC: Record<string, TipoTurno> = {
  MD: {
    codigo: 'MD', descricao: 'Madrugada', categoria: 'TRABALHO',
    horaInicio: '01:00', horaFim: '07:00', duracaoMinutos: 360, viraDia: false,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['MADRUGADA', 'MD'],
  },
  M: {
    codigo: 'M', descricao: 'Manhã', categoria: 'TRABALHO',
    horaInicio: '07:00', horaFim: '13:00', duracaoMinutos: 360, viraDia: false,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['MANHA', 'MANHÃ', 'M'],
  },
  T: {
    codigo: 'T', descricao: 'Tarde', categoria: 'TRABALHO',
    horaInicio: '13:00', horaFim: '19:00', duracaoMinutos: 360, viraDia: false,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['TARDE', 'T'],
  },
  N: {
    codigo: 'N', descricao: 'Noite', categoria: 'TRABALHO',
    horaInicio: '19:00', horaFim: '01:00', duracaoMinutos: 360, viraDia: true,
    contaComoPlantao: false, pesoPlantao: 0, corHex: '#FFFF00',
    aliasesXLS: ['NOITE', 'N'],
  },
  X: {
    codigo: 'X', descricao: 'Férias', categoria: 'AUSENCIA',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#0070C0', aliasesXLS: ['X', 'FERIAS', 'FÉRIAS'],
  },
  DF: {
    codigo: 'DF', descricao: 'DSR - Final de Semana', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#FF3399', aliasesXLS: ['DF'],
  },
  DU: {
    codigo: 'DU', descricao: 'DSR - Dia útil', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#00B050', aliasesXLS: ['DU'],
  },
  BH: {
    codigo: 'BH', descricao: 'Compensação BH', categoria: 'COMPENSACAO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#FFD966', aliasesXLS: ['BH'],
  },
  FOLGA: {
    codigo: 'FOLGA', descricao: 'Folga - Feriado', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#CC99FF', aliasesXLS: ['FOLGA'],
  },
  AN: {
    codigo: 'AN', descricao: 'Folga Aniversário', categoria: 'DESCANSO',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#99CCFF', aliasesXLS: ['AN'],
  },
  HE: {
    codigo: 'HE', descricao: 'Hora Extra', categoria: 'EXTRA',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#00B0F0', aliasesXLS: ['HE'],
  },
  AFA: {
    codigo: 'AFA', descricao: 'Afastamento Atestado', categoria: 'AUSENCIA',
    duracaoMinutos: 0, viraDia: false, contaComoPlantao: false, pesoPlantao: 0,
    corHex: '#404040', aliasesXLS: ['#', 'AT', 'ATESTADO', 'AFASTAMENTO'],
  },
};
