/**
 * STAGING-RESET-HIERARQUIA-ICI-3 — usuários de DEMONSTRAÇÃO, opcionais,
 * NUNCA a fonte de verdade do produto. Existem só para exercitar os fluxos
 * (cadastro livre, Matriz, troca, Plantão) num staging recém-resetado sem
 * esperar o cadastro das pessoas reais.
 *
 * Regras desta fase:
 *   1. Nomes/logins são GENÉRICOS de propósito — nunca uma pessoa real nem
 *      fictícia com nome próprio (nada de "Marina"/"Claudio"/"Wanessa" aqui).
 *   2. `seed-hierarquia-ici.mjs` só grava este arquivo quando chamado
 *      explicitamente com `--with-demo-users` — nunca por padrão.
 *   3. `validate-staging.mjs` NUNCA exige que estes usuários existam: uma
 *      base estrutural sem nenhum usuário de demo (nem de pessoa real) ainda
 *      passa a validação, desde que a hierarquia (unidades/equipes/grupo/
 *      matriz) esteja correta.
 *
 * Pessoas reais (coordenador do COSI, supervisora do NOC, futuro coordenador
 * do CODB) são cadastradas separadamente, pelo Dashboard ou por script local
 * NÃO versionado — ver `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md` § 6.
 */
export const USUARIOS_DEMO = Object.freeze([
  {
    login: 'coordenador.cosi.teste',
    nome: 'Coordenador COSI (teste)',
    equipeId: 'GEDSI_COSI_SOC',
    unidadeId: 'GEDSI_COSI',
    unidadesPermitidas: ['GEDSI_COSI'],
    nivelHierarquico: 4,
    perfil: 'GESTOR_UNIDADE',
    escopo: 'UNIDADE',
    ativo: true,
  },
  {
    login: 'coordenador.plantao.teste',
    nome: 'Coordenador Plantão COSI (teste)',
    equipeId: 'GEDSI_COSI_PLANTAO',
    nivelHierarquico: 4,
    perfil: 'GESTOR_EQUIPE',
    escopo: 'EQUIPE',
    ativo: true,
  },
  {
    login: 'supervisor.noc.teste',
    nome: 'Supervisor NOC (teste)',
    equipeId: 'GEDSI_CODB_NOC',
    equipesPermitidas: ['GEDSI_CODB_NOC'],
    nivelHierarquico: 5,
    perfil: 'SUPERVISOR_EQUIPE',
    escopo: 'EQUIPE',
    ativo: true,
  },
]);
