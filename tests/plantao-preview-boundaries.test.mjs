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

test('o Dashboard roteia o preview de Plantão pelo importador/conciliação puros', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');

  assert.match(dashboard, /processarArquivoImportado/, 'o Dashboard deve rotear pelo importador puro');
  assert.match(dashboard, /conciliacaoPlantoes/, 'o Dashboard deve importar a conciliação pura de Plantão');
});

/**
 * Fase PLANTÃO-3B: a integração real acontece agora — o Dashboard PASSA a
 * importar `plantaoReadRepository.ts`/`plantaoWriteRepository.ts` (o
 * teste acima, de PLANTÃO-2, dizia o oposto porque a integração ainda não
 * existia). O que continua absolutamente proibido, em qualquer fase antes
 * de PLANTÃO-3C, é publicar: nenhuma função `publicarPlantao()` pode
 * existir, e a coleção `competenciasPlantao` (só a PUBLICADA) nunca pode
 * ser alvo de escrita a partir do Dashboard.
 */
test('o Dashboard passa a integrar plantaoReadRepository/plantaoWriteRepository (Fase PLANTÃO-3B), mas nunca publica', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));

  assert.match(dashboard, /plantaoReadRepository/, 'o Dashboard deve importar a leitura persistente de Plantão');
  assert.match(dashboard, /plantaoWriteRepository/, 'o Dashboard deve importar a escrita persistente de Plantão (rascunho)');

  for (const proibido of ['publicarPlantao', /salvarDoc\(\s*['"]competenciasPlantao['"]/u]) {
    assert.doesNotMatch(dashboard, proibido instanceof RegExp ? proibido : new RegExp(proibido, 'iu'), String(proibido));
  }
});

test('plantaoWriteRepository.ts continua sem nenhuma função de publicação — publicar é PLANTÃO-3C', async () => {
  const writeRepo = await ler('lib/firebase/plantaoWriteRepository.ts');
  assert.doesNotMatch(writeRepo, /function\s+publicar/iu, 'nenhuma função de publicação pode existir nesta fase');
  assert.doesNotMatch(writeRepo, /['"]competenciasPlantao['"]/u, 'a coleção PUBLICADA nunca é gravada por esta fase');
});
