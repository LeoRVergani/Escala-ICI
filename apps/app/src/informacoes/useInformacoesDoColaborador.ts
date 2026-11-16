import { useEffect, useState } from 'react';

import { ehErroEncerramentoFirestore } from '@/lib/firebase/errors';
import { observarInformacoesDoColaborador } from '@/lib/firebase/informacoesDiaRepository';
import type { InformacaoDia } from '@/lib/informacoesDia';

/**
 * INFORMACOES-DIA-1 — as informações que a liderança LIBEROU para este colaborador (a consulta e as
 * Rules só entregam as dele e só as liberadas). Mesmo ciclo dos outros listeners do App: só assina
 * com a sessão e a carga inicial resolvidas, nunca em demonstração.
 */
export function useInformacoesDoColaborador({ login, desdeIso, listenersLiberados }: {
  login: string | null;
  /** Hoje (YYYY-MM-DD): só o que ainda vale. */
  desdeIso: string;
  listenersLiberados: boolean;
}) {
  const [informacoes, setInformacoes] = useState<InformacaoDia[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!listenersLiberados || login === null) return undefined;
    return observarInformacoesDoColaborador(
      login, desdeIso,
      (lista) => { setInformacoes(lista); setErro(''); },
      (falha) => { if (!ehErroEncerramentoFirestore(falha)) setErro('Não foi possível carregar as informações da liderança agora.'); },
    );
  }, [listenersLiberados, login, desdeIso]);

  return { informacoes: listenersLiberados && login !== null ? informacoes : [], erro };
}
