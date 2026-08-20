import type { MomentoPlantao } from './tiposPlantao.js';

/**
 * Modelo de domínio PERSISTENTE de Plantão (Fase PLANTÃO-3A). Diferente de
 * `tiposPlantao.ts` (contrato do PARSER, Fase PLANTÃO-1 — dados brutos lidos
 * de um XLS, sem identidade de login nem timezone), este arquivo descreve a
 * forma dos documentos Firestore e as validações puras antes de qualquer
 * escrita. Sem SDK do Firestore, sem React — só tipos e funções puras,
 * reaproveitadas por `lib/firebase/plantaoReadRepository.ts`/
 * `plantaoWriteRepository.ts` e por `firestore.rules` (regras espelhadas em
 * prosa, mesma convenção de `lib/sessao.ts` ↔ `firestore.rules`).
 *
 * Ver `docs/spec/PLANTOES.md`, seção 20, para a justificativa completa do
 * schema (collections escolhidas, por que RASCUNHO/PUBLICADA são coleções
 * separadas, estratégia de IDs e de timezone).
 */

/**
 * Fase ESCALAS-UX-1C — `'COPIADO'` foi adicionado (`docs/spec/EDITOR_ESCALAS.md`
 * § 7 já reservava esse nome desde a ESCALAS-UX-1B) para "Usar período
 * anterior": uma nova competência cujas atribuições nascem de uma cópia
 * estrutural de uma competência anterior já persistida, nunca um gerador
 * (`'GERADO'` continua reservado para uma futura distribuição automática
 * por regra de cobertura/rotação — domínio diferente, nunca confundido
 * com "copiar o que já existia"). Adicionar este valor aqui e em
 * `firestore.rules` (`origem in [...]`, 4 ocorrências) foi avaliado como
 * mudança mecânica e não-significativa — mesmo padrão de enum já usado
 * para os três valores anteriores, nenhuma lógica de autorização nova,
 * nenhum campo novo — por isso feito nesta fase em vez de adiado. Ver
 * checkpoint desta fase para o registro completo da decisão.
 */
export type OrigemPlantao = 'IMPORTADO' | 'MANUAL' | 'GERADO' | 'COPIADO';
export type PapelPlantonista = 'PRIMARIO' | 'SECUNDARIO';
export type StatusCompetenciaPlantao = 'RASCUNHO' | 'PUBLICADA';

export const MAXIMO_CONTATOS_PLANTONISTA = 3;

export const ORIGENS_PLANTAO_VALIDAS: readonly OrigemPlantao[] = ['IMPORTADO', 'MANUAL', 'GERADO', 'COPIADO'];
export const PAPEIS_PLANTONISTA_VALIDOS: readonly PapelPlantonista[] = ['PRIMARIO', 'SECUNDARIO'];

/**
 * Fase PLANTAO-PADRAO-1 — mesmo índice de `Date#getUTCDay()` (0 = domingo),
 * já usado internamente por `parserPlantao.ts` (`NOMES_DIA_SEMANA`, privado
 * àquele arquivo) — reaproveitado aqui como a ÚNICA convenção pública de dia
 * da semana do pacote, nunca uma segunda numeração.
 */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DIAS_SEMANA: readonly DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

/** Nomes curtos para exibição (UI) — nunca usados como fonte de verdade de identidade/ordenação. */
export const NOMES_DIA_SEMANA: readonly string[] = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export const MAXIMO_DIAS_PADRAO_HORARIO_SEMANAL = DIAS_SEMANA.length;

/**
 * Uma entrada do padrão semanal de um Grupo de Plantão — horário CIVIL
 * recorrente para um dia da semana (`docs/spec/PLANTOES.md` seção 28).
 * `fimDiaOffset` é persistido EXPLICITAMENTE (nunca inferido comparando
 * `horaFim` com `horaInicio` numericamente) — `19:00 → 07:00` só significa
 * "termina no dia seguinte" porque `fimDiaOffset = 1` diz isso, não porque
 * `07:00 < 19:00`. Um turno de 24h é representável (`horaInicio ==
 * horaFim` com `fimDiaOffset = 1`); o mesmo par com `fimDiaOffset = 0`
 * resulta em duração zero e é inválido (`validarPadraoHorarioSemanal`).
 * Ausência de entrada para um dia = "sem horário padrão configurado" —
 * nunca uma entrada artificial `00:00 → 00:00`.
 */
export interface PadraoHorarioPlantaoDia {
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
  fimDiaOffset: 0 | 1;
}

/**
 * Contato operacional de um plantonista. `rotulo` é texto livre validado
 * (não um enum fechado — grupos diferentes podem precisar de rótulos
 * diferentes, ver seção 8 de `docs/spec/PLANTOES.md`), não
 * `telefone1`/`telefone2`/`telefone3`.
 */
export interface ContatoPlantonista {
  rotulo: string;
  numero: string;
  ativo: boolean;
}

/**
 * `gruposPlantao/{grupoId}`. `equipesConsulta` é SEMPRE não vazio e SEMPRE
 * inclui `equipeResponsavelId` — resolvido uma única vez por
 * `equipesConsultaEfetivas()` antes de qualquer escrita, nunca deixado
 * como campo opcional com fallback calculado em tempo de leitura (diferente
 * do padrão `equipesPermitidas`/`unidadesPermitidas` de `lib/sessao.ts`,
 * que existe para não quebrar cadastros ANTIGOS — Plantão é domínio novo,
 * sem legado, então o campo pode e deve ser sempre concreto desde a
 * criação; isso também simplifica a Rule e a query de "grupos que posso
 * consultar", que pode fazer `array-contains` direto sem se preocupar com
 * ausência do campo).
 */
export interface GrupoPlantao {
  grupoId: string;
  nome: string;
  descricao?: string;
  equipeResponsavelId: string;
  equipesConsulta: string[];
  /**
   * Fase ESCOPO-GESTOR-UNIDADE-1 — `unidadeId` da equipe responsável no
   * momento em que este campo foi preenchido, denormalizado aqui pelo MESMO
   * motivo de `destinatarioEquipeId` em `lembretesAtribuidos`
   * (`firestore.rules`): autorizar `GESTOR_UNIDADE` a administrar este Grupo
   * exige comparar contra `unidadesPermitidas` sem depender de um `get()`
   * extra na Equipe dentro da Rule. OPCIONAL e retrocompatível — todo
   * `GrupoPlantao` criado antes desta fase não tem o campo, e continua
   * 100% válido (só não fica administrável por `GESTOR_UNIDADE`, apenas
   * pelo `GESTOR_EQUIPE`/`ADMIN_SISTEMA` de sempre — ver
   * `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`). Nunca inferido a
   * partir de nome/sigla; é o `Equipe.unidadeId` da equipe responsável,
   * copiado explicitamente na criação/edição do Grupo. Diferente de
   * `equipeResponsavelId` (imutável), este campo pode ser corrigido depois
   * (ex.: a equipe migrou de unidade) — quem já administra o Grupo pode
   * atualizá-lo para refletir a unidade atual.
   */
  unidadeResponsavelId?: string;
  /**
   * Caminho materializado (raiz -> unidade, inclusive) da unidade acima,
   * cópia de `UnidadeOrganizacional.caminho` no momento do preenchimento —
   * permite que `GESTOR_UNIDADE` de uma unidade ANCESTRAL administre este
   * Grupo sem a Rule percorrer `parentId` (mesmo princípio de
   * `Equipe.caminhoUnidade`, `docs/spec/HIERARQUIA_ORGANIZACIONAL.md` § 2).
   * Opcional; ausente = só o match exato de `unidadeResponsavelId` vale.
   */
  caminhoUnidadeResponsavel?: string[];
  timezone: string;
  ativo: boolean;
  /**
   * Fase PLANTAO-PADRAO-1 — horários recorrentes deste Grupo, por dia da
   * semana (`docs/spec/PLANTOES.md` seção 28). OPCIONAL e retrocompatível:
   * todo `GrupoPlantao` persistido antes desta fase não tem o campo (nunca
   * migrado automaticamente) e continua 100% válido — ausência do campo é
   * equivalente a array vazio ("nenhum padrão configurado"). Representa
   * horário CIVIL do Grupo (mesmo `timezone` do campo acima) — puramente
   * sugestivo para NOVAS atribuições futuras (consumido só a partir de
   * ESCALAS-UX-2B); nunca recalcula/normaliza atribuições já existentes.
   */
  padraoHorarioSemanal?: PadraoHorarioPlantaoDia[];
  schemaVersion: number;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * `gruposPlantao/{grupoId}/participantes/{login}` — o ID do documento É o
 * login (determinístico, garante unicidade por participante sem precisar
 * de query extra). `grupoId` é denormalizado no próprio documento (mesmo
 * princípio de `equipeId` denormalizado em `turnosMes`) para a Rule de
 * consulta administrativa e para queries futuras de "meus grupos"
 * (collection group) não precisarem inferir o pai pelo path.
 */
export interface ParticipantePlantao {
  grupoId: string;
  login: string;
  ativo: boolean;
  ordem?: number;
  contatos: ContatoPlantonista[];
  schemaVersion: number;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * `rascunhosCompetenciasPlantao/{id}` (status sempre `RASCUNHO`, imposto
 * pela Rule) ou `competenciasPlantao/{id}` (status sempre `PUBLICADA`,
 * escrita bloqueada nesta fase). `id = idCompetenciaPlantao(grupoId,
 * competencia)`. `totaisInformadosOrigem`/`totalBruto` preservam a
 * divergência real da planilha (ver PLANTÃO-1) — nunca reconciliados um no
 * outro.
 */
export interface CompetenciaPlantao {
  id: string;
  grupoId: string;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  status: StatusCompetenciaPlantao;
  revisao: number;
  origem: OrigemPlantao;
  totaisInformadosOrigem: { totalPlantoesInformado: number; totalMinutosInformado: number } | null;
  totalBruto: { quantidade: number; minutos: number };
  schemaVersion: number;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * `.../competencias.../{id}/atribuicoes/{atribuicaoId}`. `inicio`/`fim` são
 * instantes absolutos (ISO 8601 UTC, ex.: "2026-07-25T03:00:00.000Z") — já
 * convertidos do momento civil do XLS usando o timezone do Grupo (ver
 * `converterMomentoParaInstanteUtc`). `duracaoMinutos` é campo derivado
 * VALIDADO, nunca fonte de verdade (`validarAtribuicaoPlantaoPersistida`
 * rejeita qualquer atribuição cuja duração não bata com fim-início).
 */
export interface AtribuicaoPlantaoPersistida {
  atribuicaoId: string;
  grupoId: string;
  competenciaId: string;
  plantonistaLogin: string;
  inicio: string;
  fim: string;
  duracaoMinutos: number;
  papel: PapelPlantonista;
  origem: OrigemPlantao;
  revisao: number;
  schemaVersion: number;
  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// IDs determinísticos
// ---------------------------------------------------------------------------

const PADRAO_ID_SIMPLES = /^[A-Za-z0-9_-]+$/u;
const PADRAO_COMPETENCIA = /^\d{4}-\d{2}$/u;

/** Mesmo charset seguro de `idDocumento()` (documentos.ts) — sem "/", sem vazio. */
export function idGrupoPlantaoValido(grupoId: string): boolean {
  return PADRAO_ID_SIMPLES.test(grupoId);
}

export function idCompetenciaPlantao(grupoId: string, competencia: string): string {
  if (!idGrupoPlantaoValido(grupoId)) {
    throw new Error(`grupoId inválido: "${grupoId}".`);
  }
  if (!PADRAO_COMPETENCIA.test(competencia)) {
    throw new Error(`competencia inválida: "${competencia}" (esperado AAAA-MM).`);
  }
  return `${grupoId}_${competencia}`;
}

/**
 * ID sequencial de atribuição dentro de uma competência — determinístico e
 * ordenável (`0001`, `0002`, ...), não um UUID aleatório. Reimportar a
 * mesma planilha na mesma ordem sobrescreve os mesmos IDs, em vez de
 * duplicar atribuições a cada reimportação.
 */
export function idAtribuicaoPlantao(indice: number): string {
  if (!Number.isInteger(indice) || indice < 0) {
    throw new Error(`índice de atribuição inválido: ${indice}.`);
  }
  return String(indice + 1).padStart(4, '0');
}

// ---------------------------------------------------------------------------
// Visibilidade — equipe responsável vs. equipes autorizadas a consultar
// ---------------------------------------------------------------------------

/**
 * Sempre inclui `equipeResponsavelId` (dedup via Set) — garante o
 * invariante que a Rule assume (`equipeResponsavelId in equipesConsulta`)
 * antes mesmo de chegar ao Firestore. Chamar sempre que o formulário/import
 * monta um `GrupoPlantao`, nunca deixar o campo como veio "cru" do usuário.
 */
export function equipesConsultaEfetivas(
  equipeResponsavelId: string,
  equipesConsulta: readonly string[] = [],
): string[] {
  const explicitas = equipesConsulta.map((equipe) => equipe.trim()).filter((equipe) => equipe !== '');
  return [...new Set([equipeResponsavelId, ...explicitas])];
}

// ---------------------------------------------------------------------------
// Timezone — momento civil (parser) + timezone do Grupo -> instante UTC
// ---------------------------------------------------------------------------

const PADRAO_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/u;
const PADRAO_HORA = /^(\d{2}):(\d{2})$/u;

/** `true` só se `Intl.DateTimeFormat` reconhecer a timezone como um IANA time zone name válido. */
export function timezoneValida(timezone: string): boolean {
  try {
    // Só o construtor lança para uma timezone inválida — não precisamos da instância.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function offsetMinutosNaTimezone(timezone: string, instanteAproximado: Date): number {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(instanteAproximado).map((parte) => [parte.type, parte.value]),
  );
  const comoSeUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
  return (comoSeUtc - instanteAproximado.getTime()) / 60_000;
}

/**
 * Converte um momento civil (`{ data, hora }`, sem timezone anexado — ver
 * `MomentoPlantao` em `tiposPlantao.ts`) mais o timezone do Grupo de
 * Plantão num instante absoluto (ISO 8601 UTC). Determinístico e
 * independente do timezone da máquina que roda o código: usa
 * `Intl.DateTimeFormat` com `timeZone` explícito, nunca o timezone padrão
 * do processo/SO.
 *
 * Duas passadas resolvem corretamente uma eventual virada de horário de
 * verão: a primeira estima o offset a partir do "chute" ingênuo (tratar os
 * componentes civis como se já fossem UTC); a segunda recalcula o offset
 * usando o instante já corrigido pela primeira estimativa. Não resolve o
 * caso extremo de um horário civil inexistente/ambíguo exatamente no
 * segundo da transição de DST — aceitável porque os grupos reais de hoje
 * usam `America/Sao_Paulo`, sem DST desde 2019.
 */
export function converterMomentoParaInstanteUtc(
  momento: MomentoPlantao,
  timezone: string,
): string {
  const dataMatch = PADRAO_DATA_ISO.exec(momento.data);
  const horaMatch = PADRAO_HORA.exec(momento.hora);
  if (dataMatch === null || horaMatch === null) {
    throw new Error(`Momento de Plantão inválido: ${momento.data} ${momento.hora}`);
  }
  if (!timezoneValida(timezone)) {
    throw new Error(`Timezone inválida: "${timezone}".`);
  }

  const ano = Number(dataMatch[1]);
  const mes = Number(dataMatch[2]);
  const dia = Number(dataMatch[3]);
  const hora = Number(horaMatch[1]);
  const minuto = Number(horaMatch[2]);

  const chuteUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const dataChute = new Date(chuteUtc);
  const dataCivilValida = (
    dataChute.getUTCFullYear() === ano
    && dataChute.getUTCMonth() === mes - 1
    && dataChute.getUTCDate() === dia
    && hora <= 23
    && minuto <= 59
  );
  if (!dataCivilValida) {
    throw new Error(`Momento de Plantão com data/hora inexistente: ${momento.data} ${momento.hora}`);
  }

  const primeiroOffset = offsetMinutosNaTimezone(timezone, new Date(chuteUtc));
  const segundoOffset = offsetMinutosNaTimezone(timezone, new Date(chuteUtc - primeiroOffset * 60_000));
  const instanteUtc = chuteUtc - segundoOffset * 60_000;
  return new Date(instanteUtc).toISOString();
}

/**
 * Fase ESCALAS-UX-1B.1 — a operação INVERSA de `converterMomentoParaInstanteUtc()`:
 * um instante absoluto (ISO 8601 UTC, o que fica persistido em
 * `AtribuicaoPlantaoPersistida.inicio`/`.fim`) mais o timezone do Grupo
 * voltam a ser o momento civil `{ data, hora }` que o coordenador via no
 * Editor antes de salvar — necessário para reabrir um rascunho existente
 * na MESMA working copy, sem nunca mostrar o instante em UTC como se
 * fosse o horário que a pessoa digitou.
 *
 * Mais simples que a direção direta: um `Date` já representa um instante
 * inequívoco, então basta formatá-lo com `Intl.DateTimeFormat` usando o
 * `timeZone` do Grupo — nenhuma estimativa em duas passadas é necessária
 * (essa técnica só existe na direção direta porque ali o offset ainda é
 * desconhecido no início do cálculo). Determinístico e independente do
 * timezone da máquina que roda o código — nunca usa o timezone padrão do
 * processo/SO.
 */
export function converterInstanteUtcParaMomento(
  instanteUtc: string,
  timezone: string,
): MomentoPlantao {
  const instante = new Date(instanteUtc);
  if (Number.isNaN(instante.getTime())) {
    throw new Error(`Instante UTC inválido: "${instanteUtc}".`);
  }
  if (!timezoneValida(timezone)) {
    throw new Error(`Timezone inválida: "${timezone}".`);
  }

  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

// ---------------------------------------------------------------------------
// Padrão semanal (Fase PLANTAO-PADRAO-1) — helpers puros, sem React/Firebase.
// Consumo real (aplicar o padrão a uma nova atribuição) fica para
// ESCALAS-UX-2B; aqui só a fonte de verdade e consultas.
// ---------------------------------------------------------------------------

/** `HH:mm`, 24h, 00–23/00–59, sempre dois dígitos — mesmo formato de `REGEX_HORARIO` (lib/lembretes.ts), reimplementado aqui porque `packages/contrato` não depende de `lib/`. */
const REGEX_HORARIO_PLANTAO_VALIDO = /^([01]\d|2[0-3]):[0-5]\d$/u;

export function horarioPlantaoValido(horario: string): boolean {
  return REGEX_HORARIO_PLANTAO_VALIDO.test(horario);
}

function minutosDesdeMeiaNoite(horario: string): number {
  const partes = horario.split(':');
  return Number(partes[0] ?? 0) * 60 + Number(partes[1] ?? 0);
}

/**
 * Duração em minutos de uma entrada do padrão semanal — sem `Date`,
 * imune ao timezone da máquina (§ 12 do pedido). `horaInicio`/`horaFim`
 * precisam já ser válidos (`horarioPlantaoValido`) — chamar depois de
 * validar, nunca antes (comportamento indefinido com entrada malformada).
 * `19:00→07:00 +1` = 720min (12h); `19:00→19:00 +1` = 1440min (24h);
 * `19:00→19:00 +0` = 0min (inválido, ver `validarPadraoHorarioSemanal`).
 */
export function duracaoMinutosPadraoHorarioPlantaoDia(
  entrada: Pick<PadraoHorarioPlantaoDia, 'horaInicio' | 'horaFim' | 'fimDiaOffset'>,
): number {
  const inicio = minutosDesdeMeiaNoite(entrada.horaInicio);
  const fim = minutosDesdeMeiaNoite(entrada.horaFim) + entrada.fimDiaOffset * 1440;
  return fim - inicio;
}

/** Sempre `Domingo, Segunda, ..., Sábado` (`DIAS_SEMANA`), independente da ordem de entrada/persistência. */
export function ordenarPadraoHorarioSemanal(
  padrao: readonly PadraoHorarioPlantaoDia[],
): PadraoHorarioPlantaoDia[] {
  return [...padrao].sort((a, b) => a.diaSemana - b.diaSemana);
}

/** `null` = nenhum horário padrão configurado para este dia — nunca uma entrada `00:00→00:00` fingida. */
export function obterPadraoHorarioParaDia(
  padraoHorarioSemanal: readonly PadraoHorarioPlantaoDia[] | undefined,
  diaSemana: DiaSemana,
): PadraoHorarioPlantaoDia | null {
  return padraoHorarioSemanal?.find((entrada) => entrada.diaSemana === diaSemana) ?? null;
}

/**
 * Dia da semana de uma data civil (`AAAA-MM-DD`), determinístico e
 * independente do timezone da máquina que roda o código (§ 18 do pedido)
 * — usa `Date.UTC` diretamente sobre os componentes já extraídos por
 * regex, nunca `new Date("AAAA-MM-DD")` (sujeito a interpretação
 * inconsistente entre ambientes). Mesma convenção de `Date#getUTCDay()`
 * (0 = domingo) já usada por `NOMES_DIA_SEMANA`.
 */
export function diaSemanaCivil(dataCivil: string): DiaSemana {
  const match = PADRAO_DATA_ISO.exec(dataCivil);
  if (match === null) {
    throw new Error(`Data civil inválida: "${dataCivil}" (esperado AAAA-MM-DD).`);
  }
  const [, anoTexto, mesTexto, diaTexto] = match;
  const diaSemana = new Date(Date.UTC(Number(anoTexto), Number(mesTexto) - 1, Number(diaTexto))).getUTCDay();
  return diaSemana as DiaSemana;
}

/**
 * Combinação de `obterPadraoHorarioParaDia()` + `diaSemanaCivil()` — o
 * helper reutilizável real para ESCALAS-UX-2B ("qual o padrão deste Grupo
 * para o dia 2026-08-16?"). Não acopla a React nem a Firebase; recebe só
 * o pedaço do `GrupoPlantao` de que precisa.
 */
export function obterPadraoHorarioGrupoParaData(
  grupo: Pick<GrupoPlantao, 'padraoHorarioSemanal'>,
  dataCivil: string,
): PadraoHorarioPlantaoDia | null {
  return obterPadraoHorarioParaDia(grupo.padraoHorarioSemanal, diaSemanaCivil(dataCivil));
}

/**
 * Valida a estrutura E as regras de negócio explicitamente pedidas (dia
 * 0..6 sem duplicidade, horários `HH:mm`, offset 0/1, duração > 0) — vazio
 * é válido (nenhum padrão configurado). Nenhuma restrição adicional não
 * solicitada (ex.: duração máxima) foi inventada — ver checkpoint desta
 * fase.
 */
export function validarPadraoHorarioSemanal(padrao: readonly PadraoHorarioPlantaoDia[]): string[] {
  const erros: string[] = [];

  if (padrao.length > MAXIMO_DIAS_PADRAO_HORARIO_SEMANAL) {
    erros.push(`O padrão semanal não pode ter mais que ${MAXIMO_DIAS_PADRAO_HORARIO_SEMANAL} dias.`);
  }

  const diasVistos = new Set<number>();
  padrao.forEach((entrada, indice) => {
    const rotulo = `Padrão semanal (item ${indice + 1})`;
    const diaValido = Number.isInteger(entrada.diaSemana) && entrada.diaSemana >= 0 && entrada.diaSemana <= 6;
    if (!diaValido) {
      erros.push(`${rotulo}: dia da semana inválido.`);
    } else if (diasVistos.has(entrada.diaSemana)) {
      erros.push(`${rotulo}: dia da semana duplicado (${NOMES_DIA_SEMANA[entrada.diaSemana]}).`);
    } else {
      diasVistos.add(entrada.diaSemana);
    }

    const inicioValido = horarioPlantaoValido(entrada.horaInicio);
    const fimValido = horarioPlantaoValido(entrada.horaFim);
    if (!inicioValido) {
      erros.push(`${rotulo}: horário de início inválido (use HH:mm).`);
    }
    if (!fimValido) {
      erros.push(`${rotulo}: horário de fim inválido (use HH:mm).`);
    }

    const offsetValido = entrada.fimDiaOffset === 0 || entrada.fimDiaOffset === 1;
    if (!offsetValido) {
      erros.push(`${rotulo}: "termina no dia seguinte" inválido.`);
    }

    if (inicioValido && fimValido && offsetValido && duracaoMinutosPadraoHorarioPlantaoDia(entrada) <= 0) {
      erros.push(`${rotulo}: duração precisa ser maior que zero.`);
    }
  });

  return erros;
}

// ---------------------------------------------------------------------------
// Validações puras (retornam a lista de erros; vazio = válido — mesmo
// padrão de `validarEdicaoUsuario()` em lib/importUsers.ts)
// ---------------------------------------------------------------------------

const TAMANHO_MAXIMO_NOME_GRUPO = 80;
const TAMANHO_MAXIMO_DESCRICAO_GRUPO = 240;
const TAMANHO_MAXIMO_ROTULO_CONTATO = 40;
const TAMANHO_MAXIMO_NUMERO_CONTATO = 30;

export function validarGrupoPlantao(grupo: {
  grupoId: string;
  nome: string;
  descricao?: string;
  equipeResponsavelId: string;
  equipesConsulta: readonly string[];
  unidadeResponsavelId?: string;
  caminhoUnidadeResponsavel?: readonly string[];
  timezone: string;
  padraoHorarioSemanal?: readonly PadraoHorarioPlantaoDia[];
}): string[] {
  const erros: string[] = [];

  if (!idGrupoPlantaoValido(grupo.grupoId)) {
    erros.push('Identificador do grupo inválido (use apenas letras, números, "_" ou "-").');
  }
  if (grupo.nome.trim() === '') {
    erros.push('Informe o nome do grupo de Plantão.');
  } else if (grupo.nome.length > TAMANHO_MAXIMO_NOME_GRUPO) {
    erros.push(`O nome não pode ultrapassar ${TAMANHO_MAXIMO_NOME_GRUPO} caracteres.`);
  }
  if ((grupo.descricao?.length ?? 0) > TAMANHO_MAXIMO_DESCRICAO_GRUPO) {
    erros.push(`A descrição não pode ultrapassar ${TAMANHO_MAXIMO_DESCRICAO_GRUPO} caracteres.`);
  }
  if (grupo.equipeResponsavelId.trim() === '') {
    erros.push('Informe a equipe responsável pelo grupo.');
  }
  if (grupo.equipesConsulta.length === 0) {
    erros.push('Informe ao menos uma equipe autorizada a consultar o grupo.');
  } else if (!grupo.equipesConsulta.includes(grupo.equipeResponsavelId)) {
    erros.push('A equipe responsável precisa estar entre as equipes autorizadas a consultar.');
  }
  if (grupo.caminhoUnidadeResponsavel !== undefined
    && grupo.unidadeResponsavelId !== undefined
    && !grupo.caminhoUnidadeResponsavel.includes(grupo.unidadeResponsavelId)) {
    erros.push('O caminho da unidade responsável precisa incluir a própria unidade responsável.');
  }
  if (!timezoneValida(grupo.timezone)) {
    erros.push(`Timezone inválida: "${grupo.timezone}".`);
  }
  if (grupo.padraoHorarioSemanal !== undefined) {
    erros.push(...validarPadraoHorarioSemanal(grupo.padraoHorarioSemanal));
  }

  return erros;
}

export function validarContatosPlantonista(contatos: readonly ContatoPlantonista[]): string[] {
  const erros: string[] = [];

  if (contatos.length > MAXIMO_CONTATOS_PLANTONISTA) {
    erros.push(`No máximo ${MAXIMO_CONTATOS_PLANTONISTA} contatos por plantonista.`);
  }

  contatos.forEach((contato, indice) => {
    const rotulo = contato.rotulo.trim();
    const numero = contato.numero.trim();
    if (rotulo === '') {
      erros.push(`Contato ${indice + 1}: informe um rótulo.`);
    } else if (rotulo.length > TAMANHO_MAXIMO_ROTULO_CONTATO) {
      erros.push(`Contato ${indice + 1}: rótulo muito longo.`);
    }
    if (numero === '') {
      erros.push(`Contato ${indice + 1}: informe um número.`);
    } else if (numero.length > TAMANHO_MAXIMO_NUMERO_CONTATO) {
      erros.push(`Contato ${indice + 1}: número muito longo.`);
    }
  });

  return erros;
}

/** Remove espaços extras de cada contato — nunca decide validade, só sanitiza. */
export function normalizarContatosPlantonista(
  contatos: readonly ContatoPlantonista[],
): ContatoPlantonista[] {
  return contatos.map((contato) => ({
    rotulo: contato.rotulo.trim(),
    numero: contato.numero.trim(),
    ativo: contato.ativo,
  }));
}

export function validarParticipantePlantao(participante: {
  grupoId: string;
  login: string;
  contatos: readonly ContatoPlantonista[];
}): string[] {
  const erros: string[] = [];

  if (participante.grupoId.trim() === '') {
    erros.push('Informe o grupo de Plantão.');
  }
  if (participante.login.trim() === '') {
    erros.push('Informe o login do plantonista.');
  }
  erros.push(...validarContatosPlantonista(participante.contatos));

  return erros;
}

export function validarCompetenciaPlantao(competencia: {
  grupoId: string;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  status: string;
  origem: string;
}): string[] {
  const erros: string[] = [];

  if (competencia.grupoId.trim() === '') {
    erros.push('Informe o grupo de Plantão.');
  }
  if (!PADRAO_COMPETENCIA.test(competencia.competencia)) {
    erros.push('Competência inválida (use o formato AAAA-MM).');
  }
  if (!PADRAO_DATA_ISO.test(competencia.periodoInicio)) {
    erros.push('Período de início inválido (use o formato AAAA-MM-DD).');
  }
  if (!PADRAO_DATA_ISO.test(competencia.periodoFim)) {
    erros.push('Período de fim inválido (use o formato AAAA-MM-DD).');
  }
  if (competencia.status !== 'RASCUNHO' && competencia.status !== 'PUBLICADA') {
    erros.push(`Status desconhecido: "${competencia.status}".`);
  }
  if (!ORIGENS_PLANTAO_VALIDAS.includes(competencia.origem as OrigemPlantao)) {
    erros.push(`Origem desconhecida: "${competencia.origem}".`);
  }

  return erros;
}

export function validarAtribuicaoPlantaoPersistida(atribuicao: {
  plantonistaLogin: string;
  inicio: string;
  fim: string;
  duracaoMinutos: number;
  origem: string;
  papel: string;
}): string[] {
  const erros: string[] = [];

  if (atribuicao.plantonistaLogin.trim() === '') {
    erros.push('Informe o login do plantonista.');
  }

  const inicioMs = Date.parse(atribuicao.inicio);
  const fimMs = Date.parse(atribuicao.fim);
  const inicioValido = !Number.isNaN(inicioMs);
  const fimValido = !Number.isNaN(fimMs);

  if (!inicioValido) {
    erros.push('Início inválido.');
  }
  if (!fimValido) {
    erros.push('Fim inválido.');
  }
  if (inicioValido && fimValido) {
    if (fimMs <= inicioMs) {
      erros.push('O fim precisa ser posterior ao início.');
    } else {
      const duracaoReal = Math.round((fimMs - inicioMs) / 60_000);
      if (duracaoReal !== atribuicao.duracaoMinutos) {
        erros.push(
          `Duração inconsistente: o intervalo indica ${duracaoReal} min, mas o campo informa `
          + `${atribuicao.duracaoMinutos} min.`,
        );
      }
    }
  }

  if (!ORIGENS_PLANTAO_VALIDAS.includes(atribuicao.origem as OrigemPlantao)) {
    erros.push(`Origem desconhecida: "${atribuicao.origem}".`);
  }
  if (!PAPEIS_PLANTONISTA_VALIDOS.includes(atribuicao.papel as PapelPlantonista)) {
    erros.push(`Papel desconhecido: "${atribuicao.papel}".`);
  }

  return erros;
}
