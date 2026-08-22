import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

// Os dois módulos puros de Plantão documentam em prosa, de propósito, o que
// NUNCA importam (mesma convenção do comentário sobre Lembretes em
// app-boundaries.test.mjs) — por isso a checagem real precisa ignorar
// comentários de bloco, senão a própria documentação vira falso positivo.
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PLANTÃO-2: o preview/conciliação de Plantão precisa continuar
// isolado de qualquer escrita administrativa, do parser/catálogo 6x1 e de
// qualquer persistência real — ver docs/spec/PLANTOES.md, seções 24/25.

test('os módulos puros de Plantão (importador/conciliação) não importam nenhuma escrita administrativa', async () => {
  const [importador, conciliacao] = await Promise.all([
    ler('lib/importadorPlanilha.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  const fonte = semComentarios(`${importador}\n${conciliacao}`);

  for (const proibido of [
    'writeRepository',
    'adminRepository',
    'auditoriaRepository',
    'salvarRascunho',
    'salvarUsuario',
    'publicarEscalas',
    'excluirUsuario',
    'excluirEscalaPublicada',
    'firebase/firestore',
    'runTransaction',
    'writeBatch',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(proibido), proibido);
  }
});

test('os módulos puros de Plantão não usam o catálogo nem as regras de negócio da escala 6x1', async () => {
  const [importador, conciliacao] = await Promise.all([
    ler('lib/importadorPlanilha.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  const fonte = semComentarios(`${importador}\n${conciliacao}`);

  for (const proibido of [
    'CATALOGO_SOC',
    'alertasEscala',
    'detectarSequencias6x1',
    'detectarDescansoInsuficiente',
    'calcularTotais',
  ]) {
    assert.doesNotMatch(fonte, new RegExp(proibido), proibido);
  }
});

test('o parser isolado de Plantão (PLANTÃO-1) continua sem catálogo/regras 6x1', async () => {
  const parserPlantao = await ler('packages/contrato/src/parserPlantao.ts');

  for (const proibido of ['CATALOGO_SOC', 'alertasEscala', 'TipoTurno', 'calcularTotais']) {
    assert.doesNotMatch(parserPlantao, new RegExp(proibido), proibido);
  }
});

test('o writeRepository.ts compartilhado (6x1) segue sem qualquer menção a Plantão — a escrita de Plantão vive isolada em lib/firebase/plantaoWriteRepository.ts (Fase PLANTÃO-3A)', async () => {
  const writeRepository = await ler('lib/firebase/writeRepository.ts');
  assert.doesNotMatch(writeRepository, /plantao/iu, 'writeRepository.ts não deve mencionar Plantão');
});

test('o Dashboard roteia o preview de Plantão pelo importador/conciliação puros', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');

  assert.match(dashboard, /processarArquivoImportado/, 'o Dashboard deve rotear pelo importador puro');
  assert.match(dashboard, /conciliacaoPlantoes/, 'o Dashboard deve importar a conciliação pura de Plantão');
});

test('a importação e a reabertura de Plantão carregam usuários da equipe responsável, nunca reaproveitam a equipe da Jornada ativa', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(
    dashboard,
    /listarUsuariosElegiveisPlantao\(grupo\.equipeResponsavelId, grupo\.grupoId, grupo\.unidadeResponsavelId, grupo\.equipesConsulta\)/u,
    'o catálogo de vínculos deve vir da equipe/unidade responsável pelo Grupo de Plantão (PATCH-PLANTAO-VINCULO-GESTOR-COMO-PARTICIPANTE-1 — pool ampliado, mesmo alvo)',
  );
  assert.match(
    dashboard,
    /interpretarPlantao\(buffer, file\.name, processado\.resultado, opcoesPlantao, usuariosDoGrupo\)/u,
    'o preview precisa receber a lista recém-carregada, sem depender do setState assíncrono',
  );
});

test('a importação auto vincula somente identidade exata, única e ativa e preserva conflitos', async () => {
  const conciliacao = await ler('lib/conciliacaoPlantoes.ts');
  assert.match(conciliacao, /function candidatosPorIdentidadeExata/u);
  assert.match(conciliacao, /aliasesPlanilha/u);
  assert.match(conciliacao, /candidatos\.length === 1 && unico\.ativo/u);
  assert.match(conciliacao, /return recalcularConflitosPlantao\(iniciais\)/u);
});

/**
 * Fase PLANTÃO-3B: a integração real acontece agora — o Dashboard PASSA a
 * importar `plantaoReadRepository.ts`/`plantaoWriteRepository.ts` (o
 * teste acima, de PLANTÃO-2, dizia o oposto porque a integração ainda não
 * existia). A MATRIZ-2 acrescenta a publicação explícita por `grupoId`,
 * mantendo importador e conciliação puros.
 */
test('o Dashboard integra os repositories e publica Plantão por ação explícita', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));

  assert.match(dashboard, /plantaoReadRepository/, 'o Dashboard deve importar a leitura persistente de Plantão');
  assert.match(dashboard, /plantaoWriteRepository/, 'o Dashboard deve importar a escrita persistente de Plantão');
  assert.match(dashboard, /publicarCompetenciaPlantao\(/u);
  assert.match(dashboard, /function publicarPlantaoAcao\(/u);
});

test('plantaoWriteRepository.ts publica a competência e suas atribuições na coleção PUBLICADA', async () => {
  const writeRepo = await ler('lib/firebase/plantaoWriteRepository.ts');
  assert.match(writeRepo, /export async function publicarCompetenciaPlantao/u);
  assert.match(writeRepo, /['"]competenciasPlantao['"]/u);
});

/**
 * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — Parte C: seletor de visualização do
 * calendário de Plantão (compacta/prévia vs. edição/arrastar). O mecanismo
 * de dois modos JÁ EXISTIA (`PlantaoCalendario` `modo: 'editor' |
 * 'importacao' | 'consulta'`) — este patch só EXPÕE a escolha ao usuário em
 * vez de derivá-la automaticamente de `resultado !== null`. Os testes
 * abaixo confirmam que o seletor é só apresentação: nunca toca
 * participantes/atribuições/vínculos, nunca é usado por publicação, e
 * nunca sobrepõe uma permissão real (`somenteConsulta`).
 */

test('21. o Plantão tem um seletor de visualização explícito (Compacta / Edição), reaproveitando .segmented-control', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const \[modoVisualizacaoPlantao, setModoVisualizacaoPlantao\] = useState<'compacta' \| 'edicao'>/u);
  assert.match(dashboard, /className="segmented-control plantao-seletor-visualizacao"/u);
  assert.match(dashboard, /onClick=\{\(\) => selecionarModoVisualizacaoPlantao\('compacta'\)\}/u);
  assert.match(dashboard, /onClick=\{\(\) => selecionarModoVisualizacaoPlantao\('edicao'\)\}/u);
});

test('22. trocar o modo de visualização nunca chama nenhum setter de participantes/atribuições/vínculos — só estado local + localStorage', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function selecionarModoVisualizacaoPlantao\(modo: 'compacta' \| 'edicao'\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'selecionarModoVisualizacaoPlantao precisa existir');
  assert.match(corpo[1], /setModoVisualizacaoPlantao\(modo\)/u);
  assert.match(corpo[1], /window\.localStorage\.setItem\(CHAVE_MODO_VISUALIZACAO_PLANTAO, modo\)/u);
  for (const proibido of [
    'setParticipantes', 'setVinculos', 'setAtribuicoesEditaveis', 'setResultado',
    'firebase/firestore', 'salvarRascunho', 'publicarCompetenciaPlantao', 'writeBatch',
  ]) {
    assert.doesNotMatch(corpo[1], new RegExp(proibido, 'u'), `${proibido} não pode aparecer aqui — a troca de visualização é só apresentação`);
  }
});

test('23. a chave de persistência (localStorage) é só cosmética — nunca lida como fonte de participantes/atribuições/vínculos em nenhum outro lugar do arquivo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const CHAVE_MODO_VISUALIZACAO_PLANTAO = 'escalaIci\.plantao\.viewMode';/u);
  const ocorrencias = dashboard.match(/CHAVE_MODO_VISUALIZACAO_PLANTAO/gu) ?? [];
  // declaração + leitura no useState inicial + escrita no setter = exatamente 3 usos, nenhum outro ponto do app depende dela.
  assert.equal(ocorrencias.length, 3, `CHAVE_MODO_VISUALIZACAO_PLANTAO só pode ser usada na declaração, leitura inicial e escrita (encontrado ${ocorrencias.length})`);
});

test('24. modo "edicao" preserva o roster lateral e o calendário em modo "editor" (drag-and-drop) — mesmo componente/prop já existentes', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /\{modoVisualizacaoPlantao === 'edicao' && \(\s*<PlantaoRoster/u, 'roster (drag source) precisa aparecer em modo edição');
  assert.match(dashboard, /modo=\{somenteConsulta \? 'consulta' : \(modoVisualizacaoPlantao === 'compacta' \? 'importacao' : 'editor'\)\}/u, 'modo "edicao" do seletor precisa mapear para modo="editor" do calendário (drag-and-drop já existente)');
});

test('25. modo "compacta" usa o calendário de prévia/conferência já existente (modo="importacao") — sem roster, sem duplicar componente', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /plantao-editor-layout\$\{modoVisualizacaoPlantao === 'compacta' \? ' plantao-editor-layout-importacao' : ''\}/u);
  // Nenhum componente de calendário novo — continua sendo o único PlantaoCalendario já usado pelos outros modos.
  const ocorrenciasCalendario = dashboard.match(/<PlantaoCalendario/gu) ?? [];
  assert.equal(ocorrenciasCalendario.length, 1, 'só pode existir UM ponto de renderização do calendário de Plantão — o seletor reaproveita o mesmo componente');
});

test('26. a preferência visual nunca sobrepõe "somenteConsulta" (permissão real) — o seletor some e o calendário fica forçado em "consulta"', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /\{!somenteConsulta && \(\s*<div className="segmented-control plantao-seletor-visualizacao"/u, 'o seletor cosmético não pode aparecer quando o usuário só tem consulta real');
  assert.match(dashboard, /modo=\{somenteConsulta \? 'consulta' :/u, '"somenteConsulta" precisa continuar vencendo antes de qualquer preferência de visualização');
});

test('27. publicarPlantaoAcao/publicarCompetenciaPlantao nunca referenciam a preferência visual — publicação é 100% independente do modo de visualização', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const publicar = /function publicarPlantaoAcao\([\s\S]*?\n {2}\}/u.exec(dashboard);
  assert.ok(publicar, 'publicarPlantaoAcao precisa existir');
  assert.doesNotMatch(publicar[0], /modoVisualizacaoPlantao|CHAVE_MODO_VISUALIZACAO_PLANTAO/u, 'publicação não pode depender da preferência visual do calendário');
  const writeRepo = await ler('lib/firebase/plantaoWriteRepository.ts');
  assert.doesNotMatch(writeRepo, /modoVisualizacaoPlantao|viewMode|localStorage/u, 'a escrita persistente de Plantão não pode conhecer preferência de visualização');
});

/**
 * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — Parte A/B: a causa raiz de "As
 * regras de escrita ainda não reconhecem a matriz operacional" era um bug
 * real de `firestore.rules` (getDoc() em documento inexistente estourando
 * o limite de expressões — coberto por
 * tests/firebase/firestore.rules.test.ts). Estes testes cobrem a correção
 * client-side associada: a mensagem precisa refletir o estado ATUAL do
 * coordenador (nunca um valor congelado) e a falha real precisa ficar
 * diagnosticável em dev/staging sem expor dado sensível.
 */

test('28. publicarPlantaoAcao calcula matrizReconheceUsuario dinamicamente (podeGerenciarEsteGrupoPlantao), nunca um `true` congelado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const publicar = /async function publicarPlantaoAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(publicar, 'publicarPlantaoAcao precisa existir');
  assert.match(
    publicar[1],
    /setErroRascunhoPlantao\(mensagemErroEscritaOperacional\(falha, 'Não foi possível publicar o Plantão\.', podeGerenciarEsteGrupoPlantao\(grupo\)\)\)/u,
    'a mensagem de erro da publicação precisa recalcular podeGerenciarEsteGrupoPlantao(grupo) no momento da falha, igual ao salvarRascunhoPlantaoAcao()',
  );
  assert.doesNotMatch(
    publicar[1],
    /mensagemErroEscritaOperacional\(falha, 'Não foi possível publicar o Plantão\.', true\)/u,
    'nunca pode voltar a passar um `true` fixo — isso fazia a mensagem de matriz aparecer mesmo quando o coordenador já era reconhecido',
  );
});

test('29. salvarRascunhoPlantaoAcao e publicarPlantaoAcao usam o MESMO cálculo de matrizReconheceUsuario — nenhuma divergência entre rascunho e publicação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const salvar = /async function salvarRascunhoPlantaoAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  const publicar = /async function publicarPlantaoAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(salvar, 'salvarRascunhoPlantaoAcao precisa existir');
  assert.ok(publicar, 'publicarPlantaoAcao precisa existir');
  assert.match(salvar[1], /podeGerenciarEsteGrupoPlantao\(grupo\)/u);
  assert.match(publicar[1], /podeGerenciarEsteGrupoPlantao\(grupo\)/u);
});

test('30. diagnosticarFalhaEscritaPlantao existe, é chamada no catch da publicação, nunca loga login/e-mail/nome e é desligada em produção', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const diagnostico = /function diagnosticarFalhaEscritaPlantao\(parametros: \{[\s\S]*?\n\}\)\s*\{([\s\S]*?)\n\}\n/u.exec(dashboard);
  assert.ok(diagnostico, 'diagnosticarFalhaEscritaPlantao precisa existir');
  const corpo = diagnostico[1];
  assert.match(corpo, /if \(ambienteFirebaseAtual === 'producao'\) \{\s*return;\s*\}/u, 'nunca pode logar nada em produção');
  const proibido = /\blogin\b|\be-?mail\b|\bnome\b/giu;
  let achado;
  while ((achado = proibido.exec(corpo)) !== null) {
    assert.fail(`diagnosticarFalhaEscritaPlantao não pode referenciar "${achado[0]}" — só identificadores organizacionais/perfil`);
  }
  const publicar = /async function publicarPlantaoAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(publicar);
  assert.match(publicar[1], /diagnosticarFalhaEscritaPlantao\(\{/u, 'o catch de publicarPlantaoAcao precisa chamar o diagnóstico');
});
