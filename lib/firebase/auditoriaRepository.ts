import { doc, setDoc } from 'firebase/firestore';

import type { Usuario } from '../modelos';
import { perfilEfetivo } from '../sessao';
import { gerarUuid } from '../uuid';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * Auditoria do modo simulação de gestor — um documento imutável por ação
 * (mesmo padrão de `historicoPublicacoes`, ver firestore.rules). Registrada
 * só quando o admin está simulando; falha de auditoria nunca deve desfazer
 * nem mascarar a ação real já commitada — quem chama envolve isto num
 * try/catch isolado.
 */
export async function registrarAuditoriaAdmin(parametros: {
  atorReal: Usuario;
  atorSimulado: Usuario;
  equipeId: string;
  acao: string;
}): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'auditoriaAdmin', gerarUuid()), {
    atorRealLogin: parametros.atorReal.login,
    atorRealNome: parametros.atorReal.nome,
    atorRealPerfil: perfilEfetivo(parametros.atorReal),
    atorSimuladoLogin: parametros.atorSimulado.login,
    atorSimuladoNome: parametros.atorSimulado.nome,
    atorSimuladoPerfil: perfilEfetivo(parametros.atorSimulado),
    equipeId: parametros.equipeId,
    acao: parametros.acao,
    em: new Date().toISOString(),
  });
}
