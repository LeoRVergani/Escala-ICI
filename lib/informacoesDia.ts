import { adicionarDias } from '@escala-ici/contrato';

/**
 * INFORMACOES-DIA-1 — informações que a liderança registra sobre um colaborador num dia
 * (ou período): atestado, afastamento por horário, curso, ou uma anotação específica.
 * Ficam sempre visíveis para a liderança; só aparecem para o colaborador se marcadas.
 * Módulo PURO: tipos, validação, calendário, filtros e "o que o colaborador vê".
 */
export type TipoInformacao = 'AFASTAMENTO_HORARIO' | 'ATESTADO' | 'CURSO' | 'OUTRO';
export type CorInformacao = 'ambar' | 'rosa' | 'azul' | 'roxo';
export type IconeInformacao = 'relogio' | 'atestado' | 'curso' | 'nota';

export interface MetaTipoInformacao {
  chave: TipoInformacao;
  rotulo: string;
  descricao: string;
  cor: CorInformacao;
  icone: IconeInformacao;
  /** O horário é obrigatório (afastamento por horário). */
  exigeHorario: boolean;
  placeholderTitulo: string;
  /** Aviso curto exibido ao escolher o tipo (ex.: não registrar diagnóstico). */
  cuidado?: string;
}

export const TIPOS_INFORMACAO: readonly MetaTipoInformacao[] = [
  {
    chave: 'AFASTAMENTO_HORARIO', rotulo: 'Afastamento por horário', icone: 'relogio', cor: 'ambar', exigeHorario: true,
    descricao: 'Sai por algumas horas: consulta, compromisso, banco de horas.',
    placeholderTitulo: 'Ex.: Consulta médica',
  },
  {
    chave: 'ATESTADO', rotulo: 'Atestado', icone: 'atestado', cor: 'rosa', exigeHorario: false,
    descricao: 'Um ou mais dias fora com atestado.',
    placeholderTitulo: 'Ex.: Atestado de 3 dias',
    cuidado: 'Não registre o diagnóstico nem o CID — só o que a liderança precisa saber para a escala.',
  },
  {
    chave: 'CURSO', rotulo: 'Curso ou treinamento', icone: 'curso', cor: 'azul', exigeHorario: false,
    descricao: 'Participa de um curso, treinamento ou evento.',
    placeholderTitulo: 'Ex.: Treinamento de segurança',
  },
  {
    chave: 'OUTRO', rotulo: 'Outra informação', icone: 'nota', cor: 'roxo', exigeHorario: false,
    descricao: 'Qualquer anotação específica sobre a pessoa neste dia.',
    placeholderTitulo: 'Ex.: Vai trabalhar de casa',
  },
];

export function metaDoTipo(tipo: TipoInformacao): MetaTipoInformacao {
  return TIPOS_INFORMACAO.find((item) => item.chave === tipo)!;
}

export interface InformacaoDia {
  id: string;
  schemaVersion: 1;
  equipeId: string;
  login: string;
  nomeColaborador: string;
  tipo: TipoInformacao;
  /** YYYY-MM-DD */
  dataInicio: string;
  /** YYYY-MM-DD — igual a dataInicio quando é um dia só. */
  dataFim: string;
  /** HH:mm, ou null quando vale o dia todo. Os dois horários andam juntos. */
  horaInicio: string | null;
  horaFim: string | null;
  titulo: string;
  observacao: string;
  /** O colaborador enxerga esta informação no App. */
  visivelParaColaborador: boolean;
  criadoPorLogin: string;
  criadoPorNome: string;
  criadoEm: string;
  atualizadoPorLogin: string;
  atualizadoEm: string;
}

/** O que a tela preenche (e o que a validação confere). */
export interface EntradaInformacao {
  login: string;
  nomeColaborador: string;
  equipeId: string;
  tipo: TipoInformacao;
  dataInicio: string;
  dataFim: string;
  diaTodo: boolean;
  horaInicio: string;
  horaFim: string;
  titulo: string;
  observacao: string;
  visivelParaColaborador: boolean;
}

export const LIMITE_TITULO = 80;
export const LIMITE_OBSERVACAO = 500;
export const LIMITE_DIAS_PERIODO = 366;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/u;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/u;

export function dataValida(data: string): boolean {
  if (!DATA_ISO.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  const objeto = new Date(Date.UTC(ano, mes - 1, dia));
  return objeto.getUTCFullYear() === ano && objeto.getUTCMonth() === mes - 1 && objeto.getUTCDate() === dia;
}

export function diasEntreDatas(inicio: string, fim: string): number {
  return Math.round((new Date(`${fim}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86_400_000);
}

export function entradaEmBranco(base: Partial<EntradaInformacao> = {}): EntradaInformacao {
  return {
    login: '', nomeColaborador: '', equipeId: '', tipo: 'ATESTADO', dataInicio: '', dataFim: '', diaTodo: true, horaInicio: '', horaFim: '',
    titulo: '', observacao: '', visivelParaColaborador: false, ...base,
  };
}

/** Mensagens em português simples; vazia = pode salvar. */
export function validarEntradaInformacao(entrada: EntradaInformacao): string[] {
  const erros: string[] = [];
  const meta = TIPOS_INFORMACAO.find((item) => item.chave === entrada.tipo);
  if (entrada.login.trim() === '' || entrada.equipeId.trim() === '') erros.push('Escolha o colaborador.');
  if (!meta) erros.push('Escolha o tipo da informação.');
  if (!dataValida(entrada.dataInicio)) erros.push('Escolha o dia.');
  const fim = entrada.dataFim === '' ? entrada.dataInicio : entrada.dataFim;
  if (dataValida(entrada.dataInicio) && !dataValida(fim)) erros.push('Escolha o último dia do período.');
  else if (dataValida(entrada.dataInicio) && dataValida(fim)) {
    const dias = diasEntreDatas(entrada.dataInicio, fim);
    if (dias < 0) erros.push('O último dia não pode ser antes do primeiro.');
    else if (dias + 1 > LIMITE_DIAS_PERIODO) erros.push('O período é longo demais (no máximo 1 ano).');
  }
  const precisaHorario = !entrada.diaTodo || (meta?.exigeHorario ?? false);
  if (precisaHorario) {
    if (!HORA.test(entrada.horaInicio) || !HORA.test(entrada.horaFim)) {
      erros.push(meta?.exigeHorario && entrada.diaTodo ? 'Informe o horário do afastamento.' : 'Informe o horário de início e de fim.');
    } else if (entrada.horaFim <= entrada.horaInicio) erros.push('O horário de fim precisa ser depois do início.');
  }
  if (entrada.titulo.trim().length > LIMITE_TITULO) erros.push(`O título passa de ${LIMITE_TITULO} caracteres.`);
  if (entrada.tipo === 'OUTRO' && entrada.titulo.trim().length < 3) erros.push('Dê um título para a informação.');
  if (entrada.observacao.trim().length > LIMITE_OBSERVACAO) erros.push(`As observações passam de ${LIMITE_OBSERVACAO} caracteres.`);
  return erros;
}

export function gerarIdInformacao(): string {
  return `info-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** O documento a gravar. `existente` preserva quem criou e quando (edição). */
export function montarDocumentoInformacao(
  entrada: EntradaInformacao,
  id: string,
  autor: { login: string; nome: string },
  agoraIso: string,
  existente?: Pick<InformacaoDia, 'criadoPorLogin' | 'criadoPorNome' | 'criadoEm'> | null,
): InformacaoDia {
  const comHorario = !entrada.diaTodo || metaDoTipo(entrada.tipo).exigeHorario;
  return {
    id, schemaVersion: 1,
    equipeId: entrada.equipeId, login: entrada.login, nomeColaborador: entrada.nomeColaborador.replace(/\s+/gu, ' ').trim(),
    tipo: entrada.tipo,
    dataInicio: entrada.dataInicio, dataFim: entrada.dataFim === '' ? entrada.dataInicio : entrada.dataFim,
    horaInicio: comHorario ? entrada.horaInicio : null, horaFim: comHorario ? entrada.horaFim : null,
    titulo: entrada.titulo.replace(/\s+/gu, ' ').trim(), observacao: entrada.observacao.trim(),
    visivelParaColaborador: entrada.visivelParaColaborador,
    criadoPorLogin: existente?.criadoPorLogin ?? autor.login, criadoPorNome: existente?.criadoPorNome ?? autor.nome, criadoEm: existente?.criadoEm ?? agoraIso,
    atualizadoPorLogin: autor.login, atualizadoEm: agoraIso,
  };
}

/** Uma informação salva volta para o formulário (editar). */
export function entradaDaInformacao(informacao: InformacaoDia): EntradaInformacao {
  return {
    login: informacao.login, nomeColaborador: informacao.nomeColaborador, equipeId: informacao.equipeId, tipo: informacao.tipo,
    dataInicio: informacao.dataInicio, dataFim: informacao.dataFim, diaTodo: informacao.horaInicio === null,
    horaInicio: informacao.horaInicio ?? '', horaFim: informacao.horaFim ?? '', titulo: informacao.titulo, observacao: informacao.observacao,
    visivelParaColaborador: informacao.visivelParaColaborador,
  };
}

/** O que veio do banco; documento malformado vira `null` (ignorado, nunca derruba a tela). */
export function lerInformacao(id: string, dados: Record<string, unknown>): InformacaoDia | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null);
  const tipo = texto(dados.tipo) as TipoInformacao | null;
  const login = texto(dados.login);
  const equipeId = texto(dados.equipeId);
  const dataInicio = texto(dados.dataInicio);
  const dataFim = texto(dados.dataFim);
  if (!tipo || !TIPOS_INFORMACAO.some((meta) => meta.chave === tipo) || !login || !equipeId) return null;
  if (!dataInicio || !dataFim || !dataValida(dataInicio) || !dataValida(dataFim) || dataFim < dataInicio) return null;
  const horaInicio = dados.horaInicio === null || dados.horaInicio === undefined ? null : texto(dados.horaInicio);
  const horaFim = dados.horaFim === null || dados.horaFim === undefined ? null : texto(dados.horaFim);
  if ((horaInicio === null) !== (horaFim === null)) return null;
  if (horaInicio !== null && (!HORA.test(horaInicio) || !HORA.test(horaFim ?? ''))) return null;
  return {
    id, schemaVersion: 1, equipeId, login, nomeColaborador: texto(dados.nomeColaborador) ?? login, tipo, dataInicio, dataFim, horaInicio, horaFim,
    titulo: texto(dados.titulo) ?? '', observacao: texto(dados.observacao) ?? '', visivelParaColaborador: dados.visivelParaColaborador === true,
    criadoPorLogin: texto(dados.criadoPorLogin) ?? '', criadoPorNome: texto(dados.criadoPorNome) ?? '', criadoEm: texto(dados.criadoEm) ?? '',
    atualizadoPorLogin: texto(dados.atualizadoPorLogin) ?? '', atualizadoEm: texto(dados.atualizadoEm) ?? '',
  };
}

// ------------------------------------------------------------------ leitura

export function cobreDia(informacao: Pick<InformacaoDia, 'dataInicio' | 'dataFim'>, data: string): boolean {
  return informacao.dataInicio <= data && data <= informacao.dataFim;
}

export function sobrepoeIntervalo(informacao: Pick<InformacaoDia, 'dataInicio' | 'dataFim'>, inicio: string, fim: string): boolean {
  return informacao.dataInicio <= fim && informacao.dataFim >= inicio;
}

/** Dia todo primeiro, depois por horário, depois por nome — a ordem que a liderança lê. */
export function ordenarInformacoes<T extends InformacaoDia>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)
    || (a.horaInicio ?? '').localeCompare(b.horaInicio ?? '')
    || a.nomeColaborador.localeCompare(b.nomeColaborador, 'pt-BR')
    || a.id.localeCompare(b.id));
}

export function informacoesDoDia(lista: readonly InformacaoDia[], data: string): InformacaoDia[] {
  return ordenarInformacoes(lista.filter((informacao) => cobreDia(informacao, data)));
}

export function informacoesDoMes(lista: readonly InformacaoDia[], mes: string): InformacaoDia[] {
  return ordenarInformacoes(lista.filter((informacao) => sobrepoeIntervalo(informacao, `${mes}-01`, `${mes}-31`)));
}

export interface FiltrosInformacao {
  tipo: 'TODOS' | TipoInformacao;
  login: string;
  visibilidade: 'TODAS' | 'VISIVEL' | 'RESERVADA';
  busca: string;
}

export const SEM_FILTROS: FiltrosInformacao = { tipo: 'TODOS', login: '', visibilidade: 'TODAS', busca: '' };

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();
}

export function filtrarInformacoes(lista: readonly InformacaoDia[], filtros: FiltrosInformacao): InformacaoDia[] {
  const termo = semAcento(filtros.busca.trim());
  return lista.filter((informacao) => {
    if (filtros.tipo !== 'TODOS' && informacao.tipo !== filtros.tipo) return false;
    if (filtros.login !== '' && informacao.login !== filtros.login) return false;
    if (filtros.visibilidade === 'VISIVEL' && !informacao.visivelParaColaborador) return false;
    if (filtros.visibilidade === 'RESERVADA' && informacao.visivelParaColaborador) return false;
    if (termo === '') return true;
    return semAcento(`${informacao.nomeColaborador} ${informacao.titulo} ${informacao.observacao} ${metaDoTipo(informacao.tipo).rotulo}`).includes(termo);
  });
}

// ----------------------------------------------------------------- calendário

export interface CelulaCalendario {
  data: string;
  doMes: boolean;
}

/** As semanas (domingo a sábado) que cobrem o mês, com os dias de fora marcados. */
export function semanasDoMes(mes: string): CelulaCalendario[][] {
  const primeiro = `${mes}-01`;
  const [ano, numeroMes] = mes.split('-').map(Number) as [number, number];
  const ultimo = `${mes}-${String(new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate()).padStart(2, '0')}`;
  const inicio = adicionarDias(primeiro, -new Date(`${primeiro}T12:00:00Z`).getUTCDay());
  const fim = adicionarDias(ultimo, 6 - new Date(`${ultimo}T12:00:00Z`).getUTCDay());
  const semanas: CelulaCalendario[][] = [];
  for (let cursor = inicio; cursor <= fim; cursor = adicionarDias(cursor, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, indice) => {
      const data = adicionarDias(cursor, indice);
      return { data, doMes: data.startsWith(mes) };
    }));
  }
  return semanas;
}

export interface ResumoDia {
  total: number;
  tipos: TipoInformacao[];
}

/** Quantas informações caem em cada dia (período vira um ponto em cada dia que cobre). */
export function resumoPorDia(lista: readonly InformacaoDia[], mes: string): Map<string, ResumoDia> {
  const mapa = new Map<string, ResumoDia>();
  const inicio = `${mes}-01`;
  const fim = `${mes}-31`;
  for (const informacao of lista) {
    if (!sobrepoeIntervalo(informacao, inicio, fim)) continue;
    const de = informacao.dataInicio < inicio ? inicio : informacao.dataInicio;
    const ate = informacao.dataFim > fim ? fim : informacao.dataFim;
    for (let dia = de; dia <= ate; dia = adicionarDias(dia, 1)) {
      if (!dia.startsWith(mes)) continue;
      const atual = mapa.get(dia) ?? { total: 0, tipos: [] };
      atual.total += 1;
      if (!atual.tipos.includes(informacao.tipo)) atual.tipos.push(informacao.tipo);
      mapa.set(dia, atual);
    }
  }
  return mapa;
}

export interface ResumoPeriodo {
  /** Pessoas com alguma informação hoje. */
  pessoasHoje: number;
  noMes: number;
  atestadosNoMes: number;
  visiveisNoMes: number;
}

export function resumoDoPeriodo(lista: readonly InformacaoDia[], mes: string, hojeIso: string): ResumoPeriodo {
  const doMes = informacoesDoMes(lista, mes);
  return {
    pessoasHoje: new Set(lista.filter((informacao) => cobreDia(informacao, hojeIso)).map((informacao) => informacao.login)).size,
    noMes: doMes.length,
    atestadosNoMes: doMes.filter((informacao) => informacao.tipo === 'ATESTADO').length,
    visiveisNoMes: doMes.filter((informacao) => informacao.visivelParaColaborador).length,
  };
}

// -------------------------------------------------------------------- texto

export function formatarDiaMes(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

const DIAS_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_SEMANA_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function nomeDoMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  return `${MESES[numero - 1]![0]!.toUpperCase()}${MESES[numero - 1]!.slice(1)} de ${ano}`;
}

/** "quinta-feira, 12 de novembro" */
export function tituloDoDia(data: string): string {
  const [, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return `${DIAS_SEMANA_LONGO[new Date(`${data}T12:00:00Z`).getUTCDay()]}, ${dia} de ${MESES[mes - 1]}`;
}

/** "Hoje", "Amanhã", "Ontem" ou "qua, 18/11". */
export function rotuloDiaRelativo(data: string, hojeIso: string): string {
  const diferenca = diasEntreDatas(hojeIso, data);
  if (diferenca === 0) return 'Hoje';
  if (diferenca === 1) return 'Amanhã';
  if (diferenca === -1) return 'Ontem';
  return `${DIAS_SEMANA_CURTO[new Date(`${data}T12:00:00Z`).getUTCDay()]}, ${formatarDiaMes(data)}`;
}

/** "12/11" ou "12/11 a 14/11". */
export function descricaoPeriodo(informacao: Pick<InformacaoDia, 'dataInicio' | 'dataFim'>): string {
  return informacao.dataInicio === informacao.dataFim ? formatarDiaMes(informacao.dataInicio) : `${formatarDiaMes(informacao.dataInicio)} a ${formatarDiaMes(informacao.dataFim)}`;
}

/** "Dia todo" ou "das 14:00 às 18:00". */
export function descricaoHorario(informacao: Pick<InformacaoDia, 'horaInicio' | 'horaFim'>): string {
  return informacao.horaInicio === null || informacao.horaFim === null ? 'Dia todo' : `das ${informacao.horaInicio} às ${informacao.horaFim}`;
}

export function tituloExibicao(informacao: Pick<InformacaoDia, 'titulo' | 'tipo'>): string {
  return informacao.titulo.trim() !== '' ? informacao.titulo : metaDoTipo(informacao.tipo).rotulo;
}

/**
 * O que o colaborador vê no App: só as informações marcadas como visíveis, dele mesmo, que ainda
 * valem (hoje em diante) e começam dentro da janela. A liderança nunca é filtrada por aqui.
 */
export function paraOColaborador(lista: readonly InformacaoDia[], login: string, hojeIso: string, janelaDias = 14): InformacaoDia[] {
  const limite = adicionarDias(hojeIso, janelaDias);
  return ordenarInformacoes(lista.filter((informacao) => informacao.login === login
    && informacao.visivelParaColaborador
    && informacao.dataFim >= hojeIso
    && informacao.dataInicio <= limite));
}

// ------------------------------------------------------- marcadores na grade

/** O que a grade da escala mostra numa célula (pessoa + dia) que tem informação. */
export interface MarcadorCelula {
  /** Cores distintas, na ordem em que aparecem (no máximo uma por tipo). */
  cores: CorInformacao[];
  itens: InformacaoDia[];
}

export function chaveMarcador(login: string, data: string): string {
  return `${login}_${data}`;
}

/** Uma entrada por pessoa e dia coberto — um período vira um marcador em cada dia que cobre. */
export function marcadoresPorCelula(lista: readonly InformacaoDia[]): Map<string, MarcadorCelula> {
  const mapa = new Map<string, MarcadorCelula>();
  for (const informacao of lista) {
    const dias = Math.min(diasEntreDatas(informacao.dataInicio, informacao.dataFim), LIMITE_DIAS_PERIODO - 1);
    for (let indice = 0; indice <= dias; indice += 1) {
      const chave = chaveMarcador(informacao.login, adicionarDias(informacao.dataInicio, indice));
      const atual = mapa.get(chave) ?? { cores: [], itens: [] };
      const cor = metaDoTipo(informacao.tipo).cor;
      if (!atual.cores.includes(cor)) atual.cores.push(cor);
      atual.itens.push(informacao);
      mapa.set(chave, atual);
    }
  }
  return mapa;
}

/** "Atestado: Atestado de 3 dias (dia todo) · Curso ou treinamento (das 14:00 às 18:00)" — para o tooltip da célula. */
export function textoDoMarcador(marcador: MarcadorCelula): string {
  return ordenarInformacoes(marcador.itens)
    .map((informacao) => `${metaDoTipo(informacao.tipo).rotulo}${informacao.titulo.trim() !== '' ? `: ${informacao.titulo}` : ''} (${descricaoHorario(informacao).replace(/^Dia todo$/u, 'dia todo')})`)
    .join(' · ');
}
