import { adicionarHoras, gerarIdRecado, montarRecado, type DestinatarioRecado, type Recado } from '@/lib/recados';

/** RECADOS-2 — recados de exemplo para a demonstração (relativos a agora): um aguardando e dois com resposta livre. */
export function recadosDeExemplo(
  agoraIso: string,
  pessoas: readonly DestinatarioRecado[],
  remetente: { login: string; nome: string },
): Recado[] {
  const [a, b, c] = pessoas;
  if (!a || !b || !c) return [];
  const criado = (horasAtras: number) => adicionarHoras(agoraIso, -horasAtras);
  const recado = (texto: string, pessoa: DestinatarioRecado, horasAtras: number) => montarRecado({ texto }, pessoa, remetente, gerarIdRecado(), criado(horasAtras));
  const respondido = (base: Recado, resposta: string): Recado => ({
    ...base, status: 'RESPONDIDO', resposta, respondidoEm: adicionarHoras(base.criadoEm, 1), expiraEm: adicionarHoras(agoraIso, 20),
  });
  return [
    respondido(recado('Pode trocar comigo o plantão do dia 20?', a, 3), 'Posso sim, só me avisa o horário.'),
    respondido(recado('Consegue cobrir a noite de sábado?', b, 5), 'Não consigo, estou viajando. Dia 28 eu posso, se ajudar.'),
    recado('Pode atender o chamado do cliente X assim que possível?', c, 1),
  ];
}
