'use client';

import {
  CATALOGO_SOC,
  calcularTotais,
  dataIsoLocal,
  formatarMinutos,
  parsePlanilhaEscala,
  type Dia,
  type ErroImportacao,
  type ResultadoParse,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  AlertTriangle,
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
  Plus,
  Power,
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
  EQUIPE_DEMO,
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
import {
  COMPETENCIA_ATUAL,
  ehAdminSistema,
  perfilEfetivo,
  unidadesPermitidasEfetivas,
} from '@/lib/sessao';
import {
  achatarArvore,
  calcularResumoOrganizacional,
  caminhoCurto,
  caminhoLegivel,
  construirArvoreUnidades,
  ehUsuarioTecnicoOuFake,
  formariaCiclo,
  gestoresParaSimulacao,
  type NoArvoreUnidade,
  rotuloGestorParaSimulacao,
  rotuloOpcaoUnidade,
  trechoFinalCaminho,
} from '@/lib/organizacao';
import { formatarDataHoraSafe } from '@/lib/dataSegura';
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
} from '@/lib/gradeMembros';
import { mapaLogins, normalizarAliasesPlanilha, novoUsuario, validarEdicaoUsuario } from '@/lib/importUsers';
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
  EventoEscala,
  LinhaConciliacao,
  PublicacaoEscala,
  Setor,
  TipoUnidadeOrganizacional,
  UnidadeOrganizacional,
  Usuario,
} from '@/lib/modelos';

type Tela = 'visao' | 'importar' | 'escalas' | 'grade' | 'usuarios' | 'trocas' | 'administracao';
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

interface CargaColaborador {
  login: string;
  nome: string;
  turnoPadrao: string;
  diasTrabalhados: number;
  folgas: number;
  minutos: number;
}

/**
 * Carga por colaborador — reaproveita `calcularTotais` (mesma função que
 * já alimenta "Horas planejadas" no metric-grid) para cada documento em
 * memória, sem nenhuma consulta nova. "Trabalhados" e "folgas" seguem a
 * mesma semântica de `Totais`: trabalhados = dias de categoria TRABALHO
 * (MD/M/T/N no catálogo atual — X e AFA não contam, por serem AUSENCIA);
 * folgas = DF + DU. BH (COMPENSACAO) e X (AUSENCIA) não entram em nenhuma
 * das duas colunas — ambíguo demais pra inventar uma terceira categoria
 * agora (ver Totais em packages/contrato/src/totais.ts).
 */
function montarCargaColaboradores(
  documentos: TurnosMes[],
  usuarios: Usuario[],
  catalogo: Record<string, TipoTurno>,
): CargaColaborador[] {
  const nomes = Object.fromEntries(usuarios.map((usuario) => [usuario.login, usuario.nome]));
  return documentos
    .map((documento): CargaColaborador => {
      const totais = calcularTotais(documento.dias, catalogo);
      return {
        login: documento.login,
        nome: nomes[documento.login] ?? documento.login,
        turnoPadrao: documento.turnoPadrao,
        diasTrabalhados: totais.diasTrabalhados,
        folgas: totais.df + totais.du,
        minutos: totais.min,
      };
    })
    .sort((a, b) => b.minutos - a.minutos || a.nome.localeCompare(b.nome));
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

const NAVEGACAO: ItemNavegacao[] = [
  { id: 'visao', rotulo: 'Visão geral', icone: 'home' },
  { id: 'importar', rotulo: 'Importar escala', icone: 'upload' },
  { id: 'escalas', rotulo: 'Escalas', icone: 'calendar' },
  { id: 'grade', rotulo: 'Grade', icone: 'grid' },
  { id: 'trocas', rotulo: 'Trocas', icone: 'trocas' },
  { id: 'usuarios', rotulo: 'Usuários', icone: 'users' },
  { id: 'administracao', rotulo: 'Administração', icone: 'admin' },
];

interface CelulaEditando {
  documento: TurnosMes;
  data: string;
  dia: Dia;
}

/**
 * Árvore simples (Parte 4 da correção UX/UI) — `<ul>`/`<li>` aninhados a
 * partir de `construirArvoreUnidades()` (lib/organizacao.ts), sem nenhuma
 * biblioteca de árvore. `podeEditar` decide, nó a nó, se o botão de editar
 * aparece (admin sempre; GESTOR_UNIDADE só dentro de `unidadesPermitidas`).
 */
function ArvoreUnidadesOrganizacionais({
  nos,
  podeEditar,
  aoEditar,
}: {
  nos: NoArvoreUnidade[];
  podeEditar: (unidadeId: string) => boolean;
  aoEditar: (unidade: UnidadeOrganizacional) => void;
}) {
  if (nos.length === 0) {
    return <p className="empty-inline">Nenhuma unidade organizacional cadastrada ainda.</p>;
  }
  return (
    <ul className="org-tree">
      {nos.map((no) => (
        <li key={no.unidade.unidadeId}>
          <div className="org-tree-node">
            <div className="org-tree-node-info">
              <strong>{no.unidade.nome}</strong>
              <small>{no.unidade.sigla}</small>
              <small>{no.unidade.tipo}</small>
              <span className={`status-badge ${no.unidade.ativa ? 'success' : 'neutral'}`}>
                {no.unidade.ativa ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            <div className="org-tree-node-actions">
              {podeEditar(no.unidade.unidadeId) && (
                <button
                  className="icon-button"
                  type="button"
                  title="Editar"
                  aria-label={`Editar unidade ${no.unidade.nome}`}
                  onClick={() => aoEditar(no.unidade)}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>
          {no.filhos.length > 0 && (
            <ArvoreUnidadesOrganizacionais nos={no.filhos} podeEditar={podeEditar} aoEditar={aoEditar} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Fecha qualquer modal ao apertar Esc — usado pelos modais novos desta correção de UX. */
function useTeclaEsc(aoFechar: () => void) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        aoFechar();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);
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
  const [tela, setTela] = useState<Tela>('importar');
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
  const [historico, setHistorico] = useState<PublicacaoEscala[]>([]);
  const [revisaoAtual, setRevisaoAtual] = useState(0);
  const [revisaoParaRestaurar, setRevisaoParaRestaurar] = useState<PublicacaoEscala | null>(null);
  const [publicacaoPendente, setPublicacaoPendente] = useState(false);
  const [erroPublicacao, setErroPublicacao] = useState('');
  const [motivoPublicacao, setMotivoPublicacao] = useState('');
  const [publicacaoExpandida, setPublicacaoExpandida] = useState<string | null>(null);
  const [detalhesPublicacao, setDetalhesPublicacao] = useState<Record<string, EventoEscala[]>>({});
  const [linhasConciliacao, setLinhasConciliacao] = useState<LinhaConciliacao[]>([]);
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
  const [erroAdmin, setErroAdmin] = useState('');
  const [formSetor, setFormSetor] = useState<Setor>({ id: '', nome: '', sigla: '', ativo: true });
  /**
   * `null` = modal fechado. Guarda o modo (criar/editar) e o valor inicial
   * do formulário — a edição em si vive dentro do modal (`ModalUnidadeOrganizacional`/
   * `ModalEquipe`), então não precisa de estado espelhado aqui fora.
   */
  const [modalUnidade, setModalUnidade] = useState<{ modo: 'criar' | 'editar'; inicial: UnidadeOrganizacional } | null>(null);
  const [modalEquipe, setModalEquipe] = useState<{ modo: 'criar' | 'editar'; inicial: Equipe } | null>(null);
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
  const minhasUnidadesPermitidas = usuarioReal !== null ? unidadesPermitidasEfetivas(usuarioReal) : [];
  const navegacaoVisivel = podeAcessarAdministracao
    ? NAVEGACAO
    : NAVEGACAO.filter((item) => item.id !== 'administracao');

  // --- Derivados da tela Administração (Resumo, árvore, filtros de Usuários) ---
  const arvoreUnidadesAdmin = construirArvoreUnidades(unidadesAdmin);
  const unidadesEmArvoreParaSelect = achatarArvore(arvoreUnidadesAdmin);
  const resumoOrganizacional = calcularResumoOrganizacional(unidadesAdmin, equipesAdmin, todosUsuariosAdmin);
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
  const cargaColaboradores = useMemo(
    () => montarCargaColaboradores(documentos, usuarios, catalogo),
    [documentos, usuarios, catalogo],
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

  useEffect(() => {
    if (usuarioEfetivo === null || !modoDemo || resultado !== null) {
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
  }, [modoDemo, resultado, usuarioEfetivo]);

  async function carregarDemo() {
    setProcessando(true);
    try {
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
      setTela('escalas');
    }
  }

  async function autenticar(autenticado: Usuario, demonstracao: boolean) {
    setUsuarioReal(autenticado);
    setModoDemo(demonstracao);
    if (!demonstracao) {
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

  function reparsear(buffer: ArrayBuffer, loginParaUid: Record<string, string>): ResultadoParse {
    return parsePlanilhaEscala(buffer, {
      equipeId: usuarioEfetivo?.equipeId ?? EQUIPE_DEMO.id,
      competencia: '2026-08',
      catalogo,
      loginParaUid,
    });
  }

  /**
   * Concilia os nomes da planilha com os usuários cadastrados e, quando a
   * conciliação resolve algo que o login exato não resolveu, reprocessa a
   * planilha com o mapa estendido — sem precisar reescrever o parser.
   */
  function aplicarConciliacao(buffer: ArrayBuffer, linhas: LinhaConciliacao[]) {
    setLinhasConciliacao(linhas);
    const parseado = linhas.some((linha) => linha.login !== null)
      ? reparsear(buffer, loginParaUidComConciliacao(mapaLogins(usuarios), linhas))
      : reparsear(buffer, mapaLogins(usuarios));
    setResultado(parseado);
    return parseado;
  }

  function interpretar(buffer: ArrayBuffer, nome: string) {
    setProcessando(true);
    setMensagem('');
    try {
      const primeiraLeitura = reparsear(buffer, mapaLogins(usuarios));
      const linhas = conciliarPlanilha(
        primeiraLeitura.documentos.map((documento) => documento.login),
        usuarios,
      );
      setArquivo(buffer);
      setNomeArquivo(nome);
      const parseado = aplicarConciliacao(buffer, linhas);
      setCorrecoes({});
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

  async function receberArquivo(file: File | undefined) {
    if (file === undefined) {
      return;
    }
    const extensaoValida = /\.(xls|xlsx)$/iu.test(file.name);
    if (!extensaoValida) {
      setMensagem('Selecione um arquivo XLS ou XLSX.');
      return;
    }
    interpretar(await file.arrayBuffer(), file.name);
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
      setMensagem('Rascunho salvo com sucesso. Nenhum arquivo foi enviado.');
      setTela('escalas');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível salvar.', ambienteFirebaseAtual));
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
      setMensagem('Escala publicada para a equipe.');
      setPublicacaoPendente(false);
      setMotivoPublicacao('');
    } catch (falha) {
      const texto = mensagemErroFirebase(falha, 'Falha na publicação.', ambienteFirebaseAtual);
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

    const atualizados = resultado.documentos.map((documento) => {
      if (documento.usuarioUid !== celulaEditando.documento.usuarioUid) {
        return documento;
      }
      const dias = { ...documento.dias, [celulaEditando.data]: novoDia };
      return { ...documento, dias, totais: calcularTotais(dias, catalogo) };
    });
    setResultado({ ...resultado, documentos: atualizados });
    setCelulaEditando(null);
    setMensagem('Célula atualizada no rascunho local. Salve para persistir.');
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
    if (membroGradeDraft === null || resultado === null || usuarioEfetivo === null) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    const colaborador = usuarios.find((item) => item.login === membroGradeDraft.login);
    if (colaborador === undefined) {
      setMensagem('Selecione um colaborador cadastrado.');
      return;
    }
    if (membroJaNaGrade(resultado.documentos, colaborador.login)) {
      setMensagem('Este colaborador já está na grade desta competência.');
      return;
    }
    const referencia = {
      equipeId: usuarioEfetivo.equipeId,
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
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível incluir o colaborador na grade.', ambienteFirebaseAtual));
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

  async function encerrarSessao() {
    await sair();
    setUsuarioReal(null);
    setSimulando(null);
    setResultado(null);
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

  return (
    <AppFrame
      produto="dashboard"
      usuario={usuarioParaFrame}
      competencia="Agosto 2026"
      itens={navegacaoVisivel}
      ativo={tela}
      onNavegar={(id) => setTela(id as Tela)}
      onSair={encerrarSessao}
      produtoHref={import.meta.env.VITE_EMPLOYEE_APP_URL ?? '/app'}
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
        <section className="overview-dashboard">
          <header className="page-heading">
            <div><p className="eyebrow">Operação SOC</p><h1>Visão geral</h1></div>
            <button className="primary-button" type="button" onClick={() => setTela('importar')}>
              <Plus size={17} /> Nova importação
            </button>
          </header>
          <div className="metric-grid">
            <article><span>Competência ativa</span><strong>Agosto 2026</strong><small>26 jul – 25 ago</small></article>
            <article><span>Colaboradores</span><strong>{totaisGerais.pessoas}</strong><small>vinculados ao SOC</small></article>
            <article><span>Dias no período</span><strong>{totaisGerais.dias}</strong><small>fechamento 26 → 25</small></article>
            <article><span>Horas planejadas</span><strong>{totaisGerais.horas}</strong><small>recalculadas dos dias</small></article>
          </div>
          <div className="overview-grid">
            <article className="panel overview-span-8">
              <div className="panel-title"><div><h2>Publicação da escala</h2><p>Disponibilidade no aplicativo</p></div><ShieldCheck /></div>
              <div className={`publication-progress ${resumoPublicacao.estado}`}>
                <strong>{resumoPublicacao.titulo}</strong>
                <p>{resumoPublicacao.descricao}</p>
                <div><i style={{ width: documentos.length ? `${(publicados.length / documentos.length) * 100}%` : '0%' }} /></div>
              </div>
            </article>
            <article className="panel quick-actions overview-span-4">
              <div className="panel-title"><div><h2>Próximas ações</h2><p>Fluxo recomendado</p></div></div>
              <button type="button" onClick={() => setTela('importar')}><UploadCloud /> Validar nova planilha <ArrowUpRight /></button>
              <button type="button" onClick={() => setTela('grade')}><Pencil /> Revisar a grade <ArrowUpRight /></button>
            </article>
          </div>
          <div className="overview-grid">
            <article className="panel grid-panel overview-span-4">
              <div className="panel-title">
                <div><h2>Alertas da escala</h2><p>Pontos que merecem atenção do gestor</p></div>
                <AlertTriangle />
              </div>
              {alertasVisiveis.length === 0 ? (
                <div className="notification-empty alert-summary-empty">
                  <ShieldCheck size={18} />
                  <strong>Nenhum alerta encontrado</strong>
                  <span>A escala atual não possui inconsistências conhecidas.</span>
                </div>
              ) : (
                <>
                  <p className="alert-summary-count">
                    {alertasVisiveis.length} {alertasVisiveis.length === 1 ? 'alerta encontrado' : 'alertas encontrados'}
                  </p>
                  <div className="alert-summary-list">
                    {alertasVisiveis.map((alerta) => (
                      <button
                        key={alerta.id}
                        type="button"
                        className="alert-item alert-item-button"
                        onClick={() => setAlertaSelecionado(alerta)}
                      >
                        <AlertTriangle
                          size={15}
                          className={alerta.severidade === 'critico' ? 'alert-icon-critico' : 'alert-icon-aviso'}
                        />
                        <div>
                          <strong>{alerta.colaborador ? `${alerta.colaborador} — ${alerta.titulo}` : alerta.titulo}</strong>
                          <small>{alerta.tipo}{alerta.data ? ` · ${formatarDataCurta(alerta.data)}` : ''}</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </article>
            <article className="panel grid-panel overview-span-4">
              <div className="panel-title">
                <div><h2>Carga por colaborador</h2><p>Distribuição de dias e horas no período</p></div>
                <Users />
              </div>
              {cargaColaboradores.length === 0 ? (
                <div className="notification-empty">
                  <Users size={18} />
                  <span>Nenhum colaborador na grade deste período.</span>
                </div>
              ) : (
                <div className="carga-colaborador-list">
                  {(() => {
                    const maiorMinutos = Math.max(...cargaColaboradores.map((item) => item.minutos), 1);
                    return cargaColaboradores.map((item, indice) => (
                      <div key={item.login} className="carga-colaborador-item">
                        <div className="carga-colaborador-info">
                          <span className="carga-colaborador-rank">{indice + 1}</span>
                          <div>
                            <strong>{item.nome}</strong>
                            <small>
                              {item.diasTrabalhados} {item.diasTrabalhados === 1 ? 'dia trabalhado' : 'dias trabalhados'}
                              {' · '}{item.folgas} {item.folgas === 1 ? 'folga' : 'folgas'}
                              {' · '}{formatarMinutos(item.minutos)}
                            </small>
                          </div>
                        </div>
                        <div className="carga-colaborador-bar">
                          <i style={{ width: `${(item.minutos / maiorMinutos) * 100}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </article>
            <article className="panel grid-panel overview-span-4">
              <div className="panel-title">
                <div><h2>Trocas pendentes</h2><p>Aguardando decisão do gestor</p></div>
                <ArrowLeftRight />
              </div>
              {trocasPendentesGestor.length === 0 ? (
                <div className="notification-empty">
                  <ArrowLeftRight size={18} />
                  <span>Nenhuma troca aguardando decisão agora.</span>
                </div>
              ) : (
                <div className="alert-summary-list">
                  {trocasPendentesGestor.map((troca) => (
                    <button
                      key={troca.trocaId}
                      type="button"
                      className="alert-item alert-item-button"
                      onClick={() => { setTela('trocas'); setTrocaSelecionadaId(troca.trocaId); }}
                    >
                      <ArrowLeftRight size={15} className="alert-icon-aviso" />
                      <div>
                        <strong>{troca.solicitanteNome} ⇄ {troca.destinatarioNome}</strong>
                        <small>{formatarDataCurta(troca.data)} · {troca.turnoSolicitanteAntes} ⇄ {troca.turnoDestinatarioAntes}</small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      )}

      {tela === 'importar' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Importação segura</p><h1>Importar escala</h1><p>O arquivo é processado somente na memória deste navegador.</p></div>
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
          </article>

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
            <article className="panel grid-panel">
              <div className="panel-title">
                <div><h2>Prévia da escala</h2><p>{resultado.equipeNome} · {resultado.periodoInicio} a {resultado.periodoFim}</p></div>
                <span className={`status-badge ${resultado.ok ? 'success' : 'danger'}`}>
                  {resultado.ok ? 'Sem erros' : `${resultado.erros.length} erros`}
                </span>
              </div>
              <ScheduleGrid
                documentos={resultado.documentos}
                usuarios={usuarios}
                catalogo={catalogo}
                indiceAlertas={indiceAlertasGrade}
                compacta
              />
            </article>
          )}
          {resultado && resultado.documentos.length > 0 && (
            <ScheduleLegend catalogo={catalogo} />
          )}
        </section>
      )}

      {tela === 'escalas' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Competências</p><h1>Escalas</h1><p>Rascunhos e publicações disponíveis para a equipe.</p></div>
            <button className="primary-button" type="button" onClick={() => setTela('importar')}>
              <Plus size={17} /> Importar
            </button>
          </header>
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
              <button className="secondary-button" type="button" onClick={() => setTela('grade')}>Revisar grade</button>
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
          <header className="page-heading">
            <div>
              <p className="eyebrow">Revisão completa</p>
              <h1>Grade da equipe</h1>
              <p>Clique em uma célula para editar o rascunho.</p>
            </div>
            <div className="grade-header-actions">
              <span className={`status-badge ${publicados.length === documentos.length && documentos.length ? 'success' : 'warning'}`}>
                {publicados.length === documentos.length && documentos.length ? 'Revisão publicada' : 'Rascunho não publicado'}
              </span>
              <button
                className="secondary-button"
                type="button"
                disabled={escritaBloqueada || !usuarios.length}
                onClick={abrirAdicionarMembroGrade}
              >
                <UserPlus size={16} /> Adicionar colaborador
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!documentos.length || escritaBloqueada}
                onClick={() => void salvar()}
              >
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
              onEditar={(documento, data, dia) => setCelulaEditando({ documento, data, dia })}
              onRemover={(documento) => setRemoverMembroPendente(documento)}
            />
          </article>
          <ScheduleLegend catalogo={catalogo} />
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
            <ArvoreUnidadesOrganizacionais
              nos={arvoreUnidadesAdmin}
              podeEditar={(unidadeId) => souAdmin || minhasUnidadesPermitidas.includes(unidadeId)}
              aoEditar={abrirEdicaoUnidade}
            />
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Caminho</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {unidadesAdmin.map((item) => (
                    <tr key={item.unidadeId}>
                      <td><code className="login-code">{item.unidadeId}</code></td>
                      <td>{item.nome}</td>
                      <td>{item.tipo}</td>
                      <td title={caminhoLegivel(item.caminho, unidadesAdmin)}>{caminhoCurto(item.caminho, unidadesAdmin, 2)}</td>
                      <td><span className={`status-badge ${item.ativa ? 'success' : 'neutral'}`}>{item.ativa ? 'Ativa' : 'Inativa'}</span></td>
                      <td>
                        {(souAdmin || minhasUnidadesPermitidas.includes(item.unidadeId)) && (
                          <button
                            className="icon-button"
                            type="button"
                            title="Editar"
                            aria-label={`Editar unidade ${item.nome}`}
                            onClick={() => abrirEdicaoUnidade(item)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <thead><tr><th>ID</th><th>Nome</th><th>Sigla</th><th>Unidade</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {equipesAdmin.map((item) => (
                    <tr key={item.id}>
                      <td><code className="login-code">{item.id}</code></td>
                      <td>{item.nome}</td>
                      <td>{item.sigla}</td>
                      <td title={item.caminhoUnidade ? caminhoLegivel(item.caminhoUnidade, unidadesAdmin) : undefined}>
                        {item.caminhoUnidade ? caminhoCurto(item.caminhoUnidade, unidadesAdmin, 2) : '—'}
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
                  ))}
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
              <label className="user-form-full">
                Colaborador
                <select
                  value={membroGradeDraft.login}
                  onChange={(evento) => setMembroGradeDraft({ ...membroGradeDraft, login: evento.target.value })}
                >
                  <option value="">Selecionar usuário cadastrado…</option>
                  {usuarios
                    .filter((item) => !membroJaNaGrade(documentos, item.login))
                    .map((item) => (
                      <option key={item.login} value={item.login}>
                        {item.nome}{item.ativo ? '' : ' (inativo)'}
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
                disabled={!membroGradeDraft.login}
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
