import { doc, setDoc } from 'firebase/firestore';

import type { Usuario } from '../modelos';
import { perfilEfetivo } from '../sessao';
import { gerarUuid } from '../uuid';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * Auditoria de ações administrativas sensíveis — um documento imutável por
 * ação (mesmo padrão de `historicoPublicacoes`, ver firestore.rules). Falha
 * de auditoria nunca deve desfazer nem mascarar a ação real já commitada —
 * quem chama envolve isto num try/catch isolado.
 *
 * STAGING-RESET-HIERARQUIA-ICI-1 — `atorSimulado` agora aceita `null`: além
 * do modo "ADMIN_SISTEMA simulando outro gestor" (o único caso registrado
 * até esta fase), em staging um coordenador/supervisor agindo diretamente
 * (sem simular ninguém) também precisa gerar auditoria — ver
 * `registrarAuditoriaOperacional()` em `DashboardApp.tsx`.
 */
export async function registrarAuditoriaAdmin(parametros: {
  atorReal: Usuario;
  atorSimulado: Usuario | null;
  equipeId: string;
  acao: string;
}): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'auditoriaAdmin', gerarUuid()), {
    atorRealLogin: parametros.atorReal.login,
    atorRealNome: parametros.atorReal.nome,
    atorRealPerfil: perfilEfetivo(parametros.atorReal),
    atorSimuladoLogin: parametros.atorSimulado?.login ?? null,
    atorSimuladoNome: parametros.atorSimulado?.nome ?? null,
    atorSimuladoPerfil: parametros.atorSimulado ? perfilEfetivo(parametros.atorSimulado) : null,
    equipeId: parametros.equipeId,
    acao: parametros.acao,
    em: new Date().toISOString(),
  });
}
