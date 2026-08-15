import { formatarData } from '@escala-ici/contrato';

/**
 * Lógica pura por trás da faixa "Minha semana" da tela Hoje: separa a data
 * real de hoje (`dataHoje`) da data que o colaborador está consultando
 * (`dataConsultaEquipe`), sem navegar para a Agenda. Mantida sem dependência
 * de DOM/React para ser testável isoladamente e reaproveitável por um futuro
 * cliente React Native.
 */

export function ehDiaConsultadoHoje(dataConsultaEquipe: string, dataHoje: string): boolean {
  return dataConsultaEquipe === dataHoje;
}

export function tituloEquipeConsultada(dataConsultaEquipe: string, dataHoje: string): string {
  if (ehDiaConsultadoHoje(dataConsultaEquipe, dataHoje)) {
    return 'Equipe escalada hoje';
  }
  const diaSemana = formatarData(dataConsultaEquipe, { weekday: 'short' }).replace('.', '');
  const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const diaMes = formatarData(dataConsultaEquipe, { day: '2-digit', month: '2-digit' });
  return `Equipe escalada — ${diaSemanaCapitalizado}, ${diaMes}`;
}

export interface EstadoDiaSemana {
  ehHoje: boolean;
  ehSelecionado: boolean;
  classes: string;
}

export function classificarDiaSemana(
  data: string,
  dataHoje: string,
  dataSelecionada?: string,
): EstadoDiaSemana {
  const ehHoje = data === dataHoje;
  const ehSelecionado = dataSelecionada !== undefined && data === dataSelecionada;
  const classes = [ehHoje ? 'today' : '', ehSelecionado ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return { ehHoje, ehSelecionado, classes };
}
