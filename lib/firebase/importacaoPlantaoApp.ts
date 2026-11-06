import {
  CATALOGO_SOC,
  idCompetenciaPlantao,
  ROTULO_FUNCAO_PLANTAO,
  type FuncaoPlantao,
  type GrupoPlantao,
  type ResultadoParsePlantao,
} from '@escala-ici/contrato';

import {
  aplicarVinculosNasAtribuicoes,
  consolidarParticipantesPlantao,
  contarPendenciasVinculoPlantao,
  iniciarVinculosPlantao,
  type AtribuicaoPlantaoComVinculo,
  type VinculoPlantao,
} from '../conciliacaoPlantoes';
import { criarAtribuicoesEditaveis, resumirDuracoesAtipicas, type GrupoDuracaoAtipica } from '../editorPlantao';
import { processarArquivoImportado } from '../importadorPlanilha';
import {
  montarAtribuicoesPlantaoRascunho,
  montarCompetenciaPlantaoRascunho,
  montarParticipantesPlantaoParaSalvar,
  sugerirCompetenciaPlantao,
} from '../montagemRascunhoPlantao';
import type { Usuario } from '../modelos';
import { listarParticipantesPlantao, obterCompetenciaPlantaoRascunho } from './plantaoReadRepository';
import {
  publicarCompetenciaPlantao,
  salvarAtribuicoesPlantaoRascunho,
  salvarCompetenciaPlantaoRascunho,
  salvarParticipantePlantao,
} from './plantaoWriteRepository';

/**
 * IMPORTAR-PLANTAO-APP-1 — importação rápida de Plantão pelo App, para quem
 * coordena. Usa EXATAMENTE o pipeline do Dashboard (mesmas funções de leitura,
 * vínculo, montagem, rascunho e publicação); só não tem a edição fina. Se a
 * planilha tiver qualquer pendência (pessoa sem vínculo, posto inesperado,
 * erro de leitura), o App salva o rascunho e manda resolver no Dashboard.
 */
export interface PostoImportacaoApp {
  funcao: FuncaoPlantao | null;
  rotulo: string;
  plantoes: number;
  pessoas: number;
}

export interface PreparoImportacaoPlantaoApp {
  grupo: GrupoPlantao;
  nomeArquivo: string;
  resultado: ResultadoParsePlantao;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  vinculos: VinculoPlantao[];
  atribuicoes: AtribuicaoPlantaoComVinculo[];
  totalPlantoes: number;
  totalPessoas: number;
  minutos: number;
  postos: PostoImportacaoApp[];
  atipicas: GrupoDuracaoAtipica[];
  /** Pendências que impedem publicar pelo App (resolver no Dashboard). */
  pendencias: string[];
  nomesSemVinculo: string[];
}

export type ResultadoPreparoImportacaoApp =
  | { ok: true; preparo: PreparoImportacaoPlantaoApp }
  | { ok: false; erro: string };

export function prepararImportacaoPlantaoApp(
  arquivo: ArrayBuffer,
  nomeArquivo: string,
  grupo: GrupoPlantao,
  usuarios: readonly Usuario[],
): ResultadoPreparoImportacaoApp {
  let importado;
  try {
    importado = processarArquivoImportado(arquivo, {
      equipeId: grupo.equipeResponsavelId,
      competencia: '',
      catalogo: CATALOGO_SOC,
      loginParaUid: {},
    });
  } catch {
    return { ok: false, erro: 'Não foi possível ler este arquivo. Envie a planilha em .xls ou .xlsx.' };
  }
  if (importado.tipo !== 'PLANTAO') {
    return { ok: false, erro: 'Esta planilha não é de Plantão. Escalas 6x1 continuam sendo importadas pelo Dashboard.' };
  }
  const resultado = importado.resultado;
  if (resultado.atribuicoes.length === 0) {
    return { ok: false, erro: 'Nenhum plantão encontrado na planilha.' };
  }
  const sugestao = sugerirCompetenciaPlantao(resultado.atribuicoes);
  if (sugestao === null) {
    return { ok: false, erro: 'Não foi possível identificar o mês desta planilha.' };
  }

  const vinculos = iniciarVinculosPlantao(consolidarParticipantesPlantao(resultado), usuarios);
  const atribuicoes = aplicarVinculosNasAtribuicoes(criarAtribuicoesEditaveis(resultado.atribuicoes), vinculos);
  const nomesSemVinculo = vinculos.filter((vinculo) => vinculo.login === null).map((vinculo) => vinculo.participanteNomeOriginal);

  const pendencias: string[] = [];
  if (resultado.erros.length > 0) {
    pendencias.push(`${resultado.erros.length} problema(s) de leitura na planilha.`);
  }
  if (contarPendenciasVinculoPlantao(vinculos) > 0) {
    pendencias.push(`${nomesSemVinculo.length} pessoa(s) da planilha sem cadastro correspondente.`);
  }
  const funcoesEsperadas = grupo.funcoesEsperadas ?? [];
  const funcoesNaPlanilha = [...new Set(resultado.atribuicoes.map((atribuicao) => atribuicao.funcao ?? null))];
  if (funcoesEsperadas.length > 0) {
    const inesperadas = funcoesNaPlanilha.filter((funcao) => funcao === null || !funcoesEsperadas.includes(funcao));
    const faltando = funcoesEsperadas.filter((funcao) => !funcoesNaPlanilha.includes(funcao));
    if (inesperadas.length > 0 || faltando.length > 0) {
      pendencias.push('Os postos da planilha não batem com os postos deste Plantão.');
    }
  } else if (funcoesNaPlanilha.some((funcao) => funcao !== null)) {
    pendencias.push('A planilha tem vários postos, mas este Plantão é de posto único.');
  }

  const postos: PostoImportacaoApp[] = funcoesNaPlanilha.map((funcao) => {
    const doPosto = atribuicoes.filter((atribuicao) => (atribuicao.funcao ?? null) === funcao);
    return {
      funcao,
      rotulo: funcao ? ROTULO_FUNCAO_PLANTAO[funcao] : 'Plantão',
      plantoes: doPosto.length,
      pessoas: new Set(doPosto.map((atribuicao) => atribuicao.plantonistaNomeOriginal)).size,
    };
  });

  return {
    ok: true,
    preparo: {
      grupo,
      nomeArquivo,
      resultado,
      competencia: sugestao.competencia,
      periodoInicio: sugestao.periodoInicio,
      periodoFim: sugestao.periodoFim,
      vinculos,
      atribuicoes,
      totalPlantoes: atribuicoes.length,
      totalPessoas: vinculos.length,
      minutos: atribuicoes.reduce((soma, atribuicao) => soma + atribuicao.duracaoMinutos, 0),
      postos,
      atipicas: resumirDuracoesAtipicas(atribuicoes),
      pendencias,
      nomesSemVinculo,
    },
  };
}

/**
 * Salva o rascunho e, quando pedido e sem pendências, coloca no ar para a
 * equipe. Retorna o estado final. Mesmas funções e mesma ordem do Dashboard.
 */
export async function gravarImportacaoPlantaoApp(
  preparo: PreparoImportacaoPlantaoApp,
  opcoes: { loginAtual: string; nomesPorLogin: Readonly<Record<string, string>>; colocarNoAr: boolean },
): Promise<'NO_AR' | 'SALVO'> {
  const { grupo, competencia } = preparo;
  const agoraIso = new Date().toISOString();
  const origemApp = { origemApp: true };
  const participantesExistentes = await listarParticipantesPlantao(grupo.grupoId);
  const participantes = montarParticipantesPlantaoParaSalvar({
    grupoId: grupo.grupoId,
    vinculos: preparo.vinculos,
    participantesExistentes,
    loginAtual: opcoes.loginAtual,
    agoraIso,
    nomesPorLogin: opcoes.nomesPorLogin,
  });
  const competenciaId = idCompetenciaPlantao(grupo.grupoId, competencia);
  const competenciaExistente = await obterCompetenciaPlantaoRascunho(grupo.grupoId, competencia);
  const competenciaSalva = montarCompetenciaPlantaoRascunho({
    grupoId: grupo.grupoId,
    competencia,
    periodoInicio: preparo.periodoInicio,
    periodoFim: preparo.periodoFim,
    resultado: preparo.resultado,
    origem: 'IMPORTADO',
    loginAtual: opcoes.loginAtual,
    agoraIso,
    competenciaExistente,
  });
  const atribuicoes = montarAtribuicoesPlantaoRascunho({
    grupoId: grupo.grupoId,
    competenciaId,
    atribuicoes: preparo.atribuicoes,
    timezone: grupo.timezone,
    origem: 'IMPORTADO',
    agoraIso,
  });
  for (const participante of participantes) {
    await salvarParticipantePlantao(participante, origemApp);
  }
  await salvarCompetenciaPlantaoRascunho(competenciaSalva, origemApp);
  await salvarAtribuicoesPlantaoRascunho(grupo.grupoId, competenciaId, atribuicoes, origemApp);
  if (!opcoes.colocarNoAr || preparo.pendencias.length > 0) {
    return 'SALVO';
  }
  await publicarCompetenciaPlantao(competenciaSalva, atribuicoes, origemApp);
  return 'NO_AR';
}
