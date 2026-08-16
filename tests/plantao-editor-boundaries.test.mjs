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

// Fase ESCALAS-UX-1B: "+ Nova escala" (criação manual de Plantão) — o
// mesmo Editor, nunca um segundo. Ver docs/spec/EDITOR_ESCALAS.md § 3/§ 8
// e CHECKPOINT-FASE-ESCALAS-UX-1B-NOVA-ESCALA-VAZIA.md.

test('10. existe UM único tipo de working copy (AtribuicaoPlantaoEditavel) e UM único componente de calendário/modal de Plantão — nunca um segundo editor', async () => {
  const [editor, calendario, modal, dashboard] = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
  ]);
  const fontes = [editor, calendario, modal, dashboard].map(semComentarios);
  const contarOcorrencias = (regex) => fontes.reduce((soma, fonte) => soma + (fonte.match(regex) ?? []).length, 0);

  assert.equal(contarOcorrencias(/interface AtribuicaoPlantaoEditavel\b/gu), 1, 'só pode existir UMA definição de working copy de Plantão');
  assert.equal(contarOcorrencias(/function PlantaoCalendario\b/gu), 1, 'só pode existir UM componente de calendário de Plantão');
  assert.equal(contarOcorrencias(/function ModalEditarAtribuicaoPlantao\b/gu), 1, 'só pode existir UM modal de edição de atribuição de Plantão');
  assert.doesNotMatch(dashboard, /function ModalNovaAtribuicaoManual|function ModalCriarPlantaoManual|function CalendarioPlantaoManual/u, 'a criação manual não pode ter um segundo calendário/modal próprio');
});

test('11. a working copy MANUAL nasce SEMPRE por criarAtribuicoesEditaveis (a mesma função do caminho IMPORTADO) — nunca um segundo construtor', async () => {
  const editor = semComentarios(await ler('lib/editorPlantao.ts'));
  const ocorrencias = editor.match(/export function criarAtribuicoesEditaveis\b/gu) ?? [];
  assert.equal(ocorrencias.length, 1, 'só pode existir UMA função que cria a working copy inicial');
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /setAtribuicoesEditaveisPlantao\(\[\]\)/u, 'a criação manual precisa iniciar a working copy vazia, nunca com um objeto XLS fingido');
});

test('12. lib/editorPlantao.ts e lib/conciliacaoPlantoes.ts (onde vivem os helpers de escala MANUAL) nunca importam o parser/XLSX de Plantão', async () => {
  const [editor, conciliacao] = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  for (const fonteBruta of [editor, conciliacao]) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['parsePlanilhaPlantao', 'processarArquivoImportado', "from 'xlsx'"]) {
      assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
    }
  }
});

test('13. o parser de Plantão (packages/contrato/src/parserPlantao.ts) nunca conhece a existência de escala MANUAL/criada vazia', async () => {
  const parser = semComentarios(await ler('packages/contrato/src/parserPlantao.ts'));
  assert.doesNotMatch(parser, /MANUAL|criarPlantaoEmBranco|OrigemPlantao/u, 'o parser lê planilhas — não precisa saber que existe um caminho sem planilha');
});

test('14. montarCompetenciaPlantaoRascunho/montarAtribuicoesPlantaoRascunho nunca hardcodam origem — o chamador decide, IMPORTADO ou MANUAL', async () => {
  const montagem = semComentarios(await ler('lib/montagemRascunhoPlantao.ts'));
  assert.doesNotMatch(montagem, /origem:\s*['"]IMPORTADO['"]/u, 'a origem precisa vir de um parâmetro, nunca hardcoded para IMPORTADO');
});

test('15. "+ Nova escala" nunca virou uma nova seção fixa na navegação lateral (sidebar) — é uma ação contextual da tela Escalas', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(
    dashboard,
    /\{\s*id:\s*['"]nova-?escala['"]/iu,
    'nenhum item novo de sidebar pode existir para "+ Nova escala" — ela é um botão dentro da tela Escalas',
  );
  assert.match(dashboard, /abrirNovaEscala/u, 'a ação "+ Nova escala" precisa existir em algum lugar do Dashboard');
});

test('16. a criação manual não introduz nenhuma regra de horário fixa por dia da semana (ex.: sexta/sábado = 24h) — nenhuma regra COSI de cobertura', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const proibido of ['segunda-quinta', 'gerarEscalaAutomatica', 'regraCoberturaCosi', 'distribuicaoAutomatica']) {
    assert.doesNotMatch(dashboard, new RegExp(proibido, 'iu'), proibido);
  }
});

test('17. a competência de "+ Nova escala" usa periodoDaCompetencia (a mesma janela 26→25 do resto do sistema) — nunca um cálculo de mês civil próprio', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /periodoDaCompetencia\(/u, 'criarPlantaoEmBrancoAcao precisa reaproveitar periodoDaCompetencia');
  assert.doesNotMatch(dashboard, /getDate\(\)\s*===\s*0|new Date\(\d{4},\s*\w+\s*\+\s*1,\s*0\)/u, 'nenhum cálculo de "último dia do mês civil" próprio para a competência de Plantão');
});

test('18. o Editor de Plantão nunca depende da timezone da máquina local — sempre grupo.timezone', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(
    dashboard,
    /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/u,
    'nenhuma leitura da timezone do host pode influenciar o Editor de Plantão',
  );
});

test('19. apps/app (PWA do colaborador) continua sem nenhum editor administrativo de Plantão', async () => {
  const arquivos = await Promise.all(['apps/app/src/EmployeeApp.tsx'].map((caminho) => ler(caminho).catch(() => '')));
  const fonte = semComentarios(arquivos.join('\n'));
  for (const proibido of ['PlantaoCalendario', 'ModalEditarAtribuicaoPlantao', 'ModalNovaEscala', 'criarAtribuicoesEditaveis', 'montarAtribuicoesPlantaoRascunho']) {
    assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), proibido);
  }
});
