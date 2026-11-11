import { doc, writeBatch } from 'firebase/firestore';

import { criarIdEscopoOperacional } from '../escoposOperacionaisMatriz';
import type { Equipe, EscopoOperacional, UnidadeOrganizacional, Usuario } from '../modelos';
import { normalizarNomePessoa } from '../nomePessoa';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

/**
 * CRIAR-EQUIPE-1 — uma liderança cria a própria equipe em Minha equipe: a
 * equipe e o responsável pela escala dela (a própria liderança) num lote só
 * — os dois entram juntos ou nenhum entra (nunca sobra equipe sem chefe).
 * As Rules só aceitam o responsável sendo quem criou a equipe.
 */
function slug(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_').replace(/^_+|_+$/gu, '').slice(0, 30);
}

export function siglaDoNome(nome: string): string {
  const palavras = normalizarNomePessoa(nome).split(' ').filter((palavra) => palavra.length > 2 || /^[A-Z0-9]+$/u.test(palavra));
  const sigla = palavras.length === 1 ? slug(palavras[0] ?? '').slice(0, 8) : palavras.map((palavra) => palavra[0]).join('');
  return slug(sigla).slice(0, 10) || 'EQUIPE';
}

export function idParaNovaEquipe(nome: string, aleatorio: string = Math.random().toString(36).slice(2, 6)): string {
  return `EQ_${slug(nome) || 'EQUIPE'}_${aleatorio.toUpperCase()}`;
}

export async function criarEquipeComoLideranca(
  dados: { nome: string; unidade?: Pick<UnidadeOrganizacional, 'unidadeId' | 'caminho'> | null },
  autor: Pick<Usuario, 'login'>,
): Promise<{ equipe: Equipe; escopo: EscopoOperacional }> {
  exigirEscritaAdministrativaHabilitada();
  const nome = normalizarNomePessoa(dados.nome);
  if (nome.length < 2) throw new Error('Dê um nome para a equipe.');
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  const id = idParaNovaEquipe(nome);
  const unidade = dados.unidade ?? null;
  const equipe: Equipe & { criadoPorLogin: string; criadoEm: string } = {
    id,
    nome,
    sigla: siglaDoNome(nome),
    ativa: true,
    ...(unidade ? { unidadeId: unidade.unidadeId, caminhoUnidade: [...unidade.caminho] } : {}),
    criadoPorLogin: autor.login,
    criadoEm: agora,
  };
  const escopo = {
    tipo: 'JORNADA',
    alvoId: id,
    alvoNome: nome,
    ...(unidade ? { unidadeId: unidade.unidadeId, caminhoUnidade: [...unidade.caminho] } : {}),
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
  lote.set(doc(db, 'equipes', id), removerUndefined(equipe));
  lote.set(doc(db, 'escoposOperacionais', criarIdEscopoOperacional('JORNADA', id)), removerUndefined(escopo));
  await lote.commit();
  return { equipe, escopo };
}
