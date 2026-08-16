import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  calcularDuracaoBrutaDosIntervalos,
  detectarSobreposicoesPlantao,
  identificarLacunasPlantao,
  listarPlantonistasUnicos,
  parsePlanilhaEscala,
  parsePlanilhaPlantao,
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
