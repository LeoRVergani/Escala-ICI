'use client';

import {
  adicionarDias,
  calcularTotais,
  formatarData,
  type Dia,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import { AlertTriangle, UserMinus } from 'lucide-react';

import {
  LIMITE_DIAS_CONSECUTIVOS_TRABALHO,
  chaveIndicadorCelula,
  type IndicadorCelulaAlerta,
} from '@/lib/alertasEscala';
import { agruparGradePorPeriodo } from '@/lib/gradeMembros';
import type { Usuario } from '@/lib/modelos';

interface ScheduleGridProps {
  documentos: TurnosMes[];
  usuarios: Usuario[];
  catalogo: Record<string, TipoTurno>;
  filtroTurno?: string;
  onEditar?: (documento: TurnosMes, data: string, dia: Dia) => void;
  onRemover?: (documento: TurnosMes) => void;
  agruparPorPeriodo?: boolean;
  indiceAlertas?: Map<string, IndicadorCelulaAlerta>;
  compacta?: boolean;
  avisoDivergencia?: boolean;
}

function cabecalhoData(dataIso: string) {
  const diaSemana = formatarData(dataIso, { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();
  const diaMes = formatarData(dataIso, { day: '2-digit', month: '2-digit' });
  return { diaSemana, diaMes };
}

/**
 * A competência é a fonte de verdade das colunas, não a primeira célula
 * preenchida. Isso mantém a coluna de colaboradores estável e deixa o
 * coordenador enxergar os dias que ainda precisam ser lançados. Quando um
 * conjunto reúne documentos com períodos diferentes, a grade usa a janela
 * mínima/máxima para não esconder nenhuma data válida.
 */
function datasDoConjunto(documentos: readonly TurnosMes[]): string[] {
  const referencia = documentos[0];
  if (referencia === undefined) {
    return [];
  }

  let periodoInicio = referencia.periodoInicio;
  let periodoFim = referencia.periodoFim;
  for (const documento of documentos) {
    if (documento.periodoInicio < periodoInicio) {
      periodoInicio = documento.periodoInicio;
    }
    if (documento.periodoFim > periodoFim) {
      periodoFim = documento.periodoFim;
    }
  }

  const datas: string[] = [];
  for (let atual = periodoInicio; atual <= periodoFim; atual = adicionarDias(atual, 1)) {
    datas.push(atual);
  }
  return datas;
}

export function ScheduleGrid({
  documentos,
  usuarios,
  catalogo,
  filtroTurno = 'TODOS',
  onEditar,
  onRemover,
  agruparPorPeriodo = false,
  indiceAlertas,
  compacta = false,
  avisoDivergencia = true,
}: ScheduleGridProps) {
  const documentosFiltrados = documentos.filter(
    (documento) => filtroTurno === 'TODOS' || documento.turnoPadrao === filtroTurno,
  );
  const datas = datasDoConjunto(documentosFiltrados);
  const nomes = Object.fromEntries(usuarios.map((usuario) => [usuario.login, usuario.nome]));
  const divergencias = documentosFiltrados.filter((documento) =>
    JSON.stringify(calcularTotais(documento.dias, catalogo))
      !== JSON.stringify(documento.totais));
  const grupos = agruparPorPeriodo
    ? agruparGradePorPeriodo(documentosFiltrados, catalogo)
    : [{ codigo: '', rotulo: '', documentos: documentosFiltrados }];

  if (documentosFiltrados.length === 0) {
    return <div className="empty-state">Nenhuma escala encontrada para este filtro.</div>;
  }

  function linhaColaborador(documento: TurnosMes) {
    return (
      <tr key={documento.usuarioUid}>
        <th className="sticky-name" data-code={agruparPorPeriodo ? documento.turnoPadrao : undefined}>
          <div className="sticky-name-content">
            <div>
              <strong>{nomes[documento.login] ?? documento.login}</strong>
              <span>
                {documento.login}
                {!agruparPorPeriodo && ` · ${documento.turnoPadrao}`}
              </span>
            </div>
            {onRemover && (
              <button
                type="button"
                className="icon-button remove-membro-button"
                title="Remover da grade desta competência"
                onClick={() => onRemover(documento)}
              >
                <UserMinus size={14} />
              </button>
            )}
          </div>
        </th>
        {datas.map((data) => {
          const dia = documento.dias[data];
          const indicador = indiceAlertas?.get(chaveIndicadorCelula(documento.usuarioUid, data));
          const sequenciaCritica = indicador?.sequencia !== undefined
            && indicador.sequencia > LIMITE_DIAS_CONSECUTIVOS_TRABALHO
            ? indicador.sequencia
            : null;
          const avisos = [
            sequenciaCritica !== null
              ? `${sequenciaCritica}º dia consecutivo de trabalho`
              : null,
            indicador?.descansoInsuficiente ? 'Descanso inferior a 11 horas' : null,
          ].filter((aviso): aviso is string => aviso !== null);
          const editavel = onEditar !== undefined;
          if (!dia && !editavel) {
            return <td key={data} />;
          }
          return (
            <td key={data}>
              <button
                type="button"
                className={`shift-chip ${dia ? '' : 'shift-chip-vazio'}`}
                data-code={dia?.c ?? ''}
                title={dia
                  ? [`${data} · ${catalogo[dia.c]?.descricao ?? dia.c}`, ...avisos].join(' · ')
                  : `${data} · Sem turno definido — clique para atribuir`}
                onClick={() => onEditar?.(documento, data, dia ?? { c: '' })}
                disabled={!editavel}
              >
                {dia ? dia.c : '+'}
                {sequenciaCritica !== null && (
                  <span className="grade-alert-badge grade-alert-sequencia" aria-hidden="true">
                    {sequenciaCritica}
                  </span>
                )}
                {indicador?.descansoInsuficiente && (
                  <span className="grade-alert-badge grade-alert-descanso" aria-hidden="true">
                    <AlertTriangle size={9} strokeWidth={3} />
                  </span>
                )}
              </button>
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <div>
      {avisoDivergencia && divergencias.length > 0 && (
        <div className="alert warning">
          <strong>Horas recalculadas automaticamente</strong>
          <p>
            {divergencias.length === 1
              ? '1 colaborador teve diferença'
              : `${divergencias.length} colaboradores tiveram diferença`}
            {' '}entre o total informado na planilha e a soma dos turnos exibidos na
            grade. O sistema está usando a soma calculada pelos dias da escala.
          </p>
        </div>
      )}
      <div className={`schedule-scroll ${compacta ? 'compact' : ''}`}>
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="sticky-name">Colaborador</th>
              {datas.map((data) => {
                const { diaSemana, diaMes } = cabecalhoData(data);
                const fimDeSemana = [0, 6].includes(
                  new Date(`${data}T12:00:00`).getDay(),
                );
                return (
                  <th key={data} className={fimDeSemana ? 'weekend' : ''}>
                    <strong>{diaSemana}</strong>
                    <span>{diaMes}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          {grupos.map((grupo) => (
            <tbody key={grupo.codigo || 'todos'}>
              {agruparPorPeriodo && grupo.documentos.length > 0 && (
                <tr className="grade-group-row" data-code={grupo.codigo}>
                  <th className="grade-group-header" colSpan={datas.length + 1}>
                    <span>{grupo.rotulo}</span>
                  </th>
                </tr>
              )}
              {grupo.documentos.map((documento) => linhaColaborador(documento))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
