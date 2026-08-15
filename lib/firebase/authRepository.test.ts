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
  emailAutenticado: '' as string | null,
  usuarioPorLogin: new Map<string, Record<string, unknown> | undefined>(),
  microsoftConfigurado: true,
  tenantId: 'tenant-fixo-ici' as string | undefined,
  signOutChamadas: 0,
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
  OAuthProvider: class {
    providerId: string;
    customParameters: Record<string, string> | undefined;
    constructor(providerId: string) {
      this.providerId = providerId;
    }
    setCustomParameters(parametros: Record<string, string>) {
      this.customParameters = parametros;
    }
  },
  onAuthStateChanged: (_auth: unknown, proximo: (conta: { email: string | null } | null) => void) => {
    proximo(estado.emailAutenticado === '' || estado.emailAutenticado === null
      ? null
      : { email: estado.emailAutenticado });
    return () => {};
  },
  setPersistence: async () => {},
  signInWithEmailAndPassword: async (_auth: unknown, _email: string) => ({
    user: { email: estado.emailAutenticado },
  }),
  signInWithPopup: async (_auth: unknown, _provider: unknown) => ({
    user: { email: estado.emailAutenticado },
  }),
  signOut: async () => {
    estado.signOutChamadas += 1;
  },
}));

vi.mock('./shared', async (importarOriginal) => {
  const real = await importarOriginal<typeof import('./shared')>();
  return {
    ...real,
    exigirFirebase: () => ({ db: {}, auth: {} }),
  };
});

vi.mock('./client', () => ({
  configurarCachePersistente: () => {},
  microsoftProviderConfigurado: () => estado.microsoftConfigurado,
  obterFirebase: () => ({ auth: {} }),
  obterMicrosoftEntraTenantId: () => estado.tenantId,
  limparFirebaseLocal: async () => {},
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  getDoc: async (ref: { __colecao: string; __id: string }) => {
    const dados = ref.__colecao === 'usuarios' ? estado.usuarioPorLogin.get(ref.__id) : undefined;
    return { exists: () => dados !== undefined, id: ref.__id, data: () => dados };
  },
}));

const {
  criarProviderMicrosoft,
  entrarComEmail,
  entrarComMicrosoft,
  loginDoEmail,
  MENSAGEM_MICROSOFT_NAO_CONFIGURADO,
  MENSAGEM_SEM_EMAIL_MICROSOFT,
  observarSessao,
} = await import('./authRepository');

beforeEach(() => {
  estado.emailAutenticado = '';
  estado.usuarioPorLogin = new Map();
  estado.microsoftConfigurado = true;
  estado.tenantId = 'tenant-fixo-ici';
  estado.signOutChamadas = 0;
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

describe('criarProviderMicrosoft', () => {
  it('restringe o provider ao tenant corporativo configurado', () => {
    estado.tenantId = 'tenant-fixo-ici';
    const provider = criarProviderMicrosoft() as unknown as {
      providerId: string;
      customParameters?: Record<string, string>;
    };
    expect(provider.providerId).toBe('microsoft.com');
    expect(provider.customParameters).toEqual({ tenant: 'tenant-fixo-ici' });
  });

  it('não define tenant quando não há um configurado', () => {
    estado.tenantId = undefined;
    const provider = criarProviderMicrosoft() as unknown as { customParameters?: Record<string, string> };
    expect(provider.customParameters).toBeUndefined();
  });
});

describe('entrarComMicrosoft', () => {
  it('converge para usuarios/{login} pelo e-mail do FirebaseUser — mesma resolução do e-mail/senha', async () => {
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

    const usuario = await entrarComMicrosoft(true);
    expect(usuario.login).toBe('lvergani');
  });

  it('rejeita com a mesma mensagem de "sem perfil" quando não há usuarios/{login} — Microsoft não ganha privilégio', async () => {
    estado.emailAutenticado = 'desconhecido@empresa.com';
    await expect(entrarComMicrosoft(true)).rejects.toThrow(
      'Seu login não está cadastrado na escala. Procure o gestor.',
    );
  });

  it('rejeita e não cria sessão quando o tenant/provider não está configurado — falha antes de abrir popup', async () => {
    estado.microsoftConfigurado = false;
    estado.emailAutenticado = 'lvergani@empresa.com';
    await expect(entrarComMicrosoft(true)).rejects.toThrow(MENSAGEM_MICROSOFT_NAO_CONFIGURADO);
  });

  it('rejeita e encerra a sessão quando a conta Microsoft não devolve e-mail', async () => {
    estado.emailAutenticado = null;
    await expect(entrarComMicrosoft(true)).rejects.toThrow(MENSAGEM_SEM_EMAIL_MICROSOFT);
    expect(estado.signOutChamadas).toBe(1);
  });
});
