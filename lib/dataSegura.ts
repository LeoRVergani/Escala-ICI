/**
 * Hotfix — RangeError: Invalid time value ao abrir detalhe/notificação de
 * troca (ver commit c40c537). Causa raiz: `criarEventoHistorico()`
 * (`lib/firebase/trocasRepository.ts`) recebia os argumentos `descricao`/`em`
 * trocados de posição em todos os pontos de escrita, então `historico[].em`
 * ficava gravado com um texto ("Solicitação criada") em vez de uma data.
 * `new Date("Solicitação criada")` é `Invalid Date`, e passar isso para
 * `Intl.DateTimeFormat().format()` lança `RangeError: Invalid time value` —
 * sem try/catch, isso derruba a árvore de render inteira (tela preta).
 *
 * A causa raiz já foi corrigida no repositório (novos registros gravam `em`
 * correto). Este módulo é a segunda linha de defesa, exigida à parte: nunca
 * deixar um valor de data malformado (deste bug ou de qualquer origem
 * futura — Timestamp do Firestore, `null`, string fora do padrão) chegar a
 * `new Date()`/`Intl.DateTimeFormat` sem checagem. Documentos de troca
 * criados antes do hotfix continuam com `historico[].em` corrompido — por
 * isso as funções abaixo devolvem um texto de fallback em vez de lançar.
 */

interface TimestampComoObjeto {
  seconds: number;
  nanoseconds?: number;
}

function ehTimestampComoObjeto(valor: unknown): valor is TimestampComoObjeto {
  return typeof valor === 'object'
    && valor !== null
    && 'seconds' in valor
    && typeof (valor as { seconds: unknown }).seconds === 'number';
}

function ehConversivelParaDate(valor: unknown): valor is { toDate: () => Date } {
  return typeof valor === 'object'
    && valor !== null
    && typeof (valor as { toDate?: unknown }).toDate === 'function';
}

/**
 * Converte qualquer valor plausível de data/hora para `Date`, sem nunca
 * lançar. Aceita `Timestamp` do Firestore (via `.toDate()`), o objeto
 * `{ seconds, nanoseconds }` de um `Timestamp` serializado, `Date`, string
 * ISO (data pura `YYYY-MM-DD` ou data-hora completa), `number` (epoch em
 * milissegundos) e `null`/`undefined`. Qualquer outra coisa, ou uma data
 * inválida depois de convertida, devolve `null`.
 */
export function toDateSafe(valor: unknown): Date | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (ehConversivelParaDate(valor)) {
    try {
      const data = valor.toDate();
      return data instanceof Date && !Number.isNaN(data.getTime()) ? data : null;
    } catch {
      return null;
    }
  }

  if (ehTimestampComoObjeto(valor)) {
    const milissegundos = valor.seconds * 1000 + Math.round((valor.nanoseconds ?? 0) / 1_000_000);
    const data = new Date(milissegundos);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  if (typeof valor === 'number') {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (texto === '') {
      return null;
    }
    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  return null;
}

/** Formata só a data (dia/mês/ano), nunca lança — devolve `fallback` para qualquer valor não conversível. */
export function formatarDataSafe(valor: unknown, fallback = '—'): string {
  const data = toDateSafe(valor);
  if (data === null) {
    return fallback;
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
  } catch {
    return fallback;
  }
}

/** Formata data e hora, nunca lança — devolve `fallback` para qualquer valor não conversível. */
export function formatarDataHoraSafe(valor: unknown, fallback = '—'): string {
  const data = toDateSafe(valor);
  if (data === null) {
    return fallback;
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
  } catch {
    return fallback;
  }
}

/**
 * Formata especificamente o campo `data` (dia calendário `YYYY-MM-DD`) de
 * uma troca. Diferente das funções acima: se o valor não for uma data válida,
 * mostra o próprio valor bruto (não um "—" genérico) para facilitar
 * diagnóstico, e só cai no fallback textual quando o campo está vazio.
 */
export function formatarDiaTrocaSafe(
  valor: string | null | undefined,
  opcoes: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' },
  fallback = 'Data não informada',
): string {
  if (valor === null || valor === undefined || valor.trim() === '') {
    return fallback;
  }
  const data = toDateSafe(valor);
  if (data === null) {
    return valor;
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
  } catch {
    return valor;
  }
}
