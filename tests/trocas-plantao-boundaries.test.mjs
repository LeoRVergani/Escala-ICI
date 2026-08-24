import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gmu, '');

/**
 * FASE-TROCAS-PLANTAO-1 — primeira versão de Trocas de Plantão (coleção
 * `trocasPlantao`, ver lib/trocasPlantao.ts e docs/spec/PLANTOES.md).
 * Garante em código as decisões estruturais da fase: coleção separada de
 * Jornada, nenhuma escrita na escala publicada, Rules usando a Matriz de
 * Plantão (nunca a de Jornada), e não-regressão do fluxo de Jornada 6x1.
 */

test('lib/trocasPlantao.ts é um módulo puro — sem Firestore/React', async () => {
  const fonte = semComentarios(await ler('lib/trocasPlantao.ts'));
  for (const proibido of ["from 'firebase/firestore'", "from 'react'", 'useState', 'useEffect', 'getFirestore']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('apps/app/src/trocasApp.ts é um módulo puro — sem Firestore/React', async () => {
  const fonte = semComentarios(await ler('apps/app/src/trocasApp.ts'));
  for (const proibido of ["from 'firebase/firestore'", "from 'react'", 'useState', 'useEffect', 'getFirestore']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('lib/firebase/trocasPlantaoRepository.ts nunca escreve na escala publicada (decisão D1 da fase)', async () => {
  const original = await ler('lib/firebase/trocasPlantaoRepository.ts');
  const fonte = semComentarios(original);
  for (const proibido of [
    'competenciasPlantao',
    'rascunhosCompetenciasPlantao',
    'publicarCompetenciaPlantao',
    'salvarAtribuicoesPlantaoRascunho',
    'aplicarTrocaNosDias',
    'turnosMes',
    'runTransaction',
    'calcularTotais',
    'exigirEscritaAdministrativaHabilitada',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), proibido);
  }
  // As únicas coleções tocadas são as duas próprias da fase.
  assert.match(original, /'trocasPlantao'/u);
  assert.match(original, /'notificacoesTrocaPlantao'/u);
});

test('lib/firebase/trocasPlantaoRepository.ts não mistura domínio de Jornada 6x1', async () => {
  const fonte = semComentarios(await ler('lib/firebase/trocasPlantaoRepository.ts'));
  for (const proibido of ['CATALOGO_SOC', 'TipoTurno', 'resolverJornadaDia', 'writeRepository', 'plantaoWriteRepository']) {
    assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), proibido);
  }
});

test('firestore.rules define os dois blocos novos, usando a Matriz/administração de PLANTÃO — nunca a de Jornada', async () => {
  const regras = await ler('firestore.rules');
  assert.match(regras, /match \/trocasPlantao\/\{id\}/u);
  assert.match(regras, /match \/notificacoesTrocaPlantao\/\{id\}/u);
  const inicioTroca = regras.indexOf('match /trocasPlantao/{id}');
  const inicioNotificacao = regras.indexOf('match /notificacoesTrocaPlantao/{id}');
  const fimNotificacao = regras.indexOf('\n    }', regras.indexOf('allow delete: if souAdminSistema();', inicioNotificacao));
  const blocoCompleto = regras.slice(inicioTroca, fimNotificacao);
  assert.match(blocoCompleto, /podeAdministrarEscalaPlantao/u);
  assert.doesNotMatch(blocoCompleto, /podeAdministrarJornada/u, 'trocas de Plantão nunca usam a autorização de Jornada');
  assert.doesNotMatch(blocoCompleto, /minhaEquipe\(\)/u, 'a autorização de troca de Plantão é por Grupo, nunca por equipe');
});

test('firestore.indexes.json declara os índices compostos de trocasPlantao', async () => {
  const indices = JSON.parse(await ler('firestore.indexes.json'));
  const trocasPlantao = indices.indexes.filter((indice) => indice.collectionGroup === 'trocasPlantao');
  assert.ok(trocasPlantao.length >= 2, 'precisa haver ao menos os índices por solicitanteLogin e destinatarioLogin');
  const campos = trocasPlantao.map((indice) => indice.fields.map((campo) => campo.fieldPath).join('+'));
  assert.ok(campos.some((c) => c.includes('solicitanteLogin')));
  assert.ok(campos.some((c) => c.includes('destinatarioLogin')));
});

test('Jornada 6x1 não regride: trocasEscala/notificacoesTroca continuam nas Rules, e trocasRepository continua exportando as 5 funções de sempre', async () => {
  const regras = await ler('firestore.rules');
  assert.match(regras, /match \/trocasEscala\/\{id\}/u);
  assert.match(regras, /match \/notificacoesTroca\/\{id\}/u);

  const repositorio = await ler('lib/firebase/trocasRepository.ts');
  for (const funcao of [
    'export async function criarSolicitacaoTroca',
    'export async function cancelarSolicitacaoTroca',
    'export async function responderSolicitacaoTroca',
    'export async function gestorRecusarTroca',
    'export async function gestorAprovarEPublicarTroca',
  ]) {
    assert.match(repositorio, new RegExp(funcao.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), funcao);
  }
});

test('a tela Trocas do App tem os dois blocos rotulados e não contém mais a frase que desligava a tela inteira', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  const inicio = app.indexOf("{tela === 'trocas' && usuario && (");
  const fim = app.indexOf("{tela === 'plantao' && usuario && (");
  assert.ok(inicio > 0 && fim > inicio);
  const telaTrocas = app.slice(inicio, fim);
  assert.match(telaTrocas, /Trocas de Jornada 6x1<\/h2>/u);
  assert.match(telaTrocas, /Trocas de Plantão<\/h2>/u);
  assert.doesNotMatch(app, /Trocas de Plantão serão tratadas em uma próxima fase/u);
});

test('o App nunca usa alert() — o detalhe do dia de Plantão usa modal, não alert()', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.doesNotMatch(semComentarios(app), /\balert\(/u, 'nenhuma chamada a alert() é permitida no App');
  assert.match(app, /function DetalheDiaPlantao\(/u);
});

test('os arquivos novos de Trocas de Plantão não hardcodam nome de pessoa/equipe/setor', async () => {
  const proibidos = ['Jean', 'Leonardo', 'SOC', 'NOC', 'COSI'];
  const arquivos = await Promise.all([
    ler('lib/trocasPlantao.ts'),
    ler('lib/firebase/trocasPlantaoRepository.ts'),
    ler('apps/app/src/trocasApp.ts'),
  ]);
  for (const [indice, fonte] of arquivos.entries()) {
    for (const proibido of proibidos) {
      assert.doesNotMatch(fonte, new RegExp(`\\b${proibido}\\b`, 'u'), `arquivo ${indice}: ${proibido}`);
    }
  }
});

test('aprovação de troca de Plantão não publica automaticamente — status APROVADA é terminal e não escreve nada em competenciasPlantao', async () => {
  const dominio = await ler('lib/trocasPlantao.ts');
  assert.match(dominio, /APROVADA:\s*\[\]/u, 'APROVADA precisa ser um status terminal na tabela de transições');
  assert.match(dominio, /AVISO_APROVACAO_NAO_PUBLICA/u);

  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(app, /AVISO_APROVACAO_NAO_PUBLICA/u, 'a UI precisa exibir o aviso de que a aprovação não publica a troca');
});
