import {
  browserLocalPersistence,
  browserSessionPersistence,
  OAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import type { Usuario } from '../modelos';
import {
  configurarCachePersistente,
  limparFirebaseLocal,
  microsoftProviderConfigurado,
  obterFirebase,
  obterMicrosoftEntraTenantId,
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
export const MENSAGEM_SEM_EMAIL_MICROSOFT =
  'Não foi possível obter um e-mail corporativo da conta Microsoft. Procure o gestor.';
export const MENSAGEM_MICROSOFT_CANCELADO = 'Login Microsoft cancelado.';
export const MENSAGEM_MICROSOFT_NAO_CONFIGURADO =
  'Login Microsoft não está disponível neste ambiente. Use e-mail e senha.';

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

/**
 * Prepara a persistência do Firebase Auth respeitando o mesmo checkbox
 * "manter conectado" para qualquer provedor — Microsoft e e-mail/senha
 * nunca divergem nesse comportamento (ver seção 13 da fase AUTH-1).
 */
async function prepararPersistencia(manterConectado: boolean): Promise<Auth> {
  configurarCachePersistente(manterConectado);
  const { auth } = exigirFirebase();
  await setPersistence(
    auth,
    manterConectado ? browserLocalPersistence : browserSessionPersistence,
  );
  return auth;
}

/**
 * Único ponto de resolução `FirebaseUser -> Usuario`, reutilizado por
 * qualquer provedor. Nenhum provedor ganha um caminho de autorização
 * próprio — email/senha e Microsoft convergem exatamente aqui.
 */
async function concluirAutenticacao(auth: Auth, email: string | null): Promise<Usuario> {
  try {
    if (email === null || email.trim() === '') {
      throw new Error(MENSAGEM_SEM_EMAIL_MICROSOFT);
    }
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
  const auth = await prepararPersistencia(manterConectado);
  const credencial = await signInWithEmailAndPassword(auth, email, senha);
  return concluirAutenticacao(auth, credencial.user.email ?? email);
}

/**
 * Provider Microsoft do Firebase Auth, restrito ao tenant corporativo do
 * Entra ID quando configurado (nunca `common`). Sem tenant configurado, o
 * chamador (`microsoftProviderConfigurado()`) já deve ter desabilitado o
 * botão antes de chegar aqui — esta função não decide isso sozinha.
 */
export function criarProviderMicrosoft(): OAuthProvider {
  const provider = new OAuthProvider('microsoft.com');
  const tenantId = obterMicrosoftEntraTenantId()?.trim();
  if (tenantId) {
    provider.setCustomParameters({ tenant: tenantId });
  }
  return provider;
}

export async function entrarComMicrosoft(manterConectado: boolean): Promise<Usuario> {
  if (!microsoftProviderConfigurado()) {
    throw new Error(MENSAGEM_MICROSOFT_NAO_CONFIGURADO);
  }
  const auth = await prepararPersistencia(manterConectado);
  const credencial = await signInWithPopup(auth, criarProviderMicrosoft());
  return concluirAutenticacao(auth, credencial.user.email);
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return MENSAGEM_MICROSOFT_CANCELADO;
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login Microsoft. Permita pop-ups e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Este domínio não está autorizado para login Microsoft. Contate o administrador.';
    case 'auth/operation-not-allowed':
      return MENSAGEM_MICROSOFT_NAO_CONFIGURADO;
    case 'auth/account-exists-with-different-credential':
      return 'Esta conta já está vinculada a outro método de login. Procure o gestor.';
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
