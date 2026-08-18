import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/gu, '');

// Fase ESCALAS-SIMPLES-1 — simplificação de "Nova escala"/"Importar escala"
// com resolução automática de Área de gestão/equipe/Grupo de Plantão. Ver
// docs/spec/REDESIGN_WORKSPACE_ESCALAS.md, CHECKPOINT-FASE-ESCALAS-SIMPLES-1.md.

const SIGLAS_PROIBIDAS = ['COSI', 'SOC', 'NOC', 'CODB', 'GEDSI'];

test('1. lib/areaGestaoAtiva.ts nunca hardcoda sigla nenhuma — resolução 100% data-driven', async () => {
  const fonte = semComentarios(await ler('lib/areaGestaoAtiva.ts'));
  for (const sigla of SIGLAS_PROIBIDAS) {
    assert.doesNotMatch(fonte, new RegExp(`['"\`]${sigla}['"\`]`, 'u'), `nenhum literal "${sigla}" hardcoded`);
  }
});

test('2. as funções de resolução do wizard (escolherJornadaNovaEscala/escolherPlantaoNovaEscala) nunca hardcodam sigla', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['escolherJornadaNovaEscala', 'escolherPlantaoNovaEscala', 'criarEquipeWizardAcao', 'criarPlantaoWizardAcao']) {
    const corpo = new RegExp(`function ${nomeFuncao}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    for (const sigla of SIGLAS_PROIBIDAS) {
      assert.doesNotMatch(corpo[1], new RegExp(`['"\`]${sigla}['"\`]`, 'u'), `${nomeFuncao} não pode hardcodar "${sigla}"`);
    }
  }
});

test('3. a resolução de equipe/Grupo administráveis usa os helpers reais (equipesAdministraveisNaArea/gruposAdministraveisNaArea), nunca uma comparação por nome/sigla', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /equipesAdministraveisNaArea\(usuarioReal, equipesAdmin, areaGestaoAtivaId\)/u);
  assert.match(dashboard, /gruposAdministraveisNaArea\(usuarioReal, gruposPlantaoAdmin, equipesAdmin, areaGestaoAtivaId\)/u);
});

test('4. "Área de gestão ativa" nunca concede autorização — escolherAreaGestaoAtiva nunca chama salvarUsuario nem toca unidadesPermitidas/equipesPermitidas/perfil', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function escolherAreaGestaoAtiva\(unidadeId: string\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'escolherAreaGestaoAtiva precisa existir');
  assert.doesNotMatch(corpo[1], /salvarUsuario|unidadesPermitidas|equipesPermitidas|\.perfil\b/u, 'trocar de área ativa nunca pode alterar autorização');
  assert.match(corpo[1], /localStorage\.setItem/u, 'preferência é local/sessão, nunca Firestore');
});

test('5. o wizard nunca calcula "quem administra" sozinho — sempre delega para podeGerenciarEquipe/podeGerenciarGrupoPlantao (via os helpers de lib/areaGestaoAtiva.ts)', async () => {
  const areaGestao = semComentarios(await ler('lib/areaGestaoAtiva.ts'));
  assert.match(areaGestao, /podeGerenciarEquipe\(usuario, equipe\.id\)/u);
  assert.match(areaGestao, /podeGerenciarGrupoPlantao\(usuario, grupo\.equipeResponsavelId\)/u);
});

test('6. criação inline de equipe/Grupo nunca navega para Administração — nenhum setTela(\'administracao\') dentro de criarEquipeWizardAcao/criarPlantaoWizardAcao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  for (const nomeFuncao of ['criarEquipeWizardAcao', 'criarPlantaoWizardAcao']) {
    const corpo = new RegExp(`async function ${nomeFuncao}\\(\\) \\{([\\s\\S]*?)\\n {2}\\}`, 'u').exec(dashboard);
    assert.ok(corpo, `${nomeFuncao} precisa existir`);
    assert.doesNotMatch(corpo[1], /setTela\('administracao'\)/u, 'criação inline nunca pode navegar para Administração');
  }
});

test('7. criação inline reaproveita a MESMA escrita administrativa (salvarEquipeDoModal/salvarGrupoPlantaoDoModal) — nenhuma escrita Firestore duplicada', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const criarEquipe = /async function criarEquipeWizardAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(criarEquipe);
  assert.match(criarEquipe[1], /salvarEquipeDoModal\(novaEquipe\)/u);
  assert.doesNotMatch(criarEquipe[1], /setDoc|updateDoc|\bawait salvarEquipe\(/u, 'nunca uma segunda chamada de escrita direta — só via salvarEquipeDoModal');
  const criarPlantao = /async function criarPlantaoWizardAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(criarPlantao);
  assert.match(criarPlantao[1], /salvarGrupoPlantaoDoModal\(novoGrupo\)/u);
  assert.doesNotMatch(criarPlantao[1], /setDoc|updateDoc|\bawait salvarGrupoPlantao\(/u, 'nunca uma segunda chamada de escrita direta — só via salvarGrupoPlantaoDoModal');
});

test('8. equipe/Grupo criados inline nunca fecham o wizard inteiro — o fluxo continua (seleção automática do item recém-criado)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const criarEquipe = /async function criarEquipeWizardAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(criarEquipe);
  assert.match(criarEquipe[1], /selecionarEquipeWizard\(novaEquipe\.id\)|setWizardCriarPlantaoEquipeId\(novaEquipe\.id\)/u);
  const criarPlantao = /async function criarPlantaoWizardAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(criarPlantao);
  assert.match(criarPlantao[1], /selecionarGrupoWizard\(novoGrupo\.grupoId\)/u);
});

test('9. "Nova escala" e "Importar escala" abrem o MESMO wizard (abrirWizardEscala) — nenhum componente/fluxo paralelo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /function abrirNovaEscala\(\) \{\s*abrirWizardEscala\('NOVA'\);/u);
  assert.match(dashboard, /function abrirImportarEscala\(\) \{\s*abrirWizardEscala\('IMPORTAR'\);/u);
  const ocorrenciasModal = dashboard.match(/function ModalIniciarEscala\(/gu) ?? [];
  assert.equal(ocorrenciasModal.length, 1, 'só pode existir UM componente de wizard — nunca dois modais paralelos para Nova/Importar');
});

test('10. "Escalas" tem só DUAS ações primárias (Nova/Importar) — "Abrir grade" não é mais um botão de topo', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const bloco = /\{tela === 'escalas' && \(([\s\S]*?)<\/header>/u.exec(dashboard);
  assert.ok(bloco, 'o cabeçalho de "escalas" precisa existir');
  assert.doesNotMatch(bloco[1], />Abrir grade</u, '"Abrir grade" não pode mais ser uma ação de topo em "Escalas"');
});

test('11. o quick-add de Plantão sempre disponibiliza os três presets (12h/24h/5h) — importados de lib/editorPlantao.ts, nunca reimplementados', async () => {
  const popover = semComentarios(await ler('components/plantao/QuickAddPlantaoPopover.tsx'));
  assert.match(popover, /import \{[\s\S]*PRESETS_HORARIO_QUICK_ADD_PLANTAO[\s\S]*\} from '@\/lib\/editorPlantao';/u);
});

test('12. Área de gestão ativa nunca é lida do Firestore como fonte de autorização — só localStorage, e só dentro de autenticar()/encerrarSessao()', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const ocorrencias = dashboard.match(/setAreaGestaoEscolhaManual\(/gu) ?? [];
  assert.equal(ocorrencias.length, 3, 'só 3 pontos podem setar a preferência: autenticar(), encerrarSessao() e escolherAreaGestaoAtiva()');
});

test('13. criar equipe inline exige podeGerenciarUnidade (nunca podeGerenciarEquipe) — GESTOR_EQUIPE comum nunca vê o formulário, só a orientação de pedir a um gestor de unidade', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const podeCriarEquipeNaAreaAtiva = usuarioReal !== null\s*&& areaGestaoAtivaId !== null\s*&& podeGerenciarUnidade\(usuarioReal, areaGestaoAtivaId\);/u);
  const corpo = /async function criarEquipeWizardAcao\(\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /if \(usuarioReal === null \|\| !podeCriarEquipeNaAreaAtiva\)/u, 'o handler precisa recusar a criação quando o usuário não pode gerenciar a unidade — mesma regra da Rule de equipes');
});
