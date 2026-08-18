import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/gu, '');

// Fase ESCALAS-UX-2B.2: correções de homologação real — quick-add sem
// padrão, cadastro inline a partir de Vínculos, equipe nunca inferida por
// Plantão, remoção do Resumo, respiro do header. Ver
// docs/spec/REDESIGN_WORKSPACE_ESCALAS.md, CHECKPOINT-FASE-ESCALAS-UX-2B2-HOMOLOGACAO.md.

// --- § 48: equipe no cadastro (10 obrigatórios) ---

test('1. cadastro iniciado por Vínculos não recebe EQ_SOC (ou qualquer sigla) automaticamente — equipeId nasce vazio', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirCadastroDeVinculoPlantao\(participanteNomeOriginal: string, loginSugerido: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirCadastroDeVinculoPlantao precisa existir');
  assert.match(corpo[1], /equipeId:\s*''/u, 'equipeId precisa nascer vazio, forçando seleção explícita');
  assert.doesNotMatch(corpo[1], /EQ_SOC/u);
});

test('2. cadastro iniciado por Plantão COSI (ou qualquer Grupo) não força equipe SOC — abrirNovoUsuario/abrirCadastroDeVinculoPlantao nunca leem grupoRascunhoEscolhido/gruposPlantaoAdmin para equipeId', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['abrirNovoUsuario', 'abrirCadastroDeVinculoPlantao']) {
    const corpo = new RegExp(`function ${nomeFuncao}\\([^)]*\\) \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    assert.doesNotMatch(corpo[1], /grupoRascunhoEscolhido|gruposPlantaoAdmin|equipeResponsavelId/u, `${nomeFuncao} não pode derivar equipeId de nenhum conceito de Plantão`);
  }
});

test('3. grupo.equipeResponsavelId nunca vira Usuario.equipeId automaticamente em nenhum ponto do arquivo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /equipeId:\s*grupo\.equipeResponsavelId/u);
  assert.doesNotMatch(dashboard, /equipeId:\s*\w*[Gg]rupo\w*\.equipeResponsavelId/u);
});

test('4. equipe começa vazia/seleção explícita quando não há fonte segura (FormularioUsuario.equipeId novo = "")', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpoNovo = /function abrirNovoUsuario\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpoNovo);
  assert.match(corpoNovo[1], /equipeId:\s*''/u);
});

test('5. usuário pode selecionar uma equipe real via OrganizationTeamPicker (reaproveitado, nunca um input livre)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /pickerEquipeUsuarioAberto/u);
  assert.match(dashboard, /<OrganizationTeamPicker[\s\S]*?modo="single"[\s\S]*?onConfirmar=\{\(equipeId\) => \{[\s\S]*?setFormularioUsuario/u);
  assert.doesNotMatch(dashboard, /Equipe\s*\n\s*<input value=\{usuarioEfetivo\?\.equipeId/u, 'o antigo input desabilitado com o equipeId do operador não pode mais existir');
});

test('6. a seleção de equipe usa o ID real (equipeId), nunca o nome como identidade', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /onConfirmar=\{\(equipeId\) => \{\s*setFormularioUsuario\(\(atual\) => \(atual === null \? atual : \{ \.\.\.atual, equipeId \}\)\);/u);
});

test('7. nenhuma sigla hardcoded (SOC/NOC/COSI/CODB) no fluxo de cadastro/vínculo desta fase', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['abrirNovoUsuario', 'abrirEdicaoUsuario', 'abrirCadastroDeVinculoPlantao', 'salvarFormularioUsuario']) {
    const corpo = new RegExp(`(?:async )?function ${nomeFuncao}\\([^)]*\\)(?::\\s*Promise<void>)? \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    for (const sigla of ['COSI', 'SOC', 'NOC', 'CODB']) {
      assert.doesNotMatch(corpo[1], new RegExp(`['"\`]${sigla}`, 'u'), `${nomeFuncao} não pode referenciar "${sigla}"`);
    }
  }
});

test('8. usuário existente mantém a equipe original ao vincular a um Plantão — confirmarVinculoPlantaoAcao/desfazerVinculoPlantaoAcao nunca tocam equipeId', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['confirmarVinculoPlantaoAcao', 'desfazerVinculoPlantaoAcao']) {
    const corpo = new RegExp(`function ${nomeFuncao}\\([^)]*\\) \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    assert.doesNotMatch(corpo[1], /equipeId/u, `${nomeFuncao} nunca pode ler/gravar equipeId — vínculo não é pertencimento organizacional`);
  }
});

test('9. vínculo nunca altera equipe — confirmarVinculoPlantao (lib/conciliacaoPlantoes.ts) nunca referencia equipeId/Usuario.equipeId', async () => {
  const conciliacao = semComentarios(await ler('lib/conciliacaoPlantoes.ts'));
  assert.doesNotMatch(conciliacao, /\.equipeId\s*=/u, 'nenhuma atribuição a .equipeId dentro da lógica de conciliação/vínculo de Plantão');
});

test('10. cancelamento do formulário de usuário não cria usuário — fecharFormularioUsuario só limpa estado local, nunca chama salvarUsuario', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function fecharFormularioUsuario\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'fecharFormularioUsuario precisa existir');
  assert.doesNotMatch(corpo[1], /salvarUsuario|await /u, 'fechar/cancelar nunca pode persistir nada');
  assert.match(corpo[1], /setFormularioUsuario\(null\)/u);
});

test('validarEdicaoUsuario (lib/importUsers.ts) exige equipeId não vazio — o mesmo ponto único de validação de todos os cadastros', async () => {
  const importUsers = semComentarios(await ler('lib/importUsers.ts'));
  assert.match(importUsers, /if \(editado\.equipeId\.trim\(\) === ''\) \{/u);
});

// --- § 49: usuário novo — cadastro inline a partir de Vínculos ---

test('11. abrirCadastroDeVinculoPlantao prefila nome (do participante) e login (do termo buscado) — nunca inventa e-mail/domínio', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirCadastroDeVinculoPlantao\(participanteNomeOriginal: string, loginSugerido: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /nome:\s*participanteNomeOriginal/u);
  assert.match(corpo[1], /login:\s*loginSugerido/u);
  assert.match(corpo[1], /email:\s*''/u, 'e-mail nunca pode ser inventado sem regra confiável de derivação');
});

test('12. o cadastro a partir de Vínculos abre o MESMO modal, sem navegar para a tela Usuários — nenhum setTela dentro de abrirCadastroDeVinculoPlantao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirCadastroDeVinculoPlantao\(participanteNomeOriginal: string, loginSugerido: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.doesNotMatch(corpo[1], /setTela\(/u);
});

test('13. "Ir para Usuários" como ação principal de Vínculos foi substituída por "Cadastrar e vincular" — onIrParaUsuarios não existe mais', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /onIrParaUsuarios/u);
  assert.match(dashboard, /Cadastrar e vincular/u);
  assert.match(dashboard, /onCadastrarEVincular/u);
});

test('14. depois de salvar um cadastro iniciado por Vínculos, o vínculo é aplicado automaticamente ao participante que originou o cadastro', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function salvarFormularioUsuario\(\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo, 'salvarFormularioUsuario precisa existir');
  assert.match(corpo[1], /origemCadastroVinculoPlantao !== null/u);
  assert.match(corpo[1], /confirmarVinculoPlantaoAcao\(origemCadastroVinculoPlantao, candidato\)/u);
});

test('15. fecharFormularioUsuario/abrirNovoUsuario/abrirEdicaoUsuario sempre zeram origemCadastroVinculoPlantao — nunca vaza para o próximo cadastro', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['fecharFormularioUsuario', 'abrirNovoUsuario', 'abrirEdicaoUsuario']) {
    const corpo = new RegExp(`function ${nomeFuncao}\\([^)]*\\) \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    assert.match(corpo[1], /setOrigemCadastroVinculoPlantao\(null\)/u, `${nomeFuncao} precisa limpar origemCadastroVinculoPlantao`);
  }
});

// --- § 23-28/§ 50: quick-add sem padrão ---

// Fase ESCALAS-SIMPLES-1 (§36-41 do pedido) — os testes 16-19 desta fase
// (ESCALAS-UX-2B.2) verificavam o bloqueio "Nenhum padrão configurado" +
// "Configurar padrão"/"Informar horário manualmente", explicitamente
// substituído pelos três presets fixos (sempre disponíveis, com ou sem
// padrão) + "Outro horário" como única exceção. Ver
// lib/editorPlantao.test.ts (PRESETS_HORARIO_QUICK_ADD_PLANTAO/
// padraoDivergeDosPresetsQuickAdd) para a cobertura da nova lógica pura.

test('16. QuickAddPlantaoPopover sempre oferece os três presets fixos (12h/24h/5h), com ou sem padrão do Grupo — nunca mais bloqueia com "Nenhum padrão configurado"', async () => {
  const popover = semComentarios(await ler('components/plantao/QuickAddPlantaoPopover.tsx'));
  assert.match(popover, /padrao:\s*PadraoHorarioPlantaoDia \| null/u);
  assert.match(popover, /PRESETS_HORARIO_QUICK_ADD_PLANTAO/u);
  assert.doesNotMatch(popover, /Nenhum padrão configurado/u, 'o bloqueio antigo não pode mais existir');
  assert.doesNotMatch(popover, /onConfigurarPadrao|onInformarManualmente/u, 'as ações do bloqueio antigo foram substituídas pelos presets');
});

test('17. o padrão do Grupo só aparece como opção EXTRA quando diverge dos três presets fixos — nunca duplicado', async () => {
  const popover = semComentarios(await ler('components/plantao/QuickAddPlantaoPopover.tsx'));
  assert.match(popover, /padraoDivergeDosPresetsQuickAdd/u, 'precisa reaproveitar a mesma função pura de comparação');
});

test('18. "Outro horário" continua a única exceção que abre o editor completo — nunca inventa horário (início/fim vazios)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirOutroHorarioQuickAddPlantao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirOutroHorarioQuickAddPlantao precisa existir');
  assert.match(corpo[1], /abrirCriacaoAtribuicaoPlantao\(estado\.dataIso, estado\.plantonistaNomeOriginal\)/u);
});

test('19. quick-add nunca grava no Firestore diretamente — confirmado para "Adicionar" (presets) e "Outro horário"', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['confirmarQuickAddPlantao', 'abrirOutroHorarioQuickAddPlantao']) {
    const corpo = new RegExp(`function ${nomeFuncao}\\([^)]*\\) \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    assert.doesNotMatch(corpo[1], /setDoc|updateDoc|salvarAtribuicoesPlantaoRascunho|salvarCompetenciaPlantaoRascunho|await /u);
  }
});

// --- § 31/§ 32/§ 52: Resumo removido ---

test('20. a aba "Resumo" foi removida do Editor de Plantão — AbaPreviaPlantao não contém mais "resumo"', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const tipo = /type AbaPreviaPlantao = ([^;]*);/u.exec(dashboard);
  assert.ok(tipo, 'AbaPreviaPlantao precisa existir');
  assert.doesNotMatch(tipo[1], /'resumo'/u);
  assert.doesNotMatch(dashboard, /aba === 'resumo'/u);
  assert.doesNotMatch(dashboard, />Resumo</u, 'o botão de aba "Resumo" não pode mais existir');
});

test('21. Calendário/Lista/Contabilidade/Vínculos continuam existindo — nenhuma outra aba foi removida por engano', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const aba of ['calendario', 'plantoes', 'contabilidade', 'vinculos']) {
    assert.match(dashboard, new RegExp(`aba === '${aba}'`, 'u'), `a aba "${aba}" precisa continuar existindo`);
  }
});

test('22. o conteúdo de erros/avisos estruturais da antiga aba Resumo foi realocado para Contabilidade — nenhuma informação operacional foi perdida', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /\{aba === 'contabilidade' && \(([\s\S]*?)\n {8}\)\}\n\n {8}\{aba === 'vinculos'/u.exec(dashboard);
  assert.ok(corpo, 'o bloco de Contabilidade precisa existir e preceder Vínculos');
  assert.match(corpo[1], /Conferência do arquivo importado/u);
  assert.match(corpo[1], /resultado\.erros\.map/u, 'a tabela de erros estruturais precisa ter sido realocada para cá');
  assert.match(corpo[1], /resultado\.avisos\.map/u, 'a lista de avisos estruturais precisa ter sido realocada para cá');
});

test('23. o roster lateral continua sendo o resumo primário por pessoa — nenhuma lista grande nova abaixo do calendário', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /<PlantaoRoster/u);
  assert.doesNotMatch(dashboard, /plantao-resumo-por-pessoa/u, 'a antiga lista grande não pode ter voltado');
});

// --- § 35-40/§ 53: header ---

test('24. o cluster de contexto do header tem padding-block próprio (nunca margem solta espalhada pelos filhos)', async () => {
  const css = semComentarios(await ler('app/globals.css'));
  const bloco = /\.schedule-context-cluster \{([\s\S]*?)\}/u.exec(css);
  assert.ok(bloco, '.schedule-context-cluster precisa existir');
  assert.match(bloco[1], /padding-block:\s*12px/u);
});

test('25. .topbar virou min-height (nunca height fixo) para caber o padding do cluster sem cortar conteúdo', async () => {
  const css = await ler('app/globals.css');
  assert.match(css, /\.topbar \{[\s\S]*?min-height:\s*76px;/u);
  assert.doesNotMatch(/\.topbar \{[\s\S]*?\}/u.exec(css)[0], /\n\s*height:\s*76px;/u);
});

test('26. mobile: o cluster quebra linha (flex-wrap) em vez de espremer os três controles — nunca overflow horizontal de página', async () => {
  const css = await ler('app/globals.css');
  const blocoMedia = /@media \(max-width: 780px\) \{([\s\S]*?)\n\}/u.exec(css);
  assert.ok(blocoMedia, 'o breakpoint mobile precisa existir');
  assert.match(blocoMedia[1], /\.schedule-context-cluster \{[^}]*flex-wrap:\s*wrap/u);
});

test('27. o cluster de contexto continua fora do user-menu — nunca movido para perto do avatar/sino', async () => {
  const appFrame = await ler('components/AppFrame.tsx');
  const indiceContexto = appFrame.indexOf('contextoEscala ?? (');
  const indiceAcoes = appFrame.indexOf('className="topbar-actions"');
  const indiceUserMenu = appFrame.indexOf('className="user-menu"');
  assert.ok(indiceContexto > 0 && indiceAcoes > indiceContexto && indiceUserMenu > indiceAcoes, 'a ordem estrutural precisa continuar: contexto -> ações globais -> menu da conta');
});

test('28. status/período/switcher continuam existindo estruturalmente no header', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /<ScheduleContextSwitcher/u);
  assert.match(dashboard, /<ScheduleCompetenceControl/u);
  assert.match(dashboard, /<ScheduleStatusBadge/u);
});

// --- § 41/§ 44/§ 45/§ 46/§ 47: não regredir o que já existia ---

test('29. ContextoEscalaAtivo/ScheduleContextSwitcher/ScheduleCompetenceControl/ScheduleStatusBadge não foram refatorados — só CSS/integração', async () => {
  const contexto = semComentarios(await ler('lib/contextoEscala.ts'));
  assert.match(contexto, /export type ContextoEscalaAtivo =/u);
  assert.doesNotMatch(contexto, /padraoHorarioSemanal|obterPadraoHorarioGrupoParaData/u, 'ContextoEscalaAtivo continua sem conhecer padrão de horário');
});

test('30. os dirty guards continuam plantaoPossuiAlteracoesNaoSalvas/jornadaPossuiAlteracoesNaoSalvas — nunca plantaoEditadoDesdeImportacao como guard', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function existeAlteracaoNaoSalvaNoContextoAtivo\(\): boolean \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'existeAlteracaoNaoSalvaNoContextoAtivo precisa existir');
  assert.doesNotMatch(corpo[1], /plantaoEditadoDesdeImportacao/u);
  assert.match(corpo[1], /plantaoPossuiAlteracoesNaoSalvas/u);
  assert.match(corpo[1], /jornadaPossuiAlteracoesNaoSalvas/u);
});

test('31. nenhum publicarPlantao foi introduzido — PLANTÃO-3C continua fora de escopo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /function publicarPlantao\b/u);
});

test('32. nenhuma mudança de schema Plantão — GrupoPlantao/CompetenciaPlantao/AtribuicaoPlantaoPersistida sem campo novo nesta fase', async () => {
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  assert.doesNotMatch(modelo, /equipeIdReal|origemVinculo/u, 'nenhum campo novo relacionado ao cadastro/vínculo foi adicionado ao schema persistente');
});

test('33. limites da competência (26/07..25/08) continuam preservados — dataPertenceCompetencia ainda é o primeiro passo de solicitarNovaAtribuicaoPlantao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function solicitarNovaAtribuicaoPlantao\(plantonistaNomeOriginal: string, dataIso: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1].trimStart(), /^if \(!dataPertenceCompetencia\(dataIso, competenciaRascunho\)\) \{\s*return;\s*\}/u, 'o gate de competência precisa continuar sendo o primeiro passo');
});
