import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';
import { PwaProvider } from '@/components/PwaProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { EmployeeApp } from './EmployeeApp';
import { VERSAO_APP, versaoPublicadaDiferente } from './versaoApp';

const raiz = document.getElementById('root');

if (raiz === null) {
  throw new Error('O elemento raiz do aplicativo não foi encontrado.');
}

createRoot(raiz).render(
  <StrictMode>
    <ThemeProvider>
      <PwaProvider verificarVersaoNova={(publicada) => versaoPublicadaDiferente(VERSAO_APP, publicada)}>
        <EmployeeApp />
      </PwaProvider>
    </ThemeProvider>
  </StrictMode>,
);
