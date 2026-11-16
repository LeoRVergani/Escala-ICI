import { describe, expect, it } from 'vitest';

import { estadoInicialDaSituacao, montarRegraDoAssistente, type SituacaoChave } from './regrasAssistente';
import { errosParaSalvar, idParaSalvar, lerRegraSalva, montarDocumentoRegra } from './regrasPersistencia';
import { novaRegraEmBranco, type RegraEscala } from './regrasEscala';

const SITUACAO: Record<string, SituacaoChave> = { 'cinco-dias': 'DIAS_SEGUIDOS', 'turno-longo': 'TURNO_LONGO', 'descanso-12': 'POUCO_DESCANSO', domingo: 'DIA_DA_SEMANA' };
const exemplo = (chave: string): RegraEscala => montarRegraDoAssistente(estadoInicialDaSituacao(SITUACAO[chave]!), 'teste-abc-1234');
const AGORA = '2026-11-16T12:00:00.000Z';

describe('REGRAS-ESCALA-4 — persistência', () => {
  it('regra em teste vira regra salva: id novo, sempre da empresa, com quem criou e quando', () => {
    const doc = montarDocumentoRegra(exemplo('turno-longo'), 'paula.ferraz', AGORA);
    expect(doc).toMatchObject({ id: 'regra-abc-1234', categoria: 'EMPRESA', origem: 'ADMIN', criadoPorLogin: 'paula.ferraz', criadoEm: AGORA, atualizadoPorLogin: 'paula.ferraz' });
    expect(idParaSalvar({ id: 'Teste-X_Y!' })).toBe('regra-x-y-');
  });

  it('editar preserva quem criou e quando; só o atualizado muda', () => {
    const criada = montarDocumentoRegra(exemplo('cinco-dias'), 'paula.ferraz', AGORA);
    const editada = montarDocumentoRegra({ ...criada, nome: 'Máximo de 5 dias' }, 'renato.pires', '2026-11-20T09:00:00.000Z', criada);
    expect(editada).toMatchObject({ criadoPorLogin: 'paula.ferraz', criadoEm: AGORA, atualizadoPorLogin: 'renato.pires', atualizadoEm: '2026-11-20T09:00:00.000Z' });
  });

  it('o documento só tem campos que as Rules aceitam e não leva "ids" quando vale para todas', () => {
    const doc = montarDocumentoRegra(exemplo('domingo'), 'paula.ferraz', AGORA);
    expect(Object.keys(doc).sort()).toEqual(['ativa', 'atualizadoEm', 'atualizadoPorLogin', 'categoria', 'criadoEm', 'criadoPorLogin', 'descricao', 'entao', 'id', 'nome', 'origem', 'quando', 'schemaVersion', 'vale']);
    expect(doc.vale).toEqual({ tipo: 'TODAS' });
    // 'domingo' (dia da semana) não tem sugestão; as demais situações têm
    expect(Object.keys(doc.entao).sort()).toEqual(['agrupar', 'bloqueiaPublicacao', 'gravidade', 'mensagem']);
    expect(Object.keys(montarDocumentoRegra(exemplo('turno-longo'), 'paula.ferraz', AGORA).entao).sort()).toEqual(['agrupar', 'bloqueiaPublicacao', 'gravidade', 'mensagem', 'sugestao']);
    const porEquipe = montarDocumentoRegra({ ...exemplo('domingo'), vale: { tipo: 'EQUIPE', ids: ['EQ_SOC', 'EQ_SOC', 'EQ_NOC'] } }, 'paula.ferraz', AGORA);
    expect(porEquipe.vale).toEqual({ tipo: 'EQUIPE', ids: ['EQ_SOC', 'EQ_NOC'] });
  });

  it('regra incompleta não é gravável', () => {
    expect(errosParaSalvar(novaRegraEmBranco('x'))).toEqual(['Dê um nome para a regra.']);
    expect(errosParaSalvar(exemplo('domingo'))).toEqual([]);
  });

  it('ida e volta: o que se grava é lido de novo igual', () => {
    const doc = montarDocumentoRegra(exemplo('descanso-12'), 'paula.ferraz', AGORA);
    const lida = lerRegraSalva(doc.id, JSON.parse(JSON.stringify(doc)) as Record<string, unknown>);
    expect(lida).toEqual(doc);
  });

  it('documento malformado, de outra categoria ou com regra inválida é ignorado (nunca derruba nem roda)', () => {
    const doc = montarDocumentoRegra(exemplo('domingo'), 'paula.ferraz', AGORA);
    const cru = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
    expect(lerRegraSalva('x', { ...cru, categoria: 'LEGAL' })).toBeNull();
    expect(lerRegraSalva('x', { ...cru, schemaVersion: 2 })).toBeNull();
    expect(lerRegraSalva('x', { ...cru, quando: { logica: 'E', condicoes: [{ variavel: 'salario', op: '>', valor: 1 }] } })).toBeNull();
    expect(lerRegraSalva('x', { ...cru, quando: 'lixo' })).toBeNull();
    expect(lerRegraSalva('x', { id: 'x' })).toBeNull();
  });
});
