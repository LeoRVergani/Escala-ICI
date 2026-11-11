import { useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeftRight, CalendarDays, ChevronRight, Coffee, Radio, UserCheck, Users, UserX } from 'lucide-react';
import {
  formatarData,
  ROTULO_FUNCAO_PLANTAO,
  type AtribuicaoPlantaoPersistida,
  type FuncaoPlantao,
  type TipoTurno,
} from '@escala-ici/contrato';

import type { Usuario } from '@/lib/modelos';
import { faixaHorario } from './formatoHorario';
import { sequenciaDoPosto } from './hojePlantonista';
import { nomeExibicaoPlantonista, obterIniciaisParticipantePlantao } from './plantaoApp';
import { deslocarDias, resumirEquipeNoDia, type PessoaNoDia } from './visaoCoordenador';
import type { EquipeJornadaVisao, PlantaoVisao } from './VisaoCoordenador';

/**
 * HOJE-COORDENACAO-1 — a tela Hoje de quem coordena (6x1 e/ou Plantão):
 * números do dia; por equipe 6x1, Ontem | Hoje | Amanhã por turno (com a
 * previsão do tempo de cada turno e o "Agora"); por Plantão, Antes · Agora ·
 * Depois de cada posto (tocar abre os telefones). Só Plantão: só Plantão.
 */
const PERIODOS = ['MD', 'M', 'T', 'N'] as const;
type Periodo = (typeof PERIODOS)[number];
type Dia = 'ontem' | 'hoje' | 'amanha';

/** Turno em andamento agora (hora de Brasília): MD 01–07, M 07–13, T 13–19, N 19–01. */
export function periodoAgora(hora: number): { periodo: Periodo; ontem: boolean } {
  if (hora < 1) return { periodo: 'N', ontem: true };
  if (hora < 7) return { periodo: 'MD', ontem: false };
  if (hora < 13) return { periodo: 'M', ontem: false };
  if (hora < 19) return { periodo: 'T', ontem: false };
  return { periodo: 'N', ontem: false };
}

function horaDeBrasilia(agora: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora));
}

/** COORD-VISUAL-1 — com trim: nome cadastrado com espaço no começo não some. */
export function primeiroNome(nome: string): string {
  const limpo = nome.trim();
  return limpo.split(/\s+/u)[0] || limpo;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/u);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)?.[0] ?? '' : '')).toUpperCase();
}

interface Props {
  equipes: readonly EquipeJornadaVisao[];
  plantoes: readonly PlantaoVisao[];
  dataHoje: string;
  agora: Date;
  catalogo: Record<string, TipoTurno>;
  usuarios: readonly Usuario[];
  trocasParaAprovar: number;
  /** Previsão compacta (ícone + temperatura) no horário de um turno. */
  renderPrevisao?: (data: string, inicio: string, fim: string) => ReactNode;
  onAbrirEquipes: () => void;
  onAbrirTrocas: () => void;
  onAbrirPlantonista: (plantao: PlantaoVisao, atribuicao: AtribuicaoPlantaoPersistida) => void;
}

function Numero({ icone, rotulo, valor, destaque, onClick }: { icone: ReactNode; rotulo: string; valor: number | string; destaque?: 'alerta' | 'ok'; onClick?: () => void }) {
  const conteudo = (
    <>
      <span className="coord-numero-icone">{icone}</span>
      <span className="coord-numero-texto"><small>{rotulo}</small><strong>{valor}</strong></span>
    </>
  );
  return onClick
    ? <button type="button" className="coord-numero" data-destaque={destaque} onClick={onClick}>{conteudo}<ChevronRight size={15} aria-hidden="true" /></button>
    : <div className="coord-numero" data-destaque={destaque}>{conteudo}</div>;
}

function EquipeNoDia({ equipe, dataHoje, agora, catalogo, renderPrevisao, onAbrirEquipes }: {
  equipe: EquipeJornadaVisao; dataHoje: string; agora: Date; catalogo: Record<string, TipoTurno>;
  renderPrevisao?: Props['renderPrevisao']; onAbrirEquipes: () => void;
}) {
  const [dia, setDia] = useState<Dia>('hoje');
  const data = dia === 'ontem' ? deslocarDias(dataHoje, -1) : dia === 'amanha' ? deslocarDias(dataHoje, 1) : dataHoje;
  const resumo = resumirEquipeNoDia(equipe.documentos, data, catalogo, equipe.nomes);
  const semEscala = !equipe.documentos.some((documento) => documento.dias[data] !== undefined);
  const agoraTurno = periodoAgora(horaDeBrasilia(agora));
  const dataDoAgora = agoraTurno.ontem ? deslocarDias(dataHoje, -1) : dataHoje;
  const pessoas = (lista: readonly PessoaNoDia[]) => lista.map((pessoa) => (
    <span key={pessoa.login} className="coord-pessoa" title={pessoa.nome}>
      <span aria-hidden="true">{iniciais(pessoa.nome)}</span>{primeiroNome(pessoa.nome)}{pessoa.horaExtra && <em>HE</em>}
    </span>
  ));

  return (
    <article className="panel coord-equipe">
      <header className="coord-cartao-cabecalho">
        <div>
          <h3><Users size={16} aria-hidden="true" /> {equipe.nome}</h3>
          <small>Escala 6x1 · {formatarData(data, { weekday: 'long', day: '2-digit', month: '2-digit' })}</small>
        </div>
        <button type="button" className="text-button" onClick={onAbrirEquipes}>Ver escala <ChevronRight size={14} aria-hidden="true" /></button>
      </header>
      <div className="coord-segmento" role="tablist" aria-label="Dia">
        {(['ontem', 'hoje', 'amanha'] as const).map((opcao) => (
          <button key={opcao} type="button" role="tab" aria-selected={dia === opcao} className={dia === opcao ? 'active' : ''} onClick={() => setDia(opcao)}>
            {opcao === 'ontem' ? 'Ontem' : opcao === 'hoje' ? 'Hoje' : 'Amanhã'}
          </button>
        ))}
      </div>
      {semEscala ? (
        <p className="coord-vazio">Sem escala publicada para este dia.</p>
      ) : (
        <ul className="coord-turnos">
          {PERIODOS.map((periodo) => {
            const tipo = catalogo[periodo];
            const lista = resumo.porPeriodo[periodo];
            const ehAgora = data === dataDoAgora && periodo === agoraTurno.periodo;
            const descoberto = resumo.descobertos.includes(periodo);
            if (lista.length === 0 && !descoberto) return null;
            return (
              <li key={periodo} className={`coord-turno${ehAgora ? ' agora' : ''}${descoberto ? ' descoberto' : ''}`}>
                <span className="shift-chip" data-code={periodo}>{periodo}</span>
                <span className="coord-turno-nome">
                  <strong>{tipo?.descricao ?? periodo}{ehAgora && <em className="coord-agora">Agora</em>}</strong>
                  <small>{tipo?.horaInicio && tipo.horaFim ? faixaHorario(tipo.horaInicio, tipo.horaFim) : ''}</small>
                </span>
                <span className="coord-turno-pessoas">
                  {descoberto ? <span className="coord-descoberto"><AlertTriangle size={13} aria-hidden="true" /> Ninguém escalado</span> : pessoas(lista)}
                </span>
                {tipo?.horaInicio && tipo.horaFim && renderPrevisao?.(data, tipo.horaInicio, tipo.horaFim)}
              </li>
            );
          })}
        </ul>
      )}
      {!semEscala && (resumo.folga.length > 0 || resumo.ausentes.length > 0) && (
        <footer className="coord-equipe-rodape">
          {resumo.folga.length > 0 && <span><Coffee size={13} aria-hidden="true" /> <b>Folga:</b> {resumo.folga.map((pessoa) => primeiroNome(pessoa.nome)).join(', ')}</span>}
          {resumo.ausentes.length > 0 && <span><UserX size={13} aria-hidden="true" /> <b>Ausentes:</b> {resumo.ausentes.map((pessoa) => `${primeiroNome(pessoa.nome)} (${pessoa.codigo})`).join(', ')}</span>}
        </footer>
      )}
    </article>
  );
}

function PlantaoNoDia({ plantao, agoraIso, usuarios, onAbrirPlantonista, onAbrirEquipes }: {
  plantao: PlantaoVisao; agoraIso: string; usuarios: readonly Usuario[];
  onAbrirPlantonista: Props['onAbrirPlantonista']; onAbrirEquipes: () => void;
}) {
  const funcoes = [...new Set(plantao.atribuicoes.map((atribuicao) => atribuicao.funcao).filter((funcao): funcao is FuncaoPlantao => funcao !== undefined))];
  const postos: Array<FuncaoPlantao | undefined> = funcoes.length > 0 ? funcoes : [undefined];
  const pessoa = (atribuicao: AtribuicaoPlantaoPersistida | null, destaque: boolean) => {
    if (!atribuicao) return <span className="coord-plantao-vazio">—</span>;
    const nome = nomeExibicaoPlantonista(atribuicao.plantonistaLogin, usuarios);
    return (
      <button type="button" className={`coord-plantonista${destaque ? ' agora' : ''}`} onClick={() => onAbrirPlantonista(plantao, atribuicao)} aria-label={`Ver contatos de ${nome}`}>
        <span aria-hidden="true">{obterIniciaisParticipantePlantao(nome, atribuicao.plantonistaLogin)}</span>
        {primeiroNome(nome)}
      </button>
    );
  };
  return (
    <article className="panel coord-plantao">
      <header className="coord-cartao-cabecalho">
        <div>
          <h3><Radio size={16} aria-hidden="true" /> {plantao.grupo.nome}</h3>
          <small>{funcoes.length > 0 ? `${funcoes.length} postos` : 'Posto único'} · toque na pessoa para ligar</small>
        </div>
        <button type="button" className="text-button" onClick={onAbrirEquipes}>Ver escala <ChevronRight size={14} aria-hidden="true" /></button>
      </header>
      <div className="coord-plantao-tabela" role="table" aria-label={`Passagem do ${plantao.grupo.nome}`}>
        <div className="coord-plantao-linha cabecalho" role="row">
          <span role="columnheader">Posto</span><span role="columnheader">Antes</span><span role="columnheader">Agora</span><span role="columnheader">Depois</span>
        </div>
        {postos.map((funcao) => {
          const sequencia = sequenciaDoPosto(plantao.atribuicoes, agoraIso, funcao);
          return (
            <div key={funcao ?? 'unico'} className="coord-plantao-linha" role="row">
              <span role="cell" className="coord-plantao-posto">{funcao ? ROTULO_FUNCAO_PLANTAO[funcao] ?? funcao : 'Plantão'}</span>
              <span role="cell" data-rotulo="Antes">{pessoa(sequencia.anterior, false)}</span>
              <span role="cell" data-rotulo="Agora">{pessoa(sequencia.atual, true)}</span>
              <span role="cell" data-rotulo="Depois">{pessoa(sequencia.proximo, false)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function HojeCoordenacao({ equipes, plantoes, dataHoje, agora, catalogo, usuarios, trocasParaAprovar, renderPrevisao, onAbrirEquipes, onAbrirTrocas, onAbrirPlantonista }: Props) {
  const agoraIso = agora.toISOString();
  const agoraTurno = periodoAgora(horaDeBrasilia(agora));
  const dataDoAgora = agoraTurno.ontem ? deslocarDias(dataHoje, -1) : dataHoje;
  let trabalhandoAgora = 0;
  let naEscalaHoje = 0;
  let deFolga = 0;
  let ausentes = 0;
  for (const equipe of equipes) {
    const hoje = resumirEquipeNoDia(equipe.documentos, dataHoje, catalogo, equipe.nomes);
    const doAgora = dataDoAgora === dataHoje ? hoje : resumirEquipeNoDia(equipe.documentos, dataDoAgora, catalogo, equipe.nomes);
    naEscalaHoje += PERIODOS.reduce((total, periodo) => total + hoje.porPeriodo[periodo].length, 0);
    trabalhandoAgora += doAgora.porPeriodo[agoraTurno.periodo].length;
    deFolga += hoje.folga.length;
    ausentes += hoje.ausentes.length;
  }
  const dePlantaoAgora = plantoes.reduce((total, plantao) => total
    + plantao.atribuicoes.filter((atribuicao) => atribuicao.inicio <= agoraIso && agoraIso < atribuicao.fim).length, 0);

  return (
    <section className="coord-hoje" aria-label="Hoje nas suas equipes">
      <div className="coord-numeros">
        {equipes.length > 0 && <Numero icone={<UserCheck size={18} />} rotulo="Trabalhando agora" valor={trabalhandoAgora} destaque="ok" />}
        {equipes.length > 0 && <Numero icone={<CalendarDays size={18} />} rotulo="Na escala hoje" valor={naEscalaHoje} />}
        {equipes.length > 0 && <Numero icone={<Coffee size={18} />} rotulo="De folga hoje" valor={deFolga} />}
        {equipes.length > 0 && ausentes > 0 && <Numero icone={<UserX size={18} />} rotulo="Ausentes" valor={ausentes} />}
        {plantoes.length > 0 && <Numero icone={<Radio size={18} />} rotulo="De plantão agora" valor={dePlantaoAgora} destaque="ok" />}
        <Numero icone={<ArrowLeftRight size={18} />} rotulo="Trocas para aprovar" valor={trocasParaAprovar}
          destaque={trocasParaAprovar > 0 ? 'alerta' : undefined} onClick={onAbrirTrocas} />
      </div>
      <div className="coord-cartoes">
        {equipes.map((equipe) => (
          <EquipeNoDia key={equipe.id} equipe={equipe} dataHoje={dataHoje} agora={agora} catalogo={catalogo} renderPrevisao={renderPrevisao} onAbrirEquipes={onAbrirEquipes} />
        ))}
        {plantoes.map((plantao) => (
          <PlantaoNoDia key={plantao.grupo.grupoId} plantao={plantao} agoraIso={agoraIso} usuarios={usuarios} onAbrirPlantonista={onAbrirPlantonista} onAbrirEquipes={onAbrirEquipes} />
        ))}
      </div>
    </section>
  );
}

/**
 * LIDERANCA-PADRAO-1 — os Plantões que a pessoa administra (Posto | Antes |
 * Agora | Depois), reaproveitados na tela Plantão de quem lidera.
 */
export function PlantoesDaCoordenacao({ plantoes, agora, usuarios, onAbrirPlantonista, onAbrirEquipes }: {
  plantoes: readonly PlantaoVisao[]; agora: Date; usuarios: readonly Usuario[];
  onAbrirPlantonista: Props['onAbrirPlantonista']; onAbrirEquipes: () => void;
}) {
  const agoraIso = agora.toISOString();
  return (
    <div className="coord-cartoes">
      {plantoes.map((plantao) => (
        <PlantaoNoDia key={plantao.grupo.grupoId} plantao={plantao} agoraIso={agoraIso} usuarios={usuarios} onAbrirPlantonista={onAbrirPlantonista} onAbrirEquipes={onAbrirEquipes} />
      ))}
    </div>
  );
}
