import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase ESCALAS-UX-2A.1: ContextoEscalaAtivo + seletores reais de escala/
// competência/status no header. Ver docs/spec/REDESIGN_WORKSPACE_ESCALAS.md
// § 6/§ 7/§ 32 e CHECKPOINT-FASE-ESCALAS-UX-2A1-CONTEXTO-ATIVO.md.

// --- § 48: header ---

test('1. nenhuma competência estática "Agosto 2026" continua hardcoded como prop do header', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.doesNotMatch(dashboard, /competencia="Agosto 2026"/u, 'a prop `competencia` do AppFrame não pode mais ser uma string fixa');
});

test('2. AppFrame recebe um contexto real (contextoEscala) — nunca um valor estático — e não importa domínio de Plantão/Jornada', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /contextoEscala=\{\(/u, 'o AppFrame precisa receber o cluster de contexto via a prop `contextoEscala`');
  const appFrame = semComentarios(await ler('components/AppFrame.tsx'));
  assert.match(appFrame, /contextoEscala\?:\s*ReactNode/u, 'AppFrame precisa expor o slot `contextoEscala` como ReactNode opcional');
  assert.doesNotMatch(appFrame, /GrupoPlantao|CompetenciaPlantao|AtribuicaoPlantao|ContextoEscalaAtivo|Equipe\b/u, 'AppFrame precisa continuar genérico — nunca importa tipos de domínio');
});

test('3. Escala/Competência ficam à esquerda; notificações/tema/conta continuam a estrutura já existente à direita (nenhuma mudança na área de acoesTopo/user-menu)', async () => {
  const appFrame = await ler('components/AppFrame.tsx');
  assert.match(appFrame, /className="user-menu"/u, 'o menu de conta precisa continuar existindo, inalterado');
  assert.match(appFrame, /acoesTopo/u, 'o slot de ações globais (sino/tema) precisa continuar existindo');
  // A ordem estrutural no JSX: contextoEscala/competence-control vem ANTES de topbar-actions/acoesTopo.
  const indiceContexto = appFrame.indexOf('contextoEscala ?? (');
  const indiceAcoes = appFrame.indexOf('className="topbar-actions"');
  assert.ok(indiceContexto > 0 && indiceAcoes > indiceContexto, 'o cluster de contexto precisa vir antes das ações globais no header');
});

test('4. ContextoEscalaAtivo nunca usa nome/sigla/UID/cargo como identidade — só equipeId/grupoId (IDs reais)', async () => {
  const fonte = semComentarios(await ler('lib/contextoEscala.ts'));
  const tipo = /export type ContextoEscalaAtivo =([\s\S]*?);\n\n/u.exec(fonte);
  assert.ok(tipo, 'o tipo ContextoEscalaAtivo precisa existir');
  for (const proibido of ['nome', 'sigla', 'uid', 'cargo', 'rotulo']) {
    assert.doesNotMatch(tipo[1].toLowerCase(), new RegExp(`\\b${proibido}\\b`, 'u'), `ContextoEscalaAtivo não pode ter um campo "${proibido}"`);
  }
  assert.match(tipo[1], /equipeId: string/u);
  assert.match(tipo[1], /grupoId: string/u);
});

// --- § 44/§ 47: guarda única de alterações não salvas ---

test('5. existeAlteracaoNaoSalvaNoContextoAtivo() verifica AMBOS os dirty states (Plantão e Jornada) — nunca só um', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function existeAlteracaoNaoSalvaNoContextoAtivo\(\): boolean \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'existeAlteracaoNaoSalvaNoContextoAtivo precisa existir');
  assert.match(corpo[1], /plantaoEditadoDesdeImportacao/u, 'precisa verificar o dirty state de Plantão já existente');
  assert.match(corpo[1], /jornadaEditadaDesdeCarregamento/u, 'precisa verificar o novo dirty state de Jornada');
});

test('6. solicitarTrocaContexto/solicitarTrocaCompetencia usam a MESMA guarda — nunca dois sistemas separados', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const contexto = /function solicitarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  const competencia = /function solicitarTrocaCompetencia\(novaCompetencia: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(contexto && competencia, 'as duas funções precisam existir');
  assert.match(contexto[1], /existeAlteracaoNaoSalvaNoContextoAtivo\(\)/u);
  assert.match(competencia[1], /existeAlteracaoNaoSalvaNoContextoAtivo\(\)/u);
  assert.match(contexto[1], /setIntencaoTrocaEscalaPendente/u);
  assert.match(competencia[1], /setIntencaoTrocaEscalaPendente/u);
});

test('7. jornadaEditadaDesdeCarregamento só vira true no único ponto real de edição local (editarCelula) — nunca fora dele', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrenciasTrue = dashboard.match(/setJornadaEditadaDesdeCarregamento\(true\)/gu) ?? [];
  assert.equal(ocorrenciasTrue.length, 1, 'só pode existir UM ponto que marca a Jornada como editada');
  const editarCelula = /function editarCelula\(codigo: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(editarCelula, 'editarCelula precisa existir');
  assert.match(editarCelula[1], /setJornadaEditadaDesdeCarregamento\(true\)/u, 'a única marcação de dirty precisa estar dentro de editarCelula');
});

test('8. nenhuma nova ação de código chama window.confirm() — a guarda usa o modal UnsavedChangesDialog', async () => {
  const arquivos = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('components/escalas/UnsavedChangesDialog.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    assert.doesNotMatch(semComentarios(fonteBruta), /window\.confirm\(/u, 'nunca usar window.confirm() para a guarda de alterações não salvas');
  }
  const dialogo = await ler('components/escalas/UnsavedChangesDialog.tsx');
  assert.match(dialogo, /modal-backdrop/u, 'precisa reaproveitar o mesmo chrome de modal já existente');
  assert.match(dialogo, /Escape/u, 'Escape precisa cancelar (equivalente a "Continuar editando")');
});

test('9. cancelar a troca preserva tudo — cancelarTrocaEscalaPendente só limpa a intenção pendente, nunca mexe em contexto/competência/working copy', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function cancelarTrocaEscalaPendente\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'cancelarTrocaEscalaPendente precisa existir');
  const chamadas = corpo[1].match(/set\w+\(/gu) ?? [];
  assert.deepEqual(chamadas, ['setIntencaoTrocaEscalaPendente('], 'cancelar não pode chamar nenhum outro setState além de limpar a intenção pendente');
});

test('10. confirmar o descarte só troca DEPOIS da confirmação explícita — nunca antes/atrás do modal', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function confirmarDescarteETrocarEscala\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'confirmarDescarteETrocarEscala precisa existir');
  assert.match(corpo[1], /setIntencaoTrocaEscalaPendente\(null\)/u);
  assert.match(corpo[1], /aplicarTrocaContexto\(intencao\.alvo\)/u);
  assert.match(corpo[1], /aplicarTrocaCompetencia\(intencao\.competencia\)/u);
});

// --- § 49: integração com Plantão (reaproveita o pipeline já existente) ---

test('11. aplicarTrocaContexto (Plantão) reaproveita obterCompetenciaPlantaoRascunho + abrirRascunhoNoEditorAcao — nunca um segundo caminho de reidratação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo, 'aplicarTrocaContexto precisa existir');
  assert.match(corpo[1], /obterCompetenciaPlantaoRascunho\(grupo\.grupoId, alvo\.competencia\)/u);
  assert.match(corpo[1], /abrirRascunhoNoEditorAcao\(grupo, competenciaExistente\)/u);
  const ocorrenciasReidratar = dashboard.match(/function reidratarRascunhoPlantao\b|reidratarRascunhoPlantao\(/gu) ?? [];
  assert.ok(ocorrenciasReidratar.length <= 1, 'reidratarRascunhoPlantao só pode ser chamado de dentro de abrirRascunhoNoEditorAcao (nunca um segundo caminho direto)');
});

test('12. aplicarTrocaContexto (Jornada) reaproveita carregarEscalasEquipe + periodoDaCompetencia — nunca duplica o cálculo 26→25', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /carregarEscalasEquipe\(alvo\.equipeId, alvo\.competencia, false\)/u);
  assert.match(corpo[1], /periodoDaCompetencia\(alvo\.competencia\)/u);
});

// --- § 50: competência ausente nunca cria automaticamente ---

test('13. quando não existe rascunho de Plantão para o alvo, aplicarTrocaContexto marca "sem escala" e vai para Escalas — nunca cria/salva nada', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  const blocoSemRascunho = /if \(competenciaExistente === null\) \{([\s\S]*?)\}/u.exec(corpo[1]);
  assert.ok(blocoSemRascunho, 'o branch de "competência sem rascunho" precisa existir');
  assert.match(blocoSemRascunho[1], /setContextoSemEscala\(true\)/u);
  assert.doesNotMatch(blocoSemRascunho[1], /salvarCompetenciaPlantaoRascunho|salvarAtribuicoesPlantaoRascunho|montarCompetenciaPlantaoRascunho/u, 'nunca criar/salvar uma competência automaticamente');
});

test('14. quando não existe Jornada para o alvo, aplicarTrocaContexto marca "sem escala" e vai para Escalas — nunca inventa um calendário vazio fingindo rascunho', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  const blocoSemDocumentos = /if \(documentosExistentes\.length === 0\) \{([\s\S]*?)\}/u.exec(corpo[1]);
  assert.ok(blocoSemDocumentos, 'o branch de "nenhum documento encontrado" precisa existir');
  assert.match(blocoSemDocumentos[1], /setContextoSemEscala\(true\)/u);
  assert.match(blocoSemDocumentos[1], /setTela\('escalas'\)/u);
});

test('15. a tela Escalas mostra "Nenhuma escala criada" só quando contextoSemEscala é verdadeiro — nunca junto do card de escala existente', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /contextoSemEscala && contextoEscalaAtivo !== null && \(/u, 'o estado vazio precisa ser condicionado a contextoSemEscala');
  assert.match(dashboard, /Nenhuma escala criada para/u);
  assert.match(dashboard, /\{!contextoSemEscala && \(/u, 'o card de escala existente precisa ficar mutuamente exclusivo com o estado vazio');
});

// --- § 51: status ---

test('16. status "publicada" para Jornada só reflete um cálculo já existente (publicados/documentos) — Plantão nunca mostra "publicada" nesta fase', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const statusVar = /const statusContextoAtivo: StatusContextoEscala \| null = ([\s\S]*?);\n {2}const periodoContextoAtivo/u.exec(dashboard);
  assert.ok(statusVar, 'statusContextoAtivo precisa existir');
  assert.match(statusVar[1], /publicados\.length === documentos\.length/u, 'Jornada precisa reaproveitar o cálculo já existente de "publicados"');
  assert.doesNotMatch(statusVar[1], /'publicada'\s*:\s*'publicada'/u);
  // Fora do branch de Jornada, o único status possível para Plantão é 'rascunho' (ou 'sem-escala' já tratado antes).
  const badge = semComentarios(await ler('components/escalas/ScheduleStatusBadge.tsx'));
  assert.match(badge, /publicada: 'Publicada'/u);
  assert.doesNotMatch(badge, /publicarPlantao|PLANTAO.*publicad/iu, 'nenhuma funcionalidade nova de publicação de Plantão');
});

test('17. status nunca vira um controle editável — ScheduleStatusBadge não tem nenhum onClick/onChange', async () => {
  const badge = await ler('components/escalas/ScheduleStatusBadge.tsx');
  assert.doesNotMatch(badge, /onClick|onChange|<select|<button/u, 'o badge de status precisa continuar sendo só informativo');
  assert.match(badge, />\{ROTULOS\[status\]\}<\/span>/u, 'o texto do status precisa estar sempre visível (nunca só cor)');
});

// --- § 40/§ 39: zero mudança de schema/domínio ---

test('18. nenhum campo novo em GrupoPlantao/CompetenciaPlantao — ContextoEscalaAtivo é estado de frontend, nunca persistido', async () => {
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  assert.doesNotMatch(modelo, /contextoEscala/iu, 'o schema persistente nunca pode saber sobre ContextoEscalaAtivo');
  const contexto = semComentarios(await ler('lib/contextoEscala.ts'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'getDoc', 'getDocs', "from 'react'"]) {
    assert.doesNotMatch(contexto, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('19. nenhum componente novo de header importa Firebase diretamente', async () => {
  const arquivos = await Promise.all([
    ler('components/escalas/ScheduleContextSwitcher.tsx'),
    ler('components/escalas/ScheduleCompetenceControl.tsx'),
    ler('components/escalas/ScheduleStatusBadge.tsx'),
    ler('components/escalas/UnsavedChangesDialog.tsx'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['firebase/firestore', 'firebase/auth']) {
      assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
    }
  }
});

test('20. o roster lateral, drag-and-drop, padrão de horário e importação inline continuam fora de escopo desta fase', async () => {
  const arquivos = await Promise.all([
    ler('lib/contextoEscala.ts'),
    ler('components/escalas/ScheduleContextSwitcher.tsx'),
    ler('components/escalas/ScheduleCompetenceControl.tsx'),
    ler('components/escalas/ScheduleStatusBadge.tsx'),
    ler('components/escalas/UnsavedChangesDialog.tsx'),
  ]);
  // Nenhum dos arquivos NOVOS desta fase pode ter drag-and-drop/roster/
  // padrão de horário — o `onDragOver` pré-existente do dropzone de upload
  // de planilha em DashboardApp.tsx (recurso anterior, não relacionado)
  // fica de fora deste escopo de checagem.
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['ScheduleRoster', 'onDragStart', 'onDragOver', 'draggable', 'padraoHorario', 'PadraoHorarioSemanal']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), `${proibido} pertence a uma fase futura`);
    }
  }
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const proibido of ['ScheduleRoster', 'padraoHorario', 'PadraoHorarioSemanal']) {
    assert.doesNotMatch(dashboard, new RegExp(proibido, 'u'), `${proibido} pertence a uma fase futura`);
  }
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  assert.doesNotMatch(modelo, /padraoHorario/u, 'nenhum campo novo em GrupoPlantao nesta fase');
});
