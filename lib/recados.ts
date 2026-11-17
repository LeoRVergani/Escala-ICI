/**
 * RECADOS-1 — recado curto de uma liderança para um colaborador ("pode trocar comigo no dia 20?",
 * "pode atender este chamado?"). NÃO é chat nem histórico: o colaborador responde com um toque
 * (posso / não posso, ou "entendi") e o recado é APAGADO — pelo remetente ao dispensar, ou sozinho
 * quando expira (TTL do Firestore + limpeza ao abrir). Há limite diário por remetente, aplicado nas
 * Regras do Firestore, para que um erro ou abuso nunca estoure a cota gratuita.
 * Módulo PURO: tipos, validação, limite, e o que cada lado enxerga.
 */
export type TipoRecado = 'PERGUNTA' | 'AVISO';
export type StatusRecado = 'ENVIADO' | 'RESPONDIDO';
export type RespostaRecado = 'POSSO' | 'NAO_POSSO' | 'CIENTE';

export const LIMITE_DIARIO_RECADOS = 30;
export const MAXIMO_DESTINATARIOS = 10;
export const LIMITE_TEXTO_RECADO = 300;
export const LIMITE_NOTA_RESPOSTA = 140;
/** Quanto um recado sem resposta vive antes de expirar (e ser apagado). */
export const VALIDADE_DIAS = 3;
/** Depois de respondido, quanto tempo o remetente tem para ver a resposta antes de o recado ser apagado. */
export const VALIDADE_APOS_RESPOSTA_HORAS = 24;

export interface Recado {
  id: string;
  schemaVersion: 1;
  /** Equipe do destinatário — é nela que as Regras conferem se o remetente pode mandar. */
  equipeId: string;
  remetenteLogin: string;
  remetenteNome: string;
  destinatarioLogin: string;
  destinatarioNome: string;
  tipo: TipoRecado;
  texto: string;
  status: StatusRecado;
  resposta: RespostaRecado | null;
  notaResposta: string;
  /** ISO 8601 */
  criadoEm: string;
  respondidoEm: string | null;
  expiraEm: string;
}

export interface EntradaRecado {
  destinatarios: ReadonlyArray<{ login: string; nome: string; equipeId: string }>;
  tipo: TipoRecado;
  texto: string;
}

/** Mensagens em português simples; vazia = pode enviar. */
export function validarEntradaRecado(entrada: EntradaRecado, restanteHoje: number): string[] {
  const erros: string[] = [];
  if (entrada.destinatarios.length === 0) erros.push('Escolha para quem enviar.');
  if (entrada.destinatarios.length > MAXIMO_DESTINATARIOS) erros.push(`Escolha no máximo ${MAXIMO_DESTINATARIOS} pessoas por recado.`);
  const texto = entrada.texto.trim();
  if (texto.length < 3) erros.push('Escreva o recado.');
  if (texto.length > LIMITE_TEXTO_RECADO) erros.push(`O recado passa de ${LIMITE_TEXTO_RECADO} caracteres.`);
  if (entrada.tipo !== 'PERGUNTA' && entrada.tipo !== 'AVISO') erros.push('Escolha se quer uma resposta ou só avisar.');
  if (restanteHoje <= 0) erros.push(`Você já enviou os ${LIMITE_DIARIO_RECADOS} recados de hoje. Amanhã libera de novo.`);
  else if (entrada.destinatarios.length > restanteHoje) {
    erros.push(`Hoje você ainda pode enviar ${restanteHoje} ${restanteHoje === 1 ? 'recado' : 'recados'} (limite de ${LIMITE_DIARIO_RECADOS} por dia).`);
  }
  return erros;
}

export function gerarIdRecado(): string {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Um recado por destinatário. A hora de criação é a do servidor na gravação; aqui só a estimativa local. */
export function montarRecado(
  entrada: Pick<EntradaRecado, 'tipo' | 'texto'>,
  destinatario: { login: string; nome: string; equipeId: string },
  remetente: { login: string; nome: string },
  id: string,
  agoraIso: string,
): Recado {
  return {
    id, schemaVersion: 1, equipeId: destinatario.equipeId,
    remetenteLogin: remetente.login, remetenteNome: remetente.nome,
    destinatarioLogin: destinatario.login, destinatarioNome: destinatario.nome.replace(/\s+/gu, ' ').trim(),
    tipo: entrada.tipo, texto: entrada.texto.trim(),
    status: 'ENVIADO', resposta: null, notaResposta: '',
    criadoEm: agoraIso, respondidoEm: null, expiraEm: adicionarHoras(agoraIso, VALIDADE_DIAS * 24),
  };
}

export function adicionarHoras(iso: string, horas: number): string {
  return new Date(new Date(iso).getTime() + horas * 3_600_000).toISOString();
}

// ----------------------------------------------------------------- limite diário

/** O "dia" do limite é o dia em Brasília (UTC−3) — o mesmo cálculo das Regras do Firestore. */
export function diaDoLimite(agoraIso: string): string {
  return new Date(new Date(agoraIso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function chaveLimite(login: string, agoraIso: string): string {
  return `${login}_${diaDoLimite(agoraIso)}`;
}

export function restanteHoje(contagemHoje: number): number {
  return Math.max(0, LIMITE_DIARIO_RECADOS - Math.max(0, contagemHoje));
}

// ------------------------------------------------------------- leitura / estados

export function expirou(recado: Pick<Recado, 'expiraEm'>, agoraIso: string): boolean {
  return recado.expiraEm <= agoraIso;
}

export function rotuloResposta(resposta: RespostaRecado | null): string {
  switch (resposta) {
    case 'POSSO': return 'Posso';
    case 'NAO_POSSO': return 'Não posso';
    case 'CIENTE': return 'Entendi';
    default: return '';
  }
}

export type EstadoParaRemetente = 'AGUARDANDO' | 'POSSO' | 'NAO_POSSO' | 'CIENTE' | 'EXPIRADO';

/** O que o remetente vê no cartão: aguardando, a resposta, ou expirado (e será apagado). */
export function estadoParaRemetente(recado: Recado, agoraIso: string): EstadoParaRemetente {
  if (recado.status === 'RESPONDIDO' && recado.resposta !== null) return recado.resposta;
  return expirou(recado, agoraIso) ? 'EXPIRADO' : 'AGUARDANDO';
}

/** Mais novos primeiro; o que já tem resposta sobe (é o que o remetente precisa ver). */
export function ordenarParaRemetente(lista: readonly Recado[]): Recado[] {
  return [...lista].sort((a, b) => Number(b.status === 'RESPONDIDO') - Number(a.status === 'RESPONDIDO')
    || b.criadoEm.localeCompare(a.criadoEm) || a.id.localeCompare(b.id));
}

/**
 * O que o colaborador vê no App: só os dele, ainda sem resposta e que não expiraram. Depois de
 * responder o recado SOME para ele (e fica só para o remetente ver a resposta).
 */
export function pendentesParaODestinatario(lista: readonly Recado[], login: string, agoraIso: string): Recado[] {
  return [...lista]
    .filter((recado) => recado.destinatarioLogin === login && recado.status === 'ENVIADO' && !expirou(recado, agoraIso))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
}

/** Respostas que cabem em cada tipo de recado. */
export function respostasDoTipo(tipo: TipoRecado): RespostaRecado[] {
  return tipo === 'PERGUNTA' ? ['POSSO', 'NAO_POSSO'] : ['CIENTE'];
}

/** O que veio do banco (datas já em ISO); documento malformado vira `null`, nunca derruba a tela. */
export function lerRecado(id: string, dados: Record<string, unknown>): Recado | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null);
  const tipo = texto(dados.tipo) as TipoRecado | null;
  const status = texto(dados.status) as StatusRecado | null;
  const resposta = (dados.resposta === null || dados.resposta === undefined ? null : texto(dados.resposta)) as RespostaRecado | null;
  const remetenteLogin = texto(dados.remetenteLogin);
  const destinatarioLogin = texto(dados.destinatarioLogin);
  const equipeId = texto(dados.equipeId);
  const criadoEm = texto(dados.criadoEm);
  const expiraEm = texto(dados.expiraEm);
  if ((tipo !== 'PERGUNTA' && tipo !== 'AVISO') || (status !== 'ENVIADO' && status !== 'RESPONDIDO')) return null;
  if (!remetenteLogin || !destinatarioLogin || !equipeId || !criadoEm || !expiraEm) return null;
  if (resposta !== null && !['POSSO', 'NAO_POSSO', 'CIENTE'].includes(resposta)) return null;
  return {
    id, schemaVersion: 1, equipeId, remetenteLogin, remetenteNome: texto(dados.remetenteNome) ?? remetenteLogin,
    destinatarioLogin, destinatarioNome: texto(dados.destinatarioNome) ?? destinatarioLogin, tipo, texto: texto(dados.texto) ?? '',
    status, resposta, notaResposta: texto(dados.notaResposta) ?? '', criadoEm,
    respondidoEm: texto(dados.respondidoEm), expiraEm,
  };
}
