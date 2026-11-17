/**
 * RECADOS-2 — recado curto entre colegas (da mesma equipe ou do mesmo Plantão) ou da liderança para a equipe.
 * Mensagem LIVRE e resposta LIVRE — mas sem conversa nem histórico: o destinatário responde UMA vez, o remetente
 * vê a resposta e apaga; o que vence é apagado sozinho (TTL do Firestore + limpeza ao abrir). Há limite diário
 * por remetente, aplicado nas Regras do Firestore, para um erro ou abuso nunca estourar a cota gratuita.
 * Módulo PURO: tipos, validação, limite, e o que cada lado enxerga.
 */
export type StatusRecado = 'ENVIADO' | 'RESPONDIDO';

export const LIMITE_DIARIO_RECADOS = 30;
export const MAXIMO_DESTINATARIOS = 10;
export const LIMITE_TEXTO_RECADO = 300;
export const LIMITE_RESPOSTA_RECADO = 300;
/** Quanto um recado sem resposta vive antes de expirar (e ser apagado). */
export const VALIDADE_DIAS = 3;
/** Depois de respondido, quanto tempo o remetente tem para ver a resposta antes de o recado ser apagado. */
export const VALIDADE_APOS_RESPOSTA_HORAS = 24;
/** Atalhos que só PREENCHEM o campo de resposta (a pessoa pode editar ou escrever outra coisa). */
export const RESPOSTAS_RAPIDAS = ['Posso', 'Não posso', 'Entendi'] as const;

export interface Recado {
  id: string;
  schemaVersion: 2;
  /** Equipe do destinatário (as Regras conferem com o cadastro dele). */
  equipeId: string;
  /** Preenchido quando o recado é entre participantes de um Plantão; '' quando é de equipe. */
  grupoPlantaoId: string;
  remetenteLogin: string;
  remetenteNome: string;
  destinatarioLogin: string;
  destinatarioNome: string;
  texto: string;
  status: StatusRecado;
  /** Resposta livre; '' enquanto não respondido. */
  resposta: string;
  /** ISO 8601 */
  criadoEm: string;
  respondidoEm: string | null;
  expiraEm: string;
}

export interface DestinatarioRecado {
  login: string;
  nome: string;
  equipeId: string;
  /** Presente quando a pessoa é alcançada pelo Plantão (e não pela equipe). */
  grupoPlantaoId?: string;
}

export interface EntradaRecado {
  destinatarios: readonly DestinatarioRecado[];
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
  if (restanteHoje <= 0) erros.push(`Você já enviou os ${LIMITE_DIARIO_RECADOS} recados de hoje. Amanhã libera de novo.`);
  else if (entrada.destinatarios.length > restanteHoje) {
    erros.push(`Hoje você ainda pode enviar ${restanteHoje} ${restanteHoje === 1 ? 'recado' : 'recados'} (limite de ${LIMITE_DIARIO_RECADOS} por dia).`);
  }
  return erros;
}

export function validarResposta(resposta: string): string[] {
  const texto = resposta.trim();
  if (texto.length < 1) return ['Escreva a sua resposta.'];
  if (texto.length > LIMITE_RESPOSTA_RECADO) return [`A resposta passa de ${LIMITE_RESPOSTA_RECADO} caracteres.`];
  return [];
}

export function gerarIdRecado(): string {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function adicionarHoras(iso: string, horas: number): string {
  return new Date(new Date(iso).getTime() + horas * 3_600_000).toISOString();
}

/** Um recado por destinatário. A hora de criação é a do servidor na gravação; aqui só a estimativa local. */
export function montarRecado(
  entrada: Pick<EntradaRecado, 'texto'>,
  destinatario: DestinatarioRecado,
  remetente: { login: string; nome: string },
  id: string,
  agoraIso: string,
): Recado {
  return {
    id, schemaVersion: 2, equipeId: destinatario.equipeId, grupoPlantaoId: destinatario.grupoPlantaoId ?? '',
    remetenteLogin: remetente.login, remetenteNome: remetente.nome,
    destinatarioLogin: destinatario.login, destinatarioNome: destinatario.nome.replace(/\s+/gu, ' ').trim(),
    texto: entrada.texto.trim(), status: 'ENVIADO', resposta: '',
    criadoEm: agoraIso, respondidoEm: null, expiraEm: adicionarHoras(agoraIso, VALIDADE_DIAS * 24),
  };
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

export type EstadoParaRemetente = 'AGUARDANDO' | 'RESPONDIDO' | 'EXPIRADO';

/** O que o remetente vê no cartão: aguardando, a resposta, ou vencido (e será apagado). */
export function estadoParaRemetente(recado: Recado, agoraIso: string): EstadoParaRemetente {
  if (recado.status === 'RESPONDIDO') return 'RESPONDIDO';
  return expirou(recado, agoraIso) ? 'EXPIRADO' : 'AGUARDANDO';
}

/** Com resposta primeiro (é o que o remetente precisa ver); depois os mais novos. */
export function ordenarParaRemetente(lista: readonly Recado[]): Recado[] {
  return [...lista].sort((a, b) => Number(b.status === 'RESPONDIDO') - Number(a.status === 'RESPONDIDO')
    || b.criadoEm.localeCompare(a.criadoEm) || a.id.localeCompare(b.id));
}

/**
 * O que o colaborador vê para RESPONDER: só os dele, ainda sem resposta e que não venceram. Depois de
 * responder o recado SOME para ele (e fica só para o remetente ver a resposta).
 */
export function pendentesParaODestinatario(lista: readonly Recado[], login: string, agoraIso: string): Recado[] {
  return [...lista]
    .filter((recado) => recado.destinatarioLogin === login && recado.status === 'ENVIADO' && !expirou(recado, agoraIso))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
}

/** O que o remetente enviou e ainda não venceu. */
export function enviadosAtivos(lista: readonly Recado[], login: string, agoraIso: string): Recado[] {
  return ordenarParaRemetente(lista.filter((recado) => recado.remetenteLogin === login && !expirou(recado, agoraIso)));
}

/** A bolinha do menu: recados esperando MINHA resposta + respostas que eu ainda não apaguei. */
export function quantidadeQuePedeAtencao(lista: readonly Recado[], login: string, agoraIso: string): number {
  return pendentesParaODestinatario(lista, login, agoraIso).length
    + lista.filter((recado) => recado.remetenteLogin === login && recado.status === 'RESPONDIDO' && !expirou(recado, agoraIso)).length;
}

/** O que veio do banco (datas já em ISO); documento antigo ou malformado vira `null`, nunca derruba a tela. */
export function lerRecado(id: string, dados: Record<string, unknown>): Recado | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null);
  const status = texto(dados.status) as StatusRecado | null;
  const remetenteLogin = texto(dados.remetenteLogin);
  const destinatarioLogin = texto(dados.destinatarioLogin);
  const equipeId = texto(dados.equipeId);
  const criadoEm = texto(dados.criadoEm);
  const expiraEm = texto(dados.expiraEm);
  if (dados.schemaVersion !== 2 || (status !== 'ENVIADO' && status !== 'RESPONDIDO')) return null;
  if (!remetenteLogin || !destinatarioLogin || !equipeId || !criadoEm || !expiraEm) return null;
  return {
    id, schemaVersion: 2, equipeId, grupoPlantaoId: texto(dados.grupoPlantaoId) ?? '', remetenteLogin, remetenteNome: texto(dados.remetenteNome) ?? remetenteLogin,
    destinatarioLogin, destinatarioNome: texto(dados.destinatarioNome) ?? destinatarioLogin, texto: texto(dados.texto) ?? '',
    status, resposta: texto(dados.resposta) ?? '', criadoEm, respondidoEm: texto(dados.respondidoEm), expiraEm,
  };
}
