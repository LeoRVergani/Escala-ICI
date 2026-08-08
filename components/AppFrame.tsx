'use client';

import {
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  Grid3X3,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { Usuario } from '@/lib/modelos';
import { BrandMark } from './BrandMark';
import { ThemeToggle } from './ThemeProvider';

export interface ItemNavegacao {
  id: string;
  rotulo: string;
  icone: 'home' | 'upload' | 'calendar' | 'grid' | 'users' | 'user' | 'trocas' | 'admin';
}

const ICONES: Record<ItemNavegacao['icone'], LucideIcon> = {
  home: Home,
  upload: UploadCloud,
  calendar: CalendarDays,
  grid: Grid3X3,
  users: Users,
  user: UserRound,
  trocas: ArrowLeftRight,
  admin: ShieldCheck,
};

interface AppFrameProps {
  produto: 'dashboard' | 'app';
  usuario: Usuario;
  competencia: string;
  itens: ItemNavegacao[];
  ativo: string;
  onNavegar: (id: string) => void;
  onSair: () => void;
  produtoHref?: string;
  acoesTopo?: ReactNode;
  children: ReactNode;
}

export function AppFrame({
  produto,
  usuario,
  competencia,
  itens,
  ativo,
  onNavegar,
  onSair,
  produtoHref,
  acoesTopo,
  children,
}: AppFrameProps) {
  const [recolhida, setRecolhida] = useState(false);
  const [mobileAberta, setMobileAberta] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const menuContaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contaAberta) {
      return undefined;
    }

    function fecharAoClicarFora(evento: PointerEvent) {
      if (!menuContaRef.current?.contains(evento.target as Node)) {
        setContaAberta(false);
      }
    }

    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setContaAberta(false);
      }
    }

    document.addEventListener('pointerdown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEscape);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEscape);
    };
  }, [contaAberta]);

  return (
    <div className={`app-shell product-${produto} ${recolhida ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileAberta ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <BrandMark className="brand-mark" />
          {!recolhida && (
            <div>
              <strong>Escala ICI</strong>
              <span>{produto === 'dashboard' ? 'Gestão de escalas' : 'Minha jornada'}</span>
            </div>
          )}
          <button
            className="icon-button sidebar-mobile-close"
            type="button"
            onClick={() => setMobileAberta(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {itens.map((item) => {
            const Icone = ICONES[item.icone];
            return (
              <button
                key={item.id}
                className={ativo === item.id ? 'active' : ''}
                type="button"
                onClick={() => {
                  onNavegar(item.id);
                  setMobileAberta(false);
                }}
                title={recolhida ? item.rotulo : undefined}
                aria-current={ativo === item.id ? 'page' : undefined}
              >
                <Icone size={19} />
                {!recolhida && <span>{item.rotulo}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!recolhida && (
            <div className="system-status">
              <span className="status-dot" />
              <div>
                <strong>Sistema operacional</strong>
                <small>Dados protegidos pelas regras</small>
              </div>
            </div>
          )}
          <button
            className="collapse-button"
            type="button"
            onClick={() => setRecolhida((valor) => !valor)}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!recolhida && <span>Recolher menu</span>}
          </button>
        </div>
      </aside>

      <div className="page-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            onClick={() => setMobileAberta(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          {produto === 'app' && (
            <div className="mobile-app-brand">
              <BrandMark className="brand-mark" />
              <strong>Escala ICI</strong>
            </div>
          )}
          <div className="competence-control">
            <span>Competência</span>
            <strong><CalendarDays size={16} /> {competencia}</strong>
          </div>
          <div className="topbar-actions">
            {acoesTopo}
            <ThemeToggle />
            {produto === 'dashboard' && (
              <a
                className="product-link"
                href={produtoHref ?? '/app'}
              >
                Abrir app
              </a>
            )}
            <div className="user-menu" ref={menuContaRef}>
              <span className="avatar">{usuario.nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}</span>
              <div className="user-identity">
                <strong>{usuario.nome}</strong>
                <small>{usuario.nivelHierarquico <= 5 ? 'Coordenador' : 'Analista SOC'}</small>
              </div>
              <button
                className={`account-menu-trigger ${contaAberta ? 'open' : ''}`}
                type="button"
                onClick={() => setContaAberta((aberta) => !aberta)}
                aria-label="Abrir menu da conta"
                aria-haspopup="menu"
                aria-expanded={contaAberta}
              >
                <ChevronDown size={17} />
              </button>
              {contaAberta && (
                <div className="account-popover" role="menu" aria-label="Menu da conta">
                  <div className="account-popover-identity">
                    <span className="avatar">{usuario.nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}</span>
                    <div>
                      <strong>{usuario.nome}</strong>
                      <small>{usuario.nivelHierarquico <= 5 ? 'Coordenador' : 'Analista SOC'}</small>
                    </div>
                  </div>
                  <button
                    className="account-logout"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContaAberta(false);
                      onSair();
                    }}
                  >
                    <LogOut size={17} />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="workspace">{children}</main>
      </div>
      {produto === 'app' && (
        <nav className="bottom-nav" aria-label="Navegação principal do aplicativo">
          {itens.map((item) => {
            const Icone = ICONES[item.icone];
            return (
              <button
                key={item.id}
                type="button"
                className={ativo === item.id ? 'active' : ''}
                onClick={() => onNavegar(item.id)}
                aria-current={ativo === item.id ? 'page' : undefined}
              >
                <Icone size={20} />
                <span>{item.rotulo}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
