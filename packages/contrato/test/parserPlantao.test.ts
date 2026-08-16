import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  calcularDuracaoBrutaDosIntervalos,
  conferirContabilidadePlantao,
  detectarSobreposicoesPlantao,
  identificarLacunasPlantao,
  listarPlantonistasUnicos,
  parsePlanilhaEscala,
  parsePlanilhaPlantao,
  somarContabilidadeInformada,
} from '../src/index.js';
import { carregarFixture, OPCOES_SOC } from './dados.js';
import { carregarFixturePlantao } from './dadosPlantao.js';

function construirArrayBuffer(nomeAba: string, aoa: unknown[][]): ArrayBuffer {
  const planilha = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

function construirWorkbookAtribuicoes(linhas: Array<[string, string, string]>): ArrayBuffer {
  return construirArrayBuffer('Aba1', [
    ['Plantonista Segurança', 'Data Inicio', 'Data Fim'],
    ...linhas,
  ]);
}

function renomearAba(arquivo: ArrayBuffer, nomeAntigo: string, nomeNovo: string): ArrayBuffer {
  const workbook = XLSX.read(arquivo, { type: 'array' });
  const indice = workbook.SheetNames.indexOf(nomeAntigo);
  if (indice === -1) {
    throw new Error(`Aba "${nomeAntigo}" não encontrada.`);
  }
  workbook.SheetNames[indice] = nomeNovo;
  workbook.Sheets[nomeNovo] = workbook.Sheets[nomeAntigo];
  delete workbook.Sheets[nomeAntigo];
  return XLSX.write(workbook, { type: 'array', bookType: 'xls' }) as ArrayBuffer;
}

function resultadoFixture() {
  return parsePlanilhaPlantao(carregarFixturePlantao());
}

describe('parsePlanilhaPlantao com a fixture sanitizada', () => {
  it('1. lê as 32 atribuições', () => {
    expect(resultadoFixture().atribuicoes).toHaveLength(32);
  });

  it('2. preserva o nome original do plantonista, sem inventar identidade', () => {
    const nomes = new Set(
      resultadoFixture().atribuicoes.map((a) => a.plantonistaNomeOriginal),
    );
    expect(nomes).toEqual(new Set(['Ana Costa', 'Bruno Lima', 'Carlos Nunes']));
  });

  it('3. não cria login — a atribuição bruta não tem nenhum campo de identidade além do nome original', () => {
    const [atribuicao] = resultadoFixture().atribuicoes;
    expect(atribuicao).toBeDefined();
    expect(Object.keys(atribuicao ?? {}).sort()).toEqual(
      ['abaOrigem', 'duracaoMinutos', 'fim', 'inicio', 'linhaOrigem', 'plantonistaNomeOriginal'].sort(),
    );
  });

  it('4. parseia corretamente um plantão de 12h (após expediente)', () => {
    const doze = resultadoFixture().atribuicoes.find((a) => a.duracaoMinutos === 12 * 60);
    expect(doze).toBeDefined();
  });

  it('5. parseia corretamente um plantão de 24h (fim de semana)', () => {
    const vinteQuatro = resultadoFixture().atribuicoes.find((a) => a.duracaoMinutos === 24 * 60);
    expect(vinteQuatro).toBeDefined();
  });

  it('6. parseia a primeira borda real: 43h (sábado 00:00 até domingo 19:00)', () => {
    const [primeira] = resultadoFixture().atribuicoes;
    expect(primeira?.duracaoMinutos).toBe(43 * 60);
    expect(primeira?.inicio).toEqual({ data: '2026-07-25', hora: '00:00' });
    expect(primeira?.fim).toEqual({ data: '2026-07-26', hora: '19:00' });
  });

  it('7. parseia a última borda real: 5h (terça 19:00 até quarta 00:00)', () => {
    const atribuicoes = resultadoFixture().atribuicoes;
    const ultima = atribuicoes.at(-1);
    expect(ultima?.duracaoMinutos).toBe(5 * 60);
    expect(ultima?.inicio).toEqual({ data: '2026-08-25', hora: '19:00' });
    expect(ultima?.fim).toEqual({ data: '2026-08-26', hora: '00:00' });
  });

  it('8. calcula a duração literal a partir do intervalo, sem arredondar para uma regra de negócio', () => {
    // 43h não vira 24h, 5h não vira 12h — o parser lê o arquivo, não corrige política operacional.
    const atribuicoes = resultadoFixture().atribuicoes;
    const duracoesUnicas = new Set(atribuicoes.map((a) => a.duracaoMinutos));
    expect(duracoesUnicas).toEqual(new Set([43 * 60, 12 * 60, 24 * 60, 5 * 60]));
  });

  it('9. início inválido gera erro de linha, sem interromper o parse inteiro', () => {
    const arquivo = construirWorkbookAtribuicoes([
      ['Ana Costa', 'não é uma data', 'Domingo, 26/07/2026 - 19:00'],
      ['Bruno Lima', 'Domingo, 26/07/2026 - 19:00', 'Segunda-feira, 27/07/2026 - 07:00'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]?.motivo).toMatch(/início/iu);
    expect(resultado.atribuicoes).toHaveLength(1);
  });

  it('10. fim inválido gera erro de linha', () => {
    const arquivo = construirWorkbookAtribuicoes([
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'não é uma data'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros[0]?.motivo).toMatch(/fim/iu);
  });

  it('11. fim anterior ao início gera erro explícito', () => {
    const arquivo = construirWorkbookAtribuicoes([
      ['Ana Costa', 'Domingo, 26/07/2026 - 19:00', 'Sábado, 25/07/2026 - 00:00'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros[0]?.motivo).toMatch(/posterior/iu);
  });

  it('12. nome vazio gera erro de linha e não encerra a leitura das linhas seguintes', () => {
    const arquivo = construirWorkbookAtribuicoes([
      ['', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
      ['Bruno Lima', 'Domingo, 26/07/2026 - 19:00', 'Segunda-feira, 27/07/2026 - 07:00'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros[0]?.motivo).toMatch(/nome do plantonista vazio/iu);
    expect(resultado.atribuicoes).toHaveLength(1);
    expect(resultado.atribuicoes[0]?.plantonistaNomeOriginal).toBe('Bruno Lima');
  });

  it('13. intervalo duplicado (mesmo plantonista, mesmo início e fim) é detectado como sobreposição, nunca corrigido', () => {
    const arquivo = construirWorkbookAtribuicoes([
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.atribuicoes).toHaveLength(2);
    expect(resultado.sobreposicoes).toHaveLength(1);
    expect(resultado.sobreposicoes[0]?.tipo).toBe('MESMO_PLANTONISTA');
  });

  it('14. sobreposição entre plantonistas diferentes é detectada, nunca escolhido um vencedor', () => {
    const arquivo = construirWorkbookAtribuicoes([
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
      ['Bruno Lima', 'Sábado, 25/07/2026 - 12:00', 'Domingo, 26/07/2026 - 10:00'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.atribuicoes).toHaveLength(2);
    expect(resultado.sobreposicoes).toHaveLength(1);
    expect(resultado.sobreposicoes[0]?.tipo).toBe('PLANTONISTAS_DIFERENTES');
  });

  it('15. participante com 0 plantões na contabilidade informada é preservado, não eliminado', () => {
    const daniela = resultadoFixture().contabilidadeInformada.find(
      (c) => c.plantonistaNomeOriginal === 'Daniela Rocha',
    );
    expect(daniela).toEqual({
      plantonistaNomeOriginal: 'Daniela Rocha',
      quantidadeInformada: 0,
      minutosInformados: 0,
      valorHorasBruto: '0',
    });
  });

  it('16. extrai o total de 31 plantões informados', () => {
    expect(resultadoFixture().totaisInformados?.totalPlantoesInformado).toBe(31);
  });

  it('17. extrai o total de 468h informadas (em minutos)', () => {
    expect(resultadoFixture().totaisInformados?.totalMinutosInformado).toBe(468 * 60);
  });

  it('18. a soma bruta calculada dos 32 intervalos é 504h', () => {
    expect(resultadoFixture().totalBrutoCalculado).toEqual({ quantidade: 32, minutos: 504 * 60 });
  });

  it('19. a divergência entre 504h brutas e 468h informadas é preservada, nunca reconciliada', () => {
    const resultado = resultadoFixture();
    expect(resultado.totalBrutoCalculado.minutos).toBe(504 * 60);
    expect(resultado.totaisInformados?.totalMinutosInformado).toBe(468 * 60);
    expect(resultado.totalBrutoCalculado.minutos).not.toBe(resultado.totaisInformados?.totalMinutosInformado);
    expect(resultado.avisos.some((a) => a.includes('Divergência'))).toBe(true);
  });

  it('20. não altera a contabilidade informada para "corrigir" a divergência', () => {
    const resultado = resultadoFixture();
    // Os 4 valores informados batem exatamente com a fonte real, nenhum recalculado.
    expect(resultado.contabilidadeInformada).toEqual(
      expect.arrayContaining([
        { plantonistaNomeOriginal: 'Carlos Nunes', quantidadeInformada: 10, minutosInformados: 156 * 60, valorHorasBruto: '156:0' },
        { plantonistaNomeOriginal: 'Ana Costa', quantidadeInformada: 10, minutosInformados: 168 * 60, valorHorasBruto: '168:0' },
        { plantonistaNomeOriginal: 'Daniela Rocha', quantidadeInformada: 0, minutosInformados: 0, valorHorasBruto: '0' },
        { plantonistaNomeOriginal: 'Bruno Lima', quantidadeInformada: 11, minutosInformados: 156 * 60, valorHorasBruto: '156:0' },
      ]),
    );
  });

  it('21. não altera os intervalos brutos para "corrigir" a divergência (continuam 32)', () => {
    expect(resultadoFixture().atribuicoes).toHaveLength(32);
    expect(resultadoFixture().totalBrutoCalculado.quantidade).toBe(32);
  });

  it('22. funciona com uma aba que não se chama "PlantaoCOSI"', () => {
    const renomeada = renomearAba(carregarFixturePlantao(), 'PlantaoCOSI', 'Aba_Sem_Nome_Especial');
    const resultado = parsePlanilhaPlantao(renomeada);
    expect(resultado.ok).toBe(true);
    expect(resultado.abaOrigem).toBe('Aba_Sem_Nome_Especial');
    expect(resultado.atribuicoes).toHaveLength(32);
  });

  it('23. planilha sem estrutura reconhecida retorna erro estrutural legível, ok=false', () => {
    const arquivo = construirArrayBuffer('Aba1', [['nada', 'aqui'], ['x', 'y']]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.ok).toBe(false);
    expect(resultado.atribuicoes).toEqual([]);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]?.motivo).toBeTruthy();
  });

  it('24. o parser 6x1 continua funcionando (compatibilidade preservada)', () => {
    const resultado = parsePlanilhaEscala(carregarFixture(), OPCOES_SOC);
    expect(resultado.ok).toBe(true);
    expect(resultado.documentos).toHaveLength(9);
  });
});

describe('interpretação de data/hora e dia da semana (Plantão)', () => {
  it('um nome de dia da semana divergente da data real gera aviso, mas NUNCA altera a data', () => {
    const arquivo = construirWorkbookAtribuicoes([
      // 25/07/2026 é sábado de verdade — "Segunda-feira" aqui está errado de propósito.
      ['Ana Costa', 'Segunda-feira, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 19:00'],
    ]);
    const resultado = parsePlanilhaPlantao(arquivo);
    expect(resultado.atribuicoes[0]?.inicio).toEqual({ data: '2026-07-25', hora: '00:00' });
    expect(resultado.avisos.some((a) => a.includes('não corresponde ao dia da semana real'))).toBe(true);
  });
});

describe('helpers puros do domínio de Plantão', () => {
  it('calcularDuracaoBrutaDosIntervalos soma quantidade e minutos das atribuições', () => {
    const resultado = resultadoFixture();
    expect(calcularDuracaoBrutaDosIntervalos(resultado.atribuicoes)).toEqual({
      quantidade: 32,
      minutos: 504 * 60,
    });
  });

  it('detectarSobreposicoesPlantao não encontra nada na fixture real (nenhuma sobreposição real na planilha)', () => {
    expect(detectarSobreposicoesPlantao(resultadoFixture().atribuicoes)).toEqual([]);
  });

  it('identificarLacunasPlantao expõe a lacuna real 07:00 → 19:00 sem classificá-la como violação', () => {
    const lacunas = identificarLacunasPlantao(resultadoFixture().atribuicoes);
    expect(lacunas.length).toBeGreaterThan(0);
    const lacuna = lacunas.find((l) => l.fimAnterior.hora === '07:00' && l.inicioProximo.hora === '19:00');
    expect(lacuna).toBeDefined();
    expect(lacuna?.minutos).toBe(12 * 60);
  });

  it('listarPlantonistasUnicos retorna os 3 nomes únicos que efetivamente têm atribuição, preservando a grafia original', () => {
    const nomes = listarPlantonistasUnicos(resultadoFixture());
    expect(nomes.sort()).toEqual(['Ana Costa', 'Bruno Lima', 'Carlos Nunes'].sort());
  });
});

describe('somarContabilidadeInformada — terceira camada de verdade (Fase PLANTÃO-3B.1)', () => {
  it('soma as 4 linhas individuais da fixture: 31 plantões, 480h — NUNCA o total declarado (468h)', () => {
    const soma = somarContabilidadeInformada(resultadoFixture().contabilidadeInformada);
    expect(soma).toEqual({ quantidade: 31, minutos: 480 * 60 });
  });

  it('participante com 0/0 entra na soma sem alterar o resultado', () => {
    const soma = somarContabilidadeInformada([
      { plantonistaNomeOriginal: 'A', quantidadeInformada: 10, minutosInformados: 100, valorHorasBruto: '1:40' },
      { plantonistaNomeOriginal: 'B', quantidadeInformada: 0, minutosInformados: 0, valorHorasBruto: '0' },
    ]);
    expect(soma).toEqual({ quantidade: 10, minutos: 100 });
  });

  it('lista vazia soma para {quantidade: 0, minutos: 0} — nunca lança, nunca retorna ausente', () => {
    expect(somarContabilidadeInformada([])).toEqual({ quantidade: 0, minutos: 0 });
  });
});

describe('conferirContabilidadePlantao — três camadas + divergências (Fase PLANTÃO-3B.1)', () => {
  it('camada bruta: 32 intervalos, 504h — igual a totalBrutoCalculado, nunca recalculado diferente', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    expect(conferencia.bruto).toEqual({ quantidade: 32, minutos: 504 * 60 });
  });

  it('camada de contabilidade individual somada: 31 plantões, 480h', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    expect(conferencia.somaContabilidadeInformada).toEqual({ quantidade: 31, minutos: 480 * 60 });
  });

  it('camada declarada na fonte: 31 plantões, 468h', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    expect(conferencia.declarado).toEqual({ totalPlantoesInformado: 31, totalMinutosInformado: 468 * 60 });
  });

  it('divergência A: 32 intervalos brutos vs. 31 da contabilidade individual — divergente', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    const divergenciaA = conferencia.divergencias.find((d) => d.chave === 'INTERVALOS_VS_CONTABILIDADE_QUANTIDADE');
    expect(divergenciaA).toEqual({ chave: 'INTERVALOS_VS_CONTABILIDADE_QUANTIDADE', valorA: 32, valorB: 31, divergente: true });
  });

  it('divergência B: 504h brutas vs. 480h da contabilidade individual — divergente', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    const divergenciaB = conferencia.divergencias.find((d) => d.chave === 'INTERVALOS_VS_CONTABILIDADE_MINUTOS');
    expect(divergenciaB).toEqual({ chave: 'INTERVALOS_VS_CONTABILIDADE_MINUTOS', valorA: 504 * 60, valorB: 480 * 60, divergente: true });
  });

  it('divergência C: 480h da contabilidade individual vs. 468h declaradas — divergente', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    const divergenciaC = conferencia.divergencias.find((d) => d.chave === 'CONTABILIDADE_VS_DECLARADO_MINUTOS');
    expect(divergenciaC).toEqual({ chave: 'CONTABILIDADE_VS_DECLARADO_MINUTOS', valorA: 480 * 60, valorB: 468 * 60, divergente: true });
  });

  it('divergência D: 31 da contabilidade individual vs. 31 declarados — SEM divergência de quantidade', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    const divergenciaD = conferencia.divergencias.find((d) => d.chave === 'CONTABILIDADE_VS_DECLARADO_QUANTIDADE');
    expect(divergenciaD).toEqual({ chave: 'CONTABILIDADE_VS_DECLARADO_QUANTIDADE', valorA: 31, valorB: 31, divergente: false });
  });

  it('nenhum campo/valor é rotulado como "correto" — auditoria estrutural do próprio objeto retornado', () => {
    const conferencia = conferirContabilidadePlantao(resultadoFixture());
    const chaves = JSON.stringify(conferencia).toLowerCase();
    expect(chaves).not.toMatch(/correto|correta|realcorreto|totalcorreto/u);
  });

  it('sem seção de contabilidade informada: nenhuma divergência bruto-vs-individual é gerada (não compara contra zero)', () => {
    const conferencia = conferirContabilidadePlantao({
      totalBrutoCalculado: { quantidade: 5, minutos: 500 },
      contabilidadeInformada: [],
      totaisInformados: null,
    });
    expect(conferencia.divergencias).toEqual([]);
    expect(conferencia.somaContabilidadeInformada).toEqual({ quantidade: 0, minutos: 0 });
  });

  it('com contabilidade individual mas sem linha de total declarada: só as divergências A/B aparecem, nunca C/D', () => {
    const conferencia = conferirContabilidadePlantao({
      totalBrutoCalculado: { quantidade: 2, minutos: 200 },
      contabilidadeInformada: [
        { plantonistaNomeOriginal: 'A', quantidadeInformada: 1, minutosInformados: 100, valorHorasBruto: '1:40' },
      ],
      totaisInformados: null,
    });
    expect(conferencia.divergencias.map((d) => d.chave).sort()).toEqual([
      'INTERVALOS_VS_CONTABILIDADE_MINUTOS',
      'INTERVALOS_VS_CONTABILIDADE_QUANTIDADE',
    ]);
  });

  it('quando todas as camadas coincidem, nenhuma divergência é reportada (conferência consistente)', () => {
    const conferencia = conferirContabilidadePlantao({
      totalBrutoCalculado: { quantidade: 1, minutos: 60 },
      contabilidadeInformada: [
        { plantonistaNomeOriginal: 'A', quantidadeInformada: 1, minutosInformados: 60, valorHorasBruto: '1:0' },
      ],
      totaisInformados: { totalPlantoesInformado: 1, totalMinutosInformado: 60 },
    });
    expect(conferencia.divergencias.every((d) => !d.divergente)).toBe(true);
    expect(conferencia.divergencias).toHaveLength(4);
  });
});

describe('linha de total com rótulo diferente de "Total" — causa raiz do bug dos "—" no Dashboard (Fase PLANTÃO-3B.1)', () => {
  function construirPlanilhaComContabilidade(rotuloLinhaTotal: string): ArrayBuffer {
    return construirArrayBuffer('Aba1', [
      ['Plantonista Segurança', 'Data Inicio', 'Data Fim'],
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 12:00'],
      [],
      ['CONTABILIDADE DOS PLANTÕES NO MÊS'],
      ['Plantonistas', 'N° Plantões', 'N° Horas'],
      ['Ana Costa', '1', '12:0'],
      [rotuloLinhaTotal, '1', '12:0'],
    ]);
  }

  it('reconhece "Total Geral" como linha de total (antes desta fase, ficava null e virava um plantonista falso)', () => {
    const resultado = parsePlanilhaPlantao(construirPlanilhaComContabilidade('Total Geral'));
    expect(resultado.totaisInformados).toEqual({ totalPlantoesInformado: 1, totalMinutosInformado: 12 * 60 });
    expect(resultado.contabilidadeInformada.map((c) => c.plantonistaNomeOriginal)).toEqual(['Ana Costa']);
  });

  it('reconhece "Total:" como linha de total', () => {
    const resultado = parsePlanilhaPlantao(construirPlanilhaComContabilidade('Total:'));
    expect(resultado.totaisInformados).toEqual({ totalPlantoesInformado: 1, totalMinutosInformado: 12 * 60 });
  });

  it('reconhece "TOTAL DO MÊS" como linha de total', () => {
    const resultado = parsePlanilhaPlantao(construirPlanilhaComContabilidade('TOTAL DO MÊS'));
    expect(resultado.totaisInformados).toEqual({ totalPlantoesInformado: 1, totalMinutosInformado: 12 * 60 });
  });

  it('continua reconhecendo "Total" exato (compatibilidade com a fixture existente)', () => {
    const resultado = parsePlanilhaPlantao(construirPlanilhaComContabilidade('Total'));
    expect(resultado.totaisInformados).toEqual({ totalPlantoesInformado: 1, totalMinutosInformado: 12 * 60 });
  });

  it('sem nenhuma linha de total na planilha, totaisInformados é null (ausência, nunca 0 inventado)', () => {
    const resultado = parsePlanilhaPlantao(construirArrayBuffer('Aba1', [
      ['Plantonista Segurança', 'Data Inicio', 'Data Fim'],
      ['Ana Costa', 'Sábado, 25/07/2026 - 00:00', 'Domingo, 26/07/2026 - 12:00'],
      [],
      ['CONTABILIDADE DOS PLANTÕES NO MÊS'],
      ['Plantonistas', 'N° Plantões', 'N° Horas'],
      ['Ana Costa', '1', '12:0'],
    ]));
    expect(resultado.totaisInformados).toBeNull();
    expect(resultado.contabilidadeInformada).toHaveLength(1);
  });
});
