import { adicionarDias, type Dia } from '@escala-ici/contrato';

export const TAMANHO_CICLO_JORNADA_6X1 = 6;

export interface ResultadoPreenchimentoCiclo6x1 {
  datasAplicadas: string[];
  datasIgnoradas: string[];
}

/**
 * Calcula as datas livres do ciclo inicial de uma Jornada 6x1.
 *
 * O helper é deliberadamente puro: não grava, não recalcula totais e não
 * sobrescreve células que já possuem código. A camada de UI decide quando
 * aplicar o resultado e mostra ao coordenador o que foi preservado.
 */
export function calcularCicloInicialJornada6x1({
  dataInicial,
  periodoFim,
  dias,
}: {
  dataInicial: string;
  periodoFim: string;
  dias: Readonly<Record<string, Dia>>;
}): ResultadoPreenchimentoCiclo6x1 {
  const datasAplicadas: string[] = [];
  const datasIgnoradas: string[] = [];
  let data = dataInicial;

  for (let deslocamento = 0; deslocamento < TAMANHO_CICLO_JORNADA_6X1 && data <= periodoFim; deslocamento += 1) {
    if (dias[data]?.c) {
      datasIgnoradas.push(data);
    } else {
      datasAplicadas.push(data);
    }
    data = adicionarDias(data, 1);
  }

  return { datasAplicadas, datasIgnoradas };
}

export function mensagemCicloInicialJornada6x1(resultado: ResultadoPreenchimentoCiclo6x1, codigo: string): string {
  if (resultado.datasAplicadas.length <= 1 && resultado.datasIgnoradas.length === 0) {
    return `${codigo} aplicado no rascunho local. Salve para persistir.`;
  }
  const aplicadas = resultado.datasAplicadas.length;
  const ignoradas = resultado.datasIgnoradas.length;
  const partes = [`${codigo} aplicado em ${aplicadas} dia${aplicadas === 1 ? '' : 's'} do ciclo inicial`];
  if (ignoradas > 0) {
    partes.push(`${ignoradas} dia${ignoradas === 1 ? '' : 's'} já preenchido${ignoradas === 1 ? '' : 's'} não foi${ignoradas === 1 ? '' : 'ram'} alterado${ignoradas === 1 ? '' : 's'}`);
  }
  return `${partes.join('; ')}. Você pode editar cada dia separadamente.`;
}
