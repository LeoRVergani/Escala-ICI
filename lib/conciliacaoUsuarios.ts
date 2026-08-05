import { normalizarNome } from './nomes';
import type { LinhaConciliacao, StatusConciliacao, Usuario } from './modelos';

/**
 * Fase 3K-D2 — conciliação entre o texto da coluna de colaborador da
 * planilha e os usuários cadastrados no Firestore.
 *
 * Módulo puro: não importa o SDK do Firestore e não decide nada por conta
 * própria além de classificar. A ordem de precedência é fixa e não faz
 * nenhuma aproximação por semelhança — apenas comparações exatas, com ou sem
 * normalização (acentos/caixa/espaços):
 *
 *   1. login ou `loginAliases` (comparação exata, mesma regra do parser);
 *   2. e-mail (comparação exata, sem diferenciar caixa);
 *   3. `aliasesPlanilha` ou `nome` normalizados (comparação exata);
 *   4. sem correspondência — decisão manual do gestor.
 *
 * Uma correspondência única mas inativa nunca é vinculada automaticamente:
 * fica marcada como `USUARIO_INATIVO` para o gestor decidir.
 */

const STATUS_LIBERAM_PUBLICACAO: ReadonlySet<StatusConciliacao> = new Set([
  'VINCULADO_LOGIN',
  'VINCULADO_ALIAS',
  'IGNORADA',
]);

function loginsUnicos(usuarios: readonly Usuario[]): string[] {
  return [...new Set(usuarios.map((usuario) => usuario.login))];
}

type ClassificacaoCandidatos = Omit<LinhaConciliacao, 'nomePlanilha'>;

function classificarCandidatos(
  candidatos: readonly Usuario[],
  statusVinculo: StatusConciliacao,
): ClassificacaoCandidatos | undefined {
  if (candidatos.length === 0) {
    return undefined;
  }
  if (candidatos.length > 1) {
    return {
      login: null,
      status: 'CONFLITO_ALIAS',
      candidatos: loginsUnicos(candidatos),
    };
  }
  const [unico] = candidatos;
  if (unico === undefined) {
    return undefined;
  }
  return unico.ativo
    ? { login: unico.login, status: statusVinculo, candidatos: [unico.login] }
    : { login: null, status: 'USUARIO_INATIVO', candidatos: [unico.login] };
}

export function conciliarNome(
  nomePlanilha: string,
  usuarios: readonly Usuario[],
): LinhaConciliacao {
  const texto = nomePlanilha.trim();

  const porLogin = classificarCandidatos(
    usuarios.filter((usuario) =>
      usuario.login === texto || (usuario.loginAliases ?? []).includes(texto)),
    'VINCULADO_LOGIN',
  );
  if (porLogin !== undefined) {
    return { nomePlanilha: texto, ...porLogin };
  }

  if (texto.includes('@')) {
    const porEmail = classificarCandidatos(
      usuarios.filter((usuario) => usuario.email.toLowerCase() === texto.toLowerCase()),
      'VINCULADO_LOGIN',
    );
    if (porEmail !== undefined) {
      return { nomePlanilha: texto, ...porEmail };
    }
  }

  const chave = normalizarNome(texto);
  const porAliasOuNome = classificarCandidatos(
    usuarios.filter((usuario) =>
      normalizarNome(usuario.nome) === chave
      || (usuario.aliasesPlanilha ?? []).some((alias) => normalizarNome(alias) === chave)),
    'VINCULADO_ALIAS',
  );
  if (porAliasOuNome !== undefined) {
    return { nomePlanilha: texto, ...porAliasOuNome };
  }

  return { nomePlanilha: texto, login: null, status: 'USUARIO_NAO_ENCONTRADO', candidatos: [] };
}

/**
 * Concilia cada texto distinto encontrado na planilha, na ordem em que
 * aparecem. Textos vazios são ignorados (o parser já trata linha vazia como
 * fim da tabela).
 */
export function conciliarPlanilha(
  nomes: readonly string[],
  usuarios: readonly Usuario[],
): LinhaConciliacao[] {
  const distintos = [...new Set(nomes.map((nome) => nome.trim()).filter((nome) => nome !== ''))];
  return distintos.map((nome) => conciliarNome(nome, usuarios));
}

export function publicacaoBloqueadaPorConciliacao(
  linhas: readonly LinhaConciliacao[],
): boolean {
  return linhas.some((linha) => !STATUS_LIBERAM_PUBLICACAO.has(linha.status));
}

export function contarPendenciasConciliacao(
  linhas: readonly LinhaConciliacao[],
): number {
  return linhas.filter((linha) => !STATUS_LIBERAM_PUBLICACAO.has(linha.status)).length;
}

/** O gestor escolheu manualmente o usuário para esta linha. */
export function resolverManualmente(
  linha: LinhaConciliacao,
  usuario: Usuario,
): LinhaConciliacao {
  return usuario.ativo
    ? { ...linha, login: usuario.login, status: 'VINCULADO_ALIAS', candidatos: [usuario.login] }
    : { ...linha, login: null, status: 'USUARIO_INATIVO', candidatos: [usuario.login] };
}

export function marcarPendente(linha: LinhaConciliacao): LinhaConciliacao {
  return { ...linha, login: null, status: 'PRECISA_MAPEAR' };
}

export function ignorarLinha(linha: LinhaConciliacao): LinhaConciliacao {
  return { ...linha, status: 'IGNORADA' };
}

/**
 * Estende um `loginParaUid` (ver `lib/importUsers.ts`) com os vínculos
 * resolvidos pela conciliação, para uma nova chamada de
 * `parsePlanilhaEscala` reconhecer os nomes que não batiam pelo login exato.
 */
export function loginParaUidComConciliacao(
  base: Readonly<Record<string, string>>,
  linhas: readonly LinhaConciliacao[],
): Record<string, string> {
  const extra = Object.fromEntries(
    linhas
      .filter((linha) => linha.login !== null && linha.status !== 'IGNORADA')
      .map((linha) => [linha.nomePlanilha, linha.login as string]),
  );
  return { ...base, ...extra };
}
