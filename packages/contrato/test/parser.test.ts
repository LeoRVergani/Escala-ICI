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
