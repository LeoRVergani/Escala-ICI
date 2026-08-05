import {
  calcularTotais,
  SCHEMA_VERSION,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';

import type { Usuario } from './modelos';

/**
 * Fase 3K-D2A — presença de um colaborador na grade/rascunho da competência
 * aberta no Dashboard, separada do cadastro do usuário (Fase 3K-D2).
 *
 * Módulo puro: monta e reorganiza documentos `TurnosMes` em memória. Quem
 * chama decide se/quando persistir (ver `lib/firebase/writeRepository.ts`).
 */

export interface ReferenciaGrade {
  equipeId: string;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
}

/** Ordem fixa de exibição; códigos fora dela aparecem depois, em ordem alfabética. */
export const ORDEM_PERIODOS_GRADE = ['MD', 'M', 'T', 'N'] as const;

export interface GrupoGrade {
  codigo: string;
  rotulo: string;
  documentos: TurnosMes[];
}

export function membroJaNaGrade(
  documentos: readonly TurnosMes[],
  login: string,
): boolean {
  return documentos.some((documento) => documento.login === login);
}

/**
 * Cria o documento em branco (`dias: {}`) de um colaborador recém-incluído
 * na grade. O gestor preenche os dias pela edição de célula já existente.
 *
 * `usuarioUid` fica preenchido com o login — chave funcional estável — e não
 * com `colaborador.uid`, que é metadado opcional e pode nem existir.
 */
export function criarMembroGrade(
  colaborador: Usuario,
  turnoPadrao: string,
  referencia: ReferenciaGrade,
  catalogo: Record<string, TipoTurno>,
): TurnosMes {
  return {
    schemaVersion: SCHEMA_VERSION,
    usuarioUid: colaborador.login,
    login: colaborador.login,
    equipeId: referencia.equipeId,
    competencia: referencia.competencia,
    periodoInicio: referencia.periodoInicio,
    periodoFim: referencia.periodoFim,
    turnoPadrao,
    status: 'RASCUNHO',
    dias: {},
    totais: calcularTotais({}, catalogo),
  };
}

export function adicionarMembroGrade(
  documentos: readonly TurnosMes[],
  membro: TurnosMes,
): TurnosMes[] {
  return membroJaNaGrade(documentos, membro.login)
    ? [...documentos]
    : [...documentos, membro];
}

export function removerMembroGrade(
  documentos: readonly TurnosMes[],
  login: string,
): TurnosMes[] {
  return documentos.filter((documento) => documento.login !== login);
}

/**
 * Agrupa por `turnoPadrao` na ordem Madrugada → Manhã → Tarde → Noite;
 * qualquer outro código (ex.: um turno administrativo) some depois, em
 * ordem alfabética — nunca quebra a ordem fixa dos quatro primeiros.
 */
export function agruparGradePorPeriodo(
  documentos: readonly TurnosMes[],
  catalogo: Record<string, TipoTurno>,
): GrupoGrade[] {
  const porCodigo = new Map<string, TurnosMes[]>();
  for (const documento of documentos) {
    const codigo = documento.turnoPadrao || 'OUTROS';
    const grupo = porCodigo.get(codigo);
    if (grupo === undefined) {
      porCodigo.set(codigo, [documento]);
    } else {
      grupo.push(documento);
    }
  }

  const conhecidos = ORDEM_PERIODOS_GRADE.filter((codigo) => porCodigo.has(codigo));
  const restantes = [...porCodigo.keys()]
    .filter((codigo) => !(ORDEM_PERIODOS_GRADE as readonly string[]).includes(codigo))
    .sort((a, b) => a.localeCompare(b));

  return [...conhecidos, ...restantes].map((codigo) => ({
    codigo,
    rotulo: catalogo[codigo]?.descricao ?? codigo,
    documentos: porCodigo.get(codigo) ?? [],
  }));
}
