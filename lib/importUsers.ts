import { normalizarNome } from './nomes';
import type { Usuario } from './modelos';

/**
 * Mapa usado pelo parser da planilha para aceitar uma linha: a chave é o
 * login (ou alias) e o valor é o login oficial do cadastro — o próprio ID
 * do documento `usuarios/{login}`. Não depende de nenhum UID do Firebase
 * Authentication.
 */
export function mapaLogins(usuarios: readonly Usuario[]): Record<string, string> {
  const pares = usuarios.flatMap((usuario) => [
    [usuario.login, usuario.login] as const,
    ...(usuario.loginAliases ?? []).map((alias) => [alias, usuario.login] as const),
  ]);
  return Object.fromEntries(pares.filter(([login]) => login.trim() !== ''));
}

/**
 * Cria o documento Firestore de um colaborador em `usuarios/{login}`. O
 * login é a chave funcional e o ID do documento desde a criação — nunca
 * precisa de vínculo posterior com nenhuma conta do Firebase Authentication.
 */
export function novoUsuario(
  indice: number,
  gestor: Usuario,
  login = `novo.login${indice}`,
  ativo = false,
  agora: string = new Date().toISOString(),
): Usuario {
  return {
    login,
    nome: login === `novo.login${indice}` ? 'Novo colaborador' : login,
    email: `${login}@empresa.com`,
    cargo: 'ANALISTA_SOC',
    equipeId: gestor.equipeId,
    gestorUid: gestor.uid ?? null,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Validação pura do formulário de edição do Dashboard. Não decide nada sobre
 * Firestore Rules — apenas evita gravar um cadastro obviamente inconsistente.
 *
 * `loginOriginal` é o login do cadastro sendo editado (`null` para um
 * cadastro novo). Como o login é o próprio ID do documento — imutável após
 * criado —, é o jeito de distinguir "estou editando este mesmo cadastro" de
 * "este login já pertence a outro colaborador".
 */
export function validarEdicaoUsuario(
  editado: Usuario,
  usuariosDaEquipe: readonly Usuario[],
  loginOriginal: string | null = null,
): string[] {
  const erros: string[] = [];

  if (editado.nome.trim() === '') {
    erros.push('Informe o nome do colaborador.');
  }
  if (!EMAIL_VALIDO.test(editado.email)) {
    erros.push('Informe um e-mail válido.');
  }
  if (editado.login.trim() === '') {
    erros.push('Informe o login usado na planilha.');
  }
  if (usuariosDaEquipe.some((outro) =>
    outro.login === editado.login
    && outro.login !== loginOriginal
    && outro.ativo)) {
    erros.push('Este login já está em uso por outro colaborador ativo da equipe.');
  }
  if (!Number.isInteger(editado.nivelHierarquico) || editado.nivelHierarquico < 1) {
    erros.push('Informe um nível hierárquico válido.');
  }

  return erros;
}

/**
 * Remove vazios e duplicidades normalizadas (acentos/caixa/espaços), mantendo
 * a primeira grafia digitada pelo gestor.
 */
export function normalizarAliasesPlanilha(aliases: readonly string[]): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const alias of aliases) {
    const limpo = alias.trim();
    if (limpo === '') {
      continue;
    }
    const chave = normalizarNome(limpo);
    if (vistos.has(chave)) {
      continue;
    }
    vistos.add(chave);
    resultado.push(limpo);
  }
  return resultado;
}
