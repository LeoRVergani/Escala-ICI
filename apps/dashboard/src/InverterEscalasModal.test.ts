import { CATALOGO_SOC, type Dia, type TurnosMes } from '@escala-ici/contrato';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { REGRAS_PADRAO } from '@/lib/regrasPadrao';
import { InverterEscalasModal } from './InverterEscalasModal';

/** INVERSAO-ESCALAS-1 — o que o coordenador vê ao abrir "Inverter escalas" (as escolhas e a prévia são testadas na lógica e no navegador). */
function documento(login: string, inicio: string, fim: string): TurnosMes {
  const dias: Record<string, Dia> = {};
  for (let t = Date.parse(`${inicio}T12:00:00Z`); t <= Date.parse(`${fim}T12:00:00Z`); t += 86_400_000) dias[new Date(t).toISOString().slice(0, 10)] = { c: 'DU' };
  return {
    schemaVersion: 1, usuarioUid: login, login, equipeId: 'EQ_SOC', competencia: '2027-01', periodoInicio: inicio, periodoFim: fim, turnoPadrao: 'M',
    status: 'RASCUNHO', dias, totais: { min: 0, diasTrabalhados: 0, df: 0, du: 0, x: 0, he: 0, bh: 0, an: 0, folga: 0, afa: 0 },
  };
}

function desenhar(inicio: string, fim: string) {
  const documentos = [documento('luiz', inicio, fim), documento('daniel', inicio, fim), documento('ana', inicio, fim)];
  return renderToStaticMarkup(createElement(InverterEscalasModal, {
    documentos, nomePorLogin: { luiz: 'Luiz Neto', daniel: 'Daniel Schlottag', ana: 'Ana Souza' }, catalogo: CATALOGO_SOC, regras: REGRAS_PADRAO,
    onFechar: () => undefined, onAplicar: () => undefined,
  }));
}

describe('InverterEscalasModal — ao abrir', () => {
  const html = desenhar('2026-12-19', '2027-01-03');

  it('é uma janela com título e explicação em linguagem simples', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="inv-titulo"');
    expect(html).toContain('Inverter escalas');
    expect(html).toContain('Duas pessoas combinaram de trocar?');
  });

  it('lista as pessoas em ordem alfabética nas duas escolhas', () => {
    const ordem = [...html.matchAll(/<option value="([a-z]+)"/gu)].map((achado) => achado[1]);
    expect(ordem).toEqual(['ana', 'daniel', 'luiz', 'ana', 'daniel', 'luiz']);
    expect(html).toContain('Pessoa 1');
    expect(html).toContain('Pessoa 2');
  });

  it('oferece o período todo (marcado) e os atalhos de Natal e Ano Novo quando a escala passa por eles', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Todo o período</u);
    expect(html).toContain('Natal (24 e 25/12)');
    expect(html).toContain('Ano Novo (31/12 e 01/01)');
    expect(html).toContain('value="2026-12-19"');
    expect(html).toContain('value="2027-01-03"');
  });

  it('antes de escolher as duas pessoas: orienta, não mostra prévia e o botão Inverter fica desabilitado', () => {
    expect(html).toContain('Escolha as duas pessoas para ver o que muda.');
    expect(html).not.toContain('inv-previa');
    expect(html).toMatch(/<button[^>]*class="primary-button"[^>]*disabled=""/u);
  });

  it('numa escala que não passa pelo Natal, só o período todo é oferecido', () => {
    const agosto = desenhar('2026-07-26', '2026-08-25');
    expect(agosto).toContain('Todo o período');
    expect(agosto).not.toContain('Natal');
    expect(agosto).not.toContain('Ano Novo');
  });
});
