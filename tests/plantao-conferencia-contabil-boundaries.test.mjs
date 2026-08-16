import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PLANTÃO-3B.1 — conferência contábil da fonte (três camadas de
// verdade: bruto, contabilidade por plantonista, total declarado) e
// fidelidade da importação. Ver docs/spec/PLANTOES.md.

test('1. o Dashboard importa e usa conferirContabilidadePlantao (as três camadas chegam à UI)', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /conferirContabilidadePlantao/u, 'o Dashboard precisa chamar a conferência contábil');
  assert.match(dashboard, /conferencia\.bruto/u);
  assert.match(dashboard, /conferencia\.somaContabilidadeInformada/u);
  assert.match(dashboard, /conferencia\.declarado/u);
  assert.match(dashboard, /conferencia\.divergencias/u);
});

test('2. nenhuma métrica é rotulada como "correta" em nenhum arquivo desta fase', async () => {
  const arquivos = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('packages/contrato/src/tiposPlantao.ts'),
    ler('packages/contrato/src/parserPlantao.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['totalCorreto', 'valorCorreto', 'horasCorretas', 'quantidadeCorreta', 'totalReal']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'iu'), proibido);
    }
  }
});

test('3. nenhuma reconciliação automática — o parser nunca atribui um totalizador a outro', async () => {
  const parser = semComentarios(await ler('packages/contrato/src/parserPlantao.ts'));
  // As três camadas nunca são copiadas uma na outra — cada uma só é
  // atribuída a partir da sua própria fonte de dados (a soma dos
  // intervalos, a soma das linhas individuais, ou a linha de total lida).
  assert.doesNotMatch(parser, /totaisInformados\s*=\s*totalBrutoCalculado/u);
  assert.doesNotMatch(parser, /totalBrutoCalculado\s*=\s*totaisInformados/u);
  assert.doesNotMatch(parser, /contabilidadeInformada\s*=\s*totalBrutoCalculado/u);
});

test('4. ausência (linha de total não declarada) nunca vira zero — sempre null/"Não informado"', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /Não informad[ao] na fonte/u, 'precisa existir o texto de ausência distinto de zero');
  // O antigo `?? '—'` (que confundia ausência real com "nada para mostrar")
  // não pode mais existir associado a totaisInformados/declarado.
  assert.doesNotMatch(dashboard, /totaisInformados\?\.[a-zA-Z]+\s*\?\?\s*'—'/u);
});

test('5. nenhuma publicação foi implementada — publicarPlantao continua inexistente como função real', async () => {
  const [writeRepo, dashboard] = await Promise.all([
    ler('lib/firebase/plantaoWriteRepository.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
  ]);
  assert.doesNotMatch(semComentarios(writeRepo), /function publicar/iu);
  assert.doesNotMatch(semComentarios(dashboard), /publicarPlantao\(/u, 'nenhuma CHAMADA real a publicarPlantao() — menções em comentários explicando a ausência são esperadas');
});

test('6. nenhum novo campo foi acrescentado ao schema Firestore de Plantão — modelo persistente com diff de conteúdo compatível', async () => {
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  for (const proibido of ['ConferenciaContabilPlantao', 'SomaContabilidadeInformada', 'DivergenciaPlantao', 'conferirContabilidadePlantao']) {
    assert.doesNotMatch(modelo, new RegExp(proibido, 'u'), `${proibido} é conceito de importação/preview, nunca do schema persistente`);
  }
});

test('7. firestore.rules continua sem qualquer menção aos novos conceitos de conferência contábil', async () => {
  const rules = await ler('firestore.rules');
  for (const proibido of ['ConferenciaContabilPlantao', 'somaContabilidadeInformada', 'conferirContabilidadePlantao']) {
    assert.doesNotMatch(rules, new RegExp(proibido, 'u'));
  }
});

test('8. a árvore organizacional (UI-ORG-1/1A) continua sem nenhum código sobre contabilidade de Plantão — só prosa de contexto pré-existente é aceitável em comentário', async () => {
  const arquivos = await Promise.all([
    ler('components/organizacao/OrganizationTree.tsx'),
    ler('components/organizacao/OrganizationTeamPicker.tsx'),
    ler('lib/organizacao.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    assert.doesNotMatch(fonte, /contabilidade|conferenciacontabil|somacontabilidade/iu, 'nenhum CÓDIGO da árvore organizacional pode conhecer conceitos de contabilidade de Plantão');
  }
});

test('9. o parser 6x1 continua sem qualquer menção a conferência contábil de Plantão', async () => {
  const parserEscala = await ler('packages/contrato/src/parser.ts');
  assert.doesNotMatch(parserEscala, /contabilidade|conferencia|plantao/iu);
});

test('10. a soma da contabilidade individual e a conferência são funções puras — sem Firebase, sem React', async () => {
  const parser = semComentarios(await ler('packages/contrato/src/parserPlantao.ts'));
  for (const proibido of ['firebase/firestore', "from 'react'", 'useState', 'useEffect']) {
    assert.doesNotMatch(parser, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('11. validar prévia continua não sendo bloqueada por divergência contábil — só por vínculos pendentes', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpoFuncao = /function validarPreviaPlantao\(\) \{([\s\S]*?)\n  \}/u.exec(dashboard)?.[1] ?? '';
  assert.match(corpoFuncao, /previaPlantaoValidavel/u, 'a validação da prévia depende só dos vínculos');
  assert.doesNotMatch(corpoFuncao, /divergencia|conferencia/iu, 'divergência contábil não pode bloquear "Validar prévia" nesta fase');
});
