import { useState } from 'react';

import { diaSemanaCivil, formatarData, type PadraoHorarioPlantaoDia } from '@escala-ici/contrato';
import { CalendarClock } from 'lucide-react';

import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';
import {
  padraoDivergeDosPresetsQuickAdd,
  PRESETS_HORARIO_QUICK_ADD_PLANTAO,
  type OpcaoHorarioQuickAddPlantao,
} from '@/lib/editorPlantao';

import { previewPadraoHorarioPlantaoDia } from './PadraoHorarioSemanalCampo';

export interface QuickAddPlantaoPopoverProps {
  plantonistaNomeOriginal: string;
  dataIso: string;
  /** `null` quando o Grupo não tem padrão configurado para este dia da semana — nunca mais bloqueia o quick-add (§39 do pedido). */
  padrao: PadraoHorarioPlantaoDia | null;
  onAdicionar: (opcao: OpcaoHorarioQuickAddPlantao) => void;
  onOutroHorario: () => void;
  onFechar: () => void;
}

/**
 * Fase ESCALAS-SIMPLES-1 (§36-41 do pedido) — os três atalhos fixos
 * (12h/24h/5h, sempre `19:00 → dia seguinte`) ficam SEMPRE disponíveis,
 * com ou sem `padraoHorarioSemanal` configurado no Grupo. O padrão do
 * Grupo, quando existe E diverge dos três presets, aparece como uma
 * QUARTA opção extra (nunca duplicada — `padraoDivergeDosPresetsQuickAdd`).
 * "Outro horário" continua sendo a exceção que abre o editor completo
 * (`ModalEditarAtribuicaoPlantao`), nunca o caminho principal.
 *
 * Substitui a versão anterior (Fase ESCALAS-UX-2B.2), que bloqueava com
 * "Nenhum padrão configurado" + "Configurar padrão"/"Informar horário
 * manualmente" quando o Grupo não tinha padrão — esse bloqueio nunca mais
 * acontece: os presets fixos preenchem exatamente esse vazio.
 *
 * Posicionamento: mesmo dialog central reaproveitado da versão anterior
 * (`.modal-backdrop` + `.plantao-quick-add-dialog`) — nenhuma biblioteca de
 * posicionamento nova.
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
  const rotuloData = formatarData(dataIso, { weekday: 'long', day: '2-digit', month: 'long' });

  const opcaoPadrao: OpcaoHorarioQuickAddPlantao | null = padrao !== null && padraoDivergeDosPresetsQuickAdd(padrao)
    ? { id: 'PADRAO_GRUPO', horaInicio: padrao.horaInicio, horaFim: padrao.horaFim, fimDiaOffset: padrao.fimDiaOffset }
    : null;
  const opcoes: OpcaoHorarioQuickAddPlantao[] = opcaoPadrao !== null
    ? [opcaoPadrao, ...PRESETS_HORARIO_QUICK_ADD_PLANTAO]
    : [...PRESETS_HORARIO_QUICK_ADD_PLANTAO];

  const [selecionadaId, setSelecionadaId] = useState(opcoes[0]?.id ?? '');
  const selecionada = opcoes.find((opcao) => opcao.id === selecionadaId) ?? opcoes[0] ?? null;
  const diaSemanaDaData = diaSemanaCivil(dataIso);

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
        </div>
        <fieldset className="plantao-quick-add-opcoes">
          <legend>Horário</legend>
          {opcoes.map((opcao) => {
            const preview = previewPadraoHorarioPlantaoDia({ ...opcao, diaSemana: diaSemanaDaData });
            const rotulo = opcao.id === 'PADRAO_GRUPO' ? `Padrão do grupo · ${preview.texto}` : preview.texto;
            return (
              <label key={opcao.id} className="plantao-quick-add-opcao">
                <input
                  type="radio"
                  name="quick-add-horario"
                  value={opcao.id}
                  checked={selecionadaId === opcao.id}
                  onChange={() => setSelecionadaId(opcao.id)}
                />
                <span>{rotulo}</span>
              </label>
            );
          })}
        </fieldset>
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onOutroHorario}>
            <CalendarClock size={16} /> Outro horário
          </button>
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button
            className="primary-button"
            type="button"
            disabled={selecionada === null}
            onClick={() => selecionada !== null && onAdicionar(selecionada)}
          >
            Adicionar
          </button>
        </div>
      </section>
    </div>
  );
}
