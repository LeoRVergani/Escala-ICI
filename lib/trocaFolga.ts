import type { Dia, TipoTurno, TurnosMes } from '@escala-ici/contrato';

import { gerarAlertasEscala, type AlertaEscala } from './alertasEscala';

/**
 * TROCA-FOLGA-1 — troca de folga pelo próprio colaborador, sem colega:
 * uma folga DF/DU vira dia de trabalho e um dia de trabalho vira folga.
 *
 * "Estar apto" = a troca não pode criar NENHUM alerta novo de regra
 * (6 dias seguidos / 11h entre turnos / 35h depois da folga) e as horas do
 * mês continuam as mesmas (garantido pela própria troca: o dia de folga
 * recebe exatamente o turno do dia de trabalho).
 */
export const CODIGOS_FOLGA_TROCAVEIS = ['DF', 'DU'] as const;

export function diaEhFolgaTrocavel(dia: Dia | undefined): boolean {
  return dia !== undefined && (CODIGOS_FOLGA_TROCAVEIS as readonly string[]).includes(dia.c);
}

/** Dia de trabalho comum (Hora Extra não entra: não é jornada contratual). */
export function diaEhTrabalhoTrocavel(dia: Dia | undefined, catalogo: Record<string, TipoTurno>): boolean {
  return dia !== undefined && catalogo[dia.c]?.categoria === 'TRABALHO';
}

export function aplicarTrocaDeFolga(
  dias: Record<string, Dia>,
  dataFolga: string,
  dataTrabalho: string,
): Record<string, Dia> {
  const folga = dias[dataFolga];
  const trabalho = dias[dataTrabalho];
  if (folga === undefined || trabalho === undefined) {
    throw new Error('Um dos dias da troca não existe na escala.');
  }
  // `seq` (contador de dias seguidos da importação) deixa de valer para os
  // dois dias trocados; fica de fora para não mostrar número errado.
  const semSeq = (dia: Dia): Dia => {
    const copia = { ...dia };
    delete copia.seq;
    return copia;
  };
  return { ...dias, [dataFolga]: semSeq(trabalho), [dataTrabalho]: semSeq(folga) };
}

function diaMes(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
}

function chaveAlerta(alerta: AlertaEscala): string {
  return alerta.tipo === 'SEQUENCIA_6X1'
    ? `${alerta.tipo}:${alerta.login}:${alerta.periodoInicio}:${alerta.periodoFim}`
    : `${alerta.tipo}:${alerta.login}:${alerta.dataAnterior}:${alerta.dataAtual}`;
}

export interface ValidacaoTrocaDeFolga {
  erros: string[];
  alertasNovos: AlertaEscala[];
}

export function validarTrocaDeFolga(entrada: {
  documento: TurnosMes;
  dataFolga: string;
  dataTrabalho: string;
  catalogo: Record<string, TipoTurno>;
  /** Dia de hoje (YYYY-MM-DD). Só dá para trocar dias a partir de amanhã. */
  hoje: string;
}): ValidacaoTrocaDeFolga {
  const { documento, dataFolga, dataTrabalho, catalogo, hoje } = entrada;
  const erros: string[] = [];
  const diaFolga = documento.dias[dataFolga];
  const diaTrabalho = documento.dias[dataTrabalho];

  if (documento.status !== 'PUBLICADA') {
    erros.push('Só dá para trocar dias de uma escala publicada.');
  }
  if (dataFolga === dataTrabalho) {
    erros.push('Escolha dois dias diferentes.');
  }
  if (!diaEhFolgaTrocavel(diaFolga)) {
    erros.push('O dia de folga precisa ser uma folga de DSR (DF ou DU).');
  }
  if (!diaEhTrabalhoTrocavel(diaTrabalho, catalogo)) {
    erros.push('O outro dia precisa ser um dia de trabalho comum (sem Hora Extra).');
  }
  if (dataFolga <= hoje || dataTrabalho <= hoje) {
    erros.push('Só dá para trocar dias a partir de amanhã.');
  }
  if (erros.length > 0) {
    return { erros, alertasNovos: [] };
  }

  const antes = new Set(gerarAlertasEscala([documento], catalogo).map(chaveAlerta));
  const depois = gerarAlertasEscala(
    [{ ...documento, dias: aplicarTrocaDeFolga(documento.dias, dataFolga, dataTrabalho) }],
    catalogo,
  );
  const alertasNovos = depois.filter((alerta) => !antes.has(chaveAlerta(alerta)));
  for (const alerta of alertasNovos) {
    erros.push(alerta.tipo === 'SEQUENCIA_6X1'
      ? `Ficaria ${alerta.diasConsecutivos} dias seguidos trabalhando, até ${diaMes(alerta.diaCritico)} (máximo 6).`
      : `Ficaria só ${Math.round(alerta.descansoHoras)}h de descanso entre ${diaMes(alerta.dataAnterior)} e ${diaMes(alerta.dataAtual)} (mínimo ${alerta.minimoHoras}h).`);
  }
  return { erros, alertasNovos };
}
