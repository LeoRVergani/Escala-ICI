import { doc, getDoc, setDoc } from 'firebase/firestore';
import { preferenciasAlertasTurnoPadrao, type PreferenciasAlertasTurno } from '@escala-ici/contrato';

import { exigirFirebase } from './shared';

/**
 * ALERTAS-TURNO-1 — preferências dos avisos do turno da própria pessoa
 * (preferenciasAlertasTurno/{login}). As Rules só deixam o dono ler/gravar.
 * (Não confundir com os Lembretes da Agenda — compromissos pessoais.)
 */
export async function obterPreferenciasAlertasTurno(login: string): Promise<PreferenciasAlertasTurno> {
  const { db } = exigirFirebase();
  const snapshot = await getDoc(doc(db, 'preferenciasAlertasTurno', login));
  const padrao = preferenciasAlertasTurnoPadrao(login);
  if (!snapshot.exists()) return padrao;
  const dados = snapshot.data() as Partial<PreferenciasAlertasTurno>;
  return {
    ...padrao,
    ...dados,
    avisoAntes: { ...padrao.avisoAntes, ...dados.avisoAntes },
    pontoEntrada: { ...padrao.pontoEntrada, ...dados.pontoEntrada },
    pontoSaida: { ...padrao.pontoSaida, ...dados.pontoSaida },
    intervalo: { ...padrao.intervalo, ...dados.intervalo, horarios: { ...dados.intervalo?.horarios } },
    folga: { ...padrao.folga, ...dados.folga },
    login,
  };
}

export async function salvarPreferenciasAlertasTurno(preferencias: PreferenciasAlertasTurno): Promise<void> {
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'preferenciasAlertasTurno', preferencias.login), {
    login: preferencias.login,
    avisoAntes: { ativo: preferencias.avisoAntes.ativo, minutos: preferencias.avisoAntes.minutos },
    pontoEntrada: { ativo: preferencias.pontoEntrada.ativo },
    pontoSaida: { ativo: preferencias.pontoSaida.ativo },
    intervalo: {
      ativo: preferencias.intervalo.ativo,
      duracaoMinutos: preferencias.intervalo.duracaoMinutos,
      horarios: preferencias.intervalo.horarios,
    },
    folga: { vespera: preferencias.folga.vespera, dia: preferencias.folga.dia },
    atualizadoEm: new Date().toISOString(),
  });
}
