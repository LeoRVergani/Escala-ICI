'use client';

import { calcularTotais, type Dia, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

import type { Usuario } from '@/lib/modelos';

interface ScheduleGridProps {
  documentos: TurnosMes[];
  usuarios: Usuario[];
  catalogo: Record<string, TipoTurno>;
  filtroTurno?: string;
  onEditar?: (documento: TurnosMes, data: string, dia: Dia) => void;
  compacta?: boolean;
}

function dataCurta(dataIso: string) {
  const [, mes, dia] = dataIso.split('-');
  return { dia, mes };
}

export function ScheduleGrid({
  documentos,
  usuarios,
  catalogo,
  filtroTurno = 'TODOS',
  onEditar,
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

  if (documentosFiltrados.length === 0) {
    return <div className="empty-state">Nenhuma escala encontrada para este filtro.</div>;
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
                const partes = dataCurta(data);
                const fimDeSemana = [0, 6].includes(
                  new Date(`${data}T12:00:00`).getDay(),
                );
                return (
                  <th key={data} className={fimDeSemana ? 'weekend' : ''}>
                    <strong>{partes.dia}</strong>
                    <span>{partes.mes}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {documentosFiltrados.map((documento) => (
              <tr key={documento.usuarioUid}>
                <th className="sticky-name">
                  <strong>{nomes[documento.login] ?? documento.login}</strong>
                  <span>{documento.login} · {documento.turnoPadrao}</span>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
