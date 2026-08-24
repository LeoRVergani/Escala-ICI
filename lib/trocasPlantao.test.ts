import { describe, expect, it } from 'vitest';

import {
  destinatariosNotificacaoGestorPlantao,
  plantoesFuturosDeOutrosParticipantes,
  plantoesFuturosDoPlantonista,
  statusTrocaPlantaoEhAtivo,
  transicaoTrocaPlantaoPermitida,
  trocaPlantaoDesatualizada,
  validarNovaSolicitacaoTrocaPlantao,
  type ContextoValidacaoNovaTrocaPlantao,
  type PlantaoParaTroca,
  type SolicitacaoTrocaPlantao,
} from './trocasPlantao';

function plantao(ajustes: Partial<PlantaoParaTroca> = {}): PlantaoParaTroca {
  return {
    atribuicaoId: '0001',
    grupoId: 'PLANTAO_COSI',
    competenciaId: 'PLANTAO_COSI_2026-08',
    plantonistaLogin: 'ana',
    inicio: '2026-08-20T19:00:00.000Z',
    fim: '2026-08-21T07:00:00.000Z',
    duracaoMinutos: 720,
    ...ajustes,
  };
}

function contexto(ajustes: Partial<ContextoValidacaoNovaTrocaPlantao> = {}): ContextoValidacaoNovaTrocaPlantao {
  return {
    agoraIso: '2026-08-15T00:00:00.000Z',
    grupoId: 'PLANTAO_COSI',
    competencia: '2026-08',
    solicitanteLogin: 'ana',
    destinatarioLogin: 'bruno',
    solicitanteAtivo: true,
    destinatarioAtivo: true,
    plantaoSolicitante: plantao({ atribuicaoId: '0001', plantonistaLogin: 'ana' }),
    plantaoDestinatario: plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: '2026-08-22T19:00:00.000Z', fim: '2026-08-23T07:00:00.000Z' }),
    trocasExistentes: [],
    ...ajustes,
  };
}

describe('transicaoTrocaPlantaoPermitida', () => {
  it('permite as transições reais do fluxo A -> B -> gestor', () => {
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_USUARIO', 'PENDENTE_GESTOR')).toBe(true);
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_USUARIO', 'RECUSADA_USUARIO')).toBe(true);
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_USUARIO', 'CANCELADA')).toBe(true);
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_GESTOR', 'RECUSADA_GESTOR')).toBe(true);
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_GESTOR', 'APROVADA')).toBe(true);
  });

  it('recusa transições fora da tabela', () => {
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_USUARIO', 'APROVADA')).toBe(false);
    expect(transicaoTrocaPlantaoPermitida('PENDENTE_GESTOR', 'PENDENTE_USUARIO')).toBe(false);
  });

  it('trata todo status terminal como sem transições de saída', () => {
    for (const status of ['RECUSADA_USUARIO', 'CANCELADA', 'RECUSADA_GESTOR', 'APROVADA'] as const) {
      expect(transicaoTrocaPlantaoPermitida(status, 'PENDENTE_GESTOR')).toBe(false);
    }
  });
});

describe('statusTrocaPlantaoEhAtivo', () => {
  it('considera ativos só PENDENTE_USUARIO e PENDENTE_GESTOR', () => {
    expect(statusTrocaPlantaoEhAtivo('PENDENTE_USUARIO')).toBe(true);
    expect(statusTrocaPlantaoEhAtivo('PENDENTE_GESTOR')).toBe(true);
    expect(statusTrocaPlantaoEhAtivo('APROVADA')).toBe(false);
    expect(statusTrocaPlantaoEhAtivo('CANCELADA')).toBe(false);
  });
});

describe('plantoesFuturosDoPlantonista', () => {
  const atribuicoes = [
    plantao({ atribuicaoId: '0001', plantonistaLogin: 'ana', inicio: '2026-08-10T19:00:00.000Z', fim: '2026-08-11T07:00:00.000Z' }),
    plantao({ atribuicaoId: '0002', plantonistaLogin: 'ana', inicio: '2026-08-25T19:00:00.000Z', fim: '2026-08-26T07:00:00.000Z' }),
    plantao({ atribuicaoId: '0003', plantonistaLogin: 'ana', inicio: '2026-08-20T19:00:00.000Z', fim: '2026-08-21T07:00:00.000Z' }),
    plantao({ atribuicaoId: '0004', plantonistaLogin: 'bruno', inicio: '2026-08-27T19:00:00.000Z', fim: '2026-08-28T07:00:00.000Z' }),
  ];

  it('devolve só os plantões futuros do próprio login, em ordem cronológica', () => {
    const resultado = plantoesFuturosDoPlantonista(atribuicoes, 'ana', '2026-08-15T00:00:00.000Z');
    expect(resultado.map((a) => a.atribuicaoId)).toEqual(['0003', '0002']);
  });

  it('ignora um plantão em andamento (início <= agora)', () => {
    const resultado = plantoesFuturosDoPlantonista(atribuicoes, 'ana', '2026-08-20T19:00:00.000Z');
    expect(resultado.map((a) => a.atribuicaoId)).toEqual(['0002']);
  });

  it('devolve vazio quando o login não tem plantão futuro', () => {
    expect(plantoesFuturosDoPlantonista(atribuicoes, 'carla', '2026-08-01T00:00:00.000Z')).toEqual([]);
  });
});

describe('plantoesFuturosDeOutrosParticipantes', () => {
  const atribuicoes = [
    plantao({ atribuicaoId: '0001', plantonistaLogin: 'ana', inicio: '2026-08-20T19:00:00.000Z', fim: '2026-08-21T07:00:00.000Z' }),
    plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: '2026-08-22T19:00:00.000Z', fim: '2026-08-23T07:00:00.000Z' }),
    plantao({ atribuicaoId: '0003', plantonistaLogin: 'carla', inicio: '2026-08-23T19:00:00.000Z', fim: '2026-08-24T07:00:00.000Z' }),
    plantao({ atribuicaoId: '0004', plantonistaLogin: 'bruno', inicio: '2026-08-10T19:00:00.000Z', fim: '2026-08-11T07:00:00.000Z' }),
  ];

  it('exclui o próprio login e participantes inativos', () => {
    const resultado = plantoesFuturosDeOutrosParticipantes(atribuicoes, 'ana', ['bruno'], '2026-08-15T00:00:00.000Z');
    expect(resultado.map((a) => a.atribuicaoId)).toEqual(['0002']);
  });

  it('ignora plantões que já começaram', () => {
    const resultado = plantoesFuturosDeOutrosParticipantes(atribuicoes, 'ana', ['bruno'], '2026-08-15T00:00:00.000Z');
    expect(resultado.some((a) => a.atribuicaoId === '0004')).toBe(false);
  });

  it('devolve vazio quando não há participantes ativos além de mim', () => {
    expect(plantoesFuturosDeOutrosParticipantes(atribuicoes, 'ana', [], '2026-08-15T00:00:00.000Z')).toEqual([]);
  });
});

describe('validarNovaSolicitacaoTrocaPlantao', () => {
  it('aceita uma solicitação coerente', () => {
    expect(validarNovaSolicitacaoTrocaPlantao(contexto())).toEqual([]);
  });

  it('recusa quando não há plantão do solicitante escolhido', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(contexto({ plantaoSolicitante: undefined }));
    expect(erros).toContain('Escolha um dos seus plantões futuros.');
  });

  it('recusa quando o plantão "meu" não pertence ao solicitante', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({ plantaoSolicitante: plantao({ atribuicaoId: '0009', plantonistaLogin: 'outra-pessoa' }) }),
    );
    expect(erros).toContain('Este plantão não é seu.');
  });

  it('recusa quando não há plantão do destinatário escolhido', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(contexto({ plantaoDestinatario: undefined }));
    expect(erros).toContain('Escolha o plantão do colega.');
  });

  it('recusa quando o plantão do colega não pertence ao destinatário informado', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({ plantaoDestinatario: plantao({ atribuicaoId: '0009', plantonistaLogin: 'outra-pessoa' }) }),
    );
    expect(erros).toContain('Este plantão não é do colega escolhido.');
  });

  it('recusa quando os dois plantões não são do mesmo grupo', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({ plantaoDestinatario: plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', grupoId: 'PLANTAO_NOC' }) }),
    );
    expect(erros).toContain('Os dois plantões precisam ser do mesmo Grupo de Plantão.');
  });

  it('recusa plantão que já começou (solicitante)', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({ plantaoSolicitante: plantao({ atribuicaoId: '0001', plantonistaLogin: 'ana', inicio: '2026-08-10T00:00:00.000Z' }) }),
    );
    expect(erros).toContain('Só é possível trocar plantões que ainda não começaram.');
  });

  it('recusa plantão que já começou (destinatário)', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({ plantaoDestinatario: plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: '2026-08-01T00:00:00.000Z' }) }),
    );
    expect(erros).toContain('Só é possível trocar plantões que ainda não começaram.');
  });

  it('recusa destinatário igual ao solicitante', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(contexto({ destinatarioLogin: 'ana' }));
    expect(erros).toContain('Escolha outro participante para a troca.');
  });

  it('recusa destinatário vazio', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(contexto({ destinatarioLogin: '' }));
    expect(erros).toContain('Escolha o colega que receberá a solicitação.');
  });

  it('recusa os dois mesmos plantões (atribuicaoId igual)', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({ plantaoDestinatario: plantao({ atribuicaoId: '0001', plantonistaLogin: 'bruno' }) }),
    );
    expect(erros).toContain('Escolha dois plantões diferentes.');
  });

  it('recusa solicitante inativo', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(contexto({ solicitanteAtivo: false }));
    expect(erros).toContain('Você precisa ser participante ativo do Grupo de Plantão.');
  });

  it('recusa destinatário inativo', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(contexto({ destinatarioAtivo: false }));
    expect(erros).toContain('O colega precisa ser participante ativo do Grupo de Plantão.');
  });

  it('recusa quando já existe troca ativa envolvendo um dos dois plantões', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({
        trocasExistentes: [{ status: 'PENDENTE_GESTOR', plantaoSolicitanteId: '0001', plantaoDestinatarioId: '0099' }],
      }),
    );
    expect(erros).toContain('Já existe uma solicitação em andamento para um desses plantões.');
  });

  it('ignora troca existente que já está em status terminal', () => {
    const erros = validarNovaSolicitacaoTrocaPlantao(
      contexto({
        trocasExistentes: [{ status: 'RECUSADA_GESTOR', plantaoSolicitanteId: '0001', plantaoDestinatarioId: '0099' }],
      }),
    );
    expect(erros).toEqual([]);
  });
});

describe('trocaPlantaoDesatualizada', () => {
  const troca: Pick<
    SolicitacaoTrocaPlantao,
    'plantaoSolicitanteId' | 'plantaoDestinatarioId' | 'solicitanteLogin' | 'destinatarioLogin' | 'inicioSolicitante' | 'fimSolicitante' | 'inicioDestinatario' | 'fimDestinatario'
  > = {
    plantaoSolicitanteId: '0001',
    plantaoDestinatarioId: '0002',
    solicitanteLogin: 'ana',
    destinatarioLogin: 'bruno',
    inicioSolicitante: '2026-08-20T19:00:00.000Z',
    fimSolicitante: '2026-08-21T07:00:00.000Z',
    inicioDestinatario: '2026-08-22T19:00:00.000Z',
    fimDestinatario: '2026-08-23T07:00:00.000Z',
  };

  it('falso quando nada mudou', () => {
    const solicitanteAtual = plantao({ atribuicaoId: '0001', plantonistaLogin: 'ana', inicio: troca.inicioSolicitante, fim: troca.fimSolicitante });
    const destinatarioAtual = plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: troca.inicioDestinatario, fim: troca.fimDestinatario });
    expect(trocaPlantaoDesatualizada(troca, solicitanteAtual, destinatarioAtual)).toBe(false);
  });

  it('verdadeiro quando a atribuição sumiu', () => {
    const destinatarioAtual = plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: troca.inicioDestinatario, fim: troca.fimDestinatario });
    expect(trocaPlantaoDesatualizada(troca, undefined, destinatarioAtual)).toBe(true);
  });

  it('verdadeiro quando o dono do plantão mudou', () => {
    const solicitanteAtual = plantao({ atribuicaoId: '0001', plantonistaLogin: 'outra-pessoa', inicio: troca.inicioSolicitante, fim: troca.fimSolicitante });
    const destinatarioAtual = plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: troca.inicioDestinatario, fim: troca.fimDestinatario });
    expect(trocaPlantaoDesatualizada(troca, solicitanteAtual, destinatarioAtual)).toBe(true);
  });

  it('verdadeiro quando o horário mudou', () => {
    const solicitanteAtual = plantao({ atribuicaoId: '0001', plantonistaLogin: 'ana', inicio: '2026-08-20T20:00:00.000Z', fim: troca.fimSolicitante });
    const destinatarioAtual = plantao({ atribuicaoId: '0002', plantonistaLogin: 'bruno', inicio: troca.inicioDestinatario, fim: troca.fimDestinatario });
    expect(trocaPlantaoDesatualizada(troca, solicitanteAtual, destinatarioAtual)).toBe(true);
  });
});

describe('destinatariosNotificacaoGestorPlantao', () => {
  it('devolve vazio quando não há escopo', () => {
    expect(destinatariosNotificacaoGestorPlantao(null, [])).toEqual([]);
  });

  it('devolve vazio quando o escopo está inativo', () => {
    expect(destinatariosNotificacaoGestorPlantao({ ativo: false, responsaveisLogin: ['gestor1'] }, [])).toEqual([]);
  });

  it('devolve os responsáveis quando o escopo está ativo', () => {
    expect(destinatariosNotificacaoGestorPlantao({ ativo: true, responsaveisLogin: ['gestor1', 'gestor2'] }, [])).toEqual(['gestor1', 'gestor2']);
  });

  it('exclui logins informados (ex.: quando o gestor é uma das partes da troca)', () => {
    expect(
      destinatariosNotificacaoGestorPlantao({ ativo: true, responsaveisLogin: ['gestor1', 'ana'] }, ['ana', 'bruno']),
    ).toEqual(['gestor1']);
  });

  it('devolve vazio quando a lista de responsáveis está vazia', () => {
    expect(destinatariosNotificacaoGestorPlantao({ ativo: true, responsaveisLogin: [] }, [])).toEqual([]);
  });
});
