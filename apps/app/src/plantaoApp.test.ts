import type { AtribuicaoPlantaoPersistida, ParticipantePlantao } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import type { Usuario } from '@/lib/modelos';
import {
  contatosAtivosDoPlantonista,
  horarioPlantaoParaExibicao,
  inicialPlantonista,
  nomeExibicaoPlantonista,
  proximosPlantoesDoUsuario,
  resolverPlantaoAgora,
  rotuloHorarioPlantaoExibicao,
} from './plantaoApp';

function atribuicao(overrides: Partial<AtribuicaoPlantaoPersistida> = {}): AtribuicaoPlantaoPersistida {
  return {
    atribuicaoId: '0001',
    grupoId: 'PLANTAO_GEDSI_COSI',
    competenciaId: 'PLANTAO_GEDSI_COSI_2026-08',
    plantonistaLogin: 'clis',
    inicio: '2026-08-10T22:00:00.000Z',
    fim: '2026-08-11T10:00:00.000Z',
    duracaoMinutos: 720,
    papel: 'PRIMARIO',
    origem: 'IMPORTADO',
    revisao: 1,
    schemaVersion: 1,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function participante(overrides: Partial<ParticipantePlantao> = {}): ParticipantePlantao {
  return {
    grupoId: 'PLANTAO_GEDSI_COSI',
    login: 'clis',
    ativo: true,
    contatos: [],
    schemaVersion: 1,
    criadoPorLogin: 'admin',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    login: 'clis',
    nome: 'Claudio Lis',
    email: 'clis@ici.tec.br',
    cargo: 'Coordenador de Segurança da Informação',
    equipeId: 'GEDSI_COSI_SOC',
    gestorUid: null,
    nivelHierarquico: 3,
    turnoPadrao: 'M',
    ativo: true,
    ...overrides,
  };
}

describe('resolverPlantaoAgora', () => {
  it('encontra a atribuição que contém "agora" no intervalo [inicio, fim)', () => {
    const a = atribuicao({ atribuicaoId: '0001', inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' });
    const b = atribuicao({ atribuicaoId: '0002', inicio: '2026-08-11T10:00:00.000Z', fim: '2026-08-11T22:00:00.000Z' });
    const resumo = resolverPlantaoAgora([a, b], '2026-08-11T05:00:00.000Z');
    expect(resumo.atual?.atribuicaoId).toBe('0001');
    expect(resumo.proximo?.atribuicaoId).toBe('0002');
  });

  it('exatamente no início conta como atual (inclusive); exatamente no fim já é o próximo (exclusivo)', () => {
    const a = atribuicao({ atribuicaoId: '0001', inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' });
    const b = atribuicao({ atribuicaoId: '0002', inicio: '2026-08-11T10:00:00.000Z', fim: '2026-08-11T22:00:00.000Z' });
    expect(resolverPlantaoAgora([a, b], '2026-08-10T22:00:00.000Z').atual?.atribuicaoId).toBe('0001');
    expect(resolverPlantaoAgora([a, b], '2026-08-11T10:00:00.000Z').atual?.atribuicaoId).toBe('0002');
  });

  it('ninguém de plantão agora, mas existe um próximo', () => {
    const futura = atribuicao({ inicio: '2026-08-15T22:00:00.000Z', fim: '2026-08-16T10:00:00.000Z' });
    const resumo = resolverPlantaoAgora([futura], '2026-08-10T00:00:00.000Z');
    expect(resumo.atual).toBeNull();
    expect(resumo.proximo?.atribuicaoId).toBe(futura.atribuicaoId);
  });

  it('lista vazia -> atual e próximo nulos, nunca lança', () => {
    const resumo = resolverPlantaoAgora([], '2026-08-10T00:00:00.000Z');
    expect(resumo).toEqual({ atual: null, proximo: null });
  });

  it('nunca escolhe um "próximo" que já passou — só o que vem depois de agora', () => {
    const passada = atribuicao({ atribuicaoId: 'passada', inicio: '2026-08-01T00:00:00.000Z', fim: '2026-08-01T12:00:00.000Z' });
    const resumo = resolverPlantaoAgora([passada], '2026-08-10T00:00:00.000Z');
    expect(resumo.proximo).toBeNull();
  });
});

describe('nomeExibicaoPlantonista', () => {
  it('resolve pelo login na lista de usuários', () => {
    expect(nomeExibicaoPlantonista('clis', [usuario()])).toBe('Claudio Lis');
  });

  it('cai no próprio login quando o usuário não é encontrado — nunca lança, nunca mostra "undefined"', () => {
    expect(nomeExibicaoPlantonista('login.desconhecido', [usuario()])).toBe('login.desconhecido');
  });
});

describe('inicialPlantonista', () => {
  it('duas iniciais, maiúsculas', () => {
    expect(inicialPlantonista('Claudio Lis')).toBe('CL');
  });

  it('nome de uma palavra só -> uma inicial', () => {
    expect(inicialPlantonista('Madonna')).toBe('M');
  });
});

describe('contatosAtivosDoPlantonista', () => {
  it('retorna só os contatos ativo:true do participante', () => {
    const participantes = [participante({
      contatos: [
        { rotulo: 'Celular', numero: '11999990000', ativo: true },
        { rotulo: 'Ramal antigo', numero: '1234', ativo: false },
      ],
    })];
    expect(contatosAtivosDoPlantonista('clis', participantes)).toEqual([
      { rotulo: 'Celular', numero: '11999990000', ativo: true },
    ]);
  });

  it('login sem participante cadastrado -> lista vazia, nunca lança', () => {
    expect(contatosAtivosDoPlantonista('ninguem', [])).toEqual([]);
  });
});

describe('proximosPlantoesDoUsuario', () => {
  it('filtra só o login pedido, ordena por início, respeita o limite', () => {
    const minhas = [
      atribuicao({ atribuicaoId: 'a', plantonistaLogin: 'clis', inicio: '2026-08-20T00:00:00.000Z', fim: '2026-08-20T12:00:00.000Z' }),
      atribuicao({ atribuicaoId: 'b', plantonistaLogin: 'clis', inicio: '2026-08-15T00:00:00.000Z', fim: '2026-08-15T12:00:00.000Z' }),
    ];
    const deOutraPessoa = atribuicao({ atribuicaoId: 'c', plantonistaLogin: 'jean', inicio: '2026-08-16T00:00:00.000Z', fim: '2026-08-16T12:00:00.000Z' });
    const resultado = proximosPlantoesDoUsuario('clis', [...minhas, deOutraPessoa], '2026-08-01T00:00:00.000Z', 5);
    expect(resultado.map((item) => item.atribuicaoId)).toEqual(['b', 'a']);
  });

  it('nunca inclui um plantão já encerrado (fim <= agora)', () => {
    const encerrado = atribuicao({ plantonistaLogin: 'clis', inicio: '2026-08-01T00:00:00.000Z', fim: '2026-08-01T12:00:00.000Z' });
    expect(proximosPlantoesDoUsuario('clis', [encerrado], '2026-08-10T00:00:00.000Z', 5)).toEqual([]);
  });

  it('respeita o limite mesmo com muitos plantões futuros', () => {
    const varios = Array.from({ length: 5 }, (_, indice) =>
      atribuicao({ atribuicaoId: `id-${indice}`, plantonistaLogin: 'clis', inicio: `2026-08-${10 + indice}T00:00:00.000Z`, fim: `2026-08-${10 + indice}T12:00:00.000Z` }));
    expect(proximosPlantoesDoUsuario('clis', varios, '2026-08-01T00:00:00.000Z', 2)).toHaveLength(2);
  });
});

describe('horarioPlantaoParaExibicao / rotuloHorarioPlantaoExibicao', () => {
  it('plantão dentro do mesmo dia civil (timezone do Grupo) não cruza dia seguinte', () => {
    const horario = horarioPlantaoParaExibicao(
      { inicio: '2026-08-11T13:00:00.000Z', fim: '2026-08-11T19:00:00.000Z' },
      'America/Sao_Paulo',
    );
    expect(horario.cruzaDiaSeguinte).toBe(false);
    expect(rotuloHorarioPlantaoExibicao(horario)).toBe(`${horario.horaInicio}–${horario.horaFim}`);
  });

  it('plantão noturno que cruza a meia-noite civil marca cruzaDiaSeguinte e o rótulo mostra "(+1 dia)"', () => {
    const horario = horarioPlantaoParaExibicao(
      { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' },
      'America/Sao_Paulo',
    );
    expect(horario.cruzaDiaSeguinte).toBe(true);
    expect(rotuloHorarioPlantaoExibicao(horario)).toContain('(+1 dia)');
  });
});
