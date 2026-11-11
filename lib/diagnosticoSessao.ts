/**
 * SESSAO-CELULAR-2 — diagnóstico do "pede login toda vez que abro": guarda no
 * aparelho o que aconteceu na última abertura, para a tela de login mostrar
 * numa linha discreta. Nada sai do aparelho; só texto técnico curto.
 */
const CHAVE_DIAGNOSTICO = 'escala-ici-sessao-diagnostico';
const CHAVE_ULTIMO_LOGIN = 'escala-ici-sessao-ultimo-login';

export type EventoSessao =
  | 'LOGIN'
  | 'RESTAURADA'
  | 'SEM_CONTA_GUARDADA'
  | 'TEMPO_ESGOTADO'
  | 'CADASTRO_FALHOU'
  | 'ERRO_RESTAURAR';

function armazenamento(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function modoDeExibicao(): string {
  if (typeof window === 'undefined') return 'desconhecido';
  const standaloneIos = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standalone = standaloneIos || window.matchMedia?.('(display-mode: standalone)').matches === true;
  return standalone ? 'instalado' : 'navegador';
}

export function registrarEventoSessao(evento: EventoSessao, detalhe = ''): void {
  const local = armazenamento();
  if (local === null) return;
  try {
    const agora = new Date().toISOString();
    if (evento === 'LOGIN') {
      local.setItem(CHAVE_ULTIMO_LOGIN, JSON.stringify({ em: agora, modo: modoDeExibicao(), detalhe }));
    }
    // "Sem conta guardada" só é problema se havia um login antes neste aparelho.
    if (evento === 'SEM_CONTA_GUARDADA' && local.getItem(CHAVE_ULTIMO_LOGIN) === null) return;
    local.setItem(CHAVE_DIAGNOSTICO, JSON.stringify({ evento, detalhe: detalhe.slice(0, 120), em: agora, modo: modoDeExibicao() }));
  } catch {
    // armazenamento cheio/bloqueado: o diagnóstico é só um extra
  }
}

const TEXTO: Record<EventoSessao, string> = {
  LOGIN: 'entrou',
  RESTAURADA: 'sessão restaurada',
  SEM_CONTA_GUARDADA: 'ao abrir, nenhuma conta estava guardada no aparelho',
  TEMPO_ESGOTADO: 'ao abrir, a conexão demorou demais',
  CADASTRO_FALHOU: 'ao abrir, a busca do cadastro falhou',
  ERRO_RESTAURAR: 'ao abrir, a restauração falhou',
};

/** Linha para a tela de login (só quando a última abertura terminou mal). */
export function textoDiagnosticoSessao(): string | null {
  const local = armazenamento();
  if (local === null) return null;
  try {
    const bruto = local.getItem(CHAVE_DIAGNOSTICO);
    if (bruto === null) return null;
    const dado = JSON.parse(bruto) as { evento: EventoSessao; detalhe: string; em: string; modo: string };
    if (dado.evento === 'RESTAURADA' || dado.evento === 'LOGIN') return null;
    const login = local.getItem(CHAVE_ULTIMO_LOGIN);
    const ultimoLogin = login ? (JSON.parse(login) as { em: string; modo: string; detalhe: string }) : null;
    const hora = new Date(dado.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return [
      `Última abertura (${hora}, ${dado.modo}): ${TEXTO[dado.evento] ?? dado.evento}`,
      dado.detalhe ? `[${dado.detalhe}]` : '',
      ultimoLogin ? `· último login em ${ultimoLogin.modo}${ultimoLogin.detalhe ? `, ${ultimoLogin.detalhe}` : ''}` : '· sem login anterior registrado',
    ].filter(Boolean).join(' ');
  } catch {
    return null;
  }
}
