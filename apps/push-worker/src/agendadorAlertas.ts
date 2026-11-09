import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

import {
  agoraLocal,
  alertasDevidos,
  alertasDoTurno,
  CATALOGO_PADRAO,
  competenciaDaData,
  enviarAlertaUmaVez,
  resolverTurnoDoDia,
  somarDias,
  type DiaMin,
  type PreferenciasAlertas,
  type TipoTurnoMin,
} from './alertasTurno.js';
import type { PushWorkerConfig } from './config.js';
import { deactivateDevice, listActiveDevices } from './deviceRepository.js';
import { CODIGOS_FID_INVALIDO, sendToDevices } from './pushSender.js';

/**
 * ALERTAS-TURNO-2 — laço do agendador dos "Avisos do turno".
 * Leituras econômicas: preferências por listener (só relê quando alguém
 * muda), escala publicada e catálogo em cache por alguns minutos.
 */
const INTERVALO_MS = 60_000;
const VALIDADE_ESCALA_MS = 10 * 60_000;
const VALIDADE_CATALOGO_MS = 60 * 60_000;
const TTL_ALERTA_MS = 30 * 60_000;
const CODIGO_JA_EXISTE = 6; // gRPC ALREADY_EXISTS (create em documento existente)

interface Logger {
  info(mensagem: string, meta?: Record<string, unknown>): void;
  warn(mensagem: string, meta?: Record<string, unknown>): void;
  error(mensagem: string, meta?: Record<string, unknown>): void;
}

const logConsole: Logger = {
  info: (mensagem, meta) => console.info(mensagem, meta ?? {}),
  warn: (mensagem, meta) => console.warn(mensagem, meta ?? {}),
  error: (mensagem, meta) => console.error(mensagem, meta ?? {}),
};

function algumAtivo(preferencias: PreferenciasAlertas): boolean {
  return preferencias.avisoAntes?.ativo || preferencias.pontoEntrada?.ativo
    || preferencias.pontoSaida?.ativo || preferencias.intervalo?.ativo;
}

export function iniciarAgendadorAlertas({
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
  const preferencias = new Map<string, PreferenciasAlertas>();
  const escalas = new Map<string, { em: number; dias: Record<string, DiaMin>; equipeId: string | null }>();
  const catalogos = new Map<string, { em: number; catalogo: Record<string, TipoTurnoMin> }>();
  let rodando = false;

  const pararOuvinte = db.collection('preferenciasAlertasTurno').onSnapshot(
    (snapshot) => {
      for (const mudanca of snapshot.docChanges()) {
        if (mudanca.type === 'removed') {
          preferencias.delete(mudanca.doc.id);
          continue;
        }
        preferencias.set(mudanca.doc.id, { ...(mudanca.doc.data() as PreferenciasAlertas), login: mudanca.doc.id });
        escalas.delete(mudanca.doc.id);
      }
    },
    (erro) => logger.error('agendador de avisos: falha no listener de preferências', { erro: erro.message }),
  );

  async function escalaDe(login: string, datas: string[], agora: number) {
    const cache = escalas.get(login);
    if (cache && agora - cache.em < VALIDADE_ESCALA_MS) return cache;
    const competencias = [...new Set(datas.map(competenciaDaData))];
    const resultado = await db.collection('turnosMes')
      .where('login', '==', login)
      .where('status', '==', 'PUBLICADA')
      .where('competencia', 'in', competencias)
      .get();
    const dias: Record<string, DiaMin> = {};
    let equipeId: string | null = null;
    for (const doc of resultado.docs) {
      const dados = doc.data() as { dias?: Record<string, DiaMin>; equipeId?: string };
      Object.assign(dias, dados.dias ?? {});
      equipeId = dados.equipeId ?? equipeId;
    }
    const novo = { em: agora, dias, equipeId };
    escalas.set(login, novo);
    return novo;
  }

  async function catalogoDe(equipeId: string | null, agora: number) {
    if (!equipeId) return CATALOGO_PADRAO;
    const cache = catalogos.get(equipeId);
    if (cache && agora - cache.em < VALIDADE_CATALOGO_MS) return cache.catalogo;
    const resultado = await db.collection('tiposTurno').where('equipeId', '==', equipeId).get();
    // Mesmo comportamento do App: sem catálogo próprio, usa o padrão.
    const catalogo: Record<string, TipoTurnoMin> = resultado.empty
      ? { ...CATALOGO_PADRAO }
      : Object.fromEntries(resultado.docs.map((doc) => {
        const dados = doc.data() as TipoTurnoMin & { codigo?: string };
        return [String(dados.codigo ?? doc.id.split('_').at(-1) ?? ''), dados];
      }));
    catalogos.set(equipeId, { em: agora, catalogo });
    return catalogo;
  }

  const deps = {
    reservar: async (id: string, dados: Record<string, unknown>) => {
      try {
        await db.collection('alertasTurnoEnviados').doc(id).create(dados);
        return true;
      } catch (erro) {
        if ((erro as { code?: number }).code === CODIGO_JA_EXISTE) return false;
        throw erro;
      }
    },
    listarDispositivos: (login: string) => listActiveDevices(db, login),
    enviar: (mensagem: { fids: string[]; data: Record<string, string> }) =>
      sendToDevices(messaging, { ...mensagem, android: { priority: 'high', ttl: TTL_ALERTA_MS } }),
    desativarDispositivo: (deviceId: string) => deactivateDevice(db, deviceId),
    finalizar: async (id: string, dados: Record<string, unknown>) => {
      await db.collection('alertasTurnoEnviados').doc(id).set(dados, { merge: true });
    },
    codigosFidInvalido: CODIGOS_FID_INVALIDO,
  };

  async function verificar(): Promise<void> {
    if (rodando || !config.pushEnabled) return;
    rodando = true;
    try {
      const agoraMs = Date.now();
      const agora = agoraLocal(new Date(agoraMs));
      const hoje = agora.slice(0, 10);
      const ontem = somarDias(hoje, -1);
      for (const [login, pref] of preferencias) {
        if (!algumAtivo(pref)) continue;
        try {
          const escala = await escalaDe(login, [ontem, hoje], agoraMs);
          const catalogo = await catalogoDe(escala.equipeId, agoraMs);
          const alertas = [ontem, hoje].flatMap((data) => alertasDoTurno(pref, data, resolverTurnoDoDia(escala.dias, catalogo, data)));
          for (const alerta of alertasDevidos(alertas, agora)) {
            const resultado = await enviarAlertaUmaVez(login, alerta, deps, new Date(agoraMs).toISOString());
            if (resultado !== 'ja-enviado') {
              logger.info('aviso do turno processado', { login, tipo: alerta.tipo, data: alerta.data, resultado });
            }
          }
        } catch (erro) {
          logger.error('agendador de avisos: falha ao processar', { login, erro: erro instanceof Error ? erro.message : String(erro) });
        }
      }
    } finally {
      rodando = false;
    }
  }

  const intervalo = setInterval(() => void verificar(), INTERVALO_MS);
  void verificar();
  logger.info('agendador de avisos do turno iniciado', { pushEnabled: config.pushEnabled });

  return () => {
    clearInterval(intervalo);
    pararOuvinte();
  };
}
