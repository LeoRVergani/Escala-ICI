/**
 * Fase ESCALAS-UX-2A.1 — `ContextoEscalaAtivo` é a fonte de verdade
 * explícita para "qual escala o usuário está trabalhando agora", que o
 * Dashboard nunca teve (ver `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`
 * § 32). Puro, sem React/Firebase — identidade é sempre por ID real
 * (`alvoId`), nunca nome/sigla/cargo/UID. `label` é somente a apresentação
 * já resolvida no momento da seleção e nunca participa da identidade nem de
 * qualquer consulta/escrita. Estado de FRONTEND
 * apenas, nunca persistido no Firestore nesta fase.
 *
 * Nunca confundir com perfil/pertencimento organizacional: trocar de
 * contexto nunca altera `Usuario.equipeId` nem autorização — é só "o que
 * está em tela", igual a trocar de aba num editor de texto.
 */
export type ContextoEscalaAtivo =
  | { tipo: 'JORNADA'; alvoId: string; label: string; competencia: string }
  | { tipo: 'PLANTAO'; alvoId: string; label: string; competencia: string };

export interface ArmazenamentoContextoEscala {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export type ResultadoRestauracaoContextoEscala =
  | { estado: 'ausente' }
  | { estado: 'invalido' }
  | { estado: 'valido'; contexto: ContextoEscalaAtivo };

const PREFIXO_CONTEXTO_ESCALA = 'escala-ici:contexto-escala:';

export function chaveArmazenamentoContextoEscala(login: string): string {
  return `${PREFIXO_CONTEXTO_ESCALA}${login.trim().toLowerCase()}`;
}

export function criarContextoEscala(
  tipo: ContextoEscalaAtivo['tipo'],
  alvoId: string,
  label: string,
  competencia: string,
): ContextoEscalaAtivo {
  if (alvoId.trim() === '') {
    throw new Error('Não é permitido abrir uma escala sem alvo operacional.');
  }
  return { tipo, alvoId, label: label.trim() || alvoId, competencia };
}

export function contextoEhJornada(
  contexto: ContextoEscalaAtivo | null,
): contexto is Extract<ContextoEscalaAtivo, { tipo: 'JORNADA' }> {
  return contexto !== null && contexto.tipo === 'JORNADA';
}

export function contextoEhPlantao(
  contexto: ContextoEscalaAtivo | null,
): contexto is Extract<ContextoEscalaAtivo, { tipo: 'PLANTAO' }> {
  return contexto !== null && contexto.tipo === 'PLANTAO';
}

/**
 * Chave estável para comparação/indexação — nunca usa nome/sigla, só os
 * IDs reais + a competência (que também faz parte da identidade do
 * contexto: a mesma equipe em meses diferentes é um contexto diferente).
 */
export function chaveContextoEscala(contexto: ContextoEscalaAtivo): string {
  return `${contexto.tipo}:${contexto.alvoId}:${contexto.competencia}`;
}

export function contextosEscalaIguais(
  a: ContextoEscalaAtivo | null,
  b: ContextoEscalaAtivo | null,
): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return chaveContextoEscala(a) === chaveContextoEscala(b);
}

function contextoPersistidoBemFormado(valor: unknown): valor is ContextoEscalaAtivo {
  if (typeof valor !== 'object' || valor === null) return false;
  const candidato = valor as Partial<ContextoEscalaAtivo>;
  return (candidato.tipo === 'JORNADA' || candidato.tipo === 'PLANTAO')
    && typeof candidato.alvoId === 'string'
    && candidato.alvoId.trim() !== ''
    && typeof candidato.label === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/u.test(candidato.competencia ?? '');
}

/**
 * Persiste somente a preferência visual do usuário. A autorização continua
 * vindo da matriz; por isso a restauração abaixo sempre revalida o alvo
 * contra as opções ativas carregadas antes de devolvê-lo à UI.
 */
export function salvarContextoEscalaPersistido(
  login: string,
  contexto: ContextoEscalaAtivo,
  armazenamento: ArmazenamentoContextoEscala,
): void {
  armazenamento.setItem(chaveArmazenamentoContextoEscala(login), JSON.stringify(contexto));
}

export function limparContextoEscalaPersistido(
  login: string,
  armazenamento: ArmazenamentoContextoEscala,
): void {
  armazenamento.removeItem(chaveArmazenamentoContextoEscala(login));
}

/**
 * HOTFIX-COMPETENCIA-OPERACIONAL-DINAMICA-1 — `competenciaInicial`, quando
 * informada, prevalece sobre a competência persistida: uma NOVA
 * sessão/carregamento do Dashboard deve sempre nascer na competência
 * operacional atual (ex.: dia 26 já é o mês seguinte), nunca reabrir a
 * competência antiga que ficou salva no localStorage da última visita. Sem
 * `competenciaInicial` (compat, ex.: chamadores existentes/testes), o
 * comportamento é o de sempre — restaura a competência tal como persistida.
 * O ALVO (`tipo`/`alvoId`) sempre vem do que foi persistido, revalidado
 * contra `contextosValidos`; só a competência é normalizada aqui. Navegação
 * manual para um mês histórico DURANTE a sessão não passa por esta função —
 * só o carregamento inicial.
 */
export function restaurarContextoEscalaPersistido(
  login: string,
  contextosValidos: readonly ContextoEscalaAtivo[],
  armazenamento: ArmazenamentoContextoEscala,
  opcoes?: { competenciaInicial?: string },
): ResultadoRestauracaoContextoEscala {
  const chave = chaveArmazenamentoContextoEscala(login);
  const bruto = armazenamento.getItem(chave);
  if (bruto === null) return { estado: 'ausente' };

  let persistido: unknown;
  try {
    persistido = JSON.parse(bruto);
  } catch {
    armazenamento.removeItem(chave);
    return { estado: 'invalido' };
  }
  if (!contextoPersistidoBemFormado(persistido)) {
    armazenamento.removeItem(chave);
    return { estado: 'invalido' };
  }
  const alvoAtual = contextosValidos.find((contexto) =>
    contexto.tipo === persistido.tipo && contexto.alvoId === persistido.alvoId);
  if (alvoAtual === undefined) {
    armazenamento.removeItem(chave);
    return { estado: 'invalido' };
  }
  return {
    estado: 'valido',
    contexto: criarContextoEscala(
      alvoAtual.tipo,
      alvoAtual.alvoId,
      alvoAtual.label,
      opcoes?.competenciaInicial ?? persistido.competencia,
    ),
  };
}
