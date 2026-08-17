import { describe, expect, it } from 'vitest';

import type { AtribuicaoPlantaoBruta, PadraoHorarioPlantaoDia } from '@escala-ici/contrato';

import {
  TAMANHO_PALETA_IDENTIDADE_PLANTAO,
  adicionarAtribuicaoEditavel,
  agruparAtribuicoesPorDia,
  conferirEscalaAtualPlantao,
  construirAtribuicaoDoPadraoHorario,
  criarAtribuicaoEditavelDeCompetenciaAnterior,
  criarAtribuicoesEditaveis,
  duracaoPlantaoAtipica,
  editarAtribuicaoEditavel,
  ehDiaDeContexto,
  excluirAtribuicaoEditavel,
  indiceIdentidadePlantonista,
  nomeCurtoPlantonista,
  resumirPorPessoa,
  rotuloHorarioCartaoPlantao,
  validarAtribuicaoEditavel,
  type AtribuicaoPlantaoEditavel,
} from './editorPlantao';

const ATRIBUICOES_ORIGINAIS: AtribuicaoPlantaoBruta[] = [
  { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-07-25', hora: '00:00' }, fim: { data: '2026-07-26', hora: '19:00' }, duracaoMinutos: 43 * 60, linhaOrigem: 2, abaOrigem: 'PlantaoCOSI' },
  { plantonistaNomeOriginal: 'Bruno Lima', inicio: { data: '2026-07-26', hora: '19:00' }, fim: { data: '2026-07-27', hora: '07:00' }, duracaoMinutos: 12 * 60, linhaOrigem: 3, abaOrigem: 'PlantaoCOSI' },
  { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-07-27', hora: '19:00' }, fim: { data: '2026-07-28', hora: '07:00' }, duracaoMinutos: 12 * 60, linhaOrigem: 4, abaOrigem: 'PlantaoCOSI' },
  { plantonistaNomeOriginal: 'Carlos Nunes', inicio: { data: '2026-07-31', hora: '19:00' }, fim: { data: '2026-08-01', hora: '19:00' }, duracaoMinutos: 24 * 60, linhaOrigem: 5, abaOrigem: 'PlantaoCOSI' },
];

function congelarProfundo<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

describe('criarAtribuicoesEditaveis', () => {
  it('1. gera idLocal sequencial "importado-N" e origemImportacao true para cada linha', () => {
    const editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    expect(editaveis.map((a) => a.idLocal)).toEqual(['importado-0', 'importado-1', 'importado-2', 'importado-3']);
    expect(editaveis.every((a) => a.origemImportacao)).toBe(true);
  });

  it('2. preserva todos os campos originais de AtribuicaoPlantaoBruta', () => {
    const [primeira] = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    expect(primeira).toMatchObject(ATRIBUICOES_ORIGINAIS[0]!);
  });

  it('3. NÃO muta o array original (fonte original permanece congelada)', () => {
    const copiaAntesEsperada = congelarProfundo(ATRIBUICOES_ORIGINAIS);
    const editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    editarAtribuicaoEditavel(editaveis, 'importado-0', {
      plantonistaNomeOriginal: 'Outro Nome',
      inicio: { data: '2026-01-01', hora: '00:00' },
      fim: { data: '2026-01-01', hora: '12:00' },
    });
    expect(ATRIBUICOES_ORIGINAIS).toEqual(copiaAntesEsperada);
  });
});

describe('editarAtribuicaoEditavel', () => {
  const BASE = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);

  it('4. edita plantonista/início/fim da atribuição correspondente e recalcula duracaoMinutos', () => {
    const editadas = editarAtribuicaoEditavel(BASE, 'importado-1', {
      plantonistaNomeOriginal: 'Bruno Lima',
      inicio: { data: '2026-07-26', hora: '19:00' },
      fim: { data: '2026-07-27', hora: '19:00' },
    });
    const alvo = editadas.find((a) => a.idLocal === 'importado-1');
    expect(alvo?.duracaoMinutos).toBe(24 * 60);
    expect(alvo?.fim).toEqual({ data: '2026-07-27', hora: '19:00' });
  });

  it('5. não altera as demais atribuições', () => {
    const editadas = editarAtribuicaoEditavel(BASE, 'importado-1', {
      plantonistaNomeOriginal: 'Bruno Lima',
      inicio: { data: '2026-07-26', hora: '19:00' },
      fim: { data: '2026-07-27', hora: '19:00' },
    });
    expect(editadas.find((a) => a.idLocal === 'importado-0')).toEqual(BASE[0]);
    expect(editadas.find((a) => a.idLocal === 'importado-3')).toEqual(BASE[3]);
  });

  it('6. idLocal desconhecido não altera nenhuma atribuição (retorna array equivalente)', () => {
    const editadas = editarAtribuicaoEditavel(BASE, 'inexistente', {
      plantonistaNomeOriginal: 'Ninguém',
      inicio: { data: '2026-01-01', hora: '00:00' },
      fim: { data: '2026-01-01', hora: '12:00' },
    });
    expect(editadas).toEqual(BASE);
  });

  it('7. não muta o array recebido (retorna um novo array)', () => {
    const antes = congelarProfundo(BASE);
    editarAtribuicaoEditavel(BASE, 'importado-1', {
      plantonistaNomeOriginal: 'Outro',
      inicio: { data: '2026-01-01', hora: '00:00' },
      fim: { data: '2026-01-01', hora: '12:00' },
    });
    expect(BASE).toEqual(antes);
  });
});

describe('adicionarAtribuicaoEditavel', () => {
  it('8. anexa nova atribuição com origemImportacao false e linhaOrigem -1', () => {
    const base = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const comNova = adicionarAtribuicaoEditavel(base, {
      plantonistaNomeOriginal: 'Daniela Rocha',
      inicio: { data: '2026-08-02', hora: '19:00' },
      fim: { data: '2026-08-03', hora: '07:00' },
      abaOrigem: 'PlantaoCOSI',
    });
    const nova = comNova[comNova.length - 1]!;
    expect(nova.origemImportacao).toBe(false);
    expect(nova.linhaOrigem).toBe(-1);
    expect(nova.duracaoMinutos).toBe(12 * 60);
    expect(comNova).toHaveLength(base.length + 1);
  });

  it('9. gera idLocal único (prefixo "manual-"), nunca colide com "importado-N"', () => {
    const base = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const comNova = adicionarAtribuicaoEditavel(base, {
      plantonistaNomeOriginal: 'Daniela Rocha',
      inicio: { data: '2026-08-02', hora: '19:00' },
      fim: { data: '2026-08-03', hora: '07:00' },
      abaOrigem: 'PlantaoCOSI',
    });
    const nova = comNova[comNova.length - 1]!;
    expect(nova.idLocal.startsWith('manual-')).toBe(true);
    expect(base.some((a) => a.idLocal === nova.idLocal)).toBe(false);
  });
});

describe('excluirAtribuicaoEditavel', () => {
  it('10. remove a atribuição com o idLocal correspondente', () => {
    const base = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const restantes = excluirAtribuicaoEditavel(base, 'importado-1');
    expect(restantes).toHaveLength(base.length - 1);
    expect(restantes.some((a) => a.idLocal === 'importado-1')).toBe(false);
  });

  it('11. idLocal desconhecido não remove nada', () => {
    const base = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const restantes = excluirAtribuicaoEditavel(base, 'inexistente');
    expect(restantes).toEqual(base);
  });
});

describe('CRÍTICO — a working copy nunca é a fonte original (editar/excluir/adicionar não afeta ATRIBUICOES_ORIGINAIS)', () => {
  it('12. um ciclo completo de editar + excluir + adicionar mantém a fonte original intacta', () => {
    const copiaAntesEsperada = congelarProfundo(ATRIBUICOES_ORIGINAIS);
    let working = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    working = editarAtribuicaoEditavel(working, 'importado-0', {
      plantonistaNomeOriginal: 'Ana Costa Editada',
      inicio: { data: '2026-07-25', hora: '00:00' },
      fim: { data: '2026-07-25', hora: '12:00' },
    });
    working = excluirAtribuicaoEditavel(working, 'importado-2');
    working = adicionarAtribuicaoEditavel(working, {
      plantonistaNomeOriginal: 'Novo Plantonista',
      inicio: { data: '2026-08-10', hora: '19:00' },
      fim: { data: '2026-08-11', hora: '07:00' },
      abaOrigem: 'PlantaoCOSI',
    });
    expect(ATRIBUICOES_ORIGINAIS).toEqual(copiaAntesEsperada);
    expect(working.find((a) => a.idLocal === 'importado-0')?.plantonistaNomeOriginal).toBe('Ana Costa Editada');
    expect(working.some((a) => a.idLocal === 'importado-2')).toBe(false);
    expect(working.some((a) => a.plantonistaNomeOriginal === 'Novo Plantonista')).toBe(true);
  });
});

describe('validarAtribuicaoEditavel', () => {
  const VALIDA = {
    plantonistaNomeOriginal: 'Ana Costa',
    inicio: { data: '2026-07-26', hora: '19:00' },
    fim: { data: '2026-07-27', hora: '07:00' },
  };

  it('13. plantonista vazio bloqueia', () => {
    expect(validarAtribuicaoEditavel({ ...VALIDA, plantonistaNomeOriginal: '  ' }).length).toBeGreaterThan(0);
  });

  it('14. data/hora inicial vazia bloqueia', () => {
    expect(validarAtribuicaoEditavel({ ...VALIDA, inicio: { data: '', hora: '' } }).length).toBeGreaterThan(0);
  });

  it('15. data/hora final vazia bloqueia', () => {
    expect(validarAtribuicaoEditavel({ ...VALIDA, fim: { data: '', hora: '' } }).length).toBeGreaterThan(0);
  });

  it('16. fim <= início bloqueia', () => {
    expect(validarAtribuicaoEditavel({
      ...VALIDA,
      inicio: { data: '2026-07-27', hora: '07:00' },
      fim: { data: '2026-07-27', hora: '07:00' },
    }).length).toBeGreaterThan(0);
  });

  it('17. duração atípica (43h) NÃO bloqueia — é só aviso em outro lugar', () => {
    expect(validarAtribuicaoEditavel({
      ...VALIDA,
      inicio: { data: '2026-07-25', hora: '00:00' },
      fim: { data: '2026-07-26', hora: '19:00' },
    })).toEqual([]);
  });

  it('18. caso válido comum não gera nenhum erro', () => {
    expect(validarAtribuicaoEditavel(VALIDA)).toEqual([]);
  });
});

describe('agruparAtribuicoesPorDia', () => {
  it('19. agrupa por data de início e ordena por hora dentro do dia', () => {
    const editaveis: AtribuicaoPlantaoEditavel[] = [
      { plantonistaNomeOriginal: 'B', inicio: { data: '2026-08-01', hora: '19:00' }, fim: { data: '2026-08-02', hora: '07:00' }, duracaoMinutos: 720, linhaOrigem: 1, abaOrigem: 'X', idLocal: 'a', origemImportacao: true },
      { plantonistaNomeOriginal: 'A', inicio: { data: '2026-08-01', hora: '07:00' }, fim: { data: '2026-08-01', hora: '19:00' }, duracaoMinutos: 720, linhaOrigem: 2, abaOrigem: 'X', idLocal: 'b', origemImportacao: true },
    ];
    const porDia = agruparAtribuicoesPorDia(editaveis);
    expect(porDia.get('2026-08-01')?.map((a) => a.idLocal)).toEqual(['b', 'a']);
  });
});

describe('nomeCurtoPlantonista', () => {
  it('20. "Ana Costa" -> "Ana C."', () => {
    expect(nomeCurtoPlantonista('Ana Costa')).toBe('Ana C.');
  });

  it('21. nome de uma palavra só permanece como está', () => {
    expect(nomeCurtoPlantonista('Madonna')).toBe('Madonna');
  });

  it('22. nome com três palavras usa primeira + inicial da última', () => {
    expect(nomeCurtoPlantonista('Carlos Eduardo Nunes')).toBe('Carlos N.');
  });
});

describe('indiceIdentidadePlantonista', () => {
  it('23. é determinístico para o mesmo nome', () => {
    expect(indiceIdentidadePlantonista('Ana Costa')).toBe(indiceIdentidadePlantonista('Ana Costa'));
  });

  it('24. está sempre dentro da faixa da paleta', () => {
    for (const nome of ['Ana Costa', 'Bruno Lima', 'Carlos Nunes', 'Daniela Rocha']) {
      const indice = indiceIdentidadePlantonista(nome);
      expect(indice).toBeGreaterThanOrEqual(0);
      expect(indice).toBeLessThan(TAMANHO_PALETA_IDENTIDADE_PLANTAO);
    }
  });

  it('25. adicionar uma pessoa nova não muda o índice de uma pessoa já existente', () => {
    const indiceAnaAntes = indiceIdentidadePlantonista('Ana Costa');
    indiceIdentidadePlantonista('Zeca Novo Integrante');
    expect(indiceIdentidadePlantonista('Ana Costa')).toBe(indiceAnaAntes);
  });
});

describe('resumirPorPessoa', () => {
  it('26. agrega quantidade e minutos por pessoa a partir da working copy', () => {
    const editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const resumo = resumirPorPessoa(editaveis);
    const ana = resumo.find((p) => p.nomeOriginal === 'Ana Costa');
    expect(ana?.quantidade).toBe(2);
    expect(ana?.minutos).toBe(43 * 60 + 12 * 60);
  });

  it('27. participante conhecido sem nenhuma atribuição atual permanece visível como 0 plantões · 0h', () => {
    const editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const resumo = resumirPorPessoa(editaveis, [{ nomeOriginal: 'Daniela Rocha' }]);
    const daniela = resumo.find((p) => p.nomeOriginal === 'Daniela Rocha');
    expect(daniela).toEqual({ nomeOriginal: 'Daniela Rocha', quantidade: 0, minutos: 0 });
  });

  it('28. pessoa nova adicionada manualmente (fora da lista de conhecidos) ainda aparece no resumo', () => {
    let editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    editaveis = adicionarAtribuicaoEditavel(editaveis, {
      plantonistaNomeOriginal: 'Eduarda Nova',
      inicio: { data: '2026-08-10', hora: '19:00' },
      fim: { data: '2026-08-11', hora: '07:00' },
      abaOrigem: 'PlantaoCOSI',
    });
    const resumo = resumirPorPessoa(editaveis, [{ nomeOriginal: 'Daniela Rocha' }]);
    expect(resumo.find((p) => p.nomeOriginal === 'Eduarda Nova')?.quantidade).toBe(1);
  });
});

describe('ehDiaDeContexto', () => {
  const PERIODO_INICIO = '2026-07-26';
  const PERIODO_FIM = '2026-08-25';

  it('29. dia antes do período é contexto', () => {
    expect(ehDiaDeContexto('2026-07-25', PERIODO_INICIO, PERIODO_FIM)).toBe(true);
  });

  it('30. dia depois do período é contexto', () => {
    expect(ehDiaDeContexto('2026-08-26', PERIODO_INICIO, PERIODO_FIM)).toBe(true);
  });

  it('31. dia dentro do período não é contexto', () => {
    expect(ehDiaDeContexto('2026-08-01', PERIODO_INICIO, PERIODO_FIM)).toBe(false);
  });

  it('32. os dois dias-limite (26 e 25) não são contexto', () => {
    expect(ehDiaDeContexto(PERIODO_INICIO, PERIODO_INICIO, PERIODO_FIM)).toBe(false);
    expect(ehDiaDeContexto(PERIODO_FIM, PERIODO_INICIO, PERIODO_FIM)).toBe(false);
  });
});

describe('conferirEscalaAtualPlantao', () => {
  it('33. calcula bruto/pessoas/sobreposições/lacunas/duracoes atípicas a partir da working copy', () => {
    const editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    const ehAtipica = (duracaoMinutos: number) => duracaoMinutos !== 12 * 60 && duracaoMinutos !== 24 * 60;
    const conferencia = conferirEscalaAtualPlantao(editaveis, ehAtipica);
    expect(conferencia.bruto.quantidade).toBe(4);
    expect(conferencia.quantidadePessoas).toBe(3);
    expect(conferencia.quantidadeDuracoesAtipicas).toBe(1);
  });

  it('34. reflete uma exclusão feita na working copy (a atribuição de 43h atípica some da contagem)', () => {
    let editaveis = criarAtribuicoesEditaveis(ATRIBUICOES_ORIGINAIS);
    editaveis = excluirAtribuicaoEditavel(editaveis, 'importado-0');
    const ehAtipica = (duracaoMinutos: number) => duracaoMinutos !== 12 * 60 && duracaoMinutos !== 24 * 60;
    const conferencia = conferirEscalaAtualPlantao(editaveis, ehAtipica);
    expect(conferencia.quantidadeDuracoesAtipicas).toBe(0);
    expect(conferencia.bruto.quantidade).toBe(3);
  });
});

describe('duracaoPlantaoAtipica', () => {
  it('35. 12h e 24h são padrão, não atípicas', () => {
    expect(duracaoPlantaoAtipica(12 * 60)).toBe(false);
    expect(duracaoPlantaoAtipica(24 * 60)).toBe(false);
  });

  it('36. 43h e 5h (bordas reais da fixture) são atípicas', () => {
    expect(duracaoPlantaoAtipica(43 * 60)).toBe(true);
    expect(duracaoPlantaoAtipica(5 * 60)).toBe(true);
  });
});

describe('rotuloHorarioCartaoPlantao', () => {
  it('37. caso comum mostra a faixa de horário "início → fim"', () => {
    const rotulo = rotuloHorarioCartaoPlantao({
      inicio: { data: '2026-07-26', hora: '19:00' },
      fim: { data: '2026-07-27', hora: '07:00' },
      duracaoMinutos: 12 * 60,
    });
    expect(rotulo).toBe('19:00 → 07:00');
  });

  it('38. 24h mostra "24h" em vez da faixa de horário', () => {
    const rotulo = rotuloHorarioCartaoPlantao({
      inicio: { data: '2026-07-31', hora: '19:00' },
      fim: { data: '2026-08-01', hora: '19:00' },
      duracaoMinutos: 24 * 60,
    });
    expect(rotulo).toBe('24h');
  });

  it('39. duração atípica (43h) mostra o aviso "⚠ 43h", nunca normaliza', () => {
    const rotulo = rotuloHorarioCartaoPlantao({
      inicio: { data: '2026-07-25', hora: '00:00' },
      fim: { data: '2026-07-26', hora: '19:00' },
      duracaoMinutos: 43 * 60,
    });
    expect(rotulo).toBe('⚠ 43h');
  });
});

describe('criarAtribuicaoEditavelDeCompetenciaAnterior — Fase ESCALAS-UX-1C ("Usar período anterior")', () => {
  it('constrói uma atribuição editável com idLocal "copiado-N", distinto de "importado-"/"rehidratado-"', () => {
    const atribuicao = criarAtribuicaoEditavelDeCompetenciaAnterior({
      indice: 0,
      plantonistaNomeOriginal: 'Ana Costa',
      inicio: { data: '2026-08-26', hora: '19:00' },
      fim: { data: '2026-08-27', hora: '07:00' },
      duracaoMinutos: 720,
    });
    expect(atribuicao.idLocal).toBe('copiado-0');
    expect(atribuicao.origemImportacao).toBe(false);
    expect(atribuicao.linhaOrigem).toBe(-1);
  });

  it('preserva nome/início/fim/duração exatamente como fornecidos — nenhum recálculo', () => {
    const atribuicao = criarAtribuicaoEditavelDeCompetenciaAnterior({
      indice: 3,
      plantonistaNomeOriginal: 'Bruno Lima',
      inicio: { data: '2026-08-25', hora: '00:00' },
      fim: { data: '2026-08-26', hora: '19:00' },
      duracaoMinutos: 43 * 60,
    });
    expect(atribuicao).toMatchObject({
      plantonistaNomeOriginal: 'Bruno Lima',
      inicio: { data: '2026-08-25', hora: '00:00' },
      fim: { data: '2026-08-26', hora: '19:00' },
      duracaoMinutos: 43 * 60,
    });
  });
});

// ---------------------------------------------------------------------------
// Fase ESCALAS-UX-2B — construirAtribuicaoDoPadraoHorario (§47 do pedido)
// ---------------------------------------------------------------------------

describe('construirAtribuicaoDoPadraoHorario', () => {
  it('1. domingo 19:00 → 07:00 +1: início no dia clicado, fim no dia seguinte', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Bruno Bueno',
      dataCivil: '2026-08-16',
      padrao,
    });
    expect(resultado.inicio).toEqual({ data: '2026-08-16', hora: '19:00' });
    expect(resultado.fim).toEqual({ data: '2026-08-17', hora: '07:00' });
  });

  it('2. sexta 19:00 → 19:00 +1 (24h): início e fim no dia seguinte, mesma hora', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Caroline Ferraz',
      dataCivil: '2026-08-21',
      padrao,
    });
    expect(resultado.inicio).toEqual({ data: '2026-08-21', hora: '19:00' });
    expect(resultado.fim).toEqual({ data: '2026-08-22', hora: '19:00' });
  });

  it('3. padrão no mesmo dia (fimDiaOffset=0): início e fim compartilham a data clicada', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Jean Alves',
      dataCivil: '2026-08-17',
      padrao,
    });
    expect(resultado.inicio.data).toBe('2026-08-17');
    expect(resultado.fim.data).toBe('2026-08-17');
  });

  it('4. primeiro dia do período (26 do mês anterior): virada de dia continua correta', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 3, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Ana Costa',
      dataCivil: '2026-07-26',
      padrao,
    });
    expect(resultado.inicio.data).toBe('2026-07-26');
    expect(resultado.fim.data).toBe('2026-07-27');
  });

  it('5. último dia do período (25 do mês), inclusive virada de mês', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 2, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Ana Costa',
      dataCivil: '2026-08-25',
      padrao,
    });
    expect(resultado.inicio.data).toBe('2026-08-25');
    expect(resultado.fim.data).toBe('2026-08-26');
  });

  it('6. o nome do plantonista é preservado exatamente como recebido', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Bruno Bueno',
      dataCivil: '2026-08-16',
      padrao,
    });
    expect(resultado.plantonistaNomeOriginal).toBe('Bruno Bueno');
  });

  it('7. a data de início é sempre a data civil informada, nunca deslocada', () => {
    const padrao: PadraoHorarioPlantaoDia = { diaSemana: 6, horaInicio: '07:00', horaFim: '19:00', fimDiaOffset: 0 };
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Claudio Reis',
      dataCivil: '2026-08-22',
      padrao,
    });
    expect(resultado.inicio.data).toBe('2026-08-22');
  });

  it('8. a data de fim reflete fimDiaOffset corretamente (0 = mesmo dia, 1 = dia seguinte)', () => {
    const mesmoDia = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'X',
      dataCivil: '2026-08-10',
      padrao: { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', fimDiaOffset: 0 },
    });
    expect(mesmoDia.fim.data).toBe('2026-08-10');
    const diaSeguinte = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'X',
      dataCivil: '2026-08-10',
      padrao: { diaSemana: 1, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    });
    expect(diaSeguinte.fim.data).toBe('2026-08-11');
  });

  it('9. duração correta (12h) quando combinado com calcularDuracaoEntreMomentos via adicionarAtribuicaoEditavel', () => {
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Bruno Bueno',
      dataCivil: '2026-08-16',
      padrao: { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    });
    const [atribuicao] = adicionarAtribuicaoEditavel([], { ...resultado, abaOrigem: 'quick-add' });
    expect(atribuicao?.duracaoMinutos).toBe(12 * 60);
  });

  it('10. duração correta (24h) quando combinado com calcularDuracaoEntreMomentos via adicionarAtribuicaoEditavel', () => {
    const resultado = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Caroline Ferraz',
      dataCivil: '2026-08-21',
      padrao: { diaSemana: 5, horaInicio: '19:00', horaFim: '19:00', fimDiaOffset: 1 },
    });
    const [atribuicao] = adicionarAtribuicaoEditavel([], { ...resultado, abaOrigem: 'quick-add' });
    expect(atribuicao?.duracaoMinutos).toBe(24 * 60);
  });

  it('11. atribuições importadas atípicas (43h/5h) permanecem intactas ao adicionar uma nova atribuição pelo padrão', () => {
    const existentes = criarAtribuicoesEditaveis([
      { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-07-25', hora: '00:00' }, fim: { data: '2026-07-26', hora: '19:00' }, duracaoMinutos: 43 * 60, linhaOrigem: 2, abaOrigem: 'PlantaoCOSI' },
      { plantonistaNomeOriginal: 'Bruno Lima', inicio: { data: '2026-07-31', hora: '14:00' }, fim: { data: '2026-07-31', hora: '19:00' }, duracaoMinutos: 5 * 60, linhaOrigem: 3, abaOrigem: 'PlantaoCOSI' },
    ]);
    const novaAtribuicao = construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: 'Caroline Ferraz',
      dataCivil: '2026-08-16',
      padrao: { diaSemana: 0, horaInicio: '19:00', horaFim: '07:00', fimDiaOffset: 1 },
    });
    const resultado = adicionarAtribuicaoEditavel(existentes, { ...novaAtribuicao, abaOrigem: 'quick-add' });
    const atribuicao43h = resultado.find((item) => item.plantonistaNomeOriginal === 'Ana Costa');
    const atribuicao5h = resultado.find((item) => item.plantonistaNomeOriginal === 'Bruno Lima');
    expect(atribuicao43h?.duracaoMinutos).toBe(43 * 60);
    expect(atribuicao5h?.duracaoMinutos).toBe(5 * 60);
    expect(resultado).toHaveLength(3);
  });
});
