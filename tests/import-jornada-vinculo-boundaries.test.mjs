import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * JORNADA-IMPORTACAO-VINCULOS-UX-1 — a importação de Jornada/6x1 tinha
 * alertas/"Revisar"/colaborador importado puramente decorativos (nenhum
 * onClick), e a tabela de conciliação (associar/criar/alias/ignorar) só
 * aparecia na tela `'importar'`, nunca na tela `'grade'` (o destino real do
 * wizard de Jornada) — ver `docs/spec/EDITOR_ESCALAS.md`. Estes testes
 * travam a correção como boundary de texto (sem infraestrutura de DOM no
 * projeto) — por isso preferem `includes()` a regex sempre que o trecho tem
 * chaves de JSX/template literal, que exigiriam escapar cada `{`/`}`.
 */

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('1/10. contador de alertas é um botão real, não decoração morta', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes("className={`soc-import-review-metric soc-import-review-metric-button ${alertasOperacionais.length > 0 ? 'has-alerts' : ''}`}"));
  assert.ok(review.includes('onClick={rolarParaPendencias}'));
  assert.ok(!review.includes("<div className={`soc-import-review-metric ${alertasOperacionais.length > 0 ? 'has-alerts' : ''}`}>"));
});

test('2/10. "Revisar pendências" e a badge "Revisão necessária" abrem a mesma área de pendências', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes('function rolarParaPendencias()'));
  assert.ok(review.includes('pendenciasSecaoRef.current?.scrollIntoView'));
  assert.ok(review.includes('Revisar pendências'));
  assert.ok(review.includes('className="status-badge warning status-badge-clickable" onClick={rolarParaPendencias}'));
  // A badge "Revisão necessária" no cabeçalho agora é <button>, não <span> estático.
  assert.ok(!review.includes("<span className={`status-badge ${resultado.ok ? 'success' : 'warning'}`}>"));
});

test('3/10. colaborador importado na lista lateral é acionável (role=button + onClick)', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes("role={linha ? 'button' : undefined}"));
  assert.ok(review.includes('onClick={linha ? () => setChavePendenciaSelecionada(linha.nomePlanilha) : undefined}'));
});

test('4/10. colaborador pendente mostra status visual (badge vinculado/pendente/sugestão/conflito)', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes("STATUS_CONCILIACAO_LABEL_CURTO: Record<LinhaConciliacao['status'], string>"));
  assert.ok(review.includes("className={`status-badge compact ${statusConciliacaoResolvido(linha.status) ? 'success' : 'warning'}`}"));
});

test('5/10. modal "Vincular colaborador importado" mostra o nome como veio da planilha, iniciais, turnos e status', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes('Vincular colaborador importado'));
  assert.ok(review.includes('<h2 id="vinculo-importado-title">{nomeCurto(pendenciaSelecionada.nomePlanilha)} · {pendenciaSelecionada.nomePlanilha}</h2>'));
  assert.ok(review.includes("Turnos importados: {turnosImportadosDaLinha(pendenciaSelecionada).join(', ') || '—'}"));
});

test('6/10. lista de pendências mostra colaboradores não vinculados e permanece visível fora da tela "importar"', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(review.includes('Pendências e vínculos'));
  assert.ok(review.includes('linhasConciliacao.map((linha) => {'));
  // A tabela agora mora dentro do componente reutilizado nas duas telas —
  // não existe mais um bloco `conciliation-panel` duplicado em DashboardApp.tsx.
  assert.ok(!dashboard.includes('conciliation-panel'));
  assert.ok(dashboard.includes('linhasConciliacao={linhasConciliacao}\n                escritaBloqueada={escritaBloqueada}\n                onSelecionarVinculo={selecionarVinculoConciliacao}'));
  assert.ok(dashboard.includes('linhasConciliacao={linhasConciliacao}\n              escritaBloqueada={escritaBloqueada}\n              onSelecionarVinculo={selecionarVinculoConciliacao}'));
});

test('7/10. alertas de conciliação somem da contagem assim que a linha é resolvida (reaproveita conciliacaoUsuarios)', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes('for (const linha of linhasConciliacao) {\n      if (statusConciliacaoResolvido(linha.status)) continue;'));
  assert.ok(review.includes("import { contarPendenciasConciliacao } from '@/lib/conciliacaoUsuarios';"));
});

test('8/10. "Criar usuário" a partir de uma pendência pré-preenche nome e alias vindos da planilha', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('function abrirCadastroUsuarioParaConciliacao(linha: LinhaConciliacao) {'));
  assert.ok(dashboard.includes('setLinhaConciliacaoVinculoCadastro(linha);'));
  assert.ok(dashboard.includes('nome: linha.nomePlanilha,'));
  assert.ok(dashboard.includes('aliasesPlanilha: [linha.nomePlanilha],'));
  // A equipe nasce da escala importada (contexto ativo), nunca da equipe do ator nem de escolha livre.
  assert.ok(dashboard.includes("linhaConciliacaoVinculoCadastro !== null\n      ? (contextoEhJornada(contextoEscalaAtivo) ? contextoEscalaAtivo.alvoId : usuarioEfetivo?.equipeId ?? '')"));
});

test('9/10. associar usuário existente permite salvar o nome da planilha como alias, com auditoria', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(review.includes('onClick={() => onSalvarAlias?.(linha)}'));
  assert.ok(review.includes('onSelecionarVinculo?.(pendenciaSelecionada, evento.target.value);'));
  assert.ok(dashboard.includes("registrarAuditoriaOperacional('ASSOCIAR_USUARIO_IMPORTACAO', escolhido.equipeId,"));
  assert.ok(dashboard.includes("registrarAuditoriaOperacional('ADICIONAR_ALIAS_IMPORTACAO', escolhido.equipeId,"));
});

test('10/10. nenhuma ação "morta" restante: ignorar pendência também audita, e a tabela não ficou duplicada', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes("registrarAuditoriaOperacional('IGNORAR_PENDENCIA_IMPORTACAO', equipeIdImportacaoJornadaAtual,"));
  assert.ok(!dashboard.includes("const STATUS_CONCILIACAO_LABEL: Record<LinhaConciliacao['status'], string>"));
});

test('auditoria da importação de Jornada carrega nomeImportado/usuarioVinculadoLogin/origem (nunca exigidos pelas Rules)', async () => {
  const repositorio = await ler('lib/firebase/auditoriaRepository.ts');
  const rules = await ler('firestore.rules');
  for (const campo of ['unidadeId', 'competencia', 'nomeImportado', 'usuarioVinculadoLogin', 'origem']) {
    assert.ok(repositorio.includes(`${campo}?: string | null;`), `esperava o campo opcional ${campo}`);
  }
  // Rules não têm allowlist de campos para auditoriaAdmin/create — os novos
  // campos opcionais nunca podem quebrar a escrita de quem já auditava antes.
  assert.ok(rules.includes("allow create: if (souAdminSistema() || souCoordenadorOperacionalStaging())\n        && request.resource.data.atorRealLogin == loginDoAuth();"));
});

test('regressão 24/25 — o vínculo de Plantão continua intacto e os helpers compartilhados não colidem com o de Jornada', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('function abrirCadastroUsuarioParaVinculo(participanteNomeOriginal: string) {'));
  assert.ok(dashboard.includes('function confirmarVinculoPlantaoAcao'));
  // O novo estado de conciliação de Jornada nunca reaproveita nem pisa no
  // estado de vínculo de Plantão — cada um some quando o outro é aberto.
  assert.ok(dashboard.includes('setParticipanteVinculoCadastro(null);\n    setLinhaConciliacaoVinculoCadastro(linha);'));
  assert.ok(dashboard.includes('setParticipanteVinculoCadastro(participanteNomeOriginal);\n    setLinhaConciliacaoVinculoCadastro(null);'));
  // O literal exato que a regressão-guarda de Plantão já checava
  // (`tests/plantao-editor-boundaries.test.mjs`, teste 36) continua intocado.
  assert.ok(dashboard.includes('equipeId: equipeIdCadastroUsuario,\n          uid: undefined,'));
});

/**
 * PATCH-CIRURGICO-JORNADA-VINCULOS-USUARIOS-1 — regressões pontuais
 * relatadas depois da fase acima: (1) "Criar usuário" da pendência abria o
 * modal antigo travado em SOC; (2) o select de equipe não filtrava pela
 * unidade escolhida (GEDSI_CODB_NOC sobrevivia com GEDSI_COSI selecionada);
 * (3) a badge "Vinculado" espremia o login/nome na lista lateral; (4) o
 * vínculo só refletia no estado local depois de um reload.
 */

test('1. "Criar usuário" da pendência usa o modo livre (select técnico), nunca mais o input disabled travado', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  // usarCadastroLivreStaging não exclui mais o fluxo de conciliação de
  // Jornada — só o vínculo de Plantão (alvo fixo pelo Grupo) continua fora.
  assert.ok(dashboard.includes("const usarCadastroLivreStaging = PERMITIR_AMPLO_STAGING\n    && !souAdmin\n    && participanteVinculoCadastro === null;"));
  assert.ok(!dashboard.includes('usarCadastroLivreStaging = PERMITIR_AMPLO_STAGING\n    && !souAdmin\n    && participanteVinculoCadastro === null\n    && linhaConciliacaoVinculoCadastro === null'));
  // Quando o modo livre está desligado, o input travado mostra o código
  // técnico (rotuloTecnicoEquipe), nunca mais o nome amigável cru ("SOC").
  assert.ok(dashboard.includes('return equipe ? rotuloTecnicoEquipe(equipe) : equipeIdCadastroUsuario;'));
});

test('2. modal da pendência pré-seleciona a unidade/equipe da escala (GEDSI_COSI/GEDSI_COSI_SOC), não abre vazio', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('const equipeIdSugerida = contextoEhJornada(contextoEscalaAtivo)\n      ? contextoEscalaAtivo.alvoId\n      : usuarioEfetivo?.equipeId ?? \'\';'));
  assert.ok(dashboard.includes('unidadeId: equipeSugerida?.unidadeId,'));
  assert.ok(dashboard.includes('equipeId: equipeIdSugerida || undefined,'));
});

test('3/4/5. select de equipe usa equipesDaUnidade() — filtra pela unidade escolhida, sem hardcode de time', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const organizacao = await ler('lib/organizacao.ts');
  assert.ok(dashboard.includes('{equipesDaUnidade(equipesAdmin, formularioUsuario.unidadeId).map((equipe) => ('));
  assert.ok(organizacao.includes('export function equipesDaUnidade<T extends Pick<Equipe, \'unidadeId\'>>('));
  assert.ok(organizacao.includes('? equipes.filter((equipe) => equipe.unidadeId === unidadeId)\n    : [...equipes];'));
});

test('6. trocar de unidade limpa a equipe incompatível e mostra "Selecione uma equipe da unidade escolhida."', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('const equipeAindaValida = novaUnidadeId === undefined\n                          || equipeAtual?.unidadeId === novaUnidadeId;'));
  assert.ok(dashboard.includes('equipeId: equipeAindaValida ? formularioUsuario.equipeId : undefined,'));
  assert.ok(dashboard.includes('Selecione uma equipe da unidade escolhida.'));
});

test('7/8/9/10. validação por tipo de acesso — só GESTOR_UNIDADE fica isento de escolher equipe', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes("usarCadastroLivreStaging\n      && cadastroNovo\n      && formularioUsuario.perfil !== 'GESTOR_UNIDADE'\n      && equipeIdCadastroUsuario.trim() === ''"));
  assert.ok(dashboard.includes("candidato.perfil === 'GESTOR_UNIDADE'\n      && (candidato.equipeId ?? '').trim() === ''"));
  // COLABORADOR (perfil ausente)/SUPERVISOR_EQUIPE/GESTOR_EQUIPE continuam
  // sujeitos ao bloqueio — a única exceção adicionada é GESTOR_UNIDADE.
  assert.ok(dashboard.includes("PERFIS_DELEGAVEIS_STAGING"));
});

test('11/12. lista lateral: login fica sozinho na 1ª linha, badge "Vinculado" é secundária na 2ª linha com o nome', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes('<span className="soc-import-review-person-copy">\n                    <strong>{documento.login}</strong>\n                    <span className="soc-import-review-person-meta">\n                      <small>{nome}</small>'));
  const globals = await ler('app/globals.css');
  assert.ok(globals.includes('.soc-import-review-person-meta { display: flex; min-width: 0; align-items: center; gap: 4px; }'));
});

test('13. após criar/vincular usuário, o estado local reflete o vínculo sem reload (mapa de login usa a lista já atualizada)', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('usuariosParaMapa: Usuario[] = usuarios) {'));
  assert.ok(dashboard.includes('? reparsear(buffer, loginParaUidComConciliacao(mapaLogins(usuariosParaMapa), linhas), opcoes)\n      : reparsear(buffer, mapaLogins(usuariosParaMapa), opcoes);'));
  assert.ok(dashboard.includes('const usuariosComVinculoAtual = usuarios.some((item) => item.login === usuarioSalvo.login)'));
  assert.ok(dashboard.includes('aplicarConciliacao(\n          arquivo,\n          linhasConciliacao.map((item) => (\n            item === linhaConciliacaoVinculoCadastro ? resolverManualmente(item, usuarioSalvo) : item\n          )),\n          {},\n          usuariosComVinculoAtual,\n        );'));
});

test('14. alertas clicáveis (fase anterior) continuam intactos', async () => {
  const review = await ler('components/ScheduleImportReview.tsx');
  assert.ok(review.includes('onClick={rolarParaPendencias}'));
  assert.ok(review.includes('function rolarParaPendencias()'));
});

test('15. nenhuma chamada de aplicarConciliacao pré-existente foi alterada (Plantão não usa esse caminho e continua fora)', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  // As 3 chamadas de conciliação de linha única continuam sem o 4º parâmetro
  // (usuarios não muda nesses fluxos, então o default do parâmetro basta).
  assert.ok(dashboard.includes("aplicarConciliacao(\n      arquivo,\n      linhasConciliacao.map((item) => (item === linha ? resolverManualmente(item, escolhido) : item)),\n    );"));
  assert.ok(dashboard.includes('function confirmarVinculoPlantaoAcao'));
});
