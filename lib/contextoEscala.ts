/**
 * Fase ESCALAS-UX-2A.1 — `ContextoEscalaAtivo` é a fonte de verdade
 * explícita para "qual escala o usuário está trabalhando agora", que o
 * Dashboard nunca teve (ver `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`
 * § 32). Puro, sem React/Firebase — identidade é sempre por ID real
 * (`equipeId`/`grupoId`), nunca nome/sigla/cargo/UID. Estado de FRONTEND
 * apenas, nunca persistido no Firestore nesta fase.
 *
 * Nunca confundir com perfil/pertencimento organizacional: trocar de
 * contexto nunca altera `Usuario.equipeId` nem autorização — é só "o que
 * está em tela", igual a trocar de aba num editor de texto.
 */
export type ContextoEscalaAtivo =
  | { tipo: 'JORNADA'; equipeId: string; competencia: string }
  | { tipo: 'PLANTAO'; grupoId: string; competencia: string };

export function contextoEhJornada(
  contexto: ContextoEscalaAtivo | null,
): contexto is Extract<ContextoEscalaAtivo, { tipo: 'JORNADA' }> {
  return contexto !== null && contexto.tipo === 'JORNADA';
}

export function contextoEhPlantao(
  contexto: ContextoEscalaAtivo | null,
): contexto is Extract<ContextoEscalaAtivo, { tipo: 'PLANTAO' }> {
  return contexto !== null && contexto.tipo === 'PLANTAO';
}

/**
 * Chave estável para comparação/indexação — nunca usa nome/sigla, só os
 * IDs reais + a competência (que também faz parte da identidade do
 * contexto: a mesma equipe em meses diferentes é um contexto diferente).
 */
export function chaveContextoEscala(contexto: ContextoEscalaAtivo): string {
  return contexto.tipo === 'JORNADA'
    ? `JORNADA:${contexto.equipeId}:${contexto.competencia}`
    : `PLANTAO:${contexto.grupoId}:${contexto.competencia}`;
}

export function contextosEscalaIguais(
  a: ContextoEscalaAtivo | null,
  b: ContextoEscalaAtivo | null,
): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return chaveContextoEscala(a) === chaveContextoEscala(b);
}
