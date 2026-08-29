import {
  calcularDuracaoBrutaDosIntervalos,
  detectarSobreposicoesPlantao,
  criarIdOcorrenciaPlantao,
  funcaoPlantaoDaFonte,
  FUNCOES_PLANTAO_VALIDAS,
  ROTULO_FUNCAO_PLANTAO,
  type AtribuicaoPlantaoBruta,
  type ErroImportacaoPlantao,
  type FuncaoPlantao,
  type MomentoPlantao,
  type SobreposicaoPlantao,
} from '@escala-ici/contrato';

import { resumirPorPessoa, type AtribuicaoPlantaoEditavel } from './editorPlantao';
import { contarPendenciasVinculoPlantao, type VinculoPlantao } from './conciliacaoPlantoes';
import { normalizarNome } from './nomes';

/**
 * FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1 — camada de filtro/saúde por
 * FUNÇÃO (posto) de um Grupo de Plantão multi-função. Módulo puro: nunca
 * decide GrupoPlantao, competência ou publicação — só recorta e resume o
 * que já existe na working copy do Editor por `atribuicao.funcao`. Um
 * Grupo de posto único (`funcoesEsperadas` ausente/vazio) nunca passa por
 * este módulo com mais de uma "função" — `filtrarAtribuicoesPlantaoPorFuncao('TODOS', ...)`
 * é a identidade para ele.
 *
 * Princípio inegociável (`docs/spec/PLANTAO_MULTIPOSTO.md`): a função
 * pertence à ATRIBUIÇÃO (`atribuicao.funcao`), nunca ao usuário — a mesma
 * pessoa pode aparecer em funções diferentes em ocorrências diferentes.
 * Nenhum helper aqui lê nome/cor/posição/equipe organizacional para
 * decidir a aba de uma atribuição.
 */
export type FiltroFuncaoPlantao = 'TODOS' | FuncaoPlantao;

/** Único helper de filtro por função — nunca duplicar esta condicional em cada componente. */
export function filtrarAtribuicoesPlantaoPorFuncao<T extends { funcao?: FuncaoPlantao }>(
  atribuicoes: readonly T[],
  filtro: FiltroFuncaoPlantao,
): T[] {
  return filtro === 'TODOS' ? [...atribuicoes] : atribuicoes.filter((atribuicao) => atribuicao.funcao === filtro);
}

export interface OcorrenciaPlantaoComPostos<T> {
  ocorrenciaId: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  atribuicoes: T[];
  postosPreenchidos: FuncaoPlantao[];
  /** Postos de `funcoesEsperadas` sem nenhuma atribuição nesta ocorrência — nunca inventa plantonista, só relata o vazio. */
  postosFaltando: FuncaoPlantao[];
}

/**
 * Deriva as OCORRÊNCIAS do Plantão a partir de TODAS as atribuições
 * (nunca só das de uma função) e só depois associa quem preenche cada
 * posto — é o que permite mostrar um posto vazio na aba correspondente
 * em vez de a ocorrência simplesmente desaparecer de lá (§31/32 da fase:
 * "não derive o calendário da função somente das atribuições existentes").
 * Mesmo `criarIdOcorrenciaPlantao()` do parser (`inicio`/`fim` exatos) —
 * nunca uma segunda noção de "mesma ocorrência".
 */
export function agruparOcorrenciasPlantao<T extends { funcao?: FuncaoPlantao; inicio: MomentoPlantao; fim: MomentoPlantao }>(
  atribuicoes: readonly T[],
  funcoesEsperadas: readonly FuncaoPlantao[] = [],
): OcorrenciaPlantaoComPostos<T>[] {
  const porOcorrencia = new Map<string, { inicio: MomentoPlantao; fim: MomentoPlantao; atribuicoes: T[] }>();
  for (const atribuicao of atribuicoes) {
    const ocorrenciaId = criarIdOcorrenciaPlantao(atribuicao.inicio, atribuicao.fim);
    const atual = porOcorrencia.get(ocorrenciaId);
    if (atual === undefined) {
      porOcorrencia.set(ocorrenciaId, { inicio: atribuicao.inicio, fim: atribuicao.fim, atribuicoes: [atribuicao] });
    } else {
      atual.atribuicoes.push(atribuicao);
    }
  }

  return [...porOcorrencia.entries()]
    .map(([ocorrenciaId, grupo]) => {
      const postosPreenchidos = [...new Set(
        grupo.atribuicoes
          .map((atribuicao) => atribuicao.funcao)
          .filter((funcao): funcao is FuncaoPlantao => funcao !== undefined),
      )];
      const postosFaltando = funcoesEsperadas.filter((funcao) => !postosPreenchidos.includes(funcao));
      return { ocorrenciaId, inicio: grupo.inicio, fim: grupo.fim, atribuicoes: grupo.atribuicoes, postosPreenchidos, postosFaltando };
    })
    .sort((a, b) => `${a.inicio.data}T${a.inicio.hora}`.localeCompare(`${b.inicio.data}T${b.inicio.hora}`));
}

/**
 * Fase 27 — `detectarSobreposicoesPlantao()` (contrato) é um detector
 * genérico e não muda: continua correto para Plantão de posto único (duas
 * pessoas diferentes no MESMO horário/posto único É um conflito real de
 * escala). Num Grupo MULTI-FUNÇÃO, postos diferentes cobrindo o mesmo
 * horário são a estrutura esperada, nunca um conflito — este filtro só se
 * aplica quando `ehMultiposto` é `true`: mantém `MESMO_PLANTONISTA` (a
 * mesma pessoa em dois lugares ao mesmo tempo é sempre um conflito real,
 * qualquer que seja a função) e `PLANTONISTAS_DIFERENTES` só quando as
 * duas atribuições são do MESMO posto (duas pessoas diferentes cobrindo o
 * mesmo posto ao mesmo tempo — um double-booking real dentro daquele
 * posto). Nunca filtra nada quando `ehMultiposto` é `false` (posto único,
 * comportamento inalterado).
 */
export function conflitosRelevantesPlantao(
  sobreposicoes: readonly SobreposicaoPlantao[],
  ehMultiposto: boolean,
): SobreposicaoPlantao[] {
  if (!ehMultiposto) {
    return [...sobreposicoes];
  }
  return sobreposicoes.filter((sobreposicao) =>
    sobreposicao.tipo === 'MESMO_PLANTONISTA'
    || (
      (sobreposicao.a as AtribuicaoPlantaoBruta).funcao !== undefined
      && (sobreposicao.a as AtribuicaoPlantaoBruta).funcao === (sobreposicao.b as AtribuicaoPlantaoBruta).funcao
    ));
}

/**
 * Quebra de `contarPendenciasVinculoPlantao()` (global, uma pessoa conta
 * uma vez) por FUNÇÃO — a mesma pessoa pendente em DBA e Linux conta 1 em
 * cada função (impacto local), mas continua 1 no total global (identidade
 * única). Nunca somar as contagens por função e chamar de "total de
 * pessoas pendentes" (§24 da fase).
 */
export function vinculosPendentesPorFuncao(
  atribuicoes: readonly { plantonistaNomeOriginal: string; funcao?: FuncaoPlantao }[],
  vinculos: readonly VinculoPlantao[],
): Partial<Record<FuncaoPlantao, number>> {
  const nomesPendentes = new Set(
    vinculos
      .filter((vinculo) => vinculo.status !== 'VINCULADO')
      .map((vinculo) => normalizarNome(vinculo.participanteNomeOriginal)),
  );

  const porFuncao = new Map<FuncaoPlantao, Set<string>>();
  for (const atribuicao of atribuicoes) {
    if (atribuicao.funcao === undefined) {
      continue;
    }
    const chave = normalizarNome(atribuicao.plantonistaNomeOriginal);
    if (!nomesPendentes.has(chave)) {
      continue;
    }
    const conjunto = porFuncao.get(atribuicao.funcao) ?? new Set<string>();
    conjunto.add(chave);
    porFuncao.set(atribuicao.funcao, conjunto);
  }

  const resultado: Partial<Record<FuncaoPlantao, number>> = {};
  for (const [funcao, conjunto] of porFuncao) {
    resultado[funcao] = conjunto.size;
  }
  return resultado;
}

/**
 * Melhor esforço: um erro do parser carrega `coluna` como texto verbatim
 * (`"Plantonista <fonte>"`) — reaproveita `funcaoPlantaoDaFonte()` (mesma
 * normalização do parser) para atribuir o erro ao card certo. Retorna
 * `null` quando o erro não está associado a nenhum posto conhecido (ex.:
 * a própria fonte desconhecida que gerou o erro, ou um erro estrutural
 * sem coluna de posto) — esse erro só aparece em "Todos", nunca some.
 */
export function funcaoDoErroPlantao(erro: Pick<ErroImportacaoPlantao, 'coluna'>): FuncaoPlantao | null {
  const compatibilidade = /^Plantonista\s+(.+)$/iu.exec(erro.coluna.trim());
  const fonte = compatibilidade?.[1];
  return fonte === undefined ? null : funcaoPlantaoDaFonte(fonte);
}

/**
 * FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (§10 da fase) — regra única de
 * "esta função é válida para este Grupo". Grupo de posto único
 * (`funcoesEsperadas` ausente/vazio) sempre aceita `funcao === undefined`
 * (retrocompatibilidade total, comportamento de sempre); Grupo multiposto
 * exige `funcao` PRESENTE e pertencente a `funcoesEsperadas` — nunca
 * aceita `undefined` nem um valor fora da lista configurada, mesmo que
 * `FuncaoPlantao` (enum global) o conheça.
 */
export function funcaoPermitidaNoGrupo(
  grupo: { funcoesEsperadas?: readonly FuncaoPlantao[] },
  funcao: FuncaoPlantao | undefined,
): boolean {
  const funcoesEsperadas = grupo.funcoesEsperadas ?? [];
  if (funcoesEsperadas.length === 0) {
    return true;
  }
  return funcao !== undefined && funcoesEsperadas.includes(funcao);
}

/**
 * §11/§29/§30 da fase — validação da IMPORTAÇÃO contra o Grupo
 * ESPECÍFICO selecionado, não só o enum global `FuncaoPlantao`. Uma
 * função que o enum conhece (ex.: `TELECOM`) mas que este Grupo não
 * espera (`funcoesEsperadas` não a inclui) gera um erro BLOQUEANTE
 * nomeado, exatamente como uma fonte desconhecida do parser — nunca
 * adiciona a função a `funcoesEsperadas` sozinho, nunca cria posto novo,
 * nunca cria Grupo (§12). Posto único (`funcoesEsperadas` vazio) nunca
 * valida nada aqui — retrocompatibilidade total.
 *
 * `coluna` usa o mesmo formato `"Plantonista <fonte>"` que
 * `converterAtribuicoesMultiFonteParaBrutas()` já produz para fonte
 * desconhecida, para que `funcaoDoErroPlantao()` atribua este erro ao
 * card certo sem nenhuma lógica nova de atribuição.
 */
export function validarFuncoesContraGrupo(
  atribuicoes: readonly { funcao?: FuncaoPlantao }[],
  funcoesEsperadas: readonly FuncaoPlantao[],
): ErroImportacaoPlantao[] {
  if (funcoesEsperadas.length === 0) {
    return [];
  }
  const funcoesForaDoGrupo = new Set(
    atribuicoes
      .map((atribuicao) => atribuicao.funcao)
      .filter((funcao): funcao is FuncaoPlantao => funcao !== undefined && !funcoesEsperadas.includes(funcao)),
  );
  return [...funcoesForaDoGrupo].map((funcao) => ({
    linha: 1,
    coluna: `Plantonista ${ROTULO_FUNCAO_PLANTAO[funcao]}`,
    valorEncontrado: funcao,
    motivo: `A função ${ROTULO_FUNCAO_PLANTAO[funcao]} foi encontrada no arquivo, mas não está configurada para este Plantão.`,
  }));
}

export type StatusSaudePlantao = 'OK' | 'ATENCAO' | 'CRITICO';

export interface SaudeFuncaoPlantao {
  atribuicoes: number;
  pessoasUnicas: number;
  minutosCobertura: number;
  postosFaltando: number;
  vinculosPendentes: number;
  conflitos: number;
  errosOrigem: number;
  avisos: number;
  /**
   * §14 da fase — atribuições SEM `funcao` num Grupo multiposto (nunca
   * aceito silenciosamente). Só populado em `'TODOS'`: filtrar por uma
   * função específica já exclui, por definição, qualquer atribuição sem
   * função (`atribuicao.funcao === filtro` nunca é verdade para
   * `undefined`) — não há "aba" própria para uma atribuição sem posto.
   */
  atribuicoesSemFuncao: number;
  /** Total de ocorrências do PERÍODO (grupo inteiro — §22 da fase) — o mesmo valor em `todos` e em cada função, já que todo posto é esperado em toda ocorrência de um Grupo multiposto. */
  ocorrencias: number;
  status: StatusSaudePlantao;
}

export interface ResultadoSaudePlantao {
  todos: SaudeFuncaoPlantao;
  porFuncao: Partial<Record<FuncaoPlantao, SaudeFuncaoPlantao>>;
  podePublicar: boolean;
  /** Frases prontas para o resumo de pré-publicação (§50/§51 da fase) — nunca um booleano solto. */
  bloqueiosGlobais: string[];
}

function calcularStatusSaude(saude: Omit<SaudeFuncaoPlantao, 'status'>): StatusSaudePlantao {
  if (
    saude.postosFaltando > 0
    || saude.vinculosPendentes > 0
    || saude.conflitos > 0
    || saude.errosOrigem > 0
    || saude.atribuicoesSemFuncao > 0
  ) {
    return 'CRITICO';
  }
  if (saude.avisos > 0) {
    return 'ATENCAO';
  }
  return 'OK';
}

/**
 * Painel de saúde único (`avaliarSaudePlantao()`, §51 da fase) — nenhuma
 * regra de habilitar/desabilitar o botão Publicar espalhada pela UI, só
 * este resultado. `grupo.funcoesEsperadas` vazio/ausente = posto único:
 * `porFuncao` fica `{}`, `todos` é a única saúde relevante e
 * `postosFaltando`/`conflitos` usam a semântica de posto único
 * (`ehMultiposto = false` em `conflitosRelevantesPlantao()`).
 */
export function avaliarSaudePlantao(params: {
  grupo: { funcoesEsperadas?: readonly FuncaoPlantao[] };
  atribuicoes: readonly AtribuicaoPlantaoEditavel[];
  vinculos: readonly VinculoPlantao[];
  erros: readonly ErroImportacaoPlantao[];
  avisos: readonly string[];
}): ResultadoSaudePlantao {
  const funcoesEsperadas = params.grupo.funcoesEsperadas ?? [];
  const ehMultiposto = funcoesEsperadas.length > 0;
  const sobreposicoes = conflitosRelevantesPlantao(detectarSobreposicoesPlantao(params.atribuicoes), ehMultiposto);
  const ocorrencias = agruparOcorrenciasPlantao(params.atribuicoes, funcoesEsperadas);
  const pendentesPorFuncao = vinculosPendentesPorFuncao(params.atribuicoes, params.vinculos);

  function montarSaude(filtro: FiltroFuncaoPlantao): SaudeFuncaoPlantao {
    const atribuicoesFiltradas = filtrarAtribuicoesPlantaoPorFuncao(params.atribuicoes, filtro);
    const pessoas = resumirPorPessoa(atribuicoesFiltradas);
    const minutosCobertura = calcularDuracaoBrutaDosIntervalos(atribuicoesFiltradas).minutos;
    const postosFaltando = filtro === 'TODOS'
      ? ocorrencias.reduce((total, ocorrencia) => total + ocorrencia.postosFaltando.length, 0)
      : ocorrencias.filter((ocorrencia) => ocorrencia.postosFaltando.includes(filtro)).length;
    const vinculosPendentes = filtro === 'TODOS'
      ? contarPendenciasVinculoPlantao(params.vinculos)
      : (pendentesPorFuncao[filtro] ?? 0);
    const conflitos = filtro === 'TODOS'
      ? sobreposicoes.length
      : sobreposicoes.filter((sobreposicao) =>
        (sobreposicao.a as AtribuicaoPlantaoBruta).funcao === filtro
        || (sobreposicao.b as AtribuicaoPlantaoBruta).funcao === filtro).length;
    const errosOrigem = filtro === 'TODOS'
      ? params.erros.length
      : params.erros.filter((erro) => funcaoDoErroPlantao(erro) === filtro).length;
    const avisos = filtro === 'TODOS' ? params.avisos.length : 0;
    const atribuicoesSemFuncao = filtro === 'TODOS' && ehMultiposto
      ? params.atribuicoes.filter((atribuicao) => atribuicao.funcao === undefined).length
      : 0;

    const base = {
      atribuicoes: atribuicoesFiltradas.length,
      pessoasUnicas: pessoas.length,
      ocorrencias: ocorrencias.length,
      minutosCobertura,
      postosFaltando,
      vinculosPendentes,
      conflitos,
      errosOrigem,
      avisos,
      atribuicoesSemFuncao,
    };
    return { ...base, status: calcularStatusSaude(base) };
  }

  const todos = montarSaude('TODOS');
  const porFuncao: Partial<Record<FuncaoPlantao, SaudeFuncaoPlantao>> = {};
  for (const funcao of funcoesEsperadas) {
    porFuncao[funcao] = montarSaude(funcao);
  }

  const bloqueiosGlobais: string[] = [];
  if (todos.postosFaltando > 0) {
    bloqueiosGlobais.push(`${todos.postosFaltando} posto(s) sem plantonista.`);
  }
  if (todos.vinculosPendentes > 0) {
    bloqueiosGlobais.push(`${todos.vinculosPendentes} vínculo(s) pendente(s).`);
  }
  if (todos.conflitos > 0) {
    bloqueiosGlobais.push(`${todos.conflitos} conflito(s) de horário.`);
  }
  if (todos.errosOrigem > 0) {
    bloqueiosGlobais.push(`${todos.errosOrigem} erro(s) de origem.`);
  }
  if (todos.atribuicoesSemFuncao > 0) {
    bloqueiosGlobais.push(`${todos.atribuicoesSemFuncao} atribuição(ões) sem posto definido.`);
  }

  return { todos, porFuncao, podePublicar: bloqueiosGlobais.length === 0, bloqueiosGlobais };
}

/** Rótulo de exibição das tabs — nunca hardcode um mapa paralelo de nomes por função na UI. */
export { ROTULO_FUNCAO_PLANTAO } from '@escala-ici/contrato';

/** Ordem canônica só para o caso de `funcoesEsperadas` vir ausente em algum ponto legado — o Grupo real sempre manda quando presente (§45 da fase: nunca ordenar alfabeticamente por conta própria). */
export const ORDEM_PADRAO_FUNCOES_PLANTAO: readonly FuncaoPlantao[] = FUNCOES_PLANTAO_VALIDAS;
