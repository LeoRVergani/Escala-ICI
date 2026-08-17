import { formatarData, type PadraoHorarioPlantaoDia } from '@escala-ici/contrato';
import { CalendarCog, X } from 'lucide-react';

import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';

import { previewPadraoHorarioPlantaoDia } from './PadraoHorarioSemanalCampo';

export interface QuickAddPlantaoPopoverProps {
  plantonistaNomeOriginal: string;
  dataIso: string;
  /** Fase ESCALAS-UX-2B.2 — `null` quando o Grupo não tem padrão configurado para este dia da semana. */
  padrao: PadraoHorarioPlantaoDia | null;
  onAdicionar: () => void;
  onOutroHorario: () => void;
  /** Só chamada quando `padrao === null` — leva para Administração → Grupos de Plantão → o Grupo atual. */
  onConfigurarPadrao: () => void;
  /** Só chamada quando `padrao === null` — abre o editor completo com início/fim vazios. */
  onInformarManualmente: () => void;
  onFechar: () => void;
}

/**
 * Fase ESCALAS-UX-2B — confirmação contextual do padrão do Grupo (§ 12/
 * § 13/§ 24/§ 25 do pedido). Aparece depois de click OU drop — NUNCA cria
 * a atribuição sozinho: "Adicionar" confirma explicitamente, "Outro
 * horário" abre o editor completo (`ModalEditarAtribuicaoPlantao`) para o
 * caso que o padrão não serve, "Cancelar"/Escape/clicar fora fecha sem
 * tocar a working copy. Reusa `previewPadraoHorarioPlantaoDia()` (o MESMO
 * cálculo/formatação já usado no formulário de Administração do Grupo) —
 * nunca uma segunda implementação de preview, nunca expõe `fimDiaOffset`
 * cru.
 *
 * Fase ESCALAS-UX-2B.2 — `padrao` passou a aceitar `null` (§ 23-25 do
 * pedido): antes, sem padrão configurado, o Dashboard caía SILENCIOSAMENTE
 * no editor completo — indistinguível, na prática, de "drag quebrado".
 * Agora este MESMO popover mostra "Nenhum padrão configurado" com duas
 * ações explícitas ("Configurar padrão"/"Informar horário manualmente") —
 * nunca mais uma queda silenciosa para o modal grande.
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
  onConfigurarPadrao,
  onInformarManualmente,
  onFechar,
}: QuickAddPlantaoPopoverProps) {
  useTeclaEsc(onFechar);
  const rotuloData = formatarData(dataIso, { weekday: 'long', day: '2-digit', month: 'long' });
  const preview = padrao === null ? null : previewPadraoHorarioPlantaoDia(padrao);

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
        {preview !== null ? (
          <>
            <div className="plantao-quick-add-padrao">
              <span>Padrão do grupo</span>
              <strong>{preview.texto}</strong>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={onOutroHorario}>Outro horário</button>
              <button className="primary-button" type="button" disabled={!preview.valida} onClick={onAdicionar}>Adicionar</button>
            </div>
          </>
        ) : (
          <>
            <div className="plantao-quick-add-sem-padrao">
              <span>Nenhum padrão configurado</span>
              <p>Este Grupo não possui horário padrão para este dia da semana.</p>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={onConfigurarPadrao}>
                <CalendarCog size={16} /> Configurar padrão
              </button>
              <button className="primary-button" type="button" onClick={onInformarManualmente}>Informar horário manualmente</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
