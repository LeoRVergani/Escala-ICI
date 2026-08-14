/**
 * Lembretes — domínio puro (Fase 2).
 *
 * Módulo independente de React/DOM/`window`/Firebase, no mesmo espírito de
 * `lib/trocasEscala.ts`: só tipos e regras de negócio testáveis isoladamente,
 * reaproveitáveis pelo PWA, pelo Dashboard, pelos repositories Firebase (fase
 * seguinte) e por um futuro cliente React Native.
 *
 * Nomenclatura deliberada: "Lembrete" nunca "Evento"/"EventoUsuario" — o
 * projeto já usa `EventoEscala`/`eventosEscala` (lib/modelos.ts) para
 * publicações/atualizações de escala, algo semanticamente diferente de uma
 * anotação pessoal do colaborador. Reutilizar "Evento" aqui criaria
 * ambiguidade entre as duas coleções.
 *
 * Dois tipos funcionais, um domínio comum (`ConteudoLembrete`):
 * - `LembretePessoal`: criado pelo próprio colaborador, privado.
 * - `LembreteAtribuido`: criado por um gestor para um colaborador do seu
 *   escopo, com autoria/destinatário e um `status` administrável.
 * Eles NÃO compartilham exatamente os mesmos campos nem os mesmos estados —
 * só pessoal usa exclusão definitiva (fora deste módulo); atribuído usa
 * `ATIVO`/`CANCELADO` para preservar histórico administrativo.
 *
 * Datas seguem o padrão civil `YYYY-MM-DD` já usado em todo o projeto
 * (`EventoEscala.data`, `SolicitacaoTroca.data` etc.) — nunca `Date`/UTC como
 * base do domínio. Diferente de `packages/contrato/src/jornada.ts`
 * (`partesData`), que só valida o FORMATO da data (regex) e deixa o
 * `Date.UTC` "rolar" datas inexistentes, `validarDataCivil` aqui confere o
 * calendário de verdade (dia existe no mês, ano bissexto) — não há
 * precedente reutilizável no projeto para isso, então a validação é nova.
 *
 * "Vira dia": ao contrário dos turnos da escala (que sempre têm duração
 * positiva, então `fim <= inicio` sempre significa virada — ver
 * `resolverJornadaDia`), um lembrete pode legitimamente ter início e fim
 * iguais só por erro de digitação. Decisão adotada: horário final igual ao
 * inicial é rejeitado na validação (janela de duração zero não faz
 * sentido); "vira dia" só é verdadeiro quando o horário final é
 * estritamente menor que o inicial (ex.: 22:00–01:00).
 */

export type TipoLembrete = 'PESSOAL' | 'ATRIBUIDO';

export type StatusLembreteAtribuido = 'ATIVO' | 'CANCELADO';

export const LIMITE_TITULO_LEMBRETE = 120;
export const LIMITE_DESCRICAO_LEMBRETE = 1000;
export const LIMITE_ALERTAS_LEMBRETE = 5;

const REGEX_DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/u;
const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/u;

function anoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasNoMesCivil(ano: number, mes: number): number {
  const dias = [31, anoBissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[mes - 1] ?? 0;
}

/** Confere se `data` é um dia civil que realmente existe (formato, mês, dia-no-mês, bissexto). */
export function validarDataCivil(data: string): boolean {
  const correspondencia = REGEX_DATA_CIVIL.exec(data);
  if (correspondencia === null) {
    return false;
  }
  const ano = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const dia = Number(correspondencia[3]);
  if (mes < 1 || mes > 12 || dia < 1) {
    return false;
  }
  return dia <= diasNoMesCivil(ano, mes);
}

/** `HH:mm`, 00–23 / 00–59, sempre com dois dígitos (rejeita "7:00", "24:00", "18:60"). */
export function validarHorario(horario: string): boolean {
  return REGEX_HORARIO.test(horario);
}

function minutosDoHorario(horario: string): number {
  const [horas, minutos] = horario.split(':');
  return Number(horas) * 60 + Number(minutos);
}

export function normalizarTituloLembrete(titulo: string): string {
  return titulo.trim();
}

/** String vazia (ou só espaços) normaliza para `null` — mesmo tratamento de "sem valor" em todo o módulo. */
export function normalizarDescricaoLembrete(descricao: string | null | undefined): string | null {
  if (descricao === null || descricao === undefined) {
    return null;
  }
  const normalizado = descricao.trim();
  return normalizado === '' ? null : normalizado;
}

/** Deduplica e ordena de forma determinística — seguro chamar mesmo fora do fluxo de validação (ex.: UI). */
export function normalizarAlertasLembrete(valores: readonly number[]): number[] {
  return [...new Set(valores)].sort((a, b) => a - b);
}

export interface HorarioLembrete {
  diaInteiro: boolean;
  horaInicio: string | null;
  horaFim: string | null;
  viraDia: boolean;
}

interface EntradaHorarioLembrete {
  diaInteiro: boolean;
  horaInicio: string | null;
  horaFim: string | null;
}

/** Deriva o `HorarioLembrete` final assumindo que a entrada já passou por `validarHorarioLembrete`. */
export function normalizarHorarioLembrete(entrada: EntradaHorarioLembrete): HorarioLembrete {
  if (entrada.diaInteiro) {
    return { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false };
  }
  const { horaInicio, horaFim } = entrada;
  const viraDia = horaInicio !== null
    && horaFim !== null
    && minutosDoHorario(horaFim) < minutosDoHorario(horaInicio);
  return { diaInteiro: false, horaInicio, horaFim: horaFim ?? null, viraDia };
}

/** Regras de coerência do horário — não valida a data, só a combinação diaInteiro/horaInicio/horaFim. */
export function validarHorarioLembrete(entrada: EntradaHorarioLembrete): string[] {
  const erros: string[] = [];

  if (entrada.diaInteiro) {
    if (entrada.horaInicio !== null || entrada.horaFim !== null) {
      erros.push('Lembrete de dia inteiro não deve ter horário definido.');
    }
    return erros;
  }

  if (entrada.horaInicio === null) {
    erros.push('Informe ao menos o horário de início, ou marque como dia inteiro.');
    return erros;
  }
  if (!validarHorario(entrada.horaInicio)) {
    erros.push('Horário de início inválido.');
  }

  if (entrada.horaFim !== null) {
    if (!validarHorario(entrada.horaFim)) {
      erros.push('Horário de término inválido.');
    } else if (entrada.horaFim === entrada.horaInicio) {
      erros.push('O horário de término deve ser diferente do início.');
    }
  }

  return erros;
}

function validarAlertasLembrete(valores: readonly number[]): string[] {
  const erros: string[] = [];
  if (valores.some((valor) => valor < 0)) {
    erros.push('A antecedência do alerta não pode ser negativa.');
  }
  if (new Set(valores).size !== valores.length) {
    erros.push('Não é possível repetir a mesma antecedência de alerta.');
  }
  if (valores.length > LIMITE_ALERTAS_LEMBRETE) {
    erros.push(`É permitido no máximo ${LIMITE_ALERTAS_LEMBRETE} alertas por lembrete.`);
  }
  return erros;
}

interface EntradaConteudoLembrete extends EntradaHorarioLembrete {
  titulo: string;
  descricao?: string | null;
  alertasAntecedenciaMin?: number[];
}

function validarConteudoLembrete(entrada: EntradaConteudoLembrete): string[] {
  const erros: string[] = [];

  const titulo = normalizarTituloLembrete(entrada.titulo);
  if (titulo === '') {
    erros.push('Informe um título para o lembrete.');
  } else if (titulo.length > LIMITE_TITULO_LEMBRETE) {
    erros.push(`O título deve ter no máximo ${LIMITE_TITULO_LEMBRETE} caracteres.`);
  }

  const descricao = normalizarDescricaoLembrete(entrada.descricao);
  if (descricao !== null && descricao.length > LIMITE_DESCRICAO_LEMBRETE) {
    erros.push(`A descrição deve ter no máximo ${LIMITE_DESCRICAO_LEMBRETE} caracteres.`);
  }

  erros.push(...validarHorarioLembrete(entrada));

  if (entrada.alertasAntecedenciaMin !== undefined) {
    erros.push(...validarAlertasLembrete(entrada.alertasAntecedenciaMin));
  }

  return erros;
}

/**
 * Conteúdo comum a `LembretePessoal` e `LembreteAtribuido` — o que muda entre
 * os dois é só autoria/destinatário/status, nunca a forma do conteúdo.
 */
export interface ConteudoLembrete {
  titulo: string;
  descricao: string | null;
  data: string;
  horario: HorarioLembrete;
  serieId: string | null;
  /**
   * Antecedências (em minutos) para um futuro sistema de alertas — ver
   * `docs/spec/LEMBRETES.md`. Puro dado nesta fase: nenhum scheduler, timer
   * ou notificação é implementado aqui.
   */
  alertasAntecedenciaMin: number[];
}

export interface LembretePessoal extends ConteudoLembrete {
  tipo: 'PESSOAL';
  schemaVersion: 1;
}

export interface LembreteAtribuido extends ConteudoLembrete {
  tipo: 'ATRIBUIDO';
  schemaVersion: 1;
  destinatarioLogin: string;
  destinatarioEquipeId: string;
  criadoPorLogin: string;
  criadoPorNome: string;
  status: StatusLembreteAtribuido;
}

export type Lembrete = LembretePessoal | LembreteAtribuido;

export interface EntradaLembrete extends EntradaConteudoLembrete {
  data: string;
}

/** Erros de validação de uma ocorrência única — lista vazia significa entrada válida. */
export function validarEntradaLembrete(entrada: EntradaLembrete): string[] {
  const erros = validarConteudoLembrete(entrada);
  if (!validarDataCivil(entrada.data)) {
    erros.push('Data inválida.');
  }
  return erros;
}

/** Normaliza uma entrada já validada (`validarEntradaLembrete` sem erros) para o conteúdo final. */
export function normalizarLembrete(
  entrada: EntradaLembrete & { serieId?: string | null },
): ConteudoLembrete {
  return {
    titulo: normalizarTituloLembrete(entrada.titulo),
    descricao: normalizarDescricaoLembrete(entrada.descricao),
    data: entrada.data,
    horario: normalizarHorarioLembrete(entrada),
    serieId: entrada.serieId ?? null,
    alertasAntecedenciaMin: normalizarAlertasLembrete(entrada.alertasAntecedenciaMin ?? []),
  };
}

export interface EntradaSerieLembrete extends EntradaConteudoLembrete {
  datas: string[];
}

/** Mesmas regras de `validarEntradaLembrete`, mas para todas as datas da série. */
export function validarEntradaSerieLembrete(entrada: EntradaSerieLembrete): string[] {
  const erros = validarConteudoLembrete(entrada);
  if (entrada.datas.length === 0) {
    erros.push('Informe ao menos uma data.');
  }
  const datasInvalidas = entrada.datas.filter((data) => !validarDataCivil(data));
  if (datasInvalidas.length > 0) {
    erros.push(`Data inválida: ${datasInvalidas.join(', ')}.`);
  }
  return erros;
}

/**
 * Gera uma ocorrência normalizada por data da série (deduplicadas e
 * ordenadas), todas compartilhando `serieId`. Não é um motor de recorrência
 * (sem RRULE, sem repetição infinita) — só "1 conteúdo + N datas explícitas".
 * `serieId` é responsabilidade do caller (ex.: `lib/uuid.ts` na fase de
 * repository) para manter esta função determinística em teste. Assume
 * entrada já validada por `validarEntradaSerieLembrete`.
 */
export function criarOcorrenciasSerie(
  entrada: EntradaSerieLembrete,
  serieId: string,
): ConteudoLembrete[] {
  const datasNormalizadas = [...new Set(entrada.datas)].sort();
  return datasNormalizadas.map((data) => normalizarLembrete({
    titulo: entrada.titulo,
    descricao: entrada.descricao,
    data,
    diaInteiro: entrada.diaInteiro,
    horaInicio: entrada.horaInicio,
    horaFim: entrada.horaFim,
    alertasAntecedenciaMin: entrada.alertasAntecedenciaMin,
    serieId,
  }));
}

interface OcorrenciaOrdenavel {
  data: string;
  horario: HorarioLembrete;
}

function chaveOrdenacaoHorario(horario: HorarioLembrete): number {
  if (horario.diaInteiro || horario.horaInicio === null) {
    return -1;
  }
  return minutosDoHorario(horario.horaInicio);
}

/**
 * Ordena por data e, dentro do mesmo dia, "Dia inteiro" primeiro e depois por
 * horário inicial crescente (decisão de UX documentada na Fase 2). Desempate
 * determinístico: `Array.prototype.sort` é estável (garantido pela spec
 * desde ES2019), então itens empatados preservam a ordem relativa de
 * entrada — nenhuma chave de desempate artificial é necessária.
 */
export function ordenarLembretes<T extends OcorrenciaOrdenavel>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.data !== b.data) {
      return a.data < b.data ? -1 : 1;
    }
    return chaveOrdenacaoHorario(a.horario) - chaveOrdenacaoHorario(b.horario);
  });
}

export interface GrupoLembretesPorData<T> {
  data: string;
  itens: T[];
}

/** Agrupa por `data` civil, já ordenado cronologicamente (reaproveita `ordenarLembretes`). */
export function agruparLembretesPorData<T extends OcorrenciaOrdenavel>(
  itens: readonly T[],
): GrupoLembretesPorData<T>[] {
  const ordenados = ordenarLembretes(itens);
  const grupos = new Map<string, T[]>();
  for (const item of ordenados) {
    const grupo = grupos.get(item.data);
    if (grupo === undefined) {
      grupos.set(item.data, [item]);
    } else {
      grupo.push(item);
    }
  }
  // Map preserva ordem de inserção e `ordenados` já está em ordem cronológica
  // (chave primária de `ordenarLembretes` é `data`), então iterar o Map basta.
  return [...grupos.entries()].map(([data, itensDoDia]) => ({ data, itens: itensDoDia }));
}

/**
 * Filtro por intervalo de datas civis, inclusivo nos dois limites. Compara
 * as strings `YYYY-MM-DD` diretamente (ordem lexicográfica == ordem
 * cronológica nesse formato) — nunca `Date`/UTC, para não introduzir
 * deslocamento de fuso horário.
 */
export function filtrarLembretesPorIntervalo<T extends { data: string }>(
  itens: readonly T[],
  dataInicio: string,
  dataFim: string,
): T[] {
  return itens.filter((item) => item.data >= dataInicio && item.data <= dataFim);
}

/** Exclui cancelados sem apagá-los do domínio — preserva histórico administrativo. */
export function lembretesAtribuidosAtivos(itens: readonly LembreteAtribuido[]): LembreteAtribuido[] {
  return itens.filter((item) => item.status === 'ATIVO');
}
