import type { Usuario } from '@/lib/modelos';

/**
 * FASE-APP-OPERACOES-UNIVERSAIS-1 — o App nasceu focado em Jornada 6x1 e
 * tratava a ausência dela como "a" condição de erro do login inteiro,
 * mesmo depois de o Plantão ganhar visualização própria (`plantaoApp.ts`).
 * Um usuário que só participa de Plantão (ex.: um plantonista sem Jornada
 * 6x1 cadastrada) via o alerta vermelho global "Nenhuma jornada 6x1
 * encontrada para este período." mesmo tendo dados reais para mostrar.
 *
 * Este módulo é o único lugar que decide, de forma pura (sem
 * DOM/React/Firebase, mesmo princípio de `plantaoApp.ts`/`hojeConsulta.ts`),
 * quais operações (Jornada 6x1, Plantão) existem para o usuário num
 * período e qual delas deve aparecer em primeiro lugar — para que a
 * ausência de UMA operação nunca vire erro global enquanto a OUTRA estiver
 * disponível. Ver `docs/spec/APP_PLANTAO_VISUALIZACAO.md`.
 */

/** Entrada mínima sobre a Jornada 6x1 do usuário na competência ativa — já resolvida pelo chamador (`minhaEscala` do App). */
export interface DadosJornadaApp {
  /** `true` quando existe uma Jornada 6x1 PUBLICADA do próprio usuário para o período consultado. */
  escalaPublicada: boolean;
}

/**
 * Entrada mínima sobre o Plantão do usuário. `grupo` é `undefined` enquanto
 * a consulta ainda não terminou (nunca deve ser tratado como "não tem
 * Plantão" — só `null`, depois de resolvida, significa isso de fato).
 */
export interface DadosPlantaoApp {
  /** `undefined` = consulta ainda não concluída; `null` = equipe não tem Grupo de Plantão no escopo. */
  grupo: { grupoId: string; nome: string } | null | undefined;
  /** Competência (chave "AAAA-MM") com atribuições PUBLICADAS para este Grupo, ou `null` se não publicada. */
  competenciaPublicada: string | null;
  /** O próprio usuário aparece como participante ATIVO do Grupo. */
  participante: boolean;
  /** A consulta aos detalhes do Grupo (participantes/atribuições) foi autorizada — `false` só em permission-denied específico. */
  consulta: boolean;
}

export type OperacaoApp =
  | {
    tipo: 'JORNADA';
    equipeId: string;
    nome: string;
    status: 'sem-escala' | 'publicada';
  }
  | {
    tipo: 'PLANTAO';
    grupoId: string;
    nome: string;
    status: 'sem-escala' | 'publicada';
    participante: boolean;
    consulta: boolean;
  };

/**
 * Resolve as operações que o App conhece para este usuário nesta
 * competência. A Jornada sempre aparece na lista (mesmo `sem-escala`) — só
 * o Plantão é omitido quando a consulta ainda não terminou (`grupo ===
 * undefined`) ou quando a equipe não tem nenhum Grupo no escopo (`grupo
 * === null`), já que aí não há operação de Plantão nenhuma para descrever.
 */
export function resolverOperacoesApp(
  usuario: Pick<Usuario, 'equipeId'>,
  dadosJornada: DadosJornadaApp,
  dadosPlantao: DadosPlantaoApp,
  competencia: string,
): OperacaoApp[] {
  const operacoes: OperacaoApp[] = [
    {
      tipo: 'JORNADA',
      equipeId: usuario.equipeId,
      nome: 'Jornada 6x1',
      status: dadosJornada.escalaPublicada ? 'publicada' : 'sem-escala',
    },
  ];
  if (dadosPlantao.grupo != null) {
    operacoes.push({
      tipo: 'PLANTAO',
      grupoId: dadosPlantao.grupo.grupoId,
      nome: dadosPlantao.grupo.nome,
      status: dadosPlantao.competenciaPublicada === competencia ? 'publicada' : 'sem-escala',
      participante: dadosPlantao.participante,
      consulta: dadosPlantao.consulta,
    });
  }
  return operacoes;
}

export type EstadoGlobalApp = 'com-operacoes' | 'sem-operacoes';

/**
 * `'sem-operacoes'` só quando NENHUMA operação está publicada — é a única
 * condição em que o App deve mostrar um estado vazio geral. Nunca decide
 * erro (erro real de Firestore/Auth continua um estado à parte, tratado
 * pelo próprio chamador — ver regra 10 de `docs/spec/APP_PLANTAO_VISUALIZACAO.md`).
 */
export function derivarEstadoGlobalApp(operacoes: readonly OperacaoApp[]): EstadoGlobalApp {
  return operacoes.some((operacao) => operacao.status === 'publicada')
    ? 'com-operacoes'
    : 'sem-operacoes';
}

export function temJornadaPublicada(operacoes: readonly OperacaoApp[]): boolean {
  return operacoes.some((operacao) => operacao.tipo === 'JORNADA' && operacao.status === 'publicada');
}

export function temPlantaoPublicado(operacoes: readonly OperacaoApp[]): boolean {
  return operacoes.some((operacao) => operacao.tipo === 'PLANTAO' && operacao.status === 'publicada');
}

/**
 * Operação a destacar na aba Hoje quando só uma pode vir em primeiro lugar
 * (ex.: título/prioridade visual). Jornada 6x1 sempre antes de Plantão
 * quando as duas existem (regra 4 do App universal) — não é um juízo de
 * importância, só a ordem que o produto já usa em todo o resto do App.
 */
export function operacaoPrincipalHoje(operacoes: readonly OperacaoApp[]): OperacaoApp | null {
  const jornada = operacoes.find((operacao) => operacao.tipo === 'JORNADA' && operacao.status === 'publicada');
  if (jornada) {
    return jornada;
  }
  return operacoes.find((operacao) => operacao.tipo === 'PLANTAO' && operacao.status === 'publicada') ?? null;
}
