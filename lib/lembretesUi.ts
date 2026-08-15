/**
 * Lembretes — helpers de UI (Fase 4), ainda sem React/DOM.
 *
 * Combina a lógica pura de `lib/lembretes.ts` (ordenar/agrupar/filtrar) com
 * as necessidades concretas da tela: unir pessoal + atribuído numa única
 * visão, contar por data para os indicadores do calendário, navegar por
 * mês, e converter o estado de um formulário em `EntradaLembrete`/
 * `EntradaSerieLembrete` sem reimplementar validação de data/hora.
 *
 * Tipos aqui são estruturais (campos mínimos necessários), não os DTOs do
 * repository — assim este módulo não depende de `lib/firebase/*` e continua
 * testável sem mockar Firestore. `LembretePessoalPersistido`/
 * `LembreteAtribuidoPersistido` (`lib/firebase/lembretesRepository.ts`) são
 * estruturalmente compatíveis e podem ser passados diretamente.
 */
import { formatarCompetencia, formatarData } from '@escala-ici/contrato';
import {
  agruparLembretesPorData,
  ordenarLembretes,
  validarEntradaLembrete,
  validarEntradaSerieLembrete,
  type EntradaLembrete,
  type EntradaSerieLembrete,
  type GrupoLembretesPorData,
  type HorarioLembrete,
  type StatusLembreteAtribuido,
} from './lembretes';

export type { GrupoLembretesPorData };

export interface ItemLembretePessoal {
  lembreteId: string;
  tipo: 'PESSOAL';
  titulo: string;
  descricao: string | null;
  data: string;
  horario: HorarioLembrete;
  serieId: string | null;
}

export interface ItemLembreteAtribuido {
  lembreteId: string;
  tipo: 'ATRIBUIDO';
  titulo: string;
  descricao: string | null;
  data: string;
  horario: HorarioLembrete;
  serieId: string | null;
  status: StatusLembreteAtribuido;
  criadoPorNome: string;
}

export type ItemLembreteUnificado = ItemLembretePessoal | ItemLembreteAtribuido;

/** União pessoal + atribuído ATIVO (cancelado nunca aparece na visão ativa), já ordenada. */
export function unificarLembretesAtivos(
  pessoais: readonly ItemLembretePessoal[],
  atribuidos: readonly ItemLembreteAtribuido[],
): ItemLembreteUnificado[] {
  return ordenarLembretes([
    ...pessoais,
    ...atribuidos.filter((item) => item.status === 'ATIVO'),
  ]);
}

export function lembretesDoDia(
  itensUnificados: readonly ItemLembreteUnificado[],
  data: string,
): ItemLembreteUnificado[] {
  return itensUnificados.filter((item) => item.data === data);
}

/** Para o indicador do calendário — uma contagem por data civil, só de itens ativos. */
export function contarLembretesPorData(itensUnificados: readonly ItemLembreteUnificado[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itensUnificados) {
    contagem.set(item.data, (contagem.get(item.data) ?? 0) + 1);
  }
  return contagem;
}

/** Próximos N dias com lembrete a partir de `dataMinima` (inclusive), já agrupados/ordenados. */
export function proximosLembretesAgrupados(
  itensUnificados: readonly ItemLembreteUnificado[],
  dataMinima: string,
  limiteDias = 5,
): GrupoLembretesPorData<ItemLembreteUnificado>[] {
  return agruparLembretesPorData(itensUnificados.filter((item) => item.data >= dataMinima)).slice(0, limiteDias);
}

// --- Navegação temporal por mês (YYYY-MM), independente da competência 26→25 ---

export function mesDeData(data: string): string {
  return data.slice(0, 7);
}

export function primeiroDiaDoMes(mes: string): string {
  return `${mes}-01`;
}

/** Dia 0 do mês seguinte == último dia do mês atual — mesmo truque de `adicionarMeses()` (packages/contrato/src/jornada.ts), só para aritmética de calendário, nunca como valor civil em si. */
export function ultimoDiaDoMes(mes: string): string {
  const [ano, mesNumero] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mesNumero, 0)).getUTCDate();
  return `${mes}-${String(ultimoDia).padStart(2, '0')}`;
}

export function mesAdjacente(mes: string, deltaMeses: number): string {
  const [ano, mesNumero] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mesNumero - 1 + deltaMeses, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function tituloMesLembretes(mes: string): string {
  return formatarCompetencia(mes);
}

export function capitalizarPrimeiraLetra(texto: string): string {
  return texto.length === 0 ? texto : texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function rotuloDataLembretePorExtenso(data: string): string {
  return capitalizarPrimeiraLetra(formatarData(data, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }));
}

/** "18:30–22:30" | "21:00" (só início) | "Dia inteiro". Nunca lança para um horário incoerente — só reflete o que já foi normalizado pelo domínio. */
export function rotuloHorarioLembrete(horario: HorarioLembrete): string {
  if (horario.diaInteiro) {
    return 'Dia inteiro';
  }
  if (horario.horaInicio === null) {
    return '';
  }
  if (horario.horaFim === null) {
    return horario.horaInicio;
  }
  return `${horario.horaInicio}–${horario.horaFim}`;
}

export function rotuloViraDia(horario: HorarioLembrete): string | null {
  return horario.viraDia ? 'Termina no dia seguinte' : null;
}

/** Estado de formulário cru (strings, nunca `null`) — a UI decide vazio/preenchido; a conversão abaixo normaliza para o domínio. */
export interface FormularioLembrete {
  titulo: string;
  descricao: string;
  datas: string[];
  diaInteiro: boolean;
  horaInicio: string;
  horaFim: string;
}

function horarioDoFormulario(form: FormularioLembrete): Pick<EntradaLembrete, 'diaInteiro' | 'horaInicio' | 'horaFim'> {
  if (form.diaInteiro) {
    return { diaInteiro: true, horaInicio: null, horaFim: null };
  }
  return {
    diaInteiro: false,
    horaInicio: form.horaInicio.trim() === '' ? null : form.horaInicio,
    horaFim: form.horaFim.trim() === '' ? null : form.horaFim,
  };
}

export function entradaLembreteDoFormulario(form: FormularioLembrete): EntradaLembrete {
  return {
    titulo: form.titulo,
    descricao: form.descricao.trim() === '' ? null : form.descricao,
    data: form.datas[0] ?? '',
    ...horarioDoFormulario(form),
  };
}

export function entradaSerieLembreteDoFormulario(form: FormularioLembrete): EntradaSerieLembrete {
  return {
    titulo: form.titulo,
    descricao: form.descricao.trim() === '' ? null : form.descricao,
    datas: form.datas,
    ...horarioDoFormulario(form),
  };
}

/** Ponto único de validação do formulário — decide série vs. ocorrência única pelo número de datas, nunca reimplementa a regra em si. */
export function validarFormularioLembrete(form: FormularioLembrete): string[] {
  if (form.datas.length <= 1) {
    return validarEntradaLembrete(entradaLembreteDoFormulario(form));
  }
  return validarEntradaSerieLembrete(entradaSerieLembreteDoFormulario(form));
}
