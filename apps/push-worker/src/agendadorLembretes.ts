import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

import {
  agoraLocal,
  enviarAlertaUmaVez,
  minutosLocais,
  somarDias,
  JANELA_ATRASO_MINUTOS,
  type AlertaAgendado,
} from './alertasTurno.js';
import type { PushWorkerConfig } from './config.js';
import { deactivateDevice, listActiveDevices } from './deviceRepository.js';
import { CODIGOS_FID_INVALIDO, sendToDevices } from './pushSender.js';

/**
 * LEMBRETE-ALARME-1 — lembretes da Agenda viram push na hora escolhida
 * (`alertasAntecedenciaMin`: minutos antes; dia inteiro conta a partir das
 * 08:00). Pessoais: usuarios/{login}/lembretes; atribuídos pelo gestor:
 * lembretesAtribuidos (status ATIVO, para destinatarioLogin).
 * Mesmas garantias dos avisos do turno: uma vez cada (o horário faz parte da
 * identidade — mudou o horário, sai o aviso novo), janela de 5 min,
 * respeita PUSH_ENABLED. Lembrete atribuído novo também avisa na hora.
 */
export const HORARIO_BASE_DIA_INTEIRO = '08:00';
const INTERVALO_MS = 60_000;
const VALIDADE_CACHE_MS = 5 * 60_000;
const TTL_MS = 30 * 60_000;
const CODIGO_JA_EXISTE = 6;

export interface LembreteParaAviso {
  lembreteId: string;
  login: string;
  tipo: 'PESSOAL' | 'ATRIBUIDO';
  titulo: string;
  data: string;
  diaInteiro: boolean;
  horaInicio: string | null;
  alertasAntecedenciaMin: number[];
}

function rotuloAntecedencia(minutos: number): string {
  if (minutos === 0) return '';
  if (minutos === 1440) return ' (amanhã)';
  if (minutos % 60 === 0) return ` (em ${minutos / 60} h)`;
  return ` (em ${minutos} min)`;
}

/** Avisos de um lembrete (um por antecedência escolhida). */
export function avisosDoLembrete(lembrete: LembreteParaAviso): AlertaAgendado[] {
  const hora = lembrete.diaInteiro ? HORARIO_BASE_DIA_INTEIRO : lembrete.horaInicio;
  if (!hora || lembrete.alertasAntecedenciaMin.length === 0) return [];
  const base = minutosLocais(`${lembrete.data}T${hora}`);
  return lembrete.alertasAntecedenciaMin.map((minutos) => {
    const quando = new Date((base - minutos) * 60_000).toISOString().slice(0, 16);
    const titulo = `⏰ ${lembrete.titulo}`.slice(0, 120);
    const corpo = lembrete.diaInteiro
      ? (minutos >= 1440 ? 'Amanhã · o dia todo.' : 'Hoje · o dia todo.')
      : `${minutos >= 1440 ? 'Amanhã' : 'Hoje'} às ${hora}${rotuloAntecedencia(minutos)}.`;
    return {
      tipo: 'ALERTA_TURNO_ANTES' as const, // só para o formato; o tipo enviado é LEMBRETE_ALARME
      data: lembrete.data,
      quando,
      titulo,
      corpo,
    };
  });
}

/** Avisos que venceram agora (até 5 min de atraso). */
export function avisosDevidos(avisos: readonly AlertaAgendado[], agora: string): AlertaAgendado[] {
  const agoraMin = minutosLocais(agora);
  return avisos.filter((aviso) => {
    const quando = minutosLocais(aviso.quando);
    return quando <= agoraMin && quando > agoraMin - JANELA_ATRASO_MINUTOS;
  });
}

function lerLembrete(lembreteId: string, login: string, tipo: 'PESSOAL' | 'ATRIBUIDO', dados: Record<string, unknown>): LembreteParaAviso | null {
  const horario = (dados.horario ?? {}) as { diaInteiro?: unknown; horaInicio?: unknown };
  const alertas = Array.isArray(dados.alertasAntecedenciaMin)
    ? dados.alertasAntecedenciaMin.filter((valor): valor is number => typeof valor === 'number' && valor >= 0)
    : [];
  if (typeof dados.data !== 'string' || typeof dados.titulo !== 'string' || alertas.length === 0) return null;
  return {
    lembreteId,
    login,
    tipo,
    titulo: dados.titulo,
    data: dados.data,
    diaInteiro: horario.diaInteiro === true,
    horaInicio: typeof horario.horaInicio === 'string' ? horario.horaInicio : null,
    alertasAntecedenciaMin: alertas,
  };
}

export function iniciarAgendadorLembretes({
  db,
  messaging,
  config,
}: {
  db: Firestore;
  messaging: Messaging;
  config: PushWorkerConfig;
}): () => void {
  let cache: { em: number; chave: string; lembretes: LembreteParaAviso[] } | null = null;
  let rodando = false;

  async function carregar(hoje: string, amanha: string): Promise<LembreteParaAviso[]> {
    const chave = `${hoje}|${amanha}`;
    if (cache && cache.chave === chave && Date.now() - cache.em < VALIDADE_CACHE_MS) return cache.lembretes;
    const [pessoais, atribuidos] = await Promise.all([
      db.collectionGroup('lembretes').where('data', 'in', [hoje, amanha]).get(),
      db.collection('lembretesAtribuidos').where('data', 'in', [hoje, amanha]).get(),
    ]);
    const lembretes: LembreteParaAviso[] = [];
    for (const doc of pessoais.docs) {
      const dono = doc.ref.parent.parent;
      if (!dono || dono.parent.id !== 'usuarios') continue;
      const lido = lerLembrete(doc.id, dono.id, 'PESSOAL', doc.data());
      if (lido) lembretes.push(lido);
    }
    for (const doc of atribuidos.docs) {
      const dados = doc.data();
      if (dados.status !== 'ATIVO' || typeof dados.destinatarioLogin !== 'string') continue;
      const lido = lerLembrete(doc.id, dados.destinatarioLogin, 'ATRIBUIDO', dados);
      if (lido) lembretes.push(lido);
    }
    cache = { em: Date.now(), chave, lembretes };
    return lembretes;
  }

  const deps = {
    reservar: async (id: string, dados: Record<string, unknown>) => {
      try {
        await db.collection('pushSinosEnviados').doc(id).create(dados);
        return true;
      } catch (erro) {
        if ((erro as { code?: number }).code === CODIGO_JA_EXISTE) return false;
        throw erro;
      }
    },
    listarDispositivos: (login: string) => listActiveDevices(db, login),
    enviar: (mensagem: { fids: string[]; data: Record<string, string> }) =>
      sendToDevices(messaging, { ...mensagem, data: { ...mensagem.data, tipo: 'LEMBRETE_ALARME', route: 'agenda' }, android: { priority: 'high', ttl: TTL_MS } }),
    desativarDispositivo: (deviceId: string) => deactivateDevice(db, deviceId),
    finalizar: async (id: string, dados: Record<string, unknown>) => {
      await db.collection('pushSinosEnviados').doc(id).set(dados, { merge: true });
    },
    codigosFidInvalido: CODIGOS_FID_INVALIDO,
  };

  async function verificar(): Promise<void> {
    if (rodando || !config.pushEnabled) return;
    rodando = true;
    try {
      const agora = agoraLocal();
      const hoje = agora.slice(0, 10);
      const lembretes = await carregar(hoje, somarDias(hoje, 1));
      for (const lembrete of lembretes) {
        for (const aviso of avisosDevidos(avisosDoLembrete(lembrete), agora)) {
          // O id do aviso leva tipo+lembrete+horário: mudou o horário, é outro aviso.
          const avisoComId = { ...aviso, data: `${lembrete.tipo}_${lembrete.lembreteId}` };
          const resultado = await enviarAlertaUmaVez(`LB_${lembrete.login}`, avisoComId, deps, new Date().toISOString());
          if (resultado !== 'ja-enviado') console.info('aviso de lembrete processado', { login: lembrete.login, resultado });
        }
      }
    } catch (erro) {
      console.error('agendador de lembretes: falha', { erro: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      rodando = false;
    }
  }

  // Lembrete atribuído pelo gestor: avisa na hora em que é criado.
  const pararAtribuidos = db.collection('lembretesAtribuidos')
    .where('criadoEm', '>=', config.pushActivatedAt)
    .onSnapshot((snapshot) => {
      for (const mudanca of snapshot.docChanges()) {
        if (mudanca.type !== 'added' || !config.pushEnabled) continue;
        const dados = mudanca.doc.data();
        if (dados.status !== 'ATIVO' || typeof dados.destinatarioLogin !== 'string') continue;
        const aviso: AlertaAgendado = {
          tipo: 'ALERTA_TURNO_ANTES',
          data: `NOVO_${mudanca.doc.id}`,
          quando: 'novo',
          titulo: 'Novo lembrete do seu gestor',
          corpo: 'Abra a Agenda para ver o lembrete.',
        };
        void enviarAlertaUmaVez(`LB_${dados.destinatarioLogin}`, aviso, {
          ...deps,
          enviar: (mensagem) => sendToDevices(messaging, { ...mensagem, data: { ...mensagem.data, tipo: 'LEMBRETE_ATRIBUIDO', route: 'agenda' }, android: { priority: 'high', ttl: TTL_MS } }),
        }, new Date().toISOString()).catch((erro) => console.error('aviso de lembrete atribuído falhou', { erro: erro instanceof Error ? erro.message : String(erro) }));
      }
    }, (erro) => console.error('listener de lembretesAtribuidos falhou', { erro: erro.message }));

  const intervalo = setInterval(() => void verificar(), INTERVALO_MS);
  void verificar();
  console.info('agendador de lembretes iniciado', { pushEnabled: config.pushEnabled });
  return () => {
    clearInterval(intervalo);
    pararAtribuidos();
  };
}
