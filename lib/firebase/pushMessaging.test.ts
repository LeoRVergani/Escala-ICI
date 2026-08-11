import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({ __messaging: true })),
  isSupported: vi.fn(async () => true),
  onMessage: vi.fn(),
  onRegistered: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}));

const clienteMock = vi.hoisted(() => ({
  pushConfigurado: vi.fn(() => true),
  obterFirebase: vi.fn((): { app: { __app: boolean } } | null => ({ app: { __app: true } })),
  obterVapidKeyPublica: vi.fn((): string | undefined => 'vapid-publica-fake'),
}));

vi.mock('./client', () => clienteMock);

import {
  ativarPush,
  assinarMensagensEmPrimeiroPlano,
  assinarRenovacaoFid,
  avaliarSuporte,
  desativarPush,
  dependenciasPadrao,
  limparPushAoSair,
  retomarPushSeAderido,
  type PushMessagingDeps,
} from './pushMessaging';

function criarDeps(overrides: Partial<PushMessagingDeps> = {}): PushMessagingDeps {
  return {
    isSupported: vi.fn(async () => true),
    getMessaging: vi.fn(() => ({ __messaging: true }) as never),
    register: vi.fn(async () => {}),
    unregister: vi.fn(async () => {}),
    onRegistered: vi.fn(() => () => {}),
    onMessage: vi.fn(() => () => {}),
    requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
    permissaoAtual: vi.fn(() => 'default' as NotificationPermission),
    notificationDisponivel: vi.fn(() => true),
    serviceWorkerReady: vi.fn(async () => ({ __registration: true }) as never),
    ...overrides,
  };
}

afterEach(() => {
  clienteMock.pushConfigurado.mockReturnValue(true);
  clienteMock.obterFirebase.mockReturnValue({ app: { __app: true } });
  clienteMock.obterVapidKeyPublica.mockReturnValue('vapid-publica-fake');
  vi.clearAllMocks();
});

describe('ativarPush', () => {
  it('devolve NAO_CONFIGURADO sem tocar em nada do navegador quando pushConfigurado() é false', async () => {
    clienteMock.pushConfigurado.mockReturnValue(false);
    const deps = criarDeps();

    const resultado = await ativarPush(deps);

    expect(resultado).toEqual({ estado: 'NAO_CONFIGURADO' });
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('devolve NAO_SUPORTADO quando Notification não existe no navegador', async () => {
    const deps = criarDeps({ notificationDisponivel: () => false });
    const resultado = await ativarPush(deps);
    expect(resultado).toEqual({ estado: 'NAO_SUPORTADO' });
  });

  it('devolve NAO_SUPORTADO quando isSupported() do SDK resolve false', async () => {
    const deps = criarDeps({ isSupported: async () => false });
    const resultado = await ativarPush(deps);
    expect(resultado).toEqual({ estado: 'NAO_SUPORTADO' });
  });

  it('nunca chama requestPermission quando a permissão já está denied', async () => {
    const deps = criarDeps({ permissaoAtual: () => 'denied' });
    const resultado = await ativarPush(deps);
    expect(resultado).toEqual({ estado: 'PERMISSAO_NEGADA' });
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('pede permissão explicitamente e devolve PERMISSAO_NEGADA se o usuário recusar', async () => {
    const deps = criarDeps({ requestPermission: vi.fn(async () => 'denied' as NotificationPermission) });
    const resultado = await ativarPush(deps);
    expect(resultado).toEqual({ estado: 'PERMISSAO_NEGADA' });
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('nunca chama requestPermission quando a permissão já está granted (retomada automática no recarregamento)', async () => {
    const deps = criarDeps({
      permissaoAtual: () => 'granted',
      onRegistered: (_messaging, callback) => {
        queueMicrotask(() => callback('fid-retomado'));
        return () => {};
      },
      register: async () => {},
    });

    const resultado = await ativarPush(deps);

    expect(resultado).toEqual({ estado: 'ATIVO', fid: 'fid-retomado' });
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('instala onRegistered antes de chamar register, e devolve ATIVO com o fid entregue', async () => {
    const ordem: string[] = [];
    const deps = criarDeps({
      onRegistered: (_messaging, callback) => {
        ordem.push('onRegistered');
        queueMicrotask(() => callback('fid-de-teste'));
        return () => {};
      },
      register: async () => {
        ordem.push('register');
      },
    });

    const resultado = await ativarPush(deps);

    expect(resultado).toEqual({ estado: 'ATIVO', fid: 'fid-de-teste' });
    expect(ordem).toEqual(['onRegistered', 'register']);
  });

  it('register() rejeitando devolve ERRO com a mensagem, nunca lança', async () => {
    const deps = criarDeps({
      onRegistered: () => () => {},
      register: async () => {
        throw new Error('falha de rede');
      },
    });

    const resultado = await ativarPush(deps);

    expect(resultado.estado).toBe('ERRO');
    expect(resultado.erro).toBe('falha de rede');
  });

  it('duas chamadas concorrentes compartilham a mesma operação — register() só é chamado uma vez', async () => {
    let chamadasRegister = 0;
    const deps = criarDeps({
      onRegistered: (_messaging, callback) => {
        queueMicrotask(() => callback('fid-unico'));
        return () => {};
      },
      register: async () => {
        chamadasRegister += 1;
      },
    });

    const [primeiro, segundo] = await Promise.all([ativarPush(deps), ativarPush(deps)]);

    expect(chamadasRegister).toBe(1);
    expect(primeiro).toEqual(segundo);
  });

  it('resultado ATIVO nunca inclui a mensagem de erro, e o fid nunca aparece serializado com outro rótulo', async () => {
    const deps = criarDeps({
      onRegistered: (_messaging, callback) => {
        queueMicrotask(() => callback('fid-secreto-nao-deve-aparecer-em-log'));
        return () => {};
      },
      register: async () => {},
    });

    const resultado = await ativarPush(deps);
    expect(resultado.erro).toBeUndefined();
    expect(JSON.stringify(resultado)).toContain('fid-secreto-nao-deve-aparecer-em-log');
    // O único lugar em que o FID aparece é o campo `fid` devolvido para quem
    // chamou persistir — nunca dentro de `erro` (mensagem de log/UI).
  });
});

describe('avaliarSuporte', () => {
  it('reflete notificationDisponivel + isSupported', async () => {
    expect(await avaliarSuporte(criarDeps({ notificationDisponivel: () => false }))).toBe(false);
    expect(await avaliarSuporte(criarDeps({ isSupported: async () => false }))).toBe(false);
    expect(await avaliarSuporte(criarDeps())).toBe(true);
  });
});

describe('desativarPush', () => {
  it('chama unregister quando há Firebase e suporte', async () => {
    const deps = criarDeps();
    await desativarPush(deps);
    expect(deps.unregister).toHaveBeenCalledTimes(1);
  });

  it('não faz nada quando obterFirebase() é null', async () => {
    clienteMock.obterFirebase.mockReturnValue(null);
    const deps = criarDeps();
    await desativarPush(deps);
    expect(deps.unregister).not.toHaveBeenCalled();
  });
});

describe('assinarMensagensEmPrimeiroPlano / assinarRenovacaoFid', () => {
  it('devolvem null quando obterFirebase() é null', () => {
    clienteMock.obterFirebase.mockReturnValue(null);
    expect(assinarMensagensEmPrimeiroPlano(() => {}, criarDeps())).toBeNull();
    expect(assinarRenovacaoFid(() => {}, criarDeps())).toBeNull();
  });

  it('assinam via a mesma instância de Messaging', () => {
    const deps = criarDeps();
    assinarMensagensEmPrimeiroPlano(() => {}, deps);
    assinarRenovacaoFid(() => {}, deps);
    expect(deps.onMessage).toHaveBeenCalledTimes(1);
    expect(deps.onRegistered).toHaveBeenCalledTimes(1);
  });
});

describe('dependenciasPadrao', () => {
  it('nunca importa getToken/deleteToken do SDK', () => {
    expect(Object.keys(dependenciasPadrao)).not.toContain('getToken');
    expect(Object.keys(dependenciasPadrao)).not.toContain('deleteToken');
  });
});

describe('retomarPushSeAderido (auditoria PUSH-PWA-1.1 — reabertura/recarregamento)', () => {
  it('usuário sem adesão anterior (sem deviceId local) não registra — nunca chama isSupported/verificarDispositivoAtivo/register', async () => {
    const verificarDispositivoAtivo = vi.fn(async () => true);
    const deps = criarDeps({ permissaoAtual: () => 'granted' });

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: null, verificarDispositivoAtivo },
      deps,
    );

    expect(resultado).toEqual({ estado: 'NAO_ADERIU' });
    expect(verificarDispositivoAtivo).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('permissão não granted não registra, mesmo com deviceId local existente', async () => {
    const verificarDispositivoAtivo = vi.fn(async () => true);
    const deps = criarDeps({ permissaoAtual: () => 'default' });

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: 'dev-1', verificarDispositivoAtivo },
      deps,
    );

    expect(resultado).toEqual({ estado: 'NAO_ADERIU' });
    expect(verificarDispositivoAtivo).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('deviceId existente mas documento desativado no Firestore (por outro dispositivo/sessão) não reativa', async () => {
    const verificarDispositivoAtivo = vi.fn(async () => false);
    const deps = criarDeps({ permissaoAtual: () => 'granted' });

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: 'dev-1', verificarDispositivoAtivo },
      deps,
    );

    expect(resultado).toEqual({ estado: 'NAO_ADERIU' });
    expect(verificarDispositivoAtivo).toHaveBeenCalledWith('dev-1');
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('adesão confirmada (permissão granted + deviceId local + documento ativo) registra de novo de forma idempotente, sem pedir permissão', async () => {
    const verificarDispositivoAtivo = vi.fn(async () => true);
    const deps = criarDeps({
      permissaoAtual: () => 'granted',
      onRegistered: (_messaging, callback) => {
        queueMicrotask(() => callback('fid-retomado-no-reload'));
        return () => {};
      },
      register: vi.fn(async () => {}),
    });

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: 'dev-1', verificarDispositivoAtivo },
      deps,
    );

    expect(resultado).toEqual({ estado: 'ATIVO', fid: 'fid-retomado-no-reload' });
    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(deps.register).toHaveBeenCalledTimes(1);
  });

  it('falha ao verificar suporte não registra e não lança', async () => {
    const verificarDispositivoAtivo = vi.fn(async () => true);
    const deps = criarDeps({ permissaoAtual: () => 'granted', isSupported: async () => false });

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: 'dev-1', verificarDispositivoAtivo },
      deps,
    );

    expect(resultado).toEqual({ estado: 'NAO_ADERIU' });
    expect(verificarDispositivoAtivo).not.toHaveBeenCalled();
  });

  it('devolve NAO_CONFIGURADO sem tocar nada quando pushConfigurado() é false', async () => {
    clienteMock.pushConfigurado.mockReturnValue(false);
    const verificarDispositivoAtivo = vi.fn(async () => true);

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: 'dev-1', verificarDispositivoAtivo },
      criarDeps(),
    );

    expect(resultado).toEqual({ estado: 'NAO_CONFIGURADO' });
    expect(verificarDispositivoAtivo).not.toHaveBeenCalled();
  });

  it('falha ao consultar o Firestore (rejeição, não só false) nunca mostra estado ativo — nunca chama register', async () => {
    const verificarDispositivoAtivo = vi.fn(async () => {
      throw new Error('PERMISSION_DENIED');
    });
    const deps = criarDeps({ permissaoAtual: () => 'granted' });

    const resultado = await retomarPushSeAderido(
      { deviceIdExistente: 'dev-1', verificarDispositivoAtivo },
      deps,
    );

    expect(resultado).toEqual({ estado: 'NAO_ADERIU' });
    expect(deps.register).not.toHaveBeenCalled();
  });
});

describe('limparPushAoSair (auditoria PUSH-PWA-1.1 — logout e desativação)', () => {
  it('sem deviceId local, só tenta unregister() — nunca chama desativarDispositivo', async () => {
    const desativarDispositivo = vi.fn(async () => {});
    const deps = criarDeps();

    await limparPushAoSair({ deviceIdExistente: null, desativarDispositivo }, deps);

    expect(deps.unregister).toHaveBeenCalledTimes(1);
    expect(desativarDispositivo).not.toHaveBeenCalled();
  });

  it('com deviceId local, desativa o dispositivo e executa unregister()', async () => {
    const desativarDispositivo = vi.fn(async () => {});
    const deps = criarDeps();

    await limparPushAoSair({ deviceIdExistente: 'dev-1', desativarDispositivo }, deps);

    expect(deps.unregister).toHaveBeenCalledTimes(1);
    expect(desativarDispositivo).toHaveBeenCalledWith('dev-1');
  });

  it('nenhuma exceção escapa quando desativarDispositivo/unregister falham', async () => {
    const desativarDispositivo = vi.fn(async () => {
      throw new Error('offline');
    });
    const deps = criarDeps({ unregister: vi.fn(async () => { throw new Error('offline'); }) });

    await expect(
      limparPushAoSair({ deviceIdExistente: 'dev-1', desativarDispositivo }, deps),
    ).resolves.toBeUndefined();
  });

  it('nunca fica travado além do timeout — logout segue mesmo se a limpeza nunca resolver (ex.: offline)', async () => {
    vi.useFakeTimers();
    try {
      const desativarDispositivo = vi.fn(() => new Promise<void>(() => {})); // nunca resolve
      const deps = criarDeps({ unregister: vi.fn(() => new Promise<void>(() => {})) });

      const promessa = limparPushAoSair(
        { deviceIdExistente: 'dev-1', desativarDispositivo, timeoutMs: 50 },
        deps,
      );
      await vi.advanceTimersByTimeAsync(50);

      await expect(promessa).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
