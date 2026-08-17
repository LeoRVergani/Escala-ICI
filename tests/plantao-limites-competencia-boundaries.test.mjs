import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/gu, '');

// Fase ESCALAS-UX-2B.1: uma NOVA atribuição de Plantão só pode começar
// dentro do período real da competência ativa — dias exibidos só como
// contexto visual (fora de periodoInicio..periodoFim) nunca aceitam
// criação por click/drag/"+ Adicionar"/quick-add. Ver
// CHECKPOINT-FASE-ESCALAS-UX-2B1-LIMITES-COMPETENCIA.md.

test('1. o gate definitivo (dataPertenceCompetencia) vive na operação comum, antes de qualquer outro branch', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function solicitarNovaAtribuicaoPlantao\(plantonistaNomeOriginal: string, dataIso: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'solicitarNovaAtribuicaoPlantao precisa existir');
  const primeiraLinha = corpo[1].trim().split('\n')[0].trim();
  assert.match(primeiraLinha, /^if \(!dataPertenceCompetencia\(dataIso, competenciaRascunho\)\) \{$/u, 'o gate precisa ser o PRIMEIRO check da função — nenhum outro branch pode rodar antes');
  assert.match(corpo[1], /if \(!dataPertenceCompetencia\(dataIso, competenciaRascunho\)\) \{\s*return;\s*\}/u, 'fora do período, a função retorna sem fazer mais nada (no-op silencioso)');
});

test('2. o gate nunca altera a working copy nem marca dirty antes de validar a data', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function solicitarNovaAtribuicaoPlantao\(plantonistaNomeOriginal: string, dataIso: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  const blocoGate = /if \(!dataPertenceCompetencia\(dataIso, competenciaRascunho\)\) \{([\s\S]*?)\}/u.exec(corpo[1]);
  assert.ok(blocoGate, 'o bloco do gate precisa existir');
  assert.doesNotMatch(blocoGate[1], /setAtribuicoesEditaveisPlantao|marcarPlantaoEditadoNoEditor|setQuickAddPlantao/u, 'o gate nunca pode tocar working copy/dirty/quick-add — só um return');
});

test('3. dataPertenceCompetencia reaproveita periodoDaCompetencia — nenhum segundo cálculo 26→25', async () => {
  const lib = semComentarios(await ler('lib/montagemRascunhoPlantao.ts'));
  const corpo = /export function dataPertenceCompetencia\(dataIso: string, competencia: string\): boolean \{([\s\S]*?)\n\}/u.exec(lib);
  assert.ok(corpo, 'dataPertenceCompetencia precisa existir');
  assert.match(corpo[1], /periodoDaCompetencia\(competencia\)/u, 'precisa reaproveitar periodoDaCompetencia — nenhum cálculo de data duplicado');
});

test('4. PlantaoCalendario nunca renderiza "+ Adicionar" num dia de contexto', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  assert.match(calendario, /const podeCriar = !contexto;/u, 'precisa existir uma variável explícita "podeCriar" derivada do contexto');
  assert.match(calendario, /\{podeCriar && \(\s*<button[\s\S]{0,80}className="plantao-adicionar"/u, '"+ Adicionar" precisa estar condicionado a podeCriar');
});

test('5. clicar o fundo de um dia de contexto nunca chama onSolicitarNovaAtribuicao', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  const onClick = /onClick=\{\(\) => \{\s*if \(([^)]*)\) \{\s*onSolicitarNovaAtribuicao\(plantonistaSelecionado, data\);/u.exec(calendario);
  assert.ok(onClick, 'o onClick do fundo do dia precisa existir');
  assert.match(onClick[1], /podeCriar/u, 'a condição precisa incluir podeCriar — nunca só a seleção de plantonista');
});

test('6. drag sobre um dia de contexto nunca ativa o feedback visual de drop nem aceita o evento nativo (preventDefault condicionado a podeCriar)', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  const onDragOver = /onDragOver=\{\(evento\) => \{([\s\S]*?)\}\}/u.exec(calendario);
  assert.ok(onDragOver, 'onDragOver precisa existir');
  assert.match(onDragOver[1], /if \(!podeCriar\) \{\s*return;\s*\}/u, 'sem podeCriar, onDragOver precisa retornar ANTES de preventDefault — só assim o navegador recusa o drop nativamente');
  const onDragEnter = /onDragEnter=\{\(\) => \{([\s\S]*?)\}\}/u.exec(calendario);
  assert.ok(onDragEnter, 'onDragEnter precisa existir');
  assert.match(onDragEnter[1], /if \(podeCriar\)/u, 'o realce visual de drag-over só pode acender quando podeCriar');
});

test('7. o drop em si também revalida podeCriar (defesa em profundidade, além do preventDefault)', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  const funcao = /function aoSoltarNoDia\(evento: DragEvent<HTMLDivElement>, data: string, podeReceber: boolean\) \{([\s\S]*?)\n {2}\}/u.exec(calendario);
  assert.ok(funcao, 'aoSoltarNoDia precisa aceitar um parâmetro podeReceber');
  assert.match(funcao[1], /if \(!podeReceber\) \{\s*return;\s*\}/u, 'o handler de drop precisa recusar quando podeReceber é false');
  assert.match(calendario, /onDrop=\{\(evento\) => aoSoltarNoDia\(evento, data, podeCriar\)\}/u, 'o drop precisa passar podeCriar para a função');
});

test('8. atribuições já existentes num dia de contexto continuam renderizadas — nunca escondidas/filtradas por esta regra', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  // As atribuições do dia (`atribuicoesDoDia`) vêm de `porDia.get(data)`, sem nenhum filtro condicionado a `contexto`/`podeCriar`.
  assert.doesNotMatch(calendario, /atribuicoesDoDia\.filter/u, 'nenhum filtro pode ser aplicado às atribuições já existentes de um dia');
  assert.match(calendario, /const atribuicoesDoDia = porDia\.get\(data\) \?\? \[\];/u);
});

test('9. nenhuma atribuição existente/importada é normalizada por esta regra — nenhuma chamada a dataPertenceCompetencia fora do gate de criação', async () => {
  const arquivos = await Promise.all([
    ler('lib/editorPlantao.ts'),
    ler('lib/conciliacaoPlantoes.ts'),
  ]);
  for (const fonteBruta of arquivos) {
    const fonte = semComentarios(fonteBruta);
    assert.doesNotMatch(fonte, /dataPertenceCompetencia/u, 'módulos que lidam com atribuições existentes/importadas nunca podem referenciar este gate');
  }
});

test('10. acessibilidade — o dia de contexto informa semanticamente (aria-label) que não aceita novos plantões, nunca só por cor', async () => {
  const calendario = semComentarios(await ler('components/plantao/PlantaoCalendario.tsx'));
  assert.match(calendario, /não aceita novos plantões/u, 'o aria-label do dia de contexto precisa explicar a restrição em texto');
});

test('11. nenhuma mudança em GrupoPlantao.padraoHorarioSemanal, ContextoEscalaAtivo, dirty guards, Firestore Rules ou schema nesta fase', async () => {
  const arquivos = [
    'packages/contrato/src/modeloPlantaoPersistente.ts',
    'lib/contextoEscala.ts',
    'firestore.rules',
    'firestore.indexes.json',
  ];
  for (const caminho of arquivos) {
    const conteudo = await ler(caminho);
    assert.doesNotMatch(conteudo, /dataPertenceCompetencia|podeIniciarAtribuicaoNaData/u, `${caminho} não pode conhecer o gate desta fase`);
  }
});
