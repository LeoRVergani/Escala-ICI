import {
  CATALOGO_SOC,
  type TipoTurno,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  type Unsubscribe,
  where,
} from 'firebase/firestore';

import type {
  EstadoPublicacaoEscala,
  EventoEscala,
  PublicacaoEscala,
  Usuario,
} from '../modelos';
import { exigirFirebase, lerUsuario } from './shared';

export async function listarUsuarios(equipeId: string): Promise<Usuario[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(
    query(collection(db, 'usuarios'), where('equipeId', '==', equipeId)),
  );
  return resultado.docs.map((snapshot) =>
    lerUsuario(snapshot.id, snapshot.data()));
}

/**
 * Lista somente as pessoas cadastradas a partir de um Grupo de Plantão.
 *
 * Um responsável matricial pode administrar o Grupo sem pertencer à equipe
 * responsável. Nesse caso, consultar apenas por `equipeId` não permite que as
 * Rules provem o alvo de Plantão de todos os resultados. As duas restrições do
 * contexto tornam a consulta autorizável e impedem enumerar usuários de outro
 * Grupo que eventualmente compartilhe a mesma equipe.
 */
export async function listarUsuariosDoPlantao(
  equipeId: string,
  grupoId: string,
): Promise<Usuario[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'usuarios'),
    where('equipeId', '==', equipeId),
    where('cadastroOperacional.tipo', '==', 'PLANTAO'),
    where('cadastroOperacional.alvoId', '==', grupoId),
  ));
  return resultado.docs.map((snapshot) =>
    lerUsuario(snapshot.id, snapshot.data()));
}

/**
 * PATCH-PLANTAO-VINCULO-GESTOR-COMO-PARTICIPANTE-1 — pool de candidatos a
 * PARTICIPANTE de um Plantão, distinto de `listarUsuariosDoPlantao()` acima
 * (que só encontra quem já foi cadastrado ESPECIFICAMENTE através deste
 * Grupo). Perfil de acesso ao sistema (GESTOR_UNIDADE, GESTOR_EQUIPE etc.)
 * não é a mesma coisa que participação em escala — um coordenador pode
 * também cobrir plantão. Por isso a busca cobre TODO o alcance do Grupo:
 * membros diretos da equipe responsável e das equipes em `equipesConsulta`
 * (por `equipeId`), e quem administra a própria unidade responsável (por
 * `unidadeId`) — nunca filtra por perfil/escopo.
 *
 * IMPORTANTE — limite real (não teórico) das Rules atuais, confirmado por
 * teste antes de escrever isto (nunca por suposição): uma consulta `list`
 * em `usuarios` só é "provável" pelas Rules quando o campo do `where(...)`
 * é EXATAMENTE o mesmo campo que a regra de leitura usa para autorizar
 * (`equipeId` via `podeOperarNaEquipe()`, `unidadeId` via a branch nova
 * espelhada em `firestore.rules`). Um `where('unidadesPermitidas',
 * 'array-contains', ...)`/`where('equipesPermitidas', 'array-contains',
 * ...)` falha com "Null value error" para qualquer ator não-admin, mesmo
 * quando o único documento retornado seria o do próprio autor — por isso
 * esses dois critérios (pedidos na correção, mas não prováveis como
 * consulta ampla sem uma mudança de Rules bem mais invasiva) ficaram de
 * fora. Isso já resolve o caso relatado: `clis` tem `equipeId ==
 * GEDSI_COSI_SOC` (uma das `equipesConsulta` do Plantão COSI) E
 * `unidadeId == GEDSI_COSI` (a unidade responsável) — os dois caminhos que
 * seguem abaixo o encontram.
 *
 * Cada sub-consulta é independente e tolerante a falha (`Promise.all` sobre
 * chamadas que nunca rejeitam): se as Rules recusarem uma delas para quem
 * está autenticado agora, as demais ainda contribuem candidatos — nunca
 * derruba a tela inteira. `listarUsuariosDoPlantao()` continua fazendo
 * parte da união (superconjunto, nunca substituição).
 */
export async function listarUsuariosElegiveisPlantao(
  equipeResponsavelId: string,
  grupoId: string,
  unidadeResponsavelId: string | undefined,
  equipesConsulta: readonly string[],
): Promise<Usuario[]> {
  const { db } = exigirFirebase();

  async function buscarPorEquipeId(valor: string): Promise<Usuario[]> {
    try {
      const resultado = await getDocs(query(collection(db, 'usuarios'), where('equipeId', '==', valor)));
      return resultado.docs.map((snapshot) => lerUsuario(snapshot.id, snapshot.data()));
    } catch {
      return [];
    }
  }

  async function buscarPorUnidadeId(valor: string): Promise<Usuario[]> {
    try {
      const resultado = await getDocs(query(collection(db, 'usuarios'), where('unidadeId', '==', valor)));
      return resultado.docs.map((snapshot) => lerUsuario(snapshot.id, snapshot.data()));
    } catch {
      return [];
    }
  }

  const equipesRelacionadas = [...new Set([equipeResponsavelId, ...equipesConsulta])];
  const consultas: Promise<Usuario[]>[] = [
    listarUsuariosDoPlantao(equipeResponsavelId, grupoId).catch(() => []),
    ...equipesRelacionadas.map((equipeId) => buscarPorEquipeId(equipeId)),
    ...(unidadeResponsavelId === undefined ? [] : [buscarPorUnidadeId(unidadeResponsavelId)]),
  ];

  const listas = await Promise.all(consultas);
  const porLogin = new Map<string, Usuario>();
  for (const lista of listas) {
    for (const usuario of lista) {
      porLogin.set(usuario.login, usuario);
    }
  }
  return [...porLogin.values()];
}

export async function listarCatalogo(
  equipeId: string,
): Promise<Record<string, TipoTurno>> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(
    query(collection(db, 'tiposTurno'), where('equipeId', '==', equipeId)),
  );

  if (resultado.empty) {
    return CATALOGO_SOC;
  }

  return Object.fromEntries(resultado.docs.map((snapshot) => {
    const dados = snapshot.data();
    const codigo = String(dados.codigo ?? snapshot.id.split('_').at(-1) ?? '');
    return [codigo, dados as TipoTurno];
  }));
}

export async function carregarEscalasEquipe(
  equipeId: string,
  competencia: string,
  somentePublicadas: boolean,
): Promise<TurnosMes[]> {
  const { db } = exigirFirebase();
  const restricoes = [
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ];
  if (somentePublicadas) {
    restricoes.push(where('status', '==', 'PUBLICADA'));
  }

  const resultado = await getDocs(
    query(collection(db, 'turnosMes'), ...restricoes),
  );
  return resultado.docs.map((snapshot) => snapshot.data() as TurnosMes);
}

export function observarEscalasEquipe(
  equipeId: string,
  competencia: string,
  aoAtualizar: (documentos: TurnosMes[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, 'turnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
    where('status', '==', 'PUBLICADA'),
  ), (snapshot) => aoAtualizar(
    snapshot.docs.map((documento) => documento.data() as TurnosMes),
  ), (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar a escala publicada.'),
  ));
}

export async function carregarRascunhosEquipe(
  equipeId: string,
  competencia: string,
): Promise<TurnosMes[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'rascunhosTurnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ));
  return resultado.docs.map((snapshot) => snapshot.data() as TurnosMes);
}

export async function listarHistoricoPublicacoes(
  equipeId: string,
  competencia: string,
): Promise<PublicacaoEscala[]> {
  const { db } = exigirFirebase();
  const chavePublicacao = `${equipeId}_${competencia}`;
  const resultado = await getDocs(query(
    collection(db, 'historicoPublicacoes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
    where('chavePublicacao', '==', chavePublicacao),
  ));
  return resultado.docs
    .map((snapshot) => snapshot.data() as PublicacaoEscala)
    .sort((a, b) => b.revisao - a.revisao);
}

export async function carregarEstadoPublicacao(
  equipeId: string,
  competencia: string,
): Promise<EstadoPublicacaoEscala | null> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'publicacoesEscala', `${equipeId}_${competencia}`));
  return snapshot.exists() ? snapshot.data() as EstadoPublicacaoEscala : null;
}

/**
 * Busca pelo `login` corporativo, não pelo `usuarioUid`: o login é o
 * identificador funcional único da pessoa na empresa, enquanto o
 * `usuarioUid` gravado na escala publicada pode ficar preso a um UID
 * antigo/provisório de importação, diferente do UID atual do Firebase
 * Authentication.
 */
export async function carregarMinhaEscala(
  login: string,
  equipeId: string,
  competencia: string,
): Promise<TurnosMes | null> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'turnosMes'),
    where('login', '==', login),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
    where('status', '==', 'PUBLICADA'),
  ));
  return resultado.docs[0]?.data() as TurnosMes | undefined ?? null;
}

export async function listarEventosPublicacao(
  equipeId: string,
  publicacaoId: string,
): Promise<EventoEscala[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, 'eventosEscala'),
    where('equipeId', '==', equipeId),
    where('publicacaoId', '==', publicacaoId),
  ));
  return resultado.docs.map((snapshot) => snapshot.data() as EventoEscala);
}

export function observarEventosEscala(
  login: string,
  equipeId: string,
  aoAtualizar: (eventos: EventoEscala[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, 'eventosEscala'),
    where('usuarioUid', '==', login),
    where('equipeId', '==', equipeId),
  ), (snapshot) => {
    const eventos = snapshot.docs
      .map((documento) => documento.data() as EventoEscala)
      .sort((a, b) => b.revisao - a.revisao);
    aoAtualizar(eventos);
  }, (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar atualizações.'),
  ));
}
