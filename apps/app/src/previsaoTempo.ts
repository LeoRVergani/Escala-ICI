/**
 * PREVISAO-TEMPO-1 — previsão do tempo no horário do turno, pela Open-Meteo
 * (gratuita, sem chave, previsão hora a hora por 16 dias). O local fica num
 * lugar só (LOCAL_PREVISAO) para trocar quando precisar.
 */
export const LOCAL_PREVISAO = {
  nome: 'Curitiba',
  latitude: -25.4284,
  longitude: -49.2733,
  timezone: 'America/Sao_Paulo',
} as const;

export type TipoTempo = 'sol' | 'parcial' | 'nublado' | 'neblina' | 'garoa' | 'chuva' | 'tempestade' | 'neve';

export interface HoraPrevisao {
  /** Hora local no formato da API: "AAAA-MM-DDTHH:00". */
  hora: string;
  temperatura: number;
  chuva: number | null;
  codigo: number;
}

export interface PrevisaoTurno {
  tempMin: number;
  tempMax: number;
  /** Maior probabilidade de chuva (%) nas horas do turno. */
  chuvaMax: number | null;
  codigo: number;
  tipo: TipoTempo;
  rotulo: string;
}

export function urlPrevisao(local: { latitude: number; longitude: number; timezone: string } = LOCAL_PREVISAO): string {
  const parametros = new URLSearchParams({
    latitude: String(local.latitude),
    longitude: String(local.longitude),
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    timezone: local.timezone,
    forecast_days: '16',
  });
  return `https://api.open-meteo.com/v1/forecast?${parametros.toString()}`;
}

/** Converte a resposta da Open-Meteo em uma lista de horas (ignora qualquer formato inesperado). */
export function interpretarPrevisao(resposta: unknown): HoraPrevisao[] {
  const horaria = (resposta as { hourly?: Record<string, unknown> } | null)?.hourly;
  const horas = horaria?.time;
  const temperaturas = horaria?.temperature_2m;
  const codigos = horaria?.weather_code;
  const chuvas = horaria?.precipitation_probability;
  if (!Array.isArray(horas) || !Array.isArray(temperaturas) || !Array.isArray(codigos)) {
    return [];
  }
  const resultado: HoraPrevisao[] = [];
  horas.forEach((hora, indice) => {
    const temperatura = temperaturas[indice];
    const codigo = codigos[indice];
    if (typeof hora !== 'string' || typeof temperatura !== 'number' || typeof codigo !== 'number') return;
    const chuva = Array.isArray(chuvas) && typeof chuvas[indice] === 'number' ? (chuvas[indice] as number) : null;
    resultado.push({ hora, temperatura, chuva, codigo });
  });
  return resultado;
}

/** WMO weather code → tipo de ícone e texto em português. */
export function descreverTempo(codigo: number): { tipo: TipoTempo; rotulo: string } {
  if (codigo === 0) return { tipo: 'sol', rotulo: 'Céu limpo' };
  if (codigo === 1 || codigo === 2) return { tipo: 'parcial', rotulo: 'Parcialmente nublado' };
  if (codigo === 3) return { tipo: 'nublado', rotulo: 'Nublado' };
  if (codigo === 45 || codigo === 48) return { tipo: 'neblina', rotulo: 'Neblina' };
  if (codigo >= 51 && codigo <= 57) return { tipo: 'garoa', rotulo: 'Garoa' };
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return { tipo: 'chuva', rotulo: 'Chuva' };
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { tipo: 'neve', rotulo: 'Neve' };
  if (codigo >= 95) return { tipo: 'tempestade', rotulo: 'Tempestade' };
  return { tipo: 'nublado', rotulo: 'Nublado' };
}

const GRAVIDADE: Record<TipoTempo, number> = {
  sol: 0, parcial: 1, nublado: 2, neblina: 3, garoa: 4, chuva: 5, neve: 6, tempestade: 7,
};

function diaSeguinte(data: string): string {
  const base = new Date(`${data}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

/**
 * Previsão das horas do turno (início → fim; turno que passa da meia-noite
 * termina no dia seguinte). O ícone é o PIOR tempo do período: se chove em
 * alguma hora do turno, aparece chuva.
 */
export function previsaoDoTurno(horas: readonly HoraPrevisao[], data: string, inicio: string, fim: string): PrevisaoTurno | null {
  const comeco = `${data}T${inicio.slice(0, 2)}:00`;
  const termino = `${fim <= inicio ? diaSeguinte(data) : data}T${fim}`;
  const doTurno = horas.filter((hora) => hora.hora >= comeco && hora.hora < termino);
  if (doTurno.length === 0) {
    return null;
  }
  const temperaturas = doTurno.map((hora) => hora.temperatura);
  const chuvas = doTurno.map((hora) => hora.chuva).filter((valor): valor is number => valor !== null);
  const pior = doTurno.reduce((atual, hora) => (
    GRAVIDADE[descreverTempo(hora.codigo).tipo] > GRAVIDADE[descreverTempo(atual.codigo).tipo] ? hora : atual
  ));
  const descricao = descreverTempo(pior.codigo);
  return {
    tempMin: Math.round(Math.min(...temperaturas)),
    tempMax: Math.round(Math.max(...temperaturas)),
    chuvaMax: chuvas.length > 0 ? Math.max(...chuvas) : null,
    codigo: pior.codigo,
    ...descricao,
  };
}

/** "18°" ou "16°–21°". */
export function faixaTemperatura(previsao: Pick<PrevisaoTurno, 'tempMin' | 'tempMax'>): string {
  return previsao.tempMin === previsao.tempMax ? `${previsao.tempMax}°` : `${previsao.tempMin}°–${previsao.tempMax}°`;
}

// ---------------------------------------------------------------------------
// Busca com cache de 1 hora no aparelho (localStorage). Falha → null, sem erro.
const CHAVE_CACHE = 'escala-ici:previsao-tempo:v1';
const VALIDADE_MS = 60 * 60 * 1000;

export async function obterPrevisaoHoraria(agora: number = Date.now()): Promise<HoraPrevisao[] | null> {
  try {
    const guardado = typeof localStorage === 'undefined' ? null : localStorage.getItem(CHAVE_CACHE);
    if (guardado) {
      const cache = JSON.parse(guardado) as { em: number; horas: HoraPrevisao[] };
      if (agora - cache.em < VALIDADE_MS && Array.isArray(cache.horas) && cache.horas.length > 0) {
        return cache.horas;
      }
    }
  } catch {
    // cache corrompido: ignora e busca de novo
  }
  try {
    const resposta = await fetch(urlPrevisao());
    if (!resposta.ok) return null;
    const horas = interpretarPrevisao(await resposta.json());
    if (horas.length === 0) return null;
    try {
      localStorage.setItem(CHAVE_CACHE, JSON.stringify({ em: agora, horas }));
    } catch {
      // sem espaço/privado: segue sem cache
    }
    return horas;
  } catch {
    return null;
  }
}
