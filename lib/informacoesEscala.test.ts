import { describe, expect, it } from 'vitest';

import {
  cancelarInformacaoEscala,
  criarIdContextoInformacoesEscala,
  normalizarEntradaInformacaoEscala,
  publicarInformacaoEscala,
  transicaoDeStatusInformacaoEscalaValida,
  validarCompetencia,
  validarEntradaInformacaoEscala,
  type EntradaInformacaoEscala,
  type InformacaoEscala,
} from './informacoesEscala';

function entradaDia(sobrescritas: Partial<EntradaInformacaoEscala> = {}): EntradaInformacaoEscala {
  return {
    tipoEscala: 'JORNADA',
    alvoId: 'GEDSI_COSI_SOC',
    competencia: '2026-09',
    data: '2026-09-07',
    escopo: 'DIA',
    usuarioLogin: null,
    categoria: 'FERIADO',
    titulo: 'Feriado',
    descricao: null,
    visibilidade: 'EQUIPE',
    ...sobrescritas,
  };
}

function entradaPessoaDia(sobrescritas: Partial<EntradaInformacaoEscala> = {}): EntradaInformacaoEscala {
  return entradaDia({
    escopo: 'PESSOA_DIA',
    usuarioLogin: 'alamancio',
    categoria: 'COBERTURA_DU',
    titulo: 'DU — Alamancio',
    visibilidade: 'PESSOAS_AFETADAS',
    ...sobrescritas,
  });
}

function informacaoPersistida(sobrescritas: Partial<InformacaoEscala> = {}): InformacaoEscala {
  return {
    ...entradaDia(),
    schemaVersion: 1,
    infoId: 'info-1',
    status: 'RASCUNHO',
    criadoPorLogin: 'clis',
    criadoEm: '2026-08-27T10:00:00.000Z',
    atualizadoPorLogin: 'clis',
    atualizadoEm: '2026-08-27T10:00:00.000Z',
    publicadoPorLogin: null,
    publicadoEm: null,
    canceladoPorLogin: null,
    canceladoEm: null,
    motivoCancelamento: null,
    ...sobrescritas,
  };
}

describe('validarCompetencia', () => {
  it('aceita AAAA-MM válido', () => {
    expect(validarCompetencia('2026-09')).toBe(true);
    expect(validarCompetencia('2026-01')).toBe(true);
    expect(validarCompetencia('2026-12')).toBe(true);
  });

  it('rejeita mês inválido ou formato errado', () => {
    expect(validarCompetencia('2026-13')).toBe(false);
    expect(validarCompetencia('2026-00')).toBe(false);
    expect(validarCompetencia('2026/09')).toBe(false);
    expect(validarCompetencia('26-09')).toBe(false);
    expect(validarCompetencia('')).toBe(false);
  });
});

describe('validarEntradaInformacaoEscala — DIA', () => {
  it('aceita entrada de DIA válida, sem pessoa', () => {
    expect(validarEntradaInformacaoEscala(entradaDia())).toEqual([]);
  });

  it('rejeita DIA com usuarioLogin preenchido', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ usuarioLogin: 'alguem' }));
    expect(erros).toContain('Informação de DIA não pode estar associada a uma pessoa específica.');
  });

  it('rejeita data civil inexistente', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ data: '2026-02-30' }));
    expect(erros).toContain('Data inválida.');
  });

  it('rejeita competência fora do formato AAAA-MM', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ competencia: '09/2026' }));
    expect(erros).toContain('Competência inválida — use o formato AAAA-MM.');
  });
});

describe('validarEntradaInformacaoEscala — data precisa pertencer ao período 26→25 da competência', () => {
  const MOTIVO_FORA_DO_PERIODO = 'A data informada não pertence ao período desta competência (dia 26 do mês anterior a dia 25 do mês do rótulo).';

  it('aceita a data inicial do período (dia 26 do mês anterior)', () => {
    expect(validarEntradaInformacaoEscala(entradaDia({ competencia: '2026-09', data: '2026-08-26' }))).toEqual([]);
  });

  it('aceita a data final do período (dia 25 do mês do rótulo)', () => {
    expect(validarEntradaInformacaoEscala(entradaDia({ competencia: '2026-09', data: '2026-09-25' }))).toEqual([]);
  });

  it('aceita uma data no meio do período', () => {
    expect(validarEntradaInformacaoEscala(entradaDia({ competencia: '2026-09', data: '2026-09-01' }))).toEqual([]);
  });

  it('rejeita o dia imediatamente anterior ao início do período', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ competencia: '2026-09', data: '2026-08-25' }));
    expect(erros).toContain(MOTIVO_FORA_DO_PERIODO);
  });

  it('rejeita o dia imediatamente posterior ao fim do período', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ competencia: '2026-09', data: '2026-09-26' }));
    expect(erros).toContain(MOTIVO_FORA_DO_PERIODO);
  });

  it('rejeita uma data claramente fora do período', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ competencia: '2026-09', data: '2026-10-01' }));
    expect(erros).toContain(MOTIVO_FORA_DO_PERIODO);
  });

  it('vira o ano corretamente: competência 2027-01 vai de 2026-12-26 a 2027-01-25', () => {
    expect(validarEntradaInformacaoEscala(entradaDia({ competencia: '2027-01', data: '2026-12-26' }))).toEqual([]);
    expect(validarEntradaInformacaoEscala(entradaDia({ competencia: '2027-01', data: '2027-01-25' }))).toEqual([]);
    const erros = validarEntradaInformacaoEscala(entradaDia({ competencia: '2027-01', data: '2026-12-25' }));
    expect(erros).toContain(MOTIVO_FORA_DO_PERIODO);
  });

  it('não reporta erro de período quando competência já é inválida — só o erro de formato', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ competencia: '09/2026', data: '2026-09-07' }));
    expect(erros).not.toContain(MOTIVO_FORA_DO_PERIODO);
  });
});

describe('validarEntradaInformacaoEscala — PESSOA_DIA', () => {
  it('aceita entrada de PESSOA_DIA válida, com login', () => {
    expect(validarEntradaInformacaoEscala(entradaPessoaDia())).toEqual([]);
  });

  it('rejeita PESSOA_DIA sem usuarioLogin', () => {
    const erros = validarEntradaInformacaoEscala(entradaPessoaDia({ usuarioLogin: null }));
    expect(erros).toContain('Informe a pessoa afetada por esta informação.');
  });

  it('rejeita PESSOA_DIA com usuarioLogin só espaços', () => {
    const erros = validarEntradaInformacaoEscala(entradaPessoaDia({ usuarioLogin: '   ' }));
    expect(erros).toContain('Informe a pessoa afetada por esta informação.');
  });
});

describe('validarEntradaInformacaoEscala — campos gerais', () => {
  it('rejeita categoria inválida', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ categoria: 'INVALIDA' as never }));
    expect(erros).toContain('Categoria inválida.');
  });

  it('rejeita visibilidade inválida', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ visibilidade: 'PUBLICO' as never }));
    expect(erros).toContain('Visibilidade inválida.');
  });

  it('rejeita título vazio', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ titulo: '   ' }));
    expect(erros).toContain('Informe um título para a informação.');
  });

  it('rejeita título maior que o limite', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ titulo: 'x'.repeat(121) }));
    expect(erros.some((erro) => erro.includes('máximo 120'))).toBe(true);
  });

  it('rejeita descrição maior que o limite', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ descricao: 'x'.repeat(1001) }));
    expect(erros.some((erro) => erro.includes('máximo 1000'))).toBe(true);
  });

  it('rejeita alvoId vazio', () => {
    const erros = validarEntradaInformacaoEscala(entradaDia({ alvoId: '' }));
    expect(erros).toContain('Informe o alvo (equipe ou grupo de plantão) da informação.');
  });
});

describe('normalizarEntradaInformacaoEscala', () => {
  it('apara espaços do título e converte descrição vazia em null', () => {
    const normalizada = normalizarEntradaInformacaoEscala(entradaDia({
      titulo: '  Feriado  ',
      descricao: '   ',
    }));
    expect(normalizada.titulo).toBe('Feriado');
    expect(normalizada.descricao).toBeNull();
  });
});

describe('criarIdContextoInformacoesEscala', () => {
  it('é estável para os mesmos parâmetros', () => {
    const id1 = criarIdContextoInformacoesEscala('JORNADA', 'GEDSI_COSI_SOC', '2026-09');
    const id2 = criarIdContextoInformacoesEscala('JORNADA', 'GEDSI_COSI_SOC', '2026-09');
    expect(id1).toBe(id2);
    expect(id1).toBe('JORNADA_GEDSI_COSI_SOC_2026-09');
  });

  it('diferencia por tipo, alvo e competência', () => {
    const base = criarIdContextoInformacoesEscala('JORNADA', 'GEDSI_COSI_SOC', '2026-09');
    expect(criarIdContextoInformacoesEscala('PLANTAO', 'GEDSI_COSI_SOC', '2026-09')).not.toBe(base);
    expect(criarIdContextoInformacoesEscala('JORNADA', 'GEDSI_COSI_NOC', '2026-09')).not.toBe(base);
    expect(criarIdContextoInformacoesEscala('JORNADA', 'GEDSI_COSI_SOC', '2026-10')).not.toBe(base);
  });
});

describe('transicaoDeStatusInformacaoEscalaValida', () => {
  it('permite RASCUNHO -> PUBLICADA e RASCUNHO -> CANCELADA', () => {
    expect(transicaoDeStatusInformacaoEscalaValida('RASCUNHO', 'PUBLICADA')).toBe(true);
    expect(transicaoDeStatusInformacaoEscalaValida('RASCUNHO', 'CANCELADA')).toBe(true);
  });

  it('permite PUBLICADA -> CANCELADA, mas nunca PUBLICADA -> RASCUNHO', () => {
    expect(transicaoDeStatusInformacaoEscalaValida('PUBLICADA', 'CANCELADA')).toBe(true);
    expect(transicaoDeStatusInformacaoEscalaValida('PUBLICADA', 'RASCUNHO')).toBe(false);
  });

  it('CANCELADA é terminal — nenhuma transição sai dela, nem para ela mesma', () => {
    expect(transicaoDeStatusInformacaoEscalaValida('CANCELADA', 'RASCUNHO')).toBe(false);
    expect(transicaoDeStatusInformacaoEscalaValida('CANCELADA', 'PUBLICADA')).toBe(false);
    expect(transicaoDeStatusInformacaoEscalaValida('CANCELADA', 'CANCELADA')).toBe(false);
  });

  it('mesmo status nunca é uma "transição" (RASCUNHO->RASCUNHO, PUBLICADA->PUBLICADA)', () => {
    expect(transicaoDeStatusInformacaoEscalaValida('RASCUNHO', 'RASCUNHO')).toBe(false);
    expect(transicaoDeStatusInformacaoEscalaValida('PUBLICADA', 'PUBLICADA')).toBe(false);
  });
});

describe('publicarInformacaoEscala', () => {
  it('publica um RASCUNHO, registrando autor e data', () => {
    const publicado = publicarInformacaoEscala(informacaoPersistida(), 'clis', '2026-08-27T12:00:00.000Z');
    expect(publicado.status).toBe('PUBLICADA');
    expect(publicado.publicadoPorLogin).toBe('clis');
    expect(publicado.publicadoEm).toBe('2026-08-27T12:00:00.000Z');
    expect(publicado.atualizadoPorLogin).toBe('clis');
  });

  it('nunca republica uma CANCELADA nem uma já PUBLICADA', () => {
    expect(() => publicarInformacaoEscala(
      informacaoPersistida({ status: 'CANCELADA' }), 'clis', '2026-08-27T12:00:00.000Z',
    )).toThrow();
    expect(() => publicarInformacaoEscala(
      informacaoPersistida({ status: 'PUBLICADA', publicadoPorLogin: 'clis', publicadoEm: '2026-08-27T09:00:00.000Z' }),
      'clis',
      '2026-08-27T12:00:00.000Z',
    )).toThrow();
  });
});

describe('cancelarInformacaoEscala', () => {
  it('cancela um RASCUNHO com motivo', () => {
    const cancelado = cancelarInformacaoEscala(
      informacaoPersistida(), 'clis', 'Duplicado por engano', '2026-08-27T12:00:00.000Z',
    );
    expect(cancelado.status).toBe('CANCELADA');
    expect(cancelado.canceladoPorLogin).toBe('clis');
    expect(cancelado.motivoCancelamento).toBe('Duplicado por engano');
  });

  it('cancela uma PUBLICADA (preserva o documento, nunca deleta)', () => {
    const cancelado = cancelarInformacaoEscala(
      informacaoPersistida({ status: 'PUBLICADA', publicadoPorLogin: 'clis', publicadoEm: '2026-08-27T10:00:00.000Z' }),
      'clis',
      null,
      '2026-08-27T12:00:00.000Z',
    );
    expect(cancelado.status).toBe('CANCELADA');
    expect(cancelado.publicadoPorLogin).toBe('clis');
  });

  it('rejeita cancelar uma informação já CANCELADA', () => {
    expect(() => cancelarInformacaoEscala(
      informacaoPersistida({ status: 'CANCELADA' }), 'clis', null, '2026-08-27T12:00:00.000Z',
    )).toThrow();
  });

  it('motivo vazio normaliza para null', () => {
    const cancelado = cancelarInformacaoEscala(informacaoPersistida(), 'clis', '   ', '2026-08-27T12:00:00.000Z');
    expect(cancelado.motivoCancelamento).toBeNull();
  });
});
