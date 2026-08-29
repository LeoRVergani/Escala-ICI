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
  type FuncaoPlantao,
  type GrupoPlantao,
  type OrigemPlantao,
  type PadraoHorarioPlantaoDia,
  type ParticipantePlantao,
  type ResultadoParse,
  type ResultadoParsePlantao,
  temErroBloqueante,
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
  listarUsuariosDoPlantao,
  listarUsuariosElegiveisPlantao,
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
  listarAtribuicoesPlantaoPublicada,
  listarAtribuicoesPlantaoRascunho,
  listarCompetenciasPlantaoRascunho,
  listarGruposPlantaoPermitidos,
  listarGruposPlantaoPorUnidadeResponsavel,
  listarParticipantesPlantao,
  listarTodosGruposPlantao,
  obterCompetenciaPlantaoAtual,
  obterCompetenciaPlantaoPublicada,
  obterCompetenciaPlantaoRascunho,
  obterGrupoPlantao,
} from '@/lib/firebase/plantaoReadRepository';
import {
  atualizarEquipeConsultaPlantao,
  cancelarCompetenciaPlantaoPublicada,
  desativarParticipantePlantao,
  excluirGrupoPlantao,
  salvarAtribuicoesPlantaoRascunho,
  salvarCompetenciaPlantaoRascunho,
  salvarGrupoPlantao,
  salvarParticipantePlantao,
  publicarCompetenciaPlantao,
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
import {
  avaliarSaudePlantao,
  filtrarAtribuicoesPlantaoPorFuncao,
  ROTULO_FUNCAO_PLANTAO,
  validarFuncoesContraGrupo,
  type FiltroFuncaoPlantao,
} from '@/lib/plantaoMultiposto';
import { PlantaoCalendario } from '@/components/plantao/PlantaoCalendario';
import { CardFuncaoPlantao } from '@/components/plantao/CardFuncaoPlantao';
import { RevisarPublicacaoPlantaoModal } from '@/components/plantao/RevisarPublicacaoPlantaoModal';
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
import {
  cadastroUsuarioConcedeGestao,
  exclusaoZeraGestores,
  perfilDelegavelPorResponsavelOperacional,
  podeExcluirCompetencia,
  podeExcluirUsuario,
} from '@/lib/adminGuards';
import { areaNavegacaoDaTela } from '@/lib/navegacaoDashboard';
import { competenciaOperacionalAtual } from '@/lib/competenciaOperacionalAtual';
import {
  contextoEhJornada,
  contextoEhPlantao,
  contextosEscalaIguais,
  criarContextoEscala,
  limparContextoEscalaPersistido,
  restaurarContextoEscalaPersistido,
  salvarContextoEscalaPersistido,
  type ContextoEscalaAtivo,
} from '@/lib/contextoEscala';
import { ScheduleContextSwitcher, type OpcaoContextoEscala } from '@/components/escalas/ScheduleContextSwitcher';
import { ScheduleCompetenceControl } from '@/components/escalas/ScheduleCompetenceControl';
import { ScheduleStatusBadge, type StatusContextoEscala } from '@/components/escalas/ScheduleStatusBadge';
import { UnsavedChangesDialog } from '@/components/escalas/UnsavedChangesDialog';
import { ScheduleStartWizard, type ScheduleStartWizardProps } from '@/components/escalas/ScheduleStartWizard';
import { ResponsaveisEscalaTable } from '@/components/admin/ResponsaveisEscalaTable';
import { ResponsavelEscalaModal } from '@/components/admin/ResponsavelEscalaModal';
import { CancelarPublicacaoPlantaoModal } from '@/components/admin/CancelarPublicacaoPlantaoModal';
import { AtribuirCoordenadorModal } from '@/components/admin/AtribuirCoordenadorModal';
import {
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
  codigoOrganizacionalEquipe,
  construirArvoreOrganizacional,
  construirArvoreUnidades,
  descreverClassificacaoHierarquica,
  descreverNivelHierarquico,
  ehUsuarioTecnicoOuFake,
  equipesDaUnidade,
  formariaCiclo,
  gestoresParaSimulacao,
  type NoArvoreOrganizacional,
  raizesComEquipesSemUnidade,
  rotuloGestorParaSimulacao,
  rotuloOpcaoUnidade,
  rotuloTecnicoEquipe,
  rotuloTecnicoUnidade,
  trechoFinalCaminho,
} from '@/lib/organizacao';
import { GrupoPlantaoVisibilidadeModal } from '@/components/organizacao/GrupoPlantaoVisibilidadeModal';
import { OrganizationBreadcrumb } from '@/components/organizacao/OrganizationBreadcrumb';
import { OrganizationTeamPicker } from '@/components/organizacao/OrganizationTeamPicker';
import { OrganizationTree } from '@/components/organizacao/OrganizationTree';
import { formatarDataHoraSafe } from '@/lib/dataSegura';
import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';
import { normalizarNome } from '@/lib/nomes';
import {
  FILTRO_SETOR_TODOS,
  opcoesFiltroSetorUsuariosPlantao,
  usuarioCorrespondeBuscaTextual,
  usuarioPertenceAoFiltroSetorPlantao,
} from '@/lib/usuariosTelaFiltros';
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
  criarGradeInicialEquipe,
  criarMembroGrade,
  membroJaNaGrade,
  removerMembroGrade,
  usuariosElegiveisParaAdicionarNaGrade,
} from '@/lib/gradeMembros';
import { mapaLogins, normalizarAliasesPlanilha, novoUsuario, validarEdicaoUsuario } from '@/lib/importUsers';
import {
  avisoCargoDivergenteDaEquipe,
  montarCamposAcessoUsuario,
  resumoAcessoUsuario,
  tipoAcessoDoUsuario,
  validarCoerenciaAcessoUsuario,
  type TipoAcessoUsuario,
} from '@/lib/perfilAcessoUsuario';
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
  dentroDoEscopoPermitido,
  plantoesMonitoradosPelaEquipe,
  resolverEscoposOperacionais,
  type EscoposOperacionais,
} from '@/lib/escoposOperacionais';
import {
  classeSaudeOperacaoDashboard,
  derivarStatusOperacaoDashboard,
  documentosParaAlertasJornada,
  resolverOperacoesDashboard,
  rotuloStatusOperacaoDashboard,
  type OperacaoDashboard,
  type StatusOperacaoDashboard,
} from '@/lib/operacoesDashboard';
import { possuiOperacaoAdministravelHub } from '@/lib/hubEscalas';
import { HubEscalasOperacoes } from '@/components/escalas/HubEscalasOperacoes';
import {
  usuarioPodeAdministrarAlvoOperacional,
  usuarioPodeConsultarPlantaoOperacional,
} from '@/lib/escoposOperacionaisMatriz';
import {
  carregarOperacoesComEstado,
  executarComLimiteDeTempo,
  estadoErroOperacoes,
  type EstadoCarregamentoOperacoes,
} from '@/lib/carregamentoOperacoes';
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

/**
 * PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — telas cujo conteúdo é o
 * editor/rascunho/importação do contexto de escala ATIVO ('grade' mostra a
 * grade de Jornada, 'importar' o preview de Plantão, 'escalas' o hub que as
 * duas usam como pouso seguro quando o estado fica inválido). Só ESSAS
 * telas podem ser trocadas automaticamente por `aplicarTrocaContexto()` —
 * qualquer outra tela (Visão geral, Usuários, Trocas, Administração,
 * Responsáveis por escala, Plantões) é navegação principal e nunca deve
 * ser abandonada só porque o seletor de contexto mudou.
 */
const TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA: ReadonlySet<Tela> = new Set(['escalas', 'grade', 'importar']);
type OpcoesInicioImportacao = {
  tipoEsperado?: 'ESCALA_6X1' | 'PLANTAO';
  equipeId?: string;
  grupoId?: string;
  competencia?: string;
  aoFalhar?: (mensagem: string) => void;
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
 * Mensagem específica para ações de gestor em trocas: desde a Matriz
 * Operacional (ESCOPO-OPERACIONAL-MATRIZ-2), aprovar/recusar/publicar não
 * depende mais de "ser gestor da equipe" — depende de ser responsável
 * operacional ativo da Jornada na Matriz de Responsáveis (ou, no fallback
 * legado, gestor da equipe enquanto não existir matriz para o alvo). O texto
 * antigo ("verifique se é gestor da equipe") ficou enganoso para quem
 * administra a Jornada só pela Matriz. Para qualquer outro tipo de erro, cai
 * no mapeamento genérico (já cobre "Firestore shutting down" etc.).
 */
function mensagemErroTrocaGestor(falha: unknown, fallback: string): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String((falha as { code?: unknown }).code)
    : '';
  if (codigo.includes('permission-denied')) {
    return 'Você não é responsável por esta Jornada na Matriz de Responsáveis.';
  }
  return mensagemErroFirebase(falha, fallback, ambienteFirebaseAtual);
}

function mensagemErroEscritaOperacional(
  falha: unknown,
  fallback: string,
  matrizReconheceUsuario = true,
): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String((falha as { code?: unknown }).code)
    : '';
  if (codigo.includes('permission-denied')) {
    return matrizReconheceUsuario
      ? 'As regras de escrita ainda não reconhecem a matriz operacional neste ambiente.'
      : 'Você não está configurado como responsável por esta escala.';
  }
  return mensagemErroFirebase(falha, fallback, ambienteFirebaseAtual);
}

/**
 * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — diagnóstico de uma falha de escrita
 * operacional, só para console e só fora de produção; nunca loga login,
 * e-mail ou nome — só os identificadores organizacionais/perfil já usados
 * para decidir autorização. Existe para que uma mensagem de erro genérica
 * na tela ("As regras de escrita ainda não reconhecem...") não vire uma
 * caixa-preta: o console mostra qual operação, em qual caminho, para qual
 * grupoId/unidadeId/equipeId/perfil/escopo, e o código de erro real do
 * Firestore por trás — sem isso, a causa raiz desta fase (um `getDoc()`
 * em documento inexistente estourando o limite de expressões da regra,
 * ver `firestore.rules` e `docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md`) levou
 * bem mais tempo para ser encontrada do que deveria.
 */
function diagnosticarFalhaEscritaPlantao(parametros: {
  operacao: string;
  caminho: string;
  grupoId: string;
  unidadeId: string | undefined;
  equipeId: string | undefined;
  perfil: string | undefined;
  escopo: string | undefined;
  falha: unknown;
}) {
  if (ambienteFirebaseAtual === 'producao') {
    return;
  }
  const codigo = typeof parametros.falha === 'object' && parametros.falha !== null && 'code' in parametros.falha
    ? String((parametros.falha as { code?: unknown }).code)
    : 'desconhecido';
  console.warn('[plantao-publicacao] falha de escrita', {
    operacao: parametros.operacao,
    caminho: parametros.caminho,
    grupoId: parametros.grupoId,
    unidadeId: parametros.unidadeId ?? null,
    equipeId: parametros.equipeId ?? null,
    perfil: parametros.perfil ?? null,
    escopo: parametros.escopo ?? null,
    motivo: codigo,
  });
}

const MENSAGEM_RULES_LEITURA_OPERACIONAL =
  'Não foi possível carregar os dados desta operação. As Firestore Rules de staging ainda não reconhecem a Matriz de Responsáveis.';
const MENSAGEM_RULES_LEITURA_PARCIAL =
  'Alguns dados auxiliares não puderam ser carregados porque as Firestore Rules de staging ainda não reconhecem a Matriz de Responsáveis. Os dados disponíveis foram preservados.';

function falhaEhPermissionDenied(falha: unknown): boolean {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String(falha.code).toLowerCase()
    : '';
  const mensagemFalha = falha instanceof Error ? falha.message.toLowerCase() : String(falha ?? '').toLowerCase();
  return codigo.includes('permission-denied') || mensagemFalha.includes('permission_denied');
}

function valorLeitura<T>(resultado: PromiseSettledResult<T>, fallback: T): T {
  return resultado.status === 'fulfilled' ? resultado.value : fallback;
}

function motivoLeituraRecusada(resultados: readonly PromiseSettledResult<unknown>[]): unknown | null {
  return resultados.find((resultado) => resultado.status === 'rejected')?.reason ?? null;
}

function mensagemFalhaLeituraParcial(falha: unknown): string {
  return falhaEhPermissionDenied(falha)
    ? MENSAGEM_RULES_LEITURA_PARCIAL
    : estadoErroOperacoes(falha).mensagem;
}

function formatarHorasDescanso(horas: number): string {
  const inteiras = Math.floor(horas);
  const minutos = Math.round((horas - inteiras) * 60);
  return minutos === 0 ? `${inteiras}h` : `${inteiras}h${String(minutos).padStart(2, '0')}`;
}

type EstadoPublicacaoVisual = 'completo' | 'parcial' | 'vazio';
/**
 * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — alias local só para não repetir o
 * import em todo call site; o TIPO e a DERIVAÇÃO de status são únicos e
 * vivem em `lib/operacoesDashboard.ts` (`StatusOperacaoDashboard`/
 * `derivarStatusOperacaoDashboard`). Nenhuma tela deste arquivo volta a
 * calcular status por conta própria.
 */
type EstadoEscalaOperacionalDashboard = StatusOperacaoDashboard;

interface ResumoPublicacao {
  estado: EstadoPublicacaoVisual;
  titulo: string;
  descricao: string;
}

interface ResumoJornadaDashboard {
  equipeId: string;
  competencia: string;
  documentos: TurnosMes[];
  rascunhos: TurnosMes[];
  publicadas: TurnosMes[];
  colaboradoresAtivos: number;
  periodoInicio: string;
  periodoFim: string;
}

interface ResumoPlantaoDashboard {
  grupoId: string;
  competencia: string;
  competenciaRascunho: CompetenciaPlantao | null;
  competenciaPublicada: CompetenciaPlantao | null;
  participantesAtivos: number;
}

/** Converte o resumo local (working copy quando em contexto, ou snapshot persistido) para o formato genérico que `derivarStatusOperacaoDashboard` espera. */
function statusJornadaResumo(resumo: ResumoJornadaDashboard | null): { temRascunho: boolean; temPublicada: boolean } {
  return {
    temRascunho: (resumo?.rascunhos.length ?? 0) > 0,
    temPublicada: (resumo?.publicadas.length ?? 0) > 0,
  };
}

function statusPlantaoResumo(resumo: ResumoPlantaoDashboard | null): { temRascunho: boolean; temPublicada: boolean } {
  return {
    temRascunho: resumo?.competenciaRascunho != null,
    // `competenciaPublicada` agora pode carregar uma competência CANCELADA
    // (ver `obterCompetenciaPlantaoAtual()`) — só status 'PUBLICADA' conta
    // como publicação vigente para o indicador de status operacional.
    temPublicada: resumo?.competenciaPublicada?.status === 'PUBLICADA',
  };
}

function estadoJornadaDashboard(resumo: ResumoJornadaDashboard | null): EstadoEscalaOperacionalDashboard {
  const { temRascunho, temPublicada } = statusJornadaResumo(resumo);
  return derivarStatusOperacaoDashboard(temRascunho, temPublicada);
}

function estadoPlantaoDashboard(resumo: ResumoPlantaoDashboard | null): EstadoEscalaOperacionalDashboard {
  const { temRascunho, temPublicada } = statusPlantaoResumo(resumo);
  return derivarStatusOperacaoDashboard(temRascunho, temPublicada);
}

const classeSaudeOperacional = classeSaudeOperacaoDashboard;
const rotuloEstadoEscalaOperacional = rotuloStatusOperacaoDashboard;

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — extraída de
 * `resumoPublicacaoJornada` (que já tratava os 4 estados corretamente)
 * para virar a única fonte de "texto de publicação" tanto de Jornada
 * quanto de Plantão — "SOC e Plantão devem seguir a mesma lógica de
 * status agregada". Recebe o status já resolvido por
 * `derivarStatusOperacaoDashboard`, nunca recalcula nada por conta
 * própria.
 */
function resumoPublicacaoOperacao(estado: EstadoEscalaOperacionalDashboard): ResumoPublicacao {
  if (estado === 'sem-escala') {
    return {
      estado: 'vazio',
      titulo: 'Nenhuma escala criada',
      descricao: 'Não há rascunho nem publicação para esta competência.',
    };
  }
  if (estado === 'rascunho') {
    return {
      estado: 'parcial',
      titulo: 'Rascunho não publicado',
      descricao: 'Existe rascunho para a competência, mas ele ainda não foi publicado.',
    };
  }
  if (estado === 'publicada-com-rascunho-pendente') {
    return {
      estado: 'parcial',
      titulo: 'Publicada, com rascunho pendente',
      descricao: 'Já existe uma publicação disponível, mas um rascunho mais recente ainda não foi publicado.',
    };
  }
  return {
    estado: 'completo',
    titulo: 'Publicada',
    descricao: 'A escala publicada está disponível para os colaboradores.',
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

  /** Campos globais continuam exclusivos do admin; perfil de equipe pode ser delegado pelo responsável do alvo. */
  perfil?: Usuario['perfil'];
  escopo?: Usuario['escopo'];
  unidadeId?: string;
  unidadesPermitidas: string[];
  equipesPermitidas: string[];

  /**
   * STAGING-RESET-HIERARQUIA-ICI-2 — equipe escolhida livremente pelo
   * coordenador durante o cadastro, quando `PERMITIR_AMPLO_STAGING` está
   * ligado. Fora desse caso (produção, ou fluxo de vínculo de planilha),
   * a equipe do cadastro continua vindo de `equipeIdCadastroUsuario`
   * (contexto fixo), nunca deste campo.
   */
  equipeId?: string;

  /**
   * PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — só UI, nunca persistido:
   * decide qual bloco simples aparece em "Permissões" (`souAdmin`) e
   * recalcula `perfil`/`escopo`/`equipeId`/`equipesPermitidas`/`unidadeId`/
   * `unidadesPermitidas`/`nivelHierarquico` via `montarCamposAcessoUsuario()`
   * a cada mudança. A área "Avançado" continua editando os mesmos campos
   * técnicos diretamente — as duas UIs nunca divergem porque são o mesmo
   * estado.
   */
  tipoAcesso: TipoAcessoUsuario;
  /** Confirmação exigida só para Administrador do sistema — nunca persistida. */
  confirmaAcessoGlobal: boolean;
}

const TIPOS_UNIDADE_ORGANIZACIONAL: TipoUnidadeOrganizacional[] = [
  'PRESIDENCIA',
  'DIRETORIA',
  'ASSESSORIA',
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

const PERFIS_DELEGAVEIS_POR_RESPONSAVEL: NonNullable<Usuario['perfil']>[] = [
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
];

/** STAGING-RESET-HIERARQUIA-ICI-2 — em staging, GESTOR_UNIDADE também é delegável (ver `perfilDelegavelPorResponsavelOperacional`). */
const PERFIS_DELEGAVEIS_STAGING: NonNullable<Usuario['perfil']>[] = [
  'GESTOR_UNIDADE',
  'GESTOR_EQUIPE',
  'SUPERVISOR_EQUIPE',
];

const LABEL_PERFIL_DELEGAVEL: Record<string, string> = {
  GESTOR_UNIDADE: 'Gestor de unidade',
  GESTOR_EQUIPE: 'Coordenador da equipe',
  SUPERVISOR_EQUIPE: 'Supervisor da equipe',
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

/** Compatibilidade opt-in: sem esta variável a matriz é a única fonte operacional. */
const PERMITIR_FALLBACK_OPERACIONAL_LEGADO =
  import.meta.env.VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO === 'true';

/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — opt-in separado de
 * `PERMITIR_FALLBACK_OPERACIONAL_LEGADO`: liga a liberação ampla de
 * coordenador/supervisor mesmo quando a Matriz já cobre o alvo (e não lista
 * o usuário) — só `true` em `.env.staging.dashboard`, sempre `false` no
 * build padrão/produção. Ver `lib/escoposOperacionais.ts` (opção
 * `permitirAmploStaging`) e `souCoordenadorOperacionalStaging()` em
 * `firestore.rules` (a autorização real de escrita).
 */
const PERMITIR_AMPLO_STAGING =
  import.meta.env.VITE_ESCALA_STAGING_PERMISSAO_AMPLA === 'true';

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
              placeholder="Ex.: UNIDADE_OPERACIONAL"
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
              placeholder="Ex.: UOP"
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
  const codigoOrganizacional = codigoOrganizacionalEquipe({
    ...form,
    caminhoUnidade: unidadeSelecionada?.caminho,
  }, unidadesExistentes);

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
            ID técnico da equipe
            <input
              id="equipe-modal-id"
              autoFocus
              placeholder="Ex.: EQ_OPERACAO"
              value={form.id}
              disabled={modo === 'editar'}
              onChange={(evento) => setForm((atual) => ({ ...atual, id: evento.target.value }))}
            />
            <small>
              {modo === 'editar'
                ? 'O ID não pode ser alterado — é a chave usada pela escala e pelo histórico.'
                : 'Chave interna estável. A hierarquia é apresentada separadamente no código organizacional.'}
            </small>
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
              placeholder="Ex.: OPERACAO"
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
          <div className="admin-form-preview admin-form-full team-code-preview">
            <span>Código organizacional</span>
            <strong><code>{codigoOrganizacional || 'Defina a unidade e a sigla'}</code></strong>
            <small>Calculado pela posição atual da equipe; não altera vínculos nem documentos de escala.</small>
          </div>
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
          {form.nome.trim() !== '' && gruposExistentes.some((item) => item.grupoId !== form.grupoId && normalizarNome(item.nome) === normalizarNome(form.nome)) && (
            <p className="admin-form-full hint-text warning-text">
              Já existe outro Plantão com esse nome. Confira se não é duplicidade antes de salvar.
            </p>
          )}
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
            <p className="admin-form-preview">
              Para liberar consulta da sua própria equipe a um Plantão de outra área, use o botão &ldquo;Configurar plantões visíveis&rdquo; na página da sua equipe, em Administração &gt; Organização.
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
  podeAprovarNoEscopo,
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
  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — calculado por quem
   * chama, a partir de `escoposOperacionais.jornadasAdministraveis`: se
   * `false`, os botões Aprovar/Recusar nem aparecem, em vez de deixar a
   * escrita ser recusada pela Rule (mesmo padrão de Grupos de Plantão).
   */
  podeAprovarNoEscopo: boolean;
  onMudarMotivoRecusa: (valor: string) => void;
  onFechar: () => void;
  onRecusar: () => void;
  onAprovarEPublicar: () => void;
}) {
  const podeDecidir = troca.status === 'PENDENTE_GESTOR' && podeAprovarNoEscopo;

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

        {troca.status === 'PENDENTE_GESTOR' && !podeAprovarNoEscopo && (
          <p className="hint-text">Esta troca é de uma equipe que você não administra.</p>
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
type AbaPreviaPlantao = 'calendario' | 'contabilidade' | 'vinculos';

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
  validada: boolean;
  onCriarUsuarioParaVinculo: (participanteNomeOriginal: string) => void;
  /**
   * Fase ESCALAS-UX-1A — o Editor visual. `atribuicoesEditaveis` é a
   * WORKING COPY (nunca `resultado.atribuicoes`, que fica congelado para a
   * "Conferência da fonte"); o calendário e a "Conferência da escala
   * editada" derivam dela, nunca do XLS declarado.
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
   * FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1 — postos do Grupo em contexto
   * (`GrupoPlantao.funcoesEsperadas`). Vazio/ausente = Grupo de posto
   * único (ex.: Plantão COSI): nenhuma tab/card de função aparece, e todo
   * o restante deste componente se comporta EXATAMENTE como antes desta
   * fase (`funcaoSelecionada` nunca deixa de ser `'TODOS'` nesse caso).
   */
  funcoesEsperadas: readonly FuncaoPlantao[];
  /** Seleção PURAMENTE visual (nunca grava Firebase, nunca reprocessa importação — §11 da fase). */
  funcaoSelecionada: FiltroFuncaoPlantao;
  onMudarFuncaoSelecionada: (funcao: FiltroFuncaoPlantao) => void;
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
 * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — chave de preferência PURAMENTE
 * visual (qual layout do calendário de Plantão mostrar). Nunca é fonte da
 * escala: se ausente/corrompida, cai no mesmo padrão automático que já
 * existia antes deste patch (`resultado !== null` → compacta).
 */
const CHAVE_MODO_VISUALIZACAO_PLANTAO = 'escalaIci.plantao.viewMode';

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
  validada,
  onCriarUsuarioParaVinculo,
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
  funcoesEsperadas,
  funcaoSelecionada,
  onMudarFuncaoSelecionada,
  somenteConsulta = false,
}: PreviewPlantaoProps) {
  const vinculoPorParticipante = new Map(vinculos.map((vinculo) => [vinculo.participanteNomeOriginal, vinculo]));
  const nomesPendentesPlantao = new Set(
    vinculos.filter((vinculo) => vinculo.status !== 'VINCULADO').map((vinculo) => normalizarNome(vinculo.participanteNomeOriginal)),
  );
  /**
   * FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1 — `atribuicoesFiltradas` é a ÚNICA
   * fonte que o calendário/roster/resumo abaixo enxergam a partir daqui
   * (§14 da fase: "calendário deve receber dados já filtrados"). Para um
   * Grupo de posto único (`funcoesEsperadas` vazio), `funcaoSelecionada`
   * nunca deixa de ser `'TODOS'` (nenhuma tab aparece — ver mais abaixo),
   * então este filtro é sempre a identidade e nada muda de comportamento
   * em relação a antes desta fase.
   */
  const ehMultiposto = funcoesEsperadas.length > 0;
  const atribuicoesFiltradas = filtrarAtribuicoesPlantaoPorFuncao(atribuicoesEditaveis, funcaoSelecionada);
  const conferenciaEscalaAtual = conferirEscalaAtualPlantao(atribuicoesFiltradas, duracaoPlantaoAtipica);
  const resumoPorPessoa = resumirPorPessoa(
    atribuicoesFiltradas,
    participantes.map((participante) => ({ nomeOriginal: participante.nomeOriginal })),
  );
  /**
   * Painel de saúde por posto (§16/§51 da fase) — só calculado para Grupos
   * multi-função; `SEMPRE` a partir de `atribuicoesEditaveis` COMPLETA
   * (nunca da filtrada), porque cada card precisa da saúde do PRÓPRIO
   * posto, não do posto atualmente selecionado.
   */
  const saudeMultiposto = ehMultiposto
    ? avaliarSaudePlantao({
      grupo: { funcoesEsperadas },
      atribuicoes: atribuicoesEditaveis,
      vinculos,
      erros: resultado?.erros ?? [],
      avisos: resultado?.avisos ?? [],
    })
    : null;
  /**
   * Fase 27 — `conferenciaEscalaAtual.sobreposicoes`, quando calculada
   * sobre a lista JÁ FILTRADA por uma função específica, nunca mistura
   * postos diferentes (todo item do array já é do mesmo posto) — correta
   * por construção, sem filtro adicional. Só o caso `'TODOS'` de um Grupo
   * multi-função precisa do filtro de relevância (`conflitosRelevantesPlantao`,
   * dentro de `avaliarSaudePlantao()`), porque aí SIM há postos diferentes
   * misturados no mesmo array.
   */
  const conflitosEfetivos = ehMultiposto && funcaoSelecionada === 'TODOS'
    ? (saudeMultiposto?.todos.conflitos ?? 0)
    : conferenciaEscalaAtual.sobreposicoes.length;
  const pendenciasEfetivas = ehMultiposto && funcaoSelecionada !== 'TODOS'
    ? (saudeMultiposto?.porFuncao[funcaoSelecionada]?.vinculosPendentes ?? 0)
    : pendencias;
  const totalAlertasEditor = conferenciaEscalaAtual.quantidadeDuracoesAtipicas
    + conflitosEfetivos
    + pendenciasEfetivas;
  const primeiraAtipica = atribuicoesFiltradas.find((atribuicao) => duracaoPlantaoAtipica(atribuicao.duracaoMinutos));

  /**
   * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — antes o calendário escolhia
   * `modo="importacao"` (compacta, com legenda, sem roster) ou
   * `modo="editor"` (roster + arrastar-e-soltar) automaticamente a partir
   * de `resultado !== null` — dava a impressão de duas telas diferentes
   * para a mesma escala ao reabrir um rascunho (§ Parte C do pedido). Isso
   * vira um seletor explícito do usuário; o padrão inicial (antes de
   * qualquer escolha salva) preserva exatamente o comportamento antigo,
   * então nada muda até o usuário tocar no seletor. Nunca é lido/escrito
   * como fonte da escala — só decide apresentação (`modo` do calendário e
   * se o roster aparece), nunca `atribuicoesEditaveis`/vínculos/dados.
   */
  const [modoVisualizacaoPlantao, setModoVisualizacaoPlantao] = useState<'compacta' | 'edicao'>(() => {
    try {
      const salvo = typeof window !== 'undefined' ? window.localStorage.getItem(CHAVE_MODO_VISUALIZACAO_PLANTAO) : null;
      if (salvo === 'compacta' || salvo === 'edicao') return salvo;
    } catch {
      // localStorage indisponível (ex.: modo privado) — usa o padrão automático abaixo.
    }
    return resultado !== null ? 'compacta' : 'edicao';
  });

  function selecionarModoVisualizacaoPlantao(modo: 'compacta' | 'edicao') {
    setModoVisualizacaoPlantao(modo);
    try {
      window.localStorage.setItem(CHAVE_MODO_VISUALIZACAO_PLANTAO, modo);
    } catch {
      // localStorage indisponível — a preferência dura só a sessão em memória.
    }
  }

  /**
   * FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (§15-18 da fase) — aba
   * Vínculos passa a priorizar quem tem atribuição na função selecionada,
   * sem perder o contexto ("Mostrar todos os vínculos" sempre disponível).
   * Reseta ao trocar de função — nunca herda "mostrar todos" de uma função
   * para outra.
   */
  const [mostrarTodosVinculosPlantao, setMostrarTodosVinculosPlantao] = useState(false);
  /**
   * Reset "durante o render" (padrão recomendado pelo React para resetar
   * estado quando um valor muda, em vez de `useEffect` — evita o
   * cascading-render que a regra `react-hooks/set-state-in-effect` aponta).
   */
  const [funcaoAnteriorParaResetVinculos, setFuncaoAnteriorParaResetVinculos] = useState(funcaoSelecionada);
  if (funcaoAnteriorParaResetVinculos !== funcaoSelecionada) {
    setFuncaoAnteriorParaResetVinculos(funcaoSelecionada);
    setMostrarTodosVinculosPlantao(false);
  }
  const nomesNaFuncaoSelecionada = new Set(atribuicoesFiltradas.map((item) => normalizarNome(item.plantonistaNomeOriginal)));
  const participantesExibidosVinculos = (funcaoSelecionada === 'TODOS' || mostrarTodosVinculosPlantao)
    ? participantes
    : participantes.filter((participante) => nomesNaFuncaoSelecionada.has(normalizarNome(participante.nomeOriginal)));

  return (
    <div className="plantao-preview-fluxo">
      <article className="panel plantao-resumo-panel plantao-preview-fonte">
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
      </article>

      {conferencia !== null && conferencia.divergencias.length > 0 && (
        conferencia.divergencias.some((divergencia) => divergencia.divergente) ? (
          <article className="panel warning-panel plantao-preview-divergencias">
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
          <article className="panel plantao-preview-divergencias">
            <div className="panel-title"><div><h2>Conferência consistente</h2></div></div>
            <p className="plantao-validado-nota">
              <ShieldCheck size={15} /> As camadas de contabilidade da fonte coincidem entre si.
            </p>
          </article>
        )
      )}

      {ehMultiposto && (
        <article className="panel plantao-preview-multiposto">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Postos deste Plantão</p>
              <h2>Todos os postos, ou um de cada vez</h2>
            </div>
          </div>
          <div className="segmented-control" aria-label="Filtro por posto do Plantão">
            <button
              type="button"
              className={funcaoSelecionada === 'TODOS' ? 'active' : ''}
              aria-pressed={funcaoSelecionada === 'TODOS'}
              onClick={() => onMudarFuncaoSelecionada('TODOS')}
            >
              Todos
            </button>
            {funcoesEsperadas.map((funcao) => (
              <button
                key={funcao}
                type="button"
                className={funcaoSelecionada === funcao ? 'active' : ''}
                aria-pressed={funcaoSelecionada === funcao}
                onClick={() => onMudarFuncaoSelecionada(funcao)}
              >
                {ROTULO_FUNCAO_PLANTAO[funcao]}
              </button>
            ))}
          </div>
          {funcaoSelecionada === 'TODOS' && saudeMultiposto !== null && (
            <div className="import-summary plantao-resumo-grid">
              <div><span>Pessoas únicas</span><strong>{saudeMultiposto.todos.pessoasUnicas}</strong></div>
              <div><span>Atribuições</span><strong>{saudeMultiposto.todos.atribuicoes}</strong></div>
              <div><span>Conflitos</span><strong>{saudeMultiposto.todos.conflitos}</strong></div>
            </div>
          )}
          {saudeMultiposto !== null && (
            <div className="plantao-cards-funcao">
              {funcoesEsperadas.map((funcao) => {
                const saudeFuncao = saudeMultiposto.porFuncao[funcao];
                if (saudeFuncao === undefined) {
                  return null;
                }
                return (
                  <CardFuncaoPlantao
                    key={funcao}
                    rotulo={ROTULO_FUNCAO_PLANTAO[funcao]}
                    saude={saudeFuncao}
                    selecionado={funcaoSelecionada === funcao}
                    onSelecionar={() => {
                      onMudarFuncaoSelecionada(funcao);
                      onMudarAba('calendario');
                    }}
                    onResolverVinculos={() => {
                      onMudarFuncaoSelecionada(funcao);
                      onMudarAba('vinculos');
                    }}
                  />
                );
              })}
            </div>
          )}
        </article>
      )}

      <article className="panel plantao-preview-principal">
        <div className="plantao-preview-toolbar">
          <div className="segmented-control" aria-label="Seções da prévia de Plantão">
          <button type="button" className={aba === 'calendario' ? 'active' : ''} aria-pressed={aba === 'calendario'} onClick={() => onMudarAba('calendario')}>Calendário</button>
          <button type="button" className={aba === 'contabilidade' ? 'active' : ''} aria-pressed={aba === 'contabilidade'} onClick={() => onMudarAba('contabilidade')}>Contabilidade</button>
          <button type="button" className={aba === 'vinculos' ? 'active' : ''} aria-pressed={aba === 'vinculos'} onClick={() => onMudarAba('vinculos')}>
            Vínculos{pendencias > 0 ? ` (${pendencias})` : ''}
          </button>
          </div>
          <div className="plantao-preview-validacao">
            <span className={`status-badge ${pendencias === 0 ? 'success' : 'warning'}`}>
              {pendencias === 0 ? 'Vínculos prontos' : `${pendencias} vínculo(s) pendente(s)`}
            </span>
          </div>
        </div>
        {validada && (
          <p className="plantao-validado-nota">
            <ShieldCheck size={15} /> Prévia validada. Nenhum dado de Plantão foi publicado.
          </p>
        )}

        {aba === 'calendario' && (
          <div className="plantao-editor-calendario">
            <div className="import-summary plantao-resumo-grid">
              <div><span>Plantonistas</span><strong>{conferenciaEscalaAtual.quantidadePessoas}</strong></div>
              <div><span>Plantões</span><strong>{atribuicoesFiltradas.length}</strong></div>
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
                {conflitosEfetivos > 0 && (
                  <li>⚠ {conflitosEfetivos} sobreposição(ões) de horário</li>
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
             * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — seletor de visualização:
             * muda só apresentação/interação (via `modoVisualizacaoPlantao`),
             * nunca a escala em si. Some quando `somenteConsulta`, porque aí
             * o calendário já é forçado para `modo="consulta"` de qualquer
             * forma (permissão real, nunca preferência cosmética) e o roster
             * de arrastar-e-soltar não se aplica.
             */}
            {!somenteConsulta && (
              <div className="segmented-control plantao-seletor-visualizacao" aria-label="Visualização do calendário de Plantão">
                <button
                  type="button"
                  className={modoVisualizacaoPlantao === 'compacta' ? 'active' : ''}
                  aria-pressed={modoVisualizacaoPlantao === 'compacta'}
                  onClick={() => selecionarModoVisualizacaoPlantao('compacta')}
                  title="Foco em leitura e conferência, com legenda lateral — sem arrastar-e-soltar"
                >
                  Compacta
                </button>
                <button
                  type="button"
                  className={modoVisualizacaoPlantao === 'edicao' ? 'active' : ''}
                  aria-pressed={modoVisualizacaoPlantao === 'edicao'}
                  onClick={() => selecionarModoVisualizacaoPlantao('edicao')}
                  title="Foco em ajuste manual, com roster lateral e arrastar-e-soltar"
                >
                  Edição (arrastar)
                </button>
              </div>
            )}
            {/*
             * Fase ESCALAS-UX-2B — roster lateral substitui o antigo bloco
             * "Resumo por pessoa" abaixo do calendário (§7 do pedido): a
             * mesma informação (`resumoPorPessoa`, nenhum recálculo) agora
             * vive ao lado, sempre visível, sem duplicar a lista embaixo.
             */}
            <div className={`plantao-editor-layout${modoVisualizacaoPlantao === 'compacta' ? ' plantao-editor-layout-importacao' : ''}`}>
              {modoVisualizacaoPlantao === 'edicao' && (
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
                    atribuicoes={atribuicoesFiltradas}
                    onEditarAtribuicao={onEditarAtribuicao}
                    plantonistaSelecionado={plantonistaSelecionado}
                    modo={somenteConsulta ? 'consulta' : (modoVisualizacaoPlantao === 'compacta' ? 'importacao' : 'editor')}
                    onSolicitarNovaAtribuicao={onSolicitarNovaAtribuicao}
                  />
                ) : (
                  <p>Não foi possível calcular a competência desta planilha — confira a competência e as datas da fonte.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {aba === 'contabilidade' && (
          <>
            <div className="plantao-conferencia-escala-atual">
              <h3>Escala atual (working copy editada)</h3>
              <p>Recalculada a partir do que está no calendário agora — nunca comparada automaticamente com a fonte.</p>
              <div className="import-summary plantao-resumo-grid">
                <div><span>Plantonistas</span><strong>{conferenciaEscalaAtual.quantidadePessoas}</strong></div>
                <div><span>Plantões</span><strong>{atribuicoesFiltradas.length}</strong></div>
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
          <>
            {ehMultiposto && (
              <div className="plantao-vinculos-contexto-funcao">
                <span>
                  {funcaoSelecionada === 'TODOS'
                    ? `Vínculos — Todos (${participantesExibidosVinculos.length} participante(s))`
                    : `Vínculos — ${ROTULO_FUNCAO_PLANTAO[funcaoSelecionada]} (${participantesExibidosVinculos.length} participante(s))`}
                </span>
                {funcaoSelecionada !== 'TODOS' && !mostrarTodosVinculosPlantao && (
                  <button type="button" className="link-button" onClick={() => setMostrarTodosVinculosPlantao(true)}>
                    Mostrar todos os vínculos
                  </button>
                )}
                {funcaoSelecionada !== 'TODOS' && mostrarTodosVinculosPlantao && (
                  <button type="button" className="link-button" onClick={() => setMostrarTodosVinculosPlantao(false)}>
                    Voltar para {ROTULO_FUNCAO_PLANTAO[funcaoSelecionada]}
                  </button>
                )}
              </div>
            )}
          <div className="table-scroll">
            <table className="data-table conciliation-table">
              <thead>
                <tr><th>Participante</th><th>Encontrado na planilha</th><th>Vincular a</th><th>Status</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {participantesExibidosVinculos.map((participante) => {
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
                                    {/*
                                      PATCH-PLANTAO-VINCULO-GESTOR-COMO-PARTICIPANTE-1 —
                                      perfil administrativo não é escondido nem impede o
                                      vínculo; só fica visível para o coordenador confirmar
                                      que está escolhendo a pessoa certa (ex.: um Gestor de
                                      unidade cobrindo o próprio plantão).
                                    */}
                                    {candidato.perfil && (
                                      <small className="plantao-busca-perfil">
                                        Perfil: {LABEL_PERFIL_DELEGAVEL[candidato.perfil] ?? candidato.perfil}
                                        {candidato.unidadeId ? ` · Unidade: ${candidato.unidadeId}` : ''}
                                      </small>
                                    )}
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
                              <button type="button" className="secondary-button compact-button" onClick={() => onCriarUsuarioParaVinculo(participante.nomeOriginal)}>
                                <UserPlus size={14} /> Criar e vincular
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
          </>
        )}
      </article>
    </div>
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
  /**
   * HOTFIX-COMPETENCIA-OPERACIONAL-DINAMICA-1 — substitui a antiga
   * constante congelada `COMPETENCIA_ATUAL` ('lib/sessao.ts'). Calculada
   * uma vez no mount via `competenciaOperacionalAtual()` (nunca no momento
   * do build/import — precisa refletir o dia real do usuário). É o default
   * operacional para contextos/wizards/exclusão administrativa; nunca é
   * sobrescrita por navegação manual do usuário para um mês histórico
   * durante a sessão (ver § 13 do hotfix) — só um reload/login reavalia.
   */
  const [competenciaOperacionalHoje] = useState(() => competenciaOperacionalAtual());
  const [modoDemo, setModoDemo] = useState(true);
  // PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — tela inicial padrão é "Visão
  // geral" (nunca "Escalas"), quando não há estado salvo intencionalmente
  // para restaurar. O único código que navega para 'escalas' automaticamente
  // depois disso é a restauração explícita de `contextoEscalaAtivo`
  // persistido (ver `restaurarContextoEscalaPersistido`) — nunca um valor
  // "congelado" no primeiro carregamento.
  const [tela, setTela] = useState<Tela>('visao');
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [catalogo, setCatalogo] = useState(CATALOGO_SOC);
  const [resultado, setResultado] = useState<ResultadoParse | null>(null);
  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — `true` só quando há
   * erro BLOQUEANTE de verdade (nunca por causa de um ALERTA, que permite
   * salvar rascunho e só exige justificativa para publicar). Substitui
   * `!resultado?.ok` em todo gate de "Salvar rascunho"/"Publicar".
   */
  const resultadoTemBloqueio = resultado === null || temErroBloqueante(resultado.erros);
  const resultadoTemAlertaSemBloqueio = resultado !== null && !resultadoTemBloqueio && resultado.erros.length > 0;
  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — "Ajustar"
   * (`ScheduleImportReview`) leva até a linha exata na tabela "Corrigir
   * inconsistências", mesmo para um erro estrutural sem célula física
   * específica (todo erro tem uma linha nesta tabela, por índice).
   */
  const correcaoLinhaRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const [indiceErroDestacado, setIndiceErroDestacado] = useState<number | null>(null);
  function focarErroNaTabela(indice: number) {
    setIndiceErroDestacado(indice);
    correcaoLinhaRefs.current[indice]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const [arquivo, setArquivo] = useState<ArrayBuffer | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('Escala-Controle.xls');
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [correcoes, setCorrecoes] = useState<Record<number, string>>({});
  const [filtroTurno, setFiltroTurno] = useState('TODOS');
  const [buscaUsuario, setBuscaUsuario] = useState('');
  /**
   * PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — só relevante quando o
   * contexto ativo é um Grupo de Plantão (o pool amplo mistura plantonistas
   * com equipes que só consultam). Resetado para "Todos" a cada troca de
   * contexto em `aplicarTrocaContexto()` — nunca herda um id de equipe que
   * pode nem existir no novo Grupo.
   */
  const [filtroSetorUsuario, setFiltroSetorUsuario] = useState<string>(FILTRO_SETOR_TODOS);
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
  const [abaPreviaPlantao, setAbaPreviaPlantao] = useState<AbaPreviaPlantao>('calendario');
  const [buscaVinculoPlantao, setBuscaVinculoPlantao] = useState<Record<string, string>>({});
  /**
   * Fase ESCALAS-UX-1A — a WORKING COPY editável do Editor visual.
   * `resultadoPlantao.atribuicoes` continua congelado (fonte da
   * "Conferência da fonte"); esta é a ÚNICA fonte de verdade que o
   * calendário, a conferência e o payload de `salvarRascunhoPlantaoAcao()`
   * consultam depois da importação —
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
   * FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1 — seleção da tab Todos/DBA/Linux/
   * Telecom/Windows. PURAMENTE visual (§11/§12 da fase): nunca grava
   * Firebase, nunca reprocessa a importação, nunca altera `funcao` de
   * nenhuma atribuição. Reiniciada em toda entrada nova no Editor, mesmo
   * princípio de `plantonistaSelecionadoPlantao` acima — nunca "vaza" a
   * função selecionada de uma prévia para a próxima.
   */
  const [funcaoSelecionadaPlantao, setFuncaoSelecionadaPlantao] = useState<FiltroFuncaoPlantao>('TODOS');
  /** FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (§21 da fase) — modal "Revisar publicação", só para Grupo multi-função. */
  const [revisarPublicacaoPlantaoAberta, setRevisarPublicacaoPlantaoAberta] = useState(false);
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
  const [avisoContextoEscala, setAvisoContextoEscala] = useState('');
  const [estadoCarregamentoOperacoes, setEstadoCarregamentoOperacoes] =
    useState<EstadoCarregamentoOperacoes>({ fase: 'carregando' });
  const [tentativaCarregamentoOperacoes, setTentativaCarregamentoOperacoes] = useState(0);
  const usuarioContextoRestauradoRef = useRef<string | null>(null);
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
  const [wizardCompetencia, setWizardCompetencia] = useState(competenciaOperacionalHoje);
  const [wizardArquivoNome, setWizardArquivoNome] = useState('');
  const [wizardErro, setWizardErro] = useState('');
  const [wizardProcessando, setWizardProcessando] = useState(false);
  // --- Administração de Plantão (Fase PLANTÃO-3B) — Grupos/participantes/contatos/rascunho ---
  const [gruposPlantaoAdmin, setGruposPlantaoAdmin] = useState<GrupoPlantao[]>([]);
  const [participantesPorGrupoPlantao, setParticipantesPorGrupoPlantao] = useState<Record<string, ParticipantePlantao[]>>({});
  const [grupoPlantaoExpandido, setGrupoPlantaoExpandido] = useState<string | null>(null);
  const [erroPlantaoAdmin, setErroPlantaoAdmin] = useState('');
  /** FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — busca por nome/sigla na listagem de Grupos de Plantão (Administração). */
  const [filtroGrupoPlantaoLista, setFiltroGrupoPlantaoLista] = useState('');
  /** FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — equipeId cujo modal "Plantões visíveis" está aberto (`null` = fechado). */
  const [modalVisibilidadePlantaoEquipeId, setModalVisibilidadePlantaoEquipeId] = useState<string | null>(null);
  const [salvandoVisibilidadePlantao, setSalvandoVisibilidadePlantao] = useState(false);
  const [erroVisibilidadePlantao, setErroVisibilidadePlantao] = useState<string | null>(null);
  // --- Reabrir rascunho (Fase ESCALAS-UX-1B.1) ---
  const [rascunhosPlantaoPorGrupo, setRascunhosPlantaoPorGrupo] = useState<Record<string, CompetenciaPlantao[]>>({});
  const [resumosJornadaDashboard, setResumosJornadaDashboard] = useState<Record<string, ResumoJornadaDashboard>>({});
  const [resumosPlantaoDashboard, setResumosPlantaoDashboard] = useState<Record<string, ResumoPlantaoDashboard>>({});
  const [erroResumoJornadaDashboard, setErroResumoJornadaDashboard] = useState('');
  const [erroResumoPlantaoDashboard, setErroResumoPlantaoDashboard] = useState('');
  const erroResumoOperacionalDashboard = erroResumoJornadaDashboard || erroResumoPlantaoDashboard;
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
  const [grupoPlantaoParaExcluir, setGrupoPlantaoParaExcluir] = useState<GrupoPlantao | null>(null);
  const [excluindoGrupoPlantao, setExcluindoGrupoPlantao] = useState(false);
  const [erroExclusaoGrupoPlantao, setErroExclusaoGrupoPlantao] = useState('');
  /**
   * FASE-ESCOPO-HIERARQUICO-CODB-E-ADMIN-PLANTAO-1 — cancelamento de
   * publicação (PUBLICADA -> CANCELADA), nunca exclusão física. Mesmo
   * padrão de estado de `grupoPlantaoParaExcluir` acima.
   */
  const [publicacaoPlantaoParaCancelar, setPublicacaoPlantaoParaCancelar] = useState<
    { grupo: GrupoPlantao; competencia: CompetenciaPlantao } | null
  >(null);
  const [cancelandoPublicacaoPlantao, setCancelandoPublicacaoPlantao] = useState(false);
  const [erroCancelamentoPublicacaoPlantao, setErroCancelamentoPublicacaoPlantao] = useState('');
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
  const [publicandoPlantao, setPublicandoPlantao] = useState(false);
  const [erroRascunhoPlantao, setErroRascunhoPlantao] = useState('');
  const [rascunhoPlantaoSalvoEm, setRascunhoPlantaoSalvoEm] = useState<string | null>(null);
  const [formularioUsuario, setFormularioUsuario] = useState<FormularioUsuario | null>(null);
  const [participanteVinculoCadastro, setParticipanteVinculoCadastro] = useState<string | null>(null);
  // JORNADA-IMPORTACAO-VINCULOS-UX-1 — mesmo papel de `participanteVinculoCadastro`,
  // mas para "Criar usuário" a partir de uma pendência de conciliação da
  // planilha de Jornada (não de um participante de Grupo de Plantão).
  const [linhaConciliacaoVinculoCadastro, setLinhaConciliacaoVinculoCadastro] = useState<LinhaConciliacao | null>(null);
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
  /**
   * FASE-ESCOPO-HIERARQUICO-CODB-E-ADMIN-PLANTAO-1 — "Atribuir coordenador
   * de unidade", entrada simples e separada da Matriz de Responsáveis
   * (`modalResponsavelEscala` acima, que continua existindo para exceções
   * específicas por escala).
   */
  const [modalAtribuirCoordenador, setModalAtribuirCoordenador] = useState(false);
  const [processandoAtribuicaoCoordenador, setProcessandoAtribuicaoCoordenador] = useState(false);
  const [erroAtribuicaoCoordenador, setErroAtribuicaoCoordenador] = useState('');
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
  const [competenciaExportar, setCompetenciaExportar] = useState(competenciaOperacionalHoje);
  const [excluirEscalaPendente, setExcluirEscalaPendente] = useState(false);
  const [processandoEscalaAdmin, setProcessandoEscalaAdmin] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const escritaBloqueada = !modoDemo && !escritaAdministrativaHabilitada;
  const conciliacaoBloqueiaPublicacao = publicacaoBloqueadaPorConciliacao(linhasConciliacao);
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
   * FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 — lookup único do Grupo em
   * contexto no rascunho, reaproveitado por `PreviewPlantao`, pelo Modal de
   * atribuição e pelo gate de publicação abaixo (nunca um segundo find()
   * divergente).
   */
  const grupoRascunhoPlantaoEmContexto = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
  const funcoesEsperadasRascunhoPlantao = grupoRascunhoPlantaoEmContexto?.funcoesEsperadas ?? [];
  /**
   * §21/§25/§26 da fase — `avaliarSaudePlantao()` é a ÚNICA fonte do gate
   * de publicação para Grupo multi-função; `null` para posto único
   * (`funcoesEsperadasRascunhoPlantao` vazio), então `rascunhoPlantaoProntoParaPublicar`
   * abaixo continua exatamente como antes desta fase nesse caso — zero
   * regressão para Plantão COSI (§36 da fase).
   */
  const saudePlantaoRascunho = funcoesEsperadasRascunhoPlantao.length > 0
    ? avaliarSaudePlantao({
      grupo: { funcoesEsperadas: funcoesEsperadasRascunhoPlantao },
      atribuicoes: atribuicoesEditaveisPlantao,
      vinculos: vinculosPlantao,
      erros: resultadoPlantao?.erros ?? [],
      avisos: resultadoPlantao?.avisos ?? [],
    })
    : null;
  const rascunhoPlantaoProntoParaPublicar = rascunhoPlantaoSalvoEm === grupoRascunhoEscolhido
    && !plantaoPossuiAlteracoesNaoSalvas;
  /**
   * §25/§26 da fase — fonte NORMATIVA do gate de saúde: `null` (posto
   * único) nunca bloqueia, exatamente como antes desta fase. Nunca usar
   * `alertas.length > 0` aqui — um ALERTA (`status: 'ATENCAO'`) não é
   * bloqueante; só `podePublicar === false` (equivalente a algum posto em
   * `status: 'CRITICO'`) bloqueia de verdade.
   */
  const podePublicarPlantaoPelaSaude = saudePlantaoRascunho === null || saudePlantaoRascunho.podePublicar;
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
  const escoposOperacionais = useMemo(() => usuarioReal !== null
    ? resolverEscoposOperacionais(
      usuarioReal,
      unidadesAdmin,
      equipesAdmin,
      gruposPlantaoAdmin,
      escoposOperacionaisAdmin,
      {
        permitirFallbackLegado: PERMITIR_FALLBACK_OPERACIONAL_LEGADO,
        permitirAmploStaging: PERMITIR_AMPLO_STAGING,
      },
    )
    : ESCOPOS_OPERACIONAIS_VAZIOS,
  [equipesAdmin, escoposOperacionaisAdmin, gruposPlantaoAdmin, unidadesAdmin, usuarioReal]);
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
  const equipesDaSessao = usuarioReal === null ? [] : equipesPermitidasEfetivas(usuarioReal);
  const possuiEscopoPlantaoNaMatriz = usuarioReal !== null && escoposOperacionaisAdmin.some((escopo) =>
    escopo.ativo
    && escopo.tipo === 'PLANTAO'
    && (
      escopo.responsaveisLogin.includes(usuarioReal.login)
      || escopo.responsaveisEquipe.some((equipeId) => equipesDaSessao.includes(equipeId))
      || escopo.equipesConsulta.some((equipeId) => equipesDaSessao.includes(equipeId))
    ));
  const podeAcessarPlantoes = usuarioReal !== null
    && (souGestorDePlantao(usuarioReal) || possuiEscopoPlantaoNaMatriz);
  const carregandoEquipesPlantaoParaExibir = carregandoEquipesPlantao && podeAcessarPlantoes && !modoDemo;
  const minhasEquipesPermitidas = escoposOperacionais.equipesAdministraveis.map((item) => item.id);
  const minhasEquipesDeJornadaPermitidas = escoposOperacionais.jornadasAdministraveis.map((item) => item.id);
  const grupoCadastroVinculo = participanteVinculoCadastro === null
    ? undefined
    : gruposPlantaoAdmin.find((grupo) => grupo.grupoId === grupoRascunhoEscolhido);
  /**
   * STAGING-RESET-HIERARQUIA-ICI-2 — em staging (`PERMITIR_AMPLO_STAGING`),
   * o cadastro GERAL (não o de vínculo de planilha, que já tem um alvo bem
   * definido pelo Grupo) deixa de travar automaticamente na equipe do
   * responsável: o coordenador escolhe livremente qualquer unidade/equipe
   * ativa (`formularioUsuario.unidadeId`/`formularioUsuario.equipeId`) — ver
   * `souCoordenadorOperacionalStaging()` em `firestore.rules`, que autoriza
   * essa escrita sem checar se o autor administra o alvo escolhido.
   */
  /**
   * PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — "Criar usuário" a partir
   * de uma pendência de conciliação de Jornada agora usa o MESMO modo livre
   * do cadastro amplo (select técnico de unidade/equipe) quando
   * `PERMITIR_AMPLO_STAGING` está ligado — só o vínculo de planilha do
   * Plantão (`participanteVinculoCadastro`, alvo fixo pelo Grupo) continua
   * de fora. `abrirCadastroUsuarioParaConciliacao()` pré-seleciona a
   * unidade/equipe da escala em importação nesse select; fora do modo
   * amplo, cai no ramo de baixo (equipe fixa, exibida com o código técnico).
   */
  // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — GESTOR_UNIDADE nunca
  // usa mais este modo de escape (era o único jeito de cadastrar/promover
  // gente na própria unidade antes desta fase, sem suporte real de Rules).
  // Agora tem um caminho permanente, não-staging, via o mesmo bloco
  // "Permissões" do admin (`souGestorUnidade` abaixo, ver JSX) — mantendo os
  // dois ativos ao mesmo tempo duplicaria a UI de seleção de perfil no
  // mesmo formulário. GESTOR_EQUIPE/SUPERVISOR_EQUIPE sem contexto
  // operacional continuam usando este modo normalmente.
  const usarCadastroLivreStaging = PERMITIR_AMPLO_STAGING
    && !souAdmin
    && !souGestorUnidade
    && participanteVinculoCadastro === null;
  const equipeIdCadastroUsuario = usarCadastroLivreStaging
    ? formularioUsuario?.equipeId?.trim() ?? ''
    : linhaConciliacaoVinculoCadastro !== null
      ? (contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : usuarioEfetivo?.equipeId ?? '')
      : participanteVinculoCadastro === null
        ? usuarioEfetivo?.equipeId ?? ''
        : grupoCadastroVinculo?.equipeResponsavelId ?? '';
  const rotuloEquipeCadastroUsuario = (() => {
    const equipe = equipesAdmin.find((item) => item.id === equipeIdCadastroUsuario);
    return equipe ? rotuloTecnicoEquipe(equipe) : equipeIdCadastroUsuario;
  })();
  const contextoCadastroOperacionalUsuario = usuarioReal === null || souAdmin || usarCadastroLivreStaging
    ? undefined
    : grupoCadastroVinculo !== undefined
      && escoposOperacionais.plantoesAdministraveis.some((grupo) => grupo.grupoId === grupoCadastroVinculo.grupoId)
      ? {
        tipo: 'PLANTAO' as const,
        alvoId: grupoCadastroVinculo.grupoId,
        criadoPorLogin: usuarioReal.login,
      }
      : escoposOperacionais.jornadasAdministraveis.some((equipe) => equipe.id === equipeIdCadastroUsuario)
        ? {
          tipo: 'JORNADA' as const,
          alvoId: equipeIdCadastroUsuario,
          criadoPorLogin: usuarioReal.login,
        }
        : (() => {
          const grupo = escoposOperacionais.plantoesAdministraveis
            .find((item) => item.equipeResponsavelId === equipeIdCadastroUsuario);
          return grupo === undefined
            ? undefined
            : {
              tipo: 'PLANTAO' as const,
              alvoId: grupo.grupoId,
              criadoPorLogin: usuarioReal.login,
            };
        })();
  // JORNADA-IMPORTACAO-VINCULOS-UX-1 — equipe/competência da Jornada em
  // importação agora, para anotar auditoria de ações de conciliação
  // (associar, adicionar alias, ignorar pendência).
  const equipeIdImportacaoJornadaAtual = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.alvoId
    : usuarioEfetivo?.equipeId ?? '';
  const competenciaImportacaoJornadaAtual = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.competencia
    : null;
  /**
   * Fase CORRECAO-WIZARD-PLANTAO-EQUIPE-1 — a equipe da Jornada ATIVA
   * agora (se houver) nunca deve ser oferecida/escolhida silenciosamente
   * como "equipe responsável" de um Plantão novo no Wizard — ver
   * `equipesCandidatasParaPlantao()` (`lib/inicioEscala.ts`).
   */
  const equipeJornadaReferenciaId = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.alvoId
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

  /**
   * PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — a tela Usuários já lista o
   * pool amplo do contexto (`usuarios`, alimentado por
   * `aplicarTrocaContexto()`); estes derivados só CLASSIFICAM esse mesmo
   * pool para o filtro de setor/equipe, sem nenhuma consulta nova. `undefined`
   * quando o contexto ativo não é um Grupo de Plantão — nesse caso a tela
   * de Usuários continua exatamente como antes (sem seletor de setor).
   */
  const grupoPlantaoParaFiltroUsuarios = contextoEhPlantao(contextoEscalaAtivo)
    ? gruposPlantaoAdmin.find((item) => item.grupoId === contextoEscalaAtivo.alvoId)
    : undefined;
  const nomePorEquipeIdParaFiltroUsuarios = new Map(equipesAdmin.map((item) => [item.id, item.nome]));
  const nomePorUnidadeIdParaFiltroUsuarios = new Map(unidadesAdmin.map((item) => [item.unidadeId, item.nome]));
  const loginsParticipantesAtivosDoGrupoAtivo = new Set(
    (participantesPorGrupoPlantao[grupoPlantaoParaFiltroUsuarios?.grupoId ?? ''] ?? [])
      .filter((item) => item.ativo)
      .map((item) => item.login),
  );
  const opcoesFiltroSetorUsuarios = grupoPlantaoParaFiltroUsuarios !== undefined
    ? opcoesFiltroSetorUsuariosPlantao(grupoPlantaoParaFiltroUsuarios, nomePorEquipeIdParaFiltroUsuarios, nomePorUnidadeIdParaFiltroUsuarios)
    : [];
  const usuariosAposFiltroSetor = grupoPlantaoParaFiltroUsuarios !== undefined
    ? usuarios.filter((item) => usuarioPertenceAoFiltroSetorPlantao(item, filtroSetorUsuario, grupoPlantaoParaFiltroUsuarios, loginsParticipantesAtivosDoGrupoAtivo))
    : usuarios;
  const usuariosFiltrados = usuariosAposFiltroSetor.filter((item) => usuarioCorrespondeBuscaTextual(item, buscaUsuario));

  const documentos = useMemo(
    () => resultado?.documentos ?? [],
    [resultado?.documentos],
  );
  const equipeIdDaGradeAtiva = contextoEhJornada(contextoEscalaAtivo)
    ? contextoEscalaAtivo.alvoId
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
  /**
   * Resumo operacional da Visão geral — identidade sempre vem do alvo
   * concedido pela matriz operacional: Jornada usa `Equipe.id`/`equipeId`;
   * Plantão usa `GrupoPlantao.grupoId`. O estado do editor aberto
   * (`resultado`) só complementa o resumo quando é exatamente o mesmo alvo,
   * nunca como fallback para a equipe do usuário logado.
   */
  const competenciaDashboard = contextoEscalaAtivo?.competencia ?? competenciaOperacionalHoje;
  const equipeJornadaOperacionalDashboard = contextoEhJornada(contextoEscalaAtivo)
    ? escoposOperacionais.jornadasAdministraveis.find((equipe) => equipe.id === contextoEscalaAtivo.alvoId)
    : undefined;
  const equipeJornadaDashboard = equipeJornadaOperacionalDashboard
    ?? escoposOperacionais.jornadasAdministraveis[0]
    ?? null;
  const equipeJornadaDashboardId = equipeJornadaDashboard?.id ?? null;
  const resumoJornadaPersistidoDashboard = equipeJornadaDashboardId === null
    ? null
    : resumosJornadaDashboard[`${equipeJornadaDashboardId}:${competenciaDashboard}`] ?? null;
  const jornadaEmContextoDashboard = equipeJornadaDashboardId !== null
    && contextoEhJornada(contextoEscalaAtivo)
    && contextoEscalaAtivo.alvoId === equipeJornadaDashboardId;
  const resumoJornadaDashboard: ResumoJornadaDashboard | null = jornadaEmContextoDashboard && resultado !== null
    ? {
      equipeId: equipeJornadaDashboardId,
      competencia: competenciaDashboard,
      documentos,
      rascunhos: documentos.filter((documento) => documento.status !== 'PUBLICADA'),
      publicadas: publicados,
      colaboradoresAtivos: usuarios.filter((usuario) => usuario.ativo && usuario.equipeId === equipeJornadaDashboardId).length,
      periodoInicio: resultado.periodoInicio,
      periodoFim: resultado.periodoFim,
    }
    : resumoJornadaPersistidoDashboard;
  const estadoJornadaOperacionalDashboard = estadoJornadaDashboard(resumoJornadaDashboard);
  const nomeJornadaDashboard = equipeJornadaDashboard?.nome ?? 'Nenhuma Jornada configurada para este usuário.';
  const grupoPlantaoDashboard = gruposPlantaoAdmin.find((grupo) =>
    contextoEhPlantao(contextoEscalaAtivo) && grupo.grupoId === contextoEscalaAtivo.alvoId,
  ) ?? escoposOperacionais.plantoesAdministraveis[0] ?? null;
  const rascunhosPlantaoDashboard = grupoPlantaoDashboard === null
    ? []
    : (rascunhosPlantaoPorGrupo[grupoPlantaoDashboard.grupoId] ?? []);
  const competenciaPlantaoDashboard = rascunhosPlantaoDashboard.find((item) => item.competencia === competenciaDashboard)
    ?? rascunhosPlantaoDashboard.slice().sort((a, b) => b.competencia.localeCompare(a.competencia))[0]
    ?? null;
  const resumoPlantaoPersistidoDashboard = grupoPlantaoDashboard === null
    ? null
    : resumosPlantaoDashboard[`${grupoPlantaoDashboard.grupoId}:${competenciaDashboard}`] ?? null;
  const plantaoEmContextoDashboard = grupoPlantaoDashboard !== null
    && contextoEhPlantao(contextoEscalaAtivo)
    && contextoEscalaAtivo.alvoId === grupoPlantaoDashboard.grupoId;
  const resumoPlantaoDashboard: ResumoPlantaoDashboard | null = plantaoEmContextoDashboard
    ? {
      grupoId: grupoPlantaoDashboard.grupoId,
      competencia: competenciaDashboard,
      competenciaRascunho: competenciaPlantaoDashboard,
      competenciaPublicada: resumoPlantaoPersistidoDashboard?.competenciaPublicada ?? null,
      participantesAtivos: participantesPlantao.length,
    }
    : resumoPlantaoPersistidoDashboard;
  const estadoPlantaoOperacionalDashboard = estadoPlantaoDashboard(resumoPlantaoDashboard);
  const competenciaPlantaoExibidaDashboard = resumoPlantaoDashboard?.competenciaRascunho
    ?? resumoPlantaoDashboard?.competenciaPublicada
    ?? null;
  const participantesPlantaoDashboard = resumoPlantaoDashboard?.participantesAtivos ?? 0;
  const plantaoPossuiEscalaDashboard = estadoPlantaoOperacionalDashboard !== 'sem-escala'
    || (plantaoEmContextoDashboard && atribuicoesEditaveisPlantao.length > 0);
  /**
   * Fase DASH-SIMPLES-1A (revisão pré-commit) — mesma classe de bug do
   * HOTFIX-PLANTAO-PUBLICADO-APP-E-VISAO-GERAL-1 abaixo, só que para
   * Plantão: `erros`/`avisos`/`pendenciasVinculoPlantao` só existem no
   * resultado do editor ao vivo (`resultadoPlantao`), calculado a partir de
   * atribuições completas — ao contrário de Jornada, não existe hoje um
   * snapshot persistido com atribuições suficiente para recalcular esses
   * alertas fora de contexto sem duplicar o pipeline de validação do editor
   * (fora de escopo desta fase). Diferente de Jornada, aqui o dado
   * realmente NÃO está disponível fora do editor — então `null` (não "0")
   * é o valor honesto: `estadoPlantaoOperacionalDashboard === 'sem-escala'`
   * é a única situação em que "zero alertas" é uma verdade conhecida (não
   * há nada para gerar alerta). Qualquer consumidor de
   * `plantaoAlertasDashboard` precisa tratar `null` como "não avaliado",
   * nunca como zero.
   */
  const plantaoAlertasDashboard: number | null = plantaoEmContextoDashboard && resultadoPlantao !== null
    ? resultadoPlantao.erros.length + resultadoPlantao.avisos.length + pendenciasVinculoPlantao
    : (estadoPlantaoOperacionalDashboard === 'sem-escala' ? 0 : null);
  /**
   * HOTFIX-PLANTAO-PUBLICADO-APP-E-VISAO-GERAL-1 — a Visão Geral é
   * integrada: o indicador de alertas de uma operação NUNCA pode depender
   * de qual operação está selecionada no seletor do header. Antes,
   * `jornadaEmContextoDashboard ? alertasVisiveis.length : 0` zerava SOC
   * assim que Plantão virava o contexto ativo (`alertasVisiveis` só é
   * calculado a partir do editor único e compartilhado, `resultado`/
   * `documentos`). `resumoJornadaDashboard` já resolve corretamente entre
   * o editor ao vivo (em contexto) e o snapshot persistido (fora de
   * contexto) — ver linhas acima —, então recalcular os alertas a partir
   * DELE (em vez de reusar `alertasVisiveis`, que só existe para o
   * contexto ativo) mantém o mesmo resultado quando em contexto e passa a
   * mostrar o valor real, nunca zerado, quando não está.
   */
  const alertasJornadaCalculados = useMemo(() => {
    if (jornadaEmContextoDashboard) {
      return alertasVisiveis;
    }
    const documentosParaAlertas = documentosParaAlertasJornada(false, [], resumoJornadaDashboard?.documentos);
    if (documentosParaAlertas.length === 0) {
      return [];
    }
    const publicadasParaAlertas = resumoJornadaDashboard?.publicadas ?? [];
    const alertasOperacionaisFora = gerarAlertasEscala([...documentosParaAlertas], catalogo);
    return montarAlertasVisiveis(alertasOperacionaisFora, usuarios, [...documentosParaAlertas], publicadasParaAlertas);
  }, [resumoJornadaDashboard, jornadaEmContextoDashboard, alertasVisiveis, catalogo, usuarios]);
  const alertasJornadaDashboard = alertasJornadaCalculados.length;
  /**
   * `classeSaudeOperacaoDashboard` só aceita `number` (`alertas > 0`
   * coagiria `null` para `false`, voltando a fingir "estável" quando o dado
   * é desconhecido — o mesmo erro, um nível abaixo). Quando
   * `plantaoAlertasDashboard` é `null`, a cor de severidade do card fica
   * neutra (nunca verde/âmbar sem ter checado) — o rótulo de status
   * (Rascunho/Publicada) continua exato, só a contagem de alertas é
   * desconhecida.
   */
  const plantaoStatusDashboard: 'stable' | 'attention' | 'empty' | 'desconhecido' = plantaoAlertasDashboard === null
    ? 'desconhecido'
    : classeSaudeOperacional(estadoPlantaoOperacionalDashboard, plantaoAlertasDashboard);
  const socStatusDashboard = classeSaudeOperacional(estadoJornadaOperacionalDashboard, alertasJornadaDashboard);
  const colaboradoresJornadaDashboard = resumoJornadaDashboard?.colaboradoresAtivos ?? 0;
  /**
   * Pendências conhecidas — nunca soma `null` como zero (isso reintroduziria
   * o mesmo zero falso um nível acima, no painel "Pendências"). Quando
   * `plantaoAlertasDashboard` é `null`, o total deixa de ser confiável;
   * `pendenciasConhecidas` só é usado para decidir o estado "tudo limpo",
   * nunca como número exibido — `pendenciasDashboard` (com o Plantão
   * conhecido tratado como 0 só para fins de soma) seria enganoso ali.
   */
  const pendenciasDashboard = alertasJornadaDashboard + (plantaoAlertasDashboard ?? 0) + trocasPendentesGestor.length;
  /** `plantaoAlertasDashboard === null` só ocorre quando há um Grupo real com escala fora de contexto (ver comentário acima) — não precisa checar `possuiOperacaoPlantaoDashboard` de novo. */
  const existePendenciaDesconhecida = plantaoAlertasDashboard === null;
  /**
   * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — causa raiz do card genérico
   * "Plantão": `grupoPlantaoDashboard` é `null` sempre que o usuário não
   * tem NENHUM Grupo de Plantão no escopo (ex.: supervisora do NOC), mas o
   * card/linha de Plantão da Visão geral era renderizado incondicionalmente
   * — caindo neste fallback textual em vez de simplesmente não aparecer.
   * `possuiOperacaoPlantaoDashboard` passa a gatear cada um desses pontos;
   * o fallback deixou de ser necessário (nunca mais renderizado), mas
   * permanece como defesa — nunca inventa uma operação sem Grupo real.
   */
  const possuiOperacaoPlantaoDashboard = grupoPlantaoDashboard !== null;
  const nomePlantaoDashboard = grupoPlantaoDashboard?.nome ?? 'Plantão';
  const opcoesDataResumoDashboard = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
  const periodoJornadaDashboard = resumoJornadaDashboard === null
    ? 'Sem competência criada'
    : `${formatarData(resumoJornadaDashboard.periodoInicio, opcoesDataResumoDashboard)} — ${formatarData(resumoJornadaDashboard.periodoFim, opcoesDataResumoDashboard)}`;
  const periodoPlantaoDashboard = competenciaPlantaoExibidaDashboard === null
    ? 'Sem competência criada'
    : `${formatarData(competenciaPlantaoExibidaDashboard?.periodoInicio, opcoesDataResumoDashboard)} — ${formatarData(competenciaPlantaoExibidaDashboard?.periodoFim, opcoesDataResumoDashboard)}`;
  const resumoPublicacaoDashboard = resumoPublicacaoOperacao(estadoJornadaOperacionalDashboard);
  /**
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — causa raiz do
   * "Publicação da escala" mostrar Plantão publicado como "Rascunho
   * disponível": o `<small>` daquela linha usava `plantaoPossuiEscalaDashboard`
   * (um booleano 2 estados) direto, nunca `estadoPlantaoOperacionalDashboard`
   * (os 4 estados corretos), então "publicada" e "rascunho" apareciam com
   * o mesmo texto. Agora usa a MESMA função que a Jornada já usa, com o
   * status de Plantão.
   */
  const resumoPublicacaoPlantaoDashboard = resumoPublicacaoOperacao(estadoPlantaoOperacionalDashboard);
  const chaveJornadasDashboard = escoposOperacionais.jornadasAdministraveis.map((equipe) => equipe.id).join('|');
  const chavePlantoesDashboard = escoposOperacionais.plantoesAdministraveis.map((grupo) => grupo.grupoId).join('|');

  /**
   * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — Regra principal: única lista de
   * "operações visíveis" do Dashboard. Para a operação que É o contexto
   * ativo agora, usa o resumo "ao vivo" (`resumoJornadaDashboard`/
   * `resumoPlantaoDashboard`, que já reflete edição não salva); para as
   * demais, usa só o snapshot persistido (`resumosJornadaDashboard`/
   * `resumosPlantaoDashboard`) — não há dado "ao vivo" de uma operação que
   * não está sendo editada agora. Seletor superior, Visão geral, Escalas,
   * Publicação da escala e Alertas por operação leem só esta lista.
   */
  function statusJornadaOperacao(equipeId: string): { temRascunho: boolean; temPublicada: boolean } {
    if (equipeId === equipeJornadaDashboardId) {
      return statusJornadaResumo(resumoJornadaDashboard);
    }
    return statusJornadaResumo(resumosJornadaDashboard[`${equipeId}:${competenciaDashboard}`] ?? null);
  }
  function statusPlantaoOperacao(grupoId: string): { temRascunho: boolean; temPublicada: boolean } {
    if (grupoId === grupoPlantaoDashboard?.grupoId) {
      return statusPlantaoResumo(resumoPlantaoDashboard);
    }
    return statusPlantaoResumo(resumosPlantaoDashboard[`${grupoId}:${competenciaDashboard}`] ?? null);
  }
  const operacoesDashboard: OperacaoDashboard[] = usuarioReal !== null
    ? resolverOperacoesDashboard(usuarioReal, contextoEscalaAtivo, {
      escopos: escoposOperacionais,
      statusJornada: statusJornadaOperacao,
      statusPlantao: statusPlantaoOperacao,
    })
    : [];

  useEffect(() => {
    if (modoDemo || usuarioReal === null) {
      return;
    }
    const jornadaIds = chaveJornadasDashboard.split('|').filter((equipeId) => equipeId !== '');
    if (jornadaIds.length === 0) {
      return;
    }
    let cancelado = false;
    void Promise.all(jornadaIds.map(async (equipeId): Promise<{ resumo: ResumoJornadaDashboard; falhaParcial: unknown | null }> => {
      const resultados = await executarComLimiteDeTempo(Promise.allSettled([
        carregarRascunhosEquipe(equipeId, competenciaDashboard),
        carregarEscalasEquipe(equipeId, competenciaDashboard, true),
        listarUsuarios(equipeId),
      ]));
      const [resultadoRascunhos, resultadoPublicadas, resultadoUsuarios] = resultados;
      const rascunhos = valorLeitura(resultadoRascunhos, []);
      const publicadas = valorLeitura(resultadoPublicadas, []);
      const usuariosDaEquipe = valorLeitura(resultadoUsuarios, []);
      // Nunca lançar aqui: uma falha total nesta `equipeId` não pode
      // derrubar o `Promise.all` de TODAS as Jornadas — o card desta Jornada
      // mostra "Sem escala" e o aviso de `falhaParcial` abaixo, mas as
      // demais (e o Plantão, resolvido em outro efeito) continuam intactas.
      const documentosBase = rascunhos.length > 0 ? rascunhos : publicadas;
      const periodo = periodoDaCompetencia(competenciaDashboard);
      const datas = documentosBase.flatMap((documento) => Object.keys(documento.dias)).sort();
      return {
        resumo: {
          equipeId,
          competencia: competenciaDashboard,
          documentos: documentosBase,
          rascunhos,
          publicadas,
          colaboradoresAtivos: usuariosDaEquipe.filter((usuario) => usuario.ativo && usuario.equipeId === equipeId).length,
          periodoInicio: datas[0] ?? periodo?.periodoInicio ?? '',
          periodoFim: datas.at(-1) ?? periodo?.periodoFim ?? '',
        },
        falhaParcial: motivoLeituraRecusada(resultados),
      };
    }))
      .then((resultados) => {
        if (cancelado) {
          return;
        }
        setResumosJornadaDashboard((atuais) => ({
          ...atuais,
          ...Object.fromEntries(resultados.map(({ resumo }) => [`${resumo.equipeId}:${resumo.competencia}`, resumo])),
        }));
        const falhaParcial = resultados.find((resultado) => resultado.falhaParcial !== null)?.falhaParcial ?? null;
        setErroResumoJornadaDashboard(falhaParcial === null ? '' : mensagemFalhaLeituraParcial(falhaParcial));
      })
      .catch((falha) => {
        if (!cancelado) {
          setErroResumoJornadaDashboard(falhaEhPermissionDenied(falha)
            ? MENSAGEM_RULES_LEITURA_OPERACIONAL
            : mensagemErroFirebase(falha, 'Não foi possível carregar o resumo das Jornadas.', ambienteFirebaseAtual));
        }
      });
    return () => {
      cancelado = true;
    };
  }, [chaveJornadasDashboard, competenciaDashboard, modoDemo, usuarioReal]);

  useEffect(() => {
    if (modoDemo || usuarioReal === null) {
      return;
    }
    const grupoIds = chavePlantoesDashboard.split('|').filter((grupoId) => grupoId !== '');
    if (grupoIds.length === 0) {
      return;
    }
    let cancelado = false;
    void Promise.all(grupoIds.map(async (grupoId): Promise<{ resumo: ResumoPlantaoDashboard; falhaParcial: unknown | null }> => {
      const resultados = await executarComLimiteDeTempo(Promise.allSettled([
        obterCompetenciaPlantaoRascunho(grupoId, competenciaDashboard),
        // Tela administrativa: precisa mostrar também uma competência
        // CANCELADA (badge + motivo), nunca só PUBLICADA — ver
        // `obterCompetenciaPlantaoAtual()` em `plantaoReadRepository.ts`.
        obterCompetenciaPlantaoAtual(grupoId, competenciaDashboard),
        listarParticipantesPlantao(grupoId),
      ]));
      const [resultadoRascunho, resultadoPublicada, resultadoParticipantes] = resultados;
      const competenciaRascunho = valorLeitura(resultadoRascunho, null);
      const competenciaPublicada = valorLeitura(resultadoPublicada, null);
      const participantes = valorLeitura(resultadoParticipantes, []);
      // Nunca lançar aqui: uma falha total neste `grupoId` (ex.: índice do
      // Firestore ainda sendo criado) não pode derrubar o `Promise.all` de
      // TODOS os grupos — o card deste grupo mostra "Sem escala"/contagem 0 e
      // o aviso de `falhaParcial` abaixo, mas os demais cards (e o editor,
      // que nem depende deste efeito) continuam intactos.
      return {
        resumo: {
          grupoId,
          competencia: competenciaDashboard,
          competenciaRascunho,
          competenciaPublicada,
          participantesAtivos: participantes.filter((participante) => participante.ativo).length,
        },
        falhaParcial: motivoLeituraRecusada(resultados),
      };
    }))
      .then((resultados) => {
        if (cancelado) {
          return;
        }
        setResumosPlantaoDashboard((atuais) => ({
          ...atuais,
          ...Object.fromEntries(resultados.map(({ resumo }) => [`${resumo.grupoId}:${resumo.competencia}`, resumo])),
        }));
        setRascunhosPlantaoPorGrupo((atuais) => {
          const proximos = { ...atuais };
          for (const { resumo } of resultados) {
            const competenciaRascunho = resumo.competenciaRascunho;
            if (competenciaRascunho !== null) {
              const existentes = proximos[resumo.grupoId] ?? [];
              proximos[resumo.grupoId] = existentes.some((item) => item.competencia === competenciaRascunho.competencia)
                ? existentes.map((item) => (item.competencia === competenciaRascunho.competencia ? competenciaRascunho : item))
                : [...existentes, competenciaRascunho];
            }
          }
          return proximos;
        });
        const falhaParcial = resultados.find((resultado) => resultado.falhaParcial !== null)?.falhaParcial ?? null;
        setErroResumoPlantaoDashboard(falhaParcial === null ? '' : mensagemFalhaLeituraParcial(falhaParcial));
      })
      .catch((falha) => {
        if (!cancelado) {
          setErroResumoPlantaoDashboard(falhaEhPermissionDenied(falha)
            ? MENSAGEM_RULES_LEITURA_OPERACIONAL
            : mensagemErroFirebase(falha, 'Não foi possível carregar o resumo dos Plantões.', ambienteFirebaseAtual));
        }
      });
    return () => {
      cancelado = true;
    };
  }, [chavePlantoesDashboard, competenciaDashboard, modoDemo, usuarioReal]);

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
            setContextoEscalaAtivo(criarContextoEscala(
              'JORNADA',
              usuarioEfetivo.equipeId,
              EQUIPE_DEMO.nome,
              escala.documentos[0]?.competencia ?? '2026-08',
            ));
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
      carregarEscalasEquipe(alvo.equipeId, competenciaOperacionalHoje, true),
      carregarRascunhosEquipe(alvo.equipeId, competenciaOperacionalHoje),
      listarHistoricoPublicacoes(alvo.equipeId, competenciaOperacionalHoje),
      carregarEstadoPublicacao(alvo.equipeId, competenciaOperacionalHoje),
    ]);
    setUsuarios(usuariosRemotos);
    setCatalogo(catalogoRemoto);
    setHistorico(historicoRemoto);
    setRevisaoAtual(estadoPublicacao?.revisaoAtual ?? 0);
    const documentosCarregados = rascunhosRemotos.length > 0
      ? rascunhosRemotos
      : escalasRemotas;
    const equipeAlvo = equipesAdmin.find((equipe) => equipe.id === alvo.equipeId);
    setContextoEscalaAtivo(criarContextoEscala('JORNADA', alvo.equipeId, equipeAlvo?.nome ?? alvo.equipeId, competenciaOperacionalHoje));
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
    usuarioContextoRestauradoRef.current = null;
    setTentativaCarregamentoOperacoes(0);
    setEstadoCarregamentoOperacoes({ fase: demonstracao ? 'sucesso' : 'carregando' });
    setErroContextoEscala('');
    setAvisoContextoEscala('');
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
      setEquipesAdmin([]);
      setUnidadesAdmin([]);
      setGruposPlantaoAdmin([]);
      setEscoposOperacionaisAdmin([]);
      setResultado(null);
      setResultadoPlantao(null);
      setUsuarios([]);
      setLinhasConciliacao([]);
      setContextoEscalaAtivo(null);
      setContextoSemEscala(false);
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
   * Registra ator real (+ ator simulado, quando houver) para uma ação
   * sensível — chamada depois do sucesso da escrita real, nunca antes:
   * falha de auditoria não pode desfazer nem mascarar uma ação já
   * commitada.
   *
   * STAGING-RESET-HIERARQUIA-ICI-1 — até esta fase só disparava com
   * `simulando !== null` (ADMIN_SISTEMA simulando outro gestor). Agora
   * dispara SEMPRE que há um `usuarioReal`, com `atorSimulado: null` quando
   * ninguém está sendo simulado — em staging, um coordenador/supervisor
   * agindo diretamente também precisa gerar auditoria. `equipeId` é sempre
   * o alvo REAL da ação (não necessariamente a equipe do ator, que pode
   * administrar via Matriz uma equipe diferente da própria).
   */
  async function registrarAuditoriaOperacional(
    acao: string,
    equipeId: string,
    contexto?: {
      unidadeId?: string | null;
      competencia?: string | null;
      nomeImportado?: string | null;
      usuarioVinculadoLogin?: string | null;
      origem?: string | null;
    },
  ) {
    if (usuarioReal === null) {
      return;
    }
    try {
      await registrarAuditoriaAdmin({
        atorReal: usuarioReal,
        atorSimulado: simulando,
        equipeId,
        acao,
        ...contexto,
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
    await registrarAuditoriaOperacional('ATRIBUIR_LEMBRETE', colaboradorLembretes.equipeId);
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
    await registrarAuditoriaOperacional('ATRIBUIR_SERIE_LEMBRETES', colaboradorLembretes.equipeId);
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
        await registrarAuditoriaOperacional('CANCELAR_LEMBRETE', lembreteParaCancelar.destinatarioEquipeId);
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
      contextoEscalaAtivo?.competencia ?? competenciaOperacionalHoje,
      setTrocas,
      (falha) => setErroTroca(mensagemErroFirebase(falha, 'Não foi possível acompanhar as trocas de escala.', ambienteFirebaseAtual)),
    );
    return cancelar;
  }, [modoDemo, usuarioEfetivo, contextoEscalaAtivo, competenciaOperacionalHoje]);

  function reparsear(
    buffer: ArrayBuffer,
    loginParaUid: Record<string, string>,
    opcoes: OpcoesInicioImportacao = {},
  ): ResultadoParse {
    return parsePlanilhaEscala(buffer, {
      equipeId: opcoes.equipeId
        ?? (contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : usuarioEfetivo?.equipeId)
        ?? EQUIPE_DEMO.id,
      competencia: opcoes.competencia ?? competenciaOperacionalHoje,
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
   *
   * PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — `usuariosParaMapa` é
   * opcional e por padrão usa o `usuarios` do estado (comportamento
   * inalterado em todo chamador existente). O único chamador que precisa do
   * parâmetro é o de "criar usuário a partir da pendência": como
   * `setUsuarios()` não atualiza o `usuarios` desta mesma invocação de
   * função (React só aplica no próximo render), sem isso o vínculo recém-
   * criado ficava fora do mapa de login/alias até um reload — exatamente o
   * "preciso limpar o cache" relatado.
   */
  function aplicarConciliacao(buffer: ArrayBuffer, linhas: LinhaConciliacao[], opcoes: OpcoesInicioImportacao = {}, usuariosParaMapa: Usuario[] = usuarios) {
    setLinhasConciliacao(linhas);
    const parseado = linhas.some((linha) => linha.login !== null)
      ? reparsear(buffer, loginParaUidComConciliacao(mapaLogins(usuariosParaMapa), linhas), opcoes)
      : reparsear(buffer, mapaLogins(usuariosParaMapa), opcoes);
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
        const equipeId = opcoes.equipeId
          ?? (contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : usuarioEfetivo.equipeId);
        const equipe = equipesAdmin.find((item) => item.id === equipeId);
        setContextoEscalaAtivo(criarContextoEscala(
          'JORNADA',
          equipeId,
          equipe?.nome ?? equipeId,
          opcoes.competencia ?? parseado.documentos[0]?.competencia ?? competenciaOperacionalHoje,
        ));
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
   * preview em memória (`resultadoPlantao`) e concilia identidades exatas,
   * únicas e ativas em `iniciarVinculosPlantao`.
   */
  function interpretarPlantao(
    buffer: ArrayBuffer,
    nome: string,
    resultado: ResultadoParsePlantao,
    opcoes: OpcoesInicioImportacao = {},
    usuariosDoGrupo: readonly Usuario[] = usuarios,
  ) {
    setArquivo(buffer);
    setNomeArquivo(nome);
    setResultadoPlantao(resultado);
    setOrigemPlantaoAtual('IMPORTADO');
    setAtribuicoesEditaveisPlantao(criarAtribuicoesEditaveis(resultado.atribuicoes));
    setPlantaoEditadoDesdeImportacao(false);
    // FASE ESCALAS-UX-2A.1-FIX — a working copy nasce agora, ainda não
    // persistida: importar não é salvar.
    setPlantaoPossuiAlteracoesNaoSalvas(true);
    setVinculosPlantao(iniciarVinculosPlantao(consolidarParticipantesPlantao(resultado), usuariosDoGrupo));
    setPreviaPlantaoValidada(false);
    setAbaPreviaPlantao('calendario');
    setBuscaVinculoPlantao({});
    setPlantonistaSelecionadoPlantao(null);
    setFuncaoSelecionadaPlantao('TODOS');
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
      const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoIdEscolhido);
      setContextoEscalaAtivo(criarContextoEscala('PLANTAO', grupoIdEscolhido, grupo?.nome ?? grupoIdEscolhido, competenciaEscolhida));
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
        ...(atribuicao.funcao === undefined ? {} : { funcao: atribuicao.funcao }),
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
        // FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (§3 da fase) — criar a partir de uma aba
        // específica (DBA/Linux/Telecom/Windows) já preenche o posto; a partir de "Todos",
        // o campo nasce vazio e a escolha é obrigatória (ver validarAtribuicaoEditavel()).
        ...(funcaoSelecionadaPlantao === 'TODOS' ? {} : { funcao: funcaoSelecionadaPlantao }),
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
   *
   * FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1 — o Modal/quick-add ainda não têm
   * campo de posto (dívida documentada em `docs/spec/PLANTAO_MULTIPOSTO.md`).
   * Enquanto isso, uma nova atribuição criada com uma função específica já
   * selecionada (aba DBA/Linux/Telecom/Windows) herda essa função — sem
   * isso, ela nasceria sem `funcao` e desapareceria de toda aba específica,
   * só visível em "Todos" (§31/§32: nunca um posto "sumido"). Criar a
   * partir de "Todos" continua sem `funcao`, exatamente como antes desta
   * fase — nunca inferida às cegas.
   */
  function criarAtribuicaoPlantaoNaWorkingCopy(valores: FormularioAtribuicaoPlantao) {
    const abaOrigem = resultadoPlantao?.atribuicoes[0]?.abaOrigem ?? '';
    // `valores.funcao` (escolhido no Modal) sempre manda quando presente; o
    // quick-add (construirAtribuicaoDoPadraoHorario()) ainda não tem campo
    // de posto, então cai no fallback da aba selecionada no momento.
    const funcaoResolvida = valores.funcao ?? (funcaoSelecionadaPlantao === 'TODOS' ? undefined : funcaoSelecionadaPlantao);
    setAtribuicoesEditaveisPlantao((atuais) => adicionarAtribuicaoEditavel(atuais, {
      ...valores,
      abaOrigem,
      ...(funcaoResolvida === undefined ? {} : { funcao: funcaoResolvida }),
    }));
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
      if (equipeJornadaDashboard === null) {
        setTela('escalas');
        return;
      }
      const alvo = criarContextoEscala(
        'JORNADA',
        equipeJornadaDashboard.id,
        equipeJornadaDashboard.nome,
        competenciaDashboard,
      );
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
    const alvo = criarContextoEscala(
      'PLANTAO',
      grupoPlantaoDashboard.grupoId,
      grupoPlantaoDashboard.nome,
      competenciaPlantaoDashboard?.competencia ?? competenciaDashboard,
    );
    if (contextosEscalaIguais(contextoEscalaAtivo, alvo)) {
      if (plantaoPossuiEscalaDashboard) {
        abrirEditorPlantaoDashboard();
      } else {
        setTela('escalas');
      }
      return;
    }
    solicitarTrocaContexto(alvo);
  }
  /**
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — antes, tanto aqui
   * quanto no botão "Abrir editor" da aba Escalas, um `setTela('importar')`
   * bastava para Jornada nunca chegar aqui, mas para Plantão pousava na
   * tela de importação em branco sempre que não havia rascunho aberto
   * (o caso mais comum logo após publicar) — `origemPlantaoAtual`
   * continuava `null`, então nem `PreviewPlantao` nem `PlantaoCalendario`
   * apareciam. Agora resolve a competência a mostrar (rascunho mais
   * recente se existir, senão a publicada — `competenciaPlantaoExibidaDashboard`,
   * já calculado) e reidrata pelo MESMO caminho usado para reabrir
   * rascunho — nenhum segundo modelo de dados, só uma fonte a mais
   * (`abrirRascunhoNoEditorAcao` já aceita competência publicada).
   */
  function abrirEditorPlantaoDashboard() {
    if (grupoPlantaoDashboard === null) {
      setTela('escalas');
      return;
    }
    if (competenciaPlantaoExibidaDashboard === null) {
      setTela('importar');
      return;
    }
    void abrirRascunhoNoEditorAcao(grupoPlantaoDashboard, competenciaPlantaoExibidaDashboard);
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
    setWizardCompetencia(contextoEscalaAtivo?.competencia ?? competenciaOperacionalHoje);
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
  async function criarGrupoWizard(nome: string, equipeId: string, funcoesEsperadas?: readonly FuncaoPlantao[]) {
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
        funcoesEsperadas,
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
    try {
      const sucesso = await receberArquivo(file, {
        tipoEsperado: wizardTipo === 'JORNADA' ? 'ESCALA_6X1' : 'PLANTAO',
        equipeId: wizardEquipeId,
        grupoId: wizardGrupoId,
        competencia: wizardCompetencia,
        aoFalhar: setWizardErro,
      });
      if (sucesso) {
        fecharNovaEscala();
        setTela(wizardTipo === 'JORNADA' ? 'grade' : 'importar');
      }
    } catch (falha) {
      setWizardErro(falha instanceof Error
        ? `Não foi possível importar a planilha: ${falha.message}`
        : 'Não foi possível importar a planilha selecionada.');
    } finally {
      setWizardProcessando(false);
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
      const gradeInicial = criarGradeInicialEquipe(
        usuariosDaEquipe,
        { equipeId: wizardEquipeId, competencia: wizardCompetencia, periodoInicio: periodo.periodoInicio, periodoFim: periodo.periodoFim },
        catalogoDaEquipe,
      );
      const documentosNovos = gradeInicial.documentos;
      setResultado({
        ok: true,
        equipeNome: equipe?.nome ?? wizardEquipeId,
        periodoInicio: periodo.periodoInicio,
        periodoFim: periodo.periodoFim,
        totalDias: documentosNovos.length > 0 ? Object.keys(documentosNovos[0].dias).length : 0,
        documentos: documentosNovos,
        erros: [],
        avisos: documentosNovos.length === 0
          ? ['Nenhum colaborador ativo encontrado para esta equipe. Cadastre ou importe usuários antes de montar a escala.']
          : gradeInicial.colaboradoresSemTurnoPadrao.length > 0
            ? [`${gradeInicial.colaboradoresSemTurnoPadrao.length} colaborador(es) estão sem período padrão válido no cadastro e foram agrupados em Outros. Corrija o cadastro ou escolha o turno na grade.`]
            : ['Colaboradores organizados conforme o período padrão cadastrado. Preencha os dias e folgas no editor antes de salvar.'],
      });
      setLinhasConciliacao([]);
      setJornadaPossuiAlteracoesNaoSalvas(true);
      setContextoEscalaAtivo(criarContextoEscala('JORNADA', wizardEquipeId, equipe?.nome ?? wizardEquipeId, wizardCompetencia));
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
      let verificacaoDuplicidadeLimitadaPorRules = false;
      if (!modoDemo) {
        try {
          const existente = await obterCompetenciaPlantaoRascunho(grupo.grupoId, competencia);
          if (existente !== null) {
            setWizardErro('Já existe um rascunho para este Plantão e competência. Abra o rascunho existente.');
            return;
          }
        } catch (falha) {
          if (!falhaEhPermissionDenied(falha)) throw falha;
          // Importar/criar uma working copy local não é escrita. Rules de
          // staging desatualizadas não devem bloquear o editor; salvar e
          // publicar continuam protegidos pelo repository e pelas Rules.
          verificacaoDuplicidadeLimitadaPorRules = true;
        }
      }
      let participantesAtivos: ParticipantePlantao[] = [];
      try {
        participantesAtivos = (await garantirParticipantesDoGrupoCarregados(grupo.grupoId))
          .filter((item) => item.ativo);
      } catch (falha) {
        if (!falhaEhPermissionDenied(falha)) throw falha;
        // A lista é auxiliar à working copy vazia. Se staging ainda negar
        // essa leitura, o editor pode abrir sem roster; nenhuma pessoa é
        // inventada e a gravação continua submetida ao repository/Rules.
        verificacaoDuplicidadeLimitadaPorRules = true;
      }
      const usuariosDoGrupo = modoDemo
        ? usuarios
        : await listarUsuariosElegiveisPlantao(grupo.equipeResponsavelId, grupo.grupoId, grupo.unidadeResponsavelId, grupo.equipesConsulta);
      if (!modoDemo) {
        setUsuarios(usuariosDoGrupo);
      }
      const vinculosIniciais = vinculosDeParticipantesGrupoPlantao(participantesAtivos, usuariosDoGrupo);

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
      setFuncaoSelecionadaPlantao('TODOS');
      setGrupoRascunhoEscolhido(grupo.grupoId);
      setCompetenciaRascunho(competencia);
      setPeriodoInicioRascunho(periodo.periodoInicio);
      setPeriodoFimRascunho(periodo.periodoFim);
      setErroRascunhoPlantao('');
      setRascunhoPlantaoSalvoEm(null);
      setTipoArquivoDetectado('PLANTAO');
      setContextoEscalaAtivo(criarContextoEscala('PLANTAO', grupo.grupoId, grupo.nome, competencia));
      setContextoSemEscala(false);
      setMensagem(verificacaoDuplicidadeLimitadaPorRules
        ? 'Escala aberta localmente. As Firestore Rules de staging precisam ser publicadas antes de salvar ou publicar.'
        : `Escala de Plantão criada — "${grupo.nome}" (${competencia}). Nenhum dado foi publicado.`);
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

      const [atribuicoesAnteriores, participantesAtivos, usuariosDoGrupo] = await Promise.all([
        modoDemo ? Promise.resolve([]) : listarAtribuicoesPlantaoRascunho(grupo.grupoId, labelAnterior),
        garantirParticipantesDoGrupoCarregados(grupo.grupoId).then((lista) => lista.filter((item) => item.ativo)),
        modoDemo ? Promise.resolve(usuarios) : listarUsuariosElegiveisPlantao(grupo.equipeResponsavelId, grupo.grupoId, grupo.unidadeResponsavelId, grupo.equipesConsulta),
      ]);
      if (!modoDemo) {
        setUsuarios(usuariosDoGrupo);
      }

      const resultadoCopia = copiarAtribuicoesParaNovaCompetencia({
        atribuicoesAnteriores,
        periodoAnteriorInicio: periodoAnterior.periodoInicio,
        periodoNovoInicio: periodo.periodoInicio,
        periodoNovoFim: periodo.periodoFim,
        timezone: grupo.timezone,
        participantes: participantesAtivos,
        usuarios: usuariosDoGrupo,
      });
      const vinculosIniciais = vinculosDeCopiaAnterior(atribuicoesAnteriores, participantesAtivos, usuariosDoGrupo);

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
      setFuncaoSelecionadaPlantao('TODOS');
      setGrupoRascunhoEscolhido(grupo.grupoId);
      setCompetenciaRascunho(competencia);
      setPeriodoInicioRascunho(periodo.periodoInicio);
      setPeriodoFimRascunho(periodo.periodoFim);
      setErroRascunhoPlantao('');
      setRascunhoPlantaoSalvoEm(null);
      setTipoArquivoDetectado('PLANTAO');
      setContextoEscalaAtivo(criarContextoEscala('PLANTAO', grupo.grupoId, grupo.nome, competencia));
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
    if (!modoDemo) {
      void registrarAuditoriaOperacional('ASSOCIAR_USUARIO_IMPORTACAO', escolhido.equipeId, {
        competencia: competenciaImportacaoJornadaAtual,
        nomeImportado: linha.nomePlanilha,
        usuarioVinculadoLogin: escolhido.login,
        origem: 'IMPORTACAO_JORNADA',
      });
    }
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
    if (!modoDemo) {
      void registrarAuditoriaOperacional('IGNORAR_PENDENCIA_IMPORTACAO', equipeIdImportacaoJornadaAtual, {
        competencia: competenciaImportacaoJornadaAtual,
        nomeImportado: linha.nomePlanilha,
        origem: 'IMPORTACAO_JORNADA',
      });
    }
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
        await registrarAuditoriaOperacional('ADICIONAR_ALIAS_IMPORTACAO', escolhido.equipeId, {
          competencia: competenciaImportacaoJornadaAtual,
          nomeImportado: linha.nomePlanilha,
          usuarioVinculadoLogin: escolhido.login,
          origem: 'IMPORTACAO_JORNADA',
        });
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
    const falhar = (texto: string) => {
      setMensagem(texto);
      opcoes.aoFalhar?.(texto);
      return false;
    };
    if (file === undefined) {
      return false;
    }
    const extensaoValida = /\.(xls|xlsx)$/iu.test(file.name);
    if (!extensaoValida) {
      return falhar('Selecione um arquivo XLS ou XLSX.');
    }

    let buffer: ArrayBuffer;
    let processado: ReturnType<typeof processarArquivoImportado>;
    try {
      buffer = await file.arrayBuffer();
      const equipeImportacaoId = opcoes.equipeId
        ?? (contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : usuarioEfetivo?.equipeId)
        ?? EQUIPE_DEMO.id;
      processado = processarArquivoImportado(buffer, {
        equipeId: equipeImportacaoId,
        competencia: opcoes.competencia ?? competenciaOperacionalHoje,
        catalogo,
        loginParaUid: mapaLogins(usuarios),
      });
    } catch (falha) {
      return falhar(falha instanceof Error
        ? `Não foi possível ler a planilha: ${falha.message}`
        : 'Não foi possível ler a planilha selecionada.');
    }
    setTipoArquivoDetectado(processado.tipo);
    if (opcoes.tipoEsperado !== undefined && processado.tipo !== opcoes.tipoEsperado) {
      const esperado = opcoes.tipoEsperado === 'PLANTAO' ? 'Plantão' : 'Jornada 6x1';
      const encontrado = processado.tipo === 'PLANTAO' ? 'Plantão' : processado.tipo === 'ESCALA_6X1' ? 'Jornada 6x1' : 'estrutura desconhecida';
      return falhar(`O arquivo escolhido não corresponde ao tipo selecionado. Esperado: ${esperado}. Encontrado: ${encontrado}.`);
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
      return falhar(processado.motivo);
    }
    if (processado.tipo === 'PLANTAO') {
      const grupoAtual = contextoEhPlantao(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : '';
      const opcoesPlantao = {
        ...opcoes,
        grupoId: opcoes.grupoId ?? (grupoAtual || undefined),
        competencia: opcoes.competencia ?? (contextoEhPlantao(contextoEscalaAtivo) ? contextoEscalaAtivo.competencia : undefined),
      };
      if (opcoesPlantao.grupoId === undefined || opcoesPlantao.grupoId.trim() === '') {
        return falhar('Selecione o contexto Plantão no topo ou use o fluxo de importação para definir o Grupo de Plantão antes de carregar o arquivo.');
      }
      const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === opcoesPlantao.grupoId);
      if (grupo === undefined) {
        return falhar('O Grupo de Plantão selecionado não foi encontrado. Recarregue as operações e tente novamente.');
      }
      let usuariosDoGrupo = usuarios;
      if (!modoDemo) {
        try {
          usuariosDoGrupo = await listarUsuariosElegiveisPlantao(grupo.equipeResponsavelId, grupo.grupoId, grupo.unidadeResponsavelId, grupo.equipesConsulta);
          setUsuarios(usuariosDoGrupo);
        } catch (falha) {
          return falhar(mensagemErroFirebase(
            falha,
            'Não foi possível carregar os usuários da equipe responsável por este Plantão.',
            ambienteFirebaseAtual,
          ));
        }
      }
      setResultado(null);
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setLinhasConciliacao([]);
      /**
       * FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (§11-13/§29/§30 da fase) —
       * valida as funções ENCONTRADAS no arquivo contra `grupo.funcoesEsperadas`
       * ESPECIFICAMENTE (nunca só o enum global `FuncaoPlantao`, que
       * `processarArquivoImportado()` já usa por baixo). Uma função que o
       * enum conhece mas que este Grupo não espera vira erro BLOQUEANTE
       * nomeado, mesclado aos erros já existentes — nunca adiciona a função
       * a `funcoesEsperadas` sozinho, nunca cria posto/Grupo (§12). Grupo de
       * posto único nunca passa por aqui com erro (`validarFuncoesContraGrupo`
       * retorna `[]` quando `funcoesEsperadas` está vazio).
       */
      const errosFuncaoForaDoGrupo = validarFuncoesContraGrupo(processado.resultado.atribuicoes, grupo.funcoesEsperadas ?? []);
      const resultadoPlantaoValidado = errosFuncaoForaDoGrupo.length === 0
        ? processado.resultado
        : { ...processado.resultado, ok: false, erros: [...processado.resultado.erros, ...errosFuncaoForaDoGrupo] };
      interpretarPlantao(buffer, file.name, resultadoPlantaoValidado, opcoesPlantao, usuariosDoGrupo);
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
      const equipeAlvoId = contextoEhJornada(contextoEscalaAtivo)
        ? contextoEscalaAtivo.alvoId
        : usuarioEfetivo.equipeId;
      const responsavelDoAlvo = { ...usuarioEfetivo, equipeId: equipeAlvoId };
      const turnoPorLogin = new Map((resultado?.documentos ?? []).map((documento) => [documento.login, documento.turnoPadrao]));
      const agora = new Date().toISOString();
      const novos = logins.map((login, indice) => novoUsuario(
        usuarios.length + indice + 1,
        responsavelDoAlvo,
        login,
        true,
        agora,
        turnoPorLogin.get(login) ?? '',
      ));
      if (!modoDemo) {
        await salvarUsuarios(novos);
        await registrarAuditoriaOperacional('CADASTRAR_USUARIOS', equipeAlvoId);
      }
      const atualizados = [...usuarios, ...novos];
      setUsuarios(atualizados);
      if (arquivo !== null) {
        const parseado = parsePlanilhaEscala(arquivo, {
          equipeId: equipeAlvoId,
          competencia: contextoEscalaAtivo?.competencia ?? competenciaOperacionalHoje,
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
    // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — salvar rascunho só
    // trava por erro BLOQUEANTE (estrutural). Um ALERTA (ex.: sequência de
    // trabalho fora do padrão) pode ser uma exceção operacional legítima —
    // ver tabela de severidade em ErroImportacao/temErroBloqueante().
    if (resultado === null || usuarioEfetivo === null || temErroBloqueante(resultado.erros)) {
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
    const equipeAlvoId = contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : null;
    const matrizReconheceUsuario = equipeAlvoId !== null
      && escoposOperacionais.jornadasAdministraveis.some((equipe) => equipe.id === equipeAlvoId);
    if (!matrizReconheceUsuario) {
      setMensagem('Você não está configurado como responsável por esta escala.');
      return;
    }
    if (resultado.documentos.some((documento) => documento.equipeId !== equipeAlvoId)) {
      setMensagem('A escala aberta não pertence ao alvo operacional selecionado. Reabra a operação antes de salvar.');
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        await salvarRascunho(resultado, usuarioEfetivo, nomeArquivo);
        await registrarAuditoriaOperacional('SALVAR_RASCUNHO', equipeAlvoId ?? usuarioEfetivo.equipeId);
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
      setMensagem(mensagemErroEscritaOperacional(falha, 'Não foi possível salvar.', matrizReconheceUsuario));
    } finally {
      setProcessando(false);
    }
  }

  async function publicar() {
    setErroPublicacao('');
    // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — publicar também só
    // trava por erro BLOQUEANTE. Com ALERTA presente e nenhum BLOQUEANTE,
    // a publicação segue, mas exige justificativa (ver checagem de
    // motivoPublicacao abaixo, agora também disparada por ALERTA).
    if (resultado === null || usuarioEfetivo === null || temErroBloqueante(resultado.erros)) {
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
    const publicandoComAlerta = resultado.erros.length > 0;
    if ((revisaoAtual > 0 || publicandoComAlerta) && motivoPublicacao.trim().length < 3) {
      setErroPublicacao(publicandoComAlerta
        ? 'Explique a justificativa da exceção antes de publicar com alerta.'
        : 'Informe um motivo curto para explicar o que mudou nesta publicação.');
      return;
    }
    const equipeAlvoId = contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : null;
    const matrizReconheceUsuario = equipeAlvoId !== null
      && escoposOperacionais.jornadasAdministraveis.some((equipe) => equipe.id === equipeAlvoId);
    if (!matrizReconheceUsuario) {
      setErroPublicacao('Você não está configurado como responsável por esta escala.');
      return;
    }
    if (resultado.documentos.some((documento) => documento.equipeId !== equipeAlvoId)) {
      setErroPublicacao('A escala aberta não pertence ao alvo operacional selecionado. Reabra a operação antes de publicar.');
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
        await registrarAuditoriaOperacional('PUBLICAR_ESCALA', equipeAlvoId ?? usuarioEfetivo.equipeId);
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
      const texto = mensagemErroEscritaOperacional(falha, 'Falha na publicação.', matrizReconheceUsuario);
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
      const eventos = await listarEventosPublicacao(publicacao.equipeId, publicacao.id);
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
      await registrarAuditoriaOperacional('RECUSAR_TROCA', trocas.find((item) => item.trocaId === id)?.equipeId ?? usuarioEfetivo.equipeId);
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
      await registrarAuditoriaOperacional('APROVAR_TROCA', trocas.find((item) => item.trocaId === id)?.equipeId ?? usuarioEfetivo.equipeId);
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
        revisaoParaRestaurar.equipeId,
        revisaoParaRestaurar.competencia,
        revisaoParaRestaurar.revisao,
        usuarioEfetivo.login,
      );
      setHistorico((atual) => [restaurada.publicacao, ...atual]);
      setRevisaoAtual(restaurada.publicacao.revisao);
      await registrarAuditoriaOperacional('ROLLBACK_PUBLICACAO', revisaoParaRestaurar.equipeId);
      const datas = restaurada.documentos.flatMap((documento) => Object.keys(documento.dias));
      setResultado({
        ok: true,
        equipeNome: equipesAdmin.find((equipe) => equipe.id === revisaoParaRestaurar.equipeId)?.nome
          ?? revisaoParaRestaurar.equipeId,
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
    setParticipanteVinculoCadastro(null);
    setLinhaConciliacaoVinculoCadastro(null);
    setFormularioUsuario({
      loginOriginal: null,
      nome: '',
      email: '',
      login: '',
      cargo: '',
      nivelHierarquico: 6,
      turnoPadrao: '',
      ativo: true,
      aliasesPlanilha: [],
      unidadesPermitidas: [],
      equipesPermitidas: [],
      tipoAcesso: 'COLABORADOR',
      confirmaAcessoGlobal: false,
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function abrirCadastroUsuarioParaVinculo(participanteNomeOriginal: string) {
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
    if (grupo === undefined || grupo.equipeResponsavelId.trim() === '') {
      setMensagem('Não foi possível identificar a equipe responsável deste Plantão. Recarregue as operações e tente novamente.');
      return;
    }
    setParticipanteVinculoCadastro(participanteNomeOriginal);
    setLinhaConciliacaoVinculoCadastro(null);
    setFormularioUsuario({
      loginOriginal: null,
      nome: participanteNomeOriginal,
      email: '',
      login: '',
      cargo: '',
      nivelHierarquico: 6,
      turnoPadrao: '',
      ativo: true,
      aliasesPlanilha: [participanteNomeOriginal],
      unidadesPermitidas: [],
      equipesPermitidas: [],
      tipoAcesso: 'COLABORADOR',
      confirmaAcessoGlobal: false,
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  /**
   * JORNADA-IMPORTACAO-VINCULOS-UX-1 — equivalente de
   * `abrirCadastroUsuarioParaVinculo()` para uma pendência de conciliação
   * de Jornada: pré-preenche nome e alias com o nome como veio da planilha,
   * a equipe é resolvida por `equipeIdCadastroUsuario` (equipe da escala
   * importada, ver acima). Ao salvar, `salvarFormularioUsuario()` resolve
   * a linha de conciliação automaticamente com o usuário criado.
   *
   * PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — a unidade/equipe da
   * escala em importação também é pré-selecionada no rascunho
   * (`unidadeId`/`equipeId`), não só resolvida via `equipeIdCadastroUsuario`:
   * quando `usarCadastroLivreStaging` está ativo, é esse valor do rascunho
   * que o select técnico usa como ponto de partida — sem isso, o select
   * abriria vazio em vez de já vir em GEDSI_COSI/GEDSI_COSI_SOC.
   */
  function abrirCadastroUsuarioParaConciliacao(linha: LinhaConciliacao) {
    setParticipanteVinculoCadastro(null);
    setLinhaConciliacaoVinculoCadastro(linha);
    const equipeIdSugerida = contextoEhJornada(contextoEscalaAtivo)
      ? contextoEscalaAtivo.alvoId
      : usuarioEfetivo?.equipeId ?? '';
    const equipeSugerida = equipesAdmin.find((equipe) => equipe.id === equipeIdSugerida);
    setFormularioUsuario({
      loginOriginal: null,
      nome: linha.nomePlanilha,
      email: '',
      login: '',
      cargo: '',
      nivelHierarquico: 6,
      turnoPadrao: '',
      ativo: true,
      aliasesPlanilha: [linha.nomePlanilha],
      unidadeId: equipeSugerida?.unidadeId,
      equipeId: equipeIdSugerida || undefined,
      unidadesPermitidas: [],
      equipesPermitidas: [],
      tipoAcesso: 'COLABORADOR',
      confirmaAcessoGlobal: false,
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function abrirEdicaoUsuario(item: Usuario) {
    setParticipanteVinculoCadastro(null);
    setLinhaConciliacaoVinculoCadastro(null);
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
      equipeId: item.equipeId,
      unidadesPermitidas: item.unidadesPermitidas ?? [],
      equipesPermitidas: item.equipesPermitidas ?? [],
      tipoAcesso: tipoAcessoDoUsuario(item),
      confirmaAcessoGlobal: item.perfil === 'ADMIN_SISTEMA',
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function fecharFormularioUsuario() {
    setFormularioUsuario(null);
    setParticipanteVinculoCadastro(null);
    setLinhaConciliacaoVinculoCadastro(null);
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

  /**
   * PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — único ponto que aplica uma
   * mudança no bloco simples "Tipo de acesso" (seletor, Equipe/Unidade
   * escolhida ou confirmação do Administrador do sistema). Recalcula
   * `perfil`/`escopo`/`equipeId`/`equipesPermitidas`/`unidadeId`/
   * `unidadesPermitidas`/`nivelHierarquico` via `montarCamposAcessoUsuario()`
   * puro e grava tudo de volta no MESMO estado que a área "Avançado" edita
   * diretamente — as duas UIs nunca divergem.
   *
   * Correção CODB/NOC — até esta fase, `GESTOR_UNIDADE` preservava
   * deliberadamente o `equipeId` anterior, na crença de que era "só
   * metadado informativo". Bug real encontrado: quando `equipesPermitidas`
   * está vazio, `minhasEquipesPermitidas()` (`firestore.rules`) cai para
   * `[equipeId]` — se essa equipe também estiver em `responsaveisEquipe`
   * da Matriz de alguma operação, o coordenador ganha administração dela
   * por acidente, nunca por responsabilidade explícita (um Coordenador de
   * Unidade com `equipeId` de uma equipe subordinada virou administrador
   * da Jornada dessa equipe sem nunca ter sido designado responsável).
   * Agora sempre usa `campos.equipeId` (sempre `undefined` para
   * `GESTOR_UNIDADE`) — mesma trava reforçada em
   * `usuarioGestorUnidadeComEquipeIdInvalido()`
   * (`lib/perfilAcessoUsuario.ts`), que `salvarUsuario()` já rejeita.
   */
  function aplicarSelecaoAcessoUsuario(patch: {
    tipo?: TipoAcessoUsuario;
    equipeId?: string;
    unidadeId?: string;
    confirmaAcessoGlobal?: boolean;
  }) {
    if (formularioUsuario === null) {
      return;
    }
    const selecao = {
      tipo: patch.tipo ?? formularioUsuario.tipoAcesso,
      equipeId: 'equipeId' in patch ? patch.equipeId : formularioUsuario.equipeId,
      unidadeId: 'unidadeId' in patch ? patch.unidadeId : formularioUsuario.unidadeId,
      confirmaAcessoGlobal: patch.confirmaAcessoGlobal ?? formularioUsuario.confirmaAcessoGlobal,
    };
    const campos = montarCamposAcessoUsuario(selecao, {
      unidadeDaEquipe: (equipeId) => equipesAdmin.find((equipe) => equipe.id === equipeId)?.unidadeId,
    });
    setFormularioUsuario({
      ...formularioUsuario,
      tipoAcesso: selecao.tipo,
      confirmaAcessoGlobal: selecao.confirmaAcessoGlobal,
      perfil: campos.perfil,
      escopo: campos.escopo,
      equipeId: campos.equipeId,
      equipesPermitidas: campos.equipesPermitidas,
      unidadeId: campos.unidadeId,
      unidadesPermitidas: campos.unidadesPermitidas,
      nivelHierarquico: campos.nivelHierarquico,
    });
  }

  async function salvarFormularioUsuario() {
    if (formularioUsuario === null || usuarioEfetivo === null) {
      return;
    }
    if (escritaBloqueada) {
      const aviso = 'A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.';
      if (participanteVinculoCadastro !== null || linhaConciliacaoVinculoCadastro !== null) {
        setErrosFormularioUsuario([aviso]);
      } else {
        setMensagem(aviso);
      }
      return;
    }

    /**
     * Campos globais de organização continuam exclusivos do admin. Um
     * responsável operacional pode enviar somente perfil de gestão/supervisão
     * da equipe e escopo EQUIPE durante a criação no próprio alvo.
     */
    const cadastroNovo = formularioUsuario.loginOriginal === null;
    const perfilDelegado = !souAdmin
      && cadastroNovo
      && perfilDelegavelPorResponsavelOperacional(formularioUsuario.perfil, usarCadastroLivreStaging)
      ? formularioUsuario.perfil
      : undefined;
    /**
     * STAGING-RESET-HIERARQUIA-ICI-2 — cadastro livre: diferente do ramo
     * delegado "clássico" (sempre escopo EQUIPE, na equipe do responsável),
     * aqui o perfil escolhido decide o escopo e a unidade/equipe é a que o
     * coordenador escolheu livremente (`formularioUsuario.unidadeId`/
     * `equipeIdCadastroUsuario`) — nunca a do próprio responsável.
     */
    const camposCadastroLivreStaging: Partial<Usuario> = perfilDelegado === 'GESTOR_UNIDADE'
      ? {
        perfil: 'GESTOR_UNIDADE',
        escopo: 'UNIDADE',
        unidadeId: formularioUsuario.unidadeId,
        unidadesPermitidas: formularioUsuario.unidadeId ? [formularioUsuario.unidadeId] : [],
      }
      : perfilDelegado === 'GESTOR_EQUIPE' || perfilDelegado === 'SUPERVISOR_EQUIPE'
        ? {
          perfil: perfilDelegado,
          escopo: 'EQUIPE',
          equipesPermitidas: equipeIdCadastroUsuario ? [equipeIdCadastroUsuario] : [],
        }
        : {};
    /**
     * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — GESTOR_UNIDADE usa
     * o mesmo formulário "Tipo de acesso" do admin (ver JSX acima), então
     * `formularioUsuario.perfil/escopo/equipeId/equipesPermitidas/unidadeId`
     * já chegam aqui com o payload canônico de `montarCamposAcessoUsuario()`
     * — tanto criando (valores fixados por `aplicarSelecaoAcessoUsuario`)
     * quanto editando (copiados do usuário carregado por
     * `abrirEdicaoUsuario()`, sem alteração se só `ativo`/`nome` mudou).
     * Nunca inclui `cadastroOperacional`: a Rule nova exige esse campo
     * ausente neste caminho (não é delegação via Matriz).
     */
    const camposGestorUnidade: Partial<Usuario> = souGestorUnidade && !souAdmin && participanteVinculoCadastro === null
      ? {
        perfil: formularioUsuario.perfil,
        escopo: formularioUsuario.escopo,
        equipeId: formularioUsuario.equipeId,
        equipesPermitidas: formularioUsuario.equipesPermitidas,
        unidadeId: formularioUsuario.unidadeId,
      }
      : {};
    const camposAdministrativos: Partial<Usuario> = souAdmin && participanteVinculoCadastro === null
      ? {
        perfil: formularioUsuario.perfil,
        escopo: formularioUsuario.escopo,
        // PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — causa raiz do bug real
        // (equipesPermitidas continha a equipe certa, mas equipeId nunca era
        // sobrescrito aqui e ficava herdado da equipe de quem cadastrava):
        // equipeId agora é sempre gravado a partir do formulário.
        equipeId: formularioUsuario.equipeId,
        unidadeId: formularioUsuario.unidadeId,
        unidadesPermitidas: formularioUsuario.unidadesPermitidas,
        equipesPermitidas: formularioUsuario.equipesPermitidas,
      }
      : souGestorUnidade
        ? camposGestorUnidade
        : usarCadastroLivreStaging && cadastroNovo
          ? camposCadastroLivreStaging
          : !souAdmin && cadastroNovo ? {
            perfil: perfilDelegado,
            escopo: perfilDelegado === undefined ? undefined : 'EQUIPE',
          } : {};
    // O cadastro livre de staging nunca carrega `cadastroOperacional`: a
    // autorização vem de `souCoordenadorOperacionalStaging()`, não da
    // delegação via Matriz — as Rules exigem esse campo ausente nesse ramo.
    // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — GESTOR_UNIDADE
    // também nunca carrega `cadastroOperacional`: a autorização vem de
    // `equipeDentroDoEscopoDeUnidade()`, não da Matriz — a Rule nova exige
    // esse campo ausente. Sem essa exclusão, `contextoCadastroOperacionalUsuario`
    // poderia resolver não-nulo (quando a equipe também aparece em
    // `escoposOperacionais.jornadasAdministraveis`) e derrubar as duas Rules
    // ao mesmo tempo: a antiga (por causa de equipesPermitidas/unidadeId
    // preenchidos) e a nova (por causa do cadastroOperacional preenchido).
    const metadadosCadastro: Partial<Usuario> = !souAdmin && !souGestorUnidade && cadastroNovo && !usarCadastroLivreStaging
      ? { cadastroOperacional: contextoCadastroOperacionalUsuario }
      : {};

    let candidato: Usuario;
    if (formularioUsuario.loginOriginal === null) {
      const responsavelCadastro = participanteVinculoCadastro === null
        && linhaConciliacaoVinculoCadastro === null
        && !usarCadastroLivreStaging
        ? usuarioEfetivo
        : {
          ...usuarioEfetivo,
          equipeId: equipeIdCadastroUsuario,
          uid: undefined,
        };
      candidato = {
        ...novoUsuario(
          usuarios.length + 1,
          responsavelCadastro,
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
        ...metadadosCadastro,
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

    /**
     * Correção CODB/NOC — até esta fase, um `GESTOR_UNIDADE` sem equipe
     * escolhida no select livre ganhava `equipeId` da primeira equipe ativa
     * da unidade "só como identidade técnica" (PATCH-CIRURGICO-JORNADA-
     * VINCULOS-USUARIOS-1/PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1). Bug
     * real: essa equipe preenchida automaticamente pode coincidir com
     * `responsaveisEquipe` da Matriz de alguma Jornada, e quando
     * `equipesPermitidas` está vazio, `minhasEquipesPermitidas()`
     * (`firestore.rules`) cai para `[equipeId]` — o coordenador ganha
     * administração daquela Jornada por acidente, nunca por
     * responsabilidade explícita. `GESTOR_UNIDADE` nunca deve ter
     * `equipeId` (`usuarioGestorUnidadeComEquipeIdInvalido()`,
     * `lib/perfilAcessoUsuario.ts` — `salvarUsuario()` já rejeita) — este
     * bloco de preenchimento automático foi removido, não substituído.
     */

    /**
     * PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — validações de coerência
     * do bloco "Permissões", aplicadas ao candidato FINAL (funciona tanto
     * para quem usou só o bloco simples quanto para quem editou "Avançado"
     * manualmente, já que os dois escrevem os mesmos campos técnicos).
     * Confirmação de acesso global é exigida sempre que o resultado final
     * é ADMIN_SISTEMA/GLOBAL, não só quando escolhido pelo seletor simples
     * — nunca enfraquece a trava por causa do caminho usado para chegar lá.
     */
    if ((souAdmin || souGestorUnidade) && participanteVinculoCadastro === null) {
      const exigeConfirmacaoGlobal = souAdmin && (candidato.perfil === 'ADMIN_SISTEMA' || candidato.escopo === 'GLOBAL');
      const errosAcesso = [
        ...validarCoerenciaAcessoUsuario(candidato),
        ...(exigeConfirmacaoGlobal && !formularioUsuario.confirmaAcessoGlobal
          ? ['Confirme que este usuário deve ter acesso administrativo global.']
          : []),
      ];
      if (errosAcesso.length > 0) {
        setErrosFormularioUsuario(errosAcesso);
        return;
      }
    }

    if (
      cadastroNovo
      && !souAdmin
      && cadastroUsuarioConcedeGestao(candidato)
      && !perfilDelegavelPorResponsavelOperacional(candidato.perfil, usarCadastroLivreStaging)
    ) {
      setErrosFormularioUsuario(usarCadastroLivreStaging
        ? ['Para cadastrar outro coordenador, selecione Gestor de unidade, Coordenador da equipe ou Supervisor da equipe. Administração global continua restrita ao ADMIN_SISTEMA.']
        : ['Para cadastrar outro coordenador, selecione Coordenador da equipe ou Supervisor da equipe. Administração global e gestão de unidade continuam restritas ao ADMIN_SISTEMA.']);
      return;
    }

    // PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — Gestor de unidade
    // administra a UNIDADE inteira; exigir equipe aqui repetiria a mesma
    // trava que motivou o cadastro livre em primeiro lugar.
    if (
      usarCadastroLivreStaging
      && cadastroNovo
      && formularioUsuario.perfil !== 'GESTOR_UNIDADE'
      && equipeIdCadastroUsuario.trim() === ''
    ) {
      setErrosFormularioUsuario(['Escolha uma equipe para o cadastro.']);
      return;
    }

    if (
      cadastroNovo
      && !souAdmin
      && !souGestorUnidade
      && !usarCadastroLivreStaging
      && contextoCadastroOperacionalUsuario === undefined
    ) {
      setErrosFormularioUsuario([
        'Você pode cadastrar pessoas somente na equipe de uma Jornada ou Plantão sob sua responsabilidade. Recarregue as operações e confirme o alvo selecionado.',
      ]);
      return;
    }

    // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — GESTOR_UNIDADE não
    // depende de `contextoCadastroOperacionalUsuario` (Matriz/Plantão): a
    // checagem equivalente aqui é simplesmente ter escolhido uma equipe do
    // próprio escopo de unidade.
    if (cadastroNovo && souGestorUnidade && !souAdmin && (candidato.equipeId ?? '').trim() === '') {
      setErrosFormularioUsuario(['Selecione uma equipe da sua unidade.']);
      return;
    }

    const erros = validarEdicaoUsuario(candidato, usuarios, formularioUsuario.loginOriginal);
    if (erros.length > 0) {
      setErrosFormularioUsuario(erros);
      return;
    }

    /**
     * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — `validarEdicaoUsuario()`
     * acima só compara contra a lista de UMA equipe (`usuarios`); um login
     * colidindo com outro cadastro ativo de OUTRA equipe passa despercebido
     * e o `setDoc({merge:true})` mescla silenciosamente no documento errado.
     * Só `souAdmin` tem `todosUsuariosAdmin` (leitura global) para detectar
     * isso — sem essa leitura, um `GESTOR_EQUIPE`/`GESTOR_UNIDADE` não
     * consegue provar a colisão sem violar o próprio escopo das Rules.
     */
    if (souAdmin && todosUsuariosAdmin.length > 0) {
      const colisaoLogin = todosUsuariosAdmin.find((item) =>
        item.login === candidato.login && item.login !== formularioUsuario.loginOriginal && item.ativo);
      const colisaoEmail = todosUsuariosAdmin.find((item) =>
        item.login !== candidato.login && item.email.trim().toLowerCase() === candidato.email.trim().toLowerCase() && item.ativo);
      const aliasesCandidato = new Set((candidato.aliasesPlanilha ?? []).map((alias) => normalizarNome(alias)));
      const colisaoAlias = aliasesCandidato.size === 0 ? undefined : todosUsuariosAdmin.find((item) =>
        item.login !== candidato.login && item.ativo
        && (item.aliasesPlanilha ?? []).some((alias) => aliasesCandidato.has(normalizarNome(alias))));
      if (colisaoLogin !== undefined) {
        setErrosFormularioUsuario([`O login ${candidato.login} já pertence a ${colisaoLogin.nome} (equipe ${colisaoLogin.equipeId}). Escolha outro login.`]);
        return;
      }
      if (colisaoEmail !== undefined) {
        setErrosFormularioUsuario([`O e-mail ${candidato.email} já está em uso por ${colisaoEmail.nome} (login ${colisaoEmail.login}).`]);
        return;
      }
      if (colisaoAlias !== undefined) {
        setErrosFormularioUsuario([`Um dos aliases já está em uso por ${colisaoAlias.nome} (login ${colisaoAlias.login}). Confira antes de salvar.`]);
        return;
      }
    }

    try {
      let usuarioSalvo = candidato;
      let cadastroReaproveitado = false;
      let houveEscritaUsuario = false;
      if (!modoDemo) {
        const usuariosDoAlvo = cadastroNovo && participanteVinculoCadastro !== null
          ? await listarUsuariosDoPlantao(equipeIdCadastroUsuario, grupoCadastroVinculo?.grupoId ?? '')
          : [];
        const existente = usuariosDoAlvo.find((item) => item.login === candidato.login);
        if (existente !== undefined) {
          if (normalizarNome(existente.nome) !== normalizarNome(candidato.nome)) {
            setErrosFormularioUsuario([
              `O login ${candidato.login} já pertence a ${existente.nome}. Selecione esse cadastro na busca ou informe outro login.`,
            ]);
            return;
          }
          if (!existente.ativo) {
            setErrosFormularioUsuario([
              `${existente.nome} já está cadastrado, mas está inativo. Peça a um administrador responsável para reativar o cadastro antes de vinculá-lo.`,
            ]);
            return;
          }
          const aliasesPlanilha = normalizarAliasesPlanilha([
            ...(existente.aliasesPlanilha ?? []),
            ...(candidato.aliasesPlanilha ?? []),
          ]);
          const aliasesMudaram = aliasesPlanilha.length !== (existente.aliasesPlanilha ?? []).length
            || aliasesPlanilha.some((alias, indice) => alias !== existente.aliasesPlanilha?.[indice]);
          if (aliasesMudaram) {
            await atualizarAliasesPlanilha(existente.login, aliasesPlanilha);
            houveEscritaUsuario = true;
          }
          usuarioSalvo = {
            ...existente,
            aliasesPlanilha,
            atualizadoEm: aliasesMudaram ? new Date().toISOString() : existente.atualizadoEm,
          };
          cadastroReaproveitado = true;
          setUsuarios(usuariosDoAlvo.map((item) => (item.login === usuarioSalvo.login ? usuarioSalvo : item)));
        } else {
          await salvarUsuario(candidato);
          houveEscritaUsuario = true;
        }
        if (houveEscritaUsuario) {
          await registrarAuditoriaOperacional('SALVAR_USUARIO', candidato.equipeId, linhaConciliacaoVinculoCadastro !== null
            ? {
              competencia: competenciaImportacaoJornadaAtual,
              nomeImportado: linhaConciliacaoVinculoCadastro.nomePlanilha,
              usuarioVinculadoLogin: usuarioSalvo.login,
              origem: 'IMPORTACAO_JORNADA',
            }
            : undefined);
        }
      }
      setUsuarios((atuais) => (atuais.some((item) => item.login === usuarioSalvo.login)
        ? atuais.map((item) => (item.login === usuarioSalvo.login ? usuarioSalvo : item))
        : [...atuais, usuarioSalvo]));
      if (participanteVinculoCadastro !== null) {
        confirmarVinculoPlantaoAcao(participanteVinculoCadastro, usuarioSalvo);
        setMensagem(cadastroReaproveitado
          ? `${usuarioSalvo.nome} já estava cadastrado e foi vinculado à pessoa encontrada na planilha.`
          : `${usuarioSalvo.nome} foi cadastrado e vinculado à pessoa encontrada na planilha.`);
      } else if (linhaConciliacaoVinculoCadastro !== null && arquivo !== null) {
        // PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — `usuarios` (estado)
        // ainda não reflete o `setUsuarios(...)` de cima nesta mesma
        // invocação; sem passar a lista já atualizada, `aplicarConciliacao`
        // reprocessava a planilha com um mapa de login sem o usuário recém
        // criado/vinculado, e o vínculo só aparecia depois de um reload.
        const usuariosComVinculoAtual = usuarios.some((item) => item.login === usuarioSalvo.login)
          ? usuarios.map((item) => (item.login === usuarioSalvo.login ? usuarioSalvo : item))
          : [...usuarios, usuarioSalvo];
        aplicarConciliacao(
          arquivo,
          linhasConciliacao.map((item) => (
            item === linhaConciliacaoVinculoCadastro ? resolverManualmente(item, usuarioSalvo) : item
          )),
          {},
          usuariosComVinculoAtual,
        );
        setMensagem(cadastroReaproveitado
          ? `${usuarioSalvo.nome} já estava cadastrado e foi vinculado a "${linhaConciliacaoVinculoCadastro.nomePlanilha}".`
          : `${usuarioSalvo.nome} foi cadastrado e vinculado a "${linhaConciliacaoVinculoCadastro.nomePlanilha}".`);
      } else {
        setMensagem(formularioUsuario.loginOriginal === null
          ? 'Usuário cadastrado com sucesso.'
          : 'Usuário atualizado com sucesso.');
      }
      fecharFormularioUsuario();
    } catch (falha) {
      const erroCadastro = falhaEhPermissionDenied(falha) && ambienteFirebaseAtual === 'staging'
        ? 'Não foi possível cadastrar o usuário em staging. A autorização do alvo foi recusada e nenhum cadastro foi alterado. Recarregue as operações e confirme se o Grupo e a Matriz de Responsáveis continuam ativos para sua conta.'
        : mensagemErroFirebase(falha, 'Não foi possível salvar o usuário.', ambienteFirebaseAtual);
      setErrosFormularioUsuario([erroCadastro]);
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
        await registrarAuditoriaOperacional('ATIVAR_DESATIVAR_USUARIO', atualizado.equipeId);
      }
      setUsuarios((atuais) => atuais.map((existente) => (existente.login === item.login ? atualizado : existente)));
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível atualizar o status do usuário.', ambienteFirebaseAtual));
    }
  }

  /**
   * FASE-ESCOPO-HIERARQUICO-CODB-E-ADMIN-PLANTAO-1 — grava a atribuição
   * "Responsável / Responsável por" do `AtribuirCoordenadorModal`: reusa
   * `salvarUsuario()` (mesma escrita de sempre em `usuarios/{login}`) —
   * nenhum mecanismo de autorização novo, só a UI simples por cima do
   * `perfil: 'GESTOR_UNIDADE'` que já existe.
   */
  async function salvarAtribuicaoCoordenador(usuario: Usuario) {
    if (escritaBloqueada) {
      setErroAtribuicaoCoordenador('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    setProcessandoAtribuicaoCoordenador(true);
    setErroAtribuicaoCoordenador('');
    try {
      if (!modoDemo) {
        await salvarUsuario(usuario);
        await registrarAuditoriaOperacional('ATRIBUIR_COORDENADOR_UNIDADE', usuario.equipeId, {
          unidadeId: usuario.unidadeId ?? null,
        });
      }
      setUsuarios((atuais) => atuais.map((existente) => (existente.login === usuario.login ? usuario : existente)));
      setTodosUsuariosAdmin((atuais) => atuais.map((existente) => (existente.login === usuario.login ? usuario : existente)));
      setModalAtribuirCoordenador(false);
      setMensagem(`${usuario.nome} agora administra ${usuario.unidadeId ?? 'a unidade escolhida'} e suas equipes.`);
    } catch (falha) {
      setErroAtribuicaoCoordenador(mensagemErroFirebase(falha, 'Não foi possível atribuir o coordenador.', ambienteFirebaseAtual));
    } finally {
      setProcessandoAtribuicaoCoordenador(false);
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
      competencia: resultado.documentos[0]?.competencia ?? competenciaOperacionalHoje,
      periodoInicio: resultado.periodoInicio,
      periodoFim: resultado.periodoFim,
    };
    const membro = criarMembroGrade(colaborador, membroGradeDraft.turnoPadrao, referencia, catalogo);
    try {
      if (!modoDemo) {
        await adicionarMembroRascunho(membro);
        await registrarAuditoriaOperacional('ADICIONAR_MEMBRO_GRADE', equipeIdDaGradeAtiva);
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

  /**
   * HOTFIX-ESCALA-ALERTA-TROCAS-1 — `plantoesAdministraveis` (via
   * `resolverMatrizOperacional()`) só é populado a partir de documentos
   * `escoposOperacionais` explícitos; um Grupo recém-criado ou duplicado
   * (ex.: por uma reimportação, o caso real que motivou esta correção)
   * NUNCA é registrado ali automaticamente (`salvarGrupoPlantao()` só
   * grava o próprio Grupo). Sem este segundo caminho, o botão de
   * Editar/Excluir ficava permanentemente invisível para exatamente o
   * Grupo problemático que o usuário precisa corrigir — mesmo já
   * administrando-o de fato. `podeGerenciarGrupoPlantao()` (`lib/sessao.ts`)
   * é o mirror client-side EXATO de `podeGerenciarGrupoPlantao()` em
   * `firestore.rules` (mesma função usada pelo wizard em
   * `criarGrupoWizard()` acima) — reconcilia aqui o gate de UX com a Rule
   * real, em vez de manter dois sistemas de autorização divergentes.
   */
  function podeGerenciarEsteGrupoPlantao(grupo: GrupoPlantao): boolean {
    return usuarioReal !== null
      && (
        escoposOperacionais.plantoesAdministraveis.some((item) => item.grupoId === grupo.grupoId)
        || podeGerenciarGrupoPlantao(usuarioReal, {
          equipeResponsavelId: grupo.equipeResponsavelId,
          unidadeResponsavelId: grupo.unidadeResponsavelId,
          caminhoUnidadeResponsavel: grupo.caminhoUnidadeResponsavel,
        })
      );
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
   * HOTFIX-ESCALA-ALERTA-TROCAS-1 — corrigir um Grupo criado por engano
   * (ex.: reimportação que duplicou em vez de atualizar o existente).
   * `excluirGrupoPlantao()` já recusa sozinha (com mensagem clara) quando
   * existe competência publicada — aqui só propagamos essa mensagem,
   * nunca escondemos.
   */
  async function confirmarExclusaoGrupoPlantao() {
    if (grupoPlantaoParaExcluir === null) {
      return;
    }
    setExcluindoGrupoPlantao(true);
    setErroExclusaoGrupoPlantao('');
    try {
      if (!modoDemo) {
        await excluirGrupoPlantao(grupoPlantaoParaExcluir.grupoId);
      }
      setGruposPlantaoAdmin((atuais) => atuais.filter((item) => item.grupoId !== grupoPlantaoParaExcluir.grupoId));
      setGrupoPlantaoParaExcluir(null);
    } catch (falha) {
      setErroExclusaoGrupoPlantao(mensagemErroFirebase(falha, 'Não foi possível excluir o grupo de Plantão.', ambienteFirebaseAtual));
    } finally {
      setExcluindoGrupoPlantao(false);
    }
  }

  /**
   * FASE-ESCOPO-HIERARQUICO-CODB-E-ADMIN-PLANTAO-1 — corrige uma publicação
   * de Plantão feita no Grupo/competência errado sem apagar histórico:
   * `cancelarCompetenciaPlantaoPublicada()` grava a transição PUBLICADA ->
   * CANCELADA (nunca delete físico); aqui só refletimos o resultado no
   * cache local (`resumosPlantaoDashboard`) para a tela atualizar sem
   * precisar recarregar.
   */
  async function confirmarCancelamentoPublicacaoPlantao(motivo: string) {
    if (publicacaoPlantaoParaCancelar === null || usuarioReal === null) {
      return;
    }
    const { grupo, competencia } = publicacaoPlantaoParaCancelar;
    setCancelandoPublicacaoPlantao(true);
    setErroCancelamentoPublicacaoPlantao('');
    try {
      const cancelada = modoDemo
        ? { ...competencia, status: 'CANCELADA' as const, canceladaEm: new Date().toISOString(), canceladaPorLogin: usuarioReal.login, motivoCancelamento: motivo.trim() }
        : await cancelarCompetenciaPlantaoPublicada(grupo.grupoId, competencia.competencia, motivo, usuarioReal.login);
      setResumosPlantaoDashboard((atuais) => {
        const chave = `${grupo.grupoId}:${competencia.competencia}`;
        const atual = atuais[chave];
        return atual === undefined ? atuais : { ...atuais, [chave]: { ...atual, competenciaPublicada: cancelada } };
      });
      await registrarAuditoriaOperacional('CANCELAR_PUBLICACAO_PLANTAO', grupo.equipeResponsavelId, {
        unidadeId: grupo.unidadeResponsavelId ?? null,
        competencia: competencia.competencia,
        origem: motivo.trim(),
      });
      setPublicacaoPlantaoParaCancelar(null);
    } catch (falha) {
      setErroCancelamentoPublicacaoPlantao(mensagemErroFirebase(falha, 'Não foi possível cancelar a publicação de Plantão.', ambienteFirebaseAtual));
    } finally {
      setCancelandoPublicacaoPlantao(false);
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
  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — devolve a mensagem de
   * erro (ou `null` em caso de sucesso) além de continuar preenchendo
   * `erroPlantaoAdmin` (usado por outros handlers desta tela). O modal
   * "Plantões visíveis" (`GrupoPlantaoVisibilidadeModal`) usa o retorno
   * diretamente para nunca mais engolir uma falha em silêncio — o bug real
   * encontrado era `erroPlantaoAdmin` nunca ser renderizado na aba
   * Organização, só em "Grupos de Plantão".
   */
  async function alternarPlantaoMonitoradoPelaEquipe(grupoId: string, equipeId: string, acao: 'ADICIONAR' | 'REMOVER'): Promise<string | null> {
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
      return null;
    } catch (falha) {
      const mensagem = mensagemErroFirebase(falha, 'Não foi possível atualizar os Plantões monitorados.', ambienteFirebaseAtual);
      setErroPlantaoAdmin(mensagem);
      return mensagem;
    }
  }

  /**
   * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — salva o rascunho do
   * modal "Plantões visíveis": calcula o diff contra o que já está
   * monitorado e aplica uma mudança de cada vez (a Rule só aceita alterar
   * UMA equipe de `equipesConsulta` por escrita). Para no primeiro erro e
   * mostra dentro do próprio modal — nunca mais silencioso.
   */
  async function salvarVisibilidadePlantaoDaEquipe(equipeId: string, grupoIdsSelecionados: string[]) {
    setSalvandoVisibilidadePlantao(true);
    setErroVisibilidadePlantao(null);
    const monitoradosAtuais = new Set(plantoesMonitoradosPelaEquipe(gruposPlantaoAdmin, equipeId).map((grupo) => grupo.grupoId));
    const selecionados = new Set(grupoIdsSelecionados);
    const adicionar = [...selecionados].filter((grupoId) => !monitoradosAtuais.has(grupoId));
    const remover = [...monitoradosAtuais].filter((grupoId) => !selecionados.has(grupoId));
    try {
      for (const grupoId of adicionar) {
        const erro = await alternarPlantaoMonitoradoPelaEquipe(grupoId, equipeId, 'ADICIONAR');
        if (erro !== null) {
          setErroVisibilidadePlantao(erro);
          return;
        }
      }
      for (const grupoId of remover) {
        const erro = await alternarPlantaoMonitoradoPelaEquipe(grupoId, equipeId, 'REMOVER');
        if (erro !== null) {
          setErroVisibilidadePlantao(erro);
          return;
        }
      }
      setModalVisibilidadePlantaoEquipeId(null);
    } finally {
      setSalvandoVisibilidadePlantao(false);
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
   *
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — passou a abrir
   * também uma competência JÁ PUBLICADA (`competenciaAlvo.status ===
   * 'PUBLICADA'`), não só rascunho. Antes, "Escalas > Plantão COSI" sem
   * nenhum rascunho aberto (o caso mais comum logo após publicar) não
   * tinha como reidratar a working copy — "Abrir editor" caía direto na
   * tela de importação em branco. Reidrata pela MESMA função
   * (`reidratarRascunhoPlantao`, que nunca olha `.status` — só monta a
   * working copy a partir de atribuições+participantes+competência já
   * carregados), só troca a FONTE da leitura (publicada vs rascunho) —
   * nunca um segundo modelo de dados para a mesma escala. Editar e depois
   * "Salvar rascunho" cria um novo rascunho normalmente; a publicação
   * atual nunca é sobrescrita direto.
   */
  async function abrirRascunhoNoEditorAcao(
    grupo: GrupoPlantao,
    competenciaAlvo: CompetenciaPlantao,
  ): Promise<{ ok: true } | { ok: false; motivo: 'nao-encontrado' } | { ok: false; motivo: 'erro'; mensagem: string }> {
    setAbrirRascunhoPlantaoStatus({ fase: 'carregando' });
    const abrindoPublicada = competenciaAlvo.status === 'PUBLICADA';
    try {
      const [atribuicoesPersistidas, participantes, competenciaFresca, usuariosDoGrupo] = await Promise.all([
        modoDemo ? Promise.resolve([]) : (abrindoPublicada
          ? listarAtribuicoesPlantaoPublicada(grupo.grupoId, competenciaAlvo.competencia)
          : listarAtribuicoesPlantaoRascunho(grupo.grupoId, competenciaAlvo.competencia)),
        modoDemo ? Promise.resolve(participantesPorGrupoPlantao[grupo.grupoId] ?? []) : listarParticipantesPlantao(grupo.grupoId),
        modoDemo ? Promise.resolve(competenciaAlvo) : (abrindoPublicada
          ? obterCompetenciaPlantaoPublicada(grupo.grupoId, competenciaAlvo.competencia)
          : obterCompetenciaPlantaoRascunho(grupo.grupoId, competenciaAlvo.competencia)),
        modoDemo ? Promise.resolve(usuarios) : listarUsuariosElegiveisPlantao(grupo.equipeResponsavelId, grupo.grupoId, grupo.unidadeResponsavelId, grupo.equipesConsulta),
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
        usuarios: usuariosDoGrupo,
      });

      if (!modoDemo) {
        setUsuarios(usuariosDoGrupo);
      }
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
      setFuncaoSelecionadaPlantao('TODOS');
      setGrupoRascunhoEscolhido(grupo.grupoId);
      setCompetenciaRascunho(reidratado.competencia.competencia);
      setPeriodoInicioRascunho(reidratado.competencia.periodoInicio);
      setPeriodoFimRascunho(reidratado.competencia.periodoFim);
      setErroRascunhoPlantao('');
      setRascunhoPlantaoSalvoEm(null);
      setTipoArquivoDetectado('PLANTAO');
      setContextoEscalaAtivo(criarContextoEscala('PLANTAO', grupo.grupoId, grupo.nome, reidratado.competencia.competencia));
      setContextoSemEscala(false);
      setMensagem(abrindoPublicada
        ? `Competência publicada aberta para conferência — "${grupo.nome}" (${reidratado.competencia.competencia}), revisão ${reidratado.competencia.revisao}. Qualquer alteração cria um novo rascunho, nunca sobrescreve a publicação atual.`
        : `Rascunho de Plantão reaberto — "${grupo.nome}" (${reidratado.competencia.competencia}). Nenhum dado foi publicado.`);
      setAbrirRascunhoPlantaoStatus(null);
      setTela('importar');
      return { ok: true };
    } catch (falha) {
      const mensagem = mensagemErroFirebase(falha, abrindoPublicada ? 'Não foi possível abrir a competência publicada.' : 'Não foi possível abrir este rascunho.', ambienteFirebaseAtual);
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
      setErroRascunhoPlantao('Você não está configurado como responsável por esta escala.');
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
      setErroRascunhoPlantao(mensagemErroEscritaOperacional(
        falha,
        'Não foi possível salvar o rascunho de Plantão.',
        podeGerenciarEsteGrupoPlantao(grupo),
      ));
    } finally {
      setSalvandoRascunhoPlantao(false);
    }
  }

  async function publicarPlantaoAcao() {
    if (usuarioReal === null || contextoPlantaoSomenteConsulta) {
      setErroRascunhoPlantao('Você não está configurado como responsável por esta escala.');
      return;
    }
    const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido);
    const competencia = (rascunhosPlantaoPorGrupo[grupoRascunhoEscolhido] ?? [])
      .find((item) => item.competencia === competenciaRascunho);
    if (grupo === undefined || competencia === undefined) {
      setErroRascunhoPlantao('Salve o rascunho antes de publicar o Plantão.');
      return;
    }
    if (!podeGerenciarEsteGrupoPlantao(grupo)) {
      setErroRascunhoPlantao('Você não está configurado como responsável por esta escala.');
      return;
    }
    setPublicandoPlantao(true);
    setErroRascunhoPlantao('');
    try {
      const atribuicoes = montarAtribuicoesPlantaoRascunho({
        grupoId: grupo.grupoId,
        competenciaId: competencia.id,
        atribuicoes: atribuicoesPlantaoComVinculo,
        timezone: grupo.timezone,
        origem: origemPlantaoAtual ?? competencia.origem,
        agoraIso: new Date().toISOString(),
      });
      const publicada = modoDemo
        ? { ...competencia, status: 'PUBLICADA' as const, revisao: Math.max(1, competencia.revisao + 1) }
        : await publicarCompetenciaPlantao(competencia, atribuicoes);
      setRascunhosPlantaoPorGrupo((atuais) => ({
        ...atuais,
        [grupo.grupoId]: (atuais[grupo.grupoId] ?? []).filter((item) => item.id !== competencia.id),
      }));
      setResumosPlantaoDashboard((atuais) => ({
        ...atuais,
        [`${grupo.grupoId}:${competencia.competencia}`]: {
          grupoId: grupo.grupoId,
          competencia: competencia.competencia,
          competenciaRascunho: null,
          competenciaPublicada: publicada,
          participantesAtivos: (participantesPorGrupoPlantao[grupo.grupoId] ?? []).filter((item) => item.ativo).length,
        },
      }));
      setRascunhoPlantaoSalvoEm(null);
      setContextoSemEscala(false);
      setMensagem(`Plantão "${grupo.nome}" publicado para ${competencia.competencia}.`);
      setTela('escalas');
    } catch (falha) {
      // PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — antes vinha `true` fixo aqui
      // (nunca recalculado), então a mensagem "as regras não reconhecem a
      // matriz" aparecia mesmo quando o coordenador JÁ era reconhecido
      // (`podeGerenciarEsteGrupoPlantao` verdadeiro) e a falha real era
      // outra coisa. Agora usa o mesmo cálculo dinâmico que
      // `salvarRascunhoPlantaoAcao()` já usa, para a mensagem refletir o
      // estado ATUAL, nunca um valor congelado.
      diagnosticarFalhaEscritaPlantao({
        operacao: 'publicarCompetenciaPlantao',
        caminho: `competenciasPlantao/${competencia.id}`,
        grupoId: grupo.grupoId,
        unidadeId: grupo.unidadeResponsavelId,
        equipeId: grupo.equipeResponsavelId,
        perfil: usuarioReal?.perfil,
        escopo: usuarioReal?.escopo,
        falha,
      });
      setErroRascunhoPlantao(mensagemErroEscritaOperacional(falha, 'Não foi possível publicar o Plantão.', podeGerenciarEsteGrupoPlantao(grupo)));
    } finally {
      setPublicandoPlantao(false);
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
      if (!modoDemo) recarregarOperacoes();
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
    void Promise.all([carregarUsuarios, listarEquipes(), listarSetores(), listarUnidadesOrganizacionais()])
      .then(([todos, equipes, setores, unidades]) => {
        if (!cancelado) {
          setTodosUsuariosAdmin(todos);
          setEquipesAdmin(equipes);
          setSetoresAdmin(setores);
          setUnidadesAdmin(unidades);
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
    /**
     * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — antes usava `Promise.all`: uma
     * ÚNICA sub-consulta negada (ex.: `listarGruposPlantaoPorUnidadeResponsavel`
     * para uma unidade cujas Rules de staging ainda não foram publicadas)
     * derrubava TODAS as outras, mesmo as que teriam sucesso — zerando
     * `gruposPlantaoAdmin` por completo. Isso tinha um efeito colateral
     * sério: com `gruposPlantaoAdmin` vazio, `idsEquipeResponsavelPlantao`
     * (`lib/escoposOperacionais.ts`) também fica vazio, e o fallback de
     * Jornada amplo deixa de conseguir EXCLUIR a equipe responsável por um
     * Grupo de Plantão — ela passa a aparecer como se fosse uma Jornada
     * (ex.: o card "Jornada" mostrando "Plantão COSI"). Agora tolera falha
     * parcial (`allSettled`, aproveita quem teve sucesso) e só propaga erro
     * quando TODAS as sub-consultas falharem — nunca esconde uma falha
     * total, mas também nunca zera o resultado por causa de uma falha
     * isolada.
     */
    const carregarGrupos = souAdmin
      ? listarTodosGruposPlantao()
      : Promise.allSettled([
        ...equipesPermitidasEfetivas(usuarioReal).map((equipeId) => listarGruposPlantaoPermitidos(equipeId)),
        ...(souGestorUnidade
          ? unidadesPermitidasEfetivas(usuarioReal).map((unidadeId) => listarGruposPlantaoPorUnidadeResponsavel(unidadeId))
          : []),
        ...(ehGestorDeEquipe ? [listarTodosGruposPlantao()] : []),
      ])
        .then((resultados) => {
          const porId = new Map<string, GrupoPlantao>();
          let algumSucesso = false;
          let primeiraFalha: unknown = null;
          for (const resultado of resultados) {
            if (resultado.status === 'fulfilled') {
              algumSucesso = true;
              for (const grupo of resultado.value) {
                porId.set(grupo.grupoId, grupo);
              }
            } else if (primeiraFalha === null) {
              primeiraFalha = resultado.reason;
            }
          }
          if (!algumSucesso && resultados.length > 0 && primeiraFalha !== null) {
            throw primeiraFalha;
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
    void Promise.allSettled([carregarGrupos, listarEquipes(), listarUnidadesOrganizacionais(), carregarUsuariosParaBusca])
      .then(([grupos, equipes, unidades, todosUsuarios]) => {
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
        setCarregandoEquipesPlantao(false);
      });
    return () => {
      cancelado = true;
    };
  }, [podeAcessarPlantoes, souAdmin, souGestorUnidade, modoDemo, usuarioReal]);

  /**
   * Carga única e total da matriz para o seletor e para as telas. O estado
   * terminal é sempre sucesso, vazio ou erro; o timeout impede que uma
   * conexão interrompida deixe a UI eternamente em "Carregando...".
   */
  useEffect(() => {
    if (modoDemo || usuarioReal === null) return undefined;
    let cancelado = false;
    void Promise.resolve().then(() => {
      if (!cancelado) setEstadoCarregamentoOperacoes({ fase: 'carregando' });
    });
    void carregarOperacoesComEstado({
      carregar: async () => {
        // Jornada (equipes/unidades/escopos) é a base de que TODA a
        // resolução depende (inclusive a de Plantão, que também lê
        // `escopos`) — segue lançando normalmente: sem isso não há operação
        // nenhuma pra mostrar. O que NUNCA pode acontecer é uma falha
        // exclusivamente do lado Plantão (ex.: grupoId órfão na matriz,
        // consulta ainda sem índice) apagar a Jornada/SOC que já resolveu
        // com sucesso — por isso a busca de `grupos` roda num try/catch
        // próprio, nunca dentro do mesmo `await` que decide o estado global.
        const [equipes, unidades, escopos] = await Promise.all([
          listarEquipes(),
          listarUnidadesOrganizacionais(),
          listarEscoposOperacionais(),
        ]);

        let grupos: GrupoPlantao[] = [];
        let erroPlantao: unknown = null;
        try {
          const idsPlantaoMatriz = [...new Set(escopos
            .filter((escopo) => escopo.ativo && escopo.tipo === 'PLANTAO')
            .filter((escopo) =>
              usuarioPodeAdministrarAlvoOperacional(usuarioReal, escopos, 'PLANTAO', escopo.alvoId)
              || usuarioPodeConsultarPlantaoOperacional(usuarioReal, escopos, escopo.alvoId))
            .map((escopo) => escopo.alvoId))];
          const resultadosGruposMatriz = await Promise.allSettled(
            idsPlantaoMatriz.map((grupoId) => obterGrupoPlantao(grupoId)),
          );
          const gruposDaMatriz = resultadosGruposMatriz
            .filter((resultado): resultado is PromiseFulfilledResult<GrupoPlantao | null> => resultado.status === 'fulfilled')
            .map((resultado) => resultado.value)
            .filter((grupo): grupo is GrupoPlantao => grupo !== null);
          const falhaGrupoMatriz = motivoLeituraRecusada(resultadosGruposMatriz);

          let gruposLegados: GrupoPlantao[] = [];
          let falhaLegado: unknown = null;
          // STAGING-RESET-HIERARQUIA-ICI-1 — `PERMITIR_AMPLO_STAGING` reusa a
          // MESMA busca ampla do fallback legado (por equipe/unidade
          // permitida, ou todos os grupos para GESTOR_EQUIPE/SUPERVISOR_EQUIPE):
          // é o candidato bruto que `resolverEscoposOperacionais()` depois
          // filtra por `escopoDoGrupoPlantaoNoMeuAlcance()`, mesmo quando a
          // Matriz já cobre o alvo (e não lista este usuário) — diferente do
          // fallback legado, que só preenche alvos SEM Matriz.
          if (PERMITIR_FALLBACK_OPERACIONAL_LEGADO || PERMITIR_AMPLO_STAGING) {
            try {
              const perfil = perfilEfetivo(usuarioReal);
              if (ehAdminSistema(usuarioReal)) {
                gruposLegados = await listarTodosGruposPlantao();
              } else {
                /**
                 * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — antes usava
                 * `Promise.all`: uma única sub-consulta negada (ex.: a
                 * unidade responsável ainda sem Rules de staging publicadas)
                 * derrubava TODAS as outras, zerando `gruposLegados` por
                 * completo mesmo quando outra sub-consulta teria sucesso.
                 * Com `gruposLegados` vazio, `idsEquipeResponsavelPlantao`
                 * (`lib/escoposOperacionais.ts`) também fica vazio e o
                 * fallback de Jornada amplo deixa de excluir a equipe
                 * responsável por um Grupo de Plantão — ela passa a
                 * aparecer como se fosse uma Jornada. Agora tolera falha
                 * parcial e só registra `falhaLegado` quando NENHUMA
                 * sub-consulta teve sucesso.
                 */
                const resultados = await Promise.allSettled([
                  ...equipesPermitidasEfetivas(usuarioReal).map((equipeId) => listarGruposPlantaoPermitidos(equipeId)),
                  ...(perfil === 'GESTOR_UNIDADE'
                    ? unidadesPermitidasEfetivas(usuarioReal).map((unidadeId) => listarGruposPlantaoPorUnidadeResponsavel(unidadeId))
                    : []),
                  ...(perfil === 'GESTOR_EQUIPE' || perfil === 'SUPERVISOR_EQUIPE'
                    ? [listarTodosGruposPlantao()]
                    : []),
                ]);
                const algumSucessoLegado = resultados.some((resultado) => resultado.status === 'fulfilled');
                gruposLegados = resultados
                  .filter((resultado): resultado is PromiseFulfilledResult<GrupoPlantao[]> => resultado.status === 'fulfilled')
                  .flatMap((resultado) => resultado.value);
                if (!algumSucessoLegado && resultados.length > 0) {
                  throw resultados.find((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected')?.reason;
                }
              }
            } catch (falha) {
              falhaLegado = falha;
            }
          }
          const gruposPorId = new Map<string, GrupoPlantao>();
          for (const grupo of [...gruposDaMatriz, ...gruposLegados]) gruposPorId.set(grupo.grupoId, grupo);
          grupos = [...gruposPorId.values()];
          erroPlantao = falhaGrupoMatriz ?? falhaLegado;
        } catch (falha) {
          erroPlantao = falha;
        }

        const resolucao = resolverEscoposOperacionais(
          usuarioReal,
          unidades,
          equipes,
          grupos,
          escopos,
          {
            permitirFallbackLegado: PERMITIR_FALLBACK_OPERACIONAL_LEGADO,
            permitirAmploStaging: PERMITIR_AMPLO_STAGING,
          },
        );
        return { equipes, unidades, escopos, grupos, resolucao, erroPlantao };
      },
      // Vazio de verdade é "sem NENHUMA Jornada e NENHUM Plantão" — uma
      // falha isolada do lado Plantão (erroPlantao != null) não conta como
      // "vazio" quando a Jornada resolveu operações; o aviso da falha some
      // como card local (`erroResumoPlantaoDashboard`), nunca como bloqueio
      // da tela inteira.
      estaVazio: ({ resolucao, erroPlantao }) =>
        erroPlantao === null
        && resolucao.jornadasAdministraveis.length === 0
        && resolucao.plantoesAdministraveis.length === 0
        && resolucao.plantoesMonitorados.length === 0,
    }).then((resultadoCarga) => {
      if (cancelado) return;
      setEstadoCarregamentoOperacoes(resultadoCarga.estado);
      setCarregandoEquipesPlantao(false);
      if ('dados' in resultadoCarga) {
        setEquipesAdmin(resultadoCarga.dados.equipes);
        setUnidadesAdmin(resultadoCarga.dados.unidades);
        setEscoposOperacionaisAdmin(resultadoCarga.dados.escopos);
        setGruposPlantaoAdmin(resultadoCarga.dados.grupos);
        setErroResumoJornadaDashboard('');
        setErroResumoPlantaoDashboard(resultadoCarga.dados.erroPlantao === null
          ? ''
          : mensagemFalhaLeituraParcial(resultadoCarga.dados.erroPlantao));
      }
    });
    return () => {
      cancelado = true;
    };
  }, [modoDemo, usuarioReal, tentativaCarregamentoOperacoes]);

  function recarregarOperacoes() {
    usuarioContextoRestauradoRef.current = null;
    setErroContextoEscala('');
    setAvisoContextoEscala('');
    setEstadoCarregamentoOperacoes({ fase: 'carregando' });
    setTentativaCarregamentoOperacoes((tentativa) => tentativa + 1);
  }

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
    setAvisoContextoEscala('');
    // PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — um id de "equipe:<id>" do
    // Grupo anterior pode nem existir no novo; volta sempre para "Todos".
    setFiltroSetorUsuario(FILTRO_SETOR_TODOS);
    /**
     * PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — capturado ANTES de qualquer
     * leitura assíncrona, porque esta função nunca chama `setTela()` antes
     * deste ponto: reflete exatamente a tela em que o usuário estava ao
     * pedir a troca. Usado para decidir se um redirecionamento automático
     * (`escalas`/`grade`) é necessário — nunca abandona uma tela de
     * navegação principal (Visão geral, Usuários, Trocas, Administração...)
     * só porque o contexto mudou.
     */
    const telaAntesDaTroca = tela;
    if (alvo.tipo === 'PLANTAO') {
      const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === alvo.alvoId);
      if (grupo === undefined) {
        setErroContextoEscala('Grupo de Plantão não encontrado — recarregue a página.');
        return;
      }
      setContextoEscalaAtivo(alvo);
      setContextoSemEscala(false);
      setCarregandoContexto(true);
      try {
        let competenciaExistente: CompetenciaPlantao | null = null;
        let competenciaPublicada: CompetenciaPlantao | null = null;
        if (!modoDemo) {
          const resultados = await executarComLimiteDeTempo(Promise.allSettled([
            obterCompetenciaPlantaoRascunho(grupo.grupoId, alvo.competencia),
            obterCompetenciaPlantaoPublicada(grupo.grupoId, alvo.competencia),
            /**
             * PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — antes, este pool só
             * era carregado dentro de `abrirRascunhoNoEditorAcao()`
             * (chamada só quando existe rascunho, logo abaixo). Um Plantão
             * já Publicado sem rascunho aberto (cenário mais comum depois
             * de publicar) deixava `usuarios` com o que quer que a última
             * troca de equipe tivesse carregado — a tela Usuários não
             * encontrava participantes reais do Plantão (ex.: busca por
             * "jean" vazia). Mesma função já usada pelo fluxo de
             * vínculo/importação — nenhuma regra nova, só chamada também
             * aqui.
             */
            listarUsuariosElegiveisPlantao(grupo.equipeResponsavelId, grupo.grupoId, grupo.unidadeResponsavelId, grupo.equipesConsulta),
          ]));
          competenciaExistente = valorLeitura(resultados[0], null);
          competenciaPublicada = valorLeitura(resultados[1], null);
          setUsuarios(valorLeitura(resultados[2], usuarios));
          if (
            competenciaExistente === null
          && competenciaPublicada === null
          && resultados.some((resultado) => resultado.status === 'rejected')
          ) {
            throw motivoLeituraRecusada(resultados);
          }
          const falhaParcial = motivoLeituraRecusada(resultados);
          if (falhaParcial !== null) {
            setAvisoContextoEscala(mensagemFalhaLeituraParcial(falhaParcial));
          }
        }
        if (competenciaExistente === null) {
          setContextoSemEscala(competenciaPublicada === null);
          if (competenciaPublicada !== null) {
            setResumosPlantaoDashboard((atuais) => ({
              ...atuais,
              [`${grupo.grupoId}:${alvo.competencia}`]: {
                grupoId: grupo.grupoId,
                competencia: alvo.competencia,
                competenciaRascunho: null,
                competenciaPublicada,
                participantesAtivos: (participantesPorGrupoPlantao[grupo.grupoId] ?? []).filter((item) => item.ativo).length,
              },
            }));
          }
          if (TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA.has(telaAntesDaTroca)) {
            setTela('escalas');
          }
          return;
        }
        const resultadoAbertura = await executarComLimiteDeTempo(
          abrirRascunhoNoEditorAcao(grupo, competenciaExistente),
        );
        if (resultadoAbertura.ok) {
          setContextoEscalaAtivo(alvo);
          setContextoSemEscala(false);
        } else if (resultadoAbertura.motivo === 'erro') {
          setErroContextoEscala(resultadoAbertura.mensagem);
        } else {
          setContextoEscalaAtivo(alvo);
          setContextoSemEscala(true);
          if (TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA.has(telaAntesDaTroca)) {
            setTela('escalas');
          }
        }
      } catch (falha) {
        const erro = estadoErroOperacoes(falha);
        setErroContextoEscala(falhaEhPermissionDenied(falha)
          ? MENSAGEM_RULES_LEITURA_OPERACIONAL
          : erro.diagnostico === 'REDE'
            ? erro.mensagem
            : mensagemErroFirebase(falha, 'Não foi possível carregar este Plantão.', ambienteFirebaseAtual));
      } finally {
        setCarregandoContexto(false);
      }
      return;
    }
    if (usuarioEfetivo === null) {
      return;
    }
    setContextoEscalaAtivo(alvo);
    setContextoSemEscala(false);
    setCarregandoContexto(true);
    try {
      let rascunhosExistentes: TurnosMes[];
      let publicadasExistentes: TurnosMes[];
      let usuariosDaEquipe: Awaited<ReturnType<typeof listarUsuarios>>;
      let catalogoDaEquipe: Awaited<ReturnType<typeof listarCatalogo>>;
      let historicoDaEquipe: Awaited<ReturnType<typeof listarHistoricoPublicacoes>>;
      let estadoPublicacaoDaEquipe: Awaited<ReturnType<typeof carregarEstadoPublicacao>>;
      if (modoDemo) {
        rascunhosExistentes = resultado?.documentos.filter((documento) => documento.competencia === alvo.competencia) ?? [];
        publicadasExistentes = [];
        usuariosDaEquipe = usuarios;
        catalogoDaEquipe = catalogo;
        historicoDaEquipe = historico;
        estadoPublicacaoDaEquipe = null;
      } else {
        const resultados = await executarComLimiteDeTempo(Promise.allSettled([
          carregarRascunhosEquipe(alvo.alvoId, alvo.competencia),
          carregarEscalasEquipe(alvo.alvoId, alvo.competencia, true),
          listarUsuarios(alvo.alvoId),
          listarCatalogo(alvo.alvoId),
          listarHistoricoPublicacoes(alvo.alvoId, alvo.competencia),
          carregarEstadoPublicacao(alvo.alvoId, alvo.competencia),
        ]));
        rascunhosExistentes = valorLeitura(resultados[0], []);
        publicadasExistentes = valorLeitura(resultados[1], []);
        usuariosDaEquipe = valorLeitura(resultados[2], []);
        catalogoDaEquipe = valorLeitura(resultados[3], {});
        historicoDaEquipe = valorLeitura(resultados[4], []);
        estadoPublicacaoDaEquipe = valorLeitura(resultados[5], null);
        if (resultados[2].status === 'rejected') throw resultados[2].reason;
        if (
          rascunhosExistentes.length === 0
        && publicadasExistentes.length === 0
        && (resultados[0].status === 'rejected' || resultados[1].status === 'rejected')
        ) {
          throw motivoLeituraRecusada([resultados[0], resultados[1]]);
        }
        const falhaParcial = motivoLeituraRecusada(resultados);
        if (falhaParcial !== null) {
          setAvisoContextoEscala(mensagemFalhaLeituraParcial(falhaParcial));
        }
      }
      const documentosExistentes: TurnosMes[] = rascunhosExistentes.length > 0
        ? [...rascunhosExistentes]
        : [...publicadasExistentes];
      if (!modoDemo) {
        setUsuarios(usuariosDaEquipe);
        setCatalogo(catalogoDaEquipe);
        setHistorico(historicoDaEquipe);
        setRevisaoAtual(estadoPublicacaoDaEquipe?.revisaoAtual ?? 0);
      }
      if (documentosExistentes.length === 0) {
        setResultado(null);
        setLinhasConciliacao([]);
        setJornadaPossuiAlteracoesNaoSalvas(false);
        setContextoSemEscala(true);
        if (TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA.has(telaAntesDaTroca)) {
          setTela('escalas');
        }
        return;
      }
      const datas = documentosExistentes.flatMap((documento) => Object.keys(documento.dias));
      const periodo = periodoDaCompetencia(alvo.competencia);
      setResultado({
        ok: true,
        equipeNome: alvo.label,
        periodoInicio: datas.sort()[0] ?? periodo?.periodoInicio ?? '',
        periodoFim: datas.sort().at(-1) ?? periodo?.periodoFim ?? '',
        totalDias: new Set(datas).size,
        documentos: documentosExistentes,
        erros: [],
        avisos: [],
      });
      setJornadaPossuiAlteracoesNaoSalvas(false);
      setContextoSemEscala(false);
      if (TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA.has(telaAntesDaTroca)) {
        setTela('grade');
      }
    } catch (falha) {
      const erro = estadoErroOperacoes(falha);
      setErroContextoEscala(falhaEhPermissionDenied(falha)
        ? MENSAGEM_RULES_LEITURA_OPERACIONAL
        : erro.diagnostico === 'REDE'
          ? erro.mensagem
          : mensagemErroFirebase(falha, 'Não foi possível carregar esta jornada.', ambienteFirebaseAtual));
    } finally {
      setCarregandoContexto(false);
    }
  }

  function aplicarTrocaCompetencia(novaCompetencia: string) {
    if (contextoEscalaAtivo === null) {
      return;
    }
    const alvo = criarContextoEscala(
      contextoEscalaAtivo.tipo,
      contextoEscalaAtivo.alvoId,
      contextoEscalaAtivo.label,
      novaCompetencia,
    );
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

  const contextosOperacionaisValidos: ContextoEscalaAtivo[] = useMemo(() => [
    ...escoposOperacionais.jornadasAdministraveis.map((equipe) =>
      criarContextoEscala('JORNADA', equipe.id, equipe.nome, competenciaOperacionalHoje)),
    ...escoposOperacionais.plantoesAdministraveis.map((grupo) =>
      criarContextoEscala('PLANTAO', grupo.grupoId, grupo.nome, competenciaOperacionalHoje)),
    ...escoposOperacionais.plantoesMonitorados.map((grupo) =>
      criarContextoEscala('PLANTAO', grupo.grupoId, grupo.nome, competenciaOperacionalHoje)),
  ], [escoposOperacionais, competenciaOperacionalHoje]);
  const chaveAlvosOperacionaisValidos = contextosOperacionaisValidos
    .map((contexto) => `${contexto.tipo}:${contexto.alvoId}`)
    .sort()
    .join('|');

  /** Restaura somente após a matriz terminar; alvo inválido é removido e exige nova seleção. */
  useEffect(() => {
    if (usuarioReal === null || estadoCarregamentoOperacoes.fase === 'carregando' || estadoCarregamentoOperacoes.fase === 'erro') {
      return undefined;
    }
    if (estadoCarregamentoOperacoes.fase === 'vazio') {
      if (typeof window !== 'undefined') limparContextoEscalaPersistido(usuarioReal.login, window.localStorage);
      usuarioContextoRestauradoRef.current = usuarioReal.login;
      void Promise.resolve().then(() => {
        setContextoEscalaAtivo(null);
        setContextoSemEscala(false);
      });
      return undefined;
    }
    if (usuarioContextoRestauradoRef.current === usuarioReal.login || carregandoContexto) return undefined;
    usuarioContextoRestauradoRef.current = usuarioReal.login;
    const restaurado = modoDemo || typeof window === 'undefined'
      ? { estado: 'ausente' as const }
      : restaurarContextoEscalaPersistido(
        usuarioReal.login,
        contextosOperacionaisValidos,
        window.localStorage,
        { competenciaInicial: competenciaOperacionalHoje },
      );
    if (restaurado.estado === 'invalido') {
      void Promise.resolve().then(() => {
        setContextoEscalaAtivo(null);
        setContextoSemEscala(false);
        setErroContextoEscala('A operação salva não está mais disponível. Selecione outra operação.');
      });
      return undefined;
    }
    const alvoInicial = restaurado.estado === 'valido'
      ? restaurado.contexto
      : contextosOperacionaisValidos[0] ?? null;
    if (alvoInicial !== null) {
      void Promise.resolve().then(() => aplicarTrocaContexto(alvoInicial));
    }
    return undefined;
    // A carga é deliberadamente única por login; as alterações posteriores
    // são tratadas pelo validador abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoContexto, chaveAlvosOperacionaisValidos, contextosOperacionaisValidos, estadoCarregamentoOperacoes.fase, modoDemo, usuarioReal]);

  /** Uma matriz alterada/inativada invalida imediatamente o contexto corrente. */
  useEffect(() => {
    if (usuarioReal === null || contextoEscalaAtivo === null || estadoCarregamentoOperacoes.fase !== 'sucesso') return;
    const aindaValido = contextosOperacionaisValidos.some((contexto) =>
      contexto.tipo === contextoEscalaAtivo.tipo && contexto.alvoId === contextoEscalaAtivo.alvoId);
    if (aindaValido) return;
    if (typeof window !== 'undefined') limparContextoEscalaPersistido(usuarioReal.login, window.localStorage);
    void Promise.resolve().then(() => {
      setContextoEscalaAtivo(null);
      setContextoSemEscala(false);
      setErroContextoEscala('A operação selecionada foi desativada ou removida. Selecione outra operação.');
    });
  }, [chaveAlvosOperacionaisValidos, contextoEscalaAtivo, contextosOperacionaisValidos, estadoCarregamentoOperacoes.fase, usuarioReal]);

  useEffect(() => {
    if (
      modoDemo
      || usuarioReal === null
      || contextoEscalaAtivo === null
      || estadoCarregamentoOperacoes.fase !== 'sucesso'
      || typeof window === 'undefined'
    ) return;
    const valido = contextosOperacionaisValidos.some((contexto) =>
      contexto.tipo === contextoEscalaAtivo.tipo && contexto.alvoId === contextoEscalaAtivo.alvoId);
    if (valido) salvarContextoEscalaPersistido(usuarioReal.login, contextoEscalaAtivo, window.localStorage);
  }, [chaveAlvosOperacionaisValidos, contextoEscalaAtivo, contextosOperacionaisValidos, estadoCarregamentoOperacoes.fase, modoDemo, usuarioReal]);

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
    setAvisoContextoEscala('');
    usuarioContextoRestauradoRef.current = null;
    setEstadoCarregamentoOperacoes({ fase: 'carregando' });
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
   * contexto ativo (ou `competenciaOperacionalHoje`, se nenhum contexto
   * foi selecionado ainda).
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
  const competenciaParaNovasOpcoes = contextoEscalaAtivo?.competencia ?? competenciaOperacionalHoje;
  /**
   * Uma equipe responsável exclusivamente por um Grupo de Plantão não é uma
   * Jornada 6x1 adicional. O coordenador do COSI pode ter EQ_SOC e
   * EQ_PLANTAO_COSI nas permissões; o topo deve mostrar SOC em Jornadas e o
   * Grupo Plantão em Plantões, sem transformar a equipe técnica de Plantão em
   * uma segunda Jornada. Se no futuro a mesma equipe tiver os dois produtos,
   * o contexto Jornada já ativo continua preservado.
   */
  function contextoOpcaoOperacao(operacao: OperacaoDashboard): ContextoEscalaAtivo {
    return criarContextoEscala(
      operacao.tipo,
      operacao.alvoId,
      operacao.nome,
      contextoEscalaAtivo !== null && contextoEscalaAtivo.tipo === operacao.tipo && contextoEscalaAtivo.alvoId === operacao.alvoId
        ? contextoEscalaAtivo.competencia
        : competenciaParaNovasOpcoes,
    );
  }
  /**
   * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — `solicitarTrocaContexto`
   * é um no-op quando `alvo` já é o contexto ativo (linha 8318), então um
   * clique no card já ativo do Hub não fazia nada visível. Espelha
   * exatamente o mesmo caminho do botão "Abrir editor"/"Abrir consulta"
   * (linha ~9446): contexto igual → abre o editor direto; contexto
   * diferente → passa pelo guard de alterações não salvas normalmente (o
   * Hub vive na tela 'escalas', que está em
   * `TELAS_DEPENDENTES_DO_CONTEXTO_ESCALA`, então a troca já abre a grade
   * sozinha ao concluir). Nenhum editor paralelo.
   */
  function abrirOperacaoDoHub(operacao: OperacaoDashboard) {
    const alvo = contextoOpcaoOperacao(operacao);
    if (contextosEscalaIguais(contextoEscalaAtivo, alvo)) {
      if (operacao.tipo === 'PLANTAO') {
        abrirEditorPlantaoDashboard();
      } else {
        setTela('grade');
      }
      return;
    }
    solicitarTrocaContexto(alvo);
  }
  const opcoesContextoJornada: OpcaoContextoEscala[] = operacoesDashboard
    .filter((operacao) => operacao.tipo === 'JORNADA')
    .map((operacao) => ({
      contexto: contextoOpcaoOperacao(operacao),
      rotuloPrincipal: operacao.nome,
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
   *
   * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — ambas as listas abaixo agora
   * filtram `operacoesDashboard` (a única fonte, `resolverOperacoesDashboard`)
   * em vez de mapear `escoposOperacionais` direto — o seletor superior e a
   * Visão geral nunca podem divergir sobre quais operações existem.
   */
  const opcoesContextoPlantao: OpcaoContextoEscala[] = operacoesDashboard
    .filter((operacao) => operacao.tipo === 'PLANTAO' && !operacao.consulta)
    .map((operacao) => {
      const grupo = escoposOperacionais.plantoesAdministraveis.find((item) => item.grupoId === operacao.alvoId);
      return {
        contexto: contextoOpcaoOperacao(operacao),
        rotuloPrincipal: operacao.nome,
        rotuloSecundario: equipesAdmin.find((item) => item.id === grupo?.equipeResponsavelId)?.nome ?? grupo?.equipeResponsavelId ?? '',
      };
    });
  /**
   * Fase ESCOPO-CONSULTA-PLANTAO-1 — seção separada de "Plantões
   * monitorados" no seletor superior: Grupos que a equipe do usuário só
   * CONSULTA (`plantoesConsultaveis`), nunca administra. Nunca aparece
   * misturado com `opcoesContextoPlantao` (administráveis) — consulta não
   * é administração.
   */
  const opcoesContextoPlantaoMonitorados: OpcaoContextoEscala[] = operacoesDashboard
    .filter((operacao) => operacao.tipo === 'PLANTAO' && operacao.consulta)
    .map((operacao) => {
      const grupo = escoposOperacionais.plantoesMonitorados.find((item) => item.grupoId === operacao.alvoId);
      return {
        contexto: contextoOpcaoOperacao(operacao),
        rotuloPrincipal: operacao.nome,
        rotuloSecundario: equipesAdmin.find((item) => item.id === grupo?.equipeResponsavelId)?.nome ?? grupo?.equipeResponsavelId ?? '',
      };
    });
  /**
   * Fase DASH-SIMPLES-1B — pessoas/alertas por operação para os cartões do
   * Hub de Escalas (`HubEscalasOperacoes`). Nunca uma segunda regra de
   * autorização/status: só lê os mesmos snapshots já carregados por
   * `operacoesDashboard`/`resumosJornadaDashboard`/`resumosPlantaoDashboard`
   * (o mesmo efeito que já popula os cards únicos da Visão geral, § 3 acima
   * — aqui generalizado para TODAS as Jornadas/Plantões administráveis, não
   * só "a" operação em destaque).
   *
   * Alertas de Plantão fora do editor continuam `null` (nunca "0"
   * inventado) — mesma regra de `plantaoAlertasDashboard` acima, § 8 de
   * `docs/spec/HUB_ESCALAS.md`: só é honesto assumir 0 quando o status já
   * confirma "sem-escala"; qualquer outro caso sem o editor aberto mostra
   * "Abra para conferir".
   */
  function pessoasOperacaoHub(operacao: OperacaoDashboard): number | null {
    if (operacao.tipo === 'JORNADA') {
      return resumosJornadaDashboard[`${operacao.alvoId}:${competenciaDashboard}`]?.colaboradoresAtivos ?? null;
    }
    return resumosPlantaoDashboard[`${operacao.alvoId}:${competenciaDashboard}`]?.participantesAtivos ?? null;
  }
  function alertasOperacaoHub(operacao: OperacaoDashboard): number | null {
    if (operacao.tipo === 'JORNADA') {
      if (operacao.status === 'sem-escala') {
        return 0;
      }
      const emEdicaoAoVivo = contextoEhJornada(contextoEscalaAtivo)
        && contextoEscalaAtivo.alvoId === operacao.alvoId
        && resultado !== null;
      if (emEdicaoAoVivo) {
        return alertasVisiveis.length;
      }
      const resumo = resumosJornadaDashboard[`${operacao.alvoId}:${competenciaDashboard}`] ?? null;
      if (resumo === null) {
        return null;
      }
      const alertasOperacionaisFora = gerarAlertasEscala(resumo.documentos, catalogo);
      return montarAlertasVisiveis(alertasOperacionaisFora, usuarios, resumo.documentos, resumo.publicadas).length;
    }
    if (operacao.status === 'sem-escala') {
      return 0;
    }
    const emEdicaoAoVivo = contextoEhPlantao(contextoEscalaAtivo)
      && contextoEscalaAtivo.alvoId === operacao.alvoId
      && resultadoPlantao !== null;
    return emEdicaoAoVivo && resultadoPlantao !== null
      ? resultadoPlantao.erros.length + resultadoPlantao.avisos.length + pendenciasVinculoPlantao
      : null;
  }
  const possuiOperacaoAdministravel = possuiOperacaoAdministravelHub(operacoesDashboard);
  /**
   * `true` quando o contexto de Plantão ativo agora é só consultável (o
   * grupo está em `plantoesConsultaveis`, nunca em `plantoesAdministraveis`)
   * — gate único usado para esconder/desabilitar toda ação de escrita
   * (editar, importar, salvar rascunho, publicar, configurar grupo, editar
   * participantes, usar período anterior) e mostrar o aviso "Somente
   * consulta".
   */
  const contextoPlantaoSomenteConsulta = contextoEhPlantao(contextoEscalaAtivo)
    && escoposOperacionais.plantoesConsultaveis.some((grupo) => grupo.grupoId === contextoEscalaAtivo.alvoId);
  const rotuloContextoAtivo = contextoEscalaAtivo === null
    ? estadoCarregamentoOperacoes.fase === 'erro'
      ? 'Operações indisponíveis'
      : estadoCarregamentoOperacoes.fase === 'vazio'
        ? 'Nenhuma operação configurada'
        : 'Selecionar escala'
    : contextoEscalaAtivo.label;
  const estadoEscalaAtiva = contextoEhPlantao(contextoEscalaAtivo)
    ? estadoPlantaoOperacionalDashboard
    : estadoJornadaOperacionalDashboard;
  /**
   * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — antes recalculava "Publicada"
   * para Jornada por conta própria (`documentos.length > 0 &&
   * publicados.length === documentos.length`), uma TERCEIRA derivação de
   * status independente de `estadoJornadaOperacionalDashboard`/
   * `estadoPlantaoOperacionalDashboard` (a mesma causa raiz do "status
   * operacional único": nada impedia essas três lógicas divergirem para a
   * mesma operação/competência). Agora só reaproveita `estadoEscalaAtiva`,
   * já calculado pela mesma função (`derivarStatusOperacaoDashboard`) usada
   * em toda outra tela.
   */
  const statusContextoAtivo: StatusContextoEscala | null = contextoEscalaAtivo === null
    ? null
    : contextoSemEscala
      ? 'sem-escala'
      : estadoEscalaAtiva;
  const rotuloEscalaAtiva = contextoEscalaAtivo?.label ?? 'Nenhuma escala selecionada';
  const periodoEscalaAtiva = contextoEhJornada(contextoEscalaAtivo) && resultado !== null
    ? `${formatarData(resultado.periodoInicio, opcoesDataResumoDashboard)} até ${formatarData(resultado.periodoFim, opcoesDataResumoDashboard)}`
    : contextoEhPlantao(contextoEscalaAtivo) && competenciaPlantaoExibidaDashboard !== null
      ? `${formatarData(competenciaPlantaoExibidaDashboard.periodoInicio, opcoesDataResumoDashboard)} até ${formatarData(competenciaPlantaoExibidaDashboard.periodoFim, opcoesDataResumoDashboard)}`
      : formatarCompetencia(contextoEscalaAtivo?.competencia ?? competenciaDashboard);
  const quantidadePessoasEscalaAtiva = contextoEhPlantao(contextoEscalaAtivo)
    ? participantesPlantaoDashboard
    : documentos.length;
  const [anoEscalaAtiva = '', mesEscalaAtiva = ''] = (contextoEscalaAtivo?.competencia ?? competenciaDashboard).split('-');
  const mesCurtoEscalaAtiva = /^\d{4}$/u.test(anoEscalaAtiva) && /^\d{2}$/u.test(mesEscalaAtiva)
    ? new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
      .format(new Date(`${anoEscalaAtiva}-${mesEscalaAtiva}-01T00:00:00.000Z`))
      .replace('.', '')
      .toUpperCase()
    : '—';

  function painelCarregamentoOperacoes(): ReactNode {
    if (estadoCarregamentoOperacoes.fase === 'sucesso') return null;
    if (estadoCarregamentoOperacoes.fase === 'carregando') {
      return (
        <article className="panel organization-empty-state" role="status">
          <LoaderCircle className="spin" size={28} aria-hidden="true" />
          <h2>Carregando operações de escala…</h2>
          <p>A Matriz de Responsáveis está sendo consultada.</p>
        </article>
      );
    }
    const vazio = estadoCarregamentoOperacoes.fase === 'vazio';
    return (
      <article className="panel organization-empty-state" role={vazio ? 'status' : 'alert'}>
        <AlertTriangle size={28} aria-hidden="true" />
        <h2>{vazio
          ? 'Nenhuma operação de escala configurada para este usuário.'
          : 'Não foi possível carregar as operações de escala'}</h2>
        <p>{vazio
          ? 'Peça para um ADMIN_SISTEMA criar um vínculo em Administração → Responsáveis por escala.'
          : estadoCarregamentoOperacoes.mensagem}</p>
        <div className="grade-header-actions">
          <button className="secondary-button" type="button" onClick={recarregarOperacoes}>
            <RotateCcw size={16} /> Recarregar operações
          </button>
          {souAdmin && (
            <button className="primary-button" type="button" onClick={() => setTela('responsaveisEscala')}>
              Ir para Responsáveis por escala
            </button>
          )}
        </div>
      </article>
    );
  }
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
          {/*
           * Fase DASH-SIMPLES-1A — a Visão geral já mostra as duas operações
           * (SOC/Plantão) ao mesmo tempo, lado a lado; o seletor de contexto
           * do header não filtra nem altera nenhum dado dela (ver
           * `resolverOperacoesDashboard()`, HOTFIX-PLANTAO-PUBLICADO-APP-E-
           * VISAO-GERAL-1). Mantê-lo ali era só carga cognitiva redundante —
           * "qual escala estou trabalhando agora" só faz sentido dentro do
           * workspace de Escalas, onde o seletor continua existindo,
           * inalterado.
           */}
          {tela !== 'visao' && (
            <>
              <ScheduleContextSwitcher
                contextoAtivo={contextoEscalaAtivo}
                rotuloContextoAtivo={rotuloContextoAtivo}
                opcoesJornada={opcoesContextoJornada}
                opcoesPlantao={opcoesContextoPlantao}
                opcoesPlantaoMonitorados={opcoesContextoPlantaoMonitorados}
                onSelecionar={solicitarTrocaContexto}
                carregando={carregandoContexto || estadoCarregamentoOperacoes.fase === 'carregando'}
              />
              <ScheduleCompetenceControl
                competencia={contextoEscalaAtivo?.competencia ?? null}
                onMudarCompetencia={solicitarTrocaCompetencia}
              />
              <ScheduleStatusBadge status={statusContextoAtivo} />
            </>
          )}
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
        <div className={`toast ${resultado !== null && temErroBloqueante(resultado.erros) ? 'error' : ''}`}>
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
          {estadoCarregamentoOperacoes.fase === 'sucesso' && erroResumoOperacionalDashboard !== '' && (
            <div className="alert warning" role="status">{erroResumoOperacionalDashboard}</div>
          )}
          <header className="page-heading overview-page-heading">
            <div>
              <p className="eyebrow">Operação integrada</p>
              <h1>Visão geral</h1>
              <p className="overview-subtitle">Acompanhe as duas operações em um só lugar.</p>
            </div>
              {estadoCarregamentoOperacoes.fase === 'sucesso' && <div className="overview-header-actions">
                <button className="secondary-button" type="button" onClick={abrirNovaEscala}>
                  <Plus size={17} /> Nova escala
                </button>
                <button className="primary-button" type="button" onClick={abrirImportarEscala}>
                  <Plus size={17} /> Importar escala
                </button>
              </div>}
          </header>

          {painelCarregamentoOperacoes()}
          {estadoCarregamentoOperacoes.fase === 'sucesso' && <>

          <div className="overview-operation-grid">
            <button
              className={`overview-operation-card ${socStatusDashboard}`}
              type="button"
              onClick={() => abrirOperacaoDoDashboard('JORNADA')}
            >
              <span className="overview-operation-card-heading">
                <span className="overview-operation-icon"><ShieldCheck size={22} /></span>
                <span className="overview-operation-title"><strong>{nomeJornadaDashboard}</strong><small>{rotuloEstadoEscalaOperacional(estadoJornadaOperacionalDashboard)}</small></span>
                <ChevronRight size={19} />
              </span>
              <span className="overview-operation-meta">
                <span><CalendarDays size={16} /><small>Competência ativa</small><strong>{formatarCompetencia(competenciaDashboard)}</strong><em>{periodoJornadaDashboard}</em></span>
                <span><Users size={16} /><small>Pessoas</small><strong>{colaboradoresJornadaDashboard}</strong><em>{colaboradoresJornadaDashboard === 0 ? 'Nenhum colaborador ativo encontrado para esta equipe.' : 'colaboradores'}</em></span>
                <span><AlertTriangle size={16} /><small>Alertas</small><strong>{alertasJornadaDashboard}</strong><em>{alertasJornadaDashboard > 0 ? 'necessitam atenção' : 'nenhum pendente'}</em></span>
              </span>
              <span className="overview-operation-action"><Pencil size={15} /> Abrir operação {nomeJornadaDashboard} <ArrowUpRight size={16} /></span>
            </button>

            {/*
             * PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — o card de Plantão só
             * existe quando o usuário TEM um Grupo de Plantão real no
             * escopo (`possuiOperacaoPlantaoDashboard`). Antes era
             * incondicional: quem não tem nenhum Plantão (ex.: supervisora
             * do NOC) via um card com o rótulo genérico "Plantão"
             * (fallback de `nomePlantaoDashboard`) em vez de nada — a causa
             * raiz do "card genérico Plantão" relatado.
             */}
            {possuiOperacaoPlantaoDashboard && (
            <button
              className={`overview-operation-card ${plantaoStatusDashboard}`}
              type="button"
              onClick={() => abrirOperacaoDoDashboard('PLANTAO')}
            >
              <span className="overview-operation-card-heading">
                <span className="overview-operation-icon plantao"><Radio size={22} /></span>
                <span className="overview-operation-title"><strong>{nomePlantaoDashboard}</strong><small>{rotuloEstadoEscalaOperacional(estadoPlantaoOperacionalDashboard)}</small></span>
                <ChevronRight size={19} />
              </span>
              <span className="overview-operation-meta">
                <span><CalendarDays size={16} /><small>Competência ativa</small><strong>{formatarCompetencia(competenciaPlantaoDashboard?.competencia ?? competenciaDashboard)}</strong><em>{periodoPlantaoDashboard}</em></span>
                <span><Users size={16} /><small>Pessoas</small><strong>{participantesPlantaoDashboard}</strong><em>participantes</em></span>
                <span><AlertTriangle size={16} /><small>Alertas</small><strong>{plantaoAlertasDashboard ?? '—'}</strong><em>{plantaoAlertasDashboard === null ? 'abra a operação para conferir' : plantaoPossuiEscalaDashboard ? 'na operação' : 'nenhuma escala criada'}</em></span>
              </span>
              <span className="overview-operation-action"><Radio size={15} /> Abrir operação {nomePlantaoDashboard} <ArrowUpRight size={16} /></span>
            </button>
            )}
          </div>

          {/*
           * Fase DASH-SIMPLES-1A — a Visão geral parava de ser uma
           * triagem e virava um mosaico repetindo, em texto e em barra,
           * a MESMA informação já legível nos cards operacionais acima
           * (status, alertas, competência). "Saúde das escalas" (barra
           * artificial em %), "Colaboradores"/"Dias no período" e o card
           * "Alertas por operação" saíram por não trazerem nenhuma
           * informação operacional que os cards já não mostrassem — ver
           * docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md § 7 (revisão
           * desta fase). "Publicação da escala" continua (é a única visão
           * lado a lado das duas operações) e um único painel "Pendências"
           * substitui "Alertas por operação" + "Trocas pendentes", em
           * linguagem humana, sem duplicar o que já está nos cards.
           */}
          <div className="overview-grid overview-secondary-grid">
            <article className="panel overview-span-4 overview-publication-card">
              <div className="panel-title"><div><h2>Publicação da escala</h2><p>Disponibilidade no aplicativo</p></div><ShieldCheck /></div>
              <div className="overview-operation-list">
                <button type="button" onClick={() => abrirOperacaoDoDashboard('JORNADA')}><ShieldCheck size={18} /><span><strong>{nomeJornadaDashboard}</strong><small>{resumoPublicacaoDashboard.titulo}</small></span><em className={resumoPublicacaoDashboard.estado}>{rotuloEstadoEscalaOperacional(estadoJornadaOperacionalDashboard)}</em><ChevronRight size={15} /></button>
                {possuiOperacaoPlantaoDashboard && (
                <button type="button" onClick={() => abrirOperacaoDoDashboard('PLANTAO')}><Radio size={18} /><span><strong>{nomePlantaoDashboard}</strong><small>{resumoPublicacaoPlantaoDashboard.titulo}</small></span><em className={resumoPublicacaoPlantaoDashboard.estado}>{rotuloEstadoEscalaOperacional(estadoPlantaoOperacionalDashboard)}</em><ChevronRight size={15} /></button>
                )}
              </div>
              <button className="overview-card-link" type="button" onClick={() => setTela('escalas')}>Ver escalas e histórico <ChevronRight size={16} /></button>
            </article>

            <article className="panel overview-span-8 overview-pendencias-card">
              <div className="panel-title"><div><h2>Pendências</h2><p>O que precisa da sua atenção agora</p></div><Bell size={18} /></div>
              <div className="overview-operation-list">
                <button type="button" onClick={() => setAlertaSelecionado(alertasVisiveis[0] ?? null)}>
                  <AlertTriangle size={18} />
                  <span><strong>{nomeJornadaDashboard}</strong><small>{alertasJornadaDashboard > 0 ? `${alertasJornadaDashboard} ${alertasJornadaDashboard === 1 ? 'alerta requer' : 'alertas requerem'} atenção` : 'Nenhum alerta pendente'}</small></span>
                  <ChevronRight size={15} />
                </button>
                {possuiOperacaoPlantaoDashboard && (
                <button type="button" onClick={() => abrirOperacaoDoDashboard('PLANTAO')}>
                  <AlertTriangle size={18} />
                  <span><strong>{nomePlantaoDashboard}</strong><small>{plantaoAlertasDashboard === null ? 'Alertas não disponíveis fora do editor — abra a operação para conferir' : plantaoAlertasDashboard > 0 ? `${plantaoAlertasDashboard} ${plantaoAlertasDashboard === 1 ? 'alerta requer' : 'alertas requerem'} atenção` : 'Nenhum alerta pendente'}</small></span>
                  <ChevronRight size={15} />
                </button>
                )}
                <button type="button" onClick={abrirTrocasDoDashboard}>
                  <ArrowLeftRight size={18} />
                  <span><strong>Trocas</strong><small>{trocasPendentesGestor.length === 0 ? 'Nenhuma troca aguardando aprovação' : `${trocasPendentesGestor.length} ${trocasPendentesGestor.length === 1 ? 'troca aguardando' : 'trocas aguardando'} aprovação`}</small></span>
                  <ChevronRight size={15} />
                </button>
              </div>
              {trocasPendentesGestor.length > 0 && (
              <div className="overview-swap-preview">
                {trocasPendentesGestor.slice(0, 2).map((troca) => (
                  <button key={troca.trocaId} type="button" onClick={() => { setTela('trocas'); setTrocaSelecionadaId(troca.trocaId); }}><ArrowLeftRight size={15} /><span><strong>{troca.solicitanteNome} ⇄ {troca.destinatarioNome}</strong><small>{formatarDataCurta(troca.data)} · {troca.turnoSolicitanteAntes} ⇄ {troca.turnoDestinatarioAntes}</small></span><ChevronRight size={14} /></button>
                ))}
              </div>
              )}
              {pendenciasDashboard === 0 && !existePendenciaDesconhecida && (
                <small className="overview-health-note">Nenhuma pendência operacional no momento.</small>
              )}
            </article>
          </div>
          </>}
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
          {tipoArquivoDetectado === 'PLANTAO' && origemPlantaoAtual !== null ? (
            <article className="panel plantao-command-panel" aria-label="Ações da escala de Plantão">
              <input
                ref={inputArquivo}
                type="file"
                accept=".xls,.xlsx"
                hidden
                onChange={(evento: ChangeEvent<HTMLInputElement>) =>
                  void receberArquivo(evento.target.files?.[0])}
              />
              <div className="plantao-command-head">
                <div className="plantao-command-file">
                  <span className="plantao-command-file-icon"><FileSpreadsheet size={19} /></span>
                  <span>
                    <small>{origemPlantaoAtual === 'IMPORTADO' ? 'Planilha em revisão' : 'Origem da escala'}</small>
                    <strong>
                      {origemPlantaoAtual === 'IMPORTADO'
                        ? (nomeArquivo || 'Planilha importada')
                        : origemPlantaoAtual === 'COPIADO' ? 'Período anterior' : 'Criação manual'}
                    </strong>
                  </span>
                </div>
                <div className="plantao-command-actions">
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={processando || contextoPlantaoSomenteConsulta}
                    onClick={() => inputArquivo.current?.click()}
                  >
                    {processando ? <LoaderCircle className="spin" size={15} /> : <UploadCloud size={15} />}
                    {origemPlantaoAtual === 'IMPORTADO' ? 'Importar outra planilha' : 'Importar planilha'}
                  </button>
                  <span className={`status-badge ${previaPlantaoValidada ? 'success' : pendenciasVinculoPlantao > 0 ? 'warning' : 'neutral'}`}>
                    {previaPlantaoValidada
                      ? 'Prévia validada'
                      : pendenciasVinculoPlantao > 0
                        ? `${pendenciasVinculoPlantao} vínculo(s) pendente(s)`
                        : 'Pronta para validar'}
                  </span>
                  {!contextoPlantaoSomenteConsulta && podeAcessarPlantoes && (
                    <>
                      <button
                        className="secondary-button compact-button"
                        type="button"
                        disabled={!previaPlantaoPodeValidar || previaPlantaoValidada}
                        onClick={validarPreviaPlantao}
                      >
                        <CheckCircle2 size={15} /> {previaPlantaoValidada ? 'Validada' : 'Validar prévia'}
                      </button>
                      <button
                        className="secondary-button compact-button"
                        type="button"
                        title={!previaPlantaoValidada ? 'Valide a prévia antes de salvar.' : undefined}
                        disabled={!previaPlantaoValidada || salvandoRascunhoPlantao || grupoRascunhoEscolhido === ''}
                        onClick={() => void salvarRascunhoPlantaoAcao()}
                      >
                        {salvandoRascunhoPlantao ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                        Salvar rascunho
                      </button>
                      {saudePlantaoRascunho !== null && (
                        <button
                          className="secondary-button compact-button"
                          type="button"
                          onClick={() => setRevisarPublicacaoPlantaoAberta(true)}
                        >
                          <ShieldCheck size={15} /> Revisar publicação
                        </button>
                      )}
                      <button
                        className="primary-button compact-button"
                        type="button"
                        title={
                          !rascunhoPlantaoProntoParaPublicar
                            ? 'Salve o rascunho atual antes de publicar.'
                            : !podePublicarPlantaoPelaSaude
                              ? 'Existem problemas que precisam ser corrigidos antes de publicar — veja "Revisar publicação".'
                              : undefined
                        }
                        disabled={publicandoPlantao || salvandoRascunhoPlantao || !rascunhoPlantaoProntoParaPublicar || !podePublicarPlantaoPelaSaude}
                        onClick={() => void publicarPlantaoAcao()}
                      >
                        {publicandoPlantao ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
                        Publicar Plantão
                      </button>
                    </>
                  )}
                </div>
              </div>

              {contextoPlantaoSomenteConsulta ? (
                <p className="plantao-command-note">
                  <ShieldCheck size={15} /> Somente consulta: sua equipe monitora este Plantão, sem edição ou publicação.
                </p>
              ) : !podeAcessarPlantoes ? (
                <p className="plantao-command-note warning">
                  <AlertTriangle size={15} /> Você não administra nenhum Grupo de Plantão.
                </p>
              ) : (
                <>
                  <div className="plantao-command-context">
                    <label htmlFor="rascunho-plantao-grupo">
                      <span>Grupo</span>
                      <select
                        id="rascunho-plantao-grupo"
                        value={grupoRascunhoEscolhido}
                        onChange={(evento) => {
                          setGrupoRascunhoEscolhido(evento.target.value);
                          setRascunhoPlantaoSalvoEm(null);
                          setPlantaoPossuiAlteracoesNaoSalvas(true);
                          setErroRascunhoPlantao('');
                          if (evento.target.value !== '') {
                            const grupo = gruposPlantaoAdmin.find((item) => item.grupoId === evento.target.value);
                            setContextoEscalaAtivo(criarContextoEscala(
                              'PLANTAO',
                              evento.target.value,
                              grupo?.nome ?? evento.target.value,
                              competenciaRascunho,
                            ));
                            setContextoSemEscala(false);
                          }
                        }}
                      >
                        <option value="">Selecione o grupo</option>
                        {gruposPlantaoAdmin.filter(podeGerenciarEsteGrupoPlantao).map((grupo) => (
                          <option key={grupo.grupoId} value={grupo.grupoId}>{grupo.nome}</option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor="rascunho-plantao-competencia">
                      <span>Competência</span>
                      <input
                        id="rascunho-plantao-competencia"
                        type="month"
                        value={competenciaRascunho}
                        onChange={(evento) => {
                          setCompetenciaRascunho(evento.target.value);
                          setRascunhoPlantaoSalvoEm(null);
                          setPlantaoPossuiAlteracoesNaoSalvas(true);
                        }}
                      />
                    </label>
                    <label htmlFor="rascunho-plantao-inicio">
                      <span>Início</span>
                      <input
                        id="rascunho-plantao-inicio"
                        type="date"
                        value={periodoInicioRascunho}
                        onChange={(evento) => {
                          setPeriodoInicioRascunho(evento.target.value);
                          setRascunhoPlantaoSalvoEm(null);
                          setPlantaoPossuiAlteracoesNaoSalvas(true);
                        }}
                      />
                    </label>
                    <label htmlFor="rascunho-plantao-fim">
                      <span>Fim</span>
                      <input
                        id="rascunho-plantao-fim"
                        type="date"
                        value={periodoFimRascunho}
                        onChange={(evento) => {
                          setPeriodoFimRascunho(evento.target.value);
                          setRascunhoPlantaoSalvoEm(null);
                          setPlantaoPossuiAlteracoesNaoSalvas(true);
                        }}
                      />
                    </label>
                    <button className="secondary-button compact-button" type="button" onClick={abrirNovoGrupoPlantao}>
                      <Plus size={15} /> Novo grupo
                    </button>
                  </div>
                  <div className="plantao-command-feedback">
                    <span>
                      {new Set(vinculosPlantao.map((vinculo) => vinculo.login).filter((login) => login !== null)).size}
                      {' '}participante(s) vinculados
                    </span>
                    {erroRascunhoPlantao && <span className="plantao-command-error">{erroRascunhoPlantao}</span>}
                    {rascunhoPlantaoSalvoEm !== null && (
                      <span className="plantao-command-saved"><ShieldCheck size={14} /> Rascunho salvo e pronto para publicar.</span>
                    )}
                  </div>
                </>
              )}
            </article>
          ) : (
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
                  <p><strong>Selecionar XLS ou XLSX</strong><span className="dropzone-dica"> · também aceita arrastar</span></p>
                  <small>Leitura local, sem envio automático</small>
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
                    <div>
                      <strong>{nomeArquivo}</strong>
                      <span>
                        {resultadoTemBloqueio
                          ? 'Aguardando correções'
                          : resultadoTemAlertaSemBloqueio ? 'Pronto para salvar (com alerta)' : 'Pronto para salvar'}
                      </span>
                    </div>
                    {processando
                      ? <LoaderCircle className="spin" />
                      : resultadoTemBloqueio
                        ? <AlertTriangle className="warning-icon" />
                        : <CheckCircle2 className="success-icon" />}
                  </div>
                  <div className="import-actions">
                    <button className="secondary-button" type="button" onClick={() => void carregarDemo()}>
                      Carregar exemplo
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={resultadoTemBloqueio || processando || escritaBloqueada || conciliacaoBloqueiaPublicacao}
                      onClick={() => void salvar()}
                    >
                      <Save size={17} /> Salvar rascunho
                    </button>
                  </div>
                </>
              )}
            </article>
          )}

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
              validada={previaPlantaoValidada}
              onCriarUsuarioParaVinculo={abrirCadastroUsuarioParaVinculo}
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
              funcoesEsperadas={gruposPlantaoAdmin.find((item) => item.grupoId === grupoRascunhoEscolhido)?.funcoesEsperadas ?? []}
              funcaoSelecionada={funcaoSelecionadaPlantao}
              onMudarFuncaoSelecionada={setFuncaoSelecionadaPlantao}
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
              funcoesDisponiveis={funcoesEsperadasRascunhoPlantao}
              onFechar={fecharModalAtribuicaoPlantao}
              onSalvar={salvarModalAtribuicaoPlantao}
              onExcluir={modalAtribuicaoPlantao.modo === 'editar' ? excluirModalAtribuicaoPlantao : undefined}
            />
          )}

          {revisarPublicacaoPlantaoAberta && saudePlantaoRascunho !== null && (
            <RevisarPublicacaoPlantaoModal
              nomeGrupo={grupoRascunhoPlantaoEmContexto?.nome ?? 'Plantão'}
              competenciaRotulo={formatarCompetencia(competenciaRascunho)}
              saude={saudePlantaoRascunho}
              funcoesEsperadas={funcoesEsperadasRascunhoPlantao}
              onFechar={() => setRevisarPublicacaoPlantaoAberta(false)}
              onNavegarParaFuncao={(funcao, destino) => {
                setFuncaoSelecionadaPlantao(funcao);
                setAbaPreviaPlantao(destino);
                setRevisarPublicacaoPlantaoAberta(false);
              }}
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

          {tipoArquivoDetectado !== 'PLANTAO' && (
            <>
            {resultado && resultado.erros.length > 0 && (
              <article className="panel error-panel">
                <div className="panel-title">
                  <div>
                    <h2>Corrigir inconsistências</h2>
                    <p>
                      {resultadoTemBloqueio
                        ? 'Nada será gravado enquanto houver erros bloqueantes.'
                        : 'Sem erros bloqueantes — dá para salvar rascunho. Publicar vai pedir confirmação e justificativa.'}
                    </p>
                  </div>
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
                    <thead><tr><th>Severidade</th><th>Local</th><th>Login</th><th>Valor</th><th>Motivo</th><th>Correção</th></tr></thead>
                    <tbody>
                      {resultado.erros.map((erro, indice) => (
                        <tr
                          key={`${erro.linha}-${erro.coluna}-${indice}`}
                          ref={(elemento) => { correcaoLinhaRefs.current[indice] = elemento; }}
                          className={indiceErroDestacado === indice ? 'linha-destacada' : undefined}
                        >
                          <td>
                            <span className={`status-badge ${erro.severidade === 'BLOQUEANTE' ? 'danger' : 'warning'}`}>
                              {erro.severidade === 'BLOQUEANTE' ? 'Bloqueante' : 'Alerta'}
                            </span>
                          </td>
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

            {resultado && resultado.documentos.length > 0 && (
              <ScheduleImportReview
                resultado={resultado}
                nomeArquivo={nomeArquivo}
                usuarios={usuarios}
                catalogo={catalogo}
                indiceAlertas={indiceAlertasGrade}
                linhasConciliacao={linhasConciliacao}
                escritaBloqueada={escritaBloqueada}
                onSelecionarVinculo={selecionarVinculoConciliacao}
                onCriarUsuario={abrirCadastroUsuarioParaConciliacao}
                onSalvarAlias={(linha) => void salvarAliasConciliacao(linha)}
                onMarcarPendente={marcarConciliacaoPendente}
                onIgnorar={ignorarConciliacao}
                onAjustarErro={focarErroNaTabela}
              />
            )}
            </>
          )}
        </section>
      )}

      {tela === 'escalas' && (
        <section>
          <header className="page-heading">
            <div><h1>Escalas</h1><p>Organize, revise e publique as escalas sob sua responsabilidade.</p></div>
            {estadoCarregamentoOperacoes.fase === 'sucesso' && possuiOperacaoAdministravel && <div className="grade-header-actions">
              <button className="secondary-button" type="button" onClick={abrirImportarEscala}>
                <UploadCloud size={17} /> Importar escala
              </button>
              <button className="primary-button" type="button" onClick={abrirNovaEscala}>
                <Plus size={17} /> Nova escala
              </button>
            </div>}
          </header>
          {painelCarregamentoOperacoes()}
          {estadoCarregamentoOperacoes.fase === 'sucesso' && <>
          <HubEscalasOperacoes
            operacoes={operacoesDashboard}
            competenciaFormatada={formatarCompetencia(competenciaDashboard)}
            pessoasPorOperacao={pessoasOperacaoHub}
            alertasPorOperacao={alertasOperacaoHub}
            onAbrir={abrirOperacaoDoHub}
          />
          {avisoContextoEscala !== '' && <div className="alert warning" role="status">{avisoContextoEscala}</div>}
          {erroContextoEscala !== '' && (
            <div className="alert error" role="alert">
              <span>{erroContextoEscala}</span>
              <button className="secondary-button" type="button" onClick={recarregarOperacoes}>
                <RotateCcw size={16} /> Recarregar operações
              </button>
            </div>
          )}
          {contextoEscalaAtivo === null && (
            <article className="panel organization-empty-state">
              <CalendarDays size={28} aria-hidden="true" />
              <h2>Nenhuma operação de escala selecionada</h2>
              <p>Selecione uma Jornada ou um Plantão no seletor superior.</p>
            </article>
          )}
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
          {contextoEscalaAtivo !== null && !contextoSemEscala && (
            <article className="panel scale-record">
              <div className="scale-period"><span>{mesCurtoEscalaAtiva}</span><strong>{anoEscalaAtiva}</strong></div>
              <div className="scale-info">
                <h2>{rotuloEscalaAtiva}</h2>
                <p>{periodoEscalaAtiva} · {quantidadePessoasEscalaAtiva} {contextoEhPlantao(contextoEscalaAtivo) ? 'participantes' : 'colaboradores'}</p>
                <span className={`status-badge ${estadoEscalaAtiva === 'publicada' ? 'success' : 'warning'}`}>
                  {rotuloEstadoEscalaOperacional(estadoEscalaAtiva)}
                </span>
                {revisaoAtual > 0 && <span className="revision-label">Revisão ativa {revisaoAtual}</span>}
              </div>
              <div className="scale-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => (contextoEhPlantao(contextoEscalaAtivo) ? abrirEditorPlantaoDashboard() : setTela('grade'))}
                >
                  {contextoPlantaoSomenteConsulta ? 'Abrir consulta' : 'Abrir editor'}
                </button>
                {contextoEhJornada(contextoEscalaAtivo) && documentos.length > 0 && publicados.length !== documentos.length && (
                  <button
                    className="secondary-button danger-button"
                    type="button"
                    disabled={processando || escritaBloqueada}
                    onClick={() => setDescarteRascunhoPendente(true)}
                  >
                    <Trash2 size={16} /> Descartar rascunho
                  </button>
                )}
                {contextoEhJornada(contextoEscalaAtivo) && <button
                  className="primary-button"
                  type="button"
                  disabled={!documentos.length || resultadoTemBloqueio || processando || escritaBloqueada || conciliacaoBloqueiaPublicacao}
                  onClick={() => {
                    setErroPublicacao('');
                    setPublicacaoPendente(true);
                  }}
                >
                  <Send size={16} /> Publicar
                </button>}
              </div>
            </article>
          )}
          {/*
           * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — este painel
           * inteiro é modelado em cima de `historico`/`detalhesPublicacao`
           * (formato `PublicacaoEscala`/rollback por dia — só existe para
           * Jornada 6x1). Nunca foi populado para Plantão
           * (`aplicarTrocaContexto` nunca chama `setHistorico` no branch
           * Plantão) — antes disso ficava visível mesmo em contexto
           * Plantão, mostrando histórico da Jornada anterior ou "Nenhuma
           * revisão encontrada" mesmo com uma publicação real. Corrigido
           * gateando por `contextoEhJornada`; o contexto Plantão mostra o
           * bloco de revisão abaixo (dados reais já existentes em
           * `CompetenciaPlantao.revisao`/`.atualizadoEm`/`.criadoPorLogin`
           * — nunca um histórico completo inventado, já que não existe
           * infraestrutura de múltiplas revisões para Plantão nesta fase).
           */}
          {contextoEhJornada(contextoEscalaAtivo) && (
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
          )}
          {contextoEhPlantao(contextoEscalaAtivo) && (
          <article className="panel publication-history-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Rastreabilidade local</p>
                <h2>Revisão publicada</h2>
                <p>Plantão ainda não tem histórico de múltiplas revisões nesta fase — mostra a publicação atual.</p>
              </div>
              <ShieldCheck />
            </div>
            {resumoPlantaoDashboard?.competenciaPublicada === null || resumoPlantaoDashboard?.competenciaPublicada === undefined ? (
              <div className="history-empty">
                <RotateCcw size={22} />
                <span>Nenhuma publicação encontrada para esta competência.</span>
              </div>
            ) : (
              <div className="publication-history-list">
                <div className="publication-history-entry">
                  <div className="publication-history-item">
                    <span className={`revision-dot ${resumoPlantaoDashboard.competenciaPublicada.status === 'CANCELADA' ? 'cancelada' : 'publicacao'}`} />
                    <div>
                      <strong>
                        Revisão {resumoPlantaoDashboard.competenciaPublicada.revisao}
                        {resumoPlantaoDashboard.competenciaPublicada.status === 'CANCELADA' && (
                          <span className="status-badge warning" style={{ marginLeft: 8 }}>Cancelada</span>
                        )}
                      </strong>
                      <span>Publicada por {resumoPlantaoDashboard.competenciaPublicada.criadoPorLogin}</span>
                      <small>{participantesPlantaoDashboard} participante(s) ativo(s)</small>
                      {resumoPlantaoDashboard.competenciaPublicada.status === 'CANCELADA' && (
                        <small>
                          Cancelada por {resumoPlantaoDashboard.competenciaPublicada.canceladaPorLogin} —{' '}
                          {resumoPlantaoDashboard.competenciaPublicada.motivoCancelamento}
                        </small>
                      )}
                    </div>
                    <time dateTime={resumoPlantaoDashboard.competenciaPublicada.atualizadoEm}>
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(resumoPlantaoDashboard.competenciaPublicada.atualizadoEm))}
                    </time>
                  </div>
                </div>
                {resumoPlantaoDashboard.competenciaPublicada.status === 'PUBLICADA'
                  && grupoPlantaoDashboard !== null
                  && usuarioReal !== null
                  && podeGerenciarGrupoPlantao(usuarioReal, grupoPlantaoDashboard) && (
                  <div className="wizard-actions">
                    <button
                      className="secondary-button danger-button"
                      type="button"
                      onClick={() => {
                        setErroCancelamentoPublicacaoPlantao('');
                        setPublicacaoPlantaoParaCancelar({
                          grupo: grupoPlantaoDashboard,
                          competencia: resumoPlantaoDashboard.competenciaPublicada as CompetenciaPlantao,
                        });
                      }}
                    >
                      Cancelar publicação
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
          )}
          </>}
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
              escritaBloqueada={escritaBloqueada}
              onSelecionarVinculo={selecionarVinculoConciliacao}
              onCriarUsuario={abrirCadastroUsuarioParaConciliacao}
              onSalvarAlias={(linha) => void salvarAliasConciliacao(linha)}
              onMarcarPendente={marcarConciliacaoPendente}
              onIgnorar={ignorarConciliacao}
              onAjustarErro={focarErroNaTabela}
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
              <label className="search-control"><Search size={16} /><input value={buscaUsuario} onChange={(evento) => setBuscaUsuario(evento.target.value)} placeholder="Buscar nome, login, e-mail, alias ou cargo" /></label>
              {/*
               * PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — só aparece quando o
               * contexto ativo é um Grupo de Plantão (pool amplo, que mistura
               * plantonistas com equipes que só consultam). Contexto Jornada
               * continua exatamente como antes — sem seletor.
               */}
              {opcoesFiltroSetorUsuarios.length > 0 && (
                <select
                  className="filtro-setor-usuarios"
                  value={filtroSetorUsuario}
                  onChange={(evento) => setFiltroSetorUsuario(evento.target.value)}
                  aria-label="Filtrar por setor/equipe"
                >
                  {opcoesFiltroSetorUsuarios.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
                </select>
              )}
              <span>
                <Users size={16} />
                {' '}
                {usuariosFiltrados.length === usuarios.length
                  ? `${usuarios.length} usuário${usuarios.length === 1 ? '' : 's'}`
                  : `${usuariosFiltrados.length} de ${usuarios.length} usuários`}
              </span>
            </div>
            {usuariosFiltrados.length === 0 ? (
              <p className="empty-inline">Nenhum usuário encontrado para este filtro.</p>
            ) : (
            <div className="table-scroll">
              <table className="data-table users-table">
                <thead><tr><th>Colaborador</th><th>Login de importação</th><th>Turno</th><th>Perfil</th><th>Status</th><th>Aliases da planilha</th><th>Ações</th></tr></thead>
                <tbody>
                  {usuariosFiltrados
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
            )}
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
          {gruposPlantaoAdmin.length > 0 && (
            <label className="busca-simples" htmlFor="grupos-plantao-busca">
              Buscar Plantão
              <input
                id="grupos-plantao-busca"
                type="text"
                placeholder="Buscar por nome (ex.: COSI, NOC, DBA)"
                value={filtroGrupoPlantaoLista}
                onChange={(evento) => setFiltroGrupoPlantaoLista(evento.target.value)}
              />
            </label>
          )}
          {gruposPlantaoAdmin
            .filter((grupo) => filtroGrupoPlantaoLista.trim() === '' || normalizarNome(grupo.nome).includes(normalizarNome(filtroGrupoPlantaoLista)))
            .map((grupo) => {
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
                    {gerencio && (
                      <button
                        className="icon-button"
                        type="button"
                        title="Excluir grupo (corrige um duplicado criado por engano)"
                        aria-label={`Excluir grupo ${grupo.nome}`}
                        onClick={() => { setErroExclusaoGrupoPlantao(''); setGrupoPlantaoParaExcluir(grupo); }}
                      >
                        <Trash2 size={15} />
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
            {souAdmin && (
              <button
                className="primary-button"
                type="button"
                onClick={() => { setErroAtribuicaoCoordenador(''); setModalAtribuirCoordenador(true); }}
              >
                Atribuir coordenador de unidade
              </button>
            )}
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
                        {item.nivelHierarquico !== undefined && (
                          <div><dt>Nível hierárquico</dt><dd>{descreverClassificacaoHierarquica(item.nivelHierarquico)}</dd></div>
                        )}
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
                        <div><dt>Código organizacional</dt><dd><code className="login-code">{codigoOrganizacionalEquipe(item, unidadesAdmin)}</code></dd></div>
                        <div><dt>ID técnico</dt><dd><code className="login-code">{item.id}</code></dd></div>
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
                      {/*
                       * FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 —
                       * visível para quem administra esta equipe
                       * (`minhasEquipesPermitidas`) e agora também para
                       * GESTOR_UNIDADE sobre qualquer equipe da própria
                       * unidade (a escrita real já é autorizada pela Rule
                       * de `podeAutoVincularConsultaPlantao`, estendida na
                       * mesma fase).
                       */}
                      {(souAdmin
                        || minhasEquipesPermitidas.includes(item.id)
                        || (souGestorUnidade && dentroDoEscopoPermitido(item.unidadeId, item.caminhoUnidade, minhasUnidadesPermitidas))) && (() => {
                        const monitorados = plantoesMonitoradosPelaEquipe(gruposPlantaoAdmin, item.id);
                        return (
                          <div className="organization-plantoes-monitorados">
                            <h4>Plantões visíveis para esta equipe</h4>
                            <p className="admin-form-preview">
                              Esta equipe poderá consultar quem está de plantão. Isso não permite editar participantes, contatos, rascunhos ou publicações.
                            </p>
                            {monitorados.length === 0 ? (
                              <p className="empty-inline">Nenhum Plantão monitorado por esta equipe ainda.</p>
                            ) : (
                              <ul className="organization-team-picker-resumo">
                                {monitorados.map((grupo) => (
                                  <li key={grupo.grupoId}>
                                    <div><strong>{grupo.nome}</strong></div>
                                    {grupo.equipeResponsavelId === item.id && (
                                      <span className="status-badge neutral">responsável — sempre monitorado</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => { setErroVisibilidadePlantao(null); setModalVisibilidadePlantaoEquipeId(item.id); }}
                            >
                              Configurar plantões visíveis
                            </button>
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
                <thead><tr><th>Código organizacional</th><th>Nome</th><th>Sigla</th><th>Unidade</th><th>Destino operacional</th><th>Status</th><th></th></tr></thead>
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
                      <td>
                        <code className="login-code" title={`ID técnico: ${item.id}`}>
                          {codigoOrganizacionalEquipe(item, unidadesAdmin)}
                        </code>
                      </td>
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
              {!podeExcluirCompetencia(competenciaExportar, competenciaOperacionalHoje) ? (
                <p className="admin-form-preview admin-form-full">
                  A competência atual (<strong>{competenciaOperacionalHoje}</strong>) não pode ser excluída por aqui.
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
                <input aria-label="ID do setor" placeholder="ID (ex.: SET_OPERACAO)" value={formSetor.id} onChange={(evento) => setFormSetor((atual) => ({ ...atual, id: evento.target.value }))} />
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
          unidades={unidadesAdmin}
          grupos={gruposPlantaoAdmin}
          usuarios={todosUsuariosAdmin.length > 0 ? todosUsuariosAdmin : usuarios}
          loginAtual={usuarioReal.login}
          onFechar={() => setModalResponsavelEscala(null)}
          onSalvar={salvarEscopoOperacionalDoModal}
          processando={processandoEscopoOperacional}
        />
      )}

      {modalAtribuirCoordenador && (
        <AtribuirCoordenadorModal
          usuarios={todosUsuariosAdmin.length > 0 ? todosUsuariosAdmin : usuarios}
          unidades={unidadesAdmin}
          erro={erroAtribuicaoCoordenador || undefined}
          processando={processandoAtribuicaoCoordenador}
          onFechar={() => setModalAtribuirCoordenador(false)}
          onSalvar={(usuario) => void salvarAtribuicaoCoordenador(usuario)}
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

      {grupoPlantaoParaExcluir && (
        <ModalConfirmarComTexto
          titulo={`Excluir ${grupoPlantaoParaExcluir.nome}`}
          mensagem={(
            <>
              <p>
                Remove permanentemente o grupo <strong>{grupoPlantaoParaExcluir.nome}</strong> (
                <code>{grupoPlantaoParaExcluir.grupoId}</code>) e{' '}
                {(participantesPorGrupoPlantao[grupoPlantaoParaExcluir.grupoId] ?? []).length} participante(s)
                cadastrado(s) nele. Use para corrigir um grupo criado por engano (ex.: duplicado numa
                reimportação).
              </p>
              <p>
                Esta ação é irreversível. Se este Plantão já tiver competência publicada ou cancelada, a
                exclusão será recusada — desative o grupo em vez disso. Para corrigir uma publicação
                errada, cancele a publicação (painel &ldquo;Revisão publicada&rdquo;) antes de desativar o grupo.
              </p>
              {erroExclusaoGrupoPlantao && <div className="alert error" role="alert">{erroExclusaoGrupoPlantao}</div>}
            </>
          )}
          fraseEsperada={grupoPlantaoParaExcluir.grupoId}
          rotuloBotaoConfirmar={excluindoGrupoPlantao ? 'Excluindo…' : 'Excluir grupo'}
          processando={excluindoGrupoPlantao}
          onFechar={() => setGrupoPlantaoParaExcluir(null)}
          onConfirmar={() => void confirmarExclusaoGrupoPlantao()}
        />
      )}

      {publicacaoPlantaoParaCancelar && (
        <CancelarPublicacaoPlantaoModal
          grupo={publicacaoPlantaoParaCancelar.grupo}
          competencia={publicacaoPlantaoParaCancelar.competencia}
          erro={erroCancelamentoPublicacaoPlantao || undefined}
          processando={cancelandoPublicacaoPlantao}
          onFechar={() => setPublicacaoPlantaoParaCancelar(null)}
          onConfirmar={(motivo) => void confirmarCancelamentoPublicacaoPlantao(motivo)}
        />
      )}

      {modalVisibilidadePlantaoEquipeId && (() => {
        const equipeAlvo = equipesAdmin.find((item) => item.id === modalVisibilidadePlantaoEquipeId);
        const grupoResponsavel = gruposPlantaoAdmin.find((grupo) => grupo.ativo && grupo.equipeResponsavelId === modalVisibilidadePlantaoEquipeId);
        return (
          <GrupoPlantaoVisibilidadeModal
            equipeNome={equipeAlvo?.nome ?? 'esta equipe'}
            equipeTravadaId={grupoResponsavel?.grupoId ?? ''}
            grupos={gruposPlantaoAdmin.filter((grupo) => grupo.ativo)}
            equipes={equipesAdmin}
            unidades={unidadesAdmin}
            valoresIniciais={plantoesMonitoradosPelaEquipe(gruposPlantaoAdmin, modalVisibilidadePlantaoEquipeId).map((grupo) => grupo.grupoId)}
            salvando={salvandoVisibilidadePlantao}
            erro={erroVisibilidadePlantao}
            onFechar={() => setModalVisibilidadePlantaoEquipeId(null)}
            onSalvar={(selecionados) => void salvarVisibilidadePlantaoDaEquipe(modalVisibilidadePlantaoEquipeId, selecionados)}
          />
        );
      })()}

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
                <h2 id="publication-title">
                  {resultadoTemAlertaSemBloqueio
                    ? `Esta escala possui ${resultado?.erros.length ?? 0} alerta(s). Deseja publicar mesmo assim?`
                    : 'Publicar nova versão da escala?'}
                </h2>
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
            {resultadoTemAlertaSemBloqueio && (
              <ul className="admin-form-preview">
                {resultado?.erros.map((erro, indice) => (
                  <li key={indice}>{erro.login ? `${erro.login}: ` : ''}{erro.motivo}</li>
                ))}
              </ul>
            )}
            <label className="publication-reason">
              {resultadoTemAlertaSemBloqueio ? 'Justificativa da exceção' : 'Motivo da publicação'}
              <textarea
                value={motivoPublicacao}
                onChange={(evento) => setMotivoPublicacao(evento.target.value)}
                placeholder={resultadoTemAlertaSemBloqueio
                  ? 'Ex.: Colaborador estará em curso no período da tarde.'
                  : 'Ex.: Ajuste da cobertura da madrugada'}
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
                disabled={processando || ((revisaoAtual > 0 || resultadoTemAlertaSemBloqueio) && motivoPublicacao.trim().length < 3)}
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
          // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — mesmo padrão
          // já usado em Grupos de Plantão (podeGerenciarEsteGrupoPlantao):
          // esconder Aprovar/Recusar quando o ator não administra esta
          // Jornada, em vez de deixar a Rule recusar a escrita depois.
          podeAprovarNoEscopo={souAdmin || escoposOperacionais.jornadasAdministraveis.some((equipe) => equipe.id === trocaSelecionada.equipeId)}
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
                  Nenhum colaborador ativo encontrado para esta equipe. Cadastre ou importe usuários antes de montar a escala.
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
                <p className="eyebrow">{participanteVinculoCadastro !== null || linhaConciliacaoVinculoCadastro !== null ? 'Vínculo da planilha' : formularioUsuario.loginOriginal === null ? 'Novo colaborador' : 'Editar colaborador'}</p>
                <h2 id="user-form-title">
                  {participanteVinculoCadastro !== null || linhaConciliacaoVinculoCadastro !== null
                    ? 'Criar e vincular colaborador'
                    : formularioUsuario.loginOriginal === null ? 'Cadastrar usuário' : formularioUsuario.nome || 'Editar usuário'}
                </h2>
                {participanteVinculoCadastro !== null && (
                  <p>Cadastre <strong>{participanteVinculoCadastro}</strong>. Ao salvar, o vínculo desta importação será confirmado automaticamente.</p>
                )}
                {linhaConciliacaoVinculoCadastro !== null && (
                  <p>Cadastre <strong>{linhaConciliacaoVinculoCadastro.nomePlanilha}</strong>. Ao salvar, o vínculo desta importação de Jornada será confirmado automaticamente.</p>
                )}
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
              {usarCadastroLivreStaging ? (
                <>
                  <label>
                    Unidade
                    <select
                      value={formularioUsuario.unidadeId ?? ''}
                      onChange={(evento) => {
                        const novaUnidadeId = evento.target.value || undefined;
                        const equipeAtual = equipesAdmin.find((equipe) => equipe.id === formularioUsuario.equipeId);
                        // PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — trocar
                        // de unidade nunca deixa uma equipe de outra árvore
                        // selecionada (ex.: GEDSI_CODB_NOC sobrevivendo à
                        // troca para GEDSI_COSI).
                        const equipeAindaValida = novaUnidadeId === undefined
                          || equipeAtual?.unidadeId === novaUnidadeId;
                        setFormularioUsuario({
                          ...formularioUsuario,
                          unidadeId: novaUnidadeId,
                          equipeId: equipeAindaValida ? formularioUsuario.equipeId : undefined,
                        });
                      }}
                    >
                      <option value="">Selecione uma unidade</option>
                      {unidadesAdmin.map((unidade) => (
                        <option key={unidade.unidadeId} value={unidade.unidadeId}>{rotuloTecnicoUnidade(unidade)}</option>
                      ))}
                    </select>
                    {unidadesAdmin.length === 0 && (
                      <small className="empty-inline">Nenhuma unidade ativa encontrada.</small>
                    )}
                  </label>
                  <label>
                    Equipe{formularioUsuario.perfil === 'GESTOR_UNIDADE' ? ' (opcional para Gestor de unidade)' : ''}
                    <select
                      value={formularioUsuario.equipeId ?? ''}
                      onChange={(evento) => setFormularioUsuario({
                        ...formularioUsuario,
                        equipeId: evento.target.value || undefined,
                      })}
                    >
                      <option value="">Selecione uma equipe</option>
                      {equipesDaUnidade(equipesAdmin, formularioUsuario.unidadeId).map((equipe) => (
                        <option key={equipe.id} value={equipe.id}>{rotuloTecnicoEquipe(equipe)}</option>
                      ))}
                    </select>
                    {equipesAdmin.length === 0 && (
                      <small className="empty-inline">Nenhuma equipe ativa encontrada.</small>
                    )}
                    {equipesAdmin.length > 0
                      && !formularioUsuario.equipeId
                      && formularioUsuario.perfil !== 'GESTOR_UNIDADE' && (
                      <small className="empty-inline">Selecione uma equipe da unidade escolhida.</small>
                    )}
                  </label>
                </>
              ) : (
                <label>
                  Equipe
                  <input value={rotuloEquipeCadastroUsuario} disabled />
                  {!souAdmin && !PERMITIR_AMPLO_STAGING && participanteVinculoCadastro === null && linhaConciliacaoVinculoCadastro === null && (
                    <small className="empty-inline">Permissão ampla de staging não está ativa; cadastro restrito à equipe atual.</small>
                  )}
                  {linhaConciliacaoVinculoCadastro !== null && (
                    <small>Equipe herdada da escala de Jornada em importação.</small>
                  )}
                </label>
              )}
              {!souAdmin && formularioUsuario.loginOriginal === null && (
                <label>
                  Acesso no sistema
                  <select
                    value={formularioUsuario.perfil ?? ''}
                    onChange={(evento) => {
                      const perfil = (evento.target.value || undefined) as FormularioUsuario['perfil'];
                      const delegaGestao = perfilDelegavelPorResponsavelOperacional(perfil, usarCadastroLivreStaging);
                      setFormularioUsuario({
                        ...formularioUsuario,
                        perfil,
                        nivelHierarquico: delegaGestao
                          ? Math.min(formularioUsuario.nivelHierarquico, 5)
                          : Math.max(formularioUsuario.nivelHierarquico, 6),
                      });
                    }}
                  >
                    <option value="">Colaborador da equipe</option>
                    {(usarCadastroLivreStaging ? PERFIS_DELEGAVEIS_STAGING : PERFIS_DELEGAVEIS_POR_RESPONSAVEL).map((perfil) => (
                      <option key={perfil} value={perfil}>{LABEL_PERFIL_DELEGAVEL[perfil]}</option>
                    ))}
                  </select>
                  <small>{usarCadastroLivreStaging
                    ? 'Em staging, você pode cadastrar colaboradores, gestores de unidade, coordenadores e supervisores em qualquer unidade/equipe ativa.'
                    : 'Você pode cadastrar colaboradores, coordenadores e supervisores somente nesta equipe.'}</small>
                </label>
              )}
              <label>
                Nível hierárquico
                <input
                  type="number"
                  min={!souAdmin
                    && formularioUsuario.loginOriginal === null
                    && !perfilDelegavelPorResponsavelOperacional(formularioUsuario.perfil, usarCadastroLivreStaging) ? 6 : 1}
                  value={formularioUsuario.nivelHierarquico}
                  onChange={(evento) => setFormularioUsuario({
                    ...formularioUsuario,
                    nivelHierarquico: Number(evento.target.value),
                  })}
                />
                <small>{descreverNivelHierarquico(formularioUsuario.nivelHierarquico)}</small>
              </label>
              <label>
                Turno padrão
                <select
                  value={formularioUsuario.turnoPadrao}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, turnoPadrao: evento.target.value })}
                >
                  <option value="">Selecione o período padrão</option>
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
              {(souAdmin || souGestorUnidade) && participanteVinculoCadastro === null && linhaConciliacaoVinculoCadastro === null && (() => {
                // FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — GESTOR_UNIDADE
                // usa o mesmo formulário simplificado que ADMIN_SISTEMA, restrito a
                // Colaborador/Supervisor/Gestor de equipe (nunca Gestor de
                // unidade/Administrador — a Rule também fecha esse enum, isto é só
                // a UI não oferecer uma opção que seria negada) e só às equipes do
                // próprio escopo de unidade — nunca a lista completa.
                const equipesVisiveis = souAdmin
                  ? equipesAdmin
                  : equipesAdmin.filter((equipe) => dentroDoEscopoPermitido(equipe.unidadeId, equipe.caminhoUnidade, minhasUnidadesPermitidas));
                const equipeEscolhida = equipesVisiveis.find((equipe) => equipe.id === formularioUsuario.equipeId);
                const unidadeEscolhida = unidadesAdmin.find((unidade) => unidade.unidadeId === formularioUsuario.unidadeId);
                const avisoCargo = avisoCargoDivergenteDaEquipe(formularioUsuario.cargo, formularioUsuario.equipeId, equipesVisiveis);
                const resumo = resumoAcessoUsuario(
                  { perfil: formularioUsuario.perfil, escopo: formularioUsuario.escopo },
                  {
                    rotuloEquipe: equipeEscolhida ? rotuloTecnicoEquipe(equipeEscolhida) : undefined,
                    rotuloUnidade: unidadeEscolhida ? rotuloTecnicoUnidade(unidadeEscolhida) : undefined,
                  },
                );
                return (
                  <fieldset className="user-form-full admin-only-fields">
                    <legend>Permissões</legend>
                    <p className="hint-text">
                      Na maioria dos casos, escolha apenas o tipo de acesso e a equipe ou unidade. Os
                      campos técnicos são preenchidos automaticamente.
                    </p>
                    <label>
                      Tipo de acesso
                      <select
                        value={formularioUsuario.tipoAcesso}
                        onChange={(evento) => aplicarSelecaoAcessoUsuario({ tipo: evento.target.value as TipoAcessoUsuario })}
                      >
                        <option value="COLABORADOR">Colaborador</option>
                        <option value="SUPERVISOR_EQUIPE">Supervisor de equipe</option>
                        <option value="GESTOR_EQUIPE">Gestor de equipe</option>
                        {souAdmin && <option value="GESTOR_UNIDADE">Gestor de unidade</option>}
                        {souAdmin && <option value="ADMIN_SISTEMA">Administrador do sistema</option>}
                      </select>
                    </label>
                    {(formularioUsuario.tipoAcesso === 'COLABORADOR'
                      || formularioUsuario.tipoAcesso === 'SUPERVISOR_EQUIPE'
                      || formularioUsuario.tipoAcesso === 'GESTOR_EQUIPE') && (
                      <label>
                        {formularioUsuario.tipoAcesso === 'COLABORADOR'
                          ? 'Equipe do colaborador'
                          : formularioUsuario.tipoAcesso === 'SUPERVISOR_EQUIPE'
                            ? 'Equipe supervisionada'
                            : 'Equipe gerenciada'}
                        <select
                          value={formularioUsuario.equipeId ?? ''}
                          onChange={(evento) => aplicarSelecaoAcessoUsuario({ equipeId: evento.target.value || undefined })}
                        >
                          <option value="">Selecione uma equipe</option>
                          {equipesVisiveis.map((equipe) => (
                            <option key={equipe.id} value={equipe.id}>
                              {rotuloTecnicoEquipe(equipe)}{!equipe.ativa && ' (inativa)'}
                            </option>
                          ))}
                        </select>
                        {(formularioUsuario.tipoAcesso === 'SUPERVISOR_EQUIPE'
                          || formularioUsuario.tipoAcesso === 'GESTOR_EQUIPE') && (
                          <small className="empty-inline">
                            Alcance restrito: administra somente a equipe escolhida acima — nenhuma outra
                            equipe da unidade é afetada.
                          </small>
                        )}
                      </label>
                    )}
                    {souAdmin && formularioUsuario.tipoAcesso === 'GESTOR_UNIDADE' && (
                      <label>
                        Unidade gerenciada
                        <select
                          value={formularioUsuario.unidadeId ?? ''}
                          onChange={(evento) => aplicarSelecaoAcessoUsuario({ unidadeId: evento.target.value || undefined })}
                        >
                          <option value="">Selecione uma unidade</option>
                          {unidadesAdmin.map((unidade) => (
                            <option key={unidade.unidadeId} value={unidade.unidadeId}>
                              {rotuloTecnicoUnidade(unidade)}{!unidade.ativa && ' (inativa)'}
                            </option>
                          ))}
                        </select>
                        <div className="alert warning" role="status">
                          <strong>Alcance amplo:</strong> administra TODAS as equipes desta unidade — inclusive
                          equipes criadas depois, sem precisar de nenhuma nova permissão.
                        </div>
                      </label>
                    )}
                    {souAdmin && formularioUsuario.tipoAcesso === 'ADMIN_SISTEMA' && (
                      <label className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={formularioUsuario.confirmaAcessoGlobal}
                          onChange={(evento) => aplicarSelecaoAcessoUsuario({ confirmaAcessoGlobal: evento.target.checked })}
                        />
                        Administrador do sistema possui acesso global. Use somente para contas técnicas ou
                        administradores reais.
                      </label>
                    )}
                    <div className="access-summary">
                      {resumo.map((linha) => <p key={linha} className="hint-text">{linha}</p>)}
                      {avisoCargo && <p className="hint-text warning-text">{avisoCargo}</p>}
                    </div>
                    {/*
                      FASE-FINAL-ESTABILIZACAO-ENTREGA-UX-PERMISSOES-1 — o painel
                      "Avançado" expõe perfil/escopo/unidadeId/unidadesPermitidas/
                      equipesPermitidas crus, sem a validação de coerência do
                      seletor simples: fica reservado a ADMIN_SISTEMA. GESTOR_UNIDADE
                      já tem tudo que precisa no seletor simples acima.
                    */}
                    {souAdmin && (
                    <details className="advanced-fields">
                      <summary>Avançado</summary>
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
                        Equipe (equipeId)
                        <select
                          value={formularioUsuario.equipeId ?? ''}
                          onChange={(evento) => setFormularioUsuario({
                            ...formularioUsuario,
                            equipeId: evento.target.value || undefined,
                          })}
                        >
                          <option value="">(nenhuma)</option>
                          {equipesAdmin.map((equipe) => (
                            <option key={equipe.id} value={equipe.id}>{rotuloTecnicoEquipe(equipe)}</option>
                          ))}
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
                    </details>
                    )}
                  </fieldset>
                );
              })()}
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
                <Save size={16} /> {participanteVinculoCadastro !== null || linhaConciliacaoVinculoCadastro !== null
                  ? 'Cadastrar e vincular'
                  : formularioUsuario.loginOriginal === null ? 'Cadastrar' : 'Salvar alterações'}
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
