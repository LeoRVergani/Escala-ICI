import { formatarData, type PadraoHorarioPlantaoDia } from '@escala-ici/contrato';
import { X } from 'lucide-react';

import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';

import { previewPadraoHorarioPlantaoDia } from './PadraoHorarioSemanalCampo';

export interface QuickAddPlantaoPopoverProps {
  plantonistaNomeOriginal: string;
  dataIso: string;
  padrao: PadraoHorarioPlantaoDia;
  onAdicionar: () => void;
  onOutroHorario: () => void;
  onFechar: () => void;
}

/**
 * Fase ESCALAS-UX-2B — confirmação contextual do padrão do Grupo (§ 12/
 * § 13/§ 24/§ 25 do pedido). Aparece depois de click OU drop com padrão
 * configurado para o dia — NUNCA cria a atribuição sozinho: "Adicionar"
 * confirma explicitamente, "Outro horário" abre o editor completo
 * (`ModalEditarAtribuicaoPlantao`) para o caso que o padrão não serve,
 * "Cancelar"/Escape/clicar fora fecha sem tocar a working copy. Reusa
 * `previewPadraoHorarioPlantaoDia()` (o MESMO cálculo/formatação já usado
 * no formulário de Administração do Grupo) — nunca uma segunda
 * implementação de preview, nunca expõe `fimDiaOffset` cru.
 *
 * Posicionamento: dialog pequeno central (`.modal-backdrop` +
 * `.plantao-quick-add-dialog`, reaproveitando o MESMO chrome de modal já
 * usado no resto do Dashboard) — um popover ancorado à célula exigiria
 * lógica de posicionamento (overflow do calendário, scroll interno,
 * proximidade da borda da tela) desproporcional ao ganho nesta primeira
 * implementação; confiabilidade > posicionamento sofisticado (§ 25 do
 * pedido). Nenhuma biblioteca de posicionamento (Popper/Floating UI) foi
 * adicionada.
 */
export function QuickAddPlantaoPopover({
  plantonistaNomeOriginal,
  dataIso,
  padrao,
  onAdicionar,
  onOutroHorario,
  onFechar,
}: QuickAddPlantaoPopoverProps) {
  useTeclaEsc(onFechar);
  const preview = previewPadraoHorarioPlantaoDia(padrao);
  const rotuloData = formatarData(dataIso, { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal plantao-quick-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-plantao-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="quick-add-plantao-titulo">{plantonistaNomeOriginal}</h2>
            <p className="plantao-quick-add-data">{rotuloData}</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="plantao-quick-add-padrao">
          <span>Padrão do grupo</span>
          <strong>{preview.texto}</strong>
        </div>
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onOutroHorario}>Outro horário</button>
          <button className="primary-button" type="button" disabled={!preview.valida} onClick={onAdicionar}>Adicionar</button>
        </div>
      </section>
    </div>
  );
}
