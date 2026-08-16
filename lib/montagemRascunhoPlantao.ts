import {
  converterMomentoParaInstanteUtc,
  idAtribuicaoPlantao,
  idCompetenciaPlantao,
  type AtribuicaoPlantaoBruta,
  type AtribuicaoPlantaoPersistida,
  type CompetenciaPlantao,
  type GrupoPlantao,
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

/**
 * Sugere `competencia`/`periodoInicio`/`periodoFim` a partir da data mais
 * frequente (por mês) entre as atribuições lidas — nunca decide sozinho:
 * é só um valor inicial editável pelo gestor antes de salvar (planilhas reais
 * podem ter uma ou duas linhas "vazando" para o mês seguinte/anterior, ver
 * `docs/spec/PLANTOES.md`). `null` quando não há nenhuma atribuição.
 */
export function sugerirCompetenciaPlantao(
  atribuicoes: readonly AtribuicaoPlantaoBruta[],
): { competencia: string; periodoInicio: string; periodoFim: string } | null {
  if (atribuicoes.length === 0) {
    return null;
  }
  const contagemPorMes = new Map<string, number>();
  for (const atribuicao of atribuicoes) {
    const match = PADRAO_DATA_ISO.exec(atribuicao.inicio.data);
    if (match === null) {
      continue;
    }
    const mesChave = `${match[1]}-${match[2]}`;
    contagemPorMes.set(mesChave, (contagemPorMes.get(mesChave) ?? 0) + 1);
  }
  if (contagemPorMes.size === 0) {
    return null;
  }
  const [competencia] = [...contagemPorMes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (competencia === undefined) {
    return null;
  }
  const [anoTexto, mesTexto] = competencia.split('-');
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return {
    competencia,
    periodoInicio: `${competencia}-01`,
    periodoFim: `${competencia}-${String(ultimoDia).padStart(2, '0')}`,
  };
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
  loginAtual: string;
  agoraIso: string;
  competenciaExistente: CompetenciaPlantao | null;
}): CompetenciaPlantao {
  const { grupoId, competencia, periodoInicio, periodoFim, resultado, loginAtual, agoraIso, competenciaExistente } = opcoes;
  const id = idCompetenciaPlantao(grupoId, competencia);
  return {
    id,
    grupoId,
    competencia,
    periodoInicio,
    periodoFim,
    status: 'RASCUNHO',
    revisao: 0,
    origem: 'IMPORTADO',
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
  agoraIso: string;
}): AtribuicaoPlantaoPersistida[] {
  const { grupoId, competenciaId, atribuicoes, timezone, agoraIso } = opcoes;
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
      origem: 'IMPORTADO',
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
