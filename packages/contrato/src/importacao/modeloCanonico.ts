import { normalizarCelula } from '../normalizar.js';
import type { FuncaoPlantao } from '../modeloPlantaoPersistente.js';
import type { ErroImportacaoPlantao, MomentoPlantao } from '../tiposPlantao.js';

/**
 * FASE-IMPORTADOR-UNIVERSAL-1 — modelo intermediário neutro entre "ler a
 * planilha" e "interpretar/persistir a escala" (`docs/spec/IMPORTADOR_UNIVERSAL_ESCALAS.md`).
 * Hoje só o domínio Plantão (intervalo único e multi-função) foi migrado
 * para este modelo — a Jornada 6x1 (`parsePlanilhaEscala`) continua com seu
 * próprio pipeline, não convertido aqui ainda (dívida documentada na spec,
 * seção "Limites").
 */
export type TipoEstruturaEscala = 'PLANTAO_INTERVALO' | 'PLANTAO_MULTIFONTE' | 'DESCONHECIDA';

/**
 * Um FATO extraído da planilha — nunca uma decisão de domínio. Não inclui
 * conciliação (login/uid), competência, GrupoPlantao ou qualquer estado do
 * Firestore/editor. `funcao` só é preenchida para `PLANTAO_MULTIFONTE`
 * (vem do CABEÇALHO da coluna, nunca inferida do nome da pessoa).
 */
export interface RegistroEscalaCanonico {
  origem: {
    folha: string;
    linha: number;
  };
  pessoa: {
    nomeFonte: string;
  };
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  duracaoMinutos: number;
  funcao?: FuncaoPlantao;
}

export interface DescobertaPlanilhaEscala {
  estrutura: TipoEstruturaEscala;
  /** 1 = alta confiança (estrutura reconhecida sem ambiguidade). 0 = nenhuma estrutura reconhecida. */
  confianca: number;
  abaOrigem: string;
}

export interface EstatisticasImportacaoEscala {
  registros: number;
  /** Contagem de ocorrências distintas (mesmo inicio+fim) — nunca igual a `registros` quando há multi-função. */
  ocorrencias: number;
  pessoasUnicas: number;
  /** Só populado quando algum registro tem `funcao` (fluxo multi-função). */
  porFuncao: Partial<Record<FuncaoPlantao, number>>;
  periodoInicio: MomentoPlantao | null;
  periodoFim: MomentoPlantao | null;
}

export interface ResultadoAnaliseEscala {
  descoberta: DescobertaPlanilhaEscala;
  registros: RegistroEscalaCanonico[];
  estatisticas: EstatisticasImportacaoEscala;
  avisos: string[];
  erros: ErroImportacaoPlantao[];
}

function minutosAbsolutos(momento: MomentoPlantao): number {
  const [ano, mes, dia] = momento.data.split('-').map(Number);
  const [hora, minuto] = momento.hora.split(':').map(Number);
  return Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 0, hora ?? 0, minuto ?? 0);
}

/**
 * Nomes únicos preservando a primeira grafia encontrada — mesma filosofia
 * de `listarPlantonistasUnicos()` (`parserPlantao.ts`), mas parametrizada
 * pelo modelo canônico (§56 da fase) em vez de `ResultadoParsePlantao`.
 */
export function pessoasUnicasDosRegistros(registros: readonly RegistroEscalaCanonico[]): string[] {
  const vistos = new Map<string, string>();
  for (const registro of registros) {
    const chave = normalizarCelula(registro.pessoa.nomeFonte);
    if (!vistos.has(chave)) {
      vistos.set(chave, registro.pessoa.nomeFonte);
    }
  }
  return [...vistos.values()];
}

/**
 * Calculada sempre a partir de TODOS os registros canônicos — nunca um
 * número fixo, nunca derivada de uma amostra parcial (§55/§56: a causa
 * raiz do bug de "4 plantonistas" era justamente uma lista parcial se
 * fazendo passar por lista completa).
 */
export function calcularEstatisticasImportacao(
  registros: readonly RegistroEscalaCanonico[],
): EstatisticasImportacaoEscala {
  const ocorrenciasUnicas = new Set(
    registros.map((registro) => `${registro.inicio.data}T${registro.inicio.hora}__${registro.fim.data}T${registro.fim.hora}`),
  );
  const porFuncao: Partial<Record<FuncaoPlantao, number>> = {};
  for (const registro of registros) {
    if (registro.funcao !== undefined) {
      porFuncao[registro.funcao] = (porFuncao[registro.funcao] ?? 0) + 1;
    }
  }

  let periodoInicio: MomentoPlantao | null = null;
  let periodoFim: MomentoPlantao | null = null;
  for (const registro of registros) {
    if (periodoInicio === null || minutosAbsolutos(registro.inicio) < minutosAbsolutos(periodoInicio)) {
      periodoInicio = registro.inicio;
    }
    if (periodoFim === null || minutosAbsolutos(registro.fim) > minutosAbsolutos(periodoFim)) {
      periodoFim = registro.fim;
    }
  }

  return {
    registros: registros.length,
    ocorrencias: ocorrenciasUnicas.size,
    pessoasUnicas: pessoasUnicasDosRegistros(registros).length,
    porFuncao,
    periodoInicio,
    periodoFim,
  };
}
