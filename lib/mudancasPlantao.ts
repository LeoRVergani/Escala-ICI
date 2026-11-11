import type { FuncaoPlantao, MomentoPlantao } from '@escala-ici/contrato';

/**
 * ESCALA-PLANTAO-3 — o que muda entre a escala no ar e a que vai ser
 * publicada, em linguagem de gente: "dia 12, 19h–07h: Bruno → Jean".
 * Um plantão é o mesmo quando tem o mesmo posto e o mesmo horário.
 */
export interface PlantaoComparavel {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  funcao?: FuncaoPlantao | null;
}

export interface MudancaPlantao {
  tipo: 'TROCA' | 'NOVO' | 'RETIRADO';
  data: string;
  horario: string;
  funcao: FuncaoPlantao | null;
  antes: string | null;
  depois: string | null;
}

function chave(plantao: PlantaoComparavel): string {
  return `${plantao.funcao ?? ''}|${plantao.inicio.data}T${plantao.inicio.hora}|${plantao.fim.data}T${plantao.fim.hora}`;
}

function hora(momento: MomentoPlantao): string {
  const [h, m] = momento.hora.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function mudancasEntreEscalas(
  noAr: readonly PlantaoComparavel[],
  nova: readonly PlantaoComparavel[],
): MudancaPlantao[] {
  const antes = new Map(noAr.map((plantao) => [chave(plantao), plantao]));
  const depois = new Map(nova.map((plantao) => [chave(plantao), plantao]));
  const mudancas: MudancaPlantao[] = [];
  const base = (plantao: PlantaoComparavel) => ({
    data: plantao.inicio.data,
    horario: `${hora(plantao.inicio)}–${hora(plantao.fim)}`,
    funcao: plantao.funcao ?? null,
  });
  for (const [id, plantao] of depois) {
    const anterior = antes.get(id);
    if (!anterior) {
      mudancas.push({ tipo: 'NOVO', ...base(plantao), antes: null, depois: plantao.plantonistaNomeOriginal });
    } else if (anterior.plantonistaNomeOriginal !== plantao.plantonistaNomeOriginal) {
      mudancas.push({ tipo: 'TROCA', ...base(plantao), antes: anterior.plantonistaNomeOriginal, depois: plantao.plantonistaNomeOriginal });
    }
  }
  for (const [id, plantao] of antes) {
    if (!depois.has(id)) mudancas.push({ tipo: 'RETIRADO', ...base(plantao), antes: plantao.plantonistaNomeOriginal, depois: null });
  }
  return mudancas.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));
}
