'use client';

import { ChevronDown, Layers3, Radio, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chaveContextoEscala, contextosEscalaIguais, type ContextoEscalaAtivo } from '@/lib/contextoEscala';

/**
 * Fase ESCALAS-UX-2A.1 — "Escala atual" (`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`
 * § 7/§ 11). Agrupa JORNADAS/PLANTÕES a partir de dados reais (nunca
 * hardcoda sigla nenhuma) — o chamador (`DashboardApp.tsx`) já resolve os
 * rótulos a partir de `Equipe`/`GrupoPlantao`; este componente só
 * apresenta e emite a seleção, nunca decide o que fazer com ela (não
 * importa Firebase). Mesmo padrão de menu já usado pelo "Menu da conta"
 * (`components/AppFrame.tsx`): `useState` + click-outside/Escape
 * própria, nunca um novo sistema de popover.
 */
export interface OpcaoContextoEscala {
  contexto: ContextoEscalaAtivo;
  rotuloPrincipal: string;
  rotuloSecundario: string;
}

export interface ScheduleContextSwitcherProps {
  contextoAtivo: ContextoEscalaAtivo | null;
  rotuloContextoAtivo: string;
  opcoesJornada: OpcaoContextoEscala[];
  /** Grupos de Plantão que o usuário ADMINISTRA de fato (destino válido de "Nova escala"/"Importar escala"). */
  opcoesPlantao: OpcaoContextoEscala[];
  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — Grupos que a equipe do usuário só
   * CONSULTA (autovínculo de consulta, "Plantões monitorados"), nunca
   * administra — seção separada, nunca misturada com `opcoesPlantao`.
   * Abrir um destes sempre entra em modo somente consulta (o chamador,
   * `DashboardApp.tsx`, decide isso a partir do mesmo dado).
   */
  opcoesPlantaoMonitorados?: OpcaoContextoEscala[];
  onSelecionar: (contexto: ContextoEscalaAtivo) => void;
  /** Fase ESCALAS-UX-2A.1 — desabilita o gatilho enquanto uma troca de contexto está em andamento (nunca abrir um segundo carregamento em cima do primeiro). */
  carregando?: boolean;
}

const LIMITE_SEM_BUSCA = 8;

export function ScheduleContextSwitcher({
  contextoAtivo,
  rotuloContextoAtivo,
  opcoesJornada,
  opcoesPlantao,
  opcoesPlantaoMonitorados = [],
  onSelecionar,
  carregando = false,
}: ScheduleContextSwitcherProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  const totalOpcoes = opcoesJornada.length + opcoesPlantao.length + opcoesPlantaoMonitorados.length;
  const buscaNormalizada = busca.trim().toLowerCase();
  const opcoesJornadaFiltradas = useMemo(
    () => (buscaNormalizada === ''
      ? opcoesJornada
      : opcoesJornada.filter((item) => item.rotuloPrincipal.toLowerCase().includes(buscaNormalizada))),
    [opcoesJornada, buscaNormalizada],
  );
  const opcoesPlantaoFiltradas = useMemo(
    () => (buscaNormalizada === ''
      ? opcoesPlantao
      : opcoesPlantao.filter((item) => item.rotuloPrincipal.toLowerCase().includes(buscaNormalizada))),
    [opcoesPlantao, buscaNormalizada],
  );
  const opcoesPlantaoMonitoradosFiltradas = useMemo(
    () => (buscaNormalizada === ''
      ? opcoesPlantaoMonitorados
      : opcoesPlantaoMonitorados.filter((item) => item.rotuloPrincipal.toLowerCase().includes(buscaNormalizada))),
    [opcoesPlantaoMonitorados, buscaNormalizada],
  );

  useEffect(() => {
    if (!aberto) {
      return undefined;
    }
    function fecharAoClicarFora(evento: PointerEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAberto(false);
        gatilhoRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEscape);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEscape);
    };
  }, [aberto]);

  function selecionar(contexto: ContextoEscalaAtivo) {
    setAberto(false);
    setBusca('');
    gatilhoRef.current?.focus();
    onSelecionar(contexto);
  }

  return (
    <div className="escala-context-switcher" ref={containerRef}>
      <button
        ref={gatilhoRef}
        type="button"
        className={`escala-context-trigger ${aberto ? 'open' : ''}`}
        disabled={carregando}
        onClick={() => setAberto((atual) => !atual)}
        aria-label="Selecionar escala atual"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <Layers3 size={15} aria-hidden="true" />
        <strong>{carregando ? 'Carregando...' : rotuloContextoAtivo}</strong>
        <ChevronDown size={16} />
      </button>
      {aberto && (
        <div className="escala-context-popover" role="menu" aria-label="Selecionar escala">
          {totalOpcoes > LIMITE_SEM_BUSCA && (
            <label className="escala-context-busca">
              <Search size={14} aria-hidden="true" />
              <input
                type="text"
                placeholder="Buscar escala..."
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                autoFocus
              />
            </label>
          )}
          {opcoesJornadaFiltradas.length > 0 && (
            <div className="escala-context-grupo">
              <p>Jornadas</p>
              {opcoesJornadaFiltradas.map((opcao) => (
                <button
                  key={chaveContextoEscala(opcao.contexto)}
                  type="button"
                  role="menuitem"
                  className={`escala-context-opcao ${contextosEscalaIguais(contextoAtivo, opcao.contexto) ? 'selecionado' : ''}`}
                  aria-current={contextosEscalaIguais(contextoAtivo, opcao.contexto) ? 'true' : undefined}
                  onClick={() => selecionar(opcao.contexto)}
                >
                  <strong>{opcao.rotuloPrincipal}</strong>
                  <small>{opcao.rotuloSecundario}</small>
                </button>
              ))}
            </div>
          )}
          {opcoesPlantaoFiltradas.length > 0 && (
            <div className="escala-context-grupo">
              <p><Radio size={12} aria-hidden="true" /> Plantões</p>
              {opcoesPlantaoFiltradas.map((opcao) => (
                <button
                  key={chaveContextoEscala(opcao.contexto)}
                  type="button"
                  role="menuitem"
                  className={`escala-context-opcao ${contextosEscalaIguais(contextoAtivo, opcao.contexto) ? 'selecionado' : ''}`}
                  aria-current={contextosEscalaIguais(contextoAtivo, opcao.contexto) ? 'true' : undefined}
                  onClick={() => selecionar(opcao.contexto)}
                >
                  <strong>{opcao.rotuloPrincipal}</strong>
                  <small>{opcao.rotuloSecundario}</small>
                </button>
              ))}
            </div>
          )}
          {/*
           * Fase ESCOPO-CONSULTA-PLANTAO-1 — seção SEPARADA, nunca
           * misturada com "Plantões" (administráveis) acima: consulta não
           * é administração. Só aparece quando há algum Plantão monitorado
           * — nunca uma seção vazia.
           */}
          {opcoesPlantaoMonitoradosFiltradas.length > 0 && (
            <div className="escala-context-grupo">
              <p><Radio size={12} aria-hidden="true" /> Plantões monitorados</p>
              {opcoesPlantaoMonitoradosFiltradas.map((opcao) => (
                <button
                  key={chaveContextoEscala(opcao.contexto)}
                  type="button"
                  role="menuitem"
                  className={`escala-context-opcao ${contextosEscalaIguais(contextoAtivo, opcao.contexto) ? 'selecionado' : ''}`}
                  aria-current={contextosEscalaIguais(contextoAtivo, opcao.contexto) ? 'true' : undefined}
                  onClick={() => selecionar(opcao.contexto)}
                >
                  <strong>{opcao.rotuloPrincipal}</strong>
                  <small>{opcao.rotuloSecundario} · somente consulta</small>
                </button>
              ))}
            </div>
          )}
          {opcoesJornadaFiltradas.length === 0 && opcoesPlantaoFiltradas.length === 0 && opcoesPlantaoMonitoradosFiltradas.length === 0 && (
            <p className="escala-context-vazio">
              {totalOpcoes === 0 ? 'Nenhuma escala disponível para o seu perfil.' : 'Nenhuma escala encontrada.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
