import { doc, getDoc } from 'firebase/firestore';

import type { EntradaLembrete, EntradaSerieLembrete } from '../lembretes';
import { criarLembreteAtribuido, criarSerieLembretesAtribuidos } from './lembretesRepository';
import { exigirFirebase } from './shared';

/**
 * LEMBRETE-EQUIPE-APP-1 — único caminho do App para o coordenador criar um
 * lembrete (com aviso no celular) para alguém da equipe 6x1 ou do Plantão.
 * Marca `origemApp` (as Rules decidem quem pode); no Plantão, informa o
 * `grupoPlantaoId` (permite avisar plantonista de outra equipe).
 */
export interface AlvoLembreteEquipe {
  login: string;
  nome: string;
  /** Na 6x1 já se sabe (vem da escala); no Plantão vem do cadastro. */
  equipeId?: string | null;
  grupoPlantaoId?: string;
}

async function equipeDoCadastro(login: string): Promise<string> {
  const { db } = exigirFirebase();
  const cadastro = await getDoc(doc(db, 'usuarios', login));
  const equipeId = cadastro.exists() ? (cadastro.data() as { equipeId?: unknown }).equipeId : null;
  if (typeof equipeId !== 'string' || equipeId === '') {
    throw new Error('Esta pessoa não tem equipe no cadastro — não é possível enviar o lembrete.');
  }
  return equipeId;
}

export async function criarLembreteParaEquipeApp(
  alvo: AlvoLembreteEquipe,
  autor: { login: string; nome: string },
  entrada: { unico: EntradaLembrete } | { serie: EntradaSerieLembrete },
): Promise<void> {
  const equipeId = alvo.equipeId || await equipeDoCadastro(alvo.login);
  const destinatario = { login: alvo.login, equipeId };
  const opcoes = { origemApp: true, ...(alvo.grupoPlantaoId ? { grupoPlantaoId: alvo.grupoPlantaoId } : {}) };
  if ('unico' in entrada) {
    await criarLembreteAtribuido(destinatario, autor, entrada.unico, opcoes);
  } else {
    await criarSerieLembretesAtribuidos(destinatario, autor, entrada.serie, opcoes);
  }
}
