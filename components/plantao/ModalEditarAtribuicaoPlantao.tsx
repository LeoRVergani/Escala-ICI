import { calcularDuracaoEntreMomentos, formatarMinutos, type MomentoPlantao } from '@escala-ici/contrato';
import { Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { duracaoPlantaoAtipica, validarAtribuicaoEditavel } from '@/lib/editorPlantao';
import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';

export interface FormularioAtribuicaoPlantao {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
}

/**
 * Fase ESCALAS-UX-1A — modal único para criar OU editar uma atribuição de
 * Plantão na working copy do Editor. Nunca grava no Firestore diretamente:
 * `onSalvar`/`onExcluir` só atualizam o estado em memória do Dashboard — a
 * persistência real continua exclusivamente pelo fluxo "Salvar rascunho"
 * já existente. Bloqueia apenas os 4 erros objetivos de
 * `validarAtribuicaoEditavel()` (plantonista/datas vazias, fim <= início);
 * duração atípica (nem 12h nem 24h) é só um aviso, nunca impede salvar.
 *
 * Plantonista é um SELECT sobre `participantesConhecidos` (nunca texto
 * livre): criar uma pessoa nova é responsabilidade da tela de vínculos/
 * participantes, não deste modal — assim o Editor nunca introduz um nome
 * que a conciliação de vínculos desconhece (o que exigiria reconciliar
 * `vinculosPlantao` toda vez que o calendário adicionasse alguém, um
 * sistema mais complexo do que esta fase pede).
 */
export function ModalEditarAtribuicaoPlantao({
  titulo,
  valoresIniciais,
  modo,
  participantesConhecidos,
  onFechar,
  onSalvar,
  onExcluir,
}: {
  titulo: string;
  valoresIniciais: FormularioAtribuicaoPlantao;
  modo: 'criar' | 'editar';
  participantesConhecidos: readonly string[];
  onFechar: () => void;
  onSalvar: (valores: FormularioAtribuicaoPlantao) => void;
  onExcluir?: () => void;
}) {
  const [plantonistaNomeOriginal, setPlantonistaNomeOriginal] = useState(valoresIniciais.plantonistaNomeOriginal);
  const [dataInicial, setDataInicial] = useState(valoresIniciais.inicio.data);
  const [horaInicial, setHoraInicial] = useState(valoresIniciais.inicio.hora);
  const [dataFinal, setDataFinal] = useState(valoresIniciais.fim.data);
  const [horaFinal, setHoraFinal] = useState(valoresIniciais.fim.hora);
  const [erros, setErros] = useState<string[]>([]);
  useTeclaEsc(onFechar);

  const inicio: MomentoPlantao = { data: dataInicial, hora: horaInicial };
  const fim: MomentoPlantao = { data: dataFinal, hora: horaFinal };
  const duracaoMinutos = calcularDuracaoEntreMomentos(inicio, fim);
  const duracaoValida = duracaoMinutos !== null && duracaoMinutos > 0;
  const atipica = duracaoValida && duracaoPlantaoAtipica(duracaoMinutos);

  function aoClicarSalvar() {
    const valores: FormularioAtribuicaoPlantao = { plantonistaNomeOriginal, inicio, fim };
    const errosValidacao = validarAtribuicaoEditavel(valores);
    if (errosValidacao.length > 0) {
      setErros(errosValidacao);
      return;
    }
    onSalvar(valores);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-plantao-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="editar-plantao-modal-title">{titulo}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <label>
          Plantonista
          <select
            value={plantonistaNomeOriginal}
            onChange={(evento) => setPlantonistaNomeOriginal(evento.target.value)}
          >
            <option value="">Selecione um plantonista</option>
            {participantesConhecidos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </select>
        </label>
        <div className="contato-plantonista-linha">
          <label>
            Data inicial
            <input type="date" value={dataInicial} onChange={(evento) => setDataInicial(evento.target.value)} />
          </label>
          <label>
            Hora inicial
            <input type="time" value={horaInicial} onChange={(evento) => setHoraInicial(evento.target.value)} />
          </label>
        </div>
        <div className="contato-plantonista-linha">
          <label>
            Data final
            <input type="date" value={dataFinal} onChange={(evento) => setDataFinal(evento.target.value)} />
          </label>
          <label>
            Hora final
            <input type="time" value={horaFinal} onChange={(evento) => setHoraFinal(evento.target.value)} />
          </label>
        </div>
        <p className="admin-form-preview">
          Duração: {duracaoValida ? formatarMinutos(duracaoMinutos) : '—'}
          {atipica && ' · ⚠ duração atípica (nem 12h nem 24h) — confira antes de salvar.'}
        </p>
        {erros.length > 0 && <p className="admin-form-erro">{erros.join(' ')}</p>}
        <div className="rollback-actions">
          {modo === 'editar' && onExcluir !== undefined && (
            <button className="secondary-button danger-button rollback-actions-excluir" type="button" onClick={onExcluir}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" onClick={aoClicarSalvar}>Salvar</button>
        </div>
      </section>
    </div>
  );
}
