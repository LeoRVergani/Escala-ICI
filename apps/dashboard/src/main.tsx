import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { DashboardApp } from './DashboardApp';

const raiz = document.getElementById('root');

if (raiz === null) {
  throw new Error('O elemento raiz do dashboard não foi encontrado.');
}

createRoot(raiz).render(
  <StrictMode>
    <ThemeProvider>
      <DashboardApp />
    </ThemeProvider>
  </StrictMode>,
);
