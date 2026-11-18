import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('o app do colaborador não incorpora operações administrativas', async () => {
  const [app, login, packageJson] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/LoginPanel.tsx'),
    ler('apps/app/package.json'),
  ]);
  const fontePublica = `${app}\n${login}\n${packageJson}`;

  /**
   * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — o App passou a
   * importar `plantaoWriteRepository` (só `atualizarContatosPlantonista`,
   * ação pessoal do plantonista — ver `tests/plantao-model-boundaries.test.mjs`
   * teste 1). O `writeRepository` GENÉRICO (escrita administrativa de
   * Jornada 6x1) continua proibido — por isso o padrão abaixo casa o
   * CAMINHO de import exato, nunca a palavra solta (que também bateria,
   * por coincidência de sufixo, em `plantaoWriteRepository`).
   */
  assert.doesNotMatch(fontePublica, /from '@\/lib\/firebase\/writeRepository'/u, 'writeRepository administrativo (Jornada 6x1)');
  for (const proibido of [
    'salvarRascunho',
    'publicarEscalas',
    'salvarUsuario',
    'excluirRascunho',
    'atualizarNome',
    '"xlsx"',
  ]) {
    assert.doesNotMatch(fontePublica, new RegExp(proibido), proibido);
  }

  assert.match(app, /readRepository/);
  assert.match(login, /authRepository/);
});

test('a tela de Usuários do Dashboard não expõe UID técnico ao gestor', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');

  for (const proibido of [
    'Vincular ao UID',
    'UID do Authentication',
    'UID do Firebase Authentication',
    'Consolidar com UID real',
    'Unir cadastros duplicados',
    'vincularUsuarioAoUid',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(proibido), proibido);
  }
});

test('o Dashboard nunca importa leitura/escrita de lembretes pessoais (privacidade absoluta)', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  // Remove comentários de bloco antes de checar: o arquivo documenta de
  // propósito, em prosa, quais funções pessoais NUNCA são importadas — a
  // checagem real é sobre código, não sobre essa nota explicativa.
  const semComentarios = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const proibido of [
    'criarLembretePessoal',
    'criarSerieLembretesPessoais',
    'atualizarLembretePessoal',
    'excluirLembretePessoal',
    'listarLembretesPessoais',
    'observarLembretesPessoais',
  ]) {
    assert.doesNotMatch(semComentarios, new RegExp(proibido), proibido);
  }

  assert.match(semComentarios, /lembretesAtribuidos/);
});

test('o Dashboard consulta lembretes atribuídos pela API do gestor (com destinatarioEquipeId), nunca pela API do colaborador (Fase 5.1)', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const semComentarios = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');

  // A API "DoUsuario" serve só o colaborador consultando os próprios
  // atribuídos — a Firestore Rule exige `destinatarioEquipeId` na query do
  // gestor (ver lib/firebase/lembretesRepository.ts), então o Dashboard só
  // pode usar a variante "DoGestor".
  assert.doesNotMatch(semComentarios, /observarLembretesAtribuidosDoUsuario/);
  assert.doesNotMatch(semComentarios, /listarLembretesAtribuidosDoUsuario/);
  assert.match(semComentarios, /observarLembretesAtribuidosDoGestor/);
});

test('os dois produtos possuem entradas Vite independentes', async () => {
  const arquivos = await Promise.all([
    ler('apps/dashboard/index.html'),
    ler('apps/dashboard/src/main.tsx'),
    ler('apps/dashboard/vite.config.ts'),
    ler('apps/app/index.html'),
    ler('apps/app/src/main.tsx'),
    ler('apps/app/vite.config.ts'),
  ]);

  assert.equal(arquivos.every((conteudo) => conteudo.trim().length > 0), true);
  assert.match(arquivos[2], /dist\/apps\/dashboard/);
  assert.match(arquivos[5], /dist\/apps\/app/);
});

test('somente o repositório administrativo importa mutações do Firestore', async () => {
  const [leitura, escrita] = await Promise.all([
    ler('lib/firebase/readRepository.ts'),
    ler('lib/firebase/writeRepository.ts'),
  ]);

  for (const mutacao of ['writeBatch', 'setDoc', 'updateDoc', 'deleteDoc']) {
    assert.doesNotMatch(leitura, new RegExp(mutacao), mutacao);
    assert.match(escrita, new RegExp(mutacao), mutacao);
  }
});

test('o app possui experiência adaptativa sem misturar funções de gestão', async () => {
  const [app, frame, estilos] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/AppFrame.tsx'),
    ler('app/globals.css'),
  ]);

  assert.match(app, /ResumoSemana/);
  assert.match(app, /CalendarioEscala/);
  assert.match(app, /AgendaEscala/);
  assert.match(app, /Modo de visualização/);
  assert.match(frame, /bottom-nav/);
  assert.match(frame, /produto === 'app'/);
  assert.match(estilos, /product-app \.bottom-nav/);
  assert.match(estilos, /safe-area-inset-bottom/);
  assert.match(estilos, /@media \(max-width: 780px\)/);
  assert.doesNotMatch(app, /publicar|rascunho|editar escala/i);
});

test('a camada PWA é exclusiva da experiência de consulta do colaborador', async () => {
  const [appMain, appPage, dashboardMain, provider, manifesto, manifestoCompatibilidade] = await Promise.all([
    ler('apps/app/src/main.tsx'),
    ler('app/app/page.tsx'),
    ler('apps/dashboard/src/main.tsx'),
    ler('components/PwaProvider.tsx'),
    ler('public/manifest.webmanifest'),
    ler('public/manifest-app.webmanifest'),
  ]);

  assert.match(appMain, /PwaProvider/);
  assert.match(appPage, /PwaProvider/);
  assert.doesNotMatch(dashboardMain, /PwaProvider/);
  assert.match(provider, /serviceWorker\.register/);
  assert.match(provider, /beforeinstallprompt/);

  const dados = JSON.parse(manifesto);
  assert.equal(dados.start_url, '/');
  assert.equal(dados.scope, '/');
  assert.equal(dados.display, 'standalone');
  const compatibilidade = JSON.parse(manifestoCompatibilidade);
  assert.equal(compatibilidade.start_url, '/app');
  assert.equal(compatibilidade.scope, '/app');
});

test('o contrato visual responsivo preserva os mockups aprovados', async () => {
  const [app, frame, estilos] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/AppFrame.tsx'),
    ler('app/globals.css'),
  ]);

  assert.match(app, /Seu turno hoje/);
  assert.match(app, /Próximo turno/);
  assert.match(app, /rotulo: 'Perfil'/);
  assert.match(app, /profile-layout/);
  assert.match(frame, /mobile-app-brand/);
  assert.match(estilos, /Fase 3F — fidelidade visual/);
  assert.match(estilos, /linear-gradient\(180deg, #172554/);
  assert.match(estilos, /grid-template-columns: repeat\(4, 1fr\)/);
  assert.match(estilos, /calendar-view > \.calendar-grid \{ min-width: 0; \}/);
  assert.match(estilos, /bottom-nav button\.active::after/);
});

test('a fase 3H implementa a composição semana mais agenda em todas as larguras', async () => {
  const [app, estilos] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('app/globals.css'),
  ]);

  assert.match(app, /Minha agenda/);
  assert.match(app, /agenda-mobile-intro/);
  assert.match(app, /agenda-mobile-week/);
  assert.match(app, /selected-day-shift/);
  assert.match(app, /selected-day-facts/);
  assert.match(app, /agenda-shift-icon/);
  assert.match(app, /Esta visualização é somente leitura/);
  assert.match(estilos, /Fase 3H — convergência visual real/);
  assert.match(estilos, /employee-calendar-panel\[data-mode="agenda"\]/);
  assert.match(estilos, /grid-template-columns: minmax\(330px, 0\.82fr\) minmax\(420px, 1\.18fr\)/);
  assert.match(estilos, /today-dashboard-grid > \.today-hero \{ order: 1; \}/);
  assert.match(estilos, /today-dashboard-grid > \.week-strip \{ order: 2; \}/);
  assert.match(estilos, /today-dashboard-grid > \.next-shift-card \{ order: 3; \}/);
  assert.match(estilos, /overflow-x: clip/);
});

test('a fase 3H.1 mantém o calendário móvel legível nos dois temas', async () => {
  const estilos = await ler('app/globals.css');

  assert.match(estilos, /Fase 3H\.1 — correções de calendário móvel/);
  assert.match(estilos, /employee-calendar-panel\[data-mode="calendario"\] \.schedule-explorer[\s\S]*align-items: stretch/);
  assert.match(estilos, /employee-calendar-panel\[data-mode="calendario"\] \.schedule-view-panel[\s\S]*width: 100%/);
  assert.match(estilos, /employee-calendar-panel\[data-mode="calendario"\] \.selected-day-card[\s\S]*display: none/);
  assert.match(estilos, /agenda-mobile-week \.week-days > button \.shift-chip[\s\S]*min-width: 20px/);
  assert.match(estilos, /next-shift-icon\[data-code="MD"\] svg[\s\S]*transform: none/);
});

test('a fase 3J-A consolida a fidelidade visual do app em todas as larguras', async () => {
  const estilos = await ler('app/globals.css');

  assert.match(estilos, /Fase 3J-A — fidelidade visual final/);
  assert.match(estilos, /employee-today-screen > \.today-heading[\s\S]*display: none/);
  assert.match(estilos, /today-meta > span:not\(\.live-badge\)[\s\S]*display: none/);
  assert.match(estilos, /employee-calendar-panel\[data-mode="calendario"\] \.calendar-grid[\s\S]*width: 100%/);
  assert.match(estilos, /employee-calendar-panel\[data-mode="agenda"\] \.selected-day-card[\s\S]*display: block/);
  assert.doesNotMatch(estilos, /transform: rotate\(38deg\)/);
});

test('a fase 3K-D2A unifica as cores por período em um único token, sem produto duplicado', async () => {
  const [estilos, app] = await Promise.all([
    ler('app/globals.css'),
    ler('apps/app/src/EmployeeApp.tsx'),
  ]);

  // Tokens: fonte única, herdada por qualquer elemento com data-code.
  assert.match(estilos, /--periodo-md-text: #4338ca/);
  assert.match(estilos, /--periodo-m-text: #0891b2/);
  assert.match(estilos, /--periodo-t-text: #c2410c/);
  assert.match(estilos, /--periodo-n-text: #1d4ed8/);
  assert.match(estilos, /\.shift-chip\[data-code\] \{[\s\S]*var\(--periodo-text/);

  // O App não duplica mais uma paleta própria por código de turno.
  assert.doesNotMatch(estilos, /\.app-shell\.product-app \.shift-chip\[data-code="MD"\]\s*\{/);

  // Os cards de jornada herdam a cor do período via data-code.
  // HOTFIX-HE-TURNO-1 — a cor vem de `periodo` (turno real; numa HE é o
  // turno em que ela acontece), não mais de `codigo`.
  assert.match(app, /className="today-hero"[\s\S]*data-code=\{turnoDestaque\?\.periodo/);
  // FASE-APP-REDESIGN-HOJE-1 — `ProximoTurno` (card único) virou
  // `ProximosDias` (lista); cada item continua herdando a cor do período
  // pelo mesmo token via data-code, agora no ícone de cada linha.
  assert.match(app, /className="proximos-dias-icone" data-code=\{turno\.periodo\}/);
});

test('a fase 3J-B mantém rascunho, publicação e rollback fora do App', async () => {
  const [app, dashboard, leitura, escrita, estilos] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/firebase/readRepository.ts'),
    ler('lib/firebase/writeRepository.ts'),
    ler('app/globals.css'),
  ]);

  assert.doesNotMatch(app, /reverterPublicacao|historicoPublicacoes|rascunhosTurnosMes/);
  // DASHBOARD-LOTE3 — mesmo recurso, linguagem simples: "Versões publicadas" e "Voltar para esta versão".
  assert.match(dashboard, /Versões publicadas/);
  assert.match(dashboard, /Voltar para esta versão/);
  assert.match(leitura, /listarHistoricoPublicacoes/);
  assert.match(escrita, /rascunhosTurnosMes/);
  assert.match(escrita, /reverterPublicacao/);
  assert.match(estilos, /Fase 3J-B — histórico e rollback/);
});

test('o laboratório importa XLS na equipe autenticada e limita a leitura do App', async () => {
  const [dashboard, app, leitura, usuarios, escrita] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('lib/firebase/readRepository.ts'),
    ler('lib/importUsers.ts'),
    ler('lib/firebase/writeRepository.ts'),
  ]);

  assert.match(dashboard, /interpretar\(await resposta\.arrayBuffer\(\)/);
  assert.match(dashboard, /const responsavelDoAlvo = \{ \.\.\.usuarioEfetivo, equipeId: equipeAlvoId \}/);
  assert.match(dashboard, /novoUsuario\([\s\S]{0,220}?usuarios\.length \+ indice \+ 1,[\s\S]{0,220}?responsavelDoAlvo,[\s\S]{0,220}?login,[\s\S]{0,220}?true,[\s\S]{0,220}?turnoPorLogin\.get\(login\) \?\? ''/);
  assert.match(dashboard, /salvarUsuarios\(novos\)/);
  assert.match(dashboard, /resultadoTemErros/);
  assert.match(dashboard, /Justificativa para publicar com pendências/);
  assert.doesNotMatch(escrita, /temErroBloqueante\(resultado\.erros\)/, 'erro de fonte não impede salvar a Jornada');
  assert.match(escrita, /pendenciasImportacao/, 'a decisão de salvar/publicar com pendências permanece auditável');
  assert.match(app, /autenticado\.equipeId/);
  assert.match(leitura, /where\('equipeId', '==', equipeId\)/);
  assert.match(usuarios, /equipeId: gestor\.equipeId/);
  assert.match(escrita, /idDocumento\(documento\.equipeId, documento\.login/);
});

test('a fase 3J-C explica as revisões e atualiza o App sem F5', async () => {
  const [dashboard, app, frame, leitura, escrita, revisoes, regras, estilos] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/AppFrame.tsx'),
    ler('lib/firebase/readRepository.ts'),
    ler('lib/firebase/writeRepository.ts'),
    ler('lib/revisoes.ts'),
    ler('firestore.rules'),
    ler('app/globals.css'),
  ]);

  assert.match(dashboard, /Motivo da publicação/);
  assert.match(dashboard, /Ver alterações/);
  assert.match(dashboard, /codigoAnterior/);
  assert.match(app, /NotificationBell/);
  assert.match(app, /observarEscalasEquipe/);
  assert.match(app, /observarEventosEscala/);
  assert.match(app, /escala-ici-notificacoes-lidas/);
  assert.match(frame, /acoesTopo/);
  assert.match(leitura, /onSnapshot/);
  assert.match(escrita, /Nenhuma alteração foi encontrada/);
  assert.match(escrita, /eventosEscala/);
  assert.match(revisoes, /calcularAlteracoesEscala/);
  assert.match(regras, /match \/eventosEscala/);
  assert.match(estilos, /notification-popover/);
  assert.doesNotMatch(app, /\b(?:writeBatch|setDoc|updateDoc|deleteDoc)\s*\(/);
});

test('a fase 3J-C.1 corrige menu da conta, contraste escuro e ícone do próximo turno', async () => {
  const [frame, estilos] = await Promise.all([
    ler('components/AppFrame.tsx'),
    ler('app/globals.css'),
  ]);

  assert.match(frame, /aria-haspopup="menu"/);
  assert.match(frame, /className="account-popover"/);
  assert.match(frame, /className="account-logout"/);
  assert.match(frame, />Sair</);
  assert.doesNotMatch(frame, /onClick=\{onSair\} aria-label="Sair"/);
  assert.match(estilos, /--bg: #111824/);
  assert.match(estilos, /next-shift-title > div > span/);
  assert.doesNotMatch(estilos, /next-shift-title span\s*\{/);
});

test('a fase 3K-D1 estabiliza a sessão do App e a atualização interna', async () => {
  const [app, login, restauracao, sessao, estilos, html] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/LoginPanel.tsx'),
    ler('components/RestauracaoSessao.tsx'),
    ler('lib/sessao.ts'),
    ler('app/globals.css'),
    ler('apps/app/index.html'),
  ]);

  // O App decide a tela antes do login: nenhum flicker de tela inicial.
  assert.match(app, /TelaRestaurandoSessao/);
  assert.match(app, /deveExibirRestauracao\(sessao\.estado\)/);
  assert.match(app, /<LoginPanel tipo="app" sessaoDelegada/);
  assert.match(restauracao, /Restaurando sessão/);
  assert.match(html, /id="boot-splash"/);
  assert.match(html, /Restaurando sessão/);

  // Um único observador de sessão: o LoginPanel delega quando o App já observa.
  assert.match(login, /useRestauracaoSessao/);
  assert.match(login, /sessaoDelegada/);
  assert.doesNotMatch(login, /observarSessao/);
  assert.match(restauracao, /observarSessao/);

  // Listeners só depois da sessão e do usuário do Firestore carregados.
  assert.match(sessao, /podeIniciarListeners/);
  assert.match(app, /podeIniciarListeners\(\{/);
  assert.match(app, /dadosIniciaisCarregados: dadosCarregados/);
  // FASE-PWA-COMPETENCIAS-MULTIPERIODOS-1 — a assinatura em tempo real
  // passou a acompanhar uma janela de competências (`janelaCompetenciasApp`,
  // não só a `competenciaAtiva`), para o período anterior nunca desaparecer
  // quando a competência seguinte é publicada.
  assert.match(app, /\[competenciaAtiva, equipeUsuario, janelaCompetenciasApp, listenersLiberados, loginUsuario\]/);
  assert.match(app, /Revisão \$\{maisRecente\.revisao\}/);
  assert.match(app, /toast-action/);
  assert.match(estilos, /Fase 3K-D1 — restauração de sessão e atualização interna/);
});

test('a fase 3K-D1 mantém a troca de escala fora da escrita do App', async () => {
  const [troca, modelos, app, regras] = await Promise.all([
    ler('lib/trocaEscala.ts'),
    ler('lib/modelos.ts'),
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('firestore.rules'),
  ]);

  // Desenho preparado, escrita não implementada.
  assert.match(troca, /COLECAO_SOLICITACOES_TROCA = 'solicitacoesTroca'/);
  assert.match(troca, /transicaoPermitidaNoApp/);
  assert.match(modelos, /SolicitacaoTroca/);
  assert.doesNotMatch(troca, /firebase\/firestore/);
  for (const mutacao of ['writeBatch', 'setDoc', 'updateDoc', 'deleteDoc', 'addDoc']) {
    assert.doesNotMatch(troca, new RegExp(mutacao), mutacao);
  }

  // O App continua sem qualquer caminho de escrita, inclusive de troca.
  assert.doesNotMatch(app, /solicitacoesTroca/);
  assert.doesNotMatch(app, /writeRepository/);

  // Enquanto a escrita não existir, as regras não expõem a coleção.
  assert.doesNotMatch(regras, /solicitacoesTroca/);
});

test('a fase 3K-D2 mantém a gestão de usuários e a conciliação exclusivas do Dashboard', async () => {
  const [app, login, dashboard, conciliacao, nomes, importUsers, modelos, regras] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/LoginPanel.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/conciliacaoUsuarios.ts'),
    ler('lib/nomes.ts'),
    ler('lib/importUsers.ts'),
    ler('lib/modelos.ts'),
    ler('firestore.rules'),
  ]);
  const fontePublica = `${app}\n${login}`;

  // O App continua sem qualquer via de escrita administrativa de usuários.
  for (const proibido of ['salvarUsuario', 'conciliacaoUsuarios', 'validarEdicaoUsuario', 'excluirRascunho']) {
    assert.doesNotMatch(fontePublica, new RegExp(proibido), proibido);
  }
  assert.doesNotMatch(app, /solicitacoesTroca/);

  // Módulos puros: sem SDK do Firestore, herdam a mesma garantia de pureza da Fase 3K-D1.
  for (const mutacao of ['writeBatch', 'setDoc', 'updateDoc', 'deleteDoc', 'firebase/firestore']) {
    assert.doesNotMatch(conciliacao, new RegExp(mutacao), mutacao);
    assert.doesNotMatch(nomes, new RegExp(mutacao), mutacao);
    assert.doesNotMatch(importUsers, new RegExp(mutacao), mutacao);
  }

  // O Dashboard concentra a gestão de usuários, a conciliação e o descarte de rascunho.
  assert.match(dashboard, /conciliacaoUsuarios/);
  assert.match(dashboard, /validarEdicaoUsuario/);
  assert.match(dashboard, /normalizarAliasesPlanilha/);
  assert.match(dashboard, /excluirRascunho/);
  assert.match(dashboard, /abrirEdicaoUsuario/);
  assert.match(dashboard, /alternarAtivoUsuario/);
  assert.match(dashboard, /novoUsuario\([\s\S]{0,220}?usuarios\.length \+ indice \+ 1,[\s\S]{0,220}?responsavelDoAlvo,[\s\S]{0,220}?login,[\s\S]{0,220}?true,[\s\S]{0,220}?turnoPorLogin\.get\(login\) \?\? ''/);

  // Contrato de usuário estendido e regra de edição pelo gestor da própria equipe.
  assert.match(modelos, /aliasesPlanilha/);
  assert.match(modelos, /StatusConciliacao/);
  assert.match(regras, /souGestor\(\)[\s\S]*resource\.data\.equipeId == minhaEquipe\(\)[\s\S]*request\.resource\.data\.equipeId == resource\.data\.equipeId[\s\S]*request\.resource\.data\.login == resource\.data\.login/);
  assert.doesNotMatch(regras, /solicitacoesTroca/);
});

test('a fase 3K-D2 fortalece a base da troca de escala com elegibilidade dos participantes', async () => {
  const troca = await ler('lib/trocaEscala.ts');

  assert.match(troca, /validarElegibilidadeTroca/);
  assert.match(troca, /ContextoElegibilidadeTroca/);
  for (const mutacao of ['writeBatch', 'setDoc', 'updateDoc', 'deleteDoc', 'firebase/firestore']) {
    assert.doesNotMatch(troca, new RegExp(mutacao), mutacao);
  }
});

test('a fase 3K-D2A separa a presença na grade do cadastro do usuário e mantém tudo fora do App', async () => {
  const [app, gradeMembros, dashboard, scheduleGrid] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('lib/gradeMembros.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('components/ScheduleGrid.tsx'),
  ]);

  // Módulo puro: monta/reorganiza documentos, nunca decide sobre o cadastro do usuário.
  for (const mutacao of ['writeBatch', 'setDoc', 'updateDoc', 'deleteDoc', 'firebase/firestore']) {
    assert.doesNotMatch(gradeMembros, new RegExp(mutacao), mutacao);
  }
  assert.doesNotMatch(gradeMembros, /usuarios\//);

  // Remover da grade nunca é excluir o usuário do sistema.
  assert.match(gradeMembros, /removerMembroGrade/);
  assert.doesNotMatch(gradeMembros, /excluirUsuario|deletarUsuario/);

  // O Dashboard oferece o fluxo de adicionar/remover e agrupa por período.
  assert.match(dashboard, /adicionarMembroRascunho/);
  assert.match(dashboard, /criarMembroGrade/);
  assert.match(dashboard, /confirmarRemocaoMembroGrade/);
  assert.match(dashboard, /agruparPorPeriodo/);
  assert.match(scheduleGrid, /agruparGradePorPeriodo/);

  // O App continua sem qualquer caminho de escrita na grade.
  assert.doesNotMatch(app, /gradeMembros|adicionarMembroRascunho/);
});

test('a fase 3K-D2B mantém os alertas operacionais (6x1 e descanso mínimo) exclusivos do Dashboard', async () => {
  const [app, login, alertas, dashboard, scheduleGrid] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/LoginPanel.tsx'),
    ler('lib/alertasEscala.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('components/ScheduleGrid.tsx'),
  ]);
  const fontePublica = `${app}\n${login}`;

  // Módulo puro: só matemática de datas/horas, sem SDK do Firestore.
  for (const mutacao of ['writeBatch', 'setDoc', 'updateDoc', 'deleteDoc', 'firebase/firestore']) {
    assert.doesNotMatch(alertas, new RegExp(mutacao), mutacao);
  }
  assert.match(alertas, /isDiaDeTrabalho/);
  assert.match(alertas, /calcularIntervaloDescansoHoras/);
  assert.match(alertas, /temDescansoInsuficiente/);
  assert.match(alertas, /detectarSequencias6x1/);
  assert.match(alertas, /detectarDescansoInsuficiente/);
  assert.match(alertas, /LIMITE_DIAS_CONSECUTIVOS_TRABALHO = 6/);
  assert.match(alertas, /MINIMO_DESCANSO_HORAS = 11/);

  // Esta fase só alerta — o gancho de bloqueio existe, mas retorna sempre falso.
  assert.match(alertas, /export function bloqueiaPublicacaoPorAlerta[\s\S]*return false/);

  // Dashboard mostra os alertas na grade e no sininho; o App não importa nada disso.
  // REGRAS-ESCALA-4 — o Dashboard calcula os alertas pelo motor de regras (legais + salvas); o módulo
  // antigo segue puro e serve de referência da equivalência (lib/regrasEscala.test.ts) e das trocas de folga.
  assert.match(dashboard, /avaliarRegras\(documentos, catalogo, regrasEmVigor/);
  assert.doesNotMatch(dashboard, /gerarAlertasEscala/);
  assert.match(dashboard, /construirIndiceAlertasGrade/);
  assert.match(dashboard, /AlertasOperacionaisBell/);
  assert.match(scheduleGrid, /grade-alert-sequencia/);
  assert.match(scheduleGrid, /grade-alert-descanso/);
  assert.doesNotMatch(fontePublica, /alertasEscala|gerarAlertasEscala|AlertasOperacionaisBell/);
});

test('o login corporativo é a chave funcional — nenhum fluxo depende de UID do Firebase', async () => {
  const [app, login, authRepo, writeRepo, dashboard, modelos] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/LoginPanel.tsx'),
    ler('lib/firebase/authRepository.ts'),
    ler('lib/firebase/writeRepository.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/modelos.ts'),
  ]);
  const fontePublica = `${app}\n${login}`;

  // O App não importa a escrita administrativa.
  assert.doesNotMatch(fontePublica, /writeRepository/);

  // authRepository deriva o login do e-mail autenticado e diferencia
  // sem-perfil de inativo — nada depende de usuarios/{auth.uid}.
  assert.match(authRepo, /loginDoEmail/);
  assert.match(authRepo, /MENSAGEM_SEM_PERFIL_FIRESTORE/);
  assert.match(authRepo, /MENSAGEM_PERFIL_INATIVO/);
  assert.match(authRepo, /resolverUsuarioAutenticado/);
  assert.doesNotMatch(authRepo, /request\.auth\.uid|credencial\.user\.uid/);

  // O mecanismo de "vincular ao UID" foi removido — o login já é a chave
  // permanente do documento desde a criação, então não existe mais o
  // cenário de dois cadastros para a mesma pessoa.
  assert.doesNotMatch(writeRepo, /vincularUsuarioAoUid/);
  assert.doesNotMatch(modelos, /pendenteVinculo|substituidoPorUid/);
  assert.doesNotMatch(dashboard, /abrirVincularUid|confirmarVincularUid/);
});

test('ajustes rápidos: grade sem contagem no título do grupo, células vazias editáveis e input do login sem sobreposição', async () => {
  const [scheduleGrid, estilos] = await Promise.all([
    ler('components/ScheduleGrid.tsx'),
    ler('app/globals.css'),
  ]);

  // Cabeçalho do grupo mostra só o nome do período. O rótulo fica num
  // <span> interno (não direto no <th>) porque o <th> ocupa a linha
  // inteira via colSpan — sticky na célula não tem efeito nenhum, quem
  // precisa ficar fixo ao rolar na horizontal é o texto, via sticky no
  // próprio <span> (ver `.schedule-table .grade-group-header > span` em
  // app/globals.css).
  assert.doesNotMatch(scheduleGrid, /\{grupo\.rotulo\}[^}]*colaborador/);
  assert.match(scheduleGrid, /<th className="grade-group-header" colSpan=\{datas\.length \+ 1\}>\s*<span>\{grupo\.rotulo\}<\/span>/);

  // Colunas vêm da união dos dias de todos os documentos, não só do primeiro
  // — evita grade sem nenhuma coluna quando o primeiro colaborador está em branco.
  assert.match(scheduleGrid, /function datasDoConjunto/);
  assert.doesNotMatch(scheduleGrid, /Object\.keys\(documentosFiltrados\[0\]\?\.dias/);

  // Célula vazia em contexto editável recebe onClick — não fica "morta".
  assert.match(scheduleGrid, /shift-chip-vazio/);
  assert.match(scheduleGrid, /onEditar\?\.\(documento, data, dia \?\? \{ c: '' \}\)/);
  assert.match(estilos, /\.shift-chip-vazio \{/);

  // Input do login: a regra do ícone precisa vencer em especificidade, não só em ordem.
  assert.match(estilos, /\.login-card \.login-field-input input \{/);
});

test('correção urgente: sem undefined no Firestore, erro visível e diferenciado por ambiente', async () => {
  const [writeRepo, dashboard, app, errors, estilos, sanitizar] = await Promise.all([
    ler('lib/firebase/writeRepository.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('lib/firebase/errors.ts'),
    ler('app/globals.css'),
    ler('lib/firebase/sanitizar.ts'),
  ]);

  // Sanitizador puro, sem SDK do Firestore.
  assert.doesNotMatch(sanitizar, /firebase\/firestore/);
  assert.match(sanitizar, /export function removerUndefined/);

  // Todo payload de escrita em usuarios/{login} passa por removerUndefined.
  assert.match(writeRepo, /removerUndefined/);
  assert.match(writeRepo, /setDoc\(doc\(db, 'usuarios', usuario\.login\), removerUndefined\(usuario\)/);
  assert.match(writeRepo, /batch\.set\(doc\(db, 'usuarios', usuario\.login\), removerUndefined\(usuario\)\)/);

  // Alias-only save não regrava o usuário inteiro.
  assert.match(writeRepo, /export async function atualizarAliasesPlanilha/);
  assert.match(dashboard, /atualizarAliasesPlanilha\(escolhido\.login, aliasesAtualizados\)/);

  // mensagemErroFirebase recebe o ambiente atual, não assume "laboratório".
  assert.match(errors, /ambiente: AmbienteErroFirebase = 'indefinido'/);
  assert.match(errors, /if \(ambiente === 'local'\)/);
  assert.match(errors, /if \(ambiente === 'staging'\)/);
  assert.match(dashboard, /import { ambienteFirebaseAtual } from '@\/lib\/firebase\/shared'/);
  assert.match(app, /import { ambienteFirebaseAtual } from '@\/lib\/firebase\/shared'/);
  assert.doesNotMatch(dashboard, /mensagemErroFirebase\(falha, '[^']*'\)/);
  assert.doesNotMatch(app, /mensagemErroFirebase\(falha, '[^']*'\)/);

  // Erro de publicação some do global e aparece dentro do próprio modal.
  assert.match(dashboard, /erroPublicacao/);
  assert.match(dashboard, /\{erroPublicacao &&/);

  // Toast sempre acima de modal (não pode ficar escondido atrás do overlay).
  assert.match(estilos, /\.toast \{[\s\S]*z-index: 260/);
});

test('responsável operacional cadastra colaborador e delega coordenação somente na equipe do alvo', async () => {
  const [dashboard, guards, rules] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/adminGuards.ts'),
    ler('firestore.rules'),
  ]);

  assert.match(guards, /export function cadastroUsuarioConcedeGestao/u);
  assert.match(guards, /export function perfilDelegavelPorResponsavelOperacional/u);
  assert.match(dashboard, /Coordenador da equipe/u);
  assert.match(dashboard, /Supervisor da equipe/u);
  assert.match(dashboard, /contextoCadastroOperacionalUsuario/u);
  assert.match(dashboard, /A autorização do alvo foi recusada e nenhum cadastro foi alterado/u);
  assert.match(dashboard, /confirme se o Grupo e a Matriz de Responsáveis continuam ativos/u);
  assert.match(rules, /contextoCadastroOperacionalAutorizaUsuario/u);
  assert.match(rules, /\['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'\]/u);
  assert.match(rules, /grupoPlantaoPorId\(contexto\.alvoId\)\.equipeResponsavelId == dados\.equipeId/u);
  assert.match(rules, /dados\.get\('escopo', null\) == 'EQUIPE'/u);
  assert.doesNotMatch(dashboard, /Perfis de coordenação e supervisão são concedidos somente por ADMIN_SISTEMA/u);
});

test('STAGING-RESET-HIERARQUIA-ICI-2 — cadastro livre de unidade/equipe em staging, com código técnico como valor principal', async () => {
  const [dashboard, guards, organizacao, rules] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/adminGuards.ts'),
    ler('lib/organizacao.ts'),
    ler('firestore.rules'),
  ]);

  // Rules: nova função de validação livre, nunca checando se o autor administra o alvo.
  assert.match(rules, /function perfilCadastroLivreStagingValido\(dados\)/u);
  assert.match(rules, /souCoordenadorOperacionalStaging\(\)\s*\n\s*&& request\.resource\.data\.get\('cadastroOperacional', null\) == null\s*\n\s*&& perfilCadastroLivreStagingValido/u);

  // adminGuards: GESTOR_UNIDADE também delegável, só com permitirAmploStaging.
  assert.match(guards, /permitirAmploStaging = false/u);
  assert.match(guards, /PERFIS_DELEGAVEIS_STAGING/u);

  // Dashboard: seletor livre de Unidade/Equipe, nunca travado em SOC/GEDSI_COSI.
  assert.match(dashboard, /usarCadastroLivreStaging/u);
  assert.match(dashboard, /PERFIS_DELEGAVEIS_STAGING/u);
  assert.match(dashboard, /Nenhuma unidade ativa encontrada\./u);
  assert.match(dashboard, /Nenhuma equipe ativa encontrada\./u);

  // Rótulo técnico: ID sempre como valor principal, nunca "nome — sigla".
  assert.match(organizacao, /export function rotuloTecnicoUnidade/u);
  assert.match(organizacao, /export function rotuloTecnicoEquipe/u);
  assert.match(dashboard, /rotuloTecnicoUnidade\(unidade\)/u);
  assert.match(dashboard, /rotuloTecnicoEquipe\(equipe\)/u);

  // Nível hierárquico sempre com descrição textual ao lado, nunca só o número.
  assert.match(organizacao, /export function descreverNivelHierarquico/u);
  assert.match(organizacao, /export function descreverClassificacaoHierarquica/u);
  assert.match(dashboard, /descreverNivelHierarquico\(formularioUsuario\.nivelHierarquico\)/u);
});

test('STAGING-RESET-HIERARQUIA-ICI-3 — causa raiz do campo Equipe travado: env var precisa existir no build real, não só no .example', async () => {
  const [dashboard, exemploStaging, dockerfile, compose] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('.env.staging.dashboard.example'),
    ler('deploy/dashboard/Dockerfile'),
    ler('deploy/dashboard/compose.yaml'),
  ]);

  // #1/#5 — a env var é lida e decide o modo livre vs. restrito do modal.
  assert.match(dashboard, /const PERMITIR_AMPLO_STAGING =\s*\n\s*import\.meta\.env\.VITE_ESCALA_STAGING_PERMISSAO_AMPLA === 'true';/u);
  assert.match(dashboard, /const usarCadastroLivreStaging = PERMITIR_AMPLO_STAGING/u);

  // #2/#3 — precisa estar documentada no template de staging e propagada até o build Docker/compose.
  assert.match(exemploStaging, /^VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true$/mu);
  assert.match(dockerfile, /ARG VITE_ESCALA_STAGING_PERMISSAO_AMPLA="false"/u);
  assert.match(dockerfile, /VITE_ESCALA_STAGING_PERMISSAO_AMPLA=\$\{VITE_ESCALA_STAGING_PERMISSAO_AMPLA\}/u);
  assert.match(compose, /VITE_ESCALA_STAGING_PERMISSAO_AMPLA: \$\{VITE_ESCALA_STAGING_PERMISSAO_AMPLA:-false\}/u);

  // #10 — sem fallback antigo sobrescrevendo a equipe escolhida pela do ator
  // no cadastro geral: o responsável do cadastro usa a equipe ESCOLHIDA
  // (equipeIdCadastroUsuario), não usuarioEfetivo.equipeId, quando staging
  // livre está ativo (ou quando é "Criar usuário" a partir de uma pendência
  // de conciliação de Jornada — JORNADA-IMPORTACAO-VINCULOS-UX-1).
  // FASE1-EQUIPE-SIMPLES — "Minha equipe" pode fixar a equipe do cadastro (equipeCadastroForcada).
  assert.match(dashboard, /participanteVinculoCadastro === null\s*\n\s*&& linhaConciliacaoVinculoCadastro === null\s*\n\s*&& !usarCadastroLivreStaging\s*\n(?:\s*&& equipeCadastroForcada === null\s*\n)?\s*\? usuarioEfetivo\s*\n\s*:/u);

  // Modo restrito precisa avisar explicitamente que staging amplo está desligado.
  assert.match(dashboard, /Permissão ampla de staging não está ativa; cadastro restrito à equipe atual\./u);
});

/**
 * PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — Parte A: o cabeçalho do App
 * mostrava um rótulo genérico derivado só de `nivelHierarquico`
 * ("Analista SOC"/"Coordenador"), nunca o `cargo` real cadastrado em
 * `usuarios/{login}`. Corrigido reaproveitando `rotuloCargoExibicao()`
 * (lib/sessao.ts) — cargo real primeiro, fallback baseado em perfil só
 * quando vazio.
 */
test('o cabeçalho do AppFrame mostra o cargo real (rotuloCargoExibicao), nunca mais o rótulo fixo por nivelHierarquico', async () => {
  const frame = await ler('components/AppFrame.tsx');
  assert.match(frame, /import \{ rotuloCargoExibicao \} from '@\/lib\/sessao';/u);
  const ocorrencias = frame.match(/<small>\{rotuloCargoExibicao\(usuario\)\}<\/small>/gu) ?? [];
  assert.equal(ocorrencias.length, 2, 'os dois pontos (topbar + popover da conta) precisam usar rotuloCargoExibicao');
  assert.doesNotMatch(frame, /usuario\.nivelHierarquico <= 5 \? 'Coordenador' : 'Analista SOC'/u, 'o rótulo fixo antigo não pode sobreviver');
});

/**
 * PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — Parte C: ausência de Jornada 6x1
 * publicada sempre virava a mesma mensagem genérica, mesmo para um login
 * com participação real em Plantão. Introduziu `mensagemAusenciaEscalaAcao()`,
 * mas ainda jogava as duas mensagens no alerta vermelho GLOBAL do topo do
 * App (`setErro`) — o que continuava ruim para UX (uma ausência PARCIAL,
 * só de Jornada, virava erro visual mesmo com Plantão disponível).
 *
 * FASE-APP-OPERACOES-UNIVERSAIS-1 removeu `mensagemAusenciaEscalaAcao()`
 * (e o `setErro` associado a ela): a ausência de Jornada deixou de ser um
 * "erro" e passou a ser um dado (`minhaEscala === null`) combinado com o
 * estado de Plantão — já carregado eagerly a cada login, não mais só ao
 * abrir a aba Plantão/Perfil — através de `operacoesApp.ts`. Nenhuma tela
 * mostra mais o alerta vermelho global só por faltar Jornada.
 */
test('o App não trata mais ausência de Jornada 6x1 como erro global — operacoesApp.ts decide por operação', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');

  // VISAO-COORDENADOR-APP-3 — + obterGrupoPlantao e listarGruposPlantaoPorUnidadeResponsavel
  // (só leitura) para o coordenador achar os Plantões que administra; a lista continua fechada.
  assert.match(app, /import \{\s*listarAtribuicoesPlantaoPublicada,\s*listarGruposPlantaoPermitidos,\s*listarGruposPlantaoPorUnidadeResponsavel,\s*listarParticipantesPlantao,\s*obterCompetenciaPlantaoPublicadaNaData,\s*obterGrupoPlantao,\s*observarPublicacoesPlantao,\s*\} from '@\/lib\/firebase\/plantaoReadRepository';/u);
  assert.doesNotMatch(app, /async function mensagemAusenciaEscalaAcao/u, 'a função antiga (que jogava a ausência de Jornada no alerta global) precisa ter sido removida');
  assert.doesNotMatch(app, /setErro\(await mensagemAusenciaEscalaAcao/u);
  assert.doesNotMatch(app, /'Nenhuma escala publicada foi encontrada para o seu login neste período\.'/u, 'a mensagem genérica antiga não pode mais aparecer sozinha para este caso');

  // O novo módulo puro é quem decide o que cada tela mostra por operação.
  assert.match(app, /from '\.\/operacoesApp';/u);
  assert.match(app, /resolverOperacoesApp\(/u);
  assert.match(app, /temJornadaPublicada\(operacoesApp\)/u);
  assert.match(app, /temPlantaoPublicado\(operacoesApp\)/u);

  // Plantão passou a carregar assim que o login termina (não mais só ao
  // abrir a aba Plantão/Perfil) — é o que permite Hoje/Agenda/Trocas/Equipe
  // saberem se existe Plantão publicado antes de o usuário visitar a aba.
  assert.match(app, /useEffect\(\(\) => \{\s*if \(usuario !== null\) \{\s*void Promise\.resolve\(\)\.then\(\(\) => carregarPlantaoApp\(\)\);/u);
});

test('IMPORTAR-PLANTAO-APP-1 — exceção controlada: só quem coordena importa Plantão pelo App, por um único caminho', async () => {
  const [app, componente, visao, modulo] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('apps/app/src/ImportarPlantaoCoordenacao.tsx'),
    ler('apps/app/src/VisaoCoordenador.tsx'),
    ler('lib/firebase/importacaoPlantaoApp.ts'),
  ]);
  // O EmployeeApp não ganha símbolos de gestão: só abre o componente dedicado.
  assert.doesNotMatch(app, /importacaoPlantaoApp|montagemRascunhoPlantao|salvarParticipantePlantao|salvarCompetenciaPlantaoRascunho|publicarCompetenciaPlantao/);
  assert.match(app, /<ImportarPlantaoCoordenacao/);
  // O botão só existe na visão de coordenação (renderizada só para quem coordena).
  assert.match(app, /souCoordenacaoApp && \(\s*<VisaoEquipesCoordenador[\s\S]*?onImportarPlantao=/);
  assert.match(visao, /onImportarPlantao &&/);
  // O componente fala apenas com o módulo dedicado — nunca com o repositório de escrita direto.
  assert.match(componente, /from '@\/lib\/firebase\/importacaoPlantaoApp'/);
  assert.doesNotMatch(componente, /plantaoWriteRepository|montagemRascunhoPlantao/);
  // O módulo usa o MESMO pipeline do Dashboard e marca a origem App (Rules decidem quem grava).
  for (const funcao of ['montarCompetenciaPlantaoRascunho', 'montarAtribuicoesPlantaoRascunho', 'montarParticipantesPlantaoParaSalvar', 'publicarCompetenciaPlantao']) {
    assert.match(modulo, new RegExp(funcao), funcao);
  }
  assert.match(modulo, /origemApp: true/);
});

test('APP-SEM-NOMES-FIXOS-1 — o App é universal: nenhum nome de unidade/equipe fixo no texto exibido', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  // Textos exibidos (JSX/strings) não podem citar unidades/equipes específicas;
  // o caminho do cabeçalho vem da equipe e da unidade da PRÓPRIA pessoa.
  assert.doesNotMatch(app, /COSI &gt;|&gt; SOC|>\s*(COSI|SOC|NOC|CODB)\s*</);
  assert.doesNotMatch(app, /['"`](COSI|SOC|NOC|CODB)( &gt;| ›| >|['"`])/);
  assert.match(app, /unidadeUsuarioApp\?\.sigla \|\| unidadeUsuarioApp\?\.nome, equipeUsuarioApp\?\.sigla \|\| equipeUsuarioApp\?\.nome/);
});

test('ESPACAMENTO-PADRAO-2 — grades do App nunca somam margem ao gap (cards com espaço igual)', async () => {
  const css = await ler('app/globals.css');
  // A regra que "devolvia" margem a todo div > .panel + .panel (e pegava a grade da Hoje) não pode voltar.
  assert.doesNotMatch(css, /\.employee-screen > div > \.panel \+ \.panel/);
  // Dentro das grades da Hoje e do Perfil, card depois de card não ganha margem: só o gap.
  assert.match(css, /\.today-dashboard-grid > \.panel \+ \.panel,\s*\.app-shell\.product-app \.today-summary-grid > \.panel \+ \.panel,\s*\.app-shell\.product-app \.profile-layout > \.panel \+ \.panel \{\s*margin-top: 0;/);
  assert.match(css, /\.app-shell\.product-app \.employee-screen \{\s*display: flex;\s*flex-direction: column;\s*gap: var\(--app-espaco-blocos\);/);
});

test('CONTA-SETOR-1 — conta do setor (sem escala própria) vê a equipe do dia e os plantões', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  // Reconhecida pela escala: tem equipe com escala publicada, mas o login não está nela.
  assert.match(app, /const contaSetorApp = Boolean\(usuario\?\.equipeId\)[\s\S]{0,200}!documentos\.some\(\(documento\) => documento\.login === usuario\?\.login\)/);
  // A "Equipe escalada hoje" aparece também para a conta do setor.
  assert.match(app, /\(jornadaPublicadaApp \|\| contaSetorApp\) && \(\s*<article className="panel today-team-panel">/);
  // Nada pessoal: sem aviso de jornada e sem avisos do turno.
  assert.match(app, /!jornadaPublicadaApp && plantaoPublicadoApp && !contaSetorApp/);
  assert.match(app, /!contaSetorApp && !liderSemEscalaPropriaApp && \(\s*<AlertasTurnoPerfil/);
});

test('PWA-INSTALAR-1 / PWA-ATUALIZAR-1 / CONTA-SETOR-2 — instalar uma vez, atualização confiável, NOC com Plantões primeiro', async () => {
  const pwa = await ler('components/PwaProvider.tsx');
  // Instalar: lembra que fechou/instalou/recusou e nunca mostra com o App instalado.
  assert.match(pwa, /if \(estaInstalado\(\) \|\| instalacaoEncerrada\(\)\) \{/);
  assert.match(pwa, /const concluirInstalacao = \(\) => \{\s*encerrarInstalacao\(\);/);
  // Atualizar: confere o /versao.json (sem cache) e o botão funciona sem SW em espera.
  assert.match(pwa, /fetch\(`\/versao\.json\?t=\$\{Date\.now\(\)\}`, \{ cache: 'no-store' \}\)/);
  assert.match(pwa, /\(atualizacao \|\| versaoNovaPublicada\) &&/);
  const main = await ler('apps/app/src/main.tsx');
  assert.match(main, /verificarVersaoNova=\{\(publicada\) => versaoPublicadaDiferente\(VERSAO_APP, publicada\)\}/);
  // Conta do setor: "Equipe escalada hoje" depois dos Plantões.
  const css = await ler('app/globals.css');
  assert.match(css, /\[data-conta-setor\] > \.today-team-panel \{ order: 1; \}/);
  assert.doesNotMatch(css, /\[data-conta-setor\] > \.today-team-panel \{ order: -1; \}/);
});

test('TROCA-CONTA-1 — ouvintes ignoram o encerramento do Firestore e erros não sobrevivem à troca de conta', async () => {
  for (const arquivo of ['apps/app/src/EmployeeApp.tsx', 'apps/app/src/lembretes/useLembretes.ts']) {
    const fonte = await ler(arquivo);
    // Nenhum ouvinte mostra erro sem antes descartar o encerramento (logout).
    assert.doesNotMatch(fonte, /\(falha\) => set[A-Za-z]+\(mensagemErroFirebase\(/u, `${arquivo}: ouvinte sem ehErroEncerramentoFirestore`);
  }
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.equal((app.match(/limparErrosDaSessao\(\);/gu) ?? []).length, 2, 'limpar ao entrar e ao sair');
});

test('HOJE-PLANTONISTA-1 — Hoje do plantonista: o próprio Plantão, passagem com contatos e sem aviso de 6x1', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(app, /!jornadaPublicadaApp && plantaoPublicadoApp && !contaSetorApp && !souPlantonistaAtivoApp && !souCoordenacaoApp && \(/, 'plantonista (e líder) não vê "Nenhuma jornada 6x1"');
  // O grupo é o do PRÓPRIO plantonista (participante ativo), não o aberto na aba Plantão.
  assert.match(app, /const meuGrupo = gruposPlantaoApp\.find\(\(item\) => \(detalhesPlantaoPorGrupoApp\[item\.grupoId\]\?\.participantes \?\? \[\]\)\s*\.some\(\(participante\) => participante\.login === usuario\.login && participante\.ativo\)\)/);
  // Tocar na pessoa abre o mesmo modal de contatos dos "Plantões agora".
  assert.match(app, /onAbrirPlantonista=\{\(atribuicao\) => setPlantonistaAberto\(\{ grupo: meuGrupo, atribuicao, participantes: detalhe\.participantes \}\)\}/);
});

test('HOJE-COORDENACAO-1 — coordenação: visão do dia, histórico de trocas, Agenda com lembretes, Perfil sem avisos do turno', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(app, /<HojeCoordenacao[\s\S]{0,900}onAbrirPlantonista=\{\(plantao, atribuicao\) => setPlantonistaAberto\(\{ grupo: plantao\.grupo, atribuicao, participantes: plantao\.participantes \}\)\}/);
  assert.match(app, /const historicoTrocasEquipeApp = Object\.values\(trocasParaAprovarPorChave\)\.flat\(\)/, 'histórico sai da MESMA consulta (sem leitura nova)');
  assert.match(app, /AGENDA-COORDENACAO-1[\s\S]{0,1200}<LembretesView/);
  const tela = await ler('apps/app/src/HojeCoordenacao.tsx');
  assert.match(tela, /\(\['ontem', 'hoje', 'amanha'\] as const\)/, 'Ontem | Hoje | Amanhã');
  assert.match(tela, /sequenciaDoPosto\(plantao\.atribuicoes, agoraIso, funcao\)/, 'Antes · Agora · Depois por posto');
});

test('LEMBRETE-EQUIPE-APP-1 — lembrete para a equipe: caminho único, origemApp e Plantão informado', async () => {
  const [app, componente, modulo] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('apps/app/src/CriarLembreteEquipe.tsx'),
    ler('lib/firebase/lembreteEquipeApp.ts'),
  ]);
  // O EmployeeApp não chama o repositório de escrita: só abre o componente dedicado.
  assert.doesNotMatch(app, /criarLembreteAtribuido|criarSerieLembretesAtribuidos|lembreteEquipeApp/);
  assert.match(app, /<CriarLembreteEquipe/);
  // O componente fala só com o módulo dedicado.
  assert.match(componente, /from '@\/lib\/firebase\/lembreteEquipeApp'/);
  assert.doesNotMatch(componente, /lembretesRepository/);
  // O módulo marca a origem App e repassa o Plantão (as Rules decidem quem pode).
  assert.match(modulo, /origemApp: true/);
  assert.match(modulo, /grupoPlantaoId: alvo\.grupoPlantaoId/);
});

test('IMPORTAR-6X1-APP-1 — exceção controlada: importar 6x1 pelo App por um único caminho, com o mesmo pipeline', async () => {
  const [app, componente, visao, modulo] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('apps/app/src/ImportarEscala6x1Coordenacao.tsx'),
    ler('apps/app/src/VisaoCoordenador.tsx'),
    ler('lib/firebase/importacao6x1App.ts'),
  ]);
  // O EmployeeApp não ganha símbolos de gestão: só abre o componente dedicado.
  assert.doesNotMatch(app, /importacao6x1App|salvarRascunho|publicarEscalas|parsePlanilhaEscala/);
  assert.match(app, /<ImportarEscala6x1Coordenacao/);
  // O botão só existe na visão de coordenação.
  assert.match(app, /souCoordenacaoApp && \(\s*<VisaoEquipesCoordenador[\s\S]*?onImportar6x1=/);
  assert.match(visao, /onImportar6x1 &&/);
  // O componente fala só com o módulo dedicado.
  assert.match(componente, /from '@\/lib\/firebase\/importacao6x1App'/);
  assert.doesNotMatch(componente, /writeRepository/);
  // MESMO pipeline do Dashboard (leitura, conciliação, rascunho, publicação) e origem App.
  for (const funcao of ['processarArquivoImportado', 'conciliarPlanilha', 'loginParaUidComConciliacao', 'salvarRascunho', 'publicarEscalas', 'temErroBloqueante']) {
    assert.match(modulo, new RegExp(funcao), funcao);
  }
  assert.match(modulo, /origemApp: true/);
});

test('NOME-SEM-ESPACOS-1 — nome gravado sempre limpo, e o script usa a MESMA regra', async () => {
  const repositorio = await ler('lib/firebase/writeRepository.ts');
  // As três gravações de nome passam pela normalização.
  assert.equal((repositorio.match(/nome: normalizarNomePessoa\(/gu) ?? []).length, 3);
  const regra = (await ler('lib/nomePessoa.ts')).match(/\/\[\\s\\u00a0[^/]+\]\+\/gu/u)?.[0];
  const script = (await ler('scripts/staging/normalizar-nomes-usuarios.mjs')).match(/\/\[\\s\\u00a0[^/]+\]\+\/gu/u)?.[0];
  assert.ok(regra && script, 'regra encontrada nos dois arquivos');
  assert.equal(script, regra, 'o script de correção usa a mesma regra do repositório');
});

test('LIDERANCA-PADRAO-1 — uma regra só para as telas de quem lidera (com ou sem equipe fixa)', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  // A regra: lidera e não tem escala própria (nem jornada, nem plantão próprio).
  assert.match(app, /const liderSemEscalaPropriaApp = souCoordenacaoApp && !jornadaPublicadaApp && !souPlantonistaAtivoApp;/);
  // A regra antiga (só "sem equipe fixa") não volta.
  assert.doesNotMatch(app, /souCoordenacaoApp && !usuario\.equipeId/);
  // A declaração vem DEPOIS das variáveis que ela usa (senão a tela quebra ao abrir).
  const declaracao = app.indexOf('const liderSemEscalaPropriaApp');
  assert.ok(declaracao > app.indexOf('const souPlantonistaAtivoApp') && declaracao > app.indexOf('const jornadaPublicadaApp'));
  // Telas: Agenda (lembretes), Plantão (do líder), Equipe (sem seções de colaborador), Perfil, Trocas.
  assert.match(app, /\{tela === 'minha' && liderSemEscalaPropriaApp && \(/);
  assert.match(app, /\{tela === 'plantao' && usuario && \(liderSemEscalaPropriaApp \? \(/);
  assert.match(app, /<PlantoesDaCoordenacao/);
  assert.match(app, /souCoordenacaoApp && \(\s*<article className="panel troca-bloco-aprovar">/);
  assert.match(app, /souCoordenacaoApp && \(\s*<article className="panel troca-historico-equipe">/);
});

test('MINHA-EQUIPE-PLANTOES-1 — o chefe escolhe os Plantões da equipe por interruptor, só para a própria equipe', async () => {
  const [dashboard, componente, regras] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/dashboard/src/PlantoesDaEquipe.tsx'),
    ler('firestore.rules'),
  ]);
  assert.match(dashboard, /<PlantoesDaEquipe key=\{equipeAtivaMinhaEquipe\.id\} equipe=\{\{ id: equipeAtivaMinhaEquipe\.id, nome: equipeAtivaMinhaEquipe\.nome \}\}( gruposDemo=\{[^}]*\})? \/>/);
  // Grava pela função existente (só equipesConsulta, uma equipe por vez).
  assert.match(componente, /atualizarEquipeConsultaPlantao\(grupo\.grupoId, equipe\.id, ligar \? 'ADICIONAR' : 'REMOVER'\)/);
  // A equipe responsável nunca é desligada do próprio Plantão.
  assert.match(componente, /disabled=\{daEquipe \|\| salvandoId !== null\}/);
  // Regra: o chefe pela Matriz também usa o interruptor — mas só para a própria equipe.
  assert.match(regras, /\|\| podeAdministrarJornada\(equipeAlterada\)\n\s*\);/);
});

test('LIDERANCAS-1 — liderança promove liderança (só para gestor de equipe, com registro); menu para toda liderança', async () => {
  const [dashboard, pagina, repositorio, regras] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/dashboard/src/LiderancasPage.tsx'),
    ler('lib/firebase/liderancasRepository.ts'),
    ler('firestore.rules'),
  ]);
  assert.match(dashboard, /\{ id: 'liderancas', rotulo: 'Lideranças', icone: 'user' \}/);
  assert.match(dashboard, /tela === 'liderancas' && usuarioReal && \(\s*<LiderancasPage/);
  assert.match(await ler('apps/dashboard/src/pessoasLideranca.tsx'), /tornarLideranca\(pessoa, autorLogin\)/);
  assert.match(pagina, /<ConfirmarPromocao/);
  assert.match(repositorio, /camposPromocaoLideranca\(alvo, autorLogin, new Date\(\)\.toISOString\(\)\)/);
  // Regra: só promove para GESTOR_EQUIPE, registra quem, nunca a si mesma, nunca rebaixa.
  assert.match(regras, /&& request\.resource\.data\.get\('perfil', ''\) == 'GESTOR_EQUIPE'\n\s*&& request\.resource\.data\.get\('nivelHierarquico', -1\)/);
  assert.match(regras, /&& request\.resource\.data\.get\('promovidoPorLogin', ''\) == loginDoAuth\(\)/);
  assert.match(regras, /&& loginDoAuth\(\) != login\n\s*&& !\(resource\.data\.get\('perfil', ''\) in \['ADMIN_SISTEMA', 'GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'\]\)/);
});

test('LIDERANCAS-1 — a alternativa de promoção usa .get() (pedido sem perfil não pode dar erro e contaminar as outras)', async () => {
  const regras = await ler('firestore.rules');
  const inicio = regras.indexOf('LIDERANCAS-1 — uma liderança torna outra pessoa liderança');
  const trecho = regras.slice(inicio, inicio + 1600);
  assert.doesNotMatch(trecho, /request\.resource\.data\.(perfil|nivelHierarquico|promovidoPorLogin|promovidoEm) /u);
});

test('CRIAR-EQUIPE-1 — liderança cria a própria equipe e vira a responsável, num lote só', async () => {
  const [dashboard, modal, modulo, regras] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/dashboard/src/CriarEquipeModal.tsx'),
    ler('lib/firebase/criarEquipeLideranca.ts'),
    ler('firestore.rules'),
  ]);
  // DASHBOARD-LOTE2 — "Criar equipe" foi para o "+ Nova" junto das abas (só liderança).
  assert.match(dashboard, /souLiderancaDashboard && \(\s*<MenuAcoes[\s\S]{0,400}executar: \(\) => setCriandoEquipe\(true\)/);
  assert.match(dashboard, /setEquipeSelecionadaMinhaEquipe\(`JORNADA:\$\{equipe\.id\}`\)/);
  assert.match(modal, /criarEquipeComoLideranca\(\{ nome, unidade \}, autor\)/);
  // Equipe e responsável juntos (writeBatch) — nunca equipe sem chefe.
  assert.match(modulo, /const lote = writeBatch\(db\);[\s\S]*lote\.set\(doc\(db, 'equipes', id\)[\s\S]*lote\.set\(doc\(db, 'escoposOperacionais'[\s\S]*await lote\.commit\(\);/);
  assert.match(modulo, /responsaveisLogin: \[autor\.login\]/);
  // Regras: a criadora é quem pede; o responsável só ela, só de equipe que ela criou (no mesmo lote).
  assert.match(regras, /request\.resource\.data\.get\('criadoPorLogin', ''\) == loginDoAuth\(\)\n\s*&& request\.resource\.data\.get\('id', ''\) == equipeId/);
  assert.match(regras, /getAfter\(\/databases\/\$\(database\)\/documents\/equipes\/\$\(request\.resource\.data\.alvoId\)\)\.data\.get\('criadoPorLogin', ''\) == loginDoAuth\(\)\n\s*&& request\.resource\.data\.responsaveisLogin == \[loginDoAuth\(\)\]/);
});

test('CRIAR-PLANTAO-1 — chefe cria o Plantão da equipe (com responsável no mesmo lote); menu único para lideranças', async () => {
  const [dashboard, modulo, regras] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/firebase/criarPlantaoLideranca.ts'),
    ler('firestore.rules'),
  ]);
  assert.match(dashboard, /desabilitado: escritaBloqueada \|\| equipesMinhaEquipe\.length === 0,[\s\S]{0,200}executar: \(\) => setCriandoPlantao\(true\)/);
  assert.match(dashboard, /setEquipeSelecionadaMinhaEquipe\(`PLANTAO:\$\{grupo\.grupoId\}`\)/);
  // Toda liderança tem o mesmo menu; Administração só para o administrador.
  assert.match(dashboard, /const navegacaoVisivel = souAdmin \? NAVEGACAO : NAVEGACAO_COORDENACAO;/);
  assert.match(modulo, /const lote = writeBatch\(db\);[\s\S]*lote\.set\(doc\(db, 'gruposPlantao', grupoId\)[\s\S]*lote\.set\(doc\(db, 'escoposOperacionais'[\s\S]*await lote\.commit\(\);/);
  assert.match(regras, /\|\| podeAdministrarJornada\(request\.resource\.data\.equipeResponsavelId\)/);
  assert.match(regras, /getAfter\(\/databases\/\$\(database\)\/documents\/gruposPlantao\/\$\(request\.resource\.data\.alvoId\)\)\.data\.get\('criadoPorLogin', ''\) == loginDoAuth\(\)/);
});

test('APROVAR-TROCA-PLANTAO-LIDER-1 — quem lidera Plantão decide as trocas de todos os Plantões que administra', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  // Carrega as trocas de TODOS os Plantões liderados (atual e próxima competência), não só o selecionado.
  assert.match(app, /for \(const grupoId of chavePlantoesLideradosApp\.split\('\|'\)\) \{\s*for \(const competencia of \[competenciaAtiva, competenciaSeguinteApp\]\)/);
  // Aparecem no "Para aprovar" e somam nos números da Hoje.
  assert.match(app, /pendentesPlantaoLiderancaApp\.length > 0 && \(\s*<div className="troca-lista troca-lista-plantao-lideranca">/);
  assert.match(app, /trocasParaAprovar=\{totalTrocasParaAprovarApp\}/);
  // A decisão abre com o Plantão da própria troca (não exige Plantão selecionado).
  assert.match(app, /\{trocaPlantaoAberta && usuario && grupoDaTrocaPlantaoAberta != null && \(/);
  assert.match(app, /podeDecidirComoGestor=\{trocaPlantaoAbertaDaLideranca !== null \|\| podeAprovarTrocaPlantaoApp\}/);
});

test('LIDERANCAS-2 — Colaboradores em menu próprio (minha equipe em destaque); nova liderança e remover (admin)', async () => {
  const [dashboard, colaboradores, liderancas, regras] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/dashboard/src/ColaboradoresPage.tsx'),
    ler('apps/dashboard/src/LiderancasPage.tsx'),
    ler('firestore.rules'),
  ]);
  // Menu: Colaboradores logo abaixo de Lideranças, para toda liderança.
  assert.match(dashboard, /\{ id: 'liderancas', rotulo: 'Lideranças', icone: 'user' \},\n\s*\/\/ LIDERANCAS-2[^\n]*\n\s*\{ id: 'colaboradores', rotulo: 'Colaboradores', icone: 'users' \}/);
  // Minha equipe primeiro e com selo.
  assert.match(colaboradores, /\.sort\(\(a, b\) => Number\(daMinhaEquipe\(b\)\) - Number\(daMinhaEquipe\(a\)\)/);
  assert.match(colaboradores, /Sua equipe/);
  // Remover liderança: só o administrador, nunca a si mesmo.
  assert.match(liderancas, /souAdmin && podeRemoverLideranca\(pessoa\) && pessoa\.login !== autor\.login/);
  // Regra: pessoa nova só como GESTOR_EQUIPE nível 5, sem equipe, com registro e só os campos previstos.
  assert.match(regras, /LIDERANCAS-2[\s\S]{0,600}request\.resource\.data\.get\('perfil', ''\) == 'GESTOR_EQUIPE'\n\s*&& request\.resource\.data\.get\('nivelHierarquico', -1\) == 5/);
});

test('LIDERANCAS-2 — a alternativa "pessoa nova como liderança" é a ÚLTIMA do allow create de usuarios', async () => {
  const regras = await ler('firestore.rules');
  // Depois dela, o bloco fecha e vem a exclusão de usuário — nenhuma alternativa antiga depois.
  assert.match(regras, /'ativo', 'perfil', 'promovidoPorLogin', 'promovidoEm', 'criadoEm', 'atualizadoEm',\n\s*\]\)\n\s*\)\n\s*\);\n\n\s*\/\/ EXCLUSAO-USUARIO-2/);
  // E ela vem depois da alternativa de staging (a última antiga).
  assert.ok(regras.indexOf('perfilCadastroLivreStagingValido(request.resource.data)\n          )') < regras.indexOf('LIDERANCAS-2 — uma liderança cadastra uma pessoa NOVA'));
});

test('ADMIN-EQUIPES-1 — Administração abre em Equipes; Organização antiga continua acessível', async () => {
  const [dashboard, pagina] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/dashboard/src/AdminEquipesPage.tsx'),
  ]);
  assert.match(dashboard, /useState<'equipes' \| 'organizacao' \| 'coordenacoes' \| 'regras' \| 'conferencia'>\('equipes'\)/);
  assert.match(dashboard, /tela === 'administracao' && podeAcessarAdministracao && abaAdministracao === 'equipes' && usuarioReal && \(\s*<AdminEquipesPage/);
  assert.match(dashboard, /tela === 'administracao' && podeAcessarAdministracao && abaAdministracao === 'organizacao' && \(/);
  // A liderança da equipe é o responsável da Matriz JORNADA (o que o banco já usa).
  assert.match(dashboard, /responsaveisLogin: \[login\],[\s\S]{0,200}await salvarEscopoOperacional\(escopo\);/);
  // Sem códigos técnicos à vista: o cartão não mostra id nem código organizacional.
  assert.doesNotMatch(pagina, /codigoOrganizacional|>\{equipe\.id\}</);
});

test('ADMIN-PLANTOES-1 — Administração › Plantões em cartões; tela completa (plantonistas e escala) continua acessível', async () => {
  const [dashboard, pagina] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('apps/dashboard/src/AdminPlantoesPage.tsx'),
  ]);
  assert.match(dashboard, /tela === 'plantoes' && podeAcessarPlantoes && souAdmin && abaPlantoesAdmin === 'resumo' && usuarioReal && \(\s*<AdminPlantoesPage/);
  assert.match(dashboard, /tela === 'plantoes' && podeAcessarPlantoes && \(abaPlantoesAdmin === 'completa' \|\| !souAdmin\) && \(/);
  assert.match(dashboard, /Voltar para Plantões/);
  // Quem vê: a equipe do Plantão nunca sai da lista.
  assert.match(pagina, /equipesConsulta: \[\.\.\.new Set\(\[grupo\.equipeResponsavelId, \.\.\.selecionadas\]\)\]/);
  assert.doesNotMatch(pagina, />\{grupo\.grupoId\}</);
});

test('PLANTAO-EDITOR-SIMPLES-1 — editor de Plantão mais limpo, com "Quem vê"; Plantões da equipe no topo da Minha equipe', async () => {
  const [dashboard, regras] = await Promise.all([ler('apps/dashboard/src/DashboardApp.tsx'), ler('firestore.rules')]);
  // Editor: sem o selo "Próximo: …" duplicado, sem "Novo grupo" nos campos, com "Quem vê".
  assert.doesNotMatch(dashboard, /'Próximo: 1\. Validar prévia'|'Próximo: 2\. Salvar rascunho'/);
  assert.match(dashboard, /<QuemVePlantaoPainel/);
  // O quadro "sem planilha de origem" só aparece quando há planilha.
  assert.match(dashboard, /\{resultado !== null && \(\n\s*<article className="panel plantao-resumo-panel plantao-preview-fonte">/);
  // Minha equipe: o card dos Plantões vem ANTES da escala da equipe.
  assert.ok(dashboard.indexOf('<PlantoesDaEquipe key=') < dashboard.indexOf('{grupoAtivoMinhaEquipe !== null ? ('));
  // Regra: responsável pela escala do Plantão muda só quem vê, sem tirar a equipe do Plantão — última alternativa.
  assert.match(regras, /podeAdministrarEscalaPlantao\(grupoId\)\n\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['equipesConsulta', 'atualizadoEm'\]\)\n\s*&& request\.resource\.data\.equipesConsulta is list\n\s*&& resource\.data\.equipeResponsavelId in request\.resource\.data\.equipesConsulta\n\s*\)\n\s*\);/);
});

test('ESCALA-PLANTAO-1 — escala no ar abre a "Escala do Plantão" (conferir); editor só por Ajustar; rascunho segue no editor', async () => {
  const [dashboard, pagina] = await Promise.all([ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/src/EscalaPlantaoPage.tsx')]);
  const corpo = /function abrirEditorPlantaoDashboard\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /if \(competenciaPlantaoExibidaDashboard\.status === 'PUBLICADA'\) \{\s*setTela\('escalaPlantao'\);\s*return;\s*\}\s*void abrirRascunhoNoEditorAcao/);
  assert.match(dashboard, /onAjustar=\{\(\) => void abrirRascunhoNoEditorAcao\(grupoPlantaoDashboard, competenciaPlantaoExibidaDashboard\)\}/);
  // A tela só confere: calendário em modo consulta, mesma reidratação do editor.
  assert.match(pagina, /modo="consulta"/);
  assert.match(pagina, /reidratarRascunhoPlantao\(/);
});

test('ESCALA-PLANTAO-2 — editor: validação automática, sem aba Contabilidade, "Precisa da sua atenção" só quando há algo', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /const previaPlantaoValidadaEfetiva = previaPlantaoValidada \|\| previaPlantaoPodeValidar;/);
  // Salvar depende da validação efetiva (automática), não do clique.
  assert.match(dashboard, /disabled=\{!previaPlantaoValidadaEfetiva \|\| salvandoRascunhoPlantao/);
  assert.match(dashboard, /\(pendencias > 0 \|\| totalAlertasEditor > 0\) && \(\s*<h3 className="plantao-atencao-titulo">/);
  assert.doesNotMatch(dashboard, /'Vínculos prontos'|Prévia validada\. Nenhum dado de Plantão foi publicado\./);
});

test('SESSAO-CELULAR-1 — falha passageira ao buscar o cadastro não desconecta a conta; restauração espera quando a conta já está no aparelho', async () => {
  const [auth, restauracao] = await Promise.all([ler('lib/firebase/authRepository.ts'), ler('components/RestauracaoSessao.tsx')]);
  const corpo = /async function carregarUsuario\(email: string \| null\): Promise<Usuario> \{([\s\S]*?)\n\}/u.exec(auth)?.[1] ?? '';
  // Antes: catch → signOut sempre. Agora: passageira tenta de novo; rede mantém a sessão.
  assert.match(corpo, /if \(!falhaPassageiraAoCarregarUsuario\(primeira\)\) \{\s*(registrarEventoSessao\([^)]*\)\);\s*)?await signOut\(auth\);/);
  assert.match(corpo, /getIdToken\(true\)/);
  assert.match(corpo, /if \(falhaDeRedeAoCarregarUsuario\(segunda\)\) throw segunda;/);
  assert.match(restauracao, /if \(contaRestauradaNoAparelho\(\)\) \{\s*temporizador = window\.setTimeout\(desistir, TEMPO_EXTRA_COM_CONTA_MS\);/);
});

test('SESSAO-CELULAR-2 — diagnóstico: cada abertura registra o que aconteceu e o login do App mostra quando terminou mal', async () => {
  const [auth, login, restauracao] = await Promise.all([
    ler('lib/firebase/authRepository.ts'), ler('components/LoginPanel.tsx'), ler('components/RestauracaoSessao.tsx'),
  ]);
  assert.match(auth, /registrarEventoSessao\('SEM_CONTA_GUARDADA'/);
  assert.match(auth, /registrarEventoSessao\('RESTAURADA'\)/);
  assert.match(restauracao, /registrarEventoSessao\('TEMPO_ESGOTADO'/);
  assert.match(login, /tipo === 'app' && diagnosticoSessao && <p className="login-diagnostico-sessao">/);
});

test('MANTER-CONECTADO-APP-1 — no App a caixa vem sempre marcada e avisa quando desmarcada', async () => {
  const login = await ler('components/LoginPanel.tsx');
  assert.match(login, /const \[manterConectadoApp, setManterConectadoApp\] = useState\(true\);/);
  assert.match(login, /const manterConectado = tipo === 'app' \? manterConectadoApp : sessao\.manterConectado;/);
  assert.match(login, /Você vai precisar entrar de novo quando fechar o App\./);
});

test('ESCALA-PLANTAO-3 — rascunho salvo sozinho; Publicar abre a confirmação (o que muda, quem vê) e publica pelo mesmo caminho', async () => {
  const [dashboard, modal] = await Promise.all([ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/src/ConfirmarPublicacaoPlantao.tsx')]);
  assert.match(dashboard, /salvandoPlantaoSozinhoRef\.current = true;\s*void salvarRascunhoPlantaoAcao\(\)/);
  assert.match(dashboard, /if \(!salvandoPlantaoSozinhoRef\.current\) \{\s*setMensagem\(/);
  // O efeito fica ANTES do return antecipado do login (regra dos hooks).
  assert.ok(dashboard.indexOf('if (!deveSalvarPlantaoSozinho) return undefined;') < dashboard.indexOf('return <LoginPanel tipo="dashboard"'));
  assert.match(dashboard, /onClick=\{\(\) => setConfirmarPublicacaoPlantaoAberta\(true\)\}/);
  assert.match(dashboard, /onPublicar=\{\(\) => \{\s*void publicarPlantaoAcao\(\)/);
  assert.match(modal, /mudancasEntreEscalas\(noAr, atribuicoes\)/);
  assert.match(modal, /<QuemVePlantaoPainel/);
});

test('ESCALA-PLANTAO-4 — calendário com "Ver" / "Ajustar plantões" e dica; "⋯" mostra a versão no ar', async () => {
  const [dashboard, pagina] = await Promise.all([ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/src/EscalaPlantaoPage.tsx')]);
  assert.doesNotMatch(dashboard, /Edição \(arrastar\)/);
  assert.match(dashboard, /Ajustar plantões/);
  assert.match(dashboard, /o rascunho é salvo sozinho/);
  assert.match(pagina, /aria-label="Detalhes da versão"/);
  assert.match(pagina, /Versão \{competencia\.revisao\}/);
});

test('COORD-PREVISAO-DIREITA-1 — no celular a previsão do turno fica à direita das pessoas, na mesma linha', async () => {
  const css = await ler('app/globals.css');
  // COORD-TURNO-CARD-2 — chip em coluna fixa; previsão no canto direito, na altura do nome; pessoas alinhadas com o nome.
  assert.match(css, /grid-template-columns: 42px minmax\(0, 1fr\) auto;\s*grid-template-areas:\s*"chip nome tempo"\s*"chip pessoas pessoas";/);
  assert.match(css, /\.coord-turnos \.coord-turno > \.tempo-dia \{\s*grid-area: tempo;/);
});

test('DASHBOARD-LOTE1 — seletor do topo só nas telas da escala; passos concluídos recolhidos; "Precisa da sua atenção" só com itens', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /const TELAS_COM_SELETOR_ESCALA: ReadonlySet<string> = new Set\(\['visao', 'equipe', 'escalas', 'importar', 'grade', 'trocas', 'escalaPlantao'\]\);/);
  assert.match(dashboard, /contextoEscala=\{\(TELAS_COM_SELETOR_ESCALA\.has\(tela\) \? \(/);
  assert.match(dashboard, /passos\.map\(\(passo, indice\) => passo\.feito \? null : \(/);
  assert.match(dashboard, /if \(itens\.length === 0\) return null;/);
  assert.doesNotMatch(dashboard, /<h2>Pendências<\/h2>/);
});

test('DASHBOARD-LOTE2 — Minha equipe: ações com texto e "⋯"; Trocas: números nas abas e estado vazio simples', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /<CalendarDays size=\{14\} aria-hidden="true" \/> Ver mês/);
  assert.match(dashboard, /<Pencil size=\{14\} aria-hidden="true" \/> Editar/);
  assert.match(dashboard, /rotulo: 'Excluir',[\s\S]{0,240}perigo: true,/);
  // Minha equipe sem a coluna Status (o selo "Inativo" vai junto do nome).
  assert.match(dashboard, /<thead><tr><th>Pessoa<\/th><th>Login<\/th><th>Turno<\/th><th aria-label="Ações" \/><\/tr><\/thead>/);
  assert.doesNotMatch(dashboard, /<span>Aguardando você<\/span>/);
  assert.match(dashboard, /\{trocas\.length > 0 && <ScheduleLegend catalogo=\{catalogo\} \/>\}/);
});

test('DASHBOARD-LOTE3 — linguagem simples, "Descartar rascunho" no "⋯" e demonstração sem erros', async () => {
  const [dashboard, pessoas, plantoes] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/src/pessoasLideranca.tsx'), ler('apps/dashboard/src/PlantoesDaEquipe.tsx'),
  ]);
  for (const termo of [/Rastreabilidade local/, /laboratório local/, /Operação integrada/, /Abrir operação /, /um rollback sempre cria/]) {
    assert.doesNotMatch(dashboard, termo, String(termo));
  }
  assert.match(dashboard, /rotulo: 'Descartar rascunho',[\s\S]{0,160}perigo: true,/);
  assert.match(pessoas, /if \(pessoasDemo\) return undefined;/);
  assert.match(plantoes, /if \(gruposDemo\) return undefined;/);
});

test('ADMIN-LOTE4 — Coordenações em lista, Conferência com correção, e as telas antigas em "Avançado"', async () => {
  const [dashboard, conferencia] = await Promise.all([ler('apps/dashboard/src/DashboardApp.tsx'), ler('lib/conferenciaAdministracao.ts')]);
  assert.match(dashboard, /abaAdministracao === 'coordenacoes' && usuarioReal && \(\s*<AdminCoordenacoesPage/);
  assert.match(dashboard, /abaAdministracao === 'conferencia' && usuarioReal && \(\s*<AdminConferenciaPage/);
  // As telas antigas continuam acessíveis (em "Avançado"), não foram removidas.
  assert.match(dashboard, /rotulo: 'Organização \(árvore\)', executar: \(\) => onEscolherAba\('organizacao'\)/);
  assert.match(dashboard, /rotulo: 'Responsáveis por escala', executar: \(\) => onEscolherAba\('responsaveis'\)/);
  // Conferência é função pura (sem banco) e as correções de um clique só mexem no vínculo de responsável.
  assert.doesNotMatch(conferencia, /firebase/);
  assert.match(dashboard, /acao\.tipo === 'DESATIVAR_VINCULO'\s*\? \{ ativo: false \}/);
});

test('EQUIPE-DE-PLANTAO-1 — equipe de Plantão não é equipe 6x1: sem "Definir liderança", Conferência só com critério seguro, script só toca quem nunca teve 6x1', async () => {
  const [equipes, dashboard, script] = await Promise.all([
    ler('apps/dashboard/src/AdminEquipesPage.tsx'), ler('apps/dashboard/src/DashboardApp.tsx'), ler('scripts/staging/corrigir-equipe-de-plantao.mjs'),
  ]);
  assert.match(equipes, /const semLideranca = \(equipe: Equipe\) => daPlantao\(equipe\) === null && /);
  assert.match(equipes, /\{plantao \? \(\s*<span className="admin-equipe-plantao-nota"/);
  assert.match(dashboard, /resumo !== undefined && resumo\.rascunhos\.length === 0 && resumo\.publicadas\.length === 0/);
  // O script desativa (nunca apaga) e só quando não há escala 6x1 nenhuma.
  assert.match(script, /const corrigiveis = candidatos\.filter\(\(item\) => !item\.temEscala6x1\);/);
  assert.match(script, /lote\.update\(item\.ref, \{ ativo: false,/);
  assert.doesNotMatch(script, /\.delete\(/);
});

test('REGRAS-ESCALA-1 — painel de regras usa o motor novo; regras padrão sem "6x1" escrito; motor puro (sem Firebase/React)', async () => {
  const [dashboard, painel, motor, padrao] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/src/AdminRegrasPage.tsx'), ler('lib/regrasEscala.ts'), ler('lib/regrasPadrao.ts'),
  ]);
  assert.match(dashboard, /abaAdministracao === 'regras' && usuarioReal && \(\s*<AdminRegrasPage\s*regras=\{REGRAS_PADRAO\}\s*regrasSalvas=\{regrasSalvas\}/);
  assert.match(painel, /avaliarRegras\(documentos, catalogo, todasValendo, \{ nomePorLogin \}\)/);
  // O motor é puro: nada de Firebase nem React; o interpretador nunca executa código (sem eval/Function).
  assert.doesNotMatch(motor, /firebase|from 'react'|\beval\(|new Function/u);
  // O texto das regras não prende o sistema a um modelo de escala: o limite é só um valor.
  assert.doesNotMatch(padrao, /6x1|6X1/u);
  // Os valores vêm das MESMAS constantes do motor antigo (a equivalência é testada em lib/regrasEscala.test.ts).
  assert.match(padrao, /LIMITE_DIAS_CONSECUTIVOS_TRABALHO/);
  assert.match(padrao, /MINIMO_DESCANSO_APOS_FOLGA_HORAS/);
});

test('REGRAS-ESCALA-2 — problemas da escala: painel por pessoa, célula marcada, "Ver na escala" e prévia antes de confirmar', async () => {
  const [dashboard, revisao, grade, painel] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'), ler('components/ScheduleImportReview.tsx'), ler('components/ScheduleGrid.tsx'), ler('apps/dashboard/src/PainelProblemasEscala.tsx'),
  ]);
  // Um único ponto para trocar as regras em vigor; o motor novo alimenta painel, células e prévia.
  assert.match(dashboard, /const regrasEmVigor = useMemo<readonly RegraEscala\[\]>\(\s*\(\) => \[\.\.\.REGRAS_PADRAO, \.\.\.regrasSalvas\.filter\(\(regra\) => regra\.ativa\)\]/);
  assert.match(dashboard, /avaliarRegras\(documentos, catalogo, regrasEmVigor, \{ nomePorLogin: nomePorLoginRegras \}\)/);
  // As TRÊS telas de grade recebem as mensagens das regras (nenhuma ficou com texto de limite fixo).
  assert.equal((dashboard.match(/problemasPorCelula=\{problemasPorCelula\}/g) ?? []).length, 3);
  assert.equal((dashboard.match(/<PainelProblemasEscala alertas=\{problemasDaEscala\}/g) ?? []).length, 3, 'painel nas duas revisões e na Grade da equipe (ScheduleGrid)');
  // Prévia: o modal de escolha chama solicitarEdicaoCelula; só "Aplicar mesmo assim" chama editarCelula depois do aviso.
  assert.match(dashboard, /onClick=\{\(\) => solicitarEdicaoCelula\(tipo\.codigo, turno\.codigo\)\}/);
  assert.match(dashboard, /const \{ novos, resolvidos \} = diferencaDeProblemas\(antes, depois\);/);
  assert.match(dashboard, /Aplicar mesmo assim/);
  // editarCelula e a prévia usam o MESMO cálculo (o que se mostra é o que será aplicado).
  assert.equal((dashboard.match(/montarEdicaoCelula\(codigo, turnoHoraExtra\)/g) ?? []).length, 2);
  // O texto de limite fixo só sobrevive como reserva quando as regras não foram informadas.
  assert.match(revisao, /sequenciaCritica && problemasPorCelula === undefined/);
  assert.match(grade, /const avisos = problemasPorCelula !== undefined/);
  // Foco por propriedade (sem setState em efeito): o efeito só rola até a célula.
  assert.match(revisao, /celula\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'center', inline: 'center' \}\);/);
  assert.match(painel, /onVerNaEscala\(alerta\)/);
});

test('REGRAS-ESCALA-3 — construtor SE/ENTÃO: testa sem gravar; regras em teste só na tela; legal vira cópia da empresa', async () => {
  const [painel, construtor, exemplos] = await Promise.all([
    ler('apps/dashboard/src/AdminRegrasPage.tsx'), ler('apps/dashboard/src/ConstrutorRegra.tsx'), ler('lib/regrasAssistente.ts'),
  ]);
  // Nada é gravado nesta etapa: nem o construtor nem o painel falam com Firebase.
  assert.doesNotMatch(construtor, /firebase|setDoc|updateDoc|localStorage/iu);
  assert.doesNotMatch(painel, /firebase|setDoc|updateDoc|localStorage/iu);
  // O teste usa o mesmo motor que vale na escala, sobre as escalas já carregadas.
  assert.match(construtor, /testarRegra\(regra, documentos, catalogo, \{ nomePorLogin \}\)/);
  // "Manter em teste" só com a regra válida; regras em teste ficam em estado local do painel.
  assert.match(construtor, /disabled=\{falta\.length > 0 \|\| salvando\} onClick=\{\(\) => onManterEmTeste\(regra\)\}/);
  assert.match(painel, /const \[emTeste, setEmTeste\] = useState<RegraEscala\[\]>\(\[\]\);/);
  // Regra legal nunca é editada: o detalhe só oferece uma versão (cópia da empresa) mais rígida.
  assert.match(painel, /copiarComoRascunho\(aberta, gerarIdRegraEmTeste\(\)\)/);
  // As situações do assistente não prendem o sistema a um modelo de escala (o nome do modelo é do administrador).
  assert.doesNotMatch(exemplos, /6x1|6X1/u);
  // O campo da mensagem usa handler estável (sem ref lido dentro do map — React Compiler).
  assert.match(construtor, /function inserirCampo\(evento: MouseEvent<HTMLButtonElement>\)/);
});

test('REGRAS-ESCALA-4 — regras salvas valem de verdade: um motor para tudo, bloqueio de publicação, só o administrador grava', async () => {
  const [dashboard, painel, construtor, repositorio, rules, persistencia] = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/src/AdminRegrasPage.tsx'), ler('apps/dashboard/src/ConstrutorRegra.tsx'),
    ler('lib/firebase/regrasEscalaRepository.ts'), ler('firestore.rules'), ler('lib/regrasPersistencia.ts'),
  ]);
  // UM motor: sino, alertas, contadores de outras escalas, células e prévia usam as regras em vigor.
  assert.equal((dashboard.match(/avaliarRegras\(/g) ?? []).length >= 5, true, 'escala aberta, 2 contadores de outras escalas e as 2 pontas da prévia');
  assert.match(dashboard, /alertas=\{problemasDaEscala\}/);
  assert.match(dashboard, /alertas: AlertaRegra\[\];/);
  // Bloqueio: a regra marcada impede publicar (função e botão) e a justificativa não libera.
  assert.match(dashboard, /const publicacaoBloqueadaPorRegra = bloqueiaPublicacaoPorRegra\(problemasDaEscala\);/);
  assert.match(dashboard, /if \(publicacaoBloqueadaPorRegra\) \{\s*setErroPublicacao\(/);
  assert.match(dashboard, /disabled=\{processando \|\| publicacaoBloqueadaPorRegra \|\|/);
  // Qualquer liderança LÊ (assinatura no login); o painel e o construtor nunca falam com o Firestore.
  assert.match(dashboard, /observarRegrasEscala\(/);
  assert.doesNotMatch(painel, /firebase|setDoc|updateDoc|deleteDoc/iu);
  assert.doesNotMatch(construtor, /firebase|setDoc|updateDoc|deleteDoc/iu);
  // O repositório só grava com a escrita administrativa habilitada e só regra válida.
  assert.equal((repositorio.match(/exigirEscritaAdministrativaHabilitada\(\);/g) ?? []).length, 3);
  assert.match(repositorio, /errosParaSalvar\(regra\)/);
  assert.match(persistencia, /categoria: 'EMPRESA'/);
  // Rules: leitura de autenticado; criar, editar e excluir só ADMIN_SISTEMA; legal nunca gravada.
  const bloco = /match \/regrasEscala\/\{regraId\} \{([\s\S]*?)\n    \}/u.exec(rules)?.[1] ?? '';
  assert.match(bloco, /allow read: if autenticado\(\);/);
  assert.match(bloco, /allow create: if souAdminSistema\(\)/);
  assert.match(bloco, /allow update: if souAdminSistema\(\)/);
  assert.match(bloco, /allow delete: if souAdminSistema\(\);/);
  assert.match(rules, /dados\.categoria == 'EMPRESA'/);
});

test('VERSAO-1 — a versão do App e a do Dashboard são as da primeira seção do respectivo CHANGELOG, e o Dashboard a mostra no menu', async () => {
  const [pacoteApp, pacoteDash, changelogApp, changelogDash, frame, dashboard, vite] = await Promise.all([
    ler('apps/app/package.json'), ler('apps/dashboard/package.json'), ler('CHANGELOG.md'), ler('CHANGELOG-DASHBOARD.md'),
    ler('components/AppFrame.tsx'), ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/dashboard/vite.config.ts'),
  ]);
  const primeira = (texto) => /^## (\d+\.\d+\.\d+)\b/mu.exec(texto)?.[1];
  const versaoApp = JSON.parse(pacoteApp).version;
  const versaoDash = JSON.parse(pacoteDash).version;
  // Esqueceu de subir o número (ou de registrar a entrega)? Este teste falha — é a trava contra o esquecimento.
  assert.equal(primeira(changelogApp), versaoApp, `CHANGELOG.md começa em ${primeira(changelogApp)}, mas apps/app/package.json está em ${versaoApp}`);
  assert.equal(primeira(changelogDash), versaoDash, `CHANGELOG-DASHBOARD.md começa em ${primeira(changelogDash)}, mas apps/dashboard/package.json está em ${versaoDash}`);
  // O Dashboard mostra a versão no rodapé do menu e publica /versao.json.
  assert.match(dashboard, /versaoTexto=\{`Dashboard \$\{numeroVersaoDashboard\(\)\}`\}/);
  assert.match(frame, /className="sidebar-versao"/);
  assert.match(vite, /fileName: 'versao\.json'/);
  assert.match(vite, /__VERSAO_DASHBOARD__: JSON\.stringify\(versao\)/);
});

test('ASSISTENTE-REGRAS-1 — criar regra em 3 passos: sem termos técnicos à vista, efeito ao vivo, modo avançado por link, nada grava sozinho', async () => {
  const [assistente, painel, lib] = await Promise.all([
    ler('apps/dashboard/src/AssistenteRegra.tsx'), ler('apps/dashboard/src/AdminRegrasPage.tsx'), ler('lib/regrasAssistente.ts'),
  ]);
  // "Nova regra" abre o passo a passo; o construtor SE/ENTÃO só por "Preciso de algo diferente"/"Ajustes avançados".
  assert.match(painel, /setAssistente\(\{ id: gerarIdRegraEmTeste\(\), estado: null, jaSalva: false \}\)/);
  assert.match(assistente, /onAvancado\(novaRegraEmBranco\(idRegra\)\)/);
  assert.match(assistente, /onAvancado\(regra\)/);
  // Editar escolhe sozinho: o desenho de uma situação reabre no passo a passo; o resto, no avançado.
  assert.match(painel, /const estado = lerEstadoDaRegra\(regra\);\s*if \(estado !== null\) setAssistente\(/);
  // O efeito é calculado ao vivo pelo mesmo motor (sem botão de testar).
  assert.match(assistente, /testarRegra\(regra, documentos, catalogo, \{ nomePorLogin \}\)/);
  // Nada de termos do motor no que a pessoa lê: texto dentro das telas (JSX) e rótulos entre aspas.
  const semComentarios = assistente.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
  const textosJsx = [...semComentarios.matchAll(/>([^<>{}=]*[A-Za-zÀ-ú][^<>{}=]*)</gu)].map((achado) => achado[1]);
  const rotulos = [...semComentarios.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/gu)].map((achado) => achado[1]);
  const aVista = [...textosJsx, ...rotulos].join(' | ');
  assert.ok(aVista.length > 500, 'a verificação precisa enxergar os textos da tela');
  for (const jargao of ['Variável', 'variável', 'Condição', 'condição', 'Gravidade', 'gravidade', 'agrupar', 'Agrupar', 'SE ', 'ENTÃO', 'JSON']) {
    assert.ok(!aVista.includes(jargao), `termo técnico à vista na tela: ${jargao}`);
  }
  // Nunca fala com o Firestore: quem grava é a tela que o chama.
  assert.doesNotMatch(assistente, /firebase|setDoc|updateDoc|deleteDoc|localStorage/iu);
  assert.doesNotMatch(lib, /6x1|6X1|firebase|from 'react'/u);
  // Só ativa com nome e (se for por equipe) ao menos uma equipe.
  assert.match(assistente, /disabled=\{salvando \|\| precisaEquipe \|\| !nomeValido\} onClick=\{\(\) => void salvar\(\)\}/);
});

test('INFORMACOES-DIA-1 — o colaborador só lê o que foi liberado e é dele; o chefe grava pelo repositório; Rules só para quem gerencia a equipe', async () => {
  const [repositorio, hook, cartao, pagina, modal, dashboard, appJs, rules, biblioteca] = await Promise.all([
    ler('lib/firebase/informacoesDiaRepository.ts'), ler('apps/app/src/informacoes/useInformacoesDoColaborador.ts'),
    ler('apps/app/src/informacoes/InformacoesParaVoce.tsx'), ler('apps/dashboard/src/InformacoesPage.tsx'), ler('apps/dashboard/src/InformacaoModal.tsx'),
    ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/app/src/EmployeeApp.tsx'), ler('firestore.rules'), ler('lib/informacoesDia.ts'),
  ]);
  // App: a consulta pede só as DELE e só as LIBERADAS (é o que as Rules exigem), e ainda há um filtro de reforço no cliente.
  const consultaApp = /export function observarInformacoesDoColaborador[\s\S]*?\n\}/u.exec(repositorio)?.[0] ?? '';
  assert.match(consultaApp, /where\('login', '==', login\)/);
  assert.match(consultaApp, /where\('visivelParaColaborador', '==', true\)/);
  assert.match(appJs, /paraOColaborador\(informacoesLiberadasApp, loginUsuario, dataHoje\)/);
  assert.match(hook, /if \(!listenersLiberados \|\| login === null\) return undefined;/);
  // O App nunca grava nem apaga informação.
  for (const fonte of [hook, cartao]) assert.doesNotMatch(fonte, /salvarInformacao|excluirInformacao|setDoc|deleteDoc/u);
  assert.doesNotMatch(appJs, /salvarInformacao|excluirInformacao/u);
  // Dashboard: grava e apaga só pelo repositório; no modo demonstração fica na memória. Uma assinatura por equipe (sem consulta "in").
  assert.match(pagina, /await salvarInformacao\(documento\)/);
  assert.match(pagina, /await excluirInformacao\(informacao\.id\)/);
  assert.doesNotMatch(`${pagina}${modal}`, /setDoc|deleteDoc|localStorage/u);
  assert.doesNotMatch(repositorio, /where\('equipeId', 'in'/u);
  assert.match(dashboard, /\{ id: 'informacoes', rotulo: 'Informações', icone: 'notas' \}/);
  // A visibilidade começa DESLIGADA (só a liderança vê até alguém liberar).
  assert.match(biblioteca, /titulo: '', observacao: '', visivelParaColaborador: false, \.\.\.base/);
  // Rules: leitura = chefe da equipe OU (dono da informação E liberada); escrita só quem gerencia a equipe; sem forjar autor.
  const bloco = /match \/informacoesDia\/\{informacaoId\} \{([\s\S]*?)\n    \}/u.exec(rules)?.[1] ?? '';
  assert.match(bloco, /podeGerirInformacoesDaEquipe\(resource\.data\.equipeId\)\s*\|\|\s*\(resource\.data\.login == loginDoAuth\(\) && resource\.data\.visivelParaColaborador == true\)/);
  assert.match(bloco, /allow create: if podeGerirInformacoesDaEquipe\(request\.resource\.data\.equipeId\)/);
  assert.match(bloco, /request\.resource\.data\.criadoPorLogin == loginDoAuth\(\)/);
  assert.match(bloco, /usuarios\/\$\(request\.resource\.data\.login\)\)\.data\.get\('equipeId', null\) == request\.resource\.data\.equipeId/);
  assert.match(bloco, /allow delete: if podeGerirInformacoesDaEquipe\(resource\.data\.equipeId\);/);
});

test('INFORMACOES-DIA-1 (grade) — os marcadores são só da liderança: o App não os passa e a grade só os desenha se vierem de fora', async () => {
  const [grade, dashboard, appJs, hook] = await Promise.all([
    ler('components/ScheduleGrid.tsx'), ler('apps/dashboard/src/DashboardApp.tsx'), ler('apps/app/src/EmployeeApp.tsx'), ler('apps/dashboard/src/useInformacoesDaEquipe.ts'),
  ]);
  // A ScheduleGrid é compartilhada: o marcador é uma prop opcional, desenhada só quando informada.
  assert.match(grade, /marcadoresPorCelula\?: Map<string, MarcadorCelula>;/);
  assert.match(grade, /\{marcador && \(\s*<span className="shift-marcador"/);
  // O App nunca passa marcadores (informação reservada não pode vazar para a grade do colaborador).
  assert.doesNotMatch(appJs, /marcadoresPorCelula|marcadoresGrade/u);
  // Só a "Grade da equipe" do Dashboard recebe os marcadores, vindos da consulta da equipe (ou dos exemplos da demonstração).
  assert.equal((dashboard.match(/marcadoresPorCelula=\{marcadoresGrade\}/g) ?? []).length, 1);
  assert.match(dashboard, /useInformacoesDaEquipe\(\{ equipeId: equipeDaGrade, desdeIso: inicioDaGrade, demo: exemplosInformacoesGrade \}\)/);
  // Consulta negada (quem só consulta a escala) = sem marcadores, nunca erro na tela.
  assert.match(hook, /observarInformacoesDaEquipe\(equipeId, desdeIso, setInformacoes, \(\) => setInformacoes\(\[\]\)\)/);
  // Aviso ao editar o dia e legenda.
  assert.match(dashboard, /Esta pessoa tem \{doDiaDaPessoa\.length === 1/);
  assert.match(dashboard, /\{marcadoresGrade\.size > 0 && \(\s*<p className="legenda-informacoes">/);
});

test('SEGURANCA-1 — impressão sem HTML cru, sem código morto que confia em cabeçalhos, e auditoria de contas somente leitura', async () => {
  const [dashboard, escapar, auditoria] = await Promise.all([ler('apps/dashboard/src/DashboardApp.tsx'), ler('lib/escaparHtml.ts'), ler('scripts/staging/auditar-contas-auth.mjs')]);
  // Nenhum document.write com texto interpolado: só o HTML já montado (e escapado) por montarHtmlImpressaoEscala.
  assert.doesNotMatch(dashboard, /document\.write\(`/u);
  assert.match(dashboard, /janela\.document\.write\(html\);/u);
  assert.match(dashboard, /montarHtmlImpressaoEscala\(\{/u);
  assert.match(escapar, /Content-Security-Policy" content="default-src 'none'/u);
  // O modelo inicial confiava em cabeçalhos "oai-authenticated-user-*": o arquivo não volta.
  await assert.rejects(ler('app/chatgpt-auth.ts'), /ENOENT/u);
  // A auditoria só LÊ: nada de criar, alterar, apagar conta ou escrever no Firestore.
  // (Map.set em memória é permitido: o que se proíbe são as escritas do Firestore e do Auth.)
  assert.doesNotMatch(auditoria, /\.(update|delete|create|add)\(|\.doc\([^)]*\)\.set\(|deleteUser|updateUser|createUser|setCustomUserClaims|revokeRefreshTokens|batch\(|runTransaction/u);
  assert.match(auditoria, /\.get\(\)/u, 'a auditoria lê o cadastro (somente leitura)');
  assert.match(auditoria, /listUsers\(1000, token\)/u);
});

test('LIDERANCA-CARGO-1 — só cargo de liderança vira liderança (tela e Rules, mesma lista); administrador sem "Minha equipe"', async () => {
  const [rules, cargoLib, colaboradores, liderancas, dashboard, sessao] = await Promise.all([
    ler('firestore.rules'), ler('lib/cargoLideranca.ts'), ler('apps/dashboard/src/ColaboradoresPage.tsx'),
    ler('apps/dashboard/src/LiderancasPage.tsx'), ler('apps/dashboard/src/DashboardApp.tsx'), ler('lib/sessao.ts'),
  ]);
  // A lista de palavras das Rules e a do código são a MESMA (um dos dois não pode "esquecer" um cargo).
  const daRegra = /cargo\.lower\(\)\.matches\('\.\*\(([^)]+)\)\.\*'\)/u.exec(rules)?.[1]?.split('|').map((palavra) => palavra.replace('l[iíÍ]der', 'lider')).sort();
  const doCodigo = /PALAVRAS_CARGO_LIDERANCA = \[([\s\S]*?)\] as const/u.exec(cargoLib)?.[1]?.match(/'([a-z]+)'/gu)?.map((palavra) => palavra.replaceAll("'", '')).sort();
  assert.ok(daRegra && doCodigo, 'listas encontradas');
  assert.deepEqual(daRegra, doCodigo);
  // Rules: promoção e cadastro de liderança nova exigem cargo de liderança.
  assert.match(rules, /&& cargoDeLideranca\(resource\.data\.get\('cargo', ''\)\)/u);
  assert.match(rules, /&& cargoDeLideranca\(request\.resource\.data\.get\('cargo', ''\)\)/u);
  // Tela: o botão só aparece para cargo de liderança; "Nova liderança" valida o cargo antes de gravar.
  assert.match(colaboradores, /pessoa\.login !== autor\.login && cargoEhDeLideranca\(pessoa\.cargo\) && \(/u);
  assert.match(liderancas, /if \(!cargoEhDeLideranca\(cargo\)\) \{ setErro\(MENSAGEM_CARGO_SEM_LIDERANCA\); return; \}/u);
  // Administrador do sistema: sem "Minha equipe"/"Sua equipe" e sem se passar por "Coordenador".
  assert.match(dashboard, /semEquipePropria=\{souAdmin\}/u);
  assert.match(colaboradores, /!semEquipePropria && pessoa\.equipeId !== ''/u);
  assert.match(sessao, /if \(perfil === 'ADMIN_SISTEMA'\) return 'Administrador do sistema';/u);
});

test('RECADOS-3 — limite no servidor (mesmo número do código), só os envolvidos leem, cada um escreve só a própria resposta, envio por três caminhos e texto sempre como texto', async () => {
  const [rules, lib, repo, envio, hookApp, cartoes, nova, pagina, telaApp, appJs, dashboard, indices] = await Promise.all([
    ler('firestore.rules'), ler('lib/recados.ts'), ler('lib/firebase/recadosRepository.ts'), ler('lib/firebase/recadosEnvio.ts'), ler('apps/app/src/recados/useRecados.ts'),
    ler('components/RecadoCartoes.tsx'), ler('components/NovaMensagem.tsx'), ler('apps/dashboard/src/RecadosPage.tsx'), ler('apps/app/src/recados/RecadosTela.tsx'),
    ler('apps/app/src/EmployeeApp.tsx'), ler('apps/dashboard/src/DashboardApp.tsx'), ler('firestore.indexes.json'),
  ]);
  // O limite do código e o das Rules são o MESMO número, nos três pontos (contador, recado a pessoa, mensagem a grupo).
  const limiteCodigo = Number(/LIMITE_DIARIO_RECADOS = (\d+)/u.exec(lib)?.[1]);
  const limitesRules = [...rules.matchAll(/contagem(?:', 0\))? <= (\d+)/gu)].map((achado) => Number(achado[1]));
  assert.ok(limiteCodigo > 0 && limitesRules.length >= 3, 'limite encontrado no código e nas Rules');
  for (const limite of limitesRules) assert.equal(limite, limiteCodigo);
  assert.match(rules, /exists\(caminhoLimiteRecados\(\)\) \? get\(caminhoLimiteRecados\(\)\)\.data\.get\('contagem', 0\) \+ 1 : 1/u);
  assert.match(rules, /request\.resource\.data\.contagem == resource\.data\.contagem \+ 1/u);
  // Recado a UMA pessoa: só remetente e destinatário leem; o destinatário só responde; três caminhos para enviar.
  const pessoaBloco = /match \/recados\/\{recadoId\} \{([\s\S]*?)\n    \}\n/u.exec(rules)?.[1] ?? '';
  assert.match(pessoaBloco, /allow read: if autenticado\(\)\s*&& \(resource\.data\.remetenteLogin == loginDoAuth\(\) \|\| resource\.data\.destinatarioLogin == loginDoAuth\(\)\);/u);
  assert.match(pessoaBloco, /affectedKeys\(\)\.hasOnly\(\['status', 'resposta', 'respondidoEm', 'expiraEm'\]\)/u);
  assert.match(pessoaBloco, /podeGerirInformacoesDaEquipe\(request\.resource\.data\.equipeId\)/u);
  assert.match(pessoaBloco, /participanteAtivoDoGrupoPlantao\(request\.resource\.data\.grupoPlantaoId, request\.resource\.data\.destinatarioLogin\)/u);
  assert.match(pessoaBloco, /usuarios\/\$\(request\.resource\.data\.destinatarioLogin\)\)\.data\.get\('equipeId', null\) == request\.resource\.data\.equipeId/u);
  // Mensagem a um GRUPO: leem o remetente e os integrantes; cada integrante escreve SÓ a própria resposta, UMA vez; só o remetente apaga.
  const grupoBloco = /match \/recadosGrupo\/\{recadoId\} \{([\s\S]*?)\n    \}\n/u.exec(rules)?.[1] ?? '';
  assert.match(grupoBloco, /allow read: if autenticado\(\)\s*&& \(resource\.data\.remetenteLogin == loginDoAuth\(\) \|\| souDoAlvoDoRecadoGrupo\(resource\.data\)\);/u);
  assert.match(grupoBloco, /!\(loginDoAuth\(\) in resource\.data\.respostas\)/u);
  assert.match(grupoBloco, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['respostas'\]\)/u);
  assert.match(grupoBloco, /respostas\.diff\(resource\.data\.respostas\)\.affectedKeys\(\)\.hasOnly\(\[loginDoAuth\(\)\]\)/u);
  assert.match(grupoBloco, /allow delete: if autenticado\(\) && resource\.data\.remetenteLogin == loginDoAuth\(\);/u);
  assert.match(grupoBloco, /podeGerirInformacoesDaEquipe\(request\.resource\.data\.alvoId\)/u);
  assert.match(grupoBloco, /participanteAtivoDoGrupoPlantao\(request\.resource\.data\.alvoId, loginDoAuth\(\)\)/u);
  assert.match(grupoBloco, /podeAdministrarEscalaPlantao\(request\.resource\.data\.alvoId\)/u);
  assert.match(grupoBloco, /getAfter\(caminhoLimiteRecados\(\)\)\.data\.get\('contagem', 0\)/u);
  assert.match(rules, /\(dados\.status == 'ENVIADO' \? dados\.resposta == '' : dados\.resposta\.size\(\) >= 1\)/u);
  // O envio é um só (App e Dashboard): pessoa -> recado dela; cada grupo -> UMA mensagem; sempre recado + contador no mesmo lote.
  assert.match(envio, /enviarRecado\(montarRecado\(entrada, destino\.pessoa, remetente/u);
  assert.match(envio, /enviarRecadoGrupo\(montarRecadoGrupo\(entrada, alvo, remetente/u);
  assert.match(repo, /const lote = writeBatch\(db\);/u);
  assert.match(hookApp, /await enviarMensagem\(entrada, \{ login, nome \}\)/u);
  assert.match(pagina, /await enviarMensagem\(entrada, remetente\)/u);
  assert.match(repo, /new FieldPath\('respostas', login\)/u);
  // O App só recebe dos grupos DELE (a equipe e o Plantão em que participa) e só oferece esses destinos.
  assert.match(hookApp, /observarRecadosGrupoDoAlvo\('EQUIPE', equipeId/u);
  assert.match(hookApp, /observarRecadosGrupoDoAlvo\('PLANTAO', plantaoId/u);
  assert.match(appJs, /colega\.equipeId !== usuario\.equipeId/u);
  assert.match(appJs, /return grupo && euParticipo \? grupo : null;/u);
  // Texto sempre como TEXTO: nenhuma tela transforma a mensagem em HTML.
  for (const fonte of [pagina, nova, cartoes, telaApp]) assert.doesNotMatch(fonte, /dangerouslySetInnerHTML|innerHTML|document\.write/u);
  // Consultas por igualdade (sem "in"), como as Rules avaliam.
  assert.match(repo, /where\('remetenteLogin', '==', login\)/u);
  assert.match(repo, /where\('alvoTipo', '==', tipo\), where\('alvoId', '==', alvoId\)/u);
  assert.doesNotMatch(repo, /, 'in', /u);
  // NÃO pode haver TTL no arquivo de índices: o TTL do Firestore exige o plano pago e derrubava a publicação (HTTP 403 billing disabled).
  assert.ok(JSON.parse(indices).fieldOverrides.every((item) => item.ttl !== true), 'sem ttl:true nos índices — a limpeza é do worker');
  // Os dois menus se chamam "Mensagens"; a bolinha é da aba Mensagens.
  assert.match(dashboard, /\{ id: 'recados', rotulo: 'Mensagens', icone: 'recados' \}/u);
  assert.match(appJs, /\{ id: 'recados', rotulo: 'Mensagens', icone: 'recados' \}/u);
  assert.match(appJs, /item\.id === 'recados' \? \{ \.\.\.item, contador: recadosApp\.atencao \} : item/u);
});

test('RECADOS-3 (push) — os avisos são genéricos e únicos (pessoa, grupo e resposta), o clique abre o App, a data de ativação é Timestamp e o worker tem versão e changelog', async () => {
  const [sinos, pacoteWorker, changelogWorker, frame, sw] = await Promise.all([
    ler('apps/push-worker/src/outrosSinos.ts'), ler('apps/push-worker/package.json'), ler('CHANGELOG-PUSH-WORKER.md'),
    ler('components/AppFrame.tsx'), ler('apps/app/src/sw/pushClickRouting.js'),
  ]);
  // Os textos são FIXOS: as funções dos textos nem leem campos do recado (nome de quem enviou, conteúdo, resposta).
  for (const nome of ['textoRecado', 'textoRespostaRecado']) {
    const funcao = new RegExp(`export function ${nome}[\\s\\S]*?\\n\\}`, 'u').exec(sinos)?.[0] ?? '';
    assert.ok(funcao.length > 0, nome);
    assert.doesNotMatch(funcao, /dados\.|remetente|\.texto|nome\b/u, `${nome} lê campo do recado`);
  }
  // Pessoa: avisa o DESTINATÁRIO (sem resposta, não vencido) e, na resposta, o REMETENTE. Grupo: avisa os integrantes e, na 1ª resposta, o remetente.
  assert.match(sinos, /if \(dados\.status !== 'ENVIADO'\) return null;/u);
  assert.match(sinos, /if \(dados\.status !== 'RESPONDIDO'\) return null;/u);
  assert.match(sinos, /if \(expira !== null && expira <= agoraMs\) return null;/u);
  assert.match(sinos, /Object\.keys\(dados\.respostas as object\)\.length === 0\) return null;/u);
  // Escuta com TIMESTAMP (texto nunca casaria), só o que é novo, uma vez cada (RC_, RR_, RG_<id>_<login>, RGR_), e a rota é "recados".
  assert.match(sinos, /\.collection\('recados'\)\s*\.where\('criadoEm', '>=', inicioDeAtivacao\(config\.pushActivatedAt\)\)/u);
  assert.match(sinos, /\.collection\('recados'\)\s*\.where\('respondidoEm', '>=', inicioDeAtivacao\(config\.pushActivatedAt\)\)/u);
  assert.match(sinos, /\.collection\('recadosGrupo'\)\s*\.where\('criadoEm', '>=', inicioDeAtivacao\(config\.pushActivatedAt\)\)/u);
  assert.match(sinos, /Timestamp\.fromDate\(new Date\(pushActivatedAt\)\)/u);
  assert.match(sinos, /enviarUmaVez\(`RC_\$\{mudanca\.doc\.id\}`, decisao\.login, 'RECADO', decisao\.texto, 'recados'\)/u);
  assert.match(sinos, /enviarUmaVez\(`RR_\$\{mudanca\.doc\.id\}`, decisao\.login, 'RECADO_RESPONDIDO', decisao\.texto, 'recados'\)/u);
  assert.match(sinos, /enviarUmaVez\(`RG_\$\{mudanca\.doc\.id\}_\$\{login\}`, login, 'RECADO', textoRecado\(\), 'recados'\)/u);
  assert.match(sinos, /enviarUmaVez\(`RGR_\$\{mudanca\.doc\.id\}`, resposta\.login, 'RECADO_RESPONDIDO', resposta\.texto, 'recados'\)/u);
  assert.match(sinos, /if \(login !== grupo\.remetenteLogin\)/u);
  // Sem isto o toque no aviso não fazia nada (tipo desconhecido = "sem destino"): o prefixo RECADO abre o App.
  assert.match(sw, /PREFIXOS_ABRIR_APP = \[[^\]]*'RECADO'/u);
  // O worker tem versão e changelog próprios, alinhados; o contador do menu é opcional no AppFrame (compartilhado).
  assert.equal(/^## (\d+\.\d+\.\d+)/mu.exec(changelogWorker)?.[1], JSON.parse(pacoteWorker).version, 'versão do worker = primeira seção do CHANGELOG-PUSH-WORKER.md');
  assert.match(frame, /contador\?: number;/u);
});

test('REGRAS-LIMITE-1 — a checagem do cargo é a ÚLTIMA condição da promoção (limite de 1000 expressões por regra no Firestore)', async () => {
  const rules = await ler('firestore.rules');
  const ini = rules.indexOf('LIDERANCAS-1 — uma liderança torna outra pessoa liderança');
  const fim = rules.indexOf('// Na importação da Jornada', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco da promoção encontrado');
  const promocao = rules.slice(ini, fim);
  const cargo = promocao.indexOf('cargoDeLideranca(');
  const estrutura = promocao.indexOf(".hasOnly(['perfil', 'nivelHierarquico', 'promovidoPorLogin', 'promovidoEm', 'atualizadoEm'])");
  assert.ok(cargo > 0 && estrutura > 0, 'cargo e estrutura encontrados');
  // Antes do cargo: todas as condições baratas que descartam uma atualização que NÃO é promoção (ex.: transferir de equipe).
  assert.ok(cargo > estrutura, 'cargoDeLideranca() vem DEPOIS de affectedKeys().hasOnly([...]) — se voltar para o começo, a transferência de equipe estoura as 1000 expressões');
  // (O cadastro de liderança nova é a ÚLTIMA alternativa do `allow create` — só é avaliada se as outras recusarem —, então o
  // cargo ali não pesa em atualizações; a estrutura dessa alternativa é conferida no teste LIDERANCAS-2.)
});

test('RECADOS-3 (limpeza) — o worker apaga o que venceu (as duas coleções e os contadores antigos), em lotes, e a limpeza é iniciada e parada com o worker', async () => {
  const [limpeza, indexWorker] = await Promise.all([ler('apps/push-worker/src/limpezaRecados.ts'), ler('apps/push-worker/src/index.ts')]);
  assert.match(limpeza, /COLECOES_COM_VALIDADE = \['recados', 'recadosGrupo'\] as const/u);
  assert.match(limpeza, /db\.collection\(colecao\)\.where\(campo, operador, valor\)\.limit\(TAMANHO_DO_LOTE\)/u);
  assert.match(limpeza, /apagarEmLotes\(db, colecao, 'expiraEm', '<=', limite\)/u);
  assert.match(limpeza, /apagarEmLotes\(db, 'recadosLimite', 'dia', '<', diaDeCorteDosContadores\(agora\)\)/u);
  // teto de rodadas: a limpeza nunca fica presa num laço
  assert.match(limpeza, /rodada < MAXIMO_DE_LOTES/u);
  // iniciada com o worker e parada no desligamento
  assert.match(indexWorker, /const pararLimpezaDeRecados = iniciarLimpezaDeRecados\(\{ db \}\);/u);
  assert.match(indexWorker, /pararLimpezaDeRecados\(\);\s*process\.exit\(0\);/u);
});

test('INFORMACOES-MODAL-2 — a janela "Nova informação" tem layout próprio (largo, duas colunas, compacto em tela baixa, uma coluna no celular) e não mexe nas janelas que dividem o estilo antigo', async () => {
  const [modal, css] = await Promise.all([ler('apps/dashboard/src/InformacaoModal.tsx'), ler('app/globals.css')]);
  assert.match(modal, /className="edit-modal ninfo"/u);
  assert.match(modal, /className="ninfo-esq"/u);
  assert.match(modal, /className="ninfo-dir"/u);
  // o erro mora no rodapé (a janela não cresce quando ele aparece)
  assert.match(modal, /<p className="ninfo-erro" role="alert">\{erroNoRodape\}<\/p>/u);
  assert.doesNotMatch(modal, /dangerouslySetInnerHTML|innerHTML|document\.write|setDoc|deleteDoc|localStorage/u);
  // largura e altura da janela
  assert.match(css, /\.ninfo \{[^}]*width: min\(980px, calc\(100vw - 48px\)\); max-height: calc\(100vh - 32px\)/u);
  // telas baixas: modo compacto; telas estreitas: uma coluna
  const compacto = /@media \(max-height: 880px\) \{([\s\S]*?)\n\}/u.exec(css)?.[1] ?? '';
  assert.match(compacto, /\.ninfo-dica \{ display: none; \}/u);
  assert.match(compacto, /\.ninfo-detalhes \{ grid-template-columns:/u);
  const estreito = /@media \(max-width: 860px\) \{\s*\.ninfo \{([\s\S]*?)\n\}/u.exec(css)?.[0] ?? '';
  assert.match(estreito, /\.ninfo-esq \{ display: contents; \}/u);
  assert.match(estreito, /\.ninfo-visib \{ order: 2;/u);
  // o estilo antigo continua para as outras janelas (Nova mensagem e assistente de regra usam .info-modal/.info-rolagem)
  assert.match(css, /\.info-modal \{ display: grid; gap: 14px; width: min\(640px/u);
  assert.match(css, /\.assistente-rolagem, \.info-rolagem \{/u);
});

test('CSS-BALANCEADO-1 — o CSS global tem o mesmo número de chaves que abrem e que fecham (uma chave sobrando derruba o build inteiro)', async () => {
  const css = (await ler('app/globals.css')).replace(/\/\*[\s\S]*?\*\//gu, '');
  const abre = (css.match(/\{/gu) ?? []).length;
  const fecha = (css.match(/\}/gu) ?? []).length;
  assert.equal(abre, fecha, `chaves abrindo (${abre}) e fechando (${fecha})`);
});

test('VIRADA-CICLO-1 — ciclo 16→15: o aviso do turno busca a janela de competências, a escala mais recente vence nas datas repetidas e publicar simulando é barrado com o motivo certo', async () => {
  const [agendador, jornada, dashboard, rules] = await Promise.all([
    ler('apps/push-worker/src/agendadorAlertas.ts'), ler('packages/contrato/src/jornada.ts'), ler('apps/dashboard/src/DashboardApp.tsx'), ler('firestore.rules'),
  ]);
  // Worker: janela (mês anterior, do calendário e seguinte) e fusão como o App — nunca a competência única da regra antiga.
  assert.match(agendador, /datas\.flatMap\(competenciasDaData\)/u);
  assert.match(agendador, /mesclarDiasDasEscalas\(escalasDaPessoa\)/u);
  assert.doesNotMatch(agendador, /competenciaDaData/u);
  // Contrato: com duas escalas cobrindo a mesma data, vale a de competência mais recente (igual a `mesclarDiasEscalas`).
  const selecionar = /export function selecionarEscalaPorData[\s\S]*?\n\}/u.exec(jornada)?.[0] ?? '';
  assert.match(selecionar, /\.sort\(\(a, b\) => b\.competencia\.localeCompare\(a\.competencia\)\)\[0\]/u);
  // Dashboard: o aviso de "simulando" vem ANTES de qualquer escrita da publicação...
  const publicar = /async function publicar\(\) \{[\s\S]*?await publicarEscalas\(/u.exec(dashboard)?.[0] ?? '';
  assert.ok(publicar.length > 0, 'função publicar encontrada');
  assert.match(publicar, /if \(simulando !== null\) \{\s*setErroPublicacao\(`Você está simulando \$\{simulando\.nome\}\. Saia da simulação para publicar/u);
  // ...porque a Regra exige que quem publica seja a conta logada de verdade (é o que a simulação quebra).
  assert.match(rules, /request\.resource\.data\.publicadoPor == loginDoAuth\(\)/u);
});
