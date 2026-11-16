import { useEffect, useState } from 'react';

import { observarInformacoesDaEquipe } from '@/lib/firebase/informacoesDiaRepository';
import type { InformacaoDia } from '@/lib/informacoesDia';

/**
 * INFORMACOES-DIA-1 — as informações da equipe da grade aberta (para marcar as células e avisar ao
 * editar um dia). Em demonstração usa os exemplos recebidos. Se a consulta for negada (quem só
 * consulta a escala não é chefe dela), a grade segue sem marcadores — nunca com erro na tela.
 */
export function useInformacoesDaEquipe({ equipeId, desdeIso, demo }: {
  equipeId: string | null;
  desdeIso: string;
  /** Exemplos da demonstração; `undefined` = sessão real. */
  demo?: readonly InformacaoDia[];
}): readonly InformacaoDia[] {
  const [informacoes, setInformacoes] = useState<InformacaoDia[]>([]);

  useEffect(() => {
    if (demo !== undefined || equipeId === null || equipeId === '') return undefined;
    return observarInformacoesDaEquipe(equipeId, desdeIso, setInformacoes, () => setInformacoes([]));
  }, [equipeId, desdeIso, demo]);

  return demo !== undefined ? demo : equipeId === null || equipeId === '' ? [] : informacoes;
}
