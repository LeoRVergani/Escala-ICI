import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { formatarMinutos, parsePlanilhaEscala } from '../src/index.js';
import {
  carregarFixture,
  LOGINS_SOC,
  OPCOES_SOC,
} from './dados.js';

function resultadoOriginal() {
  return parsePlanilhaEscala(carregarFixture(), OPCOES_SOC);
}

function adulterarPrimeiraCelulaDeAleilima(): ArrayBuffer {
  const workbook = XLSX.read(carregarFixture(), { type: 'array' });
  const planilha = workbook.Sheets.Escalistas;
  if (planilha === undefined || planilha['!ref'] === undefined) {
    throw new Error('Fixture sem a aba Escalistas.');
  }

  const intervalo = XLSX.utils.decode_range(planilha['!ref']);
  let linhaLogin: number | undefined;
  let colunaLogin: number | undefined;
  let colunaDiaMes: number | undefined;
  let linhaDiaMes: number | undefined;

  for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const referencia = XLSX.utils.encode_cell({ r: linha, c: coluna });
      const valor = String(planilha[referencia]?.v ?? '').trim();
      if (valor === 'aleilima') {
        linhaLogin ??= linha;
        colunaLogin ??= coluna;
      }
      if (valor === 'DIA/MÊS') {
        linhaDiaMes ??= linha;
        colunaDiaMes ??= coluna;
      }
    }
  }

  if (
    linhaLogin === undefined
    || colunaLogin === undefined
    || linhaDiaMes === undefined
    || colunaDiaMes === undefined
    || colunaLogin !== colunaDiaMes
  ) {
    throw new Error('Estrutura da fixture inesperada.');
  }

  const primeiraColunaDia = colunaDiaMes + 1;
  const referenciaAlvo = XLSX.utils.encode_cell({
    r: linhaLogin,
    c: primeiraColunaDia,
  });
  planilha[referenciaAlvo] = { t: 's', v: 'ZZ' };

  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xls' });
  return bytes as ArrayBuffer;
}

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — mesma célula-alvo de
 * `adulterarPrimeiraCelulaDeAleilima()` (primeiro dia de aleilima), mas
 * escrevendo um NÚMERO fora de 1-6 em vez de texto — para exercitar o ramo
 * `!seqValida` de `parsePlanilhaEscala()`, classificado como ALERTA (nunca
 * BLOQUEANTE, ao contrário de um valor de texto não reconhecido).
 */
function adulterarSequenciaForaDeAlcance(): ArrayBuffer {
  const workbook = XLSX.read(carregarFixture(), { type: 'array' });
  const planilha = workbook.Sheets.Escalistas;
  if (planilha === undefined || planilha['!ref'] === undefined) {
    throw new Error('Fixture sem a aba Escalistas.');
  }

  const intervalo = XLSX.utils.decode_range(planilha['!ref']);
  let linhaLogin: number | undefined;
  let colunaLogin: number | undefined;
  let colunaDiaMes: number | undefined;
  let linhaDiaMes: number | undefined;

  for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const referencia = XLSX.utils.encode_cell({ r: linha, c: coluna });
      const valor = String(planilha[referencia]?.v ?? '').trim();
      if (valor === 'aleilima') {
        linhaLogin ??= linha;
        colunaLogin ??= coluna;
      }
      if (valor === 'DIA/MÊS') {
        linhaDiaMes ??= linha;
        colunaDiaMes ??= coluna;
      }
    }
  }

  if (
    linhaLogin === undefined
    || colunaLogin === undefined
    || linhaDiaMes === undefined
    || colunaDiaMes === undefined
    || colunaLogin !== colunaDiaMes
  ) {
    throw new Error('Estrutura da fixture inesperada.');
  }

  const segundaColunaDia = colunaDiaMes + 2;
  const referenciaAlvo = XLSX.utils.encode_cell({
    r: linhaLogin,
    c: segundaColunaDia,
  });
  planilha[referenciaAlvo] = { t: 'n', v: 9 };

  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xls' });
  return bytes as ArrayBuffer;
}

/**
 * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — mesma célula-alvo de
 * `adulterarSequenciaForaDeAlcance()`, mas escrevendo `0` em vez de `9`,
 * reproduzindo o caso real relatado (alamancio, Escalistas!E8, 27/08/2026).
 */
function adulterarSequenciaParaZero(): ArrayBuffer {
  const workbook = XLSX.read(carregarFixture(), { type: 'array' });
  const planilha = workbook.Sheets.Escalistas;
  if (planilha === undefined || planilha['!ref'] === undefined) {
    throw new Error('Fixture sem a aba Escalistas.');
  }

  const intervalo = XLSX.utils.decode_range(planilha['!ref']);
  let linhaLogin: number | undefined;
  let colunaLogin: number | undefined;
  let colunaDiaMes: number | undefined;
  let linhaDiaMes: number | undefined;

  for (let linha = intervalo.s.r; linha <= intervalo.e.r; linha += 1) {
    for (let coluna = intervalo.s.c; coluna <= intervalo.e.c; coluna += 1) {
      const referencia = XLSX.utils.encode_cell({ r: linha, c: coluna });
      const valor = String(planilha[referencia]?.v ?? '').trim();
      if (valor === 'aleilima') {
        linhaLogin ??= linha;
        colunaLogin ??= coluna;
      }
      if (valor === 'DIA/MÊS') {
        linhaDiaMes ??= linha;
        colunaDiaMes ??= coluna;
      }
    }
  }

  if (
    linhaLogin === undefined
    || colunaLogin === undefined
    || linhaDiaMes === undefined
    || colunaDiaMes === undefined
    || colunaLogin !== colunaDiaMes
  ) {
    throw new Error('Estrutura da fixture inesperada.');
  }

  const segundaColunaDia = colunaDiaMes + 2;
  const referenciaAlvo = XLSX.utils.encode_cell({
    r: linhaLogin,
    c: segundaColunaDia,
  });
  planilha[referenciaAlvo] = { t: 'n', v: 0 };

  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xls' });
  return bytes as ArrayBuffer;
}

describe('sequência 0 (HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1)', () => {
  it('A. gera ALERTA com login, data, linha, coluna e valorEncontrado', () => {
    const resultado = parsePlanilhaEscala(adulterarSequenciaParaZero(), OPCOES_SOC);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]).toMatchObject({
      login: 'aleilima',
      data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
      linha: expect.any(Number),
      coluna: expect.any(String),
      valorEncontrado: '0',
      motivo: 'Sequência de trabalho inválida; esperado número inteiro entre 1 e 6.',
      severidade: 'ALERTA',
    });
  });

  it('B. NÃO perde o dia trabalhado quando o turno é válido — dia fica sem seq', () => {
    const resultado = parsePlanilhaEscala(adulterarSequenciaParaZero(), OPCOES_SOC);
    const documento = resultado.documentos.find(({ login }) => login === 'aleilima');
    const erro = resultado.erros[0];
    const dia = documento?.dias[erro?.data ?? ''];

    expect(dia).toBeDefined();
    expect(dia?.seq).toBeUndefined();
    expect(dia).toMatchObject({ c: 'MD', i: '01:00', f: '07:00', m: 360 });
  });
});

describe('parsePlanilhaEscala com a planilha real', () => {
  it('1. extrai o nome canônico da equipe', () => {
    expect(resultadoOriginal().equipeNome).toBe('SOC - Escala 6');
  });

  it('2. resolve o período completo de 31 dias', () => {
    const resultado = resultadoOriginal();
    expect(resultado.periodoInicio).toBe('2026-07-26');
    expect(resultado.periodoFim).toBe('2026-08-25');
    expect(resultado.totalDias).toBe(31);
  });

  it('3. cria nove documentos sem erros', () => {
    const resultado = resultadoOriginal();
    expect(resultado.documentos).toHaveLength(9);
    expect(resultado.ok).toBe(true);
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toEqual([]);
  });

  it('4. aplica fill-down aos quatro blocos de turno', () => {
    const resultado = resultadoOriginal();
    const loginsDoTurno = (turno: string): string[] =>
      resultado.documentos
        .filter((documento) => documento.turnoPadrao === turno)
        .map(({ login }) => login);

    expect(loginsDoTurno('MD')).toEqual([
      'aleilima',
      'ivcarvalho',
    ]);
    expect(loginsDoTurno('M')).toEqual([
      'alamancio',
      'altaborda',
      'lvergani',
    ]);
    expect(loginsDoTurno('T')).toEqual([
      'cestradioto',
      'thaisvribeiro',
    ]);
    expect(loginsDoTurno('N')).toEqual([
      'dschlottag',
      'luizneto',
    ]);
  });

  it('5. interpreta descanso e sequência de trabalho de aleilima', () => {
    const documento = resultadoOriginal().documentos.find(
      ({ login }) => login === 'aleilima',
    );

    expect(documento?.dias['2026-07-26']?.c).toBe('DF');
    expect(documento?.dias['2026-07-27']).toEqual({
      c: 'MD',
      i: '01:00',
      f: '07:00',
      m: 360,
      vd: false,
      seq: 1,
    });
  });

  it('6. interpreta DU de ivcarvalho em 30 de julho', () => {
    const documento = resultadoOriginal().documentos.find(
      ({ login }) => login === 'ivcarvalho',
    );
    expect(documento?.dias['2026-07-30']?.c).toBe('DU');
  });

  it('7. interpreta DU de aleilima em 20 de agosto', () => {
    const documento = resultadoOriginal().documentos.find(
      ({ login }) => login === 'aleilima',
    );
    expect(documento?.dias['2026-08-20']?.c).toBe('DU');
  });

  it('8. contabiliza as férias de alamancio', () => {
    const documento = resultadoOriginal().documentos.find(
      ({ login }) => login === 'alamancio',
    );
    const outrosDias = Object.entries(documento?.dias ?? {})
      .filter(([data]) => data !== '2026-07-26')
      .map(([, dia]) => dia.c);

    expect(documento?.dias['2026-07-26']?.c).toBe('DF');
    expect(outrosDias).toHaveLength(30);
    expect(outrosDias.every((codigo) => codigo === 'X')).toBe(true);
    expect(documento?.totais).toMatchObject({ x: 30, df: 1, min: 0 });
  });

  it('9. calcula os totais de aleilima', () => {
    const totais = resultadoOriginal().documentos.find(
      ({ login }) => login === 'aleilima',
    )?.totais;

    expect(totais).toMatchObject({
      diasTrabalhados: 25,
      min: 9000,
      df: 5,
      du: 1,
    });
    expect(formatarMinutos(totais?.min ?? 0)).toBe('150:00');
    expect(
      (totais?.diasTrabalhados ?? 0) + (totais?.df ?? 0) + (totais?.du ?? 0),
    ).toBe(31);
  });

  it('10. calcula os totais de ivcarvalho', () => {
    const totais = resultadoOriginal().documentos.find(
      ({ login }) => login === 'ivcarvalho',
    )?.totais;

    expect(totais).toMatchObject({
      diasTrabalhados: 26,
      min: 9360,
      df: 4,
      du: 1,
    });
    expect(formatarMinutos(totais?.min ?? 0)).toBe('156:00');
    expect(
      (totais?.diasTrabalhados ?? 0) + (totais?.df ?? 0) + (totais?.du ?? 0),
    ).toBe(31);
  });

  it('11. mantém 31 datas ISO em todos os documentos', () => {
    const documentos = resultadoOriginal().documentos;
    expect(
      documentos.every((documento) => Object.keys(documento.dias).length === 31),
    ).toBe(true);
    expect(
      documentos.every((documento) =>
        Object.keys(documento.dias).every((data) => /^\d{4}-\d{2}-\d{2}$/u.test(data))),
    ).toBe(true);
  });

  it('12. marca vira-dia apenas nos trabalhos do turno noturno', () => {
    const documentos = resultadoOriginal().documentos;
    for (const documento of documentos) {
      const diasTrabalhados = Object.values(documento.dias)
        .filter((dia) => dia.m !== undefined);
      const viraDiaEsperado = documento.turnoPadrao === 'N';
      expect(diasTrabalhados.every((dia) => dia.vd === viraDiaEsperado)).toBe(true);
    }
  });

  it('13. ignora o resumo de folgas e a legenda', () => {
    const logins = resultadoOriginal().documentos.map(({ login }) => login);
    expect(logins).not.toEqual(expect.arrayContaining([
      'Domingo',
      'Sábado',
      'Semana',
      'Legenda',
    ]));
  });

  it('14. não importa linhas da aba derivada Escala', () => {
    const logins = resultadoOriginal().documentos.map(({ login }) => login);
    expect(logins).toEqual(Object.keys(LOGINS_SOC));
    expect(logins.every((login) => !login.includes('/'))).toBe(true);
  });

  it('15. reporta uma célula adulterada sem interromper o preview', () => {
    const resultado = parsePlanilhaEscala(
      adulterarPrimeiraCelulaDeAleilima(),
      OPCOES_SOC,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.documentos).toHaveLength(9);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]).toMatchObject({
      linha: 6,
      coluna: 'D',
      login: 'aleilima',
      valorEncontrado: 'ZZ',
    });
  });

  it('16. reporta login ausente do mapa sem inventar uid', () => {
    const { ivcarvalho: loginRemovido, ...demaisLogins } = LOGINS_SOC;
    expect(loginRemovido).toBe('u2');

    const resultado = parsePlanilhaEscala(carregarFixture(), {
      ...OPCOES_SOC,
      loginParaUid: demaisLogins,
    });
    const documento = resultado.documentos.find(
      ({ login }) => login === 'ivcarvalho',
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toEqual([
      expect.objectContaining({
        login: 'ivcarvalho',
        valorEncontrado: 'ivcarvalho',
      }),
    ]);
    expect(documento?.usuarioUid).toBe('');
  });
});

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — classificação de
 * severidade (`ErroImportacao.severidade`): só a sequência de trabalho
 * fora de 1-6 é ALERTA (pode ser uma exceção operacional legítima); todo
 * o resto continua BLOQUEANTE (erro estrutural, sem interpretação
 * possível). Ver tabela de classificação no relatório da fase.
 */
describe('severidade de erros (BLOQUEANTE vs ALERTA)', () => {
  it('sequência de trabalho fora de 1-6 é ALERTA — pode ser uma exceção operacional legítima', () => {
    const resultado = parsePlanilhaEscala(adulterarSequenciaForaDeAlcance(), OPCOES_SOC);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]).toMatchObject({
      login: 'aleilima',
      valorEncontrado: '9',
      motivo: 'Sequência de trabalho inválida; esperado número inteiro entre 1 e 6.',
      severidade: 'ALERTA',
    });
  });

  it('valor de texto não reconhecido pelo catálogo continua BLOQUEANTE — problema de dado, não exceção', () => {
    const resultado = parsePlanilhaEscala(adulterarPrimeiraCelulaDeAleilima(), OPCOES_SOC);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]).toMatchObject({ severidade: 'BLOQUEANTE' });
  });

  it('login não encontrado em opts.loginParaUid continua BLOQUEANTE', () => {
    const { ivcarvalho: loginRemovido, ...demaisLogins } = LOGINS_SOC;
    expect(loginRemovido).toBe('u2');
    const resultado = parsePlanilhaEscala(carregarFixture(), { ...OPCOES_SOC, loginParaUid: demaisLogins });
    expect(resultado.erros).toEqual([expect.objectContaining({ severidade: 'BLOQUEANTE' })]);
  });

  it('todo erro real da planilha original tem uma severidade válida (BLOQUEANTE ou ALERTA), nunca ausente', () => {
    for (const erro of resultadoOriginal().erros) {
      expect(['BLOQUEANTE', 'ALERTA']).toContain(erro.severidade);
    }
  });
});

/**
 * Reproduz em memória o cenário real de agosto/2026 relatado no bug: a aba
 * Escalistas mantém o turno-base (fill-down por bloco) da pessoa, mas cursos
 * e trocas pontuais mudam o turno real do dia, visível só na aba Escala.
 *
 *   - aleilima (base Madrugada) trabalha Manhã em 18/08.
 *   - ivcarvalho e altaborda (base Madrugada/Manhã) trabalham Tarde em 12/08.
 *   - cestradioto e luizneto (base Tarde/Noite) trabalham Manhã em 18/08.
 *   - lvergani e dschlottag (base Manhã/Noite) trabalham Tarde em 21/08.
 *
 * thaisvribeiro fica de fora da aba Escala nesses três dias e só tem
 * códigos não numéricos (DF/X/DU) — serve para confirmar que esses
 * continuam vindo só da aba Escalistas + catálogo (requisito 6).
 */
function construirPlanilhaComTrocaDeTurno(opts?: {
  duplicarAleilimaEm18: boolean;
  omitirAbaEscala: boolean;
}): ArrayBuffer {
  const escalistas = XLSX.utils.aoa_to_sheet([
    ['Equipe Teste X1'],
    [],
    [null, 'Turno', 'DIA/MÊS', '12/08', '18/08', '21/08'],
    [],
    [null, null, 'COLABORADOR'],
    [null, 'Madrugada', 'aleilima', 1, 2, null],
    [null, null, 'ivcarvalho', 2, null, null],
    [null, 'Manhã', 'altaborda', 3, null, null],
    [null, null, 'lvergani', null, null, 4],
    [null, 'Tarde', 'cestradioto', null, 5, null],
    [null, null, 'thaisvribeiro', 'DF', 'X', 'DU'],
    [null, 'Noite', 'luizneto', null, 6, null],
    [null, null, 'dschlottag', null, null, 1],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, escalistas, 'Escalistas');

  if (opts?.omitirAbaEscala !== true) {
    const linha18 = opts?.duplicarAleilimaEm18 === true
      ? ['18/08/2026 Terça-feira', null, null, 'cestradioto/luizneto/aleilima', 'aleilima', null]
      : ['18/08/2026 Terça-feira', null, null, 'cestradioto/luizneto/aleilima', null, null];

    const escala = XLSX.utils.aoa_to_sheet([
      ['Dia', null, 'Turno - Presencial'],
      [null, null, 'Madrugada', 'Manhã', 'Tarde', 'Noite'],
      ['12/08/2026 Quarta-feira', null, null, null, 'ivcarvalho/altaborda', null],
      linha18,
      ['21/08/2026 Sexta-feira', null, null, null, 'lvergani/dschlottag', null],
    ]);
    XLSX.utils.book_append_sheet(workbook, escala, 'Escala');
  }

  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

describe('parsePlanilhaEscala com trocas pontuais de turno (aba Escala complementa a Escalistas)', () => {
  function resultadoComTroca() {
    return parsePlanilhaEscala(construirPlanilhaComTrocaDeTurno(), OPCOES_SOC);
  }

  function diaDe(login: string, data: string) {
    return resultadoComTroca().documentos.find((d) => d.login === login)?.dias[data];
  }

  it('1. lvergani em 21/08/2026 é Tarde, não Manhã (turno-base)', () => {
    expect(diaDe('lvergani', '2026-08-21')).toMatchObject({ c: 'T', seq: 4 });
  });

  it('2. cestradioto em 18/08/2026 é Manhã, não Tarde (turno-base)', () => {
    expect(diaDe('cestradioto', '2026-08-18')).toMatchObject({ c: 'M', seq: 5 });
  });

  it('3. luizneto em 18/08/2026 é Manhã, não Noite (turno-base)', () => {
    expect(diaDe('luizneto', '2026-08-18')).toMatchObject({ c: 'M', seq: 6 });
  });

  it('4. ivcarvalho em 12/08/2026 é Tarde, não Madrugada (turno-base)', () => {
    expect(diaDe('ivcarvalho', '2026-08-12')).toMatchObject({ c: 'T', seq: 2 });
  });

  it('5. altaborda em 12/08/2026 é Tarde, não Manhã (turno-base)', () => {
    expect(diaDe('altaborda', '2026-08-12')).toMatchObject({ c: 'T', seq: 3 });
  });

  it('bônus: aleilima em 18/08/2026 é Manhã, não Madrugada (exemplo real do bug)', () => {
    expect(diaDe('aleilima', '2026-08-18')).toMatchObject({ c: 'M', seq: 2 });
  });

  it('bônus: dschlottag em 21/08/2026 é Tarde, não Noite (turno-base)', () => {
    expect(diaDe('dschlottag', '2026-08-21')).toMatchObject({ c: 'T', seq: 1 });
  });

  it('6. DF/DU/X de thaisvribeiro continuam vindo só da Escalistas + catálogo', () => {
    expect(diaDe('thaisvribeiro', '2026-08-12')).toEqual({ c: 'DF' });
    expect(diaDe('thaisvribeiro', '2026-08-18')).toEqual({ c: 'X' });
    expect(diaDe('thaisvribeiro', '2026-08-21')).toEqual({ c: 'DU' });
  });

  it('faz fallback com aviso para o turno-base quando o login não está na aba Escala naquele dia', () => {
    const resultado = resultadoComTroca();
    expect(diaDe('aleilima', '2026-08-12')).toMatchObject({ c: 'MD', seq: 1 });
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toEqual([
      expect.stringContaining('aleilima em 2026-08-12'),
    ]);
  });

  it('7. sem a aba Escala, cai no comportamento antigo (turno-base) sem erro nem aviso', () => {
    const resultado = parsePlanilhaEscala(
      construirPlanilhaComTrocaDeTurno({ omitirAbaEscala: true, duplicarAleilimaEm18: false }),
      { ...OPCOES_SOC, anoInicio: 2026 },
    );
    const documento = resultado.documentos.find(({ login }) => login === 'aleilima');

    expect(resultado.ok).toBe(true);
    expect(resultado.avisos).toEqual([]);
    expect(documento?.dias['2026-08-12']).toMatchObject({ c: 'MD', seq: 1 });
    expect(documento?.dias['2026-08-18']).toMatchObject({ c: 'MD', seq: 2 });
  });

  it('gera erro de duplicidade quando o mesmo login aparece em dois turnos no mesmo dia na aba Escala', () => {
    const resultado = parsePlanilhaEscala(
      construirPlanilhaComTrocaDeTurno({ duplicarAleilimaEm18: true, omitirAbaEscala: false }),
      OPCOES_SOC,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          login: 'aleilima',
          motivo: expect.stringContaining('Duplicidade de turno no dia'),
        }),
      ]),
    );
  });
});
