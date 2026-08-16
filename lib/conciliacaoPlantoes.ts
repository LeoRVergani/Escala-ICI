import type { AtribuicaoPlantaoBruta, ResultadoParsePlantao } from '@escala-ici/contrato';

import { normalizarNome } from './nomes';
import type { Usuario } from './modelos';

/**
 * Fase PLANTÃO-2 — conciliação entre o nome original de um plantonista (XLS
 * de Plantão) e os usuários cadastrados no Firestore.
 *
 * Módulo puro: não importa o SDK do Firestore, não decide nada por conta
 * própria além de classificar e sugerir. Diferença deliberada em relação a
 * `lib/conciliacaoUsuarios.ts` (a conciliação da escala 6x1): lá, uma
 * correspondência única por nome/alias já vincula automaticamente
 * (`VINCULADO_ALIAS`); aqui, NENHUMA correspondência — nem exata — vincula
 * sozinha. O máximo que este módulo faz é oferecer uma `sugestao`; confirmar
 * é sempre uma ação explícita do coordenador (`confirmarVinculoPlantao`).
 * Ver `docs/spec/PLANTOES.md`, seção "Nome do XLS → login real".
 */

export type StatusVinculoPlantao =
  | 'PENDENTE'
  | 'VINCULADO'
  | 'USUARIO_NAO_ENCONTRADO'
  | 'CONFLITO';

export interface SugestaoVinculoPlantao {
  login: string;
  nome: string;
}

export interface VinculoPlantao {
  participanteNomeOriginal: string;
  /** Login do Escala ICI — nunca UID do Firebase Authentication. */
  login: string | null;
  status: StatusVinculoPlantao;
  /** Presente só quando existe exatamente um usuário com nome normalizado igual. Nunca aplicada sozinha. */
  sugestao: SugestaoVinculoPlantao | null;
}

export interface ParticipanteConsolidadoPlantao {
  /** Grafia original preservada para apresentação — nunca normalizada. */
  nomeOriginal: string;
  quantidadeAtribuicoes: number;
  apareceNaContabilidade: boolean;
  /** `null` quando o participante não aparece na seção de contabilidade informada. */
  quantidadeInformada: number | null;
  minutosInformados: number | null;
}

/**
 * Consolida os nomes únicos encontrados na planilha — união das atribuições
 * brutas com a contabilidade informada, para que um participante presente
 * SÓ na contabilidade (ex.: 0 plantões) continue sendo um participante
 * identificado, nunca descartado por não ter nenhuma atribuição.
 */
export function consolidarParticipantesPlantao(
  resultado: Pick<ResultadoParsePlantao, 'atribuicoes' | 'contabilidadeInformada'>,
): ParticipanteConsolidadoPlantao[] {
  const porChave = new Map<string, ParticipanteConsolidadoPlantao>();

  for (const atribuicao of resultado.atribuicoes) {
    const chave = normalizarNome(atribuicao.plantonistaNomeOriginal);
    const atual = porChave.get(chave);
    if (atual === undefined) {
      porChave.set(chave, {
        nomeOriginal: atribuicao.plantonistaNomeOriginal,
        quantidadeAtribuicoes: 1,
        apareceNaContabilidade: false,
        quantidadeInformada: null,
        minutosInformados: null,
      });
    } else {
      atual.quantidadeAtribuicoes += 1;
    }
  }

  for (const linha of resultado.contabilidadeInformada) {
    const chave = normalizarNome(linha.plantonistaNomeOriginal);
    const atual = porChave.get(chave);
    if (atual === undefined) {
      porChave.set(chave, {
        nomeOriginal: linha.plantonistaNomeOriginal,
        quantidadeAtribuicoes: 0,
        apareceNaContabilidade: true,
        quantidadeInformada: linha.quantidadeInformada,
        minutosInformados: linha.minutosInformados,
      });
    } else {
      atual.apareceNaContabilidade = true;
      atual.quantidadeInformada = linha.quantidadeInformada;
      atual.minutosInformados = linha.minutosInformados;
    }
  }

  return [...porChave.values()];
}

function candidatosPorNome(nomeOriginal: string, usuarios: readonly Usuario[]): Usuario[] {
  const chave = normalizarNome(nomeOriginal);
  return usuarios.filter((usuario) => normalizarNome(usuario.nome) === chave);
}

/**
 * Estado inicial de vínculo para cada participante — nunca com `login`
 * preenchido automaticamente. Uma correspondência única de nome vira
 * `sugestao`; zero correspondências vira `USUARIO_NAO_ENCONTRADO` (o
 * coordenador ainda pode escolher manualmente qualquer usuário); mais de
 * uma correspondência fica `PENDENTE` sem sugestão (ambíguo demais para
 * sugerir uma única pessoa).
 */
export function iniciarVinculosPlantao(
  participantes: readonly ParticipanteConsolidadoPlantao[],
  usuarios: readonly Usuario[],
): VinculoPlantao[] {
  return participantes.map((participante) => {
    const candidatos = candidatosPorNome(participante.nomeOriginal, usuarios);
    const [unico] = candidatos;
    const sugestao: SugestaoVinculoPlantao | null = (candidatos.length === 1 && unico !== undefined)
      ? { login: unico.login, nome: unico.nome }
      : null;
    return {
      participanteNomeOriginal: participante.nomeOriginal,
      login: null,
      status: candidatos.length === 0 ? 'USUARIO_NAO_ENCONTRADO' : 'PENDENTE',
      sugestao,
    };
  });
}

/**
 * Marca todo login usado por mais de um participante distinto como
 * `CONFLITO` — nunca escolhe um vencedor, nunca desfaz a escolha do
 * coordenador sozinho. Reaplicada a cada mudança de vínculo (confirmar ou
 * desfazer), então um conflito que deixa de existir (o outro lado foi
 * desfeito) volta a `VINCULADO` automaticamente.
 */
function recalcularConflitosPlantao(vinculos: readonly VinculoPlantao[]): VinculoPlantao[] {
  const contagemPorLogin = new Map<string, number>();
  for (const vinculo of vinculos) {
    if (vinculo.login !== null) {
      contagemPorLogin.set(vinculo.login, (contagemPorLogin.get(vinculo.login) ?? 0) + 1);
    }
  }

  return vinculos.map((vinculo) => {
    if (vinculo.login === null) {
      return vinculo;
    }
    const emConflito = (contagemPorLogin.get(vinculo.login) ?? 0) > 1;
    if (emConflito && vinculo.status !== 'CONFLITO') {
      return { ...vinculo, status: 'CONFLITO' };
    }
    if (!emConflito && vinculo.status === 'CONFLITO') {
      return { ...vinculo, status: 'VINCULADO' };
    }
    return vinculo;
  });
}

/**
 * Confirmação explícita do coordenador — o único jeito de um vínculo
 * ganhar `login`. Recebe o `Usuario` inteiro (não uma string solta) para
 * que o login sempre venha de um cadastro real, nunca de um valor
 * inventado; a identidade gravada é sempre `usuario.login`, nunca UID.
 */
export function confirmarVinculoPlantao(
  vinculos: readonly VinculoPlantao[],
  participanteNomeOriginal: string,
  usuario: Usuario,
): VinculoPlantao[] {
  const atualizados = vinculos.map((vinculo) =>
    vinculo.participanteNomeOriginal === participanteNomeOriginal
      ? { ...vinculo, login: usuario.login, status: 'VINCULADO' as const }
      : vinculo);
  return recalcularConflitosPlantao(atualizados);
}

/** Desfaz um vínculo (confirmado ou em conflito), voltando ao estado sem login. */
export function desfazerVinculoPlantao(
  vinculos: readonly VinculoPlantao[],
  participanteNomeOriginal: string,
): VinculoPlantao[] {
  const atualizados = vinculos.map((vinculo) =>
    vinculo.participanteNomeOriginal === participanteNomeOriginal
      ? {
        ...vinculo,
        login: null,
        status: vinculo.sugestao === null
          ? ('USUARIO_NAO_ENCONTRADO' as const)
          : ('PENDENTE' as const),
      }
      : vinculo);
  return recalcularConflitosPlantao(atualizados);
}

/** A prévia só pode ser validada quando todo participante identificado está `VINCULADO`. */
export function previaPlantaoValidavel(vinculos: readonly VinculoPlantao[]): boolean {
  return vinculos.length > 0 && vinculos.every((vinculo) => vinculo.status === 'VINCULADO');
}

export function contarPendenciasVinculoPlantao(vinculos: readonly VinculoPlantao[]): number {
  return vinculos.filter((vinculo) => vinculo.status !== 'VINCULADO').length;
}

export interface AtribuicaoPlantaoComVinculo extends AtribuicaoPlantaoBruta {
  loginVinculado: string | null;
  statusVinculo: StatusVinculoPlantao;
}

/**
 * Aplica os vínculos resolvidos a cada atribuição bruta — todas as linhas
 * do mesmo plantonista refletem o mesmo vínculo automaticamente, sem o
 * coordenador precisar repetir a escolha por linha. Não altera duração,
 * datas nem quantidade de linhas: só anota `loginVinculado`/`statusVinculo`.
 */
export function aplicarVinculosNasAtribuicoes(
  atribuicoes: readonly AtribuicaoPlantaoBruta[],
  vinculos: readonly VinculoPlantao[],
): AtribuicaoPlantaoComVinculo[] {
  const porNome = new Map(
    vinculos.map((vinculo) => [normalizarNome(vinculo.participanteNomeOriginal), vinculo] as const),
  );
  return atribuicoes.map((atribuicao) => {
    const vinculo = porNome.get(normalizarNome(atribuicao.plantonistaNomeOriginal));
    return {
      ...atribuicao,
      loginVinculado: vinculo?.login ?? null,
      statusVinculo: vinculo?.status ?? 'PENDENTE',
    };
  });
}

/**
 * Busca simples por login ou nome (acento/caixa insensível), para o campo
 * de busca da tela de vínculos. Não é um endpoint novo — filtra a mesma
 * lista de usuários já carregada pelo Dashboard.
 */
export function buscarUsuariosPlantao(
  usuarios: readonly Usuario[],
  termo: string,
): Usuario[] {
  const chave = normalizarNome(termo);
  if (chave === '') {
    return [...usuarios];
  }
  return usuarios.filter((usuario) =>
    normalizarNome(usuario.nome).includes(chave)
    || normalizarNome(usuario.login).includes(chave));
}
