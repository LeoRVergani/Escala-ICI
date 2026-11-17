import { adicionarHoras, gerarIdRecado, montarRecado, montarRecadoGrupo, type AlvoRecado, type DestinatarioRecado, type Recado, type RecadoGrupo } from '@/lib/recados';

/** RECADOS-3 — mensagens de exemplo para a demonstração (relativas a agora): uma pessoa respondeu, uma aguarda e um grupo recebeu respostas. */
export function recadosDeExemplo(
  agoraIso: string,
  pessoas: readonly DestinatarioRecado[],
  alvo: AlvoRecado | undefined,
  remetente: { login: string; nome: string },
): { pessoas: Recado[]; grupos: RecadoGrupo[] } {
  const [a, b, c, d, e] = pessoas;
  if (!a || !b || !c) return { pessoas: [], grupos: [] };
  const criado = (horasAtras: number) => adicionarHoras(agoraIso, -horasAtras);
  const recado = (texto: string, pessoa: DestinatarioRecado, horasAtras: number) => montarRecado({ texto }, pessoa, remetente, gerarIdRecado(), criado(horasAtras));
  const respondido = (base: Recado, resposta: string): Recado => ({ ...base, status: 'RESPONDIDO', resposta, respondidoEm: adicionarHoras(base.criadoEm, 1), expiraEm: adicionarHoras(agoraIso, 20) });
  const grupos: RecadoGrupo[] = [];
  if (alvo) {
    const base = montarRecadoGrupo({ texto: 'Pessoal, alguém consegue cobrir a noite de sábado?' }, alvo, remetente, gerarIdRecado(), criado(4));
    const resposta = (p: DestinatarioRecado | undefined, texto: string, h: number) => (p ? [{ login: p.login, nome: p.nome, texto, em: criado(h) }] : []);
    grupos.push({ ...base, respostas: [...resposta(d, 'Posso sim! Só preciso saber o horário.', 3), ...resposta(e, 'Não consigo, estou viajando. Dia 28 eu posso.', 2)] });
  }
  return {
    pessoas: [
      respondido(recado('Pode trocar comigo o plantão do dia 20?', a, 3), 'Posso sim, só me avisa o horário.'),
      recado('Pode atender o chamado do cliente X assim que possível?', c, 1),
    ],
    grupos,
  };
}
