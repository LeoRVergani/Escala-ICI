import type { Metadata } from 'next';

import { EmployeeApp } from '@/apps/app/src/EmployeeApp';
import { PwaProvider } from '@/components/PwaProvider';

export const metadata: Metadata = {
  title: 'Minha Escala · Escala ICI',
  description: 'Consulte sua jornada, escala completa e equipe.',
  manifest: '/manifest-app.webmanifest',
  icons: {
    icon: '/icons/favicon-48.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function EmployeeAppPage() {
  return (
    <PwaProvider>
      <EmployeeApp />
    </PwaProvider>
  );
}
