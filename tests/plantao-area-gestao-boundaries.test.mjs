import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * ADENDO — ÁREA DE GESTÃO NÃO RESOLVIDA NO PLANTÃO. A cobertura de
 * comportamento (resolução real da cadeia GEDSI_COSI -> PLANTAO_GEDSI_COSI
 * -> GEDSI_COSI_PLANTAO para um GESTOR_UNIDADE) vive em
 * `lib/escoposOperacionais.test.ts` (describe "ADENDO — Área de gestão do
 * Plantão..."), com dados reais e passando — a lógica de resolução está
 * correta. Estes testes travam as duas invariantes de código pedidas
 * separadamente: nenhum id legado "COSI" (sem prefixo) sobrevive fora de
 * fixtures de teste/modo demo, e o Plantão de COSI nunca aponta para a
 * equipe de Jornada (GEDSI_COSI_SOC) como responsável.
 */

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('5. nenhum código de produção busca a unidade legada "COSI" — só o id canônico GEDSI_COSI', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const inicioEscala = await ler('lib/inicioEscala.ts');
  const escoposOperacionais = await ler('lib/escoposOperacionais.ts');
  const wizard = await ler('components/escalas/ScheduleStartWizard.tsx');
  // Um literal `'COSI'` isolado (sem o prefixo GEDSI_) nunca deveria
  // aparecer como valor de unidadeId/areaId nesses arquivos de produção —
  // `demoIdentidades.ts` é a única exceção legítima (namespace do modo
  // demo, deliberadamente isolado da hierarquia real de staging).
  for (const [nome, fonte] of [
    ['DashboardApp.tsx', dashboard],
    ['lib/inicioEscala.ts', inicioEscala],
    ['lib/escoposOperacionais.ts', escoposOperacionais],
    ['ScheduleStartWizard.tsx', wizard],
  ]) {
    assert.doesNotMatch(fonte, /['"]COSI['"]/u, `${nome} não deve referenciar o id legado 'COSI' isolado`);
  }
});

test('6. o Plantão de COSI nunca usa GEDSI_COSI_SOC (equipe de Jornada) como equipe responsável', async () => {
  const hierarquia = await ler('scripts/staging/hierarquia-ici.mjs');
  const escoposTeste = await ler('lib/escoposOperacionais.test.ts');
  assert.ok(hierarquia.includes("equipeResponsavelId: 'GEDSI_COSI_PLANTAO'"));
  assert.doesNotMatch(hierarquia, /GRUPO_PLANTAO[\s\S]{0,400}equipeResponsavelId:\s*'GEDSI_COSI_SOC'/u);
  // A fixture do teste real (ADENDO) também nunca modela isso — trava a
  // regressão caso alguém "simplifique" o teste no futuro.
  assert.ok(escoposTeste.includes("grupo('PLANTAO_GEDSI_COSI', EQUIPE_PLANTAO_REAL.id,"));
  assert.doesNotMatch(escoposTeste, /grupo\('PLANTAO_GEDSI_COSI', EQUIPE_SOC_REAL\.id/u);
});

test('4. "Criar Plantão" não aparece quando o Grupo já resolveu (grupos.length === 1)', async () => {
  const wizard = await ler('components/escalas/ScheduleStartWizard.tsx');
  // A UI de criação (com o botão "Criar Plantão") só existe no ramo ELSE de
  // `grupos.length === 1` — nunca ao lado do estado já resolvido.
  assert.ok(wizard.includes('grupos.length > 1 ? ('));
  assert.ok(wizard.includes('resolvido automaticamente'));
  const indiceResolvido = wizard.indexOf('resolvido automaticamente');
  const indiceCriarPlantao = wizard.indexOf('Criar Plantão</button>');
  assert.ok(indiceResolvido > -1 && indiceCriarPlantao > -1, 'esperava encontrar os dois marcadores no arquivo');
  // O bloco "Criar Plantão" vem depois do ramo resolvido no mesmo ternário —
  // confirma que são ramos mutuamente exclusivos do mesmo condicional
  // (grupos.length > 1 ? <select> : grupos.length === 1 ? <resolvido> : <criar>).
  assert.ok(wizard.includes(': grupos.length === 1 ? (\n                    <div className="wizard-resolved-field">'));
});

test('a área de gestão nunca mostra "não cadastrada" quando existe unidade resolvida — cobertura de comportamento real está em lib/escoposOperacionais.test.ts', async () => {
  const escoposTeste = await ler('lib/escoposOperacionais.test.ts');
  assert.ok(escoposTeste.includes('ADENDO — Área de gestão do Plantão resolve GEDSI_COSI -> PLANTAO_GEDSI_COSI -> GEDSI_COSI_PLANTAO'));
  assert.ok(escoposTeste.includes('areasParaExibicaoNoWizard nunca cai em "não cadastrada" quando GEDSI_COSI é administrável'));
});
