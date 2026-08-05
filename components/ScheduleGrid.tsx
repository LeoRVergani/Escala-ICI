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
}

function cabecalhoData(dataIso: string) {
  const diaSemana = formatarData(dataIso, { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();
  const diaMes = formatarData(dataIso, { day: '2-digit', month: '2-digit' });
  return { diaSemana, diaMes };
}

/**
 * As colunas de data vêm da união dos dias já preenchidos em qualquer
 * documento do conjunto — não só do primeiro. Um colaborador recém-incluído
 * na grade (Fase 3K-D2A) nasce com `dias: {}`; se ele calhasse de ser o
 * primeiro do array, a grade inteira ficaria sem nenhuma coluna. Sem nenhum
 * dia preenchido em ninguém, cai para o período do documento (sempre
 * presente, mesmo em branco), para a grade continuar utilizável.
 */
function datasDoConjunto(documentos: readonly TurnosMes[]): string[] {
  const chaves = new Set<string>();
  for (const documento of documentos) {
    for (const data of Object.keys(documento.dias)) {
      chaves.add(data);
    }
  }
  if (chaves.size > 0) {
    return [...chaves].sort();
  }

  const referencia = documentos[0];
  if (referencia === undefined) {
    return [];
  }
  const datas: string[] = [];
  for (let atual = referencia.periodoInicio; atual <= referencia.periodoFim; atual = adicionarDias(atual, 1)) {
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
              <span>{documento.login} · {documento.turnoPadrao}</span>
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
      {divergencias.length > 0 && (
        <div className="alert warning">
          {divergencias.length} documento(s) possui(em) totais divergentes. A tela
          está usando o recálculo dos dias.
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
                    {grupo.rotulo}
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
