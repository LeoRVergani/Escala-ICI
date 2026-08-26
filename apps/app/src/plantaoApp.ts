import {
  adicionarDias,
  converterInstanteUtcParaMomento,
  TAMANHO_PALETA_IDENTIDADE_PLANTAO,
  type AtribuicaoPlantaoPersistida,
  type ContatoPlantonista,
  type GrupoPlantao,
  type ParticipantePlantao,
} from '@escala-ici/contrato';

import type { Usuario } from '@/lib/modelos';

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — lógica pura por trás da
 * visão "Plantão" do App: quem está de plantão agora, quem vem depois,
 * contatos ativos, e os próximos plantões do próprio usuário (quando ele é
 * plantonista). Sem dependência de DOM/React/Firebase, mesmo princípio de
 * `hojeConsulta.ts` — só lê o que já foi carregado (competência PUBLICADA +
 * atribuições + participantes), nunca decide autorização nem escreve nada.
 */

export interface PlantaoAgoraResumo {
  /** Atribuição cujo intervalo [inicio, fim) contém `agoraIso` — `null` se ninguém estiver de plantão agora. */
  atual: AtribuicaoPlantaoPersistida | null;
  /** Primeira atribuição com `inicio` estritamente depois de `agoraIso` — `null` se não houver nenhuma. */
  proximo: AtribuicaoPlantaoPersistida | null;
}

/**
 * Instantes UTC (`inicio`/`fim`) já vêm como string ISO 8601 de largura
 * fixa (`AAAA-MM-DDThh:mm:ss.sssZ`) — comparação lexicográfica de string já
 * é comparação cronológica correta, sem precisar construir `Date` (que
 * herdaria o timezone da máquina para qualquer formatação, o que este
 * módulo evita de propósito).
 */
export function resolverPlantaoAgora(
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  agoraIso: string,
): PlantaoAgoraResumo {
  const ordenadas = [...atribuicoes].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const atual = ordenadas.find((atribuicao) => atribuicao.inicio <= agoraIso && agoraIso < atribuicao.fim) ?? null;
  const proximo = ordenadas.find((atribuicao) => atribuicao.inicio > agoraIso) ?? null;
  return { atual, proximo };
}

/**
 * PATCH-NOC-SUPERVISAO-CONSULTA-PLANTAO-UX-1 — classifica o que a aba "Hoje"
 * deve destacar quando ninguém está de plantão agora (`resumo.atual ===
 * null`): o próximo plantão ainda hoje, o próximo plantão futuro (outro
 * dia), ou nenhum plantão publicado daqui pra frente. Nunca usa
 * `resumo.atual` — quem chama já sabe tratar esse caso separadamente.
 */
export type DestaquePlantaoHoje =
  | { estado: 'PROXIMO_HOJE' | 'PROXIMO_FUTURO'; atribuicao: AtribuicaoPlantaoPersistida }
  | { estado: 'VAZIO' };

export function resolverDestaquePlantaoHoje(
  resumo: PlantaoAgoraResumo,
  timezone: string,
  dataHoje: string,
): DestaquePlantaoHoje {
  if (resumo.proximo === null) {
    return { estado: 'VAZIO' };
  }
  const intervalo = intervaloPlantaoCivil(resumo.proximo, timezone);
  return {
    estado: intervalo.valido && intervalo.dataInicio === dataHoje ? 'PROXIMO_HOJE' : 'PROXIMO_FUTURO',
    atribuicao: resumo.proximo,
  };
}

export function nomeExibicaoPlantonista(login: string, usuarios: readonly Usuario[]): string {
  return usuarios.find((usuario) => usuario.login === login)?.nome ?? login;
}

const CONECTIVOS_NOME_PLANTAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function iniciaisDeTokens(tokensBrutos: readonly string[]): string {
  const tokens = tokensBrutos.filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return '';
  }
  const significativos = tokens.filter((token) => !CONECTIVOS_NOME_PLANTAO.has(token.toLowerCase()));
  const lista = significativos.length > 0 ? significativos : tokens;
  if (lista.length >= 2) {
    return `${lista[0][0]}${lista[lista.length - 1][0]}`.toUpperCase();
  }
  return lista[0].slice(0, 2).toUpperCase();
}

/**
 * Iniciais de identificação de um participante de Plantão: primeira letra do
 * primeiro nome + primeira letra do último nome SIGNIFICATIVO — conectivos
 * ("de", "da", "do", "das", "dos", "e") nunca viram a inicial. Cai para o
 * `login` quando não há `nome`, e para as 2 primeiras letras de uma única
 * palavra quando não há como formar 2 iniciais. Nunca lança; string vazia só
 * quando nem `nome` nem `login` têm conteúdo.
 *
 * Substitui `inicialPlantonista()` (usava as duas PRIMEIRAS palavras e
 * devolvia 1 letra só para nome de uma palavra) e converge com o algoritmo
 * já usado no Dashboard (`components/plantao/PlantaoCalendario.tsx`).
 */
export function obterIniciaisParticipantePlantao(nome?: string, login?: string): string {
  const nomeLimpo = (nome ?? '').trim();
  if (nomeLimpo !== '') {
    return iniciaisDeTokens(nomeLimpo.split(/\s+/u));
  }
  const loginLimpo = (login ?? '').trim();
  if (loginLimpo !== '') {
    return iniciaisDeTokens(loginLimpo.split(/[.\-_@\s]+/u));
  }
  return '';
}

/** Só contatos `ativo: true` — o mesmo critério que o Dashboard já usa para não oferecer um número desligado/trocado. */
export function contatosAtivosDoPlantonista(
  login: string,
  participantes: readonly ParticipantePlantao[],
): ContatoPlantonista[] {
  return (participantes.find((participante) => participante.login === login)?.contatos ?? [])
    .filter((contato) => contato.ativo);
}

/** Próximos plantões do PRÓPRIO usuário (`plantonistaLogin === login`), já em ordem cronológica, limitado a `limite` itens. */
export function proximosPlantoesDoUsuario(
  login: string,
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  agoraIso: string,
  limite: number,
): AtribuicaoPlantaoPersistida[] {
  return atribuicoes
    .filter((atribuicao) => atribuicao.plantonistaLogin === login && atribuicao.fim > agoraIso)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, limite);
}

export interface IntervaloPlantaoCivil {
  /** "HH:mm", ou "--:--" quando `valido` é `false`. */
  horaInicio: string;
  /** "HH:mm", ou "--:--" quando `valido` é `false`. */
  horaFim: string;
  /** "AAAA-MM-DD" no timezone do Grupo, ou "" quando `valido` é `false`. */
  dataInicio: string;
  /** "AAAA-MM-DD" no timezone do Grupo, ou "" quando `valido` é `false`. */
  dataFim: string;
  /** Diferença de dias civis entre `dataInicio` e `dataFim` (0 = mesmo dia). */
  diasDeDiferenca: number;
  /** `true` quando o plantão termina num dia civil diferente do início. */
  cruzaDiaSeguinte: boolean;
  /** `false` quando `inicio`/`fim`/`timezone` não puderam ser convertidos (documento corrompido). */
  valido: boolean;
}

const INTERVALO_PLANTAO_CIVIL_INVALIDO: IntervaloPlantaoCivil = {
  horaInicio: '--:--',
  horaFim: '--:--',
  dataInicio: '',
  dataFim: '',
  diasDeDiferenca: 0,
  cruzaDiaSeguinte: false,
  valido: false,
};

/**
 * Converte um intervalo de Plantão (instantes UTC) para horário/data civil no
 * timezone do Grupo. NUNCA lança: `converterInstanteUtcParaMomento()` lança
 * em instante ou timezone inválido, e propagar isso derrubaria a árvore de
 * render inteira por causa de um único documento corrompido — mesmo
 * princípio de `lib/dataSegura.ts`.
 */
export function intervaloPlantaoCivil(
  atribuicao: Pick<AtribuicaoPlantaoPersistida, 'inicio' | 'fim'>,
  timezone: string,
): IntervaloPlantaoCivil {
  try {
    const inicio = converterInstanteUtcParaMomento(atribuicao.inicio, timezone);
    const fim = converterInstanteUtcParaMomento(atribuicao.fim, timezone);
    const diasDeDiferenca = Math.round(
      (Date.parse(`${fim.data}T00:00:00.000Z`) - Date.parse(`${inicio.data}T00:00:00.000Z`)) / 86_400_000,
    );
    return {
      horaInicio: inicio.hora,
      horaFim: fim.hora,
      dataInicio: inicio.data,
      dataFim: fim.data,
      diasDeDiferenca,
      cruzaDiaSeguinte: diasDeDiferenca > 0,
      valido: true,
    };
  } catch {
    return INTERVALO_PLANTAO_CIVIL_INVALIDO;
  }
}

/** Forma neutra: só descreve o próprio intervalo, nunca afirma "hoje"/"amanhã" — segura em qualquer contexto (inclusive plantão futuro). */
export function formatarIntervaloPlantaoCivil(intervalo: IntervaloPlantaoCivil): string {
  if (!intervalo.valido) {
    return 'Horário indisponível';
  }
  if (!intervalo.cruzaDiaSeguinte) {
    return `${intervalo.horaInicio}–${intervalo.horaFim}`;
  }
  const sufixo = intervalo.diasDeDiferenca === 1 ? 'termina no dia seguinte' : `termina ${intervalo.diasDeDiferenca} dias depois`;
  return `${intervalo.horaInicio}–${intervalo.horaFim} · ${sufixo}`;
}

/** Forma relativa a HOJE: só usa "hoje/amanhã" quando o plantão realmente começa hoje; senão cai na forma neutra, nunca mente sobre a data. */
export function formatarIntervaloPlantaoRelativoAHoje(intervalo: IntervaloPlantaoCivil, dataHoje: string): string {
  if (!intervalo.valido || intervalo.dataInicio !== dataHoje) {
    return formatarIntervaloPlantaoCivil(intervalo);
  }
  if (!intervalo.cruzaDiaSeguinte) {
    return `${intervalo.horaInicio}–${intervalo.horaFim} hoje`;
  }
  return `${intervalo.horaInicio} hoje → ${intervalo.horaFim} amanhã`;
}

/** Substitui o ternário duplicado `Até {horaFim}{cruzaDiaSeguinte ? ' (amanhã)' : ''}` — mesma regra: só diz "amanhã" quando o plantão começou hoje de verdade. */
export function rotuloFimPlantao(intervalo: IntervaloPlantaoCivil, dataHoje: string): string {
  if (!intervalo.valido) {
    return 'Horário indisponível';
  }
  if (!intervalo.cruzaDiaSeguinte) {
    return `Até ${intervalo.horaFim}`;
  }
  return intervalo.dataInicio === dataHoje ? `Até ${intervalo.horaFim} de amanhã` : `Até ${intervalo.horaFim} do dia seguinte`;
}

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-2 — todos os dias civis
 * entre `periodoInicio` e `periodoFim` (inclusive), na ordem do calendário.
 * A competência de Plantão nem sempre alinha com o mês civil (pode ir de
 * 26/07 a 25/08, por exemplo) — por isso o calendário do App usa o período
 * REAL da competência publicada (`CompetenciaPlantao.periodoInicio/Fim`),
 * nunca o primeiro/último dia do mês calculado a partir da competência.
 * Comparação/iteração por string ISO (largura fixa), mesmo princípio do
 * restante do módulo.
 */
export function diasCivisNoPeriodo(periodoInicio: string, periodoFim: string): string[] {
  const dias: string[] = [];
  let cursor = periodoInicio;
  while (cursor <= periodoFim) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

/** Atribuições agrupadas pelo dia civil (no timezone do Grupo) em que CADA UMA começa — mesmo critério de `lib/editorPlantao.ts`. */
export function atribuicoesPorDiaCivil(
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  timezone: string,
): Map<string, AtribuicaoPlantaoPersistida[]> {
  const porDia = new Map<string, AtribuicaoPlantaoPersistida[]>();
  for (const atribuicao of atribuicoes) {
    const dia = converterInstanteUtcParaMomento(atribuicao.inicio, timezone).data;
    const lista = porDia.get(dia) ?? [];
    lista.push(atribuicao);
    porDia.set(dia, lista);
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }
  return porDia;
}

/**
 * Índice ESTÁVEL (0..7) na paleta categórica de identidade visual
 * (`TAMANHO_PALETA_IDENTIDADE_PLANTAO`, `app/globals.css`). Usa
 * `ParticipantePlantao.corPreferida` quando o próprio plantonista já
 * escolheu uma cor válida; caso contrário cai num hash determinístico do
 * LOGIN (identificador estável, ao contrário do nome digitado no XLS usado
 * por `lib/editorPlantao.ts` — por isso um hash próprio aqui, não o mesmo
 * cálculo). A mesma pessoa nunca muda de cor entre sessões sem escolher.
 */
/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — quando uma equipe
 * consulta vários Grupos de Plantão (ex.: NOC vendo COSI+DBA+Linux), qual
 * deles aparece selecionado por padrão ao abrir o App. Prefere um Grupo
 * onde o usuário é participante ATIVO (mais relevante para quem também é
 * plantonista); sem nenhum, cai no primeiro retornado — mesmo
 * comportamento de antes desta fase para quem só tem um Grupo (nunca
 * regride o caso comum). `null` só quando `grupos` está vazio.
 */
export function escolherGrupoPlantaoPadrao(
  grupos: readonly GrupoPlantao[],
  participantesPorGrupo: Readonly<Record<string, readonly ParticipantePlantao[]>>,
  loginUsuario: string,
): string | null {
  const comParticipacaoAtiva = grupos.find((grupo) =>
    (participantesPorGrupo[grupo.grupoId] ?? []).some((participante) => participante.login === loginUsuario && participante.ativo));
  return comParticipacaoAtiva?.grupoId ?? grupos[0]?.grupoId ?? null;
}

/**
 * HOTFIX-TROCAS-PLANTAO-ESCOPO-CONSULTA-1 — decide se o usuário deve
 * acompanhar as trocas de plantão do Grupo selecionado. Espelha o que a
 * Rule de `trocasPlantao` (`firestore.rules`) libera para `list`/`get`:
 * participante ATIVO do Grupo, ou quem administra o Grupo (aprova trocas).
 * Quem só CONSULTA o Grupo (ex.: NOC vendo COSI+DBA+Linux) não é
 * participante ativo nem administra — não deve acompanhar, sob pena de
 * `permission-denied`.
 */
export function podeAcompanharTrocasPlantaoDoGrupo(
  participantes: readonly ParticipantePlantao[],
  loginUsuario: string,
  podeAprovarTrocaPlantao: boolean,
): boolean {
  const souParticipanteAtivo = participantes.some(
    (participante) => participante.login === loginUsuario && participante.ativo,
  );
  return souParticipanteAtivo || podeAprovarTrocaPlantao;
}

/**
 * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — `ContatoPlantonista.rotulo`
 * é texto livre (ex.: "WhatsApp", "E-mail", "Slack", "Ramal") — nunca um
 * enum fechado no modelo. Esta função só decide qual ícone mostrar ao
 * lado do contato (visual, nunca autorização); um rótulo não reconhecido
 * sempre cai em `'telefone'`, o padrão mais seguro (é o que a maioria dos
 * contatos de plantão realmente é).
 */
export type PlataformaContatoPlantao = 'whatsapp' | 'email' | 'chat' | 'telefone';

export function plataformaContatoPlantao(rotulo: string): PlataformaContatoPlantao {
  const normalizado = rotulo.trim().toLowerCase();
  if (normalizado.includes('whatsapp') || normalizado.includes('zap')) {
    return 'whatsapp';
  }
  if (normalizado.includes('mail')) {
    return 'email';
  }
  if (normalizado.includes('slack') || normalizado.includes('teams') || normalizado.includes('chat')) {
    return 'chat';
  }
  return 'telefone';
}

export function indiceCorPlantonista(
  login: string,
  participantes: readonly ParticipantePlantao[],
): number {
  const preferida = participantes.find((participante) => participante.login === login)?.corPreferida;
  if (typeof preferida === 'number' && Number.isInteger(preferida) && preferida >= 0 && preferida < TAMANHO_PALETA_IDENTIDADE_PLANTAO) {
    return preferida;
  }
  let hash = 0;
  for (let indice = 0; indice < login.length; indice += 1) {
    hash = (hash * 31 + login.charCodeAt(indice)) >>> 0;
  }
  return hash % TAMANHO_PALETA_IDENTIDADE_PLANTAO;
}

export interface EstatisticasPlantaoApp {
  /** Soma de `duracaoMinutos` de todos os plantões do usuário, em HORAS (fracionário — ex.: 12.5 = 12h30). */
  horasTotais: number;
  /** Quantidade de plantões do usuário nas atribuições recebidas. */
  totalPlantoes: number;
  /** Quantos desses plantões caem em final de semana (sábado ou domingo). */
  finaisDeSemana: number;
}

/**
 * FASE-APP-REDESIGN-HOJE-1 — estatísticas do PRÓPRIO usuário no Plantão:
 * horas totais, quantidade de plantões e quantos caem em final de semana.
 * `atribuicoes` já deve vir filtrada pela competência de interesse (mesmo
 * padrão de `proximosPlantoesDoUsuario` — este módulo nunca decide qual
 * competência é "a atual", isso é responsabilidade de quem carrega os
 * dados). Classifica cada plantão pelo dia CIVIL de início (mesmo critério
 * de `atribuicoesPorDiaCivil`) via `Date#getUTCDay()` (0 = domingo, 6 =
 * sábado, mesma convenção de `NOMES_DIA_SEMANA` em
 * `modeloPlantaoPersistente.ts`) — um plantão que começa sábado à noite e
 * termina domingo de manhã conta como UM plantão de final de semana, nunca
 * dois, porque é um único plantão com um único dia de início.
 */
export function estatisticasPlantaoApp(
  login: string,
  atribuicoes: readonly AtribuicaoPlantaoPersistida[],
  timezone: string,
): EstatisticasPlantaoApp {
  const doUsuario = atribuicoes.filter((atribuicao) => atribuicao.plantonistaLogin === login);
  const minutosTotais = doUsuario.reduce((soma, atribuicao) => soma + atribuicao.duracaoMinutos, 0);
  const finaisDeSemana = doUsuario.filter((atribuicao) => {
    const intervalo = intervaloPlantaoCivil(atribuicao, timezone);
    if (!intervalo.valido) {
      return false;
    }
    const diaSemana = new Date(`${intervalo.dataInicio}T12:00:00Z`).getUTCDay();
    return diaSemana === 0 || diaSemana === 6;
  }).length;
  return {
    horasTotais: minutosTotais / 60,
    totalPlantoes: doUsuario.length,
    finaisDeSemana,
  };
}
