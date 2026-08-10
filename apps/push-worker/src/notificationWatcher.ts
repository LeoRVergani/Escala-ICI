import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { handleNotificacao, type Logger, type ResultadoProcessamento } from './deliveryOrchestrator.js';
import type { PushWorkerConfig } from './config.js';
import type { NotificacaoTroca } from './types.js';

const COLECAO = 'notificacoesTroca';

export interface WatcherDeps {
  db: Firestore;
  messaging: Messaging;
  config: PushWorkerConfig;
  logger?: Logger;
  onResultado?: (notificacao: NotificacaoTroca, resultado: ResultadoProcessamento) => void;
  onErro?: (erro: unknown) => void;
}

/**
 * Assina `notificacoesTroca` já filtrando no servidor por
 * `criadoEm >= PUSH_ACTIVATED_AT` — o corte de ativação não depende de
 * "ignorar o primeiro snapshot" (o primeiro snapshot de um listener novo
 * sempre redelivera tudo que já casa com a consulta como "added"): como a
 * própria consulta já exclui qualquer documento anterior ao corte, todo
 * "added" que chega — no primeiro snapshot ou depois de um restart — já é
 * elegível por construção. A idempotência de fato (não duplicar em caso de
 * redelivery) é garantida por `deliveryRepository.claim`, não por lógica
 * de "primeira vez visto" aqui.
 *
 * `criadoEm` é sempre gerado como `new Date().toISOString()` no domínio
 * (lib/firebase/trocasRepository.ts), então a comparação lexicográfica de
 * string usada pela consulta (`>=`) é equivalente à comparação temporal.
 */
export function iniciarWatcher(deps: WatcherDeps): () => void {
  const { db, config, logger } = deps;

  const query = db.collection(COLECAO).where('criadoEm', '>=', config.pushActivatedAt);

  const unsubscribe = query.onSnapshot(
    (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          continue;
        }
        const notificacao = change.doc.data() as NotificacaoTroca;
        handleNotificacao(notificacao, {
          db: deps.db,
          messaging: deps.messaging,
          config: deps.config,
          ...(logger ? { logger } : {}),
        })
          .then((resultado) => deps.onResultado?.(notificacao, resultado))
          .catch((erro: unknown) => {
            logger?.error('falha ao processar notificacaoTroca', { eventId: notificacao.id, erro: erro instanceof Error ? erro.message : String(erro) });
            deps.onErro?.(erro);
          });
      }
    },
    (erro) => {
      logger?.error('erro no listener de notificacoesTroca', { erro: erro instanceof Error ? erro.message : String(erro) });
      deps.onErro?.(erro);
    },
  );

  return unsubscribe;
}
