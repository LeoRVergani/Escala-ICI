'use client';

import {
  CATALOGO_SOC,
  calcularTotais,
  conferirContabilidadePlantao,
  dataIsoLocal,
  equipesConsultaEfetivas,
  formatarCompetencia,
  formatarData,
  formatarMinutos,
  idCompetenciaPlantao,
  MAXIMO_CONTATOS_PLANTONISTA,
  normalizarContatosPlantonista,
  obterPadraoHorarioGrupoParaData,
  ordenarPadraoHorarioSemanal,
  parsePlanilhaEscala,
  validarContatosPlantonista,
  validarGrupoPlantao,
  type CompetenciaPlantao,
  type ConferenciaContabilPlantao,
  type ContatoPlantonista,
  type Dia,
  type DivergenciaPlantao,
  type ErroImportacao,
  type ErroImportacaoPlantao,
  type GrupoPlantao,
  type OrigemPlantao,
  type PadraoHorarioPlantaoDia,
  type ParticipantePlantao,
  type ResultadoParse,
  type ResultadoParsePlantao,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  Link2,
  LoaderCircle,
  Pencil,
  Phone,
  Plus,
  Power,
  Radio,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ChangeEvent, DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { AppFrame, type ItemNavegacao } from '@/components/AppFrame';
import { LoginPanel } from '@/components/LoginPanel';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { ScheduleImportReview } from '@/components/ScheduleImportReview';
import { ScheduleLegend } from '@/components/ScheduleLegend';
import {
  conciliarPlanilha,
  contarPendenciasConciliacao,
  ignorarLinha,
  loginParaUidComConciliacao,
  marcarPendente,
  publicacaoBloqueadaPorConciliacao,
  resolverManualmente,
} from '@/lib/conciliacaoUsuarios';
import {
  aplicarVinculosNasAtribuicoes,
  buscarUsuariosPlantao,
  confirmarVinculoPlantao,
  consolidarParticipantesGrupoPlantao,
  consolidarParticipantesPlantao,
  contarPendenciasVinculoPlantao,
  desfazerVinculoPlantao,
  iniciarVinculosPlantao,
  nomeParticipantePlantao,
  previaPlantaoValidavel,
  vinculosDeCopiaAnterior,
  vinculosDeParticipantesGrupoPlantao,
  type AtribuicaoPlantaoComVinculo,
  type ParticipanteConsolidadoPlantao,
  type StatusVinculoPlantao,
  type VinculoPlantao,
} from '@/lib/conciliacaoPlantoes';
import { processarArquivoImportado } from '@/lib/importadorPlanilha';
import {
  calcularCicloInicialJornada6x1,
  mensagemCicloInicialJornada6x1,
} from '@/lib/cicloJornada6x1';
import {
  EQUIPE_DEMO,
  EQUIPE_PLANTAO_DEMO,
  GRUPO_PLANTAO_DEMO,
  PARTICIPANTES_PLANTAO_DEMO,
  UNIDADE_COSI_DEMO,
  USUARIOS_DEMO,
  carregarEscalaDemonstracao,
} from '@/lib/demo';
import {
  carregarEscalasEquipe,
  carregarEstadoPublicacao,
  carregarRascunhosEquipe,
  listarHistoricoPublicacoes,
  listarEventosPublicacao,
  listarCatalogo,
  listarUsuarios,
} from '@/lib/firebase/readRepository';
import {
  adicionarMembroRascunho,
  atualizarAliasesPlanilha,
  escritaAdministrativaHabilitada,
  excluirRascunho,
  publicarEscalas,
  reverterPublicacao,
  salvarRascunho,
  salvarUsuario,
  salvarUsuarios,
} from '@/lib/firebase/writeRepository';
import {
  gestorAprovarEPublicarTroca,
  gestorRecusarTroca,
  observarTrocasDoGestor,
} from '@/lib/firebase/trocasRepository';
import { sair } from '@/lib/firebase/authRepository';
import { mensagemErroFirebase } from '@/lib/firebase/errors';
import { ambienteFirebaseAtual } from '@/lib/firebase/shared';
import {
  listarAtribuicoesPlantaoRascunho,
  listarCompetenciasPlantaoRascunho,
  listarGruposPlantaoPermitidos,
  listarGruposPlantaoPorUnidadeResponsavel,
  listarParticipantesPlantao,
  listarTodosGruposPlantao,
  obterCompetenciaPlantaoRascunho,
} from '@/lib/firebase/plantaoReadRepository';
import {
  atualizarEquipeConsultaPlantao,
  desativarParticipantePlantao,
  salvarAtribuicoesPlantaoRascunho,
  salvarCompetenciaPlantaoRascunho,
  salvarGrupoPlantao,
  salvarParticipantePlantao,
} from '@/lib/firebase/plantaoWriteRepository';
import {
  competenciaAnterior,
  copiarAtribuicoesParaNovaCompetencia,
  dataPertenceCompetencia,
  montarAtribuicoesPlantaoRascunho,
  montarCompetenciaPlantaoRascunho,
  montarParticipantesPlantaoParaSalvar,
  periodoDaCompetencia,
  reidratarRascunhoPlantao,
  sugerirCompetenciaPlantao,
  validarNovoPlantaoEmBranco,
} from '@/lib/montagemRascunhoPlantao';
import {
  adicionarAtribuicaoEditavel,
  conferirEscalaAtualPlantao,
  construirAtribuicaoDoPadraoHorario,
  criarAtribuicoesEditaveis,
  duracaoPlantaoAtipica,
  editarAtribuicaoEditavel,
  excluirAtribuicaoEditavel,
  resumirPorPessoa,
  type AtribuicaoPlantaoEditavel,
} from '@/lib/editorPlantao';
import { PlantaoCalendario } from '@/components/plantao/PlantaoCalendario';
import { PlantaoRoster } from '@/components/plantao/PlantaoRoster';
import { QuickAddPlantaoPopover } from '@/components/plantao/QuickAddPlantaoPopover';
import {
  ModalEditarAtribuicaoPlantao,
  type FormularioAtribuicaoPlantao,
} from '@/components/plantao/ModalEditarAtribuicaoPlantao';
import { PadraoHorarioSemanalCampo } from '@/components/plantao/PadraoHorarioSemanalCampo';
import { derivarPadroesHorarioPlantao } from '@/components/plantao/horariosPlantao';
import {
  excluirEscalaPublicada,
  excluirUsuario,
  listarEquipes,
  listarSetores,
  listarTodosUsuarios,
  listarUnidadesOrganizacionais,
  salvarEquipe,
  salvarSetor,
  salvarUnidadeOrganizacional,
  type OpcoesExclusaoUsuario,
} from '@/lib/firebase/adminRepository';
import { registrarAuditoriaAdmin } from '@/lib/firebase/auditoriaRepository';
/**
 * Só operações administrativas de `lembretesAtribuidos` — o Dashboard NUNCA
 * importa `criarLembretePessoal`/`listarLembretesPessoais`/
 * `observarLembretesPessoais`/`atualizarLembretePessoal`/
 * `excluirLembretePessoal` (privacidade: ver `tests/boundaries` e
 * docs/spec/LEMBRETES.md).
 */
import {
  atualizarLembreteAtribuido,
  cancelarLembreteAtribuido,
  criarLembreteAtribuido,
  criarSerieLembretesAtribuidos,
  observarLembretesAtribuidosDoGestor,
  type LembreteAtribuidoPersistido,
} from '@/lib/firebase/lembretesRepository';
import { exclusaoZeraGestores, podeExcluirCompetencia, podeExcluirUsuario } from '@/lib/adminGuards';
import { areaNavegacaoDaTela } from '@/lib/navegacaoDashboard';
import { contextoEhJornada, contextoEhPlantao, contextosEscalaIguais, type ContextoEscalaAtivo } from '@/lib/contextoEscala';
import { ScheduleContextSwitcher, type OpcaoContextoEscala } from '@/components/escalas/ScheduleContextSwitcher';
import { ScheduleCompetenceControl } from '@/components/escalas/ScheduleCompetenceControl';
import { ScheduleStatusBadge, type StatusContextoEscala } from '@/components/escalas/ScheduleStatusBadge';
import { UnsavedChangesDialog } from '@/components/escalas/UnsavedChangesDialog';
import { ScheduleStartWizard, type ScheduleStartWizardProps } from '@/components/escalas/ScheduleStartWizard';
import { ResponsaveisEscalaTable } from '@/components/admin/ResponsaveisEscalaTable';
import { ResponsavelEscalaModal } from '@/components/admin/ResponsavelEscalaModal';
import {
  COMPETENCIA_ATUAL,
  ehAdminSistema,
  equipesPermitidasEfetivas,
  perfilEfetivo,
  podeGerenciarGrupoPlantao,
  souGestorDePlantao,
  unidadesPermitidasEfetivas,
} from '@/lib/sessao';
import {
  achatarArvore,
  achatarArvoreOrganizacional,
  calcularResumoOrganizacional,
  caminhoCurto,
  caminhoLegivel,
  chaveDoNoOrganizacional,
  construirArvoreOrganizacional,
  construirArvoreUnidades,
  ehUsuarioTecnicoOuFake,
  formariaCiclo,
  gestoresParaSimulacao,
  type NoArvoreOrganizacional,
  raizesComEquipesSemUnidade,
  rotuloGestorParaSimulacao,
  rotuloOpcaoUnidade,
  trechoFinalCaminho,
} from '@/lib/organizacao';
import { OrganizationBreadcrumb } from '@/components/organizacao/OrganizationBreadcrumb';
import { OrganizationTeamPicker } from '@/components/organizacao/OrganizationTeamPicker';
import { OrganizationTree } from '@/components/organizacao/OrganizationTree';
import { formatarDataHoraSafe } from '@/lib/dataSegura';
import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';
import { normalizarNome } from '@/lib/nomes';
import {
  construirIndiceAlertasGrade,
  detectarDescansoInsuficiente,
  detectarSequencias6x1,
  gerarAlertasEscala,
  type AlertaEscala,
} from '@/lib/alertasEscala';
import {
  aplicarTrocaNosDias,
  ROTULO_STATUS_TROCA,
  SEVERIDADE_STATUS_TROCA,
  type SolicitacaoTrocaReal,
} from '@/lib/trocasEscala';
import {
  adicionarMembroGrade,
  criarMembroGrade,
  membroJaNaGrade,
  removerMembroGrade,
  usuariosElegiveisParaAdicionarNaGrade,
} from '@/lib/gradeMembros';
import { mapaLogins, normalizarAliasesPlanilha, novoUsuario, validarEdicaoUsuario } from '@/lib/importUsers';
import {
  areasParaExibicaoNoWizard,
  identificadorGrupoPlantaoDaEquipe,
  normalizarIdentificadorTecnico,
  resolverAreaAtiva,
  resolverEquipeParaJornada,
  resolverEquipeResponsavelParaPlantao,
  resolverGrupoParaPlantao,
  unidadesAdministraveis,
  equipesAdministraveisNaUnidade,
  equipesCandidatasParaPlantao,
  validarCadastroInline,
} from '@/lib/inicioEscala';
import {
  plantoesDisponiveisParaMonitoramento,
  plantoesMonitoradosPelaEquipe,
  resolverEscoposOperacionais,
  type EscoposOperacionais,
} from '@/lib/escoposOperacionais';
import {
  listarEscoposOperacionais,
  salvarEscopoOperacional,
} from '@/lib/firebase/escoposOperacionaisRepository';
import { construirGrupoPlantaoOficial, derivarUnidadeResponsavelDoGrupoPlantao } from '@/lib/gruposPlantaoProvisionamento';
import {
  LIMITE_DESCRICAO_LEMBRETE,
  LIMITE_TITULO_LEMBRETE,
  criarOcorrenciasSerie,
  normalizarHorarioLembrete,
  normalizarLembrete,
  ordenarLembretes,
  type EntradaLembrete,
  type EntradaSerieLembrete,
} from '@/lib/lembretes';
import {
  entradaLembreteDoFormulario,
  entradaSerieLembreteDoFormulario,
  janelaAmplaLembretesAtribuidos,
  validarFormularioLembrete,
  type FormularioLembrete,
} from '@/lib/lembretesUi';
import { LembreteCard } from '@/components/lembretes/LembreteCard';
import type {
  Equipe,
  EscopoOperacional,
  EventoEscala,
  LinhaConciliacao,
  PublicacaoEscala,
  Setor,
  TipoUnidadeOrganizacional,
  UnidadeOrganizacional,
  Usuario,
} from '@/lib/modelos';

type Tela = 'visao' | 'importar' | 'escalas' | 'grade' | 'usuarios' | 'trocas' | 'plantoes' | 'administracao' | 'responsaveisEscala';
type OpcoesInicioImportacao = {
  tipoEsperado?: 'ESCALA_6X1' | 'PLANTAO';
  equipeId?: string;
  grupoId?: string;
  competencia?: string;
};

/**
 * Fase ESCALAS-UX-2A.1 — a intenção de troca (contexto OU competência)
 * pendente de confirmação quando o guard de alterações não salvas
 * intercepta a ação (§ 24/§ 25 do redesign: mesmo helper/estado para os
 * dois casos, nunca dois sistemas de guard separados).
 */
type IntencaoTrocaEscala =
  | { tipo: 'contexto'; alvo: ContextoEscalaAtivo }
  | { tipo: 'competencia'; competencia: string };
type FiltroTrocas = 'pendentes' | 'aprovadas' | 'recusadas' | 'historico';

/**
 * Nunca lança: campos ausentes/malformados mostram "—" (ou o valor bruto,
 * se não estiver no formato `YYYY-MM-DD` esperado) em vez de quebrar o
 * render (hotfix RangeError em modais de troca, ver lib/dataSegura.ts).
 */
function formatarDataCurta(dataIso: string | null | undefined): string {
  if (typeof dataIso !== 'string' || dataIso.trim() === '') {
    return '—';
  }
  const partes = dataIso.split('-');
  if (partes.length !== 3) {
    return dataIso;
  }
  const [, mes, dia] = partes;
  if (!dia || !mes) {
    return dataIso;
  }
  return `${dia}/${mes}`;
}

/**
 * Mensagem específica para ações de gestor em trocas: quando o erro é
 * permission-denied, o texto genérico de `mensagemErroFirebase` fala em
 * "conta com permissão de gestor" — aqui deixamos explícito que o motivo
 * mais provável é a equipe (gestor de outra equipe, ou trocado de conta
 * sem recarregar a sessão). Para qualquer outro tipo de erro, cai no
 * mapeamento genérico (já cobre "Firestore shutting down" etc.).
 */
function mensagemErroTrocaGestor(falha: unknown, fallback: string): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String((falha as { code?: unknown }).code)
    : '';
  if (codigo.includes('permission-denied')) {
    return 'A operação foi recusada pelas regras do Firestore. Verifique se o usuário atual é gestor da equipe.';
  }
  return mensagemErroFirebase(falha, fallback, ambienteFirebaseAtual);
}

function mensagemErroEscritaOperacional(falha: unknown, fallback: string): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String((falha as { code?: unknown }).code)
    : '';
  const mensagem = mensagemErroFirebase(falha, fallback, ambienteFirebaseAtual);
  if (codigo.includes('permission-denied')) {
    return `${mensagem} A matriz já permite selecionar a escala, mas a escrita operacional ainda está em modo de transição.`;
  }
  return mensagem;
}

function formatarHorasDescanso(horas: number): string {
  const inteiras = Math.floor(horas);
  const minutos = Math.round((horas - inteiras) * 60);
  return minutos === 0 ? `${inteiras}h` : `${inteiras}h${String(minutos).padStart(2, '0')}`;
}

type EstadoPublicacaoVisual = 'completo' | 'parcial' | 'vazio';

interface ResumoPublicacao {
  estado: EstadoPublicacaoVisual;
  titulo: string;
  descricao: string;
}

/**
 * Linguagem do card "Publicação da escala" — fala de colaboradores com
 * acesso no aplicativo, não de "documentos" (Fase de revisão de textos).
 */
function resolverResumoPublicacao(publicadosLen: number, documentosLen: number): ResumoPublicacao {
  if (documentosLen === 0 || publicadosLen === 0) {
    return {
      estado: 'vazio',
      titulo: 'Nenhuma escala publicada',
      descricao: 'A escala deste período ainda não está disponível para os colaboradores.',
    };
  }
  if (publicadosLen === documentosLen) {
    return {
      estado: 'completo',
      titulo: 'Tudo publicado',
      descricao: `${documentosLen} de ${documentosLen} colaboradores já têm escala disponível no aplicativo.`,
    };
  }
  const faltam = documentosLen - publicadosLen;
  return {
    estado: 'parcial',
    titulo: 'Publicação incompleta',
    descricao: `${publicadosLen} de ${documentosLen} colaboradores têm escala disponível. ${
      faltam === 1 ? 'Falta 1 colaborador.' : `Faltam ${faltam} colaboradores.`
    }`,
  };
}

interface AlertaVisivel {
  id: string;
  titulo: string;
  colaborador?: string;
  data?: string;
  tipo: string;
  descricao: string;
  sugestao: string;
  severidade: 'critico' | 'aviso';
}

function nomeColaboradorPorLogin(usuarios: Usuario[], login: string): string {
  return usuarios.find((item) => item.login === login)?.nome ?? login;
}

/**
 * Junta os alertas já calculados por `gerarAlertasEscala` (6x1 e descanso
 * mínimo) com um alerta simples derivado do que a tela já mostra
 * (publicação incompleta) — sem inventar nenhuma detecção nova.
 */
function montarAlertasVisiveis(
  alertasOperacionais: AlertaEscala[],
  usuarios: Usuario[],
  documentos: TurnosMes[],
  publicados: TurnosMes[],
): AlertaVisivel[] {
  const documentosLen = documentos.length;
  const publicadosLen = publicados.length;
  const doMonitoramento = alertasOperacionais.map((alerta, indice): AlertaVisivel => {
    const nome = nomeColaboradorPorLogin(usuarios, alerta.login);
    if (alerta.tipo === 'SEQUENCIA_6X1') {
      return {
        id: `seq-${alerta.usuarioUid}-${indice}`,
        titulo: '7 dias consecutivos de trabalho',
        colaborador: nome,
        data: alerta.diaCritico,
        tipo: 'Sequência acima do limite',
        descricao: `${nome} completa 7 dias consecutivos de trabalho em ${formatarDataCurta(alerta.diaCritico)}, dentro do período de ${formatarDataCurta(alerta.periodoInicio)} a ${formatarDataCurta(alerta.periodoFim)}.`,
        sugestao: 'Revise a escala desse colaborador para garantir um dia de descanso antes do 7º dia consecutivo de trabalho.',
        severidade: 'critico',
      };
    }
    return {
      id: `desc-${alerta.usuarioUid}-${indice}`,
      titulo: 'Descanso inferior a 11 horas',
      colaborador: nome,
      data: alerta.dataAtual,
      tipo: 'Descanso insuficiente',
      descricao: `${nome} tem apenas ${formatarHorasDescanso(alerta.descansoHoras)} de descanso entre o turno de ${formatarDataCurta(alerta.dataAnterior)} (${alerta.horarioAnterior}) e o de ${formatarDataCurta(alerta.dataAtual)} (${alerta.horarioAtual}).`,
      sugestao: 'Ajuste um dos turnos para garantir pelo menos 11 horas de descanso entre eles.',
      severidade: 'aviso',
    };
  });

  const publicacaoIncompleta: AlertaVisivel[] = documentosLen > 0 && publicadosLen < documentosLen
    ? [{
      id: 'publicacao-incompleta',
      titulo: 'Publicação incompleta',
      tipo: 'Publicação parcial',
      descricao: `${publicadosLen} de ${documentosLen} colaboradores têm escala publicada. ${
        documentosLen - publicadosLen === 1
          ? '1 colaborador ainda não tem acesso no aplicativo.'
          : `${documentosLen - publicadosLen} colaboradores ainda não têm acesso no aplicativo.`
      }`,
      sugestao: 'Publique a escala para liberar o acesso no aplicativo dos colaboradores restantes.',
      severidade: 'aviso',
    }]
    : [];

  return [...doMonitoramento, ...publicacaoIncompleta];
}

interface AlertasOperacionaisBellProps {
  alertas: AlertaEscala[];
  usuarios: Usuario[];
  aberta: boolean;
  onAlternar: () => void;
  onFocarGrade: () => void;
}

function AlertasOperacionaisBell({
  alertas,
  usuarios,
  aberta,
  onAlternar,
  onFocarGrade,
}: AlertasOperacionaisBellProps) {
  function nomeColaborador(usuarioUid: string, login: string): string {
    return usuarios.find((item) => item.login === usuarioUid)?.nome ?? login;
  }

  return (
    <div className="notification-center">
      <button
        className={`icon-button notification-button ${alertas.length ? 'has-unread' : ''}`}
        type="button"
        onClick={onAlternar}
        aria-label={`${alertas.length} alerta(s) operacional(is) da escala`}
        aria-expanded={aberta}
      >
        {alertas.length ? <BellRing size={19} /> : <Bell size={19} />}
        {alertas.length > 0 && <span className="notification-badge">{Math.min(alertas.length, 9)}</span>}
      </button>
      {aberta && (
        <section className="notification-popover alert-popover" aria-label="Alertas operacionais da escala">
          <header>
            <div>
              <strong>Alertas operacionais</strong>
              <span>{alertas.length ? `${alertas.length} ativo(s)` : 'Nenhuma violação encontrada'}</span>
            </div>
            {alertas.length > 0 && (
              <button type="button" onClick={onFocarGrade}>Ver na grade</button>
            )}
          </header>
          <div className="notification-list">
            {alertas.length === 0 ? (
              <div className="notification-empty"><ShieldCheck size={22} /><span>6x1 e descanso mínimo dentro da regra.</span></div>
            ) : alertas.map((alerta, indice) => (
              <article key={`${alerta.tipo}-${alerta.usuarioUid}-${indice}`} className="alert-item">
                <AlertTriangle
                  size={15}
                  className={alerta.tipo === 'SEQUENCIA_6X1' ? 'alert-icon-critico' : 'alert-icon-aviso'}
                />
                {alerta.tipo === 'SEQUENCIA_6X1' ? (
                  <div>
                    <strong>{nomeColaborador(alerta.usuarioUid, alerta.login)} — 7 dias consecutivos de trabalho</strong>
                    <small>
                      Dia crítico: {formatarDataCurta(alerta.diaCritico)} · Período:{' '}
                      {formatarDataCurta(alerta.periodoInicio)} a {formatarDataCurta(alerta.periodoFim)}
                    </small>
                  </div>
                ) : (
                  <div>
                    <strong>{nomeColaborador(alerta.usuarioUid, alerta.login)} — descanso inferior a 11 horas</strong>
                    <small>
                      Anterior: {formatarDataCurta(alerta.dataAnterior)} {alerta.horarioAnterior} · Seguinte:{' '}
                      {formatarDataCurta(alerta.dataAtual)} {alerta.horarioAtual} · Descanso calculado:{' '}
                      {formatarHorasDescanso(alerta.descansoHoras)}
                    </small>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface FormularioUsuario {
  /** Login do cadastro sendo editado; `null` para um cadastro novo. Imutável após criado. */
  loginOriginal: string | null;
  nome: string;
  email: string;
  login: string;
  cargo: string;
  nivelHierarquico: number;
  turnoPadrao: string;
  ativo: boolean;
  aliasesPlanilha: string[];

  /**
   * Campos administrativos (perfil/escopo/organização) — só entram no
   * payload enviado a `salvarUsuario` quando `souAdmin` for `true` (ver
   * `salvarFormularioUsuario`); as rules rejeitam esses campos no payload
   * de um gestor comum, então omiti-los aqui evita erro de permissão.
   */
  perfil?: Usuario['perfil'];
  escopo?: Usuario['escopo'];
  unidadeId?: string;
  unidadesPermitidas: string[];
  equipesPermitidas: string[];
}

const TIPOS_UNIDADE_ORGANIZACIONAL: TipoUnidadeOrganizacional[] = [
  'PRESIDENCIA',
  'DIRETORIA',
  'GERENCIA',
  'COORDENACAO',
  'SUPERVISAO',
  'AREA',
  'SETOR',
  'DEPARTAMENTO',
];

const PERFIS_ADMINISTRAVEIS: NonNullable<Usuario['perfil']>[] = [
  'ADMIN_SISTEMA',
  'GESTOR_UNIDADE',
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
  'ANALISTA_SOC',
  'ANALISTA_SUPORTE',
  'LEITURA',
];

const STATUS_CONCILIACAO_LABEL: Record<LinhaConciliacao['status'], string> = {
  VINCULADO_LOGIN: 'Vinculado automaticamente por login/e-mail',
  VINCULADO_ALIAS: 'Vinculado por alias',
  PRECISA_MAPEAR: 'Precisa mapear',
  USUARIO_INATIVO: 'Usuário inativo',
  USUARIO_NAO_ENCONTRADO: 'Usuário não encontrado',
  CONFLITO_ALIAS: 'Conflito de aliases',
  IGNORADA: 'Ignorada',
};

const STATUS_VINCULO_PLANTAO_LABEL: Record<StatusVinculoPlantao, string> = {
  PENDENTE: 'Pendente',
  VINCULADO: 'Vinculado',
  USUARIO_NAO_ENCONTRADO: 'Usuário não encontrado',
  CONFLITO: 'Conflito de login',
};

const STATUS_VINCULO_PLANTAO_BADGE: Record<StatusVinculoPlantao, string> = {
  PENDENTE: 'warning',
  VINCULADO: 'success',
  USUARIO_NAO_ENCONTRADO: 'warning',
  CONFLITO: 'danger',
};

function formatarMomentoPlantao(momento: { data: string; hora: string }): string {
  const [ano, mes, dia] = momento.data.split('-');
  return `${dia}/${mes}/${ano} · ${momento.hora}`;
}

/**
 * Descreve uma `DivergenciaPlantao` (Fase PLANTÃO-3B.1) em texto neutro —
 * nunca chama nenhum dos dois valores de "correto"/"real", nunca culpa o
 * usuário, nunca afirma que a planilha está errada. Só relata os dois
 * números que divergem.
 */
function descreverDivergenciaPlantao(divergencia: DivergenciaPlantao): string {
  switch (divergencia.chave) {
    case 'INTERVALOS_VS_CONTABILIDADE_QUANTIDADE':
      return `Foram encontrados ${divergencia.valorA} intervalo(s), enquanto a contabilidade por `
        + `plantonista soma ${divergencia.valorB} plantão(ões).`;
    case 'INTERVALOS_VS_CONTABILIDADE_MINUTOS':
      return `A duração literal dos intervalos soma ${formatarMinutos(divergencia.valorA)}, enquanto a `
        + `contabilidade por plantonista soma ${formatarMinutos(divergencia.valorB)}.`;
    case 'CONTABILIDADE_VS_DECLARADO_QUANTIDADE':
      return `A contabilidade por plantonista soma ${divergencia.valorA} plantão(ões), enquanto o total `
        + `declarado na planilha informa ${divergencia.valorB}.`;
    case 'CONTABILIDADE_VS_DECLARADO_MINUTOS':
      return `A contabilidade por plantonista soma ${formatarMinutos(divergencia.valorA)}, enquanto o total `
        + `declarado na planilha informa ${formatarMinutos(divergencia.valorB)}.`;
    default:
      return '';
  }
}

/**
 * Fase ESCALAS-UX-2A — a sidebar principal reflete ÁREAS reais do produto
 * (`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 5), nunca ferramentas
 * internas: "Importar" é uma ação de criação de escala, "Grade" é um editor
 * de jornada, "Plantões" hoje é administração de Grupo de Plantão — nenhum
 * dos três é uma área principal independente. As telas internas
 * (`tela === 'importar' | 'grade' | 'plantoes'`) continuam existindo
 * (ver `lib/navegacaoDashboard.ts`); só deixaram de ser itens de MENU
 * PRINCIPAL — acessíveis por pontes a partir de "Escalas"/"Administração".
 */
const NAVEGACAO: ItemNavegacao[] = [
  { id: 'visao', rotulo: 'Visão geral', icone: 'home' },
  { id: 'escalas', rotulo: 'Escalas', icone: 'calendar' },
  { id: 'trocas', rotulo: 'Trocas', icone: 'trocas' },
  { id: 'usuarios', rotulo: 'Usuários', icone: 'users' },
  { id: 'administracao', rotulo: 'Administração', icone: 'admin' },
];

/**
 * Fase ESCOPO-CONSULTA-PLANTAO-1 — no-op estável (referência única, nunca
 * recriada a cada render) para os callbacks de escrita de Plantão
 * (`onEditarAtribuicao`/`onSolicitarNovaAtribuicao`) quando o contexto
 * ativo é só consultável. Defesa em profundidade: mesmo que algum botão
 * do calendário (`modo="consulta"`) escapasse do bloqueio visual, o
 * clique não teria efeito nenhum.
 */
function NAO_OPERAR_PLANTAO_CONSULTA(): void {}

/** Estado neutro de `resolverEscoposOperacionais()` enquanto `usuarioReal` ainda é `null` (sessão não resolvida). */
const ESCOPOS_OPERACIONAIS_VAZIOS: EscoposOperacionais = {
  unidadesAdministraveis: [],
  equipesAdministraveis: [],
  jornadasAdministraveis: [],
  gruposPlantaoAdministraveis: [],
  plantoesAdministraveis: [],
  plantoesConsultaveis: [],
  plantoesMonitorados: [],
  alvosDisponiveisParaConfiguracao: {
    jornadas: [],
    plantoes: [],
  },
};

interface CelulaEditando {
  documento: TurnosMes;
  data: string;
  dia: Dia;
}

/**
 * Modal de criação/edição de unidade organizacional (Parte 1-2 da correção
 * de UX) — substitui o formulário fixo no rodapé do card. Validação (ID/
 * nome/sigla obrigatórios, duplicidade, ciclo, escopo de GESTOR_UNIDADE)
 * acontece aqui, antes de chamar `onSalvar`; falhas de rede/rules chegam
 * como `Error` de `onSalvar` e aparecem no mesmo lugar, sem fechar o modal.
 */
function ModalUnidadeOrganizacional({
  modo,
  inicial,
  unidadesExistentes,
  unidadesPermitidas,
  loginAtual,
  onFechar,
  onSalvar,
}: {
  modo: 'criar' | 'editar';
  inicial: UnidadeOrganizacional;
  unidadesExistentes: UnidadeOrganizacional[];
  /** `null` = sem restrição de escopo (ADMIN_SISTEMA). */
  unidadesPermitidas: string[] | null;
  loginAtual: string;
  onFechar: () => void;
  onSalvar: (unidade: UnidadeOrganizacional) => Promise<void>;
}) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  useTeclaEsc(onFechar);

  const opcoesUnidadePai = achatarArvore(construirArvoreUnidades(unidadesExistentes))
    .filter((no) => no.unidade.unidadeId !== form.unidadeId)
    .filter((no) => unidadesPermitidas === null || unidadesPermitidas.includes(no.unidade.unidadeId));
  const unidadePaiSelecionada = unidadesExistentes.find((item) => item.unidadeId === form.parentId);

  async function aoClicarSalvar() {
    if (form.unidadeId.trim() === '') {
      setErro('Informe o ID da unidade organizacional.');
      return;
    }
    if (form.nome.trim() === '') {
      setErro('Informe o nome da unidade organizacional.');
      return;
    }
    if (form.sigla.trim() === '') {
      setErro('Informe a sigla da unidade organizacional.');
      return;
    }
    if (modo === 'criar' && unidadesExistentes.some((item) => item.unidadeId === form.unidadeId)) {
      setErro('Já existe uma unidade organizacional com esse ID.');
      return;
    }
    if (formariaCiclo(form.unidadeId, form.parentId, unidadesExistentes)) {
      setErro('Essa unidade pai criaria um ciclo na hierarquia (uma unidade não pode ser sua própria ancestral).');
      return;
    }
    if (unidadesPermitidas !== null && (form.parentId === null || !unidadesPermitidas.includes(form.parentId))) {
      setErro('Você só pode usar uma unidade pai sob sua permissão.');
      return;
    }
    const candidato: UnidadeOrganizacional = {
      ...form,
      caminho: [...(unidadePaiSelecionada?.caminho ?? []), form.unidadeId],
      criadoPorLogin: form.criadoPorLogin || loginAtual,
    };
    setSalvando(true);
    try {
      await onSalvar(candidato);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a unidade organizacional.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unidade-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="unidade-modal-title">{modo === 'criar' ? 'Nova unidade organizacional' : 'Editar unidade organizacional'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="admin-form-grid">
          <label htmlFor="unidade-modal-id">
            ID da unidade
            <input
              id="unidade-modal-id"
              autoFocus
              placeholder="Ex.: COSI"
              value={form.unidadeId}
              disabled={modo === 'editar'}
              onChange={(evento) => setForm((atual) => ({ ...atual, unidadeId: evento.target.value }))}
            />
            {modo === 'editar' && <small>O ID não pode ser alterado depois de criado.</small>}
          </label>
          <label htmlFor="unidade-modal-nome">
            Nome
            <input
              id="unidade-modal-nome"
              placeholder="Nome completo"
              value={form.nome}
              onChange={(evento) => setForm((atual) => ({ ...atual, nome: evento.target.value }))}
            />
          </label>
          <label htmlFor="unidade-modal-sigla">
            Sigla
            <input
              id="unidade-modal-sigla"
              placeholder="Ex.: COSI"
              value={form.sigla}
              onChange={(evento) => setForm((atual) => ({ ...atual, sigla: evento.target.value }))}
            />
          </label>
          <label htmlFor="unidade-modal-tipo">
            Tipo
            <select
              id="unidade-modal-tipo"
              value={form.tipo}
              onChange={(evento) => setForm((atual) => ({ ...atual, tipo: evento.target.value as TipoUnidadeOrganizacional }))}
            >
              {TIPOS_UNIDADE_ORGANIZACIONAL.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
          <label htmlFor="unidade-modal-pai">
            Unidade pai
            <select
              id="unidade-modal-pai"
              value={form.parentId ?? ''}
              onChange={(evento) => setForm((atual) => ({ ...atual, parentId: evento.target.value || null }))}
            >
              <option value="">(raiz — sem unidade pai)</option>
              {opcoesUnidadePai.map((no) => (
                <option key={no.unidade.unidadeId} value={no.unidade.unidadeId}>
                  {'  '.repeat(no.profundidade)}{rotuloOpcaoUnidade(no.unidade, unidadesExistentes)}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-row admin-form-active" htmlFor="unidade-modal-ativa">
            <input
              id="unidade-modal-ativa"
              type="checkbox"
              checked={form.ativa}
              onChange={(evento) => setForm((atual) => ({ ...atual, ativa: evento.target.checked }))}
            />
            <span>Ativa</span>
          </label>
          <p className="admin-form-preview admin-form-full">
            {form.parentId === null
              ? 'Esta unidade ficará na raiz.'
              : (
                <>
                  Caminho final: <strong>
                    {caminhoLegivel(
                      [...(unidadePaiSelecionada?.caminho ?? []), form.unidadeId || '(novo ID)'],
                      unidadesExistentes,
                    )}
                  </strong>
                </>
              )}
          </p>
        </div>
        {erro && <p className="admin-form-erro">{erro}</p>}
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={salvando} onClick={() => void aoClicarSalvar()}>
            {salvando ? <LoaderCircle className="spin" size={16} /> : null} Salvar unidade
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Modal de criação/edição de equipe (Parte 1-3 da correção de UX). Unidade
 * organizacional é obrigatória para equipes novas (spec Parte 3); equipes
 * antigas sem unidade continuam podendo ser editadas sem uma, mas com
 * aviso — nunca bloqueadas por isso.
 */
function ModalEquipe({
  modo,
  inicial,
  equipesExistentes,
  unidadesExistentes,
  unidadesPermitidas,
  onFechar,
  onSalvar,
}: {
  modo: 'criar' | 'editar';
  inicial: Equipe;
  equipesExistentes: Equipe[];
  unidadesExistentes: UnidadeOrganizacional[];
  /** `null` = sem restrição de escopo (ADMIN_SISTEMA). */
  unidadesPermitidas: string[] | null;
  onFechar: () => void;
  onSalvar: (equipe: Equipe) => Promise<void>;
}) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  useTeclaEsc(onFechar);

  const opcoesUnidade = achatarArvore(construirArvoreUnidades(unidadesExistentes))
    .filter((no) => unidadesPermitidas === null || unidadesPermitidas.includes(no.unidade.unidadeId));
  const unidadeSelecionada = unidadesExistentes.find((item) => item.unidadeId === form.unidadeId);

  async function aoClicarSalvar() {
    if (form.id.trim() === '') {
      setErro('Informe o ID da equipe.');
      return;
    }
    if (form.nome.trim() === '') {
      setErro('Informe o nome da equipe.');
      return;
    }
    if (form.sigla.trim() === '') {
      setErro('Informe a sigla da equipe.');
      return;
    }
    if (modo === 'criar' && equipesExistentes.some((item) => item.id === form.id)) {
      setErro('Já existe uma equipe com esse ID.');
      return;
    }
    if (modo === 'criar' && unidadesExistentes.length > 0 && !form.unidadeId) {
      setErro('Selecione a unidade organizacional desta equipe.');
      return;
    }
    const candidato: Equipe = {
      ...form,
      caminhoUnidade: unidadeSelecionada?.caminho,
    };
    setSalvando(true);
    try {
      await onSalvar(candidato);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a equipe.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipe-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="equipe-modal-title">{modo === 'criar' ? 'Nova equipe' : 'Editar equipe'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="admin-form-grid">
          <label htmlFor="equipe-modal-id">
            ID da equipe
            <input
              id="equipe-modal-id"
              autoFocus
              placeholder="Ex.: EQ_SOC"
              value={form.id}
              disabled={modo === 'editar'}
              onChange={(evento) => setForm((atual) => ({ ...atual, id: evento.target.value }))}
            />
            {modo === 'editar' && <small>O ID não pode ser alterado — é a chave usada pela escala (turnosMes).</small>}
          </label>
          <label htmlFor="equipe-modal-nome">
            Nome
            <input
              id="equipe-modal-nome"
              placeholder="Nome da equipe"
              value={form.nome}
              onChange={(evento) => setForm((atual) => ({ ...atual, nome: evento.target.value }))}
            />
          </label>
          <label htmlFor="equipe-modal-sigla">
            Sigla
            <input
              id="equipe-modal-sigla"
              placeholder="Ex.: SOC"
              value={form.sigla}
              onChange={(evento) => setForm((atual) => ({ ...atual, sigla: evento.target.value }))}
            />
          </label>
          <label htmlFor="equipe-modal-unidade">
            Unidade organizacional
            <select
              id="equipe-modal-unidade"
              value={form.unidadeId ?? ''}
              onChange={(evento) => setForm((atual) => ({ ...atual, unidadeId: evento.target.value || undefined }))}
            >
              <option value="">Sem unidade organizacional</option>
              {opcoesUnidade.map((no) => (
                <option key={no.unidade.unidadeId} value={no.unidade.unidadeId}>
                  {'  '.repeat(no.profundidade)}{rotuloOpcaoUnidade(no.unidade, unidadesExistentes)}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-row admin-form-active" htmlFor="equipe-modal-ativa">
            <input
              id="equipe-modal-ativa"
              type="checkbox"
              checked={form.ativa}
              onChange={(evento) => setForm((atual) => ({ ...atual, ativa: evento.target.checked }))}
            />
            <span>Ativa</span>
          </label>
          <p className="admin-form-preview admin-form-full">
            {form.unidadeId
              ? (
                <>
                  Esta equipe ficará em: <strong>{caminhoLegivel(unidadeSelecionada?.caminho ?? [form.unidadeId], unidadesExistentes)}</strong>
                </>
              )
              : 'Sem unidade organizacional vinculada — recomendamos escolher uma, mas equipes antigas podem continuar assim.'}
          </p>
        </div>
        {erro && <p className="admin-form-erro">{erro}</p>}
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={salvando} onClick={() => void aoClicarSalvar()}>
            {salvando ? <LoaderCircle className="spin" size={16} /> : null} Salvar equipe
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Modal de criação/edição de Grupo de Plantão (Fase PLANTÃO-3B). Reaproveita
 * exatamente o mesmo padrão de `ModalEquipe`/`ModalUnidadeOrganizacional`
 * (mesmas classes de modal, mesmo formato de validação) — a "equipe
 * responsável" é escolhida por um `<select>` plano sobre `equipesExistentes`
 * (nunca uma segunda árvore: equipes já não são hierárquicas, só a unidade
 * acima delas é, e o rótulo de cada opção reaproveita `trechoFinalCaminho()`
 * de `lib/organizacao.ts` para mostrar esse caminho). `equipesConsulta` é um
 * multi-select de checkboxes sobre as mesmas equipes — a equipe responsável
 * vem sempre marcada e desabilitada (a Rule exige `equipeResponsavelId in
 * equipesConsulta` sempre; nunca uma equipe extra pré-marcada, ver
 * docs/spec/PLANTOES.md, seção 20).
 */
function ModalGrupoPlantao({
  modo,
  inicial,
  gruposExistentes,
  equipesExistentes,
  unidadesExistentes,
  equipesPermitidas,
  carregandoEquipes = false,
  erroEquipes = null,
  onFechar,
  onSalvar,
}: {
  modo: 'criar' | 'editar';
  inicial: GrupoPlantao;
  gruposExistentes: GrupoPlantao[];
  equipesExistentes: Equipe[];
  unidadesExistentes: UnidadeOrganizacional[];
  /** `null` = sem restrição (ADMIN_SISTEMA); não-null = só estas equipes podem ser "responsável" (GESTOR_EQUIPE). */
  equipesPermitidas: string[] | null;
  /** `true` enquanto `equipesExistentes`/`unidadesExistentes` ainda carregam — nunca confundir com "nenhuma equipe". */
  carregandoEquipes?: boolean;
  /** Falha ao carregar equipes/unidades — nunca confundir com "nenhuma equipe". */
  erroEquipes?: string | null;
  onFechar: () => void;
  onSalvar: (grupo: GrupoPlantao) => Promise<void>;
}) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pickerEquipeResponsavelAberto, setPickerEquipeResponsavelAberto] = useState(false);
  const [pickerEquipesConsultaAberto, setPickerEquipesConsultaAberto] = useState(false);
  useTeclaEsc(onFechar);
  /**
   * Foco devolvido ao botão que abriu o picker, ao fechar (confirmando ou
   * cancelando) — nenhum dos dois botões (Selecionar/Alterar) fica
   * renderizado ao mesmo tempo que o outro, então uma única ref cobre os
   * dois casos de "equipe responsável".
   */
  const botaoEquipeResponsavelRef = useRef<HTMLButtonElement>(null);
  const botaoEquipesConsultaRef = useRef<HTMLButtonElement>(null);
  function fecharPickerEquipeResponsavel() {
    setPickerEquipeResponsavelAberto(false);
    botaoEquipeResponsavelRef.current?.focus();
  }
  function fecharPickerEquipesConsulta() {
    setPickerEquipesConsultaAberto(false);
    botaoEquipesConsultaRef.current?.focus();
  }

  const equipesParaOPicker = equipesExistentes
    .filter((equipe) => equipesPermitidas === null || equipesPermitidas.includes(equipe.id));
  const arvoreParaOPicker = construirArvoreOrganizacional(unidadesExistentes, equipesParaOPicker);
  const raizesParaOPicker = raizesComEquipesSemUnidade(arvoreParaOPicker);
  const equipeResponsavelAtual = equipesExistentes.find((equipe) => equipe.id === form.equipeResponsavelId);

  function alternarEquipeConsulta(equipeId: string) {
    setForm((atual) => ({
      ...atual,
      equipesConsulta: atual.equipesConsulta.includes(equipeId)
        ? atual.equipesConsulta.filter((item) => item !== equipeId)
        : [...atual.equipesConsulta, equipeId],
    }));
  }

  async function aoClicarSalvar() {
    if (modo === 'criar' && gruposExistentes.some((item) => item.grupoId === form.grupoId)) {
      setErro('Já existe um grupo de Plantão com esse identificador.');
      return;
    }
    /**
     * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — `unidadeResponsavelId`/
     * `caminhoUnidadeResponsavel` NUNCA digitados pelo usuário: sempre
     * copiados da equipe responsável já escolhida no picker acima
     * (`equipeResponsavelAtual`), mesma fonte/mesma função usada por
     * `criarGrupoWizard()` no Wizard (`lib/gruposPlantaoProvisionamento.ts`,
     * única fonte da derivação). Sem isso, um `GESTOR_UNIDADE` salvando por
     * este modal (em vez do fluxo inline do Wizard) teria o `create`/
     * `update` negado pelas Rules — o segundo caminho de autorização
     * (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 5) exige esses
     * campos preenchidos. Se a equipe não for encontrada (raro — lista
     * ainda carregando), preserva o valor já existente no formulário em vez
     * de apagá-lo silenciosamente.
     */
    const unidadeDerivada = derivarUnidadeResponsavelDoGrupoPlantao(equipeResponsavelAtual);
    const candidato: GrupoPlantao = {
      ...form,
      equipesConsulta: equipesConsultaEfetivas(form.equipeResponsavelId, form.equipesConsulta),
      unidadeResponsavelId: unidadeDerivada.unidadeResponsavelId ?? form.unidadeResponsavelId,
      caminhoUnidadeResponsavel: unidadeDerivada.caminhoUnidadeResponsavel ?? form.caminhoUnidadeResponsavel,
      // Fase PLANTAO-PADRAO-1 — sempre ordenado (Domingo→Sábado) antes de
      // salvar; array vazio equivale a "nenhum padrão configurado", nunca
      // persistido como `[]` (mesmo princípio de `descricao` em branco
      // virando `undefined`, acima).
      padraoHorarioSemanal: (form.padraoHorarioSemanal?.length ?? 0) === 0
        ? undefined
        : ordenarPadraoHorarioSemanal(form.padraoHorarioSemanal ?? []),
    };
    const erros = validarGrupoPlantao(candidato);
    if (erros.length > 0) {
      setErro(erros.join(' '));
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(candidato);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar o grupo de Plantão.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grupo-plantao-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="grupo-plantao-modal-title">{modo === 'criar' ? 'Novo grupo de Plantão' : 'Editar grupo de Plantão'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="admin-form-grid">
          <label htmlFor="grupo-plantao-id">
            Identificador técnico
            <input
              id="grupo-plantao-id"
              autoFocus
              placeholder="Ex.: PLANTAO_SEGURANCA"
              value={form.grupoId}
              disabled={modo === 'editar'}
              onChange={(evento) => setForm((atual) => ({ ...atual, grupoId: evento.target.value }))}
            />
            <small>
              Usado internamente pelo sistema.
              {modo === 'editar' && ' Não pode ser alterado depois de criado.'}
            </small>
          </label>
          <label htmlFor="grupo-plantao-nome">
            Nome
            <input
              id="grupo-plantao-nome"
              placeholder="Nome do grupo de Plantão"
              value={form.nome}
              onChange={(evento) => setForm((atual) => ({ ...atual, nome: evento.target.value }))}
            />
          </label>
          <label className="admin-form-full" htmlFor="grupo-plantao-descricao">
            Descrição (opcional)
            <input
              id="grupo-plantao-descricao"
              value={form.descricao ?? ''}
              onChange={(evento) => setForm((atual) => ({ ...atual, descricao: evento.target.value || undefined }))}
            />
          </label>
          <div className="admin-form-full">
            <span className="organization-picker-label">Equipe responsável</span>
            {equipeResponsavelAtual ? (
              <div className="organization-picker-valor">
                <div>
                  <strong>{equipeResponsavelAtual.nome}</strong>
                  {equipeResponsavelAtual.caminhoUnidade && (
                    <OrganizationBreadcrumb caminho={equipeResponsavelAtual.caminhoUnidade} unidades={unidadesExistentes} />
                  )}
                </div>
                <button
                  ref={botaoEquipeResponsavelRef}
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => setPickerEquipeResponsavelAberto(true)}
                >
                  Alterar
                </button>
              </div>
            ) : (
              <button
                ref={botaoEquipeResponsavelRef}
                type="button"
                className="secondary-button"
                onClick={() => setPickerEquipeResponsavelAberto(true)}
              >
                Selecionar equipe responsável
              </button>
            )}
          </div>
          <label htmlFor="grupo-plantao-timezone">
            Timezone
            <input
              id="grupo-plantao-timezone"
              placeholder="Ex.: America/Sao_Paulo"
              value={form.timezone}
              onChange={(evento) => setForm((atual) => ({ ...atual, timezone: evento.target.value }))}
            />
          </label>
          <label htmlFor="grupo-plantao-ativo">
            Status
            <span className="checkbox-row admin-form-status-checkbox">
              <input
                id="grupo-plantao-ativo"
                type="checkbox"
                checked={form.ativo}
                onChange={(evento) => setForm((atual) => ({ ...atual, ativo: evento.target.checked }))}
              />
              <span>Ativo</span>
            </span>
          </label>
          <fieldset className="admin-form-full">
            <legend>Equipes autorizadas a consultar</legend>
            <p className="admin-form-preview">
              Consultar é só visualizar o Plantão (participantes, atribuições) — nunca administra nada.
              Só quem gerencia a equipe responsável (sempre incluída abaixo) administra este grupo.
            </p>
            <button
              ref={botaoEquipesConsultaRef}
              type="button"
              className="secondary-button"
              disabled={form.equipeResponsavelId === ''}
              onClick={() => setPickerEquipesConsultaAberto(true)}
            >
              Selecionar equipes que consultam
            </button>
            {form.equipeResponsavelId === '' && (
              <small className="empty-inline">Escolha a equipe responsável antes de selecionar quem consulta.</small>
            )}
            {form.equipesConsulta.length > 0 && (
              <ul className="organization-team-picker-resumo">
                {form.equipesConsulta.map((equipeId) => {
                  const equipe = equipesExistentes.find((item) => item.id === equipeId);
                  const ehResponsavel = equipeId === form.equipeResponsavelId;
                  return (
                    <li key={equipeId}>
                      <div>
                        <strong>{equipe?.nome ?? equipeId}</strong>
                        {equipe?.caminhoUnidade && <OrganizationBreadcrumb caminho={equipe.caminhoUnidade} unidades={unidadesExistentes} />}
                      </div>
                      {ehResponsavel ? (
                        <span className="status-badge neutral">responsável — sempre incluída</span>
                      ) : (
                        <button
                          type="button"
                          className="icon-button"
                          title="Remover"
                          aria-label={`Remover ${equipe?.nome ?? equipeId} de equipes que consultam`}
                          onClick={() => alternarEquipeConsulta(equipeId)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          <PadraoHorarioSemanalCampo
            valor={form.padraoHorarioSemanal}
            onAlterar={(novo) => setForm((atual) => ({ ...atual, padraoHorarioSemanal: novo }))}
          />
        </div>
        {erro && <p className="admin-form-erro">{erro}</p>}
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={salvando} onClick={() => void aoClicarSalvar()}>
            {salvando ? <LoaderCircle className="spin" size={16} /> : null} Salvar grupo
          </button>
        </div>
      </section>
    </div>
    {pickerEquipeResponsavelAberto && (
      <OrganizationTeamPicker
        modo="single"
        titulo="Selecionar equipe responsável"
        descricao="A equipe responsável administra este grupo de Plantão e é sempre incluída entre as equipes que consultam."
        raizes={raizesParaOPicker}
        carregando={carregandoEquipes}
        erro={erroEquipes}
        valor={form.equipeResponsavelId || null}
        onFechar={fecharPickerEquipeResponsavel}
        onConfirmar={(equipeId) => {
          setForm((atual) => ({ ...atual, equipeResponsavelId: equipeId }));
          fecharPickerEquipeResponsavel();
        }}
      />
    )}
    {pickerEquipesConsultaAberto && (
      <OrganizationTeamPicker
        modo="multiple"
        titulo="Selecionar equipes que consultam"
        descricao="Consultar é só visualizar o Plantão — nunca administra participantes, contatos ou rascunhos."
        raizes={raizesParaOPicker}
        carregando={carregandoEquipes}
        erro={erroEquipes}
        valores={form.equipesConsulta}
        equipeTravadaId={form.equipeResponsavelId || undefined}
        onFechar={fecharPickerEquipesConsulta}
        onConfirmar={(equipeIds) => {
          setForm((atual) => ({ ...atual, equipesConsulta: equipeIds }));
          fecharPickerEquipesConsulta();
        }}
      />
    )}
    </>
  );
}

/**
 * Modal de contatos de um participante de Plantão (Fase PLANTÃO-3B) — até
 * `MAXIMO_CONTATOS_PLANTONISTA` linhas de rótulo/número/ativo. Validação
 * (`validarContatosPlantonista`) e normalização (`normalizarContatosPlantonista`)
 * reaproveitam as mesmas funções puras de `@escala-ici/contrato` usadas por
 * `firestore.rules`/`plantaoWriteRepository.ts` — nunca uma cópia divergente
 * da regra de "0 a 3 contatos" aqui.
 */
function ModalContatosParticipante({
  nomeExibicao,
  contatosIniciais,
  onFechar,
  onSalvar,
}: {
  nomeExibicao: string;
  contatosIniciais: ContatoPlantonista[];
  onFechar: () => void;
  onSalvar: (contatos: ContatoPlantonista[]) => Promise<void>;
}) {
  const [contatos, setContatos] = useState<ContatoPlantonista[]>(contatosIniciais);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  useTeclaEsc(onFechar);

  function atualizarContato(indice: number, campo: 'rotulo' | 'numero', valor: string) {
    setContatos((atuais) => atuais.map((item, posicao) => (posicao === indice ? { ...item, [campo]: valor } : item)));
  }

  function alternarAtivoContato(indice: number) {
    setContatos((atuais) => atuais.map((item, posicao) => (posicao === indice ? { ...item, ativo: !item.ativo } : item)));
  }

  function adicionarContato() {
    setContatos((atuais) => (atuais.length >= MAXIMO_CONTATOS_PLANTONISTA
      ? atuais
      : [...atuais, { rotulo: '', numero: '', ativo: true }]));
  }

  function removerContato(indice: number) {
    setContatos((atuais) => atuais.filter((_, posicao) => posicao !== indice));
  }

  async function aoClicarSalvar() {
    const normalizados = normalizarContatosPlantonista(contatos);
    const erros = validarContatosPlantonista(normalizados);
    if (erros.length > 0) {
      setErro(erros.join(' '));
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(normalizados);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar os contatos.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contatos-modal-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="contatos-modal-title">Contatos de {nomeExibicao}</h2>
            <p>Até {MAXIMO_CONTATOS_PLANTONISTA} contatos operacionais por plantonista.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="contato-plantonista-lista">
          {contatos.length === 0 && <p className="empty-inline">Nenhum contato cadastrado ainda.</p>}
          {contatos.map((contato, indice) => (
            <div className="contato-plantonista-linha" key={indice}>
              <label>
                Rótulo
                <input
                  placeholder="Ex.: Celular corporativo"
                  value={contato.rotulo}
                  onChange={(evento) => atualizarContato(indice, 'rotulo', evento.target.value)}
                />
              </label>
              <label>
                Número
                <input
                  placeholder="Ex.: (11) 99999-0000"
                  value={contato.numero}
                  onChange={(evento) => atualizarContato(indice, 'numero', evento.target.value)}
                />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={contato.ativo} onChange={() => alternarAtivoContato(indice)} />
                <span>Ativo</span>
              </label>
              <button
                className="icon-button"
                type="button"
                title="Remover contato"
                aria-label={`Remover contato ${indice + 1}`}
                onClick={() => removerContato(indice)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="secondary-button compact-button"
          type="button"
          disabled={contatos.length >= MAXIMO_CONTATOS_PLANTONISTA}
          onClick={adicionarContato}
        >
          <Plus size={14} /> Adicionar contato
        </button>
        {erro && <p className="admin-form-erro">{erro}</p>}
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={salvando} onClick={() => void aoClicarSalvar()}>
            {salvando ? <LoaderCircle className="spin" size={16} /> : null} Salvar contatos
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Confirmação forte genérica para ações destrutivas do admin — digitar uma
 * frase exata (o login de um usuário, ou "EXCLUIR ESCALA"/a competência)
 * antes do botão de perigo ficar disponível. Reaproveitada tanto para
 * exclusão de escala (§4) quanto embutida em `ModalExcluirUsuario` abaixo.
 */
function ModalConfirmarComTexto({
  titulo,
  mensagem,
  fraseEsperada,
  rotuloBotaoConfirmar,
  processando,
  onFechar,
  onConfirmar,
}: {
  titulo: string;
  mensagem: ReactNode;
  fraseEsperada: string | string[];
  rotuloBotaoConfirmar: string;
  processando: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const [valor, setValor] = useState('');
  const aceitas = Array.isArray(fraseEsperada) ? fraseEsperada : [fraseEsperada];
  const confere = aceitas.includes(valor.trim());

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal rollback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-texto-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div><h2 id="confirmar-texto-title">{titulo}</h2></div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        {mensagem}
        <label>
          Digite <code>{aceitas.join('</code> ou <code>')}</code> para confirmar
          <input value={valor} onChange={(evento) => setValor(evento.target.value)} autoFocus />
        </label>
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button
            className="primary-button danger-button"
            type="button"
            disabled={!confere || processando}
            onClick={onConfirmar}
          >
            {rotuloBotaoConfirmar}
          </button>
        </div>
      </section>
    </div>
  );
}

const OPCOES_EXCLUSAO_USUARIO: Array<{
  campo: keyof OpcoesExclusaoUsuario;
  titulo: string;
  descricao: (login: string) => string;
}> = [
  { campo: 'cadastro', titulo: 'Cadastro do usuário', descricao: (login) => `Remove usuarios/${login}` },
  { campo: 'escalasPublicadas', titulo: 'Escalas publicadas', descricao: () => 'Remove turnosMes vinculados a este usuário' },
  { campo: 'rascunhos', titulo: 'Rascunhos', descricao: () => 'Remove rascunhosTurnosMes vinculados' },
  { campo: 'trocas', titulo: 'Trocas vinculadas', descricao: () => 'Remove solicitações de troca relacionadas' },
  { campo: 'notificacoes', titulo: 'Notificações vinculadas', descricao: () => 'Remove notificações relacionadas' },
];

/**
 * Exclusão seletiva de usuário: o admin escolhe quais categorias de dados
 * vinculadas ao login apagar (cada opção em card próprio, todas desmarcadas
 * por padrão) e confirma digitando o login exato. Se `zeraGestores` for
 * true, uma segunda etapa explícita de confirmação aparece antes do botão
 * ficar disponível — não é só um aviso maior, é um passo a mais de verdade.
 *
 * Cadastro técnico/fake (`ehUsuarioTecnicoOuFake`) é sinalizado no
 * cabeçalho — o identificador (login/docId técnico, ex. `usuario-123` ou
 * um UID) nunca é tratado como "nome" na tela, sempre em `<code>`.
 */
function ModalExcluirUsuario({
  candidato,
  zeraGestores,
  processando,
  onFechar,
  onConfirmar,
}: {
  candidato: Usuario;
  zeraGestores: boolean;
  processando: boolean;
  onFechar: () => void;
  onConfirmar: (opcoes: OpcoesExclusaoUsuario) => void;
}) {
  const [opcoes, setOpcoes] = useState<OpcoesExclusaoUsuario>({
    cadastro: false,
    escalasPublicadas: false,
    rascunhos: false,
    trocas: false,
    notificacoes: false,
  });
  const [confirmacaoZeraGestores, setConfirmacaoZeraGestores] = useState(false);
  const [valorLogin, setValorLogin] = useState('');
  useTeclaEsc(onFechar);
  const tecnico = ehUsuarioTecnicoOuFake(candidato);
  const algumaOpcaoMarcada = Object.values(opcoes).some(Boolean);
  const loginConfere = valorLogin.trim() === candidato.login;
  const precisaSegundaEtapa = zeraGestores && opcoes.cadastro;
  const podeConfirmar = loginConfere
    && algumaOpcaoMarcada
    && (!precisaSegundaEtapa || confirmacaoZeraGestores);

  function alternar(campo: keyof OpcoesExclusaoUsuario) {
    setOpcoes((atual) => ({ ...atual, [campo]: !atual[campo] }));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal rollback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excluir-usuario-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="excluir-usuario-title">
              {tecnico ? 'Excluir cadastro técnico/fake' : `Excluir dados de ${candidato.nome}`}
            </h2>
            <p>
              {tecnico && <span className="status-badge warning">Cadastro técnico/fake</span>}
              {' '}Login <code>{candidato.login}</code> · equipe {candidato.equipeId}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <fieldset className="checkbox-card-list">
          <legend>O que apagar</legend>
          {OPCOES_EXCLUSAO_USUARIO.map(({ campo, titulo, descricao }) => (
            <label key={campo} className="checkbox-card" htmlFor={`excluir-usuario-${campo}`}>
              <input
                id={`excluir-usuario-${campo}`}
                type="checkbox"
                checked={opcoes[campo]}
                onChange={() => alternar(campo)}
              />
              <span>
                <strong>{titulo}</strong>
                <small>{descricao(candidato.login)}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {precisaSegundaEtapa && (
          <div className="alert warning" role="status">
            <strong>Esta é a última conta com perfil de gestor/admin.</strong> Excluir o cadastro pode deixar a
            equipe sem gestor.
            <label className="checkbox-row" htmlFor="excluir-usuario-confirma-zera-gestores">
              <input
                id="excluir-usuario-confirma-zera-gestores"
                type="checkbox"
                checked={confirmacaoZeraGestores}
                onChange={(evento) => setConfirmacaoZeraGestores(evento.target.checked)}
              />
              <span>Entendo e quero excluir mesmo assim</span>
            </label>
          </div>
        )}
        <label htmlFor="excluir-usuario-confirmacao-login">
          Digite <code>{candidato.login}</code> para confirmar
          <input
            id="excluir-usuario-confirmacao-login"
            value={valorLogin}
            onChange={(evento) => setValorLogin(evento.target.value)}
            autoFocus
          />
        </label>
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button
            className="primary-button danger-button"
            type="button"
            disabled={!podeConfirmar || processando}
            onClick={() => onConfirmar(opcoes)}
          >
            Excluir selecionado(s)
          </button>
        </div>
      </section>
    </div>
  );
}

function ModalDetalheTrocaGestor({
  troca,
  alertasHipoteticos,
  motivoRecusa,
  processando,
  erro,
  onMudarMotivoRecusa,
  onFechar,
  onRecusar,
  onAprovarEPublicar,
}: {
  troca: SolicitacaoTrocaReal;
  alertasHipoteticos: AlertaEscala[];
  motivoRecusa: string;
  processando: boolean;
  erro: string;
  onMudarMotivoRecusa: (valor: string) => void;
  onFechar: () => void;
  onRecusar: () => void;
  onAprovarEPublicar: () => void;
}) {
  const podeDecidir = troca.status === 'PENDENTE_GESTOR';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal troca-modal troca-gestor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="troca-gestor-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">{ROTULO_STATUS_TROCA[troca.status]}</p>
            <h2 id="troca-gestor-title">{troca.solicitanteNome} ⇄ {troca.destinatarioNome}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="troca-comparacao">
          <div>
            <small>{troca.solicitanteNome}</small>
            <strong>{formatarDataCurta(troca.data)}</strong>
            <span className="shift-chip" data-code={troca.turnoSolicitanteAntes || ''}>
              {troca.turnoSolicitanteAntes || '—'}
            </span>
            <small>{troca.horarioSolicitanteAntes || 'Sem horário'}</small>
          </div>
          <ArrowLeftRight size={18} />
          <div>
            <small>{troca.destinatarioNome}</small>
            <strong>{formatarDataCurta(troca.data)}</strong>
            <span className="shift-chip" data-code={troca.turnoDestinatarioAntes || ''}>
              {troca.turnoDestinatarioAntes || '—'}
            </span>
            <small>{troca.horarioDestinatarioAntes || 'Sem horário'}</small>
          </div>
        </div>

        {troca.mensagemSolicitante && <p className="troca-mensagem">“{troca.mensagemSolicitante}”</p>}

        {alertasHipoteticos.length > 0 && (
          <div className="alert warning">
            <strong>
              Essa troca pode causar {alertasHipoteticos.length === 1 ? '1 inconsistência' : `${alertasHipoteticos.length} inconsistências`}
            </strong>
            <ul>
              {alertasHipoteticos.map((alerta, indice) => (
                <li key={indice}>
                  {alerta.tipo === 'SEQUENCIA_6X1'
                    ? `${alerta.login} passaria a ter 7 dias consecutivos de trabalho (crítico em ${formatarDataCurta(alerta.diaCritico)}).`
                    : `${alerta.login} teria menos de 11h de descanso entre ${formatarDataCurta(alerta.dataAnterior)} e ${formatarDataCurta(alerta.dataAtual)}.`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {troca.motivoRecusa && (
          <div className="alert error">
            <strong>Motivo da recusa</strong>
            <p>{troca.motivoRecusa}</p>
          </div>
        )}

        <div className="troca-historico">
          {(troca.historico ?? []).map((evento, indice) => (
            <div className="troca-historico-item" key={indice}>
              <span className="troca-historico-dot" />
              <div>
                <strong>{evento?.descricao || 'Atualização'}</strong>
                <small>
                  {formatarDataHoraSafe(evento?.em, 'Data não registrada')}
                  {evento?.porNome ? ` · ${evento.porNome}` : ''}
                </small>
              </div>
            </div>
          ))}
        </div>

        {podeDecidir && (
          <label className="publication-reason">
            Motivo (obrigatório só se recusar)
            <textarea
              value={motivoRecusa}
              onChange={(evento) => onMudarMotivoRecusa(evento.target.value)}
              placeholder="Ex.: causaria descanso insuficiente para o colaborador."
              maxLength={280}
            />
          </label>
        )}

        {erro && <div className="alert error" role="alert">{erro}</div>}

        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Fechar</button>
          {podeDecidir && (
            <>
              <button className="secondary-button troca-recusar-button" type="button" disabled={processando} onClick={onRecusar}>
                <Ban size={16} /> Recusar
              </button>
              <button className="primary-button" type="button" disabled={processando} onClick={onAprovarEPublicar}>
                <Send size={16} /> {processando ? 'Publicando…' : 'Aprovar e publicar'}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function formularioLembreteInicial(dataHoje: string, lembreteEmEdicao?: LembreteAtribuidoPersistido): FormularioLembrete {
  if (lembreteEmEdicao === undefined) {
    return { titulo: '', descricao: '', datas: [dataHoje], diaInteiro: false, horaInicio: '', horaFim: '' };
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

/**
 * Formulário de criação/edição de um lembrete atribuído. Colaborador é
 * sempre fixo (pré-selecionado pela linha de origem, nunca um <select> que
 * permitiria trocar silenciosamente para alguém fora do escopo). Autoria
 * (`criadoPorLogin`/`criadoPorNome`) nunca é campo de formulário — vem do
 * `usuarioReal` autenticado, no `onSalvarUnico`/`onSalvarSerie` do chamador.
 */
function ModalAtribuirLembrete({
  colaborador,
  modo,
  lembreteEmEdicao,
  dataHoje,
  onFechar,
  onSalvarUnico,
  onSalvarSerie,
}: {
  colaborador: Usuario;
  modo: 'criar' | 'editar';
  lembreteEmEdicao?: LembreteAtribuidoPersistido;
  dataHoje: string;
  onFechar: () => void;
  onSalvarUnico: (entrada: EntradaLembrete) => Promise<void>;
  onSalvarSerie: (entrada: EntradaSerieLembrete) => Promise<void>;
}) {
  const [form, setForm] = useState<FormularioLembrete>(() => formularioLembreteInicial(dataHoje, lembreteEmEdicao));
  const [novaData, setNovaData] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  useTeclaEsc(onFechar);

  const viraDia = !form.diaInteiro && normalizarHorarioLembrete({
    diaInteiro: false,
    horaInicio: form.horaInicio || null,
    horaFim: form.horaFim || null,
  }).viraDia;

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

  async function aoClicarSalvar() {
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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atribuir-lembrete-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">{modo === 'criar' ? 'Novo lembrete atribuído' : 'Editar lembrete atribuído'}</p>
            <h2 id="atribuir-lembrete-title">{colaborador.nome}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <p className="admin-form-preview admin-form-full">
          Colaborador: <strong>{colaborador.nome}</strong> ({colaborador.login})
        </p>

        <div className="admin-form-grid">
          <label className="admin-form-full" htmlFor="atribuir-lembrete-titulo">
            Título
            <input
              id="atribuir-lembrete-titulo"
              autoFocus
              maxLength={LIMITE_TITULO_LEMBRETE}
              placeholder="Ex.: Treinamento técnico"
              value={form.titulo}
              onChange={(evento) => setForm((atual) => ({ ...atual, titulo: evento.target.value }))}
            />
          </label>

          <label htmlFor="atribuir-lembrete-data">
            Data
            <input
              id="atribuir-lembrete-data"
              type="date"
              value={form.datas[0] ?? ''}
              onChange={(evento) => setForm((atual) => ({ ...atual, datas: [evento.target.value, ...atual.datas.slice(1)] }))}
            />
          </label>

          <label className="checkbox-row" htmlFor="atribuir-lembrete-dia-inteiro">
            <input
              id="atribuir-lembrete-dia-inteiro"
              type="checkbox"
              checked={form.diaInteiro}
              onChange={(evento) => setForm((atual) => ({ ...atual, diaInteiro: evento.target.checked }))}
            />
            <span>Dia inteiro</span>
          </label>

          {!form.diaInteiro && (
            <>
              <label htmlFor="atribuir-lembrete-hora-inicio">
                Hora inicial
                <input
                  id="atribuir-lembrete-hora-inicio"
                  type="time"
                  value={form.horaInicio}
                  onChange={(evento) => setForm((atual) => ({ ...atual, horaInicio: evento.target.value }))}
                />
              </label>
              <label htmlFor="atribuir-lembrete-hora-fim">
                Hora final (opcional)
                <input
                  id="atribuir-lembrete-hora-fim"
                  type="time"
                  value={form.horaFim}
                  onChange={(evento) => setForm((atual) => ({ ...atual, horaFim: evento.target.value }))}
                />
              </label>
            </>
          )}

          {viraDia && <p className="admin-form-full lembrete-vira-dia-aviso">Termina no dia seguinte</p>}

          <label className="admin-form-full" htmlFor="atribuir-lembrete-descricao">
            Descrição (opcional)
            <textarea
              id="atribuir-lembrete-descricao"
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
                    {data}
                    <button type="button" onClick={() => removerData(data)} aria-label={`Remover data ${data}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="alias-editor-add lembrete-datas-adicionais-add">
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
          <button className="secondary-button" type="button" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="primary-button" type="button" onClick={() => void aoClicarSalvar()} disabled={salvando}>
            <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Lista de lembretes atribuídos de UM colaborador — nunca mostra nem
 * consulta lembretes pessoais (ver docs/spec/LEMBRETES.md, privacidade).
 * Cancelamento aqui só abre a confirmação (`onPedirCancelamento`); a
 * confirmação em si é o bloco `lembreteParaCancelar` no render principal,
 * mesmo padrão de "descartar rascunho" já usado neste arquivo.
 */
function ModalLembretesAtribuidos({
  colaborador,
  itens,
  carregando,
  erro,
  filtro,
  onMudarFiltro,
  onNovoLembrete,
  onEditar,
  onPedirCancelamento,
  onFechar,
}: {
  colaborador: Usuario;
  itens: LembreteAtribuidoPersistido[];
  carregando: boolean;
  erro: string;
  filtro: 'ATIVOS' | 'TODOS';
  onMudarFiltro: (filtro: 'ATIVOS' | 'TODOS') => void;
  onNovoLembrete: () => void;
  onEditar: (lembrete: LembreteAtribuidoPersistido) => void;
  onPedirCancelamento: (lembrete: LembreteAtribuidoPersistido) => void;
  onFechar: () => void;
}) {
  useTeclaEsc(onFechar);
  const visiveis = filtro === 'ATIVOS' ? itens.filter((item) => item.status === 'ATIVO') : itens;
  const ordenados = ordenarLembretes(visiveis);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lembretes-atribuidos-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Lembretes atribuídos</p>
            <h2 id="lembretes-atribuidos-title">{colaborador.nome}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="segmented-control" aria-label="Filtro de lembretes atribuídos">
          <button
            type="button"
            className={filtro === 'ATIVOS' ? 'active' : ''}
            onClick={() => onMudarFiltro('ATIVOS')}
            aria-pressed={filtro === 'ATIVOS'}
          >
            Ativos
          </button>
          <button
            type="button"
            className={filtro === 'TODOS' ? 'active' : ''}
            onClick={() => onMudarFiltro('TODOS')}
            aria-pressed={filtro === 'TODOS'}
          >
            Todos
          </button>
        </div>

        {erro && <div className="alert error" role="alert">{erro}</div>}

        {!erro && (
        <div className="lembretes-atribuidos-lista">
          {carregando ? (
            <div className="notification-empty"><LoaderCircle className="spin" size={20} /><span>Carregando…</span></div>
          ) : ordenados.length === 0 ? (
            <div className="notification-empty">
              <Bell size={22} />
              <span>Nenhum lembrete atribuído {filtro === 'ATIVOS' ? 'ativo' : ''} para este colaborador.</span>
            </div>
          ) : ordenados.map((item) => (
            <div
              key={item.lembreteId}
              className={item.status === 'ATIVO' ? 'lembrete-atribuido-linha' : 'lembrete-atribuido-linha lembrete-atribuido-linha-cancelado'}
            >
              <LembreteCard item={item} onSelecionar={() => item.status === 'ATIVO' && onEditar(item)} />
              <div className="lembrete-atribuido-linha-meta">
                <span className={`status-badge ${item.status === 'ATIVO' ? 'success' : 'neutral'}`}>
                  {item.status === 'ATIVO' ? 'Ativo' : 'Cancelado'}
                </span>
                {item.status === 'ATIVO' && (
                  <button
                    type="button"
                    className="icon-button"
                    title="Cancelar lembrete"
                    onClick={() => onPedirCancelamento(item)}
                  >
                    <Ban size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        )}

        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Fechar</button>
          <button className="primary-button" type="button" onClick={onNovoLembrete}>
            <Plus size={16} /> Atribuir lembrete
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Fase ESCALAS-UX-2A — sub-navegação local de "Administração" (§ 11 de
 * `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`): "Organização" é o conteúdo já
 * existente em `tela === 'administracao'`; "Grupos de Plantão" é o mesmo
 * conteúdo já existente em `tela === 'plantoes'` (renomeado apenas na UI —
 * nenhuma mudança de lógica). Reaproveita `.segmented-control` (mesmo
 * padrão já usado nos filtros de Trocas) — nunca uma segunda sidebar
 * dentro da sidebar. A aba "Grupos de Plantão" só aparece para quem já
 * podia acessar a antiga tela "Plantões" (`podeAcessarPlantoes`).
 */
function AdministracaoSubnav({
  aba,
  podeAcessarPlantoes,
  onEscolherAba,
}: {
  aba: 'organizacao' | 'plantao' | 'responsaveis';
  podeAcessarPlantoes: boolean;
  onEscolherAba: (aba: 'organizacao' | 'plantao' | 'responsaveis') => void;
}) {
  return (
    <div className="segmented-control administracao-subnav" aria-label="Áreas de Administração">
      <button
        type="button"
        aria-current={aba === 'organizacao' ? 'page' : undefined}
        className={aba === 'organizacao' ? 'active' : ''}
        onClick={() => onEscolherAba('organizacao')}
      >
        Organização
      </button>
      {podeAcessarPlantoes && (
        <button
          type="button"
          aria-current={aba === 'plantao' ? 'page' : undefined}
          className={aba === 'plantao' ? 'active' : ''}
          onClick={() => onEscolherAba('plantao')}
        >
          Grupos de Plantão
        </button>
      )}
      <button
        type="button"
        aria-current={aba === 'responsaveis' ? 'page' : undefined}
        className={aba === 'responsaveis' ? 'active' : ''}
        onClick={() => onEscolherAba('responsaveis')}
      >
        Responsáveis por escala
      </button>
    </div>
  );
}

/**
 * Fase ESCALAS-UX-1B — "+ Nova escala". Duas etapas num único modal (nunca
 * dois diálogos separados, para caber na "regra dos três passos" do § 43
 * da fase: 1. escolha o tipo, 2. escolha grupo/competência, 3. o Editor em
 * si). Etapa `'tipo'`: Escala de jornada (roteia para "Importar", fluxo 6x1
 * já existente, sem nenhum código novo de 6x1) ou Plantão (avança para a
 * etapa `'plantao'`). Etapa `'plantao'`: Grupo (só os que o usuário
 * administra) + Competência (AAAA-MM, janela 26→25) + "Como começar?"
 * (Criar escala vazia ou Importar planilha — as duas terminam no MESMO
 * Editor). Nunca pede timezone/ACL/contatos aqui — isso é configuração do
 * Grupo, não da escala mensal (§ 9/§ 11 da fase).
 */
type AbaPreviaPlantao = 'calendario' | 'resumo' | 'plantoes' | 'contabilidade' | 'vinculos';

interface PreviewPlantaoProps {
  /**
   * Fase ESCALAS-UX-1B — `null` para origem MANUAL (escala criada vazia,
   * sem nenhuma planilha): nunca uma `ResultadoParsePlantao` XLS fingida
   * com números 0/0/0. Todo o painel de "Fonte original"/divergências só
   * renderiza quando `resultado !== null`.
   */
  resultado: ResultadoParsePlantao | null;
  origem: OrigemPlantao;
  nomeArquivo: string;
  participantes: ParticipanteConsolidadoPlantao[];
  atribuicoes: AtribuicaoPlantaoComVinculo[];
  vinculos: VinculoPlantao[];
  usuarios: Usuario[];
  aba: AbaPreviaPlantao;
  onMudarAba: (aba: AbaPreviaPlantao) => void;
  buscaPorParticipante: Record<string, string>;
  onMudarBusca: (participanteNomeOriginal: string, termo: string) => void;
  onConfirmarVinculo: (participanteNomeOriginal: string, usuario: Usuario) => void;
  onDesfazerVinculo: (participanteNomeOriginal: string) => void;
  /** Fase PLANTÃO-3B.1 — as três camadas de verdade + divergências entre elas, nunca uma reconciliação. `null` junto com `resultado`. */
  conferencia: ConferenciaContabilPlantao | null;
  pendencias: number;
  podeValidar: boolean;
  validada: boolean;
  onValidar: () => void;
  onIrParaUsuarios: () => void;
  /**
   * Fase ESCALAS-UX-1A — o Editor visual. `atribuicoesEditaveis` é a
   * WORKING COPY (nunca `resultado.atribuicoes`, que fica congelado para a
   * "Conferência da fonte"); o calendário, o "Resumo do editor" e a
   * "Conferência da escala editada" derivam todos dela, nunca do XLS
   * declarado.
   */
  atribuicoesEditaveis: AtribuicaoPlantaoEditavel[];
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  dataHoje: string;
  editadoDesdeImportacao: boolean;
  onEditarAtribuicao: (idLocal: string) => void;
  /**
   * Fase ESCALAS-UX-1C — "distribuição rápida por clique": seleção
   * PURAMENTE de UI (nunca grava no Firestore, nunca altera o Grupo).
   * `null` significa nenhuma pessoa selecionada. Ver §19-21/§26-30.
   */
  plantonistaSelecionado: string | null;
  onSelecionarPlantonista: (nomeOriginal: string) => void;
  /** Fase ESCALAS-UX-2B — operação comum de criação (click e drag convergem aqui, ver `solicitarNovaAtribuicaoPlantao`). */
  onSolicitarNovaAtribuicao: (plantonistaNomeOriginal: string, dataIso: string) => void;
  /** Nomes normalizados (`normalizarNome`) de participantes inativos referenciados por alguma atribuição — para o roster mostrar "Inativo" sem esconder a escala. */
  nomesInativosPlantao: ReadonlySet<string>;
  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — `true` quando o Plantão em contexto é
   * só consultável pela equipe (autovínculo de consulta, nunca
   * administração). Além de repassar `modo="consulta"` ao calendário
   * (bloqueia clique em atribuição/criação — ver `PlantaoCalendario`), os
   * CALLBACKS de escrita (`onEditarAtribuicao`/`onSolicitarNovaAtribuicao`)
   * já chegam como no-op do chamador quando isto é `true` — dupla
   * proteção, nunca uma escrita alcança este componente por engano.
   */
  somenteConsulta?: boolean;
}

/**
 * Preview de Plantão (Fase PLANTÃO-2). Nunca persiste — "Validar prévia"
 * só confirma que a leitura e os vínculos estão completos em memória (ver
 * `docs/spec/PLANTOES.md`). Reaproveita o Design System já usado pelo
 * preview 6x1 (`.panel`, `.status-badge`, `.data-table`/`.table-scroll`,
 * `.segmented-control`, `.conciliation-table`/`.conciliation-actions`) —
 * nenhum componente visual novo, só uma composição nova dessas classes.
 */
function PreviewPlantao({
  resultado,
  origem,
  nomeArquivo,
  participantes,
  atribuicoes,
  vinculos,
  usuarios,
  aba,
  onMudarAba,
  buscaPorParticipante,
  onMudarBusca,
  onConfirmarVinculo,
  onDesfazerVinculo,
  conferencia,
  pendencias,
  podeValidar,
  validada,
  onValidar,
  onIrParaUsuarios,
  atribuicoesEditaveis,
  competencia,
  periodoInicio,
  periodoFim,
  dataHoje,
  editadoDesdeImportacao,
  onEditarAtribuicao,
  plantonistaSelecionado,
  onSelecionarPlantonista,
  onSolicitarNovaAtribuicao,
  nomesInativosPlantao,
  somenteConsulta = false,
}: PreviewPlantaoProps) {
  const vinculoPorParticipante = new Map(vinculos.map((vinculo) => [vinculo.participanteNomeOriginal, vinculo]));
  const nomesPendentesPlantao = new Set(
    vinculos.filter((vinculo) => vinculo.status !== 'VINCULADO').map((vinculo) => normalizarNome(vinculo.participanteNomeOriginal)),
  );
  const conferenciaEscalaAtual = conferirEscalaAtualPlantao(atribuicoesEditaveis, duracaoPlantaoAtipica);
  const resumoPorPessoa = resumirPorPessoa(
    atribuicoesEditaveis,
    participantes.map((participante) => ({ nomeOriginal: participante.nomeOriginal })),
  );
  const totalAlertasEditor = conferenciaEscalaAtual.quantidadeDuracoesAtipicas
    + conferenciaEscalaAtual.sobreposicoes.length
    + pendencias;
  const primeiraAtipica = atribuicoesEditaveis.find((atribuicao) => duracaoPlantaoAtipica(atribuicao.duracaoMinutos));

  return (
    <>
      <article className="panel plantao-resumo-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">{resultado === null ? 'Escala de Plantão' : 'Planilha de Plantão detectada'}</p>
            {/*
             * Fase ESCALAS-UX-1C — `origem === 'COPIADO'` também tem
             * `resultado === null` (nunca uma fonte XLS fingida): mostra
             * uma indicação de UI, sem qualquer metadado novo no schema
             * (§38 da fase — "Baseada na competência anterior" é só texto).
             */}
            <h2>{origem === 'MANUAL' ? 'Escala criada manualmente' : (origem === 'COPIADO' ? 'Escala baseada na competência anterior' : nomeArquivo)}</h2>
            {resultado !== null && <p>Aba de origem: {resultado.abaOrigem}</p>}
          </div>
          {resultado !== null && (
            <span className={`status-badge ${resultado.ok ? 'success' : 'danger'}`}>
              {resultado.ok ? 'Sem erros estruturais' : `${resultado.erros.length} erro(s)`}
            </span>
          )}
          {somenteConsulta && (
            <span className="status-badge warning" title="Sua equipe monitora este Plantão — só consulta, sem poder de edição/importação/publicação">
              Somente consulta
            </span>
          )}
        </div>
        {resultado !== null && conferencia !== null ? (
          <div className="import-summary plantao-resumo-grid">
            <div><span>Intervalos encontrados</span><strong>{conferencia.bruto.quantidade}</strong></div>
            <div><span>Duração literal dos intervalos</span><strong>{formatarMinutos(conferencia.bruto.minutos)}</strong></div>
            <div>
              <span>Contabilidade por plantonista</span>
              <strong>
                {resultado.contabilidadeInformada.length > 0
                  ? `${conferencia.somaContabilidadeInformada.quantidade} plantões · ${formatarMinutos(conferencia.somaContabilidadeInformada.minutos)}`
                  : 'Não informada na fonte'}
              </strong>
            </div>
            <div>
              <span>Total declarado na planilha</span>
              <strong>
                {conferencia.declarado
                  ? `${conferencia.declarado.totalPlantoesInformado} plantões · ${formatarMinutos(conferencia.declarado.totalMinutosInformado)}`
                  : 'Não informado na fonte'}
              </strong>
            </div>
          </div>
        ) : (
          <p>Não há planilha de origem para conferir aqui — ver &ldquo;Escala atual&rdquo; na aba Contabilidade.</p>
        )}
        <div className="import-actions">
          <span className={`status-badge ${pendencias === 0 ? 'success' : 'warning'}`}>
            {pendencias === 0 ? 'Todos os participantes vinculados' : `${pendencias} vínculo(s) pendente(s)`}
          </span>
          <button
            className="primary-button"
            type="button"
            disabled={!podeValidar}
            onClick={onValidar}
          >
            <CheckCircle2 size={17} /> Validar prévia
          </button>
        </div>
        {validada && (
          <p className="plantao-validado-nota">
            <ShieldCheck size={15} /> Prévia validada. Nenhum dado de Plantão foi publicado.
          </p>
        )}
      </article>

      {conferencia !== null && conferencia.divergencias.length > 0 && (
        conferencia.divergencias.some((divergencia) => divergencia.divergente) ? (
          <article className="panel warning-panel">
            <div className="panel-title">
              <div>
                <h2>Divergências encontradas na fonte</h2>
              </div>
              <AlertTriangle className="warning-icon" />
            </div>
            <ul className="warning-list">
              {conferencia.divergencias
                .filter((divergencia) => divergencia.divergente)
                .map((divergencia) => <li key={divergencia.chave}>{descreverDivergenciaPlantao(divergencia)}</li>)}
            </ul>
            <p>Nenhum valor foi corrigido automaticamente — conferência necessária antes de qualquer decisão operacional.</p>
          </article>
        ) : (
          <article className="panel">
            <div className="panel-title"><div><h2>Conferência consistente</h2></div></div>
            <p className="plantao-validado-nota">
              <ShieldCheck size={15} /> As camadas de contabilidade da fonte coincidem entre si.
            </p>
          </article>
        )
      )}

      <article className="panel">
        <div className="segmented-control" aria-label="Seções da prévia de Plantão">
          <button type="button" className={aba === 'calendario' ? 'active' : ''} aria-pressed={aba === 'calendario'} onClick={() => onMudarAba('calendario')}>Calendário</button>
          <button type="button" className={aba === 'resumo' ? 'active' : ''} aria-pressed={aba === 'resumo'} onClick={() => onMudarAba('resumo')}>Resumo</button>
          <button type="button" className={aba === 'plantoes' ? 'active' : ''} aria-pressed={aba === 'plantoes'} onClick={() => onMudarAba('plantoes')}>Lista</button>
          <button type="button" className={aba === 'contabilidade' ? 'active' : ''} aria-pressed={aba === 'contabilidade'} onClick={() => onMudarAba('contabilidade')}>Contabilidade</button>
          <button type="button" className={aba === 'vinculos' ? 'active' : ''} aria-pressed={aba === 'vinculos'} onClick={() => onMudarAba('vinculos')}>
            Vínculos{pendencias > 0 ? ` (${pendencias})` : ''}
          </button>
        </div>

        {aba === 'calendario' && (
          <div className="plantao-editor-calendario">
            <div className="import-summary plantao-resumo-grid">
              <div><span>Plantonistas</span><strong>{conferenciaEscalaAtual.quantidadePessoas}</strong></div>
              <div><span>Plantões</span><strong>{atribuicoesEditaveis.length}</strong></div>
              <div><span>Horas atuais</span><strong>{formatarMinutos(conferenciaEscalaAtual.bruto.minutos)}</strong></div>
              <div><span>Alertas</span><strong>{totalAlertasEditor}</strong></div>
            </div>
            <p className={`plantao-estado-edicao ${editadoDesdeImportacao ? 'sujo' : 'limpo'}`}>
              {editadoDesdeImportacao
                ? 'Alterações não salvas'
                : (resultado === null ? 'Nenhuma alteração desde a criação' : 'Nenhuma alteração desde a importação')}
            </p>
            {pendencias > 0 && (
              <div className="import-actions plantao-vinculo-pendente-banner">
                <span className="status-badge warning">{pendencias} usuário(s) precisam ser vinculados</span>
                <button type="button" className="secondary-button compact-button" onClick={() => onMudarAba('vinculos')}>
                  <Link2 size={14} /> Resolver vínculos
                </button>
              </div>
            )}
            {totalAlertasEditor > 0 && (
              <ul className="warning-list plantao-alertas-clicaveis">
                {conferenciaEscalaAtual.quantidadeDuracoesAtipicas > 0 && (
                  <li>
                    <button
                      type="button"
                      className="alert-item-button"
                      onClick={() => primeiraAtipica && onEditarAtribuicao(primeiraAtipica.idLocal)}
                    >
                      ⚠ {conferenciaEscalaAtual.quantidadeDuracoesAtipicas} duração(ões) atípica(s)
                    </button>
                  </li>
                )}
                {conferenciaEscalaAtual.sobreposicoes.length > 0 && (
                  <li>⚠ {conferenciaEscalaAtual.sobreposicoes.length} sobreposição(ões) de horário</li>
                )}
                {pendencias > 0 && (
                  <li>
                    <button type="button" className="alert-item-button" onClick={() => onMudarAba('vinculos')}>
                      ⚠ {pendencias} usuário(s) sem vínculo
                    </button>
                  </li>
                )}
              </ul>
            )}
            {plantonistaSelecionado !== null && (
              <p className="plantao-selecao-ativa">
                Adicionando plantões para <strong>{plantonistaSelecionado}</strong> — toque um dia vazio no
                calendário, ou{' '}
                <button type="button" className="link-button" onClick={() => onSelecionarPlantonista(plantonistaSelecionado)}>
                  cancelar seleção
                </button>
                .
              </p>
            )}
            {/*
             * Fase ESCALAS-UX-2B — roster lateral substitui o antigo bloco
             * "Resumo por pessoa" abaixo do calendário (§7 do pedido): a
             * mesma informação (`resumoPorPessoa`, nenhum recálculo) agora
             * vive ao lado, sempre visível, sem duplicar a lista embaixo.
             */}
            <div className={`plantao-editor-layout${resultado !== null ? ' plantao-editor-layout-importacao' : ''}`}>
              {resultado === null && (
                <PlantaoRoster
                  pessoas={resumoPorPessoa}
                  plantonistaSelecionado={plantonistaSelecionado}
                  onSelecionarPlantonista={onSelecionarPlantonista}
                  nomesInativos={nomesInativosPlantao}
                  nomesPendentes={nomesPendentesPlantao}
                />
              )}
              <div className="plantao-editor-central">
                {periodoInicio !== '' && periodoFim !== '' ? (
                  <PlantaoCalendario
                    competencia={competencia}
                    periodoInicio={periodoInicio}
                    periodoFim={periodoFim}
                    dataHoje={dataHoje}
                    atribuicoes={atribuicoesEditaveis}
                    onEditarAtribuicao={onEditarAtribuicao}
                    plantonistaSelecionado={plantonistaSelecionado}
                    modo={somenteConsulta ? 'consulta' : (resultado !== null ? 'importacao' : 'editor')}
                    onSolicitarNovaAtribuicao={onSolicitarNovaAtribuicao}
                  />
                ) : (
                  <p>Não foi possível calcular a competência desta planilha — confira as datas na aba Lista.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {aba === 'resumo' && (
          <div className="plantao-resumo-conteudo">
            {resultado === null ? (
              <p>Não houve leitura de planilha nesta escala — não há erro ou aviso estrutural aqui.</p>
            ) : (
              <>
                {resultado.erros.length > 0 && (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead><tr><th>Local</th><th>Plantonista</th><th>Valor</th><th>Motivo</th></tr></thead>
                      <tbody>
                        {resultado.erros.map((erro: ErroImportacaoPlantao, indice) => (
                          <tr key={`${erro.linha}-${erro.coluna}-${indice}`}>
                            <td>{erro.coluna}{erro.linha}</td>
                            <td>{erro.plantonistaNomeOriginal ?? '—'}</td>
                            <td><code>{erro.valorEncontrado}</code></td>
                            <td>{erro.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {resultado.avisos.length > 0 && (
                  <ul className="warning-list">
                    {resultado.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
                  </ul>
                )}
                {resultado.erros.length === 0 && resultado.avisos.length === 0 && (
                  <p>Nenhum erro ou aviso estrutural na leitura desta planilha.</p>
                )}
              </>
            )}
          </div>
        )}

        {aba === 'plantoes' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Plantonista</th><th>Início</th><th>Fim</th><th>Duração</th><th>Vínculo</th></tr>
              </thead>
              <tbody>
                {atribuicoes.map((atribuicao, indice) => (
                  <tr key={`${atribuicao.plantonistaNomeOriginal}-${indice}`}>
                    <td>{atribuicao.plantonistaNomeOriginal}</td>
                    <td>{formatarMomentoPlantao(atribuicao.inicio)}</td>
                    <td>{formatarMomentoPlantao(atribuicao.fim)}</td>
                    <td>
                      {formatarMinutos(atribuicao.duracaoMinutos)}
                      {duracaoPlantaoAtipica(atribuicao.duracaoMinutos) && (
                        <span className="status-badge neutral">duração atípica</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_VINCULO_PLANTAO_BADGE[atribuicao.statusVinculo]}`}>
                        {STATUS_VINCULO_PLANTAO_LABEL[atribuicao.statusVinculo]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === 'contabilidade' && (
          <>
            <div className="plantao-conferencia-escala-atual">
              <h3>Escala atual (working copy editada)</h3>
              <p>Recalculada a partir do que está no calendário/lista agora — nunca comparada automaticamente com a fonte.</p>
              <div className="import-summary plantao-resumo-grid">
                <div><span>Plantonistas</span><strong>{conferenciaEscalaAtual.quantidadePessoas}</strong></div>
                <div><span>Plantões</span><strong>{atribuicoesEditaveis.length}</strong></div>
                <div><span>Horas atuais</span><strong>{formatarMinutos(conferenciaEscalaAtual.bruto.minutos)}</strong></div>
                <div><span>Durações atípicas</span><strong>{conferenciaEscalaAtual.quantidadeDuracoesAtipicas}</strong></div>
              </div>
            </div>
            {resultado !== null && conferencia !== null ? (
              <>
                <h3>Fonte original (contabilidade declarada na planilha)</h3>
                <p>Estes valores representam o arquivo importado original.</p>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Plantonista</th><th>Plantões informados</th><th>Horas informadas</th></tr></thead>
                    <tbody>
                      {resultado.contabilidadeInformada.map((linha) => (
                        <tr key={linha.plantonistaNomeOriginal}>
                          <td>{linha.plantonistaNomeOriginal}</td>
                          <td>{linha.quantidadeInformada}</td>
                          <td>{formatarMinutos(linha.minutosInformados)}</td>
                        </tr>
                      ))}
                      {resultado.contabilidadeInformada.length === 0 && (
                        <tr><td colSpan={3}>Esta planilha não tem a seção de contabilidade informada.</td></tr>
                      )}
                    </tbody>
                    {resultado.contabilidadeInformada.length > 0 && (
                      <tfoot>
                        <tr>
                          <td><strong>Soma das linhas</strong></td>
                          <td><strong>{conferencia.somaContabilidadeInformada.quantidade}</strong></td>
                          <td><strong>{formatarMinutos(conferencia.somaContabilidadeInformada.minutos)}</strong></td>
                        </tr>
                        <tr>
                          <td><strong>Total declarado na planilha</strong></td>
                          <td><strong>{conferencia.declarado ? conferencia.declarado.totalPlantoesInformado : 'Não informado na fonte'}</strong></td>
                          <td><strong>{conferencia.declarado ? formatarMinutos(conferencia.declarado.totalMinutosInformado) : 'Não informado na fonte'}</strong></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            ) : (
              <p>Não há contabilidade de planilha para conferir nesta escala.</p>
            )}
          </>
        )}

        {aba === 'vinculos' && (
          <div className="table-scroll">
            <table className="data-table conciliation-table">
              <thead>
                <tr><th>Participante</th><th>Encontrado na planilha</th><th>Vincular a</th><th>Status</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {participantes.map((participante) => {
                  const vinculo = vinculoPorParticipante.get(participante.nomeOriginal);
                  if (vinculo === undefined) {
                    return null;
                  }
                  const termo = buscaPorParticipante[participante.nomeOriginal] ?? '';
                  const resultadosBusca = termo.trim() === '' ? [] : buscarUsuariosPlantao(usuarios, termo).slice(0, 6);
                  return (
                    <tr key={participante.nomeOriginal} data-status={vinculo.status}>
                      <td>{participante.nomeOriginal}</td>
                      <td>
                        <div className="plantao-vinculo-celula">
                          {participante.quantidadeAtribuicoes > 0 && (
                            <span>{participante.quantidadeAtribuicoes} atribuição(ões)</span>
                          )}
                          {participante.apareceNaContabilidade && (
                            <small>
                              Consta na contabilidade informada
                              {participante.quantidadeInformada === 0 ? ' (0 plantões)' : ''}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="plantao-vinculo-celula">
                        {vinculo.login === null ? (
                          <>
                            <label className="plantao-busca-linha">
                              <Search size={14} />
                              <input
                                value={termo}
                                onChange={(evento) => onMudarBusca(participante.nomeOriginal, evento.target.value)}
                                placeholder="Pesquisar por nome ou login…"
                                aria-label={`Buscar usuário para vincular a ${participante.nomeOriginal}`}
                              />
                            </label>
                            {resultadosBusca.length > 0 && (
                              <ul className="plantao-busca-resultados">
                                {resultadosBusca.map((candidato) => (
                                  <li key={candidato.login}>
                                    <button
                                      type="button"
                                      className="secondary-button compact-button"
                                      onClick={() => onConfirmarVinculo(participante.nomeOriginal, candidato)}
                                    >
                                      {candidato.nome} ({candidato.login}){candidato.ativo ? '' : ' — inativo'}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {vinculo.sugestao !== null && (
                              <button
                                type="button"
                                className="secondary-button compact-button"
                                title={`Sugestão: ${vinculo.sugestao.nome} (${vinculo.sugestao.login})`}
                                onClick={() => {
                                  const escolhido = usuarios.find((item) => item.login === vinculo.sugestao?.login);
                                  if (escolhido !== undefined) {
                                    onConfirmarVinculo(participante.nomeOriginal, escolhido);
                                  }
                                }}
                              >
                                <Link2 size={14} /> Sugestão: {vinculo.sugestao.nome}
                              </button>
                            )}
                            {vinculo.status === 'USUARIO_NAO_ENCONTRADO' && (
                              <button type="button" className="secondary-button compact-button" onClick={onIrParaUsuarios}>
                                <UserPlus size={14} /> Ir para Usuários
                              </button>
                            )}
                          </>
                        ) : (
                          <strong>
                            {usuarios.find((item) => item.login === vinculo.login)?.nome ?? vinculo.login}
                            {' '}({vinculo.login})
                          </strong>
                        )}
                        {vinculo.status === 'CONFLITO' && (
                          <small className="plantao-conflito-aviso">
                            Este login já está vinculado a outro participante desta planilha.
                          </small>
                        )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${STATUS_VINCULO_PLANTAO_BADGE[vinculo.status]}`}>
                          {STATUS_VINCULO_PLANTAO_LABEL[vinculo.status]}
                        </span>
                      </td>
                      <td>
                        {vinculo.login !== null && (
                          <div className="conciliation-actions">
                            <button
                              className="icon-button"
                              type="button"
                              title="Desfazer vínculo"
                              onClick={() => onDesfazerVinculo(participante.nomeOriginal)}
                            >
                              <Ban size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}

export function DashboardApp() {
  /**
   * `usuarioReal` é sempre quem está de fato autenticado no Firebase Auth —
   * nunca muda por simulação. `simulando` é o gestor "vestido" pelo admin
   * (contexto de UI/operador, não re-autenticação real — ver
   * `iniciarSimulacao`/`sairDaSimulacao`). `usuarioEfetivo` é o que o resto
   * do componente lê para escopo de dados/permissões — em operação normal
   * (sem simulação) é idêntico a `usuarioReal`.
   */
  const [usuarioReal, setUsuarioReal] = useState<Usuario | null>(null);
  const [simulando, setSimulando] = useState<Usuario | null>(null);
  const usuarioEfetivo = simulando ?? usuarioReal;
  const [modoDemo, setModoDemo] = useState(true);
  const [tela, setTela] = useState<Tela>('escalas');
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [catalogo, setCatalogo] = useState(CATALOGO_SOC);
  const [resultado, setResultado] = useState<ResultadoParse | null>(null);
  const [arquivo, setArquivo] = useState<ArrayBuffer | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('Escala-SOC-Controle-Agosto.xls');
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [correcoes, setCorrecoes] = useState<Record<number, string>>({});
  const [filtroTurno, setFiltroTurno] = useState('TODOS');
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [celulaEditando, setCelulaEditando] = useState<CelulaEditando | null>(null);
  const [cicloInicial6x1Ativo, setCicloInicial6x1Ativo] = useState(false);
  const [historico, setHistorico] = useState<PublicacaoEscala[]>([]);
  const [revisaoAtual, setRevisaoAtual] = useState(0);
  const [revisaoParaRestaurar, setRevisaoParaRestaurar] = useState<PublicacaoEscala | null>(null);
  const [publicacaoPendente, setPublicacaoPendente] = useState(false);
  const [erroPublicacao, setErroPublicacao] = useState('');
  const [motivoPublicacao, setMotivoPublicacao] = useState('');
  const [publicacaoExpandida, setPublicacaoExpandida] = useState<string | null>(null);
  const [detalhesPublicacao, setDetalhesPublicacao] = useState<Record<string, EventoEscala[]>>({});
  const [linhasConciliacao, setLinhasConciliacao] = useState<LinhaConciliacao[]>([]);
  // --- Preview de Plantão (Fase PLANTÃO-2) — nunca persiste; só prévia em memória ---
  const [tipoArquivoDetectado, setTipoArquivoDetectado] = useState<'ESCALA_6X1' | 'PLANTAO' | 'DESCONHECIDA' | null>(null);
  const [motivoArquivoDesconhecido, setMotivoArquivoDesconhecido] = useState('');
  const [resultadoPlantao, setResultadoPlantao] = useState<ResultadoParsePlantao | null>(null);
  const [vinculosPlantao, setVinculosPlantao] = useState<VinculoPlantao[]>([]);
  const [previaPlantaoValidada, setPreviaPlantaoValidada] = useState(false);
  const [abaPreviaPlantao, setAbaPreviaPlantao] = useState<'calendario' | 'resumo' | 'plantoes' | 'contabilidade' | 'vinculos'>('calendario');
  const [buscaVinculoPlantao, setBuscaVinculoPlantao] = useState<Record<string, string>>({});
  /**
   * Fase ESCALAS-UX-1A — a WORKING COPY editável do Editor visual.
   * `resultadoPlantao.atribuicoes` continua congelado (fonte da
   * "Conferência da fonte"); esta é a ÚNICA fonte de verdade que o
   * calendário, a Lista, o "Resumo do editor" e o payload de
   * `salvarRascunhoPlantaoAcao()` consultam depois da importação —
   * "Importação não é um destino, é só uma forma de preencher o Editor".
   */
  const [atribuicoesEditaveisPlantao, setAtribuicoesEditaveisPlantao] = useState<AtribuicaoPlantaoEditavel[]>([]);
  const [plantaoEditadoDesdeImportacao, setPlantaoEditadoDesdeImportacao] = useState(false);
  /**
   * FASE ESCALAS-UX-2A.1-FIX — dirty state EXPLÍCITO de "alterações não
   * salvas" do Editor de Plantão, deliberadamente SEPARADO de
   * `plantaoEditadoDesdeImportacao` (que só significa "a working copy
   * divergiu do conteúdo importado", não "existe algo não persistido" — a
   * ESCALAS-UX-2A.1 reaproveitou aquele estado por engano como guard de
   * navegação; ver `CHECKPOINT-FASE-ESCALAS-UX-2A1-FIX-DIRTY.md`). `true`
   * sempre que nasce uma working copy ainda não persistida (importar XLS,
   * criar escala vazia, usar período anterior) ou sofre qualquer mutação
   * que seria perdida ao trocar de contexto (editar/adicionar/excluir
   * atribuição, confirmar/desfazer vínculo — ambos afetam o payload
   * salvo). `false` ao reabrir um rascunho já persistido ou logo após
   * salvar com sucesso; permanece `true` se salvar falhar. Único sinal que
   * o guard de troca de contexto pode ler para Plantão — NUNCA
   * `plantaoEditadoDesdeImportacao` (protegido por boundary test).
   */
  const [plantaoPossuiAlteracoesNaoSalvas, setPlantaoPossuiAlteracoesNaoSalvas] = useState(false);
  const [modalAtribuicaoPlantao, setModalAtribuicaoPlantao] = useState<
    { modo: 'criar' | 'editar'; idLocal: string | null; valoresIniciais: FormularioAtribuicaoPlantao } | null
  >(null);
  /**
   * Fase ESCALAS-UX-1B — de onde vem a prévia de Plantão ATUALMENTE aberta
   * no Editor: `'IMPORTADO'` (planilha, `resultadoPlantao` preenchido) ou
   * `'MANUAL'` (criada vazia por "+ Nova escala", `resultadoPlantao` fica
   * `null` — nunca uma fonte XLS fingida com números 0/0/0). `null` quando
   * não há nenhuma prévia de Plantão aberta.
   */
  const [origemPlantaoAtual, setOrigemPlantaoAtual] = useState<OrigemPlantao | null>(null);
  /**
   * Fase ESCALAS-UX-1C — "distribuição rápida por clique" (§19-21/§26-30):
   * seleção PURAMENTE de UI (nunca grava no Firestore, nunca altera o
   * Grupo). Reiniciada em TODA entrada nova no Editor (importar/criar
   * vazia/reabrir rascunho/usar período anterior) para nunca "vazar" a
   * seleção de uma prévia para a próxima.
   */
  const [plantonistaSelecionadoPlantao, setPlantonistaSelecionadoPlantao] = useState<string | null>(null);
  /**
   * Fase ESCALAS-UX-2B — confirmação contextual do padrão do Grupo
   * (`QuickAddPlantaoPopover`), aberta por `solicitarNovaAtribuicaoPlantao()`
   * quando existe `padraoHorarioSemanal` para o dia+pessoa escolhidos.
   * `null` = popover fechado. Nunca grava nada sozinho — só "Adicionar"
   * confirma a criação na working copy.
   */
  const [quickAddPlantao, setQuickAddPlantao] = useState<
    { plantonistaNomeOriginal: string; dataIso: string; padrao: PadraoHorarioPlantaoDia } | null
  >(null);

  /**
   * Fase ESCALAS-UX-2A.1 — `ContextoEscalaAtivo` (`lib/contextoEscala.ts`)
   * é a fonte de verdade explícita para "qual escala o usuário está
   * trabalhando agora" (`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 32) —
   * estado de FRONTEND, sessão apenas, nunca persistido no Firestore.
   * Sincronizado reativamente a partir do estado já existente de Jornada/
   * Plantão (nunca definido diretamente por cada ação de carregamento —
   * ver os `useEffect` de sincronização abaixo), nunca escolhido por
   * hardcode de equipe/grupo.
   */
  const [contextoEscalaAtivo, setContextoEscalaAtivo] = useState<ContextoEscalaAtivo | null>(null);
  /**
   * FASE ESCALAS-UX-2A.1-FIX — `true` sempre que existe uma working copy de
   * Jornada (`resultado`) que diverge do que está persistido/publicado:
   * importação recém-lida (mesmo sem nenhuma célula editada — importar não
   * é salvar), reprocessamento de conciliação/cadastro de faltantes (ainda
   * o mesmo arquivo importado), ou edição local de célula
   * (`editarCelula()`, único ponto de mutação direta de conteúdo). `false`
   * em toda substituição de `resultado` que já nasce sincronizada com uma
   * fonte confiável: carregamento remoto/demo, salvar/publicar com
   * sucesso, restaurar revisão, descartar, trocar de contexto, logout.
   * Único sinal que o guard de troca de contexto pode ler para Jornada —
   * ver `existeAlteracaoNaoSalvaNoContextoAtivo()`.
   */
  const [jornadaPossuiAlteracoesNaoSalvas, setJornadaPossuiAlteracoesNaoSalvas] = useState(false);
  /** Verdadeiro quando o contexto+competência selecionados não têm nenhuma escala (nunca criada automaticamente — § 16 do redesign). */
  const [contextoSemEscala, setContextoSemEscala] = useState(false);
  const [carregandoContexto, setCarregandoContexto] = useState(false);
  const [erroContextoEscala, setErroContextoEscala] = useState('');
  /**
   * Guarda de "alterações não salvas" (§ 24-§ 28 do redesign) — a MESMA
   * intenção pendente serve tanto para trocar de contexto quanto para
   * trocar de competência, nunca dois sistemas separados.
   */
  const [intencaoTrocaEscalaPendente, setIntencaoTrocaEscalaPendente] = useState<IntencaoTrocaEscala | null>(null);
  // --- "+ Nova escala" (Fase ESCALAS-UX-1B) — escolher tipo, depois grupo/competência de Plantão ---
  // Wizard único de início: Nova e Importar compartilham o mesmo contexto.
  const [wizardInicio, setWizardInicio] = useState<ScheduleStartWizardProps['modo'] | null>(null);
  const [wizardTipo, setWizardTipo] = useState<ScheduleStartWizardProps['tipo']>(null);
  const [wizardAreaId, setWizardAreaId] = useState('');
  const [wizardEquipeId, setWizardEquipeId] = useState('');
  const [wizardGrupoId, setWizardGrupoId] = useState('');
  const [wizardCompetencia, setWizardCompetencia] = useState(COMPETENCIA_ATUAL);
  const [wizardArquivoNome, setWizardArquivoNome] = useState('');
  const [wizardErro, setWizardErro] = useState('');
  const [wizardProcessando, setWizardProcessando] = useState(false);
  // --- Administração de Plantão (Fase PLANTÃO-3B) — Grupos/participantes/contatos/rascunho ---
  const [gruposPlantaoAdmin, setGruposPlantaoAdmin] = useState<GrupoPlantao[]>([]);
  const [participantesPorGrupoPlantao, setParticipantesPorGrupoPlantao] = useState<Record<string, ParticipantePlantao[]>>({});
  const [grupoPlantaoExpandido, setGrupoPlantaoExpandido] = useState<string | null>(null);
  const [erroPlantaoAdmin, setErroPlantaoAdmin] = useState('');
  /** Fase ESCOPO-CONSULTA-PLANTAO-1 — grupoId em processamento ao marcar/desmarcar um Plantão monitorado pela equipe (nunca dois ao mesmo tempo). */
  const [processandoConsultaPlantao, setProcessandoConsultaPlantao] = useState<string | null>(null);
  // --- Reabrir rascunho (Fase ESCALAS-UX-1B.1) ---
  const [rascunhosPlantaoPorGrupo, setRascunhosPlantaoPorGrupo] = useState<Record<string, CompetenciaPlantao[]>>({});
  /**
   * Estado transitório de "Abrir rascunho" — distingue carregando/erro/
   * não encontrado (§ 17-19 da fase): nunca abre o calendário vazio
   * enquanto a leitura está pendente, nunca confunde erro de permissão
   * com "não encontrado". `null` = nenhuma abertura em andamento.
   */
  const [abrirRascunhoPlantaoStatus, setAbrirRascunhoPlantaoStatus] = useState<
    { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'nao-encontrado' } | null
  >(null);
  /**
   * Carregamento de `equipesAdmin`/`unidadesAdmin` para o `OrganizationTeamPicker`
   * (Fase UI-ORG-1A) — inicia `true` e só vira `false` dentro do `.then()`
   * do efeito de carregamento (nunca `setState` síncrono no corpo do
   * efeito, para não disparar o aviso de cascata de render). A exibição
   * real (`carregandoEquipesPlantaoParaExibir`, mais abaixo) combina isto
   * com `podeAcessarPlantoes`/`modoDemo`, para nunca mostrar "carregando"
   * eternamente numa tela onde o efeito nem chega a rodar.
   */
  const [carregandoEquipesPlantao, setCarregandoEquipesPlantao] = useState(true);
  const [erroEquipesPlantao, setErroEquipesPlantao] = useState('');
  const [modalGrupoPlantao, setModalGrupoPlantao] = useState<{ modo: 'criar' | 'editar'; inicial: GrupoPlantao } | null>(null);
  const [buscaParticipanteNovo, setBuscaParticipanteNovo] = useState<Record<string, string>>({});
  const [modalContatosParticipante, setModalContatosParticipante] = useState<
    { grupoId: string; nomeExibicao: string; participante: ParticipantePlantao } | null
  >(null);
  const [participanteParaDesativar, setParticipanteParaDesativar] = useState<
    { grupoId: string; login: string; nomeExibicao: string } | null
  >(null);
  const [processandoDesativarParticipante, setProcessandoDesativarParticipante] = useState(false);
  // --- Rascunho de Plantão a partir da prévia validada (Fase PLANTÃO-3B) ---
  const [grupoRascunhoEscolhido, setGrupoRascunhoEscolhido] = useState('');
  const [competenciaRascunho, setCompetenciaRascunho] = useState('');
  const [periodoInicioRascunho, setPeriodoInicioRascunho] = useState('');
  const [periodoFimRascunho, setPeriodoFimRascunho] = useState('');
  const [salvandoRascunhoPlantao, setSalvandoRascunhoPlantao] = useState(false);
  const [erroRascunhoPlantao, setErroRascunhoPlantao] = useState('');
  const [rascunhoPlantaoSalvoEm, setRascunhoPlantaoSalvoEm] = useState<string | null>(null);
  const [formularioUsuario, setFormularioUsuario] = useState<FormularioUsuario | null>(null);
  const [errosFormularioUsuario, setErrosFormularioUsuario] = useState<string[]>([]);
  const [novoAliasDraft, setNovoAliasDraft] = useState('');
  const [descarteRascunhoPendente, setDescarteRascunhoPendente] = useState(false);
  const [membroGradeDraft, setMembroGradeDraft] = useState<{ login: string; turnoPadrao: string } | null>(null);
  const [removerMembroPendente, setRemoverMembroPendente] = useState<TurnosMes | null>(null);
  const [alertasAbertos, setAlertasAbertos] = useState(false);
  const [alertaSelecionado, setAlertaSelecionado] = useState<AlertaVisivel | null>(null);
  const [trocas, setTrocas] = useState<SolicitacaoTrocaReal[]>([]);
  const [filtroTrocas, setFiltroTrocas] = useState<FiltroTrocas>('pendentes');
  const [trocaSelecionadaId, setTrocaSelecionadaId] = useState<string | null>(null);
  const [motivoRecusaTroca, setMotivoRecusaTroca] = useState('');
  const [processandoTroca, setProcessandoTroca] = useState(false);
  const [erroTroca, setErroTroca] = useState('');
  // --- Lembretes atribuídos (Fase 5) — só lembretesAtribuidos, nunca pessoais ---
  const [colaboradorLembretes, setColaboradorLembretes] = useState<Usuario | null>(null);
  const [lembretesAtribuidosColaborador, setLembretesAtribuidosColaborador] = useState<LembreteAtribuidoPersistido[]>([]);
  const [carregandoLembretesAtribuidos, setCarregandoLembretesAtribuidos] = useState(false);
  const [erroLembretesAtribuidos, setErroLembretesAtribuidos] = useState('');
  const [filtroLembretesAtribuidos, setFiltroLembretesAtribuidos] = useState<'ATIVOS' | 'TODOS'>('ATIVOS');
  const [modalAtribuirLembrete, setModalAtribuirLembrete] = useState<
    { modo: 'criar' } | { modo: 'editar'; lembrete: LembreteAtribuidoPersistido } | null
  >(null);
  const [lembreteParaCancelar, setLembreteParaCancelar] = useState<LembreteAtribuidoPersistido | null>(null);
  const [processandoCancelamentoLembrete, setProcessandoCancelamentoLembrete] = useState(false);
  // --- Administração (ADMIN_SISTEMA) ---
  const [todosUsuariosAdmin, setTodosUsuariosAdmin] = useState<Usuario[]>([]);
  const [equipesAdmin, setEquipesAdmin] = useState<Equipe[]>([]);
  const [setoresAdmin, setSetoresAdmin] = useState<Setor[]>([]);
  const [unidadesAdmin, setUnidadesAdmin] = useState<UnidadeOrganizacional[]>([]);
  const [escoposOperacionaisAdmin, setEscoposOperacionaisAdmin] = useState<EscopoOperacional[]>([]);
  const [modalResponsavelEscala, setModalResponsavelEscala] = useState<EscopoOperacional | null | 'novo'>(null);
  const [processandoEscopoOperacional, setProcessandoEscopoOperacional] = useState(false);
  const [erroAdmin, setErroAdmin] = useState('');
  const [formSetor, setFormSetor] = useState<Setor>({ id: '', nome: '', sigla: '', ativo: true });
  /**
   * `null` = modal fechado. Guarda o modo (criar/editar) e o valor inicial
   * do formulário — a edição em si vive dentro do modal (`ModalUnidadeOrganizacional`/
   * `ModalEquipe`), então não precisa de estado espelhado aqui fora.
   */
  const [modalUnidade, setModalUnidade] = useState<{ modo: 'criar' | 'editar'; inicial: UnidadeOrganizacional } | null>(null);
  const [modalEquipe, setModalEquipe] = useState<{ modo: 'criar' | 'editar'; inicial: Equipe } | null>(null);
  // --- Árvore organizacional moderna (Fase UI-ORG-1) ---
  const [chaveNoOrganizacionalSelecionada, setChaveNoOrganizacionalSelecionada] = useState<string | null>(null);
  const [buscaArvoreOrganizacional, setBuscaArvoreOrganizacional] = useState('');
  // --- Usuários (Administração): busca + filtros, ver `usuariosAdminFiltrados` ---
  const [buscaUsuarioAdmin, setBuscaUsuarioAdmin] = useState('');
  const [filtroEquipeUsuarioAdmin, setFiltroEquipeUsuarioAdmin] = useState('');
  const [filtroPerfilUsuarioAdmin, setFiltroPerfilUsuarioAdmin] = useState('');
  const [filtroTipoUsuarioAdmin, setFiltroTipoUsuarioAdmin] = useState<
    'TODOS' | 'REAIS' | 'TECNICOS' | 'GESTORES' | 'ANALISTAS'
  >('TODOS');
  const [gestorParaSimular, setGestorParaSimular] = useState('');
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<Usuario | null>(null);
  const [processandoExclusaoUsuario, setProcessandoExclusaoUsuario] = useState(false);
  const [equipeExportar, setEquipeExportar] = useState('');
  const [competenciaExportar, setCompetenciaExportar] = useState(COMPETENCIA_ATUAL);
  const [excluirEscalaPendente, setExcluirEscalaPendente] = useState(false);
  const [processandoEscalaAdmin, setProcessandoEscalaAdmin] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const escritaBloqueada = !modoDemo && !escritaAdministrativaHabilitada;
  const conciliacaoBloqueiaPublicacao = publicacaoBloqueadaPorConciliacao(linhasConciliacao);
  const pendenciasConciliacao = contarPendenciasConciliacao(linhasConciliacao);
  /**
   * Fase ESCALAS-UX-1A — `atribuicoes` vem da WORKING COPY
   * (`atribuicoesEditaveisPlantao`), nunca de `resultadoPlantao.atribuicoes`
   * (esse fica congelado para a "Conferência da fonte"); só
   * `contabilidadeInformada` continua vindo da fonte, porque é o que
   * garante que alguém com 0 atribuições atuais (ex.: consta só na
   * contabilidade declarada) continue visível na lista de participantes.
   */
  /**
   * Fase ESCALAS-UX-1B — para origem MANUAL não existe planilha nenhuma
   * (nem `contabilidadeInformada`, nem nomes a conciliar): os participantes
   * vêm dos participantes ATIVOS do Grupo escolhido, resolvidos por login →
   * nome do usuário cadastrado (`consolidarParticipantesGrupoPlantao`).
   */
  /**
   * `resultadoPlantao === null` cobre MANUAL (nunca teve XLS) e qualquer
   * origem REABERTA (Fase ESCALAS-UX-1B.1 — mesmo um rascunho
   * originalmente IMPORTADO nunca reconstrói `resultadoPlantao`, porque o
   * modelo persistido não guarda a contabilidade por plantonista
   * declarada na fonte — ver `reidratarRascunhoPlantao()`). Nos dois
   * casos, os candidatos vêm do Grupo, não de planilha.
   *
   * Inclui participantes INATIVOS quando (e só quando) uma atribuição da
   * working copy atual ainda os referencia — uma atribuição persistida
   * nunca desaparece só porque a pessoa foi desativada depois de salva
   * (§ 29 da fase); sem isso, o `<select>` do modal de edição não teria
   * nenhuma opção correspondendo ao nome já atribuído.
   */
  const participantesPlantao = useMemo(() => {
    if (resultadoPlantao !== null) {
      return consolidarParticipantesPlantao({
        atribuicoes: atribuicoesEditaveisPlantao,
        contabilidadeInformada: resultadoPlantao.contabilidadeInformada,
      });
    }
    const todosParticipantes = participantesPorGrupoPlantao[grupoRascunhoEscolhido] ?? [];
    const ativos = todosParticipantes.filter((item) => item.ativo);
    const nomesReferenciados = new Set(atribuicoesEditaveisPlantao.map((item) => normalizarNome(item.plantonistaNomeOriginal)));
    const inativosReferenciados = todosParticipantes.filter((item) => !item.ativo
      && nomesReferenciados.has(normalizarNome(nomeParticipantePlantao(item, usuarios))));
    return consolidarParticipantesGrupoPlantao([...ativos, ...inativosReferenciados], usuarios, atribuicoesEditaveisPlantao);
  }, [resultadoPlantao, atribuicoesEditaveisPlantao, participantesPorGrupoPlantao, grupoRascunhoEscolhido, usuarios]);
  const padroesHorarioModalPlantao = useMemo(() => {
    const grupoAtual = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
    return derivarPadroesHorarioPlantao(grupoAtual?.padraoHorarioSemanal);
  }, [gruposPlantaoAdmin, grupoRascunhoEscolhido]);

  /**
   * Fase ESCALAS-UX-2B — nomes normalizados dos participantes inativos
   * ainda referenciados por alguma atribuição da working copy, para o
   * roster mostrar "Inativo" sem esconder a escala (§8 do pedido). Não
   * existe para o fluxo IMPORTADO (participante de planilha nunca tem
   * `ativo`/Firestore associado).
   */
  const nomesInativosReferenciadosPlantao = useMemo(() => {
    const todosParticipantes = participantesPorGrupoPlantao[grupoRascunhoEscolhido] ?? [];
    return new Set(
      todosParticipantes
        .filter((item) => !item.ativo)
        .map((item) => normalizarNome(nomeParticipantePlantao(item, usuarios))),
    );
  }, [participantesPorGrupoPlantao, grupoRascunhoEscolhido, usuarios]);
  const atribuicoesPlantaoComVinculo = useMemo(
    () => aplicarVinculosNasAtribuicoes(atribuicoesEditaveisPlantao, vinculosPlantao)
      .slice()
      .sort((a, b) => `${a.inicio.data}${a.inicio.hora}`.localeCompare(`${b.inicio.data}${b.inicio.hora}`)),
    [atribuicoesEditaveisPlantao, vinculosPlantao],
  );
  const pendenciasVinculoPlantao = contarPendenciasVinculoPlantao(vinculosPlantao);
  const previaPlantaoPodeValidar = previaPlantaoValidavel(vinculosPlantao);
  /**
   * Gate na identidade REAL, nunca na simulada — a aba de Administração
   * precisa continuar acessível (para "Sair da simulação") mesmo enquanto o
   * admin está simulando um gestor comum.
   */
  const souAdmin = usuarioReal !== null && ehAdminSistema(usuarioReal);
  /**
   * Mesmo gate na identidade REAL de `souAdmin` — GESTOR_UNIDADE só vê a
   * aba Administração restrita ao painel de Unidades organizacionais/
   * Equipes dentro do seu escopo (`unidadesPermitidasEfetivas`); os demais
   * painéis (Usuários, Simular gestor, Limpeza/Histórico) continuam presos
   * a `souAdmin`.
   */
  const souGestorUnidade = usuarioReal !== null && perfilEfetivo(usuarioReal) === 'GESTOR_UNIDADE';
  const podeAcessarAdministracao = souAdmin || souGestorUnidade;
  /**
   * Fase ESCOPO-GESTOR-UNIDADE-1 — `lib/escoposOperacionais.ts` é a fonte
   * única do escopo administrativo do usuário (Administração, Escalas,
   * Jornada 6x1, Plantão e o seletor superior consomem daqui, nunca
   * reimplementam a mesma regra). `minhasUnidadesPermitidas`/
   * `minhasEquipesPermitidas` continuam com esses nomes para não reescrever
   * todo o restante do arquivo, mas agora vêm do resolver — que, diferente
   * de `unidadesPermitidasEfetivas()`/`equipesPermitidasEfetivas()` puras,
   * já filtra por `ativa` e já inclui a subárvore (`caminho`/
   * `caminhoUnidade` materializados) e a equipe administrável por unidade
   * de um `GESTOR_UNIDADE`, não só o pertencimento explícito por
   * `equipesPermitidas`.
   */
  const escoposOperacionais = usuarioReal !== null
    ? resolverEscoposOperacionais(usuarioReal, unidadesAdmin, equipesAdmin, gruposPlantaoAdmin, escoposOperacionaisAdmin)
    : ESCOPOS_OPERACIONAIS_VAZIOS;
  const minhasUnidadesPermitidas = escoposOperacionais.unidadesAdministraveis.map((item) => item.unidadeId);
  /**
   * Gate na identidade REAL — espelha `souGestorDePlantao()` de
   * `lib/sessao.ts`. Mudança de regra aprovada na Fase
   * ESCOPO-GESTOR-UNIDADE-1: até essa fase, `GESTOR_UNIDADE` nunca via essa
   * tela como administrador (só como consulta, se a própria equipe
   * estivesse em `equipesConsulta`) — agora também controla a
   * VISIBILIDADE da aba/seletor para `GESTOR_UNIDADE`; a autorização real
   * de cada Grupo específico continua em `podeGerenciarEsteGrupoPlantao()`
   * abaixo (que já reflete o escopo de unidade — ver
   * `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`).
   */
  const podeAcessarPlantoes = usuarioReal !== null && souGestorDePlantao(usuarioReal);
  const carregandoEquipesPlantaoParaExibir = carregandoEquipesPlantao && podeAcessarPlantoes && !modoDemo;
  const minhasEquipesPermitidas = escoposOperacionais.equipesAdministraveis.map((item) => item.id);
  const minhasEquipesDeJornadaPermitidas = escoposOperacionais.jornadasAdministraveis.map((item) => item.id);
  /**
   * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — a equipe da Jornada ATIVA
   * agora (se houver) nunca deve ser oferecida/escolhida silenciosamente
   * como "equipe responsável" de um Plantão novo no Wizard — ver
   * `equipesCandidatasParaPlantao()` (`lib/inicioEscala.ts`).
   */
  const equipeJornadaReferenciaId = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.equipeId
    : usuarioReal?.equipeId ?? null;
  // Fase ESCALAS-UX-2A — 'plantoes' não é mais um id presente em NAVEGACAO
  // (ver comentário acima do array); só 'administracao' precisa de gate.
  const navegacaoVisivel = NAVEGACAO.filter((item) => (item.id === 'administracao' ? podeAcessarAdministracao : true));

  // --- Derivados da tela Administração (Resumo, árvore, filtros de Usuários) ---
  const arvoreUnidadesAdmin = construirArvoreUnidades(unidadesAdmin);
  const unidadesEmArvoreParaSelect = achatarArvore(arvoreUnidadesAdmin);
  const resumoOrganizacional = calcularResumoOrganizacional(unidadesAdmin, equipesAdmin, todosUsuariosAdmin);
  /**
   * Árvore mista Unidades+Equipes (Fase UI-ORG-1) — mesma fundação de
   * `lib/organizacao.ts` usada pelo `OrganizationTeamPicker` em
   * `ModalGrupoPlantao`, nunca uma segunda árvore independente.
   */
  const arvoreOrganizacionalAdmin = construirArvoreOrganizacional(unidadesAdmin, equipesAdmin);
  const equipeSemUnidadeSelecionada = arvoreOrganizacionalAdmin.equipesSemUnidade
    .find((item) => `equipe:${item.id}` === chaveNoOrganizacionalSelecionada);
  const noOrganizacionalSelecionado: NoArvoreOrganizacional | null = achatarArvoreOrganizacional(arvoreOrganizacionalAdmin.raizes)
    .find((no) => chaveDoNoOrganizacional(no) === chaveNoOrganizacionalSelecionada)
    ?? (equipeSemUnidadeSelecionada
      ? { chave: `equipe:${equipeSemUnidadeSelecionada.id}`, tipo: 'equipe', equipe: equipeSemUnidadeSelecionada, profundidade: 0 }
      : null);
  const usuariosAdminFiltrados = todosUsuariosAdmin.filter((item) => {
    const termo = buscaUsuarioAdmin.trim().toLowerCase();
    const bateBusca = termo === ''
      || item.nome.toLowerCase().includes(termo)
      || item.login.toLowerCase().includes(termo)
      || item.email.toLowerCase().includes(termo);
    const bateEquipe = filtroEquipeUsuarioAdmin === '' || item.equipeId === filtroEquipeUsuarioAdmin;
    const perfilItem = perfilEfetivo(item);
    const batePerfil = filtroPerfilUsuarioAdmin === '' || perfilItem === filtroPerfilUsuarioAdmin;
    const ehTecnico = ehUsuarioTecnicoOuFake(item);
    const bateTipo = filtroTipoUsuarioAdmin === 'TODOS'
      || (filtroTipoUsuarioAdmin === 'REAIS' && !ehTecnico)
      || (filtroTipoUsuarioAdmin === 'TECNICOS' && ehTecnico)
      || (filtroTipoUsuarioAdmin === 'GESTORES' && ['GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'].includes(perfilItem))
      || (filtroTipoUsuarioAdmin === 'ANALISTAS' && ['ANALISTA_SOC', 'ANALISTA_SUPORTE', 'LEITURA'].includes(perfilItem));
    return bateBusca && bateEquipe && batePerfil && bateTipo;
  });
  const gestoresSimulaveis = [...gestoresParaSimulacao(todosUsuariosAdmin)]
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const gestorSelecionadoParaSimular = gestoresSimulaveis.find((item) => item.login === gestorParaSimular) ?? null;

  const documentos = useMemo(
    () => resultado?.documentos ?? [],
    [resultado?.documentos],
  );
  const equipeIdDaGradeAtiva = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.equipeId
    : resultado?.documentos[0]?.equipeId ?? null;
  const usuariosElegiveisGrade = useMemo(
    () => usuariosElegiveisParaAdicionarNaGrade(usuarios, documentos, equipeIdDaGradeAtiva),
    [documentos, equipeIdDaGradeAtiva, usuarios],
  );
  const publicados = useMemo(
    () => documentos.filter(({ status }) => status === 'PUBLICADA'),
    [documentos],
  );
  const alertasOperacionais = useMemo(
    () => gerarAlertasEscala(documentos, catalogo),
    [documentos, catalogo],
  );
  const indiceAlertasGrade = useMemo(
    () => construirIndiceAlertasGrade(documentos, catalogo),
    [documentos, catalogo],
  );
  const resumoPublicacao = useMemo(
    () => resolverResumoPublicacao(publicados.length, documentos.length),
    [publicados, documentos],
  );
  const alertasVisiveis = useMemo(
    () => montarAlertasVisiveis(alertasOperacionais, usuarios, documentos, publicados),
    [alertasOperacionais, usuarios, documentos, publicados],
  );
  const trocasPendentesGestor = trocas.filter((item) => item.status === 'PENDENTE_GESTOR');
  const trocasAprovadas = trocas.filter((item) => item.status === 'APROVADA_PUBLICADA');
  const trocasRecusadas = trocas.filter((item) => item.status === 'RECUSADA_GESTOR' || item.status === 'RECUSADA_USUARIO');
  const trocasListaFiltrada = filtroTrocas === 'pendentes' ? trocasPendentesGestor
    : filtroTrocas === 'aprovadas' ? trocasAprovadas
      : filtroTrocas === 'recusadas' ? trocasRecusadas
        : trocas;
  const trocaSelecionada = trocaSelecionadaId !== null
    ? trocas.find((item) => item.trocaId === trocaSelecionadaId) ?? null
    : null;
  const totaisGerais = useMemo(() => {
    const totalMin = documentos.reduce((soma, documento) =>
      soma + calcularTotais(documento.dias, catalogo).min, 0);
    return {
      pessoas: documentos.length,
      dias: resultado?.totalDias ?? 0,
      horas: formatarMinutos(totalMin),
    };
  }, [catalogo, documentos, resultado?.totalDias]);

  /**
   * Resumo operacional da Visão geral — usa os mesmos estados já consumidos
   * pelos editores. Não cria uma segunda fonte de dados nem lê/escreve um
   * novo schema: Jornada vem de `documentos`; Plantão vem da competência em
   * cache/working copy e dos participantes já carregados.
   */
  const equipeJornadaDashboard = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.equipeId
    : resultado?.equipeNome ?? minhasEquipesPermitidas[0] ?? EQUIPE_DEMO.id;
  const competenciaDashboard = contextoEscalaAtivo?.competencia ?? COMPETENCIA_ATUAL;
  const grupoPlantaoDashboard = gruposPlantaoAdmin.find((grupo) =>
    contextoEhPlantao(contextoEscalaAtivo) && grupo.grupoId === contextoEscalaAtivo.grupoId,
  ) ?? gruposPlantaoAdmin.find((grupo) => podeGerenciarEsteGrupoPlantao(grupo)) ?? gruposPlantaoAdmin[0] ?? null;
  const rascunhosPlantaoDashboard = grupoPlantaoDashboard === null
    ? []
    : (rascunhosPlantaoPorGrupo[grupoPlantaoDashboard.grupoId] ?? []);
  const competenciaPlantaoDashboard = rascunhosPlantaoDashboard.find((item) => item.competencia === competenciaDashboard)
    ?? rascunhosPlantaoDashboard.slice().sort((a, b) => b.competencia.localeCompare(a.competencia))[0]
    ?? null;
  const plantaoEmContextoDashboard = grupoPlantaoDashboard !== null
    && contextoEhPlantao(contextoEscalaAtivo)
    && contextoEscalaAtivo.grupoId === grupoPlantaoDashboard.grupoId;
  const plantaoTotalBrutoDashboard = plantaoEmContextoDashboard && resultadoPlantao !== null
    ? resultadoPlantao.totalBrutoCalculado
    : competenciaPlantaoDashboard?.totalBruto ?? null;
  const participantesPlantaoDashboard = grupoPlantaoDashboard === null
    ? (plantaoEmContextoDashboard ? participantesPlantao.length : 0)
    : plantaoEmContextoDashboard
      ? participantesPlantao.length
      : (participantesPorGrupoPlantao[grupoPlantaoDashboard.grupoId] ?? []).length;
  const plantaoPossuiEscalaDashboard = plantaoTotalBrutoDashboard !== null
    || (plantaoEmContextoDashboard && atribuicoesEditaveisPlantao.length > 0);
  const plantaoAlertasDashboard = plantaoEmContextoDashboard && resultadoPlantao !== null
    ? resultadoPlantao.erros.length + resultadoPlantao.avisos.length + pendenciasVinculoPlantao
    : 0;
  const plantaoStatusDashboard: 'stable' | 'attention' | 'empty' = !plantaoPossuiEscalaDashboard
    ? 'empty'
    : plantaoAlertasDashboard > 0
      ? 'attention'
      : 'stable';
  const socStatusDashboard: 'stable' | 'attention' | 'empty' = documentos.length === 0
    ? 'empty'
    : alertasVisiveis.length > 0
      ? 'attention'
      : 'stable';
  const colaboradoresOperacoesDashboard = totaisGerais.pessoas + participantesPlantaoDashboard;
  const pendenciasDashboard = alertasVisiveis.length + plantaoAlertasDashboard + trocasPendentesGestor.length;
  const healthBarSoc = documentos.length === 0
    ? 12
    : Math.max(18, 100 - Math.min(82, alertasVisiveis.length * 8));
  const healthBarPlantao = plantaoStatusDashboard === 'empty'
    ? 12
    : Math.max(18, 100 - Math.min(82, plantaoAlertasDashboard * 12));
  const rotuloSaudeDashboard = (status: 'stable' | 'attention' | 'empty') =>
    status === 'stable' ? 'Operação estável' : status === 'attention' ? 'Revisão necessária' : 'Sem escala';
  const nomePlantaoDashboard = grupoPlantaoDashboard?.nome ?? 'Plantão';
  const opcoesDataResumoDashboard = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
  const periodoJornadaDashboard = resultado === null
    ? 'Sem competência carregada'
    : `${formatarData(resultado.periodoInicio, opcoesDataResumoDashboard)} — ${formatarData(resultado.periodoFim, opcoesDataResumoDashboard)}`;
  const periodoPlantaoDashboard = competenciaPlantaoDashboard === null
    ? 'Sem competência criada'
    : `${formatarData(competenciaPlantaoDashboard.periodoInicio, opcoesDataResumoDashboard)} — ${formatarData(competenciaPlantaoDashboard.periodoFim, opcoesDataResumoDashboard)}`;
  const plantaoMetricasDashboard = plantaoPossuiEscalaDashboard
    ? `${participantesPlantaoDashboard} ${participantesPlantaoDashboard === 1 ? 'participante' : 'participantes'} · ${plantaoTotalBrutoDashboard?.quantidade ?? 0} ${plantaoTotalBrutoDashboard?.quantidade === 1 ? 'plantão' : 'plantões'}`
    : `${participantesPlantaoDashboard} ${participantesPlantaoDashboard === 1 ? 'participante' : 'participantes'} · nenhum rascunho`;

  useEffect(() => {
    // O demo hidrata SOC apenas quando não existe outra prévia ativa. Sem
    // esta guarda, importar Plantão limpa `resultado` da Jornada e o efeito
    // relê o XLS demo em paralelo, sobrescrevendo o contexto PLANTAO.
    if (usuarioEfetivo === null || !modoDemo || resultado !== null || resultadoPlantao !== null || tipoArquivoDetectado === 'PLANTAO') {
      return;
    }
    let cancelado = false;
    void carregarEscalaDemonstracao()
      .then((escala) => {
        if (!cancelado) {
          setResultado({
            ...escala,
            documentos: escala.documentos.map((documento) => ({
              ...documento,
              status: 'RASCUNHO',
              publicadoPor: null,
              publicadoEm: null,
            })),
          });
          setJornadaPossuiAlteracoesNaoSalvas(false);
          if (usuarioEfetivo !== null) {
            setContextoEscalaAtivo({
              tipo: 'JORNADA',
              equipeId: usuarioEfetivo.equipeId,
              competencia: escala.documentos[0]?.competencia ?? '2026-08',
            });
            setContextoSemEscala(false);
          }
        }
      })
      .catch((falha: unknown) => {
        if (!cancelado) {
          setMensagem(falha instanceof Error ? falha.message : 'Falha ao carregar demonstração.');
        }
      })
      .finally(() => {
        if (!cancelado) {
          setProcessando(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [modoDemo, resultado, resultadoPlantao, tipoArquivoDetectado, usuarioEfetivo]);

  async function carregarDemo() {
    setProcessando(true);
    try {
      // Sempre um exemplo de escala 6x1 — limpa qualquer preview de Plantão
      // que tenha ficado de uma importação anterior nesta mesma sessão.
      setTipoArquivoDetectado('ESCALA_6X1');
      setResultadoPlantao(null);
      setVinculosPlantao([]);
      setPreviaPlantaoValidada(false);
      setGrupoRascunhoEscolhido('');
      setRascunhoPlantaoSalvoEm(null);
      if (!modoDemo && usuarioEfetivo !== null) {
        const resposta = await fetch('/demo/Escala-SOC-Controle-Agosto.xls');
        if (!resposta.ok) {
          throw new Error('Não foi possível carregar a planilha de exemplo.');
        }
        interpretar(await resposta.arrayBuffer(), 'Escala-SOC-Controle-Agosto.xls');
        return;
      }
      const escala = await carregarEscalaDemonstracao();
      setResultado({
        ...escala,
        documentos: escala.documentos.map((documento) => ({
          ...documento,
          status: 'RASCUNHO',
          publicadoPor: null,
          publicadoEm: null,
        })),
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Falha ao carregar demonstração.');
    } finally {
      setProcessando(false);
    }
  }

  /**
   * Corpo original de `autenticar()` — extraído para ser reaproveitado pela
   * troca de contexto do modo simulação (`iniciarSimulacao`/
   * `sairDaSimulacao`), que precisa recarregar os dados da equipe do
   * gestor simulado (ou, ao sair, da própria equipe do admin) sem repetir
   * o login.
   */
  async function carregarDadosDaEquipe(alvo: Usuario): Promise<void> {
    const [
      usuariosRemotos,
      catalogoRemoto,
      escalasRemotas,
      rascunhosRemotos,
      historicoRemoto,
      estadoPublicacao,
    ] = await Promise.all([
      listarUsuarios(alvo.equipeId),
      listarCatalogo(alvo.equipeId),
      carregarEscalasEquipe(alvo.equipeId, '2026-08', true),
      carregarRascunhosEquipe(alvo.equipeId, '2026-08'),
      listarHistoricoPublicacoes(alvo.equipeId, '2026-08'),
      carregarEstadoPublicacao(alvo.equipeId, '2026-08'),
    ]);
    setUsuarios(usuariosRemotos);
    setCatalogo(catalogoRemoto);
    setHistorico(historicoRemoto);
    setRevisaoAtual(estadoPublicacao?.revisaoAtual ?? 0);
    const documentosCarregados = rascunhosRemotos.length > 0
      ? rascunhosRemotos
      : escalasRemotas;
    setContextoEscalaAtivo({ tipo: 'JORNADA', equipeId: alvo.equipeId, competencia: '2026-08' });
    if (documentosCarregados.length > 0) {
      const datas = documentosCarregados.flatMap((documento) => Object.keys(documento.dias));
      const periodoInicio = datas.sort()[0] ?? '2026-07-26';
      const periodoFim = datas.sort().at(-1) ?? '2026-08-25';
      setResultado({
        ok: true,
        equipeNome: alvo.equipeId,
        periodoInicio,
        periodoFim,
        totalDias: new Set(datas).size,
        documentos: documentosCarregados,
        erros: [],
        avisos: [],
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setContextoSemEscala(false);
      setTela('escalas');
    } else {
      setResultado(null);
      setLinhasConciliacao([]);
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setContextoSemEscala(true);
    }
  }

  async function autenticar(autenticado: Usuario, demonstracao: boolean) {
    setUsuarioReal(autenticado);
    setModoDemo(demonstracao);
    if (demonstracao) {
      // Laboratório local sem Firestore: semeia os dois contextos do COSI.
      // SOC é a Jornada 6x1; Plantão é uma equipe/grupo independente, para
      // que o seletor superior alterne entre os dois sem reutilizar EQ_SOC.
      // Fase ESCOPO-GESTOR-UNIDADE-1 — `unidadesAdmin` também precisa da
      // unidade COSI: sem ela, `resolverEscoposOperacionais()` não teria
      // nenhuma unidade para casar contra `unidadesPermitidas` do
      // coordenador (`GESTOR_DEMO`), e o escopo inteiro ficaria vazio.
      setUnidadesAdmin([UNIDADE_COSI_DEMO]);
      setEquipesAdmin([EQUIPE_DEMO, EQUIPE_PLANTAO_DEMO]);
      setGruposPlantaoAdmin([GRUPO_PLANTAO_DEMO]);
      setEscoposOperacionaisAdmin([
        {
          tipo: 'JORNADA',
          alvoId: EQUIPE_DEMO.id,
          alvoNome: EQUIPE_DEMO.nome,
          unidadeId: EQUIPE_DEMO.unidadeId,
          caminhoUnidade: EQUIPE_DEMO.caminhoUnidade,
          responsaveisLogin: [autenticado.login],
          responsaveisEquipe: [],
          equipesConsulta: [],
          ativo: true,
          criadoPorLogin: autenticado.login,
          atualizadoPorLogin: autenticado.login,
          schemaVersion: 1,
        },
        {
          tipo: 'PLANTAO',
          alvoId: GRUPO_PLANTAO_DEMO.grupoId,
          alvoNome: GRUPO_PLANTAO_DEMO.nome,
          unidadeId: GRUPO_PLANTAO_DEMO.unidadeResponsavelId,
          caminhoUnidade: GRUPO_PLANTAO_DEMO.caminhoUnidadeResponsavel,
          responsaveisLogin: [autenticado.login],
          responsaveisEquipe: [],
          equipesConsulta: [EQUIPE_DEMO.id],
          ativo: true,
          criadoPorLogin: autenticado.login,
          atualizadoPorLogin: autenticado.login,
          schemaVersion: 1,
        },
      ]);
      setParticipantesPorGrupoPlantao({
        [GRUPO_PLANTAO_DEMO.grupoId]: PARTICIPANTES_PLANTAO_DEMO,
      });
    } else {
      setResultado(null);
      setResultadoPlantao(null);
      setUsuarios([]);
      setLinhasConciliacao([]);
      await carregarDadosDaEquipe(autenticado);
    }
  }

  /**
   * Modo simulação de gestor — não troca o login do Firebase Auth nem a
   * sessão real: só sobrepõe qual `Usuario` o resto da tela usa para
   * escopo de dados/permissões (`usuarioEfetivo`). O admin continua
   * autenticado como admin o tempo todo.
   */
  async function iniciarSimulacao(gestor: Usuario) {
    setSimulando(gestor);
    if (!modoDemo) {
      await carregarDadosDaEquipe(gestor);
    }
  }

  async function sairDaSimulacao() {
    setSimulando(null);
    if (!modoDemo && usuarioReal !== null) {
      await carregarDadosDaEquipe(usuarioReal);
    }
  }

  /**
   * Registra ator real + ator simulado quando (e só quando) a ação foi
   * executada em modo simulação — chamada depois do sucesso da escrita
   * real, nunca antes: falha de auditoria não pode desfazer nem mascarar
   * uma ação já commitada.
   */
  async function registrarAuditoriaSeSimulando(acao: string) {
    if (simulando === null || usuarioReal === null) {
      return;
    }
    try {
      await registrarAuditoriaAdmin({
        atorReal: usuarioReal,
        atorSimulado: simulando,
        equipeId: simulando.equipeId,
        acao,
      });
    } catch (falhaAuditoria) {
      console.error('[auditoriaAdmin] falha ao registrar', falhaAuditoria);
    }
  }

  function lembretesAtribuidosDemoPara(colaborador: Usuario): LembreteAtribuidoPersistido[] {
    const agora = new Date().toISOString();
    return [{
      lembreteId: `demo-atribuido-${colaborador.login}`,
      tipo: 'ATRIBUIDO',
      schemaVersion: 1,
      destinatarioLogin: colaborador.login,
      destinatarioEquipeId: colaborador.equipeId,
      titulo: 'Treinamento técnico',
      descricao: 'Capacitação interna de atualização de processos.',
      data: dataIsoLocal(new Date()),
      horario: { diaInteiro: false, horaInicio: '09:00', horaFim: '11:00', viraDia: false },
      serieId: null,
      alertasAntecedenciaMin: [],
      criadoPorLogin: usuarioReal?.login ?? 'demo.gestor',
      criadoPorNome: usuarioReal?.nome ?? 'Gestor Demo',
      status: 'ATIVO',
      criadoEm: agora,
      atualizadoEm: agora,
      canceladoEm: null,
      canceladoPorLogin: null,
    }];
  }

  function abrirLembretesAtribuidos(colaborador: Usuario) {
    setColaboradorLembretes(colaborador);
    setErroLembretesAtribuidos('');
    setFiltroLembretesAtribuidos('ATIVOS');
    if (modoDemo) {
      setLembretesAtribuidosColaborador(lembretesAtribuidosDemoPara(colaborador));
      setCarregandoLembretesAtribuidos(false);
    } else {
      setCarregandoLembretesAtribuidos(true);
    }
  }

  function fecharLembretesAtribuidos() {
    setColaboradorLembretes(null);
    setLembretesAtribuidosColaborador([]);
    setErroLembretesAtribuidos('');
    setModalAtribuirLembrete(null);
    setLembreteParaCancelar(null);
  }

  /**
   * Realtime enquanto o painel de um colaborador está aberto — em Demo, o
   * dado já foi semeado em `abrirLembretesAtribuidos` (evento, não efeito),
   * então o listener do Firestore é pulado por completo, mesmo padrão do
   * efeito de "Trocas em tempo real" acima.
   *
   * Usa `observarLembretesAtribuidosDoGestor` (Fase 5.1), NUNCA
   * `observarLembretesAtribuidosDoUsuario` (essa é só para o colaborador
   * consultando os próprios) — a query do gestor precisa filtrar também por
   * `destinatarioEquipeId`, senão a Firestore Rule recusa o `list` inteiro
   * (ver o comentário em `lembretesRepository.ts` e
   * `docs/spec/LEMBRETES.md`, "Correção Fase 5.1").
   */
  useEffect(() => {
    if (colaboradorLembretes === null || modoDemo) {
      return undefined;
    }
    const { dataInicio, dataFim } = janelaAmplaLembretesAtribuidos(dataIsoLocal(new Date()));
    const cancelar = observarLembretesAtribuidosDoGestor(
      colaboradorLembretes.login,
      colaboradorLembretes.equipeId,
      dataInicio,
      dataFim,
      (lista) => {
        setLembretesAtribuidosColaborador(lista);
        setCarregandoLembretesAtribuidos(false);
      },
      (falha) => {
        setErroLembretesAtribuidos(mensagemErroFirebase(falha, 'Não foi possível carregar os lembretes atribuídos.', ambienteFirebaseAtual));
        setCarregandoLembretesAtribuidos(false);
      },
    );
    return cancelar;
  }, [colaboradorLembretes, modoDemo]);

  async function salvarLembreteAtribuidoUnico(entrada: EntradaLembrete): Promise<void> {
    if (colaboradorLembretes === null || usuarioReal === null) {
      throw new Error('Selecione um colaborador antes de salvar.');
    }
    if (modoDemo) {
      const agora = new Date().toISOString();
      const conteudo = normalizarLembrete(entrada);
      if (modalAtribuirLembrete?.modo === 'editar') {
        const alvoId = modalAtribuirLembrete.lembrete.lembreteId;
        setLembretesAtribuidosColaborador((atual) => atual.map((item) => item.lembreteId === alvoId ? {
          ...item,
          titulo: conteudo.titulo,
          descricao: conteudo.descricao,
          data: conteudo.data,
          horario: conteudo.horario,
          atualizadoEm: agora,
        } : item));
      } else {
        setLembretesAtribuidosColaborador((atual) => [...atual, {
          lembreteId: `demo-atribuido-${Date.now()}`,
          tipo: 'ATRIBUIDO',
          schemaVersion: 1,
          destinatarioLogin: colaboradorLembretes.login,
          destinatarioEquipeId: colaboradorLembretes.equipeId,
          titulo: conteudo.titulo,
          descricao: conteudo.descricao,
          data: conteudo.data,
          horario: conteudo.horario,
          serieId: null,
          alertasAntecedenciaMin: [],
          criadoPorLogin: usuarioReal.login,
          criadoPorNome: usuarioReal.nome,
          status: 'ATIVO',
          criadoEm: agora,
          atualizadoEm: agora,
          canceladoEm: null,
          canceladoPorLogin: null,
        }]);
      }
      return;
    }
    if (modalAtribuirLembrete?.modo === 'editar') {
      await atualizarLembreteAtribuido(modalAtribuirLembrete.lembrete.lembreteId, entrada);
    } else {
      await criarLembreteAtribuido(
        { login: colaboradorLembretes.login, equipeId: colaboradorLembretes.equipeId },
        { login: usuarioReal.login, nome: usuarioReal.nome },
        entrada,
      );
    }
    await registrarAuditoriaSeSimulando('ATRIBUIR_LEMBRETE');
  }

  async function salvarLembreteAtribuidoSerie(entrada: EntradaSerieLembrete): Promise<void> {
    if (colaboradorLembretes === null || usuarioReal === null) {
      throw new Error('Selecione um colaborador antes de salvar.');
    }
    if (modoDemo) {
      const agora = new Date().toISOString();
      const serieId = `demo-serie-${Date.now()}`;
      const ocorrencias = criarOcorrenciasSerie(entrada, serieId);
      setLembretesAtribuidosColaborador((atual) => [
        ...atual,
        ...ocorrencias.map((ocorrencia, indice) => ({
          lembreteId: `demo-atribuido-${Date.now()}-${indice}`,
          tipo: 'ATRIBUIDO' as const,
          schemaVersion: 1 as const,
          destinatarioLogin: colaboradorLembretes.login,
          destinatarioEquipeId: colaboradorLembretes.equipeId,
          titulo: ocorrencia.titulo,
          descricao: ocorrencia.descricao,
          data: ocorrencia.data,
          horario: ocorrencia.horario,
          serieId: ocorrencia.serieId,
          alertasAntecedenciaMin: ocorrencia.alertasAntecedenciaMin,
          criadoPorLogin: usuarioReal.login,
          criadoPorNome: usuarioReal.nome,
          status: 'ATIVO' as const,
          criadoEm: agora,
          atualizadoEm: agora,
          canceladoEm: null,
          canceladoPorLogin: null,
        })),
      ]);
      return;
    }
    await criarSerieLembretesAtribuidos(
      { login: colaboradorLembretes.login, equipeId: colaboradorLembretes.equipeId },
      { login: usuarioReal.login, nome: usuarioReal.nome },
      entrada,
    );
    await registrarAuditoriaSeSimulando('ATRIBUIR_SERIE_LEMBRETES');
  }

  async function confirmarCancelamentoLembreteAtribuido() {
    if (lembreteParaCancelar === null || usuarioReal === null) {
      return;
    }
    setProcessandoCancelamentoLembrete(true);
    try {
      if (modoDemo) {
        const agora = new Date().toISOString();
        setLembretesAtribuidosColaborador((atual) => atual.map((item) => item.lembreteId === lembreteParaCancelar.lembreteId ? {
          ...item,
          status: 'CANCELADO',
          atualizadoEm: agora,
          canceladoEm: agora,
          canceladoPorLogin: usuarioReal.login,
        } : item));
      } else {
        await cancelarLembreteAtribuido(lembreteParaCancelar.lembreteId, { login: usuarioReal.login });
        await registrarAuditoriaSeSimulando('CANCELAR_LEMBRETE');
      }
      setLembreteParaCancelar(null);
    } catch (falha) {
      setErroLembretesAtribuidos(mensagemErroFirebase(falha, 'Não foi possível cancelar o lembrete.', ambienteFirebaseAtual));
    } finally {
      setProcessandoCancelamentoLembrete(false);
    }
  }

  // Trocas em tempo real: o gestor precisa ver, sem F5, o momento em que o
  // destinatário aceita e a solicitação vira PENDENTE_GESTOR.
  useEffect(() => {
    if (usuarioEfetivo === null || modoDemo) {
      return undefined;
    }
    const cancelar = observarTrocasDoGestor(
      usuarioEfetivo.equipeId,
      '2026-08',
      setTrocas,
      (falha) => setErroTroca(mensagemErroFirebase(falha, 'Não foi possível acompanhar as trocas de escala.', ambienteFirebaseAtual)),
    );
    return cancelar;
  }, [modoDemo, usuarioEfetivo]);

  function reparsear(
    buffer: ArrayBuffer,
    loginParaUid: Record<string, string>,
    opcoes: OpcoesInicioImportacao = {},
  ): ResultadoParse {
    return parsePlanilhaEscala(buffer, {
      equipeId: opcoes.equipeId ?? usuarioEfetivo?.equipeId ?? EQUIPE_DEMO.id,
      competencia: opcoes.competencia ?? '2026-08',
      catalogo,
      loginParaUid,
    });
  }

  /**
   * Concilia os nomes da planilha com os usuários cadastrados e, quando a
   * conciliação resolve algo que o login exato não resolveu, reprocessa a
   * planilha com o mapa estendido — sem precisar reescrever o parser.
   *
   * FASE ESCALAS-UX-2A.1-FIX — este é sempre um caminho de IMPORTAÇÃO ainda
   * não salva (a fonte é sempre `buffer`, o arquivo recém-selecionado ou já
   * em edição de conciliação, nunca uma leitura remota já persistida):
   * `jornadaPossuiAlteracoesNaoSalvas` precisa ficar `true`, nunca `false`
   * — importar não é salvar.
   */
  function aplicarConciliacao(buffer: ArrayBuffer, linhas: LinhaConciliacao[], opcoes: OpcoesInicioImportacao = {}) {
    setLinhasConciliacao(linhas);
    const parseado = linhas.some((linha) => linha.login !== null)
      ? reparsear(buffer, loginParaUidComConciliacao(mapaLogins(usuarios), linhas), opcoes)
      : reparsear(buffer, mapaLogins(usuarios), opcoes);
    setResultado(parseado);
    setJornadaPossuiAlteracoesNaoSalvas(true);
    return parseado;
  }

  function interpretar(buffer: ArrayBuffer, nome: string, opcoes: OpcoesInicioImportacao = {}) {
    setProcessando(true);
    setMensagem('');
    try {
      const primeiraLeitura = reparsear(buffer, mapaLogins(usuarios), opcoes);
      const linhas = conciliarPlanilha(
        primeiraLeitura.documentos.map((documento) => documento.login),
        usuarios,
      );
      setArquivo(buffer);
      setNomeArquivo(nome);
      const parseado = aplicarConciliacao(buffer, linhas, opcoes);
      setCorrecoes({});
      if (usuarioEfetivo !== null) {
        setContextoEscalaAtivo({
          tipo: 'JORNADA',
          equipeId: opcoes.equipeId ?? usuarioEfetivo.equipeId,
          competencia: opcoes.competencia ?? parseado.documentos[0]?.competencia ?? '2026-08',
        });
        setContextoSemEscala(false);
      }
      if (!parseado.ok) {
        setMensagem(`${parseado.erros.length} erro(s) encontrado(s). Corrija antes de salvar.`);
      } else if (publicacaoBloqueadaPorConciliacao(linhas)) {
        setMensagem('Revise a conciliação de nomes da planilha antes de salvar ou publicar.');
      }
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Arquivo inválido.');
    } finally {
      setProcessando(false);
    }
  }

  /**
   * Fase PLANTÃO-2: nenhuma escrita, nenhuma persistência — só popula o
   * preview em memória (`resultadoPlantao`) e o estado inicial de vínculos
   * (nunca com login preenchido automaticamente, ver
   * `iniciarVinculosPlantao`).
   */
  function interpretarPlantao(buffer: ArrayBuffer, nome: string, resultado: ResultadoParsePlantao, opcoes: OpcoesInicioImportacao = {}) {
    setArquivo(buffer);
    setNomeArquivo(nome);
    setResultadoPlantao(resultado);
    setOrigemPlantaoAtual('IMPORTADO');
    setAtribuicoesEditaveisPlantao(criarAtribuicoesEditaveis(resultado.atribuicoes));
    setPlantaoEditadoDesdeImportacao(false);
    // FASE ESCALAS-UX-2A.1-FIX — a working copy nasce agora, ainda não
    // persistida: importar não é salvar.
    setPlantaoPossuiAlteracoesNaoSalvas(true);
    setVinculosPlantao(iniciarVinculosPlantao(consolidarParticipantesPlantao(resultado), usuarios));
    setPreviaPlantaoValidada(false);
    setAbaPreviaPlantao('calendario');
    setBuscaVinculoPlantao({});
    setPlantonistaSelecionadoPlantao(null);
    const grupoIdEscolhido = opcoes.grupoId?.trim() ?? '';
    setGrupoRascunhoEscolhido(grupoIdEscolhido);
    // Fase ESCALAS-UX-1A — sugerida já na importação (não só ao validar a
    // prévia), para o calendário destacar a janela 26→25 antes mesmo dos
    // vínculos serem resolvidos (vínculo pendente nunca bloqueia a
    // visualização, só o "Salvar rascunho").
    const sugestao = sugerirCompetenciaPlantao(resultado.atribuicoes);
    const competenciaEscolhida = opcoes.competencia ?? sugestao?.competencia ?? '';
    const periodoEscolhido = competenciaEscolhida === '' ? null : periodoDaCompetencia(competenciaEscolhida);
    setCompetenciaRascunho(competenciaEscolhida);
    setPeriodoInicioRascunho(periodoEscolhido?.periodoInicio ?? sugestao?.periodoInicio ?? '');
    setPeriodoFimRascunho(periodoEscolhido?.periodoFim ?? sugestao?.periodoFim ?? '');
    setErroRascunhoPlantao('');
    setRascunhoPlantaoSalvoEm(null);
    if (usuarioEfetivo !== null && grupoIdEscolhido !== '') {
      setContextoEscalaAtivo({ tipo: 'PLANTAO', grupoId: grupoIdEscolhido, competencia: competenciaEscolhida });
      setContextoSemEscala(false);
    }
    setMensagem(resultado.ok
      ? ''
      : `${resultado.erros.length} problema(s) encontrado(s) na planilha de Plantão.`);
  }

  function confirmarVinculoPlantaoAcao(participanteNomeOriginal: string, usuario: Usuario) {
    setVinculosPlantao((atuais) => confirmarVinculoPlantao(atuais, participanteNomeOriginal, usuario));
    setPreviaPlantaoValidada(false);
    // FASE ESCALAS-UX-2A.1-FIX — vínculo afeta o payload salvo (login da
    // atribuição), então conta como alteração não salva.
    setPlantaoPossuiAlteracoesNaoSalvas(true);
  }

  function desfazerVinculoPlantaoAcao(participanteNomeOriginal: string) {
    setVinculosPlantao((atuais) => desfazerVinculoPlantao(atuais, participanteNomeOriginal));
    setPreviaPlantaoValidada(false);
    setPlantaoPossuiAlteracoesNaoSalvas(true);
  }

  /**
   * Fase ESCALAS-UX-1A — toda mutação da working copy do Editor passa por
   * aqui: marca "Alterações não salvas" e invalida o "Rascunho salvo"
   * anterior (mesmo princípio de `setPreviaPlantaoValidada(false)` acima —
   * qualquer mudança de conteúdo exige salvar de novo).
   */
  function marcarPlantaoEditadoNoEditor() {
    setPlantaoEditadoDesdeImportacao(true);
    setPlantaoPossuiAlteracoesNaoSalvas(true);
    setRascunhoPlantaoSalvoEm(null);
  }

  function abrirEdicaoAtribuicaoPlantao(idLocal: string) {
    const atribuicao = atribuicoesEditaveisPlantao.find((item) => item.idLocal === idLocal);
    if (atribuicao === undefined) {
      return;
    }
    setModalAtribuicaoPlantao({
      modo: 'editar',
      idLocal,
      valoresIniciais: {
        plantonistaNomeOriginal: atribuicao.plantonistaNomeOriginal,
        inicio: atribuicao.inicio,
        fim: atribuicao.fim,
      },
    });
  }

  /**
   * Fase ESCALAS-UX-1C — "distribuição rápida por clique" (§19-21): com um
   * plantonista selecionado no painel compacto, tocar um dia vazio já abre
   * este MESMO modal de criação com o campo Plantonista pré-preenchido —
   * nunca inventa horário (início/fim continuam vazios, o coordenador
   * sempre confirma explicitamente). Sem seleção, comportamento idêntico
   * ao de antes desta fase.
   *
   * Fase ESCALAS-UX-2B — `plantonistaNomeOriginal` passou a aceitar um
   * override explícito (drag pode arrastar uma pessoa diferente da que
   * está selecionada no roster) — quando omitido, cai no comportamento de
   * sempre (`plantonistaSelecionadoPlantao ?? ''`).
   */
  function abrirCriacaoAtribuicaoPlantao(dataIso: string, plantonistaNomeOriginal?: string) {
    setModalAtribuicaoPlantao({
      modo: 'criar',
      idLocal: null,
      valoresIniciais: {
        plantonistaNomeOriginal: plantonistaNomeOriginal ?? plantonistaSelecionadoPlantao ?? '',
        inicio: { data: dataIso, hora: '' },
        fim: { data: dataIso, hora: '' },
      },
    });
  }

  /** Fase ESCALAS-UX-1C — alterna a seleção do roster; puramente de UI (§20). */
  function alternarPlantonistaSelecionado(nomeOriginal: string) {
    setPlantonistaSelecionadoPlantao((atual) => (atual === nomeOriginal ? null : nomeOriginal));
  }

  function fecharModalAtribuicaoPlantao() {
    setModalAtribuicaoPlantao(null);
  }

  /**
   * Fase ESCALAS-UX-2B — a ÚNICA função que grava uma NOVA atribuição na
   * working copy (nunca no Firestore — § 11 do pedido) e marca dirty.
   * Reaproveitada por `salvarModalAtribuicaoPlantao()` (modal completo,
   * "Outro horário") E pelo quick-add ("Adicionar" do padrão do Grupo) —
   * nenhum segundo caminho que grava atribuição.
   */
  function criarAtribuicaoPlantaoNaWorkingCopy(valores: FormularioAtribuicaoPlantao) {
    const abaOrigem = resultadoPlantao?.atribuicoes[0]?.abaOrigem ?? '';
    setAtribuicoesEditaveisPlantao((atuais) => adicionarAtribuicaoEditavel(atuais, { ...valores, abaOrigem }));
    marcarPlantaoEditadoNoEditor();
  }

  function salvarModalAtribuicaoPlantao(valores: FormularioAtribuicaoPlantao) {
    const modal = modalAtribuicaoPlantao;
    if (modal === null) {
      return;
    }
    if (modal.modo === 'editar' && modal.idLocal !== null) {
      const idLocal = modal.idLocal;
      setAtribuicoesEditaveisPlantao((atuais) => editarAtribuicaoEditavel(atuais, idLocal, valores));
      marcarPlantaoEditadoNoEditor();
    } else {
      criarAtribuicaoPlantaoNaWorkingCopy(valores);
    }
    setModalAtribuicaoPlantao(null);
  }

  /**
   * Fase ESCALAS-UX-2B — operação COMUM de criação (§10 do pedido): click
   * (pessoa selecionada + tocar dia) e drag (soltar pessoa num dia)
   * convergem os dois para cá, com a MESMA assinatura
   * `(plantonistaNomeOriginal, dataIso)`. Sem plantonista (clique em
   * "+ Adicionar" sem ninguém selecionado) ou sem padrão configurado para
   * o dia, cai direto no editor completo já existente — nunca inventa
   * horário, nunca cria sozinho. Com padrão, abre o quick-add
   * (`QuickAddPlantaoPopover`) para confirmação explícita — o DROP em si
   * nunca grava nada no Firestore nem na working copy (§13 do pedido).
   *
   * Fase ESCALAS-UX-2B.1 — gate DEFINITIVO de "esta data pode iniciar uma
   * NOVA atribuição": `dataPertenceCompetencia()` (única fonte, reaproveita
   * `periodoDaCompetencia()`). `PlantaoCalendario` já omite a UI de criação
   * para dias de contexto (§6/§7 do pedido), mas o gate real fica aqui —
   * único funil de click/drag/"+ Adicionar" — para nunca depender só da UI
   * não oferecer a ação. Fora do período: no-op silencioso (nenhuma
   * mudança na working copy, nenhum dirty) — nunca um erro pós-fato, o
   * calendário já não mostra a ação como disponível.
   */
  function solicitarNovaAtribuicaoPlantao(plantonistaNomeOriginal: string, dataIso: string) {
    if (!dataPertenceCompetencia(dataIso, competenciaRascunho)) {
      return;
    }
    if (plantonistaNomeOriginal.trim() === '') {
      abrirCriacaoAtribuicaoPlantao(dataIso);
      return;
    }
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
    const padrao = grupo === undefined ? null : obterPadraoHorarioGrupoParaData(grupo, dataIso);
    if (padrao === null) {
      abrirCriacaoAtribuicaoPlantao(dataIso, plantonistaNomeOriginal);
      return;
    }
    setQuickAddPlantao({ plantonistaNomeOriginal, dataIso, padrao });
  }

  function fecharQuickAddPlantao() {
    setQuickAddPlantao(null);
  }

  /** "Adicionar" do quick-add — confirma o padrão do Grupo como a nova atribuição. */
  function confirmarQuickAddPlantao() {
    const estado = quickAddPlantao;
    if (estado === null) {
      return;
    }
    criarAtribuicaoPlantaoNaWorkingCopy(construirAtribuicaoDoPadraoHorario({
      plantonistaNomeOriginal: estado.plantonistaNomeOriginal,
      dataCivil: estado.dataIso,
      padrao: estado.padrao,
    }));
    setQuickAddPlantao(null);
  }

  /** "Outro horário" do quick-add — fecha o popover e abre o editor completo, mesmo pré-preenchimento de sempre. */
  function abrirOutroHorarioQuickAddPlantao() {
    const estado = quickAddPlantao;
    if (estado === null) {
      return;
    }
    setQuickAddPlantao(null);
    abrirCriacaoAtribuicaoPlantao(estado.dataIso, estado.plantonistaNomeOriginal);
  }

  function excluirModalAtribuicaoPlantao() {
    const modal = modalAtribuicaoPlantao;
    if (modal === null || modal.idLocal === null) {
      return;
    }
    const idLocal = modal.idLocal;
    setAtribuicoesEditaveisPlantao((atuais) => excluirAtribuicaoEditavel(atuais, idLocal));
    marcarPlantaoEditadoNoEditor();
    setModalAtribuicaoPlantao(null);
  }

  function validarPreviaPlantao() {
    if (!previaPlantaoValidavel(vinculosPlantao)) {
      return;
    }
    setPreviaPlantaoValidada(true);
    setMensagem('Prévia validada. Nenhum dado de Plantão foi publicado.');
  }

  // --- "+ Nova escala" (Fase ESCALAS-UX-1B) ---

  /**
   * Mesma lógica de `abrirParticipantesDoGrupo()` (cache em
   * `participantesPorGrupoPlantao`), mas sem o toggle de
   * `grupoPlantaoExpandido` (que pertence só à tela "Plantões") e devolvendo
   * a lista para o chamador poder usar o resultado imediatamente.
   */
  async function garantirParticipantesDoGrupoCarregados(grupoId: string): Promise<ParticipantePlantao[]> {
    const cache = participantesPorGrupoPlantao[grupoId];
    if (modoDemo || cache !== undefined) {
      return cache ?? [];
    }
    const participantes = await listarParticipantesPlantao(grupoId);
    setParticipantesPorGrupoPlantao((atuais) => ({ ...atuais, [grupoId]: participantes }));
    return participantes;
  }

    function abrirNovaEscala() {
    abrirWizardEscala('NOVA');
  }
  function abrirImportarEscala() {
    abrirWizardEscala('IMPORTAR');
  }
  function abrirOperacaoDoDashboard(tipo: 'JORNADA' | 'PLANTAO') {
    if (tipo === 'JORNADA') {
      const alvo: ContextoEscalaAtivo = {
        tipo: 'JORNADA',
        equipeId: equipeJornadaDashboard,
        competencia: competenciaDashboard,
      };
      if (contextosEscalaIguais(contextoEscalaAtivo, alvo)) {
        setTela('grade');
        return;
      }
      solicitarTrocaContexto(alvo);
      return;
    }
    if (grupoPlantaoDashboard === null) {
      setTela('escalas');
      return;
    }
    const alvo: ContextoEscalaAtivo = {
      tipo: 'PLANTAO',
      grupoId: grupoPlantaoDashboard.grupoId,
      competencia: competenciaPlantaoDashboard?.competencia ?? competenciaDashboard,
    };
    if (contextosEscalaIguais(contextoEscalaAtivo, alvo)) {
      setTela(plantaoPossuiEscalaDashboard ? 'importar' : 'escalas');
      return;
    }
    solicitarTrocaContexto(alvo);
  }
  function abrirTrocasDoDashboard() {
    setTela('trocas');
    setTrocaSelecionadaId(trocasPendentesGestor[0]?.trocaId ?? null);
  }
  function fecharNovaEscala() {
    setWizardInicio(null);
    setWizardTipo(null);
    setWizardAreaId('');
    setWizardEquipeId('');
    setWizardGrupoId('');
    setWizardArquivoNome('');
    setWizardErro('');
  }
  function abrirWizardEscala(modo: ScheduleStartWizardProps['modo']) {
    const resolucaoArea = resolverAreaAtiva(unidadesAdmin, minhasUnidadesPermitidas, souAdmin);
    const areaInicial = resolucaoArea.estado === 'RESOLVIDO' ? resolucaoArea.valor.unidadeId : '';
    setWizardInicio(modo);
    setWizardTipo(null);
    setWizardAreaId(areaInicial);
    setWizardEquipeId('');
    setWizardGrupoId('');
    setWizardCompetencia(contextoEscalaAtivo?.competencia ?? COMPETENCIA_ATUAL);
    setWizardArquivoNome('');
    setWizardErro('');
    setWizardProcessando(false);
  }
  function selecionarTipoWizard(tipo: ScheduleStartWizardProps['tipo']) {
    if (tipo === null) {
      setWizardTipo(null);
      setWizardEquipeId('');
      setWizardGrupoId('');
      setWizardArquivoNome('');
      setWizardErro('');
      return;
    }
    const areaId = wizardAreaId || (unidadesAdministraveis(unidadesAdmin, minhasUnidadesPermitidas, souAdmin).length === 1
      ? unidadesAdministraveis(unidadesAdmin, minhasUnidadesPermitidas, souAdmin)[0]?.unidadeId ?? ''
      : '');
    setWizardTipo(tipo);
    setWizardAreaId(areaId);
    setWizardErro('');
    /**
     * Fase ESCOPO-GESTOR-UNIDADE-1 — Jornada 6x1 só oferece
     * `jornadasAdministraveis` (nunca uma equipe que já é responsável por
     * um Grupo de Plantão); Plantão continua usando
     * `minhasEquipesPermitidas` completo (precisa enxergar essa mesma
     * equipe como candidata a equipe responsável de um Grupo novo).
     */
    const equipes = equipesAdministraveisNaUnidade(equipesAdmin, areaId || null, minhasEquipesPermitidas, souAdmin);
    if (tipo === 'JORNADA') {
      const resolucao = resolverEquipeParaJornada(
        equipesAdmin,
        areaId || null,
        minhasEquipesDeJornadaPermitidas,
        souAdmin,
        equipeJornadaReferenciaId,
      );
      setWizardEquipeId(resolucao.estado === 'RESOLVIDO' ? resolucao.valor.id : '');
      setWizardGrupoId('');
    } else {
      const resolucao = resolverGrupoParaPlantao(
        gruposPlantaoAdmin.filter((grupo) => equipes.some((equipe) => equipe.id === grupo.equipeResponsavelId)),
        podeGerenciarEsteGrupoPlantao,
      );
      const resolucaoEquipe = resolverEquipeResponsavelParaPlantao(equipes, equipeJornadaReferenciaId);
      setWizardGrupoId(resolucao.estado === 'RESOLVIDO' ? resolucao.valor.grupoId : '');
      setWizardEquipeId(
        resolucao.estado === 'RESOLVIDO'
          ? resolucao.valor.equipeResponsavelId
          : resolucaoEquipe.estado === 'RESOLVIDO' ? resolucaoEquipe.valor.id : '',
      );
    }
  }
  function mudarAreaWizard(areaId: string) {
    setWizardAreaId(areaId);
    const equipes = equipesAdministraveisNaUnidade(equipesAdmin, areaId || null, minhasEquipesPermitidas, souAdmin);
    if (wizardTipo === 'JORNADA') {
      const resolucao = resolverEquipeParaJornada(
        equipesAdmin,
        areaId || null,
        minhasEquipesDeJornadaPermitidas,
        souAdmin,
        equipeJornadaReferenciaId,
      );
      setWizardEquipeId(resolucao.estado === 'RESOLVIDO' ? resolucao.valor.id : '');
      setWizardGrupoId('');
    } else if (wizardTipo === 'PLANTAO') {
      const resolucao = resolverGrupoParaPlantao(
        gruposPlantaoAdmin.filter((grupo) => equipes.some((equipe) => equipe.id === grupo.equipeResponsavelId)),
        podeGerenciarEsteGrupoPlantao,
      );
      const resolucaoEquipe = resolverEquipeResponsavelParaPlantao(equipes, equipeJornadaReferenciaId);
      setWizardGrupoId(resolucao.estado === 'RESOLVIDO' ? resolucao.valor.grupoId : '');
      setWizardEquipeId(
        resolucao.estado === 'RESOLVIDO'
          ? resolucao.valor.equipeResponsavelId
          : resolucaoEquipe.estado === 'RESOLVIDO' ? resolucaoEquipe.valor.id : '',
      );
    }
    setWizardErro('');
  }
  function mudarEquipeWizard(equipeId: string) {
    setWizardEquipeId(equipeId);
    if (wizardTipo === 'PLANTAO') {
      const grupo = gruposPlantaoAdmin.find((item) => item.equipeResponsavelId === equipeId && podeGerenciarEsteGrupoPlantao(item));
      if (grupo !== undefined) setWizardGrupoId(grupo.grupoId);
    }
  }
  function mudarGrupoWizard(grupoId: string) {
    setWizardGrupoId(grupoId);
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoId);
    if (grupo !== undefined) setWizardEquipeId(grupo.equipeResponsavelId);
  }
  async function criarEquipeWizard(nome: string, sigla: string) {
    const erros = validarCadastroInline(nome, sigla);
    const unidadeId = wizardAreaId || undefined;
    if (!souAdmin && (unidadeId === undefined || !minhasUnidadesPermitidas.includes(unidadeId))) {
      erros.push('Você só pode criar uma equipe dentro de uma área que administra.');
    }
    const id = normalizarIdentificadorTecnico(sigla);
    if (id === '' || equipesAdmin.some((item) => item.id === id)) {
      erros.push('Já existe uma equipe com esse identificador ou a sigla não é válida.');
    }
    if (erros.length > 0) {
      setWizardErro(erros.join(' '));
      return;
    }
    const unidade = unidadesAdmin.find((item) => item.unidadeId === unidadeId);
    setWizardProcessando(true);
    setWizardErro('');
    try {
      const equipe: Equipe = {
        id,
        nome: nome.trim(),
        sigla: sigla.trim(),
        ativa: true,
        unidadeId,
        caminhoUnidade: unidade?.caminho,
      };
      await salvarEquipeDoModal(equipe);
      setWizardEquipeId(equipe.id);
      setWizardErro('Equipe criada e selecionada.');
    } catch (falha) {
      setWizardErro(falha instanceof Error ? falha.message : 'Não foi possível criar a equipe.');
    } finally {
      setWizardProcessando(false);
    }
  }
  async function criarGrupoWizard(nome: string, equipeId: string) {
    const equipeResponsavel = equipesAdmin.find((item) => item.id === equipeId);
    if (equipeResponsavel === undefined) {
      setWizardErro('Selecione uma equipe responsável cadastrada para este Plantão.');
      return;
    }
    if (
      usuarioReal === null
      || !podeGerenciarGrupoPlantao(usuarioReal, {
        equipeResponsavelId: equipeId,
        unidadeResponsavelId: equipeResponsavel?.unidadeId,
        caminhoUnidadeResponsavel: equipeResponsavel?.caminhoUnidade,
      })
    ) {
      setWizardErro('Você não administra a equipe responsável por este Plantão.');
      return;
    }
    const identificador = identificadorGrupoPlantaoDaEquipe(equipeResponsavel);
    const erros = validarCadastroInline(nome, identificador);
    if (gruposPlantaoAdmin.some((item) => item.grupoId === identificador)) {
      erros.push('Já existe um Grupo de Plantão com esse identificador.');
    }
    if (erros.length > 0) {
      setWizardErro(erros.join(' '));
      return;
    }
    setWizardProcessando(true);
    setWizardErro('');
    try {
      const agora = new Date().toISOString();
      const grupo = construirGrupoPlantaoOficial({
        grupoId: identificador,
        nome: nome.trim(),
        equipeResponsavel,
        criadoPorLogin: usuarioReal.login,
        criadoEm: agora,
      });
      const errosGrupo = validarGrupoPlantao(grupo);
      if (errosGrupo.length > 0) {
        setWizardErro(errosGrupo.join(' '));
        return;
      }
      await salvarGrupoPlantaoDoModal(grupo);
      setWizardGrupoId(grupo.grupoId);
      setWizardEquipeId(grupo.equipeResponsavelId);
      setWizardErro('Plantão criado e selecionado.');
    } catch (falha) {
      setWizardErro(falha instanceof Error ? falha.message : 'Não foi possível criar o Plantão.');
    } finally {
      setWizardProcessando(false);
    }
  }
  async function selecionarArquivoWizard(file: File) {
    if (wizardTipo === null) {
      setWizardErro('Escolha Jornada 6x1 ou Plantão antes de selecionar o arquivo.');
      return;
    }
    setWizardArquivoNome(file.name);
    setWizardProcessando(true);
    setWizardErro('');
    const sucesso = await receberArquivo(file, {
      tipoEsperado: wizardTipo === 'JORNADA' ? 'ESCALA_6X1' : 'PLANTAO',
      equipeId: wizardEquipeId,
      grupoId: wizardGrupoId,
      competencia: wizardCompetencia,
    });
    setWizardProcessando(false);
    if (sucesso) {
      fecharNovaEscala();
      setTela(wizardTipo === 'JORNADA' ? 'grade' : 'importar');
    }
  }
  async function continuarWizard() {
    if (wizardTipo === null) {
      setWizardErro('Escolha o tipo de escala.');
      return;
    }
    const periodo = periodoDaCompetencia(wizardCompetencia.trim());
    if (periodo === null) {
      setWizardErro('Informe a competência no formato AAAA-MM.');
      return;
    }
    if (wizardTipo === 'JORNADA' && wizardEquipeId === '') {
      setWizardErro('Selecione ou crie uma equipe compatível com a área ativa.');
      return;
    }
    if (wizardTipo === 'PLANTAO' && wizardGrupoId === '') {
      setWizardErro('Selecione ou crie um Grupo de Plantão administrável.');
      return;
    }
    if (wizardInicio === 'IMPORTAR') {
      if (wizardArquivoNome === '') {
        setWizardErro('Selecione o arquivo depois de definir tipo, destino e competência.');
      }
      return;
    }
    if (wizardTipo === 'JORNADA') {
      const equipe = equipesAdmin.find((item) => item.id === wizardEquipeId);
      const [usuariosDaEquipe, catalogoDaEquipe] = modoDemo
        ? [usuarios, catalogo] as const
        : await Promise.all([
          listarUsuarios(wizardEquipeId),
          listarCatalogo(wizardEquipeId),
        ]);
      if (!modoDemo) {
        setUsuarios(usuariosDaEquipe);
        setCatalogo(catalogoDaEquipe);
      }
      const colaboradores = usuariosDaEquipe.filter((usuario) => usuario.ativo && usuario.equipeId === wizardEquipeId);
      const documentosNovos = colaboradores.map((colaborador) => criarMembroGrade(
        colaborador,
        colaborador.turnoPadrao,
        { equipeId: wizardEquipeId, competencia: wizardCompetencia, periodoInicio: periodo.periodoInicio, periodoFim: periodo.periodoFim },
        catalogoDaEquipe,
      ));
      setResultado({
        ok: true,
        equipeNome: equipe?.nome ?? wizardEquipeId,
        periodoInicio: periodo.periodoInicio,
        periodoFim: periodo.periodoFim,
        totalDias: documentosNovos.length > 0 ? Object.keys(documentosNovos[0].dias).length : 0,
        documentos: documentosNovos,
        erros: [],
        avisos: documentosNovos.length === 0
          ? ['Nenhum usuário ativo encontrado para esta equipe. Cadastre ou importe usuários antes de montar a escala.']
          : ['Escala criada vazia. Preencha os turnos no editor antes de salvar.'],
      });
      setLinhasConciliacao([]);
      setJornadaPossuiAlteracoesNaoSalvas(true);
      setContextoEscalaAtivo({ tipo: 'JORNADA', equipeId: wizardEquipeId, competencia: wizardCompetencia });
      setContextoSemEscala(false);
      fecharNovaEscala();
      setTela('grade');
      return;
    }
    setWizardProcessando(true);
    try {
      await criarPlantaoEmBrancoAcao(wizardGrupoId, wizardCompetencia);
    } finally {
      setWizardProcessando(false);
    }
  }
  async function abrirRascunhoWizard() {
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === wizardGrupoId);
    const existente = grupo === undefined ? undefined : (rascunhosPlantaoPorGrupo[grupo.grupoId] ?? []).find((item) => item.competencia === wizardCompetencia);
    if (grupo === undefined || existente === undefined) {
      setWizardErro('Rascunho não encontrado. Atualize a lista e tente novamente.');
      return;
    }
    setWizardProcessando(true);
    try {
      const resultadoAbertura = await abrirRascunhoNoEditorAcao(grupo, existente);
      if (resultadoAbertura.ok) {
        fecharNovaEscala();
      } else {
        setWizardErro(resultadoAbertura.motivo === 'erro'
          ? resultadoAbertura.mensagem
          : 'Rascunho não encontrado. Atualize a lista e tente novamente.');
      }
    } finally {
      setWizardProcessando(false);
    }
  }

  /**
   * Cria a working copy vazia (origem MANUAL) para um Grupo/competência
   * ainda sem rascunho — nunca sobrescreve um rascunho existente (checagem
   * de duplicata via `obterCompetenciaPlantaoRascunho`). Os vínculos nascem
   * todos já resolvidos (`vinculosDeParticipantesGrupoPlantao`): cada
   * participante ativo do grupo é uma pessoa real por login, nunca um nome
   * de planilha a conciliar.
   */
  async function criarPlantaoEmBrancoAcao(grupoIdArg = '', competenciaArg = '') {
    if (usuarioReal === null) {
      return;
    }
    const grupoId = grupoIdArg;
    const competencia = competenciaArg.trim();
    const errosValidacao = validarNovoPlantaoEmBranco({ grupoId, competencia });
    if (errosValidacao.length > 0) {
      setWizardErro(errosValidacao.join(' '));
      return;
    }
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoId);
    if (grupo === undefined) {
      setWizardErro('Selecione um Grupo de Plantão.');
      return;
    }
    if (!podeGerenciarEsteGrupoPlantao(grupo)) {
      setWizardErro('Você não administra este grupo de Plantão.');
      return;
    }
    const periodo = periodoDaCompetencia(competencia);
    if (periodo === null) {
      setWizardErro('Informe a competência no formato AAAA-MM.');
      return;
    }

    setWizardProcessando(true);
    setWizardErro('');
    try {
      if (!modoDemo) {
        const existente = await obterCompetenciaPlantaoRascunho(grupo.grupoId, competencia);
        if (existente !== null) {
                return;
        }
      }
      const participantesAtivos = (await garantirParticipantesDoGrupoCarregados(grupo.grupoId))
        .filter((item) => item.ativo);
      const vinculosIniciais = vinculosDeParticipantesGrupoPlantao(participantesAtivos, usuarios);

      setArquivo(null);
      setNomeArquivo('');
      setResultadoPlantao(null);
      setOrigemPlantaoAtual('MANUAL');
      setAtribuicoesEditaveisPlantao([]);
      setPlantaoEditadoDesdeImportacao(false);
      // FASE ESCALAS-UX-2A.1-FIX — escala vazia é uma working copy nova,
      // ainda não persistida.
      setPlantaoPossuiAlteracoesNaoSalvas(true);
      setVinculosPlantao(vinculosIniciais);
      setPreviaPlantaoValidada(previaPlantaoValidavel(vinculosIniciais));
      setAbaPreviaPlantao('calendario');
      setBuscaVinculoPlantao({});
      setPlantonistaSelecionadoPlantao(null);
      setGrupoRascunhoEscolhido(grupo.grupoId);
      setCompetenciaRascunho(competencia);
      setPeriodoInicioRascunho(periodo.periodoInicio);
      setPeriodoFimRascunho(periodo.periodoFim);
      setErroRascunhoPlantao('');
      setRascunhoPlantaoSalvoEm(null);
      setTipoArquivoDetectado('PLANTAO');
      setContextoEscalaAtivo({ tipo: 'PLANTAO', grupoId: grupo.grupoId, competencia });
      setContextoSemEscala(false);
      setMensagem(`Escala de Plantão criada — "${grupo.nome}" (${competencia}). Nenhum dado foi publicado.`);
      fecharNovaEscala();
      setTela('importar');
    } catch (falha) {
      setWizardErro(mensagemErroEscritaOperacional(falha, 'Não foi possível criar a escala de Plantão.'));
    } finally {
      setWizardProcessando(false);
    }
  }

  /**
   * Fase ESCALAS-UX-1C — "Usar período anterior" (§7-§18). Carrega a
   * competência EXATAMENTE anterior (`competenciaAnterior()`, nunca "a
   * mais recente disponível") já persistida como rascunho para este
   * Grupo, e usa suas atribuições como BASE de uma NOVA working copy —
   * via `copiarAtribuicoesParaNovaCompetencia()` (tradução de datas
   * preservando posição relativa e horário civil) e
   * `vinculosDeCopiaAnterior()` (participante ainda ativo → vínculo
   * automático; inativo/desconhecido → pendência, nunca troca sozinho).
   * A competência anterior nunca é lida como working copy nem alterada —
   * só consultada (`listarAtribuicoesPlantaoRascunho`, leitura pura).
   * Mesma checagem de duplicata de `criarPlantaoEmBrancoAcao`: nunca
   * sobrescreve um rascunho já existente na competência NOVA.
   */
  async function usarPeriodoAnteriorAcao(grupoIdArg = '', competenciaArg = '') {
    if (usuarioReal === null) {
      return;
    }
    const grupoId = grupoIdArg;
    const competencia = competenciaArg.trim();
    const errosValidacao = validarNovoPlantaoEmBranco({ grupoId, competencia });
    if (errosValidacao.length > 0) {
      setWizardErro(errosValidacao.join(' '));
      return;
    }
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoId);
    if (grupo === undefined) {
      setWizardErro('Selecione um Grupo de Plantão.');
      return;
    }
    if (!podeGerenciarEsteGrupoPlantao(grupo)) {
      setWizardErro('Você não administra este grupo de Plantão.');
      return;
    }
    const periodo = periodoDaCompetencia(competencia);
    if (periodo === null) {
      setWizardErro('Informe a competência no formato AAAA-MM.');
      return;
    }
    const labelAnterior = competenciaAnterior(competencia);
    const periodoAnterior = labelAnterior === null ? null : periodoDaCompetencia(labelAnterior);
    if (labelAnterior === null || periodoAnterior === null) {
      setWizardErro('Informe a competência no formato AAAA-MM.');
      return;
    }

    setWizardProcessando(true);
    setWizardErro('');
    try {
      if (!modoDemo) {
        const existente = await obterCompetenciaPlantaoRascunho(grupo.grupoId, competencia);
        if (existente !== null) {
                return;
        }
      }
      const rascunhosDoGrupo = await garantirRascunhosDoGrupoCarregados(grupo.grupoId);
      const competenciaAnteriorPersistida = rascunhosDoGrupo.find((item) => item.competencia === labelAnterior);
      if (competenciaAnteriorPersistida === undefined) {
        setWizardErro('Não existe uma escala anterior para este Plantão.');
        return;
      }

      const [atribuicoesAnteriores, participantesAtivos] = await Promise.all([
        modoDemo ? Promise.resolve([]) : listarAtribuicoesPlantaoRascunho(grupo.grupoId, labelAnterior),
        garantirParticipantesDoGrupoCarregados(grupo.grupoId).then((lista) => lista.filter((item) => item.ativo)),
      ]);

      const resultadoCopia = copiarAtribuicoesParaNovaCompetencia({
        atribuicoesAnteriores,
        periodoAnteriorInicio: periodoAnterior.periodoInicio,
        periodoNovoInicio: periodo.periodoInicio,
        periodoNovoFim: periodo.periodoFim,
        timezone: grupo.timezone,
        participantes: participantesAtivos,
        usuarios,
      });
      const vinculosIniciais = vinculosDeCopiaAnterior(atribuicoesAnteriores, participantesAtivos, usuarios);

      setArquivo(null);
      setNomeArquivo('');
      setResultadoPlantao(null);
      setOrigemPlantaoAtual('COPIADO');
      setAtribuicoesEditaveisPlantao(resultadoCopia.atribuicoes);
      setPlantaoEditadoDesdeImportacao(false);
      // FASE ESCALAS-UX-2A.1-FIX — cópia do período anterior é uma working
      // copy nova, ainda não persistida.
      setPlantaoPossuiAlteracoesNaoSalvas(true);
      setVinculosPlantao(vinculosIniciais);
      setPreviaPlantaoValidada(previaPlantaoValidavel(vinculosIniciais));
      setAbaPreviaPlantao('calendario');
      setBuscaVinculoPlantao({});
      setPlantonistaSelecionadoPlantao(null);
      setGrupoRascunhoEscolhido(grupo.grupoId);
      setCompetenciaRascunho(competencia);
      setPeriodoInicioRascunho(periodo.periodoInicio);
      setPeriodoFimRascunho(periodo.periodoFim);
      setErroRascunhoPlantao('');
      setRascunhoPlantaoSalvoEm(null);
      setTipoArquivoDetectado('PLANTAO');
      setContextoEscalaAtivo({ tipo: 'PLANTAO', grupoId: grupo.grupoId, competencia });
      setContextoSemEscala(false);
      setMensagem(resultadoCopia.quantidadeNaoCopiada > 0
        ? `Escala baseada na competência anterior (${labelAnterior}) — "${grupo.nome}" (${competencia}). ${resultadoCopia.quantidadeNaoCopiada} plantão(ões) da competência anterior não coube(ram) na nova janela e não foram copiados. Nenhum dado foi publicado.`
        : `Escala baseada na competência anterior (${labelAnterior}) — "${grupo.nome}" (${competencia}). Nenhum dado foi publicado.`);
      fecharNovaEscala();
      setTela('importar');
    } catch (falha) {
      setWizardErro(mensagemErroFirebase(falha, 'Não foi possível usar o período anterior.', ambienteFirebaseAtual));
    } finally {
      setWizardProcessando(false);
    }
  }

  function selecionarVinculoConciliacao(linha: LinhaConciliacao, login: string) {
    if (arquivo === null) {
      return;
    }
    const escolhido = usuarios.find((item) => item.login === login);
    if (escolhido === undefined) {
      return;
    }
    aplicarConciliacao(
      arquivo,
      linhasConciliacao.map((item) => (item === linha ? resolverManualmente(item, escolhido) : item)),
    );
  }

  function marcarConciliacaoPendente(linha: LinhaConciliacao) {
    if (arquivo === null) {
      return;
    }
    aplicarConciliacao(
      arquivo,
      linhasConciliacao.map((item) => (item === linha ? marcarPendente(item) : item)),
    );
  }

  function ignorarConciliacao(linha: LinhaConciliacao) {
    if (arquivo === null) {
      return;
    }
    aplicarConciliacao(
      arquivo,
      linhasConciliacao.map((item) => (item === linha ? ignorarLinha(item) : item)),
    );
  }

  async function salvarAliasConciliacao(linha: LinhaConciliacao) {
    if (linha.login === null) {
      return;
    }
    const escolhido = usuarios.find((item) => item.login === linha.login);
    if (escolhido === undefined) {
      return;
    }
    const aliasesAtualizados = normalizarAliasesPlanilha([...(escolhido.aliasesPlanilha ?? []), linha.nomePlanilha]);
    const agora = new Date().toISOString();
    try {
      // Atualiza só os aliases + o carimbo de data — não regrava o usuário
      // inteiro, então um cadastro antigo sem `criadoEm` não é afetado.
      if (!modoDemo) {
        await atualizarAliasesPlanilha(escolhido.login, aliasesAtualizados);
      }
      const atualizado: Usuario = { ...escolhido, aliasesPlanilha: aliasesAtualizados, atualizadoEm: agora };
      setUsuarios((atuais) => atuais.map((item) => (item.login === atualizado.login ? atualizado : item)));
      setMensagem(`Alias "${linha.nomePlanilha}" salvo para ${atualizado.nome}.`);
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível salvar o alias.', ambienteFirebaseAtual));
    }
  }

  /**
   * Ponto único de entrada da importação: detecta a estrutura ANTES de
   * decidir o fluxo (ver `docs/spec/PLANTOES.md`, "dois domínios, não
   * um"). A escala 6x1 continua exatamente com o fluxo que já existia
   * (`interpretar`); Plantão ganha um preview novo, sem tocar o
   * comportamento 6x1; uma estrutura não reconhecida só avisa — nunca
   * tenta nenhum dos dois parsers "na sorte".
   */
  async function receberArquivo(file: File | undefined, opcoes: OpcoesInicioImportacao = {}): Promise<boolean> {
    if (file === undefined) {
      return false;
    }
    const extensaoValida = /\.(xls|xlsx)$/iu.test(file.name);
    if (!extensaoValida) {
      setMensagem('Selecione um arquivo XLS ou XLSX.');
      return false;
    }

    const buffer = await file.arrayBuffer();
    const processado = processarArquivoImportado(buffer, {
      equipeId: opcoes.equipeId ?? usuarioEfetivo?.equipeId ?? EQUIPE_DEMO.id,
      competencia: opcoes.competencia ?? '2026-08',
      catalogo,
      loginParaUid: mapaLogins(usuarios),
    });
    setTipoArquivoDetectado(processado.tipo);
    if (opcoes.tipoEsperado !== undefined && processado.tipo !== opcoes.tipoEsperado) {
      const esperado = opcoes.tipoEsperado === 'PLANTAO' ? 'Plantão' : 'Jornada 6x1';
      const encontrado = processado.tipo === 'PLANTAO' ? 'Plantão' : processado.tipo === 'ESCALA_6X1' ? 'Jornada 6x1' : 'estrutura desconhecida';
      setMensagem(`O arquivo escolhido não corresponde ao tipo selecionado. Esperado: ${esperado}. Encontrado: ${encontrado}.`);
      return false;
    }
    if (processado.tipo === 'DESCONHECIDA') {
      setResultado(null);
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setLinhasConciliacao([]);
      setResultadoPlantao(null);
      setVinculosPlantao([]);
      setArquivo(null);
      setNomeArquivo(file.name);
      setMotivoArquivoDesconhecido(processado.motivo);
      setMensagem(processado.motivo);
      return false;
    }
    if (processado.tipo === 'PLANTAO') {
      const grupoAtual = contextoEhPlantao(contextoEscalaAtivo) ? contextoEscalaAtivo.grupoId : '';
      const opcoesPlantao = {
        ...opcoes,
        grupoId: opcoes.grupoId ?? (grupoAtual || undefined),
        competencia: opcoes.competencia ?? (contextoEhPlantao(contextoEscalaAtivo) ? contextoEscalaAtivo.competencia : undefined),
      };
      if (opcoesPlantao.grupoId === undefined || opcoesPlantao.grupoId.trim() === '') {
        setMensagem('Selecione o contexto Plantão no topo ou use o fluxo de importação para definir o Grupo de Plantão antes de carregar o arquivo.');
        return false;
      }
      setResultado(null);
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setLinhasConciliacao([]);
      interpretarPlantao(buffer, file.name, processado.resultado, opcoesPlantao);
      return true;
    }
    setResultadoPlantao(null);
    setVinculosPlantao([]);
    interpretar(buffer, file.name, opcoes);
    return true;
  }

  function soltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    void receberArquivo(evento.dataTransfer.files[0]);
  }

  function corrigirErro(erro: ErroImportacao, indice: number) {
    const valor = correcoes[indice]?.trim();
    if (arquivo === null || !valor) {
      return;
    }
    const workbook = XLSX.read(arquivo, { type: 'array', cellStyles: true });
    const planilha = workbook.Sheets.Escalistas;
    if (planilha === undefined) {
      setMensagem('A aba Escalistas não foi encontrada.');
      return;
    }
    planilha[`${erro.coluna}${erro.linha}`] = { t: 's', v: valor };
    const bookType = nomeArquivo.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls';
    const corrigido = XLSX.write(workbook, {
      type: 'array',
      bookType,
      cellStyles: true,
    }) as ArrayBuffer;
    interpretar(corrigido, nomeArquivo);
  }

  async function cadastrarFaltantes() {
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (usuarioEfetivo === null) {
      return;
    }
    setProcessando(true);
    try {
      const logins = [...new Set(
        (resultado?.erros ?? [])
          .filter((erro) => erro.motivo.includes('loginParaUid'))
          .map((erro) => erro.login)
          .filter((login): login is string => login !== undefined),
      )];
      const novos = logins.map((login, indice) =>
        novoUsuario(usuarios.length + indice + 1, usuarioEfetivo, login, true));
      if (!modoDemo) {
        await salvarUsuarios(novos);
        await registrarAuditoriaSeSimulando('CADASTRAR_USUARIOS');
      }
      const atualizados = [...usuarios, ...novos];
      setUsuarios(atualizados);
      if (arquivo !== null) {
        const parseado = parsePlanilhaEscala(arquivo, {
          equipeId: usuarioEfetivo.equipeId,
          competencia: '2026-08',
          catalogo,
          loginParaUid: mapaLogins(atualizados),
        });
        setResultado(parseado);
        // FASE ESCALAS-UX-2A.1-FIX — ainda é o mesmo arquivo importado, só
        // reprocessado com os logins recém-cadastrados; continua não salvo.
        setJornadaPossuiAlteracoesNaoSalvas(true);
        setMensagem(parseado.ok
          ? `${novos.length} usuário(s) cadastrado(s). A escala está pronta para salvar.`
          : `${parseado.erros.length} inconsistência(s) ainda precisam de correção.`);
      }
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível cadastrar os usuários faltantes.', ambienteFirebaseAtual));
    } finally {
      setProcessando(false);
    }
  }

  async function salvar() {
    if (resultado === null || usuarioEfetivo === null || !resultado.ok) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (conciliacaoBloqueiaPublicacao) {
      setMensagem('Resolva as pendências de conciliação de nomes antes de salvar.');
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        await salvarRascunho(resultado, usuarioEfetivo, nomeArquivo);
        await registrarAuditoriaSeSimulando('SALVAR_RASCUNHO');
      }
      setResultado({
        ...resultado,
        documentos: resultado.documentos.map((documento) => ({
          ...documento,
          status: 'RASCUNHO',
        })),
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setMensagem('Rascunho salvo com sucesso. Nenhum arquivo foi enviado.');
      setTela('escalas');
    } catch (falha) {
      setMensagem(mensagemErroEscritaOperacional(falha, 'Não foi possível salvar.'));
    } finally {
      setProcessando(false);
    }
  }

  async function publicar() {
    setErroPublicacao('');
    if (resultado === null || usuarioEfetivo === null || !resultado.ok) {
      setErroPublicacao('Corrija todos os logins e inconsistências antes de publicar.');
      return;
    }
    if (escritaBloqueada) {
      setErroPublicacao('A publicação está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (conciliacaoBloqueiaPublicacao) {
      setErroPublicacao('Resolva as pendências de conciliação de nomes antes de publicar.');
      return;
    }
    if (revisaoAtual > 0 && motivoPublicacao.trim().length < 3) {
      setErroPublicacao('Informe um motivo curto para explicar o que mudou nesta publicação.');
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        const publicacao = await publicarEscalas(
          resultado.documentos,
          usuarioEfetivo.login,
          motivoPublicacao,
        );
        setHistorico((atual) => [publicacao, ...atual]);
        setRevisaoAtual(publicacao.revisao);
        await registrarAuditoriaSeSimulando('PUBLICAR_ESCALA');
      } else {
        setRevisaoAtual((atual) => atual + 1);
      }
      const agora = new Date().toISOString();
      setResultado({
        ...resultado,
        documentos: resultado.documentos.map((documento) => ({
          ...documento,
          status: 'PUBLICADA',
          publicadoPor: usuarioEfetivo.login,
          publicadoEm: agora,
        })),
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setMensagem('Escala publicada para a equipe.');
      setPublicacaoPendente(false);
      setMotivoPublicacao('');
    } catch (falha) {
      const texto = mensagemErroEscritaOperacional(falha, 'Falha na publicação.');
      // O modal continua aberto (não chamamos setPublicacaoPendente(false))
      // e mostra o erro localmente — o toast global fica atrás do modal
      // visualmente, então não basta avisar só por ele.
      setErroPublicacao(texto);
      setMensagem(texto);
    } finally {
      setProcessando(false);
    }
  }

  async function alternarDetalhes(publicacao: PublicacaoEscala) {
    if (publicacaoExpandida === publicacao.id) {
      setPublicacaoExpandida(null);
      return;
    }
    setPublicacaoExpandida(publicacao.id);
    if (modoDemo || detalhesPublicacao[publicacao.id] !== undefined || usuarioEfetivo === null) {
      return;
    }
    try {
      const eventos = await listarEventosPublicacao(usuarioEfetivo.equipeId, publicacao.id);
      setDetalhesPublicacao((atuais) => ({ ...atuais, [publicacao.id]: eventos }));
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível carregar os detalhes da revisão.', ambienteFirebaseAtual));
    }
  }

  // --- Troca de escala real (Firestore `trocasEscala`, ver docs/spec/TROCA_ESCALA_PLANO.md) ---

  async function recusarTroca(id: string, motivo: string) {
    if (usuarioEfetivo === null) {
      return;
    }
    setProcessandoTroca(true);
    setErroTroca('');
    try {
      await gestorRecusarTroca(id, { login: usuarioEfetivo.login, nome: usuarioEfetivo.nome }, motivo);
      await registrarAuditoriaSeSimulando('RECUSAR_TROCA');
      setTrocaSelecionadaId(null);
      setMotivoRecusaTroca('');
    } catch (falha) {
      setErroTroca(mensagemErroTrocaGestor(falha, 'Não foi possível recusar a troca.'));
    } finally {
      setProcessandoTroca(false);
    }
  }

  async function aprovarEPublicarTroca(id: string) {
    if (usuarioEfetivo === null) {
      return;
    }
    setProcessandoTroca(true);
    setErroTroca('');
    try {
      await gestorAprovarEPublicarTroca(id, { login: usuarioEfetivo.login, nome: usuarioEfetivo.nome }, catalogo);
      await registrarAuditoriaSeSimulando('APROVAR_TROCA');
      setTrocaSelecionadaId(null);
    } catch (falha) {
      setErroTroca(mensagemErroTrocaGestor(falha, 'Não foi possível aprovar e publicar a troca.'));
    } finally {
      setProcessandoTroca(false);
    }
  }

  /**
   * Alertas de 6x1/descanso mínimo calculados de verdade (mesmas funções de
   * `lib/alertasEscala.ts` usadas na grade), sobre uma cópia hipotética dos
   * dois documentos com o dia trocado — mesma `aplicarTrocaNosDias` que a
   * aprovação real usa, para o modal nunca mostrar um cálculo diferente do
   * que a escrita de fato aplica. Retorna vazio se os dois colaboradores (ou
   * o dia da troca) não existirem mais na grade carregada agora.
   */
  function alertasHipoteticosTroca(troca: SolicitacaoTrocaReal): AlertaEscala[] {
    const docSolicitante = documentos.find((item) => item.login === troca.solicitanteLogin);
    const docDestinatario = documentos.find((item) => item.login === troca.destinatarioLogin);
    if (!docSolicitante || !docDestinatario) {
      return [];
    }
    try {
      const { diasSolicitante, diasDestinatario } = aplicarTrocaNosDias(
        docSolicitante.dias,
        docDestinatario.dias,
        troca.data,
      );
      const docSolicitanteHipotetico: TurnosMes = { ...docSolicitante, dias: diasSolicitante };
      const docDestinatarioHipotetico: TurnosMes = { ...docDestinatario, dias: diasDestinatario };
      return [
        ...detectarSequencias6x1(docSolicitanteHipotetico, catalogo),
        ...detectarSequencias6x1(docDestinatarioHipotetico, catalogo),
        ...detectarDescansoInsuficiente(docSolicitanteHipotetico, catalogo),
        ...detectarDescansoInsuficiente(docDestinatarioHipotetico, catalogo),
      ];
    } catch {
      return [];
    }
  }

  async function restaurar() {
    if (usuarioEfetivo === null || revisaoParaRestaurar === null || modoDemo) {
      setRevisaoParaRestaurar(null);
      return;
    }
    if (escritaBloqueada) {
      setMensagem('O rollback está bloqueado fora do laboratório local.');
      setRevisaoParaRestaurar(null);
      return;
    }
    setProcessando(true);
    try {
      const restaurada = await reverterPublicacao(
        usuarioEfetivo.equipeId,
        revisaoParaRestaurar.competencia,
        revisaoParaRestaurar.revisao,
        usuarioEfetivo.login,
      );
      setHistorico((atual) => [restaurada.publicacao, ...atual]);
      setRevisaoAtual(restaurada.publicacao.revisao);
      await registrarAuditoriaSeSimulando('ROLLBACK_PUBLICACAO');
      const datas = restaurada.documentos.flatMap((documento) => Object.keys(documento.dias));
      setResultado({
        ok: true,
        equipeNome: usuarioEfetivo.equipeId,
        periodoInicio: datas.sort()[0] ?? '2026-07-26',
        periodoFim: datas.sort().at(-1) ?? '2026-08-25',
        totalDias: new Set(datas).size,
        documentos: restaurada.documentos,
        erros: [],
        avisos: [],
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setMensagem(
        `Revisão ${revisaoParaRestaurar.revisao} restaurada como revisão ${restaurada.publicacao.revisao}.`,
      );
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Falha ao restaurar a revisão.', ambienteFirebaseAtual));
    } finally {
      setProcessando(false);
      setRevisaoParaRestaurar(null);
    }
  }

  function abrirCelulaParaEdicao(documento: TurnosMes, data: string, dia: Dia) {
    setCicloInicial6x1Ativo(!dia.c);
    setCelulaEditando({ documento, data, dia });
  }

  function editarCelula(codigo: string) {
    if (celulaEditando === null || resultado === null) {
      return;
    }
    const tipo = catalogo[codigo];
    if (tipo === undefined) {
      return;
    }
    const novoDia: Dia = tipo.categoria === 'TRABALHO'
      ? {
          c: tipo.codigo,
          i: tipo.horaInicio,
          f: tipo.horaFim,
          m: tipo.duracaoMinutos,
          vd: tipo.viraDia,
          seq: celulaEditando.dia.seq ?? 1,
        }
      : { c: tipo.codigo };

    const documentoAlvo = resultado.documentos.find(
      (documento) => documento.usuarioUid === celulaEditando.documento.usuarioUid,
    );
    if (documentoAlvo === undefined) {
      return;
    }
    const ciclo = cicloInicial6x1Ativo && tipo.categoria === 'TRABALHO'
      ? calcularCicloInicialJornada6x1({
          dataInicial: celulaEditando.data,
          periodoFim: documentoAlvo.periodoFim,
          dias: documentoAlvo.dias,
        })
      : { datasAplicadas: [celulaEditando.data], datasIgnoradas: [] };
    const datasAplicadas = new Set(ciclo.datasAplicadas);
    const dias = { ...documentoAlvo.dias };
    for (const data of datasAplicadas) {
      if (data === celulaEditando.data || !dias[data]?.c) {
        dias[data] = { ...novoDia, seq: 1 };
      }
    }

    const atualizados = resultado.documentos.map((documento) => {
      if (documento.usuarioUid !== celulaEditando.documento.usuarioUid) {
        return documento;
      }
      return { ...documento, dias, totais: calcularTotais(dias, catalogo) };
    });
    setResultado({ ...resultado, documentos: atualizados });
    // Fase ESCALAS-UX-2A.1 — o único ponto de edição local da Jornada;
    // ver comentário do estado `jornadaPossuiAlteracoesNaoSalvas`.
    setJornadaPossuiAlteracoesNaoSalvas(true);
    setCelulaEditando(null);
    setCicloInicial6x1Ativo(false);
    if (cicloInicial6x1Ativo && tipo.categoria === 'TRABALHO') {
      setMensagem(mensagemCicloInicialJornada6x1(ciclo, codigo));
    } else if (cicloInicial6x1Ativo && tipo.categoria !== 'TRABALHO') {
      setMensagem(`${codigo} aplicado somente neste dia; o preenchimento 6x1 automático vale para turnos de trabalho.`);
    } else {
      setMensagem('Célula atualizada no rascunho local. Salve para persistir.');
    }
  }

  function abrirNovoUsuario() {
    setFormularioUsuario({
      loginOriginal: null,
      nome: '',
      email: '',
      login: '',
      cargo: '',
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      aliasesPlanilha: [],
      unidadesPermitidas: [],
      equipesPermitidas: [],
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function abrirEdicaoUsuario(item: Usuario) {
    setFormularioUsuario({
      loginOriginal: item.login,
      nome: item.nome,
      email: item.email,
      login: item.login,
      cargo: item.cargo,
      nivelHierarquico: item.nivelHierarquico,
      turnoPadrao: item.turnoPadrao,
      ativo: item.ativo,
      aliasesPlanilha: item.aliasesPlanilha ?? [],
      perfil: item.perfil,
      escopo: item.escopo,
      unidadeId: item.unidadeId,
      unidadesPermitidas: item.unidadesPermitidas ?? [],
      equipesPermitidas: item.equipesPermitidas ?? [],
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function fecharFormularioUsuario() {
    setFormularioUsuario(null);
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function adicionarAliasDraft() {
    if (formularioUsuario === null || novoAliasDraft.trim() === '') {
      return;
    }
    setFormularioUsuario({
      ...formularioUsuario,
      aliasesPlanilha: normalizarAliasesPlanilha([...formularioUsuario.aliasesPlanilha, novoAliasDraft]),
    });
    setNovoAliasDraft('');
  }

  function removerAliasDraft(alias: string) {
    if (formularioUsuario === null) {
      return;
    }
    setFormularioUsuario({
      ...formularioUsuario,
      aliasesPlanilha: formularioUsuario.aliasesPlanilha.filter((item) => item !== alias),
    });
  }

  /**
   * Alterna um ID dentro de `unidadesPermitidas`/`equipesPermitidas` do
   * formulário — usado pelos checkboxes da seção administrativa (visível só
   * para `souAdmin`, ver JSX do modal).
   */
  function alternarNaListaFormularioUsuario(
    campo: 'unidadesPermitidas' | 'equipesPermitidas',
    id: string,
  ) {
    if (formularioUsuario === null) {
      return;
    }
    const atual = formularioUsuario[campo];
    setFormularioUsuario({
      ...formularioUsuario,
      [campo]: atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    });
  }

  async function salvarFormularioUsuario() {
    if (formularioUsuario === null || usuarioEfetivo === null) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }

    /**
     * Campos administrativos (perfil/escopo/unidadeId/unidadesPermitidas/
     * equipesPermitidas) só entram no payload quando `souAdmin` — as rules
     * exigem que um gestor comum NUNCA envie esses campos (nem para
     * "reafirmar" o valor atual), então omiti-los aqui é obrigatório, não
     * só desabilitar os inputs no formulário.
     */
    const camposAdministrativos: Partial<Usuario> = souAdmin
      ? {
        perfil: formularioUsuario.perfil,
        escopo: formularioUsuario.escopo,
        unidadeId: formularioUsuario.unidadeId,
        unidadesPermitidas: formularioUsuario.unidadesPermitidas,
        equipesPermitidas: formularioUsuario.equipesPermitidas,
      }
      : {};

    let candidato: Usuario;
    if (formularioUsuario.loginOriginal === null) {
      candidato = {
        ...novoUsuario(
          usuarios.length + 1,
          usuarioEfetivo,
          formularioUsuario.login || `novo.login${usuarios.length + 1}`,
          formularioUsuario.ativo,
        ),
        nome: formularioUsuario.nome,
        email: formularioUsuario.email,
        cargo: formularioUsuario.cargo,
        nivelHierarquico: formularioUsuario.nivelHierarquico,
        turnoPadrao: formularioUsuario.turnoPadrao,
        aliasesPlanilha: formularioUsuario.aliasesPlanilha,
        ...camposAdministrativos,
      };
    } else {
      const original = usuarios.find((item) => item.login === formularioUsuario.loginOriginal);
      if (original === undefined) {
        return;
      }
      candidato = {
        ...original,
        nome: formularioUsuario.nome,
        email: formularioUsuario.email,
        cargo: formularioUsuario.cargo,
        nivelHierarquico: formularioUsuario.nivelHierarquico,
        turnoPadrao: formularioUsuario.turnoPadrao,
        ativo: formularioUsuario.ativo,
        aliasesPlanilha: formularioUsuario.aliasesPlanilha,
        ...camposAdministrativos,
        atualizadoEm: new Date().toISOString(),
      };
    }

    const erros = validarEdicaoUsuario(candidato, usuarios, formularioUsuario.loginOriginal);
    if (erros.length > 0) {
      setErrosFormularioUsuario(erros);
      return;
    }

    try {
      if (!modoDemo) {
        await salvarUsuario(candidato);
        await registrarAuditoriaSeSimulando('SALVAR_USUARIO');
      }
      setUsuarios((atuais) => (atuais.some((item) => item.login === candidato.login)
        ? atuais.map((item) => (item.login === candidato.login ? candidato : item))
        : [...atuais, candidato]));
      setMensagem(formularioUsuario.loginOriginal === null
        ? 'Usuário cadastrado com sucesso.'
        : 'Usuário atualizado com sucesso.');
      fecharFormularioUsuario();
    } catch (falha) {
      setErrosFormularioUsuario([mensagemErroFirebase(falha, 'Não foi possível salvar o usuário.', ambienteFirebaseAtual)]);
    }
  }

  async function alternarAtivoUsuario(item: Usuario) {
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    const atualizado: Usuario = { ...item, ativo: !item.ativo, atualizadoEm: new Date().toISOString() };
    try {
      if (!modoDemo) {
        await salvarUsuario(atualizado);
        await registrarAuditoriaSeSimulando('ATIVAR_DESATIVAR_USUARIO');
      }
      setUsuarios((atuais) => atuais.map((existente) => (existente.login === item.login ? atualizado : existente)));
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível atualizar o status do usuário.', ambienteFirebaseAtual));
    }
  }

  function abrirAdicionarMembroGrade() {
    setMembroGradeDraft({ login: '', turnoPadrao: 'M' });
  }

  function fecharAdicionarMembroGrade() {
    setMembroGradeDraft(null);
  }

  async function confirmarAdicionarMembroGrade() {
    if (membroGradeDraft === null || resultado === null) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (equipeIdDaGradeAtiva === null) {
      setMensagem('Nenhuma equipe de Jornada está selecionada para esta grade.');
      return;
    }
    const colaborador = usuariosElegiveisGrade.find((item) => item.login === membroGradeDraft.login);
    if (colaborador === undefined) {
      setMensagem('Selecione um usuário ativo desta equipe que ainda não esteja na grade.');
      return;
    }
    if (membroJaNaGrade(resultado.documentos, colaborador.login)) {
      setMensagem('Este colaborador já está na grade desta competência.');
      return;
    }
    const referencia = {
      equipeId: equipeIdDaGradeAtiva,
      competencia: resultado.documentos[0]?.competencia ?? '2026-08',
      periodoInicio: resultado.periodoInicio,
      periodoFim: resultado.periodoFim,
    };
    const membro = criarMembroGrade(colaborador, membroGradeDraft.turnoPadrao, referencia, catalogo);
    try {
      if (!modoDemo) {
        await adicionarMembroRascunho(membro);
        await registrarAuditoriaSeSimulando('ADICIONAR_MEMBRO_GRADE');
      }
      setResultado((atual) => (atual === null ? atual : {
        ...atual,
        documentos: adicionarMembroGrade(atual.documentos, membro),
      }));
      setMensagem(`${colaborador.nome} incluído(a) na grade desta competência.`);
      setMembroGradeDraft(null);
    } catch (falha) {
      setMensagem(mensagemErroEscritaOperacional(falha, 'Não foi possível incluir o colaborador na grade.'));
    }
  }

  async function confirmarRemocaoMembroGrade() {
    if (removerMembroPendente === null) {
      return;
    }
    const documento = removerMembroPendente;
    setRemoverMembroPendente(null);
    try {
      if (!modoDemo) {
        await excluirRascunho(documento);
      }
      setResultado((atual) => (atual === null ? atual : {
        ...atual,
        documentos: removerMembroGrade(atual.documentos, documento.login),
      }));
      setMensagem('Colaborador removido da grade desta competência.');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível remover o colaborador da grade. Se a escala já foi publicada, não é possível remover por aqui.', ambienteFirebaseAtual));
    }
  }

  async function descartarRascunho() {
    setDescarteRascunhoPendente(false);
    if (resultado === null) {
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        for (const documento of resultado.documentos) {
          if (documento.status === 'RASCUNHO') {
            await excluirRascunho(documento);
          }
        }
      }
      setResultado(null);
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setArquivo(null);
      setLinhasConciliacao([]);
      setTela('importar');
      setMensagem('Rascunho descartado.');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível descartar o rascunho.', ambienteFirebaseAtual));
    } finally {
      setProcessando(false);
    }
  }

  // --- Administração de Plantão (Fase PLANTÃO-3B) ---

  function podeGerenciarEsteGrupoPlantao(grupo: GrupoPlantao): boolean {
    return usuarioReal !== null
      && escoposOperacionais.plantoesAdministraveis.some((item) => item.grupoId === grupo.grupoId);
  }

  function abrirNovoGrupoPlantao() {
    if (usuarioReal === null) {
      return;
    }
    setModalGrupoPlantao({
      modo: 'criar',
      inicial: {
        grupoId: '',
        nome: '',
        descricao: undefined,
        equipeResponsavelId: '',
        equipesConsulta: [],
        timezone: 'America/Sao_Paulo',
        ativo: true,
        padraoHorarioSemanal: undefined,
        schemaVersion: 1,
        criadoPorLogin: usuarioReal.login,
        criadoEm: '',
        atualizadoEm: '',
      },
    });
  }

  function abrirEdicaoGrupoPlantao(grupo: GrupoPlantao) {
    setModalGrupoPlantao({ modo: 'editar', inicial: grupo });
  }

  async function salvarGrupoPlantaoDoModal(grupo: GrupoPlantao) {
    try {
      if (!modoDemo) {
        await salvarGrupoPlantao(grupo);
      }
      setGruposPlantaoAdmin((atuais) => (atuais.some((item) => item.grupoId === grupo.grupoId)
        ? atuais.map((item) => (item.grupoId === grupo.grupoId ? grupo : item))
        : [...atuais, grupo]));
      setModalGrupoPlantao(null);
    } catch (falha) {
      throw new Error(mensagemErroFirebase(falha, 'Não foi possível salvar o grupo de Plantão.', ambienteFirebaseAtual));
    }
  }

  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — "Plantões monitorados pela equipe":
   * autovínculo de CONSULTA, nunca administração. Só altera
   * `equipesConsulta` (via `atualizarEquipeConsultaPlantao()`, que nunca
   * reaproveita `salvarGrupoPlantao()` genérico) — a autorização real
   * (`podeAutoVincularConsultaPlantao()` em `firestore.rules`) garante que
   * só a própria equipe administrada pode ser adicionada/removida.
   */
  async function alternarPlantaoMonitoradoPelaEquipe(grupoId: string, equipeId: string, acao: 'ADICIONAR' | 'REMOVER') {
    setProcessandoConsultaPlantao(grupoId);
    setErroPlantaoAdmin('');
    try {
      if (!modoDemo) {
        await atualizarEquipeConsultaPlantao(grupoId, equipeId, acao);
      }
      setGruposPlantaoAdmin((atuais) => atuais.map((grupo) => {
        if (grupo.grupoId !== grupoId) {
          return grupo;
        }
        const equipesConsulta = acao === 'ADICIONAR'
          ? [...new Set([...grupo.equipesConsulta, equipeId])]
          : grupo.equipesConsulta.filter((item) => item !== equipeId);
        return { ...grupo, equipesConsulta, atualizadoEm: new Date().toISOString() };
      }));
    } catch (falha) {
      setErroPlantaoAdmin(mensagemErroFirebase(falha, 'Não foi possível atualizar os Plantões monitorados.', ambienteFirebaseAtual));
    } finally {
      setProcessandoConsultaPlantao(null);
    }
  }

  async function abrirParticipantesDoGrupo(grupoId: string) {
    setGrupoPlantaoExpandido((atual) => (atual === grupoId ? null : grupoId));
    // Fase ESCALAS-UX-1B.1 — carrega os rascunhos do grupo junto (cache
    // próprio, independente do de participantes) para a seção "Rascunhos"
    // aparecer assim que o card expande, sem um segundo botão/toggle.
    void garantirRascunhosDoGrupoCarregados(grupoId);
    if (modoDemo || participantesPorGrupoPlantao[grupoId] !== undefined) {
      return;
    }
    try {
      const participantes = await listarParticipantesPlantao(grupoId);
      setParticipantesPorGrupoPlantao((atuais) => ({ ...atuais, [grupoId]: participantes }));
    } catch (falha) {
      setErroPlantaoAdmin(mensagemErroFirebase(falha, 'Não foi possível carregar os participantes deste grupo.', ambienteFirebaseAtual));
    }
  }

  /** Mesmo padrão de `abrirParticipantesDoGrupo()`, mas para a lista de rascunhos (§ 13 da fase) — cache próprio, nunca reconsulta se já carregado. */
  async function garantirRascunhosDoGrupoCarregados(grupoId: string): Promise<CompetenciaPlantao[]> {
    const cache = rascunhosPlantaoPorGrupo[grupoId];
    if (modoDemo || cache !== undefined) {
      return cache ?? [];
    }
    try {
      const rascunhos = await listarCompetenciasPlantaoRascunho(grupoId);
      setRascunhosPlantaoPorGrupo((atuais) => ({ ...atuais, [grupoId]: rascunhos }));
      return rascunhos;
    } catch (falha) {
      setErroPlantaoAdmin(mensagemErroFirebase(falha, 'Não foi possível carregar os rascunhos deste grupo.', ambienteFirebaseAtual));
      return [];
    }
  }

  /**
   * Fase ESCALAS-UX-1B.1 — o coração do "reabrir rascunho": lê
   * Grupo/competência/atribuições/participantes já persistidos via
   * `plantaoReadRepository.ts` (nenhuma query nova no Dashboard), reidrata
   * com `reidratarRascunhoPlantao()` e alimenta o MESMO estado que
   * `interpretarPlantao()`/`criarPlantaoEmBrancoAcao()` já usam — o
   * Editor que abre a seguir é exatamente o mesmo, nunca um segundo.
   * Nunca navega para "Importar" antes da leitura terminar (§ 17 da
   * fase) — o calendário só aparece depois que tudo foi carregado com
   * sucesso.
   */
  async function abrirRascunhoNoEditorAcao(
    grupo: GrupoPlantao,
    competenciaAlvo: CompetenciaPlantao,
  ): Promise<{ ok: true } | { ok: false; motivo: 'nao-encontrado' } | { ok: false; motivo: 'erro'; mensagem: string }> {
    setAbrirRascunhoPlantaoStatus({ fase: 'carregando' });
    try {
      const [atribuicoesPersistidas, participantes, competenciaFresca] = await Promise.all([
        modoDemo ? Promise.resolve([]) : listarAtribuicoesPlantaoRascunho(grupo.grupoId, competenciaAlvo.competencia),
        modoDemo ? Promise.resolve(participantesPorGrupoPlantao[grupo.grupoId] ?? []) : listarParticipantesPlantao(grupo.grupoId),
        modoDemo ? Promise.resolve(competenciaAlvo) : obterCompetenciaPlantaoRascunho(grupo.grupoId, competenciaAlvo.competencia),
      ]);
      if (competenciaFresca === null) {
        setAbrirRascunhoPlantaoStatus({ fase: 'nao-encontrado' });
        return { ok: false, motivo: 'nao-encontrado' };
      }

      const reidratado = reidratarRascunhoPlantao({
        grupo,
        competencia: competenciaFresca,
        atribuicoesPersistidas,
        participantes,
        usuarios,
      });

      setParticipantesPorGrupoPlantao((atuais) => ({ ...atuais, [grupo.grupoId]: participantes }));
      setGruposPlantaoAdmin((atuais) => (atuais.some((item) => item.grupoId === grupo.grupoId) ? atuais : [...atuais, grupo]));
      setArquivo(null);
      setNomeArquivo('');
      setResultadoPlantao(null);
      setOrigemPlantaoAtual(reidratado.origem);
      setAtribuicoesEditaveisPlantao(reidratado.atribuicoesEditaveis);
      setPlantaoEditadoDesdeImportacao(false);
      // FASE ESCALAS-UX-2A.1-FIX — rascunho recém-reaberto já está
      // persistido; nenhuma alteração pendente ainda.
      setPlantaoPossuiAlteracoesNaoSalvas(false);
      setVinculosPlantao(reidratado.vinculos);
      setPreviaPlantaoValidada(previaPlantaoValidavel(reidratado.vinculos));
      setAbaPreviaPlantao('calendario');
      setBuscaVinculoPlantao({});
      setPlantonistaSelecionadoPlantao(null);
      setGrupoRascunhoEscolhido(grupo.grupoId);
      setCompetenciaRascunho(reidratado.competencia.competencia);
      setPeriodoInicioRascunho(reidratado.competencia.periodoInicio);
      setPeriodoFimRascunho(reidratado.competencia.periodoFim);
      setErroRascunhoPlantao('');
      setRascunhoPlantaoSalvoEm(null);
      setTipoArquivoDetectado('PLANTAO');
      setContextoEscalaAtivo({ tipo: 'PLANTAO', grupoId: grupo.grupoId, competencia: reidratado.competencia.competencia });
      setContextoSemEscala(false);
      setMensagem(`Rascunho de Plantão reaberto — "${grupo.nome}" (${reidratado.competencia.competencia}). Nenhum dado foi publicado.`);
      setAbrirRascunhoPlantaoStatus(null);
      setTela('importar');
      return { ok: true };
    } catch (falha) {
      const mensagem = mensagemErroFirebase(falha, 'Não foi possível abrir este rascunho.', ambienteFirebaseAtual);
      setAbrirRascunhoPlantaoStatus({ fase: 'erro', mensagem });
      return { ok: false, motivo: 'erro', mensagem };
    }
  }

  async function adicionarParticipantePlantao(grupoId: string, usuario: Usuario) {
    if (usuarioReal === null) {
      return;
    }
    const agora = new Date().toISOString();
    const existente = (participantesPorGrupoPlantao[grupoId] ?? []).find((item) => item.login === usuario.login);
    const participante: ParticipantePlantao = existente !== undefined
      ? { ...existente, ativo: true, atualizadoEm: agora }
      : {
        grupoId,
        login: usuario.login,
        ativo: true,
        ordem: (participantesPorGrupoPlantao[grupoId] ?? []).length,
        contatos: [],
        schemaVersion: 1,
        criadoPorLogin: usuarioReal.login,
        criadoEm: agora,
        atualizadoEm: agora,
      };
    try {
      if (!modoDemo) {
        await salvarParticipantePlantao(participante);
      }
      setParticipantesPorGrupoPlantao((atuais) => {
        const atuaisDoGrupo = atuais[grupoId] ?? [];
        const proximos = atuaisDoGrupo.some((item) => item.login === participante.login)
          ? atuaisDoGrupo.map((item) => (item.login === participante.login ? participante : item))
          : [...atuaisDoGrupo, participante];
        return { ...atuais, [grupoId]: proximos };
      });
      setBuscaParticipanteNovo((atuais) => ({ ...atuais, [grupoId]: '' }));
    } catch (falha) {
      setErroPlantaoAdmin(mensagemErroFirebase(falha, 'Não foi possível adicionar o participante.', ambienteFirebaseAtual));
    }
  }

  async function confirmarDesativarParticipantePlantao() {
    if (participanteParaDesativar === null) {
      return;
    }
    const { grupoId, login } = participanteParaDesativar;
    setProcessandoDesativarParticipante(true);
    try {
      if (!modoDemo) {
        await desativarParticipantePlantao(grupoId, login);
      }
      setParticipantesPorGrupoPlantao((atuais) => ({
        ...atuais,
        [grupoId]: (atuais[grupoId] ?? []).map((item) => (item.login === login
          ? { ...item, ativo: false, atualizadoEm: new Date().toISOString() }
          : item)),
      }));
      setParticipanteParaDesativar(null);
    } catch (falha) {
      setErroPlantaoAdmin(mensagemErroFirebase(falha, 'Não foi possível desativar o participante.', ambienteFirebaseAtual));
    } finally {
      setProcessandoDesativarParticipante(false);
    }
  }

  async function salvarContatosParticipanteDoModal(contatos: ContatoPlantonista[]) {
    if (modalContatosParticipante === null) {
      return;
    }
    const { grupoId, participante } = modalContatosParticipante;
    const atualizado: ParticipantePlantao = {
      ...participante,
      contatos,
      atualizadoEm: new Date().toISOString(),
    };
    if (!modoDemo) {
      await salvarParticipantePlantao(atualizado);
    }
    setParticipantesPorGrupoPlantao((atuais) => ({
      ...atuais,
      [grupoId]: (atuais[grupoId] ?? []).map((item) => (item.login === atualizado.login ? atualizado : item)),
    }));
    setModalContatosParticipante(null);
  }

  /**
   * Monta Grupo + participantes + competência + atribuições a partir da
   * prévia validada (Fase PLANTÃO-2) e grava tudo como RASCUNHO — nunca
   * publica (`publicarPlantao()` não existe nesta fase, ver
   * docs/spec/PLANTOES.md). Reaproveita `participantesExistentes` para
   * nunca apagar contatos já cadastrados ao reimportar a mesma planilha
   * (`montarParticipantesPlantaoParaSalvar`), e `competenciaExistente` para
   * preservar `criadoEm`/`criadoPorLogin` numa regravação idempotente.
   */
  async function salvarRascunhoPlantaoAcao() {
    if (usuarioReal === null || origemPlantaoAtual === null) {
      return;
    }
    if (grupoRascunhoEscolhido === '') {
      setErroRascunhoPlantao('Selecione ou crie um grupo de Plantão antes de salvar.');
      return;
    }
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
    if (grupo === undefined) {
      setErroRascunhoPlantao('Grupo de Plantão não encontrado — recarregue a tela.');
      return;
    }
    if (!podeGerenciarEsteGrupoPlantao(grupo)) {
      setErroRascunhoPlantao('Você não administra este grupo de Plantão — só quem gerencia a equipe responsável pode salvar o rascunho.');
      return;
    }
    const competencia = competenciaRascunho.trim();
    const periodoInicio = periodoInicioRascunho.trim();
    const periodoFim = periodoFimRascunho.trim();
    if (!/^\d{4}-\d{2}$/u.test(competencia) || periodoInicio === '' || periodoFim === '') {
      setErroRascunhoPlantao('Informe a competência (AAAA-MM) e o período de início/fim.');
      return;
    }

    setSalvandoRascunhoPlantao(true);
    setErroRascunhoPlantao('');
    try {
      const agora = new Date().toISOString();
      const participantesExistentes = modoDemo
        ? (participantesPorGrupoPlantao[grupo.grupoId] ?? [])
        : await listarParticipantesPlantao(grupo.grupoId);
      const participantesParaSalvar = montarParticipantesPlantaoParaSalvar({
        grupoId: grupo.grupoId,
        vinculos: vinculosPlantao,
        participantesExistentes,
        loginAtual: usuarioReal.login,
        agoraIso: agora,
      });

      const competenciaId = idCompetenciaPlantao(grupo.grupoId, competencia);
      const competenciaExistente = modoDemo ? null : await obterCompetenciaPlantaoRascunho(grupo.grupoId, competencia);
      // Fase ESCALAS-UX-1B — origem MANUAL nunca finge uma fonte XLS: sem
      // `resultadoPlantao`, os totais declarados/brutos da fonte são 0/null,
      // nunca inventados como se viessem de uma planilha real.
      const resultadoParaCompetencia = resultadoPlantao ?? { totalBrutoCalculado: { quantidade: 0, minutos: 0 }, totaisInformados: null };
      const competenciaParaSalvar = montarCompetenciaPlantaoRascunho({
        grupoId: grupo.grupoId,
        competencia,
        periodoInicio,
        periodoFim,
        resultado: resultadoParaCompetencia,
        origem: origemPlantaoAtual,
        loginAtual: usuarioReal.login,
        agoraIso: agora,
        competenciaExistente,
      });
      const atribuicoesParaSalvar = montarAtribuicoesPlantaoRascunho({
        grupoId: grupo.grupoId,
        competenciaId,
        atribuicoes: atribuicoesPlantaoComVinculo,
        timezone: grupo.timezone,
        origem: origemPlantaoAtual,
        agoraIso: agora,
      });

      if (!modoDemo) {
        for (const participante of participantesParaSalvar) {
          await salvarParticipantePlantao(participante);
        }
        await salvarCompetenciaPlantaoRascunho(competenciaParaSalvar);
        await salvarAtribuicoesPlantaoRascunho(grupo.grupoId, competenciaId, atribuicoesParaSalvar);
      }
      setParticipantesPorGrupoPlantao((atuais) => ({ ...atuais, [grupo.grupoId]: participantesParaSalvar }));
      // Fase ESCALAS-UX-1B.1 — "Depois de salvar: dirty = false" (§ 20 da
      // fase): sem isto, o indicador "Alterações não salvas" continuava
      // aceso mesmo logo após um "Salvar rascunho" bem-sucedido.
      setPlantaoEditadoDesdeImportacao(false);
      // FASE ESCALAS-UX-2A.1-FIX — só depois da persistência bem-sucedida
      // (linhas acima); se `salvarCompetenciaPlantaoRascunho`/
      // `salvarAtribuicoesPlantaoRascunho` lançarem, o `catch` abaixo nunca
      // chega aqui e o estado permanece `true`.
      setPlantaoPossuiAlteracoesNaoSalvas(false);
      // Mantém a lista de rascunhos da tela "Plantões" coerente sem
      // precisar recarregar a página — a competência recém-salva aparece/
      // atualiza imediatamente ali também.
      setRascunhosPlantaoPorGrupo((atuais) => {
        const existentes = atuais[grupo.grupoId] ?? [];
        const outras = existentes.filter((item) => item.id !== competenciaParaSalvar.id);
        return { ...atuais, [grupo.grupoId]: [...outras, competenciaParaSalvar] };
      });
      setRascunhoPlantaoSalvoEm(grupo.grupoId);
      setMensagem(`Rascunho de Plantão salvo para "${grupo.nome}" (${competencia}). Nenhum dado foi publicado.`);
    } catch (falha) {
      setErroRascunhoPlantao(mensagemErroFirebase(falha, 'Não foi possível salvar o rascunho de Plantão.', ambienteFirebaseAtual));
    } finally {
      setSalvandoRascunhoPlantao(false);
    }
  }

  // --- Administração (ADMIN_SISTEMA) ---

  function abrirNovaEquipe() {
    setModalEquipe({ modo: 'criar', inicial: { id: '', nome: '', sigla: '', ativa: true } });
  }

  function abrirEdicaoEquipe(equipe: Equipe) {
    setModalEquipe({ modo: 'editar', inicial: equipe });
  }

  async function salvarEquipeDoModal(equipe: Equipe) {
    try {
      if (!modoDemo) {
        await salvarEquipe(equipe);
      }
      setEquipesAdmin((atuais) => (atuais.some((item) => item.id === equipe.id)
        ? atuais.map((item) => (item.id === equipe.id ? equipe : item))
        : [...atuais, equipe]));
      setModalEquipe(null);
    } catch (falha) {
      throw new Error(mensagemErroFirebase(falha, 'Não foi possível salvar a equipe.', ambienteFirebaseAtual));
    }
  }

  async function salvarFormSetor() {
    if (formSetor.id.trim() === '' || formSetor.nome.trim() === '') {
      setErroAdmin('Informe ao menos o ID e o nome do setor.');
      return;
    }
    try {
      if (!modoDemo) {
        await salvarSetor(formSetor);
      }
      setSetoresAdmin((atuais) => (atuais.some((item) => item.id === formSetor.id)
        ? atuais.map((item) => (item.id === formSetor.id ? formSetor : item))
        : [...atuais, formSetor]));
      setFormSetor({ id: '', nome: '', sigla: '', ativo: true });
    } catch (falha) {
      setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível salvar o setor.', ambienteFirebaseAtual));
    }
  }

  function abrirNovaUnidade() {
    setModalUnidade({
      modo: 'criar',
      inicial: {
        unidadeId: '',
        nome: '',
        sigla: '',
        tipo: 'SETOR',
        parentId: null,
        caminho: [],
        ativa: true,
        criadoPorLogin: usuarioReal?.login ?? '',
      },
    });
  }

  function abrirEdicaoUnidade(unidade: UnidadeOrganizacional) {
    setModalUnidade({ modo: 'editar', inicial: unidade });
  }

  async function salvarUnidadeDoModal(unidade: UnidadeOrganizacional) {
    try {
      if (!modoDemo) {
        await salvarUnidadeOrganizacional(unidade);
      }
      setUnidadesAdmin((atuais) => (atuais.some((item) => item.unidadeId === unidade.unidadeId)
        ? atuais.map((item) => (item.unidadeId === unidade.unidadeId ? unidade : item))
        : [...atuais, unidade]));
      setModalUnidade(null);
    } catch (falha) {
      throw new Error(mensagemErroFirebase(falha, 'Não foi possível salvar a unidade organizacional.', ambienteFirebaseAtual));
    }
  }

  async function salvarEscopoOperacionalDoModal(escopo: EscopoOperacional) {
    setProcessandoEscopoOperacional(true);
    setErroAdmin('');
    try {
      if (!modoDemo) {
        await salvarEscopoOperacional(escopo);
      }
      setEscoposOperacionaisAdmin((atuais) => {
        const semAtual = atuais.filter((item) => !(item.tipo === escopo.tipo && item.alvoId === escopo.alvoId));
        return [...semAtual, escopo].sort((a, b) => `${a.tipo}:${a.alvoNome}`.localeCompare(`${b.tipo}:${b.alvoNome}`));
      });
      setModalResponsavelEscala(null);
    } catch (falha) {
      setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível salvar o responsável por escala.', ambienteFirebaseAtual));
    } finally {
      setProcessandoEscopoOperacional(false);
    }
  }

  async function alternarStatusEscopoOperacional(escopo: EscopoOperacional, ativo: boolean) {
    if (usuarioReal === null) {
      return;
    }
    await salvarEscopoOperacionalDoModal({
      ...escopo,
      ativo,
      atualizadoEm: new Date().toISOString(),
      atualizadoPorLogin: usuarioReal.login,
    });
  }

  function iniciarSimulacaoSelecionada() {
    const gestor = todosUsuariosAdmin.find((item) => item.login === gestorParaSimular);
    if (gestor === undefined) {
      setErroAdmin('Selecione um gestor válido para simular.');
      return;
    }
    void iniciarSimulacao(gestor);
  }

  async function confirmarExclusaoUsuario(opcoes: OpcoesExclusaoUsuario) {
    if (usuarioParaExcluir === null) {
      return;
    }
    // Snapshot local — o toast e a atualização da lista usam este valor, não
    // `usuarioParaExcluir` direto, para nunca depender de como o estado do
    // componente evoluiu durante o `await` (o modal já fecha, mas nada
    // impede outro re-render de trocar a seleção antes da resposta chegar).
    const candidato = usuarioParaExcluir;
    setProcessandoExclusaoUsuario(true);
    try {
      if (!modoDemo) {
        await excluirUsuario(candidato, opcoes);
      }
      if (opcoes.cadastro) {
        setTodosUsuariosAdmin((atuais) => atuais.filter((item) => item.login !== candidato.login));
      }
      setMensagem(`Dados de ${candidato.nome} excluídos conforme selecionado.`);
      setUsuarioParaExcluir(null);
    } catch (falha) {
      setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível excluir os dados selecionados.', ambienteFirebaseAtual));
    } finally {
      setProcessandoExclusaoUsuario(false);
    }
  }

  async function exportarEscalaXlsx() {
    if (equipeExportar.trim() === '') {
      setErroAdmin('Selecione uma equipe para exportar.');
      return;
    }
    try {
      const documentosEquipe = modoDemo
        ? documentos
        : await carregarEscalasEquipe(equipeExportar, competenciaExportar, true);
      const cabecalho = ['Login', 'Dias trabalhados', 'Folgas', 'Total'];
      const linhas = documentosEquipe.map((documento) => {
        const totais = calcularTotais(documento.dias, catalogo);
        const dias = Object.values(documento.dias);
        return [
          documento.login,
          dias.filter((dia) => dia.c !== 'F' && dia.c !== null).length,
          dias.filter((dia) => dia.c === 'F').length,
          formatarMinutos(totais.min),
        ];
      });
      const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, planilha, 'Escala');
      const bytes = XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `escala-${equipeExportar}-${competenciaExportar}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (falha) {
      setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível exportar a escala.', ambienteFirebaseAtual));
    }
  }

  async function imprimirEscala() {
    if (equipeExportar.trim() === '') {
      setErroAdmin('Selecione uma equipe para imprimir.');
      return;
    }
    try {
      const documentosEquipe = modoDemo
        ? documentos
        : await carregarEscalasEquipe(equipeExportar, competenciaExportar, true);
      const linhasHtml = documentosEquipe.map((documento) => {
        const totais = calcularTotais(documento.dias, catalogo);
        return `<tr><td>${documento.login}</td><td>${formatarMinutos(totais.min)}</td></tr>`;
      }).join('');
      const janela = window.open('', '_blank');
      if (janela === null) {
        setErroAdmin('Não foi possível abrir a janela de impressão (bloqueada pelo navegador?).');
        return;
      }
      janela.document.write(`
        <title>Escala ${equipeExportar} — ${competenciaExportar}</title>
        <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;">
          <thead><tr><th>Login</th><th>Total</th></tr></thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      `);
      janela.document.close();
      janela.focus();
      janela.print();
    } catch (falha) {
      setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível preparar a impressão.', ambienteFirebaseAtual));
    }
  }

  async function confirmarExclusaoEscala() {
    if (equipeExportar.trim() === '') {
      setErroAdmin('Selecione uma equipe.');
      return;
    }
    setProcessandoEscalaAdmin(true);
    try {
      if (!modoDemo) {
        await excluirEscalaPublicada(equipeExportar, competenciaExportar);
      }
      setMensagem(`Escala de ${equipeExportar} (${competenciaExportar}) excluída.`);
      setExcluirEscalaPendente(false);
    } catch (falha) {
      setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível excluir a escala.', ambienteFirebaseAtual));
    } finally {
      setProcessandoEscalaAdmin(false);
    }
  }

  useEffect(() => {
    if (tela !== 'administracao' || !podeAcessarAdministracao || modoDemo) {
      return undefined;
    }
    let cancelado = false;
    // `listarTodosUsuarios()` só é útil (e só retorna tudo, pelas rules) para
    // ADMIN_SISTEMA — GESTOR_UNIDADE não usa o painel "Usuários"/"Simular
    // gestor" (ambos presos a `souAdmin` na renderização), então nem
    // dispara essa leitura.
    const carregarUsuarios = souAdmin ? listarTodosUsuarios() : Promise.resolve<Usuario[]>([]);
    void Promise.all([carregarUsuarios, listarEquipes(), listarSetores(), listarUnidadesOrganizacionais(), listarEscoposOperacionais()])
      .then(([todos, equipes, setores, unidades, escopos]) => {
        if (!cancelado) {
          setTodosUsuariosAdmin(todos);
          setEquipesAdmin(equipes);
          setSetoresAdmin(setores);
          setUnidadesAdmin(unidades);
          setEscoposOperacionaisAdmin(escopos);
        }
      })
      .catch((falha: unknown) => {
        if (!cancelado) {
          setErroAdmin(mensagemErroFirebase(falha, 'Não foi possível carregar os dados de administração.', ambienteFirebaseAtual));
        }
      });
    return () => {
      cancelado = true;
    };
  }, [tela, podeAcessarAdministracao, souAdmin, modoDemo]);

  /**
   * Carrega os Grupos de Plantão administráveis/consultáveis (Fase
   * PLANTÃO-3B) — na tela "Plantões" OU assim que uma planilha de Plantão é
   * detectada na tela "Importar" (o fluxo de "salvar como rascunho" também
   * precisa da lista de grupos para o gestor escolher/criar um). Também
   * (re)carrega `equipesAdmin`/`unidadesAdmin` — mesmos estados da
   * Administração, reaproveitados aqui (nunca uma segunda árvore/lista
   * independente) para o seletor de equipe responsável do
   * `ModalGrupoPlantao` funcionar mesmo se o usuário nunca abriu a aba
   * Administração nesta sessão.
   *
   * Fase ESCALAS-UX-2A.1 — deixou de esperar `tela === 'plantoes'`/
   * planilha detectada/"+ Nova escala" aberta: o `ScheduleContextSwitcher`
   * do header precisa da lista de "Plantões disponíveis" em QUALQUER tela
   * (o cluster de contexto aparece em todas — § 29 do redesign), não só
   * nesses três pontos específicos. `podeAcessarPlantoes` continua sendo
   * o gate de QUEM (mesma autorização de sempre, nenhuma ampliação de
   * acesso — Rules continuam a fonte de verdade do que cada leitura
   * realmente retorna).
   */
  useEffect(() => {
    const precisaCarregar = podeAcessarPlantoes;
    if (!precisaCarregar || modoDemo || usuarioReal === null) {
      return undefined;
    }
    let cancelado = false;
    /**
     * Fase ESCOPO-GESTOR-UNIDADE-1 — `equipesConsulta` é visibilidade
     * OPERACIONAL, não administrativa (regra 8 do resolver, ver
     * `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`): um `GESTOR_UNIDADE`
     * cuja equipe pessoal não esteja em `equipesConsulta` de nenhum Grupo
     * nunca apareceria em `listarGruposPlantaoPermitidos()` sozinha, mesmo
     * administrando o Grupo pela unidade. Por isso, além da consulta por
     * equipe de sempre, também busca por `unidadeResponsavelId` para cada
     * unidade permitida — `podeGerenciarEsteGrupoPlantao()` continua sendo
     * quem decide o que é editável a partir da lista combinada.
     */
    /**
     * Fase ESCOPO-CONSULTA-PLANTAO-1 — `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE`
     * também chamam `listarTodosGruposPlantao()` (a Rule de leitura passou
     * a permitir isso para qualquer gestor, não só admin — ver
     * `firestore.rules`, `match /gruposPlantao`): precisam DESCOBRIR
     * Grupos que a própria equipe ainda não consulta/administra, para
     * poder oferecer "Plantões monitorados" (autovínculo de consulta) na
     * Administração, sem depender de já ter alguma relação prévia com o
     * Grupo.
     */
    const ehGestorDeEquipe = perfilEfetivo(usuarioReal) === 'GESTOR_EQUIPE' || perfilEfetivo(usuarioReal) === 'SUPERVISOR_EQUIPE';
    const carregarGrupos = souAdmin
      ? listarTodosGruposPlantao()
      : Promise.all([
        ...equipesPermitidasEfetivas(usuarioReal).map((equipeId) => listarGruposPlantaoPermitidos(equipeId)),
        ...(souGestorUnidade
          ? unidadesPermitidasEfetivas(usuarioReal).map((unidadeId) => listarGruposPlantaoPorUnidadeResponsavel(unidadeId))
          : []),
        ...(ehGestorDeEquipe ? [listarTodosGruposPlantao()] : []),
      ])
        .then((listas) => {
          const porId = new Map<string, GrupoPlantao>();
          for (const lista of listas) {
            for (const grupo of lista) {
              porId.set(grupo.grupoId, grupo);
            }
          }
          return [...porId.values()];
        });
    const carregarUsuariosParaBusca = souAdmin ? listarTodosUsuarios() : Promise.resolve<Usuario[]>([]);
    /**
     * `allSettled`, nunca `all` (Fase UI-ORG-1A): um erro de permissão só em
     * `carregarGrupos` (ex.: Rules de Plantão ainda não deployadas em
     * staging) não pode impedir `equipesAdmin`/`unidadesAdmin` de carregar
     * — cada leitura tem seu próprio resultado/erro, nunca um único
     * `catch` genérico mascarando qual delas falhou como se fosse "nenhuma
     * equipe cadastrada".
     */
    void Promise.allSettled([carregarGrupos, listarEquipes(), listarUnidadesOrganizacionais(), carregarUsuariosParaBusca, listarEscoposOperacionais()])
      .then(([grupos, equipes, unidades, todosUsuarios, escopos]) => {
        if (cancelado) {
          return;
        }
        if (grupos.status === 'fulfilled') {
          setGruposPlantaoAdmin(grupos.value);
        } else {
          setErroPlantaoAdmin(mensagemErroFirebase(grupos.reason, 'Não foi possível carregar os Grupos de Plantão.', ambienteFirebaseAtual));
        }
        if (equipes.status === 'fulfilled') {
          setEquipesAdmin(equipes.value);
        } else {
          setErroEquipesPlantao(mensagemErroFirebase(equipes.reason, 'Não foi possível carregar as equipes.', ambienteFirebaseAtual));
        }
        if (unidades.status === 'fulfilled') {
          setUnidadesAdmin(unidades.value);
        }
        if (souAdmin && todosUsuarios.status === 'fulfilled') {
          setTodosUsuariosAdmin(todosUsuarios.value);
        }
        if (escopos.status === 'fulfilled') {
          setEscoposOperacionaisAdmin(escopos.value);
        }
        setCarregandoEquipesPlantao(false);
      });
    return () => {
      cancelado = true;
    };
  }, [podeAcessarPlantoes, souAdmin, souGestorUnidade, modoDemo, usuarioReal]);

  /**
   * Fase ESCALAS-UX-2A.1 — `equipesAdmin` precisa estar disponível para o
   * `ScheduleContextSwitcher` resolver os rótulos das Jornadas
   * (`equipeId` → nome) mesmo para quem NÃO é gestor de Plantão (o efeito
   * acima só carrega para `podeAcessarPlantoes`) e mesmo antes de visitar
   * Administração (o outro efeito só carrega para `tela === 'administracao'`).
   * `equipes` é uma coleção de leitura franqueada a qualquer usuário
   * autenticado (`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` § "Limitações
   * e riscos") — carregar uma vez por sessão aqui não amplia nenhuma
   * autorização, só evita esperar por uma tela específica. O modo demo
   * (sem Firestore) já semeia `equipesAdmin` diretamente em `autenticar()`
   * — nunca dentro deste efeito.
   */
  useEffect(() => {
    if (modoDemo || usuarioReal === null || equipesAdmin.length > 0) {
      return undefined;
    }
    let cancelado = false;
    void listarEquipes().then((equipes) => {
      if (!cancelado) {
        setEquipesAdmin(equipes);
      }
    }).catch(() => {
      // Silencioso: `equipesAdmin` também é recarregado (com tratamento de
      // erro completo) pelos dois efeitos acima assim que o usuário visitar
      // Administração ou Plantões — esta leitura eager é só uma otimização
      // para o seletor de contexto, nunca o único lugar que a garante.
    });
    return () => {
      cancelado = true;
    };
  }, [modoDemo, usuarioReal, equipesAdmin.length]);

  /**
   * Fase ESCALAS-UX-2A.1 — sincronização do contexto ativo a partir de
   * evidência inequívoca já existente (§ 13 do redesign). Feita como
   * chamada DIRETA em cada ponto onde Grupo+competência de Plantão ou
   * Jornada realmente passam a existir — nunca um `useEffect` reativo
   * genérico observando o resultado dessas ações (isso encadearia
   * re-renders desnecessários — "derived state" pertence ao corpo da
   * própria ação, não a um efeito separado). Ver `setContextoEscalaAtivo`
   * dentro de `criarPlantaoEmBrancoAcao`/`usarPeriodoAnteriorAcao`/
   * `abrirRascunhoNoEditorAcao`/o `<select>` de Grupo do rascunho
   * importado (Plantão) e dentro de `carregarDadosDaEquipe`/`interpretar`/
   * `aplicarConciliacao` (Jornada).
   */

  /**
   * Fase ESCALAS-UX-2A.1 — guarda única de "alterações não salvas" para
   * trocar de contexto OU competência (§ 24/§ 25 do redesign).
   *
   * FASE ESCALAS-UX-2A.1-FIX — lê SOMENTE os dirty states explícitos
   * (`plantaoPossuiAlteracoesNaoSalvas`/`jornadaPossuiAlteracoesNaoSalvas`),
   * NUNCA `plantaoEditadoDesdeImportacao` (esse continua existindo só para
   * o indicador visual "divergiu da importação", não é sinônimo de
   * "existe algo não salvo" — ver comentário do estado). Boundary test
   * garante que esta função nunca volte a referenciar
   * `plantaoEditadoDesdeImportacao`.
   */
  function existeAlteracaoNaoSalvaNoContextoAtivo(): boolean {
    if (contextoEscalaAtivo === null) {
      return false;
    }
    return contextoEscalaAtivo.tipo === 'PLANTAO' ? plantaoPossuiAlteracoesNaoSalvas : jornadaPossuiAlteracoesNaoSalvas;
  }

  /**
   * Carrega de fato o contexto solicitado: para Plantão, reaproveita
   * INTEGRALMENTE `abrirRascunhoNoEditorAcao()` (nunca um segundo caminho
   * de reidratação); para Jornada, usa `carregarEscalasEquipe()` (a mesma
   * função já usada por `carregarDadosDaEquipe()`), agora parametrizada
   * pela competência do contexto-alvo em vez do literal fixo de sempre.
   * Em nenhum caso cria uma escala vazia automaticamente quando não
   * encontra nada — só marca `contextoSemEscala` e deixa "Escalas" mostrar
   * a ação explícita de criar (§ 16 do redesign).
   */
  async function aplicarTrocaContexto(alvo: ContextoEscalaAtivo) {
    setErroContextoEscala('');
    if (alvo.tipo === 'PLANTAO') {
      const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === alvo.grupoId);
      if (grupo === undefined) {
        setErroContextoEscala('Grupo de Plantão não encontrado — recarregue a página.');
        return;
      }
      setCarregandoContexto(true);
      try {
        const competenciaExistente = modoDemo ? null : await obterCompetenciaPlantaoRascunho(grupo.grupoId, alvo.competencia);
        if (competenciaExistente === null) {
          setContextoEscalaAtivo(alvo);
          setContextoSemEscala(true);
          setTela('escalas');
          return;
        }
        const resultadoAbertura = await abrirRascunhoNoEditorAcao(grupo, competenciaExistente);
        if (resultadoAbertura.ok) {
          setContextoEscalaAtivo(alvo);
          setContextoSemEscala(false);
        } else if (resultadoAbertura.motivo === 'erro') {
          setErroContextoEscala(resultadoAbertura.mensagem);
        } else {
          setContextoEscalaAtivo(alvo);
          setContextoSemEscala(true);
          setTela('escalas');
        }
      } finally {
        setCarregandoContexto(false);
      }
      return;
    }
    if (usuarioEfetivo === null) {
      return;
    }
    setCarregandoContexto(true);
    try {
      const [documentosExistentes, usuariosDaEquipe, catalogoDaEquipe] = modoDemo
        ? [
          resultado?.documentos.filter((documento) => documento.competencia === alvo.competencia) ?? [],
          usuarios,
          catalogo,
        ] as const
        : await Promise.all([
          carregarEscalasEquipe(alvo.equipeId, alvo.competencia, false),
          listarUsuarios(alvo.equipeId),
          listarCatalogo(alvo.equipeId),
        ]);
      if (!modoDemo) {
        setUsuarios(usuariosDaEquipe);
        setCatalogo(catalogoDaEquipe);
      }
      if (documentosExistentes.length === 0) {
        setContextoEscalaAtivo(alvo);
        setResultado(null);
        setLinhasConciliacao([]);
        setJornadaPossuiAlteracoesNaoSalvas(false);
        setContextoSemEscala(true);
        setTela('escalas');
        return;
      }
      const datas = documentosExistentes.flatMap((documento) => Object.keys(documento.dias));
      const periodo = periodoDaCompetencia(alvo.competencia);
      setResultado({
        ok: true,
        equipeNome: alvo.equipeId,
        periodoInicio: datas.sort()[0] ?? periodo?.periodoInicio ?? '',
        periodoFim: datas.sort().at(-1) ?? periodo?.periodoFim ?? '',
        totalDias: new Set(datas).size,
        documentos: documentosExistentes,
        erros: [],
        avisos: [],
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setContextoEscalaAtivo(alvo);
      setContextoSemEscala(false);
      setTela('grade');
    } catch (falha) {
      setErroContextoEscala(mensagemErroFirebase(falha, 'Não foi possível carregar esta jornada.', ambienteFirebaseAtual));
    } finally {
      setCarregandoContexto(false);
    }
  }

  function aplicarTrocaCompetencia(novaCompetencia: string) {
    if (contextoEscalaAtivo === null) {
      return;
    }
    const alvo: ContextoEscalaAtivo = contextoEscalaAtivo.tipo === 'JORNADA'
      ? { tipo: 'JORNADA', equipeId: contextoEscalaAtivo.equipeId, competencia: novaCompetencia }
      : { tipo: 'PLANTAO', grupoId: contextoEscalaAtivo.grupoId, competencia: novaCompetencia };
    void aplicarTrocaContexto(alvo);
  }

  /** Ponto único de entrada para trocar de contexto — nunca chamado diretamente pelo JSX sem passar pelo guard de alterações não salvas. */
  function solicitarTrocaContexto(alvo: ContextoEscalaAtivo) {
    if (contextosEscalaIguais(contextoEscalaAtivo, alvo)) {
      return;
    }
    if (existeAlteracaoNaoSalvaNoContextoAtivo()) {
      setIntencaoTrocaEscalaPendente({ tipo: 'contexto', alvo });
      return;
    }
    void aplicarTrocaContexto(alvo);
  }

  /** Idem para competência — mesmo guard, nunca um segundo sistema (§ 25 do redesign). */
  function solicitarTrocaCompetencia(novaCompetencia: string) {
    if (contextoEscalaAtivo === null || contextoEscalaAtivo.competencia === novaCompetencia) {
      return;
    }
    if (existeAlteracaoNaoSalvaNoContextoAtivo()) {
      setIntencaoTrocaEscalaPendente({ tipo: 'competencia', competencia: novaCompetencia });
      return;
    }
    aplicarTrocaCompetencia(novaCompetencia);
  }

  /** Cancelar: mantém integralmente contexto/competência/working copy/aba/dirty state — nenhuma perda (§ 27 do redesign). */
  function cancelarTrocaEscalaPendente() {
    setIntencaoTrocaEscalaPendente(null);
  }

  /** Só após confirmação explícita a troca de fato acontece (§ 26 do redesign) — nunca carrega o destino antes/atrás do modal. */
  function confirmarDescarteETrocarEscala() {
    const intencao = intencaoTrocaEscalaPendente;
    setIntencaoTrocaEscalaPendente(null);
    if (intencao === null) {
      return;
    }
    if (intencao.tipo === 'contexto') {
      void aplicarTrocaContexto(intencao.alvo);
    } else {
      aplicarTrocaCompetencia(intencao.competencia);
    }
  }

  async function encerrarSessao() {
    await sair();
    setUsuarioReal(null);
    setSimulando(null);
    setResultado(null);
    setJornadaPossuiAlteracoesNaoSalvas(false);
    setContextoEscalaAtivo(null);
    setContextoSemEscala(false);
    setIntencaoTrocaEscalaPendente(null);
    setLinhasConciliacao([]);
    setFormularioUsuario(null);
    setMensagem('');
    setTrocas([]);
    setTrocaSelecionadaId(null);
    setErroTroca('');
  }

  if (usuarioReal === null) {
    return <LoginPanel tipo="dashboard" onEntrar={autenticar} />;
  }
  const usuarioParaFrame = simulando ?? usuarioReal;

  /**
   * Fase ESCALAS-UX-2A.1 — opções reais do `ScheduleContextSwitcher`,
   * nunca hardcode de sigla (§ 7/§ 8/§ 9 do redesign): uma entrada por
   * Equipe permitida (Jornada) e por Grupo de Plantão acessível
   * (Plantão), rótulos resolvidos a partir dos dados já carregados. A
   * competência de uma opção ainda não visitada herda a competência do
   * contexto ativo (ou o único valor hoje hardcoded no restante do
   * Dashboard, `'2026-08'`, se nenhum contexto foi selecionado ainda).
   */
  const areasWizard = unidadesAdministraveis(unidadesAdmin, minhasUnidadesPermitidas, souAdmin);
  const areaWizardEfetiva = wizardAreaId || (areasWizard.length === 1 ? areasWizard[0].unidadeId : null);
  /**
   * Fase ESCOPO-GESTOR-UNIDADE-1 — `equipesWizardCompletas` alimenta o
   * filtro de `gruposWizard` (precisa reconhecer a equipe responsável de
   * um Plantão como candidata) e o seletor de
   * "equipe responsável" ao criar um Grupo novo; `equipesWizard` (o que de
   * fato vai para o `<select>` de Jornada 6x1) usa `jornadasAdministraveis`
   * quando o tipo é Jornada — nunca oferece uma equipe que já é
   * responsável por um Grupo de Plantão como destino de Jornada.
   *
   * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — para Plantão, `equipesWizard`
   * também exclui a equipe da Jornada ATIVA agora
   * (`equipesCandidatasParaPlantao`) — nunca oferece a equipe que já está
   * em uso real de Jornada como "equipe responsável" de um Plantão novo.
   * `gruposWizard` continua usando `equipesWizardCompletas` (sem essa
   * exclusão) para não deixar de reconhecer um Grupo já existente cuja
   * equipe responsável, por acaso, coincida com a Jornada ativa.
   */
  const equipesWizardCompletas = equipesAdministraveisNaUnidade(
    equipesAdmin,
    areaWizardEfetiva,
    minhasEquipesPermitidas,
    souAdmin,
  );
  const equipesWizard = wizardTipo === 'JORNADA'
    ? equipesAdministraveisNaUnidade(equipesAdmin, areaWizardEfetiva, minhasEquipesDeJornadaPermitidas, souAdmin)
    : equipesCandidatasParaPlantao(equipesWizardCompletas, equipeJornadaReferenciaId);
  const gruposWizard = escoposOperacionais.plantoesAdministraveis
    .filter((grupo) => equipesWizardCompletas.some((equipe) => equipe.id === grupo.equipeResponsavelId));
  /**
   * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — "área de gestão" a EXIBIR no
   * Wizard nunca deveria dizer "não cadastrada" quando a equipe já
   * resolvida (`wizardEquipeId`) carrega, ela mesma, uma unidade real —
   * mesmo que o usuário não administre nenhuma `UnidadeOrganizacional`
   * diretamente (ex.: `GESTOR_EQUIPE` comum, sem `GESTOR_UNIDADE`). Nunca
   * amplia autorização — `areasWizard` continua a fonte usada para
   * `mudarAreaWizard`/`criarEquipeWizard`; isto só afeta o que é MOSTRADO.
   */
  const equipeWizardResolvida = equipesAdmin.find((item) => item.id === wizardEquipeId);
  const areasWizardParaExibir = areasParaExibicaoNoWizard(areasWizard, unidadesAdmin, equipeWizardResolvida);
  const rascunhoWizardExistente = wizardGrupoId !== ''
    && (rascunhosPlantaoPorGrupo[wizardGrupoId] ?? []).some((item) => item.competencia === wizardCompetencia);
  const competenciaAnteriorWizard = wizardCompetencia.trim() === '' ? null : competenciaAnterior(wizardCompetencia.trim());
  const periodoAnteriorWizardDisponivel = wizardGrupoId !== ''
    && competenciaAnteriorWizard !== null
    && (rascunhosPlantaoPorGrupo[wizardGrupoId] ?? []).some((item) => item.competencia === competenciaAnteriorWizard);
  const competenciaParaNovasOpcoes = contextoEscalaAtivo?.competencia ?? '2026-08';
  /**
   * Uma equipe responsável exclusivamente por um Grupo de Plantão não é uma
   * Jornada 6x1 adicional. O coordenador do COSI pode ter EQ_SOC e
   * EQ_PLANTAO_COSI nas permissões; o topo deve mostrar SOC em Jornadas e o
   * Grupo Plantão em Plantões, sem transformar a equipe técnica de Plantão em
   * uma segunda Jornada. Se no futuro a mesma equipe tiver os dois produtos,
   * o contexto Jornada já ativo continua preservado.
   */
  const opcoesContextoJornada: OpcaoContextoEscala[] = escoposOperacionais.jornadasAdministraveis.map((equipe) => ({
    contexto: {
      tipo: 'JORNADA',
      equipeId: equipe.id,
      competencia: contextoEhJornada(contextoEscalaAtivo) && contextoEscalaAtivo.equipeId === equipe.id
        ? contextoEscalaAtivo.competencia
        : competenciaParaNovasOpcoes,
    },
    rotuloPrincipal: equipe.nome,
    rotuloSecundario: 'Jornada 6x1',
  }));
  /**
   * FASE ESCALAS-UX-2A.1-FIX (Problema 3) — o switcher desta fase só
   * oferece para EDIÇÃO os grupos que o usuário administra
   * (`podeGerenciarEsteGrupoPlantao`, autorização real já existente,
   * nenhum hardcode de sigla). `gruposPlantaoAdmin` inclui também grupos
   * só-consultados via `equipesConsulta` — esses continuam existindo e
   * consultáveis pelo domínio já existente, só não aparecem como contexto
   * EDITÁVEL aqui: o Editor atual só sabe abrir um rascunho administrativo,
   * e Plantão publicado ainda não tem read model operacional (PLANTÃO-3C).
   * Não é mudança de ACL/Rules/GrupoPlantao — é só filtro de UX deste
   * seletor. Depois de PLANTÃO-3C isto pode evoluir para distinguir
   * Editáveis/Consulta ou abrir uma escala publicada read-only.
   */
  const opcoesContextoPlantao: OpcaoContextoEscala[] = escoposOperacionais.plantoesAdministraveis
    .map((grupo) => ({
      contexto: {
        tipo: 'PLANTAO',
        grupoId: grupo.grupoId,
        competencia: contextoEhPlantao(contextoEscalaAtivo) && contextoEscalaAtivo.grupoId === grupo.grupoId
          ? contextoEscalaAtivo.competencia
          : competenciaParaNovasOpcoes,
      },
      rotuloPrincipal: grupo.nome,
      rotuloSecundario: equipesAdmin.find((item) => item.id === grupo.equipeResponsavelId)?.nome ?? grupo.equipeResponsavelId,
    }));
  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — seção separada de "Plantões
   * monitorados" no seletor superior: Grupos que a equipe do usuário só
   * CONSULTA (`plantoesConsultaveis`), nunca administra. Nunca aparece
   * misturado com `opcoesContextoPlantao` (administráveis) — consulta não
   * é administração.
   */
  const opcoesContextoPlantaoMonitorados: OpcaoContextoEscala[] = escoposOperacionais.plantoesMonitorados
    .map((grupo) => ({
      contexto: {
        tipo: 'PLANTAO' as const,
        grupoId: grupo.grupoId,
        competencia: contextoEhPlantao(contextoEscalaAtivo) && contextoEscalaAtivo.grupoId === grupo.grupoId
          ? contextoEscalaAtivo.competencia
          : competenciaParaNovasOpcoes,
      },
      rotuloPrincipal: grupo.nome,
      rotuloSecundario: equipesAdmin.find((item) => item.id === grupo.equipeResponsavelId)?.nome ?? grupo.equipeResponsavelId,
    }));
  /**
   * `true` quando o contexto de Plantão ativo agora é só consultável (o
   * grupo está em `plantoesConsultaveis`, nunca em `plantoesAdministraveis`)
   * — gate único usado para esconder/desabilitar toda ação de escrita
   * (editar, importar, salvar rascunho, publicar, configurar grupo, editar
   * participantes, usar período anterior) e mostrar o aviso "Somente
   * consulta".
   */
  const contextoPlantaoSomenteConsulta = contextoEhPlantao(contextoEscalaAtivo)
    && escoposOperacionais.plantoesConsultaveis.some((grupo) => grupo.grupoId === contextoEscalaAtivo.grupoId);
  const rotuloContextoAtivo = contextoEscalaAtivo === null
    ? 'Selecionar escala'
    : contextoEhJornada(contextoEscalaAtivo)
      ? ((equipesAdmin.find((item) => item.id === contextoEscalaAtivo.equipeId)?.nome ?? contextoEscalaAtivo.equipeId)
        .split('>')
        .at(-1)
        ?.trim() || contextoEscalaAtivo.equipeId)
      : (gruposPlantaoAdmin.find((item) => item.grupoId === contextoEscalaAtivo.grupoId)?.nome ?? contextoEscalaAtivo.grupoId);
  /**
   * Status contextual (§ 17/§ 18 do redesign): "Publicada" para Jornada só
   * reflete um fato já calculado por `publicados`/`documentos` (nunca uma
   * funcionalidade nova) — Plantão nunca mostra "Publicada" nesta fase
   * (PLANTÃO-3C não existe ainda), só "Rascunho"/"Sem escala".
   */
  const statusContextoAtivo: StatusContextoEscala | null = contextoEscalaAtivo === null
    ? null
    : contextoSemEscala
      ? 'sem-escala'
      : (contextoEhJornada(contextoEscalaAtivo) && documentos.length > 0 && publicados.length === documentos.length)
        ? 'publicada'
        : 'rascunho';
  return (
    <AppFrame
      produto="dashboard"
      usuario={usuarioParaFrame}
      competencia={contextoEscalaAtivo === null ? 'Nenhuma escala selecionada' : formatarCompetencia(contextoEscalaAtivo.competencia)}
      itens={navegacaoVisivel}
      ativo={areaNavegacaoDaTela(tela)}
      onNavegar={(id) => setTela(id as Tela)}
      onSair={encerrarSessao}
      produtoHref={import.meta.env.VITE_EMPLOYEE_APP_URL ?? '/app'}
      contextoEscala={(
        <div className="schedule-context-cluster">
          <ScheduleContextSwitcher
            contextoAtivo={contextoEscalaAtivo}
            rotuloContextoAtivo={rotuloContextoAtivo}
            opcoesJornada={opcoesContextoJornada}
            opcoesPlantao={opcoesContextoPlantao}
            opcoesPlantaoMonitorados={opcoesContextoPlantaoMonitorados}
            onSelecionar={solicitarTrocaContexto}
            carregando={carregandoContexto}
          />
          <ScheduleCompetenceControl
            competencia={contextoEscalaAtivo?.competencia ?? null}
            onMudarCompetencia={solicitarTrocaCompetencia}
          />
          <ScheduleStatusBadge status={statusContextoAtivo} />
        </div>
      )}
      acoesTopo={(
        <AlertasOperacionaisBell
          alertas={alertasOperacionais}
          usuarios={usuarios}
          aberta={alertasAbertos}
          onAlternar={() => setAlertasAbertos((atual) => !atual)}
          onFocarGrade={() => {
            setAlertasAbertos(false);
            setTela('grade');
          }}
        />
      )}
    >
      {mensagem && (
        <div className={`toast ${resultado?.ok === false ? 'error' : ''}`}>
          <span>{mensagem}</span>
          <button type="button" onClick={() => setMensagem('')} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
      )}
      {escritaBloqueada && (
        <div className="alert warning" role="status">
          Ambiente real conectado em modo de validação somente leitura.
          Salvar, cadastrar e publicar exigem habilitação administrativa explícita.
        </div>
      )}
      {simulando !== null && (
        <div className="alert warning" role="status">
          <strong>Simulando {simulando.nome} — {perfilEfetivo(simulando)}</strong>
          <button className="secondary-button" type="button" onClick={() => void sairDaSimulacao()}>
            Sair da simulação
          </button>
        </div>
      )}

      {tela === 'visao' && (
        <section className="overview-dashboard overview-operations">
          <header className="page-heading overview-page-heading">
            <div>
              <p className="eyebrow">Operação integrada</p>
              <h1>Visão geral</h1>
              <p className="overview-subtitle">Acompanhe as duas operações em um só lugar.</p>
            </div>
              <div className="overview-header-actions">
                <button className="secondary-button" type="button" onClick={abrirNovaEscala}>
                  <Plus size={17} /> Nova escala
                </button>
                <button className="primary-button" type="button" onClick={abrirImportarEscala}>
                  <Plus size={17} /> Importar escala
                </button>
              </div>
          </header>

          <div className="overview-operation-grid">
            <button
              className={`overview-operation-card ${socStatusDashboard}`}
              type="button"
              onClick={() => abrirOperacaoDoDashboard('JORNADA')}
            >
              <span className="overview-operation-card-heading">
                <span className="overview-operation-icon"><ShieldCheck size={22} /></span>
                <span className="overview-operation-title"><strong>SOC</strong><small>{rotuloSaudeDashboard(socStatusDashboard)}</small></span>
                <ChevronRight size={19} />
              </span>
              <span className="overview-operation-meta">
                <span><CalendarDays size={16} /><small>Competência ativa</small><strong>{formatarCompetencia(competenciaDashboard)}</strong><em>{periodoJornadaDashboard}</em></span>
                <span><Users size={16} /><small>Pessoas</small><strong>{totaisGerais.pessoas}</strong><em>colaboradores</em></span>
                <span><AlertTriangle size={16} /><small>Alertas</small><strong>{alertasVisiveis.length}</strong><em>{alertasVisiveis.length > 0 ? 'necessitam atenção' : 'nenhum pendente'}</em></span>
              </span>
              <span className="overview-operation-health"><i style={{ width: `${healthBarSoc}%` }} /></span>
              <span className="overview-operation-action"><Pencil size={15} /> Abrir operação SOC <ArrowUpRight size={16} /></span>
            </button>

            <button
              className={`overview-operation-card ${plantaoStatusDashboard}`}
              type="button"
              onClick={() => abrirOperacaoDoDashboard('PLANTAO')}
            >
              <span className="overview-operation-card-heading">
                <span className="overview-operation-icon plantao"><Radio size={22} /></span>
                <span className="overview-operation-title"><strong>{nomePlantaoDashboard}</strong><small>{rotuloSaudeDashboard(plantaoStatusDashboard)}</small></span>
                <ChevronRight size={19} />
              </span>
              <span className="overview-operation-meta">
                <span><CalendarDays size={16} /><small>Competência ativa</small><strong>{formatarCompetencia(competenciaPlantaoDashboard?.competencia ?? competenciaDashboard)}</strong><em>{periodoPlantaoDashboard}</em></span>
                <span><Users size={16} /><small>Pessoas</small><strong>{participantesPlantaoDashboard}</strong><em>participantes</em></span>
                <span><AlertTriangle size={16} /><small>Alertas</small><strong>{plantaoAlertasDashboard}</strong><em>{plantaoPossuiEscalaDashboard ? 'na operação' : 'nenhuma escala criada'}</em></span>
              </span>
              <span className="overview-operation-health"><i style={{ width: `${healthBarPlantao}%` }} /></span>
              <span className="overview-operation-action"><Radio size={15} /> Abrir operação Plantão <ArrowUpRight size={16} /></span>
            </button>
          </div>

          <div className="metric-grid overview-summary-metrics">
            <article><span>Colaboradores</span><strong>{colaboradoresOperacoesDashboard}</strong><small>ativos nas duas operações</small></article>
            <article><span>Dias no período</span><strong>{totaisGerais.dias || 31}</strong><small>{formatarCompetencia(competenciaDashboard)}</small></article>
            <article className="overview-health-summary">
              <div className="overview-health-summary-heading"><span>Saúde das escalas</span><ShieldCheck size={18} /></div>
              <div className="overview-health-row"><strong>SOC</strong><small className={socStatusDashboard}>{rotuloSaudeDashboard(socStatusDashboard)}</small><b>{healthBarSoc}%</b><i><em style={{ width: `${healthBarSoc}%` }} /></i></div>
              <div className="overview-health-row"><strong>Plantão</strong><small className={plantaoStatusDashboard}>{rotuloSaudeDashboard(plantaoStatusDashboard)}</small><b>{healthBarPlantao}%</b><i><em style={{ width: `${healthBarPlantao}%` }} /></i></div>
              <small className="overview-health-note">{pendenciasDashboard > 0 ? `${pendenciasDashboard} ${pendenciasDashboard === 1 ? 'pendência requer' : 'pendências requerem'} atenção` : 'Nenhuma pendência operacional'}</small>
            </article>
            <article><span>Pendências</span><strong>{pendenciasDashboard}</strong><small>requerem atenção</small></article>
          </div>

          <div className="overview-grid overview-secondary-grid">
            <article className="panel overview-span-4 overview-publication-card">
              <div className="panel-title"><div><h2>Publicação da escala</h2><p>Disponibilidade no aplicativo</p></div><ShieldCheck /></div>
              <div className="overview-operation-list">
                <button type="button" onClick={() => abrirOperacaoDoDashboard('JORNADA')}><ShieldCheck size={18} /><span><strong>SOC</strong><small>{resumoPublicacao.titulo}</small></span><em className={resumoPublicacao.estado}>{publicados.length}/{documentos.length || 0}</em><ChevronRight size={15} /></button>
                <button type="button" onClick={() => abrirOperacaoDoDashboard('PLANTAO')}><Radio size={18} /><span><strong>Plantão</strong><small>{plantaoPossuiEscalaDashboard ? 'Rascunho disponível' : 'Nenhuma escala criada'}</small></span><em className={plantaoPossuiEscalaDashboard ? 'parcial' : 'vazio'}>{plantaoPossuiEscalaDashboard ? 'Rascunho' : 'Sem escala'}</em><ChevronRight size={15} /></button>
              </div>
              <button className="overview-card-link" type="button" onClick={() => setTela('escalas')}>Ver escalas e histórico <ChevronRight size={16} /></button>
            </article>

            <article className="panel overview-span-4 overview-alerts-card">
              <div className="panel-title"><div><h2>Alertas por operação</h2><p>Pontos que merecem atenção do gestor</p></div><Bell size={18} /></div>
              <div className="overview-operation-list">
                <button type="button" onClick={() => abrirOperacaoDoDashboard('JORNADA')}><ShieldCheck size={18} /><span><strong>SOC</strong><small>Jornada 6x1</small></span><em className={socStatusDashboard}>{alertasVisiveis.length}</em><ChevronRight size={15} /></button>
                <button type="button" onClick={() => abrirOperacaoDoDashboard('PLANTAO')}><Radio size={18} /><span><strong>Plantão</strong><small>{plantaoMetricasDashboard}</small></span><em className={plantaoStatusDashboard}>{plantaoAlertasDashboard}</em><ChevronRight size={15} /></button>
              </div>
              <button className="overview-card-link" type="button" onClick={() => setAlertaSelecionado(alertasVisiveis[0] ?? null)}>Ver alertas do SOC <ChevronRight size={16} /></button>
            </article>

            <article className="panel overview-span-4 overview-swaps-card">
              <div className="panel-title"><div><h2>Trocas pendentes</h2><p>Aguardando decisão do gestor</p></div><ArrowLeftRight size={18} /></div>
              <button className="overview-swaps-summary" type="button" onClick={abrirTrocasDoDashboard}><strong>{trocasPendentesGestor.length}</strong><span>{trocasPendentesGestor.length === 1 ? 'troca aguarda' : 'trocas aguardam'} sua decisão.</span><ChevronRight size={16} /></button>
              <div className="overview-swap-preview">
                {trocasPendentesGestor.slice(0, 2).map((troca) => (
                  <button key={troca.trocaId} type="button" onClick={() => { setTela('trocas'); setTrocaSelecionadaId(troca.trocaId); }}><ArrowLeftRight size={15} /><span><strong>{troca.solicitanteNome} ⇄ {troca.destinatarioNome}</strong><small>{formatarDataCurta(troca.data)} · {troca.turnoSolicitanteAntes} ⇄ {troca.turnoDestinatarioAntes}</small></span><ChevronRight size={14} /></button>
                ))}
              </div>
              <button className="overview-card-link" type="button" onClick={abrirTrocasDoDashboard}>Gerenciar trocas <ChevronRight size={16} /></button>
            </article>
          </div>
        </section>
      )}

      {tela === 'importar' && (
        <section>
          <header className="page-heading">
            <div>
              {/* Navegação interna: usar controle de ação, nunca hiperlink sublinhado, para retornar à listagem de escalas. */}
              <div className="tela-breadcrumb">
                <button type="button" className="screen-back-button" onClick={() => setTela('escalas')} aria-label="Voltar para Escalas">
                  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>Escalas</span>
                </button>
              </div>
              <p className="eyebrow">Importação segura</p><h1>Importar escala</h1><p>O arquivo é processado somente na memória deste navegador.</p>
            </div>
          </header>
          <article className="import-panel panel">
            <div
              className={`dropzone ${arrastando ? 'dragging' : ''}`}
              onDragOver={(evento) => {
                evento.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={soltar}
              role="button"
              tabIndex={0}
              onClick={() => inputArquivo.current?.click()}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                  inputArquivo.current?.click();
                }
              }}
            >
              <input
                ref={inputArquivo}
                type="file"
                accept=".xls,.xlsx"
                hidden
                onChange={(evento: ChangeEvent<HTMLInputElement>) =>
                  void receberArquivo(evento.target.files?.[0])}
              />
              <span className="drop-icon"><FileSpreadsheet size={28} /></span>
              <div>
                <h2>Enviar planilha</h2>
                <p>Arraste o arquivo aqui ou <strong>selecione do computador</strong></p>
                <small>XLS legado ou XLSX · leitura local</small>
              </div>
            </div>
            {(tipoArquivoDetectado === null || tipoArquivoDetectado === 'ESCALA_6X1') && (
              <>
                <div className="import-summary">
                  <div><span>Período</span><strong>{resultado ? '26 jul – 25 ago' : '—'}</strong></div>
                  <div><span>Colaboradores</span><strong>{resultado?.documentos.length ?? '—'}</strong></div>
                  <div><span>Dias</span><strong>{resultado?.totalDias ?? '—'}</strong></div>
                </div>
                <div className="file-row">
                  <FileSpreadsheet size={20} />
                  <div><strong>{nomeArquivo}</strong><span>{resultado?.ok ? 'Pronto para salvar' : 'Aguardando correções'}</span></div>
                  {processando
                    ? <LoaderCircle className="spin" />
                    : resultado?.ok
                      ? <CheckCircle2 className="success-icon" />
                      : <AlertTriangle className="warning-icon" />}
                </div>
                <div className="import-actions">
                  <button className="secondary-button" type="button" onClick={() => void carregarDemo()}>
                    Carregar exemplo
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!resultado?.ok || processando || escritaBloqueada || conciliacaoBloqueiaPublicacao}
                    onClick={() => void salvar()}
                  >
                    <Save size={17} /> Salvar rascunho
                  </button>
                </div>
              </>
            )}
          </article>

          {tipoArquivoDetectado === 'DESCONHECIDA' && (
            <article className="panel warning-panel">
              <div className="panel-title">
                <div>
                  <h2>Estrutura de planilha não reconhecida</h2>
                  <p>{motivoArquivoDesconhecido || 'Não foi possível identificar o tipo desta planilha.'}</p>
                </div>
                <AlertTriangle className="warning-icon" />
              </div>
              <p>Formatos suportados hoje: escala 6x1 (aba &ldquo;Escalistas&rdquo;) e Plantão (colunas &ldquo;Plantonista.../Data Início/Data Fim&rdquo;).</p>
            </article>
          )}

          {tipoArquivoDetectado === 'PLANTAO' && origemPlantaoAtual !== null && (
            <PreviewPlantao
              resultado={resultadoPlantao}
              origem={origemPlantaoAtual}
              nomeArquivo={nomeArquivo}
              participantes={participantesPlantao}
              atribuicoes={atribuicoesPlantaoComVinculo}
              vinculos={vinculosPlantao}
              usuarios={usuarios}
              aba={abaPreviaPlantao}
              onMudarAba={setAbaPreviaPlantao}
              buscaPorParticipante={buscaVinculoPlantao}
              onMudarBusca={(participanteNomeOriginal, termo) =>
                setBuscaVinculoPlantao((atuais) => ({ ...atuais, [participanteNomeOriginal]: termo }))}
              onConfirmarVinculo={confirmarVinculoPlantaoAcao}
              onDesfazerVinculo={desfazerVinculoPlantaoAcao}
              conferencia={resultadoPlantao === null ? null : conferirContabilidadePlantao(resultadoPlantao)}
              pendencias={pendenciasVinculoPlantao}
              podeValidar={previaPlantaoPodeValidar}
              validada={previaPlantaoValidada}
              onValidar={validarPreviaPlantao}
              onIrParaUsuarios={() => setTela('usuarios')}
              atribuicoesEditaveis={atribuicoesEditaveisPlantao}
              competencia={competenciaRascunho}
              periodoInicio={periodoInicioRascunho}
              periodoFim={periodoFimRascunho}
              dataHoje={dataIsoLocal(new Date())}
              editadoDesdeImportacao={plantaoEditadoDesdeImportacao}
              onEditarAtribuicao={contextoPlantaoSomenteConsulta ? NAO_OPERAR_PLANTAO_CONSULTA : abrirEdicaoAtribuicaoPlantao}
              plantonistaSelecionado={plantonistaSelecionadoPlantao}
              onSelecionarPlantonista={alternarPlantonistaSelecionado}
              onSolicitarNovaAtribuicao={contextoPlantaoSomenteConsulta ? NAO_OPERAR_PLANTAO_CONSULTA : solicitarNovaAtribuicaoPlantao}
              nomesInativosPlantao={nomesInativosReferenciadosPlantao}
              somenteConsulta={contextoPlantaoSomenteConsulta}
            />
          )}

          {modalAtribuicaoPlantao !== null && (
            <ModalEditarAtribuicaoPlantao
              titulo={modalAtribuicaoPlantao.modo === 'criar' ? 'Adicionar plantão' : 'Editar plantão'}
              valoresIniciais={modalAtribuicaoPlantao.valoresIniciais}
              modo={modalAtribuicaoPlantao.modo}
              participantesConhecidos={participantesPlantao.map((participante) => participante.nomeOriginal)}
              padroesDisponiveis={padroesHorarioModalPlantao}
              onFechar={fecharModalAtribuicaoPlantao}
              onSalvar={salvarModalAtribuicaoPlantao}
              onExcluir={modalAtribuicaoPlantao.modo === 'editar' ? excluirModalAtribuicaoPlantao : undefined}
            />
          )}

          {quickAddPlantao !== null && (
            <QuickAddPlantaoPopover
              plantonistaNomeOriginal={quickAddPlantao.plantonistaNomeOriginal}
              dataIso={quickAddPlantao.dataIso}
              padrao={quickAddPlantao.padrao}
              onAdicionar={confirmarQuickAddPlantao}
              onOutroHorario={abrirOutroHorarioQuickAddPlantao}
              onFechar={fecharQuickAddPlantao}
            />
          )}

          {/*
           * Fase ESCOPO-CONSULTA-PLANTAO-1 — um contexto só consultável
           * nunca mostra o painel de escrita "Salvar como rascunho",
           * mesmo que os vínculos já estejam resolvidos
           * (`previaPlantaoValidada`) — consulta nunca é administração.
           */}
          {tipoArquivoDetectado === 'PLANTAO' && origemPlantaoAtual !== null && contextoPlantaoSomenteConsulta && (
            <article className="panel">
              <div className="panel-title">
                <div><h2>Somente consulta</h2></div>
              </div>
              <p className="admin-form-preview">
                Sua equipe monitora este Plantão — a edição, importação e publicação continuam restritas ao
                responsável pelo Plantão.
              </p>
            </article>
          )}
          {tipoArquivoDetectado === 'PLANTAO' && origemPlantaoAtual !== null && previaPlantaoValidada && !contextoPlantaoSomenteConsulta && (
            <article className="panel">
              <div className="panel-title">
                <div>
                  <h2>Salvar como rascunho</h2>
                  <p>
                    Grava o grupo, os participantes vinculados, a competência e as atribuições como
                    RASCUNHO — a publicação ainda não está disponível.
                  </p>
                </div>
              </div>
              {!podeAcessarPlantoes && (
                <p className="admin-form-preview">
                  Você não administra nenhum grupo de Plantão — peça a um gestor da equipe responsável
                  ou a um administrador do sistema.
                </p>
              )}
              {podeAcessarPlantoes && (
                <>
                  <div className="toolbar">
                    <label htmlFor="rascunho-plantao-grupo" className="search-control">
                      <Radio size={16} />
                      <select
                        id="rascunho-plantao-grupo"
                        value={grupoRascunhoEscolhido}
                        onChange={(evento) => {
                          setGrupoRascunhoEscolhido(evento.target.value);
                          setRascunhoPlantaoSalvoEm(null);
                          setErroRascunhoPlantao('');
                          if (evento.target.value !== '') {
                            setContextoEscalaAtivo({ tipo: 'PLANTAO', grupoId: evento.target.value, competencia: competenciaRascunho });
                            setContextoSemEscala(false);
                          }
                        }}
                      >
                        <option value="">Selecione um grupo que você administra</option>
                        {gruposPlantaoAdmin.filter(podeGerenciarEsteGrupoPlantao).map((grupo) => (
                          <option key={grupo.grupoId} value={grupo.grupoId}>{grupo.nome}</option>
                        ))}
                      </select>
                    </label>
                    <button className="secondary-button" type="button" onClick={abrirNovoGrupoPlantao}>
                      <Plus size={16} /> Novo grupo
                    </button>
                  </div>
                  {gruposPlantaoAdmin.filter(podeGerenciarEsteGrupoPlantao).length === 0 && (
                    <p className="admin-form-preview">
                      Você ainda não administra nenhum grupo de Plantão — crie um novo grupo acima.
                    </p>
                  )}
                  <div className="admin-form-grid">
                    <label htmlFor="rascunho-plantao-competencia">
                      Competência (AAAA-MM)
                      <input
                        id="rascunho-plantao-competencia"
                        placeholder="2026-07"
                        value={competenciaRascunho}
                        onChange={(evento) => setCompetenciaRascunho(evento.target.value)}
                      />
                    </label>
                    <label htmlFor="rascunho-plantao-inicio">
                      Período — início
                      <input
                        id="rascunho-plantao-inicio"
                        type="date"
                        value={periodoInicioRascunho}
                        onChange={(evento) => setPeriodoInicioRascunho(evento.target.value)}
                      />
                    </label>
                    <label htmlFor="rascunho-plantao-fim">
                      Período — fim
                      <input
                        id="rascunho-plantao-fim"
                        type="date"
                        value={periodoFimRascunho}
                        onChange={(evento) => setPeriodoFimRascunho(evento.target.value)}
                      />
                    </label>
                  </div>
                  <p className="admin-form-preview">
                    {new Set(vinculosPlantao.map((vinculo) => vinculo.login).filter((login) => login !== null)).size}
                    {' '}participante(s) com login confirmado serão salvos neste grupo.
                  </p>
                  {erroRascunhoPlantao && <p className="admin-form-erro">{erroRascunhoPlantao}</p>}
                  {rascunhoPlantaoSalvoEm !== null && (
                    <p className="plantao-validado-nota">
                      <ShieldCheck size={15} /> Rascunho salvo. Veja em &ldquo;Plantões&rdquo;.
                    </p>
                  )}
                  <div className="rollback-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={salvandoRascunhoPlantao || grupoRascunhoEscolhido === ''}
                      onClick={() => void salvarRascunhoPlantaoAcao()}
                    >
                      {salvandoRascunhoPlantao ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                      {' '}Salvar rascunho
                    </button>
                  </div>
                </>
              )}
            </article>
          )}

          {tipoArquivoDetectado !== 'PLANTAO' && (
            <>
            {resultado && resultado.erros.length > 0 && (
              <article className="panel error-panel">
                <div className="panel-title">
                  <div><h2>Corrigir inconsistências</h2><p>Nada será gravado enquanto houver erros.</p></div>
                  {resultado.erros.some((erro) => erro.motivo.includes('loginParaUid')) && (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={escritaBloqueada}
                      onClick={() => void cadastrarFaltantes()}
                    >
                      <UserPlus size={16} /> Cadastrar usuários faltantes
                    </button>
                  )}
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Local</th><th>Login</th><th>Valor</th><th>Motivo</th><th>Correção</th></tr></thead>
                    <tbody>
                      {resultado.erros.map((erro, indice) => (
                        <tr key={`${erro.linha}-${erro.coluna}-${indice}`}>
                          <td>{erro.coluna}{erro.linha}</td>
                          <td>{erro.login ?? '—'}</td>
                          <td><code>{erro.valorEncontrado}</code></td>
                          <td>{erro.motivo}<small>{erro.sugestao}</small></td>
                          <td>
                            <div className="inline-edit">
                              <input
                                value={correcoes[indice] ?? ''}
                                onChange={(evento) => setCorrecoes((atuais) => ({
                                  ...atuais,
                                  [indice]: evento.target.value,
                                }))}
                                aria-label={`Correção para ${erro.coluna}${erro.linha}`}
                              />
                              <button type="button" onClick={() => corrigirErro(erro, indice)}>
                                Aplicar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {resultado && resultado.avisos.length > 0 && (
              <article className="panel warning-panel">
                <div className="panel-title">
                  <div><h2>Avisos</h2><p>Não impedem salvar, mas vale conferir antes de publicar.</p></div>
                  <span className="status-badge warning">{resultado.avisos.length} aviso(s)</span>
                </div>
                <ul className="warning-list">
                  {resultado.avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </article>
            )}

            {linhasConciliacao.length > 0 && (
              <article className="panel conciliation-panel">
                <div className="panel-title">
                  <div>
                    <h2>Conciliação de nomes da planilha</h2>
                    <p>Confira quem cada nome da planilha representa antes de salvar ou publicar.</p>
                  </div>
                  <span className={`status-badge ${pendenciasConciliacao ? 'warning' : 'success'}`}>
                    {pendenciasConciliacao ? `${pendenciasConciliacao} pendência(s)` : 'Tudo conciliado'}
                  </span>
                </div>
                <div className="table-scroll">
                  <table className="data-table conciliation-table">
                    <thead>
                      <tr>
                        <th>Nome encontrado na planilha</th>
                        <th>Usuário vinculado</th>
                        <th>Status</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasConciliacao.map((linha) => {
                        const vinculado = usuarios.find((item) => item.login === linha.login);
                        return (
                          <tr key={linha.nomePlanilha} data-status={linha.status}>
                            <td>{linha.nomePlanilha}</td>
                            <td>
                              <select
                                value={linha.login ?? ''}
                                onChange={(evento) => {
                                  if (evento.target.value) {
                                    selecionarVinculoConciliacao(linha, evento.target.value);
                                  }
                                }}
                                aria-label={`Usuário vinculado a ${linha.nomePlanilha}`}
                              >
                                <option value="">Selecionar usuário…</option>
                                {usuarios.map((item) => (
                                  <option key={item.login} value={item.login}>
                                    {item.nome}{item.ativo ? '' : ' (inativo)'}
                                  </option>
                                ))}
                              </select>
                              {linha.status === 'CONFLITO_ALIAS' && (
                                <small>
                                  Candidatos: {linha.candidatos
                                    .map((login) => usuarios.find((item) => item.login === login)?.nome ?? login)
                                    .join(', ')}
                                </small>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${
                                linha.status === 'VINCULADO_LOGIN' || linha.status === 'VINCULADO_ALIAS' || linha.status === 'IGNORADA'
                                  ? 'success'
                                  : 'warning'
                              }`}
                              >
                                {STATUS_CONCILIACAO_LABEL[linha.status]}
                              </span>
                            </td>
                            <td>
                              <div className="conciliation-actions">
                                {linha.login !== null && linha.status !== 'VINCULADO_LOGIN' && (
                                  <button
                                    className="icon-button"
                                    type="button"
                                    title={`Salvar "${linha.nomePlanilha}" como alias de ${vinculado?.nome ?? ''}`}
                                    disabled={escritaBloqueada}
                                    onClick={() => void salvarAliasConciliacao(linha)}
                                  >
                                    <Link2 size={15} />
                                  </button>
                                )}
                                {linha.status !== 'PRECISA_MAPEAR' && linha.status !== 'IGNORADA' && (
                                  <button
                                    className="icon-button"
                                    type="button"
                                    title="Marcar como pendente"
                                    onClick={() => marcarConciliacaoPendente(linha)}
                                  >
                                    <HelpCircle size={15} />
                                  </button>
                                )}
                                {linha.status !== 'IGNORADA' && (
                                  <button
                                    className="icon-button"
                                    type="button"
                                    title="Ignorar esta linha"
                                    onClick={() => ignorarConciliacao(linha)}
                                  >
                                    <Ban size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {resultado && resultado.documentos.length > 0 && (
              <ScheduleImportReview
                resultado={resultado}
                nomeArquivo={nomeArquivo}
                usuarios={usuarios}
                catalogo={catalogo}
                indiceAlertas={indiceAlertasGrade}
                linhasConciliacao={linhasConciliacao}
              />
            )}
            </>
          )}
        </section>
      )}

      {tela === 'escalas' && (
        <section>
          <header className="page-heading">
            <div><h1>Escalas</h1><p>Rascunhos e publicações disponíveis para a equipe.</p></div>
            <div className="grade-header-actions">
              <button className="secondary-button" type="button" onClick={abrirImportarEscala}>
                <UploadCloud size={17} /> Importar escala
              </button>
              <button className="primary-button" type="button" onClick={abrirNovaEscala}>
                <Plus size={17} /> Nova escala
              </button>
            </div>
          </header>
          {erroContextoEscala !== '' && <div className="alert error" role="alert">{erroContextoEscala}</div>}
          {contextoSemEscala && contextoEscalaAtivo !== null && (
            /*
             * Fase ESCALAS-UX-2A.1 — § 16 do redesign: trocar de contexto/
             * competência NUNCA cria um rascunho silenciosamente. Este
             * estado só aparece quando `aplicarTrocaContexto()`/
             * `aplicarTrocaCompetencia()` confirmaram (via
             * `obterCompetenciaPlantaoRascunho`/`carregarEscalasEquipe`) que
             * não existe nenhuma escala para o alvo — a ação de criar
             * continua sendo a mesma "+ Nova escala" de sempre.
             */
            <article className="panel organization-empty-state">
              <CalendarDays size={28} aria-hidden="true" />
              <h2>Nenhuma escala criada para {formatarCompetencia(contextoEscalaAtivo.competencia)}</h2>
              <p>Use &ldquo;Nova escala&rdquo; acima para importar uma planilha, criar vazia ou usar o período anterior.</p>
            </article>
          )}
          {!contextoSemEscala && (
            <article className="panel scale-record">
              <div className="scale-period"><span>AGO</span><strong>2026</strong></div>
              <div className="scale-info">
                <h2>COSI &gt; SOC</h2>
                <p>26/07/2026 até 25/08/2026 · {documentos.length} colaboradores</p>
                <span className={`status-badge ${publicados.length === documentos.length && documentos.length ? 'success' : 'warning'}`}>
                  {publicados.length === documentos.length && documentos.length ? 'Publicada' : 'Rascunho'}
                </span>
                {revisaoAtual > 0 && <span className="revision-label">Revisão ativa {revisaoAtual}</span>}
              </div>
              <div className="scale-actions">
                <button className="secondary-button" type="button" onClick={() => setTela('grade')}>Abrir editor</button>
                {documentos.length > 0 && publicados.length !== documentos.length && (
                  <button
                    className="secondary-button danger-button"
                    type="button"
                    disabled={processando || escritaBloqueada}
                    onClick={() => setDescarteRascunhoPendente(true)}
                  >
                    <Trash2 size={16} /> Descartar rascunho
                  </button>
                )}
                <button
                  className="primary-button"
                  type="button"
                  disabled={!documentos.length || !resultado?.ok || processando || escritaBloqueada || conciliacaoBloqueiaPublicacao}
                  onClick={() => {
                    setErroPublicacao('');
                    setPublicacaoPendente(true);
                  }}
                >
                  <Send size={16} /> Publicar
                </button>
              </div>
            </article>
          )}
          <article className="panel publication-history-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Rastreabilidade local</p>
                <h2>Histórico de publicações</h2>
                <p>Cada publicação é imutável; um rollback sempre cria uma nova revisão.</p>
              </div>
              <ShieldCheck />
            </div>
            {historico.length === 0 ? (
              <div className="history-empty">
                <RotateCcw size={22} />
                <span>{modoDemo ? 'Entre no laboratório local para testar o histórico e o rollback.' : 'Nenhuma revisão encontrada.'}</span>
              </div>
            ) : (
              <div className="publication-history-list">
                {historico.map((publicacao) => {
                  const eventos = detalhesPublicacao[publicacao.id] ?? [];
                  const alteracoes = eventos.flatMap((evento) => evento.alteracoes);
                  return (
                    <div className="publication-history-entry" key={publicacao.id}>
                      <div className="publication-history-item">
                        <span className={`revision-dot ${publicacao.tipo.toLowerCase()}`} />
                        <div>
                          <strong>
                            Revisão {publicacao.revisao}
                            {publicacao.revisao === revisaoAtual ? ' — ativa' : ''}
                          </strong>
                          <span>{publicacao.motivo ?? (
                            publicacao.tipo === 'ROLLBACK'
                              ? `Rollback da revisão ${publicacao.revisaoOrigem}`
                              : publicacao.tipo === 'SEED' ? 'Carga inicial do laboratório' : 'Publicação da escala'
                          )}</span>
                          <small>
                            {publicacao.totalColaboradoresAfetados ?? publicacao.totalDocumentos} colaborador(es) ·{' '}
                            {publicacao.totalDiasAlterados ?? '—'} dia(s) alterado(s)
                          </small>
                        </div>
                        <time dateTime={publicacao.publicadoEm}>
                          {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(publicacao.publicadoEm))}
                        </time>
                        <div className="history-actions">
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            onClick={() => void alternarDetalhes(publicacao)}
                          >
                            {publicacaoExpandida === publicacao.id ? 'Ocultar' : 'Ver alterações'}
                          </button>
                          {publicacao.revisao !== revisaoAtual && (
                            <button
                              className="secondary-button compact-button"
                              type="button"
                              disabled={modoDemo || processando || escritaBloqueada}
                              onClick={() => setRevisaoParaRestaurar(publicacao)}
                            >
                              <RotateCcw size={14} /> Restaurar
                            </button>
                          )}
                        </div>
                      </div>
                      {publicacaoExpandida === publicacao.id && (
                        <div className="publication-history-details">
                          {alteracoes.length === 0 ? (
                            <p>
                              {publicacao.tipo === 'SEED'
                                ? 'Esta é a carga inicial do laboratório; não existe uma revisão anterior para comparar.'
                                : 'Nenhuma alteração detalhada foi encontrada para esta revisão.'}
                            </p>
                          ) : (
                            <div className="history-change-list">
                              {alteracoes.map((alteracao) => {
                                const pessoa = usuarios.find((item) => item.login === alteracao.login);
                                const antes = alteracao.codigoAnterior === null
                                  ? 'Sem escala'
                                  : `${catalogo[alteracao.codigoAnterior]?.descricao ?? alteracao.codigoAnterior}${alteracao.horarioAnterior ? ` · ${alteracao.horarioAnterior}` : ''}`;
                                const depois = alteracao.codigoNovo === null
                                  ? 'Removido da escala'
                                  : `${catalogo[alteracao.codigoNovo]?.descricao ?? alteracao.codigoNovo}${alteracao.horarioNovo ? ` · ${alteracao.horarioNovo}` : ''}`;
                                return (
                                  <div className="history-change" key={`${alteracao.login}-${alteracao.data}`}>
                                    <div>
                                      <strong>{pessoa?.nome ?? alteracao.login}</strong>
                                      <span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${alteracao.data}T12:00:00Z`))}</span>
                                    </div>
                                    <span className="history-before">{antes}</span>
                                    <ArrowUpRight size={15} />
                                    <span className="history-after">{depois}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      )}

      {tela === 'grade' && (
        <section>
          {resultado && arquivo !== null ? (
            <ScheduleImportReview
              resultado={resultado}
              nomeArquivo={nomeArquivo}
              usuarios={usuarios}
              catalogo={catalogo}
              indiceAlertas={indiceAlertasGrade}
              linhasConciliacao={linhasConciliacao}
              onVoltar={() => setTela('escalas')}
              onEditar={abrirCelulaParaEdicao}
              onRemover={(documento) => setRemoverMembroPendente(documento)}
              headerActions={(
                <>
                  <button className="secondary-button" type="button" disabled={escritaBloqueada || !usuarios.length} onClick={abrirAdicionarMembroGrade}>
                    <UserPlus size={15} /> Adicionar colaborador
                  </button>
                  <button className="primary-button" type="button" disabled={!documentos.length || escritaBloqueada} onClick={() => void salvar()}>
                    <Save size={15} /> Salvar alterações
                  </button>
                </>
              )}
            />
          ) : (
            <>
              <header className="page-heading">
                <div>
                  {/* Navegação interna: usar controle de ação, nunca hiperlink sublinhado, para retornar à listagem de escalas. */}
                  <div className="tela-breadcrumb">
                    <button type="button" className="screen-back-button" onClick={() => setTela('escalas')} aria-label="Voltar para Escalas">
                      <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                      <span>Escalas</span>
                    </button>
                  </div>
                  <p className="eyebrow">Revisão completa</p>
                  <h1>Grade da equipe</h1>
                  <p>Clique em uma célula para editar o rascunho.</p>
                </div>
                <div className="grade-header-actions">
                  <span className={`status-badge ${publicados.length === documentos.length && documentos.length ? 'success' : 'warning'}`}>
                    {publicados.length === documentos.length && documentos.length ? 'Revisão publicada' : 'Rascunho não publicado'}
                  </span>
                  <button className="secondary-button" type="button" disabled={escritaBloqueada || !usuarios.length} onClick={abrirAdicionarMembroGrade}>
                    <UserPlus size={16} /> Adicionar colaborador
                  </button>
                  <button className="primary-button" type="button" disabled={!documentos.length || escritaBloqueada} onClick={() => void salvar()}>
                    <Save size={16} /> Salvar alterações
                  </button>
                </div>
              </header>
              <article className="panel grid-panel">
                <div className="toolbar">
                  <label><Filter size={16} /><select value={filtroTurno} onChange={(evento) => setFiltroTurno(evento.target.value)}>
                    <option value="TODOS">Todos os turnos</option>
                    <option value="MD">Madrugada</option><option value="M">Manhã</option>
                    <option value="T">Tarde</option><option value="N">Noite</option>
                  </select></label>
                  <span>{documentos.filter((documento) => filtroTurno === 'TODOS' || documento.turnoPadrao === filtroTurno).length} colaboradores</span>
                </div>
                <ScheduleGrid
                  documentos={documentos}
                  usuarios={usuarios}
                  catalogo={catalogo}
                  filtroTurno={filtroTurno}
                  agruparPorPeriodo
                  indiceAlertas={indiceAlertasGrade}
                  onEditar={abrirCelulaParaEdicao}
                  onRemover={(documento) => setRemoverMembroPendente(documento)}
                />
              </article>
              <ScheduleLegend catalogo={catalogo} />
            </>
          )}
        </section>
      )}

      {tela === 'trocas' && (
        <section>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Combinar com a equipe</p>
              <h1>Trocas de escala</h1>
              <p>Revise, aprove ou recuse pedidos de troca entre colaboradores.</p>
            </div>
          </header>
          {erroTroca && <div className="alert error" role="alert">{erroTroca}</div>}
          <div className="metric-grid">
            <article><span>Aguardando você</span><strong>{trocasPendentesGestor.length}</strong><small>precisam de decisão</small></article>
            <article><span>Aprovadas</span><strong>{trocasAprovadas.length}</strong><small>aprovadas ou publicadas</small></article>
            <article><span>Recusadas</span><strong>{trocasRecusadas.length}</strong><small>pelo colega ou pelo gestor</small></article>
            <article><span>Total no histórico</span><strong>{trocas.length}</strong><small>desde o início</small></article>
          </div>
          <article className="panel grid-panel">
            <div className="toolbar">
              <div className="segmented-control">
                {([
                  ['pendentes', 'Pendentes', trocasPendentesGestor.length],
                  ['aprovadas', 'Aprovadas', trocasAprovadas.length],
                  ['recusadas', 'Recusadas', trocasRecusadas.length],
                  ['historico', 'Histórico', trocas.length],
                ] as const).map(([id, rotulo, contagem]) => (
                  <button
                    key={id}
                    type="button"
                    className={filtroTrocas === id ? 'active' : ''}
                    onClick={() => setFiltroTrocas(id)}
                  >
                    {rotulo} ({contagem})
                  </button>
                ))}
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table trocas-table">
                <thead>
                  <tr>
                    <th>Solicitante</th>
                    <th>Destinatário</th>
                    <th>Data</th>
                    <th>Troca solicitada</th>
                    <th>Status</th>
                    <th>Atualizado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {trocasListaFiltrada.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state">Nenhuma troca neste filtro.</div></td></tr>
                  ) : trocasListaFiltrada.map((troca) => (
                    <tr key={troca.trocaId}>
                      <td><strong>{troca.solicitanteNome}</strong><small>{troca.solicitanteLogin}</small></td>
                      <td><strong>{troca.destinatarioNome}</strong><small>{troca.destinatarioLogin}</small></td>
                      <td>{formatarDataCurta(troca.data)}</td>
                      <td>
                        <span className="shift-chip" data-code={troca.turnoSolicitanteAntes || ''}>{troca.turnoSolicitanteAntes || '—'}</span>
                        {' ⇄ '}
                        <span className="shift-chip" data-code={troca.turnoDestinatarioAntes || ''}>{troca.turnoDestinatarioAntes || '—'}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${SEVERIDADE_STATUS_TROCA[troca.status]}`}>
                          {ROTULO_STATUS_TROCA[troca.status]}
                        </span>
                      </td>
                      <td>{formatarDataHoraSafe(troca.atualizadoEm)}</td>
                      <td>
                        <button
                          className="icon-button"
                          type="button"
                          title="Ver detalhes"
                          onClick={() => setTrocaSelecionadaId(troca.trocaId)}
                        >
                          <ChevronRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <ScheduleLegend catalogo={catalogo} />
        </section>
      )}

      {tela === 'usuarios' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Identidades de importação</p><h1>Usuários</h1><p>O login em destaque deve coincidir com a planilha.</p></div>
            <button
              className="primary-button"
              type="button"
              disabled={escritaBloqueada}
              onClick={abrirNovoUsuario}
            >
              <UserPlus size={17} /> Cadastrar usuário
            </button>
          </header>
          <article className="panel grid-panel">
            <div className="toolbar">
              <label className="search-control"><Search size={16} /><input value={buscaUsuario} onChange={(evento) => setBuscaUsuario(evento.target.value)} placeholder="Buscar nome ou login" /></label>
              <span><Users size={16} /> {usuarios.length} usuários</span>
            </div>
            <div className="table-scroll">
              <table className="data-table users-table">
                <thead><tr><th>Colaborador</th><th>Login de importação</th><th>Turno</th><th>Perfil</th><th>Status</th><th>Aliases da planilha</th><th>Ações</th></tr></thead>
                <tbody>
                  {usuarios
                    .filter((item) => `${item.nome} ${item.login}`.toLowerCase().includes(buscaUsuario.toLowerCase()))
                    .map((item) => (
                      <tr key={item.login}>
                        <td><strong>{item.nome}</strong><small>{item.email}</small></td>
                        <td><code className="login-code">{item.login}</code></td>
                        <td>{item.turnoPadrao}</td>
                        <td>{item.cargo}</td>
                        <td>
                          <span className={`status-badge ${item.ativo ? 'success' : 'neutral'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span>
                        </td>
                        <td>
                          {(item.aliasesPlanilha ?? []).length === 0
                            ? <small className="empty-inline">Nenhum</small>
                            : (item.aliasesPlanilha ?? []).map((alias) => (
                              <span className="alias-chip" key={alias}>{alias}</span>
                            ))}
                        </td>
                        <td>
                          <div className="user-row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              title="Editar usuário"
                              disabled={escritaBloqueada}
                              onClick={() => abrirEdicaoUsuario(item)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              title={item.ativo ? 'Desativar' : 'Ativar'}
                              disabled={escritaBloqueada}
                              onClick={() => void alternarAtivoUsuario(item)}
                            >
                              <Power size={15} />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              title="Lembretes atribuídos"
                              onClick={() => abrirLembretesAtribuidos(item)}
                            >
                              <Bell size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {tela === 'plantoes' && podeAcessarPlantoes && (
        <section>
          <header className="page-heading">
            <div>
              {/*
               * Fase ESCALAS-UX-2A — "Plantões" saiu da sidebar principal e
               * virou a sub-tela "Grupos de Plantão" de Administração
               * (§ 10/§ 12 do redesign): esta tela é configuração
               * ADMINISTRATIVA de Grupo — nunca a escala mensal (essa
               * continua em "Escalas"). Nome de UI atualizado para deixar
               * essa distinção explícita; nenhuma lógica funcional mudou.
               */}
              <p className="eyebrow">Administração</p>
              <h1><Radio size={20} /> Grupos de Plantão</h1>
              <p>Configuração de Grupo, participantes, contatos e ACL — não é a escala mensal de Plantão.</p>
            </div>
            <button className="primary-button" type="button" onClick={abrirNovoGrupoPlantao}>
              <Plus size={16} /> Novo grupo
            </button>
          </header>
          <AdministracaoSubnav
            aba="plantao"
            podeAcessarPlantoes={podeAcessarPlantoes}
            onEscolherAba={(aba) => setTela(aba === 'organizacao' ? 'administracao' : aba === 'plantao' ? 'plantoes' : 'responsaveisEscala')}
          />
          {erroPlantaoAdmin && <div className="alert error" role="alert">{erroPlantaoAdmin}</div>}
          {gruposPlantaoAdmin.length === 0 && !erroPlantaoAdmin && (
            <article className="panel organization-empty-state">
              <Radio size={28} aria-hidden="true" />
              <h2>Nenhum grupo de Plantão ainda</h2>
              <p>Crie um grupo para organizar participantes, contatos e o rascunho da competência — use o botão &ldquo;Novo grupo&rdquo; acima.</p>
            </article>
          )}
          {gruposPlantaoAdmin.map((grupo) => {
            const gerencio = podeGerenciarEsteGrupoPlantao(grupo);
            const participantesDoGrupo = participantesPorGrupoPlantao[grupo.grupoId] ?? [];
            const expandido = grupoPlantaoExpandido === grupo.grupoId;
            const equipeResponsavel = equipesAdmin.find((item) => item.id === grupo.equipeResponsavelId);
            const termoBusca = buscaParticipanteNovo[grupo.grupoId] ?? '';
            const poolBusca = souAdmin ? todosUsuariosAdmin : usuarios;
            const resultadosBusca = termoBusca.trim() === ''
              ? []
              : buscarUsuariosPlantao(poolBusca, termoBusca)
                .filter((candidato) => !participantesDoGrupo.some((item) => item.login === candidato.login && item.ativo))
                .slice(0, 6);
            return (
              <article className="panel grid-panel" key={grupo.grupoId}>
                <div className="panel-title">
                  <div>
                    <h2>{grupo.nome}</h2>
                    <p>{grupo.descricao || 'Sem descrição.'}</p>
                  </div>
                  <div className="import-actions">
                    <span className={`status-badge ${grupo.ativo ? 'success' : 'neutral'}`}>
                      {grupo.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    {!gerencio && <span className="status-badge warning">Você só consulta este grupo</span>}
                    {gerencio && (
                      <button
                        className="icon-button"
                        type="button"
                        title="Editar"
                        aria-label={`Editar grupo ${grupo.nome}`}
                        onClick={() => abrirEdicaoGrupoPlantao(grupo)}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="import-summary plantao-resumo-grid">
                  <div><span>Equipe responsável</span><strong>{equipeResponsavel?.nome ?? grupo.equipeResponsavelId}</strong></div>
                  <div><span>Equipes que consultam</span><strong>{grupo.equipesConsulta.length}</strong></div>
                  <div><span>Timezone</span><strong>{grupo.timezone}</strong></div>
                  <div><span>Participantes ativos</span><strong>{participantesDoGrupo.filter((item) => item.ativo).length}</strong></div>
                </div>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => void abrirParticipantesDoGrupo(grupo.grupoId)}
                >
                  {expandido ? 'Ocultar participantes' : 'Ver participantes'}
                </button>
                {expandido && (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Login</th><th>Nome</th><th>Contatos</th><th>Status</th>
                          {gerencio && <th>Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {participantesDoGrupo.map((participante) => {
                          const usuarioParticipante = usuarios.find((item) => item.login === participante.login)
                            ?? todosUsuariosAdmin.find((item) => item.login === participante.login);
                          const nomeExibicao = usuarioParticipante?.nome ?? participante.login;
                          return (
                            <tr key={participante.login}>
                              <td><code className="login-code">{participante.login}</code></td>
                              <td>{nomeExibicao}</td>
                              <td>{participante.contatos.length} contato(s)</td>
                              <td>
                                <span className={`status-badge ${participante.ativo ? 'success' : 'neutral'}`}>
                                  {participante.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              {gerencio && (
                                <td>
                                  <div className="conciliation-actions">
                                    <button
                                      className="icon-button"
                                      type="button"
                                      title="Contatos"
                                      aria-label={`Editar contatos de ${nomeExibicao}`}
                                      onClick={() => setModalContatosParticipante({
                                        grupoId: grupo.grupoId,
                                        nomeExibicao,
                                        participante,
                                      })}
                                    >
                                      <Phone size={14} />
                                    </button>
                                    {participante.ativo && (
                                      <button
                                        className="icon-button"
                                        type="button"
                                        title="Desativar participante"
                                        aria-label={`Desativar ${nomeExibicao}`}
                                        onClick={() => setParticipanteParaDesativar({
                                          grupoId: grupo.grupoId,
                                          login: participante.login,
                                          nomeExibicao,
                                        })}
                                      >
                                        <UserMinus size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {participantesDoGrupo.length === 0 && (
                          <tr><td colSpan={gerencio ? 5 : 4}>Nenhum participante cadastrado ainda.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {gerencio && (
                      <>
                        <label className="plantao-busca-linha">
                          <Search size={14} />
                          <input
                            value={termoBusca}
                            onChange={(evento) => setBuscaParticipanteNovo((atuais) => ({
                              ...atuais,
                              [grupo.grupoId]: evento.target.value,
                            }))}
                            placeholder="Buscar usuário por nome ou login para adicionar…"
                            aria-label={`Buscar usuário para adicionar ao grupo ${grupo.nome}`}
                          />
                        </label>
                        {resultadosBusca.length > 0 && (
                          <ul className="plantao-busca-resultados">
                            {resultadosBusca.map((candidato) => (
                              <li key={candidato.login}>
                                <button
                                  type="button"
                                  className="secondary-button compact-button"
                                  onClick={() => void adicionarParticipantePlantao(grupo.grupoId, candidato)}
                                >
                                  <UserPlus size={14} /> {candidato.nome} ({candidato.login})
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                    <div className="plantao-rascunhos-secao">
                      <h3>Rascunhos</h3>
                      {(rascunhosPlantaoPorGrupo[grupo.grupoId] ?? []).length === 0 ? (
                        <p className="empty-inline">Nenhum rascunho salvo ainda para este grupo.</p>
                      ) : (
                        <ul className="plantao-rascunhos-lista">
                          {(rascunhosPlantaoPorGrupo[grupo.grupoId] ?? []).map((rascunho) => (
                            <li key={rascunho.id} className="plantao-rascunho-item">
                              <div>
                                <strong>{formatarCompetencia(rascunho.competencia)}</strong>
                                <span>
                                  {formatarData(rascunho.periodoInicio, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  {' → '}
                                  {formatarData(rascunho.periodoFim, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <span className="status-badge neutral">RASCUNHO</span>
                              </div>
                              {gerencio && (
                                <button
                                  className="secondary-button compact-button"
                                  type="button"
                                  disabled={abrirRascunhoPlantaoStatus?.fase === 'carregando'}
                                  onClick={() => void abrirRascunhoNoEditorAcao(grupo, rascunho)}
                                >
                                  {abrirRascunhoPlantaoStatus?.fase === 'carregando'
                                    ? <LoaderCircle className="spin" size={14} />
                                    : <ArrowUpRight size={14} />}
                                  {' '}Abrir rascunho
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {abrirRascunhoPlantaoStatus?.fase === 'erro' && (
                        <p className="admin-form-erro" role="alert">{abrirRascunhoPlantaoStatus.mensagem}</p>
                      )}
                      {abrirRascunhoPlantaoStatus?.fase === 'nao-encontrado' && (
                        <p className="admin-form-erro" role="alert">Rascunho não encontrado.</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {tela === 'responsaveisEscala' && podeAcessarAdministracao && usuarioReal !== null && (
        <section>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Administração</p>
              <h1>Responsáveis por escala</h1>
              <p>Configure quem administra cada Jornada ou Plantão. Consulta é leitura e monitoramento, nunca edição.</p>
            </div>
          </header>
          <AdministracaoSubnav
            aba="responsaveis"
            podeAcessarPlantoes={podeAcessarPlantoes}
            onEscolherAba={(aba) => setTela(aba === 'organizacao' ? 'administracao' : aba === 'plantao' ? 'plantoes' : 'responsaveisEscala')}
          />
          {erroAdmin && <div className="alert error" role="alert">{erroAdmin}</div>}
          <ResponsaveisEscalaTable
            escopos={escoposOperacionaisAdmin}
            equipes={equipesAdmin}
            grupos={gruposPlantaoAdmin}
            unidades={unidadesAdmin}
            usuarios={todosUsuariosAdmin.length > 0 ? todosUsuariosAdmin : usuarios}
            onNovo={() => setModalResponsavelEscala('novo')}
            onEditar={(escopo) => setModalResponsavelEscala(escopo)}
            onAlternarStatus={alternarStatusEscopoOperacional}
            podeEditar={souAdmin}
            processando={processandoEscopoOperacional}
          />
        </section>
      )}

      {tela === 'administracao' && podeAcessarAdministracao && (
        <section>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Área restrita conforme perfil e escopo do usuário</p>
              <h1>Administração</h1>
              {souAdmin && <p>Você está como <strong>ADMIN_SISTEMA</strong> — acesso global ao staging.</p>}
              {!souAdmin && souGestorUnidade && (
                <p>Você está como <strong>GESTOR_UNIDADE</strong> — acesso restrito às unidades e equipes permitidas.</p>
              )}
            </div>
          </header>
          {/* Fase ESCALAS-UX-2A — § 11 do redesign: "Organização" (conteúdo abaixo, inalterado) e "Grupos de Plantão" (antiga tela "Plantões") como abas da mesma área, nunca uma segunda sidebar. */}
          <AdministracaoSubnav
            aba="organizacao"
            podeAcessarPlantoes={podeAcessarPlantoes}
            onEscolherAba={(aba) => setTela(aba === 'organizacao' ? 'administracao' : aba === 'plantao' ? 'plantoes' : 'responsaveisEscala')}
          />
          {erroAdmin && <div className="alert error" role="alert">{erroAdmin}</div>}

          <article className="panel">
            <div className="panel-title"><div><h2>Resumo organizacional</h2><p>Contagens gerais — atualiza ao entrar nesta tela.</p></div></div>
            <div className="metric-grid">
              <article><span>Unidades</span><strong>{resumoOrganizacional.totalUnidades}</strong></article>
              <article><span>Equipes</span><strong>{resumoOrganizacional.totalEquipes}</strong></article>
              {souAdmin && (
                <>
                  <article><span>Usuários ativos</span><strong>{resumoOrganizacional.usuariosAtivos}</strong></article>
                  <article><span>Usuários técnicos/fake</span><strong>{resumoOrganizacional.usuariosTecnicosOuFake}</strong></article>
                  <article><span>Gestores</span><strong>{resumoOrganizacional.totalGestores}</strong></article>
                </>
              )}
              <article><span>Equipes sem unidade</span><strong>{resumoOrganizacional.equipesSemUnidade}</strong></article>
            </div>
          </article>

          <article className="panel grid-panel">
            <div className="panel-title">
              <div>
                <h2>Unidades organizacionais</h2>
                <p>Hierarquia flexível (diretoria, gerência, coordenação, supervisão...) acima das equipes — criar e editar, sem exclusão.</p>
              </div>
              <button className="primary-button" type="button" onClick={abrirNovaUnidade}>
                <Plus size={16} /> Nova unidade
              </button>
            </div>
            {arvoreOrganizacionalAdmin.unidadesInalcancaveis.length > 0 && (
              <div className="alert warning" role="alert">
                {arvoreOrganizacionalAdmin.unidadesInalcancaveis.length} unidade(s) não aparecem na árvore abaixo —
                possível ciclo ou referência inválida de <code>parentId</code>:{' '}
                {arvoreOrganizacionalAdmin.unidadesInalcancaveis.map((item) => item.unidadeId).join(', ')}.
                Nada foi corrigido automaticamente.
              </div>
            )}
            <div className="organization-layout">
              <OrganizationTree
                raizes={arvoreOrganizacionalAdmin.raizes}
                labelAria="Estrutura organizacional"
                termoBusca={buscaArvoreOrganizacional}
                onMudarBusca={setBuscaArvoreOrganizacional}
                chaveSelecionada={chaveNoOrganizacionalSelecionada}
                onSelecionarNo={(no) => setChaveNoOrganizacionalSelecionada(chaveDoNoOrganizacional(no))}
                mensagemVazia="Nenhuma unidade organizacional cadastrada ainda."
                renderTrilha={(no) => (no.tipo === 'unidade' ? (
                  <span className={`status-badge ${no.unidade.ativa ? 'success' : 'neutral'}`}>
                    {no.unidade.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                ) : null)}
              />
              <div className="organization-detail-panel">
                {noOrganizacionalSelecionado === null && (
                  <p className="empty-inline">Selecione um item da árvore para ver os detalhes.</p>
                )}
                {noOrganizacionalSelecionado?.tipo === 'unidade' && (() => {
                  const item = noOrganizacionalSelecionado.unidade;
                  const pai = item.parentId !== null ? unidadesAdmin.find((u) => u.unidadeId === item.parentId) : undefined;
                  const unidadesFilhas = noOrganizacionalSelecionado.filhos.filter((f) => f.tipo === 'unidade').length;
                  const equipesFilhas = noOrganizacionalSelecionado.filhos.filter((f) => f.tipo === 'equipe').length;
                  const podeEditar = souAdmin || minhasUnidadesPermitidas.includes(item.unidadeId);
                  return (
                    <>
                      <div className="organization-detail-header">
                        <h3>{item.nome}</h3>
                        <span className={`status-badge ${item.ativa ? 'success' : 'neutral'}`}>{item.ativa ? 'Ativa' : 'Inativa'}</span>
                      </div>
                      <p className="organization-detail-tipo">{item.tipo} · <code>{item.sigla}</code></p>
                      <OrganizationBreadcrumb caminho={item.caminho} unidades={unidadesAdmin} />
                      <dl className="organization-detail-lista">
                        <div><dt>Unidade pai</dt><dd>{pai ? pai.nome : '— (raiz)'}</dd></div>
                        <div><dt>Unidades filhas</dt><dd>{unidadesFilhas}</dd></div>
                        <div><dt>Equipes associadas</dt><dd>{equipesFilhas}</dd></div>
                        <div><dt>Identificador</dt><dd><code className="login-code">{item.unidadeId}</code></dd></div>
                      </dl>
                      {podeEditar && (
                        <button className="secondary-button" type="button" onClick={() => abrirEdicaoUnidade(item)}>
                          <Pencil size={14} /> Editar unidade
                        </button>
                      )}
                    </>
                  );
                })()}
                {noOrganizacionalSelecionado?.tipo === 'equipe' && (() => {
                  const item = noOrganizacionalSelecionado.equipe;
                  const podeEditar = souAdmin || (item.unidadeId !== undefined && minhasUnidadesPermitidas.includes(item.unidadeId));
                  return (
                    <>
                      <div className="organization-detail-header">
                        <h3>{item.nome}</h3>
                        <span className={`status-badge ${item.ativa ? 'success' : 'neutral'}`}>{item.ativa ? 'Ativa' : 'Inativa'}</span>
                      </div>
                      <p className="organization-detail-tipo">Equipe · <code>{item.sigla}</code></p>
                      {item.caminhoUnidade && <OrganizationBreadcrumb caminho={item.caminhoUnidade} unidades={unidadesAdmin} />}
                      <dl className="organization-detail-lista">
                        <div><dt>Identificador</dt><dd><code className="login-code">{item.id}</code></dd></div>
                      </dl>
                      {/*
                       * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — deixa
                       * explícito, na própria árvore de Administração, que
                       * uma Equipe (mesmo com "Plantão" no nome) não é o
                       * destino da escala de Plantão — o destino real é o
                       * GrupoPlantao vinculado (`equipeResponsavelId`),
                       * nunca inferido por nome. Sem Grupo vinculado, a
                       * equipe segue disponível para Jornada 6x1 ou para
                       * futuramente virar responsável de um Grupo novo.
                       */}
                      {(() => {
                        const grupoVinculado = gruposPlantaoAdmin.find((grupo) => grupo.ativo && grupo.equipeResponsavelId === item.id);
                        return grupoVinculado ? (
                          <p className="admin-form-preview">
                            <Radio size={14} aria-hidden="true" /> Equipe responsável do Grupo de Plantão <strong>{grupoVinculado.nome}</strong> — a escala de Plantão é montada/importada sobre esse Grupo, nunca diretamente sobre esta equipe.
                          </p>
                        ) : (
                          <p className="admin-form-preview">Nenhum Grupo de Plantão vinculado a esta equipe ainda — disponível para Jornada 6x1 ou para se tornar equipe responsável de um novo Grupo de Plantão.</p>
                        );
                      })()}
                      {/*
                       * Fase ESCOPO-CONSULTA-PLANTAO-1 — "Plantões
                       * monitorados pela equipe": autovínculo direto de
                       * CONSULTA, sem depender de aprovação do coordenador
                       * responsável pelo Plantão. Visível para quem
                       * ADMINISTRA esta equipe (`minhasEquipesPermitidas`,
                       * inclui GESTOR_EQUIPE/SUPERVISOR_EQUIPE — não só
                       * `podeEditar`, que é o poder mais estrito de editar
                       * a própria Equipe, restrito a ADMIN/GESTOR_UNIDADE).
                       */}
                      {(souAdmin || minhasEquipesPermitidas.includes(item.id)) && (() => {
                        const monitorados = plantoesMonitoradosPelaEquipe(gruposPlantaoAdmin, item.id);
                        const disponiveis = plantoesDisponiveisParaMonitoramento(gruposPlantaoAdmin, item.id)
                          .filter((grupo) => grupo.equipeResponsavelId !== item.id);
                        return (
                          <div className="organization-plantoes-monitorados">
                            <h4>Plantões monitorados</h4>
                            <p className="admin-form-preview">
                              Esta configuração libera somente consulta. A edição, importação e publicação continuam restritas ao responsável pelo Plantão.
                            </p>
                            {monitorados.length === 0 ? (
                              <p className="empty-inline">Nenhum Plantão monitorado por esta equipe ainda.</p>
                            ) : (
                              <ul className="organization-team-picker-resumo">
                                {monitorados.map((grupo) => (
                                  <li key={grupo.grupoId}>
                                    <div><strong>{grupo.nome}</strong></div>
                                    {grupo.equipeResponsavelId === item.id ? (
                                      <span className="status-badge neutral">responsável — sempre monitorado</span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="icon-button"
                                        title="Parar de monitorar"
                                        aria-label={`Parar de monitorar ${grupo.nome}`}
                                        disabled={processandoConsultaPlantao === grupo.grupoId}
                                        onClick={() => void alternarPlantaoMonitoradoPelaEquipe(grupo.grupoId, item.id, 'REMOVER')}
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {disponiveis.length > 0 && (
                              <div className="wizard-inline-fields">
                                <label htmlFor={`plantoes-disponiveis-${item.id}`}>
                                  Adicionar Plantão monitorado
                                  <select
                                    id={`plantoes-disponiveis-${item.id}`}
                                    value=""
                                    disabled={processandoConsultaPlantao !== null}
                                    onChange={(evento) => {
                                      const grupoId = evento.target.value;
                                      if (grupoId !== '') {
                                        void alternarPlantaoMonitoradoPelaEquipe(grupoId, item.id, 'ADICIONAR');
                                      }
                                    }}
                                  >
                                    <option value="">Selecione um Plantão para monitorar</option>
                                    {disponiveis.map((grupo) => <option key={grupo.grupoId} value={grupo.grupoId}>{grupo.nome}</option>)}
                                  </select>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {podeEditar && (
                        <button className="secondary-button" type="button" onClick={() => abrirEdicaoEquipe(item)}>
                          <Pencil size={14} /> Editar equipe
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            {arvoreOrganizacionalAdmin.equipesSemUnidade.length > 0 && (
              <div className="organization-sem-unidade">
                <h3>Equipes sem unidade associada</h3>
                <ul>
                  {arvoreOrganizacionalAdmin.equipesSemUnidade.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="organization-tree-row-link"
                        onClick={() => setChaveNoOrganizacionalSelecionada(`equipe:${item.id}`)}
                      >
                        {item.nome} <code>{item.sigla}</code>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className="panel grid-panel">
            <div className="panel-title">
              <div>
                <h2>Equipes</h2>
                <p>Equipe é o grupo que recebe escala — a escala continua vinculada ao <code>equipeId</code>. Criar e editar, sem exclusão.</p>
              </div>
              <button className="primary-button" type="button" onClick={abrirNovaEquipe}>
                <Plus size={16} /> Nova equipe
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Nome</th><th>Sigla</th><th>Unidade</th><th>Destino operacional</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {equipesAdmin.map((item) => {
                    /**
                     * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — mesma
                     * distinção do painel de detalhe da árvore acima,
                     * agora visível para toda a lista sem precisar
                     * selecionar cada equipe: nunca inferida por nome,
                     * sempre pela relação real `equipeResponsavelId`.
                     */
                    const grupoVinculado = gruposPlantaoAdmin.find((grupo) => grupo.ativo && grupo.equipeResponsavelId === item.id);
                    return (
                    <tr key={item.id}>
                      <td><code className="login-code">{item.id}</code></td>
                      <td>{item.nome}</td>
                      <td>{item.sigla}</td>
                      <td title={item.caminhoUnidade ? caminhoLegivel(item.caminhoUnidade, unidadesAdmin) : undefined}>
                        {item.caminhoUnidade ? caminhoCurto(item.caminhoUnidade, unidadesAdmin, 2) : '—'}
                      </td>
                      <td>
                        {grupoVinculado ? (
                          <span className="status-badge warning" title={`Equipe responsável do Grupo de Plantão ${grupoVinculado.nome}`}>
                            <Radio size={12} aria-hidden="true" /> Plantão · {grupoVinculado.nome}
                          </span>
                        ) : (
                          <span className="status-badge neutral">Jornada 6x1</span>
                        )}
                      </td>
                      <td><span className={`status-badge ${item.ativa ? 'success' : 'neutral'}`}>{item.ativa ? 'Ativa' : 'Inativa'}</span></td>
                      <td>
                        {(souAdmin || (item.unidadeId !== undefined && minhasUnidadesPermitidas.includes(item.unidadeId))) && (
                          <button
                            className="icon-button"
                            type="button"
                            title="Editar"
                            aria-label={`Editar equipe ${item.nome}`}
                            onClick={() => abrirEdicaoEquipe(item)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          {souAdmin && (
          <article className="panel grid-panel">
            <div className="panel-title"><div><h2>Usuários</h2><p>Busca, filtros e exclusão seletiva de cadastros fake/teste, com confirmação forte.</p></div></div>
            <div className="toolbar">
              <label className="search-control"><Search size={16} /><input value={buscaUsuarioAdmin} onChange={(evento) => setBuscaUsuarioAdmin(evento.target.value)} placeholder="Buscar nome, login ou e-mail" /></label>
              <select value={filtroEquipeUsuarioAdmin} onChange={(evento) => setFiltroEquipeUsuarioAdmin(evento.target.value)}>
                <option value="">Todas as equipes</option>
                {equipesAdmin.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
              <select value={filtroPerfilUsuarioAdmin} onChange={(evento) => setFiltroPerfilUsuarioAdmin(evento.target.value)}>
                <option value="">Todos os perfis</option>
                {PERFIS_ADMINISTRAVEIS.map((perfil) => <option key={perfil} value={perfil}>{perfil}</option>)}
              </select>
              <select value={filtroTipoUsuarioAdmin} onChange={(evento) => setFiltroTipoUsuarioAdmin(evento.target.value as typeof filtroTipoUsuarioAdmin)}>
                <option value="TODOS">Todos</option>
                <option value="REAIS">Reais</option>
                <option value="TECNICOS">Técnicos/fake</option>
                <option value="GESTORES">Gestores</option>
                <option value="ANALISTAS">Analistas</option>
              </select>
              <span><Users size={16} /> {usuariosAdminFiltrados.length} de {todosUsuariosAdmin.length}</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Colaborador</th><th>Login</th><th>Perfil</th><th>Equipe</th><th>Tipo</th><th>Ações</th></tr></thead>
                <tbody>
                  {usuariosAdminFiltrados.map((item) => {
                    const autoExclusao = !podeExcluirUsuario(item, usuarioReal);
                    const tecnico = ehUsuarioTecnicoOuFake(item);
                    return (
                      <tr key={item.login}>
                        <td>
                          <strong>{tecnico ? (item.nome || '(sem nome humano)') : item.nome}</strong>
                          {tecnico && <small>cadastro técnico/gerado, não um colaborador identificado</small>}
                        </td>
                        <td><code className="login-code">{item.login}</code></td>
                        <td>{perfilEfetivo(item)}</td>
                        <td>{item.equipeId}</td>
                        <td>
                          <span className={`status-badge ${tecnico ? 'warning' : 'success'}`}>{tecnico ? 'Técnico/fake' : 'Real'}</span>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            type="button"
                            title={autoExclusao ? 'Não é possível excluir a própria conta logada' : 'Excluir dados'}
                            aria-label={autoExclusao ? 'Não é possível excluir a própria conta logada' : `Excluir dados de ${item.nome}`}
                            disabled={autoExclusao}
                            onClick={() => setUsuarioParaExcluir(item)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {usuariosAdminFiltrados.length === 0 && (
                    <tr><td colSpan={6}><div className="empty-state">Nenhum usuário bate com esses filtros.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
          )}

          {souAdmin && (
          <article className="panel grid-panel">
            <div className="panel-title"><div><h2>Simular gestor</h2><p>Testar o Dashboard como se fosse aquele gestor, sem trocar de login.</p></div></div>
            <div className="toolbar">
              <label htmlFor="select-gestor-simular" className="search-control">
                <Users size={16} />
                <select
                  id="select-gestor-simular"
                  value={gestorParaSimular}
                  onChange={(evento) => setGestorParaSimular(evento.target.value)}
                >
                  <option value="">Selecione um gestor</option>
                  {gestoresSimulaveis.map((item) => (
                    <option key={item.login} value={item.login}>{rotuloGestorParaSimulacao(item)}</option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="button" disabled={gestorSelecionadoParaSimular === null} onClick={iniciarSimulacaoSelecionada}>
                Simular
              </button>
            </div>
            {gestorSelecionadoParaSimular && (
              <p className="admin-form-preview">
                Simulando: <strong>{rotuloGestorParaSimulacao(gestorSelecionadoParaSimular)}</strong>
              </p>
            )}
          </article>
          )}

          {souAdmin && (
          <article className="panel grid-panel">
            <div className="panel-title"><div><h2>Limpeza / Histórico</h2><p>Exportar antes de excluir escalas antigas.</p></div></div>
            <div className="admin-form-grid">
              <label htmlFor="limpeza-equipe">
                Equipe
                <select id="limpeza-equipe" value={equipeExportar} onChange={(evento) => setEquipeExportar(evento.target.value)}>
                  <option value="">Selecione uma equipe</option>
                  {equipesAdmin.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}{item.caminhoUnidade && item.caminhoUnidade.length > 0 ? ` — ${trechoFinalCaminho(item.caminhoUnidade, unidadesAdmin, 2)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="limpeza-competencia">
                Competência
                <input
                  id="limpeza-competencia"
                  placeholder="AAAA-MM"
                  value={competenciaExportar}
                  onChange={(evento) => setCompetenciaExportar(evento.target.value)}
                />
              </label>
              <div className="admin-form-full rollback-actions">
                <button className="secondary-button" type="button" onClick={() => void exportarEscalaXlsx()}>Exportar XLSX</button>
                <button className="secondary-button" type="button" onClick={() => void imprimirEscala()}>Imprimir · Salvar PDF</button>
              </div>
              {!podeExcluirCompetencia(competenciaExportar, COMPETENCIA_ATUAL) ? (
                <p className="admin-form-preview admin-form-full">
                  A competência atual (<strong>{COMPETENCIA_ATUAL}</strong>) não pode ser excluída por aqui.
                </p>
              ) : (
                <button
                  className="secondary-button danger-button admin-form-full"
                  type="button"
                  onClick={() => setExcluirEscalaPendente(true)}
                >
                  <Trash2 size={15} /> Excluir escala desta equipe/competência
                </button>
              )}
            </div>
          </article>
          )}

          {souAdmin && (
          <details className="legacy-panel">
            <summary>
              <div>
                <h2>Setores (legado)</h2>
                <p>Cadastro antigo, mantido só por compatibilidade — novos cadastros usam Unidades organizacionais.</p>
              </div>
            </summary>
            <div className="legacy-panel-body">
              <p className="legacy-panel-warning">
                Cadastro antigo mantido apenas por compatibilidade. Novos cadastros devem usar Unidades organizacionais.
              </p>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>ID</th><th>Nome</th><th>Sigla</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {setoresAdmin.map((item) => (
                      <tr key={item.id}>
                        <td><code className="login-code">{item.id}</code></td>
                        <td>{item.nome}</td>
                        <td>{item.sigla}</td>
                        <td><span className={`status-badge ${item.ativo ? 'success' : 'neutral'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        <td>
                          <button
                            className="icon-button"
                            type="button"
                            title="Editar"
                            aria-label={`Editar setor ${item.nome}`}
                            onClick={() => setFormSetor(item)}
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="legacy-panel-form toolbar">
                <input aria-label="ID do setor" placeholder="ID (ex.: SET_SOC)" value={formSetor.id} onChange={(evento) => setFormSetor((atual) => ({ ...atual, id: evento.target.value }))} />
                <input aria-label="Nome do setor" placeholder="Nome" value={formSetor.nome} onChange={(evento) => setFormSetor((atual) => ({ ...atual, nome: evento.target.value }))} />
                <input aria-label="Sigla do setor" placeholder="Sigla" value={formSetor.sigla} onChange={(evento) => setFormSetor((atual) => ({ ...atual, sigla: evento.target.value }))} />
                <label className="checkbox-row" htmlFor="setor-legado-ativo">
                  <input
                    id="setor-legado-ativo"
                    type="checkbox"
                    checked={formSetor.ativo}
                    onChange={(evento) => setFormSetor((atual) => ({ ...atual, ativo: evento.target.checked }))}
                  />
                  <span>Ativo</span>
                </label>
                <button className="secondary-button compact-button" type="button" onClick={() => void salvarFormSetor()}>Salvar setor</button>
              </div>
            </div>
          </details>
          )}
        </section>
      )}

      {modalUnidade && (
        <ModalUnidadeOrganizacional
          modo={modalUnidade.modo}
          inicial={modalUnidade.inicial}
          unidadesExistentes={unidadesAdmin}
          unidadesPermitidas={souAdmin ? null : minhasUnidadesPermitidas}
          loginAtual={usuarioReal?.login ?? ''}
          onFechar={() => setModalUnidade(null)}
          onSalvar={salvarUnidadeDoModal}
        />
      )}

      {modalEquipe && (
        <ModalEquipe
          modo={modalEquipe.modo}
          inicial={modalEquipe.inicial}
          equipesExistentes={equipesAdmin}
          unidadesExistentes={unidadesAdmin}
          unidadesPermitidas={souAdmin ? null : minhasUnidadesPermitidas}
          onFechar={() => setModalEquipe(null)}
          onSalvar={salvarEquipeDoModal}
        />
      )}

      {modalResponsavelEscala !== null && usuarioReal !== null && (
        <ResponsavelEscalaModal
          escopo={modalResponsavelEscala === 'novo' ? null : modalResponsavelEscala}
          equipes={equipesAdmin}
          grupos={gruposPlantaoAdmin}
          usuarios={todosUsuariosAdmin.length > 0 ? todosUsuariosAdmin : usuarios}
          loginAtual={usuarioReal.login}
          onFechar={() => setModalResponsavelEscala(null)}
          onSalvar={salvarEscopoOperacionalDoModal}
          processando={processandoEscopoOperacional}
        />
      )}

      {wizardInicio !== null && (
        <ScheduleStartWizard
          modo={wizardInicio}
          tipo={wizardTipo}
          onFechar={fecharNovaEscala}
          onEscolherTipo={selecionarTipoWizard}
          areas={areasWizardParaExibir}
          areaId={wizardAreaId}
          onMudarArea={mudarAreaWizard}
          equipes={equipesWizard}
          equipeId={wizardEquipeId}
          onMudarEquipe={mudarEquipeWizard}
          grupos={gruposWizard}
          grupoId={wizardGrupoId}
          onMudarGrupo={mudarGrupoWizard}
          competencia={wizardCompetencia}
          onMudarCompetencia={(competencia) => {
            setWizardCompetencia(competencia);
            setWizardErro('');
          }}
          arquivoNome={wizardArquivoNome}
          onSelecionarArquivo={(arquivo) => void selecionarArquivoWizard(arquivo)}
          onContinuar={() => void continuarWizard()}
          onAbrirRascunhoExistente={wizardTipo === 'PLANTAO' ? abrirRascunhoWizard : undefined}
          rascunhoExistente={wizardTipo === 'PLANTAO' ? rascunhoWizardExistente : false}
          onCriarEquipe={criarEquipeWizard}
          onCriarGrupo={criarGrupoWizard}
          onUsarPeriodoAnterior={wizardTipo === 'PLANTAO'
            ? () => void usarPeriodoAnteriorAcao(wizardGrupoId, wizardCompetencia)
            : undefined}
          periodoAnteriorDisponivel={periodoAnteriorWizardDisponivel}
          erro={wizardErro}
          processando={wizardProcessando}
        />
      )}

      {modalGrupoPlantao && (
        <ModalGrupoPlantao
          modo={modalGrupoPlantao.modo}
          inicial={modalGrupoPlantao.inicial}
          gruposExistentes={gruposPlantaoAdmin}
          equipesExistentes={equipesAdmin}
          unidadesExistentes={unidadesAdmin}
          equipesPermitidas={souAdmin ? null : minhasEquipesPermitidas}
          carregandoEquipes={carregandoEquipesPlantaoParaExibir}
          erroEquipes={erroEquipesPlantao || null}
          onFechar={() => setModalGrupoPlantao(null)}
          onSalvar={salvarGrupoPlantaoDoModal}
        />
      )}

      {modalContatosParticipante && (
        <ModalContatosParticipante
          nomeExibicao={modalContatosParticipante.nomeExibicao}
          contatosIniciais={modalContatosParticipante.participante.contatos}
          onFechar={() => setModalContatosParticipante(null)}
          onSalvar={salvarContatosParticipanteDoModal}
        />
      )}

      {participanteParaDesativar && (
        <ModalConfirmarComTexto
          titulo="Desativar participante"
          mensagem={(
            <>
              Confirme digitando o login <strong>{participanteParaDesativar.login}</strong> para desativar{' '}
              {participanteParaDesativar.nomeExibicao} deste grupo de Plantão. Isto nunca exclui o histórico —
              só marca o participante como inativo.
            </>
          )}
          fraseEsperada={participanteParaDesativar.login}
          rotuloBotaoConfirmar="Desativar participante"
          processando={processandoDesativarParticipante}
          onFechar={() => setParticipanteParaDesativar(null)}
          onConfirmar={() => void confirmarDesativarParticipantePlantao()}
        />
      )}

      {usuarioParaExcluir && usuarioReal && (
        <ModalExcluirUsuario
          candidato={usuarioParaExcluir}
          zeraGestores={exclusaoZeraGestores(todosUsuariosAdmin, usuarioParaExcluir.login)}
          processando={processandoExclusaoUsuario}
          onFechar={() => setUsuarioParaExcluir(null)}
          onConfirmar={(opcoes) => void confirmarExclusaoUsuario(opcoes)}
        />
      )}

      {excluirEscalaPendente && (
        <ModalConfirmarComTexto
          titulo="Excluir escala"
          mensagem={(
            <p>
              Escalas publicadas e rascunhos de <strong>{equipeExportar}</strong> / <strong>{competenciaExportar}</strong> serão
              excluídos. Histórico e usuários não são afetados.
            </p>
          )}
          fraseEsperada={['EXCLUIR ESCALA', competenciaExportar]}
          rotuloBotaoConfirmar="Excluir escala"
          processando={processandoEscalaAdmin}
          onFechar={() => setExcluirEscalaPendente(false)}
          onConfirmar={() => void confirmarExclusaoEscala()}
        />
      )}

      {publicacaoPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => { setPublicacaoPendente(false); setErroPublicacao(''); }}>
          <section
            className="edit-modal publication-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publication-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Comunicação da mudança</p>
                <h2 id="publication-title">Publicar nova versão da escala?</h2>
                <p>Os colaboradores afetados receberão esta informação no sino do App.</p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => { setPublicacaoPendente(false); setErroPublicacao(''); }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <label className="publication-reason">
              Motivo da publicação
              <textarea
                value={motivoPublicacao}
                onChange={(evento) => setMotivoPublicacao(evento.target.value)}
                placeholder="Ex.: Ajuste da cobertura da madrugada"
                maxLength={180}
                autoFocus
              />
              <small>{motivoPublicacao.trim().length}/180 caracteres</small>
            </label>
            {erroPublicacao && (
              <div className="alert error" role="alert">{erroPublicacao}</div>
            )}
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => { setPublicacaoPendente(false); setErroPublicacao(''); }}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                disabled={processando || (revisaoAtual > 0 && motivoPublicacao.trim().length < 3)}
                onClick={() => void publicar()}
              >
                {processando ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
                Publicar e notificar
              </button>
            </div>
          </section>
        </div>
      )}

      {trocaSelecionada && (
        <ModalDetalheTrocaGestor
          troca={trocaSelecionada}
          alertasHipoteticos={alertasHipoteticosTroca(trocaSelecionada)}
          motivoRecusa={motivoRecusaTroca}
          processando={processandoTroca}
          erro={erroTroca}
          onMudarMotivoRecusa={setMotivoRecusaTroca}
          onFechar={() => { setTrocaSelecionadaId(null); setMotivoRecusaTroca(''); setErroTroca(''); }}
          onRecusar={() => void recusarTroca(trocaSelecionada.trocaId, motivoRecusaTroca)}
          onAprovarEPublicar={() => void aprovarEPublicarTroca(trocaSelecionada.trocaId)}
        />
      )}

      {alertaSelecionado && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAlertaSelecionado(null)}>
          <section
            className="edit-modal alert-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-detail-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">{alertaSelecionado.tipo}</p>
                <h2 id="alert-detail-title">{alertaSelecionado.titulo}</h2>
                {alertaSelecionado.colaborador && <p>{alertaSelecionado.colaborador}</p>}
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setAlertaSelecionado(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <p className="alert-detail-descricao">{alertaSelecionado.descricao}</p>
            {alertaSelecionado.data && (
              <p className="alert-detail-meta">
                <CalendarDays size={14} /> {formatarDataCurta(alertaSelecionado.data)}
              </p>
            )}
            <div className="alert-detail-sugestao">
              <strong>Sugestão</strong>
              <p>{alertaSelecionado.sugestao}</p>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setAlertaSelecionado(null)}>
                Fechar
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => { setAlertaSelecionado(null); setTela('grade'); }}
              >
                <ArrowUpRight size={16} /> Ver na grade
              </button>
            </div>
          </section>
        </div>
      )}

      {celulaEditando && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCelulaEditando(null)}>
          <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="panel-title">
              <div><p className="eyebrow">{celulaEditando.data}</p><h2 id="edit-title">Editar célula</h2><p>{celulaEditando.documento.login}</p></div>
              <button className="icon-button" type="button" onClick={() => setCelulaEditando(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
              {!celulaEditando.dia.c && (
                <label className="cycle-assist-toggle">
                  <input
                    type="checkbox"
                    checked={cicloInicial6x1Ativo}
                    onChange={(evento) => setCicloInicial6x1Ativo(evento.target.checked)}
                  />
                  <span>
                    <strong>Preencher ciclo inicial 6x1</strong>
                    <small>Ao escolher um turno de trabalho, replica o mesmo código nos próximos 5 dias livres. Cada dia continua editável.</small>
                  </span>
                </label>
              )}
              <div className="code-picker">
              {Object.values(catalogo).map((tipo) => (
                <button key={tipo.codigo} type="button" data-code={tipo.codigo} onClick={() => editarCelula(tipo.codigo)}>
                  <span className="shift-chip" data-code={tipo.codigo}>{tipo.codigo}</span>
                  <strong>{tipo.descricao}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {revisaoParaRestaurar && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRevisaoParaRestaurar(null)}>
          <section
            className="edit-modal rollback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rollback-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Rollback seguro</p>
                <h2 id="rollback-title">Restaurar revisão {revisaoParaRestaurar.revisao}?</h2>
                <p>A revisão atual não será apagada. Uma nova revisão de rollback será registrada.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setRevisaoParaRestaurar(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setRevisaoParaRestaurar(null)}>Cancelar</button>
              <button className="primary-button" type="button" disabled={processando} onClick={() => void restaurar()}>
                <RotateCcw size={16} /> Criar rollback
              </button>
            </div>
          </section>
        </div>
      )}

      {intencaoTrocaEscalaPendente !== null && (
        <UnsavedChangesDialog
          onContinuarEditando={cancelarTrocaEscalaPendente}
          onTrocarSemSalvar={confirmarDescarteETrocarEscala}
        />
      )}

      {descarteRascunhoPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDescarteRascunhoPendente(false)}>
          <section
            className="edit-modal rollback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Ação local, sem afetar a escala publicada</p>
                <h2 id="discard-title">Descartar este rascunho?</h2>
                <p>
                  Apenas documentos ainda não publicados são removidos. A última escala
                  publicada da equipe continua disponível para o App.
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setDescarteRascunhoPendente(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setDescarteRascunhoPendente(false)}>Cancelar</button>
              <button className="primary-button danger-button" type="button" disabled={processando} onClick={() => void descartarRascunho()}>
                {processando ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
                Descartar rascunho
              </button>
            </div>
          </section>
        </div>
      )}

      {membroGradeDraft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharAdicionarMembroGrade}>
          <section
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-membro-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Grade desta competência</p>
                <h2 id="add-membro-title">Adicionar colaborador à grade</h2>
                <p>O colaborador entra como rascunho, sem nenhum dia preenchido ainda.</p>
              </div>
              <button className="icon-button" type="button" onClick={fecharAdicionarMembroGrade} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="user-form-grid">
              {usuariosElegiveisGrade.length === 0 && (
                <p className="admin-form-erro user-form-full" role="status">
                  Nenhum usuário ativo encontrado para esta equipe. Cadastre ou importe usuários antes de montar a escala.
                </p>
              )}
              <label className="user-form-full">
                Colaborador
                <select
                  value={membroGradeDraft.login}
                  onChange={(evento) => setMembroGradeDraft({ ...membroGradeDraft, login: evento.target.value })}
                >
                  <option value="">Selecionar usuário cadastrado…</option>
                  {usuariosElegiveisGrade.map((item) => (
                    <option key={item.login} value={item.login}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="user-form-full">
                Período / turno base
                <select
                  value={membroGradeDraft.turnoPadrao}
                  onChange={(evento) => setMembroGradeDraft({ ...membroGradeDraft, turnoPadrao: evento.target.value })}
                >
                  {Object.values(catalogo).map((tipo) => (
                    <option key={tipo.codigo} value={tipo.codigo}>{tipo.descricao}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={fecharAdicionarMembroGrade}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                disabled={!membroGradeDraft.login || usuariosElegiveisGrade.length === 0}
                onClick={() => void confirmarAdicionarMembroGrade()}
              >
                <UserPlus size={16} /> Adicionar à grade
              </button>
            </div>
          </section>
        </div>
      )}

      {removerMembroPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRemoverMembroPendente(null)}>
          <section
            className="edit-modal rollback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-membro-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Ação local, o cadastro do usuário não é afetado</p>
                <h2 id="remove-membro-title">
                  Remover {usuarios.find((item) => item.login === removerMembroPendente.login)?.nome
                    ?? removerMembroPendente.login} da grade?
                </h2>
                <p>
                  Remove apenas o colaborador desta competência. O usuário continua
                  cadastrado e pode ser incluído de novo quando for preciso.
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setRemoverMembroPendente(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setRemoverMembroPendente(null)}>Cancelar</button>
              <button className="primary-button danger-button" type="button" onClick={() => void confirmarRemocaoMembroGrade()}>
                <UserMinus size={16} /> Remover da grade
              </button>
            </div>
          </section>
        </div>
      )}

      {formularioUsuario && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharFormularioUsuario}>
          <section
            className="edit-modal user-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">{formularioUsuario.loginOriginal === null ? 'Novo colaborador' : 'Editar colaborador'}</p>
                <h2 id="user-form-title">
                  {formularioUsuario.loginOriginal === null ? 'Cadastrar usuário' : formularioUsuario.nome || 'Editar usuário'}
                </h2>
              </div>
              <button className="icon-button" type="button" onClick={fecharFormularioUsuario} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="user-form-grid">
              <label>
                Nome
                <input
                  value={formularioUsuario.nome}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, nome: evento.target.value })}
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={formularioUsuario.email}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, email: evento.target.value })}
                />
              </label>
              <label>
                Login (planilha)
                <input
                  value={formularioUsuario.login}
                  disabled={formularioUsuario.loginOriginal !== null}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, login: evento.target.value })}
                />
                {formularioUsuario.loginOriginal !== null && (
                  <small>O login não pode ser alterado depois do cadastro.</small>
                )}
              </label>
              <label>
                Cargo
                <input
                  value={formularioUsuario.cargo}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, cargo: evento.target.value })}
                />
              </label>
              <label>
                Equipe
                <input value={usuarioEfetivo?.equipeId ?? ''} disabled />
              </label>
              <label>
                Nível hierárquico
                <input
                  type="number"
                  min={1}
                  value={formularioUsuario.nivelHierarquico}
                  onChange={(evento) => setFormularioUsuario({
                    ...formularioUsuario,
                    nivelHierarquico: Number(evento.target.value),
                  })}
                />
              </label>
              <label>
                Turno padrão
                <select
                  value={formularioUsuario.turnoPadrao}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, turnoPadrao: evento.target.value })}
                >
                  {Object.values(catalogo).map((tipo) => (
                    <option key={tipo.codigo} value={tipo.codigo}>{tipo.descricao}</option>
                  ))}
                </select>
              </label>
              <label className="user-form-active">
                <input
                  type="checkbox"
                  checked={formularioUsuario.ativo}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, ativo: evento.target.checked })}
                />
                <span>Ativo</span>
              </label>
              <label className="user-form-full">
                Aliases da planilha
                <div className="alias-editor">
                  <div className="alias-editor-list">
                    {formularioUsuario.aliasesPlanilha.length === 0 && (
                      <small className="empty-inline">Nenhum alias cadastrado.</small>
                    )}
                    {formularioUsuario.aliasesPlanilha.map((alias) => (
                      <span className="alias-chip" key={alias}>
                        {alias}
                        <button type="button" onClick={() => removerAliasDraft(alias)} aria-label={`Remover alias ${alias}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="alias-editor-add">
                    <input
                      value={novoAliasDraft}
                      onChange={(evento) => setNovoAliasDraft(evento.target.value)}
                      onKeyDown={(evento) => {
                        if (evento.key === 'Enter') {
                          evento.preventDefault();
                          adicionarAliasDraft();
                        }
                      }}
                      placeholder="Nome como aparece na planilha"
                    />
                    <button className="secondary-button compact-button" type="button" onClick={adicionarAliasDraft}>
                      Adicionar
                    </button>
                  </div>
                </div>
              </label>
              {souAdmin && (
                <fieldset className="user-form-full admin-only-fields">
                  <legend>Administração (perfil/escopo/organização)</legend>
                  <label>
                    Perfil
                    <select
                      value={formularioUsuario.perfil ?? ''}
                      onChange={(evento) => setFormularioUsuario({
                        ...formularioUsuario,
                        perfil: (evento.target.value || undefined) as FormularioUsuario['perfil'],
                      })}
                    >
                      <option value="">(padrão pelo nível hierárquico)</option>
                      {PERFIS_ADMINISTRAVEIS.map((perfil) => (
                        <option key={perfil} value={perfil}>{perfil}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Escopo
                    <select
                      value={formularioUsuario.escopo ?? ''}
                      onChange={(evento) => setFormularioUsuario({
                        ...formularioUsuario,
                        escopo: (evento.target.value || undefined) as FormularioUsuario['escopo'],
                      })}
                    >
                      <option value="">(padrão EQUIPE)</option>
                      <option value="GLOBAL">GLOBAL</option>
                      <option value="EQUIPE">EQUIPE</option>
                      <option value="UNIDADE">UNIDADE</option>
                    </select>
                  </label>
                  <label>
                    Unidade organizacional
                    <select
                      value={formularioUsuario.unidadeId ?? ''}
                      onChange={(evento) => setFormularioUsuario({
                        ...formularioUsuario,
                        unidadeId: evento.target.value || undefined,
                      })}
                    >
                      <option value="">(nenhuma)</option>
                      {unidadesEmArvoreParaSelect.map((no) => (
                        <option key={no.unidade.unidadeId} value={no.unidade.unidadeId}>
                          {'  '.repeat(no.profundidade)}{rotuloOpcaoUnidade(no.unidade, unidadesAdmin)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="user-form-full">
                    <legend>Unidades permitidas (GESTOR_UNIDADE)</legend>
                    {unidadesAdmin.length === 0 && (
                      <small className="empty-inline">Abra a tela Administração nesta sessão para carregar a lista de unidades.</small>
                    )}
                    {unidadesAdmin.map((unidade) => (
                      <label key={unidade.unidadeId} className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={formularioUsuario.unidadesPermitidas.includes(unidade.unidadeId)}
                          onChange={() => alternarNaListaFormularioUsuario('unidadesPermitidas', unidade.unidadeId)}
                        />
                        {unidade.nome}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="user-form-full">
                    <legend>Equipes permitidas</legend>
                    {equipesAdmin.length === 0 && (
                      <small className="empty-inline">Abra a tela Administração nesta sessão para carregar a lista de equipes.</small>
                    )}
                    {equipesAdmin.map((equipe) => (
                      <label key={equipe.id} className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={formularioUsuario.equipesPermitidas.includes(equipe.id)}
                          onChange={() => alternarNaListaFormularioUsuario('equipesPermitidas', equipe.id)}
                        />
                        {equipe.nome}
                      </label>
                    ))}
                  </fieldset>
                </fieldset>
              )}
            </div>
            {errosFormularioUsuario.length > 0 && (
              <div className="alert error">
                <ul>
                  {errosFormularioUsuario.map((erro) => <li key={erro}>{erro}</li>)}
                </ul>
              </div>
            )}
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={fecharFormularioUsuario}>Cancelar</button>
              <button className="primary-button" type="button" onClick={() => void salvarFormularioUsuario()}>
                <Save size={16} /> {formularioUsuario.loginOriginal === null ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </section>
        </div>
      )}

      {colaboradorLembretes && modalAtribuirLembrete === null && (
        <ModalLembretesAtribuidos
          colaborador={colaboradorLembretes}
          itens={lembretesAtribuidosColaborador}
          carregando={carregandoLembretesAtribuidos}
          erro={erroLembretesAtribuidos}
          filtro={filtroLembretesAtribuidos}
          onMudarFiltro={setFiltroLembretesAtribuidos}
          onNovoLembrete={() => setModalAtribuirLembrete({ modo: 'criar' })}
          onEditar={(lembrete) => setModalAtribuirLembrete({ modo: 'editar', lembrete })}
          onPedirCancelamento={setLembreteParaCancelar}
          onFechar={fecharLembretesAtribuidos}
        />
      )}

      {colaboradorLembretes && modalAtribuirLembrete !== null && (
        <ModalAtribuirLembrete
          colaborador={colaboradorLembretes}
          modo={modalAtribuirLembrete.modo}
          lembreteEmEdicao={modalAtribuirLembrete.modo === 'editar' ? modalAtribuirLembrete.lembrete : undefined}
          dataHoje={dataIsoLocal(new Date())}
          onFechar={() => setModalAtribuirLembrete(null)}
          onSalvarUnico={salvarLembreteAtribuidoUnico}
          onSalvarSerie={salvarLembreteAtribuidoSerie}
        />
      )}

      {lembreteParaCancelar && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setLembreteParaCancelar(null)}>
          <section
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancelar-lembrete-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Cancelar lembrete</p>
                <h2 id="cancelar-lembrete-title">{lembreteParaCancelar.titulo}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setLembreteParaCancelar(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <p>
              O lembrete será marcado como cancelado e sai da lista de ativos do
              colaborador. Ele continua visível aqui no histórico — cancelar não
              exclui o registro.
            </p>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setLembreteParaCancelar(null)} disabled={processandoCancelamentoLembrete}>
                Voltar
              </button>
              <button
                className="primary-button danger-button"
                type="button"
                disabled={processandoCancelamentoLembrete}
                onClick={() => void confirmarCancelamentoLembreteAtribuido()}
              >
                <Ban size={16} /> {processandoCancelamentoLembrete ? 'Cancelando…' : 'Cancelar lembrete'}
              </button>
            </div>
          </section>
        </div>
      )}

    </AppFrame>
  );
}
