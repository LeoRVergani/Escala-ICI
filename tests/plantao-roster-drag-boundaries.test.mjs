import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/gu, '');

// Fase ESCALAS-UX-2B: roster lateral + montagem rápida + drag-and-drop do
// Editor de Plantão. Ver docs/spec/REDESIGN_WORKSPACE_ESCALAS.md § 13-18,
// CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md.

test('1. o roster (PlantaoRoster) existe e é usado no Editor de Plantão do Dashboard', async () => {
  const roster = await ler('components/plantao/PlantaoRoster.tsx');
  assert.match(roster, /export function PlantaoRoster/u);
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /import \{ PlantaoRoster \} from '@\/components\/plantao\/PlantaoRoster';/u);
  assert.match(dashboard, /<PlantaoRoster/u);
});

test('2. o antigo bloco "Resumo por pessoa" abaixo do calendário foi removido — nenhum resquício de classe/CSS morto', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.doesNotMatch(dashboard, /plantao-resumo-por-pessoa/u, 'a classe do bloco antigo não pode mais aparecer no JSX');
  assert.doesNotMatch(dashboard, /plantao-pessoa-selecionar/u, 'o botão antigo de seleção não pode mais existir — o roster o substitui');
  const css = semComentarios(await ler('app/globals.css'));
  assert.doesNotMatch(css, /\.plantao-resumo-por-pessoa/u, 'CSS morto não pode sobreviver à remoção do JSX');
  assert.doesNotMatch(css, /\.plantao-pessoa-selecionar/u, 'CSS morto não pode sobreviver à remoção do JSX');
});

test('3. o layout de duas áreas (roster + calendário) existe — nunca três colunas permanentes', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /plantao-editor-layout/u);
  const css = await ler('app/globals.css');
  const bloco = /\.plantao-editor-layout \{([\s\S]*?)\}/u.exec(css);
  assert.ok(bloco, 'a regra de layout do roster+calendário precisa existir');
  assert.match(bloco[1], /grid-template-columns:\s*260px minmax\(0, 1fr\)/u, 'duas áreas: roster fixo + central flexível — nunca uma terceira coluna');
});

test('4. click e drag convergem para a MESMA operação de domínio — solicitarNovaAtribuicaoPlantao(plantonistaNomeOriginal, dataIso)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /function solicitarNovaAtribuicaoPlantao\(plantonistaNomeOriginal: string, dataIso: string\) \{/u, 'a operação comum precisa existir com esta assinatura exata');
  // O call site que passa a função para o calendário — nenhum segundo pipeline de criação.
  assert.match(dashboard, /onSolicitarNovaAtribuicao=\{onSolicitarNovaAtribuicao\}|onSolicitarNovaAtribuicao=\{solicitarNovaAtribuicaoPlantao\}/u);
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  // O clique no fundo do dia, o "+ Adicionar" E o drop chamam TODOS a mesma prop — nenhuma lógica de criação duplicada no calendário.
  const ocorrencias = calendario.match(/onSolicitarNovaAtribuicao\(/gu) ?? [];
  assert.ok(ocorrencias.length >= 3, `esperado pelo menos 3 chamadas de onSolicitarNovaAtribuicao (clique/drop/"+ Adicionar"), encontrado ${ocorrencias.length}`);
});

test('5. o DROP nunca grava direto — passa por solicitarNovaAtribuicaoPlantao, que decide entre quick-add e editor completo', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  const aoSoltar = /function aoSoltarNoDia\([\s\S]*?\n {2}\}/u.exec(calendario);
  assert.ok(aoSoltar, 'aoSoltarNoDia precisa existir');
  assert.doesNotMatch(aoSoltar[0], /setDoc|updateDoc|salvarAtribuicoesPlantaoRascunho|salvarCompetenciaPlantaoRascunho|salvarGrupoPlantao/u, 'o drop nunca pode gravar nada — só delega para onSolicitarNovaAtribuicao');
  assert.match(aoSoltar[0], /onSolicitarNovaAtribuicao\(/u);
});

test('6. quick-add nunca grava no Firestore — só altera a working copy em memória', async () => {
  const popover = semComentarios(await ler('components/plantao/QuickAddPlantaoPopover.tsx'));
  for (const proibido of ['firebase/firestore', 'setDoc', 'updateDoc', 'salvarAtribuicoesPlantaoRascunho', 'salvarCompetenciaPlantaoRascunho', 'salvarGrupoPlantao']) {
    assert.doesNotMatch(popover, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const confirmar = /function confirmarQuickAddPlantao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(confirmar, 'confirmarQuickAddPlantao precisa existir');
  assert.doesNotMatch(confirmar[1], /setDoc|updateDoc|salvarAtribuicoesPlantaoRascunho|salvarCompetenciaPlantaoRascunho|salvarGrupoPlantao|await /u, 'o quick-add nunca pode escrever no Firestore — só a working copy');
  assert.match(confirmar[1], /criarAtribuicaoPlantaoNaWorkingCopy\(/u);
});

test('7. o padrão vem de GrupoPlantao.padraoHorarioSemanal (obterPadraoHorarioGrupoParaData), nunca de um cache paralelo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function solicitarNovaAtribuicaoPlantao\(plantonistaNomeOriginal: string, dataIso: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /obterPadraoHorarioGrupoParaData\(grupo, dataIso\)/u);
  assert.match(corpo[1], /gruposPlantaoAdmin\.find\(/u, 'o grupo precisa vir de gruposPlantaoAdmin (fonte real), nunca copiado para ContextoEscalaAtivo/CompetenciaPlantao');
  // Nunca copiado para outro lugar do estado (ContextoEscalaAtivo/CompetenciaPlantao continuam sem o campo).
  const contextoEscala = semComentarios(await ler('lib/contextoEscala.ts'));
  assert.doesNotMatch(contextoEscala, /padraoHorarioSemanal/u, 'ContextoEscalaAtivo não pode conhecer o padrão semanal');
});

/**
 * Fase ESCALAS-UX-2B.2 — § 23-25 do pedido: reescrito. Sem padrão
 * configurado, `solicitarNovaAtribuicaoPlantao` NÃO cai mais direto no
 * editor completo silenciosamente (esse comportamento era indistinguível
 * de um bug de drag na homologação real) — sempre abre o quick-add, que
 * mostra "Nenhum padrão configurado" com as ações "Configurar padrão"/
 * "Informar horário manualmente". "Informar horário manualmente"
 * (`informarHorarioManualmenteQuickAdd`) é quem abre o editor completo,
 * nunca a função de decisão em si.
 */
test('8. sem padrão configurado, sempre abre o quick-add (nunca cai direto/silenciosamente no editor completo)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function solicitarNovaAtribuicaoPlantao\(plantonistaNomeOriginal: string, dataIso: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.doesNotMatch(corpo[1], /if \(padrao === null\)/u, 'não pode mais haver um branch que decide "sem padrão -> editor completo" dentro da função de decisão');
  assert.match(corpo[1], /setQuickAddPlantao\(\{ plantonistaNomeOriginal, dataIso, padrao \}\)/u, 'sempre abre o quick-add, com ou sem padrão — o popover decide o que mostrar');
});

test('8b. "Informar horário manualmente" (sem padrão) abre o editor completo com o mesmo participante/data, início/fim vazios', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function informarHorarioManualmenteQuickAdd\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'informarHorarioManualmenteQuickAdd precisa existir');
  assert.match(corpo[1], /setQuickAddPlantao\(null\)/u);
  assert.match(corpo[1], /abrirCriacaoAtribuicaoPlantao\(estado\.dataIso, estado\.plantonistaNomeOriginal\)/u);
});

/**
 * Fase ESCALAS-UX-2B.2 — § 28 do pedido: reescrito. "Outro horário" (só
 * aparece quando HÁ padrão) agora pré-preenche início/fim derivados do
 * padrão via `construirAtribuicaoDoPadraoHorario` — nunca mais campos
 * vazios obrigando o coordenador a redigitar tudo que o padrão já sabia.
 */
test('9. "Outro horário" fecha o quick-add e abre o editor completo já pré-preenchido com o horário do padrão', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirOutroHorarioQuickAddPlantao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirOutroHorarioQuickAddPlantao precisa existir');
  assert.match(corpo[1], /setQuickAddPlantao\(null\)/u);
  assert.match(corpo[1], /construirAtribuicaoDoPadraoHorario\(/u, 'precisa derivar início/fim do padrão, nunca abrir vazio');
  assert.match(corpo[1], /setModalAtribuicaoPlantao\(\{/u);
  assert.doesNotMatch(corpo[1], /hora:\s*''/u, 'não pode mais forçar hora vazia quando há padrão para derivar');
});

test('10. o preview do quick-add reaproveita previewPadraoHorarioPlantaoDia (mesmo cálculo já usado na Administração do Grupo) — nunca uma segunda implementação, nunca expõe fimDiaOffset cru', async () => {
  const popover = semComentarios(await ler('components/plantao/QuickAddPlantaoPopover.tsx'));
  assert.match(popover, /import \{ previewPadraoHorarioPlantaoDia \} from '\.\/PadraoHorarioSemanalCampo';/u);
  assert.match(popover, /previewPadraoHorarioPlantaoDia\(padrao\)/u);
  assert.doesNotMatch(popover, /fimDiaOffset/u, 'o popover nunca deve referenciar fimDiaOffset diretamente — só o texto já formatado');
});

/**
 * Fase ESCALAS-UX-2B.2 — a contagem esperada subiu de 1 para 2:
 * `confirmarQuickAddPlantao` (confirma o padrão como a atribuição) E
 * `abrirOutroHorarioQuickAddPlantao` (§ 28 do pedido — deriva o
 * pré-preenchimento do editor completo a partir do MESMO padrão) — ainda
 * uma ÚNICA função pura de construção, nunca um terceiro objeto manual
 * paralelo.
 */
test('11. construção da atribuição pelo padrão é uma ÚNICA função pura (construirAtribuicaoDoPadraoHorario) — nenhum objeto manual paralelo em drag/click/quick-add', async () => {
  const editor = semComentarios(await ler('lib/editorPlantao.ts'));
  assert.match(editor, /export function construirAtribuicaoDoPadraoHorario/u);
  const ocorrenciasDefinicao = editor.match(/function construirAtribuicaoDoPadraoHorario\(/gu) ?? [];
  assert.equal(ocorrenciasDefinicao.length, 1, 'só pode existir UMA definição da função');
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrencias = dashboard.match(/construirAtribuicaoDoPadraoHorario\(/gu) ?? [];
  assert.equal(ocorrencias.length, 2, 'só pode ser chamada de dois lugares (confirmarQuickAddPlantao e abrirOutroHorarioQuickAddPlantao) — nunca um terceiro construtor manual');
});

test('12. nenhuma atribuição existente é normalizada/recalculada ao adicionar uma nova pelo padrão — criarAtribuicaoPlantaoNaWorkingCopy só ACRESCENTA', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function criarAtribuicaoPlantaoNaWorkingCopy\(valores: FormularioAtribuicaoPlantao\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'criarAtribuicaoPlantaoNaWorkingCopy precisa existir');
  assert.match(corpo[1], /adicionarAtribuicaoEditavel\(/u, 'precisa usar adicionarAtribuicaoEditavel (só acrescenta, nunca mapeia/edita as existentes)');
  assert.doesNotMatch(corpo[1], /editarAtribuicaoEditavel|excluirAtribuicaoEditavel/u, 'a criação nunca pode editar/excluir atribuições existentes');
});

test('13. dirty real (plantaoPossuiAlteracoesNaoSalvas) é usado — nunca plantaoEditadoDesdeImportacao como guard das novas ações', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['criarAtribuicaoPlantaoNaWorkingCopy', 'confirmarQuickAddPlantao']) {
    const corpo = new RegExp(`function ${nomeFuncao}\\([^)]*\\) \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
  }
  // marcarPlantaoEditadoNoEditor() é quem seta plantaoPossuiAlteracoesNaoSalvas — confirmado pela FIX phase; aqui só garantimos que a nova função de criação a invoca.
  const criar = /function criarAtribuicaoPlantaoNaWorkingCopy\(valores: FormularioAtribuicaoPlantao\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.match(criar[1], /marcarPlantaoEditadoNoEditor\(\)/u);
});

test('14. drag-and-drop não escreve Firestore em nenhum componente novo/alterado desta fase (PlantaoRoster/PlantaoCalendario/QuickAddPlantaoPopover)', async () => {
  const arquivos = await Promise.all([
    ler('components/plantao/PlantaoRoster.tsx'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/QuickAddPlantaoPopover.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    assert.doesNotMatch(fonte, /firebase\/firestore|setDoc|updateDoc/u, 'componentes de apresentação de Plantão nunca importam Firebase diretamente');
  }
});

test('15. nenhuma sigla hardcoded (COSI/SOC/NOC/CODB) nos componentes/funções novos desta fase', async () => {
  const arquivos = await Promise.all([
    ler('components/plantao/PlantaoRoster.tsx'),
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/QuickAddPlantaoPopover.tsx'),
    ler('lib/editorPlantao.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
  ]);
  const fonte = arquivos.map(semComentarios).join('\n');
  for (const sigla of ['COSI', 'SOC', 'NOC', 'CODB']) {
    assert.doesNotMatch(fonte, new RegExp(`['"\`]${sigla}['"\`]`, 'u'), `nenhum literal "${sigla}" hardcoded`);
  }
});

test('16. nenhuma publicação de Plantão foi introduzida — publicarPlantao continua inexistente, status "Rascunho" não muda automaticamente', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /function publicarPlantao\(/u, 'publicarPlantao pertence a PLANTÃO-3C');
  const criar = /function criarAtribuicaoPlantaoNaWorkingCopy\(valores: FormularioAtribuicaoPlantao\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.doesNotMatch(criar[1], /status:\s*'PUBLICADA'/u, 'criar uma atribuição nunca pode mudar o status para PUBLICADA');
});

test('17. nenhuma biblioteca grande de calendário/drag-and-drop foi adicionada (só HTML5 nativo)', async () => {
  const packageJson = JSON.parse(await ler('package.json'));
  const todasDependencias = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const proibido of ['react-dnd', 'react-beautiful-dnd', '@dnd-kit/core', '@dnd-kit/sortable', 'fullcalendar', '@popperjs/core', '@floating-ui/react', '@floating-ui/dom', 'interactjs']) {
    assert.equal(proibido in todasDependencias, false, `${proibido} não pode ter sido adicionado`);
  }
});

test('18. no mobile, o roster não força scroll horizontal da página — só a lista interna rola', async () => {
  const css = await ler('app/globals.css');
  const blocoMobile = /@media \(max-width: 780px\) \{([\s\S]*?)\n\}/gu;
  let encontrouRegra = false;
  let match;
  while ((match = blocoMobile.exec(css)) !== null) {
    if (match[1].includes('.plantao-roster-lista')) {
      encontrouRegra = true;
      assert.match(match[1], /overflow-x:\s*auto/u, 'a lista do roster precisa rolar horizontalmente sozinha no mobile, não a página');
    }
  }
  assert.ok(encontrouRegra, 'precisa existir uma regra mobile específica para .plantao-roster-lista');
});

test('19. acessibilidade — cada pessoa do roster continua sendo um <button> real com aria-pressed, nunca só um <div> com onClick', async () => {
  const roster = await ler('components/plantao/PlantaoRoster.tsx');
  assert.match(roster, /<button[\s\S]*?aria-pressed=\{selecionado\}/u);
  assert.match(roster, /draggable/u, 'drag precisa existir no MESMO elemento acessível, nunca um elemento paralelo só-para-drag');
});

test('20. a alternativa por clique/teclado continua obrigatória mesmo com drag disponível — "+ Adicionar" permanece um <button> focável em cada dia', async () => {
  const calendario = await ler('components/plantao/PlantaoCalendario.tsx');
  assert.match(calendario, /<button[\s\S]{0,200}className="plantao-adicionar"/u);
});
