import { describe, expect, it } from 'vitest';

import {
  chaveMarcador, cobreDia, dataValida, descricaoHorario, descricaoPeriodo, entradaDaInformacao, entradaEmBranco, filtrarInformacoes, informacoesDoDia, informacoesDoMes,
  lerInformacao, marcadoresPorCelula, montarDocumentoInformacao, nomeDoMes, ordenarInformacoes, paraOColaborador, resumoDoPeriodo, resumoPorDia, rotuloDiaRelativo, SEM_FILTROS,
  semanasDoMes, textoDoMarcador, tituloDoDia, tituloExibicao, validarEntradaInformacao, type EntradaInformacao, type InformacaoDia,
} from './informacoesDia';

const AUTOR = { login: 'marina.azevedo', nome: 'Marina Azevedo' };
const AGORA = '2026-11-12T12:00:00.000Z';

function entrada(ajustes: Partial<EntradaInformacao> = {}): EntradaInformacao {
  return entradaEmBranco({ login: 'caio.monteiro', nomeColaborador: 'Caio Monteiro', equipeId: 'EQ_SOC', tipo: 'ATESTADO', dataInicio: '2026-11-12', ...ajustes });
}
function info(id: string, ajustes: Partial<EntradaInformacao> = {}): InformacaoDia {
  return montarDocumentoInformacao(entrada(ajustes), id, AUTOR, AGORA);
}

describe('INFORMACOES-DIA-1 — validação (mensagens em português simples)', () => {
  it('uma informação completa é válida', () => {
    expect(validarEntradaInformacao(entrada())).toEqual([]);
    expect(validarEntradaInformacao(entrada({ tipo: 'CURSO', dataFim: '2026-11-14', diaTodo: false, horaInicio: '08:00', horaFim: '12:00' }))).toEqual([]);
  });

  it('pede o colaborador, o tipo e o dia', () => {
    const erros = validarEntradaInformacao(entradaEmBranco({ tipo: 'XPTO' as never }));
    expect(erros).toEqual(['Escolha o colaborador.', 'Escolha o tipo da informação.', 'Escolha o dia.']);
  });

  it('período: o fim não pode ser antes do início e não passa de 1 ano', () => {
    expect(validarEntradaInformacao(entrada({ dataFim: '2026-11-10' }))).toEqual(['O último dia não pode ser antes do primeiro.']);
    expect(validarEntradaInformacao(entrada({ dataFim: '2027-12-31' }))).toEqual(['O período é longo demais (no máximo 1 ano).']);
    expect(validarEntradaInformacao(entrada({ dataInicio: '2026-02-30' }))).toEqual(['Escolha o dia.']);
  });

  it('afastamento por horário exige o horário; nos outros, só se não for o dia todo', () => {
    expect(validarEntradaInformacao(entrada({ tipo: 'AFASTAMENTO_HORARIO' }))).toEqual(['Informe o horário do afastamento.']);
    expect(validarEntradaInformacao(entrada({ tipo: 'CURSO', diaTodo: false }))).toEqual(['Informe o horário de início e de fim.']);
    expect(validarEntradaInformacao(entrada({ tipo: 'AFASTAMENTO_HORARIO', diaTodo: false, horaInicio: '10:00', horaFim: '09:00' }))).toEqual(['O horário de fim precisa ser depois do início.']);
    expect(validarEntradaInformacao(entrada({ tipo: 'AFASTAMENTO_HORARIO', diaTodo: false, horaInicio: '09:00', horaFim: '11:30' }))).toEqual([]);
    expect(validarEntradaInformacao(entrada({ tipo: 'CURSO', diaTodo: false, horaInicio: '25:00', horaFim: '26:00' }))).toEqual(['Informe o horário de início e de fim.']);
  });

  it('"outra informação" precisa de título; títulos e observações têm limite', () => {
    expect(validarEntradaInformacao(entrada({ tipo: 'OUTRO' }))).toEqual(['Dê um título para a informação.']);
    expect(validarEntradaInformacao(entrada({ tipo: 'OUTRO', titulo: 'Home office' }))).toEqual([]);
    expect(validarEntradaInformacao(entrada({ titulo: 'x'.repeat(81) }))).toEqual(['O título passa de 80 caracteres.']);
    expect(validarEntradaInformacao(entrada({ observacao: 'x'.repeat(501) }))).toEqual(['As observações passam de 500 caracteres.']);
  });

  it('dataValida confere o calendário de verdade', () => {
    expect(dataValida('2026-11-12')).toBe(true);
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('12/11/2026')).toBe(false);
  });
});

describe('INFORMACOES-DIA-1 — documento e ida e volta com o banco', () => {
  it('dia único: o último dia é o primeiro; "dia todo" não grava horário; o nome sai sem espaços sobrando', () => {
    const doc = info('a', { nomeColaborador: '  Caio   Monteiro ', titulo: ' Atestado   curto ', observacao: ' ok ' });
    expect(doc).toMatchObject({ dataInicio: '2026-11-12', dataFim: '2026-11-12', horaInicio: null, horaFim: null, nomeColaborador: 'Caio Monteiro', titulo: 'Atestado curto', observacao: 'ok', visivelParaColaborador: false });
  });

  it('afastamento por horário sempre grava o horário, mesmo se a caixa "dia todo" estiver marcada', () => {
    const doc = info('a', { tipo: 'AFASTAMENTO_HORARIO', diaTodo: true, horaInicio: '09:00', horaFim: '11:00' });
    expect(doc).toMatchObject({ horaInicio: '09:00', horaFim: '11:00' });
  });

  it('editar preserva quem criou e quando; só o "atualizado" muda', () => {
    const original = info('a');
    const editada = montarDocumentoInformacao(entrada({ titulo: 'Novo' }), 'a', { login: 'renato.pires', nome: 'Renato Pires' }, '2026-11-13T08:00:00.000Z', original);
    expect(editada).toMatchObject({ criadoPorLogin: 'marina.azevedo', criadoPorNome: 'Marina Azevedo', criadoEm: AGORA, atualizadoPorLogin: 'renato.pires', atualizadoEm: '2026-11-13T08:00:00.000Z' });
  });

  it('o que se grava é lido de novo igual, e volta para o formulário igual', () => {
    const doc = info('a', { tipo: 'CURSO', dataFim: '2026-11-14', diaTodo: false, horaInicio: '08:00', horaFim: '12:00', titulo: 'Treinamento', visivelParaColaborador: true });
    expect(lerInformacao('a', JSON.parse(JSON.stringify(doc)) as Record<string, unknown>)).toEqual(doc);
    expect(montarDocumentoInformacao(entradaDaInformacao(doc), 'a', AUTOR, AGORA, doc)).toEqual({ ...doc, atualizadoPorLogin: AUTOR.login, atualizadoEm: AGORA });
  });

  it('documento malformado é ignorado (nunca derruba a tela)', () => {
    const cru = JSON.parse(JSON.stringify(info('a'))) as Record<string, unknown>;
    expect(lerInformacao('a', { ...cru, tipo: 'ALIEN' })).toBeNull();
    expect(lerInformacao('a', { ...cru, dataFim: '2026-11-01' })).toBeNull();
    expect(lerInformacao('a', { ...cru, dataInicio: 'ontem' })).toBeNull();
    expect(lerInformacao('a', { ...cru, horaInicio: '09:00', horaFim: null })).toBeNull();
    expect(lerInformacao('a', { ...cru, login: '' })).toBeNull();
    expect(lerInformacao('a', { id: 'a' })).toBeNull();
  });
});

describe('INFORMACOES-DIA-1 — leitura: dia, período, ordem e filtros', () => {
  const lista = [
    info('tarde', { login: 'bia', nomeColaborador: 'Bia Souza', tipo: 'CURSO', diaTodo: false, horaInicio: '14:00', horaFim: '18:00' }),
    info('todo', { login: 'ana', nomeColaborador: 'Ana Lima', tipo: 'ATESTADO' }),
    info('periodo', { login: 'caio', nomeColaborador: 'Caio Monteiro', tipo: 'ATESTADO', dataInicio: '2026-11-10', dataFim: '2026-11-13', visivelParaColaborador: true }),
    info('outro-mes', { login: 'ana', nomeColaborador: 'Ana Lima', tipo: 'OUTRO', titulo: 'Home office', dataInicio: '2026-12-02' }),
  ];

  it('um período aparece em todos os dias que cobre', () => {
    expect(cobreDia(lista[2]!, '2026-11-10')).toBe(true);
    expect(cobreDia(lista[2]!, '2026-11-13')).toBe(true);
    expect(cobreDia(lista[2]!, '2026-11-14')).toBe(false);
    expect(informacoesDoDia(lista, '2026-11-12').map((item) => item.id)).toEqual(['periodo', 'todo', 'tarde']);
  });

  it('ordem: pelo primeiro dia, dia todo antes dos horários, depois por nome', () => {
    expect(ordenarInformacoes(lista).map((item) => item.id)).toEqual(['periodo', 'todo', 'tarde', 'outro-mes']);
  });

  it('o mês traz o que encosta nele, inclusive período que começou no mês anterior', () => {
    expect(informacoesDoMes(lista, '2026-11').map((item) => item.id)).toEqual(['periodo', 'todo', 'tarde']);
    expect(informacoesDoMes(lista, '2026-12').map((item) => item.id)).toEqual(['outro-mes']);
    const longo = info('longo', { dataInicio: '2026-10-28', dataFim: '2026-11-02' });
    expect(informacoesDoMes([longo], '2026-11')).toHaveLength(1);
  });

  it('filtros: tipo, pessoa, visibilidade e busca sem diferenciar acento nem maiúscula', () => {
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, tipo: 'ATESTADO' }).map((item) => item.id)).toEqual(['todo', 'periodo']);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, login: 'ana' }).map((item) => item.id)).toEqual(['todo', 'outro-mes']);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, visibilidade: 'VISIVEL' }).map((item) => item.id)).toEqual(['periodo']);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, visibilidade: 'RESERVADA' })).toHaveLength(3);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, busca: 'HOME OFICE' })).toHaveLength(0);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, busca: 'home' }).map((item) => item.id)).toEqual(['outro-mes']);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, busca: 'bia souza' }).map((item) => item.id)).toEqual(['tarde']);
    // a busca também olha o nome do tipo: quem procura "treinamento" encontra os cursos
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, busca: 'treinamento' }).map((item) => item.id)).toEqual(['tarde']);
    expect(filtrarInformacoes(lista, { ...SEM_FILTROS, busca: 'CURSO' }).map((item) => item.id)).toEqual(['tarde']);
  });
});

describe('INFORMACOES-DIA-1 — calendário e resumos', () => {
  it('novembro de 2026 começa num domingo: 5 semanas de 7 dias, com os dias de fora marcados', () => {
    const semanas = semanasDoMes('2026-11');
    expect(semanas).toHaveLength(5);
    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
    expect(semanas[0]![0]).toEqual({ data: '2026-11-01', doMes: true });
    expect(semanas.at(-1)!.at(-1)).toEqual({ data: '2026-12-05', doMes: false });
  });

  it('agosto de 2026 começa num sábado: a primeira semana traz dias de julho; são 6 semanas', () => {
    const semanas = semanasDoMes('2026-08');
    expect(semanas).toHaveLength(6);
    expect(semanas[0]![0]).toEqual({ data: '2026-07-26', doMes: false });
    expect(semanas[0]![6]).toEqual({ data: '2026-08-01', doMes: true });
  });

  it('o resumo por dia conta cada dia que um período cobre, sem passar dos limites do mês, e junta os tipos', () => {
    const lista = [
      info('a', { dataInicio: '2026-10-30', dataFim: '2026-11-02' }),
      info('b', { tipo: 'CURSO', dataInicio: '2026-11-02' }),
      info('c', { tipo: 'CURSO', dataInicio: '2026-11-02', login: 'bia' }),
    ];
    const resumo = resumoPorDia(lista, '2026-11');
    expect([...resumo.keys()]).toEqual(['2026-11-01', '2026-11-02']);
    expect(resumo.get('2026-11-01')).toEqual({ total: 1, tipos: ['ATESTADO'] });
    expect(resumo.get('2026-11-02')).toEqual({ total: 3, tipos: ['ATESTADO', 'CURSO'] });
  });

  it('os números do topo: pessoas hoje (sem repetir), total do mês, atestados e quantas o colaborador vê', () => {
    const lista = [
      info('a', { login: 'ana' }), info('b', { login: 'ana', tipo: 'CURSO' }), info('c', { login: 'bia', visivelParaColaborador: true }),
      info('d', { login: 'caio', dataInicio: '2026-11-20' }), info('e', { dataInicio: '2026-12-05' }),
    ];
    expect(resumoDoPeriodo(lista, '2026-11', '2026-11-12')).toEqual({ pessoasHoje: 2, noMes: 4, atestadosNoMes: 3, visiveisNoMes: 1 });
  });

  it('textos: dia relativo, período, horário, título do dia e mês', () => {
    expect(rotuloDiaRelativo('2026-11-12', '2026-11-12')).toBe('Hoje');
    expect(rotuloDiaRelativo('2026-11-13', '2026-11-12')).toBe('Amanhã');
    expect(rotuloDiaRelativo('2026-11-11', '2026-11-12')).toBe('Ontem');
    expect(rotuloDiaRelativo('2026-11-18', '2026-11-12')).toBe('qua, 18/11');
    expect(descricaoPeriodo({ dataInicio: '2026-11-12', dataFim: '2026-11-12' })).toBe('12/11');
    expect(descricaoPeriodo({ dataInicio: '2026-11-12', dataFim: '2026-11-14' })).toBe('12/11 a 14/11');
    expect(descricaoHorario({ horaInicio: null, horaFim: null })).toBe('Dia todo');
    expect(descricaoHorario({ horaInicio: '14:00', horaFim: '18:00' })).toBe('das 14:00 às 18:00');
    expect(tituloDoDia('2026-11-12')).toBe('quinta-feira, 12 de novembro');
    expect(nomeDoMes('2026-03')).toBe('Março de 2026');
    expect(tituloExibicao({ titulo: '', tipo: 'CURSO' })).toBe('Curso ou treinamento');
    expect(tituloExibicao({ titulo: 'NR-10', tipo: 'CURSO' })).toBe('NR-10');
  });
});

describe('INFORMACOES-DIA-1 — o que o colaborador enxerga no App', () => {
  const HOJE = '2026-11-12';
  const lista = [
    info('visivel-hoje', { login: 'caio', visivelParaColaborador: true }),
    info('reservada', { login: 'caio', visivelParaColaborador: false }),
    info('de-outro', { login: 'bia', visivelParaColaborador: true }),
    info('passada', { login: 'caio', visivelParaColaborador: true, dataInicio: '2026-11-01', dataFim: '2026-11-11' }),
    info('em-curso', { login: 'caio', visivelParaColaborador: true, dataInicio: '2026-11-10', dataFim: '2026-11-13' }),
    info('daqui-a-pouco', { login: 'caio', visivelParaColaborador: true, tipo: 'CURSO', dataInicio: '2026-11-20' }),
    info('muito-longe', { login: 'caio', visivelParaColaborador: true, dataInicio: '2026-12-30' }),
  ];

  it('só as dele, só as liberadas, de hoje em diante e dentro da janela de 14 dias', () => {
    expect(paraOColaborador(lista, 'caio', HOJE).map((item) => item.id)).toEqual(['em-curso', 'visivel-hoje', 'daqui-a-pouco']);
  });

  it('nunca mostra a reservada, a de outra pessoa nem a que já passou', () => {
    const ids = paraOColaborador(lista, 'caio', HOJE).map((item) => item.id);
    for (const proibida of ['reservada', 'de-outro', 'passada', 'muito-longe']) expect(ids).not.toContain(proibida);
    expect(paraOColaborador(lista, 'bia', HOJE).map((item) => item.id)).toEqual(['de-outro']);
    expect(paraOColaborador(lista, 'ninguem', HOJE)).toEqual([]);
  });

  it('a janela é ajustável', () => {
    expect(paraOColaborador(lista, 'caio', HOJE, 60).map((item) => item.id)).toContain('muito-longe');
    expect(paraOColaborador(lista, 'caio', HOJE, 1).map((item) => item.id)).toEqual(['em-curso', 'visivel-hoje']);
  });
});

describe('INFORMACOES-DIA-1 — marcadores na grade da escala', () => {
  it('cada dia que a informação cobre vira um marcador da pessoa, e só dela', () => {
    const periodo = info('p', { login: 'ana', dataInicio: '2026-11-10', dataFim: '2026-11-12' });
    const marcadores = marcadoresPorCelula([periodo]);
    expect([...marcadores.keys()]).toEqual(['ana_2026-11-10', 'ana_2026-11-11', 'ana_2026-11-12']);
    expect(marcadores.has(chaveMarcador('bia', '2026-11-11'))).toBe(false);
    expect(marcadores.has(chaveMarcador('ana', '2026-11-13'))).toBe(false);
  });

  it('duas informações no mesmo dia viram um marcador só, com as duas cores (sem repetir a cor do mesmo tipo)', () => {
    const lista = [
      info('a', { login: 'ana', tipo: 'CURSO', diaTodo: false, horaInicio: '14:00', horaFim: '18:00', titulo: 'NR-10' }),
      info('b', { login: 'ana', tipo: 'ATESTADO' }),
      info('c', { login: 'ana', tipo: 'ATESTADO', titulo: 'Segundo' }),
    ];
    const marcador = marcadoresPorCelula(lista).get('ana_2026-11-12')!;
    expect(marcador.cores).toEqual(['azul', 'rosa']);
    expect(marcador.itens).toHaveLength(3);
  });

  it('o texto do tooltip junta tipo, título e horário, em ordem', () => {
    const lista = [
      info('a', { login: 'ana', tipo: 'CURSO', diaTodo: false, horaInicio: '14:00', horaFim: '18:00', titulo: 'NR-10' }),
      info('b', { login: 'ana', tipo: 'ATESTADO' }),
    ];
    expect(textoDoMarcador(marcadoresPorCelula(lista).get('ana_2026-11-12')!)).toBe('Atestado (dia todo) · Curso ou treinamento: NR-10 (das 14:00 às 18:00)');
  });

  it('um período absurdo não trava a grade (no máximo 1 ano de marcadores)', () => {
    const longo = info('l', { login: 'ana', dataInicio: '2026-01-01', dataFim: '2026-12-31' });
    expect(marcadoresPorCelula([longo]).size).toBe(365);
    expect(marcadoresPorCelula([])).toEqual(new Map());
  });
});
