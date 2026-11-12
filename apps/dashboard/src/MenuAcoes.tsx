import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * DASHBOARD-LOTE2 — menu de ações compacto ("⋯" ou "+ Nova"): ações raras ou
 * perigosas ficam guardadas, longe do clique acidental. Fecha ao escolher,
 * ao clicar fora e com Esc.
 */
export interface ItemMenuAcoes {
  rotulo: string;
  icone?: ReactNode;
  perigo?: boolean;
  desabilitado?: boolean;
  dica?: string;
  executar: () => void;
}

export function MenuAcoes({ rotulo, conteudoBotao, itens, classeBotao = 'icon-button' }: {
  rotulo: string;
  conteudoBotao: ReactNode;
  itens: readonly ItemMenuAcoes[];
  classeBotao?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fecharFora = (evento: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false);
    };
    const fecharEsc = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEsc);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEsc);
    };
  }, [aberto]);
  return (
    <div className="menu-acoes" ref={raiz}>
      <button type="button" className={classeBotao} aria-haspopup="menu" aria-expanded={aberto} aria-label={rotulo} title={rotulo}
        onClick={() => setAberto((valor) => !valor)}>
        {conteudoBotao}
      </button>
      {aberto && (
        <div className="menu-acoes-lista" role="menu">
          {itens.map((item) => (
            <button key={item.rotulo} type="button" role="menuitem" disabled={item.desabilitado} title={item.dica}
              data-perigo={item.perigo ? '' : undefined}
              onClick={() => { setAberto(false); item.executar(); }}>
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
