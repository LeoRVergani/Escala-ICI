import { useEffect } from 'react';

/**
 * Fecha qualquer modal/painel ao apertar Esc. Extraído de
 * `apps/dashboard/src/DashboardApp.tsx` (Fase UI-ORG-1) para ser
 * reaproveitado também pelos componentes de árvore/seletor organizacional
 * (`components/organizacao/`) sem duplicar a mesma lógica de 6 linhas.
 */
export function useTeclaEsc(aoFechar: () => void) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        aoFechar();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);
}
