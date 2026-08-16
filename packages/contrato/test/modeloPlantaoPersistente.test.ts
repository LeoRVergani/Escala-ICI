import { describe, expect, it } from 'vitest';

import {
  converterInstanteUtcParaMomento,
  converterMomentoParaInstanteUtc,
  equipesConsultaEfetivas,
  idAtribuicaoPlantao,
  idCompetenciaPlantao,
  idGrupoPlantaoValido,
  normalizarContatosPlantonista,
  timezoneValida,
  validarAtribuicaoPlantaoPersistida,
  validarCompetenciaPlantao,
  validarContatosPlantonista,
  validarGrupoPlantao,
  validarParticipantePlantao,
} from '../src/index.js';

const GRUPO_VALIDO = {
  grupoId: 'PLANTAO_SEGURANCA',
  nome: 'Plantão de Segurança',
  equipeResponsavelId: 'EQ_COSI',
  equipesConsulta: ['EQ_COSI', 'EQ_SOC', 'EQ_NOC'],
  timezone: 'America/Sao_Paulo',
};

describe('validarGrupoPlantao', () => {
  it('1. grupo válido não gera nenhum erro', () => {
    expect(validarGrupoPlantao(GRUPO_VALIDO)).toEqual([]);
  });

  it('2. grupo sem nome é inválido', () => {
    const erros = validarGrupoPlantao({ ...GRUPO_VALIDO, nome: '   ' });
    expect(erros.some((e) => e.includes('nome'))).toBe(true);
  });

  it('3. grupo sem equipe responsável é inválido', () => {
    const erros = validarGrupoPlantao({ ...GRUPO_VALIDO, equipeResponsavelId: '' });
    expect(erros.some((e) => e.includes('equipe responsável'))).toBe(true);
  });

  it('4. timezone inválida é rejeitada', () => {
    const erros = validarGrupoPlantao({ ...GRUPO_VALIDO, timezone: 'Nao/Existe' });
    expect(erros.some((e) => e.includes('Timezone'))).toBe(true);
    expect(timezoneValida('Nao/Existe')).toBe(false);
    expect(timezoneValida('America/Sao_Paulo')).toBe(true);
  });

  it('grupo cuja equipe responsável não está em equipesConsulta é inválido', () => {
    const erros = validarGrupoPlantao({ ...GRUPO_VALIDO, equipesConsulta: ['EQ_SOC'] });
    expect(erros.some((e) => e.includes('autorizadas a consultar'))).toBe(true);
  });
});

describe('5. equipesConsultaEfetivas — visibilidade duplicada normalizada', () => {
  it('sempre inclui a equipe responsável, mesmo se ausente da lista explícita', () => {
    expect(equipesConsultaEfetivas('EQ_COSI', ['EQ_SOC'])).toEqual(
      expect.arrayContaining(['EQ_COSI', 'EQ_SOC']),
    );
  });

  it('remove duplicatas (equipe responsável repetida na lista explícita)', () => {
    const resultado = equipesConsultaEfetivas('EQ_COSI', ['EQ_COSI', 'EQ_SOC', 'EQ_COSI', 'EQ_SOC']);
    expect(resultado.sort()).toEqual(['EQ_COSI', 'EQ_SOC'].sort());
    expect(new Set(resultado).size).toBe(resultado.length);
  });

  it('sem lista explícita, resulta só na equipe responsável', () => {
    expect(equipesConsultaEfetivas('EQ_COSI')).toEqual(['EQ_COSI']);
  });

  it('ignora entradas vazias/whitespace na lista explícita', () => {
    expect(equipesConsultaEfetivas('EQ_COSI', ['  ', 'EQ_SOC', ''])).toEqual(
      expect.arrayContaining(['EQ_COSI', 'EQ_SOC']),
    );
    expect(equipesConsultaEfetivas('EQ_COSI', ['  ', 'EQ_SOC', ''])).toHaveLength(2);
  });
});

describe('validarParticipantePlantao', () => {
  it('6. participante válido não gera nenhum erro', () => {
    expect(validarParticipantePlantao({
      grupoId: 'PLANTAO_SEGURANCA',
      login: 'acosta',
      contatos: [],
    })).toEqual([]);
  });

  it('7. login vazio é inválido', () => {
    const erros = validarParticipantePlantao({ grupoId: 'PLANTAO_SEGURANCA', login: '  ', contatos: [] });
    expect(erros.some((e) => e.includes('login'))).toBe(true);
  });
});

describe('validarContatosPlantonista — máximo 3, rótulo/número obrigatórios', () => {
  const contato = (rotulo: string, numero: string) => ({ rotulo, numero, ativo: true });

  it('8. zero contatos é permitido', () => {
    expect(validarContatosPlantonista([])).toEqual([]);
  });

  it('9. um contato válido é permitido', () => {
    expect(validarContatosPlantonista([contato('Celular corporativo', '11999990000')])).toEqual([]);
  });

  it('10. dois contatos válidos são permitidos', () => {
    expect(validarContatosPlantonista([
      contato('Celular corporativo', '11999990000'),
      contato('Ramal', '4321'),
    ])).toEqual([]);
  });

  it('11. três contatos válidos são permitidos', () => {
    expect(validarContatosPlantonista([
      contato('Celular corporativo', '11999990000'),
      contato('Celular alternativo', '+5511988887777'),
      contato('Ramal', '4321'),
    ])).toEqual([]);
  });

  it('12. quatro contatos é inválido', () => {
    const erros = validarContatosPlantonista([
      contato('A', '1'), contato('B', '2'), contato('C', '3'), contato('D', '4'),
    ]);
    expect(erros.some((e) => e.includes('No máximo 3'))).toBe(true);
  });

  it('13. rótulo vazio é inválido', () => {
    const erros = validarContatosPlantonista([contato('   ', '11999990000')]);
    expect(erros.some((e) => e.includes('rótulo'))).toBe(true);
  });

  it('14. número vazio é inválido', () => {
    const erros = validarContatosPlantonista([contato('Celular', '   ')]);
    expect(erros.some((e) => e.includes('número'))).toBe(true);
  });

  it('15. espaços são normalizados (nunca gravados com espaço extra)', () => {
    const normalizados = normalizarContatosPlantonista([
      contato('  Celular corporativo  ', '  11 99999-0000  '),
    ]);
    expect(normalizados).toEqual([
      { rotulo: 'Celular corporativo', numero: '11 99999-0000', ativo: true },
    ]);
  });

  it('aceita ramal e formato internacional, sem validar operadora nem formato brasileiro fixo', () => {
    expect(validarContatosPlantonista([contato('Ramal', '4321')])).toEqual([]);
    expect(validarContatosPlantonista([contato('Celular alternativo', '+55 11 98888-7777')])).toEqual([]);
  });
});

describe('validarAtribuicaoPlantaoPersistida', () => {
  const base = {
    plantonistaLogin: 'acosta',
    origem: 'IMPORTADO',
    papel: 'PRIMARIO',
  };

  it('16. atribuição de 12h é válida', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z',
      duracaoMinutos: 12 * 60,
    });
    expect(erros).toEqual([]);
  });

  it('17. atribuição de 24h é válida', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      inicio: '2026-07-31T22:00:00.000Z',
      fim: '2026-08-01T22:00:00.000Z',
      duracaoMinutos: 24 * 60,
    });
    expect(erros).toEqual([]);
  });

  it('18. atribuição que vira o dia (calculada via timezone) é válida', () => {
    const inicio = converterMomentoParaInstanteUtc({ data: '2026-07-26', hora: '19:00' }, 'America/Sao_Paulo');
    const fim = converterMomentoParaInstanteUtc({ data: '2026-07-27', hora: '07:00' }, 'America/Sao_Paulo');
    const erros = validarAtribuicaoPlantaoPersistida({ ...base, inicio, fim, duracaoMinutos: 12 * 60 });
    expect(erros).toEqual([]);
    expect(new Date(fim).getTime() - new Date(inicio).getTime()).toBe(12 * 60 * 60 * 1000);
  });

  it('19. fim anterior ou igual ao início é inválido', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      inicio: '2026-07-27T10:00:00.000Z',
      fim: '2026-07-26T22:00:00.000Z',
      duracaoMinutos: 12 * 60,
    });
    expect(erros.some((e) => e.includes('posterior'))).toBe(true);
  });

  it('20. login ausente é inválido', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      plantonistaLogin: '',
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z',
      duracaoMinutos: 12 * 60,
    });
    expect(erros.some((e) => e.includes('login'))).toBe(true);
  });

  it('21. origem válida (IMPORTADO/MANUAL/GERADO) não gera erro', () => {
    for (const origem of ['IMPORTADO', 'MANUAL', 'GERADO']) {
      const erros = validarAtribuicaoPlantaoPersistida({
        ...base,
        origem,
        inicio: '2026-07-26T22:00:00.000Z',
        fim: '2026-07-27T10:00:00.000Z',
        duracaoMinutos: 12 * 60,
      });
      expect(erros).toEqual([]);
    }
  });

  it('22. origem desconhecida é inválida', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      origem: 'INVENTADA',
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z',
      duracaoMinutos: 12 * 60,
    });
    expect(erros.some((e) => e.includes('Origem desconhecida'))).toBe(true);
  });

  it('não permite duração inconsistente com o intervalo (nunca usa duração como fonte da verdade)', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z', // 12h reais
      duracaoMinutos: 24 * 60, // campo divergente
    });
    expect(erros.some((e) => e.includes('Duração inconsistente'))).toBe(true);
  });

  it('papel desconhecido é inválido', () => {
    const erros = validarAtribuicaoPlantaoPersistida({
      ...base,
      papel: 'TERCIARIO',
      inicio: '2026-07-26T22:00:00.000Z',
      fim: '2026-07-27T10:00:00.000Z',
      duracaoMinutos: 12 * 60,
    });
    expect(erros.some((e) => e.includes('Papel desconhecido'))).toBe(true);
  });
});

describe('23. validarCompetenciaPlantao', () => {
  const base = {
    grupoId: 'PLANTAO_SEGURANCA',
    competencia: '2026-08',
    periodoInicio: '2026-07-26',
    periodoFim: '2026-08-25',
    status: 'RASCUNHO',
    origem: 'IMPORTADO',
  };

  it('competência RASCUNHO válida não gera erro', () => {
    expect(validarCompetenciaPlantao(base)).toEqual([]);
  });

  it('competência inválida (formato errado) gera erro', () => {
    expect(validarCompetenciaPlantao({ ...base, competencia: '08/2026' })
      .some((e) => e.includes('Competência'))).toBe(true);
  });

  it('status desconhecido gera erro', () => {
    expect(validarCompetenciaPlantao({ ...base, status: 'ARQUIVADA' })
      .some((e) => e.includes('Status desconhecido'))).toBe(true);
  });
});

describe('IDs determinísticos', () => {
  it('idGrupoPlantaoValido aceita letras/números/"_"/"-", rejeita "/" e vazio', () => {
    expect(idGrupoPlantaoValido('PLANTAO_SEGURANCA')).toBe(true);
    expect(idGrupoPlantaoValido('plantao-redes-2')).toBe(true);
    expect(idGrupoPlantaoValido('')).toBe(false);
    expect(idGrupoPlantaoValido('plantao/seguranca')).toBe(false);
  });

  it('idCompetenciaPlantao combina grupoId + competência de forma determinística', () => {
    expect(idCompetenciaPlantao('PLANTAO_SEGURANCA', '2026-08')).toBe('PLANTAO_SEGURANCA_2026-08');
  });

  it('idCompetenciaPlantao rejeita grupoId ou competência inválidos', () => {
    expect(() => idCompetenciaPlantao('plantao/seguranca', '2026-08')).toThrow();
    expect(() => idCompetenciaPlantao('PLANTAO_SEGURANCA', '08-2026')).toThrow();
  });

  it('idAtribuicaoPlantao é determinístico e ordenável', () => {
    expect(idAtribuicaoPlantao(0)).toBe('0001');
    expect(idAtribuicaoPlantao(31)).toBe('0032');
    expect(() => idAtribuicaoPlantao(-1)).toThrow();
  });
});

describe('converterMomentoParaInstanteUtc — timezone determinística, sem depender do relógio da máquina', () => {
  it('19:00 em America/Sao_Paulo vira 22:00 UTC (UTC-3, sem horário de verão desde 2019)', () => {
    const instante = converterMomentoParaInstanteUtc({ data: '2026-07-25', hora: '19:00' }, 'America/Sao_Paulo');
    expect(instante).toBe('2026-07-25T22:00:00.000Z');
  });

  it('07:00 em America/Sao_Paulo vira 10:00 UTC', () => {
    const instante = converterMomentoParaInstanteUtc({ data: '2026-07-26', hora: '07:00' }, 'America/Sao_Paulo');
    expect(instante).toBe('2026-07-26T10:00:00.000Z');
  });

  it('00:00 vira 03:00 UTC do mesmo dia (São Paulo está atrás de UTC)', () => {
    const instante = converterMomentoParaInstanteUtc({ data: '2026-07-25', hora: '00:00' }, 'America/Sao_Paulo');
    expect(instante).toBe('2026-07-25T03:00:00.000Z');
  });

  it('23:00 vira 02:00 UTC do dia seguinte — a conversão pode mudar a data, não só a hora', () => {
    const instante = converterMomentoParaInstanteUtc({ data: '2026-07-25', hora: '23:00' }, 'America/Sao_Paulo');
    expect(instante).toBe('2026-07-26T02:00:00.000Z');
  });

  it('mesma entrada produz sempre o mesmo resultado (determinística), independente de quando/onde rodar', () => {
    const a = converterMomentoParaInstanteUtc({ data: '2026-08-25', hora: '19:00' }, 'America/Sao_Paulo');
    const b = converterMomentoParaInstanteUtc({ data: '2026-08-25', hora: '19:00' }, 'America/Sao_Paulo');
    expect(a).toBe(b);
  });

  it('rejeita timezone inválida', () => {
    expect(() => converterMomentoParaInstanteUtc({ data: '2026-08-25', hora: '19:00' }, 'Nao/Existe')).toThrow();
  });

  it('rejeita momento malformado', () => {
    expect(() => converterMomentoParaInstanteUtc({ data: '2026-13-99', hora: '19:00' }, 'America/Sao_Paulo')).toThrow();
  });
});

describe('converterInstanteUtcParaMomento — Fase ESCALAS-UX-1B.1 (operação inversa, para reabrir um rascunho)', () => {
  it('22:00 UTC em America/Sao_Paulo volta a ser 19:00 (o inverso exato do primeiro teste acima)', () => {
    const momento = converterInstanteUtcParaMomento('2026-07-25T22:00:00.000Z', 'America/Sao_Paulo');
    expect(momento).toEqual({ data: '2026-07-25', hora: '19:00' });
  });

  it('10:00 UTC volta a ser 07:00', () => {
    const momento = converterInstanteUtcParaMomento('2026-07-26T10:00:00.000Z', 'America/Sao_Paulo');
    expect(momento).toEqual({ data: '2026-07-26', hora: '07:00' });
  });

  it('03:00 UTC volta a ser 00:00 do mesmo dia civil', () => {
    const momento = converterInstanteUtcParaMomento('2026-07-25T03:00:00.000Z', 'America/Sao_Paulo');
    expect(momento).toEqual({ data: '2026-07-25', hora: '00:00' });
  });

  it('02:00 UTC do dia seguinte volta a ser 23:00 do dia anterior — a virada de dia também é revertida', () => {
    const momento = converterInstanteUtcParaMomento('2026-07-26T02:00:00.000Z', 'America/Sao_Paulo');
    expect(momento).toEqual({ data: '2026-07-25', hora: '23:00' });
  });

  it('duração de 12h (plantão comum) preservada no round-trip: início e fim revertidos batem com o original', () => {
    const inicioUtc = converterMomentoParaInstanteUtc({ data: '2026-07-26', hora: '19:00' }, 'America/Sao_Paulo');
    const fimUtc = converterMomentoParaInstanteUtc({ data: '2026-07-27', hora: '07:00' }, 'America/Sao_Paulo');
    expect(converterInstanteUtcParaMomento(inicioUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-07-26', hora: '19:00' });
    expect(converterInstanteUtcParaMomento(fimUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-07-27', hora: '07:00' });
  });

  it('duração de 24h preservada no round-trip', () => {
    const inicioUtc = converterMomentoParaInstanteUtc({ data: '2026-07-31', hora: '19:00' }, 'America/Sao_Paulo');
    const fimUtc = converterMomentoParaInstanteUtc({ data: '2026-08-01', hora: '19:00' }, 'America/Sao_Paulo');
    expect(converterInstanteUtcParaMomento(inicioUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-07-31', hora: '19:00' });
    expect(converterInstanteUtcParaMomento(fimUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-08-01', hora: '19:00' });
  });

  it('borda real de 43h (fixture) preservada exatamente — nunca normalizada no round-trip', () => {
    const inicioUtc = converterMomentoParaInstanteUtc({ data: '2026-07-25', hora: '00:00' }, 'America/Sao_Paulo');
    const fimUtc = converterMomentoParaInstanteUtc({ data: '2026-07-26', hora: '19:00' }, 'America/Sao_Paulo');
    expect(converterInstanteUtcParaMomento(inicioUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-07-25', hora: '00:00' });
    expect(converterInstanteUtcParaMomento(fimUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-07-26', hora: '19:00' });
  });

  it('borda real de 5h (fixture) preservada exatamente — nunca normalizada no round-trip', () => {
    const inicioUtc = converterMomentoParaInstanteUtc({ data: '2026-08-25', hora: '19:00' }, 'America/Sao_Paulo');
    const fimUtc = converterMomentoParaInstanteUtc({ data: '2026-08-26', hora: '00:00' }, 'America/Sao_Paulo');
    expect(converterInstanteUtcParaMomento(inicioUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-08-25', hora: '19:00' });
    expect(converterInstanteUtcParaMomento(fimUtc, 'America/Sao_Paulo')).toEqual({ data: '2026-08-26', hora: '00:00' });
  });

  it('rejeita timezone inválida — nunca cai silenciosamente na timezone da máquina', () => {
    expect(() => converterInstanteUtcParaMomento('2026-08-25T22:00:00.000Z', 'Nao/Existe')).toThrow();
  });

  it('rejeita instante UTC malformado', () => {
    expect(() => converterInstanteUtcParaMomento('não-é-uma-data', 'America/Sao_Paulo')).toThrow();
  });

  it('mesma entrada produz sempre o mesmo resultado (determinística)', () => {
    const a = converterInstanteUtcParaMomento('2026-08-25T22:00:00.000Z', 'America/Sao_Paulo');
    const b = converterInstanteUtcParaMomento('2026-08-25T22:00:00.000Z', 'America/Sao_Paulo');
    expect(a).toEqual(b);
  });

  it('round-trip civil→UTC→civil resulta no momento original para várias horas e timezones — nunca depende do relógio/timezone da máquina', () => {
    const casos: Array<{ momento: { data: string; hora: string }; timezone: string }> = [
      { momento: { data: '2026-01-01', hora: '00:00' }, timezone: 'America/Sao_Paulo' },
      { momento: { data: '2026-06-15', hora: '12:00' }, timezone: 'America/Sao_Paulo' },
      { momento: { data: '2026-12-31', hora: '23:59' }, timezone: 'America/Sao_Paulo' },
      { momento: { data: '2026-08-25', hora: '19:00' }, timezone: 'UTC' },
      { momento: { data: '2026-08-25', hora: '19:00' }, timezone: 'America/New_York' },
      { momento: { data: '2026-08-25', hora: '19:00' }, timezone: 'Asia/Tokyo' },
    ];
    for (const caso of casos) {
      const instanteUtc = converterMomentoParaInstanteUtc(caso.momento, caso.timezone);
      const devolta = converterInstanteUtcParaMomento(instanteUtc, caso.timezone);
      expect(devolta, `${JSON.stringify(caso.momento)} em ${caso.timezone}`).toEqual(caso.momento);
    }
  });
});

// 24. "schema não aceita undefined" é verificado onde o schema realmente
// encontra o SDK do Firestore — lib/firebase/plantaoWriteRepository.test.ts
// (`removerUndefined()` antes de qualquer `setDoc`/`updateDoc`), não aqui:
// este módulo é puro e não decide serialização, só validação/conversão.
