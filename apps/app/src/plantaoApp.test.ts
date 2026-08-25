import type { AtribuicaoPlantaoPersistida, GrupoPlantao, ParticipantePlantao } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import type { Usuario } from '@/lib/modelos';
import {
  atribuicoesPorDiaCivil,
  contatosAtivosDoPlantonista,
  diasCivisNoPeriodo,
  escolherGrupoPlantaoPadrao,
  formatarIntervaloPlantaoCivil,
  formatarIntervaloPlantaoRelativoAHoje,
  indiceCorPlantonista,
  intervaloPlantaoCivil,
  nomeExibicaoPlantonista,
  obterIniciaisParticipantePlantao,
  plataformaContatoPlantao,
  proximosPlantoesDoUsuario,
  resolverDestaquePlantaoHoje,
  resolverPlantaoAgora,
  rotuloFimPlantao,
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

describe('resolverDestaquePlantaoHoje', () => {
  it('ninguém agora, mas alguém entra mais tarde HOJE -> PROXIMO_HOJE', () => {
    const maisTarde = atribuicao({ atribuicaoId: 'mais-tarde', inicio: '2026-08-11T18:00:00.000Z', fim: '2026-08-12T06:00:00.000Z' });
    const resumo = resolverPlantaoAgora([maisTarde], '2026-08-11T10:00:00.000Z');
    const destaque = resolverDestaquePlantaoHoje(resumo, 'UTC', '2026-08-11');
    expect(destaque).toEqual({ estado: 'PROXIMO_HOJE', atribuicao: maisTarde });
  });

  it('ninguém hoje, mas existe plantão futuro em outro dia -> PROXIMO_FUTURO', () => {
    const futuro = atribuicao({ atribuicaoId: 'futuro', inicio: '2026-08-15T22:00:00.000Z', fim: '2026-08-16T10:00:00.000Z' });
    const resumo = resolverPlantaoAgora([futuro], '2026-08-11T10:00:00.000Z');
    const destaque = resolverDestaquePlantaoHoje(resumo, 'UTC', '2026-08-11');
    expect(destaque).toEqual({ estado: 'PROXIMO_FUTURO', atribuicao: futuro });
  });

  it('nenhum próximo plantão publicado -> VAZIO', () => {
    const resumo = resolverPlantaoAgora([], '2026-08-11T10:00:00.000Z');
    expect(resolverDestaquePlantaoHoje(resumo, 'UTC', '2026-08-11')).toEqual({ estado: 'VAZIO' });
  });

  it('o próximo plantão pode ser do próprio usuário (chamador decide o rótulo "Você" comparando plantonistaLogin)', () => {
    const meu = atribuicao({ atribuicaoId: 'meu', plantonistaLogin: 'clis', inicio: '2026-08-11T18:00:00.000Z', fim: '2026-08-12T06:00:00.000Z' });
    const resumo = resolverPlantaoAgora([meu], '2026-08-11T10:00:00.000Z');
    const destaque = resolverDestaquePlantaoHoje(resumo, 'UTC', '2026-08-11');
    expect(destaque.estado).toBe('PROXIMO_HOJE');
    expect(destaque).toHaveProperty('atribuicao.plantonistaLogin', 'clis');
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

describe('obterIniciaisParticipantePlantao', () => {
  it('primeiro nome + último sobrenome, nome com vários sobrenomes', () => {
    expect(obterIniciaisParticipantePlantao('Jean Carlo Machado Ribeiro')).toBe('JR');
  });

  it('nome composto simples', () => {
    expect(obterIniciaisParticipantePlantao('Bruno Bueno')).toBe('BB');
    expect(obterIniciaisParticipantePlantao('Claudio Lis')).toBe('CL');
  });

  it('ignora conectivos (de/da/do/dos/das) ao escolher o último sobrenome', () => {
    expect(obterIniciaisParticipantePlantao('Caroline Ribeiro de Freitas')).toBe('CF');
    expect(obterIniciaisParticipantePlantao('João da Silva')).toBe('JS');
    expect(obterIniciaisParticipantePlantao('Ana Paula dos Santos Lima')).toBe('AL');
  });

  it('nome de uma palavra só -> duas primeiras letras', () => {
    expect(obterIniciaisParticipantePlantao('Madonna')).toBe('MA');
  });

  it('sem nome, cai no login (separando por . _ - @)', () => {
    expect(obterIniciaisParticipantePlantao(undefined, 'caio.monteiro')).toBe('CM');
    expect(obterIniciaisParticipantePlantao('', 'clis')).toBe('CL');
  });

  it('nome e login vazios/ausentes -> string vazia, nunca lança', () => {
    expect(obterIniciaisParticipantePlantao()).toBe('');
    expect(obterIniciaisParticipantePlantao('', '')).toBe('');
    expect(obterIniciaisParticipantePlantao('   ', '   ')).toBe('');
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

describe('intervaloPlantaoCivil + formatadores', () => {
  it('plantão dentro do mesmo dia civil (timezone do Grupo) não cruza dia seguinte', () => {
    const intervalo = intervaloPlantaoCivil(
      { inicio: '2026-08-11T13:00:00.000Z', fim: '2026-08-11T19:00:00.000Z' },
      'America/Sao_Paulo',
    );
    expect(intervalo.valido).toBe(true);
    expect(intervalo.cruzaDiaSeguinte).toBe(false);
    expect(formatarIntervaloPlantaoCivil(intervalo)).toBe(`${intervalo.horaInicio}–${intervalo.horaFim}`);
  });

  it('plantão noturno que cruza a meia-noite civil marca cruzaDiaSeguinte e o rótulo neutro nunca diz "hoje"', () => {
    const intervalo = intervaloPlantaoCivil(
      { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' },
      'America/Sao_Paulo',
    );
    expect(intervalo.cruzaDiaSeguinte).toBe(true);
    expect(intervalo.diasDeDiferenca).toBe(1);
    const rotulo = formatarIntervaloPlantaoCivil(intervalo);
    expect(rotulo).toContain('termina no dia seguinte');
    expect(rotulo).not.toContain('hoje');
    expect(rotulo).not.toContain('+1 dia');
  });

  it('plantão de 24h também cruza dia seguinte', () => {
    const intervalo = intervaloPlantaoCivil(
      { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T22:00:00.000Z' },
      'America/Sao_Paulo',
    );
    expect(intervalo.cruzaDiaSeguinte).toBe(true);
    expect(intervalo.horaInicio).toBe(intervalo.horaFim);
  });

  it('respeita o timezone do Grupo (diferente de America/Sao_Paulo)', () => {
    const intervalo = intervaloPlantaoCivil(
      { inicio: '2026-08-11T02:00:00.000Z', fim: '2026-08-11T08:00:00.000Z' },
      'UTC',
    );
    expect(intervalo).toEqual({
      horaInicio: '02:00', horaFim: '08:00', dataInicio: '2026-08-11', dataFim: '2026-08-11',
      diasDeDiferenca: 0, cruzaDiaSeguinte: false, valido: true,
    });
  });

  it('instante inválido nunca lança — cai no fallback seguro', () => {
    const intervalo = intervaloPlantaoCivil({ inicio: 'não-é-uma-data', fim: '2026-08-11T10:00:00.000Z' }, 'America/Sao_Paulo');
    expect(intervalo.valido).toBe(false);
    expect(formatarIntervaloPlantaoCivil(intervalo)).toBe('Horário indisponível');
  });

  it('timezone inválida nunca lança — cai no fallback seguro', () => {
    const intervalo = intervaloPlantaoCivil(
      { inicio: '2026-08-11T13:00:00.000Z', fim: '2026-08-11T19:00:00.000Z' },
      'Timezone/Inexistente',
    );
    expect(intervalo.valido).toBe(false);
  });

  describe('formatarIntervaloPlantaoRelativoAHoje', () => {
    it('plantão que começa hoje e cruza a meia-noite -> "hoje -> amanhã"', () => {
      const intervalo = intervaloPlantaoCivil(
        { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' },
        'America/Sao_Paulo',
      );
      expect(formatarIntervaloPlantaoRelativoAHoje(intervalo, intervalo.dataInicio)).toBe(
        `${intervalo.horaInicio} hoje → ${intervalo.horaFim} amanhã`,
      );
    });

    it('plantão que NÃO começa hoje nunca finge que é "hoje" — cai na forma neutra', () => {
      const intervalo = intervaloPlantaoCivil(
        { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' },
        'America/Sao_Paulo',
      );
      const rotulo = formatarIntervaloPlantaoRelativoAHoje(intervalo, '2026-09-01');
      expect(rotulo).not.toContain('hoje');
      expect(rotulo).not.toContain('amanhã');
      expect(rotulo).toBe(formatarIntervaloPlantaoCivil(intervalo));
    });
  });

  describe('rotuloFimPlantao', () => {
    it('mesmo dia -> "Até {horaFim}"', () => {
      const intervalo = intervaloPlantaoCivil(
        { inicio: '2026-08-11T13:00:00.000Z', fim: '2026-08-11T19:00:00.000Z' },
        'America/Sao_Paulo',
      );
      expect(rotuloFimPlantao(intervalo, intervalo.dataInicio)).toBe(`Até ${intervalo.horaFim}`);
    });

    it('cruza a meia-noite e começou hoje -> "de amanhã"', () => {
      const intervalo = intervaloPlantaoCivil(
        { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' },
        'America/Sao_Paulo',
      );
      expect(rotuloFimPlantao(intervalo, intervalo.dataInicio)).toBe(`Até ${intervalo.horaFim} de amanhã`);
    });

    it('cruza a meia-noite mas NÃO começou hoje -> "do dia seguinte", nunca "amanhã"', () => {
      const intervalo = intervaloPlantaoCivil(
        { inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' },
        'America/Sao_Paulo',
      );
      expect(rotuloFimPlantao(intervalo, '2026-08-11')).toBe(`Até ${intervalo.horaFim} do dia seguinte`);
    });
  });
});

describe('diasCivisNoPeriodo', () => {
  it('lista todos os dias, inclusive, mesmo quando a competência não alinha com o mês civil', () => {
    expect(diasCivisNoPeriodo('2026-07-26', '2026-07-29')).toEqual([
      '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29',
    ]);
  });

  it('período de um único dia devolve só esse dia', () => {
    expect(diasCivisNoPeriodo('2026-08-01', '2026-08-01')).toEqual(['2026-08-01']);
  });
});

describe('atribuicoesPorDiaCivil', () => {
  it('agrupa pelo dia civil (no timezone do Grupo) em que a atribuição COMEÇA', () => {
    const noturno = atribuicao({ atribuicaoId: 'a', inicio: '2026-08-10T22:00:00.000Z', fim: '2026-08-11T10:00:00.000Z' });
    const diurno = atribuicao({ atribuicaoId: 'b', inicio: '2026-08-11T13:00:00.000Z', fim: '2026-08-11T19:00:00.000Z' });
    const porDia = atribuicoesPorDiaCivil([noturno, diurno], 'America/Sao_Paulo');
    expect(porDia.get('2026-08-10')?.map((item) => item.atribuicaoId)).toEqual(['a']);
    expect(porDia.get('2026-08-11')?.map((item) => item.atribuicaoId)).toEqual(['b']);
  });

  it('mais de uma atribuição no mesmo dia fica ordenada por início', () => {
    const depois = atribuicao({ atribuicaoId: 'depois', inicio: '2026-08-11T19:00:00.000Z', fim: '2026-08-11T22:00:00.000Z' });
    const antes = atribuicao({ atribuicaoId: 'antes', inicio: '2026-08-11T13:00:00.000Z', fim: '2026-08-11T16:00:00.000Z' });
    const porDia = atribuicoesPorDiaCivil([depois, antes], 'America/Sao_Paulo');
    expect(porDia.get('2026-08-11')?.map((item) => item.atribuicaoId)).toEqual(['antes', 'depois']);
  });
});

describe('indiceCorPlantonista', () => {
  it('usa corPreferida quando o participante já escolheu uma cor válida', () => {
    const participantes = [participante({ login: 'clis', corPreferida: 5 })];
    expect(indiceCorPlantonista('clis', participantes)).toBe(5);
  });

  it('ignora corPreferida inválida (fora de 0..7) e cai no hash por login', () => {
    const comInvalida = [participante({ login: 'clis', corPreferida: 99 })];
    const semPreferencia = [participante({ login: 'clis', corPreferida: undefined })];
    expect(indiceCorPlantonista('clis', comInvalida)).toBe(indiceCorPlantonista('clis', semPreferencia));
  });

  it('sem participante cadastrado (ou corPreferida null/ausente) cai no hash — determinístico e estável', () => {
    expect(indiceCorPlantonista('clis', [])).toBe(indiceCorPlantonista('clis', []));
    const indice = indiceCorPlantonista('login.qualquer', []);
    expect(indice).toBeGreaterThanOrEqual(0);
    expect(indice).toBeLessThan(8);
  });

  it('corPreferida: null (preferência limpa) também cai no hash automático', () => {
    const semPreferencia = [participante({ login: 'clis', corPreferida: undefined })];
    const limpa = [participante({ login: 'clis', corPreferida: null })];
    expect(indiceCorPlantonista('clis', limpa)).toBe(indiceCorPlantonista('clis', semPreferencia));
  });
});

describe('escolherGrupoPlantaoPadrao', () => {
  const cosi = { grupoId: 'PLANTAO_COSI' } as GrupoPlantao;
  const noc = { grupoId: 'PLANTAO_NOC' } as GrupoPlantao;
  const dba = { grupoId: 'PLANTAO_DBA' } as GrupoPlantao;

  it('só um grupo — comportamento de antes desta fase, sempre o primeiro', () => {
    expect(escolherGrupoPlantaoPadrao([cosi], {}, 'clis')).toBe('PLANTAO_COSI');
  });

  it('vários grupos, sem participação em nenhum — cai no primeiro retornado', () => {
    expect(escolherGrupoPlantaoPadrao([cosi, noc, dba], {}, 'clis')).toBe('PLANTAO_COSI');
  });

  it('vários grupos, participante ativo num deles que não é o primeiro — prefere onde participa', () => {
    const porGrupo = { PLANTAO_NOC: [participante({ login: 'clis', grupoId: 'PLANTAO_NOC', ativo: true })] };
    expect(escolherGrupoPlantaoPadrao([cosi, noc, dba], porGrupo, 'clis')).toBe('PLANTAO_NOC');
  });

  it('participação INATIVA não conta — continua caindo no primeiro', () => {
    const porGrupo = { PLANTAO_NOC: [participante({ login: 'clis', grupoId: 'PLANTAO_NOC', ativo: false })] };
    expect(escolherGrupoPlantaoPadrao([cosi, noc, dba], porGrupo, 'clis')).toBe('PLANTAO_COSI');
  });

  it('lista vazia -> null', () => {
    expect(escolherGrupoPlantaoPadrao([], {}, 'clis')).toBeNull();
  });
});

describe('plataformaContatoPlantao', () => {
  it('reconhece WhatsApp (com ou sem acento/caixa)', () => {
    expect(plataformaContatoPlantao('WhatsApp')).toBe('whatsapp');
    expect(plataformaContatoPlantao('zap')).toBe('whatsapp');
  });

  it('reconhece e-mail', () => {
    expect(plataformaContatoPlantao('E-mail')).toBe('email');
    expect(plataformaContatoPlantao('Gmail pessoal')).toBe('email');
  });

  it('reconhece chat corporativo (Slack/Teams)', () => {
    expect(plataformaContatoPlantao('Slack')).toBe('chat');
    expect(plataformaContatoPlantao('Teams')).toBe('chat');
  });

  it('rótulo não reconhecido (ex.: Ramal) cai em telefone, o padrão seguro', () => {
    expect(plataformaContatoPlantao('Ramal')).toBe('telefone');
    expect(plataformaContatoPlantao('Celular pessoal')).toBe('telefone');
  });
});
