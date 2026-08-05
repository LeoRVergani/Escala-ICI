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
  BriefcaseBusiness,
  Bell,
  BellRing,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
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
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AppFrame, type ItemNavegacao } from '@/components/AppFrame';
import { LoginPanel } from '@/components/LoginPanel';
import {
  TelaRestaurandoSessao,
  useRestauracaoSessao,
} from '@/components/RestauracaoSessao';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { sair } from '@/lib/firebase/authRepository';
import { mensagemErroFirebase } from '@/lib/firebase/errors';
import { ambienteFirebaseAtual } from '@/lib/firebase/shared';
import {
  carregarEscalasEquipe,
  carregarMinhaEscala,
  listarCatalogo,
  listarUsuarios,
  observarEscalasEquipe,
  observarEventosEscala,
} from '@/lib/firebase/readRepository';
import { USUARIOS_DEMO } from '@/lib/demoIdentidades';
import type { EventoEscala, Usuario } from '@/lib/modelos';
import { deveExibirRestauracao, podeIniciarListeners } from '@/lib/sessao';

type Tela = 'hoje' | 'minha' | 'equipe' | 'perfil';
type ModoEscala = 'calendario' | 'agenda';

const NAVEGACAO: ItemNavegacao[] = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'home' },
  { id: 'minha', rotulo: 'Agenda', icone: 'calendar' },
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
}: {
  data: string;
  dataHoje: string;
  escala: TurnosMes | null;
  catalogo: typeof CATALOGO_SOC;
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
    return () => {
      cancelarEscalas();
      cancelarEventos();
    };
  }, [competenciaAtiva, equipeUsuario, listenersLiberados, loginUsuario]);

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
    setDadosCarregados(false);
    setCentralAberta(false);
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
        <NotificationBell
          eventos={eventos}
          idsLidos={idsLidos}
          aberta={centralAberta}
          catalogo={catalogo}
          onAlternar={alternarCentral}
          onAtivarSistema={() => void ativarNotificacoesSistema()}
        />
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
              />
            </div>
            <div className="legend-row">
              {Object.values(catalogo).slice(0, 8).map((tipo) => (
                <span key={tipo.codigo}>
                  <i className="shift-chip" data-code={tipo.codigo}>{tipo.codigo}</i>
                  {tipo.descricao}
                </span>
              ))}
            </div>
          </article>
        </section>
      )}

      {tela === 'equipe' && (
        <section className="employee-screen employee-team-screen">
          <header className="page-heading">
            <div>
              <p className="eyebrow">COSI &gt; SOC</p>
              <h1>Escala da equipe</h1>
              <p>Apenas documentos publicados são exibidos.</p>
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
            />
          </article>
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
    </AppFrame>
  );
}
