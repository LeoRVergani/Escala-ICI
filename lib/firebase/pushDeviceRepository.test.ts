import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  documentos: new Map<string, Record<string, unknown>>(),
}));

vi.mock('./shared', () => ({
  exigirFirebase: () => ({ db: {} }),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, colecao: string, id: string) => ({ __colecao: colecao, __id: id }),
  getDoc: async (ref: { __id: string }) => {
    const dados = estado.documentos.get(ref.__id);
    return {
      exists: () => dados !== undefined,
      data: () => dados,
    };
  },
  setDoc: async (ref: { __id: string }, dados: Record<string, unknown>) => {
    estado.documentos.set(ref.__id, { ...dados });
  },
  updateDoc: async (ref: { __id: string }, patch: Record<string, unknown>) => {
    const atual = estado.documentos.get(ref.__id);
    if (atual === undefined) {
      throw { code: 'not-found' };
    }
    estado.documentos.set(ref.__id, { ...atual, ...patch });
  },
}));

import {
  desativarDispositivo,
  deviceIdExistenteLocal,
  obterOuCriarDeviceId,
  registrarOuRenovarDispositivo,
  removerDeviceIdLocal,
  verificarDispositivoAtivo,
} from './pushDeviceRepository';

function criarArmazenamentoFake() {
  const mapa = new Map<string, string>();
  return {
    getItem: (chave: string) => mapa.get(chave) ?? null,
    setItem: (chave: string, valor: string) => mapa.set(chave, valor),
    removeItem: (chave: string) => mapa.delete(chave),
  };
}

beforeEach(() => {
  estado.documentos.clear();
});

describe('obterOuCriarDeviceId / deviceIdExistenteLocal / removerDeviceIdLocal', () => {
  it('gera e persiste um deviceId estável por login', () => {
    const armazenamento = criarArmazenamentoFake();
    const primeiro = obterOuCriarDeviceId('lvergani', armazenamento);
    const segundo = obterOuCriarDeviceId('lvergani', armazenamento);
    expect(primeiro).toBe(segundo);
    expect(primeiro).toMatch(/^web-/);
  });

  it('múltiplos logins no mesmo navegador usam deviceIds distintos', () => {
    const armazenamento = criarArmazenamentoFake();
    const deviceA = obterOuCriarDeviceId('lvergani', armazenamento);
    const deviceB = obterOuCriarDeviceId('outro.login', armazenamento);
    expect(deviceA).not.toBe(deviceB);
  });

  it('deviceIdExistenteLocal nunca cria — devolve null se ausente', () => {
    const armazenamento = criarArmazenamentoFake();
    expect(deviceIdExistenteLocal('lvergani', armazenamento)).toBeNull();
    obterOuCriarDeviceId('lvergani', armazenamento);
    expect(deviceIdExistenteLocal('lvergani', armazenamento)).not.toBeNull();
  });

  it('removerDeviceIdLocal limpa o identificador — a próxima chamada gera outro', () => {
    const armazenamento = criarArmazenamentoFake();
    const original = obterOuCriarDeviceId('lvergani', armazenamento);
    removerDeviceIdLocal('lvergani', armazenamento);
    expect(deviceIdExistenteLocal('lvergani', armazenamento)).toBeNull();
    const novo = obterOuCriarDeviceId('lvergani', armazenamento);
    expect(novo).not.toBe(original);
  });
});

describe('registrarOuRenovarDispositivo', () => {
  it('cria o documento com o contrato completo (fid, nunca token; environment STAGING; schemaVersion 1)', async () => {
    await registrarOuRenovarDispositivo({ deviceId: 'dev-1', login: 'lvergani', fid: 'fid-abc' });

    const documento = estado.documentos.get('dev-1');
    expect(documento).toMatchObject({
      deviceId: 'dev-1',
      login: 'lvergani',
      plataforma: 'WEB',
      fid: 'fid-abc',
      ativo: true,
      environment: 'STAGING',
      schemaVersion: 1,
    });
    expect(documento).not.toHaveProperty('token');
  });

  it('renovação do mesmo deviceId atualiza o fid e preserva criadoEm', async () => {
    await registrarOuRenovarDispositivo({ deviceId: 'dev-1', login: 'lvergani', fid: 'fid-original' });
    const criadoEmOriginal = estado.documentos.get('dev-1')?.criadoEm;

    await registrarOuRenovarDispositivo({ deviceId: 'dev-1', login: 'lvergani', fid: 'fid-renovado' });

    const documento = estado.documentos.get('dev-1');
    expect(documento?.fid).toBe('fid-renovado');
    expect(documento?.criadoEm).toBe(criadoEmOriginal);
    expect(estado.documentos.size).toBe(1);
  });

  it('chamar de novo com o mesmo fid é idempotente — não duplica documento', async () => {
    await registrarOuRenovarDispositivo({ deviceId: 'dev-1', login: 'lvergani', fid: 'fid-abc' });
    await registrarOuRenovarDispositivo({ deviceId: 'dev-1', login: 'lvergani', fid: 'fid-abc' });
    expect(estado.documentos.size).toBe(1);
  });

  it('múltiplos dispositivos do mesmo login são permitidos (deviceIds diferentes)', async () => {
    await registrarOuRenovarDispositivo({ deviceId: 'dev-a', login: 'lvergani', fid: 'fid-a' });
    await registrarOuRenovarDispositivo({ deviceId: 'dev-b', login: 'lvergani', fid: 'fid-b' });
    expect(estado.documentos.size).toBe(2);
    expect(estado.documentos.get('dev-a')?.login).toBe('lvergani');
    expect(estado.documentos.get('dev-b')?.login).toBe('lvergani');
  });
});

describe('desativarDispositivo', () => {
  it('desativa somente o dispositivo indicado', async () => {
    await registrarOuRenovarDispositivo({ deviceId: 'dev-a', login: 'lvergani', fid: 'fid-a' });
    await registrarOuRenovarDispositivo({ deviceId: 'dev-b', login: 'lvergani', fid: 'fid-b' });

    await desativarDispositivo('dev-a');

    expect(estado.documentos.get('dev-a')?.ativo).toBe(false);
    expect(estado.documentos.get('dev-b')?.ativo).toBe(true);
  });

  it('não lança se o documento já não existir mais', async () => {
    await expect(desativarDispositivo('inexistente')).resolves.toBeUndefined();
  });
});

describe('verificarDispositivoAtivo', () => {
  it('reflete o campo ativo do documento conhecido', async () => {
    await registrarOuRenovarDispositivo({ deviceId: 'dev-a', login: 'lvergani', fid: 'fid-a' });
    expect(await verificarDispositivoAtivo('dev-a')).toBe(true);
    await desativarDispositivo('dev-a');
    expect(await verificarDispositivoAtivo('dev-a')).toBe(false);
  });

  it('devolve false para dispositivo inexistente', async () => {
    expect(await verificarDispositivoAtivo('nunca-existiu')).toBe(false);
  });
});
