'use client';

import { ChevronRight } from 'lucide-react';

import { rotuloUnidadePorId } from '@/lib/organizacao';
import type { UnidadeOrganizacional } from '@/lib/modelos';

/**
 * Breadcrumb reutilizável de caminho organizacional (Fase UI-ORG-1) — usado
 * pelo painel de detalhes da Administração e pelo resumo de seleção do
 * `OrganizationTeamPicker`. Só apresentação: recebe o `caminho` (array de
 * `unidadeId`, já calculado em `UnidadeOrganizacional.caminho`/
 * `Equipe.caminhoUnidade`) e resolve cada segmento via `rotuloUnidadePorId()`
 * — nunca recalcula rótulo por conta própria.
 */
export function OrganizationBreadcrumb({
  caminho,
  unidades,
}: {
  caminho: readonly string[];
  unidades: readonly UnidadeOrganizacional[];
}) {
  if (caminho.length === 0) {
    return null;
  }
  return (
    <nav className="organization-breadcrumb" aria-label="Caminho organizacional">
      {caminho.map((id, indice) => (
        <span className="organization-breadcrumb-item" key={id}>
          {indice > 0 && <ChevronRight size={12} aria-hidden="true" />}
          <span>{rotuloUnidadePorId(id, unidades)}</span>
        </span>
      ))}
    </nav>
  );
}
