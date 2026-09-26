import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * FASE-PWA-COMPETENCIAS-MULTIPERIODOS-1 — regressão do bug relatado: depois
 * de importar e publicar a escala de outubro (26/09 a 25/10), o PWA passou
 * a mostrar só o período novo e deixou de exibir corretamente o período
 * anterior (26/08 a 25/09), ainda vigente até 25/09. A causa raiz era a
 * assinatura em tempo real do App (`observarEscalasEquipe`) acompanhar UMA
 * única competência — trocar a competência ativa cancelava a assinatura
 * antiga e descartava o período anterior do estado `documentos`.
 *
 * Regra de negócio (26–25): cada escala começa no dia 26 e termina no dia
 * 25 do mês seguinte. A cobertura funcional detalhada (datas exatas,
 * `selecionarEscalaPorData`, `mesclarDiasEscalas`, `diaSemanaEscalaCivil`)
 * vive em `packages/contrato/test/jornada.test.ts` e
 * `lib/firebase/readRepository.test.ts` (rodam via `npm run test:unit`,
 * Vitest). Este arquivo cobre a integração/ausência de regressão
 * estrutural no App e no service worker, no mesmo estilo dos demais
 * `tests/*-boundaries.test.mjs` (checagem textual, sem transpilar TS).
 */

test('1. o App observa uma JANELA de competências (não só a ativa) para a Jornada 6x1', async () => {
  const app = semComentarios(await ler('apps/app/src/EmployeeApp.tsx'));
  assert.match(app, /observarEscalasEquipeMultiplasCompetencias/u);
  assert.match(app, /janelaCompetenciasApp\s*=\s*useMemo\(\s*\(\)\s*=>\s*competenciasCandidatas\(dataHoje\)/u);
  assert.doesNotMatch(
    app,
    /observarEscalasEquipe\(\s*\n?\s*equipeUsuario,\s*\n?\s*competenciaAtiva,/u,
    'a assinatura em tempo real não pode mais depender de uma única competência ativa',
  );
});

test('2. readRepository expõe a assinatura multi-competência reaproveitando observarEscalasEquipe (uma assinatura por competência, nunca substituindo)', async () => {
  const leitura = semComentarios(await ler('lib/firebase/readRepository.ts'));
  assert.match(leitura, /export function observarEscalasEquipeMultiplasCompetencias/u);
  assert.match(leitura, /observarEscalasEquipe\(\s*equipeId,\s*competencia,/u);
  assert.match(leitura, /porCompetencia\.set\(competencia, documentos\)/u);
});

test('3. packages/contrato expõe mesclarDiasEscalas para o calendário do App navegar mais de um período', async () => {
  const jornada = semComentarios(await ler('packages/contrato/src/jornada.ts'));
  assert.match(jornada, /export function mesclarDiasEscalas/u);
  assert.match(jornada, /export function diaSemanaEscalaCivil/u);
  assert.match(jornada, /export function selecionarEscalaPorData/u);
});

test('4. o calendário/agenda/lembretes da Jornada usam a escala MESCLADA (escalaVisivelApp), nunca só a competência de hoje', async () => {
  const app = semComentarios(await ler('apps/app/src/EmployeeApp.tsx'));
  assert.match(app, /const diasEscalaVisivelApp = mesclarDiasEscalas\(escalasDoUsuario\);/u);
  assert.match(app, /const datas = Object\.keys\(diasEscalaVisivelApp\)\.sort\(\);/u);
  const usosEscalaVisivel = app.match(/escala=\{escalaVisivelApp\}/gu) ?? [];
  assert.ok(usosEscalaVisivel.length >= 4, 'CalendarioEscala/AgendaEscala/DetalheDia/LembretesView precisam receber a escala mesclada');
});

test('5. a grade da aba Equipe (ScheduleGrid) continua UMA linha por colaborador — nunca duplica quando duas competências estão carregadas', async () => {
  const app = semComentarios(await ler('apps/app/src/EmployeeApp.tsx'));
  assert.match(app, /const documentosEquipeAtualApp = \[\.\.\.documentosPorLoginApp\.values\(\)\]/u);
  assert.match(app, /documentos=\{documentosEquipeAtualApp\}/u);
  assert.match(app, /\{documentosEquipeAtualApp\.length\} colaboradores/u);
});

test('6. o card "Plantão de hoje" continua fora da tela inicial (nenhuma chamada JSX de PlantaoHojeCard)', async () => {
  const app = semComentarios(await ler('apps/app/src/EmployeeApp.tsx'));
  assert.doesNotMatch(app, /<PlantaoHojeCard/u, 'PlantaoHojeCard não pode voltar a ser renderizado na tela inicial');
});

test('7. o service worker está na versão fase-3k-c-v2 (ou superior), remove caches antigos, chama skipWaiting/clients.claim e nunca aceita origem externa', async () => {
  for (const caminho of ['public/service-worker.js', 'apps/app/src/sw/serviceWorker.js']) {
    const sw = semComentarios(await ler(caminho));
    assert.match(sw, /const VERSION = 'fase-3k-c-v2'/u);
    assert.match(sw, /chave\.startsWith\('escala-ici-'\)/u);
    assert.match(sw, /self\.clients\.claim\(\)/u);
    assert.match(sw, /self\.skipWaiting\(\)/u);
    assert.match(sw, /url\.origin !== self\.location\.origin/u, 'o handler de fetch precisa recusar origem externa antes de responder');
  }
});

test('8. o service worker registrado pelo App aponta para o arquivo único (public/service-worker.js), nunca uma URL externa', async () => {
  const provider = semComentarios(await ler('components/PwaProvider.tsx'));
  assert.match(provider, /navigator\.serviceWorker\.register\('\/service-worker\.js'/u);
  assert.doesNotMatch(provider, /\.register\(['"]https?:\/\//u, 'o registro do service worker nunca pode apontar para uma URL externa');
});
