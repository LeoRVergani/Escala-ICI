import { formatarData } from '@escala-ici/contrato';
import { AlignLeft, CalendarDays, Clock, Plus, Repeat, Sun, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import {
  LIMITE_DESCRICAO_LEMBRETE,
  LIMITE_TITULO_LEMBRETE,
  normalizarHorarioLembrete,
  type EntradaLembrete,
  type EntradaSerieLembrete,
} from '@/lib/lembretes';
import {
  entradaLembreteDoFormulario,
  entradaSerieLembreteDoFormulario,
  validarFormularioLembrete,
  type FormularioLembrete,
  type ItemLembretePessoal,
} from '@/lib/lembretesUi';

interface LembreteFormModalProps {
  modo: 'criar' | 'editar';
  dataInicial: string;
  lembreteEmEdicao?: ItemLembretePessoal;
  onFechar: () => void;
  onSalvarUnico: (entrada: EntradaLembrete) => Promise<void>;
  onSalvarSerie: (entrada: EntradaSerieLembrete) => Promise<void>;
  onExcluir?: () => Promise<void>;
}

function formularioInicial(dataInicial: string, lembreteEmEdicao?: ItemLembretePessoal): FormularioLembrete {
  if (lembreteEmEdicao === undefined) {
    return { titulo: '', descricao: '', datas: [dataInicial], diaInteiro: false, horaInicio: '', horaFim: '' };
  }
  return {
    titulo: lembreteEmEdicao.titulo,
    descricao: lembreteEmEdicao.descricao ?? '',
    datas: [lembreteEmEdicao.data],
    diaInteiro: lembreteEmEdicao.horario.diaInteiro,
    horaInicio: lembreteEmEdicao.horario.horaInicio ?? '',
    horaFim: lembreteEmEdicao.horario.horaFim ?? '',
  };
}

export function LembreteFormModal({
  modo,
  dataInicial,
  lembreteEmEdicao,
  onFechar,
  onSalvarUnico,
  onSalvarSerie,
  onExcluir,
}: LembreteFormModalProps) {
  const [form, setForm] = useState<FormularioLembrete>(() => formularioInicial(dataInicial, lembreteEmEdicao));
  const [novaData, setNovaData] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');
  /** LEMBRETE-MODAL-2 — campos pouco usados ficam recolhidos até a pessoa abrir. */
  const [mostrarDescricao, setMostrarDescricao] = useState(() => (lembreteEmEdicao?.descricao ?? '') !== '');
  const [mostrarRepetir, setMostrarRepetir] = useState(false);

  const viraDia = !form.diaInteiro
    && normalizarHorarioLembrete({ diaInteiro: false, horaInicio: form.horaInicio || null, horaFim: form.horaFim || null }).viraDia;

  function adicionarData() {
    if (novaData.trim() === '' || form.datas.includes(novaData)) {
      return;
    }
    setForm((atual) => ({ ...atual, datas: [...atual.datas, novaData] }));
    setNovaData('');
  }

  function removerData(data: string) {
    setForm((atual) => ({ ...atual, datas: atual.datas.filter((item) => item !== data) }));
  }

  async function salvar() {
    const errosValidacao = validarFormularioLembrete(form);
    if (errosValidacao.length > 0) {
      setErros(errosValidacao);
      return;
    }
    setErros([]);
    setSalvando(true);
    try {
      if (form.datas.length <= 1) {
        await onSalvarUnico(entradaLembreteDoFormulario(form));
      } else {
        await onSalvarSerie(entradaSerieLembreteDoFormulario(form));
      }
      onFechar();
    } catch (falha) {
      setErros([falha instanceof Error ? falha.message : 'Não foi possível salvar o lembrete.']);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!onExcluir) {
      return;
    }
    setExcluindo(true);
    setErroExclusao('');
    try {
      await onExcluir();
      onFechar();
    } catch (falha) {
      setErroExclusao(falha instanceof Error ? falha.message : 'Não foi possível excluir o lembrete.');
    } finally {
      setExcluindo(false);
    }
  }

  if (confirmandoExclusao) {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={() => !excluindo && setConfirmandoExclusao(false)}>
        <section
          className="edit-modal lembrete-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lembrete-excluir-title"
          onMouseDown={(evento) => evento.stopPropagation()}
        >
          <div className="panel-title">
            <div>
              <h2 id="lembrete-excluir-title">Excluir lembrete?</h2>
              <p>“{form.titulo}” será removido definitivamente.</p>
            </div>
            <button className="icon-button" type="button" onClick={() => setConfirmandoExclusao(false)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          {erroExclusao && <div className="alert error" role="alert">{erroExclusao}</div>}
          <div className="rollback-actions">
            <button className="secondary-button" type="button" disabled={excluindo} onClick={() => setConfirmandoExclusao(false)}>
              Cancelar
            </button>
            <button className="primary-button danger-button" type="button" disabled={excluindo} onClick={() => void confirmarExclusao()}>
              <Trash2 size={15} /> {excluindo ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal lembrete-modal lembrete-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lembrete-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        {/* LEMBRETE-MODAL-2 — cabeçalho e botões fixos; só o meio rola. */}
        <header className="lembrete-form-cabecalho">
          <h2 id="lembrete-modal-title">{modo === 'criar' ? 'Novo lembrete' : 'Editar lembrete'}</h2>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="lembrete-form-corpo">
          {lembreteEmEdicao?.serieId && <p className="lembrete-serie-nota">Parte de uma série</p>}

          <input
            id="lembrete-titulo"
            className="lembrete-form-titulo"
            aria-label="Título do lembrete"
            autoFocus
            maxLength={LIMITE_TITULO_LEMBRETE}
            placeholder="O que você quer lembrar?"
            value={form.titulo}
            onChange={(evento) => setForm((atual) => ({ ...atual, titulo: evento.target.value }))}
          />

          <section className="lembrete-form-bloco" aria-label="Quando">
            <label className="lembrete-form-linha" htmlFor="lembrete-data">
              <CalendarDays size={17} aria-hidden="true" />
              <span>Data</span>
              <input
                id="lembrete-data"
                type="date"
                value={form.datas[0] ?? ''}
                onChange={(evento) => setForm((atual) => ({ ...atual, datas: [evento.target.value, ...atual.datas.slice(1)] }))}
              />
            </label>

            <div className="lembrete-form-segmento" role="radiogroup" aria-label="Horário">
              <button type="button" role="radio" aria-checked={!form.diaInteiro} className={!form.diaInteiro ? 'active' : ''}
                onClick={() => setForm((atual) => ({ ...atual, diaInteiro: false }))}>
                <Clock size={15} aria-hidden="true" /> Em um horário
              </button>
              <button type="button" role="radio" aria-checked={form.diaInteiro} className={form.diaInteiro ? 'active' : ''}
                onClick={() => setForm((atual) => ({ ...atual, diaInteiro: true }))}>
                <Sun size={15} aria-hidden="true" /> Dia inteiro
              </button>
            </div>

            {!form.diaInteiro && (
              <div className="lembrete-form-horas">
                <label htmlFor="lembrete-hora-inicio">
                  <span>Das</span>
                  <input
                    id="lembrete-hora-inicio"
                    type="time"
                    value={form.horaInicio}
                    onChange={(evento) => setForm((atual) => ({ ...atual, horaInicio: evento.target.value }))}
                  />
                </label>
                <label htmlFor="lembrete-hora-fim">
                  <span>até <small>(opcional)</small></span>
                  <input
                    id="lembrete-hora-fim"
                    type="time"
                    value={form.horaFim}
                    onChange={(evento) => setForm((atual) => ({ ...atual, horaFim: evento.target.value }))}
                  />
                </label>
              </div>
            )}
            {viraDia && <p className="lembrete-vira-dia-aviso">Termina no dia seguinte</p>}
          </section>

          {mostrarDescricao ? (
            <label className="lembrete-form-bloco lembrete-form-descricao" htmlFor="lembrete-descricao">
              <span><AlignLeft size={15} aria-hidden="true" /> Descrição</span>
              <textarea
                id="lembrete-descricao"
                autoFocus={form.descricao === ''}
                maxLength={LIMITE_DESCRICAO_LEMBRETE}
                placeholder="Detalhes do compromisso"
                value={form.descricao}
                onChange={(evento) => setForm((atual) => ({ ...atual, descricao: evento.target.value }))}
              />
            </label>
          ) : (
            <button type="button" className="lembrete-form-abrir" onClick={() => setMostrarDescricao(true)}>
              <AlignLeft size={16} aria-hidden="true" /> Adicionar descrição
            </button>
          )}

          {modo === 'criar' && (mostrarRepetir || form.datas.length > 1 ? (
            <section className="lembrete-form-bloco lembrete-datas-adicionais" aria-label="Repetir em outras datas">
              <span className="lembrete-form-rotulo"><Repeat size={15} aria-hidden="true" /> Repetir em outras datas</span>
              {form.datas.length > 1 && (
                <div className="lembrete-form-chips">
                  {form.datas.slice(1).map((data) => (
                    <span className="alias-chip" key={data}>
                      {formatarData(data, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      <button type="button" onClick={() => removerData(data)} aria-label={`Remover data ${data}`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="lembrete-form-adicionar-data">
                <input type="date" value={novaData} onChange={(evento) => setNovaData(evento.target.value)} aria-label="Outra data" />
                <button type="button" className="secondary-button" onClick={adicionarData} disabled={novaData === ''}>
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </section>
          ) : (
            <button type="button" className="lembrete-form-abrir" onClick={() => setMostrarRepetir(true)}>
              <Repeat size={16} aria-hidden="true" /> Repetir em outras datas
            </button>
          ))}

          {erros.length > 0 && (
            <div className="alert error" role="alert">
              {erros.map((erro) => <p key={erro}>{erro}</p>)}
            </div>
          )}
        </div>

        <footer className="lembrete-form-rodape">
          {modo === 'editar' && onExcluir && (
            <button
              className="secondary-button danger-button lembrete-form-excluir"
              type="button"
              disabled={salvando}
              onClick={() => setConfirmandoExclusao(true)}
            >
              <Trash2 size={15} /> Excluir
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="primary-button" type="button" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </section>
    </div>
  );
}
