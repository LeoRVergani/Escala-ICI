'use client';

import {
  CATALOGO_SOC,
  calcularTotais,
  competenciaOperacional,
  competenciasCandidatas,
  converterInstanteUtcParaMomento,
  formatarCompetencia,
  formatarData,
  formatarMinutos,
  formatarPeriodo,
  MAXIMO_CONTATOS_PLANTONISTA,
  referenciaLocal,
  resolverContextoJornada,
  resolverJornadaDia,
  selecionarEscalaPorData,
  type AtribuicaoPlantaoPersistida,
  type ContatoPlantonista,
  type ContextoJornada,
  type GrupoPlantao,
  type IntervaloTurno,
  type ParticipantePlantao,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  ArrowLeftRight,
  BellOff,
  BriefcaseBusiness,
  Bell,
  BellRing,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Filter,
  List,
  LoaderCircle,
  LogOut,
  Mail,
  Moon,
  Phone,
  Plus,
  RefreshCw,
  Radio,
  Search,
  ShieldCheck,
  Sunrise,
  Sunset,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AppFrame, type ItemNavegacao } from '@/components/AppFrame';
import { LoginPanel } from '@/components/LoginPanel';
import {
  TelaRestaurandoSessao,
  useRestauracaoSessao,
} from '@/components/RestauracaoSessao';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { ScheduleLegend } from '@/components/ScheduleLegend';
import { sair } from '@/lib/firebase/authRepository';
import { mensagemErroFirebase } from '@/lib/firebase/errors';
import { ambienteFirebaseAtual } from '@/lib/firebase/shared';
import { pushConfigurado } from '@/lib/firebase/client';
import {
  decidirEstadoCardPush,
  identificadorDispositivoAbreviado,
  rotuloConfirmacaoPush,
} from '@/lib/firebase/pushCardEstado';
import {
  desativarDispositivo,
  deviceIdExistenteLocal,
  obterOuCriarDeviceId,
  obterStatusDispositivo,
  registrarOuRenovarDispositivo,
  removerDeviceIdLocal,
} from '@/lib/firebase/pushDeviceRepository';
import {
  ativarPush,
  assinarMensagensEmPrimeiroPlano,
  assinarRenovacaoFid,
  avaliarSuporte,
  consultarServiceWorkerPush,
  desativarPush,
  limparPushAoSair as limparPushAoSairAdapter,
  repararPush,
  retomarPushSeAderido,
  testarNotificacaoLocalPush,
  type StatusServiceWorkerPush,
} from '@/lib/firebase/pushMessaging';
import { formatarDataHoraSafe, formatarDiaTrocaSafe } from '@/lib/dataSegura';
import {
  carregarEscalasEquipe,
  carregarMinhaEscala,
  listarCatalogo,
  listarUsuarios,
  observarEscalasEquipe,
  observarEventosEscala,
} from '@/lib/firebase/readRepository';
import {
  listarAtribuicoesPlantaoPublicada,
  listarGruposPlantaoPermitidos,
  listarParticipantesPlantao,
  obterCompetenciaPlantaoPublicada,
} from '@/lib/firebase/plantaoReadRepository';
import { atualizarContatosPlantonista, atualizarCorPlantonista } from '@/lib/firebase/plantaoWriteRepository';
import {
  atribuicoesPorDiaCivil,
  contatosAtivosDoPlantonista,
  diasCivisNoPeriodo,
  horarioPlantaoParaExibicao,
  inicialPlantonista,
  indiceCorPlantonista,
  nomeExibicaoPlantonista,
  proximosPlantoesDoUsuario,
  resolverPlantaoAgora,
  rotuloHorarioPlantaoExibicao,
} from './plantaoApp';
import {
  cancelarSolicitacaoTroca as cancelarSolicitacaoTrocaFirebase,
  criarSolicitacaoTroca,
  marcarNotificacaoTrocaComoLida,
  observarNotificacoesTroca,
  observarTrocasDoUsuario,
  responderSolicitacaoTroca as responderSolicitacaoTrocaFirebase,
} from '@/lib/firebase/trocasRepository';
import { GESTOR_DEMO, USUARIOS_DEMO } from '@/lib/demoIdentidades';
import type { EventoEscala, Usuario } from '@/lib/modelos';
import { deveExibirRestauracao, podeIniciarListeners } from '@/lib/sessao';
import {
  classificarDiaSemana,
  ehDiaConsultadoHoje,
  tituloEquipeConsultada,
} from './hojeConsulta';
import {
  derivarEstadoGlobalApp,
  operacaoPrincipalHoje,
  resolverOperacoesApp,
  temJornadaPublicada,
  temPlantaoPublicado,
} from './operacoesApp';
import { LembretesView } from './lembretes/LembretesView';
import {
  ROTULO_STATUS_TROCA,
  SEVERIDADE_STATUS_TROCA,
  statusEhAtivo,
  type NotificacaoTroca,
  type SolicitacaoTrocaReal,
} from '@/lib/trocasEscala';

type Tela = 'hoje' | 'minha' | 'trocas' | 'plantao' | 'equipe' | 'perfil';
type ModoEscala = 'calendario' | 'agenda' | 'lembretes';
type AbaTrocas = 'minhas' | 'responder' | 'gestor' | 'historico';

/**
 * FASE-APP-UX-OPERACOES-MOBILE-1 — estado tipado do feedback do editor de
 * contatos de Plantão (Perfil). Antes disso, sucesso e erro compartilhavam
 * a mesma string (`mensagemContatosApp`) sempre renderizada com a classe
 * `.admin-form-erro` (vermelha) — "Contatos atualizados." aparecia com a
 * mesma cor de um erro real. `null` = nenhum feedback pendente.
 */
type FeedbackPerfilTipo = 'sucesso' | 'erro' | 'aviso';
interface FeedbackPerfil {
  tipo: FeedbackPerfilTipo;
  mensagem: string;
}

/**
 * Estado do card "Notificações" do Perfil (Fase PUSH-PWA-1). `DEMO` e
 * `NAO_CONFIGURADO` nunca chegam a pedir permissão nem a chamar
 * `ativarPush()` — só descrevem por que a ativação não está disponível.
 */
type EstadoNotificacoesPush =
  | 'DEMO'
  | 'NAO_CONFIGURADO'
  | 'INDISPONIVEL'
  | 'BLOQUEADO'
  | 'DISPONIVEL'
  | 'ATIVANDO'
  | 'ATIVO'
  | 'PRECISA_REPARO'
  | 'ERRO';

const NAVEGACAO: ItemNavegacao[] = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'home' },
  { id: 'minha', rotulo: 'Agenda', icone: 'calendar' },
  { id: 'trocas', rotulo: 'Trocas', icone: 'trocas' },
  { id: 'plantao', rotulo: 'Plantão', icone: 'plantao' },
  { id: 'equipe', rotulo: 'Equipe', icone: 'users' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'user', apenasDesktop: true },
];

function tituloCalendario(datas: string[]): string {
  if (datas.length === 0) {
    return 'Período sem datas';
  }
  const inicio = datas[0]!;
  const fim = datas.at(-1)!;
  const mesInicio = formatarData(inicio, { month: 'long' });
  const mesFim = formatarData(fim, { month: 'long', year: 'numeric' });
  const titulo = mesInicio === mesFim
    ? mesFim
    : `${mesInicio} — ${mesFim}`;
  return titulo.charAt(0).toUpperCase() + titulo.slice(1);
}

function tituloProximoTurno(turno: IntervaloTurno): string {
  const data = formatarData(turno.data, {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  }).replace('.', '');
  return data.charAt(0).toUpperCase() + data.slice(1);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function datasDaSemana(datas: string[], dataHoje: string): string[] {
  if (datas.length <= 7) {
    return datas;
  }
  const indiceHoje = datas.indexOf(dataHoje);
  if (indiceHoje < 0) {
    return datas.slice(0, 7);
  }
  const inicio = Math.max(0, Math.min(indiceHoje - 3, datas.length - 7));
  return datas.slice(inicio, inicio + 7);
}

function textoEstado(contexto: ContextoJornada): string {
  switch (contexto.estado) {
    case 'EM_ANDAMENTO':
      return 'Turno em andamento';
    case 'AGENDADO_HOJE':
      return 'Você trabalha hoje';
    case 'ENCERRADO_HOJE':
      return 'Jornada concluída';
    case 'NAO_TRABALHA_HOJE':
      return contexto.hoje.descricao;
    default:
      return 'Sem escala publicada';
  }
}

function IconeTurno({ codigo }: { codigo: string }) {
  if (codigo === 'MD' || codigo === 'N') {
    return <Moon />;
  }
  if (codigo === 'M') {
    return <Sunrise />;
  }
  if (codigo === 'T') {
    return <Sunset />;
  }
  return <Coffee />;
}

function TurnoHoje({ contexto }: { contexto: ContextoJornada }) {
  const turnoDestaque = contexto.turnoAtual ?? (
    contexto.hoje.trabalha
      && contexto.hoje.inicio !== undefined
      && contexto.hoje.fim !== undefined
      ? contexto.hoje as IntervaloTurno
      : null
  );
  const trabalhando = turnoDestaque !== null;

  return (
    <article
      className="today-hero"
      data-state={trabalhando ? contexto.estado : 'DESCANSO'}
      data-code={turnoDestaque?.codigo ?? ''}
    >
      <header className="today-card-heading">
        <span>Seu turno hoje</span>
      </header>
      <div className="today-hero-heading">
        <span className="today-hero-icon">
          {turnoDestaque ? <IconeTurno codigo={turnoDestaque.codigo} /> : <Coffee />}
        </span>
        <div>
          <strong className="today-shift-name">
            {turnoDestaque?.descricao ?? 'Aproveite seu dia'}
          </strong>
          {turnoDestaque && (
            <div
              className="today-hours"
              aria-label={`Das ${turnoDestaque.inicio} às ${turnoDestaque.fim}`}
            >
              <strong>{turnoDestaque.inicio}–{turnoDestaque.fim}</strong>
            </div>
          )}
          <span className="today-date">
            {capitalizar(formatarData(contexto.hoje.data, {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            }))}
          </span>
        </div>
      </div>

      {turnoDestaque ? (
        <div className="today-meta">
          <span className="live-badge"><i /> {textoEstado(contexto)}</span>
          <span className="shift-chip" data-code={turnoDestaque.codigo}>
            {turnoDestaque.codigo}
          </span>
          <span>{formatarMinutos(turnoDestaque.duracaoMinutos)}</span>
          {turnoDestaque.viraDia && <span>termina no dia seguinte</span>}
        </div>
      ) : (
        <p className="today-rest-copy">
          Nenhum horário de trabalho está previsto para hoje.
        </p>
      )}
    </article>
  );
}

function ProximoTurno({ turno }: { turno: IntervaloTurno | null }) {
  return (
    <article className="panel next-shift-card" data-code={turno?.codigo ?? ''}>
      <header className="today-card-heading">
        <span>Próximo turno</span>
        <CalendarCheck2 size={17} />
      </header>
      {turno && (
        <>
          <div className="next-shift-title">
            <span className="next-shift-icon" data-code={turno.codigo}>
              <IconeTurno codigo={turno.codigo} />
            </span>
            <div>
              <strong>{turno.descricao}</strong>
              <span>{turno.inicio}–{turno.fim}</span>
              <small>{tituloProximoTurno(turno)}</small>
            </div>
          </div>
          <p>{formatarMinutos(turno.duracaoMinutos)} de jornada prevista</p>
        </>
      )}
      {!turno && <p>Não encontrado neste período.</p>}
    </article>
  );
}

interface PlantaoHojeCardProps {
  grupo: GrupoPlantao;
  atribuicoes: AtribuicaoPlantaoPersistida[];
  participantes: ParticipantePlantao[];
  usuarios: Usuario[];
  agoraIso: string;
}

/**
 * FASE-APP-OPERACOES-UNIVERSAIS-1 — versão compacta de "De plantão agora"
 * (a mesma lógica pura da aba Plantão, `plantaoApp.ts`) para a aba Hoje,
 * usada quando o usuário tem Plantão publicado — junto do card de Jornada
 * quando as duas operações existem, ou sozinha quando só há Plantão.
 */
function PlantaoHojeCard({ grupo, atribuicoes, participantes, usuarios, agoraIso }: PlantaoHojeCardProps) {
  const resumo = resolverPlantaoAgora(atribuicoes, agoraIso);
  const nomeAtual = resumo.atual ? nomeExibicaoPlantonista(resumo.atual.plantonistaLogin, usuarios) : null;
  const horarioAtual = resumo.atual ? horarioPlantaoParaExibicao(resumo.atual, grupo.timezone) : null;
  const contatosAtual = resumo.atual ? contatosAtivosDoPlantonista(resumo.atual.plantonistaLogin, participantes) : [];

  return (
    <article className="today-hero" data-state={resumo.atual !== null ? 'PLANTAO' : 'DESCANSO'}>
      <header className="today-card-heading">
        <span>Plantão de hoje</span>
      </header>
      {resumo.atual === null || horarioAtual === null ? (
        <p className="today-rest-copy">Ninguém está de plantão neste momento.</p>
      ) : (
        <>
          <div className="today-hero-heading">
            <span className="today-hero-icon">{inicialPlantonista(nomeAtual ?? '')}</span>
            <div>
              <strong className="today-shift-name">{nomeAtual}</strong>
              <div className="today-hours"><strong>{rotuloHorarioPlantaoExibicao(horarioAtual)}</strong></div>
            </div>
          </div>
          <div className="today-meta">
            <span className="live-badge">
              <i /> Até {horarioAtual.horaFim}{horarioAtual.cruzaDiaSeguinte ? ' (amanhã)' : ''}
            </span>
          </div>
          {contatosAtual.length > 0 && (
            <div className="plantao-contatos-lista">
              {contatosAtual.map((contato) => (
                <span className="plantao-contato-chip" key={`${contato.rotulo}-${contato.numero}`}>
                  <Phone size={13} /> {contato.rotulo}: {contato.numero}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

interface CalendarioPlantaoAppProps {
  periodoInicio: string;
  periodoFim: string;
  dataHoje: string;
  atribuicoes: AtribuicaoPlantaoPersistida[];
  participantes: ParticipantePlantao[];
  usuarios: Usuario[];
  timezone: string;
  loginUsuarioAtual: string;
}

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-2 — calendário mensal de
 * Plantão do App. Reaproveita a MESMA grade compacta já usada pela Jornada
 * (`.calendar-view`/`.calendar-weekdays`/`.calendar-grid`/`.calendar-blank`,
 * ver `CalendarioEscala` acima) em vez de um componente visual novo — só o
 * conteúdo de cada dia muda (cor por PESSOA via `[data-identidade]`, não
 * por código de turno). O dia do próprio usuário logado ganha destaque
 * (`meu-plantao`) e o rótulo "Você" — atende ao pedido de "ver os dias que
 * está de plantão" sem precisar caçar o próprio nome entre vários.
 */
function CalendarioPlantaoApp({
  periodoInicio,
  periodoFim,
  dataHoje,
  atribuicoes,
  participantes,
  usuarios,
  timezone,
  loginUsuarioAtual,
}: CalendarioPlantaoAppProps) {
  const dias = diasCivisNoPeriodo(periodoInicio, periodoFim);
  const porDia = atribuicoesPorDiaCivil(atribuicoes, timezone);
  const espacosIniciais = dias[0] ? new Date(`${dias[0]}T12:00:00Z`).getUTCDay() : 0;

  return (
    <div className="calendar-view">
      <div className="calendar-weekdays" aria-hidden="true">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}
      </div>
      <div className="calendar-grid" role="grid" aria-label="Calendário de Plantão">
        {Array.from({ length: espacosIniciais }, (_, indice) => (
          <span className="calendar-blank" key={`blank-${indice}`} aria-hidden="true" />
        ))}
        {dias.map((data) => {
          const atribuicoesDoDia = porDia.get(data) ?? [];
          const principal = atribuicoesDoDia[0] ?? null;
          const extras = atribuicoesDoDia.length - 1;
          const meuDia = atribuicoesDoDia.some((item) => item.plantonistaLogin === loginUsuarioAtual);
          const nomePrincipal = principal ? nomeExibicaoPlantonista(principal.plantonistaLogin, usuarios) : null;
          return (
            <button
              key={data}
              type="button"
              className={[
                data === dataHoje ? 'today' : '',
                meuDia ? 'meu-plantao' : '',
              ].filter(Boolean).join(' ')}
              aria-label={principal
                ? `${formatarData(data, { weekday: 'long', day: '2-digit', month: 'long' })}: ${nomePrincipal}${meuDia ? ' (você)' : ''}`
                : `${formatarData(data, { weekday: 'long', day: '2-digit', month: 'long' })}: sem plantão`}
            >
              <span>
                {formatarData(data, { day: 'numeric' })}
                <small>{formatarData(data, { month: 'short' }).replace('.', '')}</small>
              </span>
              {principal ? (
                <strong
                  className="shift-chip"
                  data-identidade={indiceCorPlantonista(principal.plantonistaLogin, participantes)}
                >
                  {inicialPlantonista(nomePrincipal ?? '')}
                  {extras > 0 ? <small>+{extras}</small> : null}
                </strong>
              ) : (
                <strong className="shift-chip shift-chip-vazio">—</strong>
              )}
              <small>{meuDia ? 'Você' : (nomePrincipal ?? 'Sem plantão')}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface VisualizacaoEscalaProps {
  datas: string[];
  dataHoje: string;
  dataSelecionada: string;
  escala: TurnosMes | null;
  catalogo: typeof CATALOGO_SOC;
  onSelecionar: (data: string) => void;
}

function ResumoSemana({
  datas,
  dataHoje,
  dataSelecionada,
  escala,
  catalogo,
  onSelecionar,
}: Omit<VisualizacaoEscalaProps, 'dataSelecionada'> & { dataSelecionada?: string }) {
  const semana = datasDaSemana(datas, dataHoje);

  return (
    <article className="panel week-strip">
      <header className="week-strip-header">
        <div>
          <small>Visão rápida</small>
          <strong>Minha semana</strong>
        </div>
        <span>Toque em um dia para ver detalhes</span>
      </header>
      <div className="week-days" role="list" aria-label="Resumo da semana">
        {semana.map((data) => {
          const jornada = resolverJornadaDia(escala, catalogo, data);
          const { ehHoje, ehSelecionado, classes } = classificarDiaSemana(
            data,
            dataHoje,
            dataSelecionada,
          );
          const rotuloEstado = ehHoje ? ', hoje' : ehSelecionado ? ', selecionado' : '';
          return (
            <button
              key={data}
              type="button"
              className={classes}
              onClick={() => onSelecionar(data)}
              aria-current={ehHoje ? 'date' : undefined}
              aria-pressed={dataSelecionada !== undefined ? ehSelecionado : undefined}
              aria-label={`${formatarData(data, {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}: ${jornada.descricao}${rotuloEstado}`}
            >
              <small>{formatarData(data, { weekday: 'short' }).replace('.', '')}</small>
              <strong>{formatarData(data, { day: '2-digit' })}</strong>
              <span className="shift-chip" data-code={jornada.codigo}>
                {jornada.codigo || '—'}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function DetalheDia({
  data,
  dataHoje,
  escala,
  catalogo,
  onSolicitarTroca,
}: {
  data: string;
  dataHoje: string;
  escala: TurnosMes | null;
  catalogo: typeof CATALOGO_SOC;
  onSolicitarTroca?: (data: string) => void;
}) {
  const jornada = resolverJornadaDia(escala, catalogo, data);
  return (
    <aside className="panel selected-day-card" aria-live="polite">
      <div className="selected-day-date">
        <small>{data === dataHoje ? 'Hoje' : 'Dia selecionado'}</small>
        <strong>{capitalizar(formatarData(data, { weekday: 'long' }))}</strong>
        <span>{formatarData(data, { day: '2-digit', month: 'long' })}</span>
      </div>
      <div className="selected-day-shift" data-code={jornada.codigo}>
        <span className="selected-day-icon">
          <IconeTurno codigo={jornada.codigo} />
        </span>
        <div>
          <strong>{jornada.descricao}</strong>
          <span>
            {jornada.trabalha && jornada.inicio && jornada.fim
              ? `${jornada.inicio}–${jornada.fim}`
              : 'Sem horário de trabalho'}
          </span>
        </div>
        <b>{jornada.codigo || '—'}</b>
      </div>
      <div className="selected-day-facts">
        <div>
          <Clock3 />
          <span>Horário</span>
          <strong>
            {jornada.trabalha && jornada.inicio && jornada.fim
              ? `${jornada.inicio}–${jornada.fim}`
              : 'Não se aplica'}
          </strong>
        </div>
        <div>
          <BriefcaseBusiness />
          <span>Tipo de escala</span>
          <strong>{jornada.descricao}</strong>
        </div>
        <div>
          <CalendarDays />
          <span>Data</span>
          <strong>
            {capitalizar(formatarData(data, {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }))}
          </strong>
        </div>
      </div>
      {onSolicitarTroca && jornada.trabalha && (
        <button
          className="secondary-button selected-day-troca-button"
          type="button"
          onClick={() => onSolicitarTroca(data)}
        >
          <ArrowLeftRight size={15} /> Solicitar troca deste dia
        </button>
      )}
      <p className="selected-day-note">
        <ShieldCheck />
        Esta visualização é somente leitura.
      </p>
    </aside>
  );
}

function CalendarioEscala({
  datas,
  dataHoje,
  dataSelecionada,
  escala,
  catalogo,
  onSelecionar,
}: VisualizacaoEscalaProps) {
  const espacosIniciais = datas[0]
    ? new Date(`${datas[0]}T12:00:00Z`).getUTCDay()
    : 0;
  const espacosFinais = (7 - ((espacosIniciais + datas.length) % 7)) % 7;

  return (
    <div className="calendar-view">
      <div className="calendar-weekdays" aria-hidden="true">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          .map((dia) => <span key={dia}>{dia}</span>)}
      </div>
      <div className="calendar-grid" role="grid" aria-label="Calendário da minha escala">
        {Array.from({ length: espacosIniciais }, (_, indice) => (
          <span className="calendar-blank" key={`blank-${indice}`} aria-hidden="true" />
        ))}
        {datas.map((data) => {
          const jornada = resolverJornadaDia(escala, catalogo, data);
          const classes = [
            data === dataHoje ? 'today' : '',
            data === dataSelecionada ? 'selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={data}
              type="button"
              className={classes}
              onClick={() => onSelecionar(data)}
              aria-pressed={data === dataSelecionada}
              aria-label={`${formatarData(data, {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}: ${jornada.descricao}`}
            >
              <span>
                {formatarData(data, { day: 'numeric' })}
                <small>{formatarData(data, { month: 'short' }).replace('.', '')}</small>
              </span>
              <strong className="shift-chip" data-code={jornada.codigo}>
                {jornada.codigo || '—'}
              </strong>
              <small>
                {jornada.trabalha && jornada.inicio && jornada.fim
                  ? `${jornada.inicio}–${jornada.fim}`
                  : jornada.descricao}
              </small>
            </button>
          );
        })}
        {Array.from({ length: espacosFinais }, (_, indice) => (
          <span className="calendar-blank" key={`end-blank-${indice}`} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

function AgendaEscala({
  datas,
  dataHoje,
  dataSelecionada,
  escala,
  catalogo,
  onSelecionar,
}: VisualizacaoEscalaProps) {
  return (
    <div className="agenda-list" role="list" aria-label="Agenda completa da minha escala">
      {datas.map((data) => {
        const jornada = resolverJornadaDia(escala, catalogo, data);
        const selecionado = data === dataSelecionada;
        return (
          <button
            key={data}
            type="button"
            data-code={jornada.codigo}
            className={[
              data === dataHoje ? 'today' : '',
              selecionado ? 'selected' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelecionar(data)}
            aria-pressed={selecionado}
          >
            <span className="agenda-date">
              <small>{formatarData(data, { weekday: 'short' }).replace('.', '')}</small>
              <strong>{formatarData(data, { day: '2-digit' })}</strong>
              <small>{formatarData(data, { month: 'short' }).replace('.', '')}</small>
            </span>
            <span className="agenda-shift-icon" data-code={jornada.codigo}>
              <IconeTurno codigo={jornada.codigo} />
            </span>
            <span className="agenda-description">
              <strong>{jornada.descricao}</strong>
              <small>
                {jornada.trabalha && jornada.inicio && jornada.fim
                  ? `${jornada.inicio}–${jornada.fim} · ${formatarMinutos(jornada.duracaoMinutos)}`
                  : 'Sem horário de trabalho'}
              </small>
            </span>
            {data === dataHoje && <b>Hoje</b>}
          </button>
        );
      })}
    </div>
  );
}

function descricaoMudanca(
  codigo: string | null,
  horario: string | null,
  catalogo: typeof CATALOGO_SOC,
  removido: boolean,
): string {
  if (codigo === null) {
    return removido ? 'Removido da escala' : 'Sem escala';
  }
  const descricao = catalogo[codigo]?.descricao ?? codigo;
  return horario ? `${descricao} · ${horario}` : descricao;
}

interface NotificationBellProps {
  eventos: EventoEscala[];
  idsLidos: ReadonlySet<string>;
  aberta: boolean;
  catalogo: typeof CATALOGO_SOC;
  onAlternar: () => void;
  onAtivarSistema: () => void;
}

function NotificationBell({
  eventos,
  idsLidos,
  aberta,
  catalogo,
  onAlternar,
  onAtivarSistema,
}: NotificationBellProps) {
  const naoLidas = eventos.filter((evento) => !idsLidos.has(evento.id)).length;
  return (
    <div className="notification-center">
      <button
        className={`icon-button notification-button ${naoLidas ? 'has-unread' : ''}`}
        type="button"
        onClick={onAlternar}
        aria-label={`${naoLidas} atualização(ões) não lida(s)`}
        aria-expanded={aberta}
      >
        {naoLidas ? <BellRing size={19} /> : <Bell size={19} />}
        {naoLidas > 0 && <span className="notification-badge">{Math.min(naoLidas, 9)}</span>}
      </button>
      {aberta && (
        <section className="notification-popover" aria-label="Atualizações da escala">
          <header>
            <div><strong>Atualizações da escala</strong><span>{naoLidas ? `${naoLidas} nova(s)` : 'Tudo visto'}</span></div>
            {'Notification' in window && Notification.permission === 'default' && (
              <button type="button" onClick={onAtivarSistema}>Ativar avisos</button>
            )}
          </header>
          <div className="notification-list">
            {eventos.length === 0 ? (
              <div className="notification-empty"><Bell size={22} /><span>Nenhuma atualização publicada.</span></div>
            ) : eventos.slice(0, 8).map((evento) => (
              <article className={idsLidos.has(evento.id) ? '' : 'unread'} key={evento.id}>
                <div className="notification-title">
                  <span className="revision-dot" />
                  <div><strong>{evento.motivo}</strong><small>Revisão {evento.revisao} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(evento.publicadoEm))}</small></div>
                </div>
                <div className="notification-changes">
                  {evento.alteracoes.slice(0, 3).map((alteracao) => (
                    <div key={`${evento.id}-${alteracao.data}`}>
                      <strong>{formatarData(alteracao.data, { day: '2-digit', month: 'short' }).replace('.', '')}</strong>
                      <span>{descricaoMudanca(alteracao.codigoAnterior, alteracao.horarioAnterior, catalogo, false)}</span>
                      <b>→</b>
                      <span>{descricaoMudanca(alteracao.codigoNovo, alteracao.horarioNovo, catalogo, true)}</span>
                    </div>
                  ))}
                  {evento.alteracoes.length > 3 && <small>+ {evento.alteracoes.length - 3} outra(s) mudança(s)</small>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface TrocaNotificationBellProps {
  notificacoes: NotificacaoTroca[];
  aberta: boolean;
  onAlternar: () => void;
  onAbrirNotificacao: (notificacao: NotificacaoTroca) => void;
}

function TrocaNotificationBell({
  notificacoes,
  aberta,
  onAlternar,
  onAbrirNotificacao,
}: TrocaNotificationBellProps) {
  const naoLidas = notificacoes.filter((notificacao) => notificacao.lidaEm === null).length;
  return (
    <div className="notification-center">
      <button
        className={`icon-button notification-button ${naoLidas ? 'has-unread' : ''}`}
        type="button"
        onClick={onAlternar}
        aria-label={`${naoLidas} notificação(ões) de troca não lida(s)`}
        aria-expanded={aberta}
      >
        <ArrowLeftRight size={19} />
        {naoLidas > 0 && <span className="notification-badge">{Math.min(naoLidas, 9)}</span>}
      </button>
      {aberta && (
        <section className="notification-popover" aria-label="Notificações de troca">
          <header>
            <div><strong>Trocas de escala</strong><span>{naoLidas ? `${naoLidas} nova(s)` : 'Tudo visto'}</span></div>
          </header>
          <div className="notification-list">
            {notificacoes.length === 0 ? (
              <div className="notification-empty"><ArrowLeftRight size={22} /><span>Nenhuma notificação de troca ainda.</span></div>
            ) : notificacoes.slice(0, 8).map((notificacao) => (
              <button
                type="button"
                className={`notification-item-button ${notificacao.lidaEm === null ? 'unread' : ''}`}
                key={notificacao.id}
                onClick={() => onAbrirNotificacao(notificacao)}
              >
                <div className="notification-title">
                  <span className="revision-dot" />
                  <div>
                    <strong>{notificacao.titulo}</strong>
                    <small>{formatarDataHoraSafe(notificacao.criadoEm)}</small>
                  </div>
                </div>
                <p>{notificacao.mensagem}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const TEXTO_ESTADO_NOTIFICACOES: Record<EstadoNotificacoesPush, string> = {
  DEMO: 'Notificações disponíveis somente com conta autenticada.',
  NAO_CONFIGURADO: 'Não configuradas neste ambiente.',
  INDISPONIVEL: 'Não suportadas neste navegador.',
  BLOQUEADO: 'Bloqueadas pelo navegador.',
  DISPONIVEL: 'Disponíveis para ativar.',
  ATIVANDO: 'Configurando…',
  ATIVO: 'Ativo neste dispositivo.',
  PRECISA_REPARO: 'Este dispositivo precisa de reparo.',
  ERRO: 'Não foi possível concluir a ativação.',
};

interface CardNotificacoesPushProps {
  estado: EstadoNotificacoesPush;
  erro: string;
  identificadorDispositivo: string | null;
  confirmacao: string | null;
  serviceWorker: StatusServiceWorkerPush | null;
  testeLocalMensagem: string;
  diagnosticoCliqueMensagem: string;
  onAtivar: () => void;
  onDesativar: () => void;
  onReparar: () => void;
  onTestarLocal: () => void;
}

/**
 * Card "Notificações" do Perfil (Fase PUSH-PWA-1, reparo adicionado na
 * PUSH-PWA-2B.1). Nunca pede permissão sozinho — só reage a clique
 * explícito. `aria-live` no status para leitor de tela acompanhar a
 * transição sem precisar focar o card de novo. `ATIVO` aqui significa
 * "documento local com FID válido no contrato desta fase" — não apenas
 * "permissão concedida" nem "existe algum documento ativo para o login"
 * (auditoria PUSH-PWA-2B.1: um registro com FID obsoleto continuava
 * mostrando `Ativo` mesmo sem nunca mais receber push).
 */
function CardNotificacoesPush({
  estado,
  erro,
  identificadorDispositivo,
  confirmacao,
  serviceWorker,
  testeLocalMensagem,
  diagnosticoCliqueMensagem,
  onAtivar,
  onDesativar,
  onReparar,
  onTestarLocal,
}: CardNotificacoesPushProps) {
  const desabilitado = estado === 'ATIVANDO';
  const mostrarDispositivo = (estado === 'ATIVO' || estado === 'PRECISA_REPARO') && identificadorDispositivo !== null;
  return (
    <article className={`panel profile-notifications${diagnosticoCliqueMensagem ? ' profile-notifications-destaque' : ''}`}>
      <div className="profile-notifications-cabecalho">
        {estado === 'ATIVO' ? <BellRing size={18} /> : <Bell size={18} />}
        <h3>Notificações</h3>
      </div>
      <p className="profile-notifications-status" aria-live="polite">
        {TEXTO_ESTADO_NOTIFICACOES[estado]}
      </p>
      {mostrarDispositivo && (
        <p className="profile-notifications-dispositivo">
          Este dispositivo · PWA Web · <code>…{identificadorDispositivo}</code>
          {confirmacao ? ` · ${confirmacao}` : ''}
        </p>
      )}
      {serviceWorker && (
        <p className="profile-notifications-dispositivo">
          Service worker · {serviceWorker.controlador ? 'Controlando esta página' : 'Sem controlador'}
          {serviceWorker.versao ? ` · ${serviceWorker.versao}` : ''}
        </p>
      )}
      {diagnosticoCliqueMensagem && (
        <p className="profile-notifications-sucesso" role="status">{diagnosticoCliqueMensagem}</p>
      )}
      {testeLocalMensagem && (
        <p className="profile-notifications-sucesso" role="status">{testeLocalMensagem}</p>
      )}
      {estado === 'ERRO' && erro && (
        <p className="profile-notifications-erro" role="alert">{erro}</p>
      )}
      {estado === 'BLOQUEADO' && (
        <p className="profile-notifications-orientacao">
          Abra as configurações do navegador para este site e permita notificações, depois tente novamente.
        </p>
      )}
      {estado === 'PRECISA_REPARO' && (
        <p className="profile-notifications-orientacao">
          O registro deste dispositivo está incompleto. Toque em &quot;Reconfigurar neste dispositivo&quot; para corrigir.
        </p>
      )}
      <div className="profile-notifications-acoes">
        {(estado === 'DISPONIVEL' || estado === 'ERRO') && (
          <button
            className="secondary-button"
            type="button"
            onClick={onAtivar}
            disabled={desabilitado}
          >
            <Bell size={16} /> Ativar notificações
          </button>
        )}
        {estado === 'ATIVANDO' && (
          <button className="secondary-button" type="button" disabled>
            <LoaderCircle size={16} className="spin" /> Configurando…
          </button>
        )}
        {(estado === 'ATIVO' || estado === 'PRECISA_REPARO') && (
          <button
            className="secondary-button"
            type="button"
            onClick={onReparar}
            disabled={desabilitado}
          >
            <RefreshCw size={16} /> Reconfigurar neste dispositivo
          </button>
        )}
        {estado === 'ATIVO' && (
          <button className="secondary-button" type="button" onClick={onTestarLocal}>
            <BellRing size={16} /> Testar neste dispositivo
          </button>
        )}
        {estado === 'ATIVO' && (
          <button className="secondary-button" type="button" onClick={onDesativar}>
            <BellOff size={16} /> Desativar neste dispositivo
          </button>
        )}
      </div>
    </article>
  );
}

function TrocaItemButton({
  troca,
  usuario,
  onAbrir,
}: {
  troca: SolicitacaoTrocaReal;
  usuario: Usuario;
  onAbrir: () => void;
}) {
  const souSolicitante = troca.solicitanteLogin === usuario.login;
  const outroNome = souSolicitante ? troca.destinatarioNome : troca.solicitanteNome;
  return (
    <button type="button" className="troca-item-button" onClick={onAbrir}>
      <ArrowLeftRight size={16} />
      <div>
        <strong>{souSolicitante ? `Você e ${outroNome}` : `${outroNome} e você`}</strong>
        <small>
          {formatarDiaTrocaSafe(troca.data, { day: '2-digit', month: 'short' }).replace('.', '')}
          {' · '}{troca.turnoSolicitanteAntes || '—'} ⇄ {troca.turnoDestinatarioAntes || '—'}
        </small>
      </div>
      <span className={`status-badge ${SEVERIDADE_STATUS_TROCA[troca.status]}`}>
        {ROTULO_STATUS_TROCA[troca.status]}
      </span>
      <ChevronRight size={16} />
    </button>
  );
}

function TrocaComparacao({ troca }: { troca: SolicitacaoTrocaReal }) {
  return (
    <div className="troca-comparacao">
      <div>
        <small>{troca.solicitanteNome}</small>
        <strong>
          {capitalizar(formatarDiaTrocaSafe(troca.data, { weekday: 'short' })).replace('.', '')}
          {' '}{formatarDiaTrocaSafe(troca.data, { day: '2-digit', month: 'short' }).replace('.', '')}
        </strong>
        <span className="shift-chip" data-code={troca.turnoSolicitanteAntes || ''}>
          {troca.turnoSolicitanteAntes || '—'}
        </span>
        <small>{troca.horarioSolicitanteAntes || 'Sem horário'}</small>
      </div>
      <ArrowLeftRight size={18} />
      <div>
        <small>{troca.destinatarioNome}</small>
        <strong>
          {capitalizar(formatarDiaTrocaSafe(troca.data, { weekday: 'short' })).replace('.', '')}
          {' '}{formatarDiaTrocaSafe(troca.data, { day: '2-digit', month: 'short' }).replace('.', '')}
        </strong>
        <span className="shift-chip" data-code={troca.turnoDestinatarioAntes || ''}>
          {troca.turnoDestinatarioAntes || '—'}
        </span>
        <small>{troca.horarioDestinatarioAntes || 'Sem horário'}</small>
      </div>
    </div>
  );
}

function ModalRespostaTroca({
  troca,
  processando,
  erro,
  onFechar,
  onAceitar,
  onRecusar,
}: {
  troca: SolicitacaoTrocaReal;
  processando: boolean;
  erro: string;
  onFechar: () => void;
  onAceitar: () => void;
  onRecusar: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal troca-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="troca-resposta-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Solicitação de troca</p>
            <h2 id="troca-resposta-title">{troca.solicitanteNome} quer trocar com você</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <TrocaComparacao troca={troca} />
        {troca.mensagemSolicitante && (
          <p className="troca-mensagem">“{troca.mensagemSolicitante}”</p>
        )}
        <div className="alert warning">
          <strong>Ainda falta a aprovação do gestor</strong>
          <p>Se você aceitar, a solicitação segue para o gestor revisar antes de valer de verdade.</p>
        </div>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="rollback-actions">
          <button className="secondary-button" type="button" disabled={processando} onClick={onRecusar}>Recusar</button>
          <button className="primary-button" type="button" disabled={processando} onClick={onAceitar}>
            <Check size={16} /> Aceitar
          </button>
        </div>
      </section>
    </div>
  );
}

function ModalDetalheTroca({
  troca,
  usuario,
  processando,
  erro,
  onFechar,
  onCancelar,
}: {
  troca: SolicitacaoTrocaReal;
  usuario: Usuario;
  processando: boolean;
  erro: string;
  onFechar: () => void;
  onCancelar: () => void;
}) {
  const podeCancelar = troca.solicitanteLogin === usuario.login && troca.status === 'PENDENTE_USUARIO';
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal troca-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="troca-detalhe-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">{ROTULO_STATUS_TROCA[troca.status]}</p>
            <h2 id="troca-detalhe-title">
              {troca.solicitanteNome} ⇄ {troca.destinatarioNome}
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <TrocaComparacao troca={troca} />
        {troca.mensagemSolicitante && (
          <p className="troca-mensagem">“{troca.mensagemSolicitante}”</p>
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
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Fechar</button>
          {podeCancelar && (
            <button className="primary-button" type="button" disabled={processando} onClick={onCancelar}>
              Cancelar solicitação
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

interface EstadoAssistenteTroca {
  passo: 1 | 2 | 3;
  data: string | null;
  destinatarioLogin: string | null;
  mensagem: string;
}

function AssistenteNovaTroca({
  estado,
  datas,
  minhaEscala,
  documentos,
  usuarios,
  usuario,
  catalogo,
  enviando,
  erro,
  onMudarPasso,
  onEscolherData,
  onEscolherDestinatario,
  onMudarMensagem,
  onFechar,
  onEnviar,
}: {
  estado: EstadoAssistenteTroca;
  datas: string[];
  minhaEscala: TurnosMes | null;
  documentos: TurnosMes[];
  usuarios: Usuario[];
  usuario: Usuario;
  catalogo: typeof CATALOGO_SOC;
  enviando: boolean;
  erro: string;
  onMudarPasso: (passo: 1 | 2 | 3) => void;
  onEscolherData: (data: string) => void;
  onEscolherDestinatario: (login: string) => void;
  onMudarMensagem: (mensagem: string) => void;
  onFechar: () => void;
  onEnviar: () => void;
}) {
  const { passo, data, destinatarioLogin, mensagem } = estado;
  const jornadaEscolhida = data ? resolverJornadaDia(minhaEscala, catalogo, data) : null;
  const colegasNoDia = data
    ? documentos
      .filter((documento) => documento.login !== usuario.login)
      .filter((documento) => usuarios.find((item) => item.login === documento.login)?.ativo !== false)
      .map((documento) => ({ documento, jornada: resolverJornadaDia(documento, catalogo, data) }))
      .filter(({ jornada }) => jornada.trabalha)
    : [];
  const destinatario = colegasNoDia.find(({ documento }) => documento.login === destinatarioLogin);
  const nomeDestinatario = destinatarioLogin
    ? usuarios.find((item) => item.login === destinatarioLogin)?.nome ?? destinatarioLogin
    : '';
  const titulo = passo === 1 ? 'Escolha o seu dia' : passo === 2 ? 'Escolha o colega' : 'Confirmar solicitação';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal troca-modal troca-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="troca-wizard-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Passo {passo} de 3</p>
            <h2 id="troca-wizard-title">{titulo}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {passo === 1 && (
          <div className="troca-wizard-lista">
            {datas.map((diaIso) => {
              const jornada = resolverJornadaDia(minhaEscala, catalogo, diaIso);
              if (!jornada.trabalha) {
                return null;
              }
              return (
                <button
                  key={diaIso}
                  type="button"
                  className={`troca-wizard-opcao ${diaIso === data ? 'selecionada' : ''}`}
                  onClick={() => { onEscolherData(diaIso); onMudarPasso(2); }}
                >
                  <div>
                    <strong>
                      {capitalizar(formatarData(diaIso, { weekday: 'short' })).replace('.', '')}
                      {' '}{formatarData(diaIso, { day: '2-digit', month: 'short' }).replace('.', '')}
                    </strong>
                    <small>{jornada.descricao}{jornada.inicio ? ` · ${jornada.inicio}–${jornada.fim}` : ''}</small>
                  </div>
                  <span className="shift-chip" data-code={jornada.codigo ?? ''}>{jornada.codigo}</span>
                </button>
              );
            })}
          </div>
        )}

        {passo === 2 && (
          <>
            <div className="troca-wizard-lista">
              {colegasNoDia.length === 0 ? (
                <div className="notification-empty">
                  <Users size={22} />
                  <span>Ninguém mais está escalado nesse dia.</span>
                </div>
              ) : colegasNoDia.map(({ documento, jornada }) => {
                const nome = usuarios.find((item) => item.login === documento.login)?.nome ?? documento.login;
                return (
                  <button
                    key={documento.login}
                    type="button"
                    className={`troca-wizard-opcao ${documento.login === destinatarioLogin ? 'selecionada' : ''}`}
                    onClick={() => onEscolherDestinatario(documento.login)}
                  >
                    <div>
                      <strong>{nome}</strong>
                      <small>{jornada.descricao}{jornada.inicio ? ` · ${jornada.inicio}–${jornada.fim}` : ''}</small>
                    </div>
                    <span className="shift-chip" data-code={jornada.codigo ?? ''}>{jornada.codigo}</span>
                  </button>
                );
              })}
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => onMudarPasso(1)}>Voltar</button>
              <button
                className="primary-button"
                type="button"
                disabled={!destinatarioLogin}
                onClick={() => onMudarPasso(3)}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {passo === 3 && jornadaEscolhida && data && (
          <div className="troca-wizard-resumo">
            <p className="troca-wizard-frase">
              Você troca <strong>{jornadaEscolhida.descricao}</strong>
              {' '}({capitalizar(formatarData(data, { weekday: 'short' })).replace('.', '')}
              {' '}{formatarData(data, { day: '2-digit', month: 'short' }).replace('.', '')}) com{' '}
              <strong>{nomeDestinatario}</strong>, que está em{' '}
              <strong>{destinatario?.jornada.descricao ?? ''}</strong>.
            </p>
            <label className="publication-reason">
              Mensagem (opcional)
              <textarea
                value={mensagem}
                onChange={(evento) => onMudarMensagem(evento.target.value)}
                placeholder="Ex.: Preciso resolver um compromisso pessoal nesse turno."
                maxLength={280}
              />
              <small>{mensagem.trim().length}/280 caracteres</small>
            </label>
            {erro && <div className="alert error" role="alert">{erro}</div>}
            <div className="rollback-actions">
              <button className="secondary-button" type="button" disabled={enviando} onClick={() => onMudarPasso(2)}>Voltar</button>
              <button className="primary-button" type="button" disabled={enviando} onClick={onEnviar}>
                <ArrowLeftRight size={16} /> {enviando ? 'Enviando…' : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 introduziu `mensagemAusenciaEscalaAcao()`
 * para diferenciar "sem Jornada" de "tem participação em Plantão" — mas
 * ainda mostrava as duas mensagens no alerta vermelho GLOBAL do topo do
 * App (`erro`/`mensagemErro`), o que continuava ruim para UX: uma
 * ausência PARCIAL (só Jornada) virava erro visual mesmo quando o usuário
 * tinha Plantão de verdade para ver. FASE-APP-OPERACOES-UNIVERSAIS-1
 * removeu essa função: a ausência de Jornada deixou de setar `erro`
 * (global) e passou a ser um dado (`minhaEscala === null`) combinado com
 * o estado de Plantão (já carregado eagerly por `carregarPlantaoApp`, ver
 * abaixo) através de `operacoesApp.ts` — cada tela decide sozinha, de
 * forma contextual, o que mostrar quando falta uma das duas operações.
 * Nenhum alerta vermelho global aparece mais só por ausência de Jornada.
 */

export function EmployeeApp() {
  const [agora, setAgora] = useState(() => new Date());
  const referencia = referenciaLocal(agora);
  const dataHoje = referencia.dataIso;
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modoDemonstracao, setModoDemonstracao] = useState(true);
  const [tela, setTela] = useState<Tela>('hoje');
  const [documentos, setDocumentos] = useState<TurnosMes[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [catalogo, setCatalogo] = useState(CATALOGO_SOC);
  const [competenciaAtiva, setCompetenciaAtiva] = useState(
    competenciaOperacional(dataHoje),
  );
  const [filtroTurno, setFiltroTurno] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [modoEscala, setModoEscala] = useState<ModoEscala>('agenda');
  const [dataSelecionada, setDataSelecionada] = useState(dataHoje);
  const [dataConsultaEquipe, setDataConsultaEquipe] = useState(dataHoje);
  /**
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — estado da visão
   * "Plantão" e dos contatos pessoais (aba Perfil). `undefined` = ainda
   * não carregado (a tela/aba ainda não foi aberta desde o login);
   * `null` = carregado e não há Grupo de Plantão no escopo da equipe do
   * usuário. Carrega uma única vez por sessão (`carregouPlantaoApp`),
   * nunca a cada troca de aba — a fonte da escala é sempre a competência
   * PUBLICADA (nunca localStorage, ver `docs/spec/APP_PLANTAO_VISUALIZACAO.md`).
   */
  const [grupoPlantaoApp, setGrupoPlantaoApp] = useState<GrupoPlantao | null | undefined>(undefined);
  const [competenciaPlantaoApp, setCompetenciaPlantaoApp] = useState<string | null>(null);
  /**
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-2 — período REAL da
   * competência publicada (`CompetenciaPlantao.periodoInicio/Fim`), à parte
   * de `competenciaPlantaoApp` (só a chave "AAAA-MM"). O calendário mensal
   * precisa do período exato porque uma competência de Plantão nem sempre
   * alinha com o mês civil (pode ir de 26/07 a 25/08, por exemplo).
   */
  const [periodoPlantaoApp, setPeriodoPlantaoApp] = useState<{ inicio: string; fim: string } | null>(null);
  const [atribuicoesPlantaoApp, setAtribuicoesPlantaoApp] = useState<AtribuicaoPlantaoPersistida[]>([]);
  const [participantesPlantaoApp, setParticipantesPlantaoApp] = useState<ParticipantePlantao[]>([]);
  const [carregandoPlantaoApp, setCarregandoPlantaoApp] = useState(false);
  const [erroPlantaoApp, setErroPlantaoApp] = useState('');
  const [contatosEdicaoApp, setContatosEdicaoApp] = useState<ContatoPlantonista[] | null>(null);
  const [salvandoContatosApp, setSalvandoContatosApp] = useState(false);
  const [feedbackContatosApp, setFeedbackContatosApp] = useState<FeedbackPerfil | null>(null);
  const [salvandoCorPlantaoApp, setSalvandoCorPlantaoApp] = useState(false);
  const [mensagemCorPlantaoApp, setMensagemCorPlantaoApp] = useState('');
  const carregouPlantaoAppRef = useRef(false);
  const [eventos, setEventos] = useState<EventoEscala[]>([]);
  const [idsLidos, setIdsLidos] = useState<Set<string>>(() => new Set());
  const [centralAberta, setCentralAberta] = useState(false);
  const [avisoAtualizacao, setAvisoAtualizacao] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [trocas, setTrocas] = useState<SolicitacaoTrocaReal[]>([]);
  const [notificacoesTroca, setNotificacoesTroca] = useState<NotificacaoTroca[]>([]);
  const [centralTrocasAberta, setCentralTrocasAberta] = useState(false);
  const [abaTrocas, setAbaTrocas] = useState<AbaTrocas>('minhas');
  /**
   * FASE-APP-OPERACOES-UNIVERSAIS-1 — só relevante quando o usuário tem
   * Jornada 6x1 E Plantão publicados ao mesmo tempo: qual operação as
   * abas Agenda/Equipe mostram. Default 'JORNADA' (mantém o comportamento
   * de sempre para quem só tem Jornada, e é a primeira opção do seletor
   * quando as duas existem).
   */
  const [operacaoAgendaApp, setOperacaoAgendaApp] = useState<'JORNADA' | 'PLANTAO'>('JORNADA');
  const [operacaoEquipeApp, setOperacaoEquipeApp] = useState<'JORNADA' | 'PLANTAO'>('JORNADA');
  const [trocaAbertaId, setTrocaAbertaId] = useState<string | null>(null);
  const [assistenteTroca, setAssistenteTroca] = useState<EstadoAssistenteTroca | null>(null);
  const [processandoTroca, setProcessandoTroca] = useState(false);
  const [erroTroca, setErroTroca] = useState('');
  const [estadoNotificacoesPush, setEstadoNotificacoesPush] = useState<EstadoNotificacoesPush>('NAO_CONFIGURADO');
  const [erroNotificacoesPush, setErroNotificacoesPush] = useState('');
  const [ultimaConfirmacaoPush, setUltimaConfirmacaoPush] = useState<string | null>(null);
  const [deviceIdPushAtual, setDeviceIdPushAtual] = useState<string | null>(null);
  const [serviceWorkerPush, setServiceWorkerPush] = useState<StatusServiceWorkerPush | null>(null);
  const [mensagemTesteLocalPush, setMensagemTesteLocalPush] = useState('');
  const [mensagemCliqueDiagnosticoPush, setMensagemCliqueDiagnosticoPush] = useState('');
  // Lido uma única vez na primeira renderização (inicializador tardio, não
  // um efeito) e some da URL logo depois — nunca reprocessado num F5.
  const [deepLinkTrocaId, setDeepLinkTrocaId] = useState<string | null>(() => {
    const parametros = new URLSearchParams(window.location.search);
    const trocaId = parametros.get('trocaId');
    if (trocaId === null || trocaId.trim() === '') {
      return null;
    }
    parametros.delete('trocaId');
    const query = parametros.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    return trocaId;
  });
  const [pushDiagnosticoNaUrl, setPushDiagnosticoNaUrl] = useState<boolean>(() => {
    const parametros = new URLSearchParams(window.location.search);
    const pushDiagnostico = parametros.get('pushDiagnostico') === '1';
    if (!pushDiagnostico) {
      return false;
    }
    parametros.delete('pushDiagnostico');
    const query = parametros.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    return true;
  });
  const eventosConhecidos = useRef<Set<string>>(new Set());
  const primeiraCargaEventos = useRef(true);
  const deviceIdPushRef = useRef<string | null>(null);
  const messagingPushInicializadoRef = useRef(false);
  const eventIdsPushConhecidos = useRef<Set<string>>(new Set());
  const sessao = useRestauracaoSessao({
    tipo: 'app',
    aoRestaurar: (restaurado) => autenticar(restaurado, false),
  });

  useEffect(() => {
    const atualizacao = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(atualizacao);
  }, []);

  const loginUsuario = usuario?.login ?? null;
  const equipeUsuario = usuario?.equipeId ?? null;
  // A sincronização só começa depois da sessão resolvida e da carga inicial:
  // assim o snapshot em tempo real nunca é sobrescrito pela leitura pontual.
  const listenersLiberados = podeIniciarListeners({
    estado: sessao.estado,
    usuarioCarregado: usuario !== null,
    dadosIniciaisCarregados: dadosCarregados,
    modoDemonstracao,
  });

  useEffect(() => {
    if (!listenersLiberados || loginUsuario === null || equipeUsuario === null) {
      return undefined;
    }
    const cancelarEscalas = observarEscalasEquipe(
      equipeUsuario,
      competenciaAtiva,
      setDocumentos,
      (falha) => setErro(mensagemErroFirebase(falha, 'A sincronização em tempo real foi interrompida.', ambienteFirebaseAtual)),
    );
    const cancelarEventos = observarEventosEscala(
      loginUsuario,
      equipeUsuario,
      (atualizados) => {
        const novos = atualizados.filter((evento) => !eventosConhecidos.current.has(evento.id));
        setEventos(atualizados);
        eventosConhecidos.current = new Set(atualizados.map((evento) => evento.id));
        if (primeiraCargaEventos.current) {
          primeiraCargaEventos.current = false;
          return;
        }
        if (novos.length > 0) {
          const maisRecente = novos[0]!;
          setAvisoAtualizacao(
            `Revisão ${maisRecente.revisao} · ${maisRecente.motivo}: ${maisRecente.alteracoes.length} mudança(s) na sua escala.`,
          );
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Escala ICI atualizada', {
              body: `${maisRecente.motivo} · ${maisRecente.alteracoes.length} mudança(s)`,
              icon: '/icons/icon-192.png',
            });
          }
        }
      },
      (falha) => setErro(mensagemErroFirebase(falha, 'Não foi possível acompanhar as atualizações.', ambienteFirebaseAtual)),
    );
    const cancelarTrocas = observarTrocasDoUsuario(
      equipeUsuario,
      competenciaAtiva,
      loginUsuario,
      setTrocas,
      (falha) => setErroTroca(mensagemErroFirebase(falha, 'Não foi possível acompanhar as trocas de escala.', ambienteFirebaseAtual)),
    );
    const cancelarNotificacoesTroca = observarNotificacoesTroca(
      loginUsuario,
      setNotificacoesTroca,
      (falha) => setErroTroca(mensagemErroFirebase(falha, 'Não foi possível acompanhar as notificações de troca.', ambienteFirebaseAtual)),
    );
    return () => {
      cancelarEscalas();
      cancelarEventos();
      cancelarTrocas();
      cancelarNotificacoesTroca();
    };
  }, [competenciaAtiva, equipeUsuario, listenersLiberados, loginUsuario]);

  // Renovação de FID (chamada de novo por `pushsubscriptionchange` ou por
  // outra aba) — assinatura de longa duração, só enquanto o dispositivo
  // está de fato ATIVO. Idempotente: `registrarOuRenovarDispositivo`
  // sempre atualiza o mesmo documento, nunca cria um novo.
  useEffect(() => {
    if (usuario === null || modoDemonstracao || estadoNotificacoesPush !== 'ATIVO') {
      return undefined;
    }
    const login = usuario.login;
    const cancelar = assinarRenovacaoFid((fid) => {
      const deviceId = deviceIdPushRef.current ?? deviceIdExistenteLocal(login);
      if (deviceId === null) {
        return;
      }
      void registrarOuRenovarDispositivo({ deviceId, login, fid }).catch(() => {
        // Melhor esforço — uma renovação perdida não é crítica; a próxima
        // notificação já usa o `fid` mais atual do lado do FCM mesmo assim.
      });
    });
    return () => cancelar?.();
  }, [usuario, modoDemonstracao, estadoNotificacoesPush]);

  // Foreground: o Firestore (`observarNotificacoesTroca`, acima) já é a
  // fonte da verdade e já atualiza a central em tempo real. Este canal só
  // participa da dedupe por `eventId` — nunca exibe uma segunda notificação
  // do sistema, nunca navega sozinho.
  useEffect(() => {
    if (usuario === null || modoDemonstracao) {
      return undefined;
    }
    // FASE-APP-OPERACOES-UNIVERSAIS-1 — `getMessaging()` (dentro da função)
    // pode lançar de forma síncrona em navegadores/ambientes sem suporte
    // (`unsupported-browser`, `messaging/missing-app-config-values`). O App
    // precisa funcionar mesmo sem Push — nunca pode derrubar o EmployeeApp
    // inteiro por causa de uma falha de Messaging.
    let cancelar: (() => void) | null = null;
    try {
      cancelar = assinarMensagensEmPrimeiroPlano((payload) => {
        const eventId = payload.data?.eventId;
        if (typeof eventId !== 'string' || eventIdsPushConhecidos.current.has(eventId)) {
          return;
        }
        eventIdsPushConhecidos.current.add(eventId);
      });
    } catch (falha) {
      console.warn('Notificações em primeiro plano indisponíveis neste ambiente.', falha);
    }
    return () => cancelar?.();
  }, [usuario, modoDemonstracao]);

  // Deep link de clique em notificação de Troca (`?trocaId=...`, ver
  // `public/service-worker.js`) — aplicado depois que a sessão e a carga
  // inicial terminam, nunca perde o destino por a sessão ainda estar sendo
  // restaurada. `window.requestAnimationFrame` (mesmo padrão de
  // `PwaProvider.tsx`) tira as chamadas de `setState` do corpo síncrono do
  // efeito, evitando cascata de renders na mesma commit.
  useEffect(() => {
    if (deepLinkTrocaId === null || usuario === null || !dadosCarregados) {
      return undefined;
    }
    const quadro = window.requestAnimationFrame(() => {
      setCentralTrocasAberta(false);
      setTela('trocas');
      setTrocaAbertaId(deepLinkTrocaId);
      setDeepLinkTrocaId(null);
    });
    const notificacaoCorrespondente = notificacoesTroca.find(
      (item) => item.trocaId === deepLinkTrocaId && item.lidaEm === null,
    );
    if (notificacaoCorrespondente) {
      void marcarNotificacaoTrocaComoLida(notificacaoCorrespondente.id).catch(() => {
        // Falha em marcar como lida não impede abrir a troca — só o badge fica desatualizado.
      });
    }
    return () => window.cancelAnimationFrame(quadro);
  }, [deepLinkTrocaId, usuario, dadosCarregados, notificacoesTroca]);

  // Fallback SW → janela (Fase PUSH-PWA-2B.2D): quando o clique na
  // notificação não conseguiu navegar sozinho (`WindowClient.navigate()`
  // indisponível ou lançando erro), o service worker envia esta mensagem
  // para a janela já aberta em vez de depender só de reload — ver
  // `apps/app/src/sw/pushClickRouting.js`. Reaproveita exatamente os
  // mesmos estados (`deepLinkTrocaId`/`pushDiagnosticoNaUrl`) e os mesmos
  // efeitos do deep link por URL logo abaixo — nunca uma segunda regra de
  // abertura de Trocas. Aceita só `trocaId`/`diagnostico`, nunca URL.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }
    const aoReceberMensagem = (event: MessageEvent) => {
      const dados = event.data as { type?: unknown; trocaId?: unknown; diagnostico?: unknown } | null;
      if (!dados || dados.type !== 'ESCALA_ICI_NOTIFICATION_CLICK') {
        return;
      }
      if (dados.diagnostico === true) {
        setPushDiagnosticoNaUrl(true);
        return;
      }
      if (typeof dados.trocaId === 'string' && dados.trocaId.trim() !== '') {
        setDeepLinkTrocaId(dados.trocaId.trim());
      }
    };
    navigator.serviceWorker.addEventListener('message', aoReceberMensagem);
    return () => navigator.serviceWorker.removeEventListener('message', aoReceberMensagem);
  }, []);

  // Diagnóstico local acionado pelo service worker (`?pushDiagnostico=1`):
  // abre o Perfil, confirma visualmente o clique e não toca em Trocas nem
  // marca notificações como lidas.
  useEffect(() => {
    if (!pushDiagnosticoNaUrl || usuario === null || !dadosCarregados) {
      return undefined;
    }
    const quadro = window.requestAnimationFrame(() => {
      setTela('perfil');
      setMensagemCliqueDiagnosticoPush('Clique da notificação local confirmado neste dispositivo.');
      setPushDiagnosticoNaUrl(false);
    });
    const temporizador = window.setTimeout(() => {
      setMensagemCliqueDiagnosticoPush('');
    }, 8_000);
    return () => {
      window.cancelAnimationFrame(quadro);
      window.clearTimeout(temporizador);
    };
  }, [pushDiagnosticoNaUrl, usuario, dadosCarregados]);

  // Derivado (não um segundo `useState`) para o modal aberto ficar sempre
  // sincronizado com o snapshot em tempo real — por exemplo, se o colega
  // responder num outro dispositivo enquanto o solicitante ainda está com o
  // detalhe aberto.
  const trocaAberta = trocaAbertaId !== null
    ? trocas.find((item) => item.trocaId === trocaAbertaId) ?? null
    : null;
  // Notificação clicada antes da lista de trocas carregar (ou apontando pra
  // uma troca que não existe mais) nunca deve travar a tela — só mostra um
  // aviso amigável em vez do modal.
  const avisoTrocaNaoEncontrada = trocaAbertaId !== null && trocaAberta === null && dadosCarregados
    ? 'Troca não encontrada ou ainda carregando. Abra pela aba Trocas.'
    : '';

  const escalasDoUsuario = documentos.filter(
    (documento) => documento.login === usuario?.login,
  );
  const minhaEscala = selecionarEscalaPorData(escalasDoUsuario, dataHoje);

  const totais = minhaEscala
    ? calcularTotais(minhaEscala.dias, catalogo)
    : null;
  const contextoHoje = resolverContextoJornada(
    minhaEscala,
    catalogo,
    referencia,
  );

  const escaladosNoDiaConsultado = documentos
    .map((documento) => ({
      documento,
      jornada: resolverJornadaDia(documento, catalogo, dataConsultaEquipe),
    }))
    .filter(({ jornada }) => jornada.trabalha)
    .filter(({ jornada }) => filtroTurno === 'TODOS' || jornada.codigo === filtroTurno)
    .filter(({ documento }) => {
      const pessoa = usuarios.find((item) => item.login === documento.login);
      return `${pessoa?.nome ?? ''} ${documento.login}`
        .toLowerCase()
        .includes(busca.toLowerCase());
    });

  const turnosTrabalho = ['MD', 'M', 'T', 'N'].filter(
    (codigo) => catalogo[codigo] !== undefined,
  );
  const turnosExibidos = filtroTurno === 'TODOS'
    ? turnosTrabalho
    : turnosTrabalho.filter((codigo) => codigo === filtroTurno);

  async function autenticar(autenticado: Usuario, demonstracao: boolean) {
    setEstadoNotificacoesPush(demonstracao ? 'DEMO' : 'NAO_CONFIGURADO');
    setErroNotificacoesPush('');
    setUltimaConfirmacaoPush(null);
    deviceIdPushRef.current = null;
    setDeviceIdPushAtual(null);
    messagingPushInicializadoRef.current = false;
    if (demonstracao) {
      setIdsLidos(new Set());
    } else {
      try {
        const salvos = JSON.parse(
          window.localStorage.getItem(`escala-ici-notificacoes-lidas-${autenticado.login}`) ?? '[]',
        ) as unknown;
        setIdsLidos(new Set(Array.isArray(salvos) ? salvos.map(String) : []));
      } catch {
        setIdsLidos(new Set());
      }
    }
    setUsuario(autenticado);
    setModoDemonstracao(demonstracao);
    setEventos([]);
    setTrocas([]);
    setNotificacoesTroca([]);
    setTrocaAbertaId(null);
    setDadosCarregados(false);
    setTela('hoje');
    eventosConhecidos.current = new Set();
    primeiraCargaEventos.current = true;
    setErro('');
    // FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — um novo login (ou
    // trocar entre demo/real no mesmo dispositivo) nunca pode reaproveitar
    // o Plantão da sessão anterior.
    carregouPlantaoAppRef.current = false;
    setGrupoPlantaoApp(undefined);
    setCompetenciaPlantaoApp(null);
    setPeriodoPlantaoApp(null);
    setAtribuicoesPlantaoApp([]);
    setParticipantesPlantaoApp([]);
    setErroPlantaoApp('');
    setContatosEdicaoApp(null);
    setFeedbackContatosApp(null);
    setMensagemCorPlantaoApp('');
    try {
      if (demonstracao) {
        const { carregarEscalaDemonstracao } = await import('@/lib/demo');
        const escala = await carregarEscalaDemonstracao();
        const escalaAtual = selecionarEscalaPorData(
          escala.documentos.filter(
            (documento) => documento.login === autenticado.login,
          ),
          dataHoje,
        );
        setDocumentos(escala.documentos);
        setUsuarios(USUARIOS_DEMO);
        setCatalogo(CATALOGO_SOC);
        setCompetenciaAtiva(
          escalaAtual?.competencia
          ?? escala.documentos[0]?.competencia
          ?? competenciaOperacional(dataHoje),
        );
      } else {
        const metadados = Promise.all([
          listarCatalogo(autenticado.equipeId),
          listarUsuarios(autenticado.equipeId),
        ]);
        let minha: TurnosMes | null = null;
        for (const competencia of competenciasCandidatas(dataHoje)) {
          minha = await carregarMinhaEscala(
            autenticado.login,
            autenticado.equipeId,
            competencia,
          );
          if (minha !== null) {
            break;
          }
        }

        const competencia = minha?.competencia ?? competenciaOperacional(dataHoje);
        const [equipe, [catalogoRemoto, usuariosRemotos]] = await Promise.all([
          carregarEscalasEquipe(autenticado.equipeId, competencia, true),
          metadados,
        ]);
        setDocumentos(
          minha && !equipe.some((item) => item.login === minha.login)
            ? [minha, ...equipe]
            : equipe,
        );
        setCatalogo(catalogoRemoto);
        setUsuarios(usuariosRemotos);
        setCompetenciaAtiva(competencia);
        // FASE-APP-OPERACOES-UNIVERSAIS-1 — a ausência de Jornada NUNCA vira
        // `erro` (alerta global) aqui: `carregarPlantaoApp` já foi disparado
        // em paralelo (ver `useEffect` mais abaixo) e cada tela decide, via
        // `operacoesApp.ts`, se mostra a Jornada, o Plantão, os dois, ou um
        // estado vazio contextual — nunca um erro vermelho por isso.
      }
    } catch (falha) {
      setErro(mensagemErroFirebase(falha, 'Não foi possível carregar a escala.', ambienteFirebaseAtual));
    } finally {
      // Libera a sincronização mesmo se a carga inicial falhar: o snapshot em
      // tempo real é a chance de a escala aparecer sem exigir F5.
      setDadosCarregados(true);
    }
  }

  /**
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — carrega a visão
   * "Plantão" (quem está de plantão agora, próximo plantonista, meus
   * próprios plantões, contatos) uma única vez por sessão. Fonte é
   * sempre a competência PUBLICADA (`obterCompetenciaPlantaoPublicada` +
   * `listarAtribuicoesPlantaoPublicada`), nunca localStorage. Tolerante:
   *
   * FASE-APP-OPERACOES-UNIVERSAIS-1 — deixou de carregar só na primeira
   * vez que a aba "Plantão"/"Perfil" abre e passou a carregar assim que o
   * login termina (`useEffect` logo abaixo, disparado por `usuario`, não
   * mais por `tela`): as abas Hoje/Agenda/Trocas/Equipe agora também
   * precisam saber se existe Plantão publicado ANTES de o usuário abrir a
   * aba Plantão — é o que evita tratar a ausência de Jornada 6x1 como erro
   * global quando o usuário só tem Plantão (`operacoesApp.ts`).
   * se a equipe do usuário não tem nenhum Grupo de Plantão no escopo
   * (`listarGruposPlantaoPermitidos` vazio), marca `null` e mostra um
   * estado vazio — nunca um erro.
   */
  async function carregarPlantaoApp() {
    if (usuario === null || modoDemonstracao || carregouPlantaoAppRef.current) {
      return;
    }
    carregouPlantaoAppRef.current = true;
    setCarregandoPlantaoApp(true);
    setErroPlantaoApp('');
    try {
      const grupos = await listarGruposPlantaoPermitidos(usuario.equipeId);
      const grupo = grupos[0] ?? null;
      setGrupoPlantaoApp(grupo);
      if (grupo === null) {
        return;
      }
      const competencia = competenciaOperacional(dataHoje);
      /**
       * A leitura do Grupo (acima) e a leitura dos detalhes (participantes/
       * competência/atribuições) passam por regras diferentes no Firestore:
       * a Matriz de Responsáveis tem sua PRÓPRIA lista de "equipes que
       * consultam" por Grupo (`escoposOperacionais`, distinta de
       * `GrupoPlantao.equipesConsulta`) e, quando existe, ela manda — uma
       * equipe pode aparecer na lista do Grupo (por isso o Grupo é
       * encontrado aqui) e ainda assim não estar na lista da Matriz (por
       * isso os detalhes abaixo podem ser negados). Isolado num try/catch
       * próprio para nunca confundir esse "permission-denied" específico
       * com uma falha de rede/sessão, e para nunca sugerir que o próprio
       * usuário precisa de "permissão de gestor" (mensagem padrão de
       * `mensagemErroFirebase`, pensada para ações administrativas — aqui é
       * consulta, ver `docs/spec/APP_PLANTAO_VISUALIZACAO.md` § 2).
       */
      try {
        const [competenciaPublicada, participantes] = await Promise.all([
          obterCompetenciaPlantaoPublicada(grupo.grupoId, competencia),
          listarParticipantesPlantao(grupo.grupoId),
        ]);
        setParticipantesPlantaoApp(participantes);
        setContatosEdicaoApp(
          participantes.find((participante) => participante.login === usuario.login)?.contatos ?? [],
        );
        if (competenciaPublicada === null) {
          setCompetenciaPlantaoApp(null);
          setPeriodoPlantaoApp(null);
          setAtribuicoesPlantaoApp([]);
          return;
        }
        setCompetenciaPlantaoApp(competencia);
        setPeriodoPlantaoApp({ inicio: competenciaPublicada.periodoInicio, fim: competenciaPublicada.periodoFim });
        const atribuicoes = await listarAtribuicoesPlantaoPublicada(grupo.grupoId, competencia);
        setAtribuicoesPlantaoApp(atribuicoes);
      } catch (falhaDetalhe) {
        const codigoDetalhe = typeof falhaDetalhe === 'object' && falhaDetalhe !== null && 'code' in falhaDetalhe
          ? String(falhaDetalhe.code)
          : '';
        if (codigoDetalhe.includes('permission-denied')) {
          setErroPlantaoApp('Sua equipe ainda não tem permissão para consultar os detalhes deste Plantão (quem está de plantão, contatos). Peça ao coordenador para liberar a consulta em Administração > Responsáveis por escala.');
          return;
        }
        throw falhaDetalhe;
      }
    } catch (falha) {
      carregouPlantaoAppRef.current = false;
      setErroPlantaoApp(mensagemErroFirebase(falha, 'Não foi possível carregar o Plantão.', ambienteFirebaseAtual, 'autoatendimento'));
    } finally {
      setCarregandoPlantaoApp(false);
    }
  }

  /** Sempre os próprios contatos, no próprio Grupo — nunca outro login, nunca outro campo (ver `firestore.rules`). */
  async function salvarMeusContatosApp() {
    if (usuario === null || grupoPlantaoApp === null || grupoPlantaoApp === undefined || contatosEdicaoApp === null) {
      return;
    }
    setSalvandoContatosApp(true);
    setFeedbackContatosApp(null);
    try {
      if (!modoDemonstracao) {
        await atualizarContatosPlantonista(grupoPlantaoApp.grupoId, usuario.login, contatosEdicaoApp);
      }
      setParticipantesPlantaoApp((atuais) => {
        const existe = atuais.some((participante) => participante.login === usuario.login);
        const atualizadoEm = new Date().toISOString();
        if (!existe) {
          return atuais;
        }
        return atuais.map((participante) => (participante.login === usuario.login
          ? { ...participante, contatos: contatosEdicaoApp, atualizadoEm }
          : participante));
      });
      setFeedbackContatosApp({ tipo: 'sucesso', mensagem: 'Contatos atualizados com sucesso.' });
    } catch (falha) {
      setFeedbackContatosApp({
        tipo: 'erro',
        mensagem: mensagemErroFirebase(falha, 'Não foi possível salvar seus contatos.', ambienteFirebaseAtual),
      });
    } finally {
      setSalvandoContatosApp(false);
    }
  }

  /**
   * Aplica na hora (sem botão "Salvar" separado — é uma preferência de UI,
   * não um formulário): clicar numa cor já grava. Sempre a própria cor, no
   * próprio Grupo — nunca outro login (ver `firestore.rules`).
   */
  async function salvarCorPlantaoApp(indice: number | null) {
    if (usuario === null || grupoPlantaoApp === null || grupoPlantaoApp === undefined) {
      return;
    }
    setSalvandoCorPlantaoApp(true);
    setMensagemCorPlantaoApp('');
    try {
      if (!modoDemonstracao) {
        await atualizarCorPlantonista(grupoPlantaoApp.grupoId, usuario.login, indice);
      }
      setParticipantesPlantaoApp((atuais) => {
        const existe = atuais.some((participante) => participante.login === usuario.login);
        const atualizadoEm = new Date().toISOString();
        if (!existe) {
          return atuais;
        }
        return atuais.map((participante) => (participante.login === usuario.login
          ? { ...participante, corPreferida: indice, atualizadoEm }
          : participante));
      });
    } catch (falha) {
      setMensagemCorPlantaoApp(mensagemErroFirebase(falha, 'Não foi possível salvar sua cor.', ambienteFirebaseAtual));
    } finally {
      setSalvandoCorPlantaoApp(false);
    }
  }

  useEffect(() => {
    if (usuario !== null) {
      void Promise.resolve().then(() => carregarPlantaoApp());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoDemonstracao]);

  async function encerrarSessao() {
    // Orquestração: limpa o push (best-effort, nunca bloqueia) antes de
    // sair — evita que o próximo usuário deste navegador reaproveite em
    // silêncio o registro FCM da pessoa anterior. `sair()` continua sem
    // saber nada sobre push (assinatura pública inalterada).
    if (usuario !== null && !modoDemonstracao) {
      await limparPushLocalAoSair(usuario.login);
    }
    await sair();
    setUsuario(null);
    setDocumentos([]);
    setEventos([]);
    setTrocas([]);
    setNotificacoesTroca([]);
    setTrocaAbertaId(null);
    setDadosCarregados(false);
    setCentralAberta(false);
    setCentralTrocasAberta(false);
    setAvisoAtualizacao('');
    setEstadoNotificacoesPush('NAO_CONFIGURADO');
    setErroNotificacoesPush('');
    setUltimaConfirmacaoPush(null);
    setTela('hoje');
  }

  function alternarCentral() {
    const abrir = !centralAberta;
    setCentralAberta(abrir);
    if (!abrir || usuario === null) {
      return;
    }
    const novosLidos = new Set(idsLidos);
    for (const evento of eventos) {
      novosLidos.add(evento.id);
    }
    setIdsLidos(novosLidos);
    window.localStorage.setItem(
      `escala-ici-notificacoes-lidas-${usuario.login}`,
      JSON.stringify([...novosLidos]),
    );
  }

  function abrirAtualizacoes() {
    setAvisoAtualizacao('');
    if (!centralAberta) {
      alternarCentral();
    }
  }

  async function ativarNotificacoesSistema() {
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
  }

  /**
   * Só descreve o estado atual — nunca pede permissão nem chama
   * `register()`. Chamada ao abrir o Perfil e depois de ativar/desativar,
   * nunca no carregamento do App.
   */
  async function avaliarEstadoNotificacoesPush() {
    setServiceWorkerPush(await consultarServiceWorkerPush());
    if (modoDemonstracao) {
      setEstadoNotificacoesPush('DEMO');
      return;
    }
    if (!pushConfigurado()) {
      setEstadoNotificacoesPush('NAO_CONFIGURADO');
      return;
    }
    if (!('Notification' in window)) {
      setEstadoNotificacoesPush('INDISPONIVEL');
      return;
    }
    const suportado = await avaliarSuporte().catch(() => false);
    if (!suportado) {
      setEstadoNotificacoesPush('INDISPONIVEL');
      return;
    }
    if (Notification.permission === 'denied') {
      setEstadoNotificacoesPush('BLOQUEADO');
      return;
    }
    if (Notification.permission === 'granted' && usuario !== null) {
      const deviceId = deviceIdExistenteLocal(usuario.login);
      if (deviceId !== null) {
        const status = await obterStatusDispositivo(deviceId, usuario.login).catch(
          (): { status: 'INATIVO'; ultimaConfirmacaoEm: null } => ({ status: 'INATIVO', ultimaConfirmacaoEm: null }),
        );
        deviceIdPushRef.current = deviceId;
        setDeviceIdPushAtual(deviceId);
        setUltimaConfirmacaoPush(status.ultimaConfirmacaoEm);
        setEstadoNotificacoesPush(decidirEstadoCardPush(status.status, messagingPushInicializadoRef.current));
        return;
      }
    }
    setEstadoNotificacoesPush('DISPONIVEL');
  }

  async function testarNotificacaoLocalNesteDispositivo() {
    setMensagemTesteLocalPush('');
    setErroNotificacoesPush('');
    const resultado = await testarNotificacaoLocalPush();
    if (resultado.aceito) {
      setMensagemTesteLocalPush('Teste local solicitado ao service worker deste dispositivo.');
      setServiceWorkerPush((atual) => ({
        controlador: true,
        versao: resultado.versao ?? atual?.versao ?? null,
        origem: atual?.origem ?? window.location.origin,
        consultadoEm: resultado.consultadoEm,
      }));
      return;
    }
    setErroNotificacoesPush(resultado.erro ?? 'Não foi possível executar o teste local neste dispositivo.');
    setMensagemTesteLocalPush('');
  }

  async function ativarNotificacoesPush() {
    if (usuario === null) {
      return;
    }
    setErroNotificacoesPush('');
    setEstadoNotificacoesPush('ATIVANDO');
    const resultado = await ativarPush();
    if (resultado.estado === 'ATIVO' && resultado.fid) {
      const deviceId = obterOuCriarDeviceId(usuario.login);
      deviceIdPushRef.current = deviceId;
      setDeviceIdPushAtual(deviceId);
      try {
        await registrarOuRenovarDispositivo({ deviceId, login: usuario.login, fid: resultado.fid });
        messagingPushInicializadoRef.current = true;
        setUltimaConfirmacaoPush(new Date().toISOString());
        setEstadoNotificacoesPush('ATIVO');
      } catch {
        setErroNotificacoesPush('Permissão concedida, mas não foi possível salvar o dispositivo. Tente novamente.');
        setEstadoNotificacoesPush('ERRO');
      }
      return;
    }
    if (resultado.estado === 'PERMISSAO_NEGADA') {
      setEstadoNotificacoesPush('BLOQUEADO');
      return;
    }
    if (resultado.estado === 'NAO_SUPORTADO') {
      setEstadoNotificacoesPush('INDISPONIVEL');
      return;
    }
    if (resultado.estado === 'NAO_CONFIGURADO') {
      setEstadoNotificacoesPush('NAO_CONFIGURADO');
      return;
    }
    setErroNotificacoesPush(resultado.erro ?? 'Não foi possível ativar as notificações.');
    setEstadoNotificacoesPush('ERRO');
  }

  /**
   * Reparo manual (Fase PUSH-PWA-2B.1): renova só a instalação atual —
   * mesmo `deviceId`, nunca cria outro — sem tocar em documentos de outras
   * instalações do mesmo login. Só muda para `ATIVO` depois de confirmar
   * (leitura de volta via `obterStatusDispositivo`) que o novo FID foi
   * persistido; se a confirmação falhar, volta para `PRECISA_REPARO` em vez
   * de mentir que deu certo.
   */
  async function repararNotificacoesPush() {
    if (usuario === null) {
      return;
    }
    setErroNotificacoesPush('');
    setEstadoNotificacoesPush('ATIVANDO');
    const deviceId = deviceIdPushRef.current ?? obterOuCriarDeviceId(usuario.login);
    deviceIdPushRef.current = deviceId;
    setDeviceIdPushAtual(deviceId);
    const resultado = await repararPush();
    if (resultado.estado === 'ATIVO' && resultado.fid) {
      try {
        await registrarOuRenovarDispositivo({ deviceId, login: usuario.login, fid: resultado.fid });
        const status = await obterStatusDispositivo(deviceId, usuario.login);
        setUltimaConfirmacaoPush(status.ultimaConfirmacaoEm);
        if (status.status === 'ATIVO') {
          messagingPushInicializadoRef.current = true;
          setEstadoNotificacoesPush('ATIVO');
        } else {
          setErroNotificacoesPush('Não foi possível confirmar o reparo. Tente novamente.');
          setEstadoNotificacoesPush('PRECISA_REPARO');
        }
      } catch {
        setErroNotificacoesPush('Permissão concedida, mas não foi possível salvar o dispositivo. Tente novamente.');
        setEstadoNotificacoesPush('ERRO');
      }
      return;
    }
    if (resultado.estado === 'PERMISSAO_NEGADA') {
      setEstadoNotificacoesPush('BLOQUEADO');
      return;
    }
    if (resultado.estado === 'NAO_SUPORTADO') {
      setEstadoNotificacoesPush('INDISPONIVEL');
      return;
    }
    if (resultado.estado === 'NAO_CONFIGURADO') {
      setEstadoNotificacoesPush('NAO_CONFIGURADO');
      return;
    }
    setErroNotificacoesPush(resultado.erro ?? 'Não foi possível reconfigurar este dispositivo.');
    setEstadoNotificacoesPush('ERRO');
  }

  async function desativarNotificacoesPush() {
    if (usuario === null) {
      return;
    }
    const deviceId = deviceIdExistenteLocal(usuario.login);
    await desativarPush().catch(() => {
      // Sem assinatura ativa neste navegador — nada a desfazer no push subscription.
    });
    if (deviceId !== null) {
      await desativarDispositivo(deviceId).catch(() => {
        // Falha ao desativar remotamente não deve travar a ação local do usuário.
      });
    }
    removerDeviceIdLocal(usuario.login);
    deviceIdPushRef.current = null;
    setDeviceIdPushAtual(null);
    messagingPushInicializadoRef.current = false;
    setUltimaConfirmacaoPush(null);
    setEstadoNotificacoesPush('DISPONIVEL');
  }

  /**
   * Chamada pelo orquestrador de logout (`encerrarSessao`). A orquestração
   * (nunca lança, nunca bloqueia `sair()` por muito tempo — timeout de 3s
   * cobre o caso offline) vive em `limparPushAoSairAdapter`
   * (`lib/firebase/pushMessaging.ts`, extraída para ser testável sem
   * React); esta função só resolve o `deviceId` local e limpa o
   * armazenamento local depois. Se a limpeza remota falhar ou não der
   * tempo, o registro residual será desativado pelo próprio push-worker
   * quando o FID deixar de existir — não é um vazamento permanente, só um
   * dispositivo "ativo" por mais tempo do que o ideal.
   */
  async function limparPushLocalAoSair(login: string) {
    const deviceId = deviceIdExistenteLocal(login);
    await limparPushAoSairAdapter({ deviceIdExistente: deviceId, desativarDispositivo });
    removerDeviceIdLocal(login);
    deviceIdPushRef.current = null;
    setDeviceIdPushAtual(null);
    messagingPushInicializadoRef.current = false;
  }

  /**
   * Retomada automática no recarregamento/reabertura do PWA (auditoria
   * PUSH-PWA-1.1, cenário do item 5 do pedido). A decisão de agir ou não
   * — e o próprio "nunca pede permissão de novo" — vive em
   * `retomarPushSeAderido` (`lib/firebase/pushMessaging.ts`), extraída
   * para ser testável sem depender de React/DOM. Esta função só orquestra
   * UI/persistência em volta do resultado: a UI só muda para `ATIVO`
   * depois que `registrarOuRenovarDispositivo` confirma a persistência;
   * falha de rede aqui é silenciosa (o usuário só veria o estado real ao
   * abrir o Perfil, sem interrupção do resto do App).
   */
  async function retomarPushAutomaticamente() {
    if (usuario === null || modoDemonstracao) {
      return;
    }
    // Checagem síncrona e barata só para decidir se vale mostrar
    // "Ativando…" — quem nunca aderiu (sem deviceId local) nem chega a
    // ver esse estado. A decisão completa (incluindo a confirmação no
    // Firestore) continua só em `retomarPushSeAderido`.
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    const login = usuario.login;
    const deviceId = deviceIdExistenteLocal(login);
    if (deviceId === null) {
      return;
    }
    setEstadoNotificacoesPush('ATIVANDO');
    const resultado = await retomarPushSeAderido({
      deviceIdExistente: deviceId,
      // Verificação enriquecida (auditoria PUSH-PWA-2B.1): um documento
      // `ativo: true` com FID obsoleto não deve retomar em silêncio como se
      // estivesse funcionando — cai para `NAO_ADERIU` e o usuário vê
      // `PRECISA_REPARO` ao abrir o Perfil (`avaliarEstadoNotificacoesPush`).
      verificarDispositivoAtivo: async (id) => (await obterStatusDispositivo(id, login)).status === 'ATIVO',
    });
    if (resultado.estado === 'ATIVO' && resultado.fid) {
      deviceIdPushRef.current = deviceId;
      setDeviceIdPushAtual(deviceId);
      try {
        await registrarOuRenovarDispositivo({ deviceId, login, fid: resultado.fid });
        messagingPushInicializadoRef.current = true;
        setUltimaConfirmacaoPush(new Date().toISOString());
        setEstadoNotificacoesPush('ATIVO');
      } catch {
        setErroNotificacoesPush('Não foi possível confirmar o dispositivo automaticamente. Abra o Perfil para tentar novamente.');
        setEstadoNotificacoesPush('ERRO');
      }
      return;
    }
    setEstadoNotificacoesPush('DISPONIVEL');
  }

  // Avalia o estado do card de notificações só quando o Perfil é aberto —
  // nunca no carregamento do App, nunca pede permissão sozinho.
  // `requestAnimationFrame` (mesmo padrão de `PwaProvider.tsx`) tira a
  // chamada — que internamente atualiza estado — do corpo síncrono do
  // efeito.
  useEffect(() => {
    if (tela !== 'perfil' || usuario === null) {
      return undefined;
    }
    const quadro = window.requestAnimationFrame(() => {
      void avaliarEstadoNotificacoesPush();
    });
    return () => window.cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela, usuario, modoDemonstracao]);

  // Retomada automática (ver `retomarPushAutomaticamente` acima) — uma vez
  // por sessão autenticada, depois que a carga inicial termina. Nunca pede
  // permissão; só age se já havia adesão confirmada.
  useEffect(() => {
    if (usuario === null || modoDemonstracao || !dadosCarregados) {
      return undefined;
    }
    const quadro = window.requestAnimationFrame(() => {
      void retomarPushAutomaticamente();
    });
    return () => window.cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoDemonstracao, dadosCarregados]);

  function alternarCentralTrocas() {
    setCentralTrocasAberta((atual) => !atual);
  }

  function abrirNotificacaoTroca(notificacao: NotificacaoTroca) {
    setCentralTrocasAberta(false);
    setTela('trocas');
    setTrocaAbertaId(notificacao.trocaId);
    if (notificacao.lidaEm === null) {
      void marcarNotificacaoTrocaComoLida(notificacao.id).catch(() => {
        // Falha em marcar como lida não impede abrir a troca — só o badge fica desatualizado.
      });
    }
  }

  // --- Troca de escala real (Firestore `trocasEscala`, ver docs/spec/TROCA_ESCALA_PLANO.md) ---

  function abrirNovaSolicitacaoTroca(diaPreenchido?: string) {
    setErroTroca('');
    setAssistenteTroca({
      passo: diaPreenchido ? 2 : 1,
      data: diaPreenchido ?? null,
      destinatarioLogin: null,
      mensagem: '',
    });
  }

  async function enviarSolicitacaoTroca() {
    if (usuario === null || assistenteTroca?.data == null || assistenteTroca.destinatarioLogin == null) {
      return;
    }
    const { data, destinatarioLogin, mensagem } = assistenteTroca;
    const destinatario = usuarios.find((item) => item.login === destinatarioLogin);
    if (destinatario === undefined) {
      setErroTroca('Colaborador não encontrado.');
      return;
    }
    setProcessandoTroca(true);
    setErroTroca('');
    try {
      await criarSolicitacaoTroca({
        equipeId: usuario.equipeId,
        competencia: competenciaAtiva,
        data,
        solicitante: { login: usuario.login, nome: usuario.nome, ativo: usuario.ativo },
        destinatario: { login: destinatario.login, nome: destinatario.nome, ativo: destinatario.ativo },
        mensagem,
        catalogo,
      });
      setAssistenteTroca(null);
      setAbaTrocas('minhas');
    } catch (falha) {
      setErroTroca(mensagemErroFirebase(falha, 'Não foi possível enviar a solicitação de troca.', ambienteFirebaseAtual));
    } finally {
      setProcessandoTroca(false);
    }
  }

  async function responderSolicitacaoTroca(trocaId: string, aceitar: boolean) {
    if (usuario === null) {
      return;
    }
    setProcessandoTroca(true);
    setErroTroca('');
    try {
      await responderSolicitacaoTrocaFirebase(trocaId, { login: usuario.login, nome: usuario.nome }, aceitar);
      setTrocaAbertaId(null);
    } catch (falha) {
      setErroTroca(mensagemErroFirebase(falha, 'Não foi possível responder a solicitação de troca.', ambienteFirebaseAtual));
    } finally {
      setProcessandoTroca(false);
    }
  }

  async function cancelarSolicitacaoTroca(trocaId: string) {
    if (usuario === null) {
      return;
    }
    setProcessandoTroca(true);
    setErroTroca('');
    try {
      await cancelarSolicitacaoTrocaFirebase(trocaId, { login: usuario.login, nome: usuario.nome });
      setTrocaAbertaId(null);
    } catch (falha) {
      setErroTroca(mensagemErroFirebase(falha, 'Não foi possível cancelar a solicitação de troca.', ambienteFirebaseAtual));
    } finally {
      setProcessandoTroca(false);
    }
  }

  // Enquanto o Firebase Auth não confirmar a sessão local, o App não mostra
  // login nem telas vazias — só a tela de restauração.
  if (deveExibirRestauracao(sessao.estado)) {
    return <TelaRestaurandoSessao />;
  }

  if (usuario === null) {
    return <LoginPanel tipo="app" sessaoDelegada onEntrar={autenticar} />;
  }

  const mensagemErro = erro || sessao.erro;
  /**
   * FASE-APP-OPERACOES-UNIVERSAIS-1 — operações conhecidas do App para
   * este usuário nesta competência (ver `operacoesApp.ts`). `grupoPlantaoApp
   * === undefined` significa "consulta de Plantão ainda em andamento" —
   * `resolverOperacoesApp` trata isso como "nenhuma operação de Plantão
   * ainda", nunca como "sem Plantão", então nenhuma tela pisca um estado
   * vazio errado enquanto a consulta eager (ver `useEffect` acima) termina.
   */
  const operacoesApp = resolverOperacoesApp(
    usuario,
    { escalaPublicada: minhaEscala !== null },
    {
      grupo: grupoPlantaoApp,
      competenciaPublicada: competenciaPlantaoApp,
      participante: participantesPlantaoApp.some(
        (participante) => participante.login === usuario.login && participante.ativo,
      ),
      consulta: erroPlantaoApp === '',
    },
    competenciaAtiva,
  );
  const jornadaPublicadaApp = temJornadaPublicada(operacoesApp);
  const plantaoPublicadoApp = temPlantaoPublicado(operacoesApp);
  const estadoGlobalApp = derivarEstadoGlobalApp(operacoesApp);
  const operacaoPrincipalHojeApp = operacaoPrincipalHoje(operacoesApp);
  // "Ainda não sabemos" (consulta de Plantão em andamento) nunca deve
  // aparentar "não tem nada" — só depois que `grupoPlantaoApp` sai de
  // `undefined` é que um estado vazio pode ser mostrado com confiança.
  const statusPlantaoConhecido = grupoPlantaoApp !== undefined || modoDemonstracao;
  // Quando as duas operações existem, o seletor (`operacaoAgendaApp`/
  // `operacaoEquipeApp`) decide; quando só uma existe, ela é a única opção
  // possível — nunca deixa o seletor "escolher" uma operação inexistente.
  const agendaOperacaoEfetiva: 'JORNADA' | 'PLANTAO' = jornadaPublicadaApp && plantaoPublicadoApp
    ? operacaoAgendaApp
    : (plantaoPublicadoApp && !jornadaPublicadaApp ? 'PLANTAO' : 'JORNADA');
  const equipeOperacaoEfetiva: 'JORNADA' | 'PLANTAO' = jornadaPublicadaApp && plantaoPublicadoApp
    ? operacaoEquipeApp
    : (plantaoPublicadoApp && !jornadaPublicadaApp ? 'PLANTAO' : 'JORNADA');
  const nomes = Object.fromEntries(usuarios.map((item) => [item.login, item.nome]));
  const datas = Object.keys(minhaEscala?.dias ?? {}).sort();
  const dataHojeFormatada = formatarData(dataHoje, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const dataSelecionadaEfetiva = datas.includes(dataSelecionada)
    ? dataSelecionada
    : datas[0] ?? dataHoje;

  function consultarEquipeNoDia(data: string) {
    setDataConsultaEquipe(data);
  }

  const consultaEhHoje = ehDiaConsultadoHoje(dataConsultaEquipe, dataHoje);
  const tituloEquipeEscalada = tituloEquipeConsultada(dataConsultaEquipe, dataHoje);

  return (
    <AppFrame
      produto="app"
      usuario={usuario}
      competencia={formatarCompetencia(competenciaAtiva)}
      itens={NAVEGACAO}
      ativo={tela}
      onNavegar={(id) => setTela(id as Tela)}
      onSair={encerrarSessao}
      perfil={{
        iniciais: usuario.nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('').toUpperCase(),
        ativo: tela === 'perfil',
        onAbrir: () => setTela('perfil'),
      }}
      acoesTopo={(
        <>
          <TrocaNotificationBell
            notificacoes={notificacoesTroca}
            aberta={centralTrocasAberta}
            onAlternar={alternarCentralTrocas}
            onAbrirNotificacao={abrirNotificacaoTroca}
          />
          <NotificationBell
            eventos={eventos}
            idsLidos={idsLidos}
            aberta={centralAberta}
            catalogo={catalogo}
            onAlternar={alternarCentral}
            onAtivarSistema={() => void ativarNotificacoesSistema()}
          />
        </>
      )}
    >
      {avisoAtualizacao && (
        <div className="toast update-toast" role="status" aria-live="polite">
          <BellRing size={18} />
          <span>{avisoAtualizacao}</span>
          <button className="toast-action" type="button" onClick={abrirAtualizacoes}>
            Ver atualizações
          </button>
          <button type="button" onClick={() => setAvisoAtualizacao('')} aria-label="Fechar">×</button>
        </div>
      )}
      {mensagemErro && <div className="alert error">{mensagemErro}</div>}

      {tela === 'hoje' && (
        <section className="employee-screen employee-today-screen">
          <header className="page-heading today-heading">
            <div>
              <p className="eyebrow">{dataHojeFormatada}</p>
              <h1>Olá, {usuario.nome.split(' ')[0]}</h1>
              <p>Veja sua jornada e quem estará com você hoje.</p>
            </div>
            <div className="today-heading-actions">
              <span className="today-period">
                <CalendarDays size={15} /> {formatarCompetencia(competenciaAtiva)}
              </span>
              <span className="read-only-badge">
                <ShieldCheck size={16} /> Escala publicada
              </span>
            </div>
          </header>

          {/*
            FASE-APP-OPERACOES-UNIVERSAIS-1 — regra 4: Jornada e Plantão
            aparecem lado a lado quando as duas existem (Jornada primeiro),
            cada uma sozinha quando só uma existe, e um estado vazio
            amigável quando nenhuma existe. Nunca um erro vermelho global
            só porque falta uma das duas.
          */}
          {!jornadaPublicadaApp && plantaoPublicadoApp && (
            <div className="alert warning" role="status">
              Nenhuma jornada 6x1 publicada para este período.
            </div>
          )}
          {statusPlantaoConhecido && estadoGlobalApp === 'sem-operacoes' ? (
            <article className="panel organization-empty-state">
              <CalendarDays size={28} aria-hidden="true" />
              <h2>Nenhuma escala publicada para este período</h2>
              <p>Quando a Jornada 6x1 ou o Plantão forem publicados, eles aparecem aqui automaticamente.</p>
            </article>
          ) : (
            <div className="today-summary-grid today-dashboard-grid" data-operacao-principal={operacaoPrincipalHojeApp?.tipo ?? ''}>
              {jornadaPublicadaApp && (
                <>
                  <TurnoHoje contexto={contextoHoje} />
                  <ProximoTurno turno={contextoHoje.proximoTurno} />
                  <ResumoSemana
                    datas={datas}
                    dataHoje={dataHoje}
                    dataSelecionada={dataConsultaEquipe}
                    escala={minhaEscala}
                    catalogo={catalogo}
                    onSelecionar={consultarEquipeNoDia}
                  />
                </>
              )}
              {plantaoPublicadoApp && grupoPlantaoApp != null && (
                <PlantaoHojeCard
                  grupo={grupoPlantaoApp}
                  atribuicoes={atribuicoesPlantaoApp}
                  participantes={participantesPlantaoApp}
                  usuarios={usuarios}
                  agoraIso={agora.toISOString()}
                />
              )}
            </div>
          )}

          {jornadaPublicadaApp && (
            <article className="panel today-team-panel">
              <div className="panel-title today-team-title">
                <div>
                  <h2>{tituloEquipeEscalada}</h2>
                  <p>{escaladosNoDiaConsultado.length} colaborador(es) encontrado(s)</p>
                  {!consultaEhHoje && (
                    <button
                      type="button"
                      className="today-back-to-today"
                      onClick={() => setDataConsultaEquipe(dataHoje)}
                    >
                      <CalendarDays size={13} /> Voltar para hoje
                    </button>
                  )}
                </div>
                <Users />
              </div>
              <div className="toolbar">
                <label className="search-control">
                  <Search size={16} />
                  <input
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Buscar colaborador"
                    aria-label="Buscar colaborador"
                  />
                </label>
                <label>
                  <Filter size={16} />
                  <select
                    value={filtroTurno}
                    onChange={(evento) => setFiltroTurno(evento.target.value)}
                    aria-label="Filtrar por turno"
                  >
                    <option value="TODOS">Todos os turnos</option>
                    <option value="MD">Madrugada</option>
                    <option value="M">Manhã</option>
                    <option value="T">Tarde</option>
                    <option value="N">Noite</option>
                  </select>
                </label>
              </div>
              <div className="today-grid">
                {turnosExibidos.map((turno) => {
                  const tipo = catalogo[turno];
                  const pessoas = escaladosNoDiaConsultado.filter(
                    ({ jornada }) => jornada.codigo === turno,
                  );
                  return (
                    <section key={turno} className="shift-group">
                      <header>
                        <span className="shift-chip" data-code={turno}>{turno}</span>
                        <div>
                          <strong>{tipo?.descricao}</strong>
                          <small>{tipo?.horaInicio}–{tipo?.horaFim}</small>
                        </div>
                        <b>{pessoas.length}</b>
                      </header>
                      <div>
                        {pessoas.length ? pessoas.map(({ documento, jornada }) => (
                          <article key={documento.login}>
                            <span className="avatar">
                              {(nomes[documento.login] ?? documento.login)
                                .split(' ')
                                .map((parte) => parte[0])
                                .slice(0, 2)
                                .join('')}
                            </span>
                            <div>
                              <strong>{nomes[documento.login] ?? documento.login}</strong>
                              <small>{jornada.inicio}–{jornada.fim} · {documento.login}</small>
                            </div>
                            {documento.login === usuario.login
                              ? <CheckCircle2 size={17} aria-label="Você" />
                              : <Clock3 size={16} />}
                          </article>
                        )) : <p className="empty-inline">Ninguém neste turno.</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
            </article>
          )}
        </section>
      )}

      {tela === 'minha' && (
        <section className="employee-screen employee-agenda-screen">
          <div className="agenda-mobile-intro">
            <span className="avatar">
              {usuario.nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}
            </span>
            <strong>Olá, {usuario.nome.split(' ')[0]}</strong>
          </div>
          <header className="page-heading schedule-page-heading">
            <div>
              <p className="eyebrow">Consulta individual</p>
              <h1>Minha agenda</h1>
              <p>
                {jornadaPublicadaApp && plantaoPublicadoApp
                  ? 'Jornada 6x1 e Plantão publicados para este período.'
                  : plantaoPublicadoApp
                    ? 'Plantão publicado para este período.'
                    : minhaEscala
                      ? `Jornada 6x1 publicada para este período — de ${formatarPeriodo(minhaEscala.periodoInicio, minhaEscala.periodoFim)}.`
                      : 'Nenhuma escala publicada para exibir.'}
              </p>
            </div>
            <span className="read-only-badge">
              <ShieldCheck size={16} /> Somente leitura
            </span>
          </header>

          {/*
            FASE-APP-OPERACOES-UNIVERSAIS-1 — regra 5: quando as duas
            operações existem, um seletor decide o que a Agenda mostra;
            quando só uma existe, ela é mostrada direto (sem seletor).
          */}
          {jornadaPublicadaApp && plantaoPublicadoApp && (
            <div className="segmented-control agenda-operacao-seletor" aria-label="Operação">
              <button
                type="button"
                className={agendaOperacaoEfetiva === 'JORNADA' ? 'active' : ''}
                aria-pressed={agendaOperacaoEfetiva === 'JORNADA'}
                onClick={() => setOperacaoAgendaApp('JORNADA')}
              >
                Jornada 6x1
              </button>
              <button
                type="button"
                className={agendaOperacaoEfetiva === 'PLANTAO' ? 'active' : ''}
                aria-pressed={agendaOperacaoEfetiva === 'PLANTAO'}
                onClick={() => setOperacaoAgendaApp('PLANTAO')}
              >
                Plantão
              </button>
            </div>
          )}

          {agendaOperacaoEfetiva === 'PLANTAO' && plantaoPublicadoApp && grupoPlantaoApp != null && periodoPlantaoApp != null ? (
            <article className="panel">
              <div className="panel-title">
                <div>
                  <h2>Calendário do mês</h2>
                  <p>Competência {formatarCompetencia(competenciaPlantaoApp ?? competenciaAtiva)}</p>
                </div>
              </div>
              <CalendarioPlantaoApp
                periodoInicio={periodoPlantaoApp.inicio}
                periodoFim={periodoPlantaoApp.fim}
                dataHoje={dataHoje}
                atribuicoes={atribuicoesPlantaoApp}
                participantes={participantesPlantaoApp}
                usuarios={usuarios}
                timezone={grupoPlantaoApp.timezone}
                loginUsuarioAtual={usuario.login}
              />
            </article>
          ) : (
            <>
              <div className="agenda-mobile-week">
                <ResumoSemana
                  datas={datas}
                  dataHoje={dataHoje}
                  escala={minhaEscala}
                  catalogo={catalogo}
                  onSelecionar={setDataSelecionada}
                />
              </div>

              <div className="metric-grid employee-metrics">
                <article data-tone="neutral">
                  <span>Total de dias</span>
                  <strong>{datas.length}</strong>
                  <small>dias no período</small>
                </article>
                <article data-tone="primary">
                  <span>Trabalhados</span>
                  <strong>{totais?.diasTrabalhados ?? 0}</strong>
                  <small>{formatarMinutos(totais?.min ?? 0)} de jornada</small>
                </article>
                <article data-tone="success">
                  <span>Descansos</span>
                  <strong>{(totais?.df ?? 0) + (totais?.du ?? 0)}</strong>
                  <small>{totais?.df ?? 0} DF · {totais?.du ?? 0} DU</small>
                </article>
                <article className="metric-next-shift" data-tone="shift" data-code={contextoHoje.proximoTurno?.codigo ?? ''}>
                  <span>Próximo turno</span>
                  <div>
                    <i><IconeTurno codigo={contextoHoje.proximoTurno?.codigo ?? ''} /></i>
                    <p>
                      <strong>{contextoHoje.proximoTurno?.descricao ?? 'Não encontrado'}</strong>
                      <small>
                        {contextoHoje.proximoTurno
                          ? `${contextoHoje.proximoTurno.inicio}–${contextoHoje.proximoTurno.fim}`
                          : 'Neste período'}
                      </small>
                    </p>
                  </div>
                </article>
              </div>

              <article
                className="panel calendar-panel employee-calendar-panel"
                data-mode={modoEscala}
              >
                <div className="panel-title schedule-panel-title">
                  <div>
                    {modoEscala === 'lembretes' ? (
                      <>
                        <h2>Lembretes</h2>
                        <p>Compromissos pessoais e atribuídos pelo gestor</p>
                      </>
                    ) : (
                      <>
                        <h2>{tituloCalendario(datas)}</h2>
                        <p>{minhaEscala?.turnoPadrao} · {minhaEscala?.login}</p>
                      </>
                    )}
                  </div>
                  <div className="segmented-control" aria-label="Modo de visualização">
                    <button
                      type="button"
                      className={modoEscala === 'calendario' ? 'active' : ''}
                      onClick={() => setModoEscala('calendario')}
                      aria-pressed={modoEscala === 'calendario'}
                    >
                      <CalendarDays size={16} /> Calendário
                    </button>
                    <button
                      type="button"
                      className={modoEscala === 'agenda' ? 'active' : ''}
                      onClick={() => setModoEscala('agenda')}
                      aria-pressed={modoEscala === 'agenda'}
                    >
                      <List size={16} /> Agenda
                    </button>
                    <button
                      type="button"
                      className={modoEscala === 'lembretes' ? 'active' : ''}
                      onClick={() => setModoEscala('lembretes')}
                      aria-pressed={modoEscala === 'lembretes'}
                    >
                      <Bell size={16} /> Lembretes
                    </button>
                  </div>
                </div>
                <div className="schedule-explorer">
                  {modoEscala === 'lembretes' ? (
                    <LembretesView
                      login={usuario.login}
                      nomeGestorDemo={GESTOR_DEMO.nome}
                      modoDemonstracao={modoDemonstracao}
                      listenersLiberados={listenersLiberados}
                      dataHoje={dataHoje}
                      escala={minhaEscala}
                      catalogo={catalogo}
                    />
                  ) : (
                    <>
                      <div className="schedule-view-panel">
                        {modoEscala === 'calendario' ? (
                          <CalendarioEscala
                            datas={datas}
                            dataHoje={dataHoje}
                            dataSelecionada={dataSelecionadaEfetiva}
                            escala={minhaEscala}
                            catalogo={catalogo}
                            onSelecionar={setDataSelecionada}
                          />
                        ) : (
                          <AgendaEscala
                            datas={datas}
                            dataHoje={dataHoje}
                            dataSelecionada={dataSelecionadaEfetiva}
                            escala={minhaEscala}
                            catalogo={catalogo}
                            onSelecionar={setDataSelecionada}
                          />
                        )}
                      </div>
                      <DetalheDia
                        data={dataSelecionadaEfetiva}
                        dataHoje={dataHoje}
                        escala={minhaEscala}
                        catalogo={catalogo}
                        onSolicitarTroca={(diaEscolhido) => abrirNovaSolicitacaoTroca(diaEscolhido)}
                      />
                    </>
                  )}
                </div>
              </article>
              <ScheduleLegend catalogo={catalogo} titulo="Legenda" />
            </>
          )}
        </section>
      )}

      {tela === 'trocas' && usuario && (
        <section className="employee-screen employee-trocas-screen">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Combinar com a equipe</p>
              <h1>Trocas de escala</h1>
              <p>Peça e responda trocas de turno — a aprovação final é sempre do gestor.</p>
            </div>
            {jornadaPublicadaApp && (
              <button className="primary-button" type="button" onClick={() => abrirNovaSolicitacaoTroca()}>
                <ArrowLeftRight size={16} /> Nova solicitação
              </button>
            )}
          </header>
          {/*
            FASE-APP-OPERACOES-UNIVERSAIS-1 — regra 8: sem Jornada 6x1
            publicada, o fluxo de troca de Jornada não tem o que mostrar —
            mas isso é uma limitação CONTEXTUAL desta tela, nunca o alerta
            vermelho global (que só aparece por erro técnico real).
          */}
          {!jornadaPublicadaApp && (
            <div className="alert warning" role="status">
              Trocas de Jornada 6x1 não estão disponíveis porque não há Jornada publicada para este período.
            </div>
          )}
          {plantaoPublicadoApp && (
            <div className="alert warning" role="status">
              Trocas de Plantão serão tratadas em uma próxima fase.
            </div>
          )}
          {jornadaPublicadaApp && (
            <>
              {erroTroca && <div className="alert error" role="alert">{erroTroca}</div>}
              {avisoTrocaNaoEncontrada && <div className="alert warning" role="status">{avisoTrocaNaoEncontrada}</div>}
              <div className="segmented-control troca-abas">
                {([
                  ['minhas', 'Minhas', trocas.filter((item) => item.solicitanteLogin === usuario.login).length],
                  ['responder', 'Para responder', trocas.filter((item) => item.destinatarioLogin === usuario.login && item.status === 'PENDENTE_USUARIO').length],
                  ['gestor', 'Gestor', trocas.filter((item) => (item.solicitanteLogin === usuario.login || item.destinatarioLogin === usuario.login) && item.status === 'PENDENTE_GESTOR').length],
                  ['historico', 'Histórico', trocas.filter((item) => (item.solicitanteLogin === usuario.login || item.destinatarioLogin === usuario.login) && !statusEhAtivo(item.status)).length],
                ] as const).map(([id, rotulo, contagem]) => (
                  <button
                    key={id}
                    type="button"
                    className={abaTrocas === id ? 'active' : ''}
                    onClick={() => setAbaTrocas(id)}
                  >
                    {rotulo}{contagem > 0 && ` (${contagem})`}
                  </button>
                ))}
              </div>
              <div className="troca-lista">
                {(() => {
                  const minhas = trocas.filter((item) => item.solicitanteLogin === usuario.login);
                  const paraResponder = trocas.filter((item) => item.destinatarioLogin === usuario.login && item.status === 'PENDENTE_USUARIO');
                  const aguardandoGestor = trocas.filter((item) => (item.solicitanteLogin === usuario.login || item.destinatarioLogin === usuario.login)
                    && item.status === 'PENDENTE_GESTOR');
                  const historicoTrocas = trocas.filter((item) => (item.solicitanteLogin === usuario.login || item.destinatarioLogin === usuario.login)
                    && !statusEhAtivo(item.status));
                  const listaAtual = abaTrocas === 'minhas' ? minhas
                    : abaTrocas === 'responder' ? paraResponder
                      : abaTrocas === 'gestor' ? aguardandoGestor
                        : historicoTrocas;
                  const mensagemVazia = abaTrocas === 'minhas' ? 'Você ainda não pediu nenhuma troca.'
                    : abaTrocas === 'responder' ? 'Nenhuma solicitação esperando sua resposta.'
                      : abaTrocas === 'gestor' ? 'Nenhuma troca aguardando o gestor agora.'
                        : 'Nenhuma troca concluída ainda.';
                  if (listaAtual.length === 0) {
                    return (
                      <div className="notification-empty">
                        <ArrowLeftRight size={22} />
                        <span>{mensagemVazia}</span>
                      </div>
                    );
                  }
                  return listaAtual.map((item) => (
                    <TrocaItemButton
                      key={item.trocaId}
                      troca={item}
                      usuario={usuario}
                      onAbrir={() => setTrocaAbertaId(item.trocaId)}
                    />
                  ));
                })()}
              </div>
            </>
          )}
        </section>
      )}

      {tela === 'plantao' && usuario && (
        <section className="employee-screen employee-plantao-screen">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Plantão</p>
              <h1>{grupoPlantaoApp ? grupoPlantaoApp.nome : 'Plantão'}</h1>
              <p>Quem está de plantão agora, o próximo e — se você é plantonista — seus próprios plantões.</p>
            </div>
          </header>

          {carregandoPlantaoApp && (
            <article className="panel organization-empty-state" role="status">
              <LoaderCircle className="spin" size={28} aria-hidden="true" />
              <h2>Carregando Plantão…</h2>
            </article>
          )}

          {!carregandoPlantaoApp && erroPlantaoApp !== '' && (
            <div className="alert error" role="alert">{erroPlantaoApp}</div>
          )}

          {!carregandoPlantaoApp && erroPlantaoApp === '' && grupoPlantaoApp === null && (
            <article className="panel organization-empty-state">
              <Radio size={28} aria-hidden="true" />
              <h2>Nenhum Plantão configurado para sua equipe</h2>
              <p>Fale com seu coordenador se você espera ver uma escala de Plantão aqui.</p>
            </article>
          )}

          {!carregandoPlantaoApp && erroPlantaoApp === '' && grupoPlantaoApp != null && competenciaPlantaoApp === null && (
            <article className="panel organization-empty-state">
              <Radio size={28} aria-hidden="true" />
              <h2>Nenhuma escala publicada este mês</h2>
              <p>Quando o Plantão for publicado, ele aparece aqui automaticamente.</p>
            </article>
          )}

          {!carregandoPlantaoApp && erroPlantaoApp === '' && grupoPlantaoApp != null && competenciaPlantaoApp !== null && (() => {
            const grupo = grupoPlantaoApp;
            const agoraIso = agora.toISOString();
            const resumo = resolverPlantaoAgora(atribuicoesPlantaoApp, agoraIso);
            const nomeAtual = resumo.atual ? nomeExibicaoPlantonista(resumo.atual.plantonistaLogin, usuarios) : null;
            const contatosAtual = resumo.atual ? contatosAtivosDoPlantonista(resumo.atual.plantonistaLogin, participantesPlantaoApp) : [];
            const horarioAtual = resumo.atual ? horarioPlantaoParaExibicao(resumo.atual, grupo.timezone) : null;
            const nomeProximo = resumo.proximo ? nomeExibicaoPlantonista(resumo.proximo.plantonistaLogin, usuarios) : null;
            const horarioProximo = resumo.proximo ? horarioPlantaoParaExibicao(resumo.proximo, grupo.timezone) : null;
            const souPlantonista = participantesPlantaoApp.some((participante) => participante.login === usuario.login && participante.ativo);
            const meusPlantoes = souPlantonista ? proximosPlantoesDoUsuario(usuario.login, atribuicoesPlantaoApp, agoraIso, 6) : [];

            return (
              <>
                <article className="today-hero" data-state={resumo.atual !== null ? 'PLANTAO' : 'DESCANSO'}>
                  <header className="today-card-heading">
                    <span>De plantão agora</span>
                  </header>
                  {resumo.atual === null || horarioAtual === null ? (
                    <p className="today-rest-copy">Ninguém está de plantão neste momento.</p>
                  ) : (
                    <>
                      <div className="today-hero-heading">
                        <span className="today-hero-icon">{inicialPlantonista(nomeAtual ?? '')}</span>
                        <div>
                          <strong className="today-shift-name">{nomeAtual}</strong>
                          <div className="today-hours"><strong>{rotuloHorarioPlantaoExibicao(horarioAtual)}</strong></div>
                        </div>
                      </div>
                      <div className="today-meta">
                        <span className="live-badge">
                          <i /> Até {horarioAtual.horaFim}{horarioAtual.cruzaDiaSeguinte ? ' (amanhã)' : ''}
                        </span>
                      </div>
                      {contatosAtual.length > 0 && (
                        <div className="plantao-contatos-lista">
                          {contatosAtual.map((contato) => (
                            <span className="plantao-contato-chip" key={`${contato.rotulo}-${contato.numero}`}>
                              <Phone size={13} /> {contato.rotulo}: {contato.numero}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </article>

                <article className="panel next-shift-card">
                  <header className="today-card-heading">
                    <span>Próximo plantonista</span>
                    <CalendarCheck2 size={17} />
                  </header>
                  {resumo.proximo === null || horarioProximo === null ? (
                    <p className="empty-inline">Nenhum próximo plantão publicado.</p>
                  ) : (
                    <div className="next-shift-title">
                      <span className="next-shift-icon">{inicialPlantonista(nomeProximo ?? '')}</span>
                      <div>
                        <strong>{nomeProximo}</strong>
                        <span>{rotuloHorarioPlantaoExibicao(horarioProximo)}</span>
                        <small>Troca de plantonista</small>
                      </div>
                    </div>
                  )}
                </article>

                {periodoPlantaoApp && (
                  <article className="panel">
                    <div className="panel-title">
                      <div>
                        <h2>Calendário do mês</h2>
                        <p>Competência {formatarCompetencia(competenciaPlantaoApp)}</p>
                      </div>
                    </div>
                    <CalendarioPlantaoApp
                      periodoInicio={periodoPlantaoApp.inicio}
                      periodoFim={periodoPlantaoApp.fim}
                      dataHoje={dataHoje}
                      atribuicoes={atribuicoesPlantaoApp}
                      participantes={participantesPlantaoApp}
                      usuarios={usuarios}
                      timezone={grupo.timezone}
                      loginUsuarioAtual={usuario.login}
                    />
                  </article>
                )}

                {souPlantonista && (
                  <article className="panel">
                    <div className="panel-title"><div><h2>Meus próximos plantões</h2><p>Competência {formatarCompetencia(competenciaPlantaoApp)}</p></div></div>
                    {meusPlantoes.length === 0 ? (
                      <p className="empty-inline">Nenhum plantão futuro publicado para você nesta competência.</p>
                    ) : (
                      <div className="plantao-meus-lista">
                        {meusPlantoes.map((atribuicao) => {
                          const horario = horarioPlantaoParaExibicao(atribuicao, grupo.timezone);
                          const dataInicio = converterInstanteUtcParaMomento(atribuicao.inicio, grupo.timezone).data;
                          return (
                            <div className="plantao-meu-item" key={atribuicao.atribuicaoId}>
                              <span>{capitalizar(formatarData(dataInicio, { weekday: 'short', day: '2-digit', month: '2-digit' }))}</span>
                              <strong>{rotuloHorarioPlantaoExibicao(horario)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                )}

                {souPlantonista && (
                  <article className="panel">
                    <div className="panel-title">
                      <div>
                        <h2>Solicitar troca de plantão</h2>
                        <p>
                          Ainda não disponível. A troca de Plantão funciona de um jeito diferente da
                          Jornada SOC (turnos de 24h/12h/8h, em vez de dias inteiros) e exige uma etapa
                          própria — está planejada para uma próxima fase, sem prazo definido.
                        </p>
                      </div>
                    </div>
                    <button className="secondary-button" type="button" disabled title="Em breve">
                      <ArrowLeftRight size={16} /> Solicitar troca (em breve)
                    </button>
                  </article>
                )}
              </>
            );
          })()}
        </section>
      )}

      {tela === 'equipe' && (
        <section className="employee-screen employee-team-screen">
          <header className="page-heading">
            <div>
              <p className="eyebrow">COSI &gt; SOC</p>
              <h1>{equipeOperacaoEfetiva === 'PLANTAO' ? 'Participantes do Plantão' : 'Escala da equipe'}</h1>
              <p>
                {equipeOperacaoEfetiva === 'PLANTAO'
                  ? 'Contatos visíveis para quem consulta este Plantão.'
                  : 'Apenas escalas publicadas são exibidas.'}
              </p>
            </div>
            <span className="read-only-badge">
              <ShieldCheck size={16} /> Publicada
            </span>
          </header>

          {/*
            FASE-APP-OPERACOES-UNIVERSAIS-1 — regra 7: seletor só quando as
            duas operações existem; caso contrário o contexto único decide
            sozinho o que aparece (nunca mais "0 colaboradores" para quem só
            tem Plantão).
          */}
          {jornadaPublicadaApp && plantaoPublicadoApp && (
            <div className="segmented-control equipe-operacao-seletor" aria-label="Operação">
              <button
                type="button"
                className={equipeOperacaoEfetiva === 'JORNADA' ? 'active' : ''}
                aria-pressed={equipeOperacaoEfetiva === 'JORNADA'}
                onClick={() => setOperacaoEquipeApp('JORNADA')}
              >
                Equipe Jornada
              </button>
              <button
                type="button"
                className={equipeOperacaoEfetiva === 'PLANTAO' ? 'active' : ''}
                aria-pressed={equipeOperacaoEfetiva === 'PLANTAO'}
                onClick={() => setOperacaoEquipeApp('PLANTAO')}
              >
                Participantes do Plantão
              </button>
            </div>
          )}

          {equipeOperacaoEfetiva === 'PLANTAO' && plantaoPublicadoApp ? (
            <article className="panel grid-panel">
              <div className="toolbar">
                <span><Users size={16} /> {participantesPlantaoApp.filter((participante) => participante.ativo).length} participante(s)</span>
              </div>
              <div className="plantao-participantes-lista">
                {participantesPlantaoApp.filter((participante) => participante.ativo).map((participante) => {
                  const contatosAtivos = contatosAtivosDoPlantonista(participante.login, participantesPlantaoApp);
                  const souEu = participante.login === usuario.login;
                  return (
                    <article key={participante.login} className="app-participant-card">
                      <header className="app-participant-card-header">
                        <span className="avatar">
                          {inicialPlantonista(nomeExibicaoPlantonista(participante.login, usuarios))}
                        </span>
                        <div className="app-participant-identidade">
                          <strong>{nomeExibicaoPlantonista(participante.login, usuarios)}</strong>
                          <small>{participante.login}</small>
                        </div>
                        {souEu && <span className="app-participant-badge">Você</span>}
                      </header>
                      {contatosAtivos.length > 0 ? (
                        <div className="plantao-contatos-lista">
                          {contatosAtivos.map((contato) => (
                            <span className="plantao-contato-chip" key={`${contato.rotulo}-${contato.numero}`}>
                              <Phone size={13} /> {contato.rotulo}: {contato.numero}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="app-participant-contato-vazio">Contato não informado.</p>
                      )}
                    </article>
                  );
                })}
                {participantesPlantaoApp.filter((participante) => participante.ativo).length === 0 && (
                  <p className="empty-inline">Nenhum participante ativo neste Grupo.</p>
                )}
              </div>
            </article>
          ) : (
            <>
              <article className="panel grid-panel">
                <div className="toolbar">
                  <label>
                    <Filter size={16} />
                    <select
                      value={filtroTurno}
                      onChange={(evento) => setFiltroTurno(evento.target.value)}
                      aria-label="Filtrar por turno"
                    >
                      <option value="TODOS">Todos os turnos</option>
                      <option value="MD">Madrugada</option>
                      <option value="M">Manhã</option>
                      <option value="T">Tarde</option>
                      <option value="N">Noite</option>
                    </select>
                  </label>
                  <span><Users size={16} /> {documentos.length} colaboradores</span>
                </div>
                <ScheduleGrid
                  documentos={documentos}
                  usuarios={usuarios}
                  catalogo={catalogo}
                  filtroTurno={filtroTurno}
                  agruparPorPeriodo
                  avisoDivergencia={false}
                />
              </article>
              <ScheduleLegend catalogo={catalogo} titulo="Legenda" />
            </>
          )}
        </section>
      )}

      {tela === 'perfil' && (
        <section className="employee-screen employee-profile-screen">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Conta do colaborador</p>
              <h1>Perfil</h1>
              <p>Identidade usada para localizar sua escala publicada.</p>
            </div>
            <span className="read-only-badge">
              <ShieldCheck size={16} /> Somente leitura
            </span>
          </header>
          <div className="profile-layout">
            <article className="panel profile-card">
              <span className="profile-avatar">
                {usuario.nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}
              </span>
              <div>
                <h2>{usuario.nome}</h2>
                <p>{usuario.login}</p>
                <span className="live-badge"><i /> Conta ativa</span>
              </div>
            </article>
            <article className="panel profile-details">
              <div><Mail /><span>E-mail</span><strong>{usuario.email}</strong></div>
              <div><BriefcaseBusiness /><span>Cargo</span><strong>{usuario.cargo}</strong></div>
              <div><Building2 /><span>Equipe</span><strong>{usuario.equipeId}</strong></div>
              <div><UserRound /><span>Nível</span><strong>{usuario.nivelHierarquico}</strong></div>
            </article>
            {grupoPlantaoApp != null
              && participantesPlantaoApp.some((participante) => participante.login === usuario.login && participante.ativo)
              && contatosEdicaoApp !== null && (
              <article className="panel profile-plantao-contatos">
                <div className="panel-title">
                  <div>
                    <h2>Meus contatos de plantão</h2>
                    <p>Visíveis para quem consulta o Plantão — até {MAXIMO_CONTATOS_PLANTONISTA} contatos.</p>
                  </div>
                </div>
                <div className="app-contact-list">
                  {contatosEdicaoApp.length === 0 && (
                    <p className="empty-inline">Contato não informado.</p>
                  )}
                  {contatosEdicaoApp.map((contato, indice) => (
                    <article className="app-contact-card" key={indice}>
                      <header className="app-contact-card-header">
                        <strong>Contato {indice + 1}</strong>
                        <button
                          className="icon-button"
                          type="button"
                          title="Remover contato"
                          aria-label={`Remover contato ${indice + 1}`}
                          onClick={() => setContatosEdicaoApp((atuais) => (atuais ?? []).filter((_, posicao) => posicao !== indice))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </header>
                      <label className="app-contact-field">
                        <span>Rótulo</span>
                        <input
                          placeholder="Ex.: Contato principal"
                          value={contato.rotulo}
                          onChange={(evento) => setContatosEdicaoApp((atuais) => (atuais ?? []).map((item, posicao) => (posicao === indice ? { ...item, rotulo: evento.target.value } : item)))}
                        />
                      </label>
                      <label className="app-contact-field">
                        <span>Número</span>
                        <input
                          placeholder="Ex.: (41) 99999-9999"
                          value={contato.numero}
                          onChange={(evento) => setContatosEdicaoApp((atuais) => (atuais ?? []).map((item, posicao) => (posicao === indice ? { ...item, numero: evento.target.value } : item)))}
                        />
                      </label>
                      <label className="app-contact-toggle-row">
                        <input
                          type="checkbox"
                          checked={contato.ativo}
                          onChange={() => setContatosEdicaoApp((atuais) => (atuais ?? []).map((item, posicao) => (posicao === indice ? { ...item, ativo: !item.ativo } : item)))}
                        />
                        <span>Contato ativo</span>
                      </label>
                    </article>
                  ))}
                </div>
                <button
                  className="secondary-button compact-button app-contact-add-button"
                  type="button"
                  disabled={contatosEdicaoApp.length >= MAXIMO_CONTATOS_PLANTONISTA}
                  onClick={() => setContatosEdicaoApp((atuais) => ((atuais ?? []).length >= MAXIMO_CONTATOS_PLANTONISTA ? atuais : [...(atuais ?? []), { rotulo: '', numero: '', ativo: true }]))}
                >
                  <Plus size={14} /> Adicionar contato
                </button>
                {feedbackContatosApp && (
                  <p
                    className={`profile-feedback profile-feedback--${feedbackContatosApp.tipo}`}
                    role={feedbackContatosApp.tipo === 'erro' ? 'alert' : 'status'}
                  >
                    {feedbackContatosApp.mensagem}
                  </p>
                )}
                <div className="rollback-actions">
                  <button
                    className="primary-button app-contact-submit-button"
                    type="button"
                    disabled={salvandoContatosApp}
                    onClick={() => void salvarMeusContatosApp()}
                  >
                    {salvandoContatosApp ? <LoaderCircle className="spin" size={16} /> : <Phone size={16} />} Atualizar meus contatos
                  </button>
                </div>

                <div className="profile-plantao-cor">
                  <p className="profile-plantao-cor-titulo">Minha cor no calendário de Plantão</p>
                  <p className="empty-inline">Escolha uma cor para se achar mais fácil no calendário mensal.</p>
                  <div className="profile-plantao-cor-paleta" role="radiogroup" aria-label="Cor de identificação no calendário">
                    {Array.from({ length: 8 }, (_, indice) => indice).map((indice) => {
                      const corAtual = indiceCorPlantonista(usuario.login, participantesPlantaoApp);
                      const selecionada = corAtual === indice;
                      return (
                        <button
                          key={indice}
                          type="button"
                          className="profile-plantao-cor-opcao"
                          data-identidade={indice}
                          disabled={salvandoCorPlantaoApp}
                          aria-pressed={selecionada}
                          aria-label={`Cor ${indice + 1}${selecionada ? ' (selecionada)' : ''}`}
                          onClick={() => void salvarCorPlantaoApp(indice)}
                        >
                          {selecionada && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                  {participantesPlantaoApp.find((participante) => participante.login === usuario.login)?.corPreferida != null && (
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      disabled={salvandoCorPlantaoApp}
                      onClick={() => void salvarCorPlantaoApp(null)}
                    >
                      Usar cor automática
                    </button>
                  )}
                  {mensagemCorPlantaoApp !== '' && <p className="admin-form-erro">{mensagemCorPlantaoApp}</p>}
                </div>
              </article>
            )}
            <CardNotificacoesPush
              estado={estadoNotificacoesPush}
              erro={erroNotificacoesPush}
              identificadorDispositivo={identificadorDispositivoAbreviado(deviceIdPushAtual)}
              confirmacao={rotuloConfirmacaoPush(ultimaConfirmacaoPush)}
              serviceWorker={serviceWorkerPush}
              testeLocalMensagem={mensagemTesteLocalPush}
              diagnosticoCliqueMensagem={mensagemCliqueDiagnosticoPush}
              onAtivar={() => void ativarNotificacoesPush()}
              onDesativar={() => void desativarNotificacoesPush()}
              onReparar={() => void repararNotificacoesPush()}
              onTestarLocal={() => void testarNotificacaoLocalNesteDispositivo()}
            />
            <button className="secondary-button profile-logout" type="button" onClick={() => void encerrarSessao()}>
              <LogOut size={17} /> Sair deste dispositivo
            </button>
          </div>
        </section>
      )}

      {assistenteTroca && usuario && (
        <AssistenteNovaTroca
          estado={assistenteTroca}
          datas={datas}
          minhaEscala={minhaEscala}
          documentos={documentos}
          usuarios={usuarios}
          usuario={usuario}
          catalogo={catalogo}
          enviando={processandoTroca}
          erro={erroTroca}
          onMudarPasso={(passo) => setAssistenteTroca((atual) => atual && { ...atual, passo })}
          onEscolherData={(diaEscolhido) => setAssistenteTroca((atual) => atual && { ...atual, data: diaEscolhido })}
          onEscolherDestinatario={(login) => setAssistenteTroca((atual) => atual && { ...atual, destinatarioLogin: login })}
          onMudarMensagem={(mensagem) => setAssistenteTroca((atual) => atual && { ...atual, mensagem })}
          onFechar={() => { setAssistenteTroca(null); setErroTroca(''); }}
          onEnviar={() => void enviarSolicitacaoTroca()}
        />
      )}

      {trocaAberta && usuario && (
        trocaAberta.destinatarioLogin === usuario.login && trocaAberta.status === 'PENDENTE_USUARIO' ? (
          <ModalRespostaTroca
            troca={trocaAberta}
            processando={processandoTroca}
            erro={erroTroca}
            onFechar={() => { setTrocaAbertaId(null); setErroTroca(''); }}
            onAceitar={() => void responderSolicitacaoTroca(trocaAberta.trocaId, true)}
            onRecusar={() => void responderSolicitacaoTroca(trocaAberta.trocaId, false)}
          />
        ) : (
          <ModalDetalheTroca
            troca={trocaAberta}
            usuario={usuario}
            processando={processandoTroca}
            erro={erroTroca}
            onFechar={() => { setTrocaAbertaId(null); setErroTroca(''); }}
            onCancelar={() => void cancelarSolicitacaoTroca(trocaAberta.trocaId)}
          />
        )
      )}
    </AppFrame>
  );
}
