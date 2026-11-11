import type { Usuario } from './modelos';

/**
 * LIDERANCAS-1 — "liderança" é quem cuida de equipe (coordenador, supervisor,
 * gestor, chefe): os perfis que já existem. Quem é liderança pode criar
 * equipe e tornar outra pessoa liderança (Dashboard › Lideranças).
 */
export const PERFIS_LIDERANCA = ['ADMIN_SISTEMA', 'GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'] as const;
/** Nível mínimo de quem é liderança (o mesmo que libera o Dashboard). */
export const NIVEL_LIDERANCA = 5;

export function ehLideranca(usuario: Pick<Usuario, 'perfil' | 'nivelHierarquico'>): boolean {
  if (usuario.perfil) return (PERFIS_LIDERANCA as readonly string[]).includes(usuario.perfil);
  return (usuario.nivelHierarquico ?? 6) <= NIVEL_LIDERANCA;
}

/** Campos gravados ao tornar alguém liderança (espelha a regra do banco). */
export function camposPromocaoLideranca(alvo: Pick<Usuario, 'nivelHierarquico'>, promovidoPorLogin: string, agoraIso: string) {
  const nivelAtual = alvo.nivelHierarquico ?? 6;
  return {
    perfil: 'GESTOR_EQUIPE' as const,
    nivelHierarquico: nivelAtual <= NIVEL_LIDERANCA ? nivelAtual : NIVEL_LIDERANCA,
    promovidoPorLogin,
    promovidoEm: agoraIso,
    atualizadoEm: agoraIso,
  };
}

/** LIDERANCAS-2 — login a partir do e-mail corporativo (o mesmo do login no App). */
export function loginDoEmailCorporativo(email: string): string {
  return (email.trim().split('@')[0] ?? '').toLowerCase();
}

/** LIDERANCAS-2 — cadastro de uma pessoa NOVA já como liderança (espelha a regra do banco). */
export function documentoNovaLideranca(
  dados: { nome: string; email: string; cargo: string },
  autorLogin: string,
  agoraIso: string,
) {
  const email = dados.email.trim().toLowerCase();
  return {
    login: loginDoEmailCorporativo(email),
    nome: dados.nome.replace(/\s+/gu, ' ').trim(),
    email,
    cargo: dados.cargo.trim(),
    equipeId: '',
    gestorUid: null,
    nivelHierarquico: NIVEL_LIDERANCA,
    turnoPadrao: '',
    ativo: true,
    perfil: 'GESTOR_EQUIPE' as const,
    promovidoPorLogin: autorLogin,
    promovidoEm: agoraIso,
    criadoEm: agoraIso,
    atualizadoEm: agoraIso,
  };
}

/** Só gestor/supervisor de equipe pode ser "removido da liderança" por esta tela (admin e gestor de unidade não). */
export function podeRemoverLideranca(usuario: Pick<Usuario, 'perfil'>): boolean {
  return usuario.perfil === 'GESTOR_EQUIPE' || usuario.perfil === 'SUPERVISOR_EQUIPE';
}
