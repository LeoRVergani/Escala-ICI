import { resolverJornadaDia, type JornadaDia, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

import { calcularIntervaloDescansoHoras, chaveIndicadorCelula, ehDiaDeFolga, intervaloDatas } from './alertasEscala';

/**
 * REGRAS-ESCALA-1 — motor de regras "SE … ENTÃO …" da escala.
 *
 * Uma regra é um DADO (nunca código): lista de condições sobre variáveis que o
 * sistema sabe calcular, uma gravidade e uma mensagem. O interpretador só
 * entende o vocabulário abaixo — regra com variável/operador desconhecido é
 * recusada na validação, nunca executada. Módulo puro (sem React, sem Firebase).
 */

// ---------------------------------------------------------------- vocabulário

export type VariavelRegra =
  | 'diasSeguidosTrabalho'
  | 'descansoHoras'
  | 'folgasEntreTurnos'
  | 'horasNoDia'
  | 'diaDaSemana';

export type CategoriaVariavel = 'SEQUENCIA' | 'DESCANSO' | 'CARGA' | 'DIA';

export interface DefinicaoVariavel {
  rotulo: string;
  unidade: string;
  ajuda: string;
  categoria: CategoriaVariavel;
}

/** O que uma regra consegue "enxergar". Variável nova entra aqui (e em construirContextoDias). */
export const VARIAVEIS_REGRA: Readonly<Record<VariavelRegra, DefinicaoVariavel>> = {
  diasSeguidosTrabalho: {
    rotulo: 'dias seguidos de trabalho', unidade: 'dias', categoria: 'SEQUENCIA',
    ajuda: 'Quantos dias seguidos a pessoa trabalha, contando o dia avaliado (zera a cada folga).',
  },
  descansoHoras: {
    rotulo: 'horas de descanso desde o turno anterior', unidade: 'h', categoria: 'DESCANSO',
    ajuda: 'Horas entre o fim do turno anterior e o início deste turno (inclui as folgas no meio).',
  },
  folgasEntreTurnos: {
    rotulo: 'dias de folga entre o turno anterior e este', unidade: 'dias', categoria: 'DESCANSO',
    ajuda: '0 quando os turnos são em dias seguidos; 1 ou mais quando há folga (DSR) no meio.',
  },
  horasNoDia: {
    rotulo: 'horas trabalhadas no dia', unidade: 'h', categoria: 'CARGA',
    ajuda: 'Duração do turno do dia avaliado.',
  },
  diaDaSemana: {
    rotulo: 'dia da semana', unidade: '', categoria: 'DIA',
    ajuda: '0 = domingo, 1 = segunda … 6 = sábado.',
  },
};

export type OperadorRegra = '>' | '>=' | '<' | '<=' | '==' | '!=';

export const OPERADORES_REGRA: Readonly<Record<OperadorRegra, string>> = {
  '>': 'maior que', '>=': 'maior ou igual a', '<': 'menor que', '<=': 'menor ou igual a', '==': 'igual a', '!=': 'diferente de',
};

export type GravidadeRegra = 'INFO' | 'AVISO' | 'CRITICO';
export const ROTULO_GRAVIDADE: Readonly<Record<GravidadeRegra, string>> = { INFO: 'Informação', AVISO: 'Aviso', CRITICO: 'Crítico' };

export type CategoriaRegra = 'LEGAL' | 'EMPRESA';
export type AgruparAlerta = 'CADA_DIA' | 'PRIMEIRO_DIA_DA_SEQUENCIA';

export interface CondicaoRegra {
  variavel: VariavelRegra;
  op: OperadorRegra;
  valor: number;
}

export interface RegraEscala {
  id: string;
  nome: string;
  descricao: string;
  /** LEGAL: pode ser endurecida, nunca desligada nem afrouxada (edição vem em etapa própria). */
  categoria: CategoriaRegra;
  ativa: boolean;
  quando: { logica: 'E' | 'OU'; condicoes: CondicaoRegra[] };
  entao: {
    gravidade: GravidadeRegra;
    bloqueiaPublicacao: boolean;
    /** Aceita {pessoa}, {dia}, {limite} e qualquer variável, ex.: {diasSeguidosTrabalho}. */
    mensagem: string;
    /** PRIMEIRO_DIA_DA_SEQUENCIA: dias seguidos em que a regra vale geram UM alerta (no primeiro). */
    agrupar: AgruparAlerta;
    /** O que a liderança deve fazer para corrigir (opcional; aceita os mesmos campos da mensagem). */
    sugestao?: string;
  };
  /** Alcance: todas as escalas ou só as de certas equipes. */
  vale: { tipo: 'TODAS' | 'EQUIPE'; ids?: string[] };
  origem: 'PADRAO' | 'ADMIN';
  schemaVersion: 1;
}

// ------------------------------------------------------------------- contexto

export type ValoresDia = Partial<Record<VariavelRegra, number>>;

export interface ContextoDia {
  data: string;
  trabalha: boolean;
  valores: ValoresDia;
  /** Turno anterior (para a mensagem/depuração), quando existe e conta para o descanso. */
  turnoAnterior: JornadaDia | null;
}

export function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay();
}

/**
 * Calcula, para cada dia do período, as variáveis que as regras podem usar.
 * Segue EXATAMENTE a lógica de `alertasEscala.ts` (sequência de trabalho e
 * descanso entre turnos) — a equivalência é verificada por teste.
 */
export function construirContextoDias(documento: TurnosMes, catalogo: Record<string, TipoTurno>): ContextoDia[] {
  const contexto: ContextoDia[] = [];
  let sequencia = 0;
  let turnoAnterior: JornadaDia | null = null;
  let datasFolga: string[] = [];
  let intervaloSoDeFolga = true;

  for (const data of intervaloDatas(documento.periodoInicio, documento.periodoFim)) {
    const jornada = resolverJornadaDia(documento, catalogo, data);
    const valores: ValoresDia = { diaDaSemana: diaDaSemana(data) };

    if (!jornada.trabalha) {
      sequencia = 0;
      if (turnoAnterior !== null) {
        if (ehDiaDeFolga(documento, catalogo, data)) datasFolga.push(data);
        else intervaloSoDeFolga = false;
      }
      contexto.push({ data, trabalha: false, valores, turnoAnterior: null });
      continue;
    }

    sequencia += 1;
    valores.diasSeguidosTrabalho = sequencia;
    valores.horasNoDia = jornada.duracaoMinutos / 60;
    let anteriorDoDia: JornadaDia | null = null;
    if (turnoAnterior !== null && intervaloSoDeFolga) {
      const descanso = calcularIntervaloDescansoHoras(turnoAnterior, jornada);
      if (Number.isFinite(descanso)) {
        valores.descansoHoras = descanso;
        valores.folgasEntreTurnos = datasFolga.length;
        anteriorDoDia = turnoAnterior;
      }
    }
    contexto.push({ data, trabalha: true, valores, turnoAnterior: anteriorDoDia });
    turnoAnterior = jornada;
    datasFolga = [];
    intervaloSoDeFolga = true;
  }
  return contexto;
}

// ---------------------------------------------------------------- interpretador

function compara(esquerda: number, op: OperadorRegra, direita: number): boolean {
  switch (op) {
    case '>': return esquerda > direita;
    case '>=': return esquerda >= direita;
    case '<': return esquerda < direita;
    case '<=': return esquerda <= direita;
    case '==': return esquerda === direita;
    case '!=': return esquerda !== direita;
    default: return false;
  }
}

/** Variável sem valor no dia (ex.: descanso num dia de folga) faz a condição ser FALSA — a regra não dispara. */
export function avaliarCondicao(condicao: CondicaoRegra, valores: ValoresDia): boolean {
  const valor = valores[condicao.variavel];
  return valor !== undefined && compara(valor, condicao.op, condicao.valor);
}

export function avaliarQuando(quando: RegraEscala['quando'], valores: ValoresDia): boolean {
  if (quando.condicoes.length === 0) return false;
  return quando.logica === 'E'
    ? quando.condicoes.every((condicao) => avaliarCondicao(condicao, valores))
    : quando.condicoes.some((condicao) => avaliarCondicao(condicao, valores));
}

export function regraAplicaAoDocumento(regra: RegraEscala, documento: Pick<TurnosMes, 'equipeId'>): boolean {
  if (regra.vale.tipo === 'TODAS') return true;
  return (regra.vale.ids ?? []).includes(documento.equipeId);
}

export interface AlertaRegra {
  chave: string;
  regraId: string;
  regraNome: string;
  gravidade: GravidadeRegra;
  bloqueiaPublicacao: boolean;
  usuarioUid: string;
  login: string;
  equipeId: string;
  /** Dia em que a regra passou a valer (primeiro dia, quando agrupada). */
  data: string;
  ateData: string;
  /** Valor da primeira condição (o "limite" da regra), p.ex. 6 dias ou 11 h. */
  limite: number | null;
  valores: ValoresDia;
  mensagem: string;
  /** Sugestão de correção já com os campos preenchidos ('' quando a regra não tem). */
  sugestao: string;
  turnoAnterior: JornadaDia | null;
}

export interface OpcoesAvaliacao {
  nomePorLogin?: Readonly<Record<string, string>>;
}

export function formatarValorRegra(numero: number): string {
  return numero.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function formatarDia(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

export function renderizarMensagem(
  modelo: string,
  dados: { pessoa: string; data: string; limite: number | null; valores: ValoresDia },
): string {
  return modelo.replace(/\{([a-zA-Z]+)\}/gu, (inteiro, nome: string) => {
    if (nome === 'pessoa') return dados.pessoa;
    if (nome === 'dia') return formatarDia(dados.data);
    if (nome === 'limite') return dados.limite === null ? '' : formatarValorRegra(dados.limite);
    const valor = (dados.valores as Record<string, number | undefined>)[nome];
    return valor === undefined ? inteiro : formatarValorRegra(valor);
  });
}

export function avaliarRegras(
  documentos: readonly TurnosMes[],
  catalogo: Record<string, TipoTurno>,
  regras: readonly RegraEscala[],
  opcoes: OpcoesAvaliacao = {},
): AlertaRegra[] {
  const alertas: AlertaRegra[] = [];
  const regrasValidas = regras.filter((regra) => regra.ativa && validarRegra(regra).length === 0);
  for (const documento of documentos) {
    const aplicaveis = regrasValidas.filter((regra) => regraAplicaAoDocumento(regra, documento));
    if (aplicaveis.length === 0) continue;
    const contexto = construirContextoDias(documento, catalogo);
    const pessoa = opcoes.nomePorLogin?.[documento.login] ?? documento.login;
    for (const regra of aplicaveis) {
      const limite = regra.quando.condicoes[0]?.valor ?? null;
      let sequenciaAberta: ContextoDia[] = [];
      const fechar = () => {
        const primeiro = sequenciaAberta[0];
        const ultimo = sequenciaAberta.at(-1);
        if (primeiro && ultimo) {
          alertas.push({
            chave: `${regra.id}|${documento.login}|${primeiro.data}`,
            regraId: regra.id, regraNome: regra.nome, gravidade: regra.entao.gravidade, bloqueiaPublicacao: regra.entao.bloqueiaPublicacao,
            usuarioUid: documento.usuarioUid, login: documento.login, equipeId: documento.equipeId,
            data: primeiro.data, ateData: ultimo.data, limite, valores: primeiro.valores,
            mensagem: renderizarMensagem(regra.entao.mensagem, { pessoa, data: primeiro.data, limite, valores: primeiro.valores }),
            sugestao: regra.entao.sugestao ? renderizarMensagem(regra.entao.sugestao, { pessoa, data: primeiro.data, limite, valores: primeiro.valores }) : '',
            turnoAnterior: primeiro.turnoAnterior,
          });
        }
        sequenciaAberta = [];
      };
      for (const dia of contexto) {
        if (!avaliarQuando(regra.quando, dia.valores)) {
          if (regra.entao.agrupar === 'PRIMEIRO_DIA_DA_SEQUENCIA') fechar();
          continue;
        }
        if (regra.entao.agrupar === 'CADA_DIA') {
          sequenciaAberta = [dia];
          fechar();
        } else {
          const anterior = sequenciaAberta.at(-1);
          // dias que não são consecutivos no calendário começam outra sequência
          if (anterior && diasEntre(anterior.data, dia.data) !== 1) fechar();
          sequenciaAberta.push(dia);
        }
      }
      if (regra.entao.agrupar === 'PRIMEIRO_DIA_DA_SEQUENCIA') fechar();
    }
  }
  return alertas.sort((a, b) => a.data.localeCompare(b.data) || a.login.localeCompare(b.login) || a.regraId.localeCompare(b.regraId));
}

function diasEntre(inicio: string, fim: string): number {
  return Math.round((new Date(`${fim}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86_400_000);
}

export function bloqueiaPublicacaoPorRegra(alertas: readonly AlertaRegra[]): boolean {
  return alertas.some((alerta) => alerta.bloqueiaPublicacao);
}

// ------------------------------------------------------------------- validação

const GRAVIDADES: readonly GravidadeRegra[] = ['INFO', 'AVISO', 'CRITICO'];

/** Lista de problemas da regra (vazia = válida). Toda regra vinda do banco passa por aqui antes de rodar. */
export function validarRegra(regra: RegraEscala): string[] {
  const erros: string[] = [];
  if (typeof regra.id !== 'string' || regra.id.trim() === '') erros.push('A regra precisa de um identificador.');
  if (typeof regra.nome !== 'string' || regra.nome.trim().length < 3) erros.push('Dê um nome para a regra.');
  const condicoes = regra.quando?.condicoes;
  if (!Array.isArray(condicoes) || condicoes.length === 0) erros.push('Inclua pelo menos uma condição.');
  else if (condicoes.length > 8) erros.push('No máximo 8 condições por regra.');
  else {
    for (const condicao of condicoes) {
      if (!(condicao.variavel in VARIAVEIS_REGRA)) erros.push(`Variável desconhecida: ${String(condicao.variavel)}.`);
      if (!(condicao.op in OPERADORES_REGRA)) erros.push(`Comparação desconhecida: ${String(condicao.op)}.`);
      if (typeof condicao.valor !== 'number' || !Number.isFinite(condicao.valor)) erros.push('O valor da condição precisa ser um número.');
    }
  }
  if (regra.quando && regra.quando.logica !== 'E' && regra.quando.logica !== 'OU') erros.push('Use E ou OU entre as condições.');
  if (!GRAVIDADES.includes(regra.entao?.gravidade)) erros.push('Escolha a gravidade do alerta.');
  const mensagem = regra.entao?.mensagem;
  if (typeof mensagem !== 'string' || mensagem.trim() === '') erros.push('Escreva a mensagem do alerta.');
  else {
    if (mensagem.length > 200) erros.push('A mensagem passa de 200 caracteres.');
    for (const [, nome] of mensagem.matchAll(/\{([a-zA-Z]+)\}/gu)) {
      if (nome !== undefined && !['pessoa', 'dia', 'limite'].includes(nome) && !(nome in VARIAVEIS_REGRA)) erros.push(`A mensagem usa {${nome}}, que não existe.`);
    }
  }
  const sugestao = regra.entao?.sugestao;
  if (sugestao !== undefined) {
    if (typeof sugestao !== 'string' || sugestao.length > 200) erros.push('A sugestão passa de 200 caracteres.');
    else {
      for (const [, nome] of sugestao.matchAll(/\{([a-zA-Z]+)\}/gu)) {
        if (nome !== undefined && !['pessoa', 'dia', 'limite'].includes(nome) && !(nome in VARIAVEIS_REGRA)) erros.push(`A sugestão usa {${nome}}, que não existe.`);
      }
    }
  }
  if (regra.vale?.tipo === 'EQUIPE' && (regra.vale.ids ?? []).length === 0) erros.push('Escolha pelo menos uma equipe.');
  if (regra.categoria === 'LEGAL' && regra.ativa === false) erros.push('Regra legal não pode ser desligada.');
  return erros;
}

// -------------------------------------------------------------- texto legível

/** "1 dia", "6 dias", "11 h": a unidade concorda com o valor. */
export function rotuloUnidade(unidade: string, valor: number): string {
  return unidade === 'dias' && valor === 1 ? 'dia' : unidade;
}

export function descreverCondicao(condicao: CondicaoRegra): string {
  const definicao = VARIAVEIS_REGRA[condicao.variavel];
  const unidade = definicao.unidade === '' ? '' : ` ${rotuloUnidade(definicao.unidade, condicao.valor)}`;
  return `${definicao.rotulo} ${condicao.op} ${formatarValorRegra(condicao.valor)}${unidade}`;
}

export function descreverQuando(quando: RegraEscala['quando']): string {
  return quando.condicoes.map(descreverCondicao).join(quando.logica === 'E' ? ' E ' : ' OU ');
}

export function descreverEntao(entao: RegraEscala['entao']): string {
  const base = `gerar alerta (${ROTULO_GRAVIDADE[entao.gravidade].toLowerCase()})`;
  return entao.bloqueiaPublicacao ? `${base} e bloquear a publicação` : base;
}

export function fraseDaRegra(regra: RegraEscala): string {
  return `SE ${descreverQuando(regra.quando)} ENTÃO ${descreverEntao(regra.entao)}`;
}

// ------------------------------------------------- problemas na grade (fase 2)

export interface ProblemaCelula {
  mensagens: string[];
  /** A mais grave entre as regras que apontam este dia. */
  gravidade: GravidadeRegra;
  regras: string[];
}

const PESO_GRAVIDADE: Readonly<Record<GravidadeRegra, number>> = { INFO: 1, AVISO: 2, CRITICO: 3 };

/**
 * REGRAS-ESCALA-2 — o que a grade marca em cada célula: o DIA em que a regra
 * deixou de ser cumprida (primeiro dia, nas regras agrupadas), com a mensagem
 * escrita pela própria regra — nenhum número fixo no código da tela.
 */
export function indexarProblemasPorCelula(alertas: readonly AlertaRegra[]): Map<string, ProblemaCelula> {
  const indice = new Map<string, ProblemaCelula>();
  for (const alerta of alertas) {
    const chave = chaveIndicadorCelula(alerta.usuarioUid, alerta.data);
    const atual = indice.get(chave);
    if (!atual) {
      indice.set(chave, { mensagens: [alerta.mensagem], gravidade: alerta.gravidade, regras: [alerta.regraNome] });
    } else {
      atual.mensagens.push(alerta.mensagem);
      atual.regras.push(alerta.regraNome);
      if (PESO_GRAVIDADE[alerta.gravidade] > PESO_GRAVIDADE[atual.gravidade]) atual.gravidade = alerta.gravidade;
    }
  }
  return indice;
}

/** Compara os problemas de antes e de depois de uma mudança: o que ela CRIA e o que ela RESOLVE. */
export function diferencaDeProblemas(
  antes: readonly AlertaRegra[],
  depois: readonly AlertaRegra[],
): { novos: AlertaRegra[]; resolvidos: AlertaRegra[] } {
  const chavesAntes = new Set(antes.map((alerta) => alerta.chave));
  const chavesDepois = new Set(depois.map((alerta) => alerta.chave));
  return {
    novos: depois.filter((alerta) => !chavesAntes.has(alerta.chave)),
    resolvidos: antes.filter((alerta) => !chavesDepois.has(alerta.chave)),
  };
}

export function agruparProblemasPorPessoa(alertas: readonly AlertaRegra[]): Array<{ login: string; alertas: AlertaRegra[] }> {
  const mapa = new Map<string, AlertaRegra[]>();
  for (const alerta of alertas) mapa.set(alerta.login, [...(mapa.get(alerta.login) ?? []), alerta]);
  return [...mapa.entries()]
    .map(([login, lista]) => ({ login, alertas: lista.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.alertas.length - a.alertas.length || a.login.localeCompare(b.login));
}

// ------------------------------------------------- construtor e teste (fase 3)

export const NOMES_DIA_SEMANA: readonly string[] = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export const CAMPOS_MENSAGEM_FIXOS: ReadonlyArray<{ campo: string; rotulo: string }> = [
  { campo: 'pessoa', rotulo: 'pessoa' },
  { campo: 'dia', rotulo: 'dia' },
  { campo: 'limite', rotulo: 'limite' },
];

export const ROTULO_CATEGORIA_VARIAVEL: Readonly<Record<CategoriaVariavel, string>> = {
  SEQUENCIA: 'Sequência de trabalho', DESCANSO: 'Descanso', CARGA: 'Carga de trabalho', DIA: 'O dia',
};

/** Variáveis agrupadas por categoria, na ordem em que o construtor as oferece. */
export function variaveisPorCategoria(): Array<{ categoria: CategoriaVariavel; rotulo: string; variaveis: VariavelRegra[] }> {
  const ordem: CategoriaVariavel[] = ['SEQUENCIA', 'DESCANSO', 'CARGA', 'DIA'];
  return ordem.map((categoria) => ({
    categoria,
    rotulo: ROTULO_CATEGORIA_VARIAVEL[categoria],
    variaveis: (Object.keys(VARIAVEIS_REGRA) as VariavelRegra[]).filter((variavel) => VARIAVEIS_REGRA[variavel].categoria === categoria),
  }));
}

export function novaRegraEmBranco(id: string): RegraEscala {
  return {
    id, nome: '', descricao: '', categoria: 'EMPRESA', ativa: true,
    quando: { logica: 'E', condicoes: [{ variavel: 'diasSeguidosTrabalho', op: '>', valor: 5 }] },
    entao: { gravidade: 'AVISO', bloqueiaPublicacao: false, mensagem: '{pessoa} trabalha {diasSeguidosTrabalho} dias seguidos — o máximo é {limite}', agrupar: 'PRIMEIRO_DIA_DA_SEQUENCIA', sugestao: '' },
    vale: { tipo: 'TODAS' }, origem: 'ADMIN', schemaVersion: 1,
  };
}

/** Cópia editável de uma regra: sempre vira regra da empresa (a regra legal original não é tocada). */
export function copiarComoRascunho(regra: RegraEscala, novoId: string): RegraEscala {
  return {
    ...structuredClone(regra),
    id: novoId,
    nome: regra.categoria === 'LEGAL' ? `${regra.nome} (versão da empresa)` : `${regra.nome} (cópia)`,
    categoria: 'EMPRESA', ativa: true, origem: 'ADMIN',
  };
}

/** Variáveis que a regra usa nas condições — o construtor oferece-as como campos da mensagem. */
export function variaveisDaRegra(regra: RegraEscala): VariavelRegra[] {
  return [...new Set(regra.quando.condicoes.map((condicao) => condicao.variavel))];
}

export interface ResultadoTesteRegra {
  total: number;
  pessoasAfetadas: number;
  documentosAvaliados: number;
  diasAvaliados: number;
  porPessoa: Array<{ login: string; nome: string; total: number }>;
  amostra: AlertaRegra[];
  alertas: AlertaRegra[];
}

/**
 * Roda UMA regra (mesmo que ainda seja um rascunho) sobre as escalas dadas, sem gravar nada.
 * Regra inválida não roda: o resultado vem vazio (a tela mostra o que falta).
 */
export function testarRegra(
  regra: RegraEscala,
  documentos: readonly TurnosMes[],
  catalogo: Record<string, TipoTurno>,
  opcoes: OpcoesAvaliacao = {},
): ResultadoTesteRegra {
  const alertas = avaliarRegras(documentos, catalogo, [{ ...regra, ativa: true }], opcoes);
  const aplicaveis = documentos.filter((documento) => regraAplicaAoDocumento(regra, documento));
  const porLogin = new Map<string, number>();
  for (const alerta of alertas) porLogin.set(alerta.login, (porLogin.get(alerta.login) ?? 0) + 1);
  return {
    total: alertas.length,
    pessoasAfetadas: porLogin.size,
    documentosAvaliados: aplicaveis.length,
    diasAvaliados: aplicaveis.reduce((soma, documento) => soma + intervaloDatas(documento.periodoInicio, documento.periodoFim).length, 0),
    porPessoa: [...porLogin.entries()]
      .map(([login, total]) => ({ login, nome: opcoes.nomePorLogin?.[login] ?? login, total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')),
    amostra: alertas.slice(0, 8),
    alertas,
  };
}

/** Identificador de uma regra que só existe em teste (única o bastante para a sessão da tela). */
export function gerarIdRegraEmTeste(): string {
  return `teste-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
