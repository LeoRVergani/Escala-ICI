import {
  idDocumento,
  type ResultadoParse,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import type {
  EventoEscala,
  PublicacaoEscala,
  TipoPublicacaoEscala,
  Usuario,
} from '../modelos';
import { agruparAlteracoesPorUsuario, calcularAlteracoesEscala } from '../revisoes';
import { gerarUuid } from '../uuid';
import { fatiarEmLotes } from './batches';
import {
  escritaAdministrativaHabilitada,
  escritaOficialHabilitada,
  exigirEscritaAdministrativaHabilitada,
  exigirFirebase,
} from './shared';

export { escritaAdministrativaHabilitada, escritaOficialHabilitada };

function validarConjuntoPublicacao(documentos: readonly TurnosMes[]): {
  equipeId: string;
  competencia: string;
  chavePublicacao: string;
} {
  const primeiro = documentos[0];
  if (primeiro === undefined) {
    throw new Error('A publicação precisa conter ao menos uma escala.');
  }
  if (documentos.some((documento) =>
    documento.equipeId !== primeiro.equipeId
    || documento.competencia !== primeiro.competencia)) {
    throw new Error('Todos os documentos devem pertencer à mesma equipe e competência.');
  }
  for (const documento of documentos) {
    idDocumento(documento.equipeId, documento.usuarioUid, documento.competencia);
  }
  return {
    equipeId: primeiro.equipeId,
    competencia: primeiro.competencia,
    chavePublicacao: `${primeiro.equipeId}_${primeiro.competencia}`,
  };
}

function idRevisao(chavePublicacao: string, revisao: number): string {
  return `${chavePublicacao}_${String(revisao).padStart(6, '0')}`;
}

function idDocumentoVersao(
  chavePublicacao: string,
  revisao: number,
  usuarioUid: string,
): string {
  return `${idRevisao(chavePublicacao, revisao)}_${usuarioUid}`;
}

function criarEventoEscala(
  publicacao: PublicacaoEscala,
  usuarioUid: string,
  alteracoes: EventoEscala['alteracoes'],
): EventoEscala {
  return {
    id: `${publicacao.id}_${usuarioUid}`,
    publicacaoId: publicacao.id,
    equipeId: publicacao.equipeId,
    competencia: publicacao.competencia,
    revisao: publicacao.revisao,
    tipo: publicacao.tipo,
    usuarioUid,
    motivo: publicacao.motivo ?? '',
    publicadoPor: publicacao.publicadoPor,
    publicadoEm: publicacao.publicadoEm,
    alteracoes,
  };
}

function motivoPublicacao(
  revisaoAtual: number,
  motivo: string,
  tipo: TipoPublicacaoEscala,
  revisaoOrigem: number | null = null,
): string {
  if (tipo === 'ROLLBACK') {
    return motivo.trim() || `Restauração da revisão ${revisaoOrigem ?? ''}`.trim();
  }
  if (revisaoAtual === 0) {
    return motivo.trim() || 'Publicação inicial da escala';
  }
  if (motivo.trim().length < 3) {
    throw new Error('Informe o motivo da alteração antes de publicar.');
  }
  return motivo.trim();
}

export async function salvarRascunho(
  resultado: ResultadoParse,
  enviadoPor: Usuario,
  nomeArquivo: string,
): Promise<string> {
  exigirEscritaAdministrativaHabilitada();
  if (!resultado.ok) {
    throw new Error('Não é permitido persistir uma importação com erros.');
  }

  const { db } = exigirFirebase();
  const importacaoId = gerarUuid();
  const lotes = fatiarEmLotes(resultado.documentos, 499);

  for (const [indice, documentos] of lotes.entries()) {
    const batch = writeBatch(db);
    for (const documento of documentos) {
      const referencia = doc(
        db,
        'rascunhosTurnosMes',
        idDocumento(documento.equipeId, documento.usuarioUid, documento.competencia),
      );
      batch.set(referencia, {
        ...documento,
        status: 'RASCUNHO',
        importacaoId,
        publicadoPor: null,
        publicadoEm: null,
        atualizadoEm: serverTimestamp(),
      });
    }

    if (indice === 0) {
      batch.set(doc(db, 'importacoes', importacaoId), {
        equipeId: enviadoPor.equipeId,
        competencia: resultado.documentos[0]?.competencia ?? '',
        enviadoPor: enviadoPor.uid,
        nomeArquivo,
        periodoInicio: resultado.periodoInicio,
        periodoFim: resultado.periodoFim,
        totalDocumentos: resultado.documentos.length,
        status: 'RASCUNHO',
        criadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return importacaoId;
}

export async function publicarEscalas(
  documentos: readonly TurnosMes[],
  publicadoPor: string,
  motivo = '',
): Promise<PublicacaoEscala> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const { equipeId, competencia, chavePublicacao } = validarConjuntoPublicacao(documentos);
  const estadoRef = doc(db, 'publicacoesEscala', chavePublicacao);
  const estadoAtual = await getDoc(estadoRef);
  const revisaoAtual = Number(estadoAtual.data()?.revisaoAtual ?? 0);
  const ativos = await getDocs(query(
    collection(db, 'turnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ));
  const documentosAtivos = ativos.docs.map((snapshot) => snapshot.data() as TurnosMes);
  const alteracoes = calcularAlteracoesEscala(documentosAtivos, documentos);
  if (revisaoAtual > 0 && alteracoes.length === 0) {
    throw new Error('Nenhuma alteração foi encontrada em relação à revisão publicada.');
  }
  const alteracoesPorUsuario = agruparAlteracoesPorUsuario(alteracoes);
  const usuariosPublicados = new Set(documentos.map(({ usuarioUid }) => usuarioUid));
  const documentosRemovidos = ativos.docs.filter((snapshot) =>
    !usuariosPublicados.has(String(snapshot.data().usuarioUid ?? '')));
  const revisao = revisaoAtual + 1;
  const publicadoEm = new Date().toISOString();
  const publicacao: PublicacaoEscala = {
    id: idRevisao(chavePublicacao, revisao),
    chavePublicacao,
    equipeId,
    competencia,
    revisao,
    tipo: 'PUBLICACAO',
    revisaoOrigem: null,
    revisaoSubstituida: revisaoAtual > 0 ? revisaoAtual : null,
    totalDocumentos: documentos.length,
    motivo: motivoPublicacao(revisaoAtual, motivo, 'PUBLICACAO'),
    totalColaboradoresAfetados: alteracoesPorUsuario.size,
    totalDiasAlterados: alteracoes.length,
    publicadoPor,
    publicadoEm,
  };

  for (const [indice, lote] of fatiarEmLotes(documentos, 100).entries()) {
    const batch = writeBatch(db);
    for (const documento of lote) {
      const publicado: TurnosMes = {
        ...documento,
        status: 'PUBLICADA',
        publicadoPor,
        publicadoEm,
        atualizadoEm: publicadoEm,
      };
      batch.set(
        doc(db, 'turnosMes', idDocumento(equipeId, documento.usuarioUid, competencia)),
        publicado,
      );
      batch.set(
        doc(db, 'versoesEscala', idDocumentoVersao(chavePublicacao, revisao, documento.usuarioUid)),
        { ...publicado, chavePublicacao, revisao },
      );
      const alteracoesDoUsuario = alteracoesPorUsuario.get(documento.usuarioUid);
      if (alteracoesDoUsuario !== undefined) {
        const evento = criarEventoEscala(publicacao, documento.usuarioUid, alteracoesDoUsuario);
        batch.set(doc(db, 'eventosEscala', evento.id), evento);
      }
      batch.delete(doc(
        db,
        'rascunhosTurnosMes',
        idDocumento(equipeId, documento.usuarioUid, competencia),
      ));
    }
    if (indice === 0) {
      batch.set(doc(db, 'historicoPublicacoes', publicacao.id), publicacao);
      batch.set(estadoRef, {
        id: chavePublicacao,
        equipeId,
        competencia,
        revisaoAtual: revisao,
        ultimaPublicacaoId: publicacao.id,
        atualizadoPor: publicadoPor,
        atualizadoEm: publicadoEm,
      });
    }
    await batch.commit();
  }

  for (const lote of fatiarEmLotes(documentosRemovidos, 150)) {
    const batch = writeBatch(db);
    for (const snapshot of lote) {
      const usuarioUid = String(snapshot.data().usuarioUid ?? '');
      batch.delete(snapshot.ref);
      batch.delete(doc(
        db,
        'rascunhosTurnosMes',
        idDocumento(equipeId, usuarioUid, competencia),
      ));
      const alteracoesDoUsuario = alteracoesPorUsuario.get(usuarioUid);
      if (alteracoesDoUsuario !== undefined) {
        const evento = criarEventoEscala(publicacao, usuarioUid, alteracoesDoUsuario);
        batch.set(doc(db, 'eventosEscala', evento.id), evento);
      }
    }
    await batch.commit();
  }
  return publicacao;
}

export async function reverterPublicacao(
  equipeId: string,
  competencia: string,
  revisaoOrigem: number,
  publicadoPor: string,
  motivo = '',
): Promise<{ publicacao: PublicacaoEscala; documentos: TurnosMes[] }> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const chavePublicacao = `${equipeId}_${competencia}`;
  const estadoRef = doc(db, 'publicacoesEscala', chavePublicacao);
  const estadoAtual = await getDoc(estadoRef);
  const revisaoAtual = Number(estadoAtual.data()?.revisaoAtual ?? 0);
  if (revisaoAtual < 1 || revisaoOrigem < 1 || revisaoOrigem >= revisaoAtual) {
    throw new Error('Selecione uma revisão anterior válida para restaurar.');
  }

  const chaveVersao = idRevisao(chavePublicacao, revisaoOrigem);
  const snapshotVersao = await getDocs(query(
    collection(db, 'versoesEscala'),
    where('equipeId', '==', equipeId),
    where('chavePublicacao', '==', chavePublicacao),
    where('revisao', '==', revisaoOrigem),
  ));
  const documentos = snapshotVersao.docs.map((snapshot) => {
    const dados = snapshot.data();
    const { chavePublicacao: _chave, revisao: _revisao, ...documento } = dados;
    void _chave;
    void _revisao;
    return documento as unknown as TurnosMes;
  });
  if (documentos.length === 0) {
    throw new Error(`A revisão ${revisaoOrigem} não possui documentos restauráveis.`);
  }

  const ativos = await getDocs(query(
    collection(db, 'turnosMes'),
    where('equipeId', '==', equipeId),
    where('competencia', '==', competencia),
  ));
  const documentosAtivos = ativos.docs.map((snapshot) => snapshot.data() as TurnosMes);
  const alteracoes = calcularAlteracoesEscala(documentosAtivos, documentos);
  if (alteracoes.length === 0) {
    throw new Error('A revisão selecionada possui o mesmo conteúdo da escala ativa.');
  }
  const alteracoesPorUsuario = agruparAlteracoesPorUsuario(alteracoes);
  const revisao = revisaoAtual + 1;
  const publicadoEm = new Date().toISOString();
  const publicacao: PublicacaoEscala = {
    id: idRevisao(chavePublicacao, revisao),
    chavePublicacao,
    equipeId,
    competencia,
    revisao,
    tipo: 'ROLLBACK',
    revisaoOrigem,
    revisaoSubstituida: revisaoAtual,
    totalDocumentos: documentos.length,
    motivo: motivoPublicacao(revisaoAtual, motivo, 'ROLLBACK', revisaoOrigem),
    totalColaboradoresAfetados: alteracoesPorUsuario.size,
    totalDiasAlterados: alteracoes.length,
    publicadoPor,
    publicadoEm,
  };

  const uidsRestaurados = new Set(documentos.map(({ usuarioUid }) => usuarioUid));
  const obsoletos = ativos.docs.filter((snapshot) =>
    !uidsRestaurados.has(String(snapshot.data().usuarioUid ?? '')));

  const batch = writeBatch(db);
  for (const snapshot of obsoletos) {
    const usuarioUid = String(snapshot.data().usuarioUid ?? '');
    batch.delete(snapshot.ref);
    const alteracoesDoUsuario = alteracoesPorUsuario.get(usuarioUid);
    if (alteracoesDoUsuario !== undefined) {
      const evento = criarEventoEscala(publicacao, usuarioUid, alteracoesDoUsuario);
      batch.set(doc(db, 'eventosEscala', evento.id), evento);
    }
  }
  for (const documento of documentos) {
    const restaurado: TurnosMes = {
      ...documento,
      status: 'PUBLICADA',
      publicadoPor,
      publicadoEm,
      atualizadoEm: publicadoEm,
    };
    batch.set(
      doc(db, 'turnosMes', idDocumento(equipeId, documento.usuarioUid, competencia)),
      restaurado,
    );
    batch.set(
      doc(db, 'versoesEscala', idDocumentoVersao(chavePublicacao, revisao, documento.usuarioUid)),
      { ...restaurado, chavePublicacao, revisao, restauradaDe: chaveVersao },
    );
    const alteracoesDoUsuario = alteracoesPorUsuario.get(documento.usuarioUid);
    if (alteracoesDoUsuario !== undefined) {
      const evento = criarEventoEscala(publicacao, documento.usuarioUid, alteracoesDoUsuario);
      batch.set(doc(db, 'eventosEscala', evento.id), evento);
    }
  }
  batch.set(doc(db, 'historicoPublicacoes', publicacao.id), publicacao);
  batch.set(estadoRef, {
    id: chavePublicacao,
    equipeId,
    competencia,
    revisaoAtual: revisao,
    ultimaPublicacaoId: publicacao.id,
    atualizadoPor: publicadoPor,
    atualizadoEm: publicadoEm,
  });
  await batch.commit();
  return { publicacao, documentos };
}

export async function salvarUsuario(usuario: Usuario): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await setDoc(doc(db, 'usuarios', usuario.uid), usuario, { merge: true });
}

export async function salvarUsuarios(usuarios: readonly Usuario[]): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  if (usuarios.length === 0) {
    return;
  }
  const equipeId = usuarios[0]?.equipeId;
  if (!equipeId || usuarios.some((usuario) => usuario.equipeId !== equipeId)) {
    throw new Error('Todos os usuários cadastrados devem pertencer à mesma equipe.');
  }
  const { db } = exigirFirebase();
  for (const lote of fatiarEmLotes(usuarios, 500)) {
    const batch = writeBatch(db);
    for (const usuario of lote) {
      batch.set(doc(db, 'usuarios', usuario.uid), usuario);
    }
    await batch.commit();
  }
}

export async function excluirRascunho(documento: TurnosMes): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  if (documento.status !== 'RASCUNHO') {
    throw new Error('Somente rascunhos podem ser excluídos.');
  }
  await deleteDoc(doc(
    db,
    'rascunhosTurnosMes',
    idDocumento(documento.equipeId, documento.usuarioUid, documento.competencia),
  ));
}

export async function atualizarNome(uid: string, nome: string): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  await updateDoc(doc(db, 'usuarios', uid), { nome });
}
