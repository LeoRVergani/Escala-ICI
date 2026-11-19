import { calcularTotais, type Dia, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

import { avaliarRegras, diferencaDeProblemas, type AlertaRegra, type RegraEscala } from './regrasEscala';

/**
 * INVERSAO-ESCALAS-1 — inverter as escalas de DUAS pessoas num período: cada dia do período, uma passa a ter o que a outra tinha.
 * Serve para quando duas pessoas combinam de trocar (ex.: "já combinei com o Daniel, eu folgo no Natal") e o coordenador não
 * quer trocar célula por célula. Função pura: não grava nada; quem aplica no rascunho é o Dashboard.
 *
 * Como é uma PERMUTA entre duas pessoas, a cobertura de cada turno em cada dia não muda — só muda quem faz o quê. O que pode
 * mudar são os alertas de regra de CADA uma das duas (descanso, dias seguidos), por isso `conferirRegrasDaInversao` compara antes e depois.
 */
export interface PeriodoInversao {
  inicio: string;
  fim: string;
}

export interface DiaTrocado {
  data: string;
  /** O que A tinha (e B passa a ter). */
  deA: Dia;
  /** O que B tinha (e A passa a ter). */
  deB: Dia;
}

export interface PlanoInversao {
  loginA: string;
  loginB: string;
  periodo: PeriodoInversao;
  /** Os dias em que as duas escalas diferem (os que de fato mudam). */
  trocados: DiaTrocado[];
  /** Dias do período em que as duas já tinham o mesmo (nada a trocar). */
  iguais: number;
  /** Dias do período que faltam na escala de uma das duas (ficam como estão). */
  semDados: string[];
  /** Verdadeiro quando o período cobre TODOS os dias das duas: o turno-base (`turnoPadrao`) também é trocado. */
  trocouTurnoPadrao: boolean;
  documentoA: TurnosMes;
  documentoB: TurnosMes;
}

export type ResultadoPlanoInversao = { ok: true; plano: PlanoInversao } | { ok: false; erro: string };

const semSeq = (dia: Dia): Dia => {
  const copia = { ...dia };
  delete copia.seq;
  return copia;
};
const mesmoDia = (a: Dia, b: Dia): boolean => JSON.stringify(semSeq(a)) === JSON.stringify(semSeq(b));
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function planejarInversao(
  documentos: readonly TurnosMes[],
  loginA: string,
  loginB: string,
  periodo: PeriodoInversao,
  catalogo: Record<string, TipoTurno>,
): ResultadoPlanoInversao {
  if (loginA === '' || loginB === '') return { ok: false, erro: 'Escolha as duas pessoas.' };
  if (loginA === loginB) return { ok: false, erro: 'Escolha duas pessoas diferentes.' };
  const documentoA = documentos.find((documento) => documento.login === loginA);
  const documentoB = documentos.find((documento) => documento.login === loginB);
  if (documentoA === undefined || documentoB === undefined) return { ok: false, erro: 'Uma das pessoas não está nesta escala.' };
  if (periodo.inicio === '' || periodo.fim === '') return { ok: false, erro: 'Informe o período.' };
  if (periodo.inicio > periodo.fim) return { ok: false, erro: 'A data inicial é depois da final.' };

  const datasDasDuas = [...new Set([...Object.keys(documentoA.dias), ...Object.keys(documentoB.dias)])].sort();
  const noPeriodo = datasDasDuas.filter((data) => data >= periodo.inicio && data <= periodo.fim);
  if (noPeriodo.length === 0) return { ok: false, erro: 'Nenhum dia da escala cai nesse período.' };

  const diasA = { ...documentoA.dias };
  const diasB = { ...documentoB.dias };
  const trocados: DiaTrocado[] = [];
  const semDados: string[] = [];
  let iguais = 0;
  for (const data of noPeriodo) {
    const a = documentoA.dias[data];
    const b = documentoB.dias[data];
    if (a === undefined || b === undefined) {
      semDados.push(data);
      continue;
    }
    if (mesmoDia(a, b)) {
      iguais += 1;
      continue;
    }
    // `seq` (contador de dias seguidos da importação) deixa de valer para os dias trocados; fica de fora para não mostrar número errado.
    diasA[data] = semSeq(b);
    diasB[data] = semSeq(a);
    trocados.push({ data, deA: a, deB: b });
  }
  if (trocados.length === 0) {
    return { ok: false, erro: 'As duas escalas são iguais nesse período: não há o que inverter.' };
  }

  const cobreTudo = datasDasDuas.every((data) => data >= periodo.inicio && data <= periodo.fim) && semDados.length === 0;
  const novoA: TurnosMes = {
    ...documentoA, dias: diasA, totais: calcularTotais(diasA, catalogo), ...(cobreTudo ? { turnoPadrao: documentoB.turnoPadrao } : {}),
  };
  const novoB: TurnosMes = {
    ...documentoB, dias: diasB, totais: calcularTotais(diasB, catalogo), ...(cobreTudo ? { turnoPadrao: documentoA.turnoPadrao } : {}),
  };
  return {
    ok: true,
    plano: { loginA, loginB, periodo, trocados, iguais, semDados, trocouTurnoPadrao: cobreTudo, documentoA: novoA, documentoB: novoB },
  };
}

/** A lista de documentos depois da inversão (as outras pessoas ficam exatamente como estavam). */
export function aplicarInversaoNosDocumentos(documentos: readonly TurnosMes[], plano: PlanoInversao): TurnosMes[] {
  return documentos.map((documento) => {
    if (documento.login === plano.loginA) return plano.documentoA;
    if (documento.login === plano.loginB) return plano.documentoB;
    return documento;
  });
}

/** O que a inversão CRIA e o que ela RESOLVE nas regras das DUAS pessoas (mesmo contrato da edição de uma célula). */
export function conferirRegrasDaInversao(
  documentos: readonly TurnosMes[],
  plano: PlanoInversao,
  catalogo: Record<string, TipoTurno>,
  regras: readonly RegraEscala[],
  nomePorLogin: Record<string, string> = {},
): { novos: AlertaRegra[]; resolvidos: AlertaRegra[] } {
  const originais = documentos.filter((documento) => documento.login === plano.loginA || documento.login === plano.loginB);
  const antes = avaliarRegras(originais, catalogo, regras, { nomePorLogin });
  const depois = avaliarRegras([plano.documentoA, plano.documentoB], catalogo, regras, { nomePorLogin });
  return diferencaDeProblemas(antes, depois);
}

export interface PeriodoSugerido {
  chave: string;
  rotulo: string;
  inicio: string;
  fim: string;
}

/** Atalhos de período para as duas escolhidas: o período todo e, quando cabem, Natal e Ano Novo. */
export function periodosSugeridos(documentos: readonly TurnosMes[], loginA: string, loginB: string): PeriodoSugerido[] {
  const docs = [loginA, loginB].map((login) => documentos.find((documento) => documento.login === login)).filter((d): d is TurnosMes => d !== undefined);
  const base = docs.length > 0 ? docs : documentos;
  if (base.length === 0) return [];
  const inicio = base.map((d) => d.periodoInicio).sort().at(-1)!;
  const fim = base.map((d) => d.periodoFim).sort()[0]!;
  const sugestoes: PeriodoSugerido[] = [{ chave: 'tudo', rotulo: 'Todo o período', inicio, fim }];
  const anos = new Set([Number(inicio.slice(0, 4)), Number(fim.slice(0, 4))]);
  for (const ano of [...anos].sort()) {
    const natal = { inicio: `${ano}-12-24`, fim: `${ano}-12-25` };
    const anoNovo = { inicio: `${ano}-12-31`, fim: `${ano + 1}-01-01` };
    if (natal.inicio >= inicio && natal.fim <= fim) sugestoes.push({ chave: `natal-${ano}`, rotulo: 'Natal (24 e 25/12)', ...natal });
    if (anoNovo.inicio >= inicio && anoNovo.fim <= fim) sugestoes.push({ chave: `anonovo-${ano}`, rotulo: 'Ano Novo (31/12 e 01/01)', ...anoNovo });
  }
  return sugestoes;
}

export function descreverPeriodo(periodo: PeriodoInversao): string {
  return periodo.inicio === periodo.fim ? ddmm(periodo.inicio) : `${ddmm(periodo.inicio)} a ${ddmm(periodo.fim)}`;
}
