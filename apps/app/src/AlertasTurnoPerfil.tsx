import { useEffect, useState } from 'react';
import { AlarmClock, BellRing, CheckCircle2, Coffee, LogIn, LogOut } from 'lucide-react';
import {
  horarioDentroDoTurno,
  OPCOES_AVISO_ANTES_MINUTOS,
  OPCOES_DURACAO_INTERVALO_MINUTOS,
  sugerirHorarioIntervalo,
  validarPreferenciasAlertasTurno,
  type PeriodoAlertaTurno,
  type PreferenciasAlertasTurno,
} from '@escala-ici/contrato';

import { obterPreferenciasAlertasTurno, salvarPreferenciasAlertasTurno } from '@/lib/firebase/alertasTurnoRepository';
import { faixaHorario } from './formatoHorario';

/**
 * ALERTAS-TURNO-1 — Perfil › Avisos do turno: "Você trabalha hoje", ponto de entrada,
 * intervalo (um horário por TURNO que a pessoa faz, no seletor de hora nativo
 * do celular) e ponto de saída. O envio é feito pelo servidor na hora certa,
 * só em dia de trabalho, a partir da escala publicada.
 */
export interface TurnoDaPessoa {
  periodo: PeriodoAlertaTurno;
  descricao: string;
  inicio: string;
  fim: string;
}

function rotuloMinutos(minutos: number): string {
  return minutos >= 60 ? `${minutos / 60} h` : `${minutos} min`;
}

function Interruptor({ ativo, onMudar, rotulo }: { ativo: boolean; onMudar: (valor: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ativo} aria-label={rotulo} className="alerta-turno-interruptor" onClick={() => onMudar(!ativo)}>
      <span />
    </button>
  );
}

export function AlertasTurnoPerfil({ login, turnos }: { login: string; turnos: readonly TurnoDaPessoa[] }) {
  const [preferencias, setPreferencias] = useState<PreferenciasAlertasTurno | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    let cancelado = false;
    void obterPreferenciasAlertasTurno(login)
      .then((dados) => { if (!cancelado) setPreferencias(dados); })
      .catch(() => { if (!cancelado) setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar seus avisos do turno.' }); });
    return () => { cancelado = true; };
  }, [login]);

  if (preferencias === null) {
    return (
      <article className="panel alertas-turno-perfil">
        <div className="alertas-turno-cabecalho"><BellRing size={18} aria-hidden="true" /><h2>Avisos do turno</h2></div>
        <p className="alertas-turno-ajuda">{mensagem?.texto ?? 'Carregando…'}</p>
      </article>
    );
  }

  const mudar = (alteracao: (atual: PreferenciasAlertasTurno) => PreferenciasAlertasTurno) => {
    setPreferencias((atual) => (atual ? alteracao(atual) : atual));
    setAlterado(true);
    setMensagem(null);
  };
  const horarioIntervalo = (turno: TurnoDaPessoa) =>
    preferencias.intervalo.horarios[turno.periodo] ?? sugerirHorarioIntervalo(turno.inicio, turno.fim);

  async function salvar() {
    if (!preferencias) return;
    // Os turnos que a pessoa faz ficam com horário gravado (a sugestão vira valor).
    const horarios = { ...preferencias.intervalo.horarios };
    for (const turno of turnos) horarios[turno.periodo] = horarios[turno.periodo] ?? sugerirHorarioIntervalo(turno.inicio, turno.fim);
    const final = { ...preferencias, intervalo: { ...preferencias.intervalo, horarios } };
    const erros = validarPreferenciasAlertasTurno(final);
    if (erros.length > 0) {
      setMensagem({ tipo: 'erro', texto: erros[0]! });
      return;
    }
    setSalvando(true);
    try {
      await salvarPreferenciasAlertasTurno(final);
      setPreferencias(final);
      setAlterado(false);
      setMensagem({ tipo: 'ok', texto: 'Avisos do turno salvos.' });
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível salvar agora. Tente de novo.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <article className="panel alertas-turno-perfil">
      <div className="alertas-turno-cabecalho">
        <BellRing size={18} aria-hidden="true" />
        <div>
          <h2>Avisos do turno</h2>
          <p className="alertas-turno-ajuda">Notificações no celular conforme a sua escala publicada — só em dia de trabalho.</p>
        </div>
        <button className="primary-button compact-button" type="button" disabled={!alterado || salvando} onClick={() => void salvar()}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <ul className="alertas-turno-lista">
        <li>
          <span className="alerta-turno-icone"><AlarmClock size={18} aria-hidden="true" /></span>
          <div className="alerta-turno-texto">
            <strong>Você trabalha hoje</strong>
            <small>Aviso antes do início do turno</small>
            {preferencias.avisoAntes.ativo && (
              <div className="alerta-turno-opcoes" role="radiogroup" aria-label="Quanto tempo antes">
                {OPCOES_AVISO_ANTES_MINUTOS.map((minutos) => (
                  <button key={minutos} type="button" role="radio" aria-checked={preferencias.avisoAntes.minutos === minutos}
                    className={preferencias.avisoAntes.minutos === minutos ? 'active' : ''}
                    onClick={() => mudar((atual) => ({ ...atual, avisoAntes: { ...atual.avisoAntes, minutos } }))}>
                    {rotuloMinutos(minutos)} antes
                  </button>
                ))}
              </div>
            )}
          </div>
          <Interruptor rotulo="Você trabalha hoje" ativo={preferencias.avisoAntes.ativo}
            onMudar={(ativo) => mudar((atual) => ({ ...atual, avisoAntes: { ...atual.avisoAntes, ativo } }))} />
        </li>

        <li>
          <span className="alerta-turno-icone"><LogIn size={18} aria-hidden="true" /></span>
          <div className="alerta-turno-texto">
            <strong>Bater o ponto de entrada</strong>
            <small>No horário de início do turno</small>
          </div>
          <Interruptor rotulo="Ponto de entrada" ativo={preferencias.pontoEntrada.ativo}
            onMudar={(ativo) => mudar((atual) => ({ ...atual, pontoEntrada: { ativo } }))} />
        </li>

        <li>
          <span className="alerta-turno-icone"><Coffee size={18} aria-hidden="true" /></span>
          <div className="alerta-turno-texto">
            <strong>Intervalo</strong>
            <small>Aviso no início e no fim do intervalo</small>
            {preferencias.intervalo.ativo && (
              <>
                <div className="alerta-turno-opcoes" role="radiogroup" aria-label="Duração do intervalo">
                  {OPCOES_DURACAO_INTERVALO_MINUTOS.map((minutos) => (
                    <button key={minutos} type="button" role="radio" aria-checked={preferencias.intervalo.duracaoMinutos === minutos}
                      className={preferencias.intervalo.duracaoMinutos === minutos ? 'active' : ''}
                      onClick={() => mudar((atual) => ({ ...atual, intervalo: { ...atual.intervalo, duracaoMinutos: minutos } }))}>
                      {minutos} min
                    </button>
                  ))}
                </div>
                {turnos.length === 0 ? (
                  <small className="alertas-turno-ajuda">Os horários aparecem quando houver escala publicada para você.</small>
                ) : (
                  <div className="alerta-turno-turnos">
                    {turnos.map((turno) => {
                      const horario = horarioIntervalo(turno);
                      const dentro = horarioDentroDoTurno(horario, turno.inicio, turno.fim);
                      return (
                        <label key={turno.periodo} className="alerta-turno-turno" data-fora={dentro ? undefined : ''}>
                          <span className="shift-chip" data-code={turno.periodo}>{turno.periodo}</span>
                          <span className="alerta-turno-turno-nome">
                            <strong>{turno.descricao}</strong>
                            <small>{faixaHorario(turno.inicio, turno.fim)}</small>
                          </span>
                          <span className="alerta-turno-turno-hora">
                            <small>intervalo às</small>
                            <input
                              type="time"
                              step={300}
                              value={horario}
                              aria-label={`Horário do intervalo no turno ${turno.descricao}`}
                              onChange={(evento) => {
                                const valor = evento.target.value;
                                if (!valor) return;
                                mudar((atual) => ({ ...atual, intervalo: { ...atual.intervalo, horarios: { ...atual.intervalo.horarios, [turno.periodo]: valor } } }));
                              }}
                            />
                          </span>
                          {!dentro && <em>Fora do horário do turno</em>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <Interruptor rotulo="Intervalo" ativo={preferencias.intervalo.ativo}
            onMudar={(ativo) => mudar((atual) => ({ ...atual, intervalo: { ...atual.intervalo, ativo } }))} />
        </li>

        <li>
          <span className="alerta-turno-icone"><LogOut size={18} aria-hidden="true" /></span>
          <div className="alerta-turno-texto">
            <strong>Bater o ponto de saída</strong>
            <small>No horário de término do turno</small>
          </div>
          <Interruptor rotulo="Ponto de saída" ativo={preferencias.pontoSaida.ativo}
            onMudar={(ativo) => mudar((atual) => ({ ...atual, pontoSaida: { ativo } }))} />
        </li>
      </ul>

      {mensagem && (
        <p className={`alertas-turno-mensagem ${mensagem.tipo}`} role="status">
          {mensagem.tipo === 'ok' && <CheckCircle2 size={15} aria-hidden="true" />} {mensagem.texto}
        </p>
      )}
      <p className="alertas-turno-ajuda">Para receber, ative as notificações neste aparelho (no card acima).</p>
    </article>
  );
}
