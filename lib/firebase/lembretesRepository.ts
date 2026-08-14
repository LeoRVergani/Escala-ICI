/**
 * Repositório de Lembretes (Fase 3) — persistência e realtime, sem nenhuma
 * lógica de UI. Usa o domínio puro de `lib/lembretes.ts` para validar e
 * normalizar antes de qualquer escrita — a Firestore Rule é a segunda
 * barreira, nunca a única (ver `firestore.rules`).
 *
 * Duas coleções, schema conceitual documentado em `docs/spec/LEMBRETES.md`:
 * - Pessoal: `usuarios/{login}/lembretes/{lembreteId}` — subcoleção, não
 *   um campo dentro de `usuarios/{login}`. Privacidade é estrutural: a Rule
 *   da subcoleção é independente da Rule do documento pai.
 * - Atribuído: `lembretesAtribuidos/{lembreteId}` — coleção top-level,
 *   porque o gestor precisa ler/gerenciar itens que não são dele.
 *
 * `lembreteId` é gerado por `gerarUuid()` (nunca `titulo + data`, nunca
 * dependente de dado pessoal) e a série (`criarOcorrenciasSerie()`, Fase 2)
 * grava um documento por ocorrência, todas com o mesmo `serieId`, em
 * `writeBatch` — atômico: ou grava tudo, ou nada.
 *
 * Timestamps seguem o padrão real do projeto (`trocasRepository.ts`,
 * `pushDeviceRepository.ts`): string ISO via `new Date().toISOString()`,
 * nunca `Timestamp`/`serverTimestamp()`.
 *
 * `exigirEscritaAdministrativaHabilitada()` só protege as operações do
 * GESTOR sobre atribuídos (mesmo padrão de `gestorRecusarTroca()`/
 * `gestorAprovarEPublicarTroca()`) — o CRUD pessoal é autoatendimento do
 * colaborador, como `criarSolicitacaoTroca()`/`cancelarSolicitacaoTroca()`,
 * e não passa por essa trava administrativa.
 */
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  criarOcorrenciasSerie,
  normalizarLembrete,
  validarEntradaLembrete,
  validarEntradaSerieLembrete,
  type EntradaLembrete,
  type EntradaSerieLembrete,
  type HorarioLembrete,
  type LembreteAtribuido,
  type LembretePessoal,
  type StatusLembreteAtribuido,
} from '../lembretes';
import type { Usuario } from '../modelos';
import { gerarUuid } from '../uuid';
import { removerUndefined } from './sanitizar';
import { exigirEscritaAdministrativaHabilitada, exigirFirebase } from './shared';

const COLECAO_ATRIBUIDOS = 'lembretesAtribuidos';

export type LembretePessoalPersistido = LembretePessoal & {
  lembreteId: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type LembreteAtribuidoPersistido = LembreteAtribuido & {
  lembreteId: string;
  criadoEm: string;
  atualizadoEm: string;
  canceladoEm: string | null;
  canceladoPorLogin: string | null;
};

function validarEntradaOuLancar(entrada: EntradaLembrete): void {
  const erros = validarEntradaLembrete(entrada);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
}

function validarEntradaSerieOuLancar(entrada: EntradaSerieLembrete): void {
  const erros = validarEntradaSerieLembrete(entrada);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
}

// --- Mapper: nunca um cast cego de snapshot.data(), sempre extração
// defensiva por campo (mesmo padrão de `lerUsuario()` em `./shared`) —
// um documento corrompido/malformado vira um lembrete com campos vazios
// nunca derruba a tela nem é promovido silenciosamente a dado válido. ---

function lerHorario(valor: unknown): HorarioLembrete {
  const registro = (typeof valor === 'object' && valor !== null) ? valor as Record<string, unknown> : {};
  const diaInteiro = registro.diaInteiro === true;
  if (diaInteiro) {
    return { diaInteiro: true, horaInicio: null, horaFim: null, viraDia: false };
  }
  return {
    diaInteiro: false,
    horaInicio: typeof registro.horaInicio === 'string' ? registro.horaInicio : null,
    horaFim: typeof registro.horaFim === 'string' ? registro.horaFim : null,
    viraDia: registro.viraDia === true,
  };
}

function lerAlertas(valor: unknown): number[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is number => typeof item === 'number')
    : [];
}

function lerLembretePessoal(lembreteId: string, dados: Record<string, unknown>): LembretePessoalPersistido {
  return {
    lembreteId,
    tipo: 'PESSOAL',
    schemaVersion: 1,
    titulo: typeof dados.titulo === 'string' ? dados.titulo : '',
    descricao: typeof dados.descricao === 'string' ? dados.descricao : null,
    data: typeof dados.data === 'string' ? dados.data : '',
    horario: lerHorario(dados.horario),
    serieId: typeof dados.serieId === 'string' ? dados.serieId : null,
    alertasAntecedenciaMin: lerAlertas(dados.alertasAntecedenciaMin),
    criadoEm: typeof dados.criadoEm === 'string' ? dados.criadoEm : '',
    atualizadoEm: typeof dados.atualizadoEm === 'string' ? dados.atualizadoEm : '',
  };
}

function lerLembreteAtribuido(lembreteId: string, dados: Record<string, unknown>): LembreteAtribuidoPersistido {
  return {
    lembreteId,
    tipo: 'ATRIBUIDO',
    schemaVersion: 1,
    destinatarioLogin: typeof dados.destinatarioLogin === 'string' ? dados.destinatarioLogin : '',
    destinatarioEquipeId: typeof dados.destinatarioEquipeId === 'string' ? dados.destinatarioEquipeId : '',
    titulo: typeof dados.titulo === 'string' ? dados.titulo : '',
    descricao: typeof dados.descricao === 'string' ? dados.descricao : null,
    data: typeof dados.data === 'string' ? dados.data : '',
    horario: lerHorario(dados.horario),
    serieId: typeof dados.serieId === 'string' ? dados.serieId : null,
    alertasAntecedenciaMin: lerAlertas(dados.alertasAntecedenciaMin),
    criadoPorLogin: typeof dados.criadoPorLogin === 'string' ? dados.criadoPorLogin : '',
    criadoPorNome: typeof dados.criadoPorNome === 'string' ? dados.criadoPorNome : '',
    status: dados.status === 'CANCELADO' ? 'CANCELADO' : 'ATIVO',
    criadoEm: typeof dados.criadoEm === 'string' ? dados.criadoEm : '',
    atualizadoEm: typeof dados.atualizadoEm === 'string' ? dados.atualizadoEm : '',
    canceladoEm: typeof dados.canceladoEm === 'string' ? dados.canceladoEm : null,
    canceladoPorLogin: typeof dados.canceladoPorLogin === 'string' ? dados.canceladoPorLogin : null,
  };
}

function colecaoPessoal(db: ReturnType<typeof exigirFirebase>['db'], login: string) {
  return collection(db, 'usuarios', login, 'lembretes');
}

// --- Pessoal ---

export async function criarLembretePessoal(login: string, entrada: EntradaLembrete): Promise<string> {
  validarEntradaOuLancar(entrada);
  const { db } = exigirFirebase();
  const conteudo = normalizarLembrete(entrada);
  const lembreteId = gerarUuid();
  const agora = new Date().toISOString();
  const documento: LembretePessoalPersistido = {
    lembreteId,
    tipo: 'PESSOAL',
    schemaVersion: 1,
    titulo: conteudo.titulo,
    descricao: conteudo.descricao,
    data: conteudo.data,
    horario: conteudo.horario,
    serieId: conteudo.serieId,
    alertasAntecedenciaMin: conteudo.alertasAntecedenciaMin,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  await setDoc(doc(colecaoPessoal(db, login), lembreteId), removerUndefined(documento));
  return lembreteId;
}

/** Uma ocorrência por documento (nunca `datas: [...]` num único doc) — todas compartilham `serieId`, gravadas em lote atômico. */
export async function criarSerieLembretesPessoais(login: string, entrada: EntradaSerieLembrete): Promise<string[]> {
  validarEntradaSerieOuLancar(entrada);
  const { db } = exigirFirebase();
  const serieId = gerarUuid();
  const ocorrencias = criarOcorrenciasSerie(entrada, serieId);
  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  const idsGerados: string[] = [];
  for (const ocorrencia of ocorrencias) {
    const lembreteId = gerarUuid();
    idsGerados.push(lembreteId);
    const documento: LembretePessoalPersistido = {
      lembreteId,
      tipo: 'PESSOAL',
      schemaVersion: 1,
      titulo: ocorrencia.titulo,
      descricao: ocorrencia.descricao,
      data: ocorrencia.data,
      horario: ocorrencia.horario,
      serieId: ocorrencia.serieId,
      alertasAntecedenciaMin: ocorrencia.alertasAntecedenciaMin,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    batch.set(doc(colecaoPessoal(db, login), lembreteId), removerUndefined(documento));
  }
  await batch.commit();
  return idsGerados;
}

export async function atualizarLembretePessoal(
  login: string,
  lembreteId: string,
  entrada: EntradaLembrete,
): Promise<void> {
  validarEntradaOuLancar(entrada);
  const { db } = exigirFirebase();
  const conteudo = normalizarLembrete(entrada);
  await updateDoc(doc(colecaoPessoal(db, login), lembreteId), removerUndefined({
    titulo: conteudo.titulo,
    descricao: conteudo.descricao,
    data: conteudo.data,
    horario: conteudo.horario,
    serieId: conteudo.serieId,
    alertasAntecedenciaMin: conteudo.alertasAntecedenciaMin,
    atualizadoEm: new Date().toISOString(),
  }));
}

/** Exclusão definitiva — aceitável porque é conteúdo do próprio colaborador; sem histórico administrativo. */
export async function excluirLembretePessoal(login: string, lembreteId: string): Promise<void> {
  const { db } = exigirFirebase();
  await deleteDoc(doc(colecaoPessoal(db, login), lembreteId));
}

/** Intervalo civil inclusivo — nunca `competenciaOperacional()`: Lembretes não ficam presos à competência 26→25. */
export async function listarLembretesPessoais(
  login: string,
  dataInicio: string,
  dataFim: string,
): Promise<LembretePessoalPersistido[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    colecaoPessoal(db, login),
    where('data', '>=', dataInicio),
    where('data', '<=', dataFim),
    orderBy('data'),
  ));
  return resultado.docs.map((snapshot) => lerLembretePessoal(snapshot.id, snapshot.data()));
}

export function observarLembretesPessoais(
  login: string,
  dataInicio: string,
  dataFim: string,
  aoAtualizar: (lembretes: LembretePessoalPersistido[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    colecaoPessoal(db, login),
    where('data', '>=', dataInicio),
    where('data', '<=', dataFim),
    orderBy('data'),
  ), (snapshot) => {
    aoAtualizar(snapshot.docs.map((documento) => lerLembretePessoal(documento.id, documento.data())));
  }, (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar seus lembretes.'),
  ));
}

// --- Atribuído ---

export type DestinatarioLembreteAtribuido = Pick<Usuario, 'login' | 'equipeId'>;
export type AutorLembreteAtribuido = Pick<Usuario, 'login' | 'nome'>;

/**
 * O repository NÃO reimplementa a checagem de escopo (`podeGerenciarEquipe()`,
 * `lib/sessao.ts`) — quem chama (Dashboard, Fase 5) já checa isso para dar
 * feedback imediato na UI. A autoridade de verdade é sempre a Firestore
 * Rule, que revalida o destinatário real contra `usuarios/{login}` — ver
 * `firestore.rules` e o teste de ataque "equipe falsificada".
 */
export async function criarLembreteAtribuido(
  destinatario: DestinatarioLembreteAtribuido,
  criadoPor: AutorLembreteAtribuido,
  entrada: EntradaLembrete,
): Promise<string> {
  exigirEscritaAdministrativaHabilitada();
  validarEntradaOuLancar(entrada);
  const { db } = exigirFirebase();
  const conteudo = normalizarLembrete(entrada);
  const lembreteId = gerarUuid();
  const agora = new Date().toISOString();
  const documento: LembreteAtribuidoPersistido = {
    lembreteId,
    tipo: 'ATRIBUIDO',
    schemaVersion: 1,
    destinatarioLogin: destinatario.login,
    destinatarioEquipeId: destinatario.equipeId,
    titulo: conteudo.titulo,
    descricao: conteudo.descricao,
    data: conteudo.data,
    horario: conteudo.horario,
    serieId: conteudo.serieId,
    alertasAntecedenciaMin: conteudo.alertasAntecedenciaMin,
    criadoPorLogin: criadoPor.login,
    criadoPorNome: criadoPor.nome,
    status: 'ATIVO',
    criadoEm: agora,
    atualizadoEm: agora,
    canceladoEm: null,
    canceladoPorLogin: null,
  };
  await setDoc(doc(db, COLECAO_ATRIBUIDOS, lembreteId), removerUndefined(documento));
  return lembreteId;
}

export async function criarSerieLembretesAtribuidos(
  destinatario: DestinatarioLembreteAtribuido,
  criadoPor: AutorLembreteAtribuido,
  entrada: EntradaSerieLembrete,
): Promise<string[]> {
  exigirEscritaAdministrativaHabilitada();
  validarEntradaSerieOuLancar(entrada);
  const { db } = exigirFirebase();
  const serieId = gerarUuid();
  const ocorrencias = criarOcorrenciasSerie(entrada, serieId);
  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  const idsGerados: string[] = [];
  for (const ocorrencia of ocorrencias) {
    const lembreteId = gerarUuid();
    idsGerados.push(lembreteId);
    const documento: LembreteAtribuidoPersistido = {
      lembreteId,
      tipo: 'ATRIBUIDO',
      schemaVersion: 1,
      destinatarioLogin: destinatario.login,
      destinatarioEquipeId: destinatario.equipeId,
      titulo: ocorrencia.titulo,
      descricao: ocorrencia.descricao,
      data: ocorrencia.data,
      horario: ocorrencia.horario,
      serieId: ocorrencia.serieId,
      alertasAntecedenciaMin: ocorrencia.alertasAntecedenciaMin,
      criadoPorLogin: criadoPor.login,
      criadoPorNome: criadoPor.nome,
      status: 'ATIVO',
      criadoEm: agora,
      atualizadoEm: agora,
      canceladoEm: null,
      canceladoPorLogin: null,
    };
    batch.set(doc(db, COLECAO_ATRIBUIDOS, lembreteId), removerUndefined(documento));
  }
  await batch.commit();
  return idsGerados;
}

/** Destinatário/equipe/autoria são imutáveis por design — só conteúdo e status mudam depois de criado. */
export async function atualizarLembreteAtribuido(lembreteId: string, entrada: EntradaLembrete): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  validarEntradaOuLancar(entrada);
  const { db } = exigirFirebase();
  const conteudo = normalizarLembrete(entrada);
  await updateDoc(doc(db, COLECAO_ATRIBUIDOS, lembreteId), removerUndefined({
    titulo: conteudo.titulo,
    descricao: conteudo.descricao,
    data: conteudo.data,
    horario: conteudo.horario,
    serieId: conteudo.serieId,
    alertasAntecedenciaMin: conteudo.alertasAntecedenciaMin,
    atualizadoEm: new Date().toISOString(),
  }));
}

/**
 * Nunca `deleteDoc()` — cancelamento é `status: ATIVO -> CANCELADO`,
 * preservando histórico administrativo. Transição é unidirecional (a Rule
 * nega `CANCELADO -> ATIVO`); reativar exige criar um novo lembrete.
 */
export async function cancelarLembreteAtribuido(
  lembreteId: string,
  canceladoPor: Pick<Usuario, 'login'>,
): Promise<void> {
  exigirEscritaAdministrativaHabilitada();
  const { db } = exigirFirebase();
  const agora = new Date().toISOString();
  const statusCancelado: StatusLembreteAtribuido = 'CANCELADO';
  await updateDoc(doc(db, COLECAO_ATRIBUIDOS, lembreteId), removerUndefined({
    status: statusCancelado,
    atualizadoEm: agora,
    canceladoEm: agora,
    canceladoPorLogin: canceladoPor.login,
  }));
}

/**
 * Mesma consulta serve o colaborador (próprio login) e o Dashboard/gestor
 * (login do colaborador selecionado, Fase 5) — quem autoriza cada caso é a
 * Firestore Rule, não uma função diferente. Sem `where('status', ...)`: por
 * volume esperado baixo, cancelados são filtrados em memória (ver
 * `lembretesAtribuidosAtivos()`, `lib/lembretes.ts`), o que evita um índice
 * composto maior (`destinatarioLogin+status+data`).
 */
export async function listarLembretesAtribuidosDoUsuario(
  destinatarioLogin: string,
  dataInicio: string,
  dataFim: string,
): Promise<LembreteAtribuidoPersistido[]> {
  const { db } = exigirFirebase();
  const resultado = await getDocs(query(
    collection(db, COLECAO_ATRIBUIDOS),
    where('destinatarioLogin', '==', destinatarioLogin),
    where('data', '>=', dataInicio),
    where('data', '<=', dataFim),
    orderBy('data'),
  ));
  return resultado.docs.map((snapshot) => lerLembreteAtribuido(snapshot.id, snapshot.data()));
}

export function observarLembretesAtribuidosDoUsuario(
  destinatarioLogin: string,
  dataInicio: string,
  dataFim: string,
  aoAtualizar: (lembretes: LembreteAtribuidoPersistido[]) => void,
  aoFalhar: (erro: Error) => void,
): Unsubscribe {
  const { db } = exigirFirebase();
  return onSnapshot(query(
    collection(db, COLECAO_ATRIBUIDOS),
    where('destinatarioLogin', '==', destinatarioLogin),
    where('data', '>=', dataInicio),
    where('data', '<=', dataFim),
    orderBy('data'),
  ), (snapshot) => {
    aoAtualizar(snapshot.docs.map((documento) => lerLembreteAtribuido(documento.id, documento.data())));
  }, (falha) => aoFalhar(
    falha instanceof Error ? falha : new Error('Falha ao acompanhar lembretes atribuídos.'),
  ));
}
