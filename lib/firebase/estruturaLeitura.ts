import { collection, getDocs } from 'firebase/firestore';

import type { Equipe, UnidadeOrganizacional } from '../modelos';
import { exigirFirebase } from './shared';

/**
 * APROVAR-TROCA-APP-2 — leitura da estrutura organizacional para o App
 * (autoatendimento) saber quais escalas a pessoa coordena, sem importar o
 * repositório administrativo. As duas coleções são de leitura livre para
 * qualquer usuário autenticado (Rules).
 */
export async function listarEquipesLeitura(): Promise<Equipe[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'equipes'));
  return resultado.docs.map((snapshot) => snapshot.data() as Equipe);
}

export async function listarUnidadesLeitura(): Promise<UnidadeOrganizacional[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(collection(db, 'unidadesOrganizacionais'));
  return resultado.docs.map((snapshot) => snapshot.data() as UnidadeOrganizacional);
}
