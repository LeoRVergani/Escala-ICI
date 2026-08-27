/**
 * Informações operacionais da escala (dia/pessoa-dia) — Fase
 * FASE-MATRIZ-DEFINITIVA-E-INFORMACOES-DIA-1, Parte B1.
 *
 * Domínio puro, sem React/DOM/Firebase, no mesmo espírito de
 * `lib/lembretes.ts`: dá nome estruturado ao que hoje só existe como texto
 * solto na planilha ("Feriado", "SOC durante o treinamento",
 * "DU - alamancio", "férias - cestradioto"), sem virar uma nova aba
 * "Observações" nem duplicar dado dentro de `TurnosMes.dias` — ver
 * `docs/spec/INFORMACOES_ESCALA.md`.
 *
 * Dois escopos, nunca misturados no mesmo item:
 * - `DIA`: pertence à data/operação inteira (ex.: Feriado, Treinamento
 *   SOC) — `usuarioLogin` sempre `null`.
 * - `PESSOA_DIA`: pertence a uma pessoa específica naquela data (ex.:
 *   Férias — Carlos, DU — Alamancio) — `usuarioLogin` sempre um login não
 *   vazio.
 * Identidade é sempre `infoId` (+ `tipoEscala`/`alvoId`/`competencia` para
 * localizar o contexto) — nunca o texto do título.
 *
 * `data` é validada como dia civil real (`validarDataCivil`, reaproveitado
 * de `lib/lembretes.ts`) E como pertencente ao PERÍODO real da competência
 * — que não é o mês calendário: uma competência operacional roda 26→25
 * (rótulo `AAAA-MM` sempre igual ao mês em que o período termina).
 * Reaproveita `dataPertenceCompetencia()`/`periodoDaCompetencia()` de
 * `lib/montagemRascunhoPlantao.ts` — nunca um segundo cálculo 26→25.
 *
 * Dívida técnica registrada (não esquecimento): essas duas funções vivem
 * num arquivo com nome específico de Plantão, mas a regra 26→25 em si é
 * universal ao projeto (Jornada e Plantão a compartilham — ver o
 * comentário de `periodoDaCompetencia()` lá, que já reaproveita
 * `competenciaOperacional()` de `packages/contrato/src/jornada.ts` por
 * esse mesmo motivo). `tests/plantao-limites-competencia-boundaries.test.mjs`
 * prende a implementação literal a esse arquivo (regex sobre o texto
 * fonte) — extrair para um módulo neutro agora exigiria reescrever esse
 * teste de fronteira, escopo maior do que esta correção pede. Extrair
 * `periodoDaCompetencia()`/`dataPertenceCompetencia()` para um módulo
 * neutro de competência (mantendo re-export em `montagemRascunhoPlantao.ts`
 * para não quebrar o boundary test) é trabalho futuro sugerido, não desta
 * fase.
 */

import { dataPertenceCompetencia } from './montagemRascunhoPlantao';
import { validarDataCivil } from './lembretes';

export type TipoEscalaInformacao = 'JORNADA' | 'PLANTAO';
export type EscopoInformacaoEscala = 'DIA' | 'PESSOA_DIA';

export const CATEGORIAS_INFORMACAO_ESCALA = [
  'GERAL',
  'TREINAMENTO',
  'FERIADO',
  'FERIAS',
  'COBERTURA_DU',
  'CURSO',
  'REUNIAO',
  'OPERACAO_ESPECIAL',
  'OUTRO',
] as const;
export type CategoriaInformacaoEscala = typeof CATEGORIAS_INFORMACAO_ESCALA[number];

export const VISIBILIDADES_INFORMACAO_ESCALA = ['EQUIPE', 'PESSOAS_AFETADAS', 'GESTORES'] as const;
export type VisibilidadeInformacaoEscala = typeof VISIBILIDADES_INFORMACAO_ESCALA[number];

export const STATUS_INFORMACAO_ESCALA = ['RASCUNHO', 'PUBLICADA', 'CANCELADA'] as const;
export type StatusInformacaoEscala = typeof STATUS_INFORMACAO_ESCALA[number];

export const LIMITE_TITULO_INFORMACAO_ESCALA = 120;
export const LIMITE_DESCRICAO_INFORMACAO_ESCALA = 1000;
export const LIMITE_MOTIVO_CANCELAMENTO_INFORMACAO_ESCALA = 500;

/**
 * Teto de itens RASCUNHO publicados por chamada de
 * `publicarInformacoesDaCompetencia()` — o `writeBatch` do Firestore tem um
 * limite rígido de 500 operações; 400 deixa margem confortável sem chegar
 * perto do limite real, e é muito mais do que uma operação/competência
 * jamais deveria acumular. Excedido, o repository lança um erro claro ANTES
 * de montar/commitar o batch — nunca divide silenciosamente em vários
 * batches "fingindo" que a publicação continua atômica.
 */
export const LIMITE_PUBLICACAO_EM_LOTE_INFORMACOES_ESCALA = 400;

const REGEX_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/u;

export function validarCompetencia(competencia: string): boolean {
  return REGEX_COMPETENCIA.test(competencia);
}

export function normalizarTituloInformacaoEscala(titulo: string): string {
  return titulo.trim();
}

/** String vazia (ou só espaços) normaliza para `null` — mesmo tratamento de "sem valor" de `lib/lembretes.ts`. */
export function normalizarDescricaoInformacaoEscala(descricao: string | null | undefined): string | null {
  if (descricao === null || descricao === undefined) {
    return null;
  }
  const normalizado = descricao.trim();
  return normalizado === '' ? null : normalizado;
}

export interface ConteudoInformacaoEscala {
  categoria: CategoriaInformacaoEscala;
  titulo: string;
  descricao: string | null;
  visibilidade: VisibilidadeInformacaoEscala;
}

export interface EntradaInformacaoEscala extends ConteudoInformacaoEscala {
  tipoEscala: TipoEscalaInformacao;
  alvoId: string;
  competencia: string;
  data: string;
  escopo: EscopoInformacaoEscala;
  usuarioLogin: string | null;
}

export interface InformacaoEscala extends EntradaInformacaoEscala {
  schemaVersion: 1;
  infoId: string;
  status: StatusInformacaoEscala;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoPorLogin: string;
  atualizadoEm: string;
  publicadoPorLogin: string | null;
  publicadoEm: string | null;
  canceladoPorLogin: string | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
}

/** Normaliza (trim/`null`) título e descrição, sem tocar em mais nada — assume os demais campos já corretos. */
export function normalizarEntradaInformacaoEscala(entrada: EntradaInformacaoEscala): EntradaInformacaoEscala {
  return {
    ...entrada,
    titulo: normalizarTituloInformacaoEscala(entrada.titulo),
    descricao: normalizarDescricaoInformacaoEscala(entrada.descricao),
  };
}

/**
 * Erros de validação de uma entrada — lista vazia significa entrada válida.
 * Assume que `normalizarEntradaInformacaoEscala()` já rodou (título/descrição
 * já vêm normalizados); chamar com a entrada crua também funciona, só que o
 * limite de tamanho do título conta espaços não aparados.
 */
export function validarEntradaInformacaoEscala(entrada: EntradaInformacaoEscala): string[] {
  const erros: string[] = [];

  if (entrada.tipoEscala !== 'JORNADA' && entrada.tipoEscala !== 'PLANTAO') {
    erros.push('Tipo de escala inválido.');
  }

  if (entrada.alvoId.trim() === '') {
    erros.push('Informe o alvo (equipe ou grupo de plantão) da informação.');
  }

  if (!validarCompetencia(entrada.competencia)) {
    erros.push('Competência inválida — use o formato AAAA-MM.');
  }

  if (!validarDataCivil(entrada.data)) {
    erros.push('Data inválida.');
  } else if (validarCompetencia(entrada.competencia) && !dataPertenceCompetencia(entrada.data, entrada.competencia)) {
    erros.push('A data informada não pertence ao período desta competência (dia 26 do mês anterior a dia 25 do mês do rótulo).');
  }

  if (entrada.escopo !== 'DIA' && entrada.escopo !== 'PESSOA_DIA') {
    erros.push('Escopo inválido.');
  } else if (entrada.escopo === 'DIA') {
    if (entrada.usuarioLogin !== null) {
      erros.push('Informação de DIA não pode estar associada a uma pessoa específica.');
    }
  } else if (entrada.usuarioLogin === null || entrada.usuarioLogin.trim() === '') {
    erros.push('Informe a pessoa afetada por esta informação.');
  }

  if (!CATEGORIAS_INFORMACAO_ESCALA.includes(entrada.categoria)) {
    erros.push('Categoria inválida.');
  }

  const titulo = normalizarTituloInformacaoEscala(entrada.titulo);
  if (titulo === '') {
    erros.push('Informe um título para a informação.');
  } else if (titulo.length > LIMITE_TITULO_INFORMACAO_ESCALA) {
    erros.push(`O título deve ter no máximo ${LIMITE_TITULO_INFORMACAO_ESCALA} caracteres.`);
  }

  const descricao = normalizarDescricaoInformacaoEscala(entrada.descricao);
  if (descricao !== null && descricao.length > LIMITE_DESCRICAO_INFORMACAO_ESCALA) {
    erros.push(`A descrição deve ter no máximo ${LIMITE_DESCRICAO_INFORMACAO_ESCALA} caracteres.`);
  }

  if (!VISIBILIDADES_INFORMACAO_ESCALA.includes(entrada.visibilidade)) {
    erros.push('Visibilidade inválida.');
  }

  return erros;
}

/**
 * Concatenação simples — mesmo padrão de `criarIdEscopoOperacional()`
 * (`lib/escoposOperacionaisMatriz.ts`): a Firestore Rule usa a MESMA
 * concatenação sem sanitizar (ver `idContextoInformacoesEscala()` em
 * `firestore.rules`); o `.replace()` abaixo é só rede de segurança
 * defensiva do lado cliente (nunca a fonte de verdade do ID) — inofensivo
 * porque `tipoEscala`/`alvoId`/`competencia` reais nunca contêm caracteres
 * fora de `[A-Za-z0-9_-]`.
 */
export function criarIdContextoInformacoesEscala(
  tipoEscala: TipoEscalaInformacao,
  alvoId: string,
  competencia: string,
): string {
  return `${tipoEscala}_${alvoId}_${competencia}`.replace(/[^A-Za-z0-9_-]/gu, '_');
}

/**
 * RASCUNHO -> PUBLICADA -> CANCELADA, sempre para frente, nunca volta
 * (mesmo espírito de `StatusLembreteAtribuido`). RASCUNHO também pode ir
 * direto para CANCELADA (descartar antes de publicar). CANCELADA é
 * terminal — nenhuma transição sai dela.
 *
 * Representa só MUDANÇA de status — `atual === novo` é sempre `false` aqui
 * (não é uma transição). Um update que mantém o mesmo status (edição de
 * conteúdo) é uma questão à parte, tratada pela Rule/repository, não por
 * esta função — por isso `publicarInformacaoEscala()`/
 * `cancelarInformacaoEscala()` abaixo, que usam isto para decidir se a ação
 * é permitida, corretamente rejeitam publicar/cancelar de novo algo que já
 * está PUBLICADA/CANCELADA.
 */
export function transicaoDeStatusInformacaoEscalaValida(
  atual: StatusInformacaoEscala,
  novo: StatusInformacaoEscala,
): boolean {
  if (atual === 'RASCUNHO') {
    return novo === 'PUBLICADA' || novo === 'CANCELADA';
  }
  if (atual === 'PUBLICADA') {
    return novo === 'CANCELADA';
  }
  return false;
}

/**
 * Transformação pura RASCUNHO -> PUBLICADA. Não escreve nada — quem chama
 * (repository, Parte B1) é responsável por persistir o resultado. A Parte
 * B2/B3 decide QUANDO chamar isto (ex.: junto do botão "Publicar" da
 * Jornada/Plantão) — nenhum wiring automático nesta fase.
 */
export function publicarInformacaoEscala(
  informacao: InformacaoEscala,
  publicadoPorLogin: string,
  agora: string,
): InformacaoEscala {
  if (!transicaoDeStatusInformacaoEscalaValida(informacao.status, 'PUBLICADA')) {
    throw new Error(`Não é possível publicar uma informação com status ${informacao.status}.`);
  }
  return {
    ...informacao,
    status: 'PUBLICADA',
    publicadoPorLogin,
    publicadoEm: agora,
    atualizadoPorLogin: publicadoPorLogin,
    atualizadoEm: agora,
  };
}

/** Transformação pura PUBLICADA/RASCUNHO -> CANCELADA. Preserva o documento (nunca hard delete de PUBLICADA). */
export function cancelarInformacaoEscala(
  informacao: InformacaoEscala,
  canceladoPorLogin: string,
  motivo: string | null,
  agora: string,
): InformacaoEscala {
  if (!transicaoDeStatusInformacaoEscalaValida(informacao.status, 'CANCELADA')) {
    throw new Error(`Não é possível cancelar uma informação com status ${informacao.status}.`);
  }
  return {
    ...informacao,
    status: 'CANCELADA',
    canceladoPorLogin,
    canceladoEm: agora,
    motivoCancelamento: normalizarDescricaoInformacaoEscala(motivo),
    atualizadoPorLogin: canceladoPorLogin,
    atualizadoEm: agora,
  };
}
