/**
 * LIDERANCA-CARGO-1 — quem pode ser liderança é decidido pelo CARGO: coordenador, supervisor, líder,
 * gestor (e afins) são cargos de liderança; analista, técnico, estagiário, assistente não são.
 * A mesma lista vive em `firestore.rules` (função `cargoDeLideranca`) — um teste de fronteira confere
 * que as duas são iguais. Não vira "automático" de propósito: dar permissão a partir de um texto
 * livre de cargo abriria uma brecha (quem edita o cargo se promoveria); a promoção continua sendo
 * um ato explícito, só que agora restrito a quem tem cargo de liderança.
 */
export const PALAVRAS_CARGO_LIDERANCA = [
  'coordenador', 'supervisor', 'lider', 'gestor', 'gerente', 'diretor', 'chefe', 'superintendente', 'presidente',
] as const;

export function semAcentoMinusculo(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();
}

export function cargoEhDeLideranca(cargo: string | null | undefined): boolean {
  const normalizado = semAcentoMinusculo(cargo ?? '');
  return PALAVRAS_CARGO_LIDERANCA.some((palavra) => normalizado.includes(palavra));
}

export const MENSAGEM_CARGO_SEM_LIDERANCA =
  'Só quem tem cargo de coordenador, supervisor, líder ou gestor pode ser liderança. Analistas e técnicos não.';
