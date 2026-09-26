import type { Equipe, EscopoUsuario, PerfilUsuario, Usuario } from './modelos';

/**
 * PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — a tela de cadastro expõe
 * `perfil`/`escopo`/`unidadeId`/`equipeId`/`unidadesPermitidas`/
 * `equipesPermitidas` como campos técnicos independentes, forçando quem
 * cadastra a entender a combinação certa entre eles (o bug real observado:
 * `equipesPermitidas` continha a equipe certa, mas `equipeId` — nunca
 * escrito pelo formulário administrativo — continuava herdado da equipe de
 * quem estava cadastrando). "Tipo de acesso" é uma camada de conveniência
 * PURA sobre os mesmos campos técnicos — nunca um schema novo, nunca
 * substitui `perfil`/`escopo` no documento salvo. `cargo` nunca entra
 * nesta decisão (ver `docs/spec/...`: cargo é texto livre, meramente
 * descritivo, nunca fonte de autorização).
 */
export type TipoAcessoUsuario =
  | 'COLABORADOR'
  | 'SUPERVISOR_EQUIPE'
  | 'GESTOR_EQUIPE'
  | 'GESTOR_UNIDADE'
  | 'ADMIN_SISTEMA';

/**
 * Nível numérico atribuído a cada Tipo de acesso — mapeado 1:1 para a
 * tabela documentada em `descreverNivelHierarquico()` (`lib/organizacao.ts`):
 * 0 = Administração do sistema, 4 = Coordenação, 5 = Supervisão,
 * 6 = Operacional. `GESTOR_EQUIPE` não tem uma linha própria nessa tabela;
 * usa o mesmo teto (5) que já governa toda delegação de gestão em
 * `DashboardApp.tsx` (`Math.min(nivelHierarquico, 5)` ao delegar
 * GESTOR_EQUIPE/SUPERVISOR_EQUIPE/GESTOR_UNIDADE) — nenhuma distinção por
 * nível entre os dois perfis é aplicada em nenhum outro lugar do sistema.
 */
const NIVEL_HIERARQUICO_POR_TIPO_ACESSO: Readonly<Record<TipoAcessoUsuario, number>> = {
  COLABORADOR: 6,
  SUPERVISOR_EQUIPE: 5,
  GESTOR_EQUIPE: 5,
  GESTOR_UNIDADE: 4,
  ADMIN_SISTEMA: 0,
};

export interface SelecaoAcessoUsuario {
  tipo: TipoAcessoUsuario;
  /** Equipe escolhida — usada por COLABORADOR/SUPERVISOR_EQUIPE/GESTOR_EQUIPE. */
  equipeId?: string;
  /** Unidade escolhida — usada por GESTOR_UNIDADE. */
  unidadeId?: string;
  /** Confirmação explícita exigida só por ADMIN_SISTEMA. */
  confirmaAcessoGlobal?: boolean;
}

export interface CamposAcessoUsuario {
  perfil: PerfilUsuario | undefined;
  escopo: EscopoUsuario | undefined;
  equipeId: string | undefined;
  equipesPermitidas: string[];
  unidadeId: string | undefined;
  unidadesPermitidas: string[];
  nivelHierarquico: number;
}

export interface ContextoMontagemAcessoUsuario {
  /** Resolve a unidade de uma equipe (`Equipe.unidadeId`), quando existir. */
  unidadeDaEquipe?: (equipeId: string) => string | undefined;
}

/**
 * FASE-MATRIZ-DEFINITIVA-E-INFORMACOES-DIA-1 (correção CODB/NOC) —
 * `GESTOR_UNIDADE` é vinculado à organização por `unidadeId`/
 * `unidadesPermitidas`, nunca por `equipeId` (`montarCamposAcessoUsuario()`
 * já produz `equipeId: undefined` para este tipo). Um `equipeId` de equipe
 * descendente sobrevivendo no documento não é só um campo "morto": quando
 * `equipesPermitidas` está vazio, `minhasEquipesPermitidas()`
 * (`firestore.rules`) cai para `[equipeId]` — se essa equipe também estiver
 * em `responsaveisEquipe` da Matriz de outra operação (ex.: a Jornada da
 * própria equipe descendente), o coordenador ganha administração daquela
 * operação por acidente, nunca por responsabilidade explícita. Bug real
 * encontrado em produção: um Coordenador de Unidade com `equipeId` da
 * equipe do NOC (subordinada à sua unidade) virou administrador da Jornada
 * do NOC sem nunca ter sido designado responsável.
 *
 * `salvarUsuario()`/`salvarUsuarios()` chamam isto antes de qualquer
 * escrita — é o único ponto por onde as quatro origens conhecidas de
 * gravação de usuário (os dois formulários de `DashboardApp.tsx`,
 * `AtribuirCoordenadorModal`, e qualquer chamador futuro) passam.
 */
export function usuarioGestorUnidadeComEquipeIdInvalido(
  usuario: { perfil?: Usuario['perfil']; equipeId?: string | null },
): boolean {
  return usuario.perfil === 'GESTOR_UNIDADE' && (usuario.equipeId ?? '').trim() !== '';
}

/** Deriva o Tipo de acesso atual de um usuário já cadastrado — para pré-selecionar o seletor ao editar. */
export function tipoAcessoDoUsuario(usuario: Pick<Usuario, 'perfil'>): TipoAcessoUsuario {
  switch (usuario.perfil) {
    case 'ADMIN_SISTEMA':
      return 'ADMIN_SISTEMA';
    case 'GESTOR_UNIDADE':
      return 'GESTOR_UNIDADE';
    case 'GESTOR_EQUIPE':
      return 'GESTOR_EQUIPE';
    case 'SUPERVISOR_EQUIPE':
      return 'SUPERVISOR_EQUIPE';
    default:
      return 'COLABORADOR';
  }
}

/**
 * Monta os campos técnicos a partir da escolha simples — único lugar que
 * decide "Supervisor de equipe > NOC" vira `equipeId: 'EQ_NOC'`,
 * `equipesPermitidas: ['EQ_NOC']`. Nunca lê nem grava Firestore. Uma
 * seleção inválida (ex.: sem equipe escolhida) ainda produz um resultado
 * (`equipeId: undefined`) — quem chama SEMPRE deve rodar
 * `validarSelecaoAcessoUsuario()` antes de salvar.
 */
export function montarCamposAcessoUsuario(
  selecao: SelecaoAcessoUsuario,
  contexto: ContextoMontagemAcessoUsuario = {},
): CamposAcessoUsuario {
  const nivelHierarquico = NIVEL_HIERARQUICO_POR_TIPO_ACESSO[selecao.tipo];

  if (selecao.tipo === 'COLABORADOR') {
    const equipeId = selecao.equipeId?.trim() || undefined;
    return {
      perfil: undefined,
      escopo: undefined,
      equipeId,
      equipesPermitidas: [],
      unidadeId: undefined,
      unidadesPermitidas: [],
      nivelHierarquico,
    };
  }

  if (selecao.tipo === 'SUPERVISOR_EQUIPE' || selecao.tipo === 'GESTOR_EQUIPE') {
    const equipeId = selecao.equipeId?.trim() || undefined;
    const unidadeDaEquipe = equipeId === undefined ? undefined : contexto.unidadeDaEquipe?.(equipeId);
    return {
      perfil: selecao.tipo,
      escopo: 'EQUIPE',
      equipeId,
      equipesPermitidas: equipeId === undefined ? [] : [equipeId],
      unidadeId: unidadeDaEquipe,
      unidadesPermitidas: [],
      nivelHierarquico,
    };
  }

  if (selecao.tipo === 'GESTOR_UNIDADE') {
    const unidadeId = selecao.unidadeId?.trim() || undefined;
    return {
      perfil: 'GESTOR_UNIDADE',
      escopo: 'UNIDADE',
      equipeId: undefined,
      equipesPermitidas: [],
      unidadeId,
      unidadesPermitidas: unidadeId === undefined ? [] : [unidadeId],
      nivelHierarquico,
    };
  }

  return {
    perfil: 'ADMIN_SISTEMA',
    escopo: 'GLOBAL',
    equipeId: undefined,
    equipesPermitidas: [],
    unidadeId: undefined,
    unidadesPermitidas: [],
    nivelHierarquico,
  };
}

/**
 * Validações da escolha simples (Tipo de acesso), antes de qualquer
 * gravação. Nunca substitui `firestore.rules` — é só a primeira barreira
 * de UX, para o admin nunca conseguir salvar uma combinação óbvia de
 * dados incompletos.
 */
export function validarSelecaoAcessoUsuario(selecao: SelecaoAcessoUsuario): string[] {
  const erros: string[] = [];

  if (
    (selecao.tipo === 'SUPERVISOR_EQUIPE' || selecao.tipo === 'GESTOR_EQUIPE')
    && (selecao.equipeId === undefined || selecao.equipeId.trim() === '')
  ) {
    erros.push(
      selecao.tipo === 'SUPERVISOR_EQUIPE'
        ? 'Selecione a equipe supervisionada.'
        : 'Selecione a equipe gerenciada.',
    );
  }

  if (selecao.tipo === 'GESTOR_UNIDADE' && (selecao.unidadeId === undefined || selecao.unidadeId.trim() === '')) {
    erros.push('Selecione a unidade gerenciada.');
  }

  if (selecao.tipo === 'ADMIN_SISTEMA' && selecao.confirmaAcessoGlobal !== true) {
    erros.push('Confirme que este usuário deve ter acesso administrativo global.');
  }

  return erros;
}

/**
 * Coerência dos campos técnicos FINAIS (depois de simples ou de
 * "Avançado" — as duas UIs escrevem os mesmos campos, então esta validação
 * cobre as duas). Nunca decide autorização de verdade (isso é
 * `firestore.rules`); só impede salvar uma combinação estruturalmente
 * incoerente antes mesmo de chegar ao Firestore.
 */
export function validarCoerenciaAcessoUsuario(
  candidato: { perfil?: Usuario['perfil']; escopo?: Usuario['escopo']; equipeId?: string; unidadeId?: string },
): string[] {
  const erros: string[] = [];

  if (candidato.perfil === 'SUPERVISOR_EQUIPE' && candidato.escopo === 'GLOBAL') {
    erros.push('Supervisor de equipe não pode ter escopo GLOBAL.');
  }
  if (candidato.perfil === 'GESTOR_EQUIPE' && candidato.escopo === 'GLOBAL') {
    erros.push('Gestor de equipe não pode ter escopo GLOBAL.');
  }
  if (candidato.perfil === 'GESTOR_UNIDADE' && (candidato.unidadeId === undefined || candidato.unidadeId.trim() === '')) {
    erros.push('Gestor de unidade precisa de uma unidade definida.');
  }
  if (
    (candidato.perfil === 'SUPERVISOR_EQUIPE' || candidato.perfil === 'GESTOR_EQUIPE')
    && (candidato.equipeId === undefined || candidato.equipeId.trim() === '')
  ) {
    erros.push('Supervisor/Gestor de equipe precisa de uma equipe definida.');
  }

  return erros;
}

/**
 * Aviso VISUAL (nunca regra de segurança — ver PATCH-ADMIN-SIMPLIFICAR-
 * CADASTRO-PERFIS-1, seção "Validações") de que o cargo textual menciona
 * uma equipe diferente da efetivamente atribuída. `cargo` é texto livre;
 * este aviso nunca bloqueia o salvamento nem participa de autorização.
 */
export function avisoCargoDivergenteDaEquipe(
  cargo: string,
  equipeId: string | undefined,
  equipes: readonly Pick<Equipe, 'id' | 'nome' | 'sigla'>[],
): string | undefined {
  const cargoNormalizado = cargo.trim().toUpperCase();
  if (cargoNormalizado === '') {
    return undefined;
  }

  const equipeMencionada = equipes.find((equipe) => {
    const sigla = equipe.sigla.trim().toUpperCase();
    const nome = equipe.nome.trim().toUpperCase();
    return (sigla !== '' && cargoNormalizado.includes(sigla)) || (nome !== '' && cargoNormalizado.includes(nome));
  });
  if (equipeMencionada === undefined || equipeMencionada.id === equipeId) {
    return undefined;
  }

  return `O cargo menciona "${equipeMencionada.nome}", mas a equipe atribuída é diferente. Confira se é o esperado.`;
}

/**
 * Resumo legível do que a seleção final vai conceder — mostrado antes de
 * salvar (ver PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1, "Feedback visual
 * antes de salvar"). Nunca cita nome real de equipe/unidade fixo no código:
 * sempre recebe o rótulo já resolvido de quem chama.
 */
export function resumoAcessoUsuario(
  candidato: Pick<Usuario, 'perfil' | 'escopo'>,
  contexto: { rotuloEquipe?: string; rotuloUnidade?: string },
): string[] {
  if (candidato.perfil === 'ADMIN_SISTEMA' || candidato.escopo === 'GLOBAL') {
    return ['Este usuário terá acesso administrativo GLOBAL a todas as equipes e unidades.'];
  }

  if (candidato.perfil === 'GESTOR_UNIDADE') {
    return [
      contexto.rotuloUnidade
        ? `Este usuário poderá administrar a unidade ${contexto.rotuloUnidade} e suas equipes, conforme as regras do sistema.`
        : 'Este usuário poderá administrar a unidade escolhida e suas equipes, conforme as regras do sistema.',
      'Este usuário NÃO terá acesso administrativo global.',
    ];
  }

  if (candidato.perfil === 'SUPERVISOR_EQUIPE' || candidato.perfil === 'GESTOR_EQUIPE') {
    const equipe = contexto.rotuloEquipe ?? 'a equipe escolhida';
    return [
      `Este usuário poderá administrar: ${equipe}.`,
      'Este usuário NÃO terá acesso administrativo global.',
      `Este usuário poderá aprovar trocas da equipe ${equipe}.`,
      'Este usuário não administrará outras equipes ou unidades, salvo se configurado separadamente.',
    ];
  }

  return ['Este usuário não terá nenhum acesso administrativo — apenas a própria escala.'];
}
