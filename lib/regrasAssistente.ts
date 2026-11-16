import type { GravidadeRegra, RegraEscala } from './regrasEscala';

/**
 * ASSISTENTE-REGRAS-1 — o passo a passo para criar regra SEM conhecer o vocabulário do
 * motor: a pessoa escolhe uma SITUAÇÃO em linguagem comum, ajusta UM número (ou um dia) e
 * diz quão sério é. Este módulo (puro) traduz isso para uma regra do motor e lê uma regra de
 * volta para o passo a passo (para editar). Nada aqui conhece React nem Firebase.
 */
export type SituacaoChave = 'DIAS_SEGUIDOS' | 'POUCO_DESCANSO' | 'TURNO_LONGO' | 'DIA_DA_SEMANA';
export type IconeSituacao = 'sequencia' | 'descanso' | 'relogio' | 'calendario';

export interface ParametrosSituacao {
  /** Dias (DIAS_SEGUIDOS) ou horas (POUCO_DESCANSO, TURNO_LONGO). Ignorado em DIA_DA_SEMANA. */
  valor: number;
  /** 0 = domingo … 6 = sábado (só DIA_DA_SEMANA). */
  diaSemana: number;
}

export interface DefinicaoSituacao {
  chave: SituacaoChave;
  titulo: string;
  /** Uma linha, em palavras de todo dia, com um exemplo. */
  descricao: string;
  icone: IconeSituacao;
  /** Presente quando a situação tem um número para ajustar. */
  numero?: { padrao: number; minimo: number; maximo: number; unidade: 'dia' | 'hora'; explicacao: string };
  gravidadePadrao: GravidadeRegra;
}

export const SITUACOES: readonly DefinicaoSituacao[] = [
  {
    chave: 'DIAS_SEGUIDOS', titulo: 'Trabalhando dias demais seguidos', icone: 'sequencia',
    descricao: 'Avisar quando alguém fica muitos dias sem folga.',
    numero: { padrao: 5, minimo: 1, maximo: 14, unidade: 'dia', explicacao: 'Conta os dias de trabalho em sequência, sem nenhuma folga no meio.' },
    gravidadePadrao: 'AVISO',
  },
  {
    chave: 'POUCO_DESCANSO', titulo: 'Pouco descanso entre um turno e outro', icone: 'descanso',
    descricao: 'Avisar quando o intervalo entre dois turnos seguidos é curto.',
    numero: { padrao: 12, minimo: 1, maximo: 48, unidade: 'hora', explicacao: 'Conta as horas entre o fim de um turno e o começo do próximo, em dias seguidos.' },
    gravidadePadrao: 'AVISO',
  },
  {
    chave: 'TURNO_LONGO', titulo: 'Turno muito comprido', icone: 'relogio',
    descricao: 'Avisar quando um único turno passa de um certo número de horas.',
    numero: { padrao: 12, minimo: 1, maximo: 24, unidade: 'hora', explicacao: 'Conta as horas de um turno só, do começo ao fim.' },
    gravidadePadrao: 'AVISO',
  },
  {
    chave: 'DIA_DA_SEMANA', titulo: 'Trabalho em um dia da semana', icone: 'calendario',
    descricao: 'Avisar quando alguém é escalado num dia específico, como o domingo.',
    gravidadePadrao: 'INFO',
  },
];

export const NOMES_DIA: readonly string[] = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const COM_ARTIGO: readonly string[] = ['no domingo', 'na segunda-feira', 'na terça-feira', 'na quarta-feira', 'na quinta-feira', 'na sexta-feira', 'no sábado'];

/** Quão sério é, em palavras de todo dia. */
export const SERIEDADE: Readonly<Record<GravidadeRegra, { titulo: string; texto: string }>> = {
  INFO: { titulo: 'Só informar', texto: 'Aparece na lista, sem chamar atenção.' },
  AVISO: { titulo: 'Chamar a atenção', texto: 'A liderança vê o aviso e decide.' },
  CRITICO: { titulo: 'Alerta sério', texto: 'Aparece em vermelho, como problema.' },
};

export function definicaoDaSituacao(chave: SituacaoChave): DefinicaoSituacao {
  return SITUACOES.find((situacao) => situacao.chave === chave)!;
}

export function plural(valor: number, unidade: 'dia' | 'hora'): string {
  const texto = unidade === 'dia' ? (valor === 1 ? 'dia' : 'dias') : (valor === 1 ? 'hora' : 'horas');
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${texto}`;
}

/** O pedaço que completa "quando alguém …" (futuro do subjuntivo): "trabalhar mais de 5 dias seguidos". */
export function fraseDaSituacao(chave: SituacaoChave, parametros: ParametrosSituacao): string {
  switch (chave) {
    case 'DIAS_SEGUIDOS': return `trabalhar mais de ${plural(parametros.valor, 'dia')} ${parametros.valor === 1 ? 'seguido' : 'seguidos'}`;
    case 'POUCO_DESCANSO': return `descansar menos de ${plural(parametros.valor, 'hora')} entre um turno e o seguinte`;
    case 'TURNO_LONGO': return `tiver um turno de mais de ${plural(parametros.valor, 'hora')}`;
    case 'DIA_DA_SEMANA': return `trabalhar ${COM_ARTIGO[parametros.diaSemana] ?? COM_ARTIGO[0]}`;
  }
}

export function nomeSugerido(chave: SituacaoChave, parametros: ParametrosSituacao): string {
  switch (chave) {
    case 'DIAS_SEGUIDOS': return `Máximo de ${plural(parametros.valor, 'dia')} ${parametros.valor === 1 ? 'seguido' : 'seguidos'}`;
    case 'POUCO_DESCANSO': return `Descanso de ${plural(parametros.valor, 'hora')} entre turnos`;
    case 'TURNO_LONGO': return `Turno de no máximo ${plural(parametros.valor, 'hora')}`;
    case 'DIA_DA_SEMANA': return `Trabalho ${COM_ARTIGO[parametros.diaSemana] ?? COM_ARTIGO[0]}`;
  }
}

interface TextosPadrao { mensagem: string; sugestao: string }

function textosPadrao(chave: SituacaoChave, parametros: ParametrosSituacao): TextosPadrao {
  switch (chave) {
    case 'DIAS_SEGUIDOS':
      return { mensagem: '{pessoa} trabalha {diasSeguidosTrabalho} dias seguidos — o máximo é {limite}', sugestao: 'Inclua uma folga na escala de {pessoa} antes do dia {dia}.' };
    case 'POUCO_DESCANSO':
      return { mensagem: '{pessoa} tem só {descansoHoras} h de descanso antes do turno do dia {dia} — o mínimo é {limite} h', sugestao: 'Mude um dos dois turnos para dar pelo menos {limite} horas de descanso.' };
    case 'TURNO_LONGO':
      return { mensagem: '{pessoa} tem um turno de {horasNoDia} h no dia {dia} — o limite é {limite} h', sugestao: 'Divida o turno ou troque a pessoa.' };
    case 'DIA_DA_SEMANA':
      return { mensagem: `{pessoa} trabalha ${COM_ARTIGO[parametros.diaSemana] ?? COM_ARTIGO[0]}, dia {dia}`, sugestao: '' };
  }
}

export interface EstadoAssistente {
  situacao: SituacaoChave;
  parametros: ParametrosSituacao;
  gravidade: GravidadeRegra;
  bloqueiaPublicacao: boolean;
  alcance: { tipo: 'TODAS' | 'EQUIPE'; ids: string[] };
  /** Vazio = usa o nome sugerido. */
  nome: string;
  /** null = usa o texto padrão da situação. */
  mensagem: string | null;
  sugestao: string | null;
}

export function estadoInicialDaSituacao(chave: SituacaoChave): EstadoAssistente {
  const definicao = definicaoDaSituacao(chave);
  return {
    situacao: chave,
    parametros: { valor: definicao.numero?.padrao ?? 0, diaSemana: 0 },
    gravidade: definicao.gravidadePadrao,
    bloqueiaPublicacao: false,
    alcance: { tipo: 'TODAS', ids: [] },
    nome: '', mensagem: null, sugestao: null,
  };
}

/** O passo a passo vira uma regra do motor (sempre uma regra da empresa). */
export function montarRegraDoAssistente(estado: EstadoAssistente, id: string): RegraEscala {
  const { situacao, parametros } = estado;
  const textos = textosPadrao(situacao, parametros);
  const quando: RegraEscala['quando'] = (() => {
    switch (situacao) {
      case 'DIAS_SEGUIDOS': return { logica: 'E' as const, condicoes: [{ variavel: 'diasSeguidosTrabalho' as const, op: '>' as const, valor: parametros.valor }] };
      case 'POUCO_DESCANSO': return { logica: 'E' as const, condicoes: [{ variavel: 'descansoHoras' as const, op: '<' as const, valor: parametros.valor }, { variavel: 'folgasEntreTurnos' as const, op: '==' as const, valor: 0 }] };
      case 'TURNO_LONGO': return { logica: 'E' as const, condicoes: [{ variavel: 'horasNoDia' as const, op: '>' as const, valor: parametros.valor }] };
      case 'DIA_DA_SEMANA': return { logica: 'E' as const, condicoes: [{ variavel: 'diaDaSemana' as const, op: '==' as const, valor: parametros.diaSemana }, { variavel: 'horasNoDia' as const, op: '>' as const, valor: 0 }] };
    }
  })();
  const sugestao = estado.sugestao ?? textos.sugestao;
  return {
    id,
    nome: estado.nome.trim() === '' ? nomeSugerido(situacao, parametros) : estado.nome,
    descricao: `Avisa quando alguém ${fraseDaSituacao(situacao, parametros)}.`,
    categoria: 'EMPRESA', ativa: true, quando,
    entao: {
      gravidade: estado.gravidade,
      bloqueiaPublicacao: estado.bloqueiaPublicacao,
      mensagem: estado.mensagem ?? textos.mensagem,
      agrupar: situacao === 'DIAS_SEGUIDOS' ? 'PRIMEIRO_DIA_DA_SEQUENCIA' : 'CADA_DIA',
      ...(sugestao === '' ? {} : { sugestao }),
    },
    vale: estado.alcance.tipo === 'EQUIPE' ? { tipo: 'EQUIPE', ids: [...estado.alcance.ids] } : { tipo: 'TODAS' },
    origem: 'ADMIN', schemaVersion: 1,
  };
}

/**
 * Uma regra existente cabe no passo a passo? Só se as condições têm EXATAMENTE o desenho de uma das
 * situações. Se sim, devolve o estado (para editar); se não, `null` — abre o modo avançado.
 */
export function lerEstadoDaRegra(regra: RegraEscala): EstadoAssistente | null {
  const { condicoes, logica } = regra.quando;
  const achar = (variavel: string, op: string) => condicoes.find((condicao) => condicao.variavel === variavel && condicao.op === op);
  let situacao: SituacaoChave | null = null;
  const parametros: ParametrosSituacao = { valor: 0, diaSemana: 0 };
  if (logica === 'E') {
    if (condicoes.length === 1 && achar('diasSeguidosTrabalho', '>')) {
      situacao = 'DIAS_SEGUIDOS'; parametros.valor = achar('diasSeguidosTrabalho', '>')!.valor;
    } else if (condicoes.length === 1 && achar('horasNoDia', '>')) {
      situacao = 'TURNO_LONGO'; parametros.valor = achar('horasNoDia', '>')!.valor;
    } else if (condicoes.length === 2 && achar('descansoHoras', '<') && achar('folgasEntreTurnos', '==')?.valor === 0) {
      situacao = 'POUCO_DESCANSO'; parametros.valor = achar('descansoHoras', '<')!.valor;
    } else if (condicoes.length === 2 && achar('diaDaSemana', '==') && achar('horasNoDia', '>')?.valor === 0) {
      situacao = 'DIA_DA_SEMANA'; parametros.diaSemana = achar('diaDaSemana', '==')!.valor;
    }
  }
  if (situacao === null || !Number.isFinite(parametros.valor) || !Number.isFinite(parametros.diaSemana)) return null;
  const textos = textosPadrao(situacao, parametros);
  const sugestaoRegra = regra.entao.sugestao ?? '';
  return {
    situacao, parametros,
    gravidade: regra.entao.gravidade,
    bloqueiaPublicacao: regra.entao.bloqueiaPublicacao,
    alcance: { tipo: regra.vale.tipo, ids: [...(regra.vale.ids ?? [])] },
    nome: regra.nome,
    mensagem: regra.entao.mensagem === textos.mensagem ? null : regra.entao.mensagem,
    sugestao: sugestaoRegra === textos.sugestao ? null : sugestaoRegra,
  };
}

/** A frase que resume a regra inteira, para o último passo. */
export function resumoDoAssistente(estado: EstadoAssistente, nomesEquipes: readonly string[] = []): string {
  const quem = estado.alcance.tipo === 'TODAS' || nomesEquipes.length === 0 ? 'em todas as equipes' : `na equipe ${nomesEquipes.join(', ')}`;
  const o_que = {
    INFO: 'Vou só informar a liderança',
    AVISO: 'Vou chamar a atenção da liderança',
    CRITICO: 'Vou mostrar um alerta sério à liderança',
  }[estado.gravidade];
  const impede = estado.bloqueiaPublicacao ? ', e não vou deixar publicar a escala enquanto isso não for corrigido' : '';
  return `${o_que} quando alguém ${fraseDaSituacao(estado.situacao, estado.parametros)}, ${quem}${impede}.`;
}
