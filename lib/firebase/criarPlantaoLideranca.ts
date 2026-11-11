import { doc, writeBatch } from 'firebase/firestore';
import type { FuncaoPlantao, GrupoPlantao } from '@escala-ici/contrato';

import { criarIdEscopoOperacional } from '../escoposOperacionaisMatriz';
import type { Equipe, EscopoOperacional, Usuario } from '../modelos';
import { normalizarNomePessoa } from '../nomePessoa';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * CRIAR-PLANTAO-1 — o chefe de uma equipe cria o Plantão dela em Minha
 * equipe: o Plantão e o responsável pela escala dele (o próprio chefe) num
 * lote só. O responsável é o que libera plantonistas, importação e publicação.
 */
function slug(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_').replace(/^_+|_+$/gu, '').slice(0, 30);
}

export function idParaNovoPlantao(nome: string, aleatorio: string = Math.random().toString(36).slice(2, 6)): string {
  const base = slug(nome).replace(/^PLANTAO_?/u, '') || 'GRUPO';
  return `PLANTAO_${base}_${aleatorio.toUpperCase()}`;
}

export async function criarPlantaoComoLideranca(
  dados: { nome: string; equipe: Pick<Equipe, 'id' | 'unidadeId' | 'caminhoUnidade'>; postos: readonly FuncaoPlantao[] },
  autor: Pick<Usuario, 'login'>,
): Promise<{ grupo: GrupoPlantao; escopo: EscopoOperacional }> {
  exigirEscritaAdministrativaHabilitada();
  const nome = normalizarNomePessoa(dados.nome);
  if (nome.length < 2) throw new Error('Dê um nome para o Plantão.');
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  const grupoId = idParaNovoPlantao(nome);
  const unidade = dados.equipe.unidadeId
    ? { unidadeResponsavelId: dados.equipe.unidadeId, caminhoUnidadeResponsavel: [...(dados.equipe.caminhoUnidade ?? [])] }
    : {};
  const grupo = {
    grupoId,
    nome,
    equipeResponsavelId: dados.equipe.id,
    equipesConsulta: [dados.equipe.id],
    ...unidade,
    ...(dados.postos.length > 1 ? { funcoesEsperadas: [...dados.postos] } : {}),
    timezone: 'America/Sao_Paulo',
    ativo: true,
    schemaVersion: 1,
    criadoPorLogin: autor.login,
    criadoEm: agora,
    atualizadoEm: agora,
  } as GrupoPlantao & { criadoPorLogin: string; criadoEm: string; atualizadoEm: string };
  const escopo = {
    tipo: 'PLANTAO',
    alvoId: grupoId,
    alvoNome: nome,
    ...(dados.equipe.unidadeId ? { unidadeId: dados.equipe.unidadeId, caminhoUnidade: [...(dados.equipe.caminhoUnidade ?? [])] } : {}),
    responsaveisLogin: [autor.login],
    responsaveisEquipe: [],
    equipesConsulta: [],
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
    criadoPorLogin: autor.login,
    atualizadoPorLogin: autor.login,
    schemaVersion: 1,
  } as unknown as EscopoOperacional;
  const lote = writeBatch(db);
  lote.set(doc(db, 'gruposPlantao', grupoId), removerUndefined(grupo));
  lote.set(doc(db, 'escoposOperacionais', criarIdEscopoOperacional('PLANTAO', grupoId)), removerUndefined(escopo));
  await lote.commit();
  return { grupo, escopo };
}
