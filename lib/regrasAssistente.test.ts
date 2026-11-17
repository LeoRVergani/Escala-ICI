import { CATALOGO_SOC, adicionarDias, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import {
  definicaoDaSituacao, estadoInicialDaSituacao, fraseDaSituacao, lerEstadoDaRegra, montarRegraDoAssistente, nomeSugerido, plural, resumoDoAssistente,
  SITUACOES, type SituacaoChave,
} from './regrasAssistente';
import { testarRegra, validarRegra } from './regrasEscala';
import { REGRAS_PADRAO } from './regrasPadrao';

const todas: SituacaoChave[] = ['DIAS_SEGUIDOS', 'POUCO_DESCANSO', 'TURNO_LONGO', 'DIA_DA_SEMANA'];

function dia(codigo: string, manual?: { i: string; f: string; vd: boolean; m: number }): Dia {
  const tipo = CATALOGO_SOC[codigo]!;
  return manual ? { c: codigo, ...manual } : { c: codigo, i: tipo.horaInicio, f: tipo.horaFim, m: tipo.duracaoMinutos, vd: tipo.viraDia };
}
function escala(codigos: string[], inicio = '2026-08-03', login = 'ana'): TurnosMes {
  const dias: Record<string, Dia> = {};
  codigos.forEach((codigo, indice) => { dias[adicionarDias(inicio, indice)] = dia(codigo); });
  const datas = Object.keys(dias).sort();
  return { schemaVersion: 1, usuarioUid: `uid-${login}`, login, equipeId: 'EQ', competencia: '2026-08', periodoInicio: datas[0]!, periodoFim: datas.at(-1)!, turnoPadrao: 'MD', status: 'RASCUNHO', dias, totais: {} } as unknown as TurnosMes;
}

describe('ASSISTENTE-REGRAS-1', () => {
  it('toda situação gera uma regra válida da empresa, com nome e frase em português corrente', () => {
    for (const chave of todas) {
      const regra = montarRegraDoAssistente(estadoInicialDaSituacao(chave), 'regra-x');
      expect(validarRegra(regra)).toEqual([]);
      expect(regra.categoria).toBe('EMPRESA');
      expect(regra.nome.length).toBeGreaterThan(5);
    }
    expect(SITUACOES.map((situacao) => situacao.chave)).toEqual(todas);
  });

  it('as frases completam "quando alguém …" e concordam com o número', () => {
    expect(fraseDaSituacao('DIAS_SEGUIDOS', { valor: 5, diaSemana: 0 })).toBe('trabalhar mais de 5 dias seguidos');
    expect(fraseDaSituacao('DIAS_SEGUIDOS', { valor: 1, diaSemana: 0 })).toBe('trabalhar mais de 1 dia seguido');
    expect(fraseDaSituacao('POUCO_DESCANSO', { valor: 12, diaSemana: 0 })).toBe('descansar menos de 12 horas entre um turno e o seguinte');
    expect(fraseDaSituacao('TURNO_LONGO', { valor: 12, diaSemana: 0 })).toBe('tiver um turno de mais de 12 horas');
    expect(fraseDaSituacao('DIA_DA_SEMANA', { valor: 0, diaSemana: 0 })).toBe('trabalhar no domingo');
    expect(fraseDaSituacao('DIA_DA_SEMANA', { valor: 0, diaSemana: 2 })).toBe('trabalhar na terça-feira');
    expect(nomeSugerido('POUCO_DESCANSO', { valor: 12, diaSemana: 0 })).toBe('Descanso de 12 horas entre turnos');
    expect(plural(1, 'hora')).toBe('1 hora');
  });

  it('o resumo do último passo é uma frase só, sem jargão', () => {
    const estado = { ...estadoInicialDaSituacao('DIAS_SEGUIDOS'), gravidade: 'CRITICO' as const, bloqueiaPublicacao: true };
    expect(resumoDoAssistente(estado)).toBe('Vou mostrar um alerta grave para a liderança quando alguém trabalhar mais de 5 dias seguidos, em todas as equipes, e não vou deixar publicar a escala enquanto isso não for corrigido.');
    expect(resumoDoAssistente({ ...estadoInicialDaSituacao('TURNO_LONGO'), alcance: { tipo: 'EQUIPE', ids: ['A'] } }, ['NOC'])).toContain('na equipe NOC');
  });

  it('ida e volta: o que o passo a passo monta, ele lê de novo igual (inclusive texto e nome personalizados)', () => {
    for (const chave of todas) {
      const base = estadoInicialDaSituacao(chave);
      const estado = { ...base, parametros: { valor: base.parametros.valor + 1, diaSemana: 3 }, gravidade: 'CRITICO' as const, bloqueiaPublicacao: true, nome: 'Minha regra', mensagem: '{pessoa} passou do limite', sugestao: 'Converse com {pessoa}.', alcance: { tipo: 'EQUIPE' as const, ids: ['EQ_A'] } };
      const lido = lerEstadoDaRegra(montarRegraDoAssistente(estado, 'regra-x'));
      expect(lido).toEqual(chave === 'DIA_DA_SEMANA' ? { ...estado, parametros: { valor: 0, diaSemana: 3 } } : { ...estado, parametros: { valor: estado.parametros.valor, diaSemana: 0 } });
    }
    // textos padrão voltam como "não personalizados" (null)
    const padrao = lerEstadoDaRegra(montarRegraDoAssistente(estadoInicialDaSituacao('TURNO_LONGO'), 'regra-x'));
    expect(padrao).toMatchObject({ mensagem: null, sugestao: null });
  });

  it('as regras legais de dias seguidos e de descanso entre turnos cabem no passo a passo; a do descanso após folga não', () => {
    expect(lerEstadoDaRegra(REGRAS_PADRAO[0]!)).toMatchObject({ situacao: 'DIAS_SEGUIDOS', parametros: { valor: 6 } });
    expect(lerEstadoDaRegra(REGRAS_PADRAO[1]!)).toMatchObject({ situacao: 'POUCO_DESCANSO', parametros: { valor: 11 } });
    expect(lerEstadoDaRegra(REGRAS_PADRAO[2]!)).toBeNull();
  });

  it('regra de desenho livre (modo avançado) não é lida pelo passo a passo', () => {
    const livre = montarRegraDoAssistente(estadoInicialDaSituacao('TURNO_LONGO'), 'regra-x');
    livre.quando.condicoes.push({ variavel: 'diaDaSemana', op: '==', valor: 1 });
    expect(lerEstadoDaRegra(livre)).toBeNull();
    expect(lerEstadoDaRegra({ ...livre, quando: { logica: 'OU', condicoes: [livre.quando.condicoes[0]!] } })).toBeNull();
  });

  it('cada situação dispara nos casos certos (mesmo motor da escala)', () => {
    const regra = (chave: SituacaoChave, valor: number, diaSemana = 0) => montarRegraDoAssistente({ ...estadoInicialDaSituacao(chave), parametros: { valor, diaSemana } }, 'regra-x');
    expect(testarRegra(regra('DIAS_SEGUIDOS', 5), [escala(['M', 'M', 'M', 'M', 'M', 'M'])], CATALOGO_SOC).total).toBe(1);
    expect(testarRegra(regra('DIAS_SEGUIDOS', 5), [escala(['M', 'M', 'M', 'M', 'M', 'DF'])], CATALOGO_SOC).total).toBe(0);
    expect(testarRegra(regra('POUCO_DESCANSO', 12), [escala(['N', 'M'])], CATALOGO_SOC).total).toBe(1);
    expect(testarRegra(regra('POUCO_DESCANSO', 12), [escala(['N', 'DF', 'M'])], CATALOGO_SOC).total).toBe(0);
    const longo = escala(['T']);
    longo.dias['2026-08-03'] = dia('T', { i: '06:00', f: '20:00', vd: false, m: 840 });
    expect(testarRegra(regra('TURNO_LONGO', 12), [longo], CATALOGO_SOC).total).toBe(1);
    // 01/08 é sábado, 02/08 domingo
    expect(testarRegra(regra('DIA_DA_SEMANA', 0, 0), [escala(['M', 'M', 'M'], '2026-08-01')], CATALOGO_SOC).alertas.map((alerta) => alerta.data)).toEqual(['2026-08-02']);
    expect(testarRegra(regra('DIA_DA_SEMANA', 0, 6), [escala(['M', 'M', 'M'], '2026-08-01')], CATALOGO_SOC).alertas.map((alerta) => alerta.data)).toEqual(['2026-08-01']);
  });

  it('a situação tem número para ajustar, com limites e unidade (só o dia da semana não tem)', () => {
    expect(definicaoDaSituacao('DIAS_SEGUIDOS').numero).toMatchObject({ padrao: 5, unidade: 'dia' });
    expect(definicaoDaSituacao('POUCO_DESCANSO').numero).toMatchObject({ padrao: 12, unidade: 'hora' });
    expect(definicaoDaSituacao('DIA_DA_SEMANA').numero).toBeUndefined();
  });
});
