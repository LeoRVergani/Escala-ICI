import {
  adicionarDias,
  resolverJornadaDia,
  type JornadaDia,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';

/**
 * Fase 3K-D2B — alertas operacionais da escala: 6x1 e descanso mínimo.
 *
 * Módulo puro, só no Dashboard. Reaproveita `resolverJornadaDia()` do
 * pacote `contrato` para saber se um dia é trabalho e quais são os
 * horários reais — a mesma função que já resolve `dia.i`/`dia.f` manuais
 * versus o catálogo e a categoria do turno, em vez de duplicar essa regra.
 *
 * Esta fase só alerta; não bloqueia publicação nem decide nada por conta
 * própria (ver `bloqueiaPublicacaoPorAlerta`, hoje sempre `false` — o gancho
 * já existe para o futuro sem precisar mudar a assinatura das funções).
 */

export const LIMITE_DIAS_CONSECUTIVOS_TRABALHO = 6;
export const MINIMO_DESCANSO_HORAS = 11;

export interface AlertaSequencia6x1 {
  tipo: 'SEQUENCIA_6X1';
  usuarioUid: string;
  login: string;
  diaCritico: string;
  periodoInicio: string;
  periodoFim: string;
  diasConsecutivos: number;
}

export interface AlertaDescansoInsuficiente {
  tipo: 'DESCANSO_INSUFICIENTE';
  usuarioUid: string;
  login: string;
  dataAnterior: string;
  codigoAnterior: string;
  horarioAnterior: string;
  dataAtual: string;
  codigoAtual: string;
  horarioAtual: string;
  descansoHoras: number;
}

export type AlertaEscala = AlertaSequencia6x1 | AlertaDescansoInsuficiente;

function intervaloDatas(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  for (let atual = inicio; atual <= fim; atual = adicionarDias(atual, 1)) {
    datas.push(atual);
  }
  return datas;
}

/**
 * Checagem rápida por código, sem precisar resolver o dia inteiro. Espelha
 * a mesma regra de categoria que `resolverJornadaDia()` usa internamente
 * (TRABALHO, PLANTÃO ou EXTRA contam como jornada real).
 */
export function isDiaDeTrabalho(
  codigoTurno: string,
  catalogo: Record<string, TipoTurno>,
): boolean {
  const categoria = catalogo[codigoTurno]?.categoria;
  return categoria === 'TRABALHO' || categoria === 'PLANTAO' || categoria === 'EXTRA';
}

/**
 * Contagem de dias consecutivos trabalhados até cada data do período,
 * zerando a cada dia de descanso/ausência/compensação ou sem escala.
 * Usada tanto para o alerta (`detectarSequencias6x1`) quanto para marcar
 * visualmente todo dia crítico na grade, não só o primeiro.
 */
export function calcularSequenciaTrabalho(
  documento: TurnosMes,
  catalogo: Record<string, TipoTurno>,
): Record<string, number> {
  const sequencia: Record<string, number> = {};
  let contagem = 0;
  for (const data of intervaloDatas(documento.periodoInicio, documento.periodoFim)) {
    const jornada = resolverJornadaDia(documento, catalogo, data);
    if (jornada.trabalha) {
      contagem += 1;
      sequencia[data] = contagem;
    } else {
      contagem = 0;
    }
  }
  return sequencia;
}

/**
 * Um alerta por sequência, disparado no dia em que ela primeiro se torna
 * crítica (7º dia consecutivo) — não um alerta por dia se a sequência
 * continuar além do 7º. A grade (`calcularSequenciaTrabalho`) continua
 * marcando todo dia a partir do 7º como crítico visualmente.
 */
export function detectarSequencias6x1(
  documento: TurnosMes,
  catalogo: Record<string, TipoTurno>,
): AlertaSequencia6x1[] {
  const sequencia = calcularSequenciaTrabalho(documento, catalogo);
  const alertas: AlertaSequencia6x1[] = [];
  for (const data of Object.keys(sequencia).sort()) {
    const contagem = sequencia[data]!;
    if (contagem === LIMITE_DIAS_CONSECUTIVOS_TRABALHO + 1) {
      alertas.push({
        tipo: 'SEQUENCIA_6X1',
        usuarioUid: documento.usuarioUid,
        login: documento.login,
        diaCritico: data,
        periodoInicio: adicionarDias(data, -(contagem - 1)),
        periodoFim: data,
        diasConsecutivos: contagem,
      });
    }
  }
  return alertas;
}

function instanteUtc(dataIso: string, hora: string): number {
  return new Date(`${dataIso}T${hora}:00Z`).getTime();
}

/**
 * Horas entre o fim do turno anterior e o início do próximo, considerando
 * a virada de dia (`viraDia`): o fim real acontece no dia seguinte à data
 * do turno quando ele vira a noite.
 */
export function calcularIntervaloDescansoHoras(
  anterior: Pick<JornadaDia, 'data' | 'fim' | 'viraDia'>,
  atual: Pick<JornadaDia, 'data' | 'inicio'>,
): number {
  if (anterior.fim === undefined || atual.inicio === undefined) {
    return Infinity;
  }
  const dataFimReal = anterior.viraDia ? adicionarDias(anterior.data, 1) : anterior.data;
  const fimMs = instanteUtc(dataFimReal, anterior.fim);
  const inicioMs = instanteUtc(atual.data, atual.inicio);
  return (inicioMs - fimMs) / (1000 * 60 * 60);
}

export function temDescansoInsuficiente(
  anterior: Pick<JornadaDia, 'data' | 'fim' | 'viraDia'>,
  atual: Pick<JornadaDia, 'data' | 'inicio'>,
  minimoHoras: number = MINIMO_DESCANSO_HORAS,
): boolean {
  return calcularIntervaloDescansoHoras(anterior, atual) < minimoHoras;
}

/** Só compara dias de calendário consecutivos (D e D+1) em que ambos trabalham. */
export function detectarDescansoInsuficiente(
  documento: TurnosMes,
  catalogo: Record<string, TipoTurno>,
  minimoHoras: number = MINIMO_DESCANSO_HORAS,
): AlertaDescansoInsuficiente[] {
  const datas = intervaloDatas(documento.periodoInicio, documento.periodoFim);
  const alertas: AlertaDescansoInsuficiente[] = [];

  for (let indice = 0; indice < datas.length - 1; indice += 1) {
    const jornadaAtual = resolverJornadaDia(documento, catalogo, datas[indice]!);
    const jornadaSeguinte = resolverJornadaDia(documento, catalogo, datas[indice + 1]!);
    if (!jornadaAtual.trabalha || !jornadaSeguinte.trabalha) {
      continue;
    }

    const descansoHoras = calcularIntervaloDescansoHoras(jornadaAtual, jornadaSeguinte);
    if (descansoHoras < minimoHoras) {
      alertas.push({
        tipo: 'DESCANSO_INSUFICIENTE',
        usuarioUid: documento.usuarioUid,
        login: documento.login,
        dataAnterior: jornadaAtual.data,
        codigoAnterior: jornadaAtual.codigo,
        horarioAnterior: `${jornadaAtual.inicio}–${jornadaAtual.fim}`,
        dataAtual: jornadaSeguinte.data,
        codigoAtual: jornadaSeguinte.codigo,
        horarioAtual: `${jornadaSeguinte.inicio}–${jornadaSeguinte.fim}`,
        descansoHoras,
      });
    }
  }

  return alertas;
}

export function gerarAlertasEscala(
  documentos: readonly TurnosMes[],
  catalogo: Record<string, TipoTurno>,
): AlertaEscala[] {
  return documentos.flatMap((documento) => [
    ...detectarSequencias6x1(documento, catalogo),
    ...detectarDescansoInsuficiente(documento, catalogo),
  ]);
}

/**
 * Preparado para o futuro: hoje sempre `false`. Esta fase só alerta — o
 * gancho existe para não ter que mudar assinaturas quando algum alerta
 * crítico passar a bloquear publicação.
 */
export function bloqueiaPublicacaoPorAlerta(alertas: readonly AlertaEscala[]): boolean {
  void alertas;
  return false;
}

export interface IndicadorCelulaAlerta {
  sequencia?: number;
  descansoInsuficiente?: boolean;
}

export function chaveIndicadorCelula(usuarioUid: string, data: string): string {
  return `${usuarioUid}_${data}`;
}

/**
 * Índice por `usuarioUid_data` para a grade colorir cada célula sem
 * recalcular a sequência inteira por célula renderizada.
 */
export function construirIndiceAlertasGrade(
  documentos: readonly TurnosMes[],
  catalogo: Record<string, TipoTurno>,
): Map<string, IndicadorCelulaAlerta> {
  const indice = new Map<string, IndicadorCelulaAlerta>();

  for (const documento of documentos) {
    const sequencia = calcularSequenciaTrabalho(documento, catalogo);
    for (const [data, contagem] of Object.entries(sequencia)) {
      const chave = chaveIndicadorCelula(documento.usuarioUid, data);
      indice.set(chave, { ...indice.get(chave), sequencia: contagem });
    }
    for (const alerta of detectarDescansoInsuficiente(documento, catalogo)) {
      const chave = chaveIndicadorCelula(alerta.usuarioUid, alerta.dataAtual);
      indice.set(chave, { ...indice.get(chave), descansoInsuficiente: true });
    }
  }

  return indice;
}
