import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

import type { PushWorkerConfig } from './config.js';
import { deactivateDevice, listActiveDevices } from './deviceRepository.js';
import { CODIGOS_FID_INVALIDO, sendToDevices } from './pushSender.js';

/**
 * SINOS-NO-CELULAR-1 — os outros sinos do App também viram push:
 *  - trocas de Plantão (notificacoesTrocaPlantao/{id}, destinatarioLogin);
 *  - escala publicada/alterada (eventosEscala/{id}, por usuário).
 * Mesmas proteções do push de trocas 6x1: textos FIXOS e genéricos (nada de
 * nome na tela bloqueada), uma vez por aviso (reserva atômica em
 * pushSinosEnviados), só depois de PUSH_ACTIVATED_AT, respeita PUSH_ENABLED,
 * aviso de troca já lido no App não vira push.
 */

const TEXTOS_TROCA_PLANTAO: Record<string, { titulo: string; corpo: string }> = {
  TROCA_PLANTAO_SOLICITADA: { titulo: 'Nova solicitação de troca de plantão', corpo: 'Você recebeu uma solicitação de troca de plantão.' },
  TROCA_PLANTAO_RECUSADA_USUARIO: { titulo: 'Troca de plantão recusada', corpo: 'Sua solicitação de troca de plantão foi recusada.' },
  TROCA_PLANTAO_ACEITA_AGUARDANDO_GESTOR: { titulo: 'Troca de plantão aceita', corpo: 'Sua solicitação foi aceita e aguarda o gestor.' },
  TROCA_PLANTAO_AGUARDANDO_APROVACAO_GESTOR: { titulo: 'Troca de plantão aguardando sua aprovação', corpo: 'Uma troca de plantão precisa da sua aprovação.' },
  TROCA_PLANTAO_RECUSADA_GESTOR: { titulo: 'Troca de plantão recusada pelo gestor', corpo: 'O gestor recusou a troca de plantão.' },
  TROCA_PLANTAO_APROVADA: { titulo: 'Troca de plantão aprovada', corpo: 'Sua troca de plantão foi aprovada. Abra o app para ver.' },
  TROCA_PLANTAO_CANCELADA: { titulo: 'Troca de plantão cancelada', corpo: 'A solicitação de troca de plantão foi cancelada.' },
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function textoTrocaPlantao(tipo: unknown): { titulo: string; corpo: string } | null {
  return typeof tipo === 'string' ? TEXTOS_TROCA_PLANTAO[tipo] ?? null : null;
}

/** Texto do aviso de escala: publicada (sem alterações) ou alterada. SEED nunca vira push. */
export function textoEventoEscala(evento: { tipo?: unknown; competencia?: unknown; alteracoes?: unknown }): { titulo: string; corpo: string } | null {
  if (evento.tipo === 'SEED') return null;
  const [, mes] = typeof evento.competencia === 'string' ? evento.competencia.split('-') : [];
  const nomeMes = MESES[Number(mes) - 1];
  const quantidade = Array.isArray(evento.alteracoes) ? evento.alteracoes.length : 0;
  if (quantidade > 0) {
    return {
      titulo: 'Sua escala mudou',
      corpo: `${quantidade} ${quantidade === 1 ? 'dia da sua escala foi alterado' : 'dias da sua escala foram alterados'}${nomeMes ? ` em ${nomeMes}` : ''}. Abra o app para ver.`,
    };
  }
  return {
    titulo: 'Escala publicada',
    corpo: nomeMes ? `Sua escala de ${nomeMes} foi publicada. Abra o app para ver.` : 'Sua escala foi publicada. Abra o app para ver.',
  };
}

interface Logger {
  info(mensagem: string, meta?: Record<string, unknown>): void;
  error(mensagem: string, meta?: Record<string, unknown>): void;
}

const logConsole: Logger = {
  info: (mensagem, meta) => console.info(mensagem, meta ?? {}),
  error: (mensagem, meta) => console.error(mensagem, meta ?? {}),
};

const CODIGO_JA_EXISTE = 6;
const TTL_MS = 24 * 60 * 60 * 1000;

export function iniciarOutrosSinos({
  db,
  messaging,
  config,
  logger = logConsole,
}: {
  db: Firestore;
  messaging: Messaging;
  config: PushWorkerConfig;
  logger?: Logger;
}): () => void {
  const loginPorUid = new Map<string, string>();

  async function enviarUmaVez(id: string, login: string, tipo: string, texto: { titulo: string; corpo: string }) {
    if (!config.pushEnabled || !login) return;
    try {
      await db.collection('pushSinosEnviados').doc(id).create({ login, tipo, status: 'ENVIANDO', criadoEm: new Date().toISOString() });
    } catch (erro) {
      if ((erro as { code?: number }).code === CODIGO_JA_EXISTE) return;
      throw erro;
    }
    const dispositivos = await listActiveDevices(db, login);
    if (dispositivos.length === 0) {
      await db.collection('pushSinosEnviados').doc(id).set({ status: 'SEM_DISPOSITIVO' }, { merge: true });
      return;
    }
    const resultado = await sendToDevices(messaging, {
      fids: dispositivos.map((dispositivo) => dispositivo.fid),
      data: { eventId: id, tipo, route: 'hoje', titulo: texto.titulo, corpo: texto.corpo },
      android: { priority: 'high', ttl: TTL_MS },
    });
    for (const [indice, resposta] of resultado.responses.entries()) {
      if (!resposta.success && resposta.errorCode && CODIGOS_FID_INVALIDO.has(resposta.errorCode)) {
        const dispositivo = dispositivos[indice];
        if (dispositivo) await deactivateDevice(db, dispositivo.deviceId);
      }
    }
    await db.collection('pushSinosEnviados').doc(id).set({
      status: resultado.successCount > 0 ? 'ENVIADO' : 'FALHOU',
      successCount: resultado.successCount,
      failureCount: resultado.failureCount,
    }, { merge: true });
    logger.info('push de sino processado', { login, tipo, enviado: resultado.successCount > 0 });
  }

  async function loginDoUid(uid: string): Promise<string | null> {
    const conhecido = loginPorUid.get(uid);
    if (conhecido) return conhecido;
    const resultado = await db.collection('usuarios').where('uid', '==', uid).limit(1).get();
    const login = resultado.docs[0]?.id ?? null;
    if (login) loginPorUid.set(uid, login);
    return login;
  }

  const pararTrocasPlantao = db.collection('notificacoesTrocaPlantao')
    .where('criadoEm', '>=', config.pushActivatedAt)
    .onSnapshot((snapshot) => {
      for (const mudanca of snapshot.docChanges()) {
        if (mudanca.type !== 'added') continue;
        const dados = mudanca.doc.data() as { destinatarioLogin?: string; tipo?: string; lidaEm?: string | null };
        const texto = textoTrocaPlantao(dados.tipo);
        if (!texto || dados.lidaEm || !dados.destinatarioLogin) continue;
        void enviarUmaVez(`TP_${mudanca.doc.id}`, dados.destinatarioLogin, String(dados.tipo), texto)
          .catch((erro) => logger.error('push de troca de plantão falhou', { erro: erro instanceof Error ? erro.message : String(erro) }));
      }
    }, (erro) => logger.error('listener de notificacoesTrocaPlantao falhou', { erro: erro.message }));

  const pararEventosEscala = db.collection('eventosEscala')
    .where('publicadoEm', '>=', config.pushActivatedAt)
    .onSnapshot((snapshot) => {
      for (const mudanca of snapshot.docChanges()) {
        if (mudanca.type !== 'added') continue;
        const dados = mudanca.doc.data() as { usuarioUid?: string; tipo?: string; competencia?: string; alteracoes?: Array<{ login?: string }> };
        const texto = textoEventoEscala(dados);
        if (!texto) continue;
        void (async () => {
          const login = dados.alteracoes?.find((alteracao) => alteracao.login)?.login
            ?? (dados.usuarioUid ? await loginDoUid(dados.usuarioUid) : null);
          if (login) await enviarUmaVez(`EE_${mudanca.doc.id}`, login, 'ESCALA_PUBLICADA', texto);
        })().catch((erro) => logger.error('push de escala falhou', { erro: erro instanceof Error ? erro.message : String(erro) }));
      }
    }, (erro) => logger.error('listener de eventosEscala falhou', { erro: erro.message }));

  logger.info('push de trocas de plantão e escala publicada iniciado', { pushEnabled: config.pushEnabled });
  return () => {
    pararTrocasPlantao();
    pararEventosEscala();
  };
}
