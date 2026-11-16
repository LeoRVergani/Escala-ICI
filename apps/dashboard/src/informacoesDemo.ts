import { adicionarDias } from '@escala-ici/contrato';

import { gerarIdInformacao, montarDocumentoInformacao, type EntradaInformacao, type InformacaoDia } from '@/lib/informacoesDia';

/**
 * INFORMACOES-DIA-1 — informações de exemplo para o modo demonstração. São sempre relativas a
 * HOJE, para a tela nunca aparecer vazia nem parada no passado.
 */
export function informacoesDeExemplo(
  hojeIso: string,
  pessoas: ReadonlyArray<{ login: string; nome: string; equipeId: string }>,
  autor: { login: string; nome: string },
): InformacaoDia[] {
  const [a, b, c, d, e] = pessoas;
  if (!a || !b || !c || !d || !e) return [];
  const base = (pessoa: { login: string; nome: string; equipeId: string }): Pick<EntradaInformacao, 'login' | 'nomeColaborador' | 'equipeId'> => (
    { login: pessoa.login, nomeColaborador: pessoa.nome, equipeId: pessoa.equipeId }
  );
  const vazio = { dataFim: '', diaTodo: true, horaInicio: '', horaFim: '', titulo: '', observacao: '', visivelParaColaborador: false } as const;
  const agora = `${hojeIso}T09:00:00.000Z`;
  const montar = (entrada: EntradaInformacao) => montarDocumentoInformacao(entrada, gerarIdInformacao(), autor, agora);
  return [
    montar({ ...vazio, ...base(a), tipo: 'CURSO', dataInicio: hojeIso, diaTodo: false, horaInicio: '14:00', horaFim: '18:00', titulo: 'Treinamento de segurança', observacao: 'Sala 3. Volta ao turno normal no dia seguinte.', visivelParaColaborador: true }),
    montar({ ...vazio, ...base(b), tipo: 'ATESTADO', dataInicio: hojeIso, dataFim: adicionarDias(hojeIso, 2), titulo: 'Atestado de 3 dias', observacao: 'Entregou o documento ao RH.' }),
    montar({ ...vazio, ...base(c), tipo: 'AFASTAMENTO_HORARIO', dataInicio: adicionarDias(hojeIso, 1), diaTodo: false, horaInicio: '09:00', horaFim: '11:00', titulo: 'Consulta médica', visivelParaColaborador: true }),
    montar({ ...vazio, ...base(d), tipo: 'OUTRO', dataInicio: adicionarDias(hojeIso, 4), titulo: 'Troca de equipamento', observacao: 'Levar o notebook antigo para a TI.' }),
    montar({ ...vazio, ...base(e), tipo: 'CURSO', dataInicio: adicionarDias(hojeIso, 9), dataFim: adicionarDias(hojeIso, 10), titulo: 'Curso de resposta a incidentes', visivelParaColaborador: true }),
    montar({ ...vazio, ...base(a), tipo: 'ATESTADO', dataInicio: adicionarDias(hojeIso, -3), dataFim: adicionarDias(hojeIso, -2), titulo: 'Atestado' }),
  ];
}
