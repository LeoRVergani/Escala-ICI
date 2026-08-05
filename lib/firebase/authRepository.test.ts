import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regra de negócio: o Firebase Auth só autentica a sessão. A identidade
 * funcional é o login corporativo, derivado do e-mail autenticado
 * (`fulano@empresa.com` -> `fulano`) — não depende de
 * `usuarios/{request.auth.uid}` nem de UID nenhum. Este mock de
 * `firebase/firestore` só expõe `doc`/`getDoc`; se o código um dia passar a
 * consultar por `collection`/`query`/`where`, a chamada quebra aqui.
 */
const estado = vi.hoisted(() => ({
  emailAutenticado: '',
  usuarioPorLogin: new Map<string, Record<string, unknown> | undefined>(),
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
  onAuthStateChanged: (_auth: unknown, proximo: (conta: { email: string } | null) => void) => {
    proximo(estado.emailAutenticado === '' ? null : { email: estado.emailAutenticado });
    return () => {};
  },
  setPersistence: async () => {},
  signInWithEmailAndPassword: async (_auth: unknown, _email: string) => ({
    user: { email: estado.emailAutenticado },
  }),
  signOut: async () => {},
}));

vi.mock('./shared', async (importarOriginal) => {
  const real = await importarOriginal<typeof import('./shared')>();
  return {
    ...real,
    exigirFirebase: () => ({ db: {}, auth: {} }),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  getDoc: async (ref: { __colecao: string; __id: string }) => {
    const dados = ref.__colecao === 'usuarios' ? estado.usuarioPorLogin.get(ref.__id) : undefined;
    return { exists: () => dados !== undefined, id: ref.__id, data: () => dados };
  },
}));

const { entrarComEmail, loginDoEmail, observarSessao } = await import('./authRepository');

beforeEach(() => {
  estado.emailAutenticado = '';
  estado.usuarioPorLogin = new Map();
});

describe('loginDoEmail', () => {
  it('deriva o login da parte antes do @, em minúsculas e sem espaços', () => {
    expect(loginDoEmail('lvergani@empresa.com')).toBe('lvergani');
    expect(loginDoEmail('  LVergani@Empresa.com')).toBe('lvergani');
  });
});

describe('entrarComEmail', () => {
  it('carrega usuarios/{login} — não usuarios/{auth.uid} — a partir do e-mail autenticado', async () => {
    estado.emailAutenticado = 'lvergani@empresa.com';
    estado.usuarioPorLogin.set('lvergani', {
      login: 'lvergani',
      nome: 'lvergani',
      email: 'lvergani@empresa.com',
      equipeId: 'EQ_SOC',
      cargo: 'ANALISTA_SOC',
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      gestorUid: null,
    });

    const usuario = await entrarComEmail('lvergani@empresa.com', 'senha', true);
    expect(usuario.login).toBe('lvergani');
  });

  it('rejeita com mensagem sem menção a UID quando o login não está cadastrado', async () => {
    estado.emailAutenticado = 'desconhecido@empresa.com';
    await expect(entrarComEmail('desconhecido@empresa.com', 'senha', true)).rejects.toThrow(
      'Seu login não está cadastrado na escala. Procure o gestor.',
    );
  });

  it('rejeita quando o cadastro existe mas está inativo', async () => {
    estado.emailAutenticado = 'lvergani@empresa.com';
    estado.usuarioPorLogin.set('lvergani', {
      login: 'lvergani',
      nome: 'lvergani',
      email: 'lvergani@empresa.com',
      equipeId: 'EQ_SOC',
      cargo: 'ANALISTA_SOC',
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: false,
      gestorUid: null,
    });

    await expect(entrarComEmail('lvergani@empresa.com', 'senha', true)).rejects.toThrow(
      'Seu cadastro está inativo. Procure o gestor.',
    );
  });
});

describe('observarSessao', () => {
  it('restaura a sessão resolvendo o perfil pelo e-mail da conta autenticada', async () => {
    estado.emailAutenticado = 'lvergani@empresa.com';
    estado.usuarioPorLogin.set('lvergani', {
      login: 'lvergani',
      nome: 'lvergani',
      email: 'lvergani@empresa.com',
      equipeId: 'EQ_SOC',
      cargo: 'ANALISTA_SOC',
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      gestorUid: null,
    });

    const restaurado = await new Promise((resolve, reject) => {
      observarSessao(true, resolve, reject);
    });
    expect((restaurado as { login: string }).login).toBe('lvergani');
  });
});
