import * as XLSX from 'xlsx';

import { CATALOGO_SOC } from './catalogo.js';
import { obterCelula, textoCelula } from './celulas.js';
import { periodoDoPonto } from './jornada.js';
import { normalizarChaveEstrutural, normalizarTexto } from './normalizar.js';
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

/**
 * MATRIZ-TURNOS-1 — escala em MATRIZ "turno × data" (ex.: escala de fim de ano do SOC): as LINHAS são os turnos
 * (Madrugada, Manhã, Tarde, Noite), as COLUNAS são as datas e cada célula tem o NOME de quem cobre aquele turno naquele dia.
 * Quem não aparece num dia está de folga — a folga não está escrita.
 *
 * É uma importação em TRECHO: cobre só os dias da planilha (não o período inteiro da competência). Quem junta o trecho com a
 * escala que já existir é `mesclarTrechoNaBase` (lib/importacaoMatrizTurnos.ts). Tabelas ao lado da matriz (totais,
 * fórmulas) nunca são lidas: o parser só olha as colunas de data e as linhas de turno.
 *
 * Regras de folga (decisão do gestor): feriado (cabeçalho com "Feriado") → FOLGA; sábado/domingo → DF; dia útil → DU.
 */

const SEMANA: Readonly<Record<string, number>> = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 };
const NOME_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;
const RE_DATA = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/u;
const LIMITE_VARREDURA_LINHAS = 80;
const LIMITE_VARREDURA_COLUNAS = 40;

export interface MatrizLocalizada {
  aba: string;
  linhaSemana: number;
  linhaData: number;
  colunaTurno: number;
  colunasData: Array<{ coluna: number; texto: string; semana: number; celula: XLSX.CellObject | undefined }>;
  linhasTurno: Array<{ linha: number; rotulo: string; tipo: TipoTurno }>;
  titulo: string;
}

function chaveRotulo(valor: unknown): string {
  return normalizarTexto(valor).replace(/\s+/gu, '');
}

/** Rótulo de turno de trabalho (MADRUGADA, MANHA…) → tipo do catálogo. */
function turnosPorRotulo(catalogo: Record<string, TipoTurno>): Map<string, TipoTurno> {
  const mapa = new Map<string, TipoTurno>();
  for (const tipo of Object.values(catalogo)) {
    if (tipo.categoria !== 'TRABALHO') continue;
    for (const alias of tipo.aliasesXLS) mapa.set(chaveRotulo(alias), tipo);
  }
  return mapa;
}

function diaDaSemanaDoCabecalho(texto: string): number | undefined {
  const chave = normalizarChaveEstrutural(texto);
  if (chave.length < 3 || chave.length > 8) return undefined;
  return SEMANA[chave.slice(0, 3)];
}

function dataDoCabecalho(celula: XLSX.CellObject | undefined): { dia: number; mes: number; ano?: number } | undefined {
  if (celula === undefined || celula.v === undefined || celula.v === null) return undefined;
  if (typeof celula.v === 'number' && celula.v > 30_000) {
    const partes = XLSX.SSF.parse_date_code(celula.v);
    return partes === null || partes === undefined ? undefined : { dia: partes.d, mes: partes.m, ano: partes.y };
  }
  const primeiraLinha = String(celula.v).split(/\r?\n/u)[0]?.trim() ?? '';
  const achado = RE_DATA.exec(primeiraLinha);
  if (achado === null) return undefined;
  const dia = Number(achado[1]);
  const mes = Number(achado[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return undefined;
  const ano = achado[3] === undefined ? undefined : (achado[3].length === 2 ? 2000 + Number(achado[3]) : Number(achado[3]));
  return { dia, mes, ...(ano === undefined ? {} : { ano }) };
}

/**
 * Acha a matriz pela ESTRUTURA (nunca pelo nome da aba ou do arquivo): uma célula "Turno" cuja linha tem 3+ dias da semana
 * em sequência, a linha de baixo com as datas (dd/mm ou data do Excel) e, na coluna do "Turno", 2+ linhas seguidas com
 * rótulos de turno de trabalho do catálogo (Madrugada/Manhã/Tarde/Noite).
 */
export function localizarMatrizTurnos(
  workbook: XLSX.WorkBook,
  catalogo: Record<string, TipoTurno> = CATALOGO_SOC,
): MatrizLocalizada | undefined {
  const rotulos = turnosPorRotulo(catalogo);
  for (const aba of workbook.SheetNames) {
    const planilha = workbook.Sheets[aba];
    const referencia = planilha?.['!ref'];
    if (planilha === undefined || referencia === undefined) continue;
    const intervalo = XLSX.utils.decode_range(referencia);
    const ultimaLinha = Math.min(intervalo.e.r, LIMITE_VARREDURA_LINHAS);
    const ultimaColuna = Math.min(intervalo.e.c, LIMITE_VARREDURA_COLUNAS);
    for (let linha = intervalo.s.r; linha <= ultimaLinha; linha += 1) {
      for (let coluna = intervalo.s.c; coluna <= ultimaColuna; coluna += 1) {
        if (normalizarChaveEstrutural(textoCelula(obterCelula(planilha, linha, coluna))) !== 'TURNO') continue;
        const colunasData: MatrizLocalizada['colunasData'] = [];
        for (let c = coluna + 1; c <= intervalo.e.c; c += 1) {
          const semana = diaDaSemanaDoCabecalho(textoCelula(obterCelula(planilha, linha, c)));
          const celulaData = obterCelula(planilha, linha + 1, c);
          if (semana === undefined || dataDoCabecalho(celulaData) === undefined) break;
          colunasData.push({ coluna: c, texto: String(celulaData?.v ?? ''), semana, celula: celulaData });
        }
        if (colunasData.length < 3) continue;
        const linhasTurno: MatrizLocalizada['linhasTurno'] = [];
        for (let l = linha + 2; l <= intervalo.e.r; l += 1) {
          const rotulo = textoCelula(obterCelula(planilha, l, coluna));
          const tipo = rotulos.get(chaveRotulo(rotulo));
          if (tipo === undefined) break;
          linhasTurno.push({ linha: l, rotulo, tipo });
        }
        if (linhasTurno.length < 2) continue;
        let titulo = '';
        for (let l = intervalo.s.r; l < linha && titulo === ''; l += 1) {
          for (let c = intervalo.s.c; c <= ultimaColuna && titulo === ''; c += 1) titulo = textoCelula(obterCelula(planilha, l, c));
        }
        return { aba, linhaSemana: linha, linhaData: linha + 1, colunaTurno: coluna, colunasData, linhasTurno, titulo };
      }
    }
  }
  return undefined;
}

function iso(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function semanaDe(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia, 12)).getUTCDay();
}

function dataExiste(ano: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function diaDeTrabalho(tipo: TipoTurno): Dia | undefined {
  if (tipo.horaInicio === undefined || tipo.horaFim === undefined || !Number.isInteger(tipo.duracaoMinutos) || tipo.duracaoMinutos <= 0) {
    return undefined;
  }
  return { c: tipo.codigo.toUpperCase(), i: tipo.horaInicio, f: tipo.horaFim, m: tipo.duracaoMinutos, vd: tipo.viraDia };
}

/** Código da folga de um dia em que a pessoa não cobre nenhum turno. */
export function codigoDeFolga(dataIso: string, ehFeriado: boolean): 'FOLGA' | 'DF' | 'DU' {
  if (ehFeriado) return 'FOLGA';
  const semana = new Date(`${dataIso}T12:00:00Z`).getUTCDay();
  return semana === 0 || semana === 6 ? 'DF' : 'DU';
}

export interface OpcoesParseMatriz extends OpcoesParse {
  /**
   * Nome como está na planilha → login do usuário (a conciliação do gestor). Sem entrada, o login do documento fica sendo o
   * próprio nome da planilha — e, sem usuário vinculado, o documento sai com erro BLOQUEANTE.
   */
  loginPorNomeFonte?: Record<string, string>;
}

export function parsePlanilhaMatrizTurnos(arquivo: ArrayBuffer, opts: OpcoesParseMatriz): ResultadoParse {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const matriz = localizarMatrizTurnos(workbook, opts.catalogo);
  const vazio: ResultadoParse = { ok: false, equipeNome: '', periodoInicio: '', periodoFim: '', totalDias: 0, documentos: [], erros: [], avisos: [] };
  if (matriz === undefined) {
    return { ...vazio, erros: [{ linha: 0, coluna: '', valorEncontrado: '', motivo: 'Matriz Turno × Data não encontrada na planilha.', severidade: 'BLOQUEANTE' }] };
  }
  const planilha = workbook.Sheets[matriz.aba]!;
  const erros: ErroImportacao[] = [];
  const avisos: string[] = [];
  const letra = (coluna: number) => XLSX.utils.encode_col(coluna);

  // ---- as datas (o cabeçalho não traz o ano: vem do título ou do dia da semana, e vira no fim do ano)
  const cabecalhos = matriz.colunasData.map((item) => ({ ...item, data: dataDoCabecalho(item.celula)! }));
  const primeiro = cabecalhos[0]!;
  let anoTitulo: number | undefined;
  const reAno = /\b(20\d{2})\b/u;
  const referencia = XLSX.utils.decode_range(planilha['!ref']!);
  for (let l = referencia.s.r; l < matriz.linhaSemana && anoTitulo === undefined; l += 1) {
    for (let c = referencia.s.c; c <= Math.min(referencia.e.c, LIMITE_VARREDURA_COLUNAS) && anoTitulo === undefined; c += 1) {
      const achado = reAno.exec(textoCelula(obterCelula(planilha, l, c)));
      if (achado !== null) anoTitulo = Number(achado[1]);
    }
  }
  const anoDeclarado = primeiro.data.ano ?? opts.anoInicio ?? anoTitulo;
  const candidatos = anoDeclarado === undefined
    ? [new Date().getUTCFullYear() - 1, new Date().getUTCFullYear(), new Date().getUTCFullYear() + 1, new Date().getUTCFullYear() + 2]
    : [anoDeclarado, anoDeclarado - 1, anoDeclarado + 1];
  const anoInicial = candidatos.find((ano) => dataExiste(ano, primeiro.data.mes, primeiro.data.dia) && semanaDe(ano, primeiro.data.mes, primeiro.data.dia) === primeiro.semana);
  if (anoInicial === undefined) {
    erros.push({
      linha: matriz.linhaData + 1, coluna: letra(primeiro.coluna), data: primeiro.texto.split(/\r?\n/u)[0] ?? '', valorEncontrado: primeiro.texto,
      motivo: 'Não consegui determinar o ano: nenhum ano próximo faz essa data cair no dia da semana do cabeçalho.',
      sugestao: 'Escreva o ano no título da planilha (ex.: "Escala de Final de Ano 2026") ou use datas completas.',
      severidade: 'BLOQUEANTE',
    });
    return { ...vazio, equipeNome: matriz.titulo, erros };
  }
  const datas: string[] = [];
  const colunaDaData = new Map<string, number>();
  const feriados = new Set<string>();
  let ano = anoInicial;
  let anterior = { mes: 0, dia: 0 };
  for (const cabecalho of cabecalhos) {
    const { mes, dia } = cabecalho.data;
    if (anterior.mes !== 0 && (mes < anterior.mes || (mes === anterior.mes && dia <= anterior.dia))) ano += 1;
    anterior = { mes, dia };
    if (!dataExiste(ano, mes, dia)) {
      erros.push({ linha: matriz.linhaData + 1, coluna: letra(cabecalho.coluna), valorEncontrado: cabecalho.texto, motivo: 'Data inexistente no cabeçalho.', severidade: 'BLOQUEANTE' });
      continue;
    }
    const dataIso = iso(ano, mes, dia);
    const semanaReal = semanaDe(ano, mes, dia);
    if (semanaReal !== cabecalho.semana) {
      erros.push({
        linha: matriz.linhaData + 1, coluna: letra(cabecalho.coluna), data: dataIso, valorEncontrado: cabecalho.texto.replace(/\r?\n/gu, ' '),
        motivo: `O dia da semana do cabeçalho não bate com a data: ${dia}/${mes}/${ano} cai em ${NOME_SEMANA[semanaReal]}.`,
        sugestao: 'Confira a data e o dia da semana da coluna.', severidade: 'ALERTA',
      });
    }
    datas.push(dataIso);
    colunaDaData.set(dataIso, cabecalho.coluna);
    if (normalizarChaveEstrutural(cabecalho.texto).includes('FERIADO')) feriados.add(dataIso);
  }
  if (datas.length === 0) return { ...vazio, equipeNome: matriz.titulo, erros };
  const periodoInicio = datas[0]!;
  const periodoFim = datas[datas.length - 1]!;

  // ---- o trecho precisa caber na competência escolhida (senão estaria sendo importado no mês errado)
  const periodoCompetencia = periodoDoPonto(opts.competencia);
  if (periodoCompetencia !== null && (periodoInicio < periodoCompetencia.periodoInicio || periodoFim > periodoCompetencia.periodoFim)) {
    const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    erros.push({
      linha: matriz.linhaData + 1, coluna: letra(primeiro.coluna), valorEncontrado: `${br(periodoInicio)} a ${br(periodoFim)}`,
      motivo: `O trecho ${br(periodoInicio)} a ${br(periodoFim)} não cabe na competência ${opts.competencia} (${br(periodoCompetencia.periodoInicio)} a ${br(periodoCompetencia.periodoFim)}).`,
      sugestao: 'Escolha a competência em que esse período termina (o rótulo é o mês em que o período acaba).', severidade: 'BLOQUEANTE',
    });
  }

  // ---- quem cobre cada turno em cada dia
  interface Pessoa { nome: string; linha: number; coluna: number; turnos: Map<string, TipoTurno> }
  const pessoas = new Map<string, Pessoa>();
  for (const { linha, rotulo, tipo } of matriz.linhasTurno) {
    for (const dataIso of datas) {
      const coluna = colunaDaData.get(dataIso)!;
      const nome = textoCelula(obterCelula(planilha, linha, coluna)).replace(/\s+/gu, ' ');
      if (nome === '') {
        erros.push({
          linha: linha + 1, coluna: letra(coluna), data: dataIso, valorEncontrado: '',
          motivo: `O turno ${rotulo} de ${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)} está sem ninguém.`, severidade: 'ALERTA',
        });
        continue;
      }
      const chave = normalizarTexto(nome);
      const pessoa = pessoas.get(chave) ?? { nome, linha: linha + 1, coluna, turnos: new Map<string, TipoTurno>() };
      pessoas.set(chave, pessoa);
      const jaTem = pessoa.turnos.get(dataIso);
      if (jaTem !== undefined) {
        erros.push({
          linha: linha + 1, coluna: letra(coluna), login: nome, data: dataIso, valorEncontrado: nome,
          motivo: `${nome} está em dois turnos no mesmo dia (${jaTem.descricao} e ${tipo.descricao}); só o primeiro foi mantido.`,
          sugestao: 'Corrija a planilha: uma pessoa cobre um turno por dia.', severidade: 'BLOQUEANTE',
        });
        continue;
      }
      pessoa.turnos.set(dataIso, tipo);
    }
  }
  for (const codigo of ['FOLGA', 'DF', 'DU']) {
    if (opts.catalogo[codigo] === undefined) {
      erros.push({ linha: 0, coluna: '', valorEncontrado: codigo, motivo: `O catálogo não tem o código de folga ${codigo}.`, severidade: 'BLOQUEANTE' });
    }
  }

  // ---- um documento por pessoa, só com os dias do trecho
  const documentos: TurnosMes[] = [];
  const ordenadas = [...pessoas.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  for (const [, pessoa] of ordenadas) {
    const login = opts.loginPorNomeFonte?.[pessoa.nome] ?? pessoa.nome;
    const usuarioUid = opts.loginParaUid[login];
    if (usuarioUid === undefined) {
      erros.push({
        linha: pessoa.linha, coluna: letra(pessoa.coluna), login, valorEncontrado: pessoa.nome,
        motivo: 'Nome da planilha sem usuário vinculado.', sugestao: 'Concilie o nome com um usuário da equipe antes de salvar.', severidade: 'BLOQUEANTE',
      });
    }
    const dias: Record<string, Dia> = {};
    const contagem = new Map<string, number>();
    for (const dataIso of datas) {
      const tipo = pessoa.turnos.get(dataIso);
      if (tipo !== undefined) {
        const dia = diaDeTrabalho(tipo);
        if (dia !== undefined) dias[dataIso] = dia;
        contagem.set(tipo.codigo, (contagem.get(tipo.codigo) ?? 0) + 1);
      } else {
        dias[dataIso] = { c: codigoDeFolga(dataIso, feriados.has(dataIso)) };
      }
    }
    const turnoPadrao = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    documentos.push({
      schemaVersion: SCHEMA_VERSION, usuarioUid: usuarioUid ?? '', login, equipeId: opts.equipeId, competencia: opts.competencia,
      periodoInicio, periodoFim, turnoPadrao: turnoPadrao.toUpperCase(), status: 'RASCUNHO', dias, totais: calcularTotais(dias, opts.catalogo),
    });
  }

  const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  avisos.push(`Escala em matriz (turno × data): ${documentos.length} pessoa(s), ${datas.length} dia(s), de ${br(periodoInicio)} a ${br(periodoFim)}. É uma importação em trecho: só esses dias são trocados.`);
  avisos.push('Folga: feriado → FOLGA; sábado e domingo → DF; dia útil → DU. Tabelas ao lado da matriz (totais, fórmulas) são ignoradas.');
  if (feriados.size > 0) avisos.push(`Feriados lidos do cabeçalho: ${[...feriados].map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ')}.`);

  return {
    ok: erros.length === 0, equipeNome: matriz.titulo, periodoInicio, periodoFim, totalDias: datas.length, documentos, erros, avisos,
    matriz: { aba: matriz.aba, datas, feriados: [...feriados], nomesFonte: ordenadas.map(([, pessoa]) => pessoa.nome) },
  };
}
