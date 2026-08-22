import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase ESCALAS-UX-2A: simplificação da navegação principal do Dashboard —
// "Importar"/"Grade"/"Plantões" saem da sidebar como destinos próprios, mas
// continuam existindo como `Tela` interna, acessíveis por pontes a partir
// de "Escalas"/"Administração". Ver docs/spec/REDESIGN_WORKSPACE_ESCALAS.md
// § 5 e CHECKPOINT-FASE-ESCALAS-UX-2A-NAVEGACAO.md.

test('1. a sidebar principal (NAVEGACAO) não contém mais "Importar escala" como item', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const navegacao = /const NAVEGACAO: ItemNavegacao\[\] = \[([\s\S]*?)\];/u.exec(dashboard);
  assert.ok(navegacao, 'NAVEGACAO precisa continuar existindo');
  assert.doesNotMatch(navegacao[1], /rotulo:\s*'Importar escala'/u, '"Importar escala" não pode mais ser um item de sidebar');
});

test('2. a sidebar principal não contém mais "Grade" como item de nível principal', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const navegacao = /const NAVEGACAO: ItemNavegacao\[\] = \[([\s\S]*?)\];/u.exec(dashboard);
  assert.ok(navegacao);
  assert.doesNotMatch(navegacao[1], /id:\s*'grade'/u, '"grade" não pode mais ter um item próprio em NAVEGACAO');
});

test('3. a sidebar principal não contém mais "Plantões" como item de nível principal', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const navegacao = /const NAVEGACAO: ItemNavegacao\[\] = \[([\s\S]*?)\];/u.exec(dashboard);
  assert.ok(navegacao);
  assert.doesNotMatch(navegacao[1], /id:\s*'plantoes'/u, '"plantoes" não pode mais ter um item próprio em NAVEGACAO');
});

test('4. NAVEGACAO tem exatamente 5 áreas: visao, escalas, trocas, usuarios, administracao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const navegacao = /const NAVEGACAO: ItemNavegacao\[\] = \[([\s\S]*?)\];/u.exec(dashboard);
  assert.ok(navegacao);
  const ids = [...navegacao[1].matchAll(/id:\s*'([a-z]+)'/gu)].map((m) => m[1]);
  assert.deepEqual(ids, ['visao', 'escalas', 'trocas', 'usuarios', 'administracao']);
});

test('5. as telas internas importar/grade/plantoes/responsaveisEscala continuam existindo (Tela e os blocos de renderização)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /type Tela = [^;]*'importar'/u, "'importar' precisa continuar no union Tela");
  assert.match(dashboard, /type Tela = [^;]*'grade'/u, "'grade' precisa continuar no union Tela");
  assert.match(dashboard, /type Tela = [^;]*'plantoes'/u, "'plantoes' precisa continuar no union Tela");
  assert.match(dashboard, /type Tela = [^;]*'responsaveisEscala'/u, "'responsaveisEscala' precisa continuar no union Tela");
  assert.match(dashboard, /\{tela === 'importar' && \(/u, 'o bloco de renderização de "importar" precisa continuar existindo');
  assert.match(dashboard, /\{tela === 'grade' && \(/u, 'o bloco de renderização de "grade" precisa continuar existindo');
  assert.match(dashboard, /\{tela === 'plantoes' && podeAcessarPlantoes && \(/u, 'o bloco de renderização de "plantoes" precisa continuar existindo');
  assert.match(dashboard, /\{tela === 'responsaveisEscala' && podeAcessarAdministracao/u, 'o bloco de renderização de "responsaveisEscala" precisa continuar existindo');
});

test('6. lib/navegacaoDashboard.ts é puro (sem Firebase, sem React) e mapeia importar/grade -> escalas, plantoes/responsaveisEscala -> administracao', async () => {
  const fonte = semComentarios(await ler('lib/navegacaoDashboard.ts'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', "from 'react'", 'useState', 'useEffect']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
  assert.match(fonte, /export function areaNavegacaoDaTela/u, 'areaNavegacaoDaTela precisa existir e ser exportada');
  assert.match(fonte, /case 'importar':\s*\n\s*case 'grade':\s*\n\s*return 'escalas';/u, "'importar'/'grade' precisam mapear para a área 'escalas'");
  assert.match(fonte, /case 'plantoes':\s*\n\s*case 'responsaveisEscala':\s*\n\s*return 'administracao';/u, "'plantoes' e 'responsaveisEscala' precisam mapear para a área 'administracao'");
});

test('7. o item ativo da sidebar usa areaNavegacaoDaTela(tela), nunca a tela crua — evita que "importar"/"grade"/"plantoes" fiquem sem nenhum item destacado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /import \{ areaNavegacaoDaTela \} from '@\/lib\/navegacaoDashboard';/u, 'o helper precisa ser importado');
  assert.match(dashboard, /ativo=\{areaNavegacaoDaTela\(tela\)\}/u, 'a prop "ativo" do AppFrame precisa vir do helper, não de `tela` diretamente');
  assert.doesNotMatch(dashboard, /ativo=\{tela\}/u, 'nenhum ponto pode voltar a passar `tela` crua como item ativo da sidebar');
});

test('8. "Escalas" oferece apenas Nova escala e Importar escala como ações primárias; a Grade permanece contextual', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const bloco = /\{tela === 'escalas' && \(([\s\S]*?)\n {6}\)\}/u.exec(dashboard);
  assert.ok(bloco, 'o bloco de "escalas" precisa existir');
  assert.match(bloco[1], /onClick=\{abrirImportarEscala\}/u, '"Escalas" precisa abrir o wizard de Importar');
  assert.match(bloco[1], /onClick=\{abrirNovaEscala\}/u, '"Escalas" precisa abrir o wizard de Nova escala');
  assert.doesNotMatch(bloco[1], />\s*(?:<[^>]+>\s*)?Abrir grade\b/u, '"Abrir grade" não pode ser uma ação primária da tela Escalas');
});

test('9. "Administração" oferece a sub-navegação Organização/Grupos de Plantão/Responsáveis por escala, e as sub-telas referenciam a mesma sub-navegação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrencias = dashboard.match(/function AdministracaoSubnav\(/gu) ?? [];
  assert.equal(ocorrencias.length, 1, 'só pode existir UM componente de sub-navegação de Administração — nunca uma segunda sidebar');
  const usos = dashboard.match(/<AdministracaoSubnav\b/gu) ?? [];
  assert.equal(usos.length, 3, 'a sub-navegação precisa ser usada em Organização, Grupos de Plantão e Responsáveis por escala');
  assert.match(dashboard, /Responsáveis por escala/u, 'a terceira aba administrativa precisa existir');
});

test('9b. Responsáveis por escala tem ação Novo vínculo visível e modal com seletores operacionais, não inputs soltos', async () => {
  const tabela = semComentarios(await ler('components/admin/ResponsaveisEscalaTable.tsx'));
  const modal = semComentarios(await ler('components/admin/ResponsavelEscalaModal.tsx'));
  assert.match(tabela, /Novo vínculo/u, 'a tela precisa expor a ação principal mesmo quando a lista estiver vazia');
  assert.match(tabela, /Somente ADMIN_SISTEMA edita responsáveis por escala nesta fase/u, 'usuário sem permissão deve entender por que não consegue editar');
  assert.match(modal, /usuariosResponsaveisOperacionaisElegiveis/u, 'responsáveis humanos precisam vir do filtro estruturado de perfil/ativo');
  assert.match(modal, /Nenhum gestor ou supervisor ativo encontrado/u, 'modal precisa orientar quando não houver responsável humano elegível');
  assert.match(modal, /Equipes administradoras/u, 'responsabilidade por equipe precisa ser nomeada como administração, não consulta');
  assert.match(tabela, /Responsável não elegível/u, 'vínculo legado com humano não elegível precisa aparecer como alerta, sem remoção automática');
  assert.match(modal, /Selecionar equipe ativa/u, 'consulta e responsabilidade por equipe precisam usar equipes ativas');
  assert.match(modal, /grupos\.filter\(\(grupo\) => grupo\.ativo\)/u, 'alvo Plantão deve listar só grupos ativos');
  assert.doesNotMatch(modal, /equipeResponsavelId.*responsaveisEquipe|responsaveisEquipe.*equipeResponsavelId/u, 'equipe responsável do Plantão não pode ser auto-adicionada como equipe administradora');
  assert.doesNotMatch(modal, /placeholder="login1, login2"|placeholder="EQ_EXEMPLO/u, 'modal não deve depender de listas digitadas manualmente');
});

test('10. ESCALAS-UX-2A em si não implementou ContextoEscalaAtivo — isso ficou para a ESCALAS-UX-2A.1 (já concluída; ver tests/dashboard-contexto-escala-boundaries.test.mjs) — mas o workspace unificado final (ScheduleWorkspace) continua fora de escopo de ambas', async () => {
  const arquivos = await Promise.all([
    ler('apps/dashboard/src/DashboardApp.tsx'),
    ler('components/AppFrame.tsx'),
    ler('lib/navegacaoDashboard.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    // Fase ESCALAS-UX-2A.1 — `ContextoEscalaAtivo`/`ScheduleContextSwitcher`
    // foram implementados como planejado (ver `lib/contextoEscala.ts`,
    // `components/escalas/`); esta asserção histórica é ajustada para
    // continuar protegendo só o que ainda é fora de escopo de QUALQUER fase
    // concluída até agora — o workspace final único.
    for (const proibido of ['ScheduleWorkspace']) {
      assert.doesNotMatch(fonte, new RegExp(proibido, 'u'), `${proibido} pertence a uma fase futura (ESCALAS-UX-2B ou posterior), ainda não implementado`);
    }
  }
});

test('11. a origem de Plantão preserva os quatro valores após a autorização matricial nas Rules', async () => {
  const rules = await ler('firestore.rules');
  const ocorrenciasCopiado = rules.match(/COPIADO/gu) ?? [];
  assert.ok(ocorrenciasCopiado.length >= 5, 'as validações de origem de Plantão precisam continuar aceitando COPIADO');
  assert.match(rules, /podeAdministrarEscalaPlantao/u, 'as Rules precisam aplicar a matriz operacional à escrita de Plantão');
  const modelo = await ler('packages/contrato/src/modeloPlantaoPersistente.ts');
  assert.match(modelo, /export type OrigemPlantao = 'IMPORTADO' \| 'MANUAL' \| 'GERADO' \| 'COPIADO';/u, 'OrigemPlantao precisa continuar exatamente com os mesmos 4 valores, nenhum novo');
});

test('12. nenhum Editor foi reescrito — PlantaoCalendario, ModalEditarAtribuicaoPlantao e ScheduleGrid continuam existindo exatamente uma vez cada', async () => {
  const [calendario, modal, grade] = await Promise.all([
    ler('components/plantao/PlantaoCalendario.tsx'),
    ler('components/plantao/ModalEditarAtribuicaoPlantao.tsx'),
    ler('components/ScheduleGrid.tsx'),
  ]);
  assert.equal((semComentarios(calendario).match(/function PlantaoCalendario\b/gu) ?? []).length, 1);
  assert.equal((semComentarios(modal).match(/function ModalEditarAtribuicaoPlantao\b/gu) ?? []).length, 1);
  assert.equal((semComentarios(grade).match(/function ScheduleGrid\b/gu) ?? []).length, 1);
});

test('13. AppFrame continua sem nenhum conceito de contexto de escala — só recebe `itens`/`ativo`/`onNavegar` como antes', async () => {
  const appFrame = semComentarios(await ler('components/AppFrame.tsx'));
  assert.match(appFrame, /plantao: Radio/u, 'o ícone de Plantão precisa continuar mapeado (usado por Administração/Grupos de Plantão)');
  assert.doesNotMatch(appFrame, /GrupoPlantao|CompetenciaPlantao|AtribuicaoPlantao/u, 'AppFrame continua genérico — nunca importa tipos de domínio de Plantão');
});

test('14. os breadcrumbs transitórios de "Importar"/"Grade" voltam para "Escalas" usando o botão compacto aprovado', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrencias = dashboard.match(/className="screen-back-button" onClick=\{\(\) => setTela\('escalas'\)\}/gu) ?? [];
  assert.equal(ocorrencias.length, 2, 'tanto "Importar" quanto "Grade" precisam de um botão compacto de volta para Escalas');
});

/**
 * PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1 — Parte D: a tela inicial do
 * Dashboard, sem rota/estado explícito, precisa ser "Visão geral"
 * ('visao'), nunca "Escalas". O bug era literal: `useState<Tela>('escalas')`
 * fixava Escalas como padrão de todo primeiro carregamento — nunca foi um
 * valor vindo de localStorage (não existe nenhuma leitura de storage para
 * decidir a tela inicial neste arquivo).
 */
test('15. estado inicial padrão é "Visão geral" (useState<Tela>(\'visao\')), não mais Escalas', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const \[tela, setTela\] = useState<Tela>\('visao'\);/u);
  assert.doesNotMatch(dashboard, /const \[tela, setTela\] = useState<Tela>\('escalas'\);/u);
});

test('16. o item de navegação "Visão geral" (id \'visao\') continua existindo e mapeia para si mesmo em areaNavegacaoDaTela — fica ativo por padrão', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const navegacaoNav = await ler('lib/navegacaoDashboard.ts');
  assert.match(dashboard, /\{ id: 'visao', rotulo: 'Visão geral', icone: 'home' \}/u);
  // areaNavegacaoDaTela('visao') cai no default (nenhum case especial
  // remapeia 'visao' para outra área) — 'visao' já é uma AreaNavegacaoDashboard.
  const funcao = /export function areaNavegacaoDaTela\(tela: TelaDashboard\): AreaNavegacaoDashboard \{([\s\S]*?)\n\}/u.exec(navegacaoNav);
  assert.ok(funcao, 'areaNavegacaoDaTela precisa existir');
  assert.doesNotMatch(funcao[1], /case 'visao':/u, "'visao' não precisa de remapeamento — já é a própria área ativa");
});

test('17. navegação manual para "Escalas" continua funcionando (onNavegar do AppFrame chama setTela livremente)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /onNavegar=\{\(id\) => setTela\(id as Tela\)\}/u);
});

test('18. "Escalas" nunca é forçado por leitura de localStorage/sessionStorage ao decidir a tela inicial', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  // Nenhum useState<Tela> pode ler de storage — o único estado persistido
  // é `contextoEscalaAtivo` (um alvo de escala, não a tela em si), e sua
  // restauração só executa quando EXISTE algo salvo (nunca no primeiro
  // acesso limpo).
  assert.doesNotMatch(dashboard, /useState<Tela>\(\s*(?:window\.)?(?:local|session)Storage/u);
});
