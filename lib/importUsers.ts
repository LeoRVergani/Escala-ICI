import type { Usuario } from './modelos';
import { gerarUuid } from './uuid';

export function mapaLogins(usuarios: readonly Usuario[]): Record<string, string> {
  const pares = usuarios.flatMap((usuario) => [
    [usuario.login, usuario.uid] as const,
    ...(usuario.loginAliases ?? []).map((login) => [login, usuario.uid] as const),
  ]);
  return Object.fromEntries(pares.filter(([login]) => login.trim() !== ''));
}

export function novoUsuario(
  indice: number,
  gestor: Usuario,
  login = `novo.login${indice}`,
  ativo = false,
): Usuario {
  return {
    uid: `usuario-${gerarUuid()}`,
    login,
    nome: login === `novo.login${indice}` ? 'Novo colaborador' : login,
    email: `${login}@empresa.com`,
    cargo: 'ANALISTA_SOC',
    equipeId: gestor.equipeId,
    gestorUid: gestor.uid,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo,
  };
}
