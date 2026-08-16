import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase UI-ORG-1: árvore organizacional moderna (OrganizationTree) + seletor
// reutilizável de equipes (OrganizationTeamPicker). Ver docs/spec/PLANTOES.md
// e docs/spec/HIERARQUIA_ORGANIZACIONAL.md.

test('1. OrganizationTree não importa Firebase nem escreve nada — só apresentação/interação sobre dados já carregados', async () => {
  const fonte = semComentarios(await ler('components/organizacao/OrganizationTree.tsx'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'updateDoc', 'getDoc', 'getDocs']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('2. OrganizationTeamPicker não escreve Firestore — só devolve equipeId(s) escolhidos via onConfirmar', async () => {
  const fonte = semComentarios(await ler('components/organizacao/OrganizationTeamPicker.tsx'));
  for (const proibido of ['firebase/firestore', 'setDoc', 'updateDoc', 'salvarGrupoPlantao', 'salvarEquipe', 'salvarUnidadeOrganizacional']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('3. nenhuma segunda estrutura/fundação de árvore organizacional foi criada — só lib/organizacao.ts monta hierarquia', async () => {
  const [tree, picker] = await Promise.all([
    ler('components/organizacao/OrganizationTree.tsx'),
    ler('components/organizacao/OrganizationTeamPicker.tsx'),
  ]);
  for (const fonte of [tree, picker]) {
    assert.doesNotMatch(semComentarios(fonte), /function construirArvore/u, 'nenhum componente pode declarar sua própria função de montagem de árvore');
    assert.doesNotMatch(semComentarios(fonte), /\.parentId/u, 'nenhum componente pode percorrer parentId diretamente — isso é só de lib/organizacao.ts');
  }
  assert.match(tree, /from '@\/lib\/organizacao'/u, 'OrganizationTree precisa importar de lib/organizacao.ts');
});

test('4. nenhum hardcode de unidade/equipe real (COSI/CODB/SOC/NOC/GEDSI) nos novos componentes/helpers', async () => {
  const arquivos = await Promise.all([
    ler('lib/organizacao.ts'),
    ler('components/organizacao/OrganizationTree.tsx'),
    ler('components/organizacao/OrganizationTeamPicker.tsx'),
    ler('components/organizacao/OrganizationBreadcrumb.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['COSI', 'CODB', 'GEDSI', 'EQ_SOC', 'EQ_NOC']) {
      assert.doesNotMatch(fonte, new RegExp(`['"\`]${proibido}['"\`]`, 'u'), `${proibido} não pode ser literal de código`);
    }
  }
});

test('5. ACL de Plantão continua só em GrupoPlantao.equipesConsulta — OrganizationTeamPicker não introduz um payload paralelo', async () => {
  const picker = await ler('components/organizacao/OrganizationTeamPicker.tsx');
  for (const proibido of ['plantoesVisiveis', 'allowedTeams', 'equipesPermitidasPlantao']) {
    assert.doesNotMatch(picker, new RegExp(proibido, 'u'), proibido);
  }
});

test('6. apps/app (colaborador) não ganha nenhum componente administrativo novo desta fase', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  for (const proibido of [
    'OrganizationTree',
    'OrganizationTeamPicker',
    'OrganizationBreadcrumb',
    'components/organizacao',
    'construirArvoreOrganizacional',
    'buscarNaArvoreOrganizacional',
  ]) {
    assert.doesNotMatch(app, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('7. componentes de árvore/seletor não importam o parser XLS nem o catálogo/regras da escala 6x1', async () => {
  const arquivos = await Promise.all([
    ler('components/organizacao/OrganizationTree.tsx'),
    ler('components/organizacao/OrganizationTeamPicker.tsx'),
    ler('components/organizacao/OrganizationBreadcrumb.tsx'),
  ]);
  for (const fonte of arquivos) {
    for (const proibido of ['parsePlanilhaEscala', 'parserPlantao', 'xlsx', 'CATALOGO_SOC', 'alertasEscala']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'iu'), proibido);
    }
  }
});

test('8. OrganizationTree não conhece Plantão — nenhuma menção a Plantão/GrupoPlantao no componente de árvore genérico', async () => {
  const tree = await ler('components/organizacao/OrganizationTree.tsx');
  assert.doesNotMatch(tree, /plantao/iu, 'a árvore genérica não deve saber que existe um domínio de Plantão');
});

test('9. OrganizationTeamPicker é genérico — não hardcoda GrupoPlantao nem nenhum outro domínio específico', async () => {
  const picker = semComentarios(await ler('components/organizacao/OrganizationTeamPicker.tsx'));
  for (const proibido of ['GrupoPlantao', 'gruposPlantao', 'equipeResponsavelId']) {
    assert.doesNotMatch(picker, new RegExp(proibido, 'u'), proibido);
  }
});

test('10. ArvoreUnidadesOrganizacionais (cards antigos) foi removida — não sobrevive dead code após a substituição', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.doesNotMatch(dashboard, /function ArvoreUnidadesOrganizacionais/u, 'o componente antigo precisa ter sido removido, não só desativado');
  assert.doesNotMatch(dashboard, /org-tree-node/u, 'nenhuma classe CSS do card antigo deve continuar referenciada');
});

test('11. firestore.rules e o modelo de Plantão continuam com diff zero nesta fase — só UI', async () => {
  const [rules, modeloPlantao] = await Promise.all([
    ler('firestore.rules'),
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
  ]);
  assert.doesNotMatch(rules, /organization|OrganizationTree|OrganizationTeamPicker/iu, 'Rules não deve mencionar nada desta fase de UI');
  assert.doesNotMatch(modeloPlantao, /organization|OrganizationTree|OrganizationTeamPicker/iu, 'o modelo de domínio não deve mencionar nada desta fase de UI');
});

/**
 * 12. Fase UI-ORG-1A: a microfase de acessibilidade explicitamente NÃO
 * introduz infraestrutura de teste de componente (jsdom/testing-library) —
 * a ausência é dívida técnica conhecida e registrada, não corrigida aqui.
 * Este teste protege essa decisão contra reintrodução acidental futura sem
 * uma decisão explícita equivalente.
 */
test('12. nenhuma dependência de testing-library/jsdom foi adicionada ao package.json', async () => {
  const pkg = JSON.parse(await ler('package.json'));
  const todasDependencias = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const proibido of ['@testing-library/react', '@testing-library/user-event', '@testing-library/dom', 'jsdom']) {
    assert.ok(!(proibido in todasDependencias), `${proibido} não deveria estar em package.json nesta fase`);
  }
});

test('13. as funções de escrita de Plantão continuam com diff zero nesta fase — só a UI que as chama mudou', async () => {
  const writeRepo = await ler('lib/firebase/plantaoWriteRepository.ts');
  for (const esperado of ['export async function salvarGrupoPlantao', 'export async function salvarParticipantePlantao', 'export async function salvarCompetenciaPlantaoRascunho', 'export async function salvarAtribuicoesPlantaoRascunho']) {
    assert.match(writeRepo, new RegExp(esperado.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), esperado);
  }
  assert.doesNotMatch(writeRepo, /function publicar/iu, 'nenhuma função de publicação pode existir nesta fase');
});
