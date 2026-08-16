import {
  calcularDuracaoBrutaDosIntervalos,
  calcularDuracaoEntreMomentos,
  detectarSobreposicoesPlantao,
  identificarLacunasPlantao,
  type AtribuicaoPlantaoBruta,
  type LacunaPlantao,
  type MomentoPlantao,
  type SobreposicaoPlantao,
  type TotalBrutoPlantao,
} from '@escala-ici/contrato';

import { normalizarNome } from './nomes';

/**
 * Fase ESCALAS-UX-1A — o Editor visual de Plantão importado. Módulo puro:
 * sem SDK do Firestore, sem React. Formaliza o princípio "Importação nunca
 * é um destino, é só uma forma de preencher o Editor de Escala" —
 * `criarAtribuicoesEditaveis()` transforma o resultado FROZEN do parser
 * (`ResultadoParsePlantao.atribuicoes`, nunca mutado depois — ver
 * `docs/spec/PLANTOES.md` seção 23/24) numa WORKING COPY editável, com
 * identidade local estável (`idLocal`) que o parser nunca tem (uma
 * `AtribuicaoPlantaoBruta` recém-lida não tem nenhum ID, só `linhaOrigem`,
 * que não serve pra atribuições adicionadas manualmente).
 *
 * `AtribuicaoPlantaoEditavel` ESTENDE `AtribuicaoPlantaoBruta` (nunca um
 * tipo paralelo/incompatível) — por isso todas as funções puras que já
 * existem para `AtribuicaoPlantaoBruta[]` (`calcularDuracaoBrutaDosIntervalos`,
 * `detectarSobreposicoesPlantao`, `identificarLacunasPlantao`,
 * `consolidarParticipantesPlantao`) continuam funcionando direto sobre a
 * working copy, sem nenhum adaptador.
 */

export interface AtribuicaoPlantaoEditavel extends AtribuicaoPlantaoBruta {
  /** Identidade estável local — nunca persistida, nunca confundida com `atribuicaoId` (Fase PLANTÃO-3A) nem com `linhaOrigem`. */
  idLocal: string;
  /** `true` quando a linha veio do XLS importado; `false` quando foi adicionada manualmente no Editor nesta sessão. */
  origemImportacao: boolean;
}

/**
 * Constrói a working copy inicial a partir do resultado (congelado) do
 * parser — chamado uma única vez, logo após a importação
 * (`interpretarPlantao()` no Dashboard). Nunca reaproveita `linhaOrigem`
 * como identidade estável: `idLocal` é sequencial e determinístico só
 * para a criação inicial (`importado-0`, `importado-1`, ...), nunca
 * recalculado depois — editar/excluir/adicionar não reordena nem
 * reaproveita `idLocal` de outra linha.
 */
export function criarAtribuicoesEditaveis(
  atribuicoesOriginais: readonly AtribuicaoPlantaoBruta[],
): AtribuicaoPlantaoEditavel[] {
  return atribuicoesOriginais.map((atribuicao, indice) => ({
    ...atribuicao,
    idLocal: `importado-${indice}`,
    origemImportacao: true,
  }));
}

/**
 * Fase ESCALAS-UX-1B.1 — constrói UMA atribuição editável a partir de uma
 * atribuição JÁ PERSISTIDA (reabertura de rascunho). Diferente de
 * `criarAtribuicoesEditaveis()` (que gera `idLocal` sequencial por
 * posição — correto só para uma leitura fresca do parser, nunca
 * persistida antes): aqui `idLocal` é derivado do `atribuicaoId` REAL e
 * estável, para a mesma atribuição sempre receber o mesmo `idLocal` entre
 * reaberturas — nunca confundir "qual atribuição é essa" ao
 * editar/excluir depois de reidratar. Recebe início/fim JÁ em horário
 * civil — a conversão do instante UTC persistido é responsabilidade de
 * quem chama (`lib/montagemRascunhoPlantao.ts`), para este módulo
 * continuar sem nenhum conhecimento de timezone.
 */
export function criarAtribuicaoEditavelDePersistida(opcoes: {
  atribuicaoId: string;
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  duracaoMinutos: number;
}): AtribuicaoPlantaoEditavel {
  return {
    plantonistaNomeOriginal: opcoes.plantonistaNomeOriginal,
    inicio: opcoes.inicio,
    fim: opcoes.fim,
    duracaoMinutos: opcoes.duracaoMinutos,
    linhaOrigem: -1,
    abaOrigem: '',
    idLocal: `rehidratado-${opcoes.atribuicaoId}`,
    origemImportacao: true,
  };
}

let proximoIdManual = 0;

/**
 * Gera uma chave local nova para uma atribuição adicionada manualmente —
 * nunca colide com `importado-N` (prefixo diferente) nem entre chamadas
 * sucessivas na mesma sessão (contador incremental, nunca reaproveitado
 * mesmo após excluir uma atribuição manual).
 */
export function novoIdLocalManual(): string {
  proximoIdManual += 1;
  return `manual-${proximoIdManual}`;
}

export function editarAtribuicaoEditavel(
  atribuicoes: readonly AtribuicaoPlantaoEditavel[],
  idLocal: string,
  alteracoes: { plantonistaNomeOriginal: string; inicio: MomentoPlantao; fim: MomentoPlantao },
): AtribuicaoPlantaoEditavel[] {
  return atribuicoes.map((atribuicao) => {
    if (atribuicao.idLocal !== idLocal) {
      return atribuicao;
    }
    const duracaoMinutos = calcularDuracaoEntreMomentos(alteracoes.inicio, alteracoes.fim) ?? atribuicao.duracaoMinutos;
    return {
      ...atribuicao,
      plantonistaNomeOriginal: alteracoes.plantonistaNomeOriginal,
      inicio: alteracoes.inicio,
      fim: alteracoes.fim,
      duracaoMinutos,
    };
  });
}

export function adicionarAtribuicaoEditavel(
  atribuicoes: readonly AtribuicaoPlantaoEditavel[],
  nova: { plantonistaNomeOriginal: string; inicio: MomentoPlantao; fim: MomentoPlantao; abaOrigem: string },
): AtribuicaoPlantaoEditavel[] {
  const duracaoMinutos = calcularDuracaoEntreMomentos(nova.inicio, nova.fim) ?? 0;
  const adicionada: AtribuicaoPlantaoEditavel = {
    idLocal: novoIdLocalManual(),
    plantonistaNomeOriginal: nova.plantonistaNomeOriginal,
    inicio: nova.inicio,
    fim: nova.fim,
    duracaoMinutos,
    linhaOrigem: -1,
    abaOrigem: nova.abaOrigem,
    origemImportacao: false,
  };
  return [...atribuicoes, adicionada];
}

export function excluirAtribuicaoEditavel(
  atribuicoes: readonly AtribuicaoPlantaoEditavel[],
  idLocal: string,
): AtribuicaoPlantaoEditavel[] {
  return atribuicoes.filter((atribuicao) => atribuicao.idLocal !== idLocal);
}

/**
 * Só erros OBJETIVOS bloqueiam (Fase ESCALAS-UX-1A, seção 18): plantonista
 * vazio, data inicial/final vazia, fim &lt;= início. Duração atípica (nem
 * 12h nem 24h) NUNCA bloqueia aqui — vira aviso não-bloqueante em outro
 * lugar (`duracaoPlantaoAtipica()`, já existente no Dashboard).
 */
export function validarAtribuicaoEditavel(entrada: {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
}): string[] {
  const erros: string[] = [];
  if (entrada.plantonistaNomeOriginal.trim() === '') {
    erros.push('Selecione ou informe o plantonista.');
  }
  if (entrada.inicio.data.trim() === '' || entrada.inicio.hora.trim() === '') {
    erros.push('Informe a data e a hora iniciais.');
  }
  if (entrada.fim.data.trim() === '' || entrada.fim.hora.trim() === '') {
    erros.push('Informe a data e a hora finais.');
  }
  if (erros.length === 0) {
    const duracaoMinutos = calcularDuracaoEntreMomentos(entrada.inicio, entrada.fim);
    if (duracaoMinutos === null) {
      erros.push('Data ou hora inválida.');
    } else if (duracaoMinutos <= 0) {
      erros.push('O fim precisa ser posterior ao início.');
    }
  }
  return erros;
}

/** Agrupa por dia civil de início (`YYYY-MM-DD`), ordenado por hora dentro do dia — base direta do calendário. */
export function agruparAtribuicoesPorDia(
  atribuicoes: readonly AtribuicaoPlantaoEditavel[],
): Map<string, AtribuicaoPlantaoEditavel[]> {
  const porDia = new Map<string, AtribuicaoPlantaoEditavel[]>();
  for (const atribuicao of atribuicoes) {
    const lista = porDia.get(atribuicao.inicio.data) ?? [];
    lista.push(atribuicao);
    porDia.set(atribuicao.inicio.data, lista);
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.inicio.hora.localeCompare(b.inicio.hora));
  }
  return porDia;
}

/** "Ana Costa" -&gt; "Ana C." — nome de uma palavra só permanece como está. */
export function nomeCurtoPlantonista(nomeOriginal: string): string {
  const partes = nomeOriginal.trim().split(/\s+/u).filter((parte) => parte !== '');
  if (partes.length <= 1) {
    return partes[0] ?? '';
  }
  const primeiro = partes[0] ?? '';
  const ultimo = partes[partes.length - 1] ?? '';
  return `${primeiro} ${ultimo.charAt(0).toUpperCase()}.`;
}

/**
 * Tamanho da paleta de identidade visual — precisa bater com o número de
 * classes `.plantao-identidade-0`..`.plantao-identidade-{N-1}` em
 * `app/globals.css`.
 */
export const TAMANHO_PALETA_IDENTIDADE_PLANTAO = 8;

/**
 * Índice ESTÁVEL (0..N-1) de identidade visual por pessoa — hash
 * determinístico do nome normalizado, nunca um índice de posição num
 * array (que mudaria de valor conforme outras pessoas entram/saem do
 * conjunto). A mesma pessoa sempre recebe o mesmo índice, em qualquer
 * competência, em qualquer sessão — sem depender de quem mais está na
 * lista. Não é um seletor de cor (nenhuma customização manual nesta fase).
 */
export function indiceIdentidadePlantonista(nomeOriginal: string): number {
  const chave = normalizarNome(nomeOriginal);
  let hash = 0;
  for (let indice = 0; indice < chave.length; indice += 1) {
    hash = (hash * 31 + chave.charCodeAt(indice)) >>> 0;
  }
  return hash % TAMANHO_PALETA_IDENTIDADE_PLANTAO;
}

export interface ResumoPessoaPlantao {
  nomeOriginal: string;
  quantidade: number;
  minutos: number;
}

/**
 * Resumo por pessoa da ESCALA ATUAL (working copy) — nunca a contabilidade
 * declarada no XLS (essa é `ConferenciaContabilPlantao`, outro painel).
 * `participantesConhecidos` garante que alguém com 0 atribuições na
 * working copy (ex.: só aparecia com 0/0 na contabilidade informada)
 * continue visível como `{quantidade: 0, minutos: 0}`, nunca some da
 * lista por falta de atribuição.
 */
export function resumirPorPessoa(
  atribuicoes: readonly AtribuicaoPlantaoEditavel[],
  participantesConhecidos: readonly { nomeOriginal: string }[] = [],
): ResumoPessoaPlantao[] {
  const porChave = new Map<string, ResumoPessoaPlantao>();
  for (const participante of participantesConhecidos) {
    const chave = normalizarNome(participante.nomeOriginal);
    if (!porChave.has(chave)) {
      porChave.set(chave, { nomeOriginal: participante.nomeOriginal, quantidade: 0, minutos: 0 });
    }
  }
  for (const atribuicao of atribuicoes) {
    const chave = normalizarNome(atribuicao.plantonistaNomeOriginal);
    const atual = porChave.get(chave);
    if (atual === undefined) {
      porChave.set(chave, {
        nomeOriginal: atribuicao.plantonistaNomeOriginal,
        quantidade: 1,
        minutos: atribuicao.duracaoMinutos,
      });
    } else {
      atual.quantidade += 1;
      atual.minutos += atribuicao.duracaoMinutos;
    }
  }
  return [...porChave.values()].sort((a, b) => a.nomeOriginal.localeCompare(b.nomeOriginal));
}

/** `true` quando `dataIso` está FORA de `[periodoInicio, periodoFim]` — comparação lexicográfica, válida porque as três são sempre `YYYY-MM-DD`. */
export function ehDiaDeContexto(dataIso: string, periodoInicio: string, periodoFim: string): boolean {
  return dataIso < periodoInicio || dataIso > periodoFim;
}

/**
 * 12h e 24h são os padrões normais do Plantão COSI analisado (após
 * expediente / fim de semana). Qualquer outra duração (ex.: as bordas
 * reais de 43h/5h da fixture) é só sinalizada como "atípica" para conferir
 * — nunca tratada como incorreta (ver docs/spec/PLANTOES.md). Movida para
 * cá na Fase ESCALAS-UX-1A (antes só existia dentro de `DashboardApp.tsx`)
 * porque o Editor visual (calendário + resumo + alertas) precisa da MESMA
 * regra que a Lista/Contabilidade já usam — nunca uma segunda definição de
 * "atípico".
 */
export function duracaoPlantaoAtipica(duracaoMinutos: number): boolean {
  return duracaoMinutos !== 12 * 60 && duracaoMinutos !== 24 * 60;
}

/**
 * Rótulo curto de horário para o cartão do calendário: "19:00 → 07:00"
 * para o caso comum, "24h" para o plantão de 24 horas (não precisa mostrar
 * hora a hora), "⚠ 43h" para qualquer duração atípica — nunca normaliza o
 * valor, só rotula.
 */
export function rotuloHorarioCartaoPlantao(
  atribuicao: Pick<AtribuicaoPlantaoEditavel, 'inicio' | 'fim' | 'duracaoMinutos'>,
  ehAtipica: (duracaoMinutos: number) => boolean = duracaoPlantaoAtipica,
): string {
  if (ehAtipica(atribuicao.duracaoMinutos)) {
    return `⚠ ${Math.round(atribuicao.duracaoMinutos / 60)}h`;
  }
  if (atribuicao.duracaoMinutos === 24 * 60) {
    return '24h';
  }
  return `${atribuicao.inicio.hora} → ${atribuicao.fim.hora}`;
}

export interface ConferenciaEscalaAtualPlantao {
  bruto: TotalBrutoPlantao;
  quantidadePessoas: number;
  sobreposicoes: SobreposicaoPlantao[];
  lacunas: LacunaPlantao[];
  quantidadeDuracoesAtipicas: number;
}

/**
 * Conferência da ESCALA ATUAL (working copy) — nunca comparada
 * automaticamente contra "o correto"; só relata o que a escala editada
 * tem agora. Ver `docs/spec/PLANTOES.md` seção 24. `ehDuracaoAtipica` é
 * injetado para reaproveitar exatamente `duracaoPlantaoAtipica()` já
 * existente no Dashboard, nunca uma segunda regra "não é 12h nem 24h".
 */
export function conferirEscalaAtualPlantao(
  atribuicoes: readonly AtribuicaoPlantaoEditavel[],
  ehDuracaoAtipica: (duracaoMinutos: number) => boolean,
): ConferenciaEscalaAtualPlantao {
  const nomes = new Set(atribuicoes.map((atribuicao) => normalizarNome(atribuicao.plantonistaNomeOriginal)));
  return {
    bruto: calcularDuracaoBrutaDosIntervalos(atribuicoes),
    quantidadePessoas: nomes.size,
    sobreposicoes: detectarSobreposicoesPlantao(atribuicoes),
    lacunas: identificarLacunasPlantao(atribuicoes),
    quantidadeDuracoesAtipicas: atribuicoes.filter((atribuicao) => ehDuracaoAtipica(atribuicao.duracaoMinutos)).length,
  };
}
