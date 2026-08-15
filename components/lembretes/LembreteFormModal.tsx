import { formatarData } from '@escala-ici/contrato';
import { Plus, Trash2, X } from 'lucide-react';
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
        className="edit-modal lembrete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lembrete-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="lembrete-modal-title">{modo === 'criar' ? 'Novo lembrete' : 'Editar lembrete'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {lembreteEmEdicao?.serieId && <p className="lembrete-serie-nota">Parte de uma série</p>}

        <div className="admin-form-grid">
          <label className="admin-form-full" htmlFor="lembrete-titulo">
            Título
            <input
              id="lembrete-titulo"
              autoFocus
              maxLength={LIMITE_TITULO_LEMBRETE}
              placeholder="Ex.: Estudar para a certificação"
              value={form.titulo}
              onChange={(evento) => setForm((atual) => ({ ...atual, titulo: evento.target.value }))}
            />
          </label>

          <label htmlFor="lembrete-data">
            Data
            <input
              id="lembrete-data"
              type="date"
              value={form.datas[0] ?? ''}
              onChange={(evento) => setForm((atual) => ({ ...atual, datas: [evento.target.value, ...atual.datas.slice(1)] }))}
            />
          </label>

          <label className="checkbox-row" htmlFor="lembrete-dia-inteiro">
            <input
              id="lembrete-dia-inteiro"
              type="checkbox"
              checked={form.diaInteiro}
              onChange={(evento) => setForm((atual) => ({ ...atual, diaInteiro: evento.target.checked }))}
            />
            <span>Dia inteiro</span>
          </label>

          {!form.diaInteiro && (
            <>
              <label htmlFor="lembrete-hora-inicio">
                Hora inicial
                <input
                  id="lembrete-hora-inicio"
                  type="time"
                  value={form.horaInicio}
                  onChange={(evento) => setForm((atual) => ({ ...atual, horaInicio: evento.target.value }))}
                />
              </label>
              <label htmlFor="lembrete-hora-fim">
                Hora final (opcional)
                <input
                  id="lembrete-hora-fim"
                  type="time"
                  value={form.horaFim}
                  onChange={(evento) => setForm((atual) => ({ ...atual, horaFim: evento.target.value }))}
                />
              </label>
            </>
          )}

          {viraDia && <p className="admin-form-full lembrete-vira-dia-aviso">Termina no dia seguinte</p>}

          <label className="admin-form-full" htmlFor="lembrete-descricao">
            Descrição (opcional)
            <textarea
              id="lembrete-descricao"
              maxLength={LIMITE_DESCRICAO_LEMBRETE}
              placeholder="Detalhes do compromisso"
              value={form.descricao}
              onChange={(evento) => setForm((atual) => ({ ...atual, descricao: evento.target.value }))}
            />
          </label>

          {modo === 'criar' && (
            <div className="admin-form-full lembrete-datas-adicionais">
              <span>Datas adicionais</span>
              <div className="alias-editor-list">
                {form.datas.slice(1).length === 0 && (
                  <small className="empty-inline">Nenhuma data adicional.</small>
                )}
                {form.datas.slice(1).map((data) => (
                  <span className="alias-chip" key={data}>
                    {formatarData(data, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    <button type="button" onClick={() => removerData(data)} aria-label={`Remover data ${data}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="alias-editor-add">
                <input
                  type="date"
                  value={novaData}
                  onChange={(evento) => setNovaData(evento.target.value)}
                  aria-label="Nova data"
                />
                <button type="button" className="secondary-button" onClick={adicionarData}>
                  <Plus size={14} /> Adicionar outra data
                </button>
              </div>
            </div>
          )}
        </div>

        {erros.length > 0 && (
          <div className="alert error" role="alert">
            {erros.map((erro) => <p key={erro}>{erro}</p>)}
          </div>
        )}

        <div className="rollback-actions">
          {modo === 'editar' && onExcluir && (
            <button
              className="secondary-button danger-button"
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
        </div>
      </section>
    </div>
  );
}
