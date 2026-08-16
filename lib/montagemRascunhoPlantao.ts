import {
  competenciaOperacional,
  converterMomentoParaInstanteUtc,
  idAtribuicaoPlantao,
  idCompetenciaPlantao,
  type AtribuicaoPlantaoBruta,
  type AtribuicaoPlantaoPersistida,
  type CompetenciaPlantao,
  type GrupoPlantao,
  type OrigemPlantao,
  type ParticipantePlantao,
  type ResultadoParsePlantao,
} from '@escala-ici/contrato';
import type { AtribuicaoPlantaoComVinculo, VinculoPlantao } from './conciliacaoPlantoes';

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

/** Normaliza os campos de um `GrupoPlantao` antes de salvar — mesmo princípio de `equipesConsultaEfetivas()`. */
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
}): GrupoPlantao {
  const {
    grupoExistente, grupoId, nome, descricao, equipeResponsavelId, equipesConsulta,
    timezone, ativo, loginAtual, agoraIso,
  } = opcoes;
  return {
    grupoId,
    nome,
    descricao: descricao.trim() === '' ? undefined : descricao,
    equipeResponsavelId,
    equipesConsulta: [...equipesConsulta],
    timezone,
    ativo,
    schemaVersion: 1,
    criadoPorLogin: grupoExistente?.criadoPorLogin ?? loginAtual,
    criadoEm: grupoExistente?.criadoEm ?? agoraIso,
    atualizadoEm: agoraIso,
  };
}
