import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, History, Phone, Radio, SkipForward } from 'lucide-react';
import {
  formatarData,
  ROTULO_FUNCAO_PLANTAO,
  type AtribuicaoPlantaoPersistida,
  type GrupoPlantao,
} from '@escala-ici/contrato';

import type { Usuario } from '@/lib/modelos';

import {
  funcaoPrincipalDoPlantonista,
  intervaloPlantaoCivil,
  nomeExibicaoPlantonista,
  obterIniciaisParticipantePlantao,
} from './plantaoApp';
import { faixaHorario } from './formatoHorario';
import {
  meuPlantaoEmDestaque,
  minhaSemanaDePlantao,
  rotuloTempoAte,
  sequenciaDoPosto,
} from './hojePlantonista';

/**
 * HOJE-PLANTONISTA-1 — a tela Hoje de quem é plantonista (sem escala 6x1):
 * "Seu plantão" (agora ou o próximo, com previsão), "Passagem do plantão"
 * (antes · agora · depois, no meu posto — tocar abre os telefones) e
 * "Minha semana de plantão".
 */
interface Props {
  login: string;
  grupo: GrupoPlantao;
  atribuicoes: readonly AtribuicaoPlantaoPersistida[];
  usuarios: readonly Usuario[];
  agora: Date;
  dataHoje: string;
  /** Previsão do tempo no horário do plantão (o App já tem o componente). */
  renderPrevisao?: (data: string, horaInicio: string, horaFim: string) => ReactNode;
  onAbrirPlantonista: (atribuicao: AtribuicaoPlantaoPersistida) => void;
  onVerPlantao: () => void;
}

function rotuloDia(data: string): string {
  return formatarData(data, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
}

export function HojePlantonista({ login, grupo, atribuicoes, usuarios, agora, dataHoje, renderPrevisao, onAbrirPlantonista, onVerPlantao }: Props) {
  const agoraIso = agora.toISOString();
  const timezone = grupo.timezone;
  const meuPosto = funcaoPrincipalDoPlantonista(atribuicoes, login);
  const destaque = meuPlantaoEmDestaque(login, atribuicoes, agoraIso);
  const sequencia = sequenciaDoPosto(atribuicoes, agoraIso, meuPosto ?? undefined);
  const semana = minhaSemanaDePlantao(login, atribuicoes, dataHoje, timezone);

  const linhaPassagem = (rotulo: string, icone: ReactNode, atribuicao: AtribuicaoPlantaoPersistida | null, agoraNela: boolean) => {
    if (!atribuicao) {
      return (
        <li className="passagem-linha vazia">
          <span className="passagem-rotulo">{icone}{rotulo}</span>
          <span className="passagem-vazio">Sem plantão registrado</span>
        </li>
      );
    }
    const intervalo = intervaloPlantaoCivil(atribuicao, timezone);
    const nome = nomeExibicaoPlantonista(atribuicao.plantonistaLogin, usuarios);
    const souEu = atribuicao.plantonistaLogin === login;
    return (
      <li className={`passagem-linha${agoraNela ? ' agora' : ''}`}>
        <button type="button" onClick={() => onAbrirPlantonista(atribuicao)} aria-label={`Ver contatos de ${nome}`}>
          <span className="passagem-rotulo">{icone}{rotulo}</span>
          <span className="passagem-avatar" aria-hidden="true">{obterIniciaisParticipantePlantao(nome, atribuicao.plantonistaLogin)}</span>
          <span className="passagem-pessoa">
            <strong>{nome}{souEu && <em className="passagem-voce">Você</em>}</strong>
            <small>
              {intervalo.valido
                ? `${rotuloDia(intervalo.dataInicio)} ${intervalo.horaInicio} → ${intervalo.dataFim !== intervalo.dataInicio ? `${rotuloDia(intervalo.dataFim)} ` : ''}${intervalo.horaFim}`
                : 'Horário indisponível'}
            </small>
          </span>
          {!souEu && <span className="passagem-ligar"><Phone size={15} aria-hidden="true" /></span>}
          <ChevronRight size={16} aria-hidden="true" className="passagem-seta" />
        </button>
      </li>
    );
  };

  const intervaloDestaque = destaque.estado === 'NENHUM' ? null : intervaloPlantaoCivil(destaque.atribuicao, timezone);

  return (
    <>
      {/* 1. Seu plantão */}
      <article className="panel plantonista-hero" data-estado={destaque.estado}>
        <div className="panel-title compact"><span>Seu plantão</span>{meuPosto && <span className="plantonista-posto">{ROTULO_FUNCAO_PLANTAO[meuPosto] ?? meuPosto}</span>}</div>
        {destaque.estado === 'NENHUM' || !intervaloDestaque ? (
          <div className="plantonista-hero-vazio">
            <Radio size={22} aria-hidden="true" />
            <div>
              <strong>Nenhum plantão seu nesta competência</strong>
              <span>Quando houver, ele aparece aqui com o horário e quanto falta.</span>
            </div>
          </div>
        ) : (
          <div className="plantonista-hero-linha">
            <div className="plantonista-hero-principal">
              <span className="plantonista-hero-icone"><Radio size={24} aria-hidden="true" /></span>
              <div>
                <span className="plantonista-hero-estado">{destaque.estado === 'AGORA' ? 'Você está de plantão' : 'Próximo plantão'}</span>
                <strong className="plantonista-hero-horario">{faixaHorario(intervaloDestaque.horaInicio, intervaloDestaque.horaFim)}</strong>
                <span className="plantonista-hero-datas">
                  {rotuloDia(intervaloDestaque.dataInicio)} <ArrowRight size={12} aria-hidden="true" /> {rotuloDia(intervaloDestaque.dataFim)}
                  {' · '}
                  <b>{destaque.estado === 'AGORA' ? `termina ${rotuloTempoAte(destaque.minutosParaFim)}` : `começa ${rotuloTempoAte(destaque.minutosParaInicio)}`}</b>
                </span>
                {destaque.estado === 'AGORA' && (
                  <span className="plantonista-progresso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(destaque.progresso * 100)}>
                    <span style={{ width: `${Math.round(destaque.progresso * 100)}%` }} />
                  </span>
                )}
              </div>
            </div>
            {renderPrevisao?.(intervaloDestaque.dataInicio, intervaloDestaque.horaInicio, intervaloDestaque.horaFim)}
          </div>
        )}
      </article>

      {/* 2. Passagem do plantão */}
      <article className="panel plantonista-passagem">
        <div className="panel-title compact">
          <span>Passagem do plantão</span>
          <button type="button" className="text-button" onClick={onVerPlantao}>Ver escala <ChevronRight size={14} aria-hidden="true" /></button>
        </div>
        <ul>
          {linhaPassagem('Antes', <History size={13} aria-hidden="true" />, sequencia.anterior, false)}
          {linhaPassagem('Agora', <Radio size={13} aria-hidden="true" />, sequencia.atual, true)}
          {linhaPassagem('Depois', <SkipForward size={13} aria-hidden="true" />, sequencia.proximo, false)}
        </ul>
        <p className="plantonista-dica">Toque em uma pessoa para ver os telefones e ligar.</p>
      </article>

      {/* 3. Minha semana de plantão */}
      <article className="panel plantonista-semana">
        <div className="panel-title compact"><span><CalendarDays size={15} aria-hidden="true" /> Minha semana de plantão</span></div>
        <ol>
          {semana.map((dia) => (
            <li key={dia.data} className={`${dia.hoje ? 'hoje ' : ''}${dia.plantoes.length > 0 ? 'com-plantao' : dia.continuacao ? 'continuacao' : ''}`}>
              <span className="plantonista-semana-dia">{formatarData(dia.data, { weekday: 'short' }).replace('.', '')}</span>
              <strong>{dia.data.slice(8, 10)}</strong>
              {dia.plantoes.length > 0
                ? dia.plantoes.map((plantao) => <small key={plantao.atribuicao.inicio}>{plantao.horaInicio}<br />{plantao.horaFim}</small>)
                : <small>{dia.continuacao ? 'até de manhã' : 'livre'}</small>}
            </li>
          ))}
        </ol>
      </article>
    </>
  );
}
