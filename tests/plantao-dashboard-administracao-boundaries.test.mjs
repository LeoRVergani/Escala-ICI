import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PLANTÃO-3B: administração de Grupos/participantes/contatos/rascunho
// no Dashboard. Ver docs/spec/PLANTOES.md, seção 21, e
// docs/spec/HIERARQUIA_ORGANIZACIONAL.md, §§ 7 e 9.

test('1. nenhuma unidade/equipe real (COSI/CODB/SOC/NOC/GEDSI) aparece hardcoded na autorização de Plantão', async () => {
  const [sessao, rules] = await Promise.all([ler('lib/sessao.ts'), ler('firestore.rules')]);
  for (const fonte of [sessao, rules]) {
    for (const proibido of ['COSI', 'CODB', 'GEDSI', 'EQ_SOC', 'EQ_NOC']) {
      assert.doesNotMatch(fonte, new RegExp(`['"\`]${proibido}['"\`]`, 'u'), `${proibido} não pode ser um literal de autorização`);
    }
  }
});

test('2. podeGerenciarGrupoPlantao() continua exigindo souGestor() && podeOperarNaEquipe() nas Rules — nunca só pertencimento', async () => {
  const rules = await ler('firestore.rules');
  const match = /function podeGerenciarGrupoPlantao\(grupoDoc\) \{([\s\S]*?)\n\s*\}/u.exec(rules);
  assert.ok(match, 'podeGerenciarGrupoPlantao() precisa continuar existindo em firestore.rules');
  assert.match(match[1], /souGestor\(\)/u, 'precisa checar souGestor()');
  assert.match(match[1], /podeOperarNaEquipe\(/u, 'precisa checar podeOperarNaEquipe()');
});

/**
 * Fase ESCOPO-GESTOR-UNIDADE-1 — mudança de regra aprovada
 * (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`): até essa fase,
 * `GESTOR_UNIDADE` nunca aparecia em `souGestorDePlantao()`. Agora aparece
 * (gate de VISIBILIDADE de tela), mas a autorização real de cada Grupo
 * (`podeGerenciarGrupoPlantao()`) continua exigindo `souGestor()` (via
 * `podeOperarNaEquipe()`) OU um caminho novo e igualmente restrito por
 * escopo: `GESTOR_UNIDADE` só quando `unidadeResponsavelId` do Grupo está
 * em `unidadesPermitidasEfetivas()` — nunca "qualquer GESTOR_UNIDADE
 * administra qualquer Plantão".
 */
test('3. o mirror client-side (lib/sessao.ts) também exige ser gestor OU unidade responsável em escopo — nunca só pertencer à equipe', async () => {
  const sessao = await ler('lib/sessao.ts');
  assert.match(sessao, /export function podeGerenciarGrupoPlantao/u);
  assert.match(sessao, /export function souGestorDePlantao/u);
  assert.match(sessao, /perfil === 'GESTOR_UNIDADE'/u, 'GESTOR_UNIDADE precisa ter um caminho de autorização explícito');
  const corpoPode = /export function podeGerenciarGrupoPlantao\([\s\S]*?\n\): boolean \{([\s\S]*?)\n\}/u.exec(sessao)?.[1] ?? '';
  assert.match(corpoPode, /unidadeResponsavelId/u, 'GESTOR_UNIDADE só administra via unidadeResponsavelId, nunca sem escopo');
  assert.match(corpoPode, /unidadesPermitidasEfetivas\(/u, 'o escopo de unidade continua vindo de unidadesPermitidasEfetivas()');
});

test('4. Equipe (lib/modelos.ts) nunca ganha um array inverso de ACL de Plantão — equipesConsulta vive só em GrupoPlantao', async () => {
  const modelos = await ler('lib/modelos.ts');
  const equipeInterface = /export interface Equipe \{([\s\S]*?)\n\}/u.exec(modelos)?.[1] ?? '';
  for (const proibido of ['plantoesVisiveis', 'gruposPlantao', 'equipesConsulta', 'plantaoIds']) {
    assert.doesNotMatch(equipeInterface, new RegExp(proibido, 'u'), proibido);
  }
});

/**
 * 5. Fase UI-ORG-1: o seletor de equipe responsável/equipesConsulta do
 * ModalGrupoPlantao passou a ser o `OrganizationTeamPicker` reutilizável
 * (antes, um `<select>` plano com `trechoFinalCaminho()` — ver Fase
 * PLANTÃO-3B). Continua reaproveitando `lib/organizacao.ts`
 * (`construirArvoreOrganizacional`), só que agora indiretamente via o
 * componente compartilhado — nunca uma segunda árvore/seletor próprio.
 */
test('5. o seletor de equipe responsável do ModalGrupoPlantao reaproveita OrganizationTeamPicker/lib/organizacao.ts, nunca uma segunda árvore', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const inicio = dashboard.indexOf('function ModalGrupoPlantao');
  const fim = dashboard.indexOf('\nfunction ModalContatosParticipante');
  assert.ok(inicio > 0 && fim > inicio, 'ModalGrupoPlantao precisa existir antes de ModalContatosParticipante');
  const corpo = dashboard.slice(inicio, fim);
  assert.match(corpo, /OrganizationTeamPicker/u, 'precisa reaproveitar o OrganizationTeamPicker compartilhado');
  assert.match(corpo, /construirArvoreOrganizacional\(/u, 'precisa montar a árvore via lib/organizacao.ts, nunca uma própria');
  assert.match(corpo, /equipesConsultaEfetivas\(/u, 'precisa reaproveitar equipesConsultaEfetivas() do contrato, nunca recalcular a regra na mão');
  assert.doesNotMatch(corpo, /\.parentId\s*===/u, 'não pode reimplementar travessia de parentId dentro do modal');
  assert.doesNotMatch(corpo, /function construirArvore/u, 'não pode declarar uma segunda função de montagem de árvore');
});

test('6. o Dashboard publica Plantão somente por uma ação explícita', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const corpo = semComentarios(dashboard);
  // Fase ESCALAS-UX-2A — 'plantoes' deixou de ser um item de NAVEGACAO
  // (agora é a sub-tela "Grupos de Plantão" de Administração, ver
  // docs/spec/REDESIGN_WORKSPACE_ESCALAS.md § 10/§ 27); o bloco de
  // renderização `tela === 'plantoes'` continua existindo e é o âncora
  // atual, no lugar do antigo item de array `id: 'plantoes'`.
  const inicioNav = corpo.indexOf("tela === 'plantoes'");
  assert.ok(inicioNav > 0, 'a tela interna "plantoes" precisa continuar existindo');
  assert.match(corpo, /Publicar Plantão/iu);
  assert.match(corpo, /publicarPlantaoAcao/u);
  assert.match(corpo, /publicarCompetenciaPlantao\(/u);
});

test('7. apps/app (colaborador) continua sem qualquer símbolo novo desta fase', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  for (const proibido of [
    'plantaoWriteRepository',
    'plantaoReadRepository',
    'ModalGrupoPlantao',
    'ModalContatosParticipante',
    'montagemRascunhoPlantao',
    'podeGerenciarGrupoPlantao',
    'souGestorDePlantao',
    'listarTodosGruposPlantao',
  ]) {
    assert.doesNotMatch(app, new RegExp(proibido), proibido);
  }
});

test('8. apps/push-worker continua sem qualquer menção a Plantão', async () => {
  const arquivos = await Promise.all([
    ler('apps/push-worker/src/deliveryOrchestrator.ts').catch(() => ''),
    ler('apps/push-worker/src/config.ts').catch(() => ''),
  ]);
  for (const fonte of arquivos) {
    assert.doesNotMatch(fonte, /plantao/iu, 'push-worker não deve mencionar Plantão nesta fase');
  }
});

test('9. o ícone novo de navegação ("plantao") é aditivo em components/AppFrame.tsx — nunca usado pelo App do colaborador', async () => {
  const [appFrame, app] = await Promise.all([
    ler('components/AppFrame.tsx'),
    ler('apps/app/src/EmployeeApp.tsx'),
  ]);
  assert.match(appFrame, /plantao: Radio/u, 'o ícone precisa estar mapeado em AppFrame.tsx');
  assert.doesNotMatch(app, /icone:\s*['"]plantao['"]/u, 'o App do colaborador nunca usa o ícone de Plantão');
});

test('10. lib/montagemRascunhoPlantao.ts é puro — sem SDK do Firestore, sem React', async () => {
  const fonte = semComentarios(await ler('lib/montagemRascunhoPlantao.ts'));
  for (const proibido of ["from 'firebase/firestore'", "from 'react'", 'useState', 'useEffect', 'getFirestore']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('11. o rascunho de Plantão continua gravado só em rascunhosCompetenciasPlantao — nunca em competenciasPlantao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.doesNotMatch(dashboard, /['"]competenciasPlantao['"]/u, 'o Dashboard nunca referencia a coleção PUBLICADA diretamente');
});

test('12. participantes de Plantão nunca são excluídos fisicamente pelo Dashboard — só desativados', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /desativarParticipantePlantao/u, 'o Dashboard precisa oferecer desativação de participante');
  assert.doesNotMatch(dashboard, /excluirParticipantePlantao|deleteDoc\([^)]*participantes/u, 'nenhuma exclusão física de participante');
});
