import type { ContextoEscalaAtivo } from './contextoEscala';
import type { EscoposOperacionais } from './escoposOperacionais';
import type { Usuario } from './modelos';

/**
 * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — fonte única de "quais operações o
 * Dashboard mostra e com qual status", para o seletor superior, Visão
 * geral, Escalas, Publicação da escala, Alertas por operação e Usuários
 * nunca reimplementarem essa decisão de formas ligeiramente diferentes
 * (a causa raiz que fazia uma tela dizer "Publicada" e outra "Sem escala"
 * para a MESMA operação/competência, e que deixava aparecer um card
 * genérico "Plantão" ao lado de "Plantão COSI").
 *
 * Cada `OperacaoDashboard` vem SEMPRE de um `Equipe`/`GrupoPlantao` real já
 * resolvido por `resolverEscoposOperacionais()` (`lib/escoposOperacionais.ts`)
 * — nunca um placeholder inventado. Não existe operação genérica "Plantão":
 * o `nome` é sempre o nome real do Grupo (ex.: "Plantão COSI").
 */

export type StatusOperacaoDashboard = 'sem-escala' | 'rascunho' | 'publicada' | 'publicada-com-rascunho-pendente';

/**
 * Única função de derivação de status — Correção obrigatória 5
 * ("status operacional único"). Antes, Jornada e Plantão tinham cada uma
 * sua própria expressão inline (`resumo.publicadas.length > 0 &&
 * resumo.rascunhos.length === 0 ? 'publicada' : 'rascunho'` de um lado,
 * `resumo.competenciaRascunho !== null ? 'rascunho' : ...` do outro), e
 * NENHUMA das duas distinguia "publicada" de "publicada com rascunho
 * pendente" — um rascunho aberto por cima de uma competência já publicada
 * aparecia só como "rascunho", escondendo que já existe algo publicado.
 */
export function derivarStatusOperacaoDashboard(temRascunho: boolean, temPublicada: boolean): StatusOperacaoDashboard {
  if (temPublicada && temRascunho) {
    return 'publicada-com-rascunho-pendente';
  }
  if (temPublicada) {
    return 'publicada';
  }
  if (temRascunho) {
    return 'rascunho';
  }
  return 'sem-escala';
}

export function rotuloStatusOperacaoDashboard(status: StatusOperacaoDashboard): string {
  switch (status) {
    case 'publicada':
      return 'Publicada';
    case 'publicada-com-rascunho-pendente':
      return 'Publicada (rascunho pendente)';
    case 'rascunho':
      return 'Rascunho';
    default:
      return 'Sem escala';
  }
}

export function classeSaudeOperacaoDashboard(status: StatusOperacaoDashboard, alertas: number): 'stable' | 'attention' | 'empty' {
  if (status === 'sem-escala') {
    return 'empty';
  }
  return alertas > 0 || status === 'publicada-com-rascunho-pendente' ? 'attention' : 'stable';
}

export interface OperacaoDashboard {
  tipo: 'JORNADA' | 'PLANTAO';
  /** `equipeId` (JORNADA) ou `grupoId` (PLANTAO) — mesmo valor usado por `ContextoEscalaAtivo.alvoId`. */
  alvoId: string;
  nome: string;
  status: StatusOperacaoDashboard;
  /** `true` quando é exatamente o contexto ativo no momento. */
  ativa: boolean;
  /**
   * `true` quando o usuário só CONSULTA/monitora esta operação (ACL de
   * `equipesConsulta`), nunca administra — nunca é destino de "Nova
   * escala"/"Importar escala"/publicação.
   */
  consulta: boolean;
}

export interface StatusPorOperacao {
  temRascunho: boolean;
  temPublicada: boolean;
}

export interface DadosOperacoesDashboard {
  escopos: EscoposOperacionais;
  statusJornada: (equipeId: string) => StatusPorOperacao;
  statusPlantao: (grupoId: string) => StatusPorOperacao;
}

function operacaoEhAtiva(contexto: ContextoEscalaAtivo | null, tipo: 'JORNADA' | 'PLANTAO', alvoId: string): boolean {
  return contexto !== null && contexto.tipo === tipo && contexto.alvoId === alvoId;
}

/**
 * Regra principal de PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — a única função
 * que decide "quais operações o Dashboard mostra para este usuário, com
 * qual status, e qual está ativa agora". Usada pelo seletor superior,
 * Visão geral, Escalas, Publicação da escala e Alertas por operação —
 * nenhum desses lugares volta a montar essa lista por conta própria.
 *
 * Nunca decide autorização por conta própria: `dados.escopos` já é o
 * resultado de `resolverEscoposOperacionais()`, a fonte normativa de quem
 * administra/consulta o quê (ver `docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md`).
 * Esta função só agrega essas listas já resolvidas num formato comum,
 * anexando status e "ativa" — não pode, por construção, inventar uma
 * operação sem `Equipe`/`GrupoPlantao` real por trás.
 */
export function resolverOperacoesDashboard(
  usuario: Usuario,
  contexto: ContextoEscalaAtivo | null,
  dados: DadosOperacoesDashboard,
): OperacaoDashboard[] {
  if (!usuario.ativo) {
    return [];
  }
  const jornadas: OperacaoDashboard[] = dados.escopos.jornadasAdministraveis.map((equipe) => {
    const { temRascunho, temPublicada } = dados.statusJornada(equipe.id);
    return {
      tipo: 'JORNADA',
      alvoId: equipe.id,
      nome: equipe.nome,
      status: derivarStatusOperacaoDashboard(temRascunho, temPublicada),
      ativa: operacaoEhAtiva(contexto, 'JORNADA', equipe.id),
      consulta: false,
    };
  });
  const plantoesAdministraveis: OperacaoDashboard[] = dados.escopos.plantoesAdministraveis.map((grupo) => {
    const { temRascunho, temPublicada } = dados.statusPlantao(grupo.grupoId);
    return {
      tipo: 'PLANTAO',
      alvoId: grupo.grupoId,
      nome: grupo.nome,
      status: derivarStatusOperacaoDashboard(temRascunho, temPublicada),
      ativa: operacaoEhAtiva(contexto, 'PLANTAO', grupo.grupoId),
      consulta: false,
    };
  });
  const plantoesMonitorados: OperacaoDashboard[] = dados.escopos.plantoesMonitorados.map((grupo) => {
    const { temRascunho, temPublicada } = dados.statusPlantao(grupo.grupoId);
    return {
      tipo: 'PLANTAO',
      alvoId: grupo.grupoId,
      nome: grupo.nome,
      status: derivarStatusOperacaoDashboard(temRascunho, temPublicada),
      ativa: operacaoEhAtiva(contexto, 'PLANTAO', grupo.grupoId),
      consulta: true,
    };
  });
  return [...jornadas, ...plantoesAdministraveis, ...plantoesMonitorados];
}
