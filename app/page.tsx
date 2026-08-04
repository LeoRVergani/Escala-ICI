import { ArrowRight, LayoutDashboard, Smartphone } from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/BrandMark';

export default function Home() {
  return (
    <main className="entry-page">
      <header className="entry-header">
        <div className="login-brand">
          <BrandMark />
          <strong>Escala ICI</strong>
        </div>
        <span className="status-badge success">Firebase Spark ready</span>
      </header>
      <section className="entry-hero">
        <p className="eyebrow">Escalas corporativas em um só fluxo</p>
        <h1>Planeje com clareza.<br />Publique com segurança.</h1>
        <p>
          Dashboard de gestão e aplicativo web de consulta conectados pelo
          mesmo contrato de dados.
        </p>
      </section>
      <section className="entry-options">
        <Link href="/dashboard">
          <span className="entry-icon"><LayoutDashboard /></span>
          <div><small>Gestores</small><h2>Dashboard</h2><p>Importe XLS, corrija, revise a grade e publique a escala.</p></div>
          <ArrowRight />
        </Link>
        <Link href="/app">
          <span className="entry-icon cyan"><Smartphone /></span>
          <div><small>Colaboradores</small><h2>App web</h2><p>Consulte sua jornada, a equipe e quem está escalado hoje.</p></div>
          <ArrowRight />
        </Link>
      </section>
      <footer>Escala ICI · Arquivos processados localmente no navegador</footer>
    </main>
  );
}
