import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { CompetenciaPlantao, GrupoPlantao } from '@escala-ici/contrato';
import { validarCancelamentoCompetenciaPlantao } from '@escala-ici/contrato';

/**
 * FASE-ESCOPO-HIERARQUICO-CODB-E-ADMIN-PLANTAO-1 — cancelamento de uma
 * competência PUBLICADA de Plantão. Deliberadamente NÃO é
 * `ModalConfirmarComTexto` (aquele exige digitar o ID de volta, pensado
 * para exclusão física): aqui a ação é reversível-em-espírito (o histórico
 * nunca some, só deixa de ser a publicação vigente), então o atrito certo é
 * um motivo obrigatório, não uma frase de confirmação.
 */
export interface CancelarPublicacaoPlantaoModalProps {
  grupo: GrupoPlantao;
  competencia: CompetenciaPlantao;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void | Promise<void>;
  processando?: boolean;
  erro?: string;
}

export function CancelarPublicacaoPlantaoModal({
  grupo,
  competencia,
  onFechar,
  onConfirmar,
  processando = false,
  erro,
}: CancelarPublicacaoPlantaoModalProps) {
  const [motivo, setMotivo] = useState('');
  const errosMotivo = validarCancelamentoCompetenciaPlantao(motivo);
  const podeConfirmar = errosMotivo.length === 0;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancelar-publicacao-plantao-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Plantão</p>
            <h2 id="cancelar-publicacao-plantao-title">Cancelar publicação de Plantão?</h2>
            <p>
              <strong>{grupo.nome}</strong> — {competencia.competencia}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="alert warning" role="status">
          <AlertTriangle size={16} />
          <span>
            Esta publicação deixará de aparecer no App e nas consultas operacionais (Hoje, Agenda, trocas).
            O histórico e as atribuições publicadas serão preservados — cancelar não é excluir.
          </span>
        </div>
        <label className="user-form-full">
          Motivo do cancelamento
          <textarea
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Ex.: Grupo duplicado criado por engano."
            rows={3}
            autoFocus
          />
        </label>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="wizard-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button
            className="primary-button danger-button"
            type="button"
            disabled={!podeConfirmar || processando}
            onClick={() => void onConfirmar(motivo)}
          >
            {processando ? 'Cancelando…' : 'Confirmar cancelamento'}
          </button>
        </div>
      </section>
    </div>
  );
}
