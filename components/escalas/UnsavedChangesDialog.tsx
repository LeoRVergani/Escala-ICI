'use client';

import { LogOut, X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Fase ESCALAS-UX-2A.1 — bloqueador de troca de contexto/competência com
 * alterações não salvas (§ 24-§ 28 do redesign). Mesmo padrão visual do
 * modal de confirmação já existente (`modal-backdrop`/`edit-modal
 * rollback-modal`/`panel-title`/`rollback-actions`, ver
 * "Descartar rascunho?" em `DashboardApp.tsx`) — nenhum modal novo,
 * nunca `window.confirm()`. Escape cancela a ação destrutiva (equivalente
 * a "Continuar editando"), nunca confirma o descarte silenciosamente.
 */
export interface UnsavedChangesDialogProps {
  onContinuarEditando: () => void;
  onTrocarSemSalvar: () => void;
}

export function UnsavedChangesDialog({ onContinuarEditando, onTrocarSemSalvar }: UnsavedChangesDialogProps) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        onContinuarEditando();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onContinuarEditando]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onContinuarEditando}>
      <section
        className="edit-modal rollback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Alterações não salvas</p>
            <h2 id="unsaved-changes-title">Você possui alterações nesta escala</h2>
            <p>Se trocar de escala agora, elas serão descartadas.</p>
          </div>
          <button className="icon-button" type="button" onClick={onContinuarEditando} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onContinuarEditando}>
            Continuar editando
          </button>
          <button className="primary-button danger-button" type="button" onClick={onTrocarSemSalvar}>
            <LogOut size={16} /> Trocar sem salvar
          </button>
        </div>
      </section>
    </div>
  );
}
