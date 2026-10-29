import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { CATALOGO_SOC } from '@escala-ici/contrato';

import { processarArquivoImportado } from '../lib/importadorPlanilha';
import { analisarCompetenciaImportacaoPlantao } from '../lib/montagemRascunhoPlantao';

function carregarArrayBuffer(caminho: string): ArrayBuffer {
  const bytes = readFileSync(caminho);
  return Uint8Array.from(bytes).buffer;
}

function resumir(caminho: string) {
  const arquivo = carregarArrayBuffer(caminho);
  let resultado = processarArquivoImportado(arquivo, {
    equipeId: 'VALIDACAO_REAL',
    competencia: '2026-09',
    catalogo: CATALOGO_SOC,
    loginParaUid: {},
  });
  // A validação de estrutura não depende do diretório real do Firebase.
  // Reprocessa Jornadas simulando os logins encontrados como já vinculados,
  // para separar erro de fonte (ex.: turno duplicado) de simples ausência no
  // mapa local usado por este script offline.
  let loginsSimulados = 0;
  if (resultado.tipo === 'ESCALA_6X1') {
    const logins = [...new Set(
      resultado.resultado.erros
        .map((erro) => erro.login)
        .filter((login): login is string => login !== undefined && login !== ''),
    )];
    loginsSimulados = logins.length;
    if (logins.length > 0) {
      resultado = processarArquivoImportado(arquivo, {
        equipeId: 'VALIDACAO_REAL',
        competencia: '2026-09',
        catalogo: CATALOGO_SOC,
        loginParaUid: Object.fromEntries(logins.map((login) => [login, `validacao-${login}`])),
      });
    }
  }
  if (resultado.tipo === 'DESCONHECIDA') {
    return { arquivo: basename(caminho), tipo: resultado.tipo, motivo: resultado.motivo };
  }
  if (resultado.tipo === 'ESCALA_6X1') {
    return {
      arquivo: basename(caminho),
      tipo: resultado.tipo,
      ok: resultado.resultado.ok,
      periodoInicio: resultado.resultado.periodoInicio,
      periodoFim: resultado.resultado.periodoFim,
      totalDias: resultado.resultado.totalDias,
      colaboradores: resultado.resultado.documentos.length,
      loginsSimulados,
      erros: resultado.resultado.erros.length,
      bloqueantes: resultado.resultado.erros.filter((erro) => erro.severidade === 'BLOQUEANTE').length,
      alertas: resultado.resultado.erros.filter((erro) => erro.severidade === 'ALERTA').length,
      avisos: resultado.resultado.avisos.length,
    };
  }

  const atribuicoes = resultado.resultado.atribuicoes;
  const ocorrencias = new Set(atribuicoes.map((atribuicao) =>
    `${atribuicao.inicio.data}T${atribuicao.inicio.hora}|${atribuicao.fim.data}T${atribuicao.fim.hora}`));
  const porFuncao = Object.fromEntries(
    ['DBA', 'LINUX', 'TELECOM', 'WINDOWS'].map((funcao) => [
      funcao,
      atribuicoes.filter((atribuicao) => atribuicao.funcao === funcao).length,
    ]),
  );
  return {
    arquivo: basename(caminho),
    tipo: resultado.tipo,
    ok: resultado.resultado.ok,
    abaOrigem: resultado.resultado.abaOrigem,
    atribuicoes: atribuicoes.length,
    ocorrencias: ocorrencias.size,
    pessoasUnicas: new Set(atribuicoes.map((atribuicao) => atribuicao.plantonistaNomeOriginal)).size,
    porFuncao,
    primeiroInicio: atribuicoes.map((atribuicao) => atribuicao.inicio.data).sort()[0] ?? null,
    ultimoInicio: atribuicoes.map((atribuicao) => atribuicao.inicio.data).sort().at(-1) ?? null,
    competencia: analisarCompetenciaImportacaoPlantao(atribuicoes),
    erros: resultado.resultado.erros.length,
    avisos: resultado.resultado.avisos.length,
  };
}

const caminhos = process.argv.slice(2);
if (caminhos.length === 0) {
  throw new Error('Informe um ou mais caminhos XLS/XLSX para validar.');
}

const relatorio = caminhos.map(resumir);
const codb = relatorio.find((item) => item.arquivo.toUpperCase().includes('CODB'));
if (codb !== undefined && codb.tipo === 'PLANTAO') {
  const esperado = codb.atribuicoes === 128
    && codb.ocorrencias === 32
    && codb.pessoasUnicas === 17
    && Object.values(codb.porFuncao).every((total) => total === 32);
  if (!esperado) {
    throw new Error(`CODB real divergiu dos totais esperados: ${JSON.stringify(codb)}`);
  }
}

console.log(JSON.stringify({ validadoEm: new Date().toISOString(), arquivos: relatorio }, null, 2));
