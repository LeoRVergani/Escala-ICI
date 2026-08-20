import { CATALOGO_SOC, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import {
  adicionarMembroGrade,
  agruparGradePorPeriodo,
  criarMembroGrade,
  membroJaNaGrade,
  removerMembroGrade,
  usuariosElegiveisParaAdicionarNaGrade,
} from './gradeMembros';
import type { Usuario } from './modelos';

const REFERENCIA = {
  equipeId: 'EQ_SOC',
  competencia: '2026-08',
  periodoInicio: '2026-07-26',
  periodoFim: '2026-08-25',
};

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
    turnoPadrao: 'M',
    ativo: true,
    ...ajustes,
  };
}

function documento(usuarioUid: string, turnoPadrao: string): TurnosMes {
  return {
    schemaVersion: 1,
    usuarioUid,
    login: usuarioUid,
    equipeId: 'EQ_SOC',
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    turnoPadrao,
    status: 'RASCUNHO',
    dias: {},
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}

describe('criação de membro em branco', () => {
  it('monta um documento RASCUNHO sem dias, com os totais zerados', () => {
    const membro = criarMembroGrade(usuario(), 'MD', REFERENCIA, CATALOGO_SOC);
    expect(membro.usuarioUid).toBe('ana');
    expect(membro.login).toBe('ana');
    expect(membro.turnoPadrao).toBe('MD');
    expect(membro.status).toBe('RASCUNHO');
    expect(membro.dias).toEqual({});
    expect(membro.totais.min).toBe(0);
    expect(membro.equipeId).toBe('EQ_SOC');
    expect(membro.competencia).toBe('2026-08');
  });
});

describe('adicionar e remover membro da grade', () => {
  it('adiciona um novo membro', () => {
    const membro = criarMembroGrade(usuario(), 'MD', REFERENCIA, CATALOGO_SOC);
    const resultado = adicionarMembroGrade([], membro);
    expect(resultado).toHaveLength(1);
    expect(membroJaNaGrade(resultado, 'ana')).toBe(true);
  });

  it('não duplica um membro que já está na grade', () => {
    const membro = criarMembroGrade(usuario(), 'MD', REFERENCIA, CATALOGO_SOC);
    const resultado = adicionarMembroGrade([membro], membro);
    expect(resultado).toHaveLength(1);
  });

  it('remove apenas o membro indicado, sem afetar os outros', () => {
    const documentos = [documento('uid-ana', 'MD'), documento('uid-bruno', 'M')];
    const resultado = removerMembroGrade(documentos, 'uid-ana');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.usuarioUid).toBe('uid-bruno');
  });

  it('remover da grade não afeta o cadastro do usuário (não é responsabilidade deste módulo)', () => {
    const documentos = [documento('uid-ana', 'MD')];
    const resultado = removerMembroGrade(documentos, 'uid-ana');
    expect(resultado).toEqual([]);
    // criarMembroGrade/removerMembroGrade nunca leem nem escrevem em `usuarios`.
  });
});

describe('colaboradores elegíveis para inclusão na grade', () => {
  it('lista apenas usuários ativos da equipe da escala que ainda não estão na grade', () => {
    const documentos = [documento('ana', 'M')];
    const usuarios = [
      usuario({ login: 'ana', nome: 'Ana', equipeId: 'EQ_SOC', ativo: true }),
      usuario({ login: 'bruno', nome: 'Bruno', equipeId: 'EQ_SOC', ativo: true }),
      usuario({ login: 'carla', nome: 'Carla', equipeId: 'EQ_NOC', ativo: true }),
      usuario({ login: 'daniel', nome: 'Daniel', equipeId: 'EQ_SOC', ativo: false }),
    ];

    expect(usuariosElegiveisParaAdicionarNaGrade(usuarios, documentos, 'EQ_SOC').map((item) => item.login)).toEqual(['bruno']);
  });

  it('não usa a equipe do coordenador como fallback quando a escala não tem equipe resolvida', () => {
    expect(usuariosElegiveisParaAdicionarNaGrade([usuario()], [], null)).toEqual([]);
  });
});

describe('agrupamento por período', () => {
  it('ordena Madrugada, Manhã, Tarde, Noite mesmo com entrada fora de ordem', () => {
    const documentos = [
      documento('uid-noite', 'N'),
      documento('uid-tarde', 'T'),
      documento('uid-md', 'MD'),
      documento('uid-manha', 'M'),
    ];
    const grupos = agruparGradePorPeriodo(documentos, CATALOGO_SOC);
    expect(grupos.map((grupo) => grupo.codigo)).toEqual(['MD', 'M', 'T', 'N']);
    expect(grupos[0]?.rotulo).toBe('Madrugada');
  });

  it('agrupa múltiplos colaboradores do mesmo período juntos', () => {
    const documentos = [documento('uid-1', 'M'), documento('uid-2', 'M')];
    const grupos = agruparGradePorPeriodo(documentos, CATALOGO_SOC);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.documentos).toHaveLength(2);
  });

  it('mantém a ordem fixa e envia códigos desconhecidos para o final, em ordem alfabética', () => {
    const documentos = [
      documento('uid-x', 'X'),
      documento('uid-n', 'N'),
      documento('uid-bh', 'BH'),
      documento('uid-md', 'MD'),
    ];
    const grupos = agruparGradePorPeriodo(documentos, CATALOGO_SOC);
    expect(grupos.map((grupo) => grupo.codigo)).toEqual(['MD', 'N', 'BH', 'X']);
  });

  it('agrupa turno vazio como OUTROS sem quebrar', () => {
    const documentos = [documento('uid-1', '')];
    const grupos = agruparGradePorPeriodo(documentos, CATALOGO_SOC);
    expect(grupos.map((grupo) => grupo.codigo)).toEqual(['OUTROS']);
  });
});
