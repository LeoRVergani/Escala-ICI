import { describe, expect, it } from 'vitest';
import {
  contarLembretesPorData,
  entradaLembreteDoFormulario,
  entradaSerieLembreteDoFormulario,
  lembretesDoDia,
  mesAdjacente,
  mesDeData,
  primeiroDiaDoMes,
  proximosLembretesAgrupados,
  rotuloDataLembretePorExtenso,
  rotuloHorarioLembrete,
  rotuloViraDia,
  tituloMesLembretes,
  ultimoDiaDoMes,
  unificarLembretesAtivos,
  validarFormularioLembrete,
  type FormularioLembrete,
  type ItemLembreteAtribuido,
  type ItemLembretePessoal,
} from './lembretesUi';

function pessoal(sobrescritas: Partial<ItemLembretePessoal> = {}): ItemLembretePessoal {
  return {
    lembreteId: 'p1',
    tipo: 'PESSOAL',
    titulo: 'Estudar CySA+',
    descricao: null,
    data: '2026-08-19',
    horario: { diaInteiro: false, horaInicio: '21:00', horaFim: null, viraDia: false },
    serieId: null,
    ...sobrescritas,
  };
}

function atribuido(sobrescritas: Partial<ItemLembreteAtribuido> = {}): ItemLembreteAtribuido {
  return {
    lembreteId: 'a1',
    tipo: 'ATRIBUIDO',
    titulo: 'Capacitação COBIT',
    descricao: null,
    data: '2026-08-17',
    horario: { diaInteiro: false, horaInicio: '18:30', horaFim: '22:30', viraDia: false },
    serieId: null,
    status: 'ATIVO',
    criadoPorNome: 'Marina Azevedo',
    ...sobrescritas,
  };
}

describe('unificarLembretesAtivos', () => {
  it('une pessoal e atribuído ativo, ordenados', () => {
    const unificados = unificarLembretesAtivos(
      [pessoal({ data: '2026-08-19' })],
      [atribuido({ data: '2026-08-17' })],
    );
    expect(unificados.map((item) => item.data)).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('nunca inclui atribuído CANCELADO na visão ativa', () => {
    const unificados = unificarLembretesAtivos(
      [],
      [atribuido({ status: 'CANCELADO' })],
    );
    expect(unificados).toHaveLength(0);
  });
});

describe('lembretesDoDia / contarLembretesPorData', () => {
  it('filtra por data e conta só os ativos', () => {
    const unificados = unificarLembretesAtivos(
      [pessoal({ lembreteId: 'p1', data: '2026-08-17' }), pessoal({ lembreteId: 'p2', data: '2026-08-18' })],
      [
        atribuido({ lembreteId: 'a1', data: '2026-08-17', status: 'ATIVO' }),
        atribuido({ lembreteId: 'a2', data: '2026-08-17', status: 'CANCELADO' }),
      ],
    );
    // a1 (18:30) vem antes de p1 (21:00) — ordenação por horário crescente.
    expect(lembretesDoDia(unificados, '2026-08-17').map((item) => item.lembreteId)).toEqual(['a1', 'p1']);

    const contagem = contarLembretesPorData(unificados);
    expect(contagem.get('2026-08-17')).toBe(2); // p1 + a1 ativo, a2 cancelado não conta
    expect(contagem.get('2026-08-18')).toBe(1);
    expect(contagem.has('2026-08-19')).toBe(false);
  });
});

describe('proximosLembretesAgrupados', () => {
  it('agrupa a partir de uma data mínima, limitado a N dias', () => {
    const unificados = unificarLembretesAtivos(
      [
        pessoal({ lembreteId: 'antigo', data: '2026-08-01' }),
        pessoal({ lembreteId: 'p1', data: '2026-08-17' }),
        pessoal({ lembreteId: 'p2', data: '2026-08-18' }),
        pessoal({ lembreteId: 'p3', data: '2026-08-19' }),
      ],
      [],
    );
    const grupos = proximosLembretesAgrupados(unificados, '2026-08-17', 2);
    expect(grupos.map((grupo) => grupo.data)).toEqual(['2026-08-17', '2026-08-18']);
  });
});

describe('navegação por mês', () => {
  it('mesDeData extrai o mês civil', () => {
    expect(mesDeData('2026-08-19')).toBe('2026-08');
  });

  it('primeiroDiaDoMes / ultimoDiaDoMes', () => {
    expect(primeiroDiaDoMes('2026-08')).toBe('2026-08-01');
    expect(ultimoDiaDoMes('2026-08')).toBe('2026-08-31');
    expect(ultimoDiaDoMes('2026-02')).toBe('2026-02-28');
    expect(ultimoDiaDoMes('2028-02')).toBe('2028-02-29'); // bissexto
  });

  it('mesAdjacente avança e retrocede, inclusive virando o ano', () => {
    expect(mesAdjacente('2026-08', 1)).toBe('2026-09');
    expect(mesAdjacente('2026-08', -1)).toBe('2026-07');
    expect(mesAdjacente('2026-12', 1)).toBe('2027-01');
    expect(mesAdjacente('2026-01', -1)).toBe('2025-12');
  });

  it('tituloMesLembretes formata em pt-BR', () => {
    expect(tituloMesLembretes('2026-08')).toBe('Agosto de 2026');
  });
});

describe('rótulos', () => {
  it('rotuloDataLembretePorExtenso', () => {
    // 2026-08-17 é uma segunda-feira.
    expect(rotuloDataLembretePorExtenso('2026-08-17')).toBe('Segunda-feira, 17 de agosto de 2026');
  });

  it('rotuloHorarioLembrete cobre os três formatos', () => {
    expect(rotuloHorarioLembrete({ diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false })).toBe('Dia inteiro');
    expect(rotuloHorarioLembrete({ diaInteiro: false, horaInicio: '21:00', horaFim: null, viraDia: false })).toBe('21:00');
    expect(rotuloHorarioLembrete({ diaInteiro: false, horaInicio: '18:30', horaFim: '22:30', viraDia: false })).toBe('18:30–22:30');
  });

  it('rotuloViraDia só aparece quando viraDia é verdadeiro', () => {
    expect(rotuloViraDia({ diaInteiro: false, horaInicio: '22:00', horaFim: '01:00', viraDia: true })).toBe('Termina no dia seguinte');
    expect(rotuloViraDia({ diaInteiro: false, horaInicio: '18:30', horaFim: '22:30', viraDia: false })).toBeNull();
  });
});

function formularioBase(sobrescritas: Partial<FormularioLembrete> = {}): FormularioLembrete {
  return {
    titulo: 'Estudar CySA+',
    descricao: '',
    datas: ['2026-08-19'],
    diaInteiro: false,
    horaInicio: '21:00',
    horaFim: '',
    ...sobrescritas,
  };
}

describe('entradaLembreteDoFormulario / entradaSerieLembreteDoFormulario', () => {
  it('converte formulário de uma data em EntradaLembrete', () => {
    expect(entradaLembreteDoFormulario(formularioBase())).toEqual({
      titulo: 'Estudar CySA+',
      descricao: null,
      data: '2026-08-19',
      diaInteiro: false,
      horaInicio: '21:00',
      horaFim: null,
    });
  });

  it('dia inteiro zera os horários mesmo se o formulário ainda tiver texto neles', () => {
    const entrada = entradaLembreteDoFormulario(formularioBase({ diaInteiro: true, horaInicio: '18:30' }));
    expect(entrada.horaInicio).toBeNull();
    expect(entrada.horaFim).toBeNull();
  });

  it('converte formulário com várias datas em EntradaSerieLembrete', () => {
    const entrada = entradaSerieLembreteDoFormulario(formularioBase({
      datas: ['2026-08-17', '2026-08-18'],
      diaInteiro: true,
      horaInicio: '',
      horaFim: '',
    }));
    expect(entrada.datas).toEqual(['2026-08-17', '2026-08-18']);
    expect(entrada.diaInteiro).toBe(true);
  });
});

describe('validarFormularioLembrete', () => {
  it('valida como ocorrência única quando há 0 ou 1 data', () => {
    expect(validarFormularioLembrete(formularioBase())).toEqual([]);
    expect(validarFormularioLembrete(formularioBase({ titulo: '' })).length).toBeGreaterThan(0);
  });

  it('valida como série quando há mais de uma data', () => {
    expect(validarFormularioLembrete(formularioBase({ datas: ['2026-08-17', '2026-08-18'] }))).toEqual([]);
    expect(validarFormularioLembrete(formularioBase({ datas: ['2026-08-17', '2026-02-30'] })).length).toBeGreaterThan(0);
  });
});
