import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — Partes B e C:
// status operacional único (Publicação da escala mostrando Plantão
// corretamente) e a aba Escalas abrindo a competência de Plantão
// publicada (não só rascunho). Ver docs/spec/EDITOR_ESCALAS.md.

// --- Parte B: status único ---

test('1. resumoPublicacaoOperacao é a única fonte de texto de publicação, compartilhada por Jornada e Plantão', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /function resumoPublicacaoOperacao\(estado: EstadoEscalaOperacionalDashboard\): ResumoPublicacao \{/u);
  assert.match(dashboard, /const resumoPublicacaoDashboard = resumoPublicacaoOperacao\(estadoJornadaOperacionalDashboard\);/u);
  assert.match(dashboard, /const resumoPublicacaoPlantaoDashboard = resumoPublicacaoOperacao\(estadoPlantaoOperacionalDashboard\);/u);
  assert.doesNotMatch(dashboard, /function resumoPublicacaoJornada\(/u, 'a função exclusiva de Jornada não pode sobreviver — foi generalizada');
});

test('2. resumoPublicacaoOperacao distingue os 4 estados com título/descrição próprios — nunca colapsa "publicada com rascunho pendente" em "Rascunho"', async () => {
  const modulo = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function resumoPublicacaoOperacao\(estado: EstadoEscalaOperacionalDashboard\): ResumoPublicacao \{([\s\S]*?)\n\}/u.exec(modulo);
  assert.ok(corpo);
  assert.match(corpo[1], /'sem-escala'/u);
  assert.match(corpo[1], /titulo: 'Rascunho não publicado'/u);
  assert.match(corpo[1], /titulo: 'Publicada, com rascunho pendente'/u);
  assert.match(corpo[1], /titulo: 'Publicada'/u);
});

test('3. "Publicação da escala" (Plantão) usa <small> e <em> vindos da MESMA função de resumo — nunca mostra "Rascunho disponível" quando o status é publicada', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /<small>\{resumoPublicacaoPlantaoDashboard\.titulo\}<\/small><\/span><em className=\{resumoPublicacaoPlantaoDashboard\.estado\}>/u,
  );
  assert.doesNotMatch(dashboard, /plantaoPossuiEscalaDashboard \? 'Rascunho disponível'/u);
});

test('4. "Publicação da escala" (Jornada) continua usando resumoPublicacaoDashboard — mesmo padrão de antes, agora via a função compartilhada', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /<small>\{resumoPublicacaoDashboard\.titulo\}<\/small><\/span><em className=\{resumoPublicacaoDashboard\.estado\}>\{rotuloEstadoEscalaOperacional\(estadoJornadaOperacionalDashboard\)\}<\/em>/u,
  );
});

test('5. Plantão publicado sem rascunho aberto ainda popula participantes — abrirRascunhoNoEditorAcao sempre chama listarParticipantesPlantao, independente da origem (rascunho ou publicada)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function abrirRascunhoNoEditorAcao\(([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /listarParticipantesPlantao\(grupo\.grupoId\)/u, 'participantes precisam ser carregados incondicionalmente, nunca só no ramo rascunho');
  assert.doesNotMatch(corpo[1], /abrindoPublicada \? Promise\.resolve\(\[\]\).*listarParticipantesPlantao/su, 'participantes não podem ficar condicionados a abrindoPublicada');
});

// --- Parte C: Escalas > Plantão COSI abre a competência publicada ---

test('6. lib/firebase/plantaoReadRepository.ts ganhou listarAtribuicoesPlantaoPublicada — antes só existia o lado rascunho', async () => {
  const repo = semComentarios(await ler('lib/firebase/plantaoReadRepository.ts'));
  assert.match(repo, /export async function listarAtribuicoesPlantaoPublicada\(/u);
  const corpo = /export async function listarAtribuicoesPlantaoPublicada\([\s\S]*?\n\}/u.exec(repo);
  assert.ok(corpo);
  assert.match(corpo[0], /collection\(db, 'competenciasPlantao', id, 'atribuicoes'\)/u, 'precisa ler da coleção PUBLICADA, nunca de rascunhosCompetenciasPlantao');
});

test('7. abrirRascunhoNoEditorAcao abre tanto rascunho quanto competência PUBLICADA — decide pelo próprio .status do documento, nunca um segundo modelo de dados', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function abrirRascunhoNoEditorAcao\(([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /const abrindoPublicada = competenciaAlvo\.status === 'PUBLICADA';/u);
  assert.match(corpo[1], /listarAtribuicoesPlantaoPublicada\(grupo\.grupoId, competenciaAlvo\.competencia\)/u);
  assert.match(corpo[1], /listarAtribuicoesPlantaoRascunho\(grupo\.grupoId, competenciaAlvo\.competencia\)/u, 'o caminho rascunho precisa continuar existindo, intacto');
  assert.match(corpo[1], /obterCompetenciaPlantaoPublicada\(grupo\.grupoId, competenciaAlvo\.competencia\)/u);
  // A reidratação é a MESMA função para os dois casos — nunca um segundo modelo.
  const ocorrenciasReidratar = corpo[1].match(/reidratarRascunhoPlantao\(/gu) ?? [];
  assert.equal(ocorrenciasReidratar.length, 1, 'só pode existir UMA chamada de reidratação, reaproveitada para os dois casos');
});

test('8. "Abrir editor" (aba Escalas) e o card da Visão geral, em contexto Plantão, chamam abrirEditorPlantaoDashboard — nunca mais um setTela(\'importar\') cego que deixa a tela em branco', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /onClick=\{\(\) => \(contextoEhPlantao\(contextoEscalaAtivo\) \? abrirEditorPlantaoDashboard\(\) : setTela\('grade'\)\)\}/u,
    'o botão "Abrir editor" da aba Escalas precisa chamar abrirEditorPlantaoDashboard em contexto Plantão',
  );
  const corpo = /function abrirEditorPlantaoDashboard\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirEditorPlantaoDashboard precisa existir');
  assert.match(corpo[1], /void abrirRascunhoNoEditorAcao\(grupoPlantaoDashboard, competenciaPlantaoExibidaDashboard\)/u);
});

test('9. o card "Plantão COSI" da Visão geral, quando o contexto já está ativo, também usa abrirEditorPlantaoDashboard — nunca setTela(\'importar\') direto', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirOperacaoDoDashboard\(tipo: 'JORNADA' \| 'PLANTAO'\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /if \(plantaoPossuiEscalaDashboard\) \{\s*abrirEditorPlantaoDashboard\(\);/u);
});

test('10. a aba Escalas gateia o histórico Jornada-only por contextoEhJornada, e mostra um bloco de revisão real (não inventado) para Plantão', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /\{contextoEhJornada\(contextoEscalaAtivo\) && \(\s*<article className="panel publication-history-panel">\s*<div className="panel-title">\s*<div>\s*<p className="eyebrow">Rastreabilidade local<\/p>\s*<h2>Histórico de publicações<\/h2>/u);
  assert.match(dashboard, /\{contextoEhPlantao\(contextoEscalaAtivo\) && \(\s*<article className="panel publication-history-panel">\s*<div className="panel-title">\s*<div>\s*<p className="eyebrow">Rastreabilidade local<\/p>\s*<h2>Revisão publicada<\/h2>/u);
  // O bloco de Plantão usa dados reais já persistidos (revisao/atualizadoEm/criadoPorLogin) — nunca uma lista de revisões inventada.
  assert.match(dashboard, /resumoPlantaoDashboard\.competenciaPublicada\.revisao/u);
  assert.match(dashboard, /resumoPlantaoDashboard\.competenciaPublicada\.criadoPorLogin/u);
  assert.match(dashboard, /resumoPlantaoDashboard\.competenciaPublicada\.atualizadoEm/u);
});

test('11. Jornada SOC não regride — "grade" continua sendo o destino direto de "Abrir editor" fora do contexto Plantão, sem passar por abrirEditorPlantaoDashboard', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /contextoEhPlantao\(contextoEscalaAtivo\) \? abrirEditorPlantaoDashboard\(\) : setTela\('grade'\)/u);
});
