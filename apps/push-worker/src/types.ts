/**
 * Cópia local mínima do contrato de `notificacoesTroca`. Fonte da verdade:
 * lib/trocasEscala.ts (`NotificacaoTroca`/`TipoNotificacaoTroca`, no repo
 * principal). Este pacote roda em runtime Node/Admin SDK, fora do
 * toolchain Vite dos apps cliente — mantenha os dois em sincronia manual
 * se o domínio de Trocas mudar.
 */
export type TipoNotificacaoTroca =
  | 'TROCA_SOLICITADA'
  | 'TROCA_RECUSADA_USUARIO'
  | 'TROCA_ACEITA_AGUARDANDO_GESTOR'
  | 'TROCA_RECUSADA_GESTOR'
  | 'TROCA_APROVADA_PUBLICADA'
  | 'TROCA_CANCELADA';

export interface NotificacaoTroca {
  id: string;
  destinatarioLogin: string;
  equipeId: string;
  tipo: TipoNotificacaoTroca;
  titulo: string;
  mensagem: string;
  trocaId: string;
  criadoPorLogin: string;
  criadoEm: string;
  lidaEm: string | null;
  acao: 'ABRIR_TROCA';
}

export type PlataformaDispositivo = 'ANDROID';

export interface DispositivoPush {
  deviceId: string;
  login: string;
  plataforma: PlataformaDispositivo;
  token: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  ultimaConfirmacaoEm: string | null;
  appVersion: string | null;
  environment: 'STAGING';
}

export type StatusPushEntrega =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'ENVIADO'
  | 'SEM_DISPOSITIVO'
  | 'ERRO_RETRY'
  | 'ERRO_FINAL';

/**
 * Controle técnico de idempotência/entrega — nunca é lido por client SDK
 * (Firestore Rules negam tudo). `PROCESSANDO` carrega uma lease
 * (`workerId`/`processandoDesde`/`leaseExpiraEm`) para que um worker que
 * morreu no meio do envio não trave o evento para sempre: outro worker (ou
 * o mesmo, após restart) pode retomar quando `leaseExpiraEm` já passou.
 */
export interface PushEntrega {
  notificacaoId: string;
  trocaId: string;
  tipo: TipoNotificacaoTroca;
  destinatarioLogin: string;
  status: StatusPushEntrega;
  workerId: string | null;
  processandoDesde: string | null;
  leaseExpiraEm: string | null;
  tentativas: number;
  primeiraTentativaEm: string;
  ultimaTentativaEm: string;
  enviadoEm: string | null;
  successCount: number;
  failureCount: number;
  erroCodigo: string | null;
  environment: 'STAGING';
}
