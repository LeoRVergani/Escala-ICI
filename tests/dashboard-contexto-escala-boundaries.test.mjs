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

test('4. ContextoEscalaAtivo usa tipo+alvoId como identidade e mantém label somente para apresentação', async () => {
  const fonte = semComentarios(await ler('lib/contextoEscala.ts'));
  const tipo = /export type ContextoEscalaAtivo =([\s\S]*?);\n\n/u.exec(fonte);
  assert.ok(tipo, 'o tipo ContextoEscalaAtivo precisa existir');
  for (const proibido of ['nome', 'sigla', 'uid', 'cargo', 'equipeId', 'grupoId']) {
    assert.doesNotMatch(tipo[1].toLowerCase(), new RegExp(`\\b${proibido}\\b`, 'u'), `ContextoEscalaAtivo não pode ter um campo "${proibido}"`);
  }
  assert.match(tipo[1], /alvoId: string/u);
  assert.match(tipo[1], /label: string/u);
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
  assert.equal(ocorrenciasTrue.length, 4, 'quatro pontos marcam a Jornada como não salva: criação vazia, editarCelula, aplicarConciliacao e cadastrarFaltantes');
  const editarCelula = /function editarCelula\(codigo: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(editarCelula, 'editarCelula precisa existir');
  assert.match(editarCelula[1], /setJornadaPossuiAlteracoesNaoSalvas\(true\)/u, 'a mutação local de célula precisa marcar dirty=true');
  const aplicarConciliacao = /function aplicarConciliacao\(buffer: ArrayBuffer, linhas: LinhaConciliacao\[\](?:, opcoes: OpcoesInicioImportacao = \{\})?\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
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
  const interpretarPlantao = /function interpretarPlantao\(([\s\S]*?)\n {2}\}\n\n {2}function confirmarVinculoPlantaoAcao/u.exec(dashboard);
  assert.ok(interpretarPlantao, 'interpretarPlantao precisa existir');
  assert.match(interpretarPlantao[1], /setPlantaoEditadoDesdeImportacao\(false\)/u);
  assert.match(interpretarPlantao[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u, 'importar uma planilha de Plantão precisa marcar alteração não salva mesmo sem nenhuma edição de célula');

  const criarVazia = /async function criarPlantaoEmBrancoAcao\([^)]*\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(criarVazia, 'criarPlantaoEmBrancoAcao precisa existir');
  assert.match(criarVazia[1], /setPlantaoPossuiAlteracoesNaoSalvas\(true\)/u);

  const usarAnterior = /async function usarPeriodoAnteriorAcao\([^)]*\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
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

test('25. opcoesContextoPlantao vem do resolver operacional — grupos só-consultados não aparecem como contexto editável', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const trecho = /const opcoesContextoPlantao: OpcaoContextoEscala\[\] = ([\s\S]*?);\n {2}const rotuloContextoAtivo/u.exec(dashboard);
  assert.ok(trecho, 'opcoesContextoPlantao precisa existir');
  assert.match(trecho[1], /escoposOperacionais\.plantoesAdministraveis/u, 'a lista de opções editáveis precisa vir do resolver operacional');
  assert.match(trecho[1], /escoposOperacionais\.plantoesMonitorados/u, 'plantões monitorados precisam ficar em lista separada');
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

test('27. Administração → Equipes ignora GrupoPlantao inativo ao calcular destino operacional', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const expressoes = [...dashboard.matchAll(/gruposPlantaoAdmin\.find\(\(grupo\) => ([^)]*equipeResponsavelId === item\.id[^)]*)\)/gu)]
    .map((match) => match[1]);
  assert.ok(expressoes.length >= 2, 'tabela e detalhe de Equipes precisam calcular vínculo operacional');
  assert.ok(expressoes.every((expressao) => expressao.includes('grupo.ativo')), 'nenhum destino operacional pode usar grupo inativo como vínculo da equipe');
});

test('28. Adicionar colaborador à grade usa elegibilidade da equipe da escala, com diagnóstico quando não há usuário ativo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const adicionarMembro = /async function confirmarAdicionarMembroGrade\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(adicionarMembro, 'confirmarAdicionarMembroGrade precisa existir');
  assert.match(dashboard, /usuariosElegiveisParaAdicionarNaGrade\(usuarios, documentos, equipeIdDaGradeAtiva\)/u);
  assert.match(dashboard, /Nenhum colaborador ativo encontrado para esta equipe\. Cadastre ou importe usuários antes de montar a escala\./u);
  assert.doesNotMatch(adicionarMembro[1], /usuarioEfetivo\.equipeId/u, 'colaborador da grade pertence à equipe da escala, não ao coordenador');
  assert.match(adicionarMembro[1], /equipeId:\s*equipeIdDaGradeAtiva/u);
});

test('29. Visão geral carrega Jornada pelo alvo da matriz operacional, não pela equipe do usuário logado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /escoposOperacionais\.jornadasAdministraveis/u, 'a Visão geral precisa partir das Jornadas administráveis da matriz');
  assert.match(dashboard, /carregarRascunhosEquipe\(equipeId, competenciaDashboard\)/u, 'rascunho de Jornada precisa ser buscado por equipeId do alvo');
  assert.match(dashboard, /carregarEscalasEquipe\(equipeId, competenciaDashboard, true\)/u, 'publicação de Jornada precisa ser buscada por equipeId do alvo');
  assert.match(dashboard, /listarUsuarios\(equipeId\)/u, 'colaboradores da Jornada precisam vir da equipe alvo');
  const trechoResumo = /Promise\.all\(jornadaIds\.map\(async \(equipeId\)([\s\S]*?)\}\)\)/u.exec(dashboard);
  assert.ok(trechoResumo, 'o efeito de resumo de Jornada precisa existir');
  assert.doesNotMatch(trechoResumo[1], /usuario(?:Real|Efetivo)\.equipeId/u, 'resumo do card nunca pode cair para a equipe do usuário logado');
});

test('30. Visão geral distingue Jornada sem escala, rascunho e publicada sem mascarar rascunho como publicação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const estado = /function estadoJornadaDashboard\(resumo: ResumoJornadaDashboard \| null\): EstadoEscalaOperacionalDashboard \{([\s\S]*?)\n\}/u.exec(dashboard);
  assert.ok(estado, 'estadoJornadaDashboard precisa existir');
  assert.match(estado[1], /resumo\.documentos\.length === 0/u, 'sem escala só quando não há rascunho nem publicação carregada');
  assert.match(estado[1], /resumo\.publicadas\.length > 0 && resumo\.rascunhos\.length === 0 \? 'publicada' : 'rascunho'/u, 'rascunho tem precedência quando existe rascunho não publicado');
  assert.match(dashboard, /resumoPublicacaoJornada\(resumoJornadaDashboard\)/u, 'card de Publicação precisa usar o resumo separado por alvo');
  assert.match(dashboard, /Rascunho não publicado/u, 'ausência de publicação não pode ser exibida como ausência total quando há rascunho');
});

test('31. Visão geral carrega Plantão pelo grupoId do alvo operacional, sem misturar equipeResponsavelId', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /escoposOperacionais\.plantoesAdministraveis/u, 'Plantão do dashboard precisa vir dos grupos administráveis da matriz');
  assert.match(dashboard, /obterCompetenciaPlantaoRascunho\(grupoId, competenciaDashboard\)/u, 'rascunho de Plantão precisa ser buscado por grupoId');
  assert.match(dashboard, /listarParticipantesPlantao\(grupoId\)/u, 'participantes de Plantão precisam vir do grupoId');
  const trechoResumo = /Promise\.all\(grupoIds\.map\(async \(grupoId\)([\s\S]*?)\}\)\)/u.exec(dashboard);
  assert.ok(trechoResumo, 'o efeito de resumo de Plantão precisa existir');
  assert.doesNotMatch(trechoResumo[1], /equipeResponsavelId/u, 'resumo mensal de Plantão não pode usar equipeResponsavelId como chave');
});

test('32. Saúde da Visão geral não usa percentual arbitrário quando não há escala', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /estadoJornadaOperacionalDashboard === 'sem-escala'\s*\?\s*0/u);
  assert.match(dashboard, /plantaoStatusDashboard === 'empty'\s*\?\s*0/u);
  assert.doesNotMatch(dashboard, /\?\s*12\s*:/u, 'estado sem escala não pode exibir 12% arbitrário');
});

test('33. Abrir operação na Visão geral seleciona o contexto superior pelo ID real do alvo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const abrir = /function abrirOperacaoDoDashboard\(tipo: 'JORNADA' \| 'PLANTAO'\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(abrir, 'abrirOperacaoDoDashboard precisa existir');
  assert.match(abrir[1], /criarContextoEscala\([\s\S]*?equipeJornadaDashboard\.id/u, 'Jornada deve selecionar o equipeId real como alvo no switcher');
  assert.match(abrir[1], /criarContextoEscala\([\s\S]*?grupoPlantaoDashboard\.grupoId/u, 'Plantão deve selecionar o grupoId real como alvo no switcher');
  assert.match(abrir[1], /solicitarTrocaContexto\(alvo\)/u, 'abertura deve passar pelo guard de alterações não salvas');
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

test('12. aplicarTrocaContexto (Jornada) carrega rascunho/publicada por equipeId + periodoDaCompetencia — nunca duplica o cálculo 26→25', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /carregarRascunhosEquipe\(alvo\.alvoId, alvo\.competencia\)/u);
  assert.match(corpo[1], /carregarEscalasEquipe\(alvo\.alvoId, alvo\.competencia, true\)/u);
  assert.match(corpo[1], /periodoDaCompetencia\(alvo\.competencia\)/u);
});

// --- § 50: competência ausente nunca cria automaticamente ---

test('13. quando não existe rascunho de Plantão, aplicarTrocaContexto só marca vazio se também não houver publicação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  const blocoSemRascunho = /if \(competenciaExistente === null\) \{([\s\S]*?)\}/u.exec(corpo[1]);
  assert.ok(blocoSemRascunho, 'o branch de "competência sem rascunho" precisa existir');
  assert.match(corpo[1], /obterCompetenciaPlantaoPublicada\(grupo\.grupoId, alvo\.competencia\)/u);
  assert.match(blocoSemRascunho[1], /setContextoSemEscala\(competenciaPublicada === null\)/u);
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
  assert.match(dashboard, /\{contextoEscalaAtivo !== null && !contextoSemEscala && \(/u, 'o card de escala existente precisa ficar mutuamente exclusivo com o estado vazio');
});

// --- § 51: status ---

test('16. status publicado reflete o estado persistido de Jornada ou Plantão', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const statusVar = /const statusContextoAtivo: StatusContextoEscala \| null = ([\s\S]*?);\n {2}const rotuloEscalaAtiva/u.exec(dashboard);
  assert.ok(statusVar, 'statusContextoAtivo precisa existir');
  assert.match(statusVar[1], /publicados\.length === documentos\.length/u, 'Jornada precisa reaproveitar o cálculo já existente de "publicados"');
  assert.match(statusVar[1], /estadoPlantaoOperacionalDashboard/u);
  const badge = semComentarios(await ler('components/escalas/ScheduleStatusBadge.tsx'));
  assert.match(badge, /publicada: 'Publicada'/u);
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
  // Nenhum dos arquivos NOVOS desta fase pode ter drag-and-drop/roster — o
  // `onDragOver` pré-existente do dropzone de upload de planilha em
  // DashboardApp.tsx (recurso anterior, não relacionado) fica de fora deste
  // escopo de checagem. `padraoHorario`/`PadraoHorarioSemanal` deixaram de
  // ser proibidos na Fase PLANTAO-PADRAO-1 (autorizada explicitamente a
  // adicionar o campo em `GrupoPlantao` + Administração do Dashboard — ver
  // `tests/plantao-padrao-horario-boundaries.test.mjs` para a cobertura
  // dedicada); continuam proibidos SÓ nos componentes de contexto ativo
  // desta fase (nunca devem conhecer Plantão além do que já conheciam).
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    for (const proibido of ['ScheduleRoster', 'onDragStart', 'onDragOver', 'draggable', 'padraoHorario', 'PadraoHorarioSemanal']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), `${proibido} pertence a uma fase futura ou fora do escopo de ContextoEscalaAtivo`);
    }
  }
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /ScheduleRoster/u, 'ScheduleRoster pertence a ESCALAS-UX-2B');
});

test('34. matriz tem uma única carga central com estados terminais e tentativa manual', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.equal(
    (dashboard.match(/listarEscoposOperacionais\(\)/gu) ?? []).length,
    1,
    'o Dashboard não pode manter leituras concorrentes da matriz',
  );
  assert.match(dashboard, /useState<EstadoCarregamentoOperacoes>\(\{ fase: 'carregando' \}\)/u);
  assert.match(dashboard, /carregarOperacoesComEstado\(/u);
  assert.match(dashboard, /estaVazio:/u);
  assert.match(dashboard, /function recarregarOperacoes\(\)/u);
  assert.match(dashboard, /> Recarregar operações/u);
});

test('35. seletor superior combina a carga da matriz e do contexto, mas volta a ficar utilizável após erro', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /carregando=\{carregandoContexto \|\| estadoCarregamentoOperacoes\.fase === 'carregando'\}/u,
  );
  assert.match(dashboard, /'Operações indisponíveis'/u);
  assert.match(dashboard, /'Nenhuma operação configurada'/u);
  const switcher = await ler('components/escalas/ScheduleContextSwitcher.tsx');
  assert.match(switcher, /disabled=\{carregando\}/u);
  assert.match(switcher, /Nenhuma operação de escala configurada para este usuário\./u);
});

test('36. UI diferencia vazio, Rules, rede e não renderiza card de escala sem alvo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const carga = await ler('lib/carregamentoOperacoes.ts');
  assert.match(dashboard, /Nenhuma operação de escala configurada para este usuário\./u);
  assert.match(dashboard, /Peça para um ADMIN_SISTEMA criar um vínculo em Administração → Responsáveis por escala\./u);
  assert.match(carga, /Não foi possível carregar a Matriz de Responsáveis\. Verifique se as Firestore Rules de staging foram publicadas\./u);
  assert.match(carga, /Verifique sua conexão e tente novamente\./u);
  assert.match(dashboard, /\{contextoEscalaAtivo !== null && !contextoSemEscala && \(/u);
});

test('37. contexto do localStorage é revalidado e removido quando o alvo some ou é inativado', async () => {
  const contexto = semComentarios(await ler('lib/contextoEscala.ts'));
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(contexto, /restaurarContextoEscalaPersistido/u);
  assert.match(contexto, /armazenamento\.removeItem\(chave\)/u);
  assert.match(dashboard, /limparContextoEscalaPersistido/u);
  assert.match(dashboard, /A operação selecionada foi desativada ou removida/u);
});

test('38. leituras parciais preservam dados válidos e diagnosticam Rules sem voltar ao erro genérico antigo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /Promise\.allSettled\(\[\s*carregarRascunhosEquipe/u);
  assert.match(dashboard, /Promise\.allSettled\(\[\s*obterCompetenciaPlantaoRascunho/u);
  assert.match(dashboard, /Os dados disponíveis foram preservados\./u);
  assert.match(dashboard, /As Firestore Rules de staging ainda não reconhecem a Matriz de Responsáveis\./u);
  assert.match(dashboard, /mensagemFalhaLeituraParcial/u);
  assert.match(dashboard, /erroContextoEscala[\s\S]*?> Recarregar operações/u);
});

test('39. staging habilita a compatibilidade legada de forma explícita; o padrão geral continua fechado', async () => {
  const [staging, geral, dashboard] = await Promise.all([
    ler('.env.staging.dashboard.example'),
    ler('.env.example'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
  ]);
  assert.match(staging, /^VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO=true$/mu);
  assert.match(geral, /^VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO=false$/mu);
  assert.match(dashboard, /import\.meta\.env\.VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO === 'true'/u);
});

test('40. importação mostra a falha dentro do wizard e sempre encerra o processamento', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const selecionar = /async function selecionarArquivoWizard\(file: File\) \{([\s\S]*?)\n {2}\}\n {2}async function continuarWizard/u.exec(dashboard);
  assert.ok(selecionar, 'selecionarArquivoWizard precisa existir');
  assert.match(selecionar[1], /aoFalhar: setWizardErro/u, 'a falha precisa aparecer no modal, não somente atrás dele');
  assert.match(selecionar[1], /finally \{\s*setWizardProcessando\(false\)/u, 'qualquer resultado precisa finalizar o spinner do wizard');

  const receber = /async function receberArquivo\(file: File \| undefined, opcoes: OpcoesInicioImportacao = \{\}\): Promise<boolean> \{([\s\S]*?)\n {2}\}\n\n {2}function soltar/u.exec(dashboard);
  assert.ok(receber, 'receberArquivo precisa existir');
  assert.match(receber[1], /opcoes\.aoFalhar\?\.\(texto\)/u);
  assert.match(receber[1], /try \{[\s\S]*?await file\.arrayBuffer\(\)[\s\S]*?processarArquivoImportado/u);
  assert.match(receber[1], /catch \(falha\) \{\s*return falhar/u, 'falha de leitura/parser precisa ser recuperável');
});

test('41. Rules atrasadas não bloqueiam a working copy local do Plantão nem liberam sua gravação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const criar = /async function criarPlantaoEmBrancoAcao\(grupoIdArg = '', competenciaArg = ''\) \{([\s\S]*?)async function usarPeriodoAnteriorAcao/u.exec(dashboard);
  assert.ok(criar, 'criarPlantaoEmBrancoAcao precisa existir');
  assert.match(criar[1], /if \(!falhaEhPermissionDenied\(falha\)\) throw falha/u, 'somente permission-denied pode limitar a checagem local');
  assert.match(criar[1], /As Firestore Rules de staging precisam ser publicadas antes de salvar ou publicar/u);
  assert.match(criar[1], /Já existe um rascunho para este Plantão e competência/u, 'um rascunho confirmado nunca pode ser sobrescrito');
  assert.match(criar[1], /let participantesAtivos: ParticipantePlantao\[\] = \[\]/u, 'a lista recusada não pode inventar participantes');
  assert.doesNotMatch(criar[1], /salvarCompetenciaPlantaoRascunho|publicarCompetenciaPlantao/u, 'abrir o editor continua sem gravar nem publicar');
});

test('42. nova Jornada usa o período do cadastro e o cadastro vindo da planilha preserva o turno importado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const gradeInicial = criarGradeInicialEquipe\(/u);
  assert.match(dashboard, /const turnoPorLogin = new Map\(\(resultado\?\.documentos \?\? \[\]\)\.map/u);
  assert.match(dashboard, /turnoPorLogin\.get\(login\) \?\? ''/u, 'login importado sem turno não pode virar Manhã silenciosamente');

  const grade = semComentarios(await ler('lib/gradeMembros.ts'));
  assert.match(grade, /resolverTurnoPadraoCadastrado/u);
  assert.match(grade, /turnoPadrao \?\? ''/u);
  assert.doesNotMatch(grade, /turnoPadrao \?\? 'M'/u);
});
