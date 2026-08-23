import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PATCH-DASHBOARD-OPERACOES-SIMPLES-1 — regra principal: uma única
// função (`resolverOperacoesDashboard`, lib/operacoesDashboard.ts) decide
// quais operações o Dashboard mostra e com qual status. A matriz completa
// de visibilidade (admin/Claudio/NOC/inativo, os 4 estados de status) já é
// coberta por lib/operacoesDashboard.test.ts — este arquivo cobre a
// CONSOLIDAÇÃO no Dashboard: quem chama a função única, e a remoção do
// card genérico "Plantão". Ver docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md,
// docs/spec/ESCALA_ICI_MASTER_SPEC.md.

test('1. o Dashboard importa e usa resolverOperacoesDashboard como a lista única de operações', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /import \{\s*classeSaudeOperacaoDashboard,\s*derivarStatusOperacaoDashboard,\s*resolverOperacoesDashboard,\s*rotuloStatusOperacaoDashboard,\s*type OperacaoDashboard,\s*type StatusOperacaoDashboard,\s*\} from '@\/lib\/operacoesDashboard';/u);
  assert.match(dashboard, /const operacoesDashboard: OperacaoDashboard\[\] = usuarioReal !== null\s*\? resolverOperacoesDashboard\(usuarioReal, contextoEscalaAtivo, \{/u);
});

test('2. o seletor superior (opcoesContextoJornada/Plantao/Monitorados) filtra operacoesDashboard — nunca volta a mapear escoposOperacionais direto', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const opcoesContextoJornada: OpcaoContextoEscala\[\] = operacoesDashboard\s*\.filter\(\(operacao\) => operacao\.tipo === 'JORNADA'\)/u);
  assert.match(dashboard, /const opcoesContextoPlantao: OpcaoContextoEscala\[\] = operacoesDashboard\s*\.filter\(\(operacao\) => operacao\.tipo === 'PLANTAO' && !operacao\.consulta\)/u);
  assert.match(dashboard, /const opcoesContextoPlantaoMonitorados: OpcaoContextoEscala\[\] = operacoesDashboard\s*\.filter\(\(operacao\) => operacao\.tipo === 'PLANTAO' && operacao\.consulta\)/u);
  assert.doesNotMatch(dashboard, /OpcaoContextoEscala\[\] = escoposOperacionais\./u, 'nenhuma lista de opções do seletor pode mapear escoposOperacionais diretamente — só via operacoesDashboard');
});

test('3. Visão geral e seletor superior nunca podem divergir — os 3 filtros do seletor e o card da Visão geral partem da MESMA lista `operacoesDashboard`', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrencias = dashboard.match(/\boperacoesDashboard\b/gu) ?? [];
  // declaração + 3 filtros do seletor = pelo menos 4 usos reais (pode haver mais, ex. gating futuro).
  assert.ok(ocorrencias.length >= 4, `operacoesDashboard precisa ser reaproveitado por múltiplos consumidores (encontrado ${ocorrencias.length} ocorrências)`);
});

test('4. o card/linha de Plantão da Visão geral só existe quando há um Grupo real no escopo (possuiOperacaoPlantaoDashboard) — nas 4 seções: cards superiores, Saúde das escalas, Publicação da escala, Alertas por operação', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const possuiOperacaoPlantaoDashboard = grupoPlantaoDashboard !== null;/u);
  const ocorrenciasGate = dashboard.match(/\{possuiOperacaoPlantaoDashboard(?: &&|\s*\?)/gu) ?? [];
  assert.ok(ocorrenciasGate.length >= 4, `esperado o gate em pelo menos 4 pontos da Visão geral (encontrado ${ocorrenciasGate.length})`);
});

test('5. nenhum "<strong>Plantão</strong>" genérico sobrevive na Visão geral — sempre {nomePlantaoDashboard}, o nome real do Grupo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /<strong>Plantão<\/strong>/u, 'rótulo genérico "Plantão" sem interpolação não pode mais existir em nenhuma tela');
});

test('6. nomePlantaoDashboard nunca é usado sem o gate — o fallback textual "Plantão" existe só como defesa, nunca renderizado (o card inteiro está atrás de possuiOperacaoPlantaoDashboard)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const nomePlantaoDashboard = grupoPlantaoDashboard\?\.nome \?\? 'Plantão';/u);
  const declaracaoIndex = dashboard.indexOf("const nomePlantaoDashboard = grupoPlantaoDashboard?.nome ?? 'Plantão';");
  const gateIndex = dashboard.indexOf('const possuiOperacaoPlantaoDashboard = grupoPlantaoDashboard !== null;');
  assert.ok(gateIndex >= 0 && gateIndex < declaracaoIndex, 'o gate precisa ser calculado antes/junto do nome, para toda renderização do nome poder checar o gate');
});

test('7. status operacional único: estadoJornadaDashboard/estadoPlantaoDashboard delegam para derivarStatusOperacaoDashboard — nenhuma fórmula própria de status sobrevive', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const jornada = /function estadoJornadaDashboard\(resumo: ResumoJornadaDashboard \| null\): EstadoEscalaOperacionalDashboard \{([\s\S]*?)\n\}/u.exec(dashboard);
  const plantao = /function estadoPlantaoDashboard\(resumo: ResumoPlantaoDashboard \| null\): EstadoEscalaOperacionalDashboard \{([\s\S]*?)\n\}/u.exec(dashboard);
  assert.ok(jornada && plantao, 'as duas funções precisam existir');
  assert.match(jornada[1], /derivarStatusOperacaoDashboard\(/u);
  assert.match(plantao[1], /derivarStatusOperacaoDashboard\(/u);
});

test('8. o badge de status do contexto ativo (aba Escalas / topo) reaproveita o mesmo status — nunca recalcula "publicada" por conta própria a partir de documentos/publicados', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const statusVar = /const statusContextoAtivo: StatusContextoEscala \| null = ([\s\S]*?);\n {2}const rotuloEscalaAtiva/u.exec(dashboard);
  assert.ok(statusVar);
  assert.doesNotMatch(statusVar[1], /documentos\.length|publicados\.length/u, 'statusContextoAtivo não pode mais inspecionar documentos/publicados diretamente');
  assert.match(statusVar[1], /estadoEscalaAtiva/u);
});

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — a correção anterior só
 * tinha alcançado o badge (`<em>`) desta linha; o `<small>` (a descrição
 * logo abaixo do nome) continuava um booleano de 2 estados
 * (`plantaoPossuiEscalaDashboard`), então "Rascunho disponível" aparecia
 * mesmo com o badge ao lado já dizendo "Publicada" — exatamente o bug
 * relatado ("card superior mostra Publicada, mas Publicação da escala
 * mostra Rascunho"). Agora o `<small>` E o `<em>` vêm da MESMA função
 * (`resumoPublicacaoOperacao`, compartilhada com Jornada) — nunca podem
 * divergir entre si.
 */
test('9. "Publicação da escala" (Plantão) mostra o mesmo rótulo de status em <small> e <em> — nunca mais um booleano ad-hoc que ignora competenciaPublicada', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /<small>\{resumoPublicacaoPlantaoDashboard\.titulo\}<\/small><\/span><em className=\{resumoPublicacaoPlantaoDashboard\.estado\}>\{rotuloEstadoEscalaOperacional\(estadoPlantaoOperacionalDashboard\)\}<\/em>/u,
  );
  assert.doesNotMatch(
    dashboard,
    /plantaoPossuiEscalaDashboard \? 'Rascunho disponível' : 'Nenhuma escala criada'/u,
    'a fórmula antiga do <small> (nunca reconhecia "Publicada") não pode sobreviver',
  );
  assert.doesNotMatch(
    dashboard,
    /<em className=\{estadoPlantaoOperacionalDashboard === 'sem-escala' \? 'vazio' : estadoPlantaoOperacionalDashboard === 'publicada' \? 'completo' : 'parcial'\}>/u,
    'o <em> não pode mais ter sua própria fórmula de classe — precisa vir de resumoPublicacaoPlantaoDashboard.estado, igual ao <small>',
  );
});

test('10. StatusOperacaoDashboard tem 4 estados — Sem escala/Rascunho/Publicada/Publicada com rascunho pendente — e o badge externo (ScheduleStatusBadge) conhece os 4', async () => {
  const modulo = semComentarios(await ler('lib/operacoesDashboard.ts'));
  assert.match(modulo, /export type StatusOperacaoDashboard = 'sem-escala' \| 'rascunho' \| 'publicada' \| 'publicada-com-rascunho-pendente';/u);
  const badge = semComentarios(await ler('components/escalas/ScheduleStatusBadge.tsx'));
  assert.match(badge, /export type StatusContextoEscala = 'rascunho' \| 'publicada' \| 'publicada-com-rascunho-pendente' \| 'sem-escala';/u);
});

test('11. resolverOperacoesDashboard nunca inventa uma operação — só mapeia escopos.jornadasAdministraveis/plantoesAdministraveis/plantoesMonitorados, nenhum literal de nome/rótulo "Plantão" hardcoded no módulo', async () => {
  const modulo = semComentarios(await ler('lib/operacoesDashboard.ts'));
  const corpo = /export function resolverOperacoesDashboard\([\s\S]*?\n\}/u.exec(modulo);
  assert.ok(corpo);
  assert.match(corpo[0], /dados\.escopos\.jornadasAdministraveis\.map/u);
  assert.match(corpo[0], /dados\.escopos\.plantoesAdministraveis\.map/u);
  assert.match(corpo[0], /dados\.escopos\.plantoesMonitorados\.map/u);
  assert.doesNotMatch(corpo[0], /nome: 'Plantão'|nome: 'SOC'|nome: 'NOC'/u, 'nunca hardcoda um nome de operação — sempre equipe.nome/grupo.nome real');
});

test('12. nenhuma referência a IDs legados em lib/operacoesDashboard.ts (COSI/CODB/COCR/EQ_SOC/EQ_NOC/EQ_PLANTAO_COSI/PLANTAO_COSI como literal)', async () => {
  const modulo = await ler('lib/operacoesDashboard.ts');
  for (const proibido of ['EQ_SOC', 'EQ_NOC', 'EQ_PLANTAO_COSI', "'PLANTAO_COSI'", "'COSI'", "'CODB'", "'COCR'"]) {
    assert.doesNotMatch(modulo, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('13. este patch não tocou firestore.rules, seed ou o repository de escrita de Plantão — publicação já corrigida continua intacta', async () => {
  const [writeRepo] = await Promise.all([ler('lib/firebase/plantaoWriteRepository.ts')]);
  assert.match(writeRepo, /export async function publicarCompetenciaPlantao/u, 'a função de publicação precisa continuar existindo, sem reescrita');
  assert.doesNotMatch(writeRepo, /operacoesDashboard|resolverOperacoesDashboard/u, 'a escrita de Plantão nunca deve depender da resolução de operações visíveis do Dashboard — são camadas distintas');
});

test('14. a tela Usuários e a Administração continuam sem reimplementar a própria lista de operações — nenhuma segunda chamada a resolverEscoposOperacionais/resolverOperacoesDashboard fora dos pontos já centralizados', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrenciasResolverOperacoes = dashboard.match(/resolverOperacoesDashboard\(/gu) ?? [];
  assert.equal(ocorrenciasResolverOperacoes.length, 1, `resolverOperacoesDashboard só pode ser chamada uma vez, para popular a lista única (encontrado ${ocorrenciasResolverOperacoes.length})`);
});
