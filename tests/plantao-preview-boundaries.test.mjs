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

test('a importação e a reabertura de Plantão carregam usuários da equipe responsável, nunca reaproveitam a equipe da Jornada ativa', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(
    dashboard,
    /listarUsuariosElegiveisPlantao\(grupo\.equipeResponsavelId, grupo\.grupoId, grupo\.unidadeResponsavelId, grupo\.equipesConsulta\)/u,
    'o catálogo de vínculos deve vir da equipe/unidade responsável pelo Grupo de Plantão (PATCH-PLANTAO-VINCULO-GESTOR-COMO-PARTICIPANTE-1 — pool ampliado, mesmo alvo)',
  );
  assert.match(
    dashboard,
    /interpretarPlantao\(buffer, file\.name, processado\.resultado, opcoesPlantao, usuariosDoGrupo\)/u,
    'o preview precisa receber a lista recém-carregada, sem depender do setState assíncrono',
  );
});

test('a importação auto vincula somente identidade exata, única e ativa e preserva conflitos', async () => {
  const conciliacao = await ler('lib/conciliacaoPlantoes.ts');
  assert.match(conciliacao, /function candidatosPorIdentidadeExata/u);
  assert.match(conciliacao, /aliasesPlanilha/u);
  assert.match(conciliacao, /candidatos\.length === 1 && unico\.ativo/u);
  assert.match(conciliacao, /return recalcularConflitosPlantao\(iniciais\)/u);
});

/**
 * Fase PLANTÃO-3B: a integração real acontece agora — o Dashboard PASSA a
 * importar `plantaoReadRepository.ts`/`plantaoWriteRepository.ts` (o
 * teste acima, de PLANTÃO-2, dizia o oposto porque a integração ainda não
 * existia). A MATRIZ-2 acrescenta a publicação explícita por `grupoId`,
 * mantendo importador e conciliação puros.
 */
test('o Dashboard integra os repositories e publica Plantão por ação explícita', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));

  assert.match(dashboard, /plantaoReadRepository/, 'o Dashboard deve importar a leitura persistente de Plantão');
  assert.match(dashboard, /plantaoWriteRepository/, 'o Dashboard deve importar a escrita persistente de Plantão');
  assert.match(dashboard, /publicarCompetenciaPlantao\(/u);
  assert.match(dashboard, /function publicarPlantaoAcao\(/u);
});

test('plantaoWriteRepository.ts publica a competência e suas atribuições na coleção PUBLICADA', async () => {
  const writeRepo = await ler('lib/firebase/plantaoWriteRepository.ts');
  assert.match(writeRepo, /export async function publicarCompetenciaPlantao/u);
  assert.match(writeRepo, /['"]competenciasPlantao['"]/u);
});
