import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// HOTFIX-COMPETENCIA-OPERACIONAL-DINAMICA-1 — a Visão Geral/Hub/wizards/
// administração não podem mais depender de uma competência congelada em
// build-time (`COMPETENCIA_ATUAL` em `lib/sessao.ts`, fixa em '2026-08').
// Este arquivo cobre só a integração/ausência de regressão do hardcode; a
// regra 26→25 em si continua coberta por
// `packages/contrato/src/jornada.test.ts` (`competenciaOperacional`) e o
// novo wrapper de runtime por `lib/competenciaOperacionalAtual.test.ts`.

test('1. lib/sessao.ts não exporta mais a constante congelada COMPETENCIA_ATUAL', async () => {
  const sessao = await ler('lib/sessao.ts');
  assert.doesNotMatch(sessao, /export const COMPETENCIA_ATUAL/u);
});

test('2. lib/competenciaOperacionalAtual.ts reaproveita competenciaOperacional()/dataIsoLocal() de @escala-ici/contrato — nunca reimplementa a regra 26→25', async () => {
  const modulo = semComentarios(await ler('lib/competenciaOperacionalAtual.ts'));
  assert.match(modulo, /import \{ competenciaOperacional, dataIsoLocal \} from '@escala-ici\/contrato';/u);
  assert.match(modulo, /export function competenciaOperacionalAtual\(data: Date = new Date\(\)\): string \{/u);
  assert.match(modulo, /return competenciaOperacional\(dataIsoLocal\(data\)\);/u);
});

test('3. DashboardApp.tsx não importa mais COMPETENCIA_ATUAL de lib/sessao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /\bCOMPETENCIA_ATUAL\b/u);
  assert.match(dashboard, /import \{ competenciaOperacionalAtual \} from '@\/lib\/competenciaOperacionalAtual';/u);
});

test('4. competenciaOperacionalHoje é calculada uma vez no mount, nunca em uma constante de módulo/build', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const \[competenciaOperacionalHoje\] = useState\(\(\) => competenciaOperacionalAtual\(\)\);/u);
});

test('5. os contextos operacionais válidos (Jornada/Plantão administráveis/monitorados) nascem com a competência operacional atual, nunca hardcode', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const bloco = /const contextosOperacionaisValidos: ContextoEscalaAtivo\[\] = useMemo\(\(\) => \[([\s\S]*?)\], \[escoposOperacionais, competenciaOperacionalHoje\]\);/u.exec(dashboard);
  assert.ok(bloco, 'contextosOperacionaisValidos precisa depender de competenciaOperacionalHoje');
  assert.doesNotMatch(bloco[1], /'2026-08'/u);
  assert.match(bloco[1], /competenciaOperacionalHoje/u);
});

test('6. a restauração de contexto persistido normaliza a competência para a operacional atual — a competência antiga do localStorage nunca comanda o default de uma nova sessão', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /restaurarContextoEscalaPersistido\(\s*usuarioReal\.login,\s*contextosOperacionaisValidos,\s*window\.localStorage,\s*\{ competenciaInicial: competenciaOperacionalHoje \},\s*\)/u,
  );
});

test('7. a trava de exclusão administrativa (podeExcluirCompetencia) usa a competência operacional atual, nunca a constante removida', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /podeExcluirCompetencia\(competenciaExportar, competenciaOperacionalHoje\)/u);
});

test('8. restaurarContextoEscalaPersistido (lib/contextoEscala.ts) aceita competenciaInicial opcional e a usa em vez da competência persistida quando informada', async () => {
  const modulo = semComentarios(await ler('lib/contextoEscala.ts'));
  assert.match(modulo, /opcoes\?: \{ competenciaInicial\?: string \}/u);
  assert.match(modulo, /opcoes\?\.competenciaInicial \?\? persistido\.competencia/u);
});

test('9. o App\\/PWA (EmployeeApp.tsx) já resolve a competência operacional em runtime via competenciaOperacional() — nunca precisou desta migração', async () => {
  const app = semComentarios(await ler('apps/app/src/EmployeeApp.tsx'));
  assert.doesNotMatch(app, /COMPETENCIA_ATUAL/u);
  assert.match(app, /competenciaOperacional\(/u);
});
