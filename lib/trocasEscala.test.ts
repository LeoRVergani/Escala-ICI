import type { Dia } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import {
  aplicarTrocaNosDias,
  statusEhAtivo,
  transicaoPermitida,
  trocaDesatualizada,
  validarNovaSolicitacaoTroca,
  type ContextoValidacaoNovaTroca,
} from './trocasEscala';

function contexto(ajustes: Partial<ContextoValidacaoNovaTroca> = {}): ContextoValidacaoNovaTroca {
  return {
    solicitanteLogin: 'ana',
    destinatarioLogin: 'bruno',
    solicitanteAtivo: true,
    destinatarioAtivo: true,
    diaSolicitante: { c: 'M' },
    diaDestinatario: { c: 'T' },
    ...ajustes,
  };
}

describe('transicaoPermitida', () => {
  it('permite as transições reais do fluxo A -> B -> gestor', () => {
    expect(transicaoPermitida('PENDENTE_USUARIO', 'PENDENTE_GESTOR')).toBe(true);
    expect(transicaoPermitida('PENDENTE_USUARIO', 'RECUSADA_USUARIO')).toBe(true);
    expect(transicaoPermitida('PENDENTE_USUARIO', 'CANCELADA_SOLICITANTE')).toBe(true);
    expect(transicaoPermitida('PENDENTE_GESTOR', 'RECUSADA_GESTOR')).toBe(true);
    expect(transicaoPermitida('PENDENTE_GESTOR', 'APROVADA_PUBLICADA')).toBe(true);
  });

  it('recusa transições fora da tabela', () => {
    expect(transicaoPermitida('PENDENTE_USUARIO', 'APROVADA_PUBLICADA')).toBe(false);
    expect(transicaoPermitida('PENDENTE_GESTOR', 'PENDENTE_USUARIO')).toBe(false);
  });

  it('trata todo status terminal como sem transições de saída', () => {
    for (const status of ['RECUSADA_USUARIO', 'CANCELADA_SOLICITANTE', 'RECUSADA_GESTOR', 'APROVADA_PUBLICADA', 'EXPIRADA'] as const) {
      expect(transicaoPermitida(status, 'PENDENTE_GESTOR')).toBe(false);
    }
  });
});

describe('statusEhAtivo', () => {
  it('considera ativos só PENDENTE_USUARIO e PENDENTE_GESTOR', () => {
    expect(statusEhAtivo('PENDENTE_USUARIO')).toBe(true);
    expect(statusEhAtivo('PENDENTE_GESTOR')).toBe(true);
    expect(statusEhAtivo('APROVADA_PUBLICADA')).toBe(false);
    expect(statusEhAtivo('EXPIRADA')).toBe(false);
  });
});

describe('validarNovaSolicitacaoTroca', () => {
  it('aceita uma solicitação coerente', () => {
    expect(validarNovaSolicitacaoTroca(contexto())).toEqual([]);
  });

  it('recusa destinatário igual ao solicitante', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ destinatarioLogin: 'ana' }));
    expect(erros).toContain('Escolha outro colaborador para a troca.');
  });

  it('recusa destinatário vazio', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ destinatarioLogin: '' }));
    expect(erros).toContain('Informe o colaborador que receberá a solicitação.');
  });

  it('recusa solicitante inativo', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ solicitanteAtivo: false }));
    expect(erros).toContain('O solicitante precisa estar ativo.');
  });

  it('recusa destinatário inativo', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ destinatarioAtivo: false }));
    expect(erros).toContain('O destinatário precisa estar ativo.');
  });

  it('recusa quando o solicitante não tem turno no dia', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ diaSolicitante: undefined }));
    expect(erros).toContain('Você não tem turno nesse dia.');
  });

  it('recusa quando o destinatário não tem turno no dia', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ diaDestinatario: undefined }));
    expect(erros).toContain('O colega não tem turno nesse dia.');
  });

  it('recusa quando os dois já estão no mesmo turno', () => {
    const erros = validarNovaSolicitacaoTroca(contexto({ diaDestinatario: { c: 'M' } }));
    expect(erros).toContain('Os dois já estão no mesmo turno nesse dia — não há o que trocar.');
  });
});

describe('aplicarTrocaNosDias', () => {
  it('troca o dia inteiro entre os dois mapas, preservando o resto', () => {
    const diasSolicitante: Record<string, Dia> = {
      '2026-08-10': { c: 'M', i: '07:00', f: '13:00' },
      '2026-08-11': { c: 'X' },
    };
    const diasDestinatario: Record<string, Dia> = {
      '2026-08-10': { c: 'T', i: '13:00', f: '19:00' },
      '2026-08-11': { c: 'M' },
    };

    const resultado = aplicarTrocaNosDias(diasSolicitante, diasDestinatario, '2026-08-10');

    expect(resultado.diasSolicitante['2026-08-10']).toEqual({ c: 'T', i: '13:00', f: '19:00' });
    expect(resultado.diasDestinatario['2026-08-10']).toEqual({ c: 'M', i: '07:00', f: '13:00' });
    expect(resultado.diasSolicitante['2026-08-11']).toEqual({ c: 'X' });
    expect(resultado.diasDestinatario['2026-08-11']).toEqual({ c: 'M' });
  });

  it('lança erro se o dia não existir em uma das duas escalas', () => {
    expect(() => aplicarTrocaNosDias({}, { '2026-08-10': { c: 'M' } }, '2026-08-10'))
      .toThrow('O dia 2026-08-10 não existe em uma das duas escalas.');
  });
});

describe('trocaDesatualizada', () => {
  const troca = {
    snapshotValidacao: {
      solicitanteDocId: 'EQ_SOC_ana_2026-08',
      destinatarioDocId: 'EQ_SOC_bruno_2026-08',
      turnoSolicitanteOriginal: 'M',
      turnoDestinatarioOriginal: 'T',
    },
  };

  it('falso quando os turnos atuais batem com o snapshot', () => {
    expect(trocaDesatualizada(troca, { c: 'M' }, { c: 'T' })).toBe(false);
  });

  it('verdadeiro quando o turno do solicitante mudou', () => {
    expect(trocaDesatualizada(troca, { c: 'N' }, { c: 'T' })).toBe(true);
  });

  it('verdadeiro quando o turno do destinatário mudou', () => {
    expect(trocaDesatualizada(troca, { c: 'M' }, { c: 'N' })).toBe(true);
  });

  it('verdadeiro quando um dos dias deixou de existir', () => {
    expect(trocaDesatualizada(troca, undefined, { c: 'T' })).toBe(true);
  });
});
