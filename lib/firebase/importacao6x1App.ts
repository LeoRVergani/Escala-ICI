import {
  parsePlanilhaEscala,
  temErroBloqueante,
  type ErroImportacao,
  type ResultadoParse,
  type TipoTurno,
} from '@escala-ici/contrato';

import {
  conciliarPlanilha,
  contarPendenciasConciliacao,
  loginParaUidComConciliacao,
  publicacaoBloqueadaPorConciliacao,
} from '../conciliacaoUsuarios';
import { processarArquivoImportado } from '../importadorPlanilha';
import { mapaLogins } from '../importUsers';
import type { LinhaConciliacao, Usuario } from '../modelos';
import { listarUsuarios } from './readRepository';
import { publicarEscalas, salvarRascunho } from './writeRepository';

/**
 * IMPORTAR-6X1-APP-1 — único caminho do App para o coordenador importar a
 * escala 6x1 do mês. MESMO pipeline do Dashboard: leitura da planilha com
 * logins/apelidos, conciliação de nomes (relê com o mapa estendido),
 * rascunho e publicação. Marca `origemApp` — as Rules decidem quem grava.
 * Pendência que o celular não resolve (nome sem cadastro, erro bloqueante)
 * → salva o rascunho e manda resolver no Dashboard.
 */
export interface PreparoImportacao6x1App {
  equipeId: string;
  competencia: string;
  nomeArquivo: string;
  resultado: ResultadoParse;
  linhas: LinhaConciliacao[];
  pessoas: number;
  pendenciasNomes: number;
  nomesPendentes: string[];
  errosBloqueantes: ErroImportacao[];
  outrosAvisos: string[];
  podePublicar: boolean;
}

export type ResultadoPreparoImportacao6x1App =
  | { tipo: 'OK'; preparo: PreparoImportacao6x1App }
  | { tipo: 'NAO_6X1'; motivo: string };

export async function prepararImportacao6x1App(
  arquivo: ArrayBuffer,
  nomeArquivo: string,
  equipeId: string,
  competencia: string,
  catalogo: Record<string, TipoTurno>,
): Promise<ResultadoPreparoImportacao6x1App> {
  const usuarios = await listarUsuarios(equipeId);
  const opcoes = { equipeId, competencia, catalogo, loginParaUid: mapaLogins(usuarios) };
  const processado = processarArquivoImportado(arquivo, opcoes);
  if (processado.tipo === 'PLANTAO') {
    return { tipo: 'NAO_6X1', motivo: 'Esta planilha é de Plantão. Importe-a na aba do Plantão.' };
  }
  if (processado.tipo !== 'ESCALA_6X1') {
    return { tipo: 'NAO_6X1', motivo: processado.motivo || 'Não reconheci esta planilha como uma escala 6x1.' };
  }

  // Igual ao Dashboard: concilia os nomes e, se algo se resolver, relê com o mapa estendido.
  const linhas = conciliarPlanilha(processado.resultado.documentos.map((documento) => documento.login), usuarios);
  const resultado = linhas.some((linha) => linha.login !== null)
    ? parsePlanilhaEscala(arquivo, { ...opcoes, loginParaUid: loginParaUidComConciliacao(mapaLogins(usuarios), linhas) })
    : processado.resultado;

  const errosBloqueantes = resultado.erros.filter((erro) => erro.severidade === 'BLOQUEANTE');
  const outrosAvisos = [
    ...resultado.erros.filter((erro) => erro.severidade !== 'BLOQUEANTE').map((erro) => erro.motivo),
    ...resultado.avisos,
  ];
  const pendenciasNomes = contarPendenciasConciliacao(linhas);
  return {
    tipo: 'OK',
    preparo: {
      equipeId,
      competencia,
      nomeArquivo,
      resultado,
      linhas,
      pessoas: resultado.documentos.length,
      pendenciasNomes,
      nomesPendentes: linhas.filter((linha) => linha.login === null && linha.status !== 'IGNORADA').map((linha) => linha.nomePlanilha),
      errosBloqueantes,
      outrosAvisos: [...new Set(outrosAvisos)].slice(0, 12),
      podePublicar: resultado.documentos.length > 0
        && !temErroBloqueante(resultado.erros)
        && !publicacaoBloqueadaPorConciliacao(linhas),
    },
  };
}

/** Salva o rascunho e, se pedido e permitido, publica. */
export async function gravarImportacao6x1App(
  preparo: PreparoImportacao6x1App,
  autor: Usuario,
  publicar: boolean,
): Promise<{ publicado: boolean }> {
  if (preparo.resultado.documentos.length === 0) {
    throw new Error('A planilha não tem ninguém da equipe para importar.');
  }
  await salvarRascunho(preparo.resultado, autor, preparo.nomeArquivo, { origemApp: true });
  if (!publicar || !preparo.podePublicar) return { publicado: false };
  await publicarEscalas(
    preparo.resultado.documentos,
    autor.login,
    'Importação pelo App',
    preparo.resultado.erros,
    { origemApp: true },
  );
  return { publicado: true };
}
