'use client';

import {
  CATALOGO_SOC,
  calcularTotais,
  competenciaOperacional,
  competenciasCandidatas,
  formatarCompetencia,
  formatarData,
  formatarMinutos,
  formatarPeriodo,
  referenciaLocal,
  resolverContextoJornada,
  resolverJornadaDia,
  selecionarEscalaPorData,
  type ContextoJornada,
  type IntervaloTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  ArrowLeftRight,
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
  LogOut,
  Mail,
  Moon,
  Search,
  ShieldCheck,
  Sunrise,
  Sunset,
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
  cancelarSolicitacaoTroca as cancelarSolicitacaoTrocaFirebase,
  criarSolicitacaoTroca,
  marcarNotificacaoTrocaComoLida,
  observarNotificacoesTroca,
  observarTrocasDoUsuario,
  responderSolicitacaoTroca as responderSolicitacaoTrocaFirebase,
} from '@/lib/firebase/trocasRepository';
import { USUARIOS_DEMO } from '@/lib/demoIdentidades';
import type { EventoEscala, Usuario } from '@/lib/modelos';
import { deveExibirRestauracao, podeIniciarListeners } from '@/lib/sessao';
import {
  ROTULO_STATUS_TROCA,
  SEVERIDADE_STATUS_TROCA,
  statusEhAtivo,
  type NotificacaoTroca,
  type SolicitacaoTrocaReal,
} from '@/lib/trocasEscala';

type Tela = 'hoje' | 'minha' | 'trocas' | 'equipe' | 'perfil';
type ModoEscala = 'calendario' | 'agenda';
type AbaTrocas = 'minhas' | 'responder' | 'gestor' | 'historico';

const NAVEGACAO: ItemNavegacao[] = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'home' },
  { id: 'minha', rotulo: 'Agenda', icone: 'calendar' },
  { id: 'trocas', rotulo: 'Trocas', icone: 'trocas' },
  { id: 'equipe', rotulo: 'Equipe', icone: 'users' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'user' },
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
  escala,
  catalogo,
  onSelecionar,
}: Omit<VisualizacaoEscalaProps, 'dataSelecionada'>) {
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
          return (
            <button
              key={data}
              type="button"
              className={data === dataHoje ? 'today' : ''}
              onClick={() => onSelecionar(data)}
              aria-label={`${formatarData(data, {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}: ${jornada.descricao}`}
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
  const [eventos, setEventos] = useState<EventoEscala[]>([]);
  const [idsLidos, setIdsLidos] = useState<Set<string>>(() => new Set());
  const [centralAberta, setCentralAberta] = useState(false);
  const [avisoAtualizacao, setAvisoAtualizacao] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [trocas, setTrocas] = useState<SolicitacaoTrocaReal[]>([]);
  const [notificacoesTroca, setNotificacoesTroca] = useState<NotificacaoTroca[]>([]);
  const [centralTrocasAberta, setCentralTrocasAberta] = useState(false);
  const [abaTrocas, setAbaTrocas] = useState<AbaTrocas>('minhas');
  const [trocaAbertaId, setTrocaAbertaId] = useState<string | null>(null);
  const [assistenteTroca, setAssistenteTroca] = useState<EstadoAssistenteTroca | null>(null);
  const [processandoTroca, setProcessandoTroca] = useState(false);
  const [erroTroca, setErroTroca] = useState('');
  const eventosConhecidos = useRef<Set<string>>(new Set());
  const primeiraCargaEventos = useRef(true);
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
    ? 'Troca não encontrada ou ainda carregando. Tente abrir pela aba Trocas.'
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

  const escaladosHoje = documentos
    .map((documento) => ({
      documento,
      jornada: resolverJornadaDia(documento, catalogo, dataHoje),
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
        if (minha === null) {
          setErro('Nenhuma escala publicada foi encontrada para o seu login neste período.');
        }
      }
    } catch (falha) {
      setErro(mensagemErroFirebase(falha, 'Não foi possível carregar a escala.', ambienteFirebaseAtual));
    } finally {
      // Libera a sincronização mesmo se a carga inicial falhar: o snapshot em
      // tempo real é a chance de a escala aparecer sem exigir F5.
      setDadosCarregados(true);
    }
  }

  async function encerrarSessao() {
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

  function abrirDia(data: string) {
    setDataSelecionada(data);
    setTela('minha');
  }

  return (
    <AppFrame
      produto="app"
      usuario={usuario}
      competencia={formatarCompetencia(competenciaAtiva)}
      itens={NAVEGACAO}
      ativo={tela}
      onNavegar={(id) => setTela(id as Tela)}
      onSair={encerrarSessao}
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

          <div className="today-summary-grid today-dashboard-grid">
            <TurnoHoje contexto={contextoHoje} />
            <ProximoTurno turno={contextoHoje.proximoTurno} />
            <ResumoSemana
              datas={datas}
              dataHoje={dataHoje}
              escala={minhaEscala}
              catalogo={catalogo}
              onSelecionar={abrirDia}
            />
          </div>

          <article className="panel today-team-panel">
            <div className="panel-title today-team-title">
              <div>
                <h2>Equipe escalada hoje</h2>
                <p>{escaladosHoje.length} colaborador(es) encontrado(s)</p>
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
                const pessoas = escaladosHoje.filter(
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
                {minhaEscala
                  ? `Período de ${formatarPeriodo(minhaEscala.periodoInicio, minhaEscala.periodoFim)}.`
                  : 'Nenhuma escala publicada para exibir.'}
              </p>
            </div>
            <span className="read-only-badge">
              <ShieldCheck size={16} /> Somente leitura
            </span>
          </header>

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
                <h2>{tituloCalendario(datas)}</h2>
                <p>{minhaEscala?.turnoPadrao} · {minhaEscala?.login}</p>
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
              </div>
            </div>
            <div className="schedule-explorer">
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
            </div>
          </article>
          <ScheduleLegend catalogo={catalogo} titulo="Legenda" />
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
            <button className="primary-button" type="button" onClick={() => abrirNovaSolicitacaoTroca()}>
              <ArrowLeftRight size={16} /> Nova solicitação
            </button>
          </header>
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
        </section>
      )}

      {tela === 'equipe' && (
        <section className="employee-screen employee-team-screen">
          <header className="page-heading">
            <div>
              <p className="eyebrow">COSI &gt; SOC</p>
              <h1>Escala da equipe</h1>
              <p>Apenas escalas publicadas são exibidas.</p>
            </div>
            <span className="read-only-badge">
              <ShieldCheck size={16} /> Publicada
            </span>
          </header>
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
