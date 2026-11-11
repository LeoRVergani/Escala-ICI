import { doc, updateDoc } from 'firebase/firestore';

import { camposPromocaoLideranca } from '../liderancas';
import type { Usuario } from '../modelos';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * LIDERANCAS-1 — torna a pessoa liderança (GESTOR_EQUIPE, nível ≤ 5) e
 * registra quem promoveu. A regra do banco só aceita esta forma exata.
 */
export async function tornarLideranca(alvo: Pick<Usuario, 'login' | 'nivelHierarquico'>, autorLogin: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'usuarios', alvo.login), camposPromocaoLideranca(alvo, autorLogin, new Date().toISOString()));
}
