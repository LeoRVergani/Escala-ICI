import { diaDoLimite, gerarIdRecado, montarRecado, montarRecadoGrupo, type EntradaMensagem } from '../recados';
import { enviarRecado, enviarRecadoGrupo, lerContagemDoDia } from './recadosRepository';

/**
 * RECADOS-3 — o envio, igual no App e no Dashboard: uma PESSOA recebe um recado dela; cada GRUPO recebe UMA mensagem
 * (a equipe ou o Plantão responde junto, no mesmo cartão). Cada envio gasta 1 do limite do dia, gravado no mesmo lote.
 */
export async function enviarMensagem(entrada: EntradaMensagem, remetente: { login: string; nome: string }): Promise<void> {
  const destino = entrada.destino;
  if (destino === null) return;
  const agora = new Date().toISOString();
  let contagem = await lerContagemDoDia(remetente.login, diaDoLimite(agora));
  const total = destino.tipo === 'PESSOA' ? 1 : destino.alvos.length;
  let enviadas = 0;
  try {
    if (destino.tipo === 'PESSOA') {
      contagem = await enviarRecado(montarRecado(entrada, destino.pessoa, remetente, gerarIdRecado(), agora), contagem);
      enviadas += 1;
    } else {
      for (const alvo of destino.alvos) {
        contagem = await enviarRecadoGrupo(montarRecadoGrupo(entrada, alvo, remetente, gerarIdRecado(), agora), contagem);
        enviadas += 1;
      }
    }
  } catch (falha) {
    if (enviadas > 0) throw new Error(`${enviadas} de ${total} mensagens foram enviadas antes de o envio falhar.`);
    throw falha;
  }
}
