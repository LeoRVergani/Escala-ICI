import * as XLSX from 'xlsx';

import { montarChaveDia, normalizarTexto } from './normalizar.js';
import { calcularTotais } from './totais.js';
import {
  SCHEMA_VERSION,
  type Dia,
  type ErroImportacao,
  type OpcoesParse,
  type ResultadoParse,
  type TipoTurno,
  type TurnosMes,
} from './tipos.js';

interface Posicao {
  linha: number;
  coluna: number;
}

interface ColunaDia {
  coluna: number;
  data: string;
}

interface EstiloCelula {
  fgColor?: { rgb?: unknown };
  fill?: { fgColor?: { rgb?: unknown } };
}

interface CoresLegenda {
  trabalho?: string;
  porCodigo: Map<string, string>;
}

const VALOR_VAZIO = /^\s*$/u;
const DATA_DIA_MES = /^(\d{1,2})\/(\d{1,2})$/u;
const DATA_COMPLETA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/u;

function obterCelula(
  planilha: XLSX.WorkSheet,
  linha: number,
  coluna: number,
): XLSX.CellObject | undefined {
  const referencia = XLSX.utils.encode_cell({ r: linha, c: coluna });
  return planilha[referencia] as XLSX.CellObject | undefined;
}

function valorCelula(celula: XLSX.CellObject | undefined): unknown {
  return celula?.v;
}

function textoCelula(celula: XLSX.CellObject | undefined): string {
  if (celula === undefined || celula.v === null || celula.v === undefined) {
    return '';
  }

  if (typeof celula.v === 'string') {
    return celula.v.trim();
  }

  if (typeof celula.w === 'string' && celula.w.trim() !== '') {
    return celula.w.trim();
  }

  return String(celula.v).trim();
}

function corCelula(celula: XLSX.CellObject | undefined): string | undefined {
  const estilo = (
    celula as (XLSX.CellObject & { s?: EstiloCelula }) | undefined
  )?.s;
  const cor = estilo?.fgColor?.rgb ?? estilo?.fill?.fgColor?.rgb;
  if (typeof cor !== 'string' || cor.trim() === '') {
    return undefined;
  }
  return cor.replace(/^FF(?=[0-9A-F]{6}$)/iu, '').toUpperCase();
}

function ehVazio(valor: unknown): boolean {
  return (
    valor === null
    || valor === undefined
    || (typeof valor === 'string' && VALOR_VAZIO.test(valor))
  );
}

function chaveAlias(valor: unknown): string {
  return normalizarTexto(valor).replace(/\s+/gu, '');
}

function localizarTexto(
  planilha: XLSX.WorkSheet,
  procurado: string,
): Posicao | undefined {
  const referencia = planilha['!ref'];
  if (referencia === undefined) {
    return undefined;
  }

  const intervalo = XLSX.utils.decode_range(referencia);
  const alvo = chaveAlias(procurado);
  for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      if (chaveAlias(valorCelula(obterCelula(planilha, linha, coluna))) === alvo) {
        return { linha, coluna };
      }
    }
  }
  return undefined;
}

function extrairNomeEquipe(
  planilha: XLSX.WorkSheet,
  linhaLimite: number,
): string {
  const referencia = planilha['!ref'];
  if (referencia === undefined) {
    return '';
  }

  const intervalo = XLSX.utils.decode_range(referencia);
  for (let linha = intervalo.s.r; linha < linhaLimite; linha += 1) {
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const texto = textoCelula(obterCelula(planilha, linha, coluna));
      if (texto !== '' && chaveAlias(texto) !== 'TURNO') {
        return texto.replace(/\s*X1\s*$/iu, '');
      }
    }
  }
  return '';
}

function extrairAnoDaAbaEscala(
  planilha: XLSX.WorkSheet | undefined,
  primeiroDia: number,
  primeiroMes: number,
): number | undefined {
  const referencia = planilha?.['!ref'];
  if (planilha === undefined || referencia === undefined) {
    return undefined;
  }

  const intervalo = XLSX.utils.decode_range(referencia);
  let primeiroAnoEncontrado: number | undefined;

  for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
    const texto = textoCelula(obterCelula(planilha, linha, intervalo.s.c));
    const resultado = DATA_COMPLETA.exec(texto);
    if (resultado === null) {
      continue;
    }

    const dia = Number(resultado[1]);
    const mes = Number(resultado[2]);
    const ano = Number(resultado[3]);
    primeiroAnoEncontrado ??= ano;

    if (dia === primeiroDia && mes === primeiroMes) {
      return ano;
    }
  }

  return primeiroAnoEncontrado;
}

function criarErroEstrutural(
  valorEncontrado: string,
  motivo: string,
  sugestao?: string,
): ErroImportacao {
  return {
    linha: 1,
    coluna: 'A',
    valorEncontrado,
    motivo,
    severidade: 'BLOQUEANTE',
    ...(sugestao === undefined ? {} : { sugestao }),
  };
}

function criarResultadoVazio(
  erros: ErroImportacao[],
  equipeNome = '',
): ResultadoParse {
  return {
    ok: false,
    equipeNome,
    periodoInicio: '',
    periodoFim: '',
    totalDias: 0,
    documentos: [],
    erros,
    avisos: [],
  };
}

function resolverColunasDia(
  planilha: XLSX.WorkSheet,
  cabecalho: Posicao,
  anoInicio: number,
  erros: ErroImportacao[],
): ColunaDia[] {
  const colunas: ColunaDia[] = [];
  let ano = anoInicio;
  let mesAnterior: number | undefined;
  let coluna = cabecalho.coluna + 1;

  while (true) {
    const celula = obterCelula(planilha, cabecalho.linha, coluna);
    const texto = textoCelula(celula);
    if (ehVazio(valorCelula(celula))) {
      break;
    }

    const resultado = DATA_DIA_MES.exec(texto);
    if (resultado === null) {
      erros.push({
        linha: cabecalho.linha + 1,
        coluna: XLSX.utils.encode_col(coluna),
        valorEncontrado: texto,
        motivo: 'Cabeçalho de dia inválido; esperado DD/MM.',
        severidade: 'BLOQUEANTE',
      });
      coluna += 1;
      continue;
    }

    const dia = Number(resultado[1]);
    const mes = Number(resultado[2]);
    if (mesAnterior !== undefined && mes < mesAnterior) {
      ano += 1;
    }

    const data = new Date(Date.UTC(ano, mes - 1, dia));
    const dataValida = (
      data.getUTCFullYear() === ano
      && data.getUTCMonth() === mes - 1
      && data.getUTCDate() === dia
    );

    if (!dataValida) {
      erros.push({
        linha: cabecalho.linha + 1,
        coluna: XLSX.utils.encode_col(coluna),
        valorEncontrado: texto,
        motivo: 'Data inexistente no cabeçalho.',
        severidade: 'BLOQUEANTE',
      });
    } else {
      colunas.push({ coluna, data: montarChaveDia(data) });
      mesAnterior = mes;
    }
    coluna += 1;
  }

  return colunas;
}

function catalogoPorAlias(
  catalogo: Record<string, TipoTurno>,
): Map<string, TipoTurno> {
  const mapa = new Map<string, TipoTurno>();
  for (const tipo of Object.values(catalogo)) {
    const aliases = [tipo.codigo, ...tipo.aliasesXLS];
    for (const alias of aliases) {
      mapa.set(chaveAlias(alias), tipo);
    }
  }
  return mapa;
}

function extrairCoresLegenda(
  planilha: XLSX.WorkSheet,
  porAlias: Map<string, TipoTurno>,
): CoresLegenda {
  const cores: CoresLegenda = { porCodigo: new Map() };
  const legenda = localizarTexto(planilha, 'LEGENDA');
  const referencia = planilha['!ref'];
  if (legenda === undefined || referencia === undefined) {
    return cores;
  }

  const intervalo = XLSX.utils.decode_range(referencia);
  const ultimaLinha = Math.min(intervalo.e.r, legenda.linha + 16);
  for (let linha = legenda.linha + 1; linha <= ultimaLinha; linha += 1) {
    const celulaCodigo = obterCelula(planilha, linha, legenda.coluna);
    const descricao = chaveAlias(
      valorCelula(obterCelula(planilha, linha, legenda.coluna + 1)),
    );
    const cor = corCelula(celulaCodigo);
    if (cor === undefined) {
      continue;
    }

    if (descricao === 'TRABALHA') {
      cores.trabalho = cor;
      continue;
    }

    const tipo = porAlias.get(chaveAlias(valorCelula(celulaCodigo)));
    if (tipo !== undefined) {
      cores.porCodigo.set(tipo.codigo.toUpperCase(), cor);
    }
  }

  return cores;
}

function avisarCorDivergente(
  avisos: string[],
  celula: XLSX.CellObject | undefined,
  linha: number,
  coluna: number,
  esperado: string | undefined,
  valor: string,
): void {
  const encontrado = corCelula(celula);
  if (
    esperado === undefined
    || encontrado === undefined
    || encontrado === esperado
  ) {
    return;
  }

  avisos.push(
    `${XLSX.utils.encode_cell({ r: linha, c: coluna })}: a cor ${encontrado} `
    + `diverge da legenda (${esperado}) para "${valor}". `
    + 'O conteúdo da célula foi mantido como fonte de verdade.',
  );
}

function diaDeTrabalho(tipo: TipoTurno, seq?: number): Dia | undefined {
  if (
    tipo.horaInicio === undefined
    || tipo.horaFim === undefined
    || !Number.isInteger(tipo.duracaoMinutos)
    || tipo.duracaoMinutos <= 0
  ) {
    return undefined;
  }

  return {
    c: tipo.codigo.toUpperCase(),
    i: tipo.horaInicio,
    f: tipo.horaFim,
    m: tipo.duracaoMinutos,
    vd: tipo.viraDia,
    ...(seq === undefined ? {} : { seq }),
  };
}

function criarDiaTexto(tipo: TipoTurno): Dia | undefined {
  if (tipo.categoria === 'TRABALHO') {
    return diaDeTrabalho(tipo);
  }
  return { c: tipo.codigo.toUpperCase() };
}

interface CabecalhoTurnosEscala {
  linha: number;
  colunas: Map<number, TipoTurno>;
}

/**
 * Acha a linha da aba "Escala" que tem pelo menos duas colunas de turno de
 * trabalho (Madrugada/Manhã/Tarde/Noite) — não fixamos esses quatro nomes,
 * reaproveitamos os aliasesXLS do catálogo para achar a linha de forma
 * genérica.
 */
function localizarCabecalhoTurnosEscala(
  planilha: XLSX.WorkSheet,
  intervalo: XLSX.Range,
  porAlias: Map<string, TipoTurno>,
): CabecalhoTurnosEscala | undefined {
  for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
    const colunas = new Map<number, TipoTurno>();
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const tipo = porAlias.get(chaveAlias(valorCelula(obterCelula(planilha, linha, coluna))));
      if (tipo?.categoria === 'TRABALHO') {
        colunas.set(coluna, tipo);
      }
    }
    if (colunas.size >= 2) {
      return { linha, colunas };
    }
  }
  return undefined;
}

function localizarColunaDatasEscala(
  planilha: XLSX.WorkSheet,
  intervalo: XLSX.Range,
  linhaInicio: number,
): number | undefined {
  for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
    for (let linha = linhaInicio; linha <= intervalo.e.r; linha += 1) {
      if (DATA_COMPLETA.test(textoCelula(obterCelula(planilha, linha, coluna)))) {
        return coluna;
      }
    }
  }
  return undefined;
}

interface IndiceTurnosEscala {
  /** chave: `${loginNormalizado}|${dataISO}` */
  mapa: Map<string, TipoTurno>;
  /** falso quando a aba "Escala" não existe ou não tem a estrutura esperada — nesse caso o chamador deve cair no fallback silencioso do turno da aba Escalistas. */
  disponivel: boolean;
}

/**
 * A aba "Escalistas" guarda a sequência 1–6 do colaborador, mas o turno-base
 * dela (fill-down por bloco) não reflete cursos/trocas pontuais de horário.
 * A aba "Escala" tem o turno real de cada dia — este índice cruza
 * login normalizado + data com o turno real, para o chamador preferir esse
 * valor sobre o turno-base sempre que existir.
 */
function construirIndiceTurnosPorDia(
  planilhaEscala: XLSX.WorkSheet | undefined,
  porAlias: Map<string, TipoTurno>,
  erros: ErroImportacao[],
): IndiceTurnosEscala {
  const mapa = new Map<string, TipoTurno>();
  const referencia = planilhaEscala?.['!ref'];
  if (planilhaEscala === undefined || referencia === undefined) {
    return { mapa, disponivel: false };
  }

  const intervalo = XLSX.utils.decode_range(referencia);
  const cabecalhoTurnos = localizarCabecalhoTurnosEscala(planilhaEscala, intervalo, porAlias);
  if (cabecalhoTurnos === undefined) {
    return { mapa, disponivel: false };
  }

  const colunaData = localizarColunaDatasEscala(
    planilhaEscala,
    intervalo,
    cabecalhoTurnos.linha + 1,
  );
  if (colunaData === undefined) {
    return { mapa, disponivel: false };
  }

  for (let linha = cabecalhoTurnos.linha + 1; linha <= intervalo.e.r; linha += 1) {
    const resultado = DATA_COMPLETA.exec(
      textoCelula(obterCelula(planilhaEscala, linha, colunaData)),
    );
    if (resultado === null) {
      continue;
    }

    const data = new Date(Date.UTC(
      Number(resultado[3]),
      Number(resultado[2]) - 1,
      Number(resultado[1]),
    ));
    if (Number.isNaN(data.getTime())) {
      continue;
    }
    const dataISO = montarChaveDia(data);

    for (const [coluna, tipo] of cabecalhoTurnos.colunas) {
      const texto = textoCelula(obterCelula(planilhaEscala, linha, coluna));
      if (texto === '') {
        continue;
      }

      for (const loginBruto of texto.split('/')) {
        const login = loginBruto.trim();
        if (login === '') {
          continue;
        }

        const chave = `${chaveAlias(login)}|${dataISO}`;
        const existente = mapa.get(chave);
        if (existente !== undefined && existente.codigo !== tipo.codigo) {
          erros.push({
            linha: linha + 1,
            coluna: XLSX.utils.encode_col(coluna),
            login,
            data: dataISO,
            valorEncontrado: texto,
            motivo: 'Duplicidade de turno no dia: o login aparece em mais de um turno na aba Escala.',
            severidade: 'BLOQUEANTE',
          });
          continue;
        }

        mapa.set(chave, tipo);
      }
    }
  }

  return { mapa, disponivel: true };
}

/**
 * Converte a planilha em documentos prontos para preview.
 *
 * `documentos` continua preenchido quando `ok` é falso. Quem chama deve
 * obrigatoriamente bloquear qualquer persistência enquanto houver erros.
 */
export function parsePlanilhaEscala(
  arquivo: ArrayBuffer,
  opts: OpcoesParse,
): ResultadoParse {
  const workbook = XLSX.read(arquivo, { type: 'array', cellStyles: true });
  const planilha = workbook.Sheets.Escalistas;
  if (planilha === undefined) {
    return criarResultadoVazio([
      criarErroEstrutural(
        'Escalistas',
        'A aba obrigatória "Escalistas" não foi encontrada.',
      ),
    ]);
  }

  const cabecalho = localizarTexto(planilha, 'DIA/MÊS');
  if (cabecalho === undefined) {
    return criarResultadoVazio([
      criarErroEstrutural(
        'DIA/MÊS',
        'Não foi possível localizar o cabeçalho de datas.',
      ),
    ]);
  }

  const equipeNome = extrairNomeEquipe(planilha, cabecalho.linha);
  const colaborador = localizarTexto(planilha, 'COLABORADOR');
  const turno = localizarTexto(planilha, 'TURNO');
  if (colaborador === undefined || turno === undefined) {
    return criarResultadoVazio(
      [
        criarErroEstrutural(
          colaborador === undefined ? 'COLABORADOR' : 'TURNO',
          'Não foi possível localizar as colunas de colaborador e turno.',
        ),
      ],
      equipeNome,
    );
  }

  const primeiraData = textoCelula(
    obterCelula(planilha, cabecalho.linha, cabecalho.coluna + 1),
  );
  const primeiraDataResultado = DATA_DIA_MES.exec(primeiraData);
  if (primeiraDataResultado === null) {
    return criarResultadoVazio(
      [
        criarErroEstrutural(
          primeiraData,
          'A primeira data do período não está no formato DD/MM.',
        ),
      ],
      equipeNome,
    );
  }

  const primeiroDia = Number(primeiraDataResultado[1]);
  const primeiroMes = Number(primeiraDataResultado[2]);
  const anoInicio = extrairAnoDaAbaEscala(
    workbook.Sheets.Escala,
    primeiroDia,
    primeiroMes,
  ) ?? opts.anoInicio;

  if (anoInicio === undefined) {
    return criarResultadoVazio(
      [
        criarErroEstrutural(
          primeiraData,
          'Não foi possível determinar o ano inicial do período.',
          'Informe opts.anoInicio ou mantenha datas completas na aba Escala.',
        ),
      ],
      equipeNome,
    );
  }

  const erros: ErroImportacao[] = [];
  const colunasDia = resolverColunasDia(planilha, cabecalho, anoInicio, erros);
  if (colunasDia.length === 0) {
    erros.push(
      criarErroEstrutural(
        primeiraData,
        'Nenhuma coluna de dia válida foi encontrada.',
      ),
    );
    return criarResultadoVazio(erros, equipeNome);
  }

  const periodoInicio = colunasDia[0]?.data ?? '';
  const periodoFim = colunasDia.at(-1)?.data ?? '';
  const porAlias = catalogoPorAlias(opts.catalogo);
  const coresLegenda = extrairCoresLegenda(planilha, porAlias);
  const indiceTurnosEscala = construirIndiceTurnosPorDia(
    workbook.Sheets.Escala,
    porAlias,
    erros,
  );
  const documentos: TurnosMes[] = [];
  const avisos: string[] = [];
  let turnoAtual: TipoTurno | undefined;

  for (let linha = colaborador.linha + 1; ; linha += 1) {
    const celulaLogin = obterCelula(planilha, linha, colaborador.coluna);
    const login = textoCelula(celulaLogin);
    if (ehVazio(valorCelula(celulaLogin))) {
      break;
    }

    const textoTurno = textoCelula(obterCelula(planilha, linha, turno.coluna));
    if (textoTurno !== '') {
      const turnoEncontrado = porAlias.get(chaveAlias(textoTurno));
      if (turnoEncontrado?.categoria === 'TRABALHO') {
        turnoAtual = turnoEncontrado;
      } else {
        turnoAtual = undefined;
        erros.push({
          linha: linha + 1,
          coluna: XLSX.utils.encode_col(turno.coluna),
          login,
          valorEncontrado: textoTurno,
          motivo: 'Turno de trabalho não reconhecido pelo catálogo.',
          severidade: 'BLOQUEANTE',
        });
      }
    }

    const usuarioUid = opts.loginParaUid[login];
    if (usuarioUid === undefined) {
      erros.push({
        linha: linha + 1,
        coluna: XLSX.utils.encode_col(colaborador.coluna),
        login,
        valorEncontrado: login,
        motivo: 'Login não encontrado em opts.loginParaUid.',
        sugestao: 'Cadastre ou associe o login antes de publicar.',
        severidade: 'BLOQUEANTE',
      });
    }

    const dias: Record<string, Dia> = {};
    for (const colunaDia of colunasDia) {
      const celula = obterCelula(planilha, linha, colunaDia.coluna);
      const valor = valorCelula(celula);
      if (ehVazio(valor)) {
        continue;
      }

      if (typeof valor === 'number') {
        avisarCorDivergente(
          avisos,
          celula,
          linha,
          colunaDia.coluna,
          coresLegenda.trabalho,
          String(valor),
        );
        const seqValida = Number.isInteger(valor) && valor >= 1 && valor <= 6;
        const turnoReal = indiceTurnosEscala.mapa.get(
          `${chaveAlias(login)}|${colunaDia.data}`,
        );
        if (turnoReal === undefined && indiceTurnosEscala.disponivel) {
          avisos.push(
            `${login} em ${colunaDia.data}: não encontrado na aba Escala; `
            + `mantido o turno base "${turnoAtual?.codigo ?? '—'}" da aba Escalistas.`,
          );
        }
        const tipoDoDia = turnoReal ?? turnoAtual;
        const dia = tipoDoDia === undefined
          ? undefined
          : diaDeTrabalho(tipoDoDia, seqValida ? valor : undefined);

        if (!seqValida || dia === undefined) {
          erros.push({
            linha: linha + 1,
            coluna: XLSX.utils.encode_col(colunaDia.coluna),
            login,
            data: colunaDia.data,
            valorEncontrado: String(valor),
            motivo: !seqValida
              ? 'Sequência de trabalho inválida; esperado número inteiro entre 1 e 6.'
              : 'O turno não possui horário e duração válidos no catálogo.',
            /**
             * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — só o dígito
             * fora de 1-6 é ALERTA (pode ser uma exceção operacional
             * legítima: curso, treinamento, ausência — exemplo dado pelo
             * dono do produto). Dígito válido mas catálogo quebrado
             * (`dia === undefined` com `seqValida` verdadeiro) continua
             * BLOQUEANTE — é um problema de dado, não uma exceção.
             */
            severidade: !seqValida ? 'ALERTA' : 'BLOQUEANTE',
          });
        } else {
          dias[colunaDia.data] = dia;
        }
        continue;
      }

      const tipo = porAlias.get(chaveAlias(valor));
      const dia = tipo === undefined ? undefined : criarDiaTexto(tipo);
      if (tipo === undefined || dia === undefined) {
        erros.push({
          linha: linha + 1,
          coluna: XLSX.utils.encode_col(colunaDia.coluna),
          login,
          data: colunaDia.data,
          valorEncontrado: textoCelula(celula),
          motivo: tipo === undefined
            ? 'Valor não reconhecido pelos aliasesXLS do catálogo.'
            : 'Tipo de trabalho sem horário ou duração válidos no catálogo.',
          severidade: 'BLOQUEANTE',
        });
      } else {
        avisarCorDivergente(
          avisos,
          celula,
          linha,
          colunaDia.coluna,
          coresLegenda.porCodigo.get(tipo.codigo.toUpperCase()),
          textoCelula(celula),
        );
        dias[colunaDia.data] = dia;
      }
    }

    documentos.push({
      schemaVersion: SCHEMA_VERSION,
      usuarioUid: usuarioUid ?? '',
      login,
      equipeId: opts.equipeId,
      competencia: opts.competencia,
      periodoInicio,
      periodoFim,
      turnoPadrao: turnoAtual?.codigo.toUpperCase() ?? '',
      status: 'RASCUNHO',
      dias,
      totais: calcularTotais(dias, opts.catalogo),
    });
  }

  return {
    ok: erros.length === 0,
    equipeNome,
    periodoInicio,
    periodoFim,
    totalDias: colunasDia.length,
    documentos,
    erros,
    avisos,
  };
}
