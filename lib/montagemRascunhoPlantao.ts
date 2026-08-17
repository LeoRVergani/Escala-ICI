import {
  adicionarDias,
  competenciaOperacional,
  converterInstanteUtcParaMomento,
  converterMomentoParaInstanteUtc,
  idAtribuicaoPlantao,
  idCompetenciaPlantao,
  ordenarPadraoHorarioSemanal,
  type AtribuicaoPlantaoBruta,
  type AtribuicaoPlantaoPersistida,
  type CompetenciaPlantao,
  type GrupoPlantao,
  type OrigemPlantao,
  type PadraoHorarioPlantaoDia,
  type ParticipantePlantao,
  type ResultadoParsePlantao,
} from '@escala-ici/contrato';
import { nomeParticipantePlantao, vinculosDeParticipantesGrupoPlantao, type AtribuicaoPlantaoComVinculo, type VinculoPlantao } from './conciliacaoPlantoes';
import {
  criarAtribuicaoEditavelDeCompetenciaAnterior,
  criarAtribuicaoEditavelDePersistida,
  type AtribuicaoPlantaoEditavel,
} from './editorPlantao';
import type { Usuario } from './modelos';

/**
 * Fase PLANTÃO-3B — ponte pura entre a prévia validada de Plantão (Fase
 * PLANTÃO-2, `resultadoPlantao`/`vinculosPlantao` do Dashboard) e o modelo
 * persistente (Fase PLANTÃO-3A, `GrupoPlantao`/`ParticipantePlantao`/
 * `CompetenciaPlantao`/`AtribuicaoPlantaoPersistida`). Módulo puro: sem SDK
 * do Firestore, sem React — só transforma dados já validados em memória
 * para o formato que `lib/firebase/plantaoWriteRepository.ts` grava. Nunca
 * decide vínculo (isso é `lib/conciliacaoPlantoes.ts`) nem decide o schema
 * (isso é `@escala-ici/contrato`); só monta os objetos finais.
 */

const PADRAO_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/u;

function mesAnoValidos(ano: number, mes: number): boolean {
  return Number.isInteger(ano) && Number.isInteger(mes) && mes >= 1 && mes <= 12;
}

/**
 * A competência operacional do Escala ICI vai do dia 26 de um mês até o dia
 * 25 do mês seguinte — rótulo `AAAA-MM` sempre igual ao mês em que termina
 * (mesmo princípio de `COMPETENCIA_ATUAL` em `lib/sessao.ts` e do período
 * real da escala 6x1, ex.: `periodoInicio: '2026-07-26'`/`periodoFim:
 * '2026-08-25'` para a competência `'2026-08'`). Fase ESCALAS-UX-1A —
 * antes desta fase, `sugerirCompetenciaPlantao()` calculava um mês
 * calendário (dia 1 ao último dia), divergindo dessa convenção; corrigido
 * aqui porque o Editor visual precisa distinguir "dia de contexto" (antes
 * do 26 ou depois do 25) de "dia da competência" de verdade.
 *
 * A regra de rollover em si (`dia <= 25` fica no próprio mês, `dia >= 26`
 * vira competência do mês seguinte) já existe como `competenciaOperacional()`
 * (`packages/contrato/src/jornada.ts`, usada pela Escala 6x1/`EmployeeApp`)
 * — reaproveitada aqui em vez de reimplementada, para as duas escalas nunca
 * divergirem sobre o que é "dia 26". A única coisa que esta função
 * acrescenta é a validação defensiva: `competenciaOperacional()` lança para
 * data malformada (correto para dado já confiável da 6x1), mas uma
 * planilha de Plantão importada pode ter uma linha com data quebrada — aqui
 * isso vira `null` (linha ignorada pelo chamador), nunca uma exceção que
 * derruba a importação inteira.
 */
export function competenciaDoDia(dataIso: string): string | null {
  const match = PADRAO_DATA_ISO.exec(dataIso);
  if (match === null) {
    return null;
  }
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (!mesAnoValidos(ano, mes)) {
    return null;
  }
  return competenciaOperacional(dataIso);
}

/**
 * `periodoInicio` é sempre dia 26 do mês ANTERIOR ao rótulo da competência;
 * `periodoFim` é sempre dia 25 do próprio mês do rótulo — nunca depende de
 * quantos dias o mês tem (diferente do cálculo antigo de "último dia do
 * mês calendário").
 */
export function periodoDaCompetencia(competencia: string): { periodoInicio: string; periodoFim: string } | null {
  const match = /^(\d{4})-(\d{2})$/u.exec(competencia);
  if (match === null) {
    return null;
  }
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (!mesAnoValidos(ano, mes)) {
    return null;
  }
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoDoMesAnterior = mes === 1 ? ano - 1 : ano;
  return {
    periodoInicio: `${String(anoDoMesAnterior).padStart(4, '0')}-${String(mesAnterior).padStart(2, '0')}-26`,
    periodoFim: `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-25`,
  };
}

/**
 * Fase ESCALAS-UX-2B.1 — `true` só quando `dataIso` está DENTRO do
 * período real da competência (`periodoInicio <= dataIso <= periodoFim`,
 * comparação lexicográfica, válida porque as três são sempre `AAAA-MM-DD`)
 * — reaproveita `periodoDaCompetencia()`, nunca um segundo cálculo 26→25.
 * `competencia`/`dataIso` inválidos retornam `false` (nunca lançam,
 * nunca assumem um período "default").
 *
 * Único gate de "esta data pode iniciar uma NOVA atribuição de Plantão
 * criada pela UI" (click/drag/quick-add — ver `solicitarNovaAtribuicaoPlantao()`
 * em `DashboardApp.tsx`). Nunca usado para filtrar/normalizar atribuições
 * JÁ existentes — dias de contexto continuam mostrando o que já está lá
 * (ex.: a borda real de 43h que começa um dia antes do início da janela).
 */
export function dataPertenceCompetencia(dataIso: string, competencia: string): boolean {
  if (!PADRAO_DATA_ISO.test(dataIso)) {
    return false;
  }
  const periodo = periodoDaCompetencia(competencia);
  if (periodo === null) {
    return false;
  }
  return dataIso >= periodo.periodoInicio && dataIso <= periodo.periodoFim;
}

/**
 * Fase ESCALAS-UX-1C — o rótulo `AAAA-MM` da competência imediatamente
 * ANTERIOR a `competencia` (nunca "a competência anterior mais recente
 * que existir" — "Usar período anterior" é sempre o mês civil-de-rótulo
 * exatamente anterior; se essa competência específica não tiver rascunho
 * salvo, § 11 desta fase manda mostrar "Não existe uma escala anterior",
 * nunca procurar mais para trás). Mesma aritmética de decremento de
 * mês/ano já usada em `periodoDaCompetencia()` — não reinventada.
 * Determinístico, nunca depende da data da máquina.
 */
export function competenciaAnterior(competencia: string): string | null {
  const match = /^(\d{4})-(\d{2})$/u.exec(competencia);
  if (match === null) {
    return null;
  }
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (!mesAnoValidos(ano, mes)) {
    return null;
  }
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  return `${String(anoAnterior).padStart(4, '0')}-${String(mesAnterior).padStart(2, '0')}`;
}

/**
 * Fase ESCALAS-UX-1B — os dois únicos campos obrigatórios de "+ Nova
 * escala" → Plantão → "Criar escala vazia": Grupo e competência (janela
 * 26→25 válida). Nunca pede timezone/ACL/participantes aqui — isso é
 * configuração do Grupo, resolvida automaticamente a partir dele.
 */
export function validarNovoPlantaoEmBranco(entrada: { grupoId: string; competencia: string }): string[] {
  const erros: string[] = [];
  if (entrada.grupoId.trim() === '') {
    erros.push('Selecione um Grupo de Plantão.');
  }
  if (periodoDaCompetencia(entrada.competencia.trim()) === null) {
    erros.push('Informe a competência no formato AAAA-MM.');
  }
  return erros;
}

/**
 * Sugere `competencia`/`periodoInicio`/`periodoFim` a partir da competência
 * (janela 26→25) mais frequente entre as atribuições lidas — nunca decide
 * sozinho: é só um valor inicial editável pelo gestor antes de salvar
 * (planilhas reais podem ter uma ou duas linhas "vazando" para os dias de
 * contexto antes do 26/depois do 25, ver `docs/spec/PLANTOES.md`). `null`
 * quando não há nenhuma atribuição.
 */
export function sugerirCompetenciaPlantao(
  atribuicoes: readonly AtribuicaoPlantaoBruta[],
): { competencia: string; periodoInicio: string; periodoFim: string } | null {
  if (atribuicoes.length === 0) {
    return null;
  }
  const contagemPorCompetencia = new Map<string, number>();
  for (const atribuicao of atribuicoes) {
    const competencia = competenciaDoDia(atribuicao.inicio.data);
    if (competencia === null) {
      continue;
    }
    contagemPorCompetencia.set(competencia, (contagemPorCompetencia.get(competencia) ?? 0) + 1);
  }
  if (contagemPorCompetencia.size === 0) {
    return null;
  }
  const [competencia] = [...contagemPorCompetencia.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (competencia === undefined) {
    return null;
  }
  const periodo = periodoDaCompetencia(competencia);
  if (periodo === null) {
    return null;
  }
  return { competencia, ...periodo };
}

/**
 * Monta os participantes a gravar a partir dos vínculos confirmados —
 * preserva `contatos`/`ordem` de quem já era participante do grupo (nunca
 * apaga contato cadastrado por reimportar a mesma planilha) e cria contatos
 * vazios só para quem é novo. Ignora vínculos sem `login` (a prévia validada
 * garante que isso não acontece, mas a função não assume — filtra mesmo
 * assim, defensivamente, sem lançar).
 */
export function montarParticipantesPlantaoParaSalvar(opcoes: {
  grupoId: string;
  vinculos: readonly VinculoPlantao[];
  participantesExistentes: readonly ParticipantePlantao[];
  loginAtual: string;
  agoraIso: string;
}): ParticipantePlantao[] {
  const { grupoId, vinculos, participantesExistentes, loginAtual, agoraIso } = opcoes;
  const existentesPorLogin = new Map(participantesExistentes.map((item) => [item.login, item]));
  const logins = [...new Set(
    vinculos.map((vinculo) => vinculo.login).filter((login): login is string => login !== null),
  )];

  return logins.map((login, indice) => {
    const existente = existentesPorLogin.get(login);
    if (existente !== undefined) {
      return { ...existente, ativo: true, atualizadoEm: agoraIso };
    }
    const novo: ParticipantePlantao = {
      grupoId,
      login,
      ativo: true,
      ordem: indice,
      contatos: [],
      schemaVersion: 1,
      criadoPorLogin: loginAtual,
      criadoEm: agoraIso,
      atualizadoEm: agoraIso,
    };
    return novo;
  });
}

export function montarCompetenciaPlantaoRascunho(opcoes: {
  grupoId: string;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  resultado: Pick<ResultadoParsePlantao, 'totalBrutoCalculado' | 'totaisInformados'>;
  /** Fase ESCALAS-UX-1B — `'MANUAL'` para uma escala criada vazia pelo Editor, `'IMPORTADO'` para uma vinda de planilha. Nunca hardcoded: o chamador sempre decide, nunca uma XLS vazia fingida. */
  origem: OrigemPlantao;
  loginAtual: string;
  agoraIso: string;
  competenciaExistente: CompetenciaPlantao | null;
}): CompetenciaPlantao {
  const { grupoId, competencia, periodoInicio, periodoFim, resultado, origem, loginAtual, agoraIso, competenciaExistente } = opcoes;
  const id = idCompetenciaPlantao(grupoId, competencia);
  return {
    id,
    grupoId,
    competencia,
    periodoInicio,
    periodoFim,
    status: 'RASCUNHO',
    revisao: 0,
    origem,
    totaisInformadosOrigem: resultado.totaisInformados === null
      ? null
      : {
        totalPlantoesInformado: resultado.totaisInformados.totalPlantoesInformado,
        totalMinutosInformado: resultado.totaisInformados.totalMinutosInformado,
      },
    totalBruto: {
      quantidade: resultado.totalBrutoCalculado.quantidade,
      minutos: resultado.totalBrutoCalculado.minutos,
    },
    schemaVersion: 1,
    criadoPorLogin: competenciaExistente?.criadoPorLogin ?? loginAtual,
    criadoEm: competenciaExistente?.criadoEm ?? agoraIso,
    atualizadoEm: agoraIso,
  };
}

/**
 * Monta as atribuições persistidas na MESMA ordem de `atribuicoes` — o
 * `atribuicaoId` sequencial (`idAtribuicaoPlantao`) depende dessa ordem para
 * ser determinístico: reimportar a mesma planilha, na mesma ordem, sobrescreve
 * os mesmos IDs em vez de duplicar (ver `salvarAtribuicoesPlantaoRascunho`).
 * Lança se alguma atribuição não tiver `loginVinculado` — chamar só depois de
 * `previaPlantaoValidavel()` confirmar que todo vínculo está `VINCULADO`.
 */
export function montarAtribuicoesPlantaoRascunho(opcoes: {
  grupoId: string;
  competenciaId: string;
  atribuicoes: readonly AtribuicaoPlantaoComVinculo[];
  timezone: string;
  /** Fase ESCALAS-UX-1B — mesma origem da competência (`montarCompetenciaPlantaoRascunho`); nunca hardcoded. */
  origem: OrigemPlantao;
  agoraIso: string;
}): AtribuicaoPlantaoPersistida[] {
  const { grupoId, competenciaId, atribuicoes, timezone, origem, agoraIso } = opcoes;
  return atribuicoes.map((atribuicao, indice) => {
    if (atribuicao.loginVinculado === null) {
      throw new Error(
        `Atribuição ${indice + 1} (${atribuicao.plantonistaNomeOriginal}) não tem um login vinculado — `
        + 'valide a prévia antes de montar o rascunho.',
      );
    }
    return {
      atribuicaoId: idAtribuicaoPlantao(indice),
      grupoId,
      competenciaId,
      plantonistaLogin: atribuicao.loginVinculado,
      inicio: converterMomentoParaInstanteUtc(atribuicao.inicio, timezone),
      fim: converterMomentoParaInstanteUtc(atribuicao.fim, timezone),
      duracaoMinutos: atribuicao.duracaoMinutos,
      papel: 'PRIMARIO',
      origem,
      revisao: 0,
      schemaVersion: 1,
      criadoEm: agoraIso,
      atualizadoEm: agoraIso,
    };
  });
}

/**
 * Normaliza os campos de um `GrupoPlantao` antes de salvar — mesmo
 * princípio de `equipesConsultaEfetivas()`. `padraoHorarioSemanal` é
 * OPCIONAL (Fase PLANTAO-PADRAO-1): quando omitido, preserva o que já
 * existia no grupo (edição sem tocar o padrão); passar explicitamente
 * `[]` remove o padrão de vez. Sempre ordenado (`ordenarPadraoHorarioSemanal`)
 * antes de gravar — a persistência nunca depende da ordem em que o
 * formulário enviou as entradas.
 */
export function montarGrupoPlantaoParaSalvar(opcoes: {
  grupoExistente: GrupoPlantao | null;
  grupoId: string;
  nome: string;
  descricao: string;
  equipeResponsavelId: string;
  equipesConsulta: readonly string[];
  timezone: string;
  ativo: boolean;
  loginAtual: string;
  agoraIso: string;
  padraoHorarioSemanal?: readonly PadraoHorarioPlantaoDia[];
}): GrupoPlantao {
  const {
    grupoExistente, grupoId, nome, descricao, equipeResponsavelId, equipesConsulta,
    timezone, ativo, loginAtual, agoraIso, padraoHorarioSemanal,
  } = opcoes;
  const padraoFinal = padraoHorarioSemanal ?? grupoExistente?.padraoHorarioSemanal;
  return {
    grupoId,
    nome,
    descricao: descricao.trim() === '' ? undefined : descricao,
    equipeResponsavelId,
    equipesConsulta: [...equipesConsulta],
    timezone,
    ativo,
    padraoHorarioSemanal: padraoFinal === undefined || padraoFinal.length === 0
      ? undefined
      : ordenarPadraoHorarioSemanal(padraoFinal),
    schemaVersion: 1,
    criadoPorLogin: grupoExistente?.criadoPorLogin ?? loginAtual,
    criadoEm: grupoExistente?.criadoEm ?? agoraIso,
    atualizadoEm: agoraIso,
  };
}

export interface RascunhoPlantaoReidratado {
  grupo: GrupoPlantao;
  competencia: CompetenciaPlantao;
  origem: OrigemPlantao;
  atribuicoesEditaveis: AtribuicaoPlantaoEditavel[];
  vinculos: VinculoPlantao[];
  /** Sempre `false` — reabrir um rascunho nunca começa "sujo" (ver docs/spec/EDITOR_ESCALAS.md § 10). */
  dirtyInicial: false;
}

/**
 * Fase ESCALAS-UX-1B.1 — a operação inversa de `montarAtribuicoesPlantaoRascunho()`/
 * `montarCompetenciaPlantaoRascunho()`: converte o que está persistido
 * (`CompetenciaPlantao` + `AtribuicaoPlantaoPersistida[]` + `GrupoPlantao`)
 * de volta na MESMA working copy que o Editor sempre usa
 * (`AtribuicaoPlantaoEditavel[]`, `lib/editorPlantao.ts`) — nunca um
 * segundo tipo de working copy, nunca um segundo Editor.
 *
 * Preserva a `origem` exatamente como foi persistida (`IMPORTADO` continua
 * `IMPORTADO`, `MANUAL` continua `MANUAL` — nunca "tudo vira MANUAL por
 * ter sido reaberto"). Para `IMPORTADO`, a "Conferência da fonte" (as três
 * camadas de verdade da planilha original) NÃO pode ser reconstruída — o
 * modelo persistido nunca guardou a contabilidade por plantonista
 * declarada na fonte, só os dois agregados da competência
 * (`totalBruto`/`totaisInformadosOrigem`, já usados para outra coisa); o
 * chamador deve manter `resultadoPlantao = null` mesmo quando `origem ===
 * 'IMPORTADO'` — exatamente o comportamento já usado hoje para `MANUAL`
 * (ver docs/spec/PLANTOES.md § 26.2, limitação registrada, não inventada
 * silenciosamente).
 *
 * `participantes` deve incluir TODOS os participantes do grupo (ativos e
 * inativos) — uma atribuição persistida pode referenciar um login que foi
 * desativado depois de salva; ela precisa continuar aparecendo (nunca
 * apagada), então o nome dela precisa ser resolvido de qualquer jeito.
 * `vinculos` (o que autoriza "Salvar rascunho") só considera os
 * participantes ATIVOS — reativar alguém é responsabilidade da tela
 * "Plantões", não do Editor.
 *
 * Módulo puro: sem React, sem Firebase — quem chama já leu tudo via
 * `plantaoReadRepository.ts`.
 */
export function reidratarRascunhoPlantao(dados: {
  grupo: GrupoPlantao;
  competencia: CompetenciaPlantao;
  atribuicoesPersistidas: readonly AtribuicaoPlantaoPersistida[];
  participantes: readonly ParticipantePlantao[];
  usuarios: readonly Usuario[];
}): RascunhoPlantaoReidratado {
  const { grupo, competencia, atribuicoesPersistidas, participantes, usuarios } = dados;
  const participantePorLogin = new Map(participantes.map((item) => [item.login, item] as const));

  const atribuicoesEditaveis = atribuicoesPersistidas.map((persistida) => {
    const participante = participantePorLogin.get(persistida.plantonistaLogin);
    const nomeOriginal = participante !== undefined
      ? nomeParticipantePlantao(participante, usuarios)
      : (usuarios.find((usuario) => usuario.login === persistida.plantonistaLogin)?.nome ?? persistida.plantonistaLogin);
    return criarAtribuicaoEditavelDePersistida({
      atribuicaoId: persistida.atribuicaoId,
      plantonistaNomeOriginal: nomeOriginal,
      inicio: converterInstanteUtcParaMomento(persistida.inicio, grupo.timezone),
      fim: converterInstanteUtcParaMomento(persistida.fim, grupo.timezone),
      duracaoMinutos: persistida.duracaoMinutos,
    });
  });

  const participantesAtivos = participantes.filter((item) => item.ativo);
  const vinculos = vinculosDeParticipantesGrupoPlantao(participantesAtivos, usuarios);

  return {
    grupo,
    competencia,
    origem: competencia.origem,
    atribuicoesEditaveis,
    vinculos,
    dirtyInicial: false,
  };
}

function diasEntreDatasIso(dataA: string, dataB: string): number {
  const [anoA, mesA, diaA] = dataA.split('-').map(Number);
  const [anoB, mesB, diaB] = dataB.split('-').map(Number);
  const utcA = Date.UTC(anoA, mesA - 1, diaA);
  const utcB = Date.UTC(anoB, mesB - 1, diaB);
  return Math.round((utcB - utcA) / 86_400_000);
}

export interface CopiaCompetenciaAnteriorResultado {
  atribuicoes: AtribuicaoPlantaoEditavel[];
  /** Quantidade de atribuições da competência anterior que não couberam na nova janela — nunca truncadas/inventadas em silêncio, só contadas para o aviso na UI. */
  quantidadeNaoCopiada: number;
}

/**
 * Fase ESCALAS-UX-1C — "Usar período anterior": traduz as atribuições de
 * uma competência anterior JÁ PERSISTIDA para uma working copy nova,
 * ainda não persistida, pronta para a competência ATUAL.
 *
 * Estratégia de tradução de datas (§ 13 da fase — preservar a POSIÇÃO
 * RELATIVA dentro da competência, nunca "+31 dias"): para cada
 * atribuição, calcula `offsetInicio` = quantos dias o início dela está
 * depois de `periodoAnteriorInicio` (pode ser negativo — dia de
 * contexto antes do dia 26, como a borda real de 43h da fixture) e
 * `spanDias` = quantos dias de duração ela tem (início→fim, geralmente
 * 0 ou 1, até maior para os 24h/43h). A nova data de início é
 * `periodoNovoInicio + offsetInicio` dias; a nova data de fim é
 * `novaDataInicio + spanDias` dias — nunca um offset recalculado
 * independentemente para o fim, para o "tamanho" da atribuição (e por
 * tabela sua `duracaoMinutos`) ser preservado EXATAMENTE, sem nenhuma
 * normalização de horário atípico (43h/5h continuam 43h/5h).
 *
 * Competências com quantidades de dias diferentes (§ 14 — 28/29/30/31
 * dias, dependendo de qual mês cai entre os dias 26 e 25): uma
 * atribuição cujo novo início cai fora da nova janela (mesma tolerância
 * de "dia de contexto" de 1 dia antes/depois já usada em
 * `ehDiaDeContexto()`) não é copiada — só contada em
 * `quantidadeNaoCopiada`, nunca truncada/deslocada/inventada em
 * silêncio. Determinístico: a mesma entrada sempre produz a mesma
 * saída.
 *
 * Preserva o login do plantonista quando ele ainda é um participante
 * conhecido (ativo ou não — nunca troca automaticamente por outra
 * pessoa, § 17/§ 18); a resolução de vínculo (quem está ativo vs. quem
 * precisa de confirmação) é responsabilidade de
 * `vinculosDeCopiaAnterior()` (`lib/conciliacaoPlantoes.ts`), não desta
 * função. Módulo puro: sem React, sem Firebase.
 */
export function copiarAtribuicoesParaNovaCompetencia(dados: {
  atribuicoesAnteriores: readonly AtribuicaoPlantaoPersistida[];
  periodoAnteriorInicio: string;
  periodoNovoInicio: string;
  periodoNovoFim: string;
  timezone: string;
  participantes: readonly ParticipantePlantao[];
  usuarios: readonly Usuario[];
}): CopiaCompetenciaAnteriorResultado {
  const {
    atribuicoesAnteriores, periodoAnteriorInicio, periodoNovoInicio, periodoNovoFim,
    timezone, participantes, usuarios,
  } = dados;
  const participantePorLogin = new Map(participantes.map((item) => [item.login, item] as const));
  const limiteInferior = adicionarDias(periodoNovoInicio, -1);
  const limiteSuperior = adicionarDias(periodoNovoFim, 1);

  const atribuicoesCopiadas: AtribuicaoPlantaoEditavel[] = [];
  let quantidadeNaoCopiada = 0;

  for (const persistida of atribuicoesAnteriores) {
    const inicioCivil = converterInstanteUtcParaMomento(persistida.inicio, timezone);
    const fimCivil = converterInstanteUtcParaMomento(persistida.fim, timezone);
    const offsetInicio = diasEntreDatasIso(periodoAnteriorInicio, inicioCivil.data);
    const spanDias = diasEntreDatasIso(inicioCivil.data, fimCivil.data);
    const novaDataInicio = adicionarDias(periodoNovoInicio, offsetInicio);

    if (novaDataInicio < limiteInferior || novaDataInicio > limiteSuperior) {
      quantidadeNaoCopiada += 1;
      continue;
    }

    const novaDataFim = adicionarDias(novaDataInicio, spanDias);
    const participante = participantePorLogin.get(persistida.plantonistaLogin);
    const nomeOriginal = participante !== undefined
      ? nomeParticipantePlantao(participante, usuarios)
      : (usuarios.find((usuario) => usuario.login === persistida.plantonistaLogin)?.nome ?? persistida.plantonistaLogin);

    atribuicoesCopiadas.push(criarAtribuicaoEditavelDeCompetenciaAnterior({
      indice: atribuicoesCopiadas.length,
      plantonistaNomeOriginal: nomeOriginal,
      inicio: { data: novaDataInicio, hora: inicioCivil.hora },
      fim: { data: novaDataFim, hora: fimCivil.hora },
      duracaoMinutos: persistida.duracaoMinutos,
    }));
  }

  return { atribuicoes: atribuicoesCopiadas, quantidadeNaoCopiada };
}
