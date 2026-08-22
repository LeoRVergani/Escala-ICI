import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1 — Parte B: filtro de
// setor/equipe na tela Usuários. Ver docs/spec/EDITOR_ESCALAS.md,
// docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md.

test('1. lib/usuariosTelaFiltros.ts existe e exporta as funções puras de classificação/busca', async () => {
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  assert.match(modulo, /export function opcoesFiltroSetorUsuariosPlantao\(/u);
  assert.match(modulo, /export function usuarioPertenceAoFiltroSetorPlantao\(/u);
  assert.match(modulo, /export function usuarioCorrespondeBuscaTextual\(/u);
  assert.match(modulo, /export const FILTRO_SETOR_TODOS = 'todos';/u);
});

test('2. a tela Usuários aplica a ordem correta: pool do contexto (usuarios) -> filtro de setor -> busca textual', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /const usuariosAposFiltroSetor = grupoPlantaoParaFiltroUsuarios !== undefined\s*\? usuarios\.filter\(\(item\) => usuarioPertenceAoFiltroSetorPlantao\(item, filtroSetorUsuario, grupoPlantaoParaFiltroUsuarios, loginsParticipantesAtivosDoGrupoAtivo\)\)\s*: usuarios;/u,
    'o filtro de setor precisa partir do pool `usuarios` já carregado pelo contexto — nenhuma consulta nova',
  );
  assert.match(
    dashboard,
    /const usuariosFiltrados = usuariosAposFiltroSetor\.filter\(\(item\) => usuarioCorrespondeBuscaTextual\(item, buscaUsuario\)\);/u,
    'a busca textual precisa rodar POR CIMA do resultado do filtro de setor, nunca do pool bruto',
  );
});

test('3. o pool completo do contexto NUNCA é substituído — grupoPlantaoParaFiltroUsuarios só CLASSIFICA `usuarios`, nunca dispara uma consulta nova (nenhuma chamada a listarUsuarios*/getDocs nos derivados desta fase)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const bloco = /const grupoPlantaoParaFiltroUsuarios = [\s\S]*?const usuariosFiltrados = usuariosAposFiltroSetor\.filter\(\(item\) => usuarioCorrespondeBuscaTextual\(item, buscaUsuario\)\);/u.exec(dashboard);
  assert.ok(bloco, 'o bloco de derivados do filtro de Usuários precisa existir');
  assert.doesNotMatch(bloco[0], /listarUsuarios|getDocs|await /u, 'só pode reclassificar o pool já carregado — nenhuma leitura nova');
});

test('4. o seletor de setor só aparece quando o contexto ativo é um Grupo de Plantão — contexto Jornada (SOC) mantém o comportamento atual, sem seletor', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /const grupoPlantaoParaFiltroUsuarios = contextoEhPlantao\(contextoEscalaAtivo\)\s*\? gruposPlantaoAdmin\.find\(\(item\) => item\.grupoId === contextoEscalaAtivo\.alvoId\)\s*: undefined;/u,
  );
  assert.match(dashboard, /\{opcoesFiltroSetorUsuarios\.length > 0 && \(/u, 'o <select> só pode renderizar quando há opções (contexto Plantão)');
});

test('5. as opções do seletor nunca hardcodam sigla — vêm de opcoesFiltroSetorUsuariosPlantao(grupo, nomePorEquipeId, nomePorUnidadeId), geradas a partir do próprio Grupo', async () => {
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  for (const sigla of ['COSI', 'SOC', 'NOC', 'CODB', 'GEDSI']) {
    assert.doesNotMatch(modulo, new RegExp(`['"\`]${sigla}`, 'u'), `nenhum literal "${sigla}" hardcoded em usuariosTelaFiltros.ts`);
  }
});

test('6. critério "Plantão": equipeId da equipe responsável OU cadastroOperacional PLANTAO deste grupo OU login participante ativo publicado', async () => {
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  const corpo = /export function usuarioPertenceAoFiltroSetorPlantao\([\s\S]*?\n\}/u.exec(modulo);
  assert.ok(corpo);
  assert.match(corpo[0], /usuario\.equipeId === grupo\.equipeResponsavelId/u);
  assert.match(corpo[0], /usuario\.cadastroOperacional\?\.tipo === 'PLANTAO' && usuario\.cadastroOperacional\.alvoId === grupo\.grupoId/u);
  assert.match(corpo[0], /loginsParticipantesAtivos\.has\(usuario\.login\)/u);
});

test('7. critério "unidade inteira": unidadeId OU unidadesPermitidas contendo a unidade responsável do Grupo', async () => {
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  const corpo = /export function usuarioPertenceAoFiltroSetorPlantao\([\s\S]*?\n\}/u.exec(modulo);
  assert.ok(corpo);
  assert.match(corpo[0], /usuario\.unidadeId === grupo\.unidadeResponsavelId/u);
  assert.match(corpo[0], /\(usuario\.unidadesPermitidas \?\? \[\]\)\.includes\(grupo\.unidadeResponsavelId\)/u);
});

test('8. o filtro nunca duplica usuário nenhum — cada opção de setor é um .filter() simples sobre o mesmo pool, nunca uma concatenação/merge de arrays', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /usuariosAposFiltroSetor = \[\.\.\./u, 'nunca pode ser uma concatenação — só um filter sobre `usuarios`');
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  assert.doesNotMatch(modulo, /\.concat\(|\[\.\.\.\w+, \.\.\.\w+\]/u, 'a classificação de setor nunca pode unir duas listas — só decide inclusão/exclusão de um pool já deduplicado');
});

test('9. busca textual cobre nome/login/e-mail/aliases/cargo — nunca só nome+login como antes', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(
    dashboard,
    /\.filter\(\(item\) => `\$\{item\.nome\} \$\{item\.login\}`\.toLowerCase\(\)\.includes\(buscaUsuario\.toLowerCase\(\)\)\)/u,
    'a busca antiga (só nome+login) não pode sobreviver na tela Usuários',
  );
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  const corpo = /export function usuarioCorrespondeBuscaTextual\([\s\S]*?\n\}/u.exec(modulo);
  assert.ok(corpo);
  assert.match(corpo[0], /usuario\.nome/u);
  assert.match(corpo[0], /usuario\.login/u);
  assert.match(corpo[0], /usuario\.email/u);
  assert.match(corpo[0], /usuario\.cargo/u);
  assert.match(corpo[0], /loginAliases/u);
  assert.match(corpo[0], /aliasesPlanilha/u);
});

test('10. contador mostra "N usuários" quando o filtro/busca não reduz nada, e "M de N usuários" quando reduz', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /usuariosFiltrados\.length === usuarios\.length\s*\? `\$\{usuarios\.length\} usuário\$\{usuarios\.length === 1 \? '' : 's'\}`\s*: `\$\{usuariosFiltrados\.length\} de \$\{usuarios\.length\} usuários`/u);
});

test('11. estado vazio mostra "Nenhum usuário encontrado para este filtro." em vez de uma tabela vazia', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /\{usuariosFiltrados\.length === 0 \? \(\s*<p className="empty-inline">Nenhum usuário encontrado para este filtro\.<\/p>/u);
});

test('12. trocar de contexto (aplicarTrocaContexto) sempre reseta o filtro de setor para "Todos" — nunca herda um id de equipe/grupo que pode não existir no novo contexto', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {2}\}\n/u.exec(dashboard);
  assert.ok(corpo);
  assert.match(corpo[1], /setFiltroSetorUsuario\(FILTRO_SETOR_TODOS\);/u);
  const indiceReset = corpo[1].indexOf('setFiltroSetorUsuario(FILTRO_SETOR_TODOS);');
  const indiceBranchPlantao = corpo[1].indexOf("if (alvo.tipo === 'PLANTAO')");
  assert.ok(indiceReset >= 0 && indiceBranchPlantao >= 0 && indiceReset < indiceBranchPlantao, 'o reset precisa acontecer antes de qualquer branch de contexto');
});

test('13. o filtro/busca nunca altera perfil/escopo/equipeId/cargo/participação — são funções puras de leitura, DashboardApp só chama setFiltroSetorUsuario/setBuscaUsuario (estado de UI)', async () => {
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  for (const proibido of ['setDoc', 'updateDoc', 'writeBatch', 'firebase/firestore', 'salvarUsuario']) {
    assert.doesNotMatch(modulo, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('14. usuários inativos continuam com a mesma visibilidade de antes — o filtro de setor/busca nunca introduz nem remove um critério de `ativo`', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const modulo = semComentarios(await ler('lib/usuariosTelaFiltros.ts'));
  assert.doesNotMatch(modulo, /\.ativo\b/u, 'a classificação de setor/busca nunca deve depender de `ativo` — isso continua só no badge/botão Ativar já existentes');
  // O badge de status e o botão Ativar/Desativar continuam existindo, sem mudança.
  assert.match(dashboard, /\{item\.ativo \? 'Ativo' : 'Inativo'\}/u);
  assert.match(dashboard, /title=\{item\.ativo \? 'Desativar' : 'Ativar'\}/u);
});
