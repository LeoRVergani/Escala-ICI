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
