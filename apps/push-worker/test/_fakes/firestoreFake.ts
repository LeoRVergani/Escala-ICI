/**
 * Dublê mínimo, em memória, da superfície do Admin SDK Firestore usada por
 * este pacote (`collection().doc().get/set/update`, `runTransaction`,
 * `where().get()`, `where().onSnapshot()`). Não é `@firebase/rules-unit-testing`
 * de propósito — aquele pacote fala com o emulador e serve para testar
 * Firestore Rules, não a lógica de orquestração de um worker Node.
 *
 * Compatível estruturalmente com os tipos públicos de
 * `firebase-admin/firestore` só onde este pacote realmente usa a API — o
 * código de produção é tipado contra os tipos reais e os testes fazem um
 * cast explícito (`as unknown as Firestore`) ao injetar este dublê.
 */

export type DocData = Record<string, unknown>;

interface StoredDoc {
  data: DocData;
}

export interface FakeDocSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): DocData | undefined;
}

export interface FakeDocRef {
  readonly id: string;
  get(): Promise<FakeDocSnapshot>;
  set(data: DocData): Promise<void>;
  update(data: DocData): Promise<void>;
}

export interface FakeQuerySnapshot {
  readonly docs: FakeDocSnapshot[];
  docChanges(): Array<{ type: 'added' | 'modified' | 'removed'; doc: FakeDocSnapshot }>;
}

export interface FakeQuery {
  where(campo: string, op: WhereOp, valor: unknown): FakeQuery;
  get(): Promise<FakeQuerySnapshot>;
  onSnapshot(
    onNext: (snapshot: FakeQuerySnapshot) => void,
    onError?: (erro: unknown) => void,
  ): () => void;
}

export interface FakeTransaction {
  get(ref: FakeDocRef): Promise<FakeDocSnapshot>;
  set(ref: FakeDocRef, data: DocData): void;
  update(ref: FakeDocRef, data: DocData): void;
}

export interface FakeCollectionRef extends FakeQuery {
  doc(id: string): FakeDocRef;
}

type WhereOp = '==' | '>=' | '<=' | '>' | '<';

function avaliarOp(valorDoDoc: unknown, op: WhereOp, valorEsperado: unknown): boolean {
  switch (op) {
    case '==':
      return valorDoDoc === valorEsperado;
    case '>=':
      return typeof valorDoDoc === typeof valorEsperado && (valorDoDoc as never) >= (valorEsperado as never);
    case '<=':
      return typeof valorDoDoc === typeof valorEsperado && (valorDoDoc as never) <= (valorEsperado as never);
    case '>':
      return typeof valorDoDoc === typeof valorEsperado && (valorDoDoc as never) > (valorEsperado as never);
    case '<':
      return typeof valorDoDoc === typeof valorEsperado && (valorDoDoc as never) < (valorEsperado as never);
    default:
      return false;
  }
}

export class FirestoreFake {
  private readonly colecoes = new Map<string, Map<string, StoredDoc>>();
  private readonly listeners = new Map<string, Set<(snapshot: FakeQuerySnapshot) => void>>();

  collection(nome: string): FakeCollectionRef {
    if (!this.colecoes.has(nome)) {
      this.colecoes.set(nome, new Map());
    }
    return this.criarQuery(nome, []);
  }

  /**
   * Injeta um documento diretamente no armazenamento e notifica listeners
   * (simula uma escrita externa, ex.: outro processo criando uma
   * notificação). Aceita qualquer tipo de objeto (não exige assinatura de
   * índice) — internamente é tratado como dados de documento Firestore.
   */
  seed<T extends object>(colecao: string, id: string, data: T): void {
    const mapa = this.colecoes.get(colecao) ?? new Map<string, StoredDoc>();
    mapa.set(id, { data: { ...(data as unknown as DocData) } });
    this.colecoes.set(colecao, mapa);
    this.notificar(colecao, { type: 'added', doc: this.snapshotDe(id, mapa.get(id)) });
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx: FakeTransaction = {
      get: (ref) => ref.get(),
      set: (ref, data) => {
        void ref.set(data);
      },
      update: (ref, data) => {
        void ref.update(data);
      },
    };
    return fn(tx);
  }

  private snapshotDe(id: string, armazenado: StoredDoc | undefined): FakeDocSnapshot {
    return {
      id,
      exists: armazenado !== undefined,
      data: () => (armazenado ? { ...armazenado.data } : undefined),
    };
  }

  private notificar(colecao: string, mudanca: { type: 'added' | 'modified' | 'removed'; doc: FakeDocSnapshot }): void {
    const ouvintes = this.listeners.get(colecao);
    if (!ouvintes) {
      return;
    }
    const mapa = this.colecoes.get(colecao) ?? new Map<string, StoredDoc>();
    const snapshot: FakeQuerySnapshot = {
      docs: Array.from(mapa.keys()).map((id) => this.snapshotDe(id, mapa.get(id))),
      docChanges: () => [mudanca],
    };
    for (const ouvinte of ouvintes) {
      ouvinte(snapshot);
    }
  }

  private criarQuery(colecao: string, filtros: Array<{ campo: string; op: WhereOp; valor: unknown }>): FakeCollectionRef {
    const mapa = () => this.colecoes.get(colecao) ?? new Map<string, StoredDoc>();
    const aplicarFiltros = (data: DocData) => filtros.every((f) => avaliarOp(data[f.campo], f.op, f.valor));

    const query: FakeCollectionRef = {
      where: (campo, op, valor) => this.criarQuery(colecao, [...filtros, { campo, op, valor }]),
      get: async () => {
        const docs = Array.from(mapa().entries())
          .filter(([, armazenado]) => aplicarFiltros(armazenado.data))
          .map(([id, armazenado]) => this.snapshotDe(id, armazenado));
        return { docs, docChanges: () => [] };
      },
      onSnapshot: (onNext) => {
        if (!this.listeners.has(colecao)) {
          this.listeners.set(colecao, new Set());
        }
        const wrapped = (snapshot: FakeQuerySnapshot) => {
          const filtrados = snapshot.docChanges().filter((c) => aplicarFiltros(c.doc.data() ?? {}));
          if (filtrados.length === 0) {
            return;
          }
          onNext({
            docs: snapshot.docs.filter((d) => aplicarFiltros(d.data() ?? {})),
            docChanges: () => filtrados,
          });
        };
        this.listeners.get(colecao)?.add(wrapped);

        const docsExistentes = Array.from(mapa().entries())
          .filter(([, armazenado]) => aplicarFiltros(armazenado.data))
          .map(([id, armazenado]) => this.snapshotDe(id, armazenado));
        if (docsExistentes.length > 0) {
          onNext({
            docs: docsExistentes,
            docChanges: () => docsExistentes.map((doc) => ({ type: 'added' as const, doc })),
          });
        }

        return () => {
          this.listeners.get(colecao)?.delete(wrapped);
        };
      },
      doc: (id: string) => {
        const ref: FakeDocRef = {
          id,
          get: async () => this.snapshotDe(id, mapa().get(id)),
          set: async (data) => {
            mapa().set(id, { data: { ...data } });
            this.colecoes.set(colecao, mapa());
            this.notificar(colecao, { type: 'added', doc: this.snapshotDe(id, mapa().get(id)) });
          },
          update: async (data) => {
            const atual = mapa().get(id);
            const novo = { ...(atual?.data ?? {}), ...data };
            mapa().set(id, { data: novo });
            this.colecoes.set(colecao, mapa());
            this.notificar(colecao, { type: 'modified', doc: this.snapshotDe(id, mapa().get(id)) });
          },
        };
        return ref;
      },
    };
    return query;
  }
}
