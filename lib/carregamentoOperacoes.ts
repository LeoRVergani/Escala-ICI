export type DiagnosticoErroOperacoes = 'RULES' | 'REDE' | 'INDICE' | 'DESCONHECIDO';

export type EstadoCarregamentoOperacoes =
  | { fase: 'carregando' }
  | { fase: 'sucesso' }
  | { fase: 'vazio' }
  | { fase: 'erro'; diagnostico: DiagnosticoErroOperacoes; mensagem: string };

export const MENSAGEM_MATRIZ_SEM_RULES =
  'Não foi possível carregar a Matriz de Responsáveis. Verifique se as Firestore Rules de staging foram publicadas.';

export const MENSAGEM_REDE_OPERACOES =
  'Não foi possível conectar ao Firestore para carregar as operações. Verifique sua conexão e tente novamente.';

/**
 * `failed-precondition` com "requires an index"/"index" na mensagem nunca é
 * um erro de permissão nem de rede — é uma consulta nova esperando o índice
 * composto terminar de ser criado no Firestore (ver firestore.indexes.json).
 * Isso é sempre transitório e nunca deve virar um bloqueio: o card/consulta
 * afetado mostra este aviso, mas seletor, card SOC e "Abrir editor" continuam
 * disponíveis (`estadoCarregamentoOperacoes.fase` some dessa erro; ver
 * `mensagemFalhaLeituraParcial()`/`estaVazio()` em DashboardApp.tsx).
 */
export const MENSAGEM_INDICE_OPERACOES =
  'Consulta aguardando índice do Firestore. O editor continua disponível.';

const MENSAGEM_ERRO_OPERACOES =
  'Não foi possível carregar as operações de escala. Tente novamente.';

function codigoDaFalha(falha: unknown): string {
  return typeof falha === 'object' && falha !== null && 'code' in falha
    ? String(falha.code).toLowerCase()
    : '';
}

function mensagemDaFalha(falha: unknown): string {
  return falha instanceof Error ? falha.message.toLowerCase() : String(falha ?? '').toLowerCase();
}

export function estadoErroOperacoes(falha: unknown): Extract<EstadoCarregamentoOperacoes, { fase: 'erro' }> {
  const codigo = codigoDaFalha(falha);
  const mensagem = mensagemDaFalha(falha);
  if (codigo.includes('permission-denied') || mensagem.includes('permission_denied')) {
    return { fase: 'erro', diagnostico: 'RULES', mensagem: MENSAGEM_MATRIZ_SEM_RULES };
  }
  if (codigo.includes('failed-precondition') && mensagem.includes('index')) {
    return { fase: 'erro', diagnostico: 'INDICE', mensagem: MENSAGEM_INDICE_OPERACOES };
  }
  if (
    codigo.includes('unavailable')
    || codigo.includes('deadline-exceeded')
    || codigo.includes('network-request-failed')
    || mensagem.includes('network')
    || mensagem.includes('tempo limite')
  ) {
    return { fase: 'erro', diagnostico: 'REDE', mensagem: MENSAGEM_REDE_OPERACOES };
  }
  return { fase: 'erro', diagnostico: 'DESCONHECIDO', mensagem: MENSAGEM_ERRO_OPERACOES };
}

export async function executarComLimiteDeTempo<T>(
  operacao: Promise<T>,
  tempoLimiteMs = 15_000,
): Promise<T> {
  let identificador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    identificador = setTimeout(() => {
      const erro = new Error('Tempo limite ao carregar operações.');
      Object.assign(erro, { code: 'deadline-exceeded' });
      rejeitar(erro);
    }, tempoLimiteMs);
  });
  try {
    return await Promise.race([operacao, limite]);
  } finally {
    if (identificador !== undefined) clearTimeout(identificador);
  }
}

export async function carregarOperacoesComEstado<T>(params: {
  carregar: () => Promise<T>;
  estaVazio: (dados: T) => boolean;
  tempoLimiteMs?: number;
}): Promise<
  | { estado: Extract<EstadoCarregamentoOperacoes, { fase: 'sucesso' | 'vazio' }>; dados: T }
  | { estado: Extract<EstadoCarregamentoOperacoes, { fase: 'erro' }> }
> {
  try {
    const dados = await executarComLimiteDeTempo(params.carregar(), params.tempoLimiteMs);
    return {
      estado: { fase: params.estaVazio(dados) ? 'vazio' : 'sucesso' },
      dados,
    };
  } catch (falha) {
    return { estado: estadoErroOperacoes(falha) };
  }
}
