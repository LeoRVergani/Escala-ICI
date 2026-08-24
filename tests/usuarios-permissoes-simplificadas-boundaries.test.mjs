import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — ver
// lib/perfilAcessoUsuario.ts (helper puro) e o bloco "Permissões" em
// apps/dashboard/src/DashboardApp.tsx.

test('1. camposAdministrativos (souAdmin) agora grava equipeId explicitamente — bug real corrigido (equipesPermitidas certo, equipeId nunca gravado)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const bloco = /const camposAdministrativos: Partial<Usuario> = souAdmin && participanteVinculoCadastro === null\s*\?\s*\{([\s\S]*?)\}\s*:/u.exec(dashboard);
  assert.ok(bloco, 'bloco camposAdministrativos (ramo souAdmin) precisa existir');
  assert.match(bloco[1], /equipeId: formularioUsuario\.equipeId,/u, 'equipeId precisa ser gravado a partir do formulário no cadastro/edição administrativa');
});

test('2. abrirEdicaoUsuario carrega equipeId real do usuário editado (nunca herda a equipe de quem edita)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirEdicaoUsuario\(item: Usuario\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirEdicaoUsuario precisa existir');
  assert.match(corpo[1], /equipeId: item\.equipeId,/u);
  assert.match(corpo[1], /tipoAcesso: tipoAcessoDoUsuario\(item\),/u);
});

test('3. o bloco "Permissões" oferece o seletor "Tipo de acesso" com as 5 opções simples', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /<legend>Permissões<\/legend>/u);
  assert.match(dashboard, /Tipo de acesso/u);
  for (const opcao of ['COLABORADOR', 'SUPERVISOR_EQUIPE', 'GESTOR_EQUIPE', 'GESTOR_UNIDADE', 'ADMIN_SISTEMA']) {
    assert.match(dashboard, new RegExp(`<option value="${opcao}">`, 'u'), `opção ${opcao} precisa existir no seletor`);
  }
  assert.doesNotMatch(dashboard, /Administração \(perfil\/escopo\/organização\)/u, 'o legend antigo precisa ter sido substituído');
});

test('4. os campos técnicos (perfil/escopo/unidadeId/equipeId/unidadesPermitidas/equipesPermitidas) ficam dentro de uma área "Avançado" recolhida por padrão', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const bloco = /<details className="advanced-fields">([\s\S]*?)<\/details>/u.exec(dashboard);
  assert.ok(bloco, 'área <details> "Avançado" precisa existir');
  assert.match(bloco[0], /<summary>Avançado<\/summary>/u);
  assert.doesNotMatch(bloco[0], /<details className="advanced-fields" open>/u, 'não pode vir aberta por padrão');
  assert.match(bloco[1], />\s*Perfil\s*</u);
  assert.match(bloco[1], />\s*Escopo\s*</u);
  assert.match(bloco[1], /Unidade organizacional/u);
  assert.match(bloco[1], /Unidades permitidas \(GESTOR_UNIDADE\)/u);
  assert.match(bloco[1], /Equipes permitidas/u);
});

test('5. texto de ajuda "os campos técnicos são preenchidos automaticamente" existe fora do Avançado', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /Os\s*\n?\s*campos técnicos são preenchidos automaticamente\./u);
});

test('6. resumo visual antes de salvar usa resumoAcessoUsuario() — nunca um texto fixo com nome real de equipe', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.match(dashboard, /resumoAcessoUsuario\(/u);
  assert.doesNotMatch(dashboard, /Este usuário poderá administrar: NOC/u, 'nunca hardcodar NOC no texto do resumo');
});

test('7. Administrador do sistema exige confirmação antes de salvar, mesmo vindo do Avançado (perfil final decide, não só o seletor simples)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /exigeConfirmacaoGlobal = candidato\.perfil === 'ADMIN_SISTEMA' \|\| candidato\.escopo === 'GLOBAL';/u);
  assert.match(dashboard, /validarCoerenciaAcessoUsuario\(candidato\)/u);
});

test('8. nenhum nome ou login real (Wanessa Moriyama / wmoriyama) hardcoded no Dashboard ou no helper puro', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const helper = await ler('lib/perfilAcessoUsuario.ts');
  for (const termo of ['Wanessa Moriyama', 'wmoriyama']) {
    assert.doesNotMatch(dashboard, new RegExp(termo, 'u'));
    assert.doesNotMatch(helper, new RegExp(termo, 'u'));
  }
});

test('9. script de correção staging é dry-run por padrão e exige --confirm=CORRIGIR_SUPERVISOR_EQUIPE para executar, sem hardcode de login/equipe', async () => {
  const script = await ler('scripts/staging/corrigir-usuario-supervisor-equipe.mjs');
  assert.match(script, /execute: argv\.includes\('--execute'\),/u);
  assert.match(script, /confirmado: argv\.includes\(`--confirm=\$\{CONFIRMACAO\}`\),/u);
  assert.match(script, /const CONFIRMACAO = 'CORRIGIR_SUPERVISOR_EQUIPE';/u);
  assert.doesNotMatch(script, /login === 'wmoriyama'|equipeId === 'GEDSI_CODB_NOC'/u, 'nunca hardcodar o caso Wanessa/NOC na lógica do script');
  assert.match(script, /perfil: 'SUPERVISOR_EQUIPE',/u);
  assert.doesNotMatch(script, /'ADMIN_SISTEMA'|escopo: 'GLOBAL'/u, 'o script nunca pode criar admin nem escopo global');
});

test('10. Firestore Rules não foram tocadas nesta fase', async () => {
  const rules = await ler('firestore.rules');
  assert.doesNotMatch(rules, /PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1/u);
});
