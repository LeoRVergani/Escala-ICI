import { describe, expect, it } from 'vitest';
import {
  LIMITE_ALERTAS_LEMBRETE,
  LIMITE_DESCRICAO_LEMBRETE,
  LIMITE_TITULO_LEMBRETE,
  agruparLembretesPorData,
  criarOcorrenciasSerie,
  filtrarLembretesPorIntervalo,
  lembretesAtribuidosAtivos,
  normalizarAlertasLembrete,
  normalizarDescricaoLembrete,
  normalizarHorarioLembrete,
  normalizarLembrete,
  normalizarTituloLembrete,
  ordenarLembretes,
  validarDataCivil,
  validarEntradaLembrete,
  validarEntradaSerieLembrete,
  validarHorario,
  validarHorarioLembrete,
  type LembreteAtribuido,
} from './lembretes';

describe('validarDataCivil', () => {
  it('aceita datas civis válidas', () => {
    expect(validarDataCivil('2026-08-17')).toBe(true);
    expect(validarDataCivil('2026-02-28')).toBe(true);
    expect(validarDataCivil('2028-02-29')).toBe(true); // 2028 é bissexto
    expect(validarDataCivil('2026-01-01')).toBe(true);
    expect(validarDataCivil('2026-12-31')).toBe(true);
  });

  it('rejeita fevereiro fora de ano bissexto', () => {
    expect(validarDataCivil('2026-02-29')).toBe(false);
  });

  it('rejeita dia inexistente no mês', () => {
    expect(validarDataCivil('2026-04-31')).toBe(false);
  });

  it('rejeita mês inválido', () => {
    expect(validarDataCivil('2026-13-01')).toBe(false);
  });

  it('rejeita formato inválido', () => {
    expect(validarDataCivil('17/08/2026')).toBe(false);
    expect(validarDataCivil('2026-8-17')).toBe(false);
    expect(validarDataCivil('não é uma data')).toBe(false);
    expect(validarDataCivil('')).toBe(false);
  });

  it('funciona na virada de ano', () => {
    expect(validarDataCivil('2026-12-31')).toBe(true);
    expect(validarDataCivil('2027-01-01')).toBe(true);
  });
});

describe('validarHorario', () => {
  it('aceita horários válidos', () => {
    expect(validarHorario('00:00')).toBe(true);
    expect(validarHorario('23:59')).toBe(true);
    expect(validarHorario('18:30')).toBe(true);
  });

  it('rejeita hora 24 ou maior', () => {
    expect(validarHorario('24:00')).toBe(false);
  });

  it('rejeita hora sem dois dígitos', () => {
    expect(validarHorario('7:00')).toBe(false);
  });

  it('rejeita minuto 60 ou maior', () => {
    expect(validarHorario('18:60')).toBe(false);
  });

  it('rejeita texto arbitrário', () => {
    expect(validarHorario('abc')).toBe(false);
  });
});

describe('validarHorarioLembrete — dia inteiro', () => {
  it('aceita dia inteiro sem horários', () => {
    expect(validarHorarioLembrete({ diaInteiro: true, horaInicio: null, horaFim: null })).toEqual([]);
  });

  it('rejeita dia inteiro com horário definido', () => {
    const erros = validarHorarioLembrete({ diaInteiro: true, horaInicio: '18:30', horaFim: null });
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe('validarHorarioLembrete — intervalo', () => {
  it('aceita intervalo simples', () => {
    expect(validarHorarioLembrete({ diaInteiro: false, horaInicio: '18:30', horaFim: '22:30' })).toEqual([]);
  });

  it('aceita somente horário de início (lembrete pontual)', () => {
    expect(validarHorarioLembrete({ diaInteiro: false, horaInicio: '21:00', horaFim: null })).toEqual([]);
  });

  it('aceita intervalo que vira o dia (22:00–01:00)', () => {
    expect(validarHorarioLembrete({ diaInteiro: false, horaInicio: '22:00', horaFim: '01:00' })).toEqual([]);
  });

  it('rejeita horário final igual ao inicial', () => {
    const erros = validarHorarioLembrete({ diaInteiro: false, horaInicio: '18:30', horaFim: '18:30' });
    expect(erros.length).toBeGreaterThan(0);
  });

  it('rejeita ausência de horário quando não é dia inteiro', () => {
    const erros = validarHorarioLembrete({ diaInteiro: false, horaInicio: null, horaFim: null });
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe('normalizarHorarioLembrete — viraDia', () => {
  it('não vira dia em intervalo comum', () => {
    expect(normalizarHorarioLembrete({ diaInteiro: false, horaInicio: '18:30', horaFim: '22:30' }).viraDia).toBe(false);
  });

  it('vira dia quando o fim é menor que o início', () => {
    expect(normalizarHorarioLembrete({ diaInteiro: false, horaInicio: '22:00', horaFim: '01:00' }).viraDia).toBe(true);
  });

  it('dia inteiro nunca vira dia e zera os horários', () => {
    const horario = normalizarHorarioLembrete({ diaInteiro: true, horaInicio: '18:30', horaFim: '22:30' });
    expect(horario).toEqual({ diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false });
  });

  it('sem horário de fim, não vira dia', () => {
    expect(normalizarHorarioLembrete({ diaInteiro: false, horaInicio: '21:00', horaFim: null }).viraDia).toBe(false);
  });
});

describe('normalizarTituloLembrete / normalizarDescricaoLembrete', () => {
  it('remove espaços nas extremidades do título', () => {
    expect(normalizarTituloLembrete('  Estudar CySA+  ')).toBe('Estudar CySA+');
  });

  it('normaliza descrição vazia ou só espaços para null', () => {
    expect(normalizarDescricaoLembrete('')).toBeNull();
    expect(normalizarDescricaoLembrete('   ')).toBeNull();
    expect(normalizarDescricaoLembrete(null)).toBeNull();
    expect(normalizarDescricaoLembrete(undefined)).toBeNull();
  });

  it('preserva descrição normal com trim', () => {
    expect(normalizarDescricaoLembrete('  Revisar módulo  ')).toBe('Revisar módulo');
  });
});

function entradaBase(sobrescritas: Partial<Parameters<typeof validarEntradaLembrete>[0]> = {}) {
  return {
    titulo: 'Estudar CySA+',
    descricao: null,
    data: '2026-08-19',
    diaInteiro: false,
    horaInicio: '21:00',
    horaFim: null,
    ...sobrescritas,
  };
}

describe('validarEntradaLembrete — título', () => {
  it('aceita título normal', () => {
    expect(validarEntradaLembrete(entradaBase())).toEqual([]);
  });

  it('rejeita título vazio', () => {
    expect(validarEntradaLembrete(entradaBase({ titulo: '' })).length).toBeGreaterThan(0);
  });

  it('rejeita título só com espaços', () => {
    expect(validarEntradaLembrete(entradaBase({ titulo: '   ' })).length).toBeGreaterThan(0);
  });

  it('aceita título exatamente no limite', () => {
    const titulo = 'x'.repeat(LIMITE_TITULO_LEMBRETE);
    expect(validarEntradaLembrete(entradaBase({ titulo }))).toEqual([]);
  });

  it('rejeita título acima do limite', () => {
    const titulo = 'x'.repeat(LIMITE_TITULO_LEMBRETE + 1);
    expect(validarEntradaLembrete(entradaBase({ titulo })).length).toBeGreaterThan(0);
  });
});

describe('validarEntradaLembrete — descrição', () => {
  it('aceita descrição nula', () => {
    expect(validarEntradaLembrete(entradaBase({ descricao: null }))).toEqual([]);
  });

  it('aceita descrição vazia (normaliza para null)', () => {
    expect(validarEntradaLembrete(entradaBase({ descricao: '' }))).toEqual([]);
  });

  it('aceita descrição exatamente no limite', () => {
    const descricao = 'x'.repeat(LIMITE_DESCRICAO_LEMBRETE);
    expect(validarEntradaLembrete(entradaBase({ descricao }))).toEqual([]);
  });

  it('rejeita descrição acima do limite', () => {
    const descricao = 'x'.repeat(LIMITE_DESCRICAO_LEMBRETE + 1);
    expect(validarEntradaLembrete(entradaBase({ descricao })).length).toBeGreaterThan(0);
  });
});

describe('validarEntradaLembrete — data', () => {
  it('rejeita data inválida', () => {
    expect(validarEntradaLembrete(entradaBase({ data: '2026-02-30' })).length).toBeGreaterThan(0);
  });

  it('não depende da competência operacional 26→25', () => {
    // 2026-09-10 pertence à competência seguinte (dia >= 26 vira mês seguinte
    // em `competenciaOperacional`), mas o lembrete deve validar normalmente.
    expect(validarEntradaLembrete(entradaBase({ data: '2026-09-10' }))).toEqual([]);
  });
});

describe('normalizarAlertasLembrete', () => {
  it('deduplica e ordena', () => {
    expect(normalizarAlertasLembrete([30, 0, 60, 0, 10])).toEqual([0, 10, 30, 60]);
  });
});

describe('validarEntradaLembrete — alertas', () => {
  it('aceita antecedências válidas', () => {
    expect(validarEntradaLembrete(entradaBase({ alertasAntecedenciaMin: [0, 10, 30, 60, 1440] }))).toEqual([]);
  });

  it('rejeita antecedência negativa', () => {
    expect(validarEntradaLembrete(entradaBase({ alertasAntecedenciaMin: [-10] })).length).toBeGreaterThan(0);
  });

  it('rejeita duplicata', () => {
    expect(validarEntradaLembrete(entradaBase({ alertasAntecedenciaMin: [10, 10] })).length).toBeGreaterThan(0);
  });

  it('rejeita acima do máximo permitido', () => {
    const alertas = Array.from({ length: LIMITE_ALERTAS_LEMBRETE + 1 }, (_, indice) => indice * 10);
    expect(validarEntradaLembrete(entradaBase({ alertasAntecedenciaMin: alertas })).length).toBeGreaterThan(0);
  });

  it('aceita exatamente o máximo permitido', () => {
    const alertas = Array.from({ length: LIMITE_ALERTAS_LEMBRETE }, (_, indice) => indice * 10);
    expect(validarEntradaLembrete(entradaBase({ alertasAntecedenciaMin: alertas }))).toEqual([]);
  });
});

describe('normalizarLembrete', () => {
  it('produz o conteúdo final normalizado', () => {
    const conteudo = normalizarLembrete(entradaBase({ titulo: '  Estudar CySA+  ' }));
    expect(conteudo).toEqual({
      titulo: 'Estudar CySA+',
      descricao: null,
      data: '2026-08-19',
      horario: { diaInteiro: false, horaInicio: '21:00', horaFim: null, viraDia: false },
      serieId: null,
      alertasAntecedenciaMin: [],
    });
  });
});

describe('criarOcorrenciasSerie — cenário COBIT', () => {
  it('gera 4 ocorrências ordenadas para a série de agosto', () => {
    const ocorrencias = criarOcorrenciasSerie(
      {
        titulo: 'Capacitação COBIT',
        descricao: null,
        datas: ['2026-08-19', '2026-08-17', '2026-08-18', '2026-08-20'],
        diaInteiro: false,
        horaInicio: '18:30',
        horaFim: '22:30',
      },
      'serie-cobit-1',
    );

    expect(ocorrencias.map((ocorrencia) => ocorrencia.data)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
    expect(ocorrencias.every((ocorrencia) => ocorrencia.serieId === 'serie-cobit-1')).toBe(true);
    expect(ocorrencias.every((ocorrencia) => ocorrencia.titulo === 'Capacitação COBIT')).toBe(true);
    expect(ocorrencias.every((ocorrencia) => ocorrencia.horario.horaInicio === '18:30')).toBe(true);
  });

  it('gera a segunda série atravessando competências 26→25 diferentes', () => {
    const ocorrencias = criarOcorrenciasSerie(
      {
        titulo: 'Capacitação COBIT — turma 2',
        descricao: null,
        datas: ['2026-08-21', '2026-08-28', '2026-09-10', '2026-09-17'],
        diaInteiro: false,
        horaInicio: '13:00',
        horaFim: '17:30',
      },
      'serie-cobit-2',
    );

    expect(ocorrencias).toHaveLength(4);
    expect(ocorrencias.map((ocorrencia) => ocorrencia.data)).toEqual([
      '2026-08-21',
      '2026-08-28',
      '2026-09-10',
      '2026-09-17',
    ]);
  });

  it('deduplica e ordena datas repetidas/fora de ordem', () => {
    const ocorrencias = criarOcorrenciasSerie(
      {
        titulo: 'Reunião recorrente',
        descricao: null,
        datas: ['2026-08-20', '2026-08-18', '2026-08-18', '2026-08-19'],
        diaInteiro: true,
        horaInicio: null,
        horaFim: null,
      },
      'serie-x',
    );

    expect(ocorrencias.map((ocorrencia) => ocorrencia.data)).toEqual([
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
  });
});

describe('validarEntradaSerieLembrete', () => {
  it('rejeita série sem nenhuma data', () => {
    const erros = validarEntradaSerieLembrete({
      titulo: 'Capacitação',
      descricao: null,
      datas: [],
      diaInteiro: true,
      horaInicio: null,
      horaFim: null,
    });
    expect(erros.length).toBeGreaterThan(0);
  });

  it('rejeita data inválida dentro da série', () => {
    const erros = validarEntradaSerieLembrete({
      titulo: 'Capacitação',
      descricao: null,
      datas: ['2026-08-17', '2026-02-30'],
      diaInteiro: true,
      horaInicio: null,
      horaFim: null,
    });
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe('ordenarLembretes', () => {
  it('ordena dia inteiro antes dos horários e por hora crescente dentro do dia', () => {
    const itens = [
      { id: 'c', data: '2026-08-17', horario: { diaInteiro: false, horaInicio: '18:30', horaFim: null, viraDia: false } },
      { id: 'a', data: '2026-08-17', horario: { diaInteiro: false, horaInicio: '08:00', horaFim: null, viraDia: false } },
      { id: 'd', data: '2026-08-17', horario: { diaInteiro: false, horaInicio: '21:00', horaFim: null, viraDia: false } },
      { id: 'b', data: '2026-08-17', horario: { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false } },
      { id: 'e', data: '2026-08-17', horario: { diaInteiro: false, horaInicio: '13:00', horaFim: null, viraDia: false } },
    ];

    expect(ordenarLembretes(itens).map((item) => item.id)).toEqual(['b', 'a', 'e', 'c', 'd']);
  });

  it('ordena primeiro por data', () => {
    const itens = [
      { data: '2026-08-19', horario: { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false } },
      { data: '2026-08-17', horario: { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false } },
      { data: '2026-08-18', horario: { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false } },
    ];

    expect(ordenarLembretes(itens).map((item) => item.data)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
    ]);
  });
});

describe('agruparLembretesPorData', () => {
  it('agrupa por data em ordem cronológica', () => {
    const itens = [
      { id: '2', data: '2026-08-18', horario: { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false } },
      { id: '1a', data: '2026-08-17', horario: { diaInteiro: false, horaInicio: '08:00', horaFim: null, viraDia: false } },
      { id: '1b', data: '2026-08-17', horario: { diaInteiro: false, horaInicio: '18:00', horaFim: null, viraDia: false } },
    ];

    const grupos = agruparLembretesPorData(itens);
    expect(grupos.map((grupo) => grupo.data)).toEqual(['2026-08-17', '2026-08-18']);
    expect(grupos[0]?.itens.map((item) => item.id)).toEqual(['1a', '1b']);
    expect(grupos[1]?.itens.map((item) => item.id)).toEqual(['2']);
  });
});

describe('filtrarLembretesPorIntervalo', () => {
  const itens = [
    { data: '2026-08-16' },
    { data: '2026-08-17' },
    { data: '2026-08-20' },
    { data: '2026-09-01' },
  ];

  it('inclui o limite inicial', () => {
    expect(filtrarLembretesPorIntervalo(itens, '2026-08-17', '2026-09-01').map((item) => item.data))
      .toContain('2026-08-17');
  });

  it('inclui o limite final', () => {
    expect(filtrarLembretesPorIntervalo(itens, '2026-08-17', '2026-08-20').map((item) => item.data))
      .toContain('2026-08-20');
  });

  it('exclui datas fora do intervalo', () => {
    const filtrados = filtrarLembretesPorIntervalo(itens, '2026-08-17', '2026-08-20').map((item) => item.data);
    expect(filtrados).not.toContain('2026-08-16');
    expect(filtrados).not.toContain('2026-09-01');
  });

  it('atravessa meses sem depender de competência', () => {
    expect(filtrarLembretesPorIntervalo(itens, '2026-08-01', '2026-09-30').map((item) => item.data))
      .toEqual(['2026-08-16', '2026-08-17', '2026-08-20', '2026-09-01']);
  });
});

describe('lembretesAtribuidosAtivos', () => {
  const base: Omit<LembreteAtribuido, 'status'> = {
    tipo: 'ATRIBUIDO',
    schemaVersion: 1,
    titulo: 'Capacitação COBIT',
    descricao: null,
    data: '2026-08-17',
    horario: { diaInteiro: false, horaInicio: '18:30', horaFim: '22:30', viraDia: false },
    serieId: 'serie-cobit-1',
    alertasAntecedenciaMin: [],
    destinatarioLogin: 'colaborador.x',
    destinatarioEquipeId: 'EQ_COSI_SOC',
    criadoPorLogin: 'gestor.y',
    criadoPorNome: 'Gestor Y',
  };

  it('mantém apenas os ativos, sem apagar cancelados do domínio', () => {
    const itens: LembreteAtribuido[] = [
      { ...base, status: 'ATIVO' },
      { ...base, status: 'CANCELADO' },
    ];
    expect(lembretesAtribuidosAtivos(itens)).toHaveLength(1);
    expect(lembretesAtribuidosAtivos(itens)[0]?.status).toBe('ATIVO');
    expect(itens).toHaveLength(2); // nada foi removido do array original
  });
});
