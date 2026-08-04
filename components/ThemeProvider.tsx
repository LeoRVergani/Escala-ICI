'use client';

import { Moon, Sun } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Tema = 'light' | 'dark';

interface ThemeContextValue {
  tema: Tema;
  alternar: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>('light');

  useEffect(() => {
    const quadro = window.requestAnimationFrame(() => {
      if (window.localStorage.getItem('escala-ici-tema') === 'dark') {
        setTema('dark');
      }
    });
    return () => window.cancelAnimationFrame(quadro);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);

  const valor = useMemo<ThemeContextValue>(() => ({
    tema,
    alternar: () => {
      setTema((atual) => {
        const proximo = atual === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = proximo;
        window.localStorage.setItem('escala-ici-tema', proximo);
        return proximo;
      });
    },
  }), [tema]);

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const contexto = useContext(ThemeContext);
  if (contexto === null) {
    return null;
  }

  return (
    <button
      className="icon-button"
      type="button"
      onClick={contexto.alternar}
      aria-label={contexto.tema === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={contexto.tema === 'light' ? 'Modo escuro' : 'Modo claro'}
    >
      {contexto.tema === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
