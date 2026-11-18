import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { COLECOES_COM_VALIDADE, diaDeCorteDosContadores, limparRecadosVencidos } from '../src/limpezaRecados.js';

/** Firestore mínimo em memória: só o que a limpeza usa (where + limit + get, batch.delete + commit). */
function fakeDb(colecoes: Record<string, Array<Record<string, unknown>>>) {
  const comparavel = (valor: unknown) => (valor instanceof Timestamp ? valor.toMillis() : valor as string | number);
  const consultas: string[] = [];
  const db = {
    collection: (nome: string) => ({
      where: (campo: string, operador: string, valor: unknown) => ({
        limit: (maximo: number) => ({
          get: async () => {
            consultas.push(`${nome}.${campo}${operador}`);
            const docs = (colecoes[nome] ?? [])
              .filter((dado) => (operador === '<=' ? comparavel(dado[campo]) <= comparavel(valor) : comparavel(dado[campo]) < comparavel(valor)))
              .slice(0, maximo)
              .map((dado) => ({ id: String(dado.id), ref: { colecao: nome, id: String(dado.id) } }));
            return { empty: docs.length === 0, size: docs.length, docs };
          },
        }),
      }),
    }),
    batch: () => {
      const pendentes: Array<{ colecao: string; id: string }> = [];
      return {
        delete: (ref: { colecao: string; id: string }) => { pendentes.push(ref); },
        commit: async () => { for (const ref of pendentes) colecoes[ref.colecao] = (colecoes[ref.colecao] ?? []).filter((dado) => String(dado.id) !== ref.id); },
      };
    },
  };
  return { db: db as unknown as Firestore, consultas };
}

const AGORA = new Date('2026-11-17T15:00:00.000Z');
const antes = (horas: number) => Timestamp.fromMillis(AGORA.getTime() - horas * 3_600_000);

describe('RECADOS-3 — limpeza dos recados vencidos pelo worker', () => {
  it('apaga só o que venceu, nas duas coleções, e mantém o que ainda vale', async () => {
    const colecoes = {
      recados: [{ id: 'vencido', expiraEm: antes(1) }, { id: 'no-limite', expiraEm: antes(0) }, { id: 'valido', expiraEm: antes(-5) }],
      recadosGrupo: [{ id: 'g-vencido', expiraEm: antes(30) }, { id: 'g-valido', expiraEm: antes(-30) }],
      recadosLimite: [],
    };
    const { db } = fakeDb(colecoes);
    expect(await limparRecadosVencidos(db, AGORA)).toBe(3);
    expect(colecoes.recados.map((dado) => dado.id)).toEqual(['valido']);
    expect(colecoes.recadosGrupo.map((dado) => dado.id)).toEqual(['g-valido']);
  });

  it('apaga em lotes: 450 vencidos somem em três rodadas e nada fica para trás', async () => {
    const colecoes = { recados: Array.from({ length: 450 }, (_, i) => ({ id: `r${i}`, expiraEm: antes(2) })), recadosGrupo: [], recadosLimite: [] };
    const { db } = fakeDb(colecoes);
    expect(await limparRecadosVencidos(db, AGORA)).toBe(450);
    expect(colecoes.recados).toHaveLength(0);
  });

  it('os contadores diários: guarda hoje e ontem (Brasília) e apaga os mais antigos', async () => {
    expect(diaDeCorteDosContadores(AGORA)).toBe('2026-11-15');
    expect(diaDeCorteDosContadores(new Date('2026-11-18T02:00:00.000Z'))).toBe('2026-11-15');
    const colecoes = {
      recados: [], recadosGrupo: [],
      recadosLimite: [{ id: 'a_2026-11-17', dia: '2026-11-17' }, { id: 'a_2026-11-16', dia: '2026-11-16' }, { id: 'a_2026-11-15', dia: '2026-11-15' }, { id: 'a_2026-11-10', dia: '2026-11-10' }],
    };
    const { db } = fakeDb(colecoes);
    expect(await limparRecadosVencidos(db, AGORA)).toBe(1);
    expect(colecoes.recadosLimite.map((dado) => dado.id)).toEqual(['a_2026-11-17', 'a_2026-11-16', 'a_2026-11-15']);
  });

  it('sem nada vencido não apaga nada; e consulta as duas coleções com validade e os contadores', async () => {
    const { db, consultas } = fakeDb({ recados: [{ id: 'v', expiraEm: antes(-1) }], recadosGrupo: [], recadosLimite: [] });
    expect(await limparRecadosVencidos(db, AGORA)).toBe(0);
    expect([...COLECOES_COM_VALIDADE]).toEqual(['recados', 'recadosGrupo']);
    expect(consultas).toEqual(['recados.expiraEm<=', 'recadosGrupo.expiraEm<=', 'recadosLimite.dia<']);
  });
});
