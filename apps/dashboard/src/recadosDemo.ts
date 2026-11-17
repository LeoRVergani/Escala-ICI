import { adicionarHoras, gerarIdRecado, montarRecado, type Recado } from '@/lib/recados';

/** RECADOS-1 — recados de exemplo para a demonstração (relativos a agora): um aguardando e dois com resposta. */
export function recadosDeExemplo(
  agoraIso: string,
  pessoas: ReadonlyArray<{ login: string; nome: string; equipeId: string }>,
  remetente: { login: string; nome: string },
): Recado[] {
  const [a, b, c] = pessoas;
  if (!a || !b || !c) return [];
  const criado = (horasAtras: number) => adicionarHoras(agoraIso, -horasAtras);
  const pergunta = (texto: string, pessoa: typeof a, horasAtras: number) => montarRecado({ tipo: 'PERGUNTA', texto }, pessoa, remetente, gerarIdRecado(), criado(horasAtras));
  const respondido = (recado: Recado, resposta: Recado['resposta'], nota: string): Recado => ({
    ...recado, status: 'RESPONDIDO', resposta, notaResposta: nota, respondidoEm: adicionarHoras(recado.criadoEm, 1), expiraEm: adicionarHoras(agoraIso, 20),
  });
  return [
    respondido(pergunta('Pode trocar comigo o plantão do dia 20?', a, 3), 'POSSO', 'Posso sim, só me avisa o horário.'),
    respondido(pergunta('Consegue cobrir a noite de sábado?', b, 5), 'NAO_POSSO', 'Estou de folga e viajando.'),
    pergunta('Pode atender o chamado do cliente X assim que possível?', c, 1),
  ];
}
