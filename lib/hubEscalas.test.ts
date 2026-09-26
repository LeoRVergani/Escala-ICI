import { describe, expect, it } from 'vitest';

import { agruparOperacoesParaHub, possuiOperacaoAdministravelHub, rotuloAcaoOperacaoHub } from './hubEscalas';
import type { OperacaoDashboard } from './operacoesDashboard';

function operacao(sobrescritas: Partial<OperacaoDashboard> = {}): OperacaoDashboard {
  return {
    tipo: 'JORNADA',
    alvoId: 'EQ_X',
    nome: 'Equipe X',
    status: 'sem-escala',
    ativa: false,
    consulta: false,
    ...sobrescritas,
  };
}

describe('agruparOperacoesParaHub', () => {
  it('usuário administra Jornada + Plantão -> ambas aparecem em minhasEscalas (teste A)', () => {
    const soc = operacao({ tipo: 'JORNADA', alvoId: 'EQ_SOC', nome: 'SOC' });
    const plantaoCosi = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_COSI', nome: 'Plantão COSI' });
    const grupo = agruparOperacoesParaHub([soc, plantaoCosi]);
    expect(grupo.minhasEscalas).toEqual([soc, plantaoCosi]);
    expect(grupo.acompanhamento).toEqual([]);
  });

  it('contexto ativo Jornada -> Plantão continua no Hub (teste B) — a lista nunca é filtrada pelo contexto ativo', () => {
    const soc = operacao({ tipo: 'JORNADA', alvoId: 'EQ_SOC', nome: 'SOC', ativa: true });
    const plantaoCosi = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_COSI', nome: 'Plantão COSI', ativa: false });
    const grupo = agruparOperacoesParaHub([soc, plantaoCosi]);
    expect(grupo.minhasEscalas.map((item) => item.nome)).toEqual(['SOC', 'Plantão COSI']);
  });

  it('contexto ativo Plantão -> Jornada continua no Hub (teste C) — mesma lista, independente de qual operação está ativa', () => {
    const soc = operacao({ tipo: 'JORNADA', alvoId: 'EQ_SOC', nome: 'SOC', ativa: false });
    const plantaoCosi = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_COSI', nome: 'Plantão COSI', ativa: true });
    const grupo = agruparOperacoesParaHub([soc, plantaoCosi]);
    expect(grupo.minhasEscalas.map((item) => item.nome)).toEqual(['SOC', 'Plantão COSI']);
  });

  it('operação somente consulta -> aparece em acompanhamento, nunca em minhasEscalas (teste D)', () => {
    const noc = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_NOC', nome: 'Plantão NOC', consulta: true });
    const grupo = agruparOperacoesParaHub([noc]);
    expect(grupo.acompanhamento).toEqual([noc]);
    expect(grupo.minhasEscalas).toEqual([]);
  });

  it('nunca mistura administráveis e consulta na mesma lista', () => {
    const soc = operacao({ tipo: 'JORNADA', alvoId: 'EQ_SOC', nome: 'SOC', consulta: false });
    const noc = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_NOC', nome: 'Plantão NOC', consulta: true });
    const grupo = agruparOperacoesParaHub([soc, noc]);
    expect(grupo.minhasEscalas).toHaveLength(1);
    expect(grupo.acompanhamento).toHaveLength(1);
    expect(grupo.minhasEscalas[0]?.consulta).toBe(false);
    expect(grupo.acompanhamento[0]?.consulta).toBe(true);
  });

  it('escala sem publicação continua aparecendo (teste I) — sem-escala nunca é filtrada da lista', () => {
    const semEscala = operacao({ tipo: 'JORNADA', alvoId: 'EQ_SOC', nome: 'SOC', status: 'sem-escala' });
    const grupo = agruparOperacoesParaHub([semEscala]);
    expect(grupo.minhasEscalas).toEqual([semEscala]);
  });

  it('grupo Plantão homônimo permanece desambiguado (teste G) — o agrupamento nunca deduplica/agrupa por nome, só reflete a lista já recebida', () => {
    const primeiro = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_A', nome: 'Plantão Segurança' });
    const segundo = operacao({ tipo: 'PLANTAO', alvoId: 'PLANTAO_B', nome: 'Plantão Segurança' });
    const grupo = agruparOperacoesParaHub([primeiro, segundo]);
    expect(grupo.minhasEscalas).toHaveLength(2);
    expect(grupo.minhasEscalas.map((item) => item.alvoId)).toEqual(['PLANTAO_A', 'PLANTAO_B']);
  });
});

describe('rotuloAcaoOperacaoHub', () => {
  it('operação administrável -> "Abrir escala" (teste F)', () => {
    expect(rotuloAcaoOperacaoHub(operacao({ consulta: false }))).toBe('Abrir escala');
  });

  it('operação somente consulta -> "Visualizar", nunca um verbo administrativo (teste E)', () => {
    const rotulo = rotuloAcaoOperacaoHub(operacao({ consulta: true }));
    expect(rotulo).toBe('Visualizar');
    expect(rotulo).not.toMatch(/Editar|Publicar|Importar|Salvar|Excluir|Cancelar/u);
  });
});

describe('possuiOperacaoAdministravelHub', () => {
  it('true quando existe ao menos uma operação administrável', () => {
    expect(possuiOperacaoAdministravelHub([operacao({ consulta: false })])).toBe(true);
  });

  it('false quando o usuário só tem operações de consulta — nunca deve ganhar CTA de criação/importação', () => {
    expect(possuiOperacaoAdministravelHub([operacao({ consulta: true })])).toBe(false);
  });

  it('false para lista vazia', () => {
    expect(possuiOperacaoAdministravelHub([])).toBe(false);
  });
});
