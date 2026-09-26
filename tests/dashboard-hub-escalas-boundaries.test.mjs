import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase DASH-SIMPLES-1B — "Escalas" vira o HUB único de trabalho com escalas
// (`docs/spec/HUB_ESCALAS.md`). Este arquivo cobre a integração no
// Dashboard: o Hub nunca reimplementa autorização/status por conta própria
// (só reaproveita `operacoesDashboard`, já coberta por
// `tests/dashboard-operacoes-visiveis-boundaries.test.mjs`), e uma operação
// de Acompanhamento nunca ganha uma ação administrativa. A matriz de
// agrupamento/rótulo (testes A-I do pedido) é coberta por
// `lib/hubEscalas.test.ts` — este arquivo cobre só a integração real.

test('1. a tela Escalas renderiza o Hub (HubEscalasOperacoes) a partir da MESMA lista operacoesDashboard — nunca uma segunda resolução', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /import \{ possuiOperacaoAdministravelHub \} from '@\/lib\/hubEscalas';/u);
  assert.match(dashboard, /import \{ HubEscalasOperacoes \} from '@\/components\/escalas\/HubEscalasOperacoes';/u);
  assert.match(dashboard, /<HubEscalasOperacoes\s*\n\s*operacoes=\{operacoesDashboard\}/u);
  const ocorrenciasResolverOperacoes = dashboard.match(/resolverOperacoesDashboard\(/gu) ?? [];
  assert.equal(ocorrenciasResolverOperacoes.length, 1, 'o Hub não pode chamar resolverOperacoesDashboard uma segunda vez — só consome a lista já resolvida');
});

/**
 * HOTFIX-OPERACIONAL-PLANTAO-IMPORTACAO-HUB-1 — `solicitarTrocaContexto()`
 * sozinho é um no-op quando o alvo já é o contexto ativo (nunca abre o
 * editor, mesmo numa troca real), então clicar num card do Hub não abria
 * nada. `abrirOperacaoDoHub()` é o único caminho de abertura do Hub: para
 * contexto igual, abre o editor direto pelo MESMO par de chamadas do botão
 * "Abrir editor"/"Abrir consulta" já existente
 * (`abrirEditorPlantaoDashboard()`/`setTela('grade')`); para contexto
 * diferente, delega 100% para `contextoOpcaoOperacao()` +
 * `solicitarTrocaContexto()` — nunca um terceiro caminho de navegação.
 */
test('2. abrir uma operação do Hub passa por abrirOperacaoDoHub(), que delega a troca de contexto real para contextoOpcaoOperacao + solicitarTrocaContexto (nunca um segundo caminho paralelo) e só abre o editor direto quando o contexto já é o ativo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /onAbrir=\{abrirOperacaoDoHub\}/u);
  const corpo = /function abrirOperacaoDoHub\(operacao: OperacaoDashboard\) \{([\s\S]*?)\n  \}/u.exec(dashboard);
  assert.ok(corpo, 'abrirOperacaoDoHub precisa existir');
  assert.match(corpo[1], /contextoOpcaoOperacao\(operacao\)/u);
  assert.match(corpo[1], /solicitarTrocaContexto\(alvo\)/u);
  assert.match(corpo[1], /abrirEditorPlantaoDashboard\(\)/u);
  assert.match(corpo[1], /setTela\('grade'\)/u);
});

test('3. os botões "Nova escala"/"Importar escala" da tela Escalas só aparecem quando existe ao menos uma operação administrável — nunca para quem só consulta', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const possuiOperacaoAdministravel = possuiOperacaoAdministravelHub\(operacoesDashboard\);/u);
  assert.match(
    dashboard,
    /\{estadoCarregamentoOperacoes\.fase === 'sucesso' && possuiOperacaoAdministravel && <div className="grade-header-actions">/u,
  );
});

test('4. HubEscalasOperacoes agrupa via agruparOperacoesParaHub (lib/hubEscalas.ts) — nunca uma segunda regra de "administro vs acompanho" embutida no componente', async () => {
  const componente = semComentarios(await ler('components/escalas/HubEscalasOperacoes.tsx'));
  assert.match(componente, /import \{ agruparOperacoesParaHub, rotuloAcaoOperacaoHub \} from '@\/lib\/hubEscalas';/u);
  assert.match(componente, /agruparOperacoesParaHub\(operacoes\)/u);
  assert.doesNotMatch(componente, /\.consulta === (true|false)\)/u, 'nenhum filtro ad-hoc de `.consulta` fora de agruparOperacoesParaHub');
});

test('5. o cartão de uma operação de Acompanhamento (consulta) nunca renderiza um verbo administrativo — só "Visualizar"', async () => {
  const componente = semComentarios(await ler('components/escalas/HubEscalasOperacoes.tsx'));
  for (const proibido of ['Editar', 'Publicar', 'Importar', 'Salvar', 'Excluir', 'Cancelar publicação']) {
    assert.doesNotMatch(componente, new RegExp(proibido, 'u'), `"${proibido}" não pode aparecer no componente do Hub`);
  }
});

test('6. alertas de Plantão fora do editor nunca são "0" fabricado — só 0 quando o status já confirma sem-escala, senão null ("Abra para conferir")', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function alertasOperacaoHub\(operacao: OperacaoDashboard\): number \| null \{([\s\S]*?)\n  \}/u.exec(dashboard);
  assert.ok(corpo, 'alertasOperacaoHub precisa existir');
  assert.match(corpo[1], /operacao\.status === 'sem-escala'/u);
  assert.match(corpo[1], /: null;/u);
});

test('7. o componente do Hub nunca mostra "0 alertas" quando o valor é desconhecido — usa "Abra para conferir"', async () => {
  const componente = semComentarios(await ler('components/escalas/HubEscalasOperacoes.tsx'));
  assert.match(componente, /alertas === null \? 'Abra para conferir'/u);
});

test('8. "Minhas escalas" e "Acompanhamento" nunca aparecem como uma seção vazia — só renderizam quando têm pelo menos um item', async () => {
  const componente = semComentarios(await ler('components/escalas/HubEscalasOperacoes.tsx'));
  assert.match(componente, /\{minhasEscalas\.length > 0 &&/u);
  assert.match(componente, /\{acompanhamento\.length > 0 &&/u);
});

test('9. nenhum literal de nome/sigla real (SOC/NOC/COSI/CODB) hardcoded no Hub — nome sempre vem da OperacaoDashboard resolvida', async () => {
  const modulo = await ler('lib/hubEscalas.ts');
  const componente = await ler('components/escalas/HubEscalasOperacoes.tsx');
  for (const proibido of ["'SOC'", "'NOC'", "'COSI'", "'CODB'"]) {
    assert.doesNotMatch(modulo, new RegExp(proibido, 'u'), proibido);
    assert.doesNotMatch(componente, new RegExp(proibido, 'u'), proibido);
  }
});
