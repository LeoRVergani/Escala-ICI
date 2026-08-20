import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/gu, '');

// Fase PLANTAO-PADRAO-1: padrão semanal configurável por Grupo de Plantão
// (modelo + validação + Rules + Administração do Grupo). Ver
// docs/spec/PLANTOES.md, seção 20.7, e CHECKPOINT-FASE-PLANTAO-PADRAO-1.md.
// NÃO cobre consumo pelo Editor (ESCALAS-UX-2B) — ainda não existe.

test('1. padraoHorarioSemanal pertence a GrupoPlantao, nunca a Usuario/Equipe', async () => {
  const [modelo, usuarios, equipe] = await Promise.all([
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
    ler('lib/modelos.ts'),
    ler('packages/contrato/src/modeloOrganizacional.ts').catch(() => ler('lib/modelos.ts')),
  ]);
  assert.match(modelo, /padraoHorarioSemanal\?:\s*PadraoHorarioPlantaoDia\[\]/u, 'GrupoPlantao precisa declarar o campo');
  assert.doesNotMatch(usuarios, /padraoHorarioSemanal/u, 'Usuario não pode ganhar este campo');
  assert.doesNotMatch(equipe, /padraoHorarioSemanal/u, 'Equipe/organização não pode ganhar este campo');
});

test('2. o campo é opcional (backward compatibility) — GrupoPlantao sem ele continua válido', async () => {
  const modelo = semComentarios(await ler('packages/contrato/src/modeloPlantaoPersistente.ts'));
  const tipo = /export interface GrupoPlantao \{([\s\S]*?)\n\}/u.exec(modelo);
  assert.ok(tipo, 'interface GrupoPlantao precisa existir');
  assert.match(tipo[1], /padraoHorarioSemanal\?:/u, 'o campo precisa ser opcional (?:), nunca obrigatório');
});

test('3. nenhuma regra hardcoded por sigla de equipe/grupo (if COSI/SOC/NOC/CODB) em nenhum arquivo desta fase', async () => {
  const arquivos = await Promise.all([
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
    ler('lib/montagemRascunhoPlantao.ts'),
    ler('lib/firebase/plantaoWriteRepository.ts'),
    ler('lib/firebase/plantaoReadRepository.ts'),
    ler('components/plantao/PadraoHorarioSemanalCampo.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('firestore.rules'),
  ]);
  const fonte = arquivos.map(semComentarios).join('\n');
  for (const sigla of ['COSI', 'SOC', 'NOC', 'CODB']) {
    assert.doesNotMatch(fonte, new RegExp(`['"\`]${sigla}['"\`]`, 'u'), `nenhum literal "${sigla}" hardcoded`);
    assert.doesNotMatch(fonte, new RegExp(`if\\s*\\(.*${sigla}`, 'u'), `nenhum "if (${sigla}...)" hardcoded`);
  }
});

test('4. nenhuma regra hardcoded por dia da semana em prosa (if sexta/sábado) na lógica de validação', async () => {
  const modelo = semComentarios(await ler('packages/contrato/src/modeloPlantaoPersistente.ts'));
  for (const dia of ['sexta', 'sábado', 'domingo']) {
    assert.doesNotMatch(modelo.toLowerCase(), new RegExp(`if\\s*\\(.*${dia}`, 'u'), `nenhum "if (...${dia}...)" hardcoded`);
  }
});

test('5. o dia da semana usa uma ÚNICA convenção pública (DiaSemana/DIAS_SEMANA) — nenhuma segunda numeração inventada', async () => {
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  assert.match(modelo, /export type DiaSemana = 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6/u);
  assert.match(modelo, /export const DIAS_SEMANA: readonly DiaSemana\[\]/u);
});

test('6. Editor mensal (calendário/grade) NÃO consome o padrão nesta fase — ESCALAS-UX-2B ainda não começou', async () => {
  const arquivos = await Promise.all([
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/ScheduleGrid.tsx'),
    ler('lib/editorPlantao.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['obterPadraoHorarioGrupoParaData', 'obterPadraoHorarioParaDia', 'padraoHorarioSemanal']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), `${proibido} pertence à ESCALAS-UX-2B (consumo), não a esta fase`);
    }
  }
});

test('7. nenhuma atribuição (importada, manual ou copiada) é normalizada/recalculada a partir do padrão semanal', async () => {
  const montagem = semComentarios(await ler('lib/montagemRascunhoPlantao.ts'));
  // As funções que montam atribuições para salvar nunca podem referenciar o
  // padrão semanal — elas só usam o que já existe na working copy do
  // Editor (importado/manual/copiado), nunca um "default" vindo do Grupo.
  const funcoesDeAtribuicao = [
    /export function montarAtribuicoesPlantaoRascunho\([\s\S]*?\n\}/u,
    /export function copiarAtribuicoesParaNovaCompetencia\([\s\S]*?\n\}/u,
  ];
  for (const padrao of funcoesDeAtribuicao) {
    const corpo = padrao.exec(montagem);
    assert.ok(corpo, `função esperada não encontrada: ${padrao}`);
    assert.doesNotMatch(corpo[0], /padraoHorarioSemanal|obterPadraoHorarioParaDia|obterPadraoHorarioGrupoParaData/u,
      'nenhuma função de montagem de atribuição pode consultar o padrão semanal nesta fase');
  }
});

test('8. nenhum drag-and-drop foi introduzido por esta fase', async () => {
  const arquivos = await Promise.all([
    ler('components/plantao/PadraoHorarioSemanalCampo.tsx'),
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
    ler('lib/montagemRascunhoPlantao.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['onDragStart', 'onDragOver', 'onDrop', 'draggable']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), `${proibido} pertence a uma fase futura`);
    }
  }
});

test('9. nenhuma publicação de Plantão foi introduzida — publicarPlantao continua inexistente', async () => {
  const arquivos = await Promise.all([
    ler('lib/firebase/plantaoWriteRepository.ts'),
    ler('lib/montagemRascunhoPlantao.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
  ]);
  for (const fonte of arquivos) {
    assert.doesNotMatch(fonte, /function publicarPlantao\(/u, 'publicarPlantao pertence a PLANTÃO-3C — a função em si não pode existir (menções em comentário explicando a ausência são esperadas)');
  }
  const rules = await ler('firestore.rules');
  assert.match(rules, /allow create, update, delete: if false;/u, 'escrita de competenciasPlantao continua bloqueada');
});

test('10. Firestore Rules: leitura de gruposPlantao continua incluindo o caminho de equipesConsulta (Fase ESCOPO-CONSULTA-PLANTAO-1 só ACRESCENTOU caminhos novos, nunca removeu este); nenhum deles menciona o campo de padrão semanal', async () => {
  const rules = await ler('firestore.rules');
  const bloco = /match \/gruposPlantao\/\{grupoId\} \{([\s\S]*?)\n {4}\}/u.exec(rules);
  assert.ok(bloco, 'bloco de Rules de gruposPlantao precisa existir');
  const leitura = /allow read: if ([\s\S]*?);/u.exec(bloco[1]);
  assert.ok(leitura, 'allow read precisa existir');
  assert.match(leitura[1], /autenticado\(\)/u);
  assert.match(leitura[1], /souAdminSistema\(\)/u);
  assert.match(leitura[1], /minhaEquipe\(\)\s+in\s+resource\.data\.equipesConsulta/u);
  assert.doesNotMatch(leitura[1], /padraoHorarioSemanal/u, 'a regra de leitura não precisa (e não deve) mencionar o campo novo');
});

test('11. Firestore Rules: create/update aceitam o campo opcional e validam sua estrutura quando presente', async () => {
  const rules = await ler('firestore.rules');
  assert.match(rules, /function padraoHorarioPlantaoDiaValido\(entrada\)/u);
  assert.match(rules, /function padraoHorarioSemanalValido\(padrao\)/u);
  assert.match(rules, /function padraoHorarioSemanalDoRequestValido\(dados\)/u);
  assert.match(rules, /!\('padraoHorarioSemanal' in dados\) \|\| padraoHorarioSemanalValido\(dados\.padraoHorarioSemanal\)/u,
    'ausência do campo precisa continuar válida (retrocompatibilidade)');
  const bloco = /match \/gruposPlantao\/\{grupoId\} \{([\s\S]*?)\n {4}\}/u.exec(rules);
  assert.ok(bloco);
  const ocorrencias = bloco[1].match(/padraoHorarioSemanalDoRequestValido\(request\.resource\.data\)/gu) ?? [];
  assert.equal(ocorrencias.length, 2, 'create E update precisam validar o padrão (2 ocorrências)');
  const allowlists = bloco[1].match(/'padraoHorarioSemanal'/gu) ?? [];
  assert.equal(allowlists.length, 2, 'create E update precisam incluir o campo na allowlist de chaves (2 ocorrências)');
});

test('12. nenhuma mudança em Auth/App/Push por esta fase', async () => {
  const arquivos = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('lib/firebase/authRepository.ts'),
  ]);
  for (const fonte of arquivos) {
    assert.doesNotMatch(fonte, /padraoHorarioSemanal|PadraoHorarioPlantaoDia/u, 'App/Auth não podem conhecer este campo');
  }
});
