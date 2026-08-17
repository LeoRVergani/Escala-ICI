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

test('5. existeAlteracaoNaoSalvaNoContextoAtivo() verifica AMBOS os dirty states explícitos (Plantão e Jornada) — nunca plantaoEditadoDesdeImportacao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function existeAlteracaoNaoSalvaNoContextoAtivo\(\): boolean \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'existeAlteracaoNaoSalvaNoContextoAtivo precisa existir');
  assert.match(corpo[1], /plantaoPossuiAlteracoesNaoSalvas/u, 'precisa verificar o dirty state explícito de Plantão');
  assert.match(corpo[1], /jornadaPossuiAlteracoesNaoSalvas/u, 'precisa verificar o dirty state explícito de Jornada');
  assert.doesNotMatch(corpo[1], /plantaoEditadoDesdeImportacao/u, 'FIX ESCALAS-UX-2A.1: o guard nunca pode usar plantaoEditadoDesdeImportacao — esse estado só significa "divergiu da importação", não "existe algo não salvo"');
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

test('7. jornadaPossuiAlteracoesNaoSalvas vira true em editarCelula (mutação local) E nos pontos de importação não salva (aplicarConciliacao/cadastrarFaltantes) — FIX ESCALAS-UX-2A.1: cobertura completa, não só editarCelula', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrenciasTrue = dashboard.match(/setJornadaPossuiAlteracoesNaoSalvas\(true\)/gu) ?? [];
  assert.equal(ocorrenciasTrue.length, 3, 'exatamente 3 pontos marcam a Jornada como não salva: editarCelula, aplicarConciliacao, cadastrarFaltantes');
  const editarCelula = /function editarCelula\(codigo: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(editarCelula, 'editarCelula precisa existir');
  assert.match(editarCelula[1], /setJornadaPossuiAlteracoesNaoSalvas\(true\)/u, 'a mutação local de célula precisa marcar dirty=true');
  const aplicarConciliacao = /function aplicarConciliacao\(buffer: ArrayBuffer, linhas: LinhaConciliacao\[\]\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(aplicarConciliacao, 'aplicarConciliacao precisa existir');
  assert.match(aplicarConciliacao[1], /setJornadaPossuiAlteracoesNaoSalvas\(true\)/u, 'importar/reconciliar planilha nunca pode deixar dirty=false — importar não é salvar');
});

// --- FASE ESCALAS-UX-2A.1-FIX — Problema 1: dirty de Plantão explícito ---

test('21. existe um dirty state explícito de Plantão separado de plantaoEditadoDesdeImportacao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const \[plantaoPossuiAlteracoesNaoSalvas, setPlantaoPossuiAlteracoesNaoSalvas\] = useState\(false\)/u, 'plantaoPossuiAlteracoesNaoSalvas precisa existir como estado próprio');
  assert.match(dashboard, /const \[plantaoEditadoDesdeImportacao, setPlantaoEditadoDesdeImportacao\] = useState\(false\)/u, 'plantaoEditadoDesdeImportacao precisa continuar existindo — não foi removido, só deixou de ser o guard');
});

test('22. importar/criar vazia/usar período anterior de Plantão marcam plantaoPossuiAlteracoesNaoSalvas=true mesmo quando plantaoEditadoDesdeImportacao continua false', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const interpretarPlantao = /function interpretarPlantao\(buffer: ArrayBuffer, nome: string, resultado: ResultadoParsePlantao\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(interpretarPlantao, 'interpretarPlantao precisa existir');
  assert.match(interpretarPlantao[1], /setPlantaoEditadoDesdeImportacao\(false\)/u);
  assert.match(interpretarPlantao[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u, 'importar uma planilha de Plantão precisa marcar alteração não salva mesmo sem nenhuma edição de célula');

  const criarVazia = /async function criarPlantaoEmBrancoAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(criarVazia, 'criarPlantaoEmBrancoAcao precisa existir');
  assert.match(criarVazia[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u);

  const usarAnterior = /async function usarPeriodoAnteriorAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(usarAnterior, 'usarPeriodoAnteriorAcao precisa existir');
  assert.match(usarAnterior[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u);
});

test('23. reabrir rascunho de Plantão persistido zera plantaoPossuiAlteracoesNaoSalvas; salvar com sucesso também zera', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const abrirRascunho = /async function abrirRascunhoNoEditorAcao\(([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(abrirRascunho, 'abrirRascunhoNoEditorAcao precisa existir');
  assert.match(abrirRascunho[1], /setPlantaoPossuiAlteracoesNaoSalvas\(false\)/u, 'reabrir um rascunho já persistido precisa zerar o dirty state');

  const salvar = /async function salvarRascunhoPlantaoAcao\(\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(salvar, 'salvarRascunhoPlantaoAcao precisa existir');
  const corpoTry = /try \{([\s\S]*?)\} catch \(falha\) \{([\s\S]*?)\n {4}\} finally/u.exec(salvar[1]);
  assert.ok(corpoTry, 'salvarRascunhoPlantaoAcao precisa ter try/catch');
  assert.match(corpoTry[1], /setPlantaoPossuiAlteracoesNaoSalvas\(false\)/u, 'salvar com sucesso precisa zerar o dirty state');
  assert.doesNotMatch(corpoTry[2], /setPlantaoPossuiAlteracoesNaoSalvas/u, 'o catch de erro NUNCA pode zerar o dirty state — deve permanecer true');
});

test('24. mutações do Editor de Plantão (editar/adicionar/excluir atribuição, confirmar/desfazer vínculo) marcam plantaoPossuiAlteracoesNaoSalvas=true', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const marcarEditado = /function marcarPlantaoEditadoNoEditor\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(marcarEditado, 'marcarPlantaoEditadoNoEditor precisa existir (chamado por editar/adicionar/excluir atribuição)');
  assert.match(marcarEditado[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u);

  const confirmarVinculo = /function confirmarVinculoPlantaoAcao\(participanteNomeOriginal: string, usuario: Usuario\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(confirmarVinculo, 'confirmarVinculoPlantaoAcao precisa existir');
  assert.match(confirmarVinculo[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u, 'confirmar vínculo afeta o payload salvo — precisa marcar dirty=true');

  const desfazerVinculo = /function desfazerVinculoPlantaoAcao\(participanteNomeOriginal: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(desfazerVinculo, 'desfazerVinculoPlantaoAcao precisa existir');
  assert.match(desfazerVinculo[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u, 'desfazer vínculo afeta o payload salvo — precisa marcar dirty=true');
});

// --- FASE ESCALAS-UX-2A.1-FIX — Problema 3: grupos consulta-only não alimentam o switcher editável ---

test('25. opcoesContextoPlantao filtra gruposPlantaoAdmin por podeGerenciarEsteGrupoPlantao — grupos só-consultados não aparecem como contexto editável nesta fase', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const trecho = /const opcoesContextoPlantao: OpcaoContextoEscala\[\] = ([\s\S]*?);\n {2}const rotuloContextoAtivo/u.exec(dashboard);
  assert.ok(trecho, 'opcoesContextoPlantao precisa existir');
  assert.match(trecho[1], /gruposPlantaoAdmin\s*\n?\s*\.filter\(podeGerenciarEsteGrupoPlantao\)/u, 'a lista de opções editáveis precisa filtrar por podeGerenciarEsteGrupoPlantao');
  for (const proibido of ['SOC', 'NOC', 'COSI', 'CODB']) {
    assert.doesNotMatch(trecho[1], new RegExp(`['"\`]${proibido}['"\`]`, 'u'), `nenhum hardcode de sigla ("${proibido}") no filtro do switcher`);
  }
});

test('26. existeAlteracaoNaoSalvaNoContextoAtivo nunca referencia plantaoEditadoDesdeImportacao em lugar nenhum do arquivo como leitura de guard (proteção estrutural ampla)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const solicitarContexto = /function solicitarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  const solicitarCompetencia = /function solicitarTrocaCompetencia\(novaCompetencia: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(solicitarContexto && solicitarCompetencia);
  assert.doesNotMatch(solicitarContexto[1], /plantaoEditadoDesdeImportacao/u);
  assert.doesNotMatch(solicitarCompetencia[1], /plantaoEditadoDesdeImportacao/u);
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
