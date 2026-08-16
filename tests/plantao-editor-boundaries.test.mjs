import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase ESCALAS-UX-1A: Editor visual de Plantão importado (calendário +
// modal de edição + working copy). Ver docs/spec/PLANTOES.md e
// docs/spec/EDITOR_ESCALAS.md.

test('1. lib/editorPlantao.ts é puro — sem Firestore, sem React, sem SDK nenhum', async () => {
  const fonte = semComentarios(await ler('lib/editorPlantao.ts'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'updateDoc', 'getDoc', 'getDocs', "from 'react'", 'useState', 'useEffect']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('2. PlantaoCalendario/ModalEditarAtribuicaoPlantao não importam Firebase — só apresentação/edição em memória', async () => {
  const arquivos = await Promise.all([
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'updateDoc', 'getDoc', 'getDocs', 'salvarAtribuicoesPlantaoRascunho', 'salvarParticipantePlantao']) {
      assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
    }
  }
});

test('3. nenhum arquivo novo do Editor declara ou chama publicarPlantao — publicação continua fora de escopo (PLANTÃO-3C)', async () => {
  const arquivos = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    assert.doesNotMatch(fonte, /function\s+publicarPlantao/u, 'nenhuma função de publicação pode existir nesta fase');
    assert.doesNotMatch(fonte, /['"]competenciasPlantao['"]/u, 'a coleção PUBLICADA nunca é referenciada pelo Editor');
  }
});

test('4. nenhum hardcode de unidade/equipe real (COSI/CODB/SOC/NOC/GEDSI) nos arquivos novos do Editor', async () => {
  const arquivos = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['COSI', 'CODB', 'GEDSI', 'EQ_SOC', 'EQ_NOC']) {
      assert.doesNotMatch(fonte, new RegExp(`['"\`]${proibido}['"\`]`, 'u'), `${proibido} não pode ser literal de código`);
    }
  }
});

test('5. o modal de edição não hardcoda um horário padrão (ex.: 19:00→07:00) — o usuário sempre digita', async () => {
  const fonte = semComentarios(await ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'));
  assert.doesNotMatch(fonte, /19:00/u, 'nenhum horário fixo de COSI pode vir pré-preenchido');
  assert.doesNotMatch(fonte, /07:00/u, 'nenhum horário fixo de COSI pode vir pré-preenchido');
});

test('6. drag-and-drop, geradores automáticos e cópia de período não foram introduzidos nesta fase', async () => {
  const arquivos = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['onDragStart', 'onDrop', 'draggable', 'gerarEscalaAutomatica', 'copiarPeriodoAnterior', 'distribuicaoAutomatica']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'iu'), proibido);
    }
  }
});

test('7. o Dashboard deriva a Lista e o Calendário da MESMA working copy — nunca duas fontes de verdade para as atribuições', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /aplicarVinculosNasAtribuicoes\(atribuicoesEditaveisPlantao, vinculosPlantao\)/u,
    'atribuicoesPlantaoComVinculo (consumido tanto pela Lista quanto pelo payload de salvar) precisa derivar da working copy',
  );
  assert.match(
    dashboard,
    /atribuicoes=\{atribuicoesEditaveis\}/u,
    'o PlantaoCalendario precisa consumir a mesma working copy, não uma cópia paralela',
  );
  assert.match(
    dashboard,
    /atribuicoesEditaveis=\{atribuicoesEditaveisPlantao\}/u,
    'a prop atribuicoesEditaveis de PreviewPlantao precisa vir do estado da working copy do Dashboard',
  );
});

test('8. o Dashboard continua importando plantaoReadRepository/plantaoWriteRepository, mas o Editor em si (lib/editorPlantao.ts) nunca importa nenhum dos dois', async () => {
  const editor = semComentarios(await ler('lib/editorPlantao.ts'));
  assert.doesNotMatch(editor, /plantaoReadRepository|plantaoWriteRepository/u, 'a working copy é pura — persistência é responsabilidade exclusiva do Dashboard');
});

test('9. nenhuma dependência de testing-library/jsdom foi adicionada nesta fase', async () => {
  const pacote = JSON.parse(await ler('package.json'));
  const todasDependencias = { ...pacote.dependencies, ...pacote.devDependencies };
  for (const nome of Object.keys(todasDependencias)) {
    assert.doesNotMatch(nome, /testing-library|jsdom/iu, `${nome} não deveria ter sido adicionado`);
  }
});
