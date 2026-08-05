import type { Usuario } from '../modelos';
import { obterFirebase } from './client';
import { resolverPoliticaFirebase } from './environment';

const politica = resolverPoliticaFirebase(
  import.meta.env,
  typeof window === 'undefined' ? undefined : window.location.hostname,
);

export const escritaOficialHabilitada = politica.escritaOficial;
export const emuladoresLaboratorioHabilitados = politica.emuladoresLaboratorio;
export const emuladoresLocaisHabilitados = emuladoresLaboratorioHabilitados;
export const escritaAdministrativaHabilitada = politica.escritaAdministrativa;
/** Para `mensagemErroFirebase()` diferenciar staging de laboratório local. */
export const ambienteFirebaseAtual = politica.ambiente;

export function exigirFirebase() {
  const firebase = obterFirebase();
  if (firebase === null) {
    throw new Error('Firebase ainda não foi configurado.');
  }
  return firebase;
}

export function exigirEscritaAdministrativaHabilitada(): void {
  if (!escritaAdministrativaHabilitada) {
    throw new Error(
      'A escrita está bloqueada. Use o laboratório local/LAN autorizado ou habilite explicitamente a escrita oficial no ambiente administrativo.',
    );
  }
}

/**
 * `login` é o ID do documento `usuarios/{login}` — a fonte de verdade da
 * identidade, por isso ignora `dados.login` (que deveria ser sempre igual,
 * mas o ID é quem manda). `uid` é metadado opcional: só existe quando
 * alguém preencheu o UID do Firebase Authentication manualmente.
 */
export function lerUsuario(
  login: string,
  dados: Record<string, unknown>,
): Usuario {
  return {
    login,
    uid: typeof dados.uid === 'string' && dados.uid.trim() !== '' ? dados.uid : undefined,
    loginAliases: Array.isArray(dados.loginAliases)
      ? dados.loginAliases.filter((login): login is string => typeof login === 'string')
      : [],
    nome: String(dados.nome ?? ''),
    email: String(dados.email ?? ''),
    cargo: String(dados.cargo ?? ''),
    equipeId: String(dados.equipeId ?? ''),
    gestorUid: typeof dados.gestorUid === 'string' ? dados.gestorUid : null,
    nivelHierarquico: Number(dados.nivelHierarquico ?? 6),
    turnoPadrao: String(dados.turnoPadrao ?? ''),
    ativo: dados.ativo !== false,
    aliasesPlanilha: Array.isArray(dados.aliasesPlanilha)
      ? dados.aliasesPlanilha.filter((alias): alias is string => typeof alias === 'string')
      : [],
    criadoEm: typeof dados.criadoEm === 'string' ? dados.criadoEm : undefined,
    atualizadoEm: typeof dados.atualizadoEm === 'string' ? dados.atualizadoEm : undefined,
  };
}
