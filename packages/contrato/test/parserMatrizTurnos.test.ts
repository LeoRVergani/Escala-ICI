import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { CATALOGO_SOC, codigoDeFolga, detectarTipoPlanilha, localizarMatrizTurnos, parsePlanilhaMatrizTurnos } from '../src/index.js';

/**
 * MATRIZ-TURNOS-1 — escala em matriz "turno × data" (fim de ano). A planilha é montada em código (nomes fictícios): as LINHAS são
 * os turnos, as COLUNAS as datas e cada célula tem o nome de quem cobre o turno; quem não aparece no dia está de folga.
 */
const PESSOAS = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara'];
const TURNOS: Array<[string, string]> = [['Madrugada', 'MD'], ['Manhã', 'M'], ['Tarde', 'T'], ['Noite', 'N']];
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Quem cobre o turno `k` (0=MD…3=N) no dia `i`: 4 pessoas distintas por dia, girando pelas 9. */
const quemCobre = (i: number, k: number) => PESSOAS[(i + k * 2) % PESSOAS.length]!;

interface Opcoes {
  titulo?: string | null;
  inicio?: string;
  dias?: number;
  feriados?: string[];
  ajustar?: (celulas: string[][], cabecalhoData: string[]) => void;
  semTabelaLateral?: boolean;
}

function dataMais(inicio: string, dias: number): string {
  return new Date(Date.parse(`${inicio}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

function montarMatriz(opcoes: Opcoes = {}): ArrayBuffer {
  const { titulo = 'Escala de Final de Ano 2026', inicio = '2026-12-19', dias = 16, feriados = ['2026-12-25', '2027-01-01'] } = opcoes;
  const datas = Array.from({ length: dias }, (_, i) => dataMais(inicio, i));
  const semana = datas.map((d) => SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]!);
  const cabecalhoData = datas.map((d) => `${d.slice(8)}/${d.slice(5, 7)}${feriados.includes(d) ? '\nFeriado' : ''}`);
  const corpo = TURNOS.map(([rotulo], k) => [rotulo, ...datas.map((_, i) => quemCobre(i, k))]);
  const celulas = [...corpo.map((linha) => [...linha])];
  opcoes.ajustar?.(celulas, cabecalhoData);
  const aoa: unknown[][] = [
    titulo === null ? [] : [titulo], [],
    ['Turno', ...semana], ['', ...cabecalhoData], ...celulas,
  ];
  if (opcoes.semTabelaLateral !== true) {
    // tabela lateral (totais e fórmulas) depois da última coluna de data: nunca deve ser lida
    const coluna = dias + 2;
    aoa[2]![coluna] = 'Colaborador'; aoa[2]![coluna + 1] = 'Dias trabalhados';
    PESSOAS.forEach((nome, n) => { const linha = 4 + n; aoa[linha] ??= []; aoa[linha]![coluna] = nome; aoa[linha]![coluna + 1] = { t: 'n', v: 7, f: 'COUNTIF($B$5:$Q$8,S5)' }; });
  }
  const planilha = XLSX.utils.aoa_to_sheet(aoa as never);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Planilha1');
  return XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const logins = Object.fromEntries(PESSOAS.map((nome) => [nome, nome.toLowerCase()]));
const opcoesPadrao = { equipeId: 'EQ_SOC', competencia: '2027-01', catalogo: CATALOGO_SOC, loginParaUid: logins };

describe('MATRIZ-TURNOS-1 — detecção pela ESTRUTURA', () => {
  it('reconhece a matriz (turno × data) e a diferencia de 6x1 e de Plantão', () => {
    expect(detectarTipoPlanilha(montarMatriz())).toEqual({ tipo: 'ESCALA_MATRIZ_TURNOS', abaEncontrada: 'Planilha1' });
  });

  it('não depende do título, do nome da aba nem da tabela ao lado', () => {
    expect(detectarTipoPlanilha(montarMatriz({ titulo: null, semTabelaLateral: true })).tipo).toBe('ESCALA_MATRIZ_TURNOS');
  });

  it('uma planilha qualquer continua DESCONHECIDA, e a mensagem cita o formato novo', () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'X');
    const resultado = detectarTipoPlanilha(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    expect(resultado.tipo).toBe('DESCONHECIDA');
    expect(resultado.motivo).toContain('matriz "Turno × Data"');
  });

  it('exige 2+ turnos de trabalho nas linhas e 3+ datas com dia da semana — senão não é a matriz', () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['Turno', 'Seg', 'Ter'], ['', '01/12', '02/12'], ['Manhã', 'Ana', 'Bia']]), 'X');
    expect(localizarMatrizTurnos(livro)).toBeUndefined();
  });
});

describe('MATRIZ-TURNOS-1 — leitura das datas', () => {
  it('lê as 16 datas do título 2026 e VIRA o ano em 01/01 (2027), ignorando a tabela lateral', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz(), opcoesPadrao);
    expect(r.ok).toBe(true);
    expect([r.periodoInicio, r.periodoFim, r.totalDias]).toEqual(['2026-12-19', '2027-01-03', 16]);
    expect(r.matriz?.datas).toHaveLength(16);
    expect(r.matriz?.datas[13]).toBe('2027-01-01');
    expect(r.matriz?.nomesFonte).toEqual(['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara']);
  });

  it('sem ano no título, descobre o ano pelo dia da semana do cabeçalho (19/12 cair em sábado)', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz({ titulo: null }), { ...opcoesPadrao, anoInicio: undefined });
    expect(r.periodoInicio).toBe('2026-12-19');
  });

  it('o ano do título que não bate com o dia da semana é corrigido para o ano vizinho que bate', () => {
    // título diz 2027, mas 19/12 é sábado em 2026: vale o ano vizinho
    expect(parsePlanilhaMatrizTurnos(montarMatriz({ titulo: 'Escala 2027' }), opcoesPadrao).periodoInicio).toBe('2026-12-19');
  });

  it('feriados vêm do cabeçalho ("Feriado" na célula da data)', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz(), opcoesPadrao);
    expect(r.matriz?.feriados).toEqual(['2026-12-25', '2027-01-01']);
    expect(r.avisos.join(' ')).toContain('Feriados lidos do cabeçalho: 25/12, 01/01.');
  });

  it('dia da semana do cabeçalho que não bate com a data vira ALERTA (não bloqueia)', () => {
    const livro = montarMatriz();
    const planilha = XLSX.read(livro, { type: 'array' });
    planilha.Sheets.Planilha1!.C3 = { t: 's', v: 'Qua' }; // 20/12 é domingo
    const r = parsePlanilhaMatrizTurnos(XLSX.write(planilha, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, opcoesPadrao);
    const alerta = r.erros.find((erro) => erro.data === '2026-12-20');
    expect(alerta).toMatchObject({ severidade: 'ALERTA' });
    expect(alerta?.motivo).toContain('cai em domingo');
    expect(r.documentos).toHaveLength(9);
  });
});

describe('MATRIZ-TURNOS-1 — os documentos por pessoa', () => {
  const r = parsePlanilhaMatrizTurnos(montarMatriz(), opcoesPadrao);
  const doc = (nome: string) => r.documentos.find((d) => d.login === nome)!;

  it('um documento por pessoa, em ordem alfabética, só com os dias do trecho (rascunho)', () => {
    expect(r.documentos.map((d) => d.login)).toEqual(['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara']);
    expect(doc('Ana')).toMatchObject({ schemaVersion: 1, equipeId: 'EQ_SOC', competencia: '2027-01', periodoInicio: '2026-12-19', periodoFim: '2027-01-03', status: 'RASCUNHO', usuarioUid: 'ana' });
    expect(Object.keys(doc('Ana').dias)).toHaveLength(16);
  });

  it('o turno de trabalho sai com horário e duração do catálogo; a folga é só o código', () => {
    const dias = doc('Ana').dias; // Ana cobre a Madrugada no dia 0 (19/12)
    expect(dias['2026-12-19']).toEqual({ c: 'MD', i: '01:00', f: '07:00', m: 360, vd: false });
    expect(dias['2026-12-20']).toEqual({ c: 'DF' }); // domingo, sem turno
  });

  it('a regra de folga: feriado → FOLGA, sábado/domingo → DF, dia útil → DU (24/12 e 31/12 são dias comuns)', () => {
    expect(codigoDeFolga('2026-12-25', true)).toBe('FOLGA');
    expect(codigoDeFolga('2026-12-26', false)).toBe('DF'); // sábado
    expect(codigoDeFolga('2026-12-27', false)).toBe('DF'); // domingo
    expect(codigoDeFolga('2026-12-24', false)).toBe('DU'); // quinta, véspera de Natal, não é feriado
    expect(codigoDeFolga('2026-12-31', false)).toBe('DU');
    const tudo = r.documentos.flatMap((d) => Object.entries(d.dias));
    expect(tudo.filter(([, dia]) => dia.c === 'FOLGA').every(([data]) => ['2026-12-25', '2027-01-01'].includes(data))).toBe(true);
  });

  it('cada pessoa tem exatamente o que a matriz diz, dia a dia (conferido contra a própria matriz de origem)', () => {
    for (const nome of PESSOAS) {
      for (let i = 0; i < 16; i += 1) {
        const data = dataMais('2026-12-19', i);
        const k = [0, 1, 2, 3].find((turno) => quemCobre(i, turno) === nome);
        const esperado = k === undefined ? ['FOLGA', 'DF', 'DU'] : [TURNOS[k]![1]];
        expect(esperado, `${nome} em ${data}`).toContain(doc(nome).dias[data]!.c);
      }
    }
  });

  it('os totais fecham: dias trabalhados + folgas = 16 e o turno padrão é o mais frequente', () => {
    for (const d of r.documentos) {
      const t = d.totais;
      expect(t.diasTrabalhados + t.df + t.du + t.folga).toBe(16);
      expect(d.turnoPadrao).toMatch(/^(MD|M|T|N)$/u);
    }
  });
});

describe('MATRIZ-TURNOS-1 — erros e vínculos', () => {
  it('nome sem usuário vinculado → erro BLOQUEANTE (que NÃO oferece "cadastrar login")', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz(), { ...opcoesPadrao, loginParaUid: { Ana: 'ana' } });
    const semVinculo = r.erros.filter((e) => e.motivo === 'Nome da planilha sem usuário vinculado.');
    expect(semVinculo).toHaveLength(8);
    expect(semVinculo.every((e) => e.severidade === 'BLOQUEANTE' && !e.motivo.includes('loginParaUid'))).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('a conciliação (nome → login) troca o login do documento; o uid vem do login vinculado', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz(), {
      ...opcoesPadrao, loginParaUid: { 'ana.silva': 'uid-ana' }, loginPorNomeFonte: { Ana: 'ana.silva' },
    });
    const ana = r.documentos.find((d) => d.login === 'ana.silva');
    expect(ana).toMatchObject({ login: 'ana.silva', usuarioUid: 'uid-ana' });
    expect(r.documentos.find((d) => d.login === 'Ana')).toBeUndefined();
  });

  it('a mesma pessoa em dois turnos no mesmo dia é BLOQUEANTE e só o primeiro turno é mantido', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz({ ajustar: (celulas) => { celulas[1]![1] = celulas[0]![1]!; } }), opcoesPadrao); // Manhã de 19/12 = quem faz a Madrugada
    const erro = r.erros.find((e) => e.motivo.includes('dois turnos no mesmo dia'));
    expect(erro).toMatchObject({ severidade: 'BLOQUEANTE', data: '2026-12-19' });
    expect(r.documentos.find((d) => d.login === 'Ana')!.dias['2026-12-19']!.c).toBe('MD');
  });

  it('turno sem ninguém é ALERTA com a data', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz({ ajustar: (celulas) => { celulas[3]![5] = ''; } }), opcoesPadrao);
    expect(r.erros.find((e) => e.severidade === 'ALERTA' && e.motivo.includes('Noite'))).toMatchObject({ data: '2026-12-23' });
    expect(r.ok).toBe(false); // ok = sem nenhum erro/alerta (igual ao 6x1)
  });

  it('o trecho precisa caber na competência escolhida: em 2026-12 (17/11–15/12) é recusado com o período certo na mensagem', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz(), { ...opcoesPadrao, competencia: '2026-12' });
    expect(r.erros.find((e) => e.severidade === 'BLOQUEANTE')?.motivo).toBe('O trecho 19/12/2026 a 03/01/2027 não cabe na competência 2026-12 (17/11/2026 a 15/12/2026).');
  });

  it('um trecho que atravessa o fechamento (10/12 a 20/12) não cabe em nenhuma competência única', () => {
    const r = parsePlanilhaMatrizTurnos(montarMatriz({ inicio: '2026-12-10', dias: 11, feriados: [] }), opcoesPadrao);
    expect(r.erros.some((e) => e.motivo.includes('não cabe na competência'))).toBe(true);
  });

  it('data inexistente ou ano indeterminado não quebra: vira erro BLOQUEANTE legível', () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([
      ['Turno', 'Seg', 'Ter', 'Qua'], ['', '31/02', '01/03', '02/03'], ['Manhã', 'A', 'B', 'C'], ['Tarde', 'D', 'E', 'F'],
    ]), 'X');
    const r = parsePlanilhaMatrizTurnos(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, opcoesPadrao);
    expect(r.ok).toBe(false);
    expect(r.erros[0]!.severidade).toBe('BLOQUEANTE');
  });
});
