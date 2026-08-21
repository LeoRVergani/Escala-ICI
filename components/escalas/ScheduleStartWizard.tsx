import { CalendarDays, CheckCircle2, ChevronDown, FileSpreadsheet, LoaderCircle, Pencil, Plus, Radio, RotateCcw, UploadCloud, X } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, UnidadeOrganizacional } from '@/lib/modelos';
import { formatarData } from '@escala-ici/contrato';
import { periodoDaCompetencia } from '@/lib/montagemRascunhoPlantao';
import { sugerirNomeGrupoPlantao } from '@/lib/gruposPlantaoProvisionamento';

type ModoInicioEscala = 'NOVA' | 'IMPORTAR';
type TipoInicioEscala = 'JORNADA' | 'PLANTAO';

export interface ScheduleStartWizardProps {
  modo: ModoInicioEscala;
  tipo: TipoInicioEscala | null;
  onFechar: () => void;
  onEscolherTipo: (tipo: TipoInicioEscala | null) => void;
  areas: UnidadeOrganizacional[];
  areaId: string;
  onMudarArea: (areaId: string) => void;
  equipes: Equipe[];
  equipeId: string;
  onMudarEquipe: (equipeId: string) => void;
  grupos: GrupoPlantao[];
  grupoId: string;
  onMudarGrupo: (grupoId: string) => void;
  competencia: string;
  onMudarCompetencia: (competencia: string) => void;
  arquivoNome: string;
  onSelecionarArquivo: (arquivo: File) => void;
  onContinuar: () => void;
  onAbrirRascunhoExistente?: () => void | Promise<void>;
  rascunhoExistente?: boolean;
  onCriarEquipe: (nome: string, sigla: string) => void | Promise<void>;
  onCriarGrupo: (nome: string, equipeId: string) => void | Promise<void>;
  onUsarPeriodoAnterior?: () => void | Promise<void>;
  periodoAnteriorDisponivel?: boolean;
  erro: string;
  processando: boolean;
}

export function ScheduleStartWizard({
  modo,
  tipo,
  onFechar,
  onEscolherTipo,
  areas,
  areaId,
  onMudarArea,
  equipes,
  equipeId,
  onMudarEquipe,
  grupos,
  grupoId,
  onMudarGrupo,
  competencia,
  onMudarCompetencia,
  arquivoNome,
  onSelecionarArquivo,
  onContinuar,
  onAbrirRascunhoExistente,
  rascunhoExistente = false,
  onCriarEquipe,
  onCriarGrupo,
  onUsarPeriodoAnterior,
  periodoAnteriorDisponivel = false,
  erro,
  processando,
}: ScheduleStartWizardProps) {
  const [criacaoEquipeAberta, setCriacaoEquipeAberta] = useState(false);
  const [criacaoGrupoAberta, setCriacaoGrupoAberta] = useState(false);
  const [nomeEquipe, setNomeEquipe] = useState('');
  const [siglaEquipe, setSiglaEquipe] = useState('');
  const [nomeGrupo, setNomeGrupo] = useState('');
  const periodo = useMemo(
    () => /^\d{4}-\d{2}$/u.test(competencia.trim()) ? periodoDaCompetencia(competencia.trim()) : null,
    [competencia],
  );
  const destinoSelecionado = tipo === 'PLANTAO' ? grupoId !== '' : equipeId !== '';
  const podeContinuar = destinoSelecionado && periodo !== null && !processando;
  const mostrarSeletorArea = areas.length > 1;
  const areaResolvida = areas.length === 1 ? areas[0] : areas.find((area) => area.unidadeId === areaId);
  const titulo = modo === 'NOVA' ? 'Nova escala' : 'Importar escala';
  const equipeSelecionada = equipes.find((equipe) => equipe.id === equipeId);
  const grupoSelecionado = grupos.find((grupo) => grupo.grupoId === grupoId);
  const rotuloOperacao = tipo === 'JORNADA'
    ? equipeSelecionada?.nome ?? 'Jornada 6x1'
    : grupoSelecionado?.nome ?? 'Plantão';
  const descricaoOperacao = tipo === 'JORNADA'
    ? 'Escala regular da equipe, com turnos, folgas e alertas.'
    : 'Cobertura por intervalos, participantes e competência.';

  function escolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (arquivo !== undefined) {
      onSelecionarArquivo(arquivo);
    }
    evento.target.value = '';
  }

  async function criarEquipe() {
    if (nomeEquipe.trim() === '' || siglaEquipe.trim() === '') return;
    await onCriarEquipe(nomeEquipe.trim(), siglaEquipe.trim());
    setNomeEquipe('');
    setSiglaEquipe('');
    setCriacaoEquipeAberta(false);
  }

  async function criarGrupo() {
    if (nomeGrupo.trim() === '' || equipeId === '') return;
    await onCriarGrupo(nomeGrupo.trim(), equipeId);
    setNomeGrupo('');
    setCriacaoGrupoAberta(false);
  }

  function selecionarEquipeResponsavelPlantao(novoEquipeId: string) {
    onMudarEquipe(novoEquipeId);
    const equipe = equipes.find((item) => item.id === novoEquipeId);
    setNomeGrupo(sugerirNomeGrupoPlantao(equipe));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal schedule-start-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-start-wizard-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">{modo === 'NOVA' ? 'Criar' : 'Preencher'}</p>
            <h2 id="schedule-start-wizard-title">{titulo}</h2>
            <p>{modo === 'NOVA'
              ? tipo === 'JORNADA'
                ? 'Carregue os colaboradores no período padrão cadastrado e ajuste dias, folgas e horários no editor.'
                : 'Comece uma escala de Plantão vazia e monte os intervalos no editor.'
              : 'Envie sua planilha, revise os dados e abra o editor quando estiver pronta.'}</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {tipo === null ? (
          <div className="nova-escala-tipos">
            <button type="button" className="nova-escala-tipo-card" onClick={() => onEscolherTipo('JORNADA')}>
              <CalendarDays size={22} />
              <strong>Jornada 6x1</strong>
              <span>Escala regular da equipe, com turnos, folgas, férias e alertas.</span>
            </button>
            <button type="button" className="nova-escala-tipo-card" onClick={() => onEscolherTipo('PLANTAO')}>
              <Radio size={22} />
              <strong>Plantão</strong>
              <span>Cobertura por intervalos, participantes e competência.</span>
            </button>
          </div>
        ) : (
            <div className="schedule-start-flow">
              <div className="wizard-type-summary">
                <span className={`wizard-type-summary-icon ${tipo === 'PLANTAO' ? 'plantao' : ''}`}>
                  {tipo === 'JORNADA' ? <CalendarDays size={18} /> : <Radio size={18} />}
                </span>
                <div className="wizard-type-summary-copy">
                  <strong>{modo === 'NOVA' ? 'Criar nova escala' : 'Importar escala'}</strong>
                  <span>{rotuloOperacao} · {descricaoOperacao}</span>
                </div>
                <span className={`wizard-readiness ${podeContinuar ? 'ready' : ''}`}>
                  <CheckCircle2 size={14} /> {podeContinuar ? 'Destino pronto' : 'Defina o destino'}
                </span>
                <button type="button" className="secondary-button compact-button wizard-change-button" onClick={() => onEscolherTipo(null)}>
                  <Pencil size={14} /> Alterar
                </button>
              </div>

            <div className="wizard-context-grid">
              <div className="wizard-field-block">
                <span className="wizard-field-label">Área de gestão</span>
                {mostrarSeletorArea ? (
                  <label className="select-with-icon" htmlFor="schedule-start-area">
                    <select id="schedule-start-area" value={areaId} onChange={(evento) => onMudarArea(evento.target.value)}>
                      <option value="">Selecione a área</option>
                      {areas.map((area) => <option key={area.unidadeId} value={area.unidadeId}>{area.nome}</option>)}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </label>
                ) : areaResolvida !== undefined ? (
                  <div className="wizard-resolved-field"><CheckCircle2 size={16} />{areaResolvida.nome}<small>resolvida automaticamente</small></div>
                ) : (
                  <div className="wizard-empty-field">Área não cadastrada na hierarquia; o destino único define o contexto.</div>
                )}
              </div>

              {tipo === 'JORNADA' ? (
                <div className="wizard-field-block">
                  <span className="wizard-field-label">Equipe</span>
                  {equipes.length > 1 ? (
                    <label className="select-with-icon" htmlFor="schedule-start-equipe">
                      <select id="schedule-start-equipe" value={equipeId} onChange={(evento) => onMudarEquipe(evento.target.value)}>
                        <option value="">Selecione a equipe</option>
                        {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" />
                    </label>
                  ) : equipes.length === 1 ? (
                    <div className="wizard-resolved-field"><CheckCircle2 size={16} />{equipes[0].nome}<small>resolvida automaticamente</small></div>
                  ) : (
                    <div className="wizard-inline-create">
                      <p>Nenhuma equipe compatível nesta área.</p>
                      {!criacaoEquipeAberta ? (
                        <button className="secondary-button compact-button" type="button" onClick={() => setCriacaoEquipeAberta(true)}><Plus size={15} /> Criar equipe</button>
                      ) : (
                        <div className="wizard-inline-fields">
                          <label htmlFor="wizard-equipe-nome">Nome<input id="wizard-equipe-nome" value={nomeEquipe} onChange={(evento) => setNomeEquipe(evento.target.value)} /></label>
                          <label htmlFor="wizard-equipe-sigla">Sigla<input id="wizard-equipe-sigla" value={siglaEquipe} onChange={(evento) => setSiglaEquipe(evento.target.value)} /></label>
                          <button className="primary-button compact-button" type="button" disabled={processando || nomeEquipe.trim() === '' || siglaEquipe.trim() === ''} onClick={() => void criarEquipe()}>{processando ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Criar equipe</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="wizard-field-block">
                  <span className="wizard-field-label">Grupo de Plantão</span>
                  {grupos.length > 1 ? (
                    <label className="select-with-icon" htmlFor="schedule-start-grupo">
                      <select id="schedule-start-grupo" value={grupoId} onChange={(evento) => onMudarGrupo(evento.target.value)}>
                        <option value="">Selecione o grupo de Plantão</option>
                        {grupos.map((grupo) => <option key={grupo.grupoId} value={grupo.grupoId}>{grupo.nome}</option>)}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" />
                    </label>
                  ) : grupos.length === 1 ? (
                    <div className="wizard-resolved-field"><CheckCircle2 size={16} />{grupos[0].nome}<small>resolvido automaticamente</small></div>
                  ) : (
                    <div className="wizard-inline-create">
                      {equipes.length === 0 ? (
                        <div className="wizard-inline-create nested">
                          <p>Nenhum Grupo de Plantão administrável nesta área.</p>
                          <p className="admin-form-preview">Nenhuma equipe responsável disponível nesta área.</p>
                          {!criacaoEquipeAberta ? (
                            <button className="secondary-button compact-button" type="button" onClick={() => setCriacaoEquipeAberta(true)}><Plus size={15} /> Criar equipe responsável</button>
                          ) : (
                            <div className="wizard-inline-fields">
                              <label htmlFor="wizard-plantao-equipe-nome">Nome da equipe<input id="wizard-plantao-equipe-nome" value={nomeEquipe} onChange={(evento) => setNomeEquipe(evento.target.value)} /></label>
                              <label htmlFor="wizard-plantao-equipe-sigla">Sigla<input id="wizard-plantao-equipe-sigla" value={siglaEquipe} onChange={(evento) => setSiglaEquipe(evento.target.value)} /></label>
                              <button className="primary-button compact-button" type="button" disabled={processando || nomeEquipe.trim() === '' || siglaEquipe.trim() === ''} onClick={() => void criarEquipe()}>{processando ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Criar equipe</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/*
                           * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — mensagem
                           * específica (não genérica) quando já existe ao
                           * menos uma equipe administrável nesta área, mas
                           * nenhum GrupoPlantao vinculado a ela ainda —
                           * diagnóstico explícito, nunca "erro" silencioso;
                           * o próprio fluxo abaixo já cria o Grupo oficial,
                           * sem depender do Console do Firestore.
                           */}
                          <p>Existe equipe de Plantão nesta área, mas ainda não há Grupo de Plantão vinculado. Crie o grupo para importar ou montar a escala.</p>
                        </>
                      )}
                      {equipes.length === 0 ? null : !criacaoGrupoAberta ? (
                        <button
                          className="secondary-button compact-button"
                          type="button"
                          onClick={() => {
                            /**
                             * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — nunca
                             * deixa "Nome" vazio quando já existe uma equipe
                             * responsável resolvida (uma única candidata, ou
                             * já escolhida no `<select>`) — sugere o nome da
                             * própria equipe, de forma editável. Quando a
                             * equipe precisa de escolha explícita, o nome só
                             * é sugerido depois dessa escolha.
                             */
                            setNomeGrupo(sugerirNomeGrupoPlantao(equipeSelecionada));
                            setCriacaoGrupoAberta(true);
                          }}
                        ><Plus size={15} /> Criar Plantão</button>
                      ) : (
                        <div className="wizard-inline-fields">
                          <label htmlFor="wizard-grupo-nome">Nome<input id="wizard-grupo-nome" value={nomeGrupo} onChange={(evento) => setNomeGrupo(evento.target.value)} /></label>
                          {equipes.length > 1 || equipeId === '' ? <label htmlFor="wizard-grupo-equipe">Equipe responsável<select id="wizard-grupo-equipe" value={equipeId} onChange={(evento) => selecionarEquipeResponsavelPlantao(evento.target.value)}><option value="">Selecione a equipe responsável</option>{equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome} / {equipe.id}</option>)}</select></label> : <div className="wizard-resolved-field"><CheckCircle2 size={16} />{equipes[0].nome} / {equipes[0].id}<small>responsável resolvida automaticamente</small></div>}
                          <button className="primary-button compact-button" type="button" disabled={processando || nomeGrupo.trim() === '' || equipeId === ''} onClick={() => void criarGrupo()}>{processando ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Criar Plantão</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="wizard-field-block wizard-competence-block">
              <span className="wizard-field-label">Competência</span>
              <label htmlFor="schedule-start-competencia"><input id="schedule-start-competencia" type="month" value={competencia} onChange={(evento) => onMudarCompetencia(evento.target.value)} /></label>
              {periodo !== null && <p className="admin-form-preview">{formatarData(periodo.periodoInicio, { day: '2-digit', month: '2-digit', year: 'numeric' })} → {formatarData(periodo.periodoFim, { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>}
            </div>

            {rascunhoExistente && onAbrirRascunhoExistente && (
              <div className="warning-panel-inline">
                <span className="status-badge warning">Já existe um rascunho para este destino e competência.</span>
                <button className="secondary-button compact-button" type="button" disabled={processando} onClick={() => void onAbrirRascunhoExistente()}>Abrir rascunho existente</button>
              </div>
            )}

            {modo === 'IMPORTAR' && podeContinuar && (
              <div className="wizard-upload-block">
                <span className="wizard-field-label">Arquivo</span>
                <label className="wizard-dropzone" htmlFor="schedule-start-file">
                  <UploadCloud size={22} />
                  <strong>{arquivoNome || 'Selecionar planilha'}</strong>
                  <span>{arquivoNome ? 'Arquivo selecionado. O sistema validará o tipo escolhido.' : 'XLS ou XLSX · o upload só acontece depois do tipo, destino e competência.'}</span>
                  <input id="schedule-start-file" type="file" accept=".xls,.xlsx" onChange={escolherArquivo} />
                </label>
              </div>
            )}

            {erro !== '' && <p className="admin-form-erro" role="alert">{erro}</p>}

            <div className="wizard-actions">
              <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
              {modo === 'NOVA' && tipo === 'PLANTAO' && onUsarPeriodoAnterior && (
                <button className="secondary-button" type="button" disabled={!podeContinuar || !periodoAnteriorDisponivel || processando} onClick={() => void onUsarPeriodoAnterior()}><RotateCcw size={16} /> Usar período anterior</button>
              )}
              {modo === 'NOVA' && rascunhoExistente && onAbrirRascunhoExistente ? null : (
                <button className="primary-button" type="button" disabled={!podeContinuar || (modo === 'IMPORTAR' && arquivoNome === '')} onClick={onContinuar}>
                  {processando ? <LoaderCircle className="spin" size={16} /> : modo === 'IMPORTAR' ? <FileSpreadsheet size={16} /> : <CheckCircle2 size={16} />}
                  {modo === 'IMPORTAR' ? 'Continuar para revisão' : 'Abrir editor'}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
