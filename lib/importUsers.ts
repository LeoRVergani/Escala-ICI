import { normalizarNome } from './nomes';
import type { Usuario } from './modelos';
import { gerarUuid } from './uuid';

export function mapaLogins(usuarios: readonly Usuario[]): Record<string, string> {
  const pares = usuarios.flatMap((usuario) => [
    [usuario.login, usuario.uid] as const,
    ...(usuario.loginAliases ?? []).map((login) => [login, usuario.uid] as const),
  ]);
  return Object.fromEntries(pares.filter(([login]) => login.trim() !== ''));
}

/**
 * Cria o documento Firestore de um colaborador.
 *
 * Sem `uidAutenticacao`, o UID gerado é um identificador provisório
 * (`pendente-...`) que nunca corresponderá a uma conta real do Firebase
 * Authentication — o documento nasce marcado como `pendenteVinculo`. Como o
 * UID é o próprio ID do documento (contrato do projeto, ver Fase 3K-D2 no
 * checkpoint), ele não pode ser renomeado depois: quando o UID real for
 * conhecido, é preciso cadastrar um novo usuário com ele e desativar este.
 *
 * Informar `uidAutenticacao` (o UID já existente no Firebase Authentication)
 * evita esse problema — é a forma correta de cadastrar alguém que já tem
 * conta, em vez de editar manualmente um nome no Firestore para reaproveitar
 * outro colaborador fictício.
 */
export function novoUsuario(
  indice: number,
  gestor: Usuario,
  login = `novo.login${indice}`,
  ativo = false,
  uidAutenticacao?: string,
  agora: string = new Date().toISOString(),
): Usuario {
  const uidInformado = uidAutenticacao?.trim();
  return {
    uid: uidInformado || `pendente-${gerarUuid()}`,
    login,
    nome: login === `novo.login${indice}` ? 'Novo colaborador' : login,
    email: `${login}@empresa.com`,
    cargo: 'ANALISTA_SOC',
    equipeId: gestor.equipeId,
    gestorUid: gestor.uid,
    nivelHierarquico: 6,
    turnoPadrao: 'M',
    ativo,
    pendenteVinculo: !uidInformado,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Validação pura do formulário de edição do Dashboard. Não decide nada sobre
 * Firestore Rules — apenas evita gravar um cadastro obviamente inconsistente.
 */
export function validarEdicaoUsuario(
  editado: Usuario,
  usuariosDaEquipe: readonly Usuario[],
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
    outro.uid !== editado.uid
    && outro.login === editado.login
    && outro.ativo
    && !outro.substituidoPorUid)) {
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
