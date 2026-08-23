import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PLANTÃO-3A: modelo persistente + Rules + repositories, sem UI, sem
// publicação. Ver docs/spec/PLANTOES.md, seção 20.

/**
 * PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — o App passou a importar
 * `plantaoReadRepository` (leitura tolerante, só para diferenciar a
 * mensagem de "sem escala" quando há participação em Plantão — ver
 * `mensagemAusenciaEscalaAcao`), então saiu desta lista de proibidos.
 *
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — o App passou a importar
 * `plantaoWriteRepository` também, mas só `atualizarContatosPlantonista`
 * (ação PESSOAL do próprio plantonista sobre os PRÓPRIOS contatos — nunca
 * `exigirEscritaAdministrativaHabilitada()`, mesmo padrão de
 * `criarSolicitacaoTroca()`). O título do teste sempre foi sobre ESCRITA
 * ADMINISTRATIVA — nunca sobre toda e qualquer escrita — e essa garantia
 * continua intacta abaixo: nenhuma das funções administrativas da lista
 * pode aparecer no App.
 */
test('1. o App do colaborador não ganha nenhuma escrita ADMINISTRATIVA de Plantão (só a atualização pessoal de contatos)', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  for (const proibido of [
    'salvarGrupoPlantao',
    'salvarParticipantePlantao',
    'salvarCompetenciaPlantaoRascunho',
    'salvarAtribuicoesPlantaoRascunho',
    'publicarCompetenciaPlantao',
    'desativarParticipantePlantao',
    'atualizarEquipeConsultaPlantao',
  ]) {
    assert.doesNotMatch(app, new RegExp(proibido), proibido);
  }
  assert.match(app, /import \{ atualizarContatosPlantonista \} from '@\/lib\/firebase\/plantaoWriteRepository';/u);
});

/**
 * 2. Fase PLANTÃO-3B: a integração agora existe de propósito — este teste,
 * criado em PLANTÃO-3A, dizia o oposto porque a Administração de Plantão no
 * Dashboard ainda não tinha sido construída. A MATRIZ-2 acrescenta agora
 * a publicação explícita, sem alterar o modelo persistente de Plantão.
 */
test('2. o Dashboard (PLANTÃO-3B) passa a chamar os repositories de Plantão — grupo, participantes, contatos e rascunho', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const esperado of [
    'plantaoWriteRepository',
    'plantaoReadRepository',
    'salvarGrupoPlantao',
    'salvarParticipantePlantao',
    'desativarParticipantePlantao',
    'salvarCompetenciaPlantaoRascunho',
    'salvarAtribuicoesPlantaoRascunho',
    'listarParticipantesPlantao',
    'obterCompetenciaPlantaoRascunho',
    'obterCompetenciaPlantaoPublicada',
    'publicarCompetenciaPlantao',
  ]) {
    assert.match(dashboard, new RegExp(esperado), esperado);
  }
});

test('3. o parser isolado de Plantão (PLANTÃO-1) continua sem nenhum import de Firebase', async () => {
  const parserPlantao = await ler('packages/contrato/src/parserPlantao.ts');
  for (const proibido of ['firebase', 'Firestore', 'getFirestore']) {
    assert.doesNotMatch(parserPlantao, new RegExp(proibido, 'iu'), proibido);
  }
});

test('4. e 5. os repositories de Plantão não importam o parser XLS nem React', async () => {
  const [leitura, escrita] = await Promise.all([
    ler('lib/firebase/plantaoReadRepository.ts'),
    ler('lib/firebase/plantaoWriteRepository.ts'),
  ]);
  const fonte = semComentarios(`${leitura}\n${escrita}`);

  for (const proibido of [
    'parsePlanilhaPlantao',
    'detectarTipoPlanilha',
    'parsePlanilhaEscala',
    "from 'xlsx'",
    "from \"react\"",
    "from 'react'",
    'useState',
    'useEffect',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(escaparRegex(proibido)), proibido);
  }
});

test('6. e 7. o modelo e os repositories de Plantão não usam o catálogo nem as regras de negócio da escala 6x1', async () => {
  const [modelo, leitura, escrita] = await Promise.all([
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
    ler('lib/firebase/plantaoReadRepository.ts'),
    ler('lib/firebase/plantaoWriteRepository.ts'),
  ]);
  const fonte = semComentarios(`${modelo}\n${leitura}\n${escrita}`);

  for (const proibido of [
    'CATALOGO_SOC',
    'alertasEscala',
    'detectarSequencias6x1',
    'detectarDescansoInsuficiente',
    'calcularTotais',
    'TipoTurno',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(proibido), proibido);
  }
});

test('8. Plantão não altera nenhum módulo de autenticação', async () => {
  const [modelo, leitura, escrita] = await Promise.all([
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
    ler('lib/firebase/plantaoReadRepository.ts'),
    ler('lib/firebase/plantaoWriteRepository.ts'),
  ]);
  const fonte = `${modelo}\n${leitura}\n${escrita}`;
  for (const proibido of ['authRepository', 'signInWithPopup', 'signInWithEmailAndPassword', 'GoogleAuthProvider', 'OAuthProvider']) {
    assert.doesNotMatch(fonte, new RegExp(proibido), proibido);
  }
});

test('9. nenhum tipo/repository de Plantão usa UID como identidade funcional', async () => {
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  const semComentario = semComentarios(modelo);
  // O único "uid" tolerado é dentro de comentários/strings explicando a
  // regra (já removidos acima) — o código real (tipos/campos) nunca deve
  // declarar um campo `uid`/`usuarioUid` para Plantão.
  assert.doesNotMatch(semComentario, /\buid\b/iu, 'uid');
  assert.doesNotMatch(semComentario, /usuarioUid/u, 'usuarioUid');
});

test('10. contatos de plantonistas não aparecem hardcoded em nenhum arquivo estático versionado', async () => {
  const [modelo, leitura, escrita, fixture] = await Promise.all([
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
    ler('lib/firebase/plantaoReadRepository.ts'),
    ler('lib/firebase/plantaoWriteRepository.ts'),
    ler('packages/contrato/src/parserPlantao.ts'),
  ]);
  // O domínio só define A FORMA do contato (rotulo/numero/ativo) — nunca um
  // valor de telefone literal. Procuramos por um padrão de número de
  // telefone plausível (7+ dígitos seguidos, com ou sem separadores) em
  // qualquer um desses arquivos-fonte.
  const fonte = `${modelo}\n${leitura}\n${escrita}\n${fixture}`;
  const pareceTelefone = /(?:\+?\d[\d\s()./-]{6,}\d)/u;
  const encontrados = fonte.match(new RegExp(pareceTelefone, 'gu')) ?? [];
  // Datas ISO/timestamps (ex.: "2026-08-01T00:00:00.000Z") e datas/horas em
  // texto (ex.: "17/08/2026 - 19:00", usadas nos comentários que explicam o
  // formato do XLS) batem acidentalmente nesse padrão frouxo — filtra só
  // candidatos plausíveis a telefone (sem "/" nem "AAAA-MM-DD").
  const candidatosReais = encontrados.filter((trecho) =>
    !trecho.includes('/') && !/\d{4}-\d{2}-\d{2}/u.test(trecho));
  assert.deepEqual(candidatosReais, [], `possíveis números hardcoded: ${candidatosReais.join(', ')}`);
});

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
