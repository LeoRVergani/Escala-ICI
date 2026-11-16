import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import { adicionarDias } from '@escala-ici/contrato';
import { detectarDescansoInsuficiente, detectarSequencias6x1 } from './alertasEscala';
import {
  agruparProblemasPorPessoa, avaliarRegras, copiarComoRascunho, novaRegraEmBranco, testarRegra, variaveisDaRegra, variaveisPorCategoria, bloqueiaPublicacaoPorRegra, construirContextoDias, diferencaDeProblemas, fraseDaRegra, indexarProblemasPorCelula, renderizarMensagem, validarRegra,
  type RegraEscala,
} from './regrasEscala';
import { EXEMPLOS_REGRA } from './regrasExemplos';
import { REGRAS_PADRAO } from './regrasPadrao';

function dia(codigo: string, manual?: { i: string; f: string; vd: boolean; m: number }): Dia {
  const tipo = CATALOGO_SOC[codigo]!;
  return manual
    ? { c: codigo, i: manual.i, f: manual.f, m: manual.m, vd: manual.vd }
    : { c: codigo, i: tipo.horaInicio, f: tipo.horaFim, m: tipo.duracaoMinutos, vd: tipo.viraDia };
}

function documento(dias: Record<string, Dia>, login = 'ana', equipeId = 'EQ_SOC'): TurnosMes {
  const datas = Object.keys(dias).sort();
  return {
    schemaVersion: 1, usuarioUid: `uid-${login}`, login, equipeId, competencia: '2026-08',
    periodoInicio: datas[0]!, periodoFim: datas.at(-1)!, turnoPadrao: 'MD', status: 'RASCUNHO', dias,
    totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  } as TurnosMes;
}

function sequenciaDeDias(codigos: string[], inicio = '2026-08-03'): Record<string, Dia> {
  const dias: Record<string, Dia> = {};
  codigos.forEach((codigo, indice) => { dias[adicionarDias(inicio, indice)] = dia(codigo); });
  return dias;
}

// gerador pseudoaleatório determinístico (mulberry32)
function aleatorio(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODIGOS_TRABALHO = Object.keys(CATALOGO_SOC).filter((codigo) => ['TRABALHO', 'PLANTAO', 'EXTRA'].includes(CATALOGO_SOC[codigo]!.categoria));
const CODIGOS_OUTROS = Object.keys(CATALOGO_SOC).filter((codigo) => !CODIGOS_TRABALHO.includes(codigo));
const hora = (n: number) => `${String(n).padStart(2, '0')}:00`;

function escalaAleatoria(semente: number): TurnosMes[] {
  const sorteio = aleatorio(semente);
  // cada pessoa tem uma "taxa de trabalho" diferente: assim saem sequências longas E folgas variadas
  const documentos: TurnosMes[] = [];
  for (let pessoa = 0; pessoa < 3; pessoa += 1) {
    const taxaTrabalho = 0.55 + sorteio() * 0.42;
    const dias: Record<string, Dia> = {};
    for (let indice = 0; indice < 35; indice += 1) {
      const lista = sorteio() < taxaTrabalho ? CODIGOS_TRABALHO : CODIGOS_OUTROS;
      const codigo = lista[Math.floor(sorteio() * lista.length)]!;
      const tipo = CATALOGO_SOC[codigo]!;
      const manual = tipo.horaInicio !== undefined && sorteio() < 0.12
        ? (() => { const inicio = Math.floor(sorteio() * 24); const duracao = 4 + Math.floor(sorteio() * 9); const fim = (inicio + duracao) % 24; return { i: hora(inicio), f: hora(fim), vd: fim <= inicio, m: duracao * 60 }; })()
        : undefined;
      dias[adicionarDias('2026-08-01', indice)] = dia(codigo, manual);
    }
    documentos.push(documento(dias, `pessoa${pessoa}`));
  }
  return documentos;
}

describe('REGRAS-ESCALA-1 — equivalência com o motor de alertas atual', () => {
  it('300 escalas aleatórias: as 3 regras padrão geram EXATAMENTE os mesmos alertas de antes', () => {
    let totalSequencias = 0;
    let totalDescansos = 0;
    for (let semente = 1; semente <= 300; semente += 1) {
      const documentos = escalaAleatoria(semente);
      const novos = avaliarRegras(documentos, CATALOGO_SOC, REGRAS_PADRAO);

      const antigosSeq = documentos.flatMap((doc) => detectarSequencias6x1(doc, CATALOGO_SOC))
        .map((alerta) => `${alerta.login}|${alerta.diaCritico}|${alerta.diasConsecutivos}`).sort();
      const novosSeq = novos.filter((alerta) => alerta.regraId === 'padrao-dias-seguidos')
        .map((alerta) => `${alerta.login}|${alerta.data}|${alerta.valores.diasSeguidosTrabalho}`).sort();
      expect(novosSeq).toEqual(antigosSeq);

      const antigosDes = documentos.flatMap((doc) => detectarDescansoInsuficiente(doc, CATALOGO_SOC))
        .map((alerta) => `${alerta.login}|${alerta.dataAtual}|${alerta.regra}|${alerta.descansoHoras}|${alerta.minimoHoras}`).sort();
      const novosDes = novos.filter((alerta) => alerta.regraId !== 'padrao-dias-seguidos')
        .map((alerta) => `${alerta.login}|${alerta.data}|${alerta.regraId === 'padrao-descanso-apos-folga' ? 'DSR' : 'INTERJORNADA'}|${alerta.valores.descansoHoras}|${alerta.limite}`).sort();
      expect(novosDes).toEqual(antigosDes);

      totalSequencias += antigosSeq.length;
      totalDescansos += antigosDes.length;
    }
    // o teste só vale se as escalas aleatórias realmente disparam alertas dos dois tipos
    expect(totalSequencias).toBeGreaterThan(50);
    expect(totalDescansos).toBeGreaterThan(200);
  });
});

describe('REGRAS-ESCALA-1 — interpretador', () => {
  const regraHoras: RegraEscala = {
    id: 'teste-horas', nome: 'Turno longo', descricao: '', categoria: 'EMPRESA', ativa: true,
    quando: { logica: 'E', condicoes: [{ variavel: 'horasNoDia', op: '>', valor: 6 }] },
    entao: { gravidade: 'CRITICO', bloqueiaPublicacao: true, mensagem: '{pessoa} passa de {limite} h no dia {dia} ({horasNoDia} h)', agrupar: 'CADA_DIA' },
    vale: { tipo: 'TODAS' }, origem: 'ADMIN', schemaVersion: 1,
  };

  it('regra criada pelo administrador (carga no dia) dispara com mensagem e bloqueia a publicação', () => {
    const doc = documento({ '2026-08-03': dia('T'), '2026-08-04': dia('T', { i: '08:00', f: '18:00', vd: false, m: 600 }) });
    const alertas = avaliarRegras([doc], CATALOGO_SOC, [regraHoras]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ data: '2026-08-04', gravidade: 'CRITICO', mensagem: 'ana passa de 6 h no dia 04/08 (10 h)' });
    expect(bloqueiaPublicacaoPorRegra(alertas)).toBe(true);
  });

  it('E exige todas as condições; OU basta uma; variável sem valor no dia nunca dispara', () => {
    const doc = documento(sequenciaDeDias(['N', 'M', 'DF', 'DF']));
    const base = { ...regraHoras, entao: { ...regraHoras.entao, bloqueiaPublicacao: false } };
    const fria = { ...base, quando: { logica: 'E' as const, condicoes: [{ variavel: 'horasNoDia' as const, op: '>=' as const, valor: 1 }, { variavel: 'diaDaSemana' as const, op: '==' as const, valor: 99 }] } };
    const ou = { ...fria, quando: { ...fria.quando, logica: 'OU' as const } };
    expect(avaliarRegras([doc], CATALOGO_SOC, [fria])).toHaveLength(0);
    expect(avaliarRegras([doc], CATALOGO_SOC, [ou]).length).toBeGreaterThan(0);
    // nos dias de folga não há "horas no dia": a regra de horas não dispara neles
    const emFolga = avaliarRegras([doc], CATALOGO_SOC, [{ ...base, quando: { logica: 'E', condicoes: [{ variavel: 'horasNoDia', op: '>=', valor: 0 }] } }]);
    expect(emFolga.map((alerta) => alerta.data)).toEqual(['2026-08-03', '2026-08-04']);
  });

  it('agrupa dias seguidos em um alerta só (no primeiro dia) e separa quando há folga no meio', () => {
    const regra: RegraEscala = { ...regraHoras, quando: { logica: 'E', condicoes: [{ variavel: 'diasSeguidosTrabalho', op: '>=', valor: 2 }] }, entao: { ...regraHoras.entao, bloqueiaPublicacao: false, agrupar: 'PRIMEIRO_DIA_DA_SEQUENCIA' } };
    const doc = documento(sequenciaDeDias(['M', 'M', 'M', 'DF', 'M', 'M']));
    const alertas = avaliarRegras([doc], CATALOGO_SOC, [regra]);
    expect(alertas.map((alerta) => [alerta.data, alerta.ateData])).toEqual([['2026-08-04', '2026-08-05'], ['2026-08-08', '2026-08-08']]);
  });

  it('regra só para certas equipes não vale para as outras; regra desligada não roda', () => {
    const regra: RegraEscala = { ...regraHoras, vale: { tipo: 'EQUIPE', ids: ['EQ_NOC'] } };
    const doc = documento({ '2026-08-03': dia('T', { i: '08:00', f: '18:00', vd: false, m: 600 }) }, 'ana', 'EQ_SOC');
    expect(avaliarRegras([doc], CATALOGO_SOC, [regra])).toHaveLength(0);
    expect(avaliarRegras([{ ...doc, equipeId: 'EQ_NOC' }], CATALOGO_SOC, [regra])).toHaveLength(1);
    expect(avaliarRegras([{ ...doc, equipeId: 'EQ_NOC' }], CATALOGO_SOC, [{ ...regra, ativa: false }])).toHaveLength(0);
  });

  it('o contexto traz as variáveis calculadas (dias seguidos, descanso, folgas entre os turnos)', () => {
    const contexto = construirContextoDias(documento(sequenciaDeDias(['T', 'T', 'DF', 'M'])), CATALOGO_SOC);
    expect(contexto.map((item) => item.valores.diasSeguidosTrabalho)).toEqual([1, 2, undefined, 1]);
    expect(contexto[3]?.valores.folgasEntreTurnos).toBe(1);
    expect(contexto[1]?.valores.descansoHoras).toBe(18);
  });
});

describe('REGRAS-ESCALA-1 — validação e texto', () => {
  const regra = REGRAS_PADRAO[0]!;

  it('as 3 regras padrão são válidas e legais', () => {
    for (const padrao of REGRAS_PADRAO) {
      expect(validarRegra(padrao)).toEqual([]);
      expect(padrao.categoria).toBe('LEGAL');
    }
  });

  it('regra com variável, comparação, mensagem ou alcance inválidos é recusada (nunca executada)', () => {
    const ruim = { ...regra, quando: { logica: 'E' as const, condicoes: [{ variavel: 'salario', op: '~', valor: Number.NaN }] }, entao: { ...regra.entao, mensagem: 'Oi {inexistente}' }, vale: { tipo: 'EQUIPE' as const } } as unknown as RegraEscala;
    const erros = validarRegra(ruim).join(' | ');
    expect(erros).toContain('Variável desconhecida');
    expect(erros).toContain('Comparação desconhecida');
    expect(erros).toContain('precisa ser um número');
    expect(erros).toContain('{inexistente}');
    expect(erros).toContain('pelo menos uma equipe');
    expect(avaliarRegras([documento(sequenciaDeDias(['M']))], CATALOGO_SOC, [ruim])).toEqual([]);
  });

  it('regra legal não pode ser desligada', () => {
    expect(validarRegra({ ...regra, ativa: false })).toContain('Regra legal não pode ser desligada.');
  });

  it('a frase legível não tem "6x1" escrito — o número é só o valor da regra', () => {
    expect(fraseDaRegra(regra)).toBe('SE dias seguidos de trabalho > 6 dias ENTÃO gerar alerta (aviso)');
    expect(fraseDaRegra(REGRAS_PADRAO[2]!)).toBe('SE horas de descanso desde o turno anterior < 35 h E dias de folga entre o turno anterior e este >= 1 dia ENTÃO gerar alerta (aviso)');
    expect(JSON.stringify(REGRAS_PADRAO)).not.toMatch(/6x1/iu);
  });

  it('mensagem troca {pessoa}, {dia}, {limite} e variáveis; deixa intacto o que não conhece', () => {
    expect(renderizarMensagem('{pessoa} {dia} {limite} {horasNoDia} {x}', { pessoa: 'Ana', data: '2026-08-12', limite: 11, valores: { horasNoDia: 9.5 } })).toBe('Ana 12/08 11 9,5 {x}');
  });
});

describe('REGRAS-ESCALA-2 — problemas na grade e prévia de mudança', () => {
  // N (19h–01h) seguida de M (07h–13h) no dia seguinte: só 6 h de descanso — viola a interjornada.
  const comProblema = () => documento(sequenciaDeDias(['N', 'M', 'DF']));
  // com folga entre os turnos: o descanso passa de 24 h e deixa de violar a interjornada
  const semProblema = () => documento(sequenciaDeDias(['N', 'DF', 'DF']));

  it('a célula marcada é o DIA do turno que veio cedo demais, com a mensagem escrita pela regra', () => {
    const alertas = avaliarRegras([comProblema()], CATALOGO_SOC, REGRAS_PADRAO);
    const indice = indexarProblemasPorCelula(alertas);
    const celula = indice.get('uid-ana_2026-08-04');
    expect(celula?.gravidade).toBe('AVISO');
    expect(celula?.mensagens[0]).toContain('6 h de descanso');
    expect(celula?.mensagens[0]).toContain('o mínimo é 11 h');
    expect(indice.size).toBe(1);
  });

  it('a prévia de uma mudança separa o que ela CRIA do que ela RESOLVE', () => {
    const antes = avaliarRegras([semProblema()], CATALOGO_SOC, REGRAS_PADRAO);
    const depois = avaliarRegras([comProblema()], CATALOGO_SOC, REGRAS_PADRAO);
    expect(antes).toHaveLength(0);
    const criando = diferencaDeProblemas(antes, depois);
    expect(criando.novos).toHaveLength(1);
    expect(criando.resolvidos).toHaveLength(0);
    const resolvendo = diferencaDeProblemas(depois, antes);
    expect(resolvendo.novos).toHaveLength(0);
    expect(resolvendo.resolvidos).toHaveLength(1);
  });

  it('mudança que não mexe nos problemas existentes não cria nem resolve nada', () => {
    const alertas = avaliarRegras([comProblema()], CATALOGO_SOC, REGRAS_PADRAO);
    expect(diferencaDeProblemas(alertas, alertas)).toEqual({ novos: [], resolvidos: [] });
  });

  it('agrupa por pessoa, a que tem mais problemas primeiro', () => {
    const a = documento(sequenciaDeDias(['N', 'M', 'N', 'M']), 'ana');
    const b = documento(sequenciaDeDias(['N', 'M']), 'bia');
    const grupos = agruparProblemasPorPessoa(avaliarRegras([b, a], CATALOGO_SOC, REGRAS_PADRAO));
    expect(grupos.map((grupo) => [grupo.login, grupo.alertas.length])).toEqual([['ana', 2], ['bia', 1]]);
  });
});

describe('REGRAS-ESCALA-3 — exemplos, cópia e teste de regra', () => {
  const comId = (chave: string) => ({ ...EXEMPLOS_REGRA.find((exemplo) => exemplo.chave === chave)!.modelo, id: `teste-${chave}` });

  it('todo exemplo do construtor é uma regra válida', () => {
    for (const exemplo of EXEMPLOS_REGRA) expect(validarRegra({ ...exemplo.modelo, id: exemplo.chave })).toEqual([]);
    expect(validarRegra(novaRegraEmBranco('x'))).toEqual(['Dê um nome para a regra.']);
  });

  it('cada exemplo dispara nos casos certos', () => {
    const seisDias = documento(sequenciaDeDias(['M', 'M', 'M', 'M', 'M', 'M']));
    expect(testarRegra(comId('cinco-dias'), [seisDias], CATALOGO_SOC).total).toBe(1);

    const longo = documento({ '2026-08-03': dia('T', { i: '06:00', f: '20:00', vd: false, m: 840 }), '2026-08-04': dia('T') });
    expect(testarRegra(comId('turno-longo'), [longo], CATALOGO_SOC).alertas.map((alerta) => alerta.data)).toEqual(['2026-08-03']);

    // 01/08 é sábado; 02/08, domingo
    const fimDeSemana = documento(sequenciaDeDias(['M', 'M', 'M'], '2026-08-01'));
    expect(testarRegra(comId('domingo'), [fimDeSemana], CATALOGO_SOC).alertas.map((alerta) => alerta.data)).toEqual(['2026-08-02']);

    const apertado = documento(sequenciaDeDias(['N', 'M']));
    expect(testarRegra(comId('descanso-12'), [apertado], CATALOGO_SOC).total).toBe(1);
  });

  it('o teste resume casos, pessoas e o tamanho do que foi avaliado — e funciona com a regra ainda desligada', () => {
    const a = documento(sequenciaDeDias(['N', 'M', 'N', 'M']), 'ana');
    const b = documento(sequenciaDeDias(['M', 'M']), 'bia');
    const resultado = testarRegra({ ...comId('descanso-12'), ativa: false }, [a, b], CATALOGO_SOC, { nomePorLogin: { ana: 'Ana Souza' } });
    expect(resultado).toMatchObject({ total: 2, pessoasAfetadas: 1, documentosAvaliados: 2, diasAvaliados: 6 });
    expect(resultado.porPessoa).toEqual([{ login: 'ana', nome: 'Ana Souza', total: 2 }]);
  });

  it('regra inválida não roda no teste', () => {
    const invalida = { ...novaRegraEmBranco('x'), quando: { logica: 'E' as const, condicoes: [] } };
    expect(testarRegra(invalida, [documento(sequenciaDeDias(['M']))], CATALOGO_SOC).total).toBe(0);
  });

  it('copiar uma regra legal cria uma regra da empresa, sem tocar na original', () => {
    const legal = REGRAS_PADRAO[1]!;
    const copia = copiarComoRascunho(legal, 'nova');
    expect(copia).toMatchObject({ id: 'nova', categoria: 'EMPRESA', origem: 'ADMIN', nome: 'Descanso mínimo entre dois turnos (versão da empresa)' });
    copia.quando.condicoes[0]!.valor = 12;
    expect(legal.quando.condicoes[0]!.valor).toBe(11);
    expect(validarRegra(copia)).toEqual([]);
  });

  it('o construtor oferece as variáveis por categoria e os campos da mensagem vêm das condições', () => {
    expect(variaveisPorCategoria().map((grupo) => grupo.categoria)).toEqual(['SEQUENCIA', 'DESCANSO', 'CARGA', 'DIA']);
    expect(variaveisDaRegra(comId('descanso-12'))).toEqual(['descansoHoras', 'folgasEntreTurnos']);
  });
});
