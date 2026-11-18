import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { entradaEmBranco, TIPOS_INFORMACAO } from '@/lib/informacoesDia';
import { InformacaoModal, type PessoaDaEquipe } from './InformacaoModal';

const PESSOAS: PessoaDaEquipe[] = [
  { login: 'aura.matos', nome: 'Aura Matos', equipeId: 'EQ_SOC' },
  { login: 'gael.freire', nome: 'Gael Freire', equipeId: 'EQ_SOC' },
];

function desenhar(opcoes: { edicao: boolean; tipo?: 'ATESTADO' | 'CURSO'; escolhida?: boolean }) {
  const base = entradaEmBranco({
    dataInicio: '2026-11-18',
    ...(opcoes.tipo ? { tipo: opcoes.tipo } : {}),
    ...(opcoes.escolhida || opcoes.edicao ? { login: 'aura.matos', nomeColaborador: 'Aura Matos', equipeId: 'EQ_SOC' } : {}),
  });
  return renderToStaticMarkup(createElement(InformacaoModal, {
    edicao: opcoes.edicao, entradaInicial: base, pessoas: PESSOAS, nomeEquipe: () => 'SOC', onFechar: () => undefined, onSalvar: async () => undefined,
  }));
}

describe('INFORMACOES-MODAL-2 — "Nova informação" em duas colunas', () => {
  it('nova informação: Quem (lista sempre visível, escolhida destacada) à esquerda; tipos, quando e detalhes à direita; botões no rodapé', () => {
    const html = desenhar({ edicao: false, escolhida: true });
    expect(html).toContain('aria-label="Nova informação"');
    expect(html).toContain('class="ninfo-esq"');
    expect(html).toContain('class="ninfo-dir"');
    expect(html).toContain('ninfo-lista');
    expect(html).toContain('aria-label="Escolher Aura Matos"');
    // a escolhida fica marcada; a outra não
    expect(html).toMatch(/aria-label="Escolher Aura Matos" aria-pressed="true" data-marcada=""/u);
    expect(html).toMatch(/aria-label="Escolher Gael Freire" aria-pressed="false"/u);
    // os 4 tipos, na ordem do cadastro
    for (const tipo of TIPOS_INFORMACAO) expect(html).toContain(`<strong>${tipo.rotulo}</strong>`);
    expect(html).toContain('Mostrar para o colaborador no App');
    expect(html).toContain('Salvar informação');
    expect(html).toContain('Cancelar');
  });

  it('o rodapé reserva o lugar do erro (a janela não cresce quando ele aparece) e só mostra erro depois de tentar salvar', () => {
    const html = desenhar({ edicao: false });
    expect(html).toMatch(/<p class="ninfo-erro" role="alert"><\/p>/u);
  });

  it('o aviso do CID só aparece no atestado', () => {
    expect(desenhar({ edicao: false, tipo: 'ATESTADO' })).toContain('Não registre o diagnóstico nem o CID');
    expect(desenhar({ edicao: false, tipo: 'CURSO' })).not.toContain('Não registre o diagnóstico nem o CID');
  });

  it('editando: a pessoa fica travada (sem lista nem busca) e o botão diz "Salvar alterações"', () => {
    const html = desenhar({ edicao: true });
    expect(html).toContain('aria-label="Editar informação"');
    expect(html).toContain('ninfo-escolhida');
    expect(html).toContain('Aura Matos');
    expect(html).not.toContain('ninfo-lista');
    expect(html).not.toContain('Buscar pelo nome');
    expect(html).toContain('Salvar alterações');
  });

  it('o texto digitado nunca vira HTML: o nome com marcação é escapado', () => {
    const html = renderToStaticMarkup(createElement(InformacaoModal, {
      edicao: false, entradaInicial: entradaEmBranco({ dataInicio: '2026-11-18' }),
      pessoas: [{ login: 'x', nome: '<img src=x onerror=alert(1)>', equipeId: 'EQ_SOC' }], nomeEquipe: () => 'SOC', onFechar: () => undefined, onSalvar: async () => undefined,
    }));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
