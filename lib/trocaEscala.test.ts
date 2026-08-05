import type { TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import type { NovaSolicitacaoTroca, Usuario } from './modelos';
import {
  COLECAO_SOLICITACOES_TROCA,
  atorDaTransicao,
  diaParaSolicitacao,
  montarSolicitacaoTroca,
  solicitacaoDesatualizada,
  transicaoPermitida,
  transicaoPermitidaNoApp,
  validarElegibilidadeTroca,
  validarSolicitacaoTroca,
} from './trocaEscala';

const CONTEXTO = { usuarioUid: 'UID_ANA', equipeId: 'EQ_SOC' };

function entrada(
  ajustes: Partial<NovaSolicitacaoTroca> = {},
): NovaSolicitacaoTroca {
  return {
    equipeId: 'EQ_SOC',
    competencia: '2026-08',
    revisaoBase: 3,
    solicitanteUid: 'UID_ANA',
    solicitanteLogin: 'ana',
    destinatarioUid: 'UID_BRUNO',
    destinatarioLogin: 'bruno',
    diaSolicitante: { data: '2026-08-10', codigo: 'MD', horario: '23:00–07:00' },
    diaDestinatario: { data: '2026-08-11', codigo: 'T', horario: '15:00–23:00' },
    motivo: 'Consulta médica agendada.',
    ...ajustes,
  };
}

describe('coleção da troca de escala', () => {
  it('mantém o nome que o App poderá escrever no futuro', () => {
    expect(COLECAO_SOLICITACOES_TROCA).toBe('solicitacoesTroca');
  });
});

describe('validação da solicitação criada pelo App', () => {
  it('aceita uma solicitação coerente', () => {
    expect(validarSolicitacaoTroca(entrada(), CONTEXTO)).toEqual([]);
  });

  it('recusa solicitação em nome de outro colaborador', () => {
    const erros = validarSolicitacaoTroca(
      entrada({ solicitanteUid: 'UID_OUTRO' }),
      CONTEXTO,
    );
    expect(erros).toContain('A solicitação só pode ser criada em nome do próprio colaborador.');
  });

  it('recusa troca fora da própria equipe', () => {
    const erros = validarSolicitacaoTroca(
      entrada({ equipeId: 'EQ_OUTRA' }),
      CONTEXTO,
    );
    expect(erros).toContain('A troca só pode ocorrer dentro da própria equipe.');
  });

  it('recusa troca consigo mesmo', () => {
    const erros = validarSolicitacaoTroca(
      entrada({ destinatarioUid: 'UID_ANA' }),
      CONTEXTO,
    );
    expect(erros).toContain('Escolha outro colaborador para a troca.');
  });

  it('exige motivo e revisão vigente', () => {
    const erros = validarSolicitacaoTroca(
      entrada({ motivo: '   ', revisaoBase: 0 }),
      CONTEXTO,
    );
    expect(erros).toContain('Descreva o motivo da troca.');
    expect(erros).toContain('A solicitação precisa apontar a revisão vigente da escala.');
  });

  it('recusa motivo acima do limite', () => {
    const erros = validarSolicitacaoTroca(
      entrada({ motivo: 'x'.repeat(281) }),
      CONTEXTO,
    );
    expect(erros).toContain('O motivo deve ter no máximo 280 caracteres.');
  });
});

describe('documento montado pelo App', () => {
  it('nasce pendente, sem decisão de gestor', () => {
    const solicitacao = montarSolicitacaoTroca(
      entrada({ motivo: '  Consulta médica.  ' }),
      'SOL_1',
      '2026-08-04T12:00:00.000Z',
    );

    expect(solicitacao).toMatchObject({
      id: 'SOL_1',
      status: 'PENDENTE',
      motivo: 'Consulta médica.',
      criadoEm: '2026-08-04T12:00:00.000Z',
      atualizadoEm: '2026-08-04T12:00:00.000Z',
      decididoPor: null,
      decididoEm: null,
      observacaoGestor: null,
      aplicadoNaRevisao: null,
    });
  });
});

describe('transições de status', () => {
  it('só permite decisão e aplicação a partir dos estados corretos', () => {
    expect(transicaoPermitida('PENDENTE', 'APROVADA')).toBe(true);
    expect(transicaoPermitida('APROVADA', 'APLICADA')).toBe(true);
    expect(transicaoPermitida('PENDENTE', 'APLICADA')).toBe(false);
    expect(transicaoPermitida('APLICADA', 'PENDENTE')).toBe(false);
    expect(transicaoPermitida('CANCELADA', 'APROVADA')).toBe(false);
  });

  it('atribui aprovação, recusa e aplicação ao gestor', () => {
    expect(atorDaTransicao('APROVADA')).toBe('GESTOR');
    expect(atorDaTransicao('RECUSADA')).toBe('GESTOR');
    expect(atorDaTransicao('APLICADA')).toBe('GESTOR');
    expect(atorDaTransicao('CANCELADA')).toBe('COLABORADOR');
  });

  it('permite ao App apenas cancelar a própria solicitação', () => {
    expect(transicaoPermitidaNoApp('PENDENTE', 'CANCELADA')).toBe(true);
    expect(transicaoPermitidaNoApp('PENDENTE', 'APROVADA')).toBe(false);
    expect(transicaoPermitidaNoApp('APROVADA', 'APLICADA')).toBe(false);
  });
});

describe('fotografia do dia e revisão base', () => {
  const escala = {
    dias: {
      '2026-08-10': { c: 'MD', i: '23:00', f: '07:00' },
      '2026-08-12': { c: 'DF' },
    },
  } as unknown as TurnosMes;

  it('copia código e horário do dia escolhido', () => {
    expect(diaParaSolicitacao(escala, '2026-08-10')).toEqual({
      data: '2026-08-10',
      codigo: 'MD',
      horario: '23:00–07:00',
    });
  });

  it('mantém horário nulo em dias sem jornada', () => {
    expect(diaParaSolicitacao(escala, '2026-08-12')).toEqual({
      data: '2026-08-12',
      codigo: 'DF',
      horario: null,
    });
    expect(diaParaSolicitacao(null, '2026-08-13')).toEqual({
      data: '2026-08-13',
      codigo: null,
      horario: null,
    });
  });

  it('marca como desatualizada a solicitação pendente de revisão antiga', () => {
    expect(solicitacaoDesatualizada({ revisaoBase: 3, status: 'PENDENTE' }, 4)).toBe(true);
    expect(solicitacaoDesatualizada({ revisaoBase: 3, status: 'PENDENTE' }, 3)).toBe(false);
    expect(solicitacaoDesatualizada({ revisaoBase: 3, status: 'APLICADA' }, 9)).toBe(false);
  });
});

describe('elegibilidade dos participantes da troca', () => {
  function usuario(ajustes: Partial<Usuario> = {}): Usuario {
    return {
      uid: 'uid-ana',
      login: 'ana',
      nome: 'Ana',
      email: 'ana@empresa.com',
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_SOC',
      gestorUid: null,
      nivelHierarquico: 6,
      turnoPadrao: 'MD',
      ativo: true,
      ...ajustes,
    };
  }

  function escala(ajustes: Partial<TurnosMes> = {}): Pick<TurnosMes, 'status' | 'competencia'> {
    return { status: 'PUBLICADA', competencia: '2026-08', ...ajustes };
  }

  it('aceita quando ambos ativos, mesma equipe, mesma competência e escala publicada', () => {
    expect(validarElegibilidadeTroca({
      solicitante: usuario({ uid: 'uid-ana' }),
      destinatario: usuario({ uid: 'uid-bruno' }),
      escalaSolicitante: escala(),
      escalaDestinatario: escala(),
    })).toEqual([]);
  });

  it('recusa quando um dos dois está inativo', () => {
    const erros = validarElegibilidadeTroca({
      solicitante: usuario({ ativo: false }),
      destinatario: usuario({ uid: 'uid-bruno' }),
      escalaSolicitante: escala(),
      escalaDestinatario: escala(),
    });
    expect(erros).toContain('O solicitante precisa estar ativo.');
  });

  it('recusa equipes diferentes', () => {
    const erros = validarElegibilidadeTroca({
      solicitante: usuario({ equipeId: 'EQ_SOC' }),
      destinatario: usuario({ uid: 'uid-bruno', equipeId: 'EQ_OUTRA' }),
      escalaSolicitante: escala(),
      escalaDestinatario: escala(),
    });
    expect(erros).toContain('A troca só pode ocorrer dentro da mesma equipe.');
  });

  it('recusa quando alguma escala não está publicada (inclui rascunho, arquivada ou cancelada)', () => {
    const erros = validarElegibilidadeTroca({
      solicitante: usuario(),
      destinatario: usuario({ uid: 'uid-bruno' }),
      escalaSolicitante: escala({ status: 'RASCUNHO' }),
      escalaDestinatario: escala(),
    });
    expect(erros).toContain('A troca só pode envolver escala publicada.');
  });

  it('recusa competências diferentes', () => {
    const erros = validarElegibilidadeTroca({
      solicitante: usuario(),
      destinatario: usuario({ uid: 'uid-bruno' }),
      escalaSolicitante: escala({ competencia: '2026-08' }),
      escalaDestinatario: escala({ competencia: '2026-09' }),
    });
    expect(erros).toContain('A troca só pode ocorrer dentro da mesma competência.');
  });
});
