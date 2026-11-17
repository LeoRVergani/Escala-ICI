/**
 * RECADOS-3 — mensagem curta para UMA PESSOA ou para um GRUPO (a equipe ou o Plantão), como começar uma conversa no
 * Teams: escolhe o destino, escreve e envia. Para um grupo é UMA mensagem só e cada um responde do seu jeito — o
 * remetente vê todas as respostas juntas. (RECADOS-2: recado entre colegas da mesma equipe ou do mesmo Plantão.)
 * Mensagem LIVRE e resposta LIVRE — mas sem conversa nem histórico: o destinatário responde UMA vez, o remetente
 * vê a resposta e apaga; o que vence é apagado sozinho (TTL do Firestore + limpeza ao abrir). Há limite diário
 * por remetente, aplicado nas Regras do Firestore, para um erro ou abuso nunca estourar a cota gratuita.
 * Módulo PURO: tipos, validação, limite, e o que cada lado enxerga.
 */
export type StatusRecado = 'ENVIADO' | 'RESPONDIDO';

export const LIMITE_DIARIO_RECADOS = 30;
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

export type TipoAlvoRecado = 'EQUIPE' | 'PLANTAO';

/** Um grupo que pode receber uma mensagem: a equipe ou um Plantão. */
export interface AlvoRecado {
  tipo: TipoAlvoRecado;
  id: string;
  nome: string;
  /** Quantas pessoas tem, quando se sabe (só para mostrar). */
  quantidade?: number;
}

/** Para onde vai a mensagem: uma pessoa, ou um ou mais grupos ("Todos" = todos os grupos a que se tem acesso). */
export type DestinoMensagem =
  | { tipo: 'PESSOA'; pessoa: DestinatarioRecado }
  | { tipo: 'GRUPOS'; alvos: readonly AlvoRecado[] };

export interface EntradaMensagem {
  destino: DestinoMensagem | null;
  texto: string;
}

/** Quantas mensagens do limite do dia este envio gasta: uma por pessoa ou uma por grupo (não por integrante). */
export function mensagensConsumidas(destino: DestinoMensagem | null): number {
  if (destino === null) return 1;
  return destino.tipo === 'PESSOA' ? 1 : Math.max(1, destino.alvos.length);
}

/** Mensagens em português simples; vazia = pode enviar. */
export function validarEntradaMensagem(entrada: EntradaMensagem, restanteHoje: number): string[] {
  const erros: string[] = [];
  if (entrada.destino === null || (entrada.destino.tipo === 'GRUPOS' && entrada.destino.alvos.length === 0)) erros.push('Escolha para quem enviar.');
  const texto = entrada.texto.trim();
  if (texto.length < 3) erros.push('Escreva a mensagem.');
  if (texto.length > LIMITE_TEXTO_RECADO) erros.push(`A mensagem passa de ${LIMITE_TEXTO_RECADO} caracteres.`);
  const gasto = mensagensConsumidas(entrada.destino);
  if (restanteHoje <= 0) erros.push(`Você já enviou as ${LIMITE_DIARIO_RECADOS} mensagens de hoje. Amanhã libera de novo.`);
  else if (gasto > restanteHoje) {
    erros.push(`Hoje você ainda pode enviar ${restanteHoje} ${restanteHoje === 1 ? 'mensagem' : 'mensagens'} (limite de ${LIMITE_DIARIO_RECADOS} por dia).`);
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
  entrada: Pick<EntradaMensagem, 'texto'>,
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

/** A bolinha do menu: esperando MINHA resposta (pessoa ou grupo) + respostas que eu ainda não vi e não apaguei. */
export function quantidadeQuePedeAtencao(pessoas: readonly Recado[], grupos: readonly RecadoGrupo[], login: string, agoraIso: string): number {
  return pendentesParaODestinatario(pessoas, login, agoraIso).length
    + gruposPendentesParaMembro(grupos, login, agoraIso).length
    + pessoas.filter((recado) => recado.remetenteLogin === login && recado.status === 'RESPONDIDO' && !expirou(recado, agoraIso)).length
    + gruposEnviadosAtivos(grupos, login, agoraIso).filter((grupo) => grupo.respostas.length > 0).length;
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

// ------------------------------------------------------- mensagem para um GRUPO

export interface RespostaDoGrupo {
  login: string;
  nome: string;
  texto: string;
  /** ISO 8601 */
  em: string;
}

/**
 * Uma mensagem para a equipe ou para um Plantão. UM documento só; cada integrante responde UMA vez, no mapa
 * `respostas` (a chave é o login dele). Quem enviou vê todas as respostas no mesmo cartão e apaga.
 */
export interface RecadoGrupo {
  id: string;
  schemaVersion: 1;
  alvoTipo: TipoAlvoRecado;
  alvoId: string;
  alvoNome: string;
  remetenteLogin: string;
  remetenteNome: string;
  texto: string;
  criadoEm: string;
  expiraEm: string;
  /** Mais antigas primeiro. */
  respostas: RespostaDoGrupo[];
}

export function montarRecadoGrupo(
  entrada: Pick<EntradaMensagem, 'texto'>,
  alvo: AlvoRecado,
  remetente: { login: string; nome: string },
  id: string,
  agoraIso: string,
): RecadoGrupo {
  return {
    id, schemaVersion: 1, alvoTipo: alvo.tipo, alvoId: alvo.id, alvoNome: alvo.nome,
    remetenteLogin: remetente.login, remetenteNome: remetente.nome, texto: entrada.texto.trim(),
    criadoEm: agoraIso, expiraEm: adicionarHoras(agoraIso, VALIDADE_DIAS * 24), respostas: [],
  };
}

export function jaRespondeuGrupo(grupo: Pick<RecadoGrupo, 'respostas'>, login: string): boolean {
  return grupo.respostas.some((resposta) => resposta.login === login);
}

/** O que um integrante vê para RESPONDER: mensagens de OUTRA pessoa para o seu grupo, ainda válidas e sem a resposta dele. */
export function gruposPendentesParaMembro(lista: readonly RecadoGrupo[], login: string, agoraIso: string): RecadoGrupo[] {
  return [...lista]
    .filter((grupo) => grupo.remetenteLogin !== login && !expirou(grupo, agoraIso) && !jaRespondeuGrupo(grupo, login))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
}

/** O que eu enviei para grupos e ainda vale: com respostas primeiro, depois as mais novas. */
export function gruposEnviadosAtivos(lista: readonly RecadoGrupo[], login: string, agoraIso: string): RecadoGrupo[] {
  return [...lista]
    .filter((grupo) => grupo.remetenteLogin === login && !expirou(grupo, agoraIso))
    .sort((a, b) => Number(b.respostas.length > 0) - Number(a.respostas.length > 0) || b.criadoEm.localeCompare(a.criadoEm) || a.id.localeCompare(b.id));
}

/** "Equipe SOC · 42 pessoas" */
export function rotuloDoAlvo(alvo: Pick<AlvoRecado, 'nome' | 'quantidade'>): string {
  return alvo.quantidade === undefined ? alvo.nome : `${alvo.nome} · ${alvo.quantidade} ${alvo.quantidade === 1 ? 'pessoa' : 'pessoas'}`;
}

/** "3 de 13 responderam" (ou "3 responderam" quando não se sabe o tamanho do grupo). */
export function rotuloRespostasDoGrupo(grupo: Pick<RecadoGrupo, 'respostas'>, quantidade?: number): string {
  const total = grupo.respostas.length;
  if (total === 0) return 'Ninguém respondeu ainda';
  const verbo = total === 1 ? 'respondeu' : 'responderam';
  return quantidade !== undefined && quantidade >= total ? `${total} de ${quantidade} ${verbo}` : `${total} ${verbo}`;
}

/** O que veio do banco (datas já em ISO; `respostas` é um mapa login → resposta). Malformado vira `null`. */
export function lerRecadoGrupo(id: string, dados: Record<string, unknown>): RecadoGrupo | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null);
  const alvoTipo = texto(dados.alvoTipo) as TipoAlvoRecado | null;
  const alvoId = texto(dados.alvoId);
  const remetenteLogin = texto(dados.remetenteLogin);
  const criadoEm = texto(dados.criadoEm);
  const expiraEm = texto(dados.expiraEm);
  if (dados.schemaVersion !== 1 || (alvoTipo !== 'EQUIPE' && alvoTipo !== 'PLANTAO') || !alvoId || !remetenteLogin || !criadoEm || !expiraEm) return null;
  const respostas: RespostaDoGrupo[] = [];
  const mapa = dados.respostas !== null && typeof dados.respostas === 'object' ? dados.respostas as Record<string, unknown> : {};
  for (const [login, bruto] of Object.entries(mapa)) {
    const item = bruto as { nome?: unknown; texto?: unknown; em?: unknown } | null;
    if (item === null || typeof item !== 'object' || typeof item.texto !== 'string' || typeof item.em !== 'string') continue;
    respostas.push({ login, nome: typeof item.nome === 'string' ? item.nome : login, texto: item.texto, em: item.em });
  }
  respostas.sort((a, b) => a.em.localeCompare(b.em) || a.login.localeCompare(b.login));
  return {
    id, schemaVersion: 1, alvoTipo, alvoId, alvoNome: texto(dados.alvoNome) ?? alvoId, remetenteLogin,
    remetenteNome: texto(dados.remetenteNome) ?? remetenteLogin, texto: texto(dados.texto) ?? '', criadoEm, expiraEm, respostas,
  };
}
