import type { EscopoUsuario, PerfilUsuario, Usuario } from '../modelos';

const PERFIS_VALIDOS: readonly PerfilUsuario[] = [
  'ADMIN_SISTEMA',
  'GESTOR_EQUIPE',
  'ANALISTA_SOC',
  'LEITURA',
  'GESTOR_UNIDADE',
  'SUPERVISOR_EQUIPE',
  'ANALISTA_SUPORTE',
];
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
    perfil: PERFIS_VALIDOS.includes(dados.perfil as PerfilUsuario)
      ? (dados.perfil as PerfilUsuario)
      : undefined,
    escopo: dados.escopo === 'GLOBAL' || dados.escopo === 'EQUIPE' || dados.escopo === 'UNIDADE'
      ? (dados.escopo as EscopoUsuario)
      : undefined,
    unidadeId: typeof dados.unidadeId === 'string' && dados.unidadeId.trim() !== ''
      ? dados.unidadeId
      : undefined,
    unidadesPermitidas: Array.isArray(dados.unidadesPermitidas)
      ? dados.unidadesPermitidas.filter((item): item is string => typeof item === 'string')
      : undefined,
    equipesPermitidas: Array.isArray(dados.equipesPermitidas)
      ? dados.equipesPermitidas.filter((item): item is string => typeof item === 'string')
      : undefined,
    aliasesPlanilha: Array.isArray(dados.aliasesPlanilha)
      ? dados.aliasesPlanilha.filter((alias): alias is string => typeof alias === 'string')
      : [],
    criadoEm: typeof dados.criadoEm === 'string' ? dados.criadoEm : undefined,
    atualizadoEm: typeof dados.atualizadoEm === 'string' ? dados.atualizadoEm : undefined,
  };
}
