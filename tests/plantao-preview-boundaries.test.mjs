import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

// Os dois módulos puros de Plantão documentam em prosa, de propósito, o que
// NUNCA importam (mesma convenção do comentário sobre Lembretes em
// app-boundaries.test.mjs) — por isso a checagem real precisa ignorar
// comentários de bloco, senão a própria documentação vira falso positivo.
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PLANTÃO-2: o preview/conciliação de Plantão precisa continuar
// isolado de qualquer escrita administrativa, do parser/catálogo 6x1 e de
// qualquer persistência real — ver docs/spec/PLANTOES.md, seções 24/25.

test('os módulos puros de Plantão (importador/conciliação) não importam nenhuma escrita administrativa', async () => {
  const [importador, conciliacao] = await Promise.all([
    ler('lib/importadorPlanilha.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  const fonte = semComentarios(`${importador}\n${conciliacao}`);

  for (const proibido of [
    'writeRepository',
    'adminRepository',
    'auditoriaRepository',
    'salvarRascunho',
    'salvarUsuario',
    'publicarEscalas',
    'excluirUsuario',
    'excluirEscalaPublicada',
    'firebase/firestore',
    'runTransaction',
    'writeBatch',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(proibido), proibido);
  }
});

test('os módulos puros de Plantão não usam o catálogo nem as regras de negócio da escala 6x1', async () => {
  const [importador, conciliacao] = await Promise.all([
    ler('lib/importadorPlanilha.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  const fonte = semComentarios(`${importador}\n${conciliacao}`);

  for (const proibido of [
    'CATALOGO_SOC',
    'alertasEscala',
    'detectarSequencias6x1',
    'detectarDescansoInsuficiente',
    'calcularTotais',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(proibido), proibido);
  }
});

test('o parser isolado de Plantão (PLANTÃO-1) continua sem catálogo/regras 6x1', async () => {
  const parserPlantao = await ler('packages/contrato/src/parserPlantao.ts');

  for (const proibido of ['CATALOGO_SOC', 'alertasEscala', 'TipoTurno', 'calcularTotais']) {
    assert.doesNotMatch(parserPlantao, new RegExp(proibido), proibido);
  }
});

test('o writeRepository.ts compartilhado (6x1) segue sem qualquer menção a Plantão — a escrita de Plantão vive isolada em lib/firebase/plantaoWriteRepository.ts (Fase PLANTÃO-3A)', async () => {
  const writeRepository = await ler('lib/firebase/writeRepository.ts');
  assert.doesNotMatch(writeRepository, /plantao/iu, 'writeRepository.ts não deve mencionar Plantão');
});

test('o Dashboard não grava Plantão: o preview usa só o roteador/conciliação puros, nunca uma escrita real', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');

  assert.match(dashboard, /processarArquivoImportado/, 'o Dashboard deve rotear pelo importador puro');
  assert.match(dashboard, /conciliacaoPlantoes/, 'o Dashboard deve importar a conciliação pura de Plantão');

  // Nenhuma função de escrita real (existente hoje em writeRepository.ts)
  // pode aparecer associada a "Plantao" no mesmo arquivo — checagem
  // best-effort: nenhuma dessas funções é sequer declarada com sufixo
  // "Plantao"/"Plantão" em todo o Dashboard.
  for (const proibido of [
    'salvarRascunhoPlantao',
    'publicarPlantao',
    'salvarPlantao',
    'gravarPlantao',
    'persistirPlantao',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(proibido, 'iu'), proibido);
  }
});
