import * as XLSX from 'xlsx';

import { ehVazio, obterCelula, textoCelula, valorCelula } from './celulas.js';
import { localizarTabelaPlantao } from './detectorPlanilha.js';
import { montarChaveDia, normalizarCelula, normalizarChaveEstrutural } from './normalizar.js';
import type {
  AtribuicaoPlantaoBruta,
  ContabilidadePlantaoInformada,
  ErroImportacaoPlantao,
  LacunaPlantao,
  MomentoPlantao,
  ResultadoParsePlantao,
  SobreposicaoPlantao,
  TotaisInformadosPlantao,
  TotalBrutoPlantao,
} from './tiposPlantao.js';

const PADRAO_DATA_HORA = /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})/u;
const PADRAO_PREFIXO_DIA_SEMANA = /^\s*([^,]+),/u;

/** Índice = `Date#getUTCDay()` (0 = domingo). */
const NOMES_DIA_SEMANA: readonly string[] = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const PADRAO_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/u;
const PADRAO_HORA = /^(\d{2}):(\d{2})$/u;

function minutosAbsolutos(momento: MomentoPlantao): number {
  const dataMatch = PADRAO_DATA_ISO.exec(momento.data);
  const horaMatch = PADRAO_HORA.exec(momento.hora);
  if (dataMatch === null || horaMatch === null) {
    throw new Error(`Momento de Plantão inválido: ${momento.data} ${momento.hora}`);
  }

  return Date.UTC(
    Number(dataMatch[1]),
    Number(dataMatch[2]) - 1,
    Number(dataMatch[3]),
    Number(horaMatch[1]),
    Number(horaMatch[2]),
  ) / 60_000;
}

interface MomentoInterpretado {
  momento: MomentoPlantao;
  avisoDiaSemana?: string;
}

/**
 * Extrai data+hora de um texto como "Segunda-feira, 17/08/2026 - 19:00".
 * A fonte de verdade é sempre o padrão numérico `DD/MM/YYYY - HH:mm`; o
 * nome do dia da semana (texto antes da primeira vírgula) NUNCA altera a
 * data — só gera um aviso quando diverge da data real, exatamente para
 * pegar erro de digitação sem deixar ele corromper o dado (ver seção
 * "Datas, horas e timezone" de `docs/spec/PLANTOES.md`).
 */
function interpretarMomento(texto: string): MomentoInterpretado | undefined {
  const bruto = texto.trim();
  const resultado = PADRAO_DATA_HORA.exec(bruto);
  if (resultado === null) {
    return undefined;
  }

  const dia = Number(resultado[1]);
  const mes = Number(resultado[2]);
  const ano = Number(resultado[3]);
  const hora = Number(resultado[4]);
  const minuto = Number(resultado[5]);

  if (hora > 23 || minuto > 59) {
    return undefined;
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const dataValida = (
    data.getUTCFullYear() === ano
    && data.getUTCMonth() === mes - 1
    && data.getUTCDate() === dia
  );
  if (!dataValida) {
    return undefined;
  }

  const momento: MomentoPlantao = {
    data: montarChaveDia(data),
    hora: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
  };

  const prefixo = PADRAO_PREFIXO_DIA_SEMANA.exec(bruto);
  let avisoDiaSemana: string | undefined;
  if (prefixo !== null) {
    const textoDiaSemana = prefixo[1] ?? '';
    const diaSemanaTexto = normalizarChaveEstrutural(textoDiaSemana);
    const diaSemanaReal = NOMES_DIA_SEMANA[data.getUTCDay()] ?? '';
    if (diaSemanaTexto !== '' && diaSemanaTexto !== normalizarChaveEstrutural(diaSemanaReal)) {
      avisoDiaSemana = `"${textoDiaSemana.trim()}" não corresponde ao dia da semana real de `
        + `${resultado[1]}/${resultado[2]}/${resultado[3]} (${diaSemanaReal}); `
        + 'a data numérica foi mantida como fonte de verdade.';
    }
  }

  return {
    momento,
    ...(avisoDiaSemana === undefined ? {} : { avisoDiaSemana }),
  };
}

/**
 * Aceita "156:0" (horas:minutos, minutos não necessariamente com zero à
 * esquerda) ou um valor só de horas ("0"). Nunca lança — valor não
 * reconhecido vira 0 minutos, preservando o texto original em
 * `valorHorasBruto` para diagnóstico (ver seção 16 da especificação).
 */
function interpretarHorasInformadas(valorBruto: string): number | undefined {
  const comMinutos = /^\s*(\d+)\s*:\s*(\d+)\s*$/u.exec(valorBruto);
  if (comMinutos !== null) {
    return Number(comMinutos[1]) * 60 + Number(comMinutos[2]);
  }

  const somenteHoras = /^\s*(\d+)\s*$/u.exec(valorBruto);
  if (somenteHoras !== null) {
    return Number(somenteHoras[1]) * 60;
  }

  return undefined;
}

function criarErroEstruturalPlantao(
  valorEncontrado: string,
  motivo: string,
): ErroImportacaoPlantao {
  return { linha: 1, coluna: 'A', valorEncontrado, motivo };
}

function resultadoVazioPlantao(
  erros: ErroImportacaoPlantao[],
  abaOrigem = '',
): ResultadoParsePlantao {
  return {
    ok: false,
    abaOrigem,
    atribuicoes: [],
    contabilidadeInformada: [],
    totaisInformados: null,
    totalBrutoCalculado: { quantidade: 0, minutos: 0 },
    sobreposicoes: [],
    erros,
    avisos: [],
  };
}

interface ContabilidadeExtraida {
  porPlantonista: ContabilidadePlantaoInformada[];
  totais: TotaisInformadosPlantao | null;
}

const MARCADOR_CONTABILIDADE = 'CONTABILIDADE';
const LINHAS_BUSCA_CABECALHO_CONTABILIDADE = 5;

/**
 * Procura, em qualquer lugar da mesma aba, a seção opcional "Contabilidade
 * dos Plantões no mês" (colunas "Plantonistas"/"N° Plantões"/"N° Horas").
 * Sua ausência não é erro — nem toda planilha de Plantão precisa ter essa
 * seção. Uma linha cuja coluna de nome normaliza para "TOTAL" é tratada
 * como o total agregado, não como um plantonista.
 */
function extrairContabilidadeInformada(
  planilha: XLSX.WorkSheet,
  avisos: string[],
): ContabilidadeExtraida {
  const referencia = planilha['!ref'];
  if (referencia === undefined) {
    return { porPlantonista: [], totais: null };
  }

  const intervalo = XLSX.utils.decode_range(referencia);
  let marcador: { linha: number; coluna: number } | undefined;
  for (let linha = intervalo.s.r; linha <= intervalo.e.r && marcador === undefined; linha += 1) {
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const chave = normalizarChaveEstrutural(valorCelula(obterCelula(planilha, linha, coluna)));
      if (chave.startsWith(MARCADOR_CONTABILIDADE)) {
        marcador = { linha, coluna };
        break;
      }
    }
  }
  if (marcador === undefined) {
    return { porPlantonista: [], totais: null };
  }

  let cabecalho: { linha: number; colNome: number; colQtd: number; colHoras: number } | undefined;
  const ultimaLinhaBusca = Math.min(
    intervalo.e.r,
    marcador.linha + LINHAS_BUSCA_CABECALHO_CONTABILIDADE,
  );
  for (let linha = marcador.linha; linha <= ultimaLinhaBusca && cabecalho === undefined; linha += 1) {
    let colNome: number | undefined;
    let colQtd: number | undefined;
    let colHoras: number | undefined;
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const chave = normalizarChaveEstrutural(valorCelula(obterCelula(planilha, linha, coluna)));
      if (chave === 'PLANTONISTAS') {
        colNome = coluna;
      } else if (chave === 'NPLANTOES') {
        colQtd = coluna;
      } else if (chave === 'NHORAS') {
        colHoras = coluna;
      }
    }
    if (colNome !== undefined && colQtd !== undefined && colHoras !== undefined) {
      cabecalho = { linha, colNome, colQtd, colHoras };
    }
  }
  if (cabecalho === undefined) {
    return { porPlantonista: [], totais: null };
  }

  const porPlantonista: ContabilidadePlantaoInformada[] = [];
  let totais: TotaisInformadosPlantao | null = null;

  for (let linha = cabecalho.linha + 1; linha <= intervalo.e.r; linha += 1) {
    const celulaNome = obterCelula(planilha, linha, cabecalho.colNome);
    if (ehVazio(valorCelula(celulaNome))) {
      break;
    }

    const nome = textoCelula(celulaNome);
    const valorHorasBruto = textoCelula(obterCelula(planilha, linha, cabecalho.colHoras));
    const quantidadeTexto = textoCelula(obterCelula(planilha, linha, cabecalho.colQtd));
    const quantidade = Number(quantidadeTexto);
    const minutosInformados = interpretarHorasInformadas(valorHorasBruto);

    if (minutosInformados === undefined) {
      avisos.push(
        `Contabilidade informada: valor de horas "${valorHorasBruto}" não reconhecido `
        + `para "${nome}" (linha ${linha + 1}); tratado como 0 minutos.`,
      );
    }

    if (normalizarChaveEstrutural(nome) === 'TOTAL') {
      totais = {
        totalPlantoesInformado: Number.isFinite(quantidade) ? quantidade : 0,
        totalMinutosInformado: minutosInformados ?? 0,
      };
      continue;
    }

    porPlantonista.push({
      plantonistaNomeOriginal: nome,
      quantidadeInformada: Number.isFinite(quantidade) ? quantidade : 0,
      minutosInformados: minutosInformados ?? 0,
      valorHorasBruto,
    });
  }

  return { porPlantonista, totais };
}

/**
 * Soma bruta das durações das atribuições — deliberadamente NÃO chamada de
 * "contabilidade mensal" (ver `TotalBrutoPlantao`). Não é a fonte de
 * verdade da contabilidade de negócio; é só o dado calculável a partir dos
 * intervalos lidos.
 */
export function calcularDuracaoBrutaDosIntervalos(
  atribuicoes: readonly AtribuicaoPlantaoBruta[],
): TotalBrutoPlantao {
  return atribuicoes.reduce<TotalBrutoPlantao>(
    (acumulado, atribuicao) => ({
      quantidade: acumulado.quantidade + 1,
      minutos: acumulado.minutos + atribuicao.duracaoMinutos,
    }),
    { quantidade: 0, minutos: 0 },
  );
}

/**
 * Detecta sobreposições de horário entre atribuições — nunca escolhe um
 * vencedor, nunca remove linha, só relata. `MESMO_PLANTONISTA` cobre
 * também o caso degenerado de duas linhas idênticas (mesmo início e fim).
 */
export function detectarSobreposicoesPlantao(
  atribuicoes: readonly AtribuicaoPlantaoBruta[],
): SobreposicaoPlantao[] {
  const comMinutos = atribuicoes.map((atribuicao) => ({
    atribuicao,
    inicio: minutosAbsolutos(atribuicao.inicio),
    fim: minutosAbsolutos(atribuicao.fim),
  }));

  const sobreposicoes: SobreposicaoPlantao[] = [];
  for (let i = 0; i < comMinutos.length; i += 1) {
    for (let j = i + 1; j < comMinutos.length; j += 1) {
      const x = comMinutos[i];
      const y = comMinutos[j];
      if (x === undefined || y === undefined) {
        continue;
      }
      const seSobrepoe = x.inicio < y.fim && y.inicio < x.fim;
      if (!seSobrepoe) {
        continue;
      }

      const mesmoPlantonista = normalizarCelula(x.atribuicao.plantonistaNomeOriginal)
        === normalizarCelula(y.atribuicao.plantonistaNomeOriginal);

      sobreposicoes.push({
        tipo: mesmoPlantonista ? 'MESMO_PLANTONISTA' : 'PLANTONISTAS_DIFERENTES',
        a: x.atribuicao,
        b: y.atribuicao,
      });
    }
  }
  return sobreposicoes;
}

/**
 * Lacunas cronológicas entre o fim de uma atribuição e o início da
 * seguinte (ordenadas por início). Informação estrutural pura — uma
 * lacuna real (ex.: 07:00 → 19:00 no Plantão COSI) pode ser cobertura
 * intencional, não falta de cobertura; a regra de cobertura é do futuro
 * Grupo de Plantão (PLANTÃO-3), não deste parser.
 */
export function identificarLacunasPlantao(
  atribuicoes: readonly AtribuicaoPlantaoBruta[],
): LacunaPlantao[] {
  const ordenadas = [...atribuicoes].sort(
    (a, b) => minutosAbsolutos(a.inicio) - minutosAbsolutos(b.inicio),
  );

  const lacunas: LacunaPlantao[] = [];
  for (let i = 0; i < ordenadas.length - 1; i += 1) {
    const atual = ordenadas[i];
    const proxima = ordenadas[i + 1];
    if (atual === undefined || proxima === undefined) {
      continue;
    }
    const fimAtualMin = minutosAbsolutos(atual.fim);
    const inicioProximaMin = minutosAbsolutos(proxima.inicio);
    if (inicioProximaMin > fimAtualMin) {
      lacunas.push({
        fimAnterior: atual.fim,
        inicioProximo: proxima.inicio,
        minutos: inicioProximaMin - fimAtualMin,
      });
    }
  }
  return lacunas;
}

/**
 * Nomes únicos preservando a primeira grafia encontrada — insumo puro
 * para a futura tela de conciliação nome→login da FASE PLANTÃO-2. Não
 * chama nenhum repositório de usuários, não inventa login.
 */
export function listarPlantonistasUnicos(resultado: ResultadoParsePlantao): string[] {
  const vistos = new Map<string, string>();
  for (const atribuicao of resultado.atribuicoes) {
    const chave = normalizarCelula(atribuicao.plantonistaNomeOriginal);
    if (!vistos.has(chave)) {
      vistos.set(chave, atribuicao.plantonistaNomeOriginal);
    }
  }
  return [...vistos.values()];
}

/**
 * Converte a tabela de atribuições de Plantão em dados prontos para
 * preview. Não persiste nada, não concilia login, não aplica nenhuma
 * regra de escala 6x1 (alertas/descanso/sequência/catálogo SOC são de
 * outro domínio). `atribuicoes` continua preenchido quando `ok` é falso,
 * na mesma filosofia de `parsePlanilhaEscala` — quem chama deve bloquear
 * qualquer persistência enquanto houver erros.
 */
export function parsePlanilhaPlantao(arquivo: ArrayBuffer): ResultadoParsePlantao {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const localizacao = localizarTabelaPlantao(workbook);

  if (localizacao.status === 'AUSENTE') {
    return resultadoVazioPlantao([
      criarErroEstruturalPlantao(
        'Plantonista.../Data Início/Data Fim',
        'Não foi possível localizar uma tabela de atribuições de Plantão '
        + '(cabeçalho esperado: uma coluna iniciada em "Plantonista", '
        + 'seguida de "Data Início" e "Data Fim", nesta ordem).',
      ),
    ]);
  }

  if (localizacao.status === 'AMBIGUA') {
    return resultadoVazioPlantao([
      criarErroEstruturalPlantao(
        (localizacao.abasCandidatas ?? []).join(', '),
        'Mais de uma aba desta planilha possui estrutura de tabela de '
        + 'Plantão; é necessário indicar manualmente qual aba usar.',
      ),
    ]);
  }

  const { aba, linhaCabecalho, colPlantonista, colInicio, colFim } = localizacao;
  const planilha = workbook.Sheets[aba as string] as XLSX.WorkSheet;
  const erros: ErroImportacaoPlantao[] = [];
  const avisos: string[] = [];
  const atribuicoes: AtribuicaoPlantaoBruta[] = [];

  for (
    let linha = (linhaCabecalho as number) + 1;
    ;
    linha += 1
  ) {
    const celulaNome = obterCelula(planilha, linha, colPlantonista as number);
    const nome = textoCelula(celulaNome);
    const textoInicio = textoCelula(obterCelula(planilha, linha, colInicio as number));
    const textoFim = textoCelula(obterCelula(planilha, linha, colFim as number));

    // Fim da tabela: linha inteiramente vazia. Uma linha com nome vazio mas
    // início/fim preenchidos NÃO encerra a leitura — é um erro de linha
    // (ver seção "Validações de intervalo" de docs/spec/PLANTOES.md), para
    // não confundir "faltou o nome nesta linha" com "acabou a tabela".
    if (ehVazio(valorCelula(celulaNome)) && textoInicio === '' && textoFim === '') {
      break;
    }

    if (nome === '') {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colPlantonista as number),
        valorEncontrado: nome,
        motivo: 'Nome do plantonista vazio.',
      });
      continue;
    }

    const inicio = interpretarMomento(textoInicio);
    if (inicio === undefined) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colInicio as number),
        plantonistaNomeOriginal: nome,
        valorEncontrado: textoInicio,
        motivo: 'Data/hora de início inválida ou não reconhecida (esperado '
          + '"DD/MM/AAAA - HH:mm").',
      });
      continue;
    }

    const fim = interpretarMomento(textoFim);
    if (fim === undefined) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colFim as number),
        plantonistaNomeOriginal: nome,
        valorEncontrado: textoFim,
        motivo: 'Data/hora de fim inválida ou não reconhecida (esperado '
          + '"DD/MM/AAAA - HH:mm").',
      });
      continue;
    }

    const duracaoMinutos = minutosAbsolutos(fim.momento) - minutosAbsolutos(inicio.momento);
    if (duracaoMinutos <= 0) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colFim as number),
        plantonistaNomeOriginal: nome,
        valorEncontrado: `${textoInicio} -> ${textoFim}`,
        motivo: 'O fim do plantão não é posterior ao início.',
      });
      continue;
    }

    if (inicio.avisoDiaSemana !== undefined) {
      avisos.push(`Linha ${linha + 1} (início): ${inicio.avisoDiaSemana}`);
    }
    if (fim.avisoDiaSemana !== undefined) {
      avisos.push(`Linha ${linha + 1} (fim): ${fim.avisoDiaSemana}`);
    }

    atribuicoes.push({
      plantonistaNomeOriginal: nome,
      inicio: inicio.momento,
      fim: fim.momento,
      duracaoMinutos,
      linhaOrigem: linha + 1,
      abaOrigem: aba as string,
    });
  }

  const { porPlantonista: contabilidadeInformada, totais: totaisInformados } =
    extrairContabilidadeInformada(planilha, avisos);
  const totalBrutoCalculado = calcularDuracaoBrutaDosIntervalos(atribuicoes);
  const sobreposicoes = detectarSobreposicoesPlantao(atribuicoes);

  if (totaisInformados !== null) {
    if (totaisInformados.totalMinutosInformado !== totalBrutoCalculado.minutos) {
      avisos.push(
        'Divergência entre o total bruto calculado dos intervalos '
        + `(${totalBrutoCalculado.minutos} min) e o total de horas informado na `
        + `planilha (${totaisInformados.totalMinutosInformado} min). Nenhum dos `
        + 'dois valores foi alterado — a reconciliação de negócio é decisão de '
        + 'fase futura.',
      );
    }
    if (totaisInformados.totalPlantoesInformado !== totalBrutoCalculado.quantidade) {
      avisos.push(
        'Divergência entre a quantidade bruta de atribuições lidas '
        + `(${totalBrutoCalculado.quantidade}) e a quantidade de plantões informada `
        + `na planilha (${totaisInformados.totalPlantoesInformado}). Nenhum dos dois `
        + 'valores foi alterado — a reconciliação de negócio é decisão de fase futura.',
      );
    }
  }

  return {
    ok: erros.length === 0,
    abaOrigem: aba as string,
    atribuicoes,
    contabilidadeInformada,
    totaisInformados,
    totalBrutoCalculado,
    sobreposicoes,
    erros,
    avisos,
  };
}
