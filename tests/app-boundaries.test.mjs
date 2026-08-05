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

  for (const proibido of [
    'writeRepository',
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
  assert.match(app, /className="today-hero"[\s\S]*data-code=\{turnoDestaque\?\.codigo/);
  assert.match(app, /className="panel next-shift-card" data-code=\{turno\?\.codigo/);
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
  assert.match(dashboard, /Histórico de publicações/);
  assert.match(dashboard, /Criar rollback/);
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
  assert.match(dashboard, /novoUsuario\(usuarios\.length \+ indice \+ 1, usuario, login, true\)/);
  assert.match(dashboard, /salvarUsuarios\(novos\)/);
  assert.match(dashboard, /!resultado\?\.ok/);
  assert.match(app, /autenticado\.equipeId/);
  assert.match(leitura, /where\('equipeId', '==', equipeId\)/);
  assert.match(usuarios, /equipeId: gestor\.equipeId/);
  assert.match(escrita, /idDocumento\(documento\.equipeId, documento\.usuarioUid/);
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
  assert.match(app, /\[competenciaAtiva, equipeUsuario, listenersLiberados, usuarioUid\]/);
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
  assert.match(dashboard, /uidAutenticacao/);
  assert.match(dashboard, /novoUsuario\(usuarios\.length \+ indice \+ 1, usuario, login, true\)/);

  // Contrato de usuário estendido e regra de edição pelo gestor da própria equipe.
  assert.match(modelos, /aliasesPlanilha/);
  assert.match(modelos, /pendenteVinculo/);
  assert.match(modelos, /StatusConciliacao/);
  assert.match(regras, /souGestor\(\)[\s\S]*resource\.data\.equipeId == minhaEquipe\(\)[\s\S]*request\.resource\.data\.equipeId == resource\.data\.equipeId[\s\S]*request\.resource\.data\.uid == resource\.data\.uid/);
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
  assert.match(dashboard, /gerarAlertasEscala/);
  assert.match(dashboard, /construirIndiceAlertasGrade/);
  assert.match(dashboard, /AlertasOperacionaisBell/);
  assert.match(scheduleGrid, /grade-alert-sequencia/);
  assert.match(scheduleGrid, /grade-alert-descanso/);
  assert.doesNotMatch(fontePublica, /alertasEscala|gerarAlertasEscala|AlertasOperacionaisBell/);
});

test('a fase 3K-D2C corrige o vínculo entre o UID do Authentication e usuarios/{uid}', async () => {
  const [app, login, authRepo, writeRepo, dashboard, modelos] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('components/LoginPanel.tsx'),
    ler('lib/firebase/authRepository.ts'),
    ler('lib/firebase/writeRepository.ts'),
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('lib/modelos.ts'),
  ]);
  const fontePublica = `${app}\n${login}`;

  // O App não importa a escrita administrativa que corrige o vínculo.
  assert.doesNotMatch(fontePublica, /vincularUsuarioAoUid/);

  // authRepository resolve por doc ID real e diferencia sem-perfil de inativo.
  assert.match(authRepo, /MENSAGEM_SEM_PERFIL_FIRESTORE/);
  assert.match(authRepo, /MENSAGEM_PERFIL_INATIVO/);
  assert.match(authRepo, /resolverUsuarioAutenticado/);
  assert.equal(
    authRepo.match(/não está cadastrado no Firestore/g)?.length,
    1,
    'a mensagem de perfil ausente deve existir uma única vez, na constante compartilhada',
  );

  // writeRepository cria o documento correto e nunca apaga o antigo.
  assert.match(writeRepo, /export async function vincularUsuarioAoUid/);
  assert.doesNotMatch(writeRepo, /vincularUsuarioAoUid[\s\S]{0,900}deleteDoc/);
  assert.match(writeRepo, /substituidoPorUid: uidNovoLimpo/);

  // Contrato e Dashboard: campo novo e ação de vincular.
  assert.match(modelos, /substituidoPorUid/);
  assert.match(dashboard, /abrirVincularUid/);
  assert.match(dashboard, /confirmarVincularUid/);
});
