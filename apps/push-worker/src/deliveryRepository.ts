import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { NotificacaoTroca, PushEntrega } from './types.js';

const COLECAO = 'pushEntregas';

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: 'ja-enviado' | 'lease-em-vigor' };

export interface ClaimOptions {
  workerId: string;
  leaseDurationMs: number;
  now?: () => Date;
}

/**
 * Reivindica o direito de processar `notificacao` de forma segura contra
 * restart e contra dois workers concorrentes.
 *
 * - Se já existe um registro `ENVIADO`, nunca reclama de novo (garante que
 *   o restart do container, cujo primeiro snapshot do listener redelivera
 *   tudo como "added", não reenvia nada).
 * - Se existe um `PROCESSANDO` com lease ainda válida (`leaseExpiraEm` no
 *   futuro), outro worker está de fato processando agora — não reclama.
 * - Se existe um `PROCESSANDO` com lease vencida (o worker anterior
 *   provavelmente morreu no meio do envio), a lease é retomada com
 *   segurança: reclama de novo, incrementa `tentativas`, atualiza
 *   `workerId`/`processandoDesde`/`leaseExpiraEm`.
 * - `PENDENTE`/`ERRO_RETRY` sempre podem ser reclamados.
 *
 * A leitura+decisão+escrita acontece dentro de uma única transação do
 * Firestore, então duas chamadas concorrentes para o mesmo
 * `notificacao.id` nunca reclamam as duas ao mesmo tempo.
 */
export async function claim(
  db: Firestore,
  notificacao: NotificacaoTroca,
  options: ClaimOptions,
): Promise<ClaimResult> {
  const now = options.now ?? (() => new Date());
  const ref = db.collection(COLECAO).doc(notificacao.id);

  return db.runTransaction(async (tx: Transaction) => {
    const snapshot = await tx.get(ref);
    const nowIso = now().toISOString();
    const leaseExpiraEm = new Date(now().getTime() + options.leaseDurationMs).toISOString();

    if (!snapshot.exists) {
      const entrega: PushEntrega = {
        notificacaoId: notificacao.id,
        trocaId: notificacao.trocaId,
        tipo: notificacao.tipo,
        destinatarioLogin: notificacao.destinatarioLogin,
        status: 'PROCESSANDO',
        workerId: options.workerId,
        processandoDesde: nowIso,
        leaseExpiraEm,
        tentativas: 1,
        primeiraTentativaEm: nowIso,
        ultimaTentativaEm: nowIso,
        enviadoEm: null,
        successCount: 0,
        failureCount: 0,
        erroCodigo: null,
        environment: 'STAGING',
      };
      tx.set(ref, entrega);
      return { claimed: true };
    }

    const atual = snapshot.data() as PushEntrega;

    if (atual.status === 'ENVIADO') {
      return { claimed: false, reason: 'ja-enviado' };
    }

    if (atual.status === 'PROCESSANDO' && atual.leaseExpiraEm !== null && atual.leaseExpiraEm > nowIso) {
      return { claimed: false, reason: 'lease-em-vigor' };
    }

    tx.update(ref, {
      status: 'PROCESSANDO',
      workerId: options.workerId,
      processandoDesde: nowIso,
      leaseExpiraEm,
      tentativas: atual.tentativas + 1,
      ultimaTentativaEm: nowIso,
    });
    return { claimed: true };
  });
}

export async function markSemDispositivo(db: Firestore, notificacaoId: string, now: () => Date = () => new Date()): Promise<void> {
  await db.collection(COLECAO).doc(notificacaoId).update({
    status: 'SEM_DISPOSITIVO',
    workerId: null,
    processandoDesde: null,
    leaseExpiraEm: null,
    ultimaTentativaEm: now().toISOString(),
  });
}

export interface FinalizeEnvioOptions {
  successCount: number;
  failureCount: number;
  status: 'ENVIADO' | 'ERRO_RETRY' | 'ERRO_FINAL';
  erroCodigo: string | null;
  now?: () => Date;
}

export async function finalizeEnvio(
  db: Firestore,
  notificacaoId: string,
  options: FinalizeEnvioOptions,
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const nowIso = now().toISOString();
  await db.collection(COLECAO).doc(notificacaoId).update({
    status: options.status,
    workerId: null,
    processandoDesde: null,
    leaseExpiraEm: null,
    ultimaTentativaEm: nowIso,
    enviadoEm: options.status === 'ENVIADO' ? nowIso : null,
    successCount: options.successCount,
    failureCount: options.failureCount,
    erroCodigo: options.erroCodigo,
  });
}
