import { describe, expect, it } from 'vitest';

import type { AtribuicaoPlantaoPersistida, ParticipantePlantao } from '@escala-ici/contrato';

import {
  aplicarVinculosNasAtribuicoes,
  buscarUsuariosPlantao,
  confirmarVinculoPlantao,
  consolidarParticipantesGrupoPlantao,
  consolidarParticipantesPlantao,
  contarPendenciasVinculoPlantao,
  desfazerVinculoPlantao,
  iniciarVinculosPlantao,
  nomeParticipantePlantao,
  previaPlantaoValidavel,
  vinculosDeCopiaAnterior,
  vinculosDeParticipantesGrupoPlantao,
  type VinculoPlantao,
} from './conciliacaoPlantoes';
import type { Usuario } from './modelos';

function criarUsuario(overrides: Partial<Usuario> & { login: string; nome: string }): Usuario {
  return {
    email: `${overrides.login}@empresa.com`,
    cargo: 'Analista',
    equipeId: 'EQ_COSI',
    gestorUid: null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo: true,
    ...overrides,
  };
}

const USUARIOS_TESTE: Usuario[] = [
  criarUsuario({ login: 'acosta', nome: 'Ana Costa' }),
  criarUsuario({ login: 'blima', nome: 'Bruno Lima' }),
  // Carlos Nunes e Daniela Rocha propositalmente NÃO cadastrados.
];

const RESULTADO_PLANTAO_BASE = {
  atribuicoes: [
    { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-07-25', hora: '00:00' }, fim: { data: '2026-07-26', hora: '19:00' }, duracaoMinutos: 43 * 60, linhaOrigem: 2, abaOrigem: 'PlantaoCOSI' },
    { plantonistaNomeOriginal: 'Bruno Lima', inicio: { data: '2026-07-26', hora: '19:00' }, fim: { data: '2026-07-27', hora: '07:00' }, duracaoMinutos: 12 * 60, linhaOrigem: 3, abaOrigem: 'PlantaoCOSI' },
    { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-07-27', hora: '19:00' }, fim: { data: '2026-07-28', hora: '07:00' }, duracaoMinutos: 12 * 60, linhaOrigem: 4, abaOrigem: 'PlantaoCOSI' },
    { plantonistaNomeOriginal: 'Carlos Nunes', inicio: { data: '2026-07-31', hora: '19:00' }, fim: { data: '2026-08-01', hora: '19:00' }, duracaoMinutos: 24 * 60, linhaOrigem: 5, abaOrigem: 'PlantaoCOSI' },
  ],
  contabilidadeInformada: [
    { plantonistaNomeOriginal: 'Ana Costa', quantidadeInformada: 2, minutosInformados: 55 * 60, valorHorasBruto: '55:0' },
    { plantonistaNomeOriginal: 'Bruno Lima', quantidadeInformada: 1, minutosInformados: 12 * 60, valorHorasBruto: '12:0' },
    { plantonistaNomeOriginal: 'Carlos Nunes', quantidadeInformada: 1, minutosInformados: 24 * 60, valorHorasBruto: '24:0' },
    { plantonistaNomeOriginal: 'Daniela Rocha', quantidadeInformada: 0, minutosInformados: 0, valorHorasBruto: '0' },
  ],
};

describe('consolidarParticipantesPlantao', () => {
  it('1. consolida nomes repetidos em um único participante', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const ana = participantes.find((p) => p.nomeOriginal === 'Ana Costa');
    expect(ana?.quantidadeAtribuicoes).toBe(2);
  });

  it('2. inclui participante presente somente na contabilidade (Daniela Rocha não tem nenhuma atribuição bruta)', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const daniela = participantes.find((p) => p.nomeOriginal === 'Daniela Rocha');
    expect(daniela).toBeDefined();
    expect(daniela?.quantidadeAtribuicoes).toBe(0);
    expect(daniela?.apareceNaContabilidade).toBe(true);
  });

  it('3. participante com 0 plantões informados permanece na lista, não é descartado', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const daniela = participantes.find((p) => p.nomeOriginal === 'Daniela Rocha');
    expect(daniela?.quantidadeInformada).toBe(0);
    expect(daniela?.minutosInformados).toBe(0);
  });

  it('4. preserva o nome original (grafia exata do XLS), nunca normalizado', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    expect(participantes.map((p) => p.nomeOriginal).sort()).toEqual(
      ['Ana Costa', 'Bruno Lima', 'Carlos Nunes', 'Daniela Rocha'].sort(),
    );
  });

  it('resulta em exatamente 4 participantes únicos para a fixture conhecida', () => {
    expect(consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE)).toHaveLength(4);
  });
});

describe('iniciarVinculosPlantao / conciliação exata', () => {
  it('5. uma correspondência exata, única e ativa vincula automaticamente pelo login real', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const vinculos = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const ana = vinculos.find((v) => v.participanteNomeOriginal === 'Ana Costa');
    expect(ana?.login).toBe('acosta');
    expect(ana?.status).toBe('VINCULADO');
    expect(ana?.sugestao).toEqual({ login: 'acosta', nome: 'Ana Costa' });
  });

  it('vincula automaticamente por alias exato da planilha', () => {
    const participantes = [{
      nomeOriginal: 'A. Costa',
      quantidadeAtribuicoes: 1,
      apareceNaContabilidade: true,
      quantidadeInformada: 1,
      minutosInformados: 720,
    }];
    const usuarios = [criarUsuario({
      login: 'acosta',
      nome: 'Ana Costa',
      aliasesPlanilha: ['A. Costa'],
    })];

    expect(iniciarVinculosPlantao(participantes, usuarios)[0]).toMatchObject({
      login: 'acosta',
      status: 'VINCULADO',
    });
  });

  it('não auto vincula correspondência ambígua nem usuário inativo', () => {
    const participantes = [{
      nomeOriginal: 'Pessoa Plantão',
      quantidadeAtribuicoes: 1,
      apareceNaContabilidade: false,
      quantidadeInformada: null,
      minutosInformados: null,
    }];
    const ambiguos = [
      criarUsuario({ login: 'pessoa1', nome: 'Pessoa Um', aliasesPlanilha: ['Pessoa Plantão'] }),
      criarUsuario({ login: 'pessoa2', nome: 'Pessoa Dois', aliasesPlanilha: ['Pessoa Plantão'] }),
    ];
    const inativo = [criarUsuario({
      login: 'pessoa1',
      nome: 'Pessoa Plantão',
      ativo: false,
    })];

    expect(iniciarVinculosPlantao(participantes, ambiguos)[0]).toMatchObject({ login: null, status: 'PENDENTE' });
    expect(iniciarVinculosPlantao(participantes, inativo)[0]).toMatchObject({ login: null, status: 'PENDENTE' });
  });

  it('marca conflito quando dois nomes exatos da fonte resolvem para o mesmo login', () => {
    const participantes = [
      {
        nomeOriginal: 'Ana Costa',
        quantidadeAtribuicoes: 1,
        apareceNaContabilidade: false,
        quantidadeInformada: null,
        minutosInformados: null,
      },
      {
        nomeOriginal: 'A. Costa',
        quantidadeAtribuicoes: 1,
        apareceNaContabilidade: false,
        quantidadeInformada: null,
        minutosInformados: null,
      },
    ];
    const usuarios = [criarUsuario({
      login: 'acosta',
      nome: 'Ana Costa',
      aliasesPlanilha: ['A. Costa'],
    })];

    expect(iniciarVinculosPlantao(participantes, usuarios).map((item) => item.status))
      .toEqual(['CONFLITO', 'CONFLITO']);
  });

  it('7. participante sem nenhum usuário correspondente fica com status USUARIO_NAO_ENCONTRADO, não bloqueado', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const vinculos = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const carlos = vinculos.find((v) => v.participanteNomeOriginal === 'Carlos Nunes');
    expect(carlos?.status).toBe('USUARIO_NAO_ENCONTRADO');
    expect(carlos?.sugestao).toBeNull();
    expect(carlos?.login).toBeNull();
  });
});

describe('confirmarVinculoPlantao / login como identidade', () => {
  it('6. e 8. o vínculo confirmado usa o login do usuário real escolhido, nunca um valor inventado', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const iniciais = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const usuarioAna = USUARIOS_TESTE.find((u) => u.login === 'acosta');
    expect(usuarioAna).toBeDefined();
    const vinculos = confirmarVinculoPlantao(iniciais, 'Ana Costa', usuarioAna as Usuario);
    const ana = vinculos.find((v) => v.participanteNomeOriginal === 'Ana Costa');
    expect(ana?.login).toBe('acosta');
    expect(ana?.status).toBe('VINCULADO');
  });

  it('9. UID nunca é usado como identidade — o tipo VinculoPlantao só tem `login`, nunca um campo de UID', () => {
    const vinculo: VinculoPlantao = {
      participanteNomeOriginal: 'Ana Costa',
      login: 'acosta',
      status: 'VINCULADO',
      sugestao: null,
    };
    expect(Object.keys(vinculo).sort()).toEqual(
      ['login', 'participanteNomeOriginal', 'sugestao', 'status'].sort(),
    );
    expect(Object.keys(vinculo)).not.toContain('uid');
  });

  it('10. dois participantes apontando para o mesmo login geram conflito explícito para ambos', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const iniciais = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const usuarioAna = USUARIOS_TESTE.find((u) => u.login === 'acosta') as Usuario;

    let vinculos = confirmarVinculoPlantao(iniciais, 'Ana Costa', usuarioAna);
    vinculos = confirmarVinculoPlantao(vinculos, 'Daniela Rocha', usuarioAna);

    const ana = vinculos.find((v) => v.participanteNomeOriginal === 'Ana Costa');
    const daniela = vinculos.find((v) => v.participanteNomeOriginal === 'Daniela Rocha');
    expect(ana?.status).toBe('CONFLITO');
    expect(daniela?.status).toBe('CONFLITO');
  });

  it('desfazer um dos dois lados do conflito libera o outro de volta para VINCULADO', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const iniciais = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const usuarioAna = USUARIOS_TESTE.find((u) => u.login === 'acosta') as Usuario;

    let vinculos = confirmarVinculoPlantao(iniciais, 'Ana Costa', usuarioAna);
    vinculos = confirmarVinculoPlantao(vinculos, 'Daniela Rocha', usuarioAna);
    vinculos = desfazerVinculoPlantao(vinculos, 'Daniela Rocha');

    const ana = vinculos.find((v) => v.participanteNomeOriginal === 'Ana Costa');
    const daniela = vinculos.find((v) => v.participanteNomeOriginal === 'Daniela Rocha');
    expect(ana?.status).toBe('VINCULADO');
    expect(daniela?.login).toBeNull();
  });
});

describe('previaPlantaoValidavel', () => {
  it('11. todos vinculados permite validar a prévia', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const usuarios = [
      ...USUARIOS_TESTE,
      criarUsuario({ login: 'cnunes', nome: 'Carlos Nunes' }),
      criarUsuario({ login: 'drocha', nome: 'Daniela Rocha' }),
    ];
    const loginPorNome = new Map([
      ['Ana Costa', 'acosta'],
      ['Bruno Lima', 'blima'],
      ['Carlos Nunes', 'cnunes'],
      ['Daniela Rocha', 'drocha'],
    ]);

    let vinculos = iniciarVinculosPlantao(participantes, usuarios);
    for (const participante of participantes) {
      const usuario = usuarios.find((u) => u.login === loginPorNome.get(participante.nomeOriginal)) as Usuario;
      vinculos = confirmarVinculoPlantao(vinculos, participante.nomeOriginal, usuario);
    }
    expect(contarPendenciasVinculoPlantao(vinculos)).toBe(0);
    expect(previaPlantaoValidavel(vinculos)).toBe(true);
  });

  it('12. um participante pendente impede a validação (4 participantes, 3 vinculados, 1 pendente)', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const vinculos = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    expect(previaPlantaoValidavel(vinculos)).toBe(false);
    expect(contarPendenciasVinculoPlantao(vinculos)).toBeGreaterThan(0);
  });

  it('lista vazia de vínculos nunca é considerada validável', () => {
    expect(previaPlantaoValidavel([])).toBe(false);
  });
});

describe('aplicarVinculosNasAtribuicoes', () => {
  it('13. confirmar o vínculo de um participante atualiza TODAS as atribuições dele automaticamente', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const iniciais = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const usuarioAna = USUARIOS_TESTE.find((u) => u.login === 'acosta') as Usuario;
    const vinculos = confirmarVinculoPlantao(iniciais, 'Ana Costa', usuarioAna);

    const atribuicoesComVinculo = aplicarVinculosNasAtribuicoes(RESULTADO_PLANTAO_BASE.atribuicoes, vinculos);
    const linhasDeAna = atribuicoesComVinculo.filter((a) => a.plantonistaNomeOriginal === 'Ana Costa');
    expect(linhasDeAna).toHaveLength(2);
    expect(linhasDeAna.every((linha) => linha.loginVinculado === 'acosta' && linha.statusVinculo === 'VINCULADO')).toBe(true);
  });

  it('14. a quantidade de atribuições não muda depois da conciliação', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const vinculos = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const atribuicoesComVinculo = aplicarVinculosNasAtribuicoes(RESULTADO_PLANTAO_BASE.atribuicoes, vinculos);
    expect(atribuicoesComVinculo).toHaveLength(RESULTADO_PLANTAO_BASE.atribuicoes.length);
  });

  it('15. a duração bruta de cada atribuição não muda depois da conciliação', () => {
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    const vinculos = iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const atribuicoesComVinculo = aplicarVinculosNasAtribuicoes(RESULTADO_PLANTAO_BASE.atribuicoes, vinculos);
    const total = atribuicoesComVinculo.reduce((soma, a) => soma + a.duracaoMinutos, 0);
    const totalOriginal = RESULTADO_PLANTAO_BASE.atribuicoes.reduce((soma, a) => soma + a.duracaoMinutos, 0);
    expect(total).toBe(totalOriginal);
  });

  it('16. os minutos informados na contabilidade não são tocados pela conciliação de vínculos', () => {
    // A conciliação de login nunca lê nem escreve `contabilidadeInformada` — só
    // anota vínculo nas atribuições brutas. Prova: o objeto de entrada
    // permanece intacto (nenhuma função de conciliação recebe/retorna
    // `contabilidadeInformada`).
    const totalMinutosInformadosAntes = RESULTADO_PLANTAO_BASE.contabilidadeInformada
      .reduce((soma, linha) => soma + linha.minutosInformados, 0);
    const participantes = consolidarParticipantesPlantao(RESULTADO_PLANTAO_BASE);
    iniciarVinculosPlantao(participantes, USUARIOS_TESTE);
    const totalMinutosInformadosDepois = RESULTADO_PLANTAO_BASE.contabilidadeInformada
      .reduce((soma, linha) => soma + linha.minutosInformados, 0);
    expect(totalMinutosInformadosDepois).toBe(totalMinutosInformadosAntes);
  });
});

describe('buscarUsuariosPlantao', () => {
  it('busca por nome (parcial, acento/caixa insensível)', () => {
    const resultado = buscarUsuariosPlantao(USUARIOS_TESTE, 'ana');
    expect(resultado.map((u) => u.login)).toEqual(['acosta']);
  });

  it('busca por login', () => {
    const resultado = buscarUsuariosPlantao(USUARIOS_TESTE, 'blima');
    expect(resultado.map((u) => u.login)).toEqual(['blima']);
  });

  it('termo vazio retorna todos os usuários', () => {
    expect(buscarUsuariosPlantao(USUARIOS_TESTE, '')).toHaveLength(USUARIOS_TESTE.length);
  });
});

function participantePlantao(overrides: Partial<ParticipantePlantao> & { login: string }): ParticipantePlantao {
  return {
    grupoId: 'PLANTAO_SEGURANCA',
    ativo: true,
    contatos: [],
    schemaVersion: 1,
    criadoPorLogin: 'gestor1',
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('nomeParticipantePlantao — Fase ESCALAS-UX-1B', () => {
  it('resolve o nome do usuário cadastrado pelo login', () => {
    expect(nomeParticipantePlantao(participantePlantao({ login: 'acosta' }), USUARIOS_TESTE)).toBe('Ana Costa');
  });

  it('cai no próprio login quando o usuário não é encontrado (nunca lança, nunca inventa nome)', () => {
    expect(nomeParticipantePlantao(participantePlantao({ login: 'usuario-removido' }), USUARIOS_TESTE)).toBe('usuario-removido');
  });
});

describe('consolidarParticipantesGrupoPlantao — Fase ESCALAS-UX-1B (escala manual, sem XLS)', () => {
  const PARTICIPANTES_ATIVOS: ParticipantePlantao[] = [
    participantePlantao({ login: 'acosta' }),
    participantePlantao({ login: 'blima' }),
  ];

  it('consolida a partir dos participantes ATIVOS do grupo, nunca da contabilidade (que não existe)', () => {
    const participantes = consolidarParticipantesGrupoPlantao(PARTICIPANTES_ATIVOS, USUARIOS_TESTE, []);
    expect(participantes.map((p) => p.nomeOriginal).sort()).toEqual(['Ana Costa', 'Bruno Lima']);
    expect(participantes.every((p) => !p.apareceNaContabilidade)).toBe(true);
    expect(participantes.every((p) => p.quantidadeInformada === null)).toBe(true);
  });

  it('participante sem nenhuma atribuição ainda continua visível como 0 plantões (não é descartado)', () => {
    const participantes = consolidarParticipantesGrupoPlantao(PARTICIPANTES_ATIVOS, USUARIOS_TESTE, []);
    expect(participantes.every((p) => p.quantidadeAtribuicoes === 0)).toBe(true);
  });

  it('conta atribuições da working copy atual por pessoa', () => {
    const atribuicoes = [
      { plantonistaNomeOriginal: 'Ana Costa', inicio: { data: '2026-08-01', hora: '19:00' }, fim: { data: '2026-08-02', hora: '07:00' }, duracaoMinutos: 720, linhaOrigem: -1, abaOrigem: '' },
    ];
    const participantes = consolidarParticipantesGrupoPlantao(PARTICIPANTES_ATIVOS, USUARIOS_TESTE, atribuicoes);
    expect(participantes.find((p) => p.nomeOriginal === 'Ana Costa')?.quantidadeAtribuicoes).toBe(1);
    expect(participantes.find((p) => p.nomeOriginal === 'Bruno Lima')?.quantidadeAtribuicoes).toBe(0);
  });

  it('participantes inativos não entram na consolidação (o chamador filtra por ativo antes)', () => {
    const comInativo = [...PARTICIPANTES_ATIVOS, participantePlantao({ login: 'cnunes', ativo: false })];
    const participantes = consolidarParticipantesGrupoPlantao(
      comInativo.filter((p) => p.ativo),
      USUARIOS_TESTE,
      [],
    );
    expect(participantes).toHaveLength(2);
  });
});

describe('vinculosDeParticipantesGrupoPlantao — Fase ESCALAS-UX-1B', () => {
  it('todo participante ativo do grupo nasce VINCULADO — nenhuma conciliação nome→login necessária', () => {
    const vinculos = vinculosDeParticipantesGrupoPlantao(
      [participantePlantao({ login: 'acosta' }), participantePlantao({ login: 'blima' })],
      USUARIOS_TESTE,
    );
    expect(vinculos.every((v) => v.status === 'VINCULADO')).toBe(true);
    expect(vinculos.every((v) => v.sugestao === null)).toBe(true);
    expect(vinculos.map((v) => v.login).sort()).toEqual(['acosta', 'blima']);
  });

  it('previaPlantaoValidavel já retorna true para essa lista, sem nenhuma mudança de lógica', () => {
    const vinculos = vinculosDeParticipantesGrupoPlantao([participantePlantao({ login: 'acosta' })], USUARIOS_TESTE);
    expect(previaPlantaoValidavel(vinculos)).toBe(true);
  });

  it('grupo sem nenhum participante ativo produz lista vazia — previaPlantaoValidavel corretamente fica false', () => {
    const vinculos = vinculosDeParticipantesGrupoPlantao([], USUARIOS_TESTE);
    expect(vinculos).toEqual([]);
    expect(previaPlantaoValidavel(vinculos)).toBe(false);
  });
});

function atribuicaoPersistida(overrides: Partial<AtribuicaoPlantaoPersistida> & { plantonistaLogin: string }): AtribuicaoPlantaoPersistida {
  return {
    atribuicaoId: '0001',
    grupoId: 'PLANTAO_SEGURANCA',
    competenciaId: 'PLANTAO_SEGURANCA_2026-07',
    inicio: '2026-06-26T22:00:00.000Z',
    fim: '2026-06-27T10:00:00.000Z',
    duracaoMinutos: 720,
    papel: 'PRIMARIO',
    origem: 'MANUAL',
    revisao: 0,
    schemaVersion: 1,
    criadoEm: '2026-07-01T00:00:00.000Z',
    atualizadoEm: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('vinculosDeCopiaAnterior — Fase ESCALAS-UX-1C ("Usar período anterior")', () => {
  it('login que ainda é participante ATIVO nasce VINCULADO automaticamente — identidade já conhecida com certeza', () => {
    const vinculos = vinculosDeCopiaAnterior(
      [atribuicaoPersistida({ plantonistaLogin: 'acosta' })],
      [participantePlantao({ login: 'acosta' })],
      USUARIOS_TESTE,
    );
    expect(vinculos).toEqual([{ participanteNomeOriginal: 'Ana Costa', login: 'acosta', status: 'VINCULADO', sugestao: null }]);
  });

  it('login que existe como usuário mas não é (mais) participante ativo deste Grupo vira PENDENTE com sugestão para o próprio login — nunca troca automaticamente por outra pessoa', () => {
    const vinculos = vinculosDeCopiaAnterior(
      [atribuicaoPersistida({ plantonistaLogin: 'blima' })],
      [], // Bruno Lima não é (mais) participante ativo
      USUARIOS_TESTE,
    );
    expect(vinculos).toEqual([{
      participanteNomeOriginal: 'Bruno Lima',
      login: null,
      status: 'PENDENTE',
      sugestao: { login: 'blima', nome: 'Bruno Lima' },
    }]);
  });

  it('login sem nenhum usuário cadastrado vira USUARIO_NAO_ENCONTRADO, nunca inventa um nome', () => {
    const vinculos = vinculosDeCopiaAnterior(
      [atribuicaoPersistida({ plantonistaLogin: 'usuario-removido' })],
      [],
      USUARIOS_TESTE,
    );
    expect(vinculos).toEqual([{
      participanteNomeOriginal: 'usuario-removido',
      login: null,
      status: 'USUARIO_NAO_ENCONTRADO',
      sugestao: null,
    }]);
  });

  it('logins duplicados na competência anterior viram um único vínculo (dedup por login)', () => {
    const vinculos = vinculosDeCopiaAnterior(
      [atribuicaoPersistida({ plantonistaLogin: 'acosta' }), atribuicaoPersistida({ plantonistaLogin: 'acosta', atribuicaoId: '0002' })],
      [participantePlantao({ login: 'acosta' })],
      USUARIOS_TESTE,
    );
    expect(vinculos).toHaveLength(1);
  });

  it('um vínculo PENDENTE de participante inativo bloqueia previaPlantaoValidavel — o coordenador precisa decidir antes de salvar', () => {
    const vinculos = vinculosDeCopiaAnterior(
      [atribuicaoPersistida({ plantonistaLogin: 'blima' })],
      [],
      USUARIOS_TESTE,
    );
    expect(previaPlantaoValidavel(vinculos)).toBe(false);
  });
});
