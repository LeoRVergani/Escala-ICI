import { adicionarDias, formatarData } from '@escala-ici/contrato';

import {
  agruparAtribuicoesPorDia,
  duracaoPlantaoAtipica,
  ehDiaDeContexto,
  indiceIdentidadePlantonista,
  nomeCurtoPlantonista,
  rotuloHorarioCartaoPlantao,
  type AtribuicaoPlantaoEditavel,
} from '@/lib/editorPlantao';

/**
 * Fase ESCALAS-UX-1A — calendário do Editor de Plantão. Diferente de
 * `LembretesCalendario` (que navega livremente mês a mês), este calendário
 * mostra SEMPRE a janela inteira da competência importada (26→25), sem
 * navegação — o coordenador está conferindo/editando UMA competência já
 * carregada, não navegando o histórico. A grade estende alguns dias antes
 * de `periodoInicio` e depois de `periodoFim` só para completar as semanas
 * (domingo a sábado); esses dias extras são reais (não células em branco),
 * porque a fixture real já tem atribuições que começam/terminam exatamente
 * neles (a borda de 43h começa um dia antes do início da janela).
 */

function diaDaSemanaUtc(dataIso: string): number {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay();
}

function diasDaGradeCompetencia(periodoInicio: string, periodoFim: string): string[] {
  const inicioGrade = adicionarDias(periodoInicio, -diaDaSemanaUtc(periodoInicio));
  const fimGrade = adicionarDias(periodoFim, 6 - diaDaSemanaUtc(periodoFim));
  const dias: string[] = [];
  let cursor = inicioGrade;
  while (cursor <= fimGrade) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

export interface PlantaoCalendarioProps {
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  dataHoje: string;
  atribuicoes: readonly AtribuicaoPlantaoEditavel[];
  onEditarAtribuicao: (idLocal: string) => void;
  onAdicionarPlantao: (dataIso: string) => void;
}

export function PlantaoCalendario({
  competencia,
  periodoInicio,
  periodoFim,
  dataHoje,
  atribuicoes,
  onEditarAtribuicao,
  onAdicionarPlantao,
}: PlantaoCalendarioProps) {
  const dias = diasDaGradeCompetencia(periodoInicio, periodoFim);
  const porDia = agruparAtribuicoesPorDia(atribuicoes);
  const [ano, mes] = competencia.split('-');

  return (
    <div className="plantao-calendario">
      <header className="plantao-calendario-header">
        <strong>Competência {mes}/{ano}</strong>
        <span className="plantao-calendario-periodo">
          {formatarData(periodoInicio, { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {' → '}
          {formatarData(periodoFim, { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </header>
      <div className="calendar-weekdays" aria-hidden="true">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}
      </div>
      <div className="plantao-grid" role="grid" aria-label="Calendário do Plantão">
        {dias.map((data) => {
          const contexto = ehDiaDeContexto(data, periodoInicio, periodoFim);
          const ehHoje = data === dataHoje;
          const atribuicoesDoDia = porDia.get(data) ?? [];
          return (
            <div
              key={data}
              role="gridcell"
              className={['plantao-dia', contexto ? 'contexto' : '', ehHoje ? 'hoje' : ''].filter(Boolean).join(' ')}
              aria-label={formatarData(data, { weekday: 'long', day: '2-digit', month: 'long' })}
            >
              <div className="plantao-dia-cabecalho">
                <span className="plantao-dia-numero">{formatarData(data, { day: 'numeric' })}</span>
                {contexto && <span className="plantao-dia-contexto-rotulo">contexto</span>}
              </div>
              <div className="plantao-cartoes">
                {atribuicoesDoDia.map((atribuicao) => {
                  const atipica = duracaoPlantaoAtipica(atribuicao.duracaoMinutos);
                  return (
                    <button
                      key={atribuicao.idLocal}
                      type="button"
                      className="plantao-card"
                      data-identidade={indiceIdentidadePlantonista(atribuicao.plantonistaNomeOriginal)}
                      data-atipica={atipica ? 'true' : 'false'}
                      onClick={() => onEditarAtribuicao(atribuicao.idLocal)}
                      aria-label={`Editar plantão de ${atribuicao.plantonistaNomeOriginal}, ${rotuloHorarioCartaoPlantao(atribuicao)}`}
                    >
                      <span>{nomeCurtoPlantonista(atribuicao.plantonistaNomeOriginal)}</span>
                      <span className="plantao-card-horario">{rotuloHorarioCartaoPlantao(atribuicao)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="plantao-adicionar"
                onClick={() => onAdicionarPlantao(data)}
                aria-label={`Adicionar plantão em ${formatarData(data, { day: '2-digit', month: '2-digit' })}`}
              >
                + Adicionar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
