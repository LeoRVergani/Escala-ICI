import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';

import { camposPromocaoLideranca, documentoNovaLideranca } from '../liderancas';
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

/**
 * LIDERANCAS-2 — cadastra uma pessoa NOVA já como liderança. Se o e-mail já
 * tem cadastro, o banco recusa (é atualização, não criação): promova em
 * Colaboradores.
 */
export async function cadastrarNovaLideranca(
  dados: { nome: string; email: string; cargo: string },
  autorLogin: string,
): Promise<string> {
  exigirEscritaAdministrativaHabilitada();
  const documento = documentoNovaLideranca(dados, autorLogin, new Date().toISOString());
  if (!documento.login || !documento.email.includes('@')) throw new Error('Informe um e-mail corporativo válido.');
  if (documento.nome.length < 2) throw new Error('Informe o nome da pessoa.');
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'usuarios', documento.login), documento);
  return documento.login;
}

/** LIDERANCAS-2 — o administrador tira alguém da liderança (volta a colaborador). */
export async function removerLideranca(login: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'usuarios', login), {
    perfil: deleteField(),
    nivelHierarquico: 6,
    promovidoPorLogin: deleteField(),
    promovidoEm: deleteField(),
    atualizadoEm: new Date().toISOString(),
  });
}
