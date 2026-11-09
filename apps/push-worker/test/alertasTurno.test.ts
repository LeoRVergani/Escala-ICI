import { CATALOGO_SOC, resolverJornadaDia, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { describe, expect, it } from 'vitest';

import {
  agoraLocal,
  alertasDevidos,
  alertasDoTurno,
  CATALOGO_PADRAO,
  competenciaDaData,
  enviarAlertaUmaVez,
  resolverTurnoDoDia,
  type DependenciasEnvio,
  type PreferenciasAlertas,
} from '../src/alertasTurno.js';

const tudoLigado: PreferenciasAlertas = {
  login: 'ana',
  avisoAntes: { ativo: true, minutos: 60 },
  pontoEntrada: { ativo: true },
  pontoSaida: { ativo: true },
  intervalo: { ativo: true, duracaoMinutos: 15, horarios: { M: '10:00', N: '22:00', MD: '04:00' } },
};

describe('ALERTAS-TURNO-2 — paridade com o contrato (a cópia não pode divergir da original)', () => {
  it('catálogo padrão igual ao CATALOGO_SOC', () => {
    for (const [codigo, tipo] of Object.entries(CATALOGO_SOC)) {
      const copia = CATALOGO_PADRAO[codigo];
      expect(copia, codigo).toBeDefined();
      expect({ categoria: copia?.categoria, horaInicio: copia?.horaInicio, horaFim: copia?.horaFim, duracaoMinutos: copia?.duracaoMinutos, viraDia: copia?.viraDia, descricao: copia?.descricao })
        .toEqual({ categoria: tipo.categoria, horaInicio: tipo.horaInicio, horaFim: tipo.horaFim, duracaoMinutos: tipo.duracaoMinutos, viraDia: tipo.viraDia, descricao: tipo.descricao });
    }
    expect(Object.keys(CATALOGO_PADRAO).sort()).toEqual(Object.keys(CATALOGO_SOC).sort());
  });

  it('resolverTurnoDoDia == resolverJornadaDia em todos os códigos, HE com turno e horário próprio', () => {
    const casos: Dia[] = [
      ...Object.keys(CATALOGO_SOC).map((c) => ({ c }) as Dia),
      { c: 'HE', t: 'T', i: '13:00', f: '19:00', vd: false } as Dia,
      { c: 'HE', t: 'N' } as Dia,
      { c: 'M', i: '08:00', f: '14:00', m: 360 } as Dia,
    ];
    casos.forEach((dia, indice) => {
      const data = `2026-11-${String(indice + 1).padStart(2, '0')}`;
      const documento = { dias: { [data]: dia } } as unknown as TurnosMes;
      const original = resolverJornadaDia(documento, CATALOGO_SOC, data);
      const copia = resolverTurnoDoDia({ [data]: dia }, CATALOGO_PADRAO, data);
      expect({ trabalha: copia.trabalha, inicio: copia.inicio, fim: copia.fim, periodo: copia.periodo, viraDia: copia.viraDia, descricao: copia.descricao }, JSON.stringify(dia))
        .toEqual({ trabalha: original.trabalha, inicio: original.inicio, fim: original.fim, periodo: original.periodo, viraDia: original.viraDia, descricao: original.descricao });
    });
  });
});

describe('ALERTAS-TURNO-2 — agenda dos avisos', () => {
  it('turno da manhã: 1 h antes, entrada, intervalo início/fim e saída nos horários certos', () => {
    const turno = resolverTurnoDoDia({ '2026-11-09': { c: 'M' } }, CATALOGO_PADRAO, '2026-11-09');
    const alertas = alertasDoTurno(tudoLigado, '2026-11-09', turno);
    expect(alertas.map((a) => `${a.tipo}@${a.quando}`)).toEqual([
      'ALERTA_TURNO_ANTES@2026-11-09T06:00',
      'ALERTA_TURNO_ENTRADA@2026-11-09T07:00',
      'ALERTA_TURNO_INTERVALO@2026-11-09T10:00',
      'ALERTA_TURNO_FIM_INTERVALO@2026-11-09T10:15',
      'ALERTA_TURNO_SAIDA@2026-11-09T13:00',
    ]);
    expect(alertas[0]?.corpo).toContain('começa em 1 h');
  });

  it('turno da noite: saída no dia seguinte; intervalo depois da meia-noite também', () => {
    const turno = resolverTurnoDoDia({ '2026-11-09': { c: 'N' } }, CATALOGO_PADRAO, '2026-11-09');
    const depoisDaMeiaNoite = { ...tudoLigado, intervalo: { ...tudoLigado.intervalo, horarios: { N: '00:30' } } };
    const alertas = alertasDoTurno(depoisDaMeiaNoite, '2026-11-09', turno);
    expect(alertas.find((a) => a.tipo === 'ALERTA_TURNO_SAIDA')?.quando).toBe('2026-11-10T01:00');
    expect(alertas.find((a) => a.tipo === 'ALERTA_TURNO_INTERVALO')?.quando).toBe('2026-11-10T00:30');
    expect(alertas.find((a) => a.tipo === 'ALERTA_TURNO_FIM_INTERVALO')?.quando).toBe('2026-11-10T00:45');
  });

  it('folga, férias e dia sem escala: nenhum aviso', () => {
    for (const c of ['DF', 'DU', 'X', 'BH', 'FOLGA']) {
      const turno = resolverTurnoDoDia({ '2026-11-09': { c } }, CATALOGO_PADRAO, '2026-11-09');
      expect(alertasDoTurno(tudoLigado, '2026-11-09', turno), c).toEqual([]);
    }
    expect(alertasDoTurno(tudoLigado, '2026-11-09', resolverTurnoDoDia({}, CATALOGO_PADRAO, '2026-11-09'))).toEqual([]);
  });

  it('hora extra com turno: usa o horário do turno real', () => {
    const turno = resolverTurnoDoDia({ '2026-11-15': { c: 'HE', t: 'T' } }, CATALOGO_PADRAO, '2026-11-15');
    const alertas = alertasDoTurno({ ...tudoLigado, intervalo: { ...tudoLigado.intervalo, horarios: { T: '16:00' } } }, '2026-11-15', turno);
    expect(alertas.find((a) => a.tipo === 'ALERTA_TURNO_ENTRADA')?.quando).toBe('2026-11-15T13:00');
    expect(alertas.find((a) => a.tipo === 'ALERTA_TURNO_INTERVALO')?.quando).toBe('2026-11-15T16:00');
  });

  it('intervalo fora do turno é ignorado; avisos desligados não entram', () => {
    const turno = resolverTurnoDoDia({ '2026-11-09': { c: 'M' } }, CATALOGO_PADRAO, '2026-11-09');
    const fora = { ...tudoLigado, intervalo: { ...tudoLigado.intervalo, horarios: { M: '15:00' } } };
    expect(alertasDoTurno(fora, '2026-11-09', turno).some((a) => a.tipo.includes('INTERVALO'))).toBe(false);
    const soEntrada = { ...tudoLigado, avisoAntes: { ativo: false, minutos: 60 }, pontoSaida: { ativo: false }, intervalo: { ...tudoLigado.intervalo, ativo: false } };
    expect(alertasDoTurno(soEntrada, '2026-11-09', turno).map((a) => a.tipo)).toEqual(['ALERTA_TURNO_ENTRADA']);
  });

  it('só vence dentro da janela de 5 minutos', () => {
    const turno = resolverTurnoDoDia({ '2026-11-09': { c: 'M' } }, CATALOGO_PADRAO, '2026-11-09');
    const alertas = alertasDoTurno(tudoLigado, '2026-11-09', turno);
    expect(alertasDevidos(alertas, '2026-11-09T06:59').map((a) => a.tipo)).toEqual([]);
    expect(alertasDevidos(alertas, '2026-11-09T07:00').map((a) => a.tipo)).toEqual(['ALERTA_TURNO_ENTRADA']);
    expect(alertasDevidos(alertas, '2026-11-09T07:04').map((a) => a.tipo)).toEqual(['ALERTA_TURNO_ENTRADA']);
    expect(alertasDevidos(alertas, '2026-11-09T07:05').map((a) => a.tipo)).toEqual([]);
  });

  it('competência (dia 26 vira o mês) e hora de Brasília', () => {
    expect(competenciaDaData('2026-11-25')).toBe('2026-11');
    expect(competenciaDaData('2026-11-26')).toBe('2026-12');
    expect(competenciaDaData('2026-12-26')).toBe('2027-01');
    expect(agoraLocal(new Date('2026-11-09T13:30:00Z'))).toBe('2026-11-09T10:30');
    expect(agoraLocal(new Date('2026-11-10T02:15:00Z'))).toBe('2026-11-09T23:15');
  });
});

describe('ALERTAS-TURNO-2 — envio uma única vez', () => {
  const alerta = { tipo: 'ALERTA_TURNO_ENTRADA' as const, data: '2026-11-09', quando: '2026-11-09T07:00', titulo: 'T', corpo: 'C' };
  function fakes(opcoes: { jaExiste?: boolean; dispositivos?: Array<{ deviceId: string; fid: string }>; invalido?: boolean } = {}) {
    const registro: Record<string, unknown>[] = [];
    const desativados: string[] = [];
    const enviados: unknown[] = [];
    const deps: DependenciasEnvio = {
      reservar: async () => !opcoes.jaExiste,
      listarDispositivos: async () => opcoes.dispositivos ?? [],
      enviar: async (mensagem) => {
        enviados.push(mensagem);
        return opcoes.invalido
          ? { successCount: 1, failureCount: 1, responses: [{ success: true, errorCode: null }, { success: false, errorCode: 'messaging/installation-id-not-registered' }] }
          : { successCount: 1, failureCount: 0, responses: [{ success: true, errorCode: null }] };
      },
      desativarDispositivo: async (id) => { desativados.push(id); },
      finalizar: async (_id, dados) => { registro.push(dados); },
      codigosFidInvalido: new Set(['messaging/installation-id-not-registered']),
    };
    return { deps, registro, desativados, enviados };
  }

  it('já reservado (enviado antes ou por outro ciclo): não envia de novo', async () => {
    const { deps, enviados } = fakes({ jaExiste: true, dispositivos: [{ deviceId: 'd1', fid: 'f1' }] });
    expect(await enviarAlertaUmaVez('ana', alerta, deps, '2026-11-09T10:00:00Z')).toBe('ja-enviado');
    expect(enviados).toHaveLength(0);
  });

  it('sem dispositivo: registra e não quebra', async () => {
    const { deps, registro } = fakes();
    expect(await enviarAlertaUmaVez('ana', alerta, deps, 'x')).toBe('sem-dispositivo');
    expect(registro[0]).toMatchObject({ status: 'SEM_DISPOSITIVO' });
  });

  it('envia com tipo ALERTA_TURNO_* e rota hoje; desativa dispositivo inválido', async () => {
    const { deps, registro, desativados, enviados } = fakes({ dispositivos: [{ deviceId: 'd1', fid: 'f1' }, { deviceId: 'd2', fid: 'f2' }], invalido: true });
    expect(await enviarAlertaUmaVez('ana', alerta, deps, 'x')).toBe('enviado');
    expect(enviados[0]).toMatchObject({ fids: ['f1', 'f2'], data: { tipo: 'ALERTA_TURNO_ENTRADA', route: 'hoje', eventId: 'ana_2026-11-09_ALERTA_TURNO_ENTRADA' } });
    expect(desativados).toEqual(['d2']);
    expect(registro[0]).toMatchObject({ status: 'ENVIADO', successCount: 1, failureCount: 1 });
  });
});
