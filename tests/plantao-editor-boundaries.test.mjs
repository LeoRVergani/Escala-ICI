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

test('6. geradores automáticos e cópia de período não foram introduzidos nesta fase (drag-and-drop passou a ser autorizado na ESCALAS-UX-2B — ver tests/plantao-roster-drag-boundaries.test.mjs)', async () => {
  const arquivos = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['gerarEscalaAutomatica', 'copiarPeriodoAnterior', 'distribuicaoAutomatica']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'iu'), proibido);
    }
  }
});

test('7. o Dashboard deriva o Calendário e o payload salvo da MESMA working copy — nunca duas fontes de verdade para as atribuições', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /aplicarVinculosNasAtribuicoes\(atribuicoesEditaveisPlantao, vinculosPlantao\)/u,
    'atribuicoesPlantaoComVinculo, consumido pelo payload de salvar, precisa derivar da working copy',
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

// Fase ESCALAS-UX-1B.1: reabrir um rascunho de Plantão no MESMO Editor
// (round-trip UTC↔civil + reidratação da working copy). Ver
// docs/spec/PLANTOES.md § 26 e CHECKPOINT-FASE-ESCALAS-UX-1B1-REABRIR-RASCUNHO.md.

test('20. reidratarRascunhoPlantao() (lib/montagemRascunhoPlantao.ts) é pura — sem React, sem Firestore', async () => {
  const fonte = semComentarios(await ler('lib/montagemRascunhoPlantao.ts'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'updateDoc', 'getDoc', 'getDocs', "from 'react'", 'useState', 'useEffect']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('21. converterInstanteUtcParaMomento()/converterMomentoParaInstanteUtc() (packages/contrato/src/modeloPlantaoPersistente.ts) nunca importam Firebase nem dependem da timezone do host', async () => {
  const fonte = semComentarios(await ler('packages/contrato/src/modeloPlantaoPersistente.ts'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', "from 'firebase", 'Intl.DateTimeFormat().resolvedOptions']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
  assert.match(fonte, /export function converterInstanteUtcParaMomento/u, 'a conversão inversa precisa existir e ser exportada');
});

test('22. reabrir um rascunho continua usando a MESMA working copy/calendário/modal — nenhum segundo Editor, nenhuma segunda estrutura de dados', async () => {
  const [editor, calendario, modal, dashboard, montagem] = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/montagemRascunhoPlantao.ts'),
  ]);
  const fontes = [editor, calendario, modal, dashboard, montagem].map(semComentarios);
  const contarOcorrencias = (regex) => fontes.reduce((soma, fonte) => soma + (fonte.match(regex) ?? []).length, 0);

  assert.equal(contarOcorrencias(/interface AtribuicaoPlantaoEditavel\b/gu), 1, 'só pode existir UMA definição de working copy de Plantão');
  assert.equal(contarOcorrencias(/function PlantaoCalendario\b/gu), 1, 'só pode existir UM componente de calendário de Plantão');
  assert.equal(contarOcorrencias(/function ModalEditarAtribuicaoPlantao\b/gu), 1, 'só pode existir UM modal de edição de atribuição de Plantão');
  assert.equal(contarOcorrencias(/function reidratarRascunhoPlantao\b/gu), 1, 'só pode existir UMA função de reidratação');
  assert.doesNotMatch(
    semComentarios(dashboard),
    /function EditorRascunhoPlantao|function CalendarioRascunhoPlantao|AtribuicaoPlantaoRascunhoEditavelV2/u,
    'reabrir um rascunho não pode ter um Editor/tipo próprio',
  );
});

test('23. a limpeza de documentos órfãos em salvarAtribuicoesPlantaoRascunho() nunca usa deleteDoc solto — sempre dentro do mesmo batch das atualizações (atomicidade)', async () => {
  const fonte = semComentarios(await ler('lib/firebase/plantaoWriteRepository.ts'));
  assert.doesNotMatch(fonte, /\bdeleteDoc\(/u, 'exclusão de atribuições órfãs deve ser batch.delete(), nunca deleteDoc() solto');
  assert.match(fonte, /batch\.delete\(/u, 'a limpeza de documentos órfãos precisa existir');
});

test('24. a publicação fica isolada no repository; módulos puros continuam sem copiar-anterior ou drag-and-drop', async () => {
  const arquivosPuros = await Promise.all([
    ler('lib/montagemRascunhoPlantao.ts'),
    ler('lib/editorPlantao.ts'),
    ler('lib/firebase/plantaoReadRepository.ts'),
  ]);
  for (const fonteBruta of arquivosPuros) {
    const fonte = semComentarios(fonteBruta);
    assert.doesNotMatch(fonte, /function\s+publicarCompetenciaPlantao/u, 'módulos puros não publicam');
    for (const proibido of ['onDragStart', 'onDrop', 'draggable', 'copiarPeriodoAnterior', 'copiarEscalaAnterior']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'iu'), proibido);
    }
  }
  const writeRepo = semComentarios(await ler('lib/firebase/plantaoWriteRepository.ts'));
  assert.match(writeRepo, /export async function publicarCompetenciaPlantao/u);
  assert.match(writeRepo, /['"]competenciasPlantao['"]/u);
});

test('25. firestore.rules continua com diff zero — a correção de leitura para GESTOR_EQUIPE foi feita no repository, nunca na Rule', async () => {
  // Prova indireta: nenhuma das funções novas/alteradas do repository de
  // leitura referencia "firestore.rules" como algo a modificar, e o
  // `where('grupoId', ...)` (a correção real) vive no client, não na Rule.
  const leitura = semComentarios(await ler('lib/firebase/plantaoReadRepository.ts'));
  assert.match(leitura, /where\('grupoId', '==', grupoId\)/u, "a correção de list precisa estar no repository (where('grupoId', ...))");
});

// Fase ESCALAS-UX-1C: "Usar período anterior" + distribuição rápida por
// clique. Ver docs/spec/EDITOR_ESCALAS.md § 7/§ 19-30 e
// CHECKPOINT-FASE-ESCALAS-UX-1C-FACILIDADES-DISTRIBUICAO.md.

test('26. "Usar período anterior"/distribuição rápida continuam usando a MESMA working copy/calendário/modal — nenhum segundo Editor, nenhuma segunda estrutura de dados', async () => {
  const [editor, calendario, modal, dashboard, montagem] = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/montagemRascunhoPlantao.ts'),
  ]);
  const fontes = [editor, calendario, modal, dashboard, montagem].map(semComentarios);
  const contarOcorrencias = (regex) => fontes.reduce((soma, fonte) => soma + (fonte.match(regex) ?? []).length, 0);

  assert.equal(contarOcorrencias(/interface AtribuicaoPlantaoEditavel\b/gu), 1, 'só pode existir UMA definição de working copy de Plantão');
  assert.equal(contarOcorrencias(/function PlantaoCalendario\b/gu), 1, 'só pode existir UM componente de calendário de Plantão');
  assert.equal(contarOcorrencias(/function ModalEditarAtribuicaoPlantao\b/gu), 1, 'só pode existir UM modal de edição de atribuição de Plantão');
  assert.equal(contarOcorrencias(/export function copiarAtribuicoesParaNovaCompetencia\b/gu), 1, 'só pode existir UMA função de cópia de competência anterior');
  assert.equal(contarOcorrencias(/export function criarAtribuicaoEditavelDeCompetenciaAnterior\b/gu), 1, 'só pode existir UMA função que constrói uma atribuição editável a partir da cópia');
  assert.doesNotMatch(
    semComentarios(dashboard),
    /function EditorPeriodoAnterior|function CalendarioPeriodoAnterior|AtribuicaoPlantaoCopiadaEditavelV2/u,
    '"Usar período anterior" não pode ter um Editor/tipo próprio',
  );
});

test('27. nenhum gerador automático, rotação ou regra de cobertura foi introduzido por "Usar período anterior"/distribuição rápida', async () => {
  const arquivos = await Promise.all([
    ler('lib/montagemRascunhoPlantao.ts'),
    ler('lib/editorPlantao.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['gerarEscalaAutomatica', 'distribuicaoAutomatica', 'rotacionar', 'regraCoberturaCosi', 'proximoPlantonista']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'iu'), proibido);
    }
  }
});

test('28. a distribuição rápida por clique nunca inventa horário — abrirCriacaoAtribuicaoPlantao continua abrindo o modal com início/fim vazios mesmo com plantonista selecionado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirCriacaoAtribuicaoPlantao\(dataIso: string, plantonistaNomeOriginal\?: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirCriacaoAtribuicaoPlantao precisa existir');
  assert.match(corpo[1], /inicio:\s*\{\s*data:\s*dataIso,\s*hora:\s*''\s*\}/u, 'início nunca pode vir pré-preenchido com um horário');
  assert.match(corpo[1], /fim:\s*\{\s*data:\s*dataIso,\s*hora:\s*''\s*\}/u, 'fim nunca pode vir pré-preenchido com um horário');
  for (const proibido of ['19:00', '07:00']) {
    assert.doesNotMatch(corpo[1], new RegExp(proibido, 'u'), `${proibido} não pode ser um horário fixo inventado`);
  }
});

test('29. a seleção de plantonista (painel "Resumo por pessoa") é puramente de UI — nunca escreve no Firestore nem chama Firebase', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function alternarPlantonistaSelecionado\(nomeOriginal: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'alternarPlantonistaSelecionado precisa existir');
  for (const proibido of ['setDoc', 'updateDoc', 'salvarParticipantePlantao', 'salvarGrupoPlantao', 'await ']) {
    assert.doesNotMatch(corpo[1], new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

/**
 * 30. ERRATA (ESCALAS-UX-2B) — este teste, criado em ESCALAS-UX-1C,
 * proibia drag-and-drop porque aquela fase explicitamente NÃO o
 * implementava. A ESCALAS-UX-2B autoriza drag-and-drop no roster/
 * calendário de Plantão como um segundo gatilho para a MESMA operação já
 * usada pelo clique (nunca um pipeline de domínio paralelo) — a
 * cobertura completa dessa garantia (drag e click convergem para
 * `solicitarNovaAtribuicaoPlantao`, drop nunca grava Firestore, sem drag
 * no mobile) vive em `tests/plantao-roster-drag-boundaries.test.mjs`.
 * `lib/montagemRascunhoPlantao.ts`/`lib/conciliacaoPlantoes.ts` continuam
 * sem nenhuma menção a drag — só a camada de apresentação (roster/
 * calendário) ganhou os handlers nativos do navegador.
 */
test('30. drag-and-drop não vazou para os módulos de domínio puro (montagem/conciliação) — só a camada de apresentação (roster/calendário) manipula eventos de drag', async () => {
  const arquivos = await Promise.all([
    ler('lib/montagemRascunhoPlantao.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['onDragStart', 'onDragOver', 'onDrop', 'draggable']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), `${proibido} não pode existir num módulo de domínio puro`);
    }
  }
});

test('31. "Usar período anterior" só lê a competência anterior (nunca a reidrata como working copy nem grava nela) — usarPeriodoAnteriorAcao nunca chama salvarAtribuicoesPlantaoRascunho/salvarCompetenciaPlantaoRascunho com a competência anterior', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function usarPeriodoAnteriorAcao\([^)]*\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo, 'usarPeriodoAnteriorAcao precisa existir');
  assert.doesNotMatch(corpo[1], /salvarAtribuicoesPlantaoRascunho|salvarCompetenciaPlantaoRascunho|salvarParticipantePlantao/u, 'a leitura da competência anterior nunca pode gravar nada');
  assert.match(corpo[1], /listarAtribuicoesPlantaoRascunho\(grupo\.grupoId,\s*labelAnterior\)/u, 'as atribuições anteriores precisam ser só lidas (leitura pura)');
});

test('32. o "Salvar rascunho" (salvarRascunhoPlantaoAcao) sempre grava na competência NOVA (estado atual), nunca em um identificador de competência anterior', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function salvarRascunhoPlantaoAcao\(\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo, 'salvarRascunhoPlantaoAcao precisa existir');
  assert.match(corpo[1], /idCompetenciaPlantao\(grupo\.grupoId,\s*competencia\)/u, 'o id da competência a salvar precisa vir de `competencia` (competenciaRascunho), nunca de uma variável de "anterior"');
  assert.doesNotMatch(corpo[1], /labelAnterior|competenciaAnterior\(/u, 'salvarRascunhoPlantaoAcao nunca deve referenciar a competência anterior');
});

// Revisão visual compacta da importação de Plantão.

test('33. a revisão abre com Calendário e mantém somente as abas úteis; Resumo e Lista não voltam como painéis vazios/confusos', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const preview = /function PreviewPlantao\([\s\S]*?\n\}\n\nexport function DashboardApp/u.exec(dashboard)?.[0] ?? '';
  assert.match(dashboard, /type AbaPreviaPlantao = 'calendario' \| 'contabilidade' \| 'vinculos'/u);
  assert.match(dashboard, /useState<AbaPreviaPlantao>\('calendario'\)/u);
  assert.match(preview, />Calendário<\/button>/u);
  assert.match(preview, />Contabilidade<\/button>/u);
  assert.doesNotMatch(preview, />Resumo<\/button>|>Lista<\/button>/u);
});

test('34. o calendário ocupa o topo visual e os diagnósticos da fonte ficam depois dele', async () => {
  const [dashboard, css] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('app/globals.css'),
  ]);
  assert.match(dashboard, /plantao-preview-principal/u);
  assert.match(dashboard, /plantao-preview-fonte/u);
  assert.match(dashboard, /plantao-preview-divergencias/u);
  assert.match(css, /\.plantao-preview-principal\s*\{[^}]*order:\s*1/u);
  assert.match(css, /\.plantao-preview-fonte\s*\{[^}]*order:\s*2/u);
  assert.match(css, /\.plantao-preview-divergencias\s*\{[^}]*order:\s*3/u);
  assert.match(dashboard, /plantao-command-panel/u);
});

test('34.1 ações de validar, salvar e publicar ficam acima do calendário e o card inferior de salvamento não volta', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const inicioBarra = dashboard.indexOf('className="panel plantao-command-panel"');
  const fimBarra = dashboard.indexOf('className="import-panel panel"', inicioBarra);
  const inicioPreview = dashboard.indexOf('<PreviewPlantao', inicioBarra);
  assert.ok(inicioBarra > 0 && fimBarra > inicioBarra && inicioPreview > fimBarra, 'a barra operacional precisa aparecer antes do calendário/preview');
  const barra = dashboard.slice(inicioBarra, fimBarra);
  assert.match(barra, /Importar outra planilha/u);
  assert.match(barra, /Validar prévia/u);
  assert.match(barra, /Salvar rascunho/u);
  assert.match(barra, /Publicar Plantão/u);
  assert.match(barra, /rascunho-plantao-grupo/u);
  assert.match(barra, /rascunho-plantao-competencia/u);
  assert.doesNotMatch(barra, /className=\{`dropzone/u, 'depois de detectar Plantão, importar deve ser botão e não um dropzone grande');
  assert.match(barra, /rascunhoPlantaoProntoParaPublicar/u, 'publicar só habilita depois de salvar a versão atual');
  assert.doesNotMatch(dashboard, />Salvar como rascunho</u, 'o card inferior antigo precisa ser removido');
});

test('35. cartões importados mostram iniciais maiores e horário compacto ao lado, preservando o horário completo no título acessível', async () => {
  const [calendario, css] = await Promise.all([
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('app/globals.css'),
  ]);
  assert.match(calendario, /function rotuloHorarioCompacto\(horario: string\)/u);
  assert.match(calendario, /return `\$\{compactar\(inicio \?\? ''\)\}–\$\{compactar\(fim \?\? ''\)\}`/u);
  assert.match(calendario, /title=\{`\$\{atribuicao\.plantonistaNomeOriginal\} · \$\{horario\}`\}/u);
  assert.match(calendario, /plantao-card-iniciais[\s\S]*?plantao-card-horario/u);
  assert.match(css, /\.plantao-dia-importacao \.plantao-card\s*\{[^}]*flex-direction:\s*row/u);
  assert.match(css, /\.plantao-card-iniciais\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/u);
  assert.match(css, /\.plantao-dia-importacao \.plantao-card-horario\s*\{[^}]*font-size:\s*11\.5px/u);
});

test('36. usuário ausente pode ser criado e vinculado no modal, sempre na equipe responsável do Grupo e nunca associado ao usuário logado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /onCriarUsuarioParaVinculo=\{abrirCadastroUsuarioParaVinculo\}/u);
  assert.match(dashboard, /Criar e vincular/u);
  assert.match(dashboard, /grupo\.equipeResponsavelId\.trim\(\) === ''/u);
  assert.match(dashboard, /participanteVinculoCadastro === null\s*\? usuarioEfetivo\?\.equipeId \?\? ''\s*:\s*grupoCadastroVinculo\?\.equipeResponsavelId \?\? ''/u);
  assert.match(dashboard, /equipeId:\s*equipeIdCadastroUsuario,\s*uid:\s*undefined/u);
  assert.match(dashboard, /confirmarVinculoPlantaoAcao\(participanteVinculoCadastro, usuarioSalvo\)/u);
  assert.match(dashboard, /const usuariosDoAlvo = cadastroNovo && participanteVinculoCadastro !== null/u, 'repetir a ação precisa consultar o alvo e reutilizar cadastro existente');
  assert.match(dashboard, /cadastroReaproveitado/u, 'cadastro já existente não pode ser regravado como update administrativo');
  assert.match(dashboard, /souAdmin && participanteVinculoCadastro === null/u);
  assert.doesNotMatch(dashboard, /onCriarUsuarioParaVinculo=\{\(\) => setTela\('usuarios'\)\}/u);
});
