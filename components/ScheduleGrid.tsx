'use client';

import {
  calcularTotais,
  formatarData,
  type Dia,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import { UserMinus } from 'lucide-react';

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
  compacta?: boolean;
}

function cabecalhoData(dataIso: string) {
  const diaSemana = formatarData(dataIso, { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();
  const diaMes = formatarData(dataIso, { day: '2-digit', month: '2-digit' });
  return { diaSemana, diaMes };
}

export function ScheduleGrid({
  documentos,
  usuarios,
  catalogo,
  filtroTurno = 'TODOS',
  onEditar,
  onRemover,
  agruparPorPeriodo = false,
  compacta = false,
}: ScheduleGridProps) {
  const documentosFiltrados = documentos.filter(
    (documento) => filtroTurno === 'TODOS' || documento.turnoPadrao === filtroTurno,
  );
  const datas = Object.keys(documentosFiltrados[0]?.dias ?? {}).sort();
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
          return (
            <td key={data}>
              {dia && (
                <button
                  type="button"
                  className="shift-chip"
                  data-code={dia.c}
                  title={`${data} · ${catalogo[dia.c]?.descricao ?? dia.c}`}
                  onClick={() => onEditar?.(documento, data, dia)}
                  disabled={onEditar === undefined}
                >
                  {dia.c}
                </button>
              )}
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
                    {grupo.rotulo} · {grupo.documentos.length} colaborador(es)
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
