import { describe, expect, it } from 'vitest';

import type { NotificacaoTroca } from '@/lib/trocasEscala';
import type { NotificacaoTrocaPlantao, SolicitacaoTrocaPlantao } from '@/lib/trocasPlantao';

import {
  contarAbasTrocaPlantao,
  contarNaoLidas,
  filtrarTrocasPlantaoPorAba,
  mensagemVaziaAbaTrocaPlantao,
  mesclarNotificacoesTrocaApp,
} from './trocasApp';

function notificacaoJornada(overrides: Partial<NotificacaoTroca> = {}): NotificacaoTroca {
  return {
    id: 'notif-jornada-1',
    destinatarioLogin: 'ana',
    equipeId: 'EQ_SOC',
    tipo: 'TROCA_SOLICITADA',
    titulo: 'Nova troca',
    mensagem: 'Bruno pediu uma troca com você.',
    trocaId: 'troca-jornada-1',
    criadoPorLogin: 'bruno',
    criadoEm: '2026-08-10T10:00:00.000Z',
    lidaEm: null,
    acao: 'ABRIR_TROCA',
    ...overrides,
  };
}

function notificacaoPlantao(overrides: Partial<NotificacaoTrocaPlantao> = {}): NotificacaoTrocaPlantao {
  return {
    id: 'notif-plantao-1',
    destinatarioLogin: 'ana',
    grupoId: 'PLANTAO_COSI',
    tipo: 'TROCA_PLANTAO_SOLICITADA',
    titulo: 'Nova troca de plantão',
    mensagem: 'Bruno pediu uma troca de plantão com você.',
    trocaId: 'troca-plantao-1',
    criadoPorLogin: 'bruno',
    criadoEm: '2026-08-11T10:00:00.000Z',
    lidaEm: null,
    acao: 'ABRIR_TROCA_PLANTAO',
    ...overrides,
  };
}

function trocaPlantao(overrides: Partial<SolicitacaoTrocaPlantao> = {}): SolicitacaoTrocaPlantao {
  return {
    trocaId: 'troca-1',
    tipo: 'PLANTAO',
    grupoId: 'PLANTAO_COSI',
    competencia: '2026-08',
    solicitanteLogin: 'ana',
    solicitanteNome: 'Ana',
    destinatarioLogin: 'bruno',
    destinatarioNome: 'Bruno',
    plantaoSolicitanteId: '0001',
    plantaoDestinatarioId: '0002',
    inicioSolicitante: '2026-08-20T19:00:00.000Z',
    fimSolicitante: '2026-08-21T07:00:00.000Z',
    inicioDestinatario: '2026-08-22T19:00:00.000Z',
    fimDestinatario: '2026-08-23T07:00:00.000Z',
    status: 'PENDENTE_USUARIO',
    mensagemSolicitante: null,
    motivoRecusa: null,
    criadoEm: '2026-08-15T00:00:00.000Z',
    atualizadoEm: '2026-08-15T00:00:00.000Z',
    respondidoEm: null,
    decididoEm: null,
    criadoPorLogin: 'ana',
    gestorLogin: null,
    gestorNome: null,
    historico: [],
    schemaVersion: 1,
    ...overrides,
  };
}

describe('mesclarNotificacoesTrocaApp', () => {
  it('mescla os dois domínios num único feed, ordenado por criadoEm desc', () => {
    const jornada = [notificacaoJornada({ id: 'j1', criadoEm: '2026-08-10T10:00:00.000Z' })];
    const plantao = [notificacaoPlantao({ id: 'p1', criadoEm: '2026-08-11T10:00:00.000Z' })];
    const resultado = mesclarNotificacoesTrocaApp(jornada, plantao);
    expect(resultado.map((item) => item.id)).toEqual(['p1', 'j1']);
    expect(resultado[0].origem).toBe('PLANTAO');
    expect(resultado[1].origem).toBe('JORNADA');
  });

  it('lista vazia dos dois lados -> feed vazio', () => {
    expect(mesclarNotificacoesTrocaApp([], [])).toEqual([]);
  });
});

describe('contarNaoLidas', () => {
  it('conta só itens com lidaEm null', () => {
    const itens = mesclarNotificacoesTrocaApp(
      [notificacaoJornada({ id: 'j1', lidaEm: null }), notificacaoJornada({ id: 'j2', lidaEm: '2026-08-10T12:00:00.000Z' })],
      [notificacaoPlantao({ id: 'p1', lidaEm: null })],
    );
    expect(contarNaoLidas(itens)).toBe(2);
  });

  it('tudo lido -> zero', () => {
    const itens = mesclarNotificacoesTrocaApp(
      [notificacaoJornada({ lidaEm: '2026-08-10T12:00:00.000Z' })],
      [],
    );
    expect(contarNaoLidas(itens)).toBe(0);
  });
});

describe('contarAbasTrocaPlantao / filtrarTrocasPlantaoPorAba', () => {
  const trocas = [
    trocaPlantao({ trocaId: 'minha-pendente', solicitanteLogin: 'ana', destinatarioLogin: 'bruno', status: 'PENDENTE_USUARIO' }),
    trocaPlantao({ trocaId: 'para-responder', solicitanteLogin: 'carla', destinatarioLogin: 'ana', status: 'PENDENTE_USUARIO' }),
    trocaPlantao({ trocaId: 'aguardando-gestor', solicitanteLogin: 'ana', destinatarioLogin: 'bruno', status: 'PENDENTE_GESTOR' }),
    trocaPlantao({ trocaId: 'aprovada', solicitanteLogin: 'ana', destinatarioLogin: 'bruno', status: 'APROVADA' }),
    trocaPlantao({ trocaId: 'de-outra-pessoa', solicitanteLogin: 'carla', destinatarioLogin: 'daniel', status: 'PENDENTE_USUARIO' }),
  ];

  it('conta cada aba pelo papel do usuário logado', () => {
    expect(contarAbasTrocaPlantao(trocas, 'ana')).toEqual({
      minhas: 3, // minha-pendente, aguardando-gestor, aprovada (solicitanteLogin === ana)
      responder: 1, // para-responder
      gestor: 1, // aguardando-gestor
      historico: 1, // aprovada
    });
  });

  it('filtra "minhas" só pelo solicitante', () => {
    expect(filtrarTrocasPlantaoPorAba(trocas, 'ana', 'minhas').map((t) => t.trocaId)).toEqual([
      'minha-pendente', 'aguardando-gestor', 'aprovada',
    ]);
  });

  it('filtra "responder" só destinatário com status PENDENTE_USUARIO', () => {
    expect(filtrarTrocasPlantaoPorAba(trocas, 'ana', 'responder').map((t) => t.trocaId)).toEqual(['para-responder']);
  });

  it('filtra "gestor" por PENDENTE_GESTOR envolvendo o usuário', () => {
    expect(filtrarTrocasPlantaoPorAba(trocas, 'ana', 'gestor').map((t) => t.trocaId)).toEqual(['aguardando-gestor']);
  });

  it('filtra "historico" por status inativo envolvendo o usuário', () => {
    expect(filtrarTrocasPlantaoPorAba(trocas, 'ana', 'historico').map((t) => t.trocaId)).toEqual(['aprovada']);
  });

  it('nunca inclui trocas de terceiros sem relação com o usuário', () => {
    for (const aba of ['minhas', 'responder', 'gestor', 'historico'] as const) {
      expect(filtrarTrocasPlantaoPorAba(trocas, 'ana', aba).some((t) => t.trocaId === 'de-outra-pessoa')).toBe(false);
    }
  });
});

describe('mensagemVaziaAbaTrocaPlantao', () => {
  it('devolve uma mensagem não vazia para cada aba', () => {
    for (const aba of ['minhas', 'responder', 'gestor', 'historico'] as const) {
      expect(mensagemVaziaAbaTrocaPlantao(aba).length).toBeGreaterThan(0);
    }
  });
});
