import { describe, expect, it } from 'vitest';

import { conferirAdministracao } from './conferenciaAdministracao';

const equipe = (id: string, ativa = true) => ({ id, nome: id, sigla: id, ativa }) as never;
const grupo = (grupoId: string, equipeResponsavelId: string) => ({ grupoId, nome: grupoId, equipeResponsavelId, equipesConsulta: [equipeResponsavelId], timezone: 'America/Sao_Paulo', ativo: true, schemaVersion: 1 }) as never;
const escopo = (tipo: 'JORNADA' | 'PLANTAO', alvoId: string, responsaveis: string[]) => ({ tipo, alvoId, alvoNome: alvoId, responsaveisLogin: responsaveis, responsaveisEquipe: [], equipesConsulta: [], ativo: true }) as never;
const pessoa = (login: string, extra: Record<string, unknown> = {}) => ({ login, nome: login, ativo: true, equipeId: 'SOC', nivelHierarquico: 6, ...extra }) as never;

describe('ADMIN-CONFERENCIA-1', () => {
  it('tudo em ordem: nenhum problema', () => {
    expect(conferirAdministracao({
      equipes: [equipe('SOC')], grupos: [grupo('PL', 'SOC')],
      escopos: [escopo('JORNADA', 'SOC', ['chefe']), escopo('PLANTAO', 'PL', ['chefe'])],
      usuarios: [pessoa('chefe', { perfil: 'GESTOR_EQUIPE', nivelHierarquico: 5 }), pessoa('ana')],
    })).toEqual([]);
  });

  it('equipe sem liderança e Plantão sem responsável vêm primeiro (gravidade alta)', () => {
    const problemas = conferirAdministracao({ equipes: [equipe('SOC')], grupos: [grupo('PL', 'SOC')], escopos: [], usuarios: [] });
    expect(problemas.map((item) => item.chave)).toEqual(['sem-responsavel-PL', 'sem-lideranca-SOC']);
  });

  it('responsável inválido e vínculo sem alvo vêm com a correção de um clique', () => {
    const problemas = conferirAdministracao({
      equipes: [equipe('SOC')], grupos: [],
      escopos: [escopo('JORNADA', 'SOC', ['ana']), escopo('PLANTAO', 'SUMIU', ['chefe'])],
      usuarios: [pessoa('ana')],
    });
    expect(problemas.find((item) => item.acao.tipo === 'REMOVER_RESPONSAVEL')?.titulo).toContain('não é liderança');
    expect(problemas.find((item) => item.acao.tipo === 'DESATIVAR_VINCULO')?.chave).toBe('vinculo-sem-alvo-PLANTAO-SUMIU');
  });

  it('pessoas ativas sem equipe aparecem juntas num item só', () => {
    const problemas = conferirAdministracao({
      equipes: [equipe('SOC')], grupos: [], escopos: [escopo('JORNADA', 'SOC', ['chefe'])],
      usuarios: [pessoa('chefe', { perfil: 'GESTOR_EQUIPE' }), pessoa('a', { equipeId: '' }), pessoa('b', { equipeId: 'NAO_EXISTE' })],
    });
    expect(problemas.find((item) => item.chave === 'pessoas-sem-equipe')?.titulo).toBe('2 pessoas estão sem equipe');
  });

  it('sem a lista de pessoas carregada, não julga responsáveis (nunca oferece remover alguém por engano)', () => {
    const problemas = conferirAdministracao({
      equipes: [equipe('SOC')], grupos: [], escopos: [escopo('JORNADA', 'SOC', ['chefe'])], usuarios: [],
    });
    expect(problemas).toEqual([]);
  });
});
