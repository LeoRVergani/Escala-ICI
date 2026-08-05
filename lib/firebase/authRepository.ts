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

/**
 * Mensagens distintas para os três casos que antes chegavam como o mesmo
 * "não está cadastrado": sem perfil, perfil inativo, ou (fora daqui — ver
 * `EmployeeApp.autenticar`) perfil ativo sem escala publicada no período
 * atual.
 */
export const MENSAGEM_SEM_PERFIL_FIRESTORE =
  'Seu login não está cadastrado na escala. Procure o gestor.';
export const MENSAGEM_PERFIL_INATIVO =
  'Seu cadastro está inativo. Procure o gestor.';

/**
 * O Firebase Auth só serve para autenticar a sessão — a identidade
 * funcional é o login corporativo, derivado do e-mail autenticado
 * (`fulano@empresa.com` → `fulano`). Isso vale para qualquer provedor que
 * devolva e-mail (login por senha hoje, Microsoft/SSO no futuro): nenhum
 * dos dois precisa que `usuarios/{auth.uid}` exista.
 */
export function loginDoEmail(email: string): string {
  return email.split('@')[0]?.toLowerCase().trim() ?? '';
}

async function resolverUsuarioAutenticado(email: string | null): Promise<Usuario> {
  const login = loginDoEmail(email ?? '');
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'usuarios', login));
  if (!snapshot.exists()) {
    throw new Error(MENSAGEM_SEM_PERFIL_FIRESTORE);
  }
  const usuario = lerUsuario(snapshot.id, snapshot.data());
  if (!usuario.ativo) {
    throw new Error(MENSAGEM_PERFIL_INATIVO);
  }
  return usuario;
}

async function carregarUsuario(email: string | null): Promise<Usuario> {
  const { auth } = exigirFirebase();
  try {
    return await resolverUsuarioAutenticado(email);
  } catch (falha) {
    await signOut(auth);
    throw falha;
  }
}

export async function entrarComEmail(
  email: string,
  senha: string,
  manterConectado: boolean,
): Promise<Usuario> {
  configurarCachePersistente(manterConectado);
  const { auth } = exigirFirebase();
  await setPersistence(
    auth,
    manterConectado ? browserLocalPersistence : browserSessionPersistence,
  );
  const credencial = await signInWithEmailAndPassword(auth, email, senha);
  try {
    return await resolverUsuarioAutenticado(credencial.user.email ?? email);
  } catch (falha) {
    await signOut(auth);
    throw falha;
  }
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
      void carregarUsuario(conta.email)
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
