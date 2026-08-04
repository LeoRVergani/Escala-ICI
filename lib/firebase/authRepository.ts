import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import type { Usuario } from '../modelos';
import {
  configurarCachePersistente,
  limparFirebaseLocal,
  obterFirebase,
} from './client';
import { exigirFirebase, lerUsuario } from './shared';

async function carregarUsuario(uid: string): Promise<Usuario> {
  const { auth, db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'usuarios', uid));
  if (!snapshot.exists()) {
    await signOut(auth);
    throw new Error('Seu usuário autenticado não está cadastrado no Firestore.');
  }
  return lerUsuario(snapshot.id, snapshot.data());
}

export async function entrarComEmail(
  email: string,
  senha: string,
  manterConectado: boolean,
): Promise<Usuario> {
  configurarCachePersistente(manterConectado);
  const { auth, db } = exigirFirebase();
  await setPersistence(
    auth,
    manterConectado ? browserLocalPersistence : browserSessionPersistence,
  );
  const credencial = await signInWithEmailAndPassword(auth, email, senha);
  const snapshot = await getDoc(doc(db, 'usuarios', credencial.user.uid));
  if (!snapshot.exists()) {
    await signOut(auth);
    throw new Error('Seu usuário autenticado não está cadastrado no Firestore.');
  }
  return lerUsuario(snapshot.id, snapshot.data());
}

export function observarSessao(
  manterConectado: boolean,
  aoRestaurar: (usuario: Usuario | null) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  configurarCachePersistente(manterConectado);
  const { auth } = exigirFirebase();
  let ativo = true;
  let cancelarObservacao: Unsubscribe | undefined;

  void setPersistence(
    auth,
    manterConectado ? browserLocalPersistence : browserSessionPersistence,
  ).then(() => {
    if (!ativo) {
      return;
    }
    cancelarObservacao = onAuthStateChanged(auth, (conta) => {
      if (conta === null) {
        aoRestaurar(null);
        return;
      }
      void carregarUsuario(conta.uid)
        .then(aoRestaurar)
        .catch((falha: unknown) =>
          aoFalhar(falha instanceof Error ? falha : new Error('Falha ao restaurar sessão.')));
    }, (falha) => aoFalhar(falha));
  }).catch((falha: unknown) =>
    aoFalhar(falha instanceof Error ? falha : new Error('Falha ao preparar sessão.')));

  return () => {
    ativo = false;
    cancelarObservacao?.();
  };
}

export function mensagemErroAutenticacao(falha: unknown): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String(falha.code)
    : '';

  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha inválidos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
    case 'auth/network-request-failed':
      return 'Não foi possível acessar o Firebase. Verifique sua conexão.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    default:
      return falha instanceof Error ? falha.message : 'Não foi possível entrar.';
  }
}

export async function sair(): Promise<void> {
  const firebase = obterFirebase();
  if (firebase !== null) {
    await signOut(firebase.auth);
    await limparFirebaseLocal();
  }
}
