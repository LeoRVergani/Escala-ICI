import { calcularDuracaoEntreMomentos, formatarMinutos, ROTULO_FUNCAO_PLANTAO, type FuncaoPlantao, type MomentoPlantao } from '@escala-ici/contrato';
import { AlertTriangle, CalendarDays, Clock3, Info, Moon, PencilLine, Radio, SunMedium, Sunset, Trash2, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { duracaoPlantaoAtipica, validarAtribuicaoEditavel } from '@/lib/editorPlantao';
import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';

import {
  derivarPadroesHorarioPlantao,
  padraoHorarioCorrespondente,
  padraoHorarioParaValores,
  type PadraoHorarioPlantaoModal,
  type TomHorarioPlantao,
} from './horariosPlantao';

export interface FormularioAtribuicaoPlantao {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  /** FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 — posto desta atribuição. Ausente para Grupo de posto único (comportamento de sempre). */
  funcao?: FuncaoPlantao;
}

function IconeTom({ tom }: { tom: TomHorarioPlantao }) {
  if (tom === 'madrugada') return <SunMedium size={19} strokeWidth={1.8} />;
  if (tom === 'manha') return <SunriseIcon />;
  if (tom === 'tarde') return <Sunset size={19} strokeWidth={1.8} />;
  if (tom === 'noite') return <Moon size={19} strokeWidth={1.8} />;
  return <Clock3 size={19} strokeWidth={1.8} />;
}

function SunriseIcon() {
  return <SunMedium size={19} strokeWidth={1.8} />;
}

/**
 * Modal único para criar ou editar uma atribuição na working copy do Editor.
 * O formulário mantém os mesmos callbacks e a mesma validação de domínio;
 * apenas reorganiza a experiência em padrões à esquerda e detalhes à direita.
 */
export function ModalEditarAtribuicaoPlantao({
  titulo,
  valoresIniciais,
  modo,
  participantesConhecidos,
  padroesDisponiveis,
  funcoesDisponiveis,
  onFechar,
  onSalvar,
  onExcluir,
}: {
  titulo: string;
  valoresIniciais: FormularioAtribuicaoPlantao;
  modo: 'criar' | 'editar';
  participantesConhecidos: readonly string[];
  padroesDisponiveis?: readonly PadraoHorarioPlantaoModal[];
  /**
   * FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 — postos do Grupo em contexto
   * (`grupo.funcoesEsperadas`). Ausente/vazio = Grupo de posto único: o
   * campo "Posto" nem aparece (§5/§36 da fase). Nunca acoplado a CODB —
   * quem chama decide a lista, este componente só a exibe.
   */
  funcoesDisponiveis?: readonly FuncaoPlantao[];
  onFechar: () => void;
  onSalvar: (valores: FormularioAtribuicaoPlantao) => void;
  onExcluir?: () => void;
}) {
  const padroes = useMemo(
    () => padroesDisponiveis !== undefined && padroesDisponiveis.length > 0
      ? [...padroesDisponiveis]
      : derivarPadroesHorarioPlantao(undefined),
    [padroesDisponiveis],
  );
  const padraoInicial = useMemo(
    () => padraoHorarioCorrespondente(
      padroes,
      valoresIniciais.inicio.hora,
      valoresIniciais.fim.hora,
      valoresIniciais.inicio.data,
      valoresIniciais.fim.data,
    ) ?? (modo === 'criar' && valoresIniciais.inicio.hora === '' ? padroes[0] ?? null : null),
    [modo, padroes, valoresIniciais.fim.data, valoresIniciais.fim.hora, valoresIniciais.inicio.data, valoresIniciais.inicio.hora],
  );
  const valoresPresetInicial = padraoInicial === null || valoresIniciais.inicio.hora !== ''
    ? null
    : padraoHorarioParaValores(padraoInicial, valoresIniciais.inicio.data);
  const [plantonistaNomeOriginal, setPlantonistaNomeOriginal] = useState(valoresIniciais.plantonistaNomeOriginal);
  const [dataInicial, setDataInicial] = useState(valoresIniciais.inicio.data);
  const [horaInicial, setHoraInicial] = useState(valoresPresetInicial?.horaInicial ?? valoresIniciais.inicio.hora);
  const [dataFinal, setDataFinal] = useState(valoresPresetInicial?.dataFinal ?? valoresIniciais.fim.data);
  const [horaFinal, setHoraFinal] = useState(valoresPresetInicial?.horaFinal ?? valoresIniciais.fim.hora);
  const [padraoSelecionado, setPadraoSelecionado] = useState<string | null>(padraoInicial?.id ?? null);
  const [horarioForaDoPadrao, setHorarioForaDoPadrao] = useState(padraoInicial === null);
  const [funcao, setFuncao] = useState<FuncaoPlantao | ''>(valoresIniciais.funcao ?? '');
  const [erros, setErros] = useState<string[]>([]);
  useTeclaEsc(onFechar);

  const inicio: MomentoPlantao = { data: dataInicial, hora: horaInicial };
  const fim: MomentoPlantao = { data: dataFinal, hora: horaFinal };
  const duracaoMinutos = calcularDuracaoEntreMomentos(inicio, fim);
  const duracaoValida = duracaoMinutos !== null && duracaoMinutos > 0;
  const atipica = duracaoValida && duracaoPlantaoAtipica(duracaoMinutos);
  const padraoAtual = padroes.find((padrao) => padrao.id === padraoSelecionado) ?? null;
  const mostrarCampoPosto = funcoesDisponiveis !== undefined && funcoesDisponiveis.length > 0;
  /**
   * §8 da fase — confirmação simples (nunca `window.confirm()`, ver
   * `components/escalas/UnsavedChangesDialog.tsx`): um banner explica a
   * troca de posto ANTES de salvar, na mesma linguagem de "só nesta
   * ocorrência" (nunca "mover para equipe X" — não é equipe
   * organizacional). Só aparece editando uma atribuição que já tinha
   * posto e o usuário mudou para outro.
   */
  const trocandoPosto = modo === 'editar'
    && valoresIniciais.funcao !== undefined
    && funcao !== ''
    && funcao !== valoresIniciais.funcao;

  function aplicarPadrao(padrao: PadraoHorarioPlantaoModal) {
    const valores = padraoHorarioParaValores(padrao, dataInicial);
    setPadraoSelecionado(padrao.id);
    setHorarioForaDoPadrao(false);
    setHoraInicial(valores.horaInicial);
    setHoraFinal(valores.horaFinal);
    setDataFinal(valores.dataFinal);
    setErros([]);
  }

  function alterarDataInicial(valor: string) {
    setDataInicial(valor);
    if (padraoAtual !== null) {
      setDataFinal(padraoHorarioParaValores(padraoAtual, valor).dataFinal);
    }
  }

  function ativarHorarioForaDoPadrao() {
    setPadraoSelecionado(null);
    setHorarioForaDoPadrao(true);
    setErros([]);
  }

  function aoClicarSalvar() {
    const valores: FormularioAtribuicaoPlantao = {
      plantonistaNomeOriginal,
      inicio,
      fim,
      ...(funcao === '' ? {} : { funcao }),
    };
    const errosValidacao = validarAtribuicaoEditavel(valores, funcoesDisponiveis ?? []);
    if (errosValidacao.length > 0) {
      setErros(errosValidacao);
      return;
    }
    onSalvar(valores);
  }

  return (
    <div className="modal-backdrop plantao-d-modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal plantao-d-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-plantao-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title plantao-d-modal-titlebar">
          <div>
            <h2 id="editar-plantao-modal-title">{titulo}</h2>
            <p className="plantao-d-modal-caption">Escolha um padrão ou defina uma exceção operacional.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="plantao-d-modal-grid">
          <section className="plantao-d-modal-patterns" aria-labelledby="plantao-d-padroes-titulo">
            <div className="plantao-d-section-heading">
              <div>
                <h3 id="plantao-d-padroes-titulo">Padrões da escala</h3>
                <p>Selecione o horário mais usado pelo grupo.</p>
              </div>
            </div>
            <div className="plantao-d-pattern-list" role="radiogroup" aria-label="Padrões da escala">
              {padroes.map((padrao) => (
                <button
                  key={padrao.id}
                  className={`plantao-d-pattern-card${padraoSelecionado === padrao.id ? ' selected' : ''}`}
                  data-tom={padrao.tom}
                  type="button"
                  role="radio"
                  aria-checked={padraoSelecionado === padrao.id}
                  onClick={() => aplicarPadrao(padrao)}
                >
                  <span className="plantao-d-pattern-icon"><IconeTom tom={padrao.tom} /></span>
                  <span className="plantao-d-pattern-copy">
                    <strong>{padrao.titulo}</strong>
                    <small>{padrao.subtitulo}</small>
                  </span>
                  <span className="plantao-d-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="plantao-d-pattern-note"><Info size={15} /> Os padrões vêm do Grupo de Plantão.</p>
          </section>

          <section className="plantao-d-modal-details" aria-labelledby="plantao-d-detalhes-titulo">
            <div className="plantao-d-section-heading">
              <div>
                <h3 id="plantao-d-detalhes-titulo">Detalhes</h3>
                <p>Confirme quem estará de plantão e quando.</p>
              </div>
            </div>
            <label className="plantao-d-field">
              <span><UserRound size={14} /> Colaborador</span>
              <select
                value={plantonistaNomeOriginal}
                onChange={(evento) => setPlantonistaNomeOriginal(evento.target.value)}
              >
                <option value="">Selecione um plantonista</option>
                {participantesConhecidos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </label>
            {mostrarCampoPosto && (
              <label className="plantao-d-field">
                <span><Radio size={14} /> Posto</span>
                <select
                  value={funcao}
                  onChange={(evento) => setFuncao(evento.target.value as FuncaoPlantao | '')}
                >
                  <option value="">Selecione o posto</option>
                  {funcoesDisponiveis?.map((item) => (
                    <option key={item} value={item}>{ROTULO_FUNCAO_PLANTAO[item]}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="plantao-d-field">
              <span><CalendarDays size={14} /> Data</span>
              <input type="date" value={dataInicial} onChange={(evento) => alterarDataInicial(evento.target.value)} />
            </label>

            <div className="plantao-d-selected-preview" data-tom={padraoAtual?.tom ?? 'vinte-quatro-horas'}>
              <div className="plantao-d-selected-icon"><IconeTom tom={padraoAtual?.tom ?? 'vinte-quatro-horas'} /></div>
              <div>
                <span>Horário selecionado</span>
                <strong>{horaInicial || '--:--'} <i>→</i> {horaFinal || '--:--'}</strong>
                <small>{padraoAtual?.titulo ?? (duracaoValida ? 'Fora do padrão' : 'Informe início e fim')}</small>
              </div>
            </div>

            <button
              className={`plantao-d-custom-toggle${horarioForaDoPadrao ? ' active' : ''}`}
              type="button"
              onClick={ativarHorarioForaDoPadrao}
            >
              <PencilLine size={15} />
              <span>
                <strong>Definir horário fora do padrão</strong>
                <small>Use apenas quando a operação exigir uma exceção.</small>
              </span>
            </button>

            {horarioForaDoPadrao && (
              <div className="plantao-d-custom-fields">
                <label className="plantao-d-field">
                  <span>Data final</span>
                  <input type="date" value={dataFinal} onChange={(evento) => { setDataFinal(evento.target.value); setPadraoSelecionado(null); }} />
                </label>
                <div className="plantao-d-time-fields">
                  <label className="plantao-d-field">
                    <span>Hora inicial</span>
                    <input type="time" value={horaInicial} onChange={(evento) => { setHoraInicial(evento.target.value); setPadraoSelecionado(null); }} />
                  </label>
                  <label className="plantao-d-field">
                    <span>Hora final</span>
                    <input type="time" value={horaFinal} onChange={(evento) => { setHoraFinal(evento.target.value); setPadraoSelecionado(null); }} />
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="plantao-d-modal-summary">
          <CalendarDays size={15} />
          <span>{dataInicial || '—'}</span>
          <i>·</i>
          <span>{plantonistaNomeOriginal || 'Selecione o colaborador'}</span>
          <i>·</i>
          <strong>{duracaoValida ? `${horaInicial} → ${horaFinal}` : 'Horário pendente'}</strong>
        </div>

        {atipica && <p className="plantao-d-warning">⚠ Duração atípica de {formatarMinutos(duracaoMinutos ?? 0)} — confira antes de salvar.</p>}
        {trocandoPosto && valoresIniciais.funcao !== undefined && (
          <p className="plantao-d-warning">
            <AlertTriangle size={15} /> Alterar o posto desta atribuição de {ROTULO_FUNCAO_PLANTAO[valoresIniciais.funcao]} para {ROTULO_FUNCAO_PLANTAO[funcao]}?
            A pessoa será movida somente nesta ocorrência — o cadastro dela não muda.
          </p>
        )}
        {erros.length > 0 && <p className="admin-form-erro">{erros.join(' ')}</p>}

        <div className="rollback-actions plantao-d-modal-actions">
          {modo === 'editar' && onExcluir !== undefined && (
            <button className="secondary-button danger-button rollback-actions-excluir" type="button" onClick={onExcluir}>
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" onClick={aoClicarSalvar}>Salvar plantão</button>
        </div>
      </section>
    </div>
  );
}
